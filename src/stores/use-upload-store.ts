import { createStore, useStore } from "zustand";

import { persist } from "zustand/middleware";

export interface UploadedFile {
  fileUri: string;
  displayName: string;
  mimeType: string;
  name: string;
}

export interface UploadStore {
  files: UploadedFile[];
  isUploading: boolean;
  isLoading: boolean;

  setFiles: (files: UploadedFile[]) => void;
  addFile: (file: UploadedFile) => void;
  clearFiles: () => void;
  setUploading: (isUploading: boolean) => void;
  removeFile: (fileUri: string) => void;
  fetchFiles: () => Promise<void>;
}

/**
 * Fetches initial file data from the server
 * @returns Promise containing array of uploaded files
 */
const fetchInitialData = async (): Promise<UploadedFile[]> => {
  try {
    const response = await fetch("/api/files/get-files");
    const data = (await response.json()) as {
      error: string;
      files: {
        uri: string;
        displayName: string;
        mimeType: string;
        name: string;
      }[];
    };

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch files");
    }

    return data.files.map((file) => ({
      fileUri: file.uri,
      displayName: file.displayName,
      mimeType: file.mimeType,
      name: file.name,
    }));
  } catch (error) {
    console.error("Failed to fetch initial files:", error);
    return [];
  }
};

/**
 * Store for managing file uploads and their status
 * Handles file listing, upload status, and file operations
 */
const store = createStore<UploadStore>()(
  persist(
    (set) => ({
      files: [],
      isUploading: false,
      isLoading: true,
      setFiles: (files) => set({ files }),
      addFile: (file) => set((state) => ({ files: [...state.files, file] })),
      clearFiles: () => set({ files: [] }),
      setUploading: (isUploading) => set({ isUploading }),

      /**
       * Removes a file from the store by its URI
       */
      removeFile: (fileUri) =>
        set((state) => ({
          files: state.files.filter((file) => file.fileUri !== fileUri),
        })),

      /**
       * Fetches files from the server and updates the store
       * Manages loading state during the fetch operation
       */
      fetchFiles: async () => {
        set({ isLoading: true });
        try {
          const files = await fetchInitialData();
          set({ files });
        } catch (error) {
          console.error("Failed to fetch files:", error);
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "upload-store",
      partialize: (state) => ({
        files: state.files,
        isUploading: state.isUploading,
        isLoading: state.isLoading,
      }),
    },
  ),
);

/**
 * Custom hook to access the upload store with type-safe selectors
 * @param selector Function to select specific state from the store
 * @returns The selected state portion
 */
export const useUploadStore = <T>(selector: (state: UploadStore) => T): T =>
  useStore(store, selector);

export const uploadStore = {
  getState: store.getState,
  setState: store.setState,
  subscribe: store.subscribe,
};
