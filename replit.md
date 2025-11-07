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
- **Automation Tables**: `automationConfigs` (with `customFolderNames` JSONB), `automationRules`, `automationLogs`.
- **AI Tables**: `operationAnalyses`, `bankAccountAnalyses`, `knowledgeBase` (supports both 'operation' and 'bank_account' analysis types).
- **Patterns**: UUID primary keys, foreign key relationships, timestamp tracking, status enums, JSONB for metadata, B2 storage keys, SHA-256 file hashes.

#### Core Features
- **Integrated Financial Management**: Comprehensive banking module (accounts, transactions), payments linked to invoices and bank accounts, expenses linked to bank accounts, clickable accounts with detailed financial dashboards.
- **Client Management**: Clickable client rows with detailed dashboards, currency field locked after creation to prevent conflicts with linked invoices/payments, comprehensive client operation statistics.
- **Gmail Integration**: OAuth 2.0, automatic background sync every 15 minutes (messages, calendar events), multi-account support, email bodies and attachments stored in Backblaze B2 with deduplication, intelligent spam filtering, automatic message-to-operation linking after each sync.
- **AI-Powered Assistance**:
    - **LiveChat Personal Assistant**: Optimistic updates, smart operation search by various references, proactive assistance, flexible search.
    - **AI Task & Note Automation**: 
        - Automatically creates tasks and notes from email threads using Gemini AI
        - Real-time processing for new operations with linked emails
        - Periodic processing of existing operations (runs every 15 minutes with Gmail sync)
        - Smart caching with multi-level deduplication (per-thread cache + knowledge base)
        - Confidence-based filtering (70% minimum threshold)
        - Support for different optimization levels (high, medium, low)
    - **AI Financial Analysis**: Expert financial analysis for bank accounts using Gemini AI with progressive learning. Provides insights on cash flow, expense categorization, red flags, optimization opportunities, and actionable recommendations. Uses knowledge base to reduce API calls.
    - **AI Knowledge Base System**: Progressive learning system reusing successful analyses from a knowledge base (stored in B2) to reduce Gemini API calls. Now supports both operation and bank account analysis types.
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

**November 7, 2025**
- Fixed Gmail sync stuck in "syncing" state by changing final status to "idle" instead of "completed"
- Implemented periodic email linking (runs every 15 minutes after Gmail sync)
- Added automated processing of existing operations for AI-powered task/note creation
- Fixed processEmailThreadForAutomation to use first enabled automation config instead of searching for specific module name
- Fixed client assignment issue by transforming empty strings to null in insertOperationSchema