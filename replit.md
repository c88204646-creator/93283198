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
- **Integration Tables**: `customFields`, `customFieldValues`, `gmailAccounts`, `gmailMessages`, `calendarEvents`.
- **File Management Tables**: `operationFolders`, `operationFiles`, `gmailAttachments`, `fileThumbnails`.
- **Automation Tables**: `automationConfigs`, `automationRules`, `automationLogs`.
- **AI Tables**: `operationAnalyses`, `bankAccountAnalyses`, `knowledgeBase`, `financial_suggestions`.
- **Patterns**: UUID primary keys, foreign key relationships, timestamp tracking, status enums, JSONB for metadata, B2 storage keys, SHA-256 file hashes.
- **CFDI 4.0 Fields**: `invoices` table includes fiscal fields (folioFiscal/UUID, issuerRFC, issuerName, emisorRegimenFiscal, metodoPago, formaPago); `invoiceItems` table includes SAT codes (satProductCode, satUnitCode, satTaxObject, identification).

#### Core Features
- **Integrated Financial Management**: Comprehensive banking module, payments, expenses, and detailed financial dashboards.
- **Client Management**: Clickable client rows with detailed dashboards and operation statistics.
- **Gmail Integration**: OAuth 2.0, automatic background sync (messages, calendar events), multi-account support, email bodies and attachments stored in Backblaze B2, intelligent spam filtering, automatic message-to-operation linking, smart attachment filtering (automatically ignores email signatures, inline logos, tracking pixels, and duplicate files to optimize storage costs).
- **AI-Powered Assistance**:
    - **LiveChat Personal Assistant**: Optimistic updates, smart operation search, proactive assistance.
    - **AI Task & Note Automation (Smart Gemini)**: 2-level resilient system with 100% open source fallback. Primary: Gemini AI with confidence-based filtering, intelligent deduplication, status auto-update, knowledge base integration, company context awareness. Fallback: Rule-based analyzer using regex patterns, keyword detection, and information extraction (no external APIs). **Content Quality**: Both AI and fallback systems INTERPRET emails and transform informal conversations into professional business summaries suitable for internal use without needing email context. Aggressive text cleaning removes greetings, salutations, informal phrases, and converts conversational language to objective business terminology. Circuit breaker protection ensures continuous operation. Rate limiting, retry logic, multi-level caching, real-time and periodic processing, respects manual modifications.
    - **AI Operation Analysis (3-Tier System)**: Robust analysis pipeline ensuring 100% uptime with professional output: (1) Gemini AI with enhanced prompts demanding business context, stakeholder identification, risk analysis, and self-explanatory summaries for non-assigned employees. (2) Knowledge Base reuse - progressive learning system reusing successful analyses to reduce API calls. (3) Rule-based fallback - professional analysis using BasicEmailAnalyzer with executive summaries including business context, stakeholders, risk flags, key milestones, and pending dependencies. Circuit breaker pattern (15min timeout, 3 failures to open, 2 successes to close) protects against API failures. System NEVER shows technical errors to users - always generates professional analysis. Gemini analyses cached for 24 hours, fallback for 2 hours.
    - **AI Financial Analysis**: Expert financial analysis for bank accounts using Gemini AI with progressive learning, providing insights on cash flow, expenses, optimization, and actionable recommendations.
    - **AI Knowledge Base System**: Progressive learning system storing and reusing successful analyses to reduce Gemini API calls.
    - **AI-Powered Financial Transaction Detection**: 2-level resilient detection system (Gemini AI → OCR Fallback) with circuit breaker pattern. Automated detection of payments and expenses from email attachments, creating financial suggestions requiring user approval. **Complete Evidence Tracking**: Each detected transaction includes full source tracking (gmailMessageId, gmailAttachmentId, extractedText) enabling real-time preview of source PDF/image documents and direct links to originating emails. **Operation-Specific Display**: Financial suggestions now display exclusively within the relevant operation's detail page (Information tab), immediately below AI operation analysis, with full evidence UI showing attachment previews and email links. Includes intelligent duplicate detection via SHA-256 hash comparison, context-aware OCR amount extraction with keyword prioritization (Total/Amount/Monto), and configurable UI toggles. All suggestions go through approval workflow - no separate manual queue needed. Runs automatically every 15 minutes via automation service.
