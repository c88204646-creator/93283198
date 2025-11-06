import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result?.toString().split(',')[1];
          if (!base64) throw new Error('Failed to read file');

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

          const result = await response.json();
          
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
          }
        } catch (error) {
          console.error('Upload error:', error);
          toast({
            title: 'Upload failed',
            description: error instanceof Error ? error.message : 'Failed to upload file',
            variant: 'destructive',
          });
        } finally {
          setUploading(false);
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
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleFileSelect}
        disabled={disabled || uploading}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        data-testid="button-upload-file"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            {children || 'Upload File'}
          </>
        )}
      </Button>
    </>
  );
}
