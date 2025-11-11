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
      const thumbnailHash = crypto.createHash('sha256').update(thumbnailBuffer).digest('hex');
      const thumbnailKey = `thumbnails/${size}/${fileId}_${thumbnailHash}.jpg`;

      const uploadResult = await backblazeStorage.uploadFile(
        thumbnailBuffer,
        thumbnailKey,
        'image/jpeg',
        {
          category: 'thumbnail',
          originalFileId: fileId,
          size: size
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
   * Usando pdf-poppler o fallback a imagen genérica
   */
  private static async generatePDFThumbnail(
    buffer: Buffer,
    size: 'small' | 'medium' | 'large'
  ): Promise<Buffer> {
    try {
      // TODO: Implementar extracción de primera página de PDF
      // Por ahora, retornar imagen placeholder
      const { width, height } = this.SIZES[size.toUpperCase() as keyof typeof this.SIZES];

      // Crear imagen placeholder simple para PDFs
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="#1e293b"/>
          <text x="50%" y="50%" font-family="Arial" font-size="48" fill="#94a3b8" text-anchor="middle" dominant-baseline="middle">PDF</text>
        </svg>
      `;

      return await sharp(Buffer.from(svg))
        .jpeg({ quality: 85 })
        .toBuffer();

    } catch (error) {
      console.error('Error generating PDF thumbnail:', error);
      throw error;
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
