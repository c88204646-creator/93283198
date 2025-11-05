-- ================================================
-- CONSULTAS DE MONITOREO Y OPTIMIZACIÓN NEONDB
-- ================================================

-- 1. VER TAMAÑO DE CADA TABLA
-- Útil para identificar tablas grandes que necesitan optimización
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY size_bytes DESC;

-- 2. VER CONEXIONES ACTIVAS
-- Monitorea cuántas conexiones están usando recursos
SELECT 
    count(*) as total_connections,
    state,
    application_name
FROM pg_stat_activity
GROUP BY state, application_name
ORDER BY total_connections DESC;

-- 3. IDENTIFICAR TABLAS SIN ÍNDICES UTILIZADOS
-- Encuentra tablas que podrían necesitar índices
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    AND n_distinct > 100  -- Columnas con muchos valores distintos
ORDER BY n_distinct DESC;

-- 4. VER USO DE ÍNDICES EXISTENTES
-- Identifica índices que no se están usando (candidatos para eliminar)
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- 5. ÍNDICES RECOMENDADOS PARA ESTE PROYECTO
-- Ejecuta estos para mejorar el rendimiento:

-- Índices para operations (tabla principal)
CREATE INDEX IF NOT EXISTS idx_operations_client_id ON operations(client_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
CREATE INDEX IF NOT EXISTS idx_operations_start_date ON operations(start_date);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at DESC);

-- Índices para invoices
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_operation_id ON invoices(operation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- Índices para gmail_messages (si tienes muchos emails)
CREATE INDEX IF NOT EXISTS idx_gmail_messages_account_id ON gmail_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_received_at ON gmail_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_subject ON gmail_messages USING gin(to_tsvector('english', subject));

-- Índices para calendar_events
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_gmail_account ON calendar_events(gmail_account_id);

-- Índices para proposals
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- Índices para expenses
CREATE INDEX IF NOT EXISTS idx_expenses_operation_id ON expenses(operation_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);

-- 6. VACUUM Y ANALYZE (Mantener la base optimizada)
-- Ejecuta periódicamente para recuperar espacio
VACUUM ANALYZE;

-- 7. VER ESTADÍSTICAS DE CACHE (requiere extensión neon)
-- Ayuda a entender si necesitas más memoria
CREATE EXTENSION IF NOT EXISTS neon;
SELECT * FROM neon_stat_file_cache;

-- 8. IDENTIFICAR CONSULTAS LENTAS
-- Necesitas habilitar pg_stat_statements primero
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT 
    query,
    calls,
    total_exec_time / 1000 as total_time_seconds,
    mean_exec_time / 1000 as avg_time_seconds,
    (total_exec_time / sum(total_exec_time) OVER ()) * 100 as percent_of_total
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- 9. VER BLOQUEOS Y TRANSACCIONES LARGAS
-- Identifica queries que están bloqueando recursos
SELECT 
    pid,
    usename,
    application_name,
    state,
    query_start,
    state_change,
    query
FROM pg_stat_activity
WHERE state != 'idle'
    AND query_start < now() - interval '30 seconds'
ORDER BY query_start;

-- 10. LIMPIAR SESIONES (tabla session si existe)
-- Para reducir tamaño de tabla de sesiones
DELETE FROM session 
WHERE expire < extract(epoch from now()) * 1000;
