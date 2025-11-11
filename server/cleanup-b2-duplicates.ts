/**
 * Cleanup Script for Backblaze B2
 * 
 * Identifica y elimina:
 * 1. Archivos duplicados (mismo fileHash pero múltiples copias en B2)
 * 2. Archivos innecesarios (firmas, logos inline, tracking pixels)
 * 
 * IMPORTANTE: Ejecutar con precaución - esto elimina archivos de B2
 */

import { db } from '../db';
import { gmailAttachments } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';
import { backblazeStorage } from './backblazeStorage';
import { AttachmentFilter } from './attachment-filter';

interface CleanupStats {
  totalAttachments: number;
  duplicatesFound: number;
  unnecessaryFound: number;
  filesDeleted: number;
  bytesSaved: number;
  errors: number;
}

export class B2CleanupService {
  
  /**
   * Encuentra attachments duplicados en la base de datos
   */
  static async findDuplicates(): Promise<Map<string, string[]>> {
    console.log('[B2 Cleanup] 🔍 Buscando archivos duplicados...');
    
    // Agrupar por fileHash para encontrar duplicados
    const attachments = await db.select({
      id: gmailAttachments.id,
      fileHash: gmailAttachments.fileHash,
      b2Key: gmailAttachments.b2Key,
      filename: gmailAttachments.filename,
      size: gmailAttachments.size,
    })
    .from(gmailAttachments)
    .where(sql`${gmailAttachments.fileHash} IS NOT NULL AND ${gmailAttachments.b2Key} IS NOT NULL`);
    
    const hashMap = new Map<string, string[]>();
    
    for (const attachment of attachments) {
      if (!attachment.fileHash || !attachment.b2Key) continue;
      
      if (!hashMap.has(attachment.fileHash)) {
        hashMap.set(attachment.fileHash, []);
      }
      hashMap.get(attachment.fileHash)!.push(attachment.id);
    }
    
    // Filtrar solo los que tienen duplicados (más de 1 registro)
    const duplicates = new Map<string, string[]>();
    for (const [hash, ids] of hashMap.entries()) {
      if (ids.length > 1) {
        duplicates.set(hash, ids);
      }
    }
    
    console.log(`[B2 Cleanup] ✅ Encontrados ${duplicates.size} grupos de archivos duplicados`);
    return duplicates;
  }
  
  /**
   * Encuentra archivos innecesarios (firmas, logos, tracking pixels)
   */
  static async findUnnecessaryFiles(): Promise<Array<{
    id: string;
    filename: string;
    b2Key: string;
    size: number;
    reason: string;
  }>> {
    console.log('[B2 Cleanup] 🔍 Buscando archivos innecesarios...');
    
    const attachments = await db.select({
      id: gmailAttachments.id,
      filename: gmailAttachments.filename,
      mimeType: gmailAttachments.mimeType,
      size: gmailAttachments.size,
      isInline: gmailAttachments.isInline,
      b2Key: gmailAttachments.b2Key,
    })
    .from(gmailAttachments)
    .where(sql`${gmailAttachments.b2Key} IS NOT NULL`);
    
    const unnecessary: Array<{
      id: string;
      filename: string;
      b2Key: string;
      size: number;
      reason: string;
    }> = [];
    
    for (const attachment of attachments) {
      if (!attachment.b2Key) continue;
      
      const shouldIgnore = AttachmentFilter.shouldIgnoreAttachment({
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        isInline: attachment.isInline || false
      });
      
      if (shouldIgnore) {
        const reason = AttachmentFilter.getIgnoreReason({
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
          isInline: attachment.isInline || false
        }) || 'Archivo innecesario';
        
        unnecessary.push({
          id: attachment.id,
          filename: attachment.filename,
          b2Key: attachment.b2Key,
          size: attachment.size,
          reason
        });
      }
    }
    
    console.log(`[B2 Cleanup] ✅ Encontrados ${unnecessary.length} archivos innecesarios`);
    return unnecessary;
  }
  
