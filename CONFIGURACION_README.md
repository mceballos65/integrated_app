# Sistema de Configuración de la Aplicación

## Cambios Realizados

1. **Archivo de configuración centralizado en el backend**
   - La configuración ahora se guarda en un archivo JSON llamado `app_config.json` en el backend
   - Se creó el módulo `config_handler.py` para manejar todas las operaciones relacionadas con la configuración

2. **Nuevos endpoints en el backend**
   - `/api/config/exists?file=app_config.json` - Verifica si existe el archivo de configuración
   - `/api/config/load?file=app_config.json` - Carga la configuración desde el archivo
   - `/api/config/save?file=app_config.json` - Guarda la configuración completa
   - `/api/config/update?file=app_config.json` - Actualiza parcialmente la configuración existente
   - `/api/config/replace?file=app_config.json` - Reemplaza completamente la configuración existente
   - `/api/config/delete?file=app_config.json` - Elimina el archivo de configuración

3. **Compatibilidad con los endpoints anteriores**
   - `/config` (GET) - Ahora carga desde el archivo de configuración
   - `/config` (POST) - Ahora actualiza el archivo de configuración
   - `/config` (PUT) - Ahora reemplaza el archivo de configuración

4. **Manejo del frontend**
   - Se actualizó `configStorage.js` para usar los nuevos endpoints
   - Solo se usa localStorage como fallback cuando no se puede conectar al backend
   - La URL por defecto para backend y prediction es ahora http://localhost:8000

5. **UserAPI**
   - Se actualizó para obtener la URL del backend dinámicamente
   - Se eliminó la dependencia de valores guardados en localStorage

## Estructura del Archivo de Configuración

```json
{
  "app": {
    "prediction_url": "http://localhost:8000",
    "account_code": "ACM"
  },
  "logging": {
    "file_location": "./logs/predictions.log",
    "max_entries": 50000
  },
  "security": {
    "admin_user_disabled": false,
    "debug_requires_auth": false,
    "admin_username": "",
    "admin_password_hash": ""
  },
  "github": {
    "token": "",
    "repo_url": "",
    "branch": "main"
  }
}
```

## Flujo de Configuración

1. Al iniciar la aplicación, se verifica si existe el archivo `app_config.json` en el backend
2. Si no existe, se muestra la pantalla de configuración inicial
3. Si existe, se carga la configuración desde el archivo y se inicializa la aplicación
4. Si no se puede conectar al backend, se intenta usar la configuración guardada en localStorage como fallback
5. Para reiniciar completamente la configuración, simplemente hay que eliminar el archivo `app_config.json` del backend

## Próximos Pasos

- Asegurarse de que todas las aplicaciones que necesitan acceder a la configuración usen el nuevo sistema
- Realizar pruebas para verificar que la aplicación funcione correctamente cuando:
  - El archivo de configuración no existe
  - El archivo de configuración existe
  - El backend no está disponible
  - Se elimina el archivo de configuración
