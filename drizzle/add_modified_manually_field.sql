-- Add modifiedManually field to operation_tasks table
ALTER TABLE operation_tasks 
ADD COLUMN IF NOT EXISTS modified_manually BOOLEAN NOT NULL DEFAULT false;

-- Update comment for status field to reflect new states
COMMENT ON COLUMN operation_tasks.status IS 'pending, in-progress, pending-approval, completed, cancelled';
