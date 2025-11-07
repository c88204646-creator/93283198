// Reference: javascript_database blueprint integration
import { db } from "./db";
import { eq, desc, and, inArray, gte, sql, isNull, asc, count } from "drizzle-orm";
import {
  users, clients, employees, operations, invoices, proposals, expenses, leads, 
  invoiceItems, proposalItems, payments, customFields, customFieldValues,
  operationEmployees, gmailAccounts, gmailMessages, gmailAttachments, calendarEvents,
  automationConfigs, automationRules, automationLogs, operationNotes, operationTasks,
  operationFolders, operationFiles, operationAnalyses, knowledgeBase, chatConversations, chatMessages,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Employee, type InsertEmployee,
  type Operation, type InsertOperation,
  type OperationEmployee, type InsertOperationEmployee,
  type Invoice, type InsertInvoice,
  type Proposal, type InsertProposal,
  type Expense, type InsertExpense,
  type Lead, type InsertLead,
  type InvoiceItem, type InsertInvoiceItem,
  type ProposalItem, type InsertProposalItem,
  type Payment, type InsertPayment,
  type CustomField, type InsertCustomField,
  type CustomFieldValue, type InsertCustomFieldValue,
  type GmailAccount, type InsertGmailAccount,
  type GmailMessage, type InsertGmailMessage,
  type GmailAttachment, type InsertGmailAttachment,
  type CalendarEvent, type InsertCalendarEvent,
  type AutomationConfig, type InsertAutomationConfig,
  type AutomationRule, type InsertAutomationRule,
  type AutomationLog, type InsertAutomationLog,
  type OperationNote, type InsertOperationNote,
  type OperationTask, type InsertOperationTask,
  type OperationFolder, type InsertOperationFolder,
  type OperationFile, type InsertOperationFile,
  type OperationAnalysis, type InsertOperationAnalysis,
  type KnowledgeBase, type InsertKnowledgeBase,
  type ChatConversation, type InsertChatConversation,
  type ChatMessage, type InsertChatMessage,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Clients
  getAllClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;
  countClients(): Promise<number>;

  // Employees
  getAllEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployeeByUserId(userId: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<void>;
  countEmployees(): Promise<number>;

  // Operations
  getAllOperations(): Promise<Operation[]>;
  getOperation(id: string): Promise<Operation | undefined>;
  createOperation(operation: InsertOperation): Promise<Operation>;
  updateOperation(id: string, operation: Partial<InsertOperation>): Promise<Operation | undefined>;
  deleteOperation(id: string): Promise<void>;
  countOperations(): Promise<number>;

  // Invoices
  getAllInvoices(): Promise<Invoice[]>;
  getInvoicesByOperation(operationId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<void>;
  countInvoices(): Promise<number>;

  // Proposals
  getAllProposals(): Promise<Proposal[]>;
  getProposal(id: string): Promise<Proposal | undefined>;
  createProposal(proposal: InsertProposal): Promise<Proposal>;
  updateProposal(id: string, proposal: Partial<InsertProposal>): Promise<Proposal | undefined>;
  deleteProposal(id: string): Promise<void>;
  countProposals(): Promise<number>;

  // Invoice Items
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
  getInvoiceItem(id: string): Promise<InvoiceItem | undefined>;
  createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
  updateInvoiceItem(id: string, item: Partial<InsertInvoiceItem>): Promise<InvoiceItem | undefined>;
  deleteInvoiceItem(id: string): Promise<void>;

  // Proposal Items
  getProposalItems(proposalId: string): Promise<ProposalItem[]>;
  getProposalItem(id: string): Promise<ProposalItem | undefined>;
  createProposalItem(item: InsertProposalItem): Promise<ProposalItem>;
  updateProposalItem(id: string, item: Partial<InsertProposalItem>): Promise<ProposalItem | undefined>;
  deleteProposalItem(id: string): Promise<void>;

  // Payments
  getPayments(invoiceId: string): Promise<Payment[]>;
  getPaymentsByOperation(operationId: string): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: string): Promise<void>;

  // Expenses
  getAllExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<void>;
  countExpenses(): Promise<number>;

  // Leads
  getAllLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<void>;
  countLeads(): Promise<number>;

  // Custom Fields
  getAllCustomFields(): Promise<CustomField[]>;
  getCustomField(id: string): Promise<CustomField | undefined>;
  getCustomFieldsByModule(moduleName: string): Promise<CustomField[]>;
  createCustomField(customField: InsertCustomField): Promise<CustomField>;
  updateCustomField(id: string, customField: Partial<InsertCustomField>): Promise<CustomField | undefined>;
  deleteCustomField(id: string): Promise<void>;

  // Custom Field Values
  getCustomFieldValue(customFieldId: string, recordId: string): Promise<CustomFieldValue | undefined>;
  getCustomFieldValuesByRecord(moduleName: string, recordId: string): Promise<CustomFieldValue[]>;
  createCustomFieldValue(value: InsertCustomFieldValue): Promise<CustomFieldValue>;
  updateCustomFieldValue(id: string, value: Partial<InsertCustomFieldValue>): Promise<CustomFieldValue | undefined>;
  deleteCustomFieldValue(id: string): Promise<void>;

  // Operation Employees (many-to-many)
  getOperationEmployees(operationId: string): Promise<string[]>; // Returns employee IDs
  setOperationEmployees(operationId: string, employeeIds: string[]): Promise<void>;
  addOperationEmployee(operationId: string, employeeId: string): Promise<OperationEmployee>;
  removeOperationEmployee(operationId: string, employeeId: string): Promise<void>;

  // Gmail Accounts
  getAllGmailAccounts(userId?: string): Promise<GmailAccount[]>;
  getGmailAccount(id: string): Promise<GmailAccount | undefined>;
  getGmailAccountByEmail(email: string): Promise<GmailAccount | undefined>;
  createGmailAccount(account: InsertGmailAccount): Promise<GmailAccount>;
  updateGmailAccount(id: string, account: Partial<InsertGmailAccount>): Promise<GmailAccount | undefined>;
  deleteGmailAccount(id: string): Promise<void>;

  // Gmail Messages
  getGmailMessages(accountId: string, limit?: number, offset?: number): Promise<GmailMessage[]>;
  getGmailMessagesByOperation(operationId: string): Promise<GmailMessage[]>;
  getGmailMessage(id: string): Promise<GmailMessage | undefined>;
  getGmailMessageByMessageId(messageId: string): Promise<GmailMessage | undefined>;
  createGmailMessage(message: InsertGmailMessage): Promise<GmailMessage>;
  updateGmailMessage(id: string, message: Partial<InsertGmailMessage>): Promise<GmailMessage | undefined>;
  deleteGmailMessage(id: string): Promise<void>;

  // Gmail Attachments
  getGmailAttachments(messageId: string): Promise<GmailAttachment[]>;
  getGmailAttachment(id: string): Promise<GmailAttachment | undefined>;
  createGmailAttachment(attachment: InsertGmailAttachment): Promise<GmailAttachment>;
  deleteGmailAttachment(id: string): Promise<void>;

  // Calendar Events
  getAllCalendarEvents(userId: string): Promise<CalendarEvent[]>;
  getCalendarEventsByAccount(accountId: string): Promise<CalendarEvent[]>;
  getCalendarEvent(id: string): Promise<CalendarEvent | undefined>;
  getCalendarEventsByGoogleId(eventId: string): Promise<CalendarEvent[]>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<void>;

  // Automation Configs
  getAutomationConfigs(userId: string): Promise<AutomationConfig[]>;
  getAutomationConfig(id: string): Promise<AutomationConfig | undefined>;
  getAutomationConfigByModule(userId: string, moduleName: string): Promise<AutomationConfig | undefined>;
  getEnabledAutomationConfigs(): Promise<AutomationConfig[]>;
  createAutomationConfig(config: InsertAutomationConfig): Promise<AutomationConfig>;
  updateAutomationConfig(id: string, config: Partial<InsertAutomationConfig>): Promise<AutomationConfig | undefined>;
  deleteAutomationConfig(id: string): Promise<void>;

  // Automation Rules
  getAutomationRulesByConfig(configId: string): Promise<AutomationRule[]>;
  getAutomationRule(id: string): Promise<AutomationRule | undefined>;
  createAutomationRule(rule: InsertAutomationRule): Promise<AutomationRule>;
  updateAutomationRule(id: string, rule: Partial<InsertAutomationRule>): Promise<AutomationRule | undefined>;
  deleteAutomationRule(id: string): Promise<void>;

  // Automation Logs
  getAutomationLogs(configId?: string, limit?: number): Promise<AutomationLog[]>;
  createAutomationLog(log: InsertAutomationLog): Promise<AutomationLog>;

  // Operation Employees
  assignEmployeeToOperation(operationId: string, employeeId: string): Promise<void>;
  getOperationEmployees(operationId: string): Promise<Employee[]>;

  // Helper functions for automation
  getUnprocessedMessages(accountIds: string[], since: Date): Promise<GmailMessage[]>;
  linkMessageToOperation(messageId: string, operationId: string | null): Promise<void>;
  getOperationMessages(operationId: string): Promise<GmailMessage[]>;
  linkMessagesToOperations(): Promise<void>;

  // Operation Notes
  getOperationNotes(operationId: string): Promise<OperationNote[]>;
  getOperationNote(id: string): Promise<OperationNote | undefined>;
  createOperationNote(note: InsertOperationNote): Promise<OperationNote>;
  updateOperationNote(id: string, note: Partial<InsertOperationNote>): Promise<OperationNote | undefined>;
  deleteOperationNote(id: string): Promise<void>;

  // Operation Tasks
  getOperationTasks(operationId: string): Promise<OperationTask[]>;
  getOperationTask(id: string): Promise<OperationTask | undefined>;
  createOperationTask(task: InsertOperationTask): Promise<OperationTask>;
  updateOperationTask(id: string, task: Partial<InsertOperationTask>): Promise<OperationTask | undefined>;
  deleteOperationTask(id: string): Promise<void>;

  // Operation Folders
  getOperationFolders(operationId: string): Promise<OperationFolder[]>;
  getOperationFolder(id: string): Promise<OperationFolder | undefined>;
  createOperationFolder(folder: InsertOperationFolder): Promise<OperationFolder>;
  updateOperationFolder(id: string, folder: Partial<InsertOperationFolder>): Promise<OperationFolder | undefined>;
  deleteOperationFolder(id: string): Promise<void>;

  // Operation Files
  getOperationFiles(operationId: string, folderId?: string | null): Promise<OperationFile[]>;
  getOperationFile(id: string): Promise<OperationFile | undefined>;
  createOperationFile(file: InsertOperationFile): Promise<OperationFile>;
  updateOperationFile(id: string, file: Partial<InsertOperationFile>): Promise<OperationFile | undefined>;
  deleteOperationFile(id: string): Promise<void>;

  // Operation Analysis
  getOperationAnalysis(operationId: string): Promise<OperationAnalysis | undefined>;
  createOperationAnalysis(analysis: InsertOperationAnalysis): Promise<OperationAnalysis>;
  updateOperationAnalysis(id: string, analysis: Partial<InsertOperationAnalysis>): Promise<OperationAnalysis | undefined>;
  deleteOperationAnalysis(id: string): Promise<void>;

  // LiveChat methods
  createChatConversation(userId: string): Promise<ChatConversation>;
  getChatConversation(conversationId: string): Promise<ChatConversation | undefined>;
  getUserConversations(userId: string): Promise<ChatConversation[]>;
  createChatMessage(conversationId: string, role: 'user' | 'assistant', content: string, metadata?: any): Promise<ChatMessage>;
  getChatMessages(conversationId: string, limit?: number): Promise<ChatMessage[]>;
  archiveChatConversation(conversationId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Clients
  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async countClients(): Promise<number> {
    const result = await db.select({ value: count() }).from(clients);
    return Number(result[0]?.value ?? 0);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(insertClient).returning();
    return client;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db.update(clients).set(updateData).where(eq(clients.id, id)).returning();
    return client || undefined;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  // Employees
  async getAllEmployees(): Promise<Employee[]> {
    return await db.select().from(employees).orderBy(desc(employees.createdAt));
  }

  async countEmployees(): Promise<number> {
    const result = await db.select({ value: count() }).from(employees);
    return Number(result[0]?.value ?? 0);
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee || undefined;
  }

  async getEmployeeByUserId(userId: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.userId, userId));
    return employee || undefined;
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values(insertEmployee).returning();
    return employee;
  }

  async updateEmployee(id: string, updateData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [employee] = await db.update(employees).set(updateData).where(eq(employees.id, id)).returning();
    return employee || undefined;
  }

  async deleteEmployee(id: string): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  // Operations
  async getAllOperations(): Promise<Operation[]> {
    return await db.select().from(operations).orderBy(desc(operations.createdAt));
  }

  async countOperations(): Promise<number> {
    const result = await db.select({ value: count() }).from(operations);
    return Number(result[0]?.value ?? 0);
  }

  async getOperation(id: string): Promise<Operation | undefined> {
    const [operation] = await db.select().from(operations).where(eq(operations.id, id));
    return operation || undefined;
  }

  async createOperation(insertOperation: InsertOperation): Promise<Operation> {
    const [operation] = await db.insert(operations).values(insertOperation).returning();
    return operation;
  }

  async updateOperation(id: string, updateData: Partial<InsertOperation>): Promise<Operation | undefined> {
    const [operation] = await db.update(operations).set(updateData).where(eq(operations.id, id)).returning();
    return operation || undefined;
  }

  async deleteOperation(id: string): Promise<void> {
    await db.delete(operations).where(eq(operations.id, id));
  }

  // Operation Employees
  async assignEmployeeToOperation(operationId: string, employeeId: string): Promise<void> {
    await db.insert(operationEmployees).values({
      operationId,
      employeeId,
    });
  }

  async getOperationEmployees(operationId: string): Promise<Employee[]> {
    const result = await db.select({
      employee: employees,
    })
      .from(operationEmployees)
      .innerJoin(employees, eq(operationEmployees.employeeId, employees.id))
      .where(eq(operationEmployees.operationId, operationId));

    return result.map(r => r.employee);
  }

  // Invoices
  async getAllInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoicesByOperation(operationId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.operationId, operationId)).orderBy(desc(invoices.createdAt));
  }

  async countInvoices(): Promise<number> {
    const result = await db.select({ value: count() }).from(invoices);
    return Number(result[0]?.value ?? 0);
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(insertInvoice).returning();
    return invoice;
  }

  async updateInvoice(id: string, updateData: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [invoice] = await db.update(invoices).set(updateData).where(eq(invoices.id, id)).returning();
    return invoice || undefined;
  }

  async deleteInvoice(id: string): Promise<void> {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  // Proposals
  async getAllProposals(): Promise<Proposal[]> {
    return await db.select().from(proposals).orderBy(desc(proposals.createdAt));
  }

  async countProposals(): Promise<number> {
    const result = await db.select({ value: count() }).from(proposals);
    return Number(result[0]?.value ?? 0);
  }

  async getProposal(id: string): Promise<Proposal | undefined> {
    const [proposal] = await db.select().from(proposals).where(eq(proposals.id, id));
    return proposal || undefined;
  }

  async createProposal(insertProposal: InsertProposal): Promise<Proposal> {
    const [proposal] = await db.insert(proposals).values(insertProposal).returning();
    return proposal;
  }

  async updateProposal(id: string, updateData: Partial<InsertProposal>): Promise<Proposal | undefined> {
    const [proposal] = await db.update(proposals).set(updateData).where(eq(proposals.id, id)).returning();
    return proposal || undefined;
  }

  async deleteProposal(id: string): Promise<void> {
    await db.delete(proposals).where(eq(proposals.id, id));
  }

  // Expenses
  async getAllExpenses(): Promise<Expense[]> {
    return await db.select().from(expenses).orderBy(desc(expenses.createdAt));
  }

  async countExpenses(): Promise<number> {
    const result = await db.select({ value: count() }).from(expenses);
    return Number(result[0]?.value ?? 0);
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense || undefined;
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }

  async updateExpense(id: string, updateData: Partial<InsertExpense>): Promise<Expense | undefined> {
    const [expense] = await db.update(expenses).set(updateData).where(eq(expenses.id, id)).returning();
    return expense || undefined;
  }

  async deleteExpense(id: string): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  // Leads
  async getAllLeads(): Promise<Lead[]> {
    return await db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async countLeads(): Promise<number> {
    const result = await db.select({ value: count() }).from(leads);
    return Number(result[0]?.value ?? 0);
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async updateLead(id: string, updateData: Partial<InsertLead>): Promise<Lead | undefined> {
    const [lead] = await db.update(leads).set(updateData).where(eq(leads.id, id)).returning();
    return lead || undefined;
  }

  async deleteLead(id: string): Promise<void> {
    await db.delete(leads).where(eq(leads.id, id));
  }

  // Custom Fields
  async getAllCustomFields(): Promise<CustomField[]> {
    return await db.select().from(customFields).orderBy(desc(customFields.createdAt));
  }

  async getCustomField(id: string): Promise<CustomField | undefined> {
    const [customField] = await db.select().from(customFields).where(eq(customFields.id, id));
    return customField || undefined;
  }

  async getCustomFieldsByModule(moduleName: string): Promise<CustomField[]> {
    return await db.select().from(customFields).where(eq(customFields.moduleName, moduleName));
  }

  async createCustomField(insertCustomField: InsertCustomField): Promise<CustomField> {
    const [customField] = await db.insert(customFields).values(insertCustomField).returning();
    return customField;
  }

  async updateCustomField(id: string, updateData: Partial<InsertCustomField>): Promise<CustomField | undefined> {
    const [customField] = await db.update(customFields).set(updateData).where(eq(customFields.id, id)).returning();
    return customField || undefined;
  }

  async deleteCustomField(id: string): Promise<void> {
    await db.delete(customFields).where(eq(customFields.id, id));
  }

  // Custom Field Values
  async getCustomFieldValue(customFieldId: string, recordId: string): Promise<CustomFieldValue | undefined> {
    const [value] = await db.select().from(customFieldValues).where(
      and(
        eq(customFieldValues.customFieldId, customFieldId),
        eq(customFieldValues.recordId, recordId)
      )
    );
    return value || undefined;
  }

  async getCustomFieldValuesByRecord(moduleName: string, recordId: string): Promise<CustomFieldValue[]> {
    return await db.select().from(customFieldValues).where(
      and(
        eq(customFieldValues.moduleName, moduleName),
        eq(customFieldValues.recordId, recordId)
      )
    );
  }

  async createCustomFieldValue(insertValue: InsertCustomFieldValue): Promise<CustomFieldValue> {
    const [value] = await db.insert(customFieldValues).values(insertValue).returning();
    return value;
  }

  async updateCustomFieldValue(id: string, updateData: Partial<InsertCustomFieldValue>): Promise<CustomFieldValue | undefined> {
    const [value] = await db.update(customFieldValues).set(updateData).where(eq(customFieldValues.id, id)).returning();
    return value || undefined;
  }

  async deleteCustomFieldValue(id: string): Promise<void> {
    await db.delete(customFieldValues).where(eq(customFieldValues.id, id));
  }

  // Invoice Items
  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    return await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  }

  async getInvoiceItem(id: string): Promise<InvoiceItem | undefined> {
    const [item] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, id));
    return item || undefined;
  }

  async createInvoiceItem(insertItem: InsertInvoiceItem): Promise<InvoiceItem> {
    const [item] = await db.insert(invoiceItems).values(insertItem).returning();
    return item;
  }

  async updateInvoiceItem(id: string, updateData: Partial<InsertInvoiceItem>): Promise<InvoiceItem | undefined> {
    const [item] = await db.update(invoiceItems).set(updateData).where(eq(invoiceItems.id, id)).returning();
    return item || undefined;
  }

  async deleteInvoiceItem(id: string): Promise<void> {
    await db.delete(invoiceItems).where(eq(invoiceItems.id, id));
  }

  // Proposal Items
  async getProposalItems(proposalId: string): Promise<ProposalItem[]> {
    return await db.select().from(proposalItems).where(eq(proposalItems.proposalId, proposalId));
  }

  async getProposalItem(id: string): Promise<ProposalItem | undefined> {
    const [item] = await db.select().from(proposalItems).where(eq(proposalItems.id, id));
    return item || undefined;
  }

  async createProposalItem(insertItem: InsertProposalItem): Promise<ProposalItem> {
    const [item] = await db.insert(proposalItems).values(insertItem).returning();
    return item;
  }

  async updateProposalItem(id: string, updateData: Partial<InsertProposalItem>): Promise<ProposalItem | undefined> {
    const [item] = await db.update(proposalItems).set(updateData).where(eq(proposalItems.id, id)).returning();
    return item || undefined;
  }

  async deleteProposalItem(id: string): Promise<void> {
    await db.delete(proposalItems).where(eq(proposalItems.id, id));
  }

  // Payments
  async getPayments(invoiceId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.invoiceId, invoiceId)).orderBy(desc(payments.paymentDate));
  }

  async getPaymentsByOperation(operationId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.operationId, operationId)).orderBy(desc(payments.paymentDate));
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    return payment;
  }

  async updatePayment(id: string, updateData: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [payment] = await db.update(payments).set(updateData).where(eq(payments.id, id)).returning();
    return payment || undefined;
  }

  async deletePayment(id: string): Promise<void> {
    await db.delete(payments).where(eq(payments.id, id));
  }

  // Operation Employees (many-to-many)
  async getOperationEmployees(operationId: string): Promise<string[]> {
    const assignments = await db.select().from(operationEmployees).where(eq(operationEmployees.operationId, operationId));
    return assignments.map(a => a.employeeId);
  }

  async setOperationEmployees(operationId: string, employeeIds: string[]): Promise<void> {
    await db.delete(operationEmployees).where(eq(operationEmployees.operationId, operationId));
    if (employeeIds.length > 0) {
      await db.insert(operationEmployees).values(
        employeeIds.map(employeeId => ({ operationId, employeeId }))
      );
    }
  }

  async addOperationEmployee(operationId: string, employeeId: string): Promise<OperationEmployee> {
    const [assignment] = await db.insert(operationEmployees).values({ operationId, employeeId }).returning();
    return assignment;
  }

  async removeOperationEmployee(operationId: string, employeeId: string): Promise<void> {
    await db.delete(operationEmployees).where(
      and(
        eq(operationEmployees.operationId, operationId),
        eq(operationEmployees.employeeId, employeeId)
      )
    );
  }

  // Gmail Accounts
  async getAllGmailAccounts(userId?: string): Promise<GmailAccount[]> {
    if (userId) {
      return await db.select().from(gmailAccounts).where(eq(gmailAccounts.userId, userId)).orderBy(desc(gmailAccounts.createdAt));
    }
    return await db.select().from(gmailAccounts).orderBy(desc(gmailAccounts.createdAt));
  }

  async getGmailAccount(id: string): Promise<GmailAccount | undefined> {
    const [account] = await db.select().from(gmailAccounts).where(eq(gmailAccounts.id, id));
    return account || undefined;
  }

  async getGmailAccountByEmail(email: string): Promise<GmailAccount | undefined> {
    const [account] = await db.select().from(gmailAccounts).where(eq(gmailAccounts.email, email));
    return account || undefined;
  }

  async createGmailAccount(insertAccount: InsertGmailAccount): Promise<GmailAccount> {
    const [account] = await db.insert(gmailAccounts).values(insertAccount).returning();
    return account;
  }

  async updateGmailAccount(id: string, updateData: Partial<InsertGmailAccount>): Promise<GmailAccount | undefined> {
    const [account] = await db.update(gmailAccounts).set(updateData).where(eq(gmailAccounts.id, id)).returning();
    return account || undefined;
  }

  async deleteGmailAccount(id: string): Promise<void> {
    await db.delete(gmailAccounts).where(eq(gmailAccounts.id, id));
  }

  // Gmail Messages  
  async getGmailMessages(accountId: string, limit = 50, offset = 0): Promise<GmailMessage[]> {
    return await db.select().from(gmailMessages)
      .where(eq(gmailMessages.gmailAccountId, accountId))
      .orderBy(desc(gmailMessages.date))
      .limit(Math.min(limit, 100))
      .offset(offset);
  }

  async getGmailMessagesByOperation(operationId: string): Promise<GmailMessage[]> {
    return await db.select().from(gmailMessages)
      .where(eq(gmailMessages.operationId, operationId))
      .orderBy(desc(gmailMessages.date));
  }

  async getGmailMessage(id: string): Promise<GmailMessage | undefined> {
    const [message] = await db.select().from(gmailMessages).where(eq(gmailMessages.id, id));
    return message || undefined;
  }

  async getGmailMessageByMessageId(messageId: string): Promise<GmailMessage | undefined> {
    const [message] = await db.select().from(gmailMessages).where(eq(gmailMessages.messageId, messageId));
    return message || undefined;
  }

  async createGmailMessage(insertMessage: InsertGmailMessage): Promise<GmailMessage> {
    const [message] = await db.insert(gmailMessages).values(insertMessage).returning();
    return message;
  }

  async updateGmailMessage(id: string, updateData: Partial<InsertGmailMessage>): Promise<GmailMessage | undefined> {
    const [message] = await db.update(gmailMessages).set(updateData).where(eq(gmailMessages.id, id)).returning();
    return message || undefined;
  }

  async deleteGmailMessage(id: string): Promise<void> {
    await db.delete(gmailMessages).where(eq(gmailMessages.id, id));
  }

  // Gmail Attachments
  async getGmailAttachments(messageId: string): Promise<GmailAttachment[]> {
    return await db.select().from(gmailAttachments).where(eq(gmailAttachments.gmailMessageId, messageId));
  }

  async getGmailAttachment(id: string): Promise<GmailAttachment | undefined> {
    const [attachment] = await db.select().from(gmailAttachments).where(eq(gmailAttachments.id, id));
    return attachment || undefined;
  }

  async createGmailAttachment(insertAttachment: InsertGmailAttachment): Promise<GmailAttachment> {
    const [attachment] = await db.insert(gmailAttachments).values(insertAttachment).returning();
    return attachment;
  }

  async deleteGmailAttachment(id: string): Promise<void> {
    await db.delete(gmailAttachments).where(eq(gmailAttachments.id, id));
  }

  // Calendar Events
  async getAllCalendarEvents(userId: string): Promise<CalendarEvent[]> {
    const accounts = await this.getAllGmailAccounts(userId);
    const accountIds = accounts.map(a => a.id);

    // Obtener eventos de Google Calendar de todas las cuentas vinculadas
    const googleEvents = accountIds.length > 0 
      ? await db.select().from(calendarEvents)
          .where(inArray(calendarEvents.gmailAccountId, accountIds))
          .orderBy(desc(calendarEvents.startTime))
      : [];

    // Obtener eventos locales del usuario
    const localEvents = await db.select().from(calendarEvents)
      .where(and(
        eq(calendarEvents.source, 'local'),
        eq(calendarEvents.createdBy, userId)
      ))
      .orderBy(desc(calendarEvents.startTime));

    return [...googleEvents, ...localEvents];
  }

  async getCalendarEventsByAccount(accountId: string): Promise<CalendarEvent[]> {
    return await db.select().from(calendarEvents)
      .where(eq(calendarEvents.gmailAccountId, accountId))
      .orderBy(desc(calendarEvents.startTime));
  }

  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    return event || undefined;
  }

  async getCalendarEventsByGoogleId(eventId: string): Promise<CalendarEvent[]> {
    return await db.select().from(calendarEvents).where(eq(calendarEvents.eventId, eventId));
  }

  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const [event] = await db.insert(calendarEvents).values(insertEvent).returning();
    return event;
  }

  async updateCalendarEvent(id: string, updateData: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const [event] = await db.update(calendarEvents).set(updateData).where(eq(calendarEvents.id, id)).returning();
    return event || undefined;
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  }

  // Automation Configs
  async getAutomationConfigs(userId: string): Promise<AutomationConfig[]> {
    return await db.select().from(automationConfigs).where(eq(automationConfigs.userId, userId));
  }

  async getAutomationConfig(id: string): Promise<AutomationConfig | undefined> {
    const [config] = await db.select().from(automationConfigs).where(eq(automationConfigs.id, id));
    return config || undefined;
  }

  async getAutomationConfigByModule(userId: string, moduleName: string): Promise<AutomationConfig | undefined> {
    const [config] = await db.select().from(automationConfigs)
      .where(and(
        eq(automationConfigs.userId, userId),
        eq(automationConfigs.moduleName, moduleName)
      ));
    return config || undefined;
  }

  async getEnabledAutomationConfigs(): Promise<AutomationConfig[]> {
    return await db.select().from(automationConfigs).where(eq(automationConfigs.isEnabled, true));
  }

  async createAutomationConfig(insertConfig: InsertAutomationConfig): Promise<AutomationConfig> {
    const [config] = await db.insert(automationConfigs).values(insertConfig).returning();
    return config;
  }

  async updateAutomationConfig(id: string, updateData: Partial<InsertAutomationConfig>): Promise<AutomationConfig | undefined> {
    const [config] = await db.update(automationConfigs)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(automationConfigs.id, id))
      .returning();
    return config || undefined;
  }

  async deleteAutomationConfig(id: string): Promise<void> {
    await db.delete(automationConfigs).where(eq(automationConfigs.id, id));
  }

  // Automation Rules
  async getAutomationRulesByConfig(configId: string): Promise<AutomationRule[]> {
    return await db.select().from(automationRules)
      .where(eq(automationRules.configId, configId))
      .orderBy(desc(automationRules.priority));
  }

  async getAutomationRule(id: string): Promise<AutomationRule | undefined> {
    const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, id));
    return rule || undefined;
  }

  async createAutomationRule(insertRule: InsertAutomationRule): Promise<AutomationRule> {
    const [rule] = await db.insert(automationRules).values(insertRule).returning();
    return rule;
  }

  async updateAutomationRule(id: string, updateData: Partial<InsertAutomationRule>): Promise<AutomationRule | undefined> {
    const [rule] = await db.update(automationRules)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(automationRules.id, id))
      .returning();
    return rule || undefined;
  }

  async deleteAutomationRule(id: string): Promise<void> {
    await db.delete(automationRules).where(eq(automationRules.id, id));
  }

  // Automation Logs
  async getAutomationLogs(configId?: string, limit: number = 100): Promise<AutomationLog[]> {
    if (configId) {
      const rules = await this.getAutomationRulesByConfig(configId);
      const ruleIds = rules.map(r => r.id);

      if (ruleIds.length === 0) {
        return [];
      }

      return await db.select().from(automationLogs)
        .where(inArray(automationLogs.ruleId, ruleIds))
        .orderBy(desc(automationLogs.createdAt))
        .limit(limit);
    }

    return await db.select().from(automationLogs)
      .orderBy(desc(automationLogs.createdAt))
      .limit(limit);
  }

  async createAutomationLog(insertLog: InsertAutomationLog): Promise<AutomationLog> {
    const [log] = await db.insert(automationLogs).values(insertLog).returning();
    return log;
  }

  // Helper functions for automation
  async getUnprocessedMessages(accountIds: string[], since: Date): Promise<GmailMessage[]> {
    if (accountIds.length === 0) {
      return [];
    }

    // Get all messages from selected accounts
    const allMessages = await db.select()
      .from(gmailMessages)
      .where(inArray(gmailMessages.gmailAccountId, accountIds));

    // Filter messages received after 'since' date and sort
    return allMessages
      .filter(msg => msg.date && new Date(msg.date) > since)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async linkMessageToOperation(messageId: string, operationId: string | null): Promise<void> {
    await db.update(gmailMessages)
      .set({ operationId })
      .where(eq(gmailMessages.id, messageId));
  }

  async getOperationMessages(operationId: string): Promise<GmailMessage[]> {
    return await db.select()
      .from(gmailMessages)
      .where(eq(gmailMessages.operationId, operationId))
      .orderBy(desc(gmailMessages.date));
  }

  async linkMessagesToOperations(): Promise<void> {
    // Get all operations
    const allOperations = await db.select().from(operations);

    // Get all messages without operation link
    const unlinkedMessages = await db.select()
      .from(gmailMessages)
      .where(sql`${gmailMessages.operationId} IS NULL`);

    // Get all attachments for text extraction
    const allAttachments = await db.select().from(gmailAttachments);

    let linkedCount = 0;

    for (const message of unlinkedMessages) {
      for (const operation of allOperations) {
        const operationName = operation.name.toLowerCase();
        const bookingNumber = operation.bookingTracking?.toLowerCase();

        // Build searchable content
        const subject = (message.subject || '').toLowerCase();
        const from = (message.fromEmail || '').toLowerCase();
        const snippet = (message.snippet || '').toLowerCase();
        const bodyText = (message.bodyText || '').toLowerCase();

        // Get attachments text for this message
        const messageAttachments = allAttachments.filter(att => att.gmailMessageId === message.id);
        const attachmentsText = messageAttachments
          .map(att => (att.extractedText || '').toLowerCase())
          .join(' ');

        // Combine all searchable content
        const fullContent = `${subject} ${from} ${snippet} ${bodyText} ${attachmentsText}`;

        // Check if operation name or booking number exists
        const hasOperationName = fullContent.includes(operationName);
        const hasBookingNumber = bookingNumber && fullContent.includes(bookingNumber);

        if (hasOperationName || hasBookingNumber) {
          await this.linkMessageToOperation(message.id, operation.id);
          linkedCount++;
          break; // Only link to first matching operation
        }
      }
    }

    console.log(`[Email Linking] Linked ${linkedCount} messages to operations`);
  }

  // Operation Notes
  async getOperationNotes(operationId: string): Promise<OperationNote[]> {
    return await db.select().from(operationNotes)
      .where(eq(operationNotes.operationId, operationId))
      .orderBy(desc(operationNotes.createdAt));
  }

  async getOperationNote(id: string): Promise<OperationNote | undefined> {
    const [note] = await db.select().from(operationNotes).where(eq(operationNotes.id, id));
    return note || undefined;
  }

  async createOperationNote(insertNote: InsertOperationNote): Promise<OperationNote> {
    const [note] = await db.insert(operationNotes).values(insertNote).returning();
    return note;
  }

  async updateOperationNote(id: string, updateData: Partial<InsertOperationNote>): Promise<OperationNote | undefined> {
    const [note] = await db.update(operationNotes)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(operationNotes.id, id))
      .returning();
    return note || undefined;
  }

  async deleteOperationNote(id: string): Promise<void> {
    await db.delete(operationNotes).where(eq(operationNotes.id, id));
  }

  // Operation Tasks
  async getOperationTasks(operationId: string): Promise<OperationTask[]> {
    return await db.select().from(operationTasks)
      .where(eq(operationTasks.operationId, operationId))
      .orderBy(desc(operationTasks.createdAt));
  }

  async getOperationTask(id: string): Promise<OperationTask | undefined> {
    const [task] = await db.select().from(operationTasks).where(eq(operationTasks.id, id));
    return task || undefined;
  }

  async createOperationTask(insertTask: InsertOperationTask): Promise<OperationTask> {
    const [task] = await db.insert(operationTasks).values(insertTask).returning();
    return task;
  }

  async updateOperationTask(id: string, updateData: Partial<InsertOperationTask>): Promise<OperationTask | undefined> {
    const [task] = await db.update(operationTasks)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(operationTasks.id, id))
      .returning();
    return task || undefined;
  }

  async deleteOperationTask(id: string): Promise<void> {
    await db.delete(operationTasks).where(eq(operationTasks.id, id));
  }

  // Operation Folders
  async getOperationFolders(operationId: string): Promise<OperationFolder[]> {
    return await db.select().from(operationFolders)
      .where(eq(operationFolders.operationId, operationId))
      .orderBy(desc(operationFolders.createdAt));
  }

  async getOperationFolder(id: string): Promise<OperationFolder | undefined> {
    const [folder] = await db.select().from(operationFolders).where(eq(operationFolders.id, id));
    return folder || undefined;
  }

  async createOperationFolder(insertFolder: InsertOperationFolder): Promise<OperationFolder> {
    const [folder] = await db.insert(operationFolders).values(insertFolder).returning();
    return folder;
  }

  async updateOperationFolder(id: string, updateData: Partial<InsertOperationFolder>): Promise<OperationFolder | undefined> {
    const [folder] = await db.update(operationFolders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(operationFolders.id, id))
      .returning();
    return folder || undefined;
  }

  async deleteOperationFolder(id: string): Promise<void> {
    await db.delete(operationFolders).where(eq(operationFolders.id, id));
  }

  // Operation Files
  async getOperationFiles(operationId: string, folderId?: string | null): Promise<OperationFile[]> {
    if (folderId === undefined) {
      return await db.select().from(operationFiles)
        .where(eq(operationFiles.operationId, operationId))
        .orderBy(desc(operationFiles.createdAt));
    }

    if (folderId === null) {
      return await db.select().from(operationFiles)
        .where(and(
          eq(operationFiles.operationId, operationId),
          isNull(operationFiles.folderId)
        ))
        .orderBy(desc(operationFiles.createdAt));
    }

    return await db.select().from(operationFiles)
      .where(and(
        eq(operationFiles.operationId, operationId),
        eq(operationFiles.folderId, folderId)
      ))
      .orderBy(desc(operationFiles.createdAt));
  }

  async getOperationFile(id: string): Promise<OperationFile | undefined> {
    const [file] = await db.select().from(operationFiles).where(eq(operationFiles.id, id));
    return file || undefined;
  }

  async createOperationFile(insertFile: InsertOperationFile): Promise<OperationFile> {
    const [file] = await db.insert(operationFiles).values(insertFile).returning();
    return file;
  }

  async updateOperationFile(id: string, updateData: Partial<InsertOperationFile>): Promise<OperationFile | undefined> {
    const [file] = await db.update(operationFiles)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(operationFiles.id, id))
      .returning();
    return file || undefined;
  }

  async deleteOperationFile(id: string): Promise<void> {
    await db.delete(operationFiles).where(eq(operationFiles.id, id));
  }

  // Operation Analysis
  async getOperationAnalysis(operationId: string): Promise<OperationAnalysis | undefined> {
    const [analysis] = await db.select().from(operationAnalyses)
      .where(eq(operationAnalyses.operationId, operationId))
      .orderBy(desc(operationAnalyses.createdAt))
      .limit(1);
    return analysis || undefined;
  }

  async createOperationAnalysis(insertAnalysis: InsertOperationAnalysis): Promise<OperationAnalysis> {
    const [analysis] = await db.insert(operationAnalyses).values(insertAnalysis).returning();
    return analysis;
  }

  async updateOperationAnalysis(id: string, updateData: Partial<InsertOperationAnalysis>): Promise<OperationAnalysis | undefined> {
    const [analysis] = await db.update(operationAnalyses)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(operationAnalyses.id, id))
      .returning();
    return analysis || undefined;
  }

  async deleteOperationAnalysis(id: string): Promise<void> {
    await db.delete(operationAnalyses).where(eq(operationAnalyses.id, id));
  }

  // LiveChat methods
  async createChatConversation(userId: string): Promise<ChatConversation> {
    const [conversation] = await db.insert(chatConversations).values({
      userId,
      status: 'active'
    }).returning();
    return conversation;
  }

  async getChatConversation(conversationId: string): Promise<ChatConversation | undefined> {
    const [conversation] = await db.select()
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId));
    return conversation;
  }

  async getUserConversations(userId: string): Promise<ChatConversation[]> {
    return db.select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.lastMessageAt));
  }

  async createChatMessage(conversationId: string, role: 'user' | 'assistant', content: string, metadata?: any): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values({
      conversationId,
      role,
      content,
      metadata
    }).returning();

    // Update conversation lastMessageAt
    await db.update(chatConversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(chatConversations.id, conversationId));

    return message;
  }

  async getChatMessages(conversationId: string, limit: number = 50): Promise<ChatMessage[]> {
    return db.select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit);
  }

  async archiveChatConversation(conversationId: string): Promise<void> {
    await db.update(chatConversations)
      .set({ status: 'archived' })
      .where(eq(chatConversations.id, conversationId));
  }
}

export const storage = new DatabaseStorage();