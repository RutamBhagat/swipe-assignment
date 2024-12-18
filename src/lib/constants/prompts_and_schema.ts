import {
  combinedGeminiInvoiceSchema,
  combinedZodInvoiceSchema,
} from "../validations/invoice-generate";
import {
  geminiPurchaseOrderSchema,
  zodPurchaseOrderSchema,
} from "../validations/purchase-order-generate";

export const GEMINI_PROMPTS = {
  EXTRACTION_PROMPT: {
    prompt: `
      You are a specialized data extraction assistant. Your task is to analyze invoice documents and extract structured information into a JSON format strictly adhering to the provided schema.  Output ONLY valid JSON. No explanatory text, markdown, or any other content is permitted.
      Key Instructions:
      1. Customer Details: Prioritize "Buyer". If unavailable, use "Consignee". If both are unavailable, use an empty string "".
      2. Line Items: Each line item represents a unique product on the invoice. Extract product details, quantity, price, and tax. Use column headers ("Sl", "Description", "Rate/Item", "Quantity", "Taxable Value", "GST Amount", "Amount", "Per", "Tax") as guides. If the tax is included in the price, set \`tax\` to \`null\`. If the tax is indeterminable, also set it to \`null\`.
      3. Tax Calculation: If both CGST and SGST are present, sum them. If only IGST is present, use its value. For individual products, calculate tax proportionally based on the total tax and the product's price. If the tax is uncalculable, set \`tax\` to \`null\`.
      4. Discounts: If discount information is available, attempt to calculate missing amounts or percentages. If discounts are unavailable or ambiguous, set \`discount\` to \`null\`.
      5. Total Amount: Use the value from "Amount Payable" as the \`totalAmount\`.
      6. Currency: If "₹" or "Rupees" are present, use "INR". If no currency is specified, use "USD".  Do not infer currency from other clues (e.g., addresses).
      7. Missing Data:  For numeric fields, use \`null\`. For text fields, use "".
      8. Multiple Products/Invoice: Generate separate invoice entries for each unique product on the invoice, distributing quantities, prices, and taxes accordingly.
      9. IDs: If IDs are missing, generate unique ones using these prefixes: "INV-" for invoices, "CUST-" for customers, and "PROD-" for products.
      10. Date Format: Use the format YYYY-MM-DD. If the date is invalid or unavailable, use \`null\`.
      11. Phone Number: If available, extract the phone number from the "Buyer" or "Consignee" fields. If unavailable, use "".
      12. Output:  Valid JSON only, matching the provided schema. Disregard "Place of Supply", "Total amount (in words)", and "Beneficiary Name". No other output allowed.  All missing or ambiguous fields should be represented by their respective null values as described above.
      Example Output:
      {
        "invoices": [
          {
            "invoiceId": "INV-1",
            "serialNumber": null,
            "customerId": "CUST-1",
            "customerName": "Test Assam",
            "productId": "PROD-1",
            "productName": "gertgerg rfreferf",
            "quantity": 1,
            "tax": null,
            "totalAmount": 0,
            "date": "2024-11-04",
            "currency": "INR"
          }
        ],
        "products": [
          {
            "productId": "PROD-1",
            "productName": "gertgerg rfreferf",
            "quantity": 1,
            "unitPrice": 0,
            "tax": null,
            "priceWithTax": 0,
            "currency": "INR",
            "discount": null
          }
        ],
        "customers": [
          {
            "customerId": "CUST-1",
            "customerName": "Test Assam",
            "phoneNumber": "",
            "totalPurchaseAmount": 3061814.98,
            "currency": "INR"
          }
        ]
      }
    `,
    zod_schema: combinedZodInvoiceSchema,
    gemini_schema: combinedGeminiInvoiceSchema,
  },
  PROCESSING_ORDER: {
    prompt: `PROCESSING_ORDER`,
    zod_schema: zodPurchaseOrderSchema,
    gemini_schema: geminiPurchaseOrderSchema,
  },
  CLASSIFY: {
    prompt: `
      You are a Purchase Order (PO) classifier. Analyze "extractedData" to determine if it's a PO. Emails are pre-filtered. Maximize accuracy even if language isn't explicit. Classify iteratively: subject first ("Purchase Order", "PO #..."), if inconclusive check body, then context, finally attachment name if needed. Manually correctable confidence will be used for future learning.
      Positive Indicators (ranked confidence, highest to lowest):
      Highest: Explicit "Purchase Order", "PO", "P.O.", "Our PO" + number. "PO Number:" with a value.
      High: Language implying order placement/confirmation, e.g., "attached our Purchase Order", "placing an order", "confirms your order", "process the order", "acknowledge receipt", "Accept this purchase order", "Order has been placed", "arrange the material"/"confirm the order"/"delivery date"/"please find attached our order" + PO number.
      Medium: Item descriptions, quantities, units, pricing, delivery dates, terms, buyer/seller names.
      Low: Filenames like "PurchaseOrder_1234.pdf", "PO-ABC-Company.xlsx" (only if confidence is borderline).
      Confidence Assignment:
      Subject has explicit PO mention without rejection keywords: high confidence.
      Subject inconclusive, body has strong confirmation language: high confidence, else low confidence
      Subject or body has contextual info: medium confidence.
      Attachment has relevant PO name and confidence is between cutoff: low confidence.
      Output: {
        "isPurchaseOrder": true/false, 
        "confidence": "HIGH" #or MEDIUM or LOW
      }
      Case-insensitive keywords: "PO", "po", "Po". Allow variations like "Purchase Order Number", "Order Number".
      INPUT:
    `,
    zod_schema: zodPurchaseOrderSchema,
    gemini_schema: geminiPurchaseOrderSchema,
  },
};
