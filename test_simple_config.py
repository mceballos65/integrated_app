#!/usr/bin/env python3
"""Simple script to test GitHub config reading"""

try:
    from config_handler import load_config
    from user_encryption import get_github_token
    
    print("=== Testing GitHub Config ===")
    
    # 1. Load raw config
    config = load_config()
    print("\n1. Config loaded:", config is not None)
    
    if config and "github" in config:
        github_section = config["github"]
        print("2. GitHub section found")
        print(f"   repositoryUrl: {github_section.get('repositoryUrl', 'MISSING')}")
        print(f"   branchName: {github_section.get('branchName', 'MISSING')}")
        print(f"   githubUsername: {github_section.get('githubUsername', 'MISSING')}")
        print(f"   localPath: {github_section.get('localPath', 'MISSING')}")
        print(f"   token field: {github_section.get('token', 'MISSING')}")
        
        # 2. Check token
        token = get_github_token()
        print(f"\n3. Encrypted token: {'YES' if token else 'NO'}")
        if token:
            print(f"   Token length: {len(token)}")
            print(f"   Token prefix: {token[:8]}...")
            
        # 3. Test what the URL would be
        if github_section.get('repositoryUrl') and github_section.get('githubUsername'):
            repo_url = github_section['repositoryUrl']
            username = github_section['githubUsername']
            test_url = repo_url.replace("https://", f"https://{username}:TOKEN@")
            print(f"\n4. Constructed URL would be: {test_url}")
        else:
            print("\n4. Cannot construct URL - missing fields")
    else:
        print("2. No GitHub section found!")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
