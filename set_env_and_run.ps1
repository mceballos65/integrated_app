# Script de PowerShell para configurar variables de entorno y ejecutar la aplicación

# Variables de configuración de Git/GitHub
$env:DX_EXT_CFG_GIT_REPO = "https://github.com/mceballos65/integrated_app_config.git"
$env:DX_EXT_CFG_GIT_TOKEN = "ghp_your_github_token_here"
$env:DX_EXT_CFG_GIT_USER = "mceballos65"
$env:DX_EXT_CFG_GIT_BRANCH = "main"  # Rama a usar para backup/restore

# Variables de configuración de GUI
$env:DX_EXT_GUI_USER = "admin"
$env:DX_EXT_GUI_PASSWORD = "your_secure_password_here"

# Código de cuenta
$env:DX_ENV_OU_GSMA_CODE = "ABC"

# Información sobre las variables
Write-Host "Variables de entorno configuradas:" -ForegroundColor Green
Write-Host "- DX_EXT_CFG_GIT_REPO: Repositorio de GitHub para backup y restore" -ForegroundColor Yellow
Write-Host "- DX_EXT_CFG_GIT_TOKEN: Token de GitHub para autenticación" -ForegroundColor Yellow
Write-Host "- DX_EXT_CFG_GIT_USER: Usuario de GitHub" -ForegroundColor Yellow
Write-Host "- DX_EXT_CFG_GIT_BRANCH: Rama de Git a usar (default: main)" -ForegroundColor Yellow
Write-Host "- DX_EXT_GUI_USER: Usuario de la interfaz gráfica" -ForegroundColor Yellow
Write-Host "- DX_EXT_GUI_PASSWORD: Password del usuario de la interfaz" -ForegroundColor Yellow
Write-Host "- DX_ENV_OU_GSMA_CODE: Código de tres letras de la cuenta" -ForegroundColor Yellow

# Verificar que las variables estén configuradas
Write-Host "`nVerificación de variables:" -ForegroundColor Cyan
$variables = @(
    "DX_EXT_CFG_GIT_REPO",
    "DX_EXT_CFG_GIT_TOKEN", 
    "DX_EXT_CFG_GIT_USER",
    "DX_EXT_CFG_GIT_BRANCH",
    "DX_EXT_GUI_USER",
    "DX_EXT_GUI_PASSWORD",
    "DX_ENV_OU_GSMA_CODE"
)

foreach ($var in $variables) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ($value) {
        if ($var -like "*TOKEN*" -or $var -like "*PASSWORD*") {
            Write-Host "✓ ${var}: ***SET***" -ForegroundColor Green
        } else {
            Write-Host "✓ ${var}: $value" -ForegroundColor Green
        }
    } else {
        Write-Host "✗ ${var}: NOT SET" -ForegroundColor Red
    }
}

Write-Host "`nEjecutando la aplicación..." -ForegroundColor Cyan

# Ejecutar la aplicación
python -m uvicorn main_advanced:app --reload --host 0.0.0.0 --port 8000
