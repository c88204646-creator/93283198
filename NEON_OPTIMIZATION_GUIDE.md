# Guía de Optimización NeonDB

Este documento explica las optimizaciones implementadas para reducir costos de NeonDB.

## 🎯 Optimizaciones Implementadas

### 1. Connection Pooling Optimizado
**Ubicación**: `server/db.ts`

```typescript
// Configuración optimizada del pool
max: 10, // Límite de 10 conexiones máximas (reducido de 20)
idleTimeoutMillis: 10000, // Cierra conexiones inactivas después de 10s
connectionTimeoutMillis: 10000 // Timeout de conexión
```

**Beneficios**:
- Reduce el número de conexiones simultáneas
- Cierra conexiones inactivas rápidamente
- Menor uso de recursos de compute

### 2. Caché de Consultas
**Ubicación**: `server/cache.ts`

Sistema de caché en memoria para reducir consultas repetitivas:
- TTL predeterminado: 5 minutos
- Invalidación por patrón
- Auto-limpieza automática

**Uso recomendado**:
```typescript
import { queryCache } from './cache';

// Obtener con caché
const cacheKey = 'all_clients';
let clients = queryCache.get<Client[]>(cacheKey);

if (!clients) {
  clients = await db.select().from(clientsTable);
  queryCache.set(cacheKey, clients);
}
```

### 3. Graceful Shutdown
**Ubicación**: `server/db.ts`

Cierre ordenado de conexiones al detener el servidor:
- Evita conexiones huérfanas
- Reduce facturación por conexiones abiertas

## 💰 Configuraciones Recomendadas en Neon Dashboard

### A. Autoscaling (Crucial)
```
Min CU: 0.25
Max CU: 2-4 (dependiendo del tráfico)
```
**Ahorro**: ~40-60% en costos de compute

### B. Scale-to-Zero
```
Suspend compute after: 5 minutes
```
**Ahorro**: No pagas cuando no hay actividad

### C. Point-in-Time Restore (PITR)
```
Restore window: 1-3 días (en lugar de 7 o 30)
```
**Ahorro**: ~$0.15-0.20/GB-month

### D. Branches
- Elimina branches de desarrollo después de usar
- Usa root branch para producción
- Configura auto-delete para preview branches

## 📊 Optimizaciones Adicionales Recomendadas

### 1. Usar Conexión Pooled
Asegúrate de que tu `DATABASE_URL` use el sufijo `-pooler`:

```
postgresql://user:pass@ep-xxx-pooler.aws.neon.tech/db
```

**Cómo obtenerla**:
1. Ve a tu proyecto en Neon Dashboard
2. Connection Details > Pooled connection
3. Copia la URL con `-pooler`

### 2. Índices en la Base de Datos
Ejecuta estas consultas para identificar tablas que necesitan índices:

```sql
-- Ver consultas lentas
SELECT query, calls, total_exec_time 
FROM pg_stat_statements 
ORDER BY total_exec_time DESC LIMIT 10;

-- Verificar uso de índices
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### 3. Monitoreo de Uso
Revisa semanalmente:
- Dashboard de Neon > Usage
- Emails semanales de uso
- Métricas de conexiones activas

## 🚀 Próximos Pasos Sugeridos

1. **Implementar caché en rutas frecuentes**:
   - Lista de clientes
   - Lista de empleados
   - Configuraciones de automatización

2. **Agregar índices necesarios**:
   ```sql
   CREATE INDEX idx_operations_client ON operations(client_id);
   CREATE INDEX idx_operations_status ON operations(status);
   CREATE INDEX idx_invoices_client ON invoices(client_id);
   ```

3. **Considerar Read Replicas** (si tienes muchas lecturas):
   - Configurar en Neon Dashboard
   - Separar queries de lectura vs escritura

## 📈 Estimación de Ahorro

Con estas optimizaciones:
- **Connection pooling**: 20-30% reducción en uso de compute
- **Caché**: 30-50% reducción en queries
- **Scale-to-zero**: 40-60% en horas sin uso
- **PITR reducido**: ~$0.15/GB-month

**Ahorro total estimado**: 40-70% en costos mensuales de NeonDB

## 🔍 Monitoreo

Para verificar el impacto:
```typescript
// Ver estadísticas de caché
import { queryCache } from './cache';
console.log(queryCache.getStats());

// Monitorear conexiones del pool
console.log({
  total: pool.totalCount,
  idle: pool.idleCount,
  waiting: pool.waitingCount
});
```

## ⚠️ Importante

- La caché está en memoria, se pierde al reiniciar
- Para caché persistente, considera Redis (pero evalúa el costo adicional)
- Monitorea el uso real antes de hacer ajustes drásticos
