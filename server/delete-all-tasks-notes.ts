/**
 * Script para eliminar TODAS las tareas y notas de todas las operaciones
 * El sistema automático las regenerará correctamente con el sistema mejorado
 */

import { storage } from "./storage";

async function deleteAllTasksAndNotes() {
  try {
    console.log("[Delete] Iniciando eliminación de todas las tareas y notas...\n");
    
    const operations = await storage.getAllOperations();
    
    let tasksDeleted = 0;
    let notesDeleted = 0;
    
    console.log(`[Delete] Procesando ${operations.length} operaciones\n`);
    
    for (const operation of operations) {
      console.log(`\n📦 Operación: ${operation.operationNumber || operation.id}`);
      
      // Eliminar todas las tareas
      const tasks = await storage.getOperationTasks(operation.id);
      console.log(`   Tareas a eliminar: ${tasks.length}`);
      
      for (const task of tasks) {
        await storage.deleteOperationTask(task.id);
        tasksDeleted++;
      }
      
      // Eliminar todas las notas
      const notes = await storage.getOperationNotes(operation.id);
      console.log(`   Notas a eliminar: ${notes.length}`);
      
      for (const note of notes) {
        await storage.deleteOperationNote(note.id);
        notesDeleted++;
      }
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("✅ ELIMINACIÓN COMPLETADA\n");
    console.log(`📊 Resultados:`);
    console.log(`   - Tareas eliminadas: ${tasksDeleted}`);
    console.log(`   - Notas eliminadas: ${notesDeleted}`);
    console.log(`   - Operaciones procesadas: ${operations.length}`);
    console.log("\n💡 El sistema automático regenerará las tareas y notas correctamente.");
    console.log("=".repeat(80) + "\n");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error durante la eliminación:", error);
    process.exit(1);
  }
}

deleteAllTasksAndNotes();
