#!/usr/bin/env python3
"""
Test script to debug what happens when we update GitHub config
"""

import json
import requests
import sys

BACKEND_URL = "http://localhost:8000"

def test_config_update():
    print("=== Testing Config Update ===\n")
    
    # Test data that should be sent from frontend
    test_config_update = {
        "github": {
            "githubUsername": "mceballos65",
            "repositoryUrl": "https://github.com/mceballos65/test-repo.git",
            "branchName": "main",
            "localPath": "./app_data/config"
        }
    }
    
    print("1. Sending test config update to backend...")
    print(f"Data to send: {json.dumps(test_config_update, indent=2)}")
    
    try:
        # Send PATCH request to update config
        response = requests.patch(
            f"{BACKEND_URL}/api/config/update",
            json=test_config_update,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\n2. Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Config update successful!")
            print(f"Returned config: {json.dumps(result, indent=2)}")
        else:
            print(f"❌ Config update failed!")
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Is the server running?")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    # Check the file after update
    print(f"\n3. Checking app_config.json after update...")
    try:
        with open("app_data/config/app_config.json", 'r') as f:
            config = json.load(f)
        
        github_config = config.get("github", {})
        print(f"GitHub section in file: {json.dumps(github_config, indent=2)}")
        
        # Check specific fields
        repo_url = github_config.get("repositoryUrl", "")
        branch_name = github_config.get("branchName", "")
        
        if repo_url:
            print(f"✅ repositoryUrl saved: '{repo_url}'")
        else:
            print(f"❌ repositoryUrl is empty or missing")
            
        if branch_name:
            print(f"✅ branchName saved: '{branch_name}'")
        else:
            print(f"❌ branchName is empty or missing")
            
    except Exception as e:
        print(f"❌ Error reading config file: {str(e)}")

if __name__ == "__main__":
    test_config_update()
