import { db } from "./db";
import { users, clients, employees, operations, invoices, proposals, expenses, leads } from "@shared/schema";
import bcrypt from "bcrypt";

async function seed() {
  console.log("Starting database seed...");

  try {
    // Create demo users
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const hashedPassword2 = await bcrypt.hash("manager123", 10);
    const hashedPassword3 = await bcrypt.hash("employee123", 10);

    const [admin, manager, employee] = await db.insert(users).values([
      {
        username: "admin",
        password: hashedPassword,
        email: "admin@logisticore.com",
        fullName: "Admin User",
        role: "admin",
      },
      {
        username: "manager",
        password: hashedPassword2,
        email: "manager@logisticore.com",
        fullName: "Manager User",
        role: "manager",
      },
      {
        username: "employee",
        password: hashedPassword3,
        email: "employee@logisticore.com",
        fullName: "Employee User",
        role: "employee",
      },
    ]).returning();

    console.log("Created demo users");

    // Create employee records
    const [emp1, emp2, emp3] = await db.insert(employees).values([
      {
        userId: admin.id,
        position: "System Administrator",
        department: "IT",
        hireDate: new Date("2023-01-15"),
        status: "active",
        phone: "+1-555-0101",
      },
      {
        userId: manager.id,
        position: "Operations Manager",
        department: "Operations",
        hireDate: new Date("2023-03-01"),
        status: "active",
        phone: "+1-555-0102",
      },
      {
        userId: employee.id,
        position: "Operations Specialist",
        department: "Operations",
        hireDate: new Date("2023-06-01"),
        status: "active",
        phone: "+1-555-0103",
      },
    ]).returning();

    console.log("Created employee records");

    // Create sample clients
    const [client1, client2, client3] = await db.insert(clients).values([
      {
        name: "Acme Corporation",
        email: "contact@acme.com",
        phone: "+1-555-1001",
        address: "123 Business St, San Francisco, CA 94102",
        status: "active",
        notes: "Major corporate client with multiple ongoing projects",
      },
      {
        name: "TechStart Inc",
        email: "info@techstart.io",
        phone: "+1-555-1002",
        address: "456 Innovation Ave, Austin, TX 78701",
        status: "active",
        notes: "Fast-growing startup, potential for expansion",
      },
      {
        name: "Global Solutions LLC",
        email: "hello@globalsolutions.com",
        phone: "+1-555-1003",
        address: "789 Enterprise Blvd, New York, NY 10001",
        status: "potential",
        notes: "Prospective client, initial discussions ongoing",
      },
    ]).returning();

    console.log("Created sample clients");

    // Create sample operations
    const [op1, op2] = await db.insert(operations).values([
      {
        name: "Q4 Marketing Campaign",
        description: "Comprehensive digital marketing campaign for product launch",
        status: "in-progress",
        priority: "high",
        clientId: client1.id,
        assignedEmployeeId: emp2.id,
        startDate: new Date("2025-10-01"),
        endDate: new Date("2025-12-31"),
      },
      {
        name: "IT Infrastructure Upgrade",
        description: "Modernization of core IT systems and cloud migration",
        status: "planning",
        priority: "urgent",
        clientId: client2.id,
        assignedEmployeeId: emp3.id,
        startDate: new Date("2025-11-15"),
        endDate: new Date("2026-02-28"),
      },
    ]).returning();

    console.log("Created sample operations");

    // Create sample invoices
    await db.insert(invoices).values([
      {
        invoiceNumber: "INV-2025-001",
        operationId: op1.id,
        employeeId: emp2.id,
        clientId: client1.id,
        amount: "15000.00",
        status: "sent",
        dueDate: new Date("2025-12-15"),
        notes: "Q4 campaign first phase payment",
      },
      {
        invoiceNumber: "INV-2025-002",
        operationId: op2.id,
        employeeId: emp3.id,
        clientId: client2.id,
        amount: "25000.00",
        status: "paid",
        dueDate: new Date("2025-11-30"),
        paidDate: new Date("2025-11-28"),
        notes: "Infrastructure assessment and planning",
      },
    ]);

    console.log("Created sample invoices");

    // Create sample proposals
    await db.insert(proposals).values([
      {
        proposalNumber: "PROP-2025-001",
        clientId: client3.id,
        employeeId: emp2.id,
        title: "Digital Transformation Proposal",
        description: "Comprehensive digital transformation roadmap and implementation plan",
        amount: "45000.00",
        status: "sent",
        validUntil: new Date("2025-12-31"),
      },
    ]);

    console.log("Created sample proposals");

    // Create sample expenses
    await db.insert(expenses).values([
      {
        operationId: op1.id,
        employeeId: emp2.id,
        category: "services",
        amount: "2500.00",
        description: "Social media advertising campaign budget",
        date: new Date("2025-11-01"),
        status: "approved",
      },
      {
        operationId: op2.id,
        employeeId: emp3.id,
        category: "equipment",
        amount: "1200.00",
        description: "Server hardware for testing environment",
        date: new Date("2025-11-05"),
        status: "pending",
      },
    ]);

    console.log("Created sample expenses");

    // Create sample leads
    await db.insert(leads).values([
      {
        name: "Sarah Johnson",
        email: "sarah.j@newventure.com",
        phone: "+1-555-2001",
        company: "New Venture Co",
        source: "website",
        status: "new",
        assignedEmployeeId: emp2.id,
        notes: "Interested in logistics automation solutions",
      },
      {
        name: "Michael Chen",
        email: "m.chen@retailcorp.com",
        phone: "+1-555-2002",
        company: "Retail Corp",
        source: "referral",
        status: "contacted",
        assignedEmployeeId: emp3.id,
        notes: "Follow-up scheduled for next week",
      },
      {
        name: "Emma Rodriguez",
        email: "emma@growthco.io",
        phone: "+1-555-2003",
        company: "Growth Co",
        source: "social-media",
        status: "qualified",
        assignedEmployeeId: emp2.id,
        notes: "High potential client, budget confirmed",
      },
    ]);

    console.log("Created sample leads");

    console.log("✅ Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log("Seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
