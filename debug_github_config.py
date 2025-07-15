#!/usr/bin/env python3
"""Debug script to check GitHub configuration in the backend"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config_handler import load_config
from user_encryption import get_github_token
import json

def debug_github_config():
    print("=== DEBUG: GitHub Configuration ===")
    
    # 1. Check what's in app_config.json
    print("\n1. Raw config from app_config.json:")
    config = load_config()
    if config and config.get("github"):
        github_section = config["github"]
        print(json.dumps(github_section, indent=2))
        
        # Check each field
        print("\n2. Individual fields:")
        print(f"  repositoryUrl: '{github_section.get('repositoryUrl', 'NOT_FOUND')}'")
        print(f"  branchName: '{github_section.get('branchName', 'NOT_FOUND')}'") 
        print(f"  githubUsername: '{github_section.get('githubUsername', 'NOT_FOUND')}'")
        print(f"  localPath: '{github_section.get('localPath', 'NOT_FOUND')}'")
        print(f"  token (should be empty): '{github_section.get('token', 'NOT_FOUND')}'")
    else:
        print("No github section found in config!")
        return
    
    # 2. Check encrypted token
    print("\n3. Encrypted token status:")
    token = get_github_token()
    if token:
        print(f"  Token found: YES (length: {len(token)})")
        print(f"  Token starts with: {token[:10]}...")
    else:
        print("  Token found: NO")
    
    # 3. Simulate what get_github_config() would return
    print("\n4. Final config that would be used:")
    if token:
        final_config = github_section.copy()
        final_config["githubToken"] = token
        
        # Check required fields
        required_fields = ["githubToken", "githubUsername", "repositoryUrl", "branchName", "localPath"]
        missing_fields = []
        for field in required_fields:
            if not final_config.get(field):
                missing_fields.append(field)
        
        if missing_fields:
            print(f"  MISSING FIELDS: {missing_fields}")
            print("  Config would be REJECTED")
        else:
            print("  All required fields present")
            print("  Config would be ACCEPTED")
            
            # Show what URL would be constructed
            repo_url = final_config.get("repositoryUrl", "")
            username = final_config.get("githubUsername", "")
            if repo_url and username:
                url_with_auth = repo_url.replace("https://", f"https://{username}:***TOKEN***@")
                print(f"  Constructed URL: {url_with_auth}")
    else:
        print("  Cannot create final config - no token")

if __name__ == "__main__":
    debug_github_config()
