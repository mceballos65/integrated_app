#!/usr/bin/env python3
"""
Script para guardar credenciales de GitHub en el sistema encriptado
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from user_encryption import (
        save_github_credentials,
        get_github_credentials,
        delete_github_credentials
    )
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

def setup_github_credentials():
    print("=== SETUP GITHUB CREDENTIALS ===\n")
    
    # Check current status
    print("1. Checking current GitHub credentials status:")
    try:
        current_creds = get_github_credentials()
        print(f"   Current status:")
        print(f"   - Has username: {current_creds['has_username']}")
        print(f"   - Has token: {current_creds['has_token']}")
        print(f"   - Complete: {current_creds['complete']}")
        
        if current_creds['has_username']:
            print(f"   - Current username: {current_creds['username']}")
    except Exception as e:
        print(f"   Error checking current credentials: {e}")
    
    print("\n" + "="*50)
    print("IMPORTANT SECURITY NOTES:")
    print("- Your GitHub username and token will be encrypted")
    print("- They will NOT be stored in plain text files")
    print("- Only the encrypted system can access them")
    print("="*50 + "\n")
    
    # Get GitHub username
    username = input("Enter your GitHub username (e.g., mceballos65): ").strip()
    if not username:
        print("Username is required!")
        return
    
    # Get GitHub token
    print("\nEnter your GitHub Personal Access Token:")
    print("(This is NOT your GitHub password - it's a token from GitHub Settings > Developer settings > Personal access tokens)")
    token = input("GitHub Token: ").strip()
    if not token:
        print("Token is required!")
        return
    
    # Validate token format (basic check)
    if not token.startswith(('ghp_', 'github_pat_')):
        print("WARNING: Token doesn't seem to be in the expected format (should start with 'ghp_' or 'github_pat_')")
        confirm = input("Continue anyway? (y/n): ").lower().strip()
        if confirm not in ['y', 'yes', 's', 'si']:
            print("Setup cancelled.")
            return
    
    # Save credentials
    print(f"\n2. Saving GitHub credentials for user: {username}")
    try:
        success = save_github_credentials(username, token)
        if success:
            print("   ✅ GitHub credentials saved successfully!")
            
            # Verify by reading them back
            print("\n3. Verifying saved credentials:")
            verification = get_github_credentials()
            print(f"   - Username: {verification['username']}")
            print(f"   - Token: {'✅ Saved' if verification['has_token'] else '❌ Not saved'}")
            print(f"   - Complete: {'✅ Yes' if verification['complete'] else '❌ No'}")
            
            if verification['complete']:
                print(f"\n✅ SUCCESS: GitHub credentials are properly configured!")
                print(f"   The backend will now use these credentials for git operations.")
            else:
                print(f"\n❌ ERROR: Something went wrong during verification.")
                
        else:
            print("   ❌ Failed to save GitHub credentials")
            
    except Exception as e:
        print(f"   ❌ Error saving credentials: {e}")

def delete_credentials():
    print("\n=== DELETE GITHUB CREDENTIALS ===")
    print("This will permanently delete your GitHub credentials from encrypted storage.")
    confirm = input("Are you sure? (y/n): ").lower().strip()
    
    if confirm in ['y', 'yes', 's', 'si']:
        try:
            success = delete_github_credentials()
            if success:
                print("✅ GitHub credentials deleted successfully!")
            else:
                print("❌ Failed to delete GitHub credentials")
        except Exception as e:
            print(f"❌ Error deleting credentials: {e}")
    else:
        print("Deletion cancelled.")

if __name__ == "__main__":
    print("GitHub Credentials Setup")
    print("1. Setup/Update GitHub credentials")
    print("2. Delete GitHub credentials")
    print("3. Check current status")
    
    choice = input("\nChoose an option (1-3): ").strip()
    
    if choice == "1":
        setup_github_credentials()
    elif choice == "2":
        delete_credentials()
    elif choice == "3":
        try:
            creds = get_github_credentials()
            print(f"\nCurrent status:")
            print(f"- Username: {creds['username'] if creds['has_username'] else 'Not set'}")
            print(f"- Token: {'Set' if creds['has_token'] else 'Not set'}")
            print(f"- Complete: {'Yes' if creds['complete'] else 'No'}")
        except Exception as e:
            print(f"Error checking status: {e}")
    else:
        print("Invalid option.")
    
    print("\nPress Enter to continue...")
    input()
