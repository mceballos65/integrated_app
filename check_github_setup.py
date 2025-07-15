#!/usr/bin/env python3
"""
Script para verificar y configurar el token de GitHub correctamente
"""

import requests

def check_and_setup_github():
    """Verificar el estado del token de GitHub"""
    BASE_URL = "http://localhost:8000"
    
    # 1. Verificar si el token existe
    print("🔍 Checking if GitHub token exists...")
    try:
        response = requests.get(f"{BASE_URL}/config/github/token/exists")
        if response.status_code == 200:
            exists = response.json().get("exists", False)
            print(f"   Token exists: {exists}")
        else:
            print(f"   Error checking token: {response.status_code}")
            return
    except Exception as e:
        print(f"   Error: {e}")
        return
    
    # 2. Si no existe el token, pedirlo al usuario
    if not exists:
        print("\n❌ No GitHub token found!")
        print("💡 Please go to the frontend and:")
        print("   1. Go to Configuration → GitHub Integration")
        print("   2. Enter your GitHub token in the 'GitHub Token' field")
        print("   3. Click 'Save Configuration'")
        print("\n📝 To create a GitHub token:")
        print("   1. Go to https://github.com/settings/tokens")
        print("   2. Click 'Generate new token (classic)'")
        print("   3. Select scopes: repo (full control)")
        print("   4. Copy the generated token")
        return
    
    # 3. Verificar la configuración actual
    print("\n📋 Current GitHub configuration:")
    try:
        response = requests.get(f"{BASE_URL}/api/config")
        if response.status_code == 200:
            config = response.json()
            github_config = config.get("github", {})
            print(f"   Repository URL: {github_config.get('repositoryUrl', 'Not set')}")
            print(f"   Branch Name: {github_config.get('branchName', 'Not set')}")
            print(f"   GitHub Username: {github_config.get('githubUsername', 'Not set')}")
            print(f"   Has Token: {github_config.get('hasToken', False)}")
            
            # Verificar si la configuración está completa
            required_fields = ['repositoryUrl', 'branchName', 'githubUsername']
            missing_fields = [field for field in required_fields if not github_config.get(field)]
            
            if missing_fields:
                print(f"\n⚠️  Missing configuration fields: {', '.join(missing_fields)}")
                print("   Please configure these in the frontend.")
            else:
                print("\n✅ GitHub configuration looks complete!")
                print("   You should be able to push now.")
        else:
            print(f"   Error getting config: {response.status_code}")
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    check_and_setup_github()
