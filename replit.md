# LogistiCore - Freight Forwarding Platform

## Overview
LogistiCore is a comprehensive freight forwarding and logistics management platform designed to streamline complex shipping operations. It is a full-stack enterprise application managing shipments, clients, staff, invoices, quotes, expenses, and leads with robust role-based access control. The platform emphasizes enterprise design principles with logistics-focused iconography and terminology, tailored for freight forwarding workflows, aiming to enhance efficiency and reduce operational costs within the logistics sector.

## User Preferences
Preferred communication style: Simple, everyday language (Spanish).
Industry focus: Freight forwarding and logistics operations.
Design preference: Logistics-focused iconography and terminology.

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
- **Automation Tables**: `automationConfigs`, `automationRules`, `automationLogs`.
- **Patterns**: UUID primary keys, foreign key relationships, timestamp tracking, status enums, JSONB for metadata, B2 storage keys, SHA-256 file hashes.

### Core Features
- **Gmail Integration**: OAuth 2.0, background sync (messages, calendar events), multi-account support, UI for message/calendar viewing, email bodies and attachments stored in Backblaze B2 with automatic deduplication.
- **Spam Filtering**: Intelligent email filtering that blocks spam while preserving important business communications.
- **Automation Module**: Plugin-based system for entity creation from email patterns (e.g., Operations from emails), rule-based matching.
- **AI-Powered Task & Note Automation**: Automatically analyzes email threads linked to operations and creates relevant tasks and notes using Gemini AI, with smart caching and deduplication for optimized API usage.
- **Employee Birthday Tracking**: Automatic creation/update of birthday events in calendar, special UI indicators.
- **File Management**: Backblaze B2 storage (primary), Replit Object Storage (legacy fallback), automatic attachment processing from emails with categorization, SHA-256 deduplication, hierarchical folder organization, ACL-based permissions, presigned URLs.

## External Dependencies

### Database
- Neon PostgreSQL Serverless (`@neondatabase/serverless`)
- Drizzle ORM (v0.39.1) & Drizzle Kit
- External Neon database: `neondb` on Neon cloud (ap-southeast-1)

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
- **Backblaze B2** (Primary storage, S3-compatible API via `@aws-sdk/client-s3`) for email bodies, attachments, and operation files, with SHA-256 hash-based file deduplication.
- **Replit Object Storage** (Legacy fallback, Google Cloud Storage-backed) for backward compatibility.

### Artificial Intelligence
- Google Gemini AI (via `GEMINI_API_KEY`) for task and note automation.