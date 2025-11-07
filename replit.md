# LogistiCore - Freight Forwarding Platform

## Overview
LogistiCore is a comprehensive freight forwarding and logistics management platform designed to streamline complex shipping operations. It is a full-stack enterprise application managing shipments, clients, staff, invoices, quotes, expenses, and leads with robust role-based access control. The platform emphasizes enterprise design principles with logistics-focused iconography and terminology, tailored for freight forwarding workflows, aiming to enhance efficiency and reduce operational costs within the logistics sector.

## User Preferences
Preferred communication style: Simple, everyday language (Spanish).
Industry focus: Freight forwarding and logistics operations.
Design preference: Logistics-focused iconography and terminology.

## Recent Updates (November 7, 2025)
1. **Integrated Financial Management Tabs**: Added 4 new tabs to operation detail page for comprehensive financial tracking:
   - **Payments Tab**: ✅ Full CRUD - Create, edit, delete payments linked directly to operations via `operationId` foreign key
     - Payment methods: cash, transfer, check, card, other
     - Real-time data fetching with TanStack Query
     - Dialog-based forms for create/edit operations
   - **Invoices Tab**: ✅ Read-only display - Track invoices associated with specific operations
     - Displays invoice number, date, total, status
     - Redirects to main invoices module for creation/editing (due to complexity with invoice items)
   - **Expenses Tab**: ✅ Full CRUD - Create, edit, delete expenses linked directly to operations
     - Categories: travel, supplies, equipment, services, other
     - Status tracking: pending, approved, rejected, reimbursed
     - Employee assignment with dropdown selection
     - Optional receipt URL field
   - **Client Tab**: ✅ Read-only preview of client information reusing UI from main clients module
   - Backend support:
     - Storage methods: `getPaymentsByOperation()`, `getInvoicesByOperation()`, `getExpensesByOperation()`
     - API routes: `/api/operations/:id/payments`, `/api/operations/:id/invoices`, `/api/operations/:id/expenses`
     - All routes support GET (list) and POST (create) operations
     - Individual PATCH and DELETE routes use existing `/api/payments/:id`, `/api/expenses/:id` endpoints
   - Tab layout expanded to 9 columns to accommodate new financial modules
   - All tabs follow consistent UI/UX patterns with empty states, loading states, and action buttons
2. **LiveChat Personal Assistant - Optimizado y Mejorado**: Chat completamente funcional con respuestas rápidas e inteligentes:
   - **Optimistic Updates**: Mensajes del usuario aparecen INSTANTÁNEAMENTE antes de esperar respuesta del servidor
   - **Búsqueda Inteligente de Operaciones**: Entiende referencias imprecisas ("operación 0051", "51", "NAVI-0051")
   - **Asistente Proactivo**: AI anticipa necesidades y ofrece información relevante automáticamente
   - **Búsqueda Flexible**: Encuentra operaciones por nombre, referencia, descripción o números parciales
   - **Prompt Mejorado**: Instrucciones detalladas para respuestas contextuales en español con emojis
   - Corregido bucle infinito que creaba conversaciones duplicadas
   - Tablas de base de datos: `chat_conversations` y `chat_messages` creadas y funcionando
2. **Kanban Task Board System**: Implemented visual drag-and-drop task management:
   - New `TaskKanban` component with 5 status columns displayed horizontally: Pending, In Progress, Pending Approval, Completed, Cancelled
   - **Horizontal scrollable layout** - All columns visible in a single line with 320px width each for easy drag-and-drop
   - Drag-and-drop functionality using @dnd-kit library for moving tasks between status columns
   - **Status selector in create/edit forms** - Users can manually select task status when creating or editing tasks
   - Added `modifiedManually` boolean field to `operationTasks` table to track user-edited tasks
   - Manual task modifications (edit, drag-drop, status change) automatically set `modifiedManually: true` flag
   - AI automation respects manually modified tasks - never duplicates or overwrites them
   - Visual indicators show task priority, assignee, due date, and creation source (AI vs Manual)
   - Integrated into operation detail page with dialog-based create/edit forms
   - Console logs clearly show: "🔒 Respecting manually modified task" when automation skips protected tasks
