-- Migration: Add Backblaze B2 storage columns
-- Created: 2024-11-05
-- Description: Add columns for Backblaze B2 storage to support migrating from database/Replit storage

-- Gmail Messages: Add B2 keys for email bodies
ALTER TABLE gmail_messages
ADD COLUMN IF NOT EXISTS body_text_b2_key TEXT,
ADD COLUMN IF NOT EXISTS body_html_b2_key TEXT;

COMMENT ON COLUMN gmail_messages.body_text_b2_key IS 'Backblaze B2 key for plain text email body';
COMMENT ON COLUMN gmail_messages.body_html_b2_key IS 'Backblaze B2 key for HTML email body';

-- Gmail Attachments: Add B2 keys and file hash for deduplication
ALTER TABLE gmail_attachments
ADD COLUMN IF NOT EXISTS b2_key TEXT,
ADD COLUMN IF NOT EXISTS file_hash TEXT,
ADD COLUMN IF NOT EXISTS extracted_text_b2_key TEXT;

COMMENT ON COLUMN gmail_attachments.b2_key IS 'Backblaze B2 key for the attachment file';
COMMENT ON COLUMN gmail_attachments.file_hash IS 'SHA-256 hash for file deduplication';
COMMENT ON COLUMN gmail_attachments.extracted_text_b2_key IS 'Backblaze B2 key for extracted text from OCR/PDF analysis';

-- Operation Files: Add B2 keys and file hash, make objectPath nullable
ALTER TABLE operation_files
ADD COLUMN IF NOT EXISTS b2_key TEXT,
ADD COLUMN IF NOT EXISTS file_hash TEXT,
ADD COLUMN IF NOT EXISTS extracted_text_b2_key TEXT,
ALTER COLUMN object_path DROP NOT NULL;

COMMENT ON COLUMN operation_files.b2_key IS 'Backblaze B2 key for the file';
COMMENT ON COLUMN operation_files.file_hash IS 'SHA-256 hash for file deduplication';
COMMENT ON COLUMN operation_files.extracted_text_b2_key IS 'Backblaze B2 key for extracted text from OCR/PDF analysis';
COMMENT ON COLUMN operation_files.object_path IS 'Legacy: Path in Replit object storage (for backwards compatibility)';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_gmail_messages_b2_keys ON gmail_messages(body_text_b2_key, body_html_b2_key);
CREATE INDEX IF NOT EXISTS idx_gmail_attachments_b2_key ON gmail_attachments(b2_key);
CREATE INDEX IF NOT EXISTS idx_gmail_attachments_file_hash ON gmail_attachments(file_hash);
CREATE INDEX IF NOT EXISTS idx_operation_files_b2_key ON operation_files(b2_key);
CREATE INDEX IF NOT EXISTS idx_operation_files_file_hash ON operation_files(file_hash);

COMMENT ON INDEX idx_gmail_messages_b2_keys IS 'Index for faster email body retrieval from Backblaze';
COMMENT ON INDEX idx_gmail_attachments_b2_key IS 'Index for faster attachment retrieval from Backblaze';
COMMENT ON INDEX idx_gmail_attachments_file_hash IS 'Index for deduplication queries';
COMMENT ON INDEX idx_operation_files_b2_key IS 'Index for faster file retrieval from Backblaze';
COMMENT ON INDEX idx_operation_files_file_hash IS 'Index for deduplication queries';
