#!/usr/bin/env python3
"""
Script de prueba para verificar que el sistema de tokens funciona correctamente
"""

import json
import os
import sys
import requests

# Add the current directory to Python path to import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from user_encryption import save_github_token, get_github_token, delete_github_token, github_token_exists
import config_handler

def test_token_security():
    """Test that tokens are handled securely"""
    print("=== Test de Seguridad de Tokens ===\n")
    
    # Test 1: Save a test token
    print("1. Guardando token de prueba...")
    test_token = "ghp_test_token_12345678901234567890123456"
    success = save_github_token(test_token)
    
    if success:
        print("   ✓ Token guardado exitosamente")
    else:
        print("   ✗ Error guardando token")
        return False
    
    # Test 2: Verify token exists
    print("2. Verificando que el token existe...")
    exists = github_token_exists()
    if exists:
        print("   ✓ Token existe en storage seguro")
    else:
        print("   ✗ Token no encontrado")
        return False
    
    # Test 3: Retrieve token
    print("3. Recuperando token...")
    retrieved_token = get_github_token()
    if retrieved_token == test_token:
        print("   ✓ Token recuperado correctamente")
    else:
        print(f"   ✗ Token no coincide. Esperado: {test_token}, Obtenido: {retrieved_token}")
        return False
    
    # Test 4: Check that app_config.json doesn't contain the token
    print("4. Verificando que app_config.json está limpio...")
    config_path = "./app_data/config/app_config.json"
    
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config_content = f.read()
        
        if test_token in config_content:
            print("   ✗ ¡PELIGRO! Token encontrado en app_config.json")
            return False
        else:
            print("   ✓ app_config.json está limpio (no contiene tokens)")
    else:
        print("   ⚠ app_config.json no existe")
    
    # Test 5: Test config_handler sanitization
    print("5. Probando sanitización del config_handler...")
    test_config = {
        "app": {"prediction_url": "http://localhost:8000"},
        "github": {
            "githubToken": test_token,
            "githubUsername": "testuser",
            "repositoryUrl": "https://github.com/test/repo.git"
        }
    }
    
    saved_config = config_handler.save_config(test_config, config_handler.DEFAULT_CONFIG_FILENAME)
    
    # Reload and check that token is not there
    loaded_config = config_handler.load_config(config_handler.DEFAULT_CONFIG_FILENAME)
    
    if "githubToken" in loaded_config.get("github", {}):
        if loaded_config["github"]["githubToken"] == test_token:
            print("   ✗ ¡PELIGRO! Token en plaintext en archivo guardado")
            return False
        else:
            print("   ⚠ Campo githubToken existe pero no es el token original")
    else:
        print("   ✓ config_handler sanitiza correctamente (no hay githubToken en archivo)")
    
    # Test 6: Clean up
    print("6. Limpiando token de prueba...")
    delete_success = delete_github_token()
    if delete_success:
        print("   ✓ Token eliminado exitosamente")
    else:
        print("   ✗ Error eliminando token")
    
    return True

def test_api_endpoints():
    """Test that API endpoints work correctly (requires backend running)"""
    print("\n=== Test de Endpoints API ===\n")
    
    backend_url = "http://localhost:8000"
    test_token = "ghp_api_test_12345678901234567890123456"
    
    try:
        # Test token save endpoint
        print("1. Probando POST /config/github/token...")
        response = requests.post(f"{backend_url}/config/github/token", 
                               json={"token": test_token})
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("hasToken"):
                print("   ✓ Token guardado via API exitosamente")
            else:
                print(f"   ✗ Respuesta inesperada: {data}")
                return False
        else:
            print(f"   ✗ Error HTTP {response.status_code}: {response.text}")
            return False
        
        # Test token exists endpoint
        print("2. Probando GET /config/github/token/exists...")
        response = requests.get(f"{backend_url}/config/github/token/exists")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("hasToken"):
                print("   ✓ Endpoint de verificación funciona")
            else:
                print(f"   ✗ Token no detectado: {data}")
                return False
        else:
            print(f"   ✗ Error HTTP {response.status_code}: {response.text}")
            return False
        
        # Test config load endpoint (should include hasToken)
        print("3. Probando GET /api/config/load...")
        response = requests.get(f"{backend_url}/api/config/load")
        
        if response.status_code == 200:
            data = response.json()
            config = data.get("config", {})
            github_config = config.get("github", {})
            
            if github_config.get("hasToken"):
                print("   ✓ Config load incluye hasToken=true")
            else:
                print(f"   ✗ hasToken no encontrado en respuesta: {github_config}")
                return False
            
            if "githubToken" in github_config:
                print("   ✗ ¡PELIGRO! githubToken presente en respuesta de config")
                return False
            else:
                print("   ✓ githubToken no presente en respuesta")
        else:
            print(f"   ✗ Error HTTP {response.status_code}: {response.text}")
            return False
        
        # Test token delete endpoint
        print("4. Probando DELETE /config/github/token...")
        response = requests.delete(f"{backend_url}/config/github/token")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and not data.get("hasToken"):
                print("   ✓ Token eliminado via API exitosamente")
            else:
                print(f"   ✗ Respuesta inesperada: {data}")
                return False
        else:
            print(f"   ✗ Error HTTP {response.status_code}: {response.text}")
            return False
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("   ⚠ Backend no está ejecutándose. Ejecuta 'python main_advanced.py' primero")
        return None
    except Exception as e:
        print(f"   ✗ Error inesperado: {e}")
        return False

def main():
    print("=== VERIFICACIÓN COMPLETA DEL SISTEMA DE TOKENS SEGUROS ===\n")
    
    # Test local functionality
    local_test = test_token_security()
    
    if local_test:
        print("\n✓ Todos los tests locales pasaron exitosamente")
    else:
        print("\n✗ Algunos tests locales fallaron")
        return
    
    # Test API endpoints
    api_test = test_api_endpoints()
    
    if api_test is True:
        print("\n✓ Todos los tests de API pasaron exitosamente")
        print("\n🎉 ¡SISTEMA COMPLETAMENTE SEGURO!")
        print("\nAhora puedes:")
        print("1. Usar el frontend para configurar GitHub")
        print("2. Los tokens se manejarán automáticamente de forma segura")
        print("3. Nunca aparecerán en app_config.json")
    elif api_test is False:
        print("\n✗ Algunos tests de API fallaron")
    else:
        print("\n⚠ Tests de API no ejecutados (backend no disponible)")
        print("\nPara prueba completa, ejecuta: python main_advanced.py")

if __name__ == "__main__":
    main()