2. **AI Knowledge Base System**: Implemented progressive learning system to dramatically reduce Gemini API usage:
   - New `knowledgeBase` table indexes successful analyses with operation metadata
   - Intelligent similarity matching (60%+ threshold) finds relevant prior analyses
   - Successful analyses stored as JSON documents in Backblaze B2 for reuse
   - System learns from each analysis and improves quality scores over time
   - Logs clearly show: "🎓 REUSING KNOWLEDGE" vs "🤖 CALLING GEMINI API"
   - Cache extended from 1 hour to 24 hours to further reduce API calls
3. **Operation Analysis Service Enhanced**: 
   - Before calling Gemini, system searches knowledge base for similar operations
   - If match found (based on type, category, shipping mode, priority), adapts existing analysis
   - Only calls Gemini when no similar case exists in knowledge base
   - Each new Gemini-generated analysis is saved to knowledge base for future reuse
   - Usage counter and quality score track effectiveness of each knowledge entry

## Previous Updates (November 6, 2025)
1. **Complete English Translation**: Operation files and automation modules fully translated to English including UI, error messages, categories, colors, and all user-facing text.
2. **Custom Folder Names UI**: Added configuration interface in automation settings for custom folder naming, allowing users to personalize automatic file categorization folders.
3. **Attachment Cleanup**: Removed 77 pending attachments from database to enable fresh re-download and processing via direct B2 upload during next Gmail sync.
4. **Direct B2 Upload**: FileUploader component integrated for direct Backblaze B2 uploads with proper validation and error handling.
5. **File Management Complete Rewrite** (operation-files.tsx):
   - **Replaced complex implementation with simple HTML forms** - No more shadcn Select issues
   - **Manual folder creation WORKS** - Native select elements with proper form handling
   - **Manual file upload WORKS** - FileUploader integration with metadata dialog
   - **File editing FULLY VISIBLE** - Edit/Delete/Download buttons in dropdown menus for every file
   - **Move files between folders** - Edit dialog with folder selector
   - **Rename files** - Edit dialog with name field
   - **Delete files** - Confirmation prompt before deletion
   - **"All Files" view** - Shows ALL operation files across all folders
   - **Automation respects user changes** - Per-attachment duplicate prevention via sourceGmailAttachmentId
6. **Critical Bug Fix - apiRequest Parameter Order**:
   - Fixed incorrect parameter order across multiple files (was `url, method, data` ❌ → now `method, url, data` ✅)
   - Fixed files: operation-files.tsx (6 places), operation-detail.tsx (2 places), calendar.tsx (2 places)
   - All CRUD operations now work correctly: create/edit/delete folders and files
7. **File Upload Limit Increased**: Express body parser limit increased from 100kb to 50mb (supports ~37mb actual files after base64 encoding overhead)
8. **Operation Detail Files Tab - Full CRUD Visibility** (operation-detail.tsx):
   - **All file/folder operations now visible** - Dropdown menus (⋮) for every file and folder
   - **Edit folders** - Rename via dropdown menu with Edit Folder dialog
   - **Delete folders** - Remove via dropdown menu with confirmation dialog (deletes all contained files)
   - **Edit files** - Rename and move between folders via dropdown menu with Edit File dialog
   - **Delete files** - Remove via dropdown menu with confirmation dialog
   - **Download files** - Direct download via dropdown menu
   - **Complete feature parity** - Operation detail tab now has same file management capabilities as dedicated files page

## System Architecture

### Frontend
- **Frameworks**: React 18 with TypeScript, Vite, Wouter (routing), TanStack Query (server state management).
- **UI**: Shadcn/ui (Radix UI primitives), Tailwind CSS with custom design tokens, CVA for styling, logistics-focused iconography, custom coral/orange color palette, Poppins font, dark mode support.
- **State Management**: React Context (authentication), TanStack Query (server state), React hooks (local UI state).

### Backend
- **Framework**: Express.js with TypeScript for RESTful APIs.
- **Authentication**: Session-based using express-session with PostgreSQL store, bcrypt for password hashing.
- **Authorization**: Role-based access control (admin, manager, employee) middleware.
- **API Design**: RESTful endpoints (`/api/*`) for CRUD operations, JSON format, error handling.
- **Data Layer**: Drizzle ORM (type-safe queries), Zod validation, schema-first design.

