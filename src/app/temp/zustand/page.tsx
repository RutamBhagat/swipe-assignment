"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import dynamic from "next/dynamic";
import { useDataStoreContext } from "@/providers/data-store-provider";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUploadStoreContext } from "@/providers/upload-store-provider";

// Type the dynamic import
const DynamicJsonDisplay = dynamic(
  () => import("@/components/json-display").then((mod) => mod.JsonDisplay),
  {
    ssr: false,
  },
);

export default function StoreDebugger() {
  const { invoices, products, customers, processedFiles, removeProcessedFile } =
    useDataStoreContext(
      useShallow((state) => ({
        invoices: state.invoices,
        products: state.products,
        customers: state.customers,
        processedFiles: state.processedFiles,
        removeProcessedFile: state.removeProcessedFile,
      })),
    );

  const { files, isUploading, isLoading } = useUploadStoreContext(
    useShallow((state) => ({
      files: state.files,
      isUploading: state.isUploading,
      isLoading: state.isLoading,
    })),
  );

  // useEffect(() => {
  //   [
  //     "https://generativelanguage.googleapis.com/v1beta/files/ywdx053bt3l3",
  //     "https://generativelanguage.googleapis.com/v1beta/files/gbsqu7pai68o",
  //     "https://generativelanguage.googleapis.com/v1beta/files/7gahzvw7cs0n",
  //     "https://generativelanguage.googleapis.com/v1beta/files/td33p8xupsli",
  //   ].map((inst) => {
  //     removeProcessedFile(inst);
  //   });
  // }, []);

  return (
    <Tabs defaultValue="files" className="mx-auto w-full max-w-7xl">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="files">Files</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
      </TabsList>

      <TabsContent value="files">
        {files && Object.keys(files).length > 0 ? (
          <DynamicJsonDisplay
            title="File Management"
            description="View and manage your uploaded files here."
            data={{
              files,
              isUploading,
              isLoading,
            }}
          />
        ) : (
          <p>No files uploaded yet.</p>
        )}
      </TabsContent>

      <TabsContent value="data">
        {invoices || products || customers || processedFiles ? (
          <DynamicJsonDisplay
            title="Store Data"
            description="Debug view of the current store state."
            data={{
              invoices,
              products,
              customers,
              processedFiles,
            }}
          />
        ) : (
          <p>No store data available yet.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
