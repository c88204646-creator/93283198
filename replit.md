# LogistiCore - Freight Forwarding Platform

### Overview
LogistiCore is a comprehensive full-stack enterprise platform designed to streamline freight forwarding and logistics operations. It manages shipments, clients, staff, invoices, quotes, expenses, and leads with robust role-based access control. The platform emphasizes enterprise design principles with logistics-focused iconography and terminology, aiming to enhance efficiency and reduce operational costs within the logistics sector. Key capabilities include integrated financial management (banking, payments, expenses), AI-powered operational assistance, and a Kanban task board system.

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
- **Data Layer**: Drizzle ORM, Zod validation with automatic date transformation (strings to Date objects), schema-first design.

#### Database Schema
- **Core Tables**: `users`, `employees`, `clients`, `operations`, `invoices`, `proposals`, `expenses`, `leads`, `bank_accounts`, `chat_conversations`, `chat_messages`, `operationTasks`.
- **Integration Tables**: `customFields`, `customFieldValues`, `gmailAccounts`, `gmailMessages`, `calendarEvents`.
- **File Management Tables**: `operationFolders`, `operationFiles`, `gmailAttachments`.
- **Automation Tables**: `automationConfigs` (with `customFolderNames` JSONB, `autoDetectPayments`, `autoDetectExpenses` flags), `automationRules`, `automationLogs`.
- **AI Tables**: `operationAnalyses`, `bankAccountAnalyses`, `knowledgeBase` (supports both 'operation' and 'bank_account' analysis types), `financial_suggestions` (AI-detected transactions pending approval).
- **Patterns**: UUID primary keys, foreign key relationships, timestamp tracking, status enums, JSONB for metadata, B2 storage keys, SHA-256 file hashes.

#### Core Features
- **Integrated Financial Management**: Comprehensive banking module (accounts, transactions), payments linked to invoices and bank accounts, expenses linked to bank accounts, clickable accounts with detailed financial dashboards.
- **Client Management**: Clickable client rows with detailed dashboards, currency field locked after creation to prevent conflicts with linked invoices/payments, comprehensive client operation statistics.
- **Gmail Integration**: OAuth 2.0, automatic background sync every 15 minutes (messages, calendar events), multi-account support, email bodies and attachments stored in Backblaze B2 with deduplication, intelligent spam filtering, automatic message-to-operation linking after each sync.
- **AI-Powered Assistance**:
    - **LiveChat Personal Assistant**: Optimistic updates, smart operation search by various references, proactive assistance, flexible search.
    - **AI Task & Note Automation (Smart Gemini)**:
        - **Professional Notes**: AI generates descriptive notes (minimum 100 characters) with complete context including who, what, when, reference numbers, and decisions made
        - **Smart Task Detection**: Automatically creates tasks from email threads with confidence-based filtering (70% minimum threshold)
        - **Intelligent Deduplication**: Detects and prevents duplicate tasks using isDuplicate flag and similarity matching
        - **Status Auto-Update**: Detects completed tasks (from email confirmations) and overdue tasks (comparing dates with current time)
        - **Knowledge Base Integration**: Saves successful analyses for continuous learning and reuse to reduce API calls by up to 80%
        - **Rate Limiting & Retry**: Exponential backoff retry logic (up to 3 attempts) to handle Gemini API 429 errors, 2-second minimum delay between calls
        - **Multi-level Caching**: Per-thread cache (30 min TTL) + knowledge base storage in B2
        - Real-time processing for new operations with linked emails
        - Periodic processing of existing operations (runs every 15 minutes with Gmail sync)
        - Support for different optimization levels (high, medium, low)
        - Respects manually modified tasks (never overrides user changes)
    - **AI Financial Analysis**: Expert financial analysis for bank accounts using Gemini AI with progressive learning. Provides insights on cash flow, expense categorization, red flags, optimization opportunities, and actionable recommendations. Uses knowledge base to reduce API calls.
    - **AI Knowledge Base System**: Progressive learning system that stores and reuses successful analyses (stored in B2) to reduce Gemini API calls by up to 80%. Supports operation analysis, email thread analysis, and bank account analysis types. Similarity matching (60% threshold) based on operation type, category, shipping mode, and priority.
- **Kanban Task Board System**: Drag-and-drop task management with configurable status columns, manual override of AI-generated tasks.
- **File Management**: Backblaze B2 exclusive storage for all files, automatic attachment processing and categorization, SHA-256 hash-based deduplication, hierarchical folder organization, manual file/folder creation, editing, and movement. Automation respects user modifications.
- **Automation Module**: Plugin-based system for entity creation from email patterns, rule-based matching, custom folder name configuration.
- **UI/UX**: Logistics-focused iconography, custom coral/orange color palette, dark mode, consistent UI/UX patterns across modules.

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

