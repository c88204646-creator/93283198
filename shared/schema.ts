import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with role-based access
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("employee"), // admin, manager, employee
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Clients table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  status: text("status").notNull().default("active"), // active, inactive, potential
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Employees table (extends user data)
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  position: text("position").notNull(),
  department: text("department").notNull(),
  hireDate: timestamp("hire_date").notNull(),
  status: text("status").notNull().default("active"), // active, on-leave, terminated
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Operations table
export const operations = pgTable("operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("planning"), // planning, in-progress, completed, cancelled
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  assignedEmployeeId: varchar("assigned_employee_id").references(() => employees.id, { onDelete: "set null" }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  
  // Freight forwarding specific fields
  projectCategory: text("project_category").notNull(), // import, export, domestic, warehousing, etc.
  operationType: text("operation_type").notNull(), // FCL, LCL, Air, Road, Rail, etc.
  shippingMode: text("shipping_mode").notNull(), // sea, air, land, multimodal
  insurance: text("insurance").notNull(), // yes, no
  projectCurrency: text("project_currency").notNull().default("USD"), // USD, EUR, etc.
  
  // Shipping information (optional)
  courier: text("courier"),
  pickUpAddress: text("pick_up_address"),
  deliveryAddress: text("delivery_address"),
  
  // Tracking and dates (optional)
  bookingTracking: text("booking_tracking"),
  pickUpDate: timestamp("pick_up_date"),
  etd: timestamp("etd"), // Estimated Time of Departure
  eta: timestamp("eta"), // Estimated Time of Arrival
  mblAwb: text("mbl_awb"), // Master Bill of Lading / Air Waybill
  hblAwb: text("hbl_awb"), // House Bill of Lading / Air Waybill
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  operationId: varchar("operation_id").references(() => operations.id, { onDelete: "set null" }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"), // draft, sent, paid, overdue, cancelled
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Proposals/Quotes table
export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalNumber: text("proposal_number").notNull().unique(),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"), // draft, sent, accepted, rejected, expired
  validUntil: timestamp("valid_until").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  operationId: varchar("operation_id").references(() => operations.id, { onDelete: "set null" }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  category: text("category").notNull(), // travel, supplies, equipment, services, other
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, reimbursed
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Leads table
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  source: text("source").notNull(), // website, referral, cold-call, social-media, other
  status: text("status").notNull().default("new"), // new, contacted, qualified, proposal-sent, converted, lost
  assignedEmployeeId: varchar("assigned_employee_id").references(() => employees.id, { onDelete: "set null" }),
  notes: text("notes"),
  convertedToClientId: varchar("converted_to_client_id").references(() => clients.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Custom Fields Definition table
export const customFields = pgTable("custom_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleName: text("module_name").notNull(), // operations, clients, employees, invoices, proposals, expenses, leads
  fieldName: text("field_name").notNull(),
  fieldLabel: text("field_label").notNull(),
  fieldType: text("field_type").notNull(), // text, number, date, dropdown, checkbox
  fieldOptions: jsonb("field_options"), // For dropdown options: ["Option 1", "Option 2"]
  required: boolean("required").notNull().default(false),
  defaultValue: text("default_value"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Custom Field Values table
export const customFieldValues = pgTable("custom_field_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleName: text("module_name").notNull(),
  recordId: varchar("record_id").notNull(),
  customFieldId: varchar("custom_field_id").notNull().references(() => customFields.id, { onDelete: "cascade" }),
  value: text("value"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  employee: one(employees, {
    fields: [users.id],
    references: [employees.userId],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  operations: many(operations),
  invoices: many(invoices),
  proposals: many(proposals),
  expenses: many(expenses),
  leads: many(leads),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  operations: many(operations),
  invoices: many(invoices),
  proposals: many(proposals),
  convertedLeads: many(leads),
}));

export const operationsRelations = relations(operations, ({ one, many }) => ({
  client: one(clients, {
    fields: [operations.clientId],
    references: [clients.id],
  }),
  assignedEmployee: one(employees, {
    fields: [operations.assignedEmployeeId],
    references: [employees.id],
  }),
  invoices: many(invoices),
  expenses: many(expenses),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  operation: one(operations, {
    fields: [invoices.operationId],
    references: [operations.id],
  }),
  employee: one(employees, {
    fields: [invoices.employeeId],
    references: [employees.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
  client: one(clients, {
    fields: [proposals.clientId],
    references: [clients.id],
  }),
  employee: one(employees, {
    fields: [proposals.employeeId],
    references: [employees.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  operation: one(operations, {
    fields: [expenses.operationId],
    references: [operations.id],
  }),
  employee: one(employees, {
    fields: [expenses.employeeId],
    references: [employees.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  assignedEmployee: one(employees, {
    fields: [leads.assignedEmployeeId],
    references: [employees.id],
  }),
  convertedToClient: one(clients, {
    fields: [leads.convertedToClientId],
    references: [clients.id],
  }),
}));

export const customFieldsRelations = relations(customFields, ({ many }) => ({
  values: many(customFieldValues),
}));

export const customFieldValuesRelations = relations(customFieldValues, ({ one }) => ({
  customField: one(customFields, {
    fields: [customFieldValues.customFieldId],
    references: [customFields.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true });
export const insertOperationSchema = createInsertSchema(operations).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertProposalSchema = createInsertSchema(proposals).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export const insertCustomFieldSchema = createInsertSchema(customFields).omit({ id: true, createdAt: true });
export const insertCustomFieldValueSchema = createInsertSchema(customFieldValues).omit({ id: true, createdAt: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export type InsertOperation = z.infer<typeof insertOperationSchema>;
export type Operation = typeof operations.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertCustomField = z.infer<typeof insertCustomFieldSchema>;
export type CustomField = typeof customFields.$inferSelect;

export type InsertCustomFieldValue = z.infer<typeof insertCustomFieldValueSchema>;
export type CustomFieldValue = typeof customFieldValues.$inferSelect;
