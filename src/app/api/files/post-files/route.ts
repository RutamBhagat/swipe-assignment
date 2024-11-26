import { GoogleAIFileManager } from "@google/generative-ai/server";
import { type NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { consola } from "consola";
import { fileUploadApiSchema } from "@/lib/validations/file";
import { env } from "@/env";
import * as XLSX from "xlsx";

// Constants
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
// const UPLOAD_DIR = "/tmp";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const EXCEL_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

class FileUploadError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
    public status: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = "FileUploadError";
  }
}

interface UploadResult {
  filePath: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

function createErrorResponse(error: FileUploadError): NextResponse {
  consola.error({
    message: `File upload error: ${error.message}`,
    code: error.code,
    cause: error.cause,
  });

  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
    },
    { status: error.status },
  );
}

async function cleanupFile(filePath: string): Promise<void> {
  try {
    // await fs.access(filePath);
    // await fs.unlink(filePath);
  } catch (error) {
    consola.warn(`Failed to cleanup file ${filePath}:`, error);
  }
}

async function convertExcelToCSV(
  file: Buffer,
  fileName: string,
): Promise<UploadResult> {
  try {
    const workbook: XLSX.WorkBook = XLSX.read(file);
    if (!workbook.SheetNames.length) {
      throw new FileUploadError(
        "Excel file is empty",
        null,
        400,
        "EMPTY_EXCEL_FILE",
      );
    }

    const firstSheetName: string | undefined = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new FileUploadError(
        "No sheet found in Excel file",
        null,
        400,
        "NO_SHEET_FOUND",
      );
    }

    const worksheet: XLSX.WorkSheet | undefined =
      workbook.Sheets[firstSheetName];
    if (!worksheet) {
      throw new FileUploadError(
        "Failed to read Excel worksheet",
        null,
        500,
        "WORKSHEET_READ_ERROR",
      );
    }

    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const buffer = Buffer.from(csvContent);

    if (buffer.length > MAX_FILE_SIZE) {
      throw new FileUploadError(
        "Converted CSV file exceeds size limit",
        null,
        400,
        "CONVERTED_FILE_TOO_LARGE",
      );
    }

    const csvFileName = fileName.replace(/\.[^.]+$/, ".csv");
    const filePath = path.join(UPLOAD_DIR, `${Date.now()}-${csvFileName}`);
    await fs.writeFile(filePath, csvContent, "utf8");

    return {
      filePath,
      buffer,
      mimeType: "text/csv",
      fileName: csvFileName,
    };
  } catch (error) {
    if (error instanceof FileUploadError) throw error;
    throw new FileUploadError(
      "Failed to convert Excel to CSV",
      error,
      500,
      "EXCEL_CONVERSION_FAILED",
    );
  }
}

async function validateAndProcessFile(file: File): Promise<UploadResult> {
  if (!file) {
    throw new FileUploadError("No file uploaded", null, 400, "NO_FILE");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new FileUploadError(
      "File size exceeds 2GB limit",
      null,
      400,
      "FILE_TOO_LARGE",
    );
  }

  const validateResult = fileUploadApiSchema.safeParse({
    file: {
      name: file.name,
      type: file.type,
      size: file.size,
    },
  });

  if (!validateResult.success) {
    throw new FileUploadError(
      validateResult.error.errors[0]?.message || "Invalid file format",
      null,
      400,
      "INVALID_FILE_FORMAT",
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const isExcelFile = EXCEL_MIME_TYPES.includes(file.type);

  if (isExcelFile) {
    return await convertExcelToCSV(buffer, file.name);
  }

  const fileName = `${Date.now()}-${file.name}`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  await fs.writeFile(filePath, buffer);

  return {
    filePath,
    buffer,
    mimeType: file.type,
    fileName,
  };
}

async function initializeFileManager(): Promise<GoogleAIFileManager> {
  try {
    return new GoogleAIFileManager(env.GEMINI_API_KEY);
  } catch (error) {
    throw new FileUploadError(
      "Failed to initialize Google AI file manager",
      error,
      500,
      "INIT_FAILED",
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  consola.info(`Starting file upload request ${requestId}`);
  const startTime = Date.now(); // Start time

  let processedFile: UploadResult | null = null;

  try {
    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const fileManager = await initializeFileManager();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new FileUploadError("No file uploaded", null, 400, "NO_FILE");
    }

    processedFile = await validateAndProcessFile(file);

    const uploadResponse = await fileManager.uploadFile(
      processedFile.filePath,
      {
        mimeType: processedFile.mimeType,
        displayName: processedFile.fileName,
      },
    );

    consola.success(`File upload successful for request ${requestId}`);

    return NextResponse.json({
      message: "File uploaded successfully",
      fileUri: uploadResponse.file.uri,
      displayName: uploadResponse.file.displayName,
      mimeType: uploadResponse.file.mimeType,
      requestId,
    });
  } catch (error) {
    const fileUploadError =
      error instanceof FileUploadError
        ? error
        : new FileUploadError(
            "Failed to upload file to Google AI",
            error,
            500,
            "UPLOAD_FAILED",
          );

    return createErrorResponse(fileUploadError);
  } finally {
    // Cleanup temporary file
    if (processedFile?.filePath) {
      await cleanupFile(processedFile.filePath);
    }
    const endTime = Date.now(); // End time
    const durationMs = endTime - startTime;
    const durationSec = (durationMs / 1000).toFixed(2);
    consola.info(
      `Request ${requestId} completed in ${durationMs}ms (${durationSec}s)`,
    );
  }
}
