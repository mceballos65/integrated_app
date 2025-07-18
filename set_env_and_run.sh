#!/bin/bash
# Script de ejemplo para configurar todas las variables de entorno

# Variables de configuración de Git/GitHub
export DX_EXT_CFG_GIT_REPO="https://github.com/mceballos65/integrated_app_config.git"
export DX_EXT_CFG_GIT_TOKEN="ghp_your_github_token_here"
export DX_EXT_CFG_GIT_USER="mceballos65"
export DX_EXT_CFG_GIT_BRANCH="main"  # Rama a usar para backup/restore

# Variables de configuración de GUI
export DX_EXT_GUI_USER="admin"
export DX_EXT_GUI_PASSWORD="your_secure_password_here"

# Código de cuenta
export DX_ENV_OU_GSMA_CODE="ABC"

# Información sobre las variables:
echo "Variables de entorno configuradas:"
echo "- DX_EXT_CFG_GIT_REPO: Repositorio de GitHub para backup y restore"
echo "- DX_EXT_CFG_GIT_TOKEN: Token de GitHub para autenticación" 
echo "- DX_EXT_CFG_GIT_USER: Usuario de GitHub"
echo "- DX_EXT_CFG_GIT_BRANCH: Rama de Git a usar (default: main)"
echo "- DX_EXT_GUI_USER: Usuario de la interfaz gráfica"
echo "- DX_EXT_GUI_PASSWORD: Password del usuario de la interfaz"
echo "- DX_ENV_OU_GSMA_CODE: Código de tres letras de la cuenta"

# Ejecutar la aplicación
python -m uvicorn main_advanced:app --reload --host 0.0.0.0 --port 8000
