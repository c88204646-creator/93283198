import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import bcrypt from "bcrypt";
import { 
  insertUserSchema, insertClientSchema, insertEmployeeSchema, insertOperationSchema,
  insertInvoiceSchema, insertProposalSchema, insertExpenseSchema, insertLeadSchema,
  insertCustomFieldSchema
} from "@shared/schema";
import { z } from "zod";

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

  app.post("/api/auth/logout", (req, res) => {
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

  // Dashboard Stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const [
        allOperations,
        allClients,
        allEmployees,
        allInvoices,
        allProposals,
        allExpenses,
        allLeads,
      ] = await Promise.all([
        storage.getAllOperations(),
        storage.getAllClients(),
        storage.getAllEmployees(),
        storage.getAllInvoices(),
        storage.getAllProposals(),
        storage.getAllExpenses(),
        storage.getAllLeads(),
      ]);

      const stats = {
        operations: {
          total: allOperations.length,
          active: allOperations.filter(o => o.status === "in-progress").length,
        },
        clients: {
          total: allClients.length,
          active: allClients.filter(c => c.status === "active").length,
        },
        employees: {
          total: allEmployees.length,
          active: allEmployees.filter(e => e.status === "active").length,
        },
        invoices: {
          total: allInvoices.length,
          pending: allInvoices.filter(i => i.status === "sent" || i.status === "overdue").length,
          paid: allInvoices.filter(i => i.status === "paid").length,
        },
        proposals: {
          total: allProposals.length,
          pending: allProposals.filter(p => p.status === "sent").length,
        },
        expenses: {
          total: allExpenses.length,
          pending: allExpenses.filter(e => e.status === "pending").length,
        },
        leads: {
          total: allLeads.length,
          new: allLeads.filter(l => l.status === "new").length,
        },
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
      const allClients = await storage.getAllClients();
      res.json(allClients);
    } catch (error) {
      console.error("Get clients error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const data = insertClientSchema.parse(req.body);
      const client = await storage.createClient(data);
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
      const client = await storage.updateClient(id, data);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
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
      await storage.deleteClient(id);
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Delete client error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Employee Routes (Admin/Manager only for viewing all, create, delete)
  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      const allEmployees = await storage.getAllEmployees();
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
      const employee = await storage.updateEmployee(id, data);
      
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
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
      res.json({ message: "Employee deleted successfully" });
    } catch (error) {
      console.error("Delete employee error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Operation Routes
  app.get("/api/operations", requireAuth, async (req, res) => {
    try {
      const allOperations = await storage.getAllOperations();
      res.json(allOperations);
    } catch (error) {
      console.error("Get operations error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/operations", requireAuth, async (req, res) => {
    try {
      const data = insertOperationSchema.parse(req.body);
      const operation = await storage.createOperation(data);
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
      const data = insertOperationSchema.partial().parse(req.body);
      const operation = await storage.updateOperation(id, data);
      
      if (!operation) {
        return res.status(404).json({ message: "Operation not found" });
      }
      
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

  const httpServer = createServer(app);

  return httpServer;
}
