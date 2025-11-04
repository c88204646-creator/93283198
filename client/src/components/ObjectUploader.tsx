import { useCallback, useState } from "react";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Upload, X } from "lucide-react";

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setProgress(0);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Get upload URL
        const response = await fetch("/api/objects/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { uploadURL } = await response.json();

        // Upload file
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const fileURL = uploadURL.split("?")[0];
        onUploadComplete?.(fileURL, {
          name: file.name,
          type: file.type,
          size: file.size,
        });

        setProgress(((i + 1) / selectedFiles.length) * 100);
      }

      setSelectedFiles([]);
      onClose();
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error al subir archivos. Por favor intenta de nuevo.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Subir archivos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              data-testid="input-file-upload"
              disabled={uploading}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="text-sm text-muted-foreground">
                Haz clic para seleccionar archivos
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Máximo 10 archivos, 100MB cada uno
              </div>
            </label>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Archivos seleccionados ({selectedFiles.length})
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                    data-testid={`file-item-${index}`}
                  >
                    <div className="flex-1 truncate text-sm">
                      {file.name}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                      data-testid={`button-remove-file-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Subiendo archivos...
              </div>
              <Progress value={progress} />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={uploading}
              data-testid="button-cancel-upload"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading}
              data-testid="button-start-upload"
            >
              {uploading ? "Subiendo..." : `Subir ${selectedFiles.length} archivo${selectedFiles.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
