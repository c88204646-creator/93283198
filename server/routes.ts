import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import bcrypt from "bcrypt";
import {
  insertUserSchema, insertClientSchema, insertEmployeeSchema, insertOperationSchema,
  insertInvoiceSchema, insertProposalSchema, insertBankAccountSchema, insertExpenseSchema, insertLeadSchema,
  insertCustomFieldSchema, insertOperationFolderSchema, insertOperationFileSchema
} from "@shared/schema";
import { z } from "zod";
import * as gmailSync from "./gmail-sync";
import * as calendarSync from "./calendar-sync";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { queryCache } from "./cache";
import { backblazeStorage } from "./backblazeStorage";
import { clientAutoAssignmentService } from "./client-auto-assignment-service";
import { facturamaInvoiceExtractor } from "./facturama-invoice-extractor";

const PgSession = ConnectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// Middleware to check if user is authenticated
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// Middleware to check if user is admin or manager
async function requireAdminOrManager(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return res.status(403).json({ message: "Forbidden: Admin or Manager access required" });
  }

  next();
}

// Middleware to check if user is admin
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }

  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "logisticore-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );

  // Authentication Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", requireAuth, (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User Routes
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithoutPasswords = allUsers.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertUserSchema.partial().parse(req.body);
      
      // Si se está actualizando la contraseña, hashearla
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      }
      
      const user = await storage.updateUser(id, data);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // No permitir que el usuario se elimine a sí mismo
      if (id === req.session.userId) {
        return res.status(400).json({ message: "No puedes eliminar tu propia cuenta" });
      }

      // Verificar si el usuario tiene un empleado asociado
      const employee = await storage.getEmployeeByUserId(id);
      if (employee) {
        return res.status(400).json({ 
          message: "No se puede eliminar este usuario porque tiene un empleado asociado. Primero elimina el empleado." 
        });
      }

      await db.delete(users).where(eq(users.id, id));
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const [
        operations,
        clients,
        employees,
        invoices,
        proposals,
        expenses,
        leads,
      ] = await Promise.all([
        storage.countOperations().catch(() => 0),
        storage.countClients().catch(() => 0),
        storage.countEmployees().catch(() => 0),
        storage.countInvoices().catch(() => 0),
        storage.countProposals().catch(() => 0),
        storage.countExpenses().catch(() => 0),
        storage.countLeads().catch(() => 0),
      ]);

      const stats = {
        operations,
        clients,
        employees,
        invoices,
        proposals,
        expenses,
        leads,
      };

      res.json(stats);
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Client Routes
  app.get("/api/clients", requireAuth, async (req, res) => {
    try {
      const cacheKey = 'clients:all';
      let allClients = queryCache.get<any[]>(cacheKey);

      if (!allClients) {
        allClients = await storage.getAllClients();
        queryCache.set(cacheKey, allClients, 5 * 60 * 1000); // 5 min cache
      }

      res.json(allClients);
    } catch (error) {
      console.error("Get clients error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const cacheKey = `clients:${id}`;
      let client = queryCache.get<any>(cacheKey);

      if (!client) {
        const allClients = await storage.getAllClients();
        client = allClients.find(c => c.id === id);
        if (client) {
          queryCache.set(cacheKey, client, 5 * 60 * 1000); // 5 min cache
        }
      }

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      res.json(client);
    } catch (error) {
      console.error("Get client error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const data = insertClientSchema.parse(req.body);
      const client = await storage.createClient(data);

      // Invalidate cache
      queryCache.invalidate('clients:all');

      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create client error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertClientSchema.partial().parse(req.body);
      
      // Si se está intentando cambiar la divisa, validar que no haya facturas o cotizaciones
      if (data.currency) {
        const existingClient = await storage.getClient(id);
        
        if (!existingClient) {
          return res.status(404).json({ message: "Client not found" });
        }
        
        // Solo validar si la divisa es diferente a la actual
        if (data.currency !== existingClient.currency) {
          // Verificar si el cliente tiene facturas
          const clientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, id));
          
          if (clientInvoices.length > 0) {
            return res.status(400).json({ 
              message: `No se puede cambiar la divisa porque este cliente tiene ${clientInvoices.length} factura(s) asociada(s). La divisa no puede modificarse una vez que hay facturas emitidas.` 
            });
          }
          
          // Verificar si el cliente tiene cotizaciones (proposals)
          const clientProposals = await db.select().from(proposals).where(eq(proposals.clientId, id));
          
          if (clientProposals.length > 0) {
            return res.status(400).json({ 
              message: `No se puede cambiar la divisa porque este cliente tiene ${clientProposals.length} cotización(es) asociada(s). La divisa no puede modificarse una vez que hay cotizaciones emitidas.` 
            });
          }
          
          // Si no hay facturas ni cotizaciones, actualizar la divisa de las operaciones vinculadas
          await db.update(operations)
            .set({ currency: data.currency })
            .where(eq(operations.clientId, id));
          
          console.log(`✓ Divisa actualizada de ${existingClient.currency} a ${data.currency} para el cliente ${existingClient.name} y sus operaciones`);
        }
      }

      const client = await storage.updateClient(id, data);

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Invalidate cache
      queryCache.invalidate('clients:all');

      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update client error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar si el cliente tiene operaciones asociadas
      const clientOperations = await db.select().from(operations).where(eq(operations.clientId, id));
      
      if (clientOperations.length > 0) {
        return res.status(400).json({ 
          message: `No se puede eliminar este cliente porque tiene ${clientOperations.length} operación(es) asociada(s). Primero elimina o reasigna las operaciones.` 
        });
      }

      await storage.deleteClient(id);

      // Invalidate cache
      queryCache.invalidate('clients:all');

      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Delete client error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper function to create or update birthday event
  async function handleBirthdayEvent(employeeId: string, employeeName: Date | null, birthdate: Date | null, currentBirthdayEventId?: string | null) {
    if (!birthdate) {
      // If no birthdate, delete existing birthday event if any
      if (currentBirthdayEventId) {
        await storage.deleteCalendarEvent(currentBirthdayEventId);
        await storage.updateEmployee(employeeId, { birthdayEventId: null });
      }
      return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const birthMonth = birthdate.getMonth();
    const birthDay = birthdate.getDate();

    // Calculate next birthday (this year or next year)
    let nextBirthday = new Date(currentYear, birthMonth, birthDay);
    if (nextBirthday < now) {
      nextBirthday = new Date(currentYear + 1, birthMonth, birthDay);
    }

    // Set as all-day event
    nextBirthday.setHours(0, 0, 0, 0);
    const endDate = new Date(nextBirthday);
    endDate.setHours(23, 59, 59, 999);

    const eventData = {
      title: `🎂 Cumpleaños de ${employeeName}`,
      description: `Hoy es el cumpleaños de ${employeeName}!`,
      startTime: nextBirthday,
      endTime: endDate,
      isAllDay: true,
      status: 'confirmed' as const,
      source: 'local' as const,
      isBirthday: true,
      employeeId,
    };

    let birthdayEventId = currentBirthdayEventId;

    if (currentBirthdayEventId) {
      // Update existing event
      await storage.updateCalendarEvent(currentBirthdayEventId, eventData);
    } else {
      // Create new event
      const event = await storage.createCalendarEvent(eventData);
      birthdayEventId = event.id;
      // Update employee with birthday event ID
      await storage.updateEmployee(employeeId, { birthdayEventId });
    }
  }

  // Employee Routes (Admin/Manager only for viewing all, create, delete)
  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      const cacheKey = 'employees:all';
      let allEmployees = queryCache.get<any[]>(cacheKey);

      if (!allEmployees) {
        allEmployees = await storage.getAllEmployees();
        queryCache.set(cacheKey, allEmployees, 5 * 60 * 1000); // 5 min cache
      }

      res.json(allEmployees);
    } catch (error) {
      console.error("Get employees error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/employees", requireAdminOrManager, async (req, res) => {
    try {
      const data = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(data);

      // Handle birthday event creation
      await handleBirthdayEvent(employee.id, employee.name, employee.birthdate, null);

      // Invalidate cache
      queryCache.invalidate('employees:all');

      res.json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create employee error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/employees/:id", requireAdminOrManager, async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertEmployeeSchema.partial().parse(req.body);

      // Get current employee to check existing birthday event
      const currentEmployee = await storage.getEmployee(id);
      if (!currentEmployee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      const employee = await storage.updateEmployee(id, data);

      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Handle birthday event update
      await handleBirthdayEvent(
        employee.id,
        employee.name,
        employee.birthdate,
        employee.birthdayEventId
      );

      // Invalidate cache
      queryCache.invalidate('employees:all');

      res.json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update employee error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/employees/:id", requireAdminOrManager, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteEmployee(id);

      // Invalidate cache
      queryCache.invalidate('employees:all');

      res.json({ message: "Employee deleted successfully" });
    } catch (error) {
      console.error("Delete employee error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Operation Routes
  app.get("/api/operations", requireAuth, async (req, res) => {
    try {
      const cacheKey = 'operations:all';
      let operationsWithEmployees = queryCache.get<any[]>(cacheKey);

      if (!operationsWithEmployees) {
        const allOperations = await storage.getAllOperations();
        operationsWithEmployees = await Promise.all(
          allOperations.map(async (op) => ({
            ...op,
            employeeIds: await storage.getOperationEmployees(op.id),
          }))
        );
        queryCache.set(cacheKey, operationsWithEmployees, 3 * 60 * 1000); // 3 min cache
      }

      res.json(operationsWithEmployees);
    } catch (error) {
      console.error("Get operations error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/operations/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const operation = await storage.getOperation(id);

      if (!operation) {
        return res.status(404).json({ message: "Operation not found" });
      }

      const employeeIds = await storage.getOperationEmployees(id);
      res.json({ ...operation, employeeIds });
    } catch (error) {
      console.error("Get operation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/operations/:id/financial-overview", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const operation = await storage.getOperation(id);

      if (!operation) {
        return res.status(404).json({ message: "Operation not found" });
      }

      const financialSummary = await storage.getOperationFinancialSummary(id);
      res.json(financialSummary);
    } catch (error) {
      console.error("Get operation financial overview error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/operations", requireAuth, async (req, res) => {
    try {
      const { employeeIds, ...operationData } = req.body;
      const data = insertOperationSchema.parse(operationData);
      const operation = await storage.createOperation(data);

      if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
        await storage.setOperationEmployees(operation.id, employeeIds);
      }

      // Invalidate cache
      queryCache.invalidate('operations:all');

      res.json(operation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create operation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/operations/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { employeeIds, ...operationData } = req.body;
      const data = insertOperationSchema.partial().parse(operationData);
      const operation = await storage.updateOperation(id, data);

      if (!operation) {
        return res.status(404).json({ message: "Operation not found" });
      }

      if (employeeIds !== undefined && Array.isArray(employeeIds)) {
        await storage.setOperationEmployees(id, employeeIds);
      }

      // Invalidate cache
      queryCache.invalidate('operations:all');

      res.json(operation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update operation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/operations/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteOperation(id);

      // Invalidate cache
      queryCache.invalidate('operations:all');

      res.json({ message: "Operation deleted successfully" });
    } catch (error) {
      console.error("Delete operation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Invoice Routes
  app.get("/api/invoices", requireAuth, async (req, res) => {
    try {
      const allInvoices = await storage.getAllInvoices();
      res.json(allInvoices);
    } catch (error) {
      console.error("Get invoices error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/invoices", requireAuth, async (req, res) => {
    try {
      const data = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(data);
      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create invoice error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertInvoiceSchema.partial().parse(req.body);
      const invoice = await storage.updateInvoice(id, data);

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update invoice error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteInvoice(id);
      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      console.error("Delete invoice error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/invoices/:invoiceId/stamp", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      
      const invoice = await storage.getInvoiceById(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (invoice.folioFiscal) {
        return res.status(400).json({ message: "Esta factura ya está timbrada" });
      }

      const items = await storage.getInvoiceItems(invoiceId);
      if (!items || items.length === 0) {
        return res.status(400).json({ message: "La factura debe tener al menos un concepto" });
      }

      const client = await storage.getClientById(invoice.clientId);
      if (!client) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }

      const { stampInvoiceInFacturama } = await import("./facturama-service");
      const result = await stampInvoiceInFacturama(
        { ...invoice, id: invoiceId },
        items,
        client.rfc || "",
        client.name,
        client.fiscalRegime || "612"
      );

      await storage.updateInvoice(invoiceId, {
        folioFiscal: result.folioFiscal,
      });

      res.json({ 
        message: "Factura timbrada exitosamente",
        folioFiscal: result.folioFiscal,
        facturamId: result.facturamId
      });
    } catch (error: any) {
      console.error("Stamp invoice error:", error);
      res.status(500).json({ 
        message: error?.message || "Error al timbrar factura" 
      });
    }
  });

  // Proposal Routes
  app.get("/api/proposals", requireAuth, async (req, res) => {
    try {
      const allProposals = await storage.getAllProposals();
      res.json(allProposals);
    } catch (error) {
      console.error("Get proposals error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/proposals", requireAuth, async (req, res) => {
    try {
      const data = insertProposalSchema.parse(req.body);
      const proposal = await storage.createProposal(data);
      res.json(proposal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create proposal error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/proposals/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertProposalSchema.partial().parse(req.body);
      const proposal = await storage.updateProposal(id, data);

      if (!proposal) {
        return res.status(404).json({ message: "Proposal not found" });
      }

      res.json(proposal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update proposal error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/proposals/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProposal(id);
      res.json({ message: "Proposal deleted successfully" });
    } catch (error) {
      console.error("Delete proposal error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Convert Proposal to Invoice
  app.post("/api/proposals/:id/convert-to-invoice", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const proposal = await storage.getProposal(id);

      if (!proposal) {
        return res.status(404).json({ message: "Proposal not found" });
      }

      if (proposal.convertedToInvoiceId) {
        return res.status(400).json({ message: "Proposal already converted to invoice" });
      }

      const proposalItems = await storage.getProposalItems(id);

      const invoiceNumber = `INV-${Date.now()}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const invoice = await storage.createInvoice({
        invoiceNumber,
        clientId: proposal.clientId,
        employeeId: proposal.employeeId,
        operationId: null,
        currency: proposal.currency,
        subtotal: proposal.subtotal,
        tax: proposal.tax,
        total: proposal.total,
        status: "draft",
        dueDate,
        paidDate: null,
        notes: `Converted from proposal ${proposal.proposalNumber}`,
      });

      for (const item of proposalItems) {
        await storage.createInvoiceItem({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        });
      }

      await storage.updateProposal(id, {
        status: "converted",
        convertedToInvoiceId: invoice.id,
      });

      res.json(invoice);
    } catch (error) {
      console.error("Convert proposal to invoice error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Invoice Items Routes
  app.get("/api/invoices/:invoiceId/items", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const items = await storage.getInvoiceItems(invoiceId);
      res.json(items);
    } catch (error) {
      console.error("Get invoice items error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/invoices/:invoiceId/items", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { insertInvoiceItemSchema } = await import("@shared/schema");
      const data = insertInvoiceItemSchema.parse({ ...req.body, invoiceId });
      const item = await storage.createInvoiceItem(data);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create invoice item error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/invoice-items/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { insertInvoiceItemSchema } = await import("@shared/schema");
      const data = insertInvoiceItemSchema.partial().parse(req.body);
      const item = await storage.updateInvoiceItem(id, data);

      if (!item) {
        return res.status(404).json({ message: "Invoice item not found" });
      }

      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update invoice item error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/invoice-items/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteInvoiceItem(id);
      res.json({ message: "Invoice item deleted successfully" });
    } catch (error) {
      console.error("Delete invoice item error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Proposal Items Routes
  app.get("/api/proposals/:proposalId/items", requireAuth, async (req, res) => {
    try {
      const { proposalId } = req.params;
      const items = await storage.getProposalItems(proposalId);
      res.json(items);
    } catch (error) {
      console.error("Get proposal items error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/proposals/:proposalId/items", requireAuth, async (req, res) => {
    try {
      const { proposalId } = req.params;
      const { insertProposalItemSchema } = await import("@shared/schema");
      const data = insertProposalItemSchema.parse({ ...req.body, proposalId });
      const item = await storage.createProposalItem(data);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create proposal item error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/proposal-items/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { insertProposalItemSchema } = await import("@shared/schema");
      const data = insertProposalItemSchema.partial().parse(req.body);
      const item = await storage.updateProposalItem(id, data);

      if (!item) {
        return res.status(404).json({ message: "Proposal item not found" });
      }

      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update proposal item error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/proposal-items/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProposalItem(id);
      res.json({ message: "Proposal item deleted successfully" });
    } catch (error) {
      console.error("Delete proposal item error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Payments Routes
  app.get("/api/invoices/:invoiceId/payments", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const payments = await storage.getPayments(invoiceId);
      res.json(payments);
    } catch (error) {
      console.error("Get payments error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/invoices/:invoiceId/payments", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { insertPaymentSchema } = await import("@shared/schema");
      const data = insertPaymentSchema.parse({ ...req.body, invoiceId });
      const payment = await storage.createPayment(data);
      res.json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/payments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { insertPaymentSchema } = await import("@shared/schema");
      const data = insertPaymentSchema.partial().parse(req.body);
      const payment = await storage.updatePayment(id, data);

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      res.json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/payments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePayment(id);
      res.json({ message: "Payment deleted successfully" });
    } catch (error) {
      console.error("Delete payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Operation Payments Routes
  app.get("/api/operations/:operationId/payments", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const payments = await storage.getPaymentsByOperation(operationId);
      res.json(payments);
    } catch (error) {
      console.error("Get operation payments error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/operations/:operationId/payments", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const { insertPaymentSchema } = await import("@shared/schema");
      const data = insertPaymentSchema.parse({ ...req.body, operationId });
      const payment = await storage.createPayment(data);
      res.json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create operation payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Operation Invoices Routes
  app.get("/api/operations/:operationId/invoices", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const invoices = await storage.getInvoicesByOperation(operationId);
      res.json(invoices);
    } catch (error) {
      console.error("Get operation invoices error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bank Account Routes
  app.get("/api/bank-accounts", requireAuth, async (req, res) => {
    try {
      const accounts = await storage.getAllBankAccounts();
      res.json(accounts);
    } catch (error) {
      console.error("Get bank accounts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/bank-accounts", requireAuth, async (req, res) => {
    try {
      const data = insertBankAccountSchema.parse(req.body);
      const account = await storage.createBankAccount(data);
      res.json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create bank account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/bank-accounts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertBankAccountSchema.partial().parse(req.body);
      const account = await storage.updateBankAccount(id, data);

      if (!account) {
        return res.status(404).json({ message: "Bank account not found" });
      }

      res.json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update bank account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/bank-accounts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBankAccount(id);
      res.json({ message: "Bank account deleted successfully" });
    } catch (error) {
      console.error("Delete bank account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get bank account by ID
  app.get("/api/bank-accounts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const account = await storage.getBankAccount(id);
      
      if (!account) {
        return res.status(404).json({ message: "Bank account not found" });
      }
      
      res.json(account);
    } catch (error) {
      console.error("Get bank account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get payments by bank account
  app.get("/api/bank-accounts/:id/payments", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const payments = await storage.getPaymentsByBankAccount(id);
      res.json(payments);
    } catch (error) {
      console.error("Get payments by bank account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get expenses by bank account
  app.get("/api/bank-accounts/:id/expenses", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const expenses = await storage.getExpensesByBankAccount(id);
      res.json(expenses);
    } catch (error) {
      console.error("Get expenses by bank account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get financial analysis for bank account (AI-powered)
  app.get("/api/bank-accounts/:id/analysis", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { financialAnalysisService } = await import('./financial-analysis-service');
      
      // Get account
      const account = await storage.getBankAccount(id);
      if (!account) {
        return res.status(404).json({ message: "Bank account not found" });
      }

      // Check if there's a recent analysis
      const existingAnalysis = await storage.getBankAccountAnalysis(id);
      if (existingAnalysis && existingAnalysis.status === 'ready') {
        const age = Date.now() - new Date(existingAnalysis.expiresAt).getTime();
        if (age < 0) {
          // Cache still valid
          return res.json(existingAnalysis);
        }
      }

      // Get payments and expenses for last 3 months
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setMonth(periodStart.getMonth() - 3);

      const payments = await storage.getPaymentsByBankAccount(id);
      const expenses = await storage.getExpensesByBankAccount(id);

      // Filter by period
      const paymentsInPeriod = payments.filter(p => {
        const date = new Date(p.paymentDate);
        return date >= periodStart && date <= periodEnd;
      });
      const expensesInPeriod = expenses.filter(e => {
        const date = new Date(e.date);
        return date >= periodStart && date <= periodEnd;
      });

      // Generate analysis
      const result = await financialAnalysisService.analyzeAccount({
        account,
        payments: paymentsInPeriod,
        expenses: expensesInPeriod,
        periodStart,
        periodEnd,
      });

      // Return the latest analysis
      const analysis = await storage.getBankAccountAnalysis(id);
      res.json(analysis);
    } catch (error) {
      console.error("Get bank account analysis error:", error);
      res.status(500).json({ message: "Internal server error", error: String(error) });
    }
  });

  // Invalidate analysis cache (force regeneration)
  app.post("/api/bank-accounts/:id/analysis/refresh", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { financialAnalysisService } = await import('./financial-analysis-service');
      
      await financialAnalysisService.invalidateCache(id);
      res.json({ message: "Analysis cache invalidated, will regenerate on next request" });
    } catch (error) {
      console.error("Invalidate analysis cache error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Expense Routes
  app.get("/api/expenses", requireAuth, async (req, res) => {
    try {
      const allExpenses = await storage.getAllExpenses();
      res.json(allExpenses);
    } catch (error) {
      console.error("Get expenses error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/expenses", requireAuth, async (req, res) => {
    try {
      const data = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(data);
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create expense error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertExpenseSchema.partial().parse(req.body);
      const expense = await storage.updateExpense(id, data);

      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update expense error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteExpense(id);
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error("Delete expense error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Operation Expenses Routes
  app.get("/api/operations/:operationId/expenses", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const expenses = await storage.getExpensesByOperation(operationId);
      res.json(expenses);
    } catch (error) {
      console.error("Get operation expenses error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/operations/:operationId/expenses", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const data = insertExpenseSchema.parse({ ...req.body, operationId });
      const expense = await storage.createExpense(data);
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create operation expense error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Lead Routes
  app.get("/api/leads", requireAuth, async (req, res) => {
    try {
      const allLeads = await storage.getAllLeads();
      res.json(allLeads);
    } catch (error) {
      console.error("Get leads error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/leads", requireAuth, async (req, res) => {
    try {
      const data = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(data);
      res.json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create lead error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertLeadSchema.partial().parse(req.body);
      const lead = await storage.updateLead(id, data);

      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      res.json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update lead error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteLead(id);
      res.json({ message: "Lead deleted successfully" });
    } catch (error) {
      console.error("Delete lead error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Custom Field Routes (Admin only)
  app.get("/api/custom-fields", requireAuth, async (req, res) => {
    try {
      const allCustomFields = await storage.getAllCustomFields();
      res.json(allCustomFields);
    } catch (error) {
      console.error("Get custom fields error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/custom-fields", requireAdmin, async (req, res) => {
    try {
      const data = insertCustomFieldSchema.parse(req.body);
      const customField = await storage.createCustomField(data);
      res.json(customField);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create custom field error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/custom-fields/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertCustomFieldSchema.partial().parse(req.body);
      const customField = await storage.updateCustomField(id, data);

      if (!customField) {
        return res.status(404).json({ message: "Custom field not found" });
      }

      res.json(customField);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update custom field error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/custom-fields/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCustomField(id);
      res.json({ message: "Custom field deleted successfully" });
    } catch (error) {
      console.error("Delete custom field error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Gmail OAuth Routes
  app.get("/api/gmail/oauth/start", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const authUrl = gmailSync.getAuthUrl(userId);
      res.json({ authUrl });
    } catch (error) {
      console.error("Gmail OAuth start error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/gmail/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || typeof code !== 'string') {
        return res.status(400).send('Missing authorization code');
      }

      if (!state || typeof state !== 'string') {
        return res.status(400).send('Missing state parameter');
      }

      const { userId } = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));

      const syncRangeMonths = parseInt(req.query.syncRange as string || '1');
      const syncFromDate = new Date();
      syncFromDate.setMonth(syncFromDate.getMonth() - syncRangeMonths);

      await gmailSync.handleOAuthCallback(code, userId, syncFromDate);

      res.send(`
        <html>
          <head><title>Gmail Connected</title></head>
          <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>✓ Gmail Account Connected</h1>
            <p>Your Gmail account has been successfully connected and is now syncing in the background.</p>
            <p>You can close this window and return to the application.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'gmail-connected' }, '*');
              }
              setTimeout(() => { window.close(); }, 2000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Gmail OAuth callback error:", error);
      res.status(500).send('Failed to connect Gmail account');
    }
  });

  // Gmail Account Routes
  app.get("/api/gmail/accounts", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const accounts = await storage.getAllGmailAccounts(userId);

      const accountsWithoutTokens = accounts.map(({ accessToken, refreshToken, ...account }) => account);
      res.json(accountsWithoutTokens);
    } catch (error) {
      console.error("Get Gmail accounts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/gmail/accounts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const account = await storage.getGmailAccount(id);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Account not found" });
      }

      await storage.deleteGmailAccount(id);
      res.json({ message: "Gmail account disconnected successfully" });
    } catch (error) {
      console.error("Delete Gmail account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/gmail/accounts/:id/toggle-sync", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const account = await storage.getGmailAccount(id);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Account not found" });
      }

      const updatedAccount = await storage.updateGmailAccount(id, {
        syncEnabled: !account.syncEnabled,
      });

      if (updatedAccount?.syncEnabled) {
        gmailSync.startSync(id);
      }

      res.json(updatedAccount);
    } catch (error) {
      console.error("Toggle Gmail sync error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/gmail/accounts/:id/resync", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const account = await storage.getGmailAccount(id);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Account not found" });
      }

      if (!account.syncEnabled) {
        return res.status(400).json({ message: "Sync is disabled for this account" });
      }

      gmailSync.startSync(id);
      res.json({ message: "Sync started" });
    } catch (error) {
      console.error("Resync Gmail account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Gmail Message Routes
  app.get("/api/gmail/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const limit = parseInt(req.query.limit as string || '500');

      const accounts = await storage.getAllGmailAccounts(userId);
      if (!accounts || accounts.length === 0) {
        return res.json([]);
      }

      const allMessages: any[] = [];
      for (const account of accounts) {
        const messages = await storage.getGmailMessages(account.id, limit, 0);
        allMessages.push(...messages);
      }

      allMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      res.json(allMessages.slice(0, limit));
    } catch (error) {
      console.error("Get all Gmail messages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/gmail/accounts/:accountId/messages", requireAuth, async (req, res) => {
    try {
      const { accountId } = req.params;
      const userId = req.session.userId!;
      const limit = parseInt(req.query.limit as string || '500');
      const offset = parseInt(req.query.offset as string || '0');

      const account = await storage.getGmailAccount(accountId);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Account not found" });
      }

      const messages = await storage.getGmailMessages(accountId, limit, offset);
      res.json(messages);
    } catch (error) {
      console.error("Get Gmail messages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/gmail/messages/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const message = await storage.getGmailMessage(id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      const account = await storage.getGmailAccount(message.gmailAccountId);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Message not found" });
      }

      res.json(message);
    } catch (error) {
      console.error("Get Gmail message error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get email content with signed URLs for bodies and attachments
  app.get("/api/gmail/messages/:id/content", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      console.log(`[Email Content] Loading content for message ${id}`);

      const message = await storage.getGmailMessage(id);
      if (!message) {
        console.log(`[Email Content] Message ${id} not found`);
        return res.status(404).json({ message: "Message not found" });
      }

      const account = await storage.getGmailAccount(message.gmailAccountId);
      if (!account || account.userId !== userId) {
        console.log(`[Email Content] Message ${id} access denied`);
        return res.status(404).json({ message: "Message not found" });
      }

      // Get attachments
      const attachments = await storage.getGmailAttachments(id);

      // Use backend proxy endpoints instead of direct B2 URLs (avoids CORS issues)
      let htmlBodyUrl: string | null = null;
      let textBodyUrl: string | null = null;

      console.log(`[Email Content] Message has bodyHtmlB2Key: ${!!message.bodyHtmlB2Key}, bodyHtml: ${!!message.bodyHtml}, bodyTextB2Key: ${!!message.bodyTextB2Key}, bodyText: ${!!message.bodyText}`);

      // Always use backend proxy endpoints for email bodies (B2 or database)
      if (message.bodyHtmlB2Key || message.bodyHtml) {
        htmlBodyUrl = `/api/gmail/messages/${id}/body/html`;
        console.log(`[Email Content] Using backend proxy for HTML body`);
      }
      if (message.bodyTextB2Key || message.bodyText) {
        textBodyUrl = `/api/gmail/messages/${id}/body/text`;
        console.log(`[Email Content] Using backend proxy for text body`);
      }

      console.log(`[Email Content] Final URLs - htmlBodyUrl: ${htmlBodyUrl}, textBodyUrl: ${textBodyUrl}, attachments: ${attachments.length}`);


      // Generate signed URLs for attachments
      const attachmentsWithUrls = await Promise.all(
        attachments.map(async (attachment) => {
          let signedUrl: string | null = null;
          
          if (attachment.b2Key && backblazeStorage.isAvailable()) {
            try {
              signedUrl = await backblazeStorage.getSignedUrl(attachment.b2Key, 1800);
            } catch (error) {
              console.error(`Error generating signed URL for attachment ${attachment.id}:`, error);
            }
          }

          return {
            ...attachment,
            signedUrl,
          };
        })
      );

      res.json({
        message,
        htmlBodyUrl,
        textBodyUrl,
        attachments: attachmentsWithUrls,
      });
    } catch (error) {
      console.error("Get email content error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Download email body from Backblaze
  app.get("/api/gmail/messages/:id/body/:type", requireAuth, async (req, res) => {
    try {
      const { id, type } = req.params;
      const userId = req.session.userId!;

      if (type !== 'text' && type !== 'html') {
        return res.status(400).json({ message: "Invalid body type. Use 'text' or 'html'." });
      }

      const message = await storage.getGmailMessage(id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      const account = await storage.getGmailAccount(message.gmailAccountId);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Message not found" });
      }

      const b2Key = type === 'text' ? message.bodyTextB2Key : message.bodyHtmlB2Key;
      const legacyBody = type === 'text' ? message.bodyText : message.bodyHtml;

      // Try Backblaze first, fall back to legacy storage
      if (b2Key && backblazeStorage.isAvailable()) {
        try {
          const bodyContent = await backblazeStorage.downloadFile(b2Key);
          const contentType = type === 'text' ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8';

          res.setHeader('Content-Type', contentType);
          res.send(bodyContent);
          return;
        } catch (error) {
          console.error(`Error downloading from Backblaze, falling back to legacy:`, error);
          // Fall through to legacy storage
        }
      }

      // Fallback to legacy storage (bodyText/bodyHtml in database)
      if (legacyBody) {
        const contentType = type === 'text' ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8';
        res.setHeader('Content-Type', contentType);
        res.send(legacyBody);
      } else {
        return res.status(404).json({ message: "Email body not found" });
      }
    } catch (error) {
      console.error("Download email body error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Gmail Attachment Routes
  app.get("/api/gmail/attachments/all", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;

      const accounts = await storage.getAllGmailAccounts(userId);
      if (!accounts || accounts.length === 0) {
        return res.json([]);
      }

      const allMessages = [];
      for (const account of accounts) {
        const messages = await storage.getGmailMessages(account.id, 100, 0);
        allMessages.push(...messages);
      }

      const allAttachments = [];
      for (const message of allMessages) {
        const attachments = await storage.getGmailAttachments(message.id);
        allAttachments.push(...attachments);
      }

      res.json(allAttachments);
    } catch (error) {
      console.error("Get all Gmail attachments error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/gmail/messages/:messageId/attachments", requireAuth, async (req, res) => {
    try {
      const { messageId } = req.params;
      const userId = req.session.userId!;

      const message = await storage.getGmailMessage(messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      const account = await storage.getGmailAccount(message.gmailAccountId);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Message not found" });
      }

      const attachments = await storage.getGmailAttachments(messageId);
      res.json(attachments);
    } catch (error) {
      console.error("Get Gmail attachments error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/gmail/attachments/:id/download", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const attachment = await storage.getGmailAttachment(id);
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      const message = await storage.getGmailMessage(attachment.gmailMessageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      const account = await storage.getGmailAccount(message.gmailAccountId);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      let buffer: Buffer;

      // Try to download from Backblaze first if b2Key exists
      if (attachment.b2Key) {
        try {
          buffer = await backblazeStorage.downloadFile(attachment.b2Key);
          console.log(`Downloaded attachment from Backblaze: ${attachment.filename}`);
        } catch (error) {
          console.error(`Error downloading from Backblaze, falling back to Gmail API:`, error);
          // Fallback to Gmail API if Backblaze fails
          const attachmentData = await gmailSync.getAttachmentData(
            account,
            message.messageId,
            attachment.attachmentId
          );
          buffer = Buffer.from(attachmentData, 'base64');
        }
      } else {
        // Fallback to Gmail API if no b2Key
        const attachmentData = await gmailSync.getAttachmentData(
          account,
          message.messageId,
          attachment.attachmentId
        );
        buffer = Buffer.from(attachmentData, 'base64');
      }

      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
      res.setHeader('Content-Length', buffer.length);

      res.send(buffer);
    } catch (error) {
      console.error("Download Gmail attachment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Calendar Routes
  // Get all calendar events for the authenticated user
  app.get("/api/calendar/events", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const events = await storage.getAllCalendarEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Get calendar events error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get calendar events by account
  app.get("/api/calendar/accounts/:accountId/events", requireAuth, async (req, res) => {
    try {
      const { accountId } = req.params;
      const userId = req.session.userId!;

      const account = await storage.getGmailAccount(accountId);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Account not found" });
      }

      const events = await storage.getCalendarEventsByAccount(accountId);
      res.json(events);
    } catch (error) {
      console.error("Get account calendar events error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create a new local calendar event
  app.post("/api/calendar/events", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { title, description, location, startTime, endTime, isAllDay, attendees, reminders } = req.body;

      const event = await storage.createCalendarEvent({
        title,
        description,
        location,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isAllDay: isAllDay || false,
        attendees,
        reminders,
        source: 'local',
        syncStatus: 'synced',
        createdBy: userId,
      });

      res.json(event);
    } catch (error) {
      console.error("Create calendar event error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create a new Google Calendar event and sync
  app.post("/api/calendar/google-events", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { accountId, title, description, location, startTime, endTime, isAllDay, attendees, reminders } = req.body;

      const account = await storage.getGmailAccount(accountId);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Account not found" });
      }

      const event = await calendarSync.createGoogleCalendarEvent(accountId, {
        title,
        description,
        location,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isAllDay: isAllDay || false,
        attendees,
        reminders,
      });

      res.json(event);
    } catch (error) {
      console.error("Create Google calendar event error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update a calendar event
  app.patch("/api/calendar/events/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const event = await storage.getCalendarEvent(id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Verificar permisos
      if (event.source === 'local' && event.createdBy !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (event.source === 'google' && event.gmailAccountId) {
        const account = await storage.getGmailAccount(event.gmailAccountId);
        if (!account || account.userId !== userId) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const { title, description, location, startTime, endTime, isAllDay, attendees, reminders } = req.body;

      // Si es un evento de Google, actualizar en Google Calendar también
      if (event.source === 'google' && event.eventId) {
        await calendarSync.updateGoogleCalendarEvent(id, {
          title,
          description,
          location,
          startTime: startTime ? new Date(startTime) : undefined,
          endTime: endTime ? new Date(endTime) : undefined,
          isAllDay,
          attendees,
          reminders,
        });
      } else {
        // Evento local, solo actualizar en base de datos
        await storage.updateCalendarEvent(id, {
          title,
          description,
          location,
          startTime: startTime ? new Date(startTime) : undefined,
          endTime: endTime ? new Date(endTime) : undefined,
          isAllDay,
          attendees,
          reminders,
        });
      }

      const updatedEvent = await storage.getCalendarEvent(id);
      res.json(updatedEvent);
    } catch (error) {
      console.error("Update calendar event error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a calendar event
  app.delete("/api/calendar/events/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const event = await storage.getCalendarEvent(id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Verificar permisos
      if (event.source === 'local' && event.createdBy !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (event.source === 'google' && event.gmailAccountId) {
        const account = await storage.getGmailAccount(event.gmailAccountId);
        if (!account || account.userId !== userId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        // Eliminar en Google Calendar también
        await calendarSync.deleteGoogleCalendarEvent(id);
      } else {
        // Evento local, solo eliminar de base de datos
        await storage.deleteCalendarEvent(id);
      }

      res.status(204).send();
    } catch (error) {
      console.error("Delete calendar event error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Trigger manual sync for an account's calendar
  app.post("/api/calendar/accounts/:accountId/sync", requireAuth, async (req, res) => {
    try {
      const { accountId } = req.params;
      const userId = req.session.userId!;

      const account = await storage.getGmailAccount(accountId);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Account not found" });
      }

      await calendarSync.syncCalendarEvents(accountId);
      res.json({ message: "Sync completed successfully" });
    } catch (error) {
      console.error("Calendar sync error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Automation Config Routes
  app.get("/api/automation/configs", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const configs = await storage.getAutomationConfigs(userId);
      res.json(configs);
    } catch (error) {
      console.error("Get automation configs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/automation/configs/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const config = await storage.getAutomationConfig(id);
      if (!config || config.userId !== userId) {
        return res.status(404).json({ message: "Config not found" });
      }

      res.json(config);
    } catch (error) {
      console.error("Get automation config error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/automation/configs", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { moduleName, moduleDescription, isEnabled, selectedGmailAccounts, defaultEmployees, processAttachments, autoCreateTasks, autoCreateNotes, aiOptimizationLevel, autoDetectPayments, autoDetectExpenses, autoAssignClients, autoAssignInvoices, companyName, companyDomain, employeeEmails } = req.body;

      // Check if config already exists for this module
      const existing = await storage.getAutomationConfigByModule(userId, moduleName);
      if (existing) {
        return res.status(400).json({ message: "Configuration for this module already exists" });
      }

      const config = await storage.createAutomationConfig({
        userId,
        moduleName,
        moduleDescription,
        isEnabled: isEnabled || false,
        selectedGmailAccounts: selectedGmailAccounts || [],
        defaultEmployees: defaultEmployees || [],
        processAttachments: processAttachments || false,
        autoCreateTasks: autoCreateTasks || 'disabled',
        autoCreateNotes: autoCreateNotes || 'disabled',
        aiOptimizationLevel: aiOptimizationLevel || 'high',
        autoDetectPayments: autoDetectPayments || false,
        autoDetectExpenses: autoDetectExpenses || false,
        autoAssignClients: autoAssignClients || false,
        autoAssignInvoices: autoAssignInvoices || false,
        companyName: companyName || '',
        companyDomain: companyDomain || '',
        employeeEmails: employeeEmails || [],
      });

      res.json(config);
    } catch (error) {
      console.error("Create automation config error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/automation/configs/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const config = await storage.getAutomationConfig(id);
      if (!config || config.userId !== userId) {
        return res.status(404).json({ message: "Config not found" });
      }

      const { moduleDescription, isEnabled, selectedGmailAccounts, defaultEmployees, processAttachments, autoCreateTasks, autoCreateNotes, aiOptimizationLevel, autoDetectPayments, autoDetectExpenses, autoAssignClients, autoAssignInvoices, companyName, companyDomain, employeeEmails } = req.body;
      const updated = await storage.updateAutomationConfig(id, {
        moduleDescription,
        isEnabled,
        selectedGmailAccounts,
        defaultEmployees,
        processAttachments,
        autoCreateTasks,
        autoCreateNotes,
        aiOptimizationLevel,
        autoDetectPayments,
        autoDetectExpenses,
        autoAssignClients,
        autoAssignInvoices,
        companyName,
        companyDomain,
        employeeEmails,
      });

      res.json(updated);
    } catch (error) {
      console.error("Update automation config error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/automation/configs/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const config = await storage.getAutomationConfig(id);
      if (!config || config.userId !== userId) {
        return res.status(404).json({ message: "Config not found" });
      }

      await storage.deleteAutomationConfig(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete automation config error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Automation Rule Routes
  app.get("/api/automation/configs/:configId/rules", requireAuth, async (req, res) => {
    try {
      const { configId } = req.params;
      const userId = req.session.userId!;

      const config = await storage.getAutomationConfig(configId);
      if (!config || config.userId !== userId) {
        return res.status(404).json({ message: "Config not found" });
      }

      const rules = await storage.getAutomationRulesByConfig(configId);
      res.json(rules);
    } catch (error) {
      console.error("Get automation rules error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/automation/configs/:configId/rules", requireAuth, async (req, res) => {
    try {
      const { configId } = req.params;
      const userId = req.session.userId!;

      const config = await storage.getAutomationConfig(configId);
      if (!config || config.userId !== userId) {
        return res.status(404).json({ message: "Config not found" });
      }

      const { name, description, isEnabled, priority, conditions, actions } = req.body;

      const rule = await storage.createAutomationRule({
        configId,
        name,
        description,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        priority: priority || 0,
        conditions: conditions || [],
        actions: actions || [],
      });

      res.json(rule);
    } catch (error) {
      console.error("Create automation rule error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/automation/rules/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const rule = await storage.getAutomationRule(id);
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }

      const config = await storage.getAutomationConfig(rule.configId);
      if (!config || config.userId !== userId) {
        return res.status(404).json({ message: "Rule not found" });
      }

      const { name, description, isEnabled, priority, conditions, actions } = req.body;
      const updated = await storage.updateAutomationRule(id, {
        name,
        description,
        isEnabled,
        priority,
        conditions,
        actions,
      });

      res.json(updated);
    } catch (error) {
      console.error("Update automation rule error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/automation/rules/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const rule = await storage.getAutomationRule(id);
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }

      const config = await storage.getAutomationConfig(rule.configId);
      if (!config || config.userId !== userId) {
        return res.status(404).json({ message: "Rule not found" });
      }

      await storage.deleteAutomationRule(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete automation rule error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Automation Log Routes
  app.get("/api/automation/configs/:configId/logs", requireAuth, async (req, res) => {
    try {
      const { configId } = req.params;
      const userId = req.session.userId!;
      const limit = parseInt(req.query.limit as string || '100');

      const config = await storage.getAutomationConfig(configId);
      if (!config || config.userId !== userId) {
        return res.status(404).json({ message: "Config not found" });
      }

      const logs = await storage.getAutomationLogs(configId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Get automation logs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Operation Notes Routes
  app.get("/api/operations/:operationId/notes", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const notes = await storage.getOperationNotes(operationId);
      res.json(notes);
    } catch (error) {
      console.error("Get operation notes error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/operations/:operationId/notes", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const userId = req.session.userId!;
      const { content } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({ message: "Content is required" });
      }

      const note = await storage.createOperationNote({
        operationId,
        userId,
        content: content.trim(),
      });

      res.status(201).json(note);
    } catch (error) {
      console.error("Create operation note error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/operations/:operationId/notes/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;
      const { content } = req.body;

      const note = await storage.getOperationNote(id);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      if (note.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.updateOperationNote(id, { content });
      res.json(updated);
    } catch (error) {
      console.error("Update operation note error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/operations/:operationId/notes/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const note = await storage.getOperationNote(id);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      if (note.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteOperationNote(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete operation note error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Operation Tasks Routes
  app.get("/api/operations/:operationId/tasks", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const tasks = await storage.getOperationTasks(operationId);
      res.json(tasks);
    } catch (error) {
      console.error("Get operation tasks error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/operations/:operationId/tasks", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const userId = req.session.userId!;
      const { title, description, status, priority, assignedToId, dueDate } = req.body;

      if (!title || title.trim() === '') {
        return res.status(400).json({ message: "Title is required" });
      }

      const task = await storage.createOperationTask({
        operationId,
        title: title.trim(),
        description,
        status: status || 'pending',
        priority: priority || 'medium',
        assignedToId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        createdById: userId,
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Create operation task error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/operations/:operationId/tasks/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, status, priority, assignedToId, dueDate, completedAt, modifiedManually } = req.body;

      const task = await storage.getOperationTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const updated = await storage.updateOperationTask(id, {
        title,
        description,
        status,
        priority,
        assignedToId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined,
        modifiedManually: modifiedManually !== undefined ? modifiedManually : task.modifiedManually,
      });

      res.json(updated);
    } catch (error) {
      console.error("Update operation task error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/operations/:operationId/tasks/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const task = await storage.getOperationTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      await storage.deleteOperationTask(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete operation task error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin endpoint to clean all existing tasks and notes
  app.post("/api/admin/clean-tasks-and-notes", requireAdmin, async (req, res) => {
    try {
      const { TextCleaner } = await import("./text-cleaner");
      
      // Get all operations
      const operations = await storage.getAllOperations();
      
      let tasksUpdated = 0;
      let notesUpdated = 0;
      let tasksSkipped = 0;
      let notesSkipped = 0;
      
      console.log(`[Admin Clean] Starting cleanup of tasks and notes for ${operations.length} operations`);
      
      for (const operation of operations) {
        // Clean tasks for this operation
        const tasks = await storage.getOperationTasks(operation.id);
        
        for (const task of tasks) {
          // Skip if manually modified
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
          
          // Only update if something changed
          if (cleanedTitle !== originalTitle || cleanedDescription !== originalDescription) {
            await storage.updateOperationTask(task.id, {
              title: cleanedTitle,
              description: cleanedDescription,
            });
            tasksUpdated++;
            console.log(`[Admin Clean] Task updated: "${originalTitle}" -> "${cleanedTitle}"`);
          } else {
            tasksSkipped++;
          }
        }
        
        // Clean notes for this operation
        const notes = await storage.getOperationNotes(operation.id);
        
        for (const note of notes) {
          const originalContent = note.content;
          const cleanedContent = TextCleaner.cleanNoteContent(note.content);
          
          // Only update if something changed
          if (cleanedContent !== originalContent) {
            await storage.updateOperationNote(note.id, {
              content: cleanedContent,
            });
            notesUpdated++;
            console.log(`[Admin Clean] Note updated: "${originalContent}" -> "${cleanedContent}"`);
          } else {
            notesSkipped++;
          }
        }
      }
      
      console.log(`[Admin Clean] Cleanup completed: ${tasksUpdated} tasks updated, ${tasksSkipped} tasks skipped, ${notesUpdated} notes updated, ${notesSkipped} notes skipped`);
      
      res.json({
        success: true,
        tasksUpdated,
        tasksSkipped,
        notesUpdated,
        notesSkipped,
        totalOperations: operations.length
      });
    } catch (error) {
      console.error("Clean tasks and notes error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Object Storage Routes (Referenced from javascript_object_storage integration)
  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Operation Folders Routes
  app.get("/api/operations/:operationId/folders", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const folders = await storage.getOperationFolders(operationId);
      res.json(folders);
    } catch (error) {
      console.error("Get operation folders error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/operations/:operationId/folders", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const userId = req.session.userId!;
      const data = insertOperationFolderSchema.parse({ ...req.body, operationId, createdBy: userId });

      const folder = await storage.createOperationFolder(data);
      res.status(201).json(folder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Create folder error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/operations/:operationId/folders/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, category, color } = req.body;

      const folder = await storage.updateOperationFolder(id, { name, description, category, color });
      res.json(folder);
    } catch (error) {
      console.error("Update folder error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/operations/:operationId/folders/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteOperationFolder(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete folder error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Operation Files Routes
  app.get("/api/operations/:operationId/files", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const { folderId } = req.query;

      const files = await storage.getOperationFiles(
        operationId,
        folderId === 'null' ? null : (folderId as string | undefined)
      );
      res.json(files);
    } catch (error) {
      console.error("Get operation files error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/b2/upload", requireAuth, async (req, res) => {
    try {
      const { buffer: base64Buffer, filename, mimeType, operationId, category } = req.body;
      const userId = req.session.userId!;

      if (!base64Buffer || !filename || !mimeType || !operationId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const buffer = Buffer.from(base64Buffer, 'base64');

      // Upload to Backblaze with deduplication
      const uploadResult = await backblazeStorage.uploadOperationFile(
        buffer,
        filename,
        mimeType,
        operationId,
        userId,
        category
      );

      res.json({
        b2Key: uploadResult.fileKey,
        fileHash: uploadResult.fileHash,
        size: uploadResult.size,
        isDuplicate: uploadResult.isDuplicate,
      });
    } catch (error) {
      console.error("Backblaze upload error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/operations/:operationId/files", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const userId = req.session.userId!;
      const { fileURL, b2Key, fileHash, originalName, mimeType, size, folderId, category, description, tags } = req.body;

      if (!originalName || !mimeType || !size) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      let objectPath: string | null = null;

      // Support both Backblaze and Replit Object Storage for backwards compatibility
      if (fileURL && !b2Key) {
        // Legacy: Using Replit Object Storage
        const objectStorageService = new ObjectStorageService();
        objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
          fileURL,
          {
            owner: userId,
            visibility: "private",
          }
        );
      }

      const finalTags = (tags && Array.isArray(tags) && tags.length > 0) ? tags : null;

      const file = await storage.createOperationFile({
        operationId,
        folderId: folderId || null,
        name: originalName,
        originalName,
        mimeType,
        size,
        objectPath: objectPath || null,
        b2Key: b2Key || null,
        fileHash: fileHash || null,
        category: category || null,
        description: description || null,
        tags: finalTags,
        uploadedBy: userId,
        uploadedVia: "manual",
      });

      res.status(201).json(file);
    } catch (error) {
      console.error("Create file error:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        operationId: req.params.operationId,
        userId: req.session.userId,
        body: req.body
      });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/operations/:operationId/files/preview-urls", requireAuth, async (req, res) => {
    try {
      const { fileIds } = req.body;
      
      if (!fileIds || !Array.isArray(fileIds)) {
        return res.status(400).json({ message: "fileIds array is required" });
      }

      const files = await Promise.all(
        fileIds.map((id: string) => storage.getOperationFile(id))
      );

      const urlMap: Record<string, string> = {};
      
      for (const file of files) {
        if (!file || !file.b2Key) continue;
        
        try {
          const signedUrl = await backblazeStorage.getSignedUrl(file.b2Key, 3600);
          urlMap[file.id] = signedUrl;
        } catch (error) {
          console.error(`Failed to generate signed URL for file ${file.id}:`, error);
        }
      }

      res.json(urlMap);
    } catch (error) {
      console.error("Generate preview URLs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/operations/:operationId/files/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, category, tags, folderId } = req.body;

      const file = await storage.updateOperationFile(id, {
        name,
        description,
        category,
        tags,
        folderId,
      });
      res.json(file);
    } catch (error) {
      console.error("Update file error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/operations/:operationId/files/:id/download", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const file = await storage.getOperationFile(id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Verify user has access to the operation
      const operation = await storage.getOperation(file.operationId);
      if (!operation) {
        return res.status(404).json({ message: "Operation not found" });
      }

      let buffer: Buffer;

      // Try to download from Backblaze first if b2Key exists
      if (file.b2Key) {
        try {
          buffer = await backblazeStorage.downloadFile(file.b2Key);
          console.log(`Downloaded file from Backblaze: ${file.originalName}`);
        } catch (error) {
          console.error(`Error downloading from Backblaze for file ${file.id}:`, error);
          // If Backblaze fails and we have objectPath, try Replit Object Storage
          if (file.objectPath) {
            const objectStorageService = new ObjectStorageService();
            const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
            const bufferData = await objectFile.download();
            buffer = bufferData[0];
          } else {
            return res.status(500).json({ message: "File not available for download" });
          }
        }
      } else if (file.objectPath) {
        // Legacy: Download from Replit Object Storage
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
        const bufferData = await objectFile.download();
        buffer = bufferData[0];
      } else {
        return res.status(404).json({ message: "File not available for download" });
      }

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      res.setHeader('Content-Length', buffer.length);

      res.send(buffer);
    } catch (error) {
      console.error("Download operation file error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/operations/:operationId/files/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteOperationFile(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get thumbnail for file (lazy loading)
  app.get("/api/files/:id/thumbnail", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const size = (req.query.size as 'small' | 'medium' | 'large') || 'small';

      const file = await storage.getOperationFile(id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const { ThumbnailService } = await import('./thumbnail-service');
      const thumbnailUrl = await ThumbnailService.getOrGenerateThumbnail(
        file.id,
        file.b2Key,
        file.mimeType,
        size
      );

      if (!thumbnailUrl) {
        return res.status(404).json({ message: "Thumbnail not available for this file type" });
      }

      // Redirigir al signed URL del thumbnail
      res.redirect(thumbnailUrl);
    } catch (error) {
      console.error("Get thumbnail error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Batch generate thumbnails for multiple files
  app.post("/api/files/thumbnails/batch", requireAuth, async (req, res) => {
    try {
      const { fileIds, size } = req.body as { fileIds: string[]; size?: 'small' | 'medium' | 'large' };

      if (!Array.isArray(fileIds)) {
        return res.status(400).json({ message: "fileIds must be an array" });
      }

      const files = await Promise.all(
        fileIds.map(id => storage.getOperationFile(id))
      );

      const validFiles = files.filter(f => f !== null).map(f => ({
        id: f!.id,
        b2Key: f!.b2Key,
        mimeType: f!.mimeType
      }));

      const { ThumbnailService } = await import('./thumbnail-service');
      const thumbnails = await ThumbnailService.generateBatchThumbnails(validFiles, size || 'small');

      const result: Record<string, string | null> = {};
      thumbnails.forEach((url, id) => {
        result[id] = url;
      });

      res.json(result);
    } catch (error) {
      console.error("Batch generate thumbnails error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get messages linked to an operation (optimized endpoint)
  app.get("/api/operations/:operationId/messages", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const messages = await storage.getOperationMessages(operationId);
      res.json(messages);
    } catch (error) {
      console.error("Get operation messages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Manually trigger email-operation linking
  app.post("/api/gmail/link-messages", requireAuth, async (req, res) => {
    try {
      await storage.linkMessagesToOperations();
      res.json({ message: "Email linking completed" });
    } catch (error) {
      console.error("Link messages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Operation Analysis - AI-powered insights
  app.get("/api/operations/:operationId/analysis", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const { operationAnalysisService } = await import("./operation-analysis-service");
      
      // Get or generate analysis
      const analysis = await operationAnalysisService.getOrGenerateAnalysis(operationId);
      res.json(analysis);
    } catch (error) {
      console.error("Get operation analysis error:", error);
      res.status(500).json({ 
        message: "Failed to generate analysis",
        error: error.message 
      });
    }
  });

  // Force refresh operation analysis
  app.post("/api/operations/:operationId/analysis/refresh", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const { operationAnalysisService } = await import("./operation-analysis-service");
      
      // Delete existing analysis to force regeneration
      const existing = await storage.getOperationAnalysis(operationId);
      if (existing) {
        await storage.deleteOperationAnalysis(existing.id);
      }
      
      // Generate fresh analysis
      const analysis = await operationAnalysisService.getOrGenerateAnalysis(operationId);
      res.json(analysis);
    } catch (error) {
      console.error("Refresh operation analysis error:", error);
      res.status(500).json({ 
        message: "Failed to refresh analysis",
        error: error.message 
      });
    }
  });

  // LiveChat routes
  app.post("/api/chat/conversations", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const conversation = await storage.createChatConversation(userId);
      res.json(conversation);
    } catch (error) {
      console.error("Create conversation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/chat/conversations", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/chat/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const conversation = await storage.getChatConversation(id);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const messages = await storage.getChatMessages(id);
      res.json(messages);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/chat/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.session.userId!;

      const conversation = await storage.getChatConversation(id);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Save user message
      const userMessage = await storage.createChatMessage(id, 'user', content);

      // Get conversation history
      const messages = await storage.getChatMessages(id);
      const history = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt
      }));

      // Get response from Gemini
      const { geminiService } = await import('./gemini-service');
      const assistantResponse = await geminiService.chat(history, userId);

      // Save assistant message
      const assistantMessage = await storage.createChatMessage(id, 'assistant', assistantResponse);

      res.json({
        userMessage,
        assistantMessage
      });
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ message: "Error al procesar el mensaje" });
    }
  });

  app.delete("/api/chat/conversations/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const conversation = await storage.getChatConversation(id);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      await storage.archiveChatConversation(id);
      res.json({ message: "Conversation archived" });
    } catch (error) {
      console.error("Archive conversation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Financial Suggestions routes
  app.get("/api/financial-suggestions/pending", requireAuth, async (req, res) => {
    try {
      const { type, operationId } = req.query;
      let suggestions = await storage.getAllPendingFinancialSuggestions();
      
      // Filter by type if provided
      if (type && (type === 'payment' || type === 'expense')) {
        suggestions = suggestions.filter(s => s.type === type);
      }
      
      // Filter by operationId if provided
      if (operationId && typeof operationId === 'string') {
        suggestions = suggestions.filter(s => s.operationId === operationId);
      }
      
      res.json(suggestions);
    } catch (error) {
      console.error("Get pending financial suggestions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/financial-suggestions/operation/:operationId", requireAuth, async (req, res) => {
    try {
      const { operationId } = req.params;
      const { status } = req.query;
      const suggestions = await storage.getFinancialSuggestions(operationId, status as string);
      res.json(suggestions);
    } catch (error) {
      console.error("Get operation financial suggestions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/financial-suggestions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const suggestion = await storage.getFinancialSuggestion(id);
      if (!suggestion) {
        return res.status(404).json({ message: "Financial suggestion not found" });
      }
      res.json(suggestion);
    } catch (error) {
      console.error("Get financial suggestion error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/financial-suggestions/:id/approve", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const suggestion = await storage.getFinancialSuggestion(id);
      if (!suggestion) {
        return res.status(404).json({ message: "Financial suggestion not found" });
      }

      if (suggestion.status !== 'pending') {
        return res.status(400).json({ message: "Suggestion already processed" });
      }

      const approved = await storage.approveFinancialSuggestion(id, userId);
      
      if (!approved) {
        return res.status(500).json({ message: "Failed to approve suggestion" });
      }

      // 🎓 LEARN FROM APPROVED SUGGESTION
      const { knowledgeBaseService } = await import('./knowledge-base-service');
      knowledgeBaseService.learnFromApprovedSuggestion(id).catch(err => {
        console.error('[Learning] Error learning from approved suggestion:', err);
      });

      if (suggestion.type === 'payment') {
        const payment = await storage.createPayment({
          operationId: suggestion.operationId,
          amount: parseFloat(suggestion.amount.toString()),
          currency: suggestion.currency,
          date: suggestion.detectedDate || new Date(),
          method: 'bank_transfer',
          description: suggestion.description || 'Payment detected from email',
        });

        await storage.updateFinancialSuggestion(id, {
          status: 'processed',
          createdRecordId: payment.id,
          createdRecordType: 'payment',
        });

        res.json({ message: "Payment created successfully", payment, suggestion: approved });
      } else if (suggestion.type === 'expense') {
        const expense = await storage.createExpense({
          operationId: suggestion.operationId,
          amount: parseFloat(suggestion.amount.toString()),
          currency: suggestion.currency,
          date: suggestion.detectedDate || new Date(),
          category: 'general',
          description: suggestion.description || 'Expense detected from email',
        });

        await storage.updateFinancialSuggestion(id, {
          status: 'processed',
          createdRecordId: expense.id,
          createdRecordType: 'expense',
        });

        res.json({ message: "Expense created successfully", expense, suggestion: approved });
      }
    } catch (error) {
      console.error("Approve financial suggestion error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/financial-suggestions/:id/reject", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.session.userId!;

      const suggestion = await storage.getFinancialSuggestion(id);
      if (!suggestion) {
        return res.status(404).json({ message: "Financial suggestion not found" });
      }

      if (suggestion.status !== 'pending') {
        return res.status(400).json({ message: "Suggestion already processed" });
      }

      const rejected = await storage.rejectFinancialSuggestion(id, userId, reason || 'No reason provided');
      
      // 🎓 LEARN FROM REJECTED SUGGESTION
      const { knowledgeBaseService } = await import('./knowledge-base-service');
      knowledgeBaseService.learnFromRejectedSuggestion(id, reason || 'No reason provided').catch(err => {
        console.error('[Learning] Error learning from rejected suggestion:', err);
      });

      res.json({ message: "Financial suggestion rejected", suggestion: rejected });
    } catch (error) {
      console.error("Reject financial suggestion error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ADMIN: Seed knowledge base with professional logistics feedback
  app.post("/api/admin/seed-knowledge", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { seedKnowledgeBase } = await import('./seed-knowledge-base');
      await seedKnowledgeBase();
      res.json({ message: "Knowledge base populated successfully with professional logistics templates!" });
    } catch (error: any) {
      console.error("Seed knowledge base error:", error);
      res.status(500).json({ message: error?.message || "Error seeding knowledge base" });
    }
  });

  // Get knowledge base statistics for Learning Center
  app.get("/api/knowledge-base/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getKnowledgeBaseStats();
      res.json(stats);
    } catch (error) {
      console.error("Get knowledge base stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all knowledge base entries with filtering
  app.get("/api/knowledge-base", requireAuth, async (req, res) => {
    try {
      const { type } = req.query;
      const entries = await storage.getKnowledgeBaseEntries(type as string);
      res.json(entries);
    } catch (error) {
      console.error("Get knowledge base entries error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 🆕 TEST: Process operation for client auto-assignment from invoice
  app.post("/api/operations/:id/test-client-assignment", requireAuth, async (req, res) => {
    try {
      const { id: operationId } = req.params;
      
      console.log(`[TEST] Processing operation ${operationId} for client auto-assignment...`);
      
      // Get operation
      const operation = await storage.getOperation(operationId);
      if (!operation) {
        return res.status(404).json({ message: "Operation not found" });
      }
      
      // Get attachments
      const attachments = await storage.getOperationAttachmentsByOperationId(operationId);
      
      // Filter PDF attachments that might be invoices
      const invoiceCandidates = attachments.filter(att => 
        att.filename.toLowerCase().includes('factura') ||
        att.filename.toLowerCase().includes('invoice') ||
        att.filename.toLowerCase().endsWith('.pdf')
      );
      
      if (invoiceCandidates.length === 0) {
        return res.json({
          success: false,
          message: "No se encontraron archivos PDF de facturas en esta operación",
          attachmentCount: attachments.length
        });
      }
      
      console.log(`[TEST] Found ${invoiceCandidates.length} invoice candidates`);
      
      const results = [];
      
      // Try each attachment
      for (const attachment of invoiceCandidates) {
        console.log(`[TEST] Processing attachment: ${attachment.filename}`);
        
        const result = await clientAutoAssignmentService.processAttachmentForClientAssignment(
          operationId,
          attachment.id,
          attachment.filename,
          attachment.b2Key
        );
        
        results.push({
          filename: attachment.filename,
          ...result
        });
        
        // If successful, stop processing
        if (result.success) {
          break;
        }
      }
      
      // Get updated operation
      const updatedOperation = await storage.getOperation(operationId);
      
      res.json({
        success: results.some(r => r.success),
        results,
        operation: updatedOperation,
        message: results.some(r => r.success) 
          ? "Cliente asignado exitosamente" 
          : "No se pudo asignar cliente desde las facturas encontradas"
      });
      
    } catch (error: any) {
      console.error("[TEST] Error processing client assignment:", error);
      res.status(500).json({ 
        success: false,
        message: "Error interno del servidor",
        error: error?.message 
      });
    }
  });

  // 🆕 TEST: Extract invoice data from attachment (diagnostic)
  app.get("/api/operations/:operationId/attachments/:attachmentId/extract-invoice", requireAuth, async (req, res) => {
    try {
      const { operationId, attachmentId } = req.params;
      
      console.log(`[TEST] Extracting invoice data from attachment ${attachmentId}...`);
      
      // Get attachment
      const attachments = await storage.getOperationAttachmentsByOperationId(operationId);
      const attachment = attachments.find(a => a.id === attachmentId);
      
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }
      
      // Download file from B2
      const fileBuffer = await backblazeStorage.downloadFile(attachment.b2Key);
      
      // Extract invoice data
      const invoiceData = await facturamaInvoiceExtractor.extractInvoiceData(
        fileBuffer,
        attachment.filename
      );
      
      if (!invoiceData) {
        return res.json({
          success: false,
          message: "No se pudo extraer datos de factura del archivo",
          filename: attachment.filename
        });
      }
      
      res.json({
        success: true,
        invoiceData,
        filename: attachment.filename
      });
      
    } catch (error: any) {
      console.error("[TEST] Error extracting invoice data:", error);
      res.status(500).json({ 
        success: false,
        message: "Error interno del servidor",
        error: error?.message 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}