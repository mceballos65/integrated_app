"""
Módulo para manejar la configuración de la aplicación
Guarda y carga la configuración desde un archivo JSON
"""

import json
import os
from typing import Dict, Any, Optional

# Nombre del archivo de configuración por defecto
DEFAULT_CONFIG_FILENAME = "app_data/config/app_config.json"

# Configuración por defecto
DEFAULT_CONFIG = {
    "app": {
        "prediction_url": "/api",
        "account_code": ""
    },
    "logging": {
        "file_location": "./app_data/logs/predictions.log",
        "max_entries": 50000
    },
    "security": {
        "admin_username": "",
        "admin_password_hash": ""
    },
    "github": {
        "token": "",
        "repo_url": "",
        "branch": "main"
    },
    # Registro de configuraciones que han sido editadas
    "edited_configs": {
        "backend": False,
        "app": False,
        "security": False,
        "github": False,
        "logging": False,
        "user_management": False
    }
}

def ensure_directories():
    """Ensure that required directories exist"""
    os.makedirs("./app_data/config", exist_ok=True)
    os.makedirs("./app_data/logs", exist_ok=True)

def get_config_path(filename: str) -> str:
    """Obtiene la ruta absoluta al archivo de configuración"""
    # Si ya es una ruta absoluta, úsala tal como está
    if os.path.isabs(filename):
        return filename
    
    # Si es una ruta relativa, hacer que sea relativa al directorio del script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(script_dir, filename)

def config_exists(filename: str) -> bool:
    """Verifica si el archivo de configuración existe"""
    config_path = get_config_path(filename)
    return os.path.exists(config_path)

def load_config(filename: str) -> Dict[str, Any]:
    """Carga la configuración desde un archivo JSON"""
    # Ensure directories exist
    ensure_directories()
    
    config_path = get_config_path(filename)
    if not config_exists(filename):
        return DEFAULT_CONFIG
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        return config
    except Exception as e:
        print(f"Error loading config from {filename}: {str(e)}")
        return DEFAULT_CONFIG

def sanitize_config_for_storage(config: Dict[str, Any]) -> Dict[str, Any]:
    """Remove GitHub tokens from config before storage to prevent plaintext storage"""
    import copy
    sanitized_config = copy.deepcopy(config)
    
    # Remove any GitHub tokens to prevent plaintext storage
    if "github" in sanitized_config:
        # Remove any token fields that might exist
        sanitized_config["github"].pop("githubToken", None)
        sanitized_config["github"].pop("token", None)
        # Keep empty string for backward compatibility
        if "token" not in sanitized_config["github"]:
            sanitized_config["github"]["token"] = ""
    
    return sanitized_config

def save_config(config: Dict[str, Any], filename: str) -> Dict[str, Any]:
    """Guarda la configuración en un archivo JSON"""
    # Ensure directories exist
    ensure_directories()
    
    # Sanitize config to remove any tokens before storage
    sanitized_config = sanitize_config_for_storage(config)
    
    config_path = get_config_path(filename)
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(sanitized_config, f, indent=2)
        return sanitized_config
    except Exception as e:
        print(f"Error saving config to {filename}: {str(e)}")
        raise e

def update_config(config_update: Dict[str, Any], filename: str) -> Dict[str, Any]:
    """Actualiza parcialmente la configuración existente"""
    # Cargar configuración actual
    current_config = load_config(filename)
    
    # Función recursiva para actualizar diccionarios anidados
    def deep_update(source, updates):
        for key, value in updates.items():
            if isinstance(value, dict) and key in source and isinstance(source[key], dict):
                source[key] = deep_update(source[key], value)
            else:
                source[key] = value
        return source
    
    # Aplicar la actualización
    updated_config = deep_update(current_config, config_update)
    
    # Guardar la configuración actualizada
    return save_config(updated_config, filename)

def delete_config(filename: str) -> bool:
    """Elimina el archivo de configuración si existe"""
    config_path = get_config_path(filename)
    if os.path.exists(config_path):
        try:
            os.remove(config_path)
            return True
        except Exception as e:
            print(f"Error deleting config file {filename}: {str(e)}")
            return False
    return True  # Si no existe, consideramos que la operación fue exitosa
