import { useCallback } from "react";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import { DashboardModal } from "@uppy/react";

export function useObjectUploader(onUploadComplete?: (fileURL: string, file: any) => void) {
  const uppy = new Uppy({
    restrictions: {
      maxNumberOfFiles: 10,
      maxFileSize: 100 * 1024 * 1024,
    },
    autoProceed: false,
  });

  uppy.use(AwsS3, {
    shouldUseMultipart: (file) => file.size > 100 * 2 ** 20,
    async getUploadParameters(file) {
      const response = await fetch("/api/objects/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL } = await response.json();

      return {
        method: "PUT",
        url: uploadURL,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      };
    },
  });

  uppy.on("upload-success", (file, response) => {
    if (file && response.uploadURL) {
      const fileURL = response.uploadURL.split("?")[0];
      onUploadComplete?.(fileURL, {
        name: file.name,
        type: file.type,
        size: file.size,
      });
    }
  });

  return uppy;
}

interface ObjectUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (fileURL: string, file: any) => void;
}

export function ObjectUploader({ isOpen, onClose, onUploadComplete }: ObjectUploaderProps) {
  const uppy = useObjectUploader(
    useCallback(
      (fileURL: string, file: any) => {
        onUploadComplete?.(fileURL, file);
        onClose();
      },
      [onUploadComplete, onClose]
    )
  );

  return (
    <DashboardModal
      uppy={uppy}
      open={isOpen}
      onRequestClose={onClose}
      proudlyDisplayPoweredByUppy={false}
      closeModalOnClickOutside
    />
  );
}
