# LogistiCore - Freight Forwarding Platform

## Overview

LogistiCore is a comprehensive freight forwarding and logistics management platform designed for managing complex shipping operations. It's a full-stack enterprise application that handles shipments, clients, staff, invoices, quotes, expenses, and leads with role-based access control. The platform follows enterprise design principles with logistics-focused iconography and terminology, optimized for freight forwarding workflows.

## User Preferences

Preferred communication style: Simple, everyday language (Spanish).
Industry focus: Freight forwarding and logistics operations.
Design preference: Logistics-focused iconography and terminology.

## System Architecture

### Frontend Architecture

**Framework & Tooling**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management with automatic caching and refetching

**UI Component System**
- Shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Class Variance Authority (CVA) for variant-based component styling
- Logistics-focused design with freight forwarding iconography (trucks, ships, planes, packages)

**Design Tokens**
- Custom color palette with primary coral/orange accent (hsl 9 75% 61%) and neutral grays
- Typography system using Poppins font family with consistent weight hierarchy
- Spacing system based on Tailwind's 2-16 unit scale
- Dark mode support with CSS variables for theme switching
- Freight forwarding branding throughout the application

**State Management**
- React Context for authentication state (AuthContext)
- TanStack Query for server state with stale-while-revalidate pattern
- Local component state with React hooks for UI interactions
- Session-based authentication persisted server-side

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for RESTful API endpoints
- Session-based authentication using express-session with PostgreSQL store (connect-pg-simple)
- Role-based access control middleware (admin, manager, employee roles)
- Bcrypt for password hashing with salt rounds

