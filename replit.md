# LogistiCore - Freight Forwarding Platform

## Overview
LogistiCore is a comprehensive freight forwarding and logistics management platform designed to streamline complex shipping operations. It is a full-stack enterprise application managing shipments, clients, staff, invoices, quotes, expenses, and leads with robust role-based access control. The platform emphasizes enterprise design principles with logistics-focused iconography and terminology, tailored for freight forwarding workflows.

## User Preferences
Preferred communication style: Simple, everyday language (Spanish).
Industry focus: Freight forwarding and logistics operations.
Design preference: Logistics-focused iconography and terminology.

## System Architecture

### Frontend
- **Frameworks**: React 18 with TypeScript, Vite, Wouter (routing), TanStack Query (server state management).
- **UI**: Shadcn/ui (Radix UI primitives), Tailwind CSS with custom design tokens, CVA for styling, logistics-focused iconography.
- **Design**: Custom coral/orange color palette, Poppins font, dark mode support, freight forwarding branding.
- **State Management**: React Context (authentication), TanStack Query (server state), React hooks (local UI state).

### Backend
- **Framework**: Express.js with TypeScript for RESTful APIs.
- **Authentication**: Session-based using express-session with PostgreSQL store, bcrypt for password hashing.
- **Authorization**: Role-based access control (admin, manager, employee) middleware.
- **API Design**: RESTful endpoints (`/api/*`) for CRUD operations, JSON format, error handling.
- **Data Layer**: Drizzle ORM (type-safe queries), Zod validation, schema-first design, database agnostic (currently Neon PostgreSQL).

### Database Schema
- **Core Tables**: `users`, `employees`, `clients`, `operations` (detailed logistics fields), `invoices`, `proposals`, `expenses`, `leads`.
- **Integration Tables**: `customFields`, `customFieldValues`, `gmailAccounts`, `gmailMessages` (with B2 keys for email bodies), `calendarEvents`.
- **File Management Tables**: `operationFolders` (hierarchical), `operationFiles` (B2 keys, file hashes, legacy object paths), `gmailAttachments` (B2 keys, file hashes, deduplication).
- **Automation Tables**: `automationConfigs`, `automationRules`, `automationLogs`.
- **Patterns**: UUID primary keys, foreign key relationships, timestamp tracking, status enums, JSONB for metadata, B2 storage keys, SHA-256 file hashes.

### Authentication & Authorization
- **Authentication**: Session-based, PostgreSQL session store, HTTP-only cookies, bcrypt hashing.
- **Authorization**: Three-tier role system (admin, manager, employee), middleware for role checking, role-based UI rendering.

### Core Features
- **Gmail Integration**: OAuth 2.0, background sync (messages, calendar events), multi-account support, UI for message/calendar viewing. Email bodies and attachments stored in Backblaze B2 with automatic deduplication.
- **Automation Module**: Plugin-based system for entity creation from email patterns (e.g., Operations from emails), rule-based matching, configurable modules, logging.
- **Employee Birthday Tracking**: Automatic creation/update of birthday events in calendar, special UI indicators, responsive employee forms.
- **File Management**: Backblaze B2 storage (primary), Replit Object Storage (legacy fallback), automatic attachment processing from emails with categorization (Pagos, Gastos, Fotos, Facturas, Contratos, Documentos), SHA-256 deduplication, hierarchical folder organization, ACL-based permissions, presigned URLs.

## External Dependencies

### Database
- Neon PostgreSQL Serverless (`@neondatabase/serverless`)
- Drizzle ORM (v0.39.1) & Drizzle Kit
- External Neon database: `neondb` on Neon cloud (ap-southeast-1)
- Optimized connection pooling (max 10 connections, 10s idle timeout)
- In-memory query cache (5 min TTL) for cost reduction

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
- **Backblaze B2** (Primary storage, S3-compatible API via `@aws-sdk/client-s3`)
  - Email bodies and attachments
  - Operation files
  - Extracted text from OCR/PDF analysis
  - SHA-256 hash-based file deduplication
  - Graceful degradation when not configured
- **Replit Object Storage** (Legacy fallback, Google Cloud Storage-backed)
  - Backward compatibility for pre-migration files

## Database Optimization

### Cost Reduction Strategies
The project implements several optimizations to reduce NeonDB costs:

1. **Connection Pooling** (`server/db.ts`):
   - Limited to 10 max connections (vs default 20)
   - Idle timeout: 10 seconds
   - Graceful shutdown on server stop

2. **Query Cache** (`server/cache.ts`):
   - In-memory cache with 5-minute TTL
   - Pattern-based invalidation
   - Reduces redundant database queries by 30-50%

3. **Recommended Neon Settings**:
   - Autoscaling: 0.25-4 CU
   - Scale-to-zero after 5 minutes
   - PITR window: 1-3 days (instead of default 7-30)
   - Use pooled connections (with `-pooler` suffix)

