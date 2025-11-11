import { db } from "./db";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import {
  users, clients, employees, operations, invoices, proposals, expenses, leads,
  invoiceItems, proposalItems, payments, bankAccounts, customFields, customFieldValues,
  operationEmployees, gmailAccounts, gmailMessages, gmailAttachments, calendarEvents,
  automationConfigs, automationRules, automationLogs, operationNotes, operationTasks,
  operationFolders, operationFiles, operationAnalyses, bankAccountAnalyses, knowledgeBase,
  chatConversations, chatMessages, financialSuggestions, session
} from "@shared/schema";

async function resetDatabase() {
  console.log("🔴 INICIANDO RESTABLECIMIENTO COMPLETO DE LA BASE DE DATOS...\n");
  
  try {
    // 1. Eliminar todos los datos de todas las tablas (en orden correcto por dependencias)
    console.log("📋 Eliminando todos los datos...");
    
    // Primero las tablas dependientes (que tienen foreign keys)
    await db.delete(chatMessages);
    console.log("  ✓ Chat messages eliminados");
    
    await db.delete(chatConversations);
    console.log("  ✓ Chat conversations eliminados");
    
    await db.delete(financialSuggestions);
    console.log("  ✓ Financial suggestions eliminados");
    
    await db.delete(knowledgeBase);
    console.log("  ✓ Knowledge base eliminado");
    
    await db.delete(bankAccountAnalyses);
    console.log("  ✓ Bank account analyses eliminados");
    
    await db.delete(operationAnalyses);
    console.log("  ✓ Operation analyses eliminados");
    
    await db.delete(operationFiles);
    console.log("  ✓ Operation files eliminados");
    
    await db.delete(operationFolders);
    console.log("  ✓ Operation folders eliminados");
    
    await db.delete(operationTasks);
    console.log("  ✓ Operation tasks eliminados");
    
    await db.delete(operationNotes);
    console.log("  ✓ Operation notes eliminados");
    
    await db.delete(automationLogs);
    console.log("  ✓ Automation logs eliminados");
    
    await db.delete(automationRules);
    console.log("  ✓ Automation rules eliminados");
    
    await db.delete(automationConfigs);
    console.log("  ✓ Automation configs eliminados");
    
    await db.delete(calendarEvents);
    console.log("  ✓ Calendar events eliminados");
    
    await db.delete(gmailAttachments);
    console.log("  ✓ Gmail attachments eliminados");
    
    await db.delete(gmailMessages);
    console.log("  ✓ Gmail messages eliminados");
    
    await db.delete(gmailAccounts);
    console.log("  ✓ Gmail accounts eliminados");
    
    await db.delete(customFieldValues);
    console.log("  ✓ Custom field values eliminados");
    
    await db.delete(customFields);
    console.log("  ✓ Custom fields eliminados");
    
    await db.delete(operationEmployees);
    console.log("  ✓ Operation employees eliminados");
    
    await db.delete(payments);
    console.log("  ✓ Payments eliminados");
    
    await db.delete(expenses);
    console.log("  ✓ Expenses eliminados");
    
    await db.delete(proposalItems);
    console.log("  ✓ Proposal items eliminados");
    
    await db.delete(invoiceItems);
    console.log("  ✓ Invoice items eliminados");
    
    await db.delete(proposals);
    console.log("  ✓ Proposals eliminados");
    
    await db.delete(invoices);
    console.log("  ✓ Invoices eliminados");
    
    await db.delete(operations);
    console.log("  ✓ Operations eliminados");
    
    await db.delete(leads);
    console.log("  ✓ Leads eliminados");
    
    await db.delete(employees);
    console.log("  ✓ Employees eliminados");
    
    await db.delete(bankAccounts);
    console.log("  ✓ Bank accounts eliminados");
    
    await db.delete(clients);
    console.log("  ✓ Clients eliminados");
    
    await db.delete(users);
    console.log("  ✓ Users eliminados");
    
    // Eliminar sesiones
    await db.delete(session);
    console.log("  ✓ Sessions eliminadas");
    
    console.log("\n✅ Todos los datos han sido eliminados exitosamente\n");
    
    // 2. Crear el nuevo usuario
    console.log("👤 Creando nuevo usuario...");
    
    const email = "contacto@navicargologistics.com";
    const password = "Contra8@";
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [newUser] = await db.insert(users).values({
      username: "navicargo",
      email: email,
      password: hashedPassword,
      fullName: "ADVANCE LOGISTICS SERVICES OPEN SEA",
      role: "admin"
    }).returning();
    
    console.log(`  ✓ Usuario creado: ${newUser.email}`);
    console.log(`  ✓ Nombre completo: ${newUser.fullName}`);
    console.log(`  ✓ Rol: ${newUser.role}`);
    console.log(`  ✓ Username: ${newUser.username}`);
    
    // 3. Crear el empleado asociado
    console.log("\n👨‍💼 Creando empleado asociado...");
    
    const [newEmployee] = await db.insert(employees).values({
      userId: newUser.id,
      name: "ADVANCE LOGISTICS SERVICES OPEN SEA",
      email: email,
      position: "Administrador",
      department: "Dirección General",
      status: "active"
    }).returning();
    
    console.log(`  ✓ Empleado creado: ${newEmployee.name}`);
    console.log(`  ✓ Posición: ${newEmployee.position}`);
    
    console.log("\n✨ ¡RESTABLECIMIENTO COMPLETO EXITOSO!\n");
    console.log("📝 Credenciales de acceso:");
    console.log(`   Email: ${email}`);
    console.log(`   Contraseña: ${password}`);
    console.log(`   Rol: ${newUser.role}`);
    console.log("\n🚀 Ahora puedes iniciar sesión con estas credenciales.\n");
    
  } catch (error) {
    console.error("\n❌ Error durante el restablecimiento:", error);
    throw error;
  }
}

// Ejecutar el script
resetDatabase()
  .then(() => {
    console.log("✅ Script completado exitosamente");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  });