- **Kanban Task Board System**: Drag-and-drop task management with configurable status columns, manual override of AI-generated tasks.
- **File Management**: Backblaze B2 exclusive storage for all files, automatic attachment processing and categorization, SHA-256 hash-based deduplication, hierarchical folder organization, intelligent attachment filtering to prevent storing email signatures/logos/tracking pixels, professional thumbnail system with lazy loading similar to Dropbox/Google Drive.
- **Automation Module**: Plugin-based system for entity creation from email patterns, rule-based matching, custom folder name configuration, invoice auto-creation from Facturama PDFs.
- **Invoice Auto-Creation System**: Automatically detects Facturama invoice PDFs, extracts complete fiscal data (CFDI 4.0), creates full invoices with itemized details and SAT codes, prevents duplicates via folioFiscal (UUID), and assigns to operations. Includes toggle in automation UI (autoAssignInvoices).
- **Manual Invoice Creation & Facturama Stamping**: Professional single-page ERP-style invoice form with full CFDI 4.0 compliance. Users can create invoices manually with all fiscal fields (RFC, régimen fiscal, uso CFDI, método/forma de pago, lugar expedición, exportación) and configurable tax per item (not default 16% IVA). **Official SAT Catalog Integration**: Professional searchable dropdown components for all fiscal fields using official Mexican SAT Anexo 20 Version 4.0 catalogs (~52,000 product codes, unit codes, tax objects, fiscal regimes, payment methods/forms). Custom SATCombobox component provides autocomplete search functionality with ability to enter custom values when needed. All SAT codes comply with Mexican tax authority requirements. Created invoices can be stamped via Facturama API integration for SAT certification. System distinguishes between manually created invoices (pending stamping) and auto-detected Facturama invoices (already stamped). Requires FACTURAMA_API_USER and FACTURAMA_API_PASSWORD secrets. Includes POST /api/invoices/:invoiceId/stamp endpoint for manual stamping.
- **UI/UX**: Logistics-focused iconography, custom coral/orange color palette, dark mode, consistent UI/UX patterns.

### External Dependencies

#### Database
- Neon PostgreSQL Serverless (`@neondatabase/serverless`)
- Drizzle ORM (v0.39.1) & Drizzle Kit

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
- Backblaze B2 (Exclusive storage solution, S3-compatible API via `@aws-sdk/client-s3`)
- Sharp (High-performance image processing for thumbnail generation)

#### Artificial Intelligence
- Google Gemini AI (via `GEMINI_API_KEY`)

#### Invoice & Tax Compliance
- Facturama API (via `FACTURAMA_API_USER` and `FACTURAMA_API_PASSWORD`) - Mexican SAT CFDI 4.0 invoice stamping and certification

#### Background Services
- **Automatic Gmail Sync**: Every 15 minutes, processes messages and calendar events, links messages to operations.
- **Automatic Calendar Sync**: Every 5 minutes, syncs calendar events.
- **Automation Service**: Every 15 minutes, processes operations for AI task/note creation, handles unprocessed messages, processes attachments, runs email thread analysis, and performs automatic cleanup of orphaned thumbnails.
- **Professional File Preview System**: On-demand thumbnail generation for images and PDFs with three sizes (small 150x150, medium 400x400, large 800x800), intelligent caching in B2 storage, lazy loading for optimal performance, automatic cleanup of orphaned thumbnails. Similar to Dropbox/Google Drive interface with grid/list views, batch thumbnail generation, and progressive loading.