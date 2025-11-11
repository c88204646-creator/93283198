/**
 * Attachment Filter Service
 * 
 * Filtra attachments innecesarios antes de subirlos a Backblaze B2:
 * - Imágenes de firma de correo
 * - Logos inline
 * - Imágenes muy pequeñas
 * - Archivos con nombres comunes de tracking/firma
 */

export interface AttachmentMetadata {
  filename: string;
  mimeType: string;
  size: number;
  isInline: boolean;
}

export class AttachmentFilter {
  
  // Nombres comunes de archivos que son firmas o tracking pixels
  private static readonly SIGNATURE_PATTERNS = [
    /^image\d{3,}\.(png|gif|jpg|jpeg)$/i,  // image001.png, image002.gif, etc.
    /^signature\.(png|gif|jpg|jpeg)$/i,    // signature.png
    /^logo\.(png|gif|jpg|jpeg)$/i,         // logo.png
    /^spacer\.(gif|png)$/i,                // spacer.gif (tracking pixel)
    /^pixel\.(gif|png)$/i,                 // pixel.gif
    /^blank\.(gif|png)$/i,                 // blank.gif
    /^transparent\.(gif|png)$/i,           // transparent.gif
    /^1x1\.(gif|png)$/i,                   // 1x1.gif
    /^.*_signature_.*\.(png|gif|jpg|jpeg)$/i, // cualquier_signature_algo.png
    /^cid:.*$/i,                           // Content-ID references (inline)
  ];

  // Tamaños límite
  private static readonly MAX_INLINE_IMAGE_SIZE = 50 * 1024; // 50KB - imágenes inline típicas
  private static readonly MIN_USEFUL_FILE_SIZE = 1024; // 1KB - tracking pixels

  /**
   * Determina si un attachment debe ser ignorado (no almacenado)
   */
  static shouldIgnoreAttachment(metadata: AttachmentMetadata): boolean {
    const { filename, mimeType, size, isInline } = metadata;
    
    // 1. Ignorar tracking pixels (archivos muy pequeños)
    if (size < this.MIN_USEFUL_FILE_SIZE) {
      console.log(`[Attachment Filter] 🚫 Ignorando tracking pixel: ${filename} (${size} bytes)`);
      return true;
    }
    
    // 2. Ignorar imágenes inline pequeñas (probablemente firmas/logos)
    if (isInline && mimeType.startsWith('image/') && size < this.MAX_INLINE_IMAGE_SIZE) {
      console.log(`[Attachment Filter] 🚫 Ignorando imagen inline de firma: ${filename} (${size} bytes)`);
      return true;
    }
    
    // 3. Ignorar archivos con nombres comunes de firma
    const matchesSignaturePattern = this.SIGNATURE_PATTERNS.some(pattern => 
      pattern.test(filename)
    );
    
    if (matchesSignaturePattern) {
      console.log(`[Attachment Filter] 🚫 Ignorando archivo de firma/logo: ${filename}`);
      return true;
    }
    
    // 4. Ignorar GIFs inline pequeños (casi siempre son tracking/firma)
    if (isInline && mimeType === 'image/gif' && size < 100 * 1024) { // 100KB
      console.log(`[Attachment Filter] 🚫 Ignorando GIF inline: ${filename} (${size} bytes)`);
      return true;
    }
    
    // Archivo útil - no ignorar
    return false;
  }
  
  /**
   * Proporciona una razón legible de por qué se ignoró un archivo
   */
  static getIgnoreReason(metadata: AttachmentMetadata): string | null {
    const { filename, mimeType, size, isInline } = metadata;
    
    if (size < this.MIN_USEFUL_FILE_SIZE) {
      return 'Tracking pixel o archivo demasiado pequeño';
    }
    
    if (isInline && mimeType.startsWith('image/') && size < this.MAX_INLINE_IMAGE_SIZE) {
      return 'Imagen inline de firma/logo';
    }
    
    const matchesSignaturePattern = this.SIGNATURE_PATTERNS.some(pattern => 
      pattern.test(filename)
    );
    
    if (matchesSignaturePattern) {
      return 'Nombre de archivo típico de firma/logo';
    }
    
    if (isInline && mimeType === 'image/gif' && size < 100 * 1024) {
      return 'GIF inline (probablemente tracking)';
    }
    
    return null;
  }
  
  /**
   * Obtiene estadísticas de filtrado para logging
   */
  static getFilterStats(attachments: AttachmentMetadata[]): {
    total: number;
    ignored: number;
    kept: number;
    bytesSaved: number;
  } {
    let ignored = 0;
    let bytesSaved = 0;
    
    for (const attachment of attachments) {
      if (this.shouldIgnoreAttachment(attachment)) {
        ignored++;
        bytesSaved += attachment.size;
      }
    }
    
    return {
      total: attachments.length,
      ignored,
      kept: attachments.length - ignored,
      bytesSaved
    };
  }
}
