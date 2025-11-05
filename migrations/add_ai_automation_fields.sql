-- Migración para agregar campos de automatización AI a tasks y notes
-- Fecha: 2025-11-05

-- Agregar campos a operation_notes para AI automation
ALTER TABLE operation_notes 
ADD COLUMN IF NOT EXISTS created_automatically BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS source_gmail_message_id VARCHAR REFERENCES gmail_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_email_thread_id TEXT,
ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- Agregar campos a operation_tasks para AI automation
ALTER TABLE operation_tasks
ADD COLUMN IF NOT EXISTS created_automatically BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS source_gmail_message_id VARCHAR REFERENCES gmail_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_email_thread_id TEXT,
ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS ai_model TEXT,
ADD COLUMN IF NOT EXISTS ai_suggestion TEXT;

-- Agregar campos a automation_configs para tasks y notes automáticas
ALTER TABLE automation_configs
ADD COLUMN IF NOT EXISTS auto_create_tasks TEXT DEFAULT 'disabled',
ADD COLUMN IF NOT EXISTS auto_create_notes TEXT DEFAULT 'disabled',
ADD COLUMN IF NOT EXISTS ai_optimization_level TEXT DEFAULT 'high';

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_operation_notes_created_automatically ON operation_notes(created_automatically);
CREATE INDEX IF NOT EXISTS idx_operation_notes_source_gmail ON operation_notes(source_gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_operation_notes_thread ON operation_notes(source_email_thread_id);

CREATE INDEX IF NOT EXISTS idx_operation_tasks_created_automatically ON operation_tasks(created_automatically);
CREATE INDEX IF NOT EXISTS idx_operation_tasks_source_gmail ON operation_tasks(source_gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_operation_tasks_thread ON operation_tasks(source_email_thread_id);
CREATE INDEX IF NOT EXISTS idx_operation_tasks_status ON operation_tasks(status);

COMMENT ON COLUMN operation_notes.created_automatically IS 'Indica si la nota fue creada automáticamente por AI';
COMMENT ON COLUMN operation_notes.ai_confidence IS 'Nivel de confianza de la AI (0-100)';
COMMENT ON COLUMN operation_tasks.created_automatically IS 'Indica si la tarea fue creada automáticamente por AI';
COMMENT ON COLUMN operation_tasks.ai_confidence IS 'Nivel de confianza de la AI (0-100)';
COMMENT ON COLUMN automation_configs.auto_create_tasks IS 'Modo de creación automática de tareas: disabled, basic, smart_ai';
COMMENT ON COLUMN automation_configs.auto_create_notes IS 'Modo de creación automática de notas: disabled, basic, smart_ai';
COMMENT ON COLUMN automation_configs.ai_optimization_level IS 'Nivel de optimización de AI: high (80% reducción), medium (50%), low (20%)';
