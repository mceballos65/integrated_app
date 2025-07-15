#!/usr/bin/env python3
"""Script to test backend GitHub config via API"""

import requests
import json

def test_backend_config():
    try:
        # Test if backend is running
        print("Testing backend connection...")
        response = requests.get("http://localhost:8000/health", timeout=5)
        print(f"Backend health: {response.status_code}")
        
        if response.status_code == 200:
            # Get config
            print("\nGetting config from backend...")
            config_response = requests.get("http://localhost:8000/config", timeout=5)
            print(f"Config response status: {config_response.status_code}")
            
            if config_response.status_code == 200:
                config_data = config_response.json()
                print("\nBackend config GitHub section:")
                github_config = config_data.get("github", {})
                print(json.dumps(github_config, indent=2))
                
                # Check what username it's using
                username = github_config.get("githubUsername", "NOT_FOUND")
                print(f"\nUsername being used: '{username}'")
                
                # Check token status
                print("\nChecking token status...")
                token_response = requests.get("http://localhost:8000/config/github/token/exists", timeout=5)
                if token_response.status_code == 200:
                    token_exists = token_response.json().get("exists", False)
                    print(f"Token exists: {token_exists}")
                else:
                    print(f"Token check failed: {token_response.status_code}")
                    
            else:
                print(f"Failed to get config: {config_response.text}")
        else:
            print(f"Backend not healthy: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Backend not running")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_backend_config()
