# Variables de Entorno para Configuración Automática

Este documento describe las variables de entorno que se pueden usar para configurar automáticamente la aplicación al iniciarse.

## Variables de Configuración de Git/GitHub

### DX_EXT_CFG_GIT_REPO
- **Descripción**: Repositorio de GitHub que se usará para backup y restore de archivos de configuración
- **Formato**: URL completa del repositorio o formato `owner/repo`
- **Ejemplo**: `https://github.com/mceballos65/integrated_app_config.git` o `mceballos65/integrated_app_config`
- **Requerido**: Sí (para funcionalidad de GitHub)

### DX_EXT_CFG_GIT_TOKEN
- **Descripción**: Token de acceso personal de GitHub para autenticación
- **Formato**: Token de GitHub (empieza con `ghp_`)
- **Ejemplo**: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Requerido**: Sí (para funcionalidad de GitHub)
- **Seguridad**: Se almacena de forma cifrada

### DX_EXT_CFG_GIT_USER
- **Descripción**: Nombre de usuario de GitHub
- **Formato**: Nombre de usuario sin el símbolo @
- **Ejemplo**: `mceballos65`
- **Requerido**: Sí (para funcionalidad de GitHub)

### DX_EXT_CFG_GIT_BRANCH
- **Descripción**: Nombre de la rama de Git a usar para push/pull
- **Formato**: Nombre de la rama
- **Ejemplo**: `main`, `develop`, `config-branch`
- **Default**: `main` (si no se especifica)
- **Requerido**: No

## Variables de Configuración de Interfaz Gráfica

### DX_EXT_GUI_USER
- **Descripción**: Nombre de usuario para la interfaz gráfica de la aplicación
- **Formato**: Nombre de usuario alfanumérico
- **Ejemplo**: `admin`, `operator`, `user123`
- **Requerido**: Sí (para auto-configurar usuario)

### DX_EXT_GUI_PASSWORD
- **Descripción**: Contraseña para el usuario de la interfaz gráfica
- **Formato**: Contraseña segura
- **Ejemplo**: `MiContraseñaSegura123!`
- **Requerido**: Sí (para auto-configurar usuario)
- **Seguridad**: Se almacena hasheada

## Variables de Configuración de Aplicación

### DX_ENV_OU_GSMA_CODE
- **Descripción**: Código de tres letras que identifica la cuenta/organización
- **Formato**: Código de 3 caracteres alfanuméricos
- **Ejemplo**: `ABC`, `XYZ`, `001`
- **Requerido**: No

## Comportamiento de la Aplicación

### Configuración Automática
Cuando la aplicación se inicia, verifica automáticamente si estas variables de entorno están configuradas:

1. **Si se encuentran variables válidas**: La aplicación se configura automáticamente usando estos valores
2. **Si faltan variables esenciales**: La aplicación mostrará el wizard de configuración
3. **Si hay errores**: Se muestra un mensaje de advertencia pero la aplicación continúa

### Orden de Prioridad
1. Variables de entorno (mayor prioridad)
2. Archivo de configuración existente
3. Configuración por defecto/wizard (menor prioridad)

### Endpoints de API
- `GET /api/config/wizard-required`: Verifica si se necesita el wizard
- `POST /api/config/reload-environment`: Fuerza la recarga de variables de entorno

## Ejemplos de Uso

### Linux/macOS (Bash)
```bash
export DX_EXT_CFG_GIT_REPO="https://github.com/usuario/repo.git"
export DX_EXT_CFG_GIT_TOKEN="ghp_token_aqui"
export DX_EXT_CFG_GIT_USER="usuario"
export DX_EXT_CFG_GIT_BRANCH="main"
export DX_EXT_GUI_USER="admin"
export DX_EXT_GUI_PASSWORD="contraseña_segura"
export DX_ENV_OU_GSMA_CODE="ABC"

python -m uvicorn main_advanced:app --reload --host 0.0.0.0 --port 8000
```

### Windows (PowerShell)
```powershell
$env:DX_EXT_CFG_GIT_REPO = "https://github.com/usuario/repo.git"
$env:DX_EXT_CFG_GIT_TOKEN = "ghp_token_aqui"
$env:DX_EXT_CFG_GIT_USER = "usuario"
$env:DX_EXT_CFG_GIT_BRANCH = "main"
$env:DX_EXT_GUI_USER = "admin"
$env:DX_EXT_GUI_PASSWORD = "contraseña_segura"
$env:DX_ENV_OU_GSMA_CODE = "ABC"

python -m uvicorn main_advanced:app --reload --host 0.0.0.0 --port 8000
```

### Docker
```dockerfile
ENV DX_EXT_CFG_GIT_REPO="https://github.com/usuario/repo.git"
ENV DX_EXT_CFG_GIT_TOKEN="ghp_token_aqui"
ENV DX_EXT_CFG_GIT_USER="usuario"
ENV DX_EXT_CFG_GIT_BRANCH="main"
ENV DX_EXT_GUI_USER="admin"
ENV DX_EXT_GUI_PASSWORD="contraseña_segura"
ENV DX_ENV_OU_GSMA_CODE="ABC"
```

## Scripts Incluidos

- `set_env_and_run.sh`: Script de Bash para configurar variables y ejecutar la aplicación
- `set_env_and_run.ps1`: Script de PowerShell para Windows
- `test_env_config.py`: Script de prueba para validar la configuración
