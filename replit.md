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
- **Integration Tables**: `customFields`, `customFieldValues`, `gmailAccounts`, `gmailMessages`, `calendarEvents`.
- **File Management Tables**: `operationFolders` (hierarchical), `operationFiles` (metadata, storage paths).
- **Automation Tables**: `automationConfigs`, `automationRules`, `automationLogs`.
- **Patterns**: UUID primary keys, foreign key relationships, timestamp tracking, status enums, JSONB for metadata.

### Authentication & Authorization
- **Authentication**: Session-based, PostgreSQL session store, HTTP-only cookies, bcrypt hashing.
- **Authorization**: Three-tier role system (admin, manager, employee), middleware for role checking, role-based UI rendering.

### Core Features
- **Gmail Integration**: OAuth 2.0, background sync (messages, calendar events), multi-account support, UI for message/calendar viewing.
- **Automation Module**: Plugin-based system for entity creation from email patterns (e.g., Operations from emails), rule-based matching, configurable modules, logging.
- **Employee Birthday Tracking**: Automatic creation/update of birthday events in calendar, special UI indicators, responsive employee forms.
- **File Management**: Manual uploads to Replit Object Storage, automatic attachment processing from emails with categorization (Pagos, Gastos, Fotos, Facturas, Contratos, Documentos), hierarchical folder organization, ACL-based permissions, presigned URLs.

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
- Replit Object Storage (backed by Google Cloud Storage)

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