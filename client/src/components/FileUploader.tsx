import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, FileIcon, CheckCircle2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface FileUploaderProps {
  onUploadComplete: (result: {
    b2Key: string;
    fileHash: string;
    size: number;
    originalName: string;
    mimeType: string;
  }) => void;
  operationId: string;
  category?: string;
  accept?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function FileUploader({
  onUploadComplete,
  operationId,
  category,
  accept,
  disabled,
  children,
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    setSelectedFile(file);
    setUploading(true);
    setUploadProgress(10);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          setUploadProgress(30);
          const base64 = reader.result?.toString().split(',')[1];
          if (!base64) throw new Error('Failed to read file');

          setUploadProgress(50);
          const response = await fetch('/api/b2/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              buffer: base64,
              filename: file.name,
              mimeType: file.type || 'application/octet-stream',
              operationId,
              category,
            }),
          });

          if (!response.ok) {
            throw new Error('Upload failed');
          }

          setUploadProgress(80);
          const result = await response.json();
          
          setUploadProgress(100);
          onUploadComplete({
            b2Key: result.b2Key,
            fileHash: result.fileHash,
            size: result.size,
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
          });

          if (result.isDuplicate) {
            toast({
              title: 'File deduplicated',
              description: 'This file already exists and was reused',
            });
          } else {
            toast({
              title: 'Upload successful',
              description: `${file.name} uploaded successfully`,
            });
          }
        } catch (error) {
          console.error('Upload error:', error);
          toast({
            title: 'Upload failed',
            description: error instanceof Error ? error.message : 'Failed to upload file',
            variant: 'destructive',
          });
          setSelectedFile(null);
        } finally {
          setUploading(false);
          setUploadProgress(0);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File read error:', error);
      toast({
        title: 'Error reading file',
        description: 'Failed to read the selected file',
        variant: 'destructive',
      });
      setUploading(false);
      setUploadProgress(0);
      setSelectedFile(null);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  return (
    <div className="w-full space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled || uploading}
      />
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
          ${uploading ? 'pointer-events-none opacity-60' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={() => !uploading && !disabled && fileInputRef.current?.click()}
        data-testid="dropzone-upload"
      >
        {uploading ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Uploading {selectedFile?.name}...</p>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
            </div>
          </div>
        ) : selectedFile && uploadProgress === 100 ? (
          <div className="space-y-3">
            <div className="flex justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              File uploaded successfully!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Drag & drop your file here
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Maximum file size: 37MB
            </p>
          </div>
        )}
      </div>

      {selectedFile && !uploading && uploadProgress !== 100 && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <FileIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
