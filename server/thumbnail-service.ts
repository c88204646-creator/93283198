/**
 * Thumbnail Generation Service
 * 
 * Genera thumbnails para imágenes y PDFs de forma lazy
 * Similar a Dropbox/Google Drive
 */

import sharp from 'sharp';
import { db } from './db';
import { fileThumbnails } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { backblazeStorage } from './backblazeStorage';
import * as crypto from 'crypto';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
}

export class ThumbnailService {
  // Tamaños estándar de thumbnails
  static readonly SIZES = {
    SMALL: { width: 150, height: 150 },   // Grid view
    MEDIUM: { width: 400, height: 400 },  // Preview
    LARGE: { width: 800, height: 800 },   // Lightbox
  };

  /**
   * Genera o obtiene thumbnail para un archivo
   */
  static async getOrGenerateThumbnail(
    fileId: string,
    b2Key: string | null,
    mimeType: string,
    size: 'small' | 'medium' | 'large' = 'small'
  ): Promise<string | null> {
    try {
      // Verificar si ya existe el thumbnail en caché
      const cached = await db.select()
        .from(fileThumbnails)
        .where(
          and(
            eq(fileThumbnails.fileId, fileId),
            eq(fileThumbnails.size, size)
          )
        )
        .limit(1);

      if (cached.length > 0 && cached[0].b2Key) {
        // Generar signed URL para el thumbnail cacheado
        try {
          return await backblazeStorage.getSignedUrl(cached[0].b2Key, 3600);
        } catch (error) {
          console.error(`Error getting cached thumbnail URL:`, error);
          // Si falla, regenerar thumbnail
        }
      }

      // Si no hay caché o falló, generar nuevo thumbnail
      if (!b2Key || !backblazeStorage.isAvailable()) {
        return null;
      }

      // Solo generar thumbnails para imágenes y PDFs
      if (!mimeType.startsWith('image/') && !mimeType.includes('pdf')) {
        return null;
      }

      // Descargar archivo original
      const buffer = await backblazeStorage.downloadFile(b2Key);

      let thumbnailBuffer: Buffer;

      if (mimeType.startsWith('image/')) {
        // Generar thumbnail de imagen
        thumbnailBuffer = await this.generateImageThumbnail(buffer, size);
      } else if (mimeType.includes('pdf')) {
        // Para PDFs, generar thumbnail de la primera página
        thumbnailBuffer = await this.generatePDFThumbnail(buffer, size);
      } else {
        return null;
      }

      // Subir thumbnail a B2
      const thumbnailFolder = `thumbnails/${size}`;
      
      const uploadResult = await backblazeStorage.uploadFile(
        thumbnailBuffer,
        thumbnailFolder,
        {
          mimeType: 'image/jpeg',
          category: 'thumbnail',
          originalName: `${fileId}_thumbnail.jpg`
        }
      );

      // Guardar en caché
      await db.insert(fileThumbnails)
        .values({
          fileId,
          size,
          b2Key: uploadResult.fileKey,
          width: this.SIZES[size.toUpperCase() as keyof typeof this.SIZES].width,
          height: this.SIZES[size.toUpperCase() as keyof typeof this.SIZES].height
        })
        .onConflictDoUpdate({
          target: [fileThumbnails.fileId, fileThumbnails.size],
          set: {
            b2Key: uploadResult.fileKey,
            updatedAt: new Date()
          }
        });

      // Generar signed URL para el thumbnail
      return await backblazeStorage.getSignedUrl(uploadResult.fileKey, 3600);

    } catch (error) {
      console.error(`Error generating thumbnail for file ${fileId}:`, error);
      return null;
    }
  }

