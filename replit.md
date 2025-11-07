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
- **Core Tables**: `users`, `employees`, `clients`, `operations`, `invoices`, `proposals`, `expenses`, `leads`, `bank_accounts`, `chat_conversations`, `chat_messages`, `operationTasks`.
- **Integration Tables**: `customFields`, `customFieldValues`, `gmailAccounts`, `gmailMessages`, `calendarEvents`.
- **File Management Tables**: `operationFolders`, `operationFiles`, `gmailAttachments`.
- **Automation Tables**: `automationConfigs`, `automationRules`, `automationLogs`.
- **AI Tables**: `operationAnalyses`, `bankAccountAnalyses`, `knowledgeBase`, `financial_suggestions`.
- **Patterns**: UUID primary keys, foreign key relationships, timestamp tracking, status enums, JSONB for metadata, B2 storage keys, SHA-256 file hashes.

#### Core Features
- **Integrated Financial Management**: Comprehensive banking module, payments, expenses, and detailed financial dashboards.
- **Client Management**: Clickable client rows with detailed dashboards and operation statistics.
- **Gmail Integration**: OAuth 2.0, automatic background sync (messages, calendar events), multi-account support, email bodies and attachments stored in Backblaze B2, intelligent spam filtering, automatic message-to-operation linking.
- **AI-Powered Assistance**:
    - **LiveChat Personal Assistant**: Optimistic updates, smart operation search, proactive assistance.
    - **AI Task & Note Automation (Smart Gemini)**: 2-level resilient system with 100% open source fallback. Primary: Gemini AI with confidence-based filtering, intelligent deduplication, status auto-update, knowledge base integration, company context awareness. Fallback: Rule-based analyzer using regex patterns, keyword detection, and information extraction (no external APIs). **Content Quality**: Both AI and fallback systems INTERPRET emails and transform informal conversations into professional business summaries suitable for internal use without needing email context. Aggressive text cleaning removes greetings, salutations, informal phrases, and converts conversational language to objective business terminology. Circuit breaker protection ensures continuous operation. Rate limiting, retry logic, multi-level caching, real-time and periodic processing, respects manual modifications.
    - **AI Financial Analysis**: Expert financial analysis for bank accounts using Gemini AI with progressive learning, providing insights on cash flow, expenses, optimization, and actionable recommendations.
    - **AI Knowledge Base System**: Progressive learning system storing and reusing successful analyses to reduce Gemini API calls.
    - **AI-Powered Financial Transaction Detection**: 2-level resilient detection system (Gemini AI → OCR Fallback) with circuit breaker pattern. Automated detection of payments and expenses from email attachments, creating financial suggestions requiring user approval. Includes intelligent duplicate detection and configurable UI toggles. All suggestions go through approval workflow - no separate manual queue needed. Runs automatically every 15 minutes via automation service.
- **Kanban Task Board System**: Drag-and-drop task management with configurable status columns, manual override of AI-generated tasks.
- **File Management**: Backblaze B2 exclusive storage for all files, automatic attachment processing and categorization, SHA-256 hash-based deduplication, hierarchical folder organization.
- **Automation Module**: Plugin-based system for entity creation from email patterns, rule-based matching, custom folder name configuration.
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

#### Object Storage
- Backblaze B2 (Exclusive storage solution, S3-compatible API via `@aws-sdk/client-s3`)

#### Artificial Intelligence
- Google Gemini AI (via `GEMINI_API_KEY`)

#### Background Services
- **Automatic Gmail Sync**: Every 15 minutes, processes messages and calendar events, links messages to operations.
- **Automatic Calendar Sync**: Every 5 minutes, syncs calendar events.
- **Automation Service**: Every 15 minutes, processes operations for AI task/note creation, handles unprocessed messages, processes attachments, and runs email thread analysis.