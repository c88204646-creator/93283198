# LogistiCore - Freight Forwarding Platform

### Overview
LogistiCore is a comprehensive full-stack enterprise platform designed to streamline freight forwarding and logistics operations. It manages shipments, clients, staff, invoices, quotes, expenses, and leads with robust role-based access control. The platform emphasizes enterprise design principles with logistics-focused iconography and terminology, aiming to enhance efficiency and reduce operational costs within the logistics sector. Key capabilities include integrated financial management, AI-powered operational assistance with company context awareness, and a Kanban task board system.

### User Preferences
Preferred communication style: Simple, everyday language (Spanish).
Industry focus: Freight forwarding and logistics operations.
Design preference: Logistics-focused iconography and terminology.

### System Architecture

#### Frontend
- **Frameworks**: React 18 with TypeScript, Vite, Wouter (routing), TanStack Query (server state).
- **UI**: Shadcn/ui (Radix UI primitives), Tailwind CSS with custom design tokens, CVA for styling, logistics-focused iconography, custom coral/orange color palette, Poppins font, dark mode support.
- **State Management**: React Context (authentication), TanStack Query (server state), React hooks (local UI state).

#### Backend
- **Framework**: Express.js with TypeScript for RESTful APIs.
- **Authentication**: Session-based using express-session with PostgreSQL store, bcrypt for password hashing.
- **Authorization**: Role-based access control (admin, manager, employee) middleware.
- **API Design**: RESTful endpoints, JSON format, error handling.
- **Data Layer**: Drizzle ORM, Zod validation with automatic date transformation, schema-first design.

#### Database Schema
- **Core Tables**: `users`, `employees`, `clients`, `operations`, `invoices`, `invoiceItems`, `proposals`, `expenses`, `leads`, `bank_accounts`, `chat_conversations`, `chat_messages`, `operationTasks`.
- **Key Patterns**: UUID primary keys, foreign key relationships, timestamp tracking, status enums, JSONB for metadata, B2 storage keys, SHA-256 file hashes. CFDI 4.0 fields are integrated into invoices.

#### Core Features
- **Integrated Financial Management**: Comprehensive banking module, payments, expenses, and detailed financial dashboards.
- **Client Management**: Detailed client dashboards with operation statistics.
- **Gmail Integration**: OAuth 2.0, automatic background sync (messages, calendar events), multi-account support, email bodies and attachments stored in Backblaze B2, intelligent spam filtering, automatic message-to-operation linking, smart attachment filtering.
- **AI-Powered Assistance**:
    - **LiveChat Personal Assistant**: Optimistic updates, smart operation search, proactive assistance.
    - **AI Task & Note Automation (Smart Gemini with Continuous Learning)**: 3-level resilient system using progressive learning to reduce Gemini API usage. Prioritizes pattern reuse from a knowledge base, falls back to Gemini AI with strict prompts, and uses a rule-based fallback if Gemini fails. Includes automatic feedback to save successful patterns.
    - **AI Operation Analysis (3-Tier System)**: Robust analysis pipeline ensuring 100% uptime, using Gemini AI with enhanced prompts, knowledge base reuse, and a rule-based fallback. Includes circuit breaker protection.
    - **AI Financial Analysis**: Expert financial analysis for bank accounts using Gemini AI with progressive learning.
    - **AI Knowledge Base System**: Stores and reuses successful analyses, tasks, and notes to optimize Gemini API calls.
    - **AI-Powered Financial Transaction Detection**: 2-level resilient detection system (Gemini AI → OCR Fallback) with circuit breaker pattern. Automated detection of payments and expenses from email attachments, creating user-approvable financial suggestions with complete evidence tracking and operation-specific display.
- **Kanban Task Board System**: Drag-and-drop task management with configurable status columns, manual override of AI-generated tasks.
- **File Management**: Backblaze B2 exclusive storage, automatic attachment processing and categorization, SHA-256 hash-based deduplication, hierarchical folder organization, intelligent attachment filtering, professional thumbnail system with lazy loading.
- **Automation Module**: Plugin-based system for entity creation from email patterns, rule-based matching, custom folder configuration, and invoice auto-creation from Facturama PDFs.
- **Invoice Auto-Creation System**: Automatically detects Facturama invoice PDFs, extracts CFDI 4.0 data, creates full invoices with itemized details and SAT codes, prevents duplicates, and assigns to operations.
- **Client Auto-Assignment System**: Automatically detects Facturama invoice PDFs, extracts client fiscal data, creates new clients or assigns existing ones to operations. Includes smart currency auto-correction based on invoice currency.
- **Manual Invoice Creation & Facturama Stamping**: Professional dedicated-page invoice creation with full CFDI 4.0 compliance, client integration, and official SAT Catalog Integration for all fiscal fields. Supports manual stamping via Facturama API.
- **UI/UX**: Logistics-focused iconography, custom coral/orange color palette, dark mode, consistent UI/UX patterns.

### External Dependencies

#### Database
- Neon PostgreSQL Serverless
- Drizzle ORM & Drizzle Kit

#### UI Libraries
- Radix UI
- React Hook Form
- Zod
- date-fns
- Lucide React

#### Session & Security
- connect-pg-simple
- bcrypt
- CORS (Express middleware)

#### Google API Integration
- googleapis (for Gmail and Calendar API)

#### Object Storage & Image Processing
- Backblaze B2 (S3-compatible API via `@aws-sdk/client-s3`)
- Sharp (High-performance image processing for thumbnail generation)

#### Artificial Intelligence
- Google Gemini AI

#### Invoice & Tax Compliance
- Facturama API (Mexican SAT CFDI 4.0 invoice stamping and certification)

#### Background Services
- **Automatic Gmail Sync**: Every 15 minutes.
- **Automatic Calendar Sync**: Every 5 minutes.
- **Automation Service**: Every 15 minutes, handles AI task/note creation, message processing, attachment processing, email thread analysis, client auto-assignment, invoice auto-creation, and cleanup.
- **Professional File Preview System**: On-demand thumbnail generation with intelligent caching, lazy loading, and automatic cleanup.