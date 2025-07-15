#!/usr/bin/env python3
"""
Script para probar la obtención de credenciales de GitHub desde el sistema de usuarios encriptado
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from user_encryption import (
        get_github_token,
        decrypt_data,
        get_all_users,
        get_user_by_username
    )
    from config_handler import load_config
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

def test_github_credentials():
    print("=== TESTING GITHUB CREDENTIALS FROM ENCRYPTED SYSTEM ===\n")
    
    # 1. Test GitHub token from encrypted storage
    print("1. Testing GitHub token from encrypted storage:")
    try:
        token = get_github_token()
        if token:
            print(f"   ✅ Token found: YES (length: {len(token)})")
            print(f"   ✅ Token prefix: {token[:10]}...")
        else:
            print("   ❌ Token found: NO")
    except Exception as e:
        print(f"   ❌ Error getting token: {e}")
    
    # 2. Test user system
    print("\n2. Testing user system:")
    try:
        users = get_all_users()
        print(f"   ✅ Total users found: {len(users)}")
        
        for user in users:
            username = user.get('username', 'NO_USERNAME')
            print(f"   - User: {username}")
            
            # Check if this user might have GitHub credentials
            if 'github_username' in user:
                print(f"     GitHub username: {user['github_username']}")
            if 'github_email' in user:
                print(f"     GitHub email: {user['github_email']}")
                
    except Exception as e:
        print(f"   ❌ Error accessing users: {e}")
    
    # 3. Test specific user lookup (assuming github user might be stored separately)
    print("\n3. Testing specific user lookups:")
    test_usernames = ['github', 'git', 'admin', 'mceballos65']
    
    for username in test_usernames:
        try:
            user = get_user_by_username(username)
            if user:
                print(f"   ✅ User '{username}' found:")
                # Don't print password, but check for github-related fields
                for key in user.keys():
                    if 'github' in key.lower() or 'git' in key.lower():
                        print(f"     - {key}: {user[key]}")
            else:
                print(f"   ❌ User '{username}' not found")
        except Exception as e:
            print(f"   ❌ Error checking user '{username}': {e}")
    
    # 4. Test raw encrypted data inspection
    print("\n4. Testing raw encrypted data inspection:")
    try:
        raw_data = decrypt_data()
        print(f"   ✅ Raw data keys: {list(raw_data.keys())}")
        
        if 'github' in raw_data:
            github_data = raw_data['github']
            print(f"   ✅ GitHub section found:")
            for key in github_data.keys():
                if 'token' in key.lower() or 'password' in key.lower():
                    print(f"     - {key}: [HIDDEN]")
                else:
                    print(f"     - {key}: {github_data[key]}")
        
        if 'users' in raw_data:
            users = raw_data['users']
            print(f"   ✅ Users section found with {len(users)} users")
            
            # Look for any github-related data in users
            for user in users:
                username = user.get('username', 'NO_USERNAME')
                github_fields = [k for k in user.keys() if 'github' in k.lower() or 'git' in k.lower()]
                if github_fields:
                    print(f"     User '{username}' has GitHub fields: {github_fields}")
                    
    except Exception as e:
        print(f"   ❌ Error inspecting raw data: {e}")
    
    # 5. Current config.json status
    print("\n5. Current app_config.json GitHub section:")
    try:
        config = load_config('app_data/config/app_config.json')
        github_section = config.get('github', {})
        print(f"   Current GitHub config:")
        for key, value in github_section.items():
            if key == 'token':
                print(f"     {key}: {'[EMPTY]' if not value else '[HAS_VALUE]'}")
            else:
                print(f"     {key}: '{value}'")
    except Exception as e:
        print(f"   ❌ Error reading config: {e}")
    
    print("\n=== RECOMMENDATIONS ===")
    print("1. GitHub token should be stored using save_github_token() and retrieved with get_github_token()")
    print("2. GitHub username should be stored in the encrypted user system")
    print("3. app_config.json should only contain repository URL, branch, and local path")
    print("4. No sensitive credentials should be in app_config.json")

if __name__ == "__main__":
    test_github_credentials()
    print("\nPress Enter to continue...")
    input()