**API Design**
- RESTful endpoints under `/api` namespace
- CRUD operations for all major entities (clients, employees, operations, invoices, proposals, expenses, leads)
- Authentication endpoints (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`)
- Role-based authorization middleware for protected routes
- JSON request/response format with comprehensive error handling

**Data Layer**
- Storage abstraction interface (IStorage) for database operations
- Drizzle ORM for type-safe database queries
- Schema-first design with Zod validation
- Database agnostic design (currently using Neon PostgreSQL serverless)

### Database Schema

**Core Tables**
- **users**: Authentication and role management (admin/manager/employee)
- **employees**: Extended employee information linked to user accounts
- **clients**: Customer relationship management
- **operations**: Freight forwarding shipment tracking with comprehensive logistics fields:
  - Basic info: name, description, status, priority, client, assigned employee
  - Project details: project category, operation type (FCL/LCL/Air/Road/Rail), shipping mode (sea/air/land/multimodal), insurance, currency
  - Shipping info: courier, pick up address, delivery address
  - Tracking & dates: booking/tracking number, pick up date, ETD, ETA, MBL/AWB, HBL/AWB
- **invoices**: Financial tracking with status workflow (draft/sent/paid/overdue/cancelled)
- **proposals**: Sales proposal management with acceptance workflow
- **expenses**: Employee expense tracking with approval workflow
- **leads**: Sales pipeline management with conversion tracking
- **customFields**: Dynamic field definitions for entity customization
- **customFieldValues**: Values for custom fields across entities
- **gmailAccounts**: Gmail/GSuite account management for OAuth integration
- **gmailMessages**: Gmail messages synced from Google API
- **calendarEvents**: Google Calendar events synced from Calendar API, plus local events

**Schema Patterns**
- UUID primary keys generated via PostgreSQL `gen_random_uuid()`
- Foreign key relationships with cascade/set null delete behaviors
- Timestamp tracking (createdAt) for audit trails
- Status enums for workflow states (planning/in-progress/completed, etc.)
- JSONB fields for flexible metadata storage

**Data Integrity**
- Referential integrity enforced through foreign key constraints
- Unique constraints on usernames and emails
- Not null constraints on critical fields
- Drizzle-zod integration for runtime validation matching database schema

### Authentication & Authorization

**Authentication Mechanism**
- Session-based authentication using express-session
- PostgreSQL session store for persistence across server restarts
- HTTP-only session cookies for security
- Password hashing with bcrypt (10 salt rounds)

**Authorization Model**
- Three-tier role system: admin, manager, employee
- Middleware functions for role checking (requireAuth, requireAdminOrManager, requireAdmin)
- Role-based UI rendering in React components
- Protected routes enforced at both frontend and backend layers

### External Dependencies

**Database**
- Neon PostgreSQL Serverless (@neondatabase/serverless) with WebSocket support
- Connection pooling via pg Pool
- Drizzle ORM (v0.39.1) for query building and migrations
- Drizzle Kit for schema management and migrations

**UI Libraries**
- Radix UI primitives for accessible component foundations (accordion, dialog, dropdown, select, etc.)
- React Hook Form for form state management
- Zod for schema validation and type inference
- date-fns for date formatting and manipulation
- Lucide React for icon system

**Development Tools**
- TypeScript for static type checking
- ESBuild for production bundling
- TSX for development server with hot reload
- PostCSS with Tailwind and Autoprefixer

**Session & Security**
- connect-pg-simple for PostgreSQL session storage
- bcrypt for password hashing
- CORS handling via Express middleware

**Google API Integration**
- googleapis package for Gmail and Calendar API access
- Custom OAuth 2.0 flow with automatic redirect URI detection using REPLIT_DOMAINS
- OAuth scopes: gmail.readonly, calendar.readonly
- Automatic token refresh handling
- Background sync services with 5-minute intervals

**Deployment Considerations**
- Environment variable for DATABASE_URL
- Separate build commands for client (Vite) and server (ESBuild)
- Production mode uses compiled JavaScript from dist directory
- Static file serving in production via Express

## Recent Features

### Gmail Integration Module (November 2025)
Complete Gmail/GSuite synchronization system with OAuth authentication:

**OAuth Implementation**
- Custom OAuth flow using Google APIs
- Automatic redirect URI detection via REPLIT_DOMAINS environment variable
- Scopes: gmail.readonly, calendar.readonly
- Token management with automatic refresh
- Support for multiple Gmail accounts per user

**Background Synchronization**
- Automatic Gmail message sync (5-minute intervals)
- Automatic Google Calendar sync (5-minute intervals)
- Last sync timestamp tracking
- Error handling and retry logic
- Configurable sync date ranges

**Gmail Features**
- Message list with subject, sender, snippet
- Inbox/Sent/Starred folder support
- Message body viewing (HTML and plain text)
- Search and filtering capabilities
- Account management UI

**Calendar Features**
- Monthly calendar view with event display
- Event creation (local or synced to Google Calendar)
- All-day event support
- Event details: title, description, location, attendees
- Automatic background synchronization
- Multi-account support (view events from all linked Google accounts)
- Visual differentiation between Google and local events

**Technical Components**
- `server/gmail-sync.ts`: Gmail OAuth and message synchronization service
- `server/calendar-sync.ts`: Google Calendar synchronization service
- `client/src/pages/gmail.tsx`: Gmail inbox interface
- `client/src/pages/calendar.tsx`: Calendar view and event management
- Database tables: gmailAccounts, gmailMessages, calendarEvents
- API routes: `/api/gmail/*`, `/api/calendar/*`
- Background sync initialized in `server/index.ts`

### Automation Module (November 2025)
Modular automation system for creating entities automatically from email patterns:

**Architecture**
- Plugin-based system with available modules catalog
- Each module can be activated/deactivated independently
- Rule-based pattern matching with priority system
- Background processing with 2-minute intervals
- Comprehensive logging for all automation actions

**Available Modules**
1. **Operation Email Automation** (Active)
   - Creates operations automatically from emails matching specific patterns
   - Supports pattern extraction (e.g., "NAVI-123" from subject)
   - Configurable default values for operation fields
   - Marks created operations as "automated" with review flag
2. **Invoice Email Automation** (Coming Soon)
3. **Expense Receipt Automation** (Coming Soon)

**Rule System**
- Multiple rules per module with priority ordering
- Condition operators: contains, startsWith, endsWith, equals, regex
- Field matching: subject, from, to, body
- Action types: create_operation (more to come)
- Enable/disable rules individually

**User Interface**
- Module catalog view showing available automation plugins
- Per-module configuration dialog with tabs:
  - Settings: Gmail account selection, enable/disable
  - Rules: Create and manage automation rules
  - Logs: View execution history
- Visual indicators for automated operations in operations list

**Technical Components**
- `server/automation-service.ts`: Background automation processing service
- `client/src/pages/automation.tsx`: Module catalog and configuration UI
- Database tables: automationConfigs, automationRules, automationLogs
- Extended operations table with: createdAutomatically, automationRuleId, requiresReview
- API routes: `/api/automation/*`
- Background processing initialized in `server/index.ts`