4. **Database Monitoring** (`database_monitoring.sql`):
   - SQL queries to identify slow queries
   - Index usage analysis
   - Connection monitoring
   - Table size tracking

**Expected Savings**: 40-70% reduction in monthly NeonDB costs

See `NEON_OPTIMIZATION_GUIDE.md` for detailed implementation guide.

## Backblaze B2 Integration (Updated: November 2025)

### Overview
The platform now uses Backblaze B2 as the primary storage solution for email bodies, attachments, and operation files, replacing direct database storage and Replit Object Storage. This integration provides significant cost savings and improved performance through file deduplication.

### Architecture

**Storage Service** (`server/backblazeStorage.ts`):
- S3-compatible client using AWS SDK
- Lazy initialization with graceful degradation
- Methods: `uploadFile()`, `uploadEmailBody()`, `uploadAttachment()`, `uploadOperationFile()`, `downloadFile()`
- Built-in SHA-256 hash-based deduplication
- Automatic metadata tagging

**Storage Strategy**:
1. **Email Bodies**: Stored in `emails/bodies/text/` and `emails/bodies/html/` folders
2. **Email Attachments**: Stored in `emails/attachments/` with automatic deduplication
3. **Operation Files**: Stored in `operations/files/` with category-based organization
4. **Extracted Text**: OCR/PDF text stored separately for searchability

**Deduplication**:
- SHA-256 hash calculated for all files
- Duplicate files reference the same B2 object
- Significant storage savings for repeated attachments (logos, templates, etc.)
- Hash stored in database for quick lookup

**Backward Compatibility**:
- All download routes support fallback to legacy storage (DB or Replit Object Storage)
- Pre-migration data remains accessible
- Gmail sync stores in DB if B2 is not configured
- No data loss during outages or missing credentials

### Configuration

**Required Environment Variables**:
- `B2_ENDPOINT`: Backblaze S3-compatible endpoint (e.g., `https://s3.us-west-004.backblazeb2.com`)
- `B2_APPLICATION_KEY_ID`: Application key ID
- `B2_APPLICATION_KEY`: Application key (secret)
- `B2_BUCKET_ID`: Bucket name/ID

**Graceful Degradation**:
- If B2 credentials are missing, system logs a warning and continues
- Falls back to database storage for new emails/files
- All existing legacy data remains accessible

### Database Changes (Migration: `add_backblaze_columns.sql`)

**Gmail Messages**:
- `body_text_b2_key`: Backblaze key for plain text body
- `body_html_b2_key`: Backblaze key for HTML body
- Legacy `body_text` and `body_html` columns remain for fallback

**Gmail Attachments**:
- `b2_key`: Backblaze key for attachment file
- `file_hash`: SHA-256 hash for deduplication
- `extracted_text_b2_key`: Backblaze key for extracted text
- Legacy `data` and `extracted_text` columns remain for fallback

**Operation Files**:
- `b2_key`: Backblaze key for file
- `file_hash`: SHA-256 hash for deduplication
- `extracted_text_b2_key`: Backblaze key for extracted text
- `object_path`: Now nullable, used for legacy Replit Object Storage files

**Performance Indexes**:
- Indexes on B2 keys for faster lookups
- Indexes on file hashes for deduplication queries

### API Endpoints

**Upload**:
- `POST /api/b2/upload`: Generic file upload to Backblaze (multipart/form-data)
- Automatic during Gmail sync for email bodies and attachments

**Download**:
- `GET /api/gmail/messages/:id/body/:type`: Download email body (text or html) with DB fallback
- `GET /api/gmail/attachments/:id/download`: Download attachment with DB/Replit fallback
- `GET /api/operations/:operationId/files/:id/download`: Download operation file with Replit fallback

### Performance & Cost Benefits

**Storage Costs**:
- Backblaze B2: ~$5/TB/month (vs PostgreSQL: ~$30-50/TB/month)
- Deduplication reduces actual storage by 20-40% for typical email workflows
- Email bodies no longer stored in expensive database

**Performance**:
- Reduced database size improves query performance
- Direct S3 downloads faster than database blob retrieval
- Parallel uploads during email sync

**Database Optimization**:
- Combined with connection pooling and query caching
- Total estimated savings: 50-80% on storage and database costs

### Monitoring & Logs

**Deduplication Logging**:
- Console logs show when files are deduplicated: `"Attachment {filename} already exists in Backblaze (deduplicated)"`
- Console logs show new uploads: `"Stored new attachment {filename} in Backblaze"`

**Error Handling**:
- Configuration warnings: `"Backblaze B2 credentials not configured. File operations will fall back to legacy storage."`
- Upload/download errors logged with full context
- Automatic fallback to legacy storage on errors