# LogistiCore - Freight Forwarding Platform

## Overview
LogistiCore is a comprehensive freight forwarding and logistics management platform designed to streamline complex shipping operations. It is a full-stack enterprise application managing shipments, clients, staff, invoices, quotes, expenses, and leads with robust role-based access control. The platform emphasizes enterprise design principles with logistics-focused iconography and terminology, tailored for freight forwarding workflows, aiming to enhance efficiency and reduce operational costs within the logistics sector.

## User Preferences
Preferred communication style: Simple, everyday language (Spanish).
Industry focus: Freight forwarding and logistics operations.
Design preference: Logistics-focused iconography and terminology.

## Recent Updates (November 6, 2025)
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