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
  currency: text("currency").notNull().default("USD"), // MXN, USD, ARS
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

// Operation Employees junction table (many-to-many)
export const operationEmployees = pgTable("operation_employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  operationId: varchar("operation_id").notNull().references(() => operations.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  operationId: varchar("operation_id").references(() => operations.id, { onDelete: "set null" }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
  currency: text("currency").notNull().default("USD"), // MXN, USD, ARS - from client
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  tax: decimal("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
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
  currency: text("currency").notNull().default("USD"), // MXN, USD, ARS - from client
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  tax: decimal("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("draft"), // draft, sent, accepted, rejected, expired, converted
  validUntil: timestamp("valid_until").notNull(),
  convertedToInvoiceId: varchar("converted_to_invoice_id").references(() => invoices.id, { onDelete: "set null" }),
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

// Invoice Items table
export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Proposal Items table
export const proposalItems = pgTable("proposal_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Payments table
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, transfer, check, card, other
  reference: text("reference"),
  notes: text("notes"),
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

// Gmail Accounts table
export const gmailAccounts = pgTable("gmail_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiry: timestamp("token_expiry").notNull(),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  syncFromDate: timestamp("sync_from_date").notNull(), // User-configured start date for sync
  lastSyncDate: timestamp("last_sync_date"),
  firstEmailDate: timestamp("first_email_date"), // Detected oldest email in account
  status: text("status").notNull().default("active"), // active, paused, error, disconnected
  syncStatus: text("sync_status").notNull().default("pending"), // pending, syncing, completed, error
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Gmail Messages table
export const gmailMessages = pgTable("gmail_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gmailAccountId: varchar("gmail_account_id").notNull().references(() => gmailAccounts.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull().unique(), // Gmail message ID
  threadId: text("thread_id").notNull(),
  subject: text("subject"),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmails: text("to_emails").array().notNull(), // Array of recipient emails
  ccEmails: text("cc_emails").array(), // Array of CC emails
  bccEmails: text("bcc_emails").array(), // Array of BCC emails
  date: timestamp("date").notNull(),
  snippet: text("snippet"), // Preview text
  bodyText: text("body_text"), // Plain text body
  bodyHtml: text("body_html"), // HTML body
  labels: text("labels").array(), // Gmail labels
  hasAttachments: boolean("has_attachments").notNull().default(false),
  isRead: boolean("is_read").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  isImportant: boolean("is_important").notNull().default(false),
  internalDate: text("internal_date"), // Gmail internal date
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Gmail Attachments table
export const gmailAttachments = pgTable("gmail_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gmailMessageId: varchar("gmail_message_id").notNull().references(() => gmailMessages.id, { onDelete: "cascade" }),
  attachmentId: text("attachment_id").notNull(), // Gmail attachment ID
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // Size in bytes
  data: text("data"), // Base64 encoded data (optional, can be fetched on demand)
  isInline: boolean("is_inline").notNull().default(false),
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
  operationAssignments: many(operationEmployees),
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
  employeeAssignments: many(operationEmployees),
  invoices: many(invoices),
  expenses: many(expenses),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
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
  items: many(invoiceItems),
  payments: many(payments),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  client: one(clients, {
    fields: [proposals.clientId],
    references: [clients.id],
  }),
  employee: one(employees, {
    fields: [proposals.employeeId],
    references: [employees.id],
  }),
  convertedToInvoice: one(invoices, {
    fields: [proposals.convertedToInvoiceId],
    references: [invoices.id],
  }),
  items: many(proposalItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const proposalItemsRelations = relations(proposalItems, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalItems.proposalId],
    references: [proposals.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
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

export const operationEmployeesRelations = relations(operationEmployees, ({ one }) => ({
  operation: one(operations, {
    fields: [operationEmployees.operationId],
    references: [operations.id],
  }),
  employee: one(employees, {
    fields: [operationEmployees.employeeId],
    references: [employees.id],
  }),
}));

export const gmailAccountsRelations = relations(gmailAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [gmailAccounts.userId],
    references: [users.id],
  }),
  messages: many(gmailMessages),
}));

export const gmailMessagesRelations = relations(gmailMessages, ({ one, many }) => ({
  account: one(gmailAccounts, {
    fields: [gmailMessages.gmailAccountId],
    references: [gmailAccounts.id],
  }),
  attachments: many(gmailAttachments),
}));

export const gmailAttachmentsRelations = relations(gmailAttachments, ({ one }) => ({
  message: one(gmailMessages, {
    fields: [gmailAttachments.gmailMessageId],
    references: [gmailMessages.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true });
export const insertOperationSchema = createInsertSchema(operations).omit({ id: true, createdAt: true });
export const insertOperationEmployeeSchema = createInsertSchema(operationEmployees).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertProposalSchema = createInsertSchema(proposals).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true, createdAt: true });
export const insertProposalItemSchema = createInsertSchema(proposalItems).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertCustomFieldSchema = createInsertSchema(customFields).omit({ id: true, createdAt: true });
export const insertCustomFieldValueSchema = createInsertSchema(customFieldValues).omit({ id: true, createdAt: true });
export const insertGmailAccountSchema = createInsertSchema(gmailAccounts).omit({ id: true, createdAt: true });
export const insertGmailMessageSchema = createInsertSchema(gmailMessages).omit({ id: true, createdAt: true });
export const insertGmailAttachmentSchema = createInsertSchema(gmailAttachments).omit({ id: true, createdAt: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export type InsertOperation = z.infer<typeof insertOperationSchema>;
export type Operation = typeof operations.$inferSelect;

export type InsertOperationEmployee = z.infer<typeof insertOperationEmployeeSchema>;
export type OperationEmployee = typeof operationEmployees.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;

export type InsertProposalItem = z.infer<typeof insertProposalItemSchema>;
export type ProposalItem = typeof proposalItems.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

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

export type InsertGmailAccount = z.infer<typeof insertGmailAccountSchema>;
export type GmailAccount = typeof gmailAccounts.$inferSelect;

export type InsertGmailMessage = z.infer<typeof insertGmailMessageSchema>;
export type GmailMessage = typeof gmailMessages.$inferSelect;

export type InsertGmailAttachment = z.infer<typeof insertGmailAttachmentSchema>;
export type GmailAttachment = typeof gmailAttachments.$inferSelect;
