# Configuración de Backblaze B2 para Almacenamiento de Correos

Este sistema utiliza Backblaze B2 para almacenar de forma eficiente:
- Cuerpos de correos electrónicos (texto y HTML)
- Archivos adjuntos de correos
- Texto extraído de PDFs e imágenes

## Beneficios

✅ **Deduplicación automática**: Los archivos duplicados no se almacenan dos veces  
✅ **Almacenamiento económico**: Backblaze es significativamente más barato que otras soluciones  
✅ **Escalable**: Maneja grandes volúmenes de correos y archivos  
✅ **Fallback automático**: Si Backblaze no está configurado, usa la base de datos

## Configuración

### 1. Crear una cuenta en Backblaze B2

1. Visita https://www.backblaze.com/b2/sign-up.html
2. Crea una cuenta (tienen plan gratuito con 10GB)

### 2. Crear un Bucket

1. En el panel de Backblaze, ve a **B2 Cloud Storage > Buckets**
2. Haz clic en **Create a Bucket**
3. Configuración recomendada:
   - **Bucket Name**: `workspace-emails` (o el nombre que prefieras)
   - **Files in Bucket**: Private
   - **Default Encryption**: Disable (o Enable si prefieres)
   - **Object Lock**: Disabled

4. Anota el **Bucket ID** (lo necesitarás)

### 3. Crear Application Key

1. Ve a **App Keys** en el panel de Backblaze
2. Haz clic en **Add a New Application Key**
3. Configuración:
   - **Name**: `workspace-app` (o cualquier nombre descriptivo)
   - **Allow access to Bucket(s)**: Selecciona tu bucket
   - **Type of Access**: Read and Write
   - **Allow List All Bucket Names**: ✓
   - **File name prefix**: (dejar vacío)
   - **Duration**: (dejar vacío para que no expire)

4. **IMPORTANTE**: Guarda inmediatamente:
   - **applicationKeyId** (se muestra siempre)
   - **applicationKey** (se muestra SOLO UNA VEZ)

### 4. Obtener el Endpoint

El endpoint de Backblaze tiene el formato:
```
s3.REGION.backblazeb2.com
```

Donde REGION es tu región, por ejemplo:
- `us-west-004`
- `us-east-005`
- `eu-central-003`

Para encontrar tu región:
1. Ve a tu bucket en Backblaze
2. En la información del bucket, busca **Endpoint**
3. El endpoint se verá como: `s3.us-west-004.backblazeb2.com`

### 5. Configurar en Replit

En los **Secrets** de tu Replit, agrega:

```
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_APPLICATION_KEY_ID=tu_application_key_id_aqui
B2_APPLICATION_KEY=tu_application_key_aqui
B2_BUCKET_ID=tu_bucket_name_aqui
```

**Notas importantes:**
- ✅ Puedes poner el endpoint con o sin `https://` (el sistema lo agrega automáticamente)
- ✅ El `B2_BUCKET_ID` es el **nombre del bucket**, no el ID numérico
- ❌ NO compartas tu `B2_APPLICATION_KEY` con nadie

### 6. Ejemplo Completo

```env
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_APPLICATION_KEY_ID=004abc123def456789
B2_APPLICATION_KEY=K004XYZ987654321abcdefghijklmnopqrstuvw
B2_BUCKET_ID=workspace-emails
```

## Verificación

Una vez configurado, reinicia la aplicación. En los logs deberías ver:

```
B2_ENDPOINT corregido a: https://s3.us-west-004.backblazeb2.com
Backblaze B2 configurado: Region=us-west-004, Bucket=workspace-emails
```

Si Backblaze está configurado correctamente, verás mensajes como:
```
Stored email body in Backblaze: 19a564ad5c16c552
Stored new attachment documento.pdf in Backblaze
```

Si hay algún error, verás:
```
Error storing email body in Backblaze for 123abc: [error details]
```

## Estructura de Archivos en B2

Los archivos se organizan así:

```
emails/
├── bodies/
│   ├── text/
│   │   └── sha256_hash_del_contenido
│   └── html/
│       └── sha256_hash_del_contenido
└── attachments/
    ├── sha256_hash_del_archivo  (archivos deduplicados)
    └── extracted-text/
        └── sha256_hash_del_texto_extraido
```

## Costos Estimados

Backblaze B2 Pricing (2024):
- **Almacenamiento**: $0.005 por GB/mes ($5 por TB/mes)
- **Descarga**: $0.01 por GB (primer GB gratis por día)
- **Uploads**: GRATIS
- **API Calls**: Primeras 2,500 al día GRATIS

**Ejemplo**: Para 100,000 correos con archivos (aproximadamente 50GB):
- Costo mensual: ~$0.25 USD

## Troubleshooting

### Error: "Invalid URL"

**Causa**: El endpoint no tiene el formato correcto  
**Solución**: Asegúrate de que el endpoint sea exactamente: `s3.REGION.backblazeb2.com`

### Error: "Access Denied"

**Causa**: Las credenciales son incorrectas  
**Solución**: Verifica que el `applicationKey` y `applicationKeyId` sean correctos

### Los archivos no se suben

**Causa**: Permisos insuficientes en la Application Key  
**Solución**: Asegúrate de que la Application Key tenga permisos de **Read and Write**

## Fallback sin Backblaze

Si NO configuras Backblaze:
- ⚠️ Los correos y archivos se guardarán en la base de datos PostgreSQL
- ⚠️ Esto puede llenar rápidamente la base de datos
- ⚠️ No hay deduplicación de archivos duplicados
- ⚠️ El rendimiento puede degradarse con muchos correos

**Recomendación**: Configura Backblaze para producción.