#### Object Storage
- Backblaze B2 (Exclusive storage solution, S3-compatible API via `@aws-sdk/client-s3`) for email bodies, attachments, and operation files.

#### Artificial Intelligence
- Google Gemini AI (via `GEMINI_API_KEY`) for task and note automation.

### Background Services

#### Automatic Gmail Sync (15-minute interval)
- Syncs all enabled Gmail accounts
- Processes new messages and calendar events
- Links messages to operations after each sync cycle
- Handles rate limiting and error recovery
- Updates sync status: idle → syncing → idle

#### Automatic Calendar Sync (5-minute interval)
- Syncs calendar events from all Gmail accounts
- Updates existing events and creates new ones

#### Automation Service (15-minute interval)
- Processes existing operations for AI task/note creation
- Handles unprocessed messages according to automation rules
- Processes attachments and creates folders automatically
- Runs email thread analysis for operations with linked emails
- Updates lastProcessedAt timestamp for processed configs

### Recent Changes

**November 7, 2025 - AI Financial Detection System & Enhanced Automation**
- **AI-Powered Financial Transaction Detection** (NEW - COMPLETE):
  - Automated detection of payments (from clients) and expenses (company payments) from email attachments using Gemini AI
  - PDF text extraction with pdf-parse library for analyzing invoices, receipts, and financial documents
  - Creates financial suggestions requiring user approval before creating actual payment/expense records
  - Confidence scoring (70% minimum threshold) ensures high-quality suggestions
  - Real-time notification system in header showing pending suggestions with badge counter
  - Detailed approval workflow with AI reasoning display, rejection capability with notes
  - **Intelligent Duplicate Detection System** (NEW - COMPLETE):
    - SHA-256 file hash calculation for exact duplicate detection
    - Automatic skip of already-processed files (prevents reprocessing same attachment)
    - Smart similarity matching: ±2% amount tolerance, ±3 day date window, same operation
    - New database fields: `isDuplicate`, `duplicateReason`, `relatedSuggestionId`, `attachmentHash`
    - Visual UI indicators: duplicate badge in notification list, warning alert in approval modal
    - Clear messaging explains why transaction is flagged as potential duplicate
    - Users can still approve flagged duplicates with full context (warning-only, not blocking)
  - **Configurable UI toggles in automation settings**: `autoDetectPayments` and `autoDetectExpenses` switches with clear descriptions
  - Integrated with automation service - processes automatically in background every 15 minutes
  - New `financial_suggestions` table tracks all detected transactions and their approval status
  - Financial Detection API endpoints: GET pending, GET by operation, approve, reject
  - Full integration with automation config mutations (create/update operations include detection flags)
- **Enhanced AI Task/Note Generation**:
  - Improved prompts to generate professional, descriptive notes (minimum 100 characters) with full context
  - Implemented intelligent task deduplication to prevent creating similar tasks from email threads
  - Added automatic task status detection (completed/overdue) based on email content and current date
  - Integrated knowledge base for continuous learning - saves successful analyses to reduce future API calls
  - Implemented rate limiting (2s delay between calls) and retry logic with exponential backoff (3 attempts) to handle Gemini API 429 errors
  - Status updates: AI can now update existing task statuses (completed/overdue) based on email evidence
  - Tasks created with appropriate initial status (pending/overdue/completed) based on AI analysis
- **Kanban Board Fix**:
  - Fixed drag-and-drop task status persistence issue in TaskKanban component
  - Implemented `useDroppable` hook to properly register columns as droppable areas
  - Created dedicated `DroppableColumn` component for better drop zone detection
  - Added visual feedback (border highlight) when dragging tasks over columns
  - Task status now correctly updates and persists when dragged between columns
- **System Improvements**:
  - Fixed Gmail sync stuck in "syncing" state by changing final status to "idle" instead of "completed"
  - Implemented periodic email linking (runs every 15 minutes after Gmail sync)
  - Added automated processing of existing operations for AI-powered task/note creation
  - Fixed processEmailThreadForAutomation to use first enabled automation config instead of searching for specific module name
  - Fixed client assignment issue by transforming empty strings to null in insertOperationSchema
  - Created FinancialDetectionService for analyzing email attachments and detecting transactions
  - Added FinancialSuggestionsNotification component in app header for user approval workflow