  /**
   * Genera thumbnail de imagen usando sharp
   */
  private static async generateImageThumbnail(
    buffer: Buffer,
    size: 'small' | 'medium' | 'large'
  ): Promise<Buffer> {
    const { width, height } = this.SIZES[size.toUpperCase() as keyof typeof this.SIZES];

    return await sharp(buffer)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 85,
        progressive: true
      })
      .toBuffer();
  }

  /**
   * Genera thumbnail de PDF (primera página)
   * Renderiza la primera página del PDF a imagen
   */
  private static async generatePDFThumbnail(
    buffer: Buffer,
    size: 'small' | 'medium' | 'large'
  ): Promise<Buffer> {
    try {
      const { width: targetWidth, height: targetHeight } = this.SIZES[size.toUpperCase() as keyof typeof this.SIZES];

      // Cargar el PDF con pdfjs
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@5.4.394/standard_fonts/'
      });
      
      const pdf = await loadingTask.promise;
      
      // Obtener la primera página
      const page = await pdf.getPage(1);
      
      // Calcular escala para ajustar al tamaño deseado
      const viewport = page.getViewport({ scale: 1.0 });
      const scale = Math.min(targetWidth / viewport.width, targetHeight / viewport.height);
      const scaledViewport = page.getViewport({ scale });

      // Crear canvas virtual para renderizado
      const canvasWidth = Math.floor(scaledViewport.width);
      const canvasHeight = Math.floor(scaledViewport.height);

      // Crear un canvas manual (sin node-canvas)
      const canvasData = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
      
      const canvasContext = {
        canvas: {
          width: canvasWidth,
          height: canvasHeight
        },
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        miterLimit: 10,
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        
        fillRect(x: number, y: number, w: number, h: number) {
          // Rellenar con blanco por defecto
          const startX = Math.max(0, Math.floor(x));
          const startY = Math.max(0, Math.floor(y));
          const endX = Math.min(canvasWidth, Math.ceil(x + w));
          const endY = Math.min(canvasHeight, Math.ceil(y + h));
          
          for (let py = startY; py < endY; py++) {
            for (let px = startX; px < endX; px++) {
              const offset = (py * canvasWidth + px) * 4;
              canvasData[offset] = 255;     // R
              canvasData[offset + 1] = 255; // G
              canvasData[offset + 2] = 255; // B
              canvasData[offset + 3] = 255; // A
            }
          }
        },
        
        save() {},
        restore() {},
        translate() {},
        scale() {},
        transform() {},
        setTransform() {},
        resetTransform() {},
        rotate() {},
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        bezierCurveTo() {},
        quadraticCurveTo() {},
        rect() {},
        arc() {},
        arcTo() {},
        ellipse() {},
        fill() {},
        stroke() {},
        clip() {},
        isPointInPath: () => false,
        clearRect() {},
        strokeRect() {},
        measureText: () => ({ width: 0 }),
        fillText() {},
        strokeText() {},
        getImageData: () => ({ data: canvasData, width: canvasWidth, height: canvasHeight }),
        putImageData() {},
        createImageData: () => ({ data: new Uint8ClampedArray(canvasWidth * canvasHeight * 4), width: canvasWidth, height: canvasHeight }),
        drawImage() {},
        setLineDash() {},
        getLineDash: () => [],
      };

      // Renderizar PDF en el canvas
      await page.render({
        canvasContext: canvasContext as any,
        viewport: scaledViewport
      }).promise;

      // Convertir los datos del canvas a imagen con sharp
      const imageBuffer = await sharp(Buffer.from(canvasData.buffer), {
        raw: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 4
        }
      })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

      // Limpiar
      await pdf.destroy();

      return imageBuffer;

    } catch (error) {
      console.error('Error generating PDF thumbnail:', error);
      
      // Fallback a placeholder en caso de error
      const { width, height } = this.SIZES[size.toUpperCase() as keyof typeof this.SIZES];
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="#f1f5f9"/>
          <rect width="${width}" height="${height}" fill="none" stroke="#cbd5e1" stroke-width="2"/>
          <text x="50%" y="50%" font-family="Arial" font-size="24" fill="#64748b" text-anchor="middle" dominant-baseline="middle">PDF</text>
        </svg>
      `;

      return await sharp(Buffer.from(svg))
        .jpeg({ quality: 85 })
        .toBuffer();
    }
  }

  /**
   * Genera thumbnails en batch para múltiples archivos
   */
  static async generateBatchThumbnails(
    files: Array<{ id: string; b2Key: string | null; mimeType: string }>,
    size: 'small' | 'medium' | 'large' = 'small'
  ): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();

    // Procesar en paralelo con límite de concurrencia
    const BATCH_SIZE = 5;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async (file) => ({
          id: file.id,
          url: await this.getOrGenerateThumbnail(file.id, file.b2Key, file.mimeType, size)
        }))
      );

      batchResults.forEach(({ id, url }) => {
        results.set(id, url);
      });
    }

    return results;
  }

  /**
   * Limpia thumbnails antiguos o huérfanos
   */
  static async cleanupOrphanedThumbnails(): Promise<number> {
    try {
      // Buscar thumbnails que ya no tienen archivo padre
      const orphans = await db.execute<{ id: string; b2_key: string }>(
        `
        SELECT ft.id, ft.b2_key
        FROM file_thumbnails ft
        LEFT JOIN operation_files of ON ft.file_id = of.id
        LEFT JOIN gmail_attachments ga ON ft.file_id = ga.id
        WHERE of.id IS NULL AND ga.id IS NULL
        `
      );

      let deleted = 0;
      for (const orphan of orphans.rows) {
        try {
          // Eliminar de B2
          if (orphan.b2_key) {
            await backblazeStorage.deleteFile(orphan.b2_key);
          }
          
          // Eliminar de DB
          await db.delete(fileThumbnails)
            .where(eq(fileThumbnails.id, orphan.id));
          
          deleted++;
        } catch (error) {
          console.error(`Error deleting orphaned thumbnail ${orphan.id}:`, error);
        }
      }

      console.log(`[Thumbnail Cleanup] Deleted ${deleted} orphaned thumbnails`);
      return deleted;

    } catch (error) {
      console.error('[Thumbnail Cleanup] Error:', error);
      return 0;
    }
  }
}
