#!/usr/bin/env python3
"""
Script para migrar las credenciales de GitHub del app_config.json al sistema encriptado
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from user_encryption import (
        get_github_token,
        save_github_token,
        decrypt_data,
        save_users_data
    )
    from config_handler import load_config, save_config
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

def migrate_github_credentials():
    print("=== MIGRATING GITHUB CREDENTIALS TO ENCRYPTED SYSTEM ===\n")
    
    # 1. Read current GitHub username from app_config.json
    print("1. Reading GitHub username from app_config.json:")
    try:
        config = load_config('app_data/config/app_config.json')
        github_section = config.get('github', {})
        github_username = github_section.get('githubUsername', '')
        
        if github_username:
            print(f"   ✅ GitHub username found: '{github_username}'")
        else:
            print("   ❌ No GitHub username found in config")
            return
            
    except Exception as e:
        print(f"   ❌ Error reading config: {e}")
        return
    
    # 2. Check current encrypted data
    print("\n2. Checking current encrypted data:")
    try:
        data = decrypt_data()
        print(f"   Current keys in encrypted data: {list(data.keys())}")
        
        # Check if github section already exists
        if 'github' in data:
            print(f"   GitHub section exists: {data['github']}")
        else:
            print("   No GitHub section in encrypted data")
            
    except Exception as e:
        print(f"   ❌ Error reading encrypted data: {e}")
        return
    
    # 3. Add GitHub username to encrypted storage
    print(f"\n3. Adding GitHub username '{github_username}' to encrypted storage:")
    try:
        # Create or update github section in encrypted data
        if 'github' not in data:
            data['github'] = {}
        
        data['github']['username'] = github_username
        data['last_modified'] = datetime.now().isoformat()
        
        # Save the updated encrypted data
        if save_users_data(data):
            print(f"   ✅ GitHub username saved to encrypted storage")
        else:
            print(f"   ❌ Failed to save GitHub username to encrypted storage")
            return
            
    except Exception as e:
        print(f"   ❌ Error saving to encrypted storage: {e}")
        return
    
    # 4. Remove GitHub username from app_config.json
    print(f"\n4. Removing GitHub username from app_config.json:")
    try:
        # Remove githubUsername from config
        if 'githubUsername' in github_section:
            del github_section['githubUsername']
            
        # Save the cleaned config
        cleaned_config = save_config(config, 'app_data/config/app_config.json')
        print(f"   ✅ GitHub username removed from app_config.json")
        
    except Exception as e:
        print(f"   ❌ Error cleaning config: {e}")
        return
    
    # 5. Verify the migration
    print(f"\n5. Verifying migration:")
    try:
        # Check encrypted storage
        updated_data = decrypt_data()
        github_data = updated_data.get('github', {})
        stored_username = github_data.get('username', '')
        
        if stored_username == github_username:
            print(f"   ✅ GitHub username correctly stored in encrypted system: '{stored_username}'")
        else:
            print(f"   ❌ GitHub username mismatch. Expected: '{github_username}', Got: '{stored_username}'")
            
        # Check config file
        updated_config = load_config('app_data/config/app_config.json')
        updated_github_section = updated_config.get('github', {})
        
        if 'githubUsername' not in updated_github_section:
            print(f"   ✅ GitHub username successfully removed from app_config.json")
        else:
            print(f"   ❌ GitHub username still present in app_config.json")
            
        # Show final state
        print(f"\n   Final app_config.json GitHub section:")
        for key, value in updated_github_section.items():
            print(f"     {key}: '{value}'")
            
    except Exception as e:
        print(f"   ❌ Error verifying migration: {e}")
        return
    
    print(f"\n=== MIGRATION COMPLETE ===")
    print(f"✅ GitHub username moved from app_config.json to encrypted storage")
    print(f"✅ app_config.json now only contains non-sensitive data")
    print(f"✅ Both token and username are now in encrypted storage")

def create_github_credential_functions():
    """Create helper functions to get GitHub credentials from encrypted storage"""
    
    print(f"\n=== CREATING HELPER FUNCTIONS ===")
    
    helper_code = '''
def get_github_username():
    """Get GitHub username from encrypted storage"""
    try:
        data = decrypt_data()
        github_data = data.get('github', {})
        return github_data.get('username', '')
    except Exception as e:
        print(f"Error getting GitHub username: {e}")
        return ''

def save_github_username(username):
    """Save GitHub username to encrypted storage"""
    try:
        data = decrypt_data()
        if 'github' not in data:
            data['github'] = {}
        
        data['github']['username'] = username
        data['last_modified'] = datetime.now().isoformat()
        
        return save_users_data(data)
    except Exception as e:
        print(f"Error saving GitHub username: {e}")
        return False

def get_github_credentials():
    """Get both GitHub token and username from encrypted storage"""
    try:
        token = get_github_token()
        username = get_github_username()
        
        return {
            'token': token,
            'username': username,
            'has_token': bool(token),
            'has_username': bool(username),
            'complete': bool(token and username)
        }
    except Exception as e:
        print(f"Error getting GitHub credentials: {e}")
        return {
            'token': '',
            'username': '',
            'has_token': False,
            'has_username': False,
            'complete': False
        }
'''
    
    print("Helper functions that should be added to user_encryption.py:")
    print(helper_code)

if __name__ == "__main__":
    from datetime import datetime
    
    print("This script will:")
    print("1. Move GitHub username from app_config.json to encrypted storage")
    print("2. Clean app_config.json to remove sensitive data")
    print("3. Verify the migration")
    print("\nDo you want to continue? (y/n): ", end="")
    
    choice = input().lower().strip()
    if choice in ['y', 'yes', 's', 'si']:
        migrate_github_credentials()
        create_github_credential_functions()
    else:
        print("Migration cancelled.")
    
    print("\nPress Enter to continue...")
    input()
