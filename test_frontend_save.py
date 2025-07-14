#!/usr/bin/env python3
"""
Test script to verify that the GitHub Integration Save button works correctly
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_github_config_endpoints():
    """Test the GitHub configuration endpoints"""
    print("🧪 Testing GitHub Integration endpoints...")
    
    # Test 1: Check if token exists (should be False initially)
    print("\n1. Checking if GitHub token exists...")
    try:
        response = requests.get(f"{BASE_URL}/config/github/token/exists")
        if response.status_code == 200:
            exists = response.json().get("exists", False)
            print(f"   ✅ Token exists: {exists}")
        else:
            print(f"   ❌ Error checking token existence: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 2: Save a test token
    print("\n2. Saving a test GitHub token...")
    test_token = "ghp_test_token_for_testing_12345"
    try:
        response = requests.post(
            f"{BASE_URL}/config/github/token",
            json={"token": test_token}
        )
        if response.status_code == 200:
            print(f"   ✅ Token saved successfully")
        else:
            print(f"   ❌ Error saving token: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: Check if token exists (should be True now)
    print("\n3. Checking if GitHub token exists after saving...")
    try:
        response = requests.get(f"{BASE_URL}/config/github/token/exists")
        if response.status_code == 200:
            exists = response.json().get("exists", False)
            print(f"   ✅ Token exists: {exists}")
        else:
            print(f"   ❌ Error checking token existence: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 4: Save GitHub config
    print("\n4. Saving GitHub configuration...")
    github_config = {
        "github": {
            "repo_url": "https://github.com/test/repo.git",
            "branch": "main"
        }
    }
    try:
        response = requests.patch(
            f"{BASE_URL}/api/config",
            json=github_config
        )
        if response.status_code == 200:
            config = response.json()
            print(f"   ✅ GitHub config saved successfully")
            print(f"   📝 Repo URL: {config.get('github', {}).get('repo_url', 'Not set')}")
            print(f"   📝 Branch: {config.get('github', {}).get('branch', 'Not set')}")
            # Verify token is not exposed
            if 'token' in config.get('github', {}):
                if config['github']['token']:
                    print(f"   ⚠️  WARNING: Token is exposed in config response!")
                else:
                    print(f"   ✅ Token is properly hidden in config response")
            else:
                print(f"   ✅ Token field not included in config response")
        else:
            print(f"   ❌ Error saving config: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 5: Verify app_config.json doesn't contain the token
    print("\n5. Verifying app_config.json doesn't contain the token...")
    try:
        with open("./app_data/config/app_config.json", "r") as f:
            config_content = f.read()
            if test_token in config_content:
                print(f"   ❌ SECURITY ISSUE: Token found in app_config.json!")
            else:
                print(f"   ✅ Token is NOT in app_config.json (secure)")
    except Exception as e:
        print(f"   ❌ Error reading config file: {e}")
    
    print("\n🎉 Test completed!")
    print("\nNow test the frontend:")
    print("1. Go to Configuration page → GitHub Integration tab")
    print("2. Fill in the form and click 'Save Configuration'")
    print("3. Verify the success message appears")
    print("4. Verify the token field is cleared after saving")
    print("5. Verify the 'Token is already configured' status appears")

if __name__ == "__main__":
    test_github_config_endpoints()
