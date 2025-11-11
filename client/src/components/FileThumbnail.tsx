import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface FileThumbnailProps {
  fileId: string;
  fileName: string;
  mimeType: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  fallbackIcon?: React.ComponentType<{ className?: string }>;
}

/**
 * Professional lazy-loading thumbnail component
 * Similar to Dropbox/Google Drive
 */
export function FileThumbnail({
  fileId,
  fileName,
  mimeType,
  size = 'small',
  className = "",
  fallbackIcon: FallbackIcon
}: FileThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer para lazy loading
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Cargar cuando esté a 50px de ser visible
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Cargar thumbnail cuando sea visible
  useEffect(() => {
    if (!isVisible) return;

    // Solo cargar thumbnails para imágenes y PDFs
    if (!mimeType.startsWith('image/') && !mimeType.includes('pdf')) {
      return;
    }

    const loadThumbnail = async () => {
      setIsLoading(true);
      setError(false);

      try {
        // El endpoint ya maneja la redirección al signed URL
        const url = `/api/files/${fileId}/thumbnail?size=${size}`;
        
        // Verificar que el thumbnail existe
        const response = await fetch(url, { method: 'HEAD' });
        
        if (response.ok) {
          setThumbnailUrl(url);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error loading thumbnail:', err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadThumbnail();
  }, [isVisible, fileId, size, mimeType]);

  // Renderizado
  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && thumbnailUrl && !error && (
        <img
          src={thumbnailUrl}
          alt={fileName}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setError(true)}
        />
      )}

      {!isLoading && (error || !thumbnailUrl) && FallbackIcon && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <FallbackIcon className="w-12 h-12 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}
