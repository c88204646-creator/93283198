/**
 * Script temporal para limpiar tareas y notas existentes
 * Ejecutar con: tsx server/clean-existing-data.ts
 */

import { storage } from "./storage";
import { TextCleaner } from "./text-cleaner";

async function cleanExistingTasksAndNotes() {
  try {
    console.log("[Admin Clean] Iniciando limpieza de tareas y notas...\n");
    
    // Obtener todas las operaciones
    const operations = await storage.getAllOperations();
    
    let tasksUpdated = 0;
    let notesUpdated = 0;
    let tasksSkipped = 0;
    let notesSkipped = 0;
    
    console.log(`[Admin Clean] Procesando ${operations.length} operaciones\n`);
    
    for (const operation of operations) {
      console.log(`\n📦 Operación: ${operation.operationNumber}`);
      
      // Limpiar tareas
      const tasks = await storage.getOperationTasks(operation.id);
      console.log(`   Tareas encontradas: ${tasks.length}`);
      
      for (const task of tasks) {
        // Saltar si fue modificada manualmente
        if (task.modifiedManually) {
          tasksSkipped++;
          continue;
        }
        
        const originalTitle = task.title;
        const originalDescription = task.description;
        
        const cleanedTitle = TextCleaner.cleanTaskTitle(task.title);
        const cleanedDescription = task.description 
          ? TextCleaner.cleanTaskDescription(task.description)
          : null;
        
        // Solo actualizar si algo cambió
        if (cleanedTitle !== originalTitle || cleanedDescription !== originalDescription) {
          await storage.updateOperationTask(task.id, {
            title: cleanedTitle,
            description: cleanedDescription,
          });
          tasksUpdated++;
          console.log(`   ✅ Tarea actualizada:`);
          console.log(`      ANTES: "${originalTitle}"`);
          console.log(`      AHORA: "${cleanedTitle}"`);
        } else {
          tasksSkipped++;
        }
      }
      
      // Limpiar notas
      const notes = await storage.getOperationNotes(operation.id);
      console.log(`   Notas encontradas: ${notes.length}`);
      
      for (const note of notes) {
        const originalContent = note.content;
        const cleanedContent = TextCleaner.cleanNoteContent(note.content);
        
        // Solo actualizar si algo cambió
        if (cleanedContent !== originalContent) {
          await storage.updateOperationNote(note.id, {
            content: cleanedContent,
          });
          notesUpdated++;
          console.log(`   ✅ Nota actualizada:`);
          console.log(`      ANTES: "${originalContent}"`);
          console.log(`      AHORA: "${cleanedContent}"`);
        } else {
          notesSkipped++;
        }
      }
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("✅ LIMPIEZA COMPLETADA\n");
    console.log(`📊 Resultados:`);
    console.log(`   - Tareas actualizadas: ${tasksUpdated}`);
    console.log(`   - Tareas sin cambios: ${tasksSkipped}`);
    console.log(`   - Notas actualizadas: ${notesUpdated}`);
    console.log(`   - Notas sin cambios: ${notesSkipped}`);
    console.log(`   - Total operaciones: ${operations.length}`);
    console.log("=".repeat(80) + "\n");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error durante la limpieza:", error);
    process.exit(1);
  }
}

// Ejecutar
cleanExistingTasksAndNotes();
