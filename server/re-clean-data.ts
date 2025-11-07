/**
 * Script para RE-limpiar tareas y notas con el sistema mejorado de interpretación
 */

import { storage } from "./storage";
import { TextCleaner } from "./text-cleaner";

async function recleanTasksAndNotes() {
  try {
    console.log("[Re-Clean] Iniciando RE-limpieza con sistema de interpretación mejorado...\n");
    
    const operations = await storage.getAllOperations();
    
    let tasksUpdated = 0;
    let notesUpdated = 0;
    let tasksSkipped = 0;
    let notesSkipped = 0;
    
    console.log(`[Re-Clean] Procesando ${operations.length} operaciones\n`);
    
    for (const operation of operations) {
      console.log(`\n📦 Operación: ${operation.operationNumber || operation.id}`);
      
      // Re-limpiar tareas
      const tasks = await storage.getOperationTasks(operation.id);
      
      for (const task of tasks) {
        if (task.modifiedManually) {
          tasksSkipped++;
          continue;
        }
        
        const originalTitle = task.title;
        const cleanedTitle = TextCleaner.cleanTaskTitle(task.title);
        
        if (cleanedTitle !== originalTitle) {
          await storage.updateOperationTask(task.id, {
            title: cleanedTitle,
          });
          tasksUpdated++;
          console.log(`   ✅ Tarea RE-interpretada:`);
          console.log(`      ANTES: "${originalTitle}"`);
          console.log(`      AHORA: "${cleanedTitle}"`);
        } else {
          tasksSkipped++;
        }
      }
      
      // Re-limpiar notas
      const notes = await storage.getOperationNotes(operation.id);
      
      for (const note of notes) {
        // Solo procesar notas cortas que parecen conversacionales
        if (note.content.length > 300 || note.content.startsWith('[AUTO]')) {
          notesSkipped++;
          continue;
        }
        
        const originalContent = note.content;
        const cleanedContent = TextCleaner.cleanNoteContent(note.content);
        
        if (cleanedContent !== originalContent) {
          await storage.updateOperationNote(note.id, {
            content: cleanedContent,
          });
          notesUpdated++;
          console.log(`   ✅ Nota RE-interpretada:`);
          console.log(`      ANTES: "${originalContent}"`);
          console.log(`      AHORA: "${cleanedContent}"`);
        } else {
          notesSkipped++;
        }
      }
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("✅ RE-LIMPIEZA COMPLETADA\n");
    console.log(`📊 Resultados:`);
    console.log(`   - Tareas actualizadas: ${tasksUpdated}`);
    console.log(`   - Tareas sin cambios: ${tasksSkipped}`);
    console.log(`   - Notas actualizadas: ${notesUpdated}`);
    console.log(`   - Notas sin cambios: ${notesSkipped}`);
    console.log("=".repeat(80) + "\n");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

recleanTasksAndNotes();