### Database Schema
- **Core Tables**: `users`, `employees`, `clients`, `operations`, `invoices`, `proposals`, `expenses`, `leads`.
- **Integration Tables**: `customFields`, `customFieldValues`, `gmailAccounts`, `gmailMessages`, `calendarEvents`.
- **File Management Tables**: `operationFolders`, `operationFiles`, `gmailAttachments`.
- **Automation Tables**: `automationConfigs` (with `customFolderNames` JSONB field for user-configurable folder names), `automationRules`, `automationLogs`.
- **AI Tables**: `operationAnalyses` (24-hour cache for AI analysis), `knowledgeBase` (progressive learning system with B2 document storage).
- **Patterns**: UUID primary keys, foreign key relationships, timestamp tracking, status enums, JSONB for metadata, B2 storage keys, SHA-256 file hashes.

### Core Features
- **Gmail Integration**: OAuth 2.0, background sync (messages, calendar events), multi-account support, UI for message/calendar viewing, email bodies and attachments stored in Backblaze B2 with automatic deduplication.
- **Spam Filtering**: Intelligent email filtering that blocks spam while preserving important business communications.
- **Automation Module**: Plugin-based system for entity creation from email patterns (e.g., Operations from emails), rule-based matching, custom folder name configuration for automatic file categorization.
- **AI-Powered Task & Note Automation**: Automatically analyzes email threads linked to operations and creates relevant tasks and notes using Gemini AI, with smart caching and deduplication for optimized API usage.
- **Employee Birthday Tracking**: Automatic creation/update of birthday events in calendar, special UI indicators.
- **File Management**: Backblaze B2 storage (exclusive), automatic attachment processing from emails with categorization, SHA-256 hash-based deduplication, hierarchical folder organization, metadata tracking, automatic file versioning. Manual folder creation and file upload supported. Files can be moved between folders and renamed via Edit dialog. Automation respects user modifications (per-attachment checking prevents duplicates).

## External Dependencies

### Database
- Neon PostgreSQL Serverless (`@neondatabase/serverless`)
- Drizzle ORM (v0.39.1) & Drizzle Kit
- External Neon database: `neondb` on Neon cloud (ap-southeast-1)

### Data Transfer Optimizations (Nov 2025)
**Background**: The project exceeded Neon's data transfer quota. Optimizations implemented to reduce egress data:

1. **Dashboard Stats**: Changed from fetching all records (using `getAll*()`) to using `COUNT(*)` queries - reduces data transfer by ~99% for stats endpoint.
2. **Background Sync Frequencies**: Reduced to minimize DB queries:
   - Gmail sync: 10 min → 120 min (12x reduction)
   - Automation service: 2 min → 15 min (7.5x reduction)
3. **Gmail Message Queries**: 
   - Default limit: 200 → 50 messages
   - Maximum enforced limit: 100 messages per query
   - Attachment endpoint: 500 → 100 messages per account
4. **Future Optimizations Needed**:
   - Add pagination to all `getAll*` methods
   - Select specific columns instead of `SELECT *`
   - Implement caching for frequently accessed data
   - Add indexes for common query patterns

### UI Libraries
- Radix UI
- React Hook Form
- Zod
- date-fns
- Lucide React

### Session & Security
- connect-pg-simple
- bcrypt
- CORS (Express middleware)

### Google API Integration
- googleapis (for Gmail and Calendar API)

### Object Storage
- **Backblaze B2** (Exclusive storage solution, S3-compatible API via `@aws-sdk/client-s3`) for email bodies, attachments, and operation files, with SHA-256 hash-based automatic file deduplication.
- Required environment variables: `B2_BUCKET_NAME`, `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_ENDPOINT`
- Lazy initialization pattern: backblazeStorage singleton initializes on first use to ensure secrets are available
- Metadata sanitization: All metadata fields are sanitized to remove invalid HTTP header characters (control chars, non-ASCII)

### Artificial Intelligence
- Google Gemini AI (via `GEMINI_API_KEY`) for task and note automation.