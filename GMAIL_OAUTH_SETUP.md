# Configuración de Google OAuth para Gmail

## URLs que debes configurar en Google Cloud Console

### 1. Accede a Google Cloud Console
- Ve a: https://console.cloud.google.com/
- Selecciona tu proyecto o crea uno nuevo

### 2. Habilita las APIs necesarias
- Gmail API
- Google+ API (para obtener información del usuario)

### 3. Configura la pantalla de consentimiento OAuth
- Ve a "APIs y servicios" > "Pantalla de consentimiento de OAuth"
- Tipo de usuario: Externo (o Interno si es para tu organización)
- Completa la información requerida
- Agrega los scopes:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/userinfo.email`

### 4. Crea las credenciales OAuth 2.0
- Ve a "APIs y servicios" > "Credenciales"
- Haz clic en "Crear credenciales" > "ID de cliente de OAuth 2.0"
- Tipo de aplicación: "Aplicación web"

### 5. Configura las URLs autorizadas

**Orígenes de JavaScript autorizados:**
```
https://workspace.83a571b0-d081-4ff7-a5b3-042fe980ca21-00-72xj66t1j9ct.worf.replit.dev
```

**URIs de redireccionamiento autorizados:**
```
https://workspace.83a571b0-d081-4ff7-a5b3-042fe980ca21-00-72xj66t1j9ct.worf.replit.dev/api/gmail/oauth/callback
```

### 6. Secrets de Replit

**IMPORTANTE**: Asegúrate de que estos secrets estén configurados EXACTAMENTE como se indica:

- `GOOGLE_CLIENT_ID`: El ID de cliente que obtienes de Google Cloud Console
- `GOOGLE_CLIENT_SECRET`: El secreto de cliente de Google Cloud Console
- `GOOGLE_REDIRECT_URI`: **DEBE SER LA URL COMPLETA (no solo el path)**:
  ```
  https://workspace.83a571b0-d081-4ff7-a5b3-042fe980ca21-00-72xj66t1j9ct.worf.replit.dev/api/gmail/oauth/callback
  ```

**❌ INCORRECTO:**
- `/api/gmail/oauth/callback`
- `/api/google-auth/callback`

**✅ CORRECTO:**
- `https://workspace.83a571b0-d081-4ff7-a5b3-042fe980ca21-00-72xj66t1j9ct.worf.replit.dev/api/gmail/oauth/callback`

### 7. Notas importantes

1. **Dominios verificados**: Si tu aplicación está en modo "En producción", necesitarás verificar el dominio de Replit o mantener la app en modo "Testing"
2. **Usuarios de prueba**: Si está en modo "Testing", solo los usuarios que agregues como "Test users" podrán autenticarse
3. **Límites de cuota**: La API de Gmail tiene límites de cuota. Monitorea el uso en Google Cloud Console

### 8. Flujo de autenticación

1. El usuario hace clic en "Conectar Gmail" en la aplicación
2. Se abre una ventana emergente con la autorización de Google
3. El usuario autoriza el acceso a Gmail
4. Google redirige a `/api/gmail/oauth/callback`
5. La aplicación guarda los tokens y comienza la sincronización automática

### 9. Rangos de sincronización disponibles

- Último mes (1 mes)
- Últimos 2 meses
- Últimos 3 meses
- Últimos 6 meses
- Último año (12 meses)
- Últimos 2 años (24 meses)

### 10. Permisos solicitados

La aplicación solicita acceso de **solo lectura** a:
- Mensajes de Gmail (lectura)
- Información básica del perfil (email)

**NO** se solicitan permisos para:
- Enviar correos
- Modificar correos
- Eliminar correos
- Acceder a otros servicios de Google

## Troubleshooting

### Error: redirect_uri_mismatch
- Verifica que la URL de redirección en Google Cloud Console sea EXACTAMENTE: `https://workspace.83a571b0-d081-4ff7-a5b3-042fe980ca21-00-72xj66t1j9ct.worf.replit.dev/api/gmail/oauth/callback`
- No debe tener espacios ni caracteres extra

### Error: access_denied
- Asegúrate de que el usuario esté en la lista de "Test users" si la app está en modo Testing
- Verifica que las APIs estén habilitadas

### No se recibe el refresh_token
- Asegúrate de que `prompt: 'consent'` esté configurado en la solicitud OAuth
- Revoca el acceso previo desde tu cuenta de Google y vuelve a autorizar

### La sincronización no funciona
- Verifica los logs del servidor para ver errores específicos
- Asegúrate de que los tokens no hayan expirado
- Verifica que los límites de cuota de la API no se hayan alcanzado