  /**
   * Elimina archivos duplicados de B2, manteniendo solo uno por hash
   */
  static async removeDuplicates(dryRun = true): Promise<CleanupStats> {
    const stats: CleanupStats = {
      totalAttachments: 0,
      duplicatesFound: 0,
      unnecessaryFound: 0,
      filesDeleted: 0,
      bytesSaved: 0,
      errors: 0
    };
    
    if (!backblazeStorage.isAvailable()) {
      console.error('[B2 Cleanup] ❌ Backblaze no está disponible');
      return stats;
    }
    
    const duplicates = await this.findDuplicates();
    stats.duplicatesFound = duplicates.size;
    
    for (const [hash, ids] of duplicates.entries()) {
      // Mantener el primer registro, eliminar el resto
      const [keepId, ...removeIds] = ids;
      
      for (const removeId of removeIds) {
        try {
          const attachment = await db.select()
            .from(gmailAttachments)
            .where(eq(gmailAttachments.id, removeId))
            .limit(1);
          
          if (attachment.length === 0 || !attachment[0].b2Key) continue;
          
          const { b2Key, size, filename } = attachment[0];
          
          if (dryRun) {
            console.log(`[B2 Cleanup] [DRY RUN] 🗑️  Eliminaría: ${filename} (${b2Key}) - ${size} bytes`);
          } else {
            // Eliminar de B2
            await backblazeStorage.deleteFile(b2Key);
            
            // Actualizar DB para apuntar al archivo original
            const originalAttachment = await db.select()
              .from(gmailAttachments)
              .where(eq(gmailAttachments.id, keepId))
              .limit(1);
            
            if (originalAttachment.length > 0 && originalAttachment[0].b2Key) {
              await db.update(gmailAttachments)
                .set({
                  b2Key: originalAttachment[0].b2Key,
                  fileHash: hash
                })
                .where(eq(gmailAttachments.id, removeId));
            }
            
            console.log(`[B2 Cleanup] ✅ Eliminado duplicado: ${filename} (${size} bytes)`);
          }
          
          stats.filesDeleted++;
          stats.bytesSaved += size;
          
        } catch (error) {
          console.error(`[B2 Cleanup] ❌ Error eliminando duplicado ${removeId}:`, error);
          stats.errors++;
        }
      }
    }
    
    return stats;
  }
  
  /**
   * Elimina archivos innecesarios de B2
   */
  static async removeUnnecessaryFiles(dryRun = true): Promise<CleanupStats> {
    const stats: CleanupStats = {
      totalAttachments: 0,
      duplicatesFound: 0,
      unnecessaryFound: 0,
      filesDeleted: 0,
      bytesSaved: 0,
      errors: 0
    };
    
    if (!backblazeStorage.isAvailable()) {
      console.error('[B2 Cleanup] ❌ Backblaze no está disponible');
      return stats;
    }
    
    const unnecessary = await this.findUnnecessaryFiles();
    stats.unnecessaryFound = unnecessary.length;
    
    for (const file of unnecessary) {
      try {
        if (dryRun) {
          console.log(`[B2 Cleanup] [DRY RUN] 🗑️  Eliminaría: ${file.filename} - ${file.reason} (${file.size} bytes)`);
        } else {
          // Eliminar de B2
          await backblazeStorage.deleteFile(file.b2Key);
          
          // Eliminar registro de DB
          await db.delete(gmailAttachments)
            .where(eq(gmailAttachments.id, file.id));
          
          console.log(`[B2 Cleanup] ✅ Eliminado archivo innecesario: ${file.filename} (${file.size} bytes)`);
        }
        
        stats.filesDeleted++;
        stats.bytesSaved += file.size;
        
      } catch (error) {
        console.error(`[B2 Cleanup] ❌ Error eliminando archivo innecesario ${file.id}:`, error);
        stats.errors++;
      }
    }
    
    return stats;
  }
  
  /**
   * Ejecuta limpieza completa
   */
  static async fullCleanup(dryRun = true): Promise<void> {
    console.log(`[B2 Cleanup] 🚀 Iniciando limpieza completa (${dryRun ? 'DRY RUN' : 'REAL'})...`);
    
    const duplicateStats = await this.removeDuplicates(dryRun);
    const unnecessaryStats = await this.removeUnnecessaryFiles(dryRun);
    
    const totalStats: CleanupStats = {
      totalAttachments: 0,
      duplicatesFound: duplicateStats.duplicatesFound,
      unnecessaryFound: unnecessaryStats.unnecessaryFound,
      filesDeleted: duplicateStats.filesDeleted + unnecessaryStats.filesDeleted,
      bytesSaved: duplicateStats.bytesSaved + unnecessaryStats.bytesSaved,
      errors: duplicateStats.errors + unnecessaryStats.errors
    };
    
    console.log('\n[B2 Cleanup] 📊 RESUMEN DE LIMPIEZA:');
    console.log(`  - Grupos de duplicados encontrados: ${totalStats.duplicatesFound}`);
    console.log(`  - Archivos innecesarios encontrados: ${totalStats.unnecessaryFound}`);
    console.log(`  - Archivos eliminados: ${totalStats.filesDeleted}`);
    console.log(`  - Espacio liberado: ${(totalStats.bytesSaved / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Errores: ${totalStats.errors}`);
    
    if (dryRun) {
      console.log('\n[B2 Cleanup] ℹ️  Esto fue un DRY RUN. Para ejecutar la limpieza real, usa: dryRun = false');
    }
  }
}

// Script ejecutable
if (require.main === module) {
  (async () => {
    const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--execute');
    
    console.log('========================================');
    console.log('  LIMPIEZA DE BACKBLAZE B2');
    console.log('========================================\n');
    
    if (isDryRun) {
      console.log('⚠️  MODO DRY RUN - No se eliminarán archivos realmente');
      console.log('Para ejecutar la limpieza real, usa: npm run cleanup-b2 -- --execute\n');
    } else {
      console.log('⚠️  MODO REAL - Se eliminarán archivos permanentemente');
      console.log('Esperando 5 segundos...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    await B2CleanupService.fullCleanup(isDryRun);
    
    console.log('\n[B2 Cleanup] ✅ Limpieza completada');
    process.exit(0);
  })();
}
