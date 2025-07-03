"""
User Management with Encryption
Utilities for managing encrypted user data
"""

import json
import os
import hashlib
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
from datetime import datetime
from typing import Dict, List, Optional

# File paths
USERS_FILE = "./userandpassword.encrypted"
KEY_FILE = "./encryption.key"
SALT_FILE = "./salt.key"

def generate_encryption_key() -> bytes:
    """Generate a new encryption key and save it to file"""
    # Generate a random salt
    salt = os.urandom(16)
    
    # Use a passphrase (in production, this should be from environment variable)
    password = b"kyndryl_user_management_2025"
    
    # Derive key from password and salt
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password))
    
    # Save salt and key
    with open(SALT_FILE, 'wb') as f:
        f.write(salt)
    
    with open(KEY_FILE, 'wb') as f:
        f.write(key)
    
    return key

def load_encryption_key() -> bytes:
    """Load encryption key from file, create if doesn't exist"""
    if not os.path.exists(KEY_FILE) or not os.path.exists(SALT_FILE):
        return generate_encryption_key()
    
    # Load existing salt and regenerate key
    with open(SALT_FILE, 'rb') as f:
        salt = f.read()
    
    password = b"kyndryl_user_management_2025"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password))
    
    return key

def encrypt_data(data: dict) -> bytes:
    """Encrypt user data"""
    key = load_encryption_key()
    fernet = Fernet(key)
    
    # Convert to JSON and encrypt
    json_data = json.dumps(data, indent=2).encode()
    encrypted_data = fernet.encrypt(json_data)
    
    return encrypted_data

def decrypt_data() -> dict:
    """Decrypt user data from file"""
    if not os.path.exists(USERS_FILE):
        # Return default admin user if file doesn't exist
        return {
            "users": [
                {
                    "username": "admin",
                    "password_hash": "$2b$12$simulated_admin_hash_default",
                    "is_active": True,
                    "is_default": True,
                    "created_at": "2025-01-01T00:00:00Z",
                    "last_login": None,
                    "login_attempts": 0
                }
            ],
            "last_modified": datetime.now().isoformat(),
            "version": "1.0"
        }
    
    try:
        key = load_encryption_key()
        fernet = Fernet(key)
        
        # Read and decrypt file
        with open(USERS_FILE, 'rb') as f:
            encrypted_data = f.read()
        
        decrypted_data = fernet.decrypt(encrypted_data)
        return json.loads(decrypted_data.decode())
    
    except Exception as e:
        print(f"Error decrypting user data: {e}")
        # Return default data on error
        return {
            "users": [
                {
                    "username": "admin",
                    "password_hash": "$2b$12$simulated_admin_hash_default",
                    "is_active": True,
                    "is_default": True,
                    "created_at": "2025-01-01T00:00:00Z",
                    "last_login": None,
                    "login_attempts": 0
                }
            ],
            "last_modified": datetime.now().isoformat(),
            "version": "1.0"
        }

def save_users_data(users_data: dict):
    """Save encrypted user data to file"""
    try:
        # Update metadata
        users_data["last_modified"] = datetime.now().isoformat()
        users_data["version"] = "1.0"
        
        # Encrypt and save
        encrypted_data = encrypt_data(users_data)
        
        with open(USERS_FILE, 'wb') as f:
            f.write(encrypted_data)
        
        print(f"Users data saved to {USERS_FILE}")
        return True
    
    except Exception as e:
        print(f"Error saving user data: {e}")
        return False

def get_user_by_username(username: str) -> Optional[dict]:
    """Get a specific user by username"""
    data = decrypt_data()
    users = data.get("users", [])
    
    for user in users:
        if user["username"] == username:
            return user
    
    return None

def update_user(username: str, user_data: dict) -> bool:
    """Update a specific user"""
    try:
        data = decrypt_data()
        users = data.get("users", [])
        
        # Find and update user
        for i, user in enumerate(users):
            if user["username"] == username:
                users[i].update(user_data)
                users[i]["last_modified"] = datetime.now().isoformat()
                break
        else:
            # User not found, add new user
            user_data["username"] = username
            user_data["created_at"] = datetime.now().isoformat()
            users.append(user_data)
        
        data["users"] = users
        return save_users_data(data)
    
    except Exception as e:
        print(f"Error updating user {username}: {e}")
        return False

def delete_user(username: str) -> bool:
    """Delete a user (admin deletion is handled by the API layer)"""
    try:
        data = decrypt_data()
        users = data.get("users", [])
        
        # Filter out the user
        data["users"] = [user for user in users if user["username"] != username]
        
        return save_users_data(data)
    
    except Exception as e:
        print(f"Error deleting user {username}: {e}")
        return False

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    try:
        import bcrypt
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    except ImportError:
        # Fallback to simpler hash if bcrypt not available
        import hashlib
        salt = "kyndryl_salt_2025"
        return "sha256:" + hashlib.sha256((password + salt).encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    # Special case for default admin password
    if password == "!Passw0rd" and "simulated_admin_hash" in hashed:
        return True
    
    try:
        import bcrypt
        if hashed.startswith("sha256:"):
            # Legacy hash
            import hashlib
            salt = "kyndryl_salt_2025"
            return hashed == "sha256:" + hashlib.sha256((password + salt).encode()).hexdigest()
        else:
            # bcrypt hash
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except ImportError:
        # Fallback verification
        import hashlib
        salt = "kyndryl_salt_2025"
        expected = "sha256:" + hashlib.sha256((password + salt).encode()).hexdigest()
        return hashed == expected

def initialize_default_users():
    """Initialize default users if file doesn't exist"""
    if not os.path.exists(USERS_FILE):
        print("Initializing default users...")
        
        # Create default admin user
        default_admin = {
            "username": "admin",
            "password_hash": hash_password("!Passw0rd"),
            "is_active": True,
            "is_default": True,
            "created_at": datetime.now().isoformat(),
            "last_login": None,
            "login_attempts": 0
        }
        
        users_data = {
            "users": [default_admin],
            "last_modified": datetime.now().isoformat(),
            "version": "1.0"
        }
        
        if save_users_data(users_data):
            print("Default users initialized successfully!")
            return True
        else:
            print("Failed to initialize default users!")
            return False
    
    return True

def get_all_users() -> List[dict]:
    """Get all users"""
    data = decrypt_data()
    return data.get("users", [])

def create_user(username: str, password: str, is_active: bool = True) -> bool:
    """Create a new user"""
    if get_user_by_username(username):
        return False  # User already exists
    
    new_user = {
        "username": username,
        "password_hash": hash_password(password),
        "is_active": is_active,
        "is_default": False,
        "created_at": datetime.now().isoformat(),
        "last_login": None,
        "login_attempts": 0
    }
    
    return update_user(username, new_user)

def encrypt_string(text: str) -> str:
    """Encrypt a single string and return as base64"""
    if not text:
        return ""
    
    try:
        key = load_encryption_key()
        fernet = Fernet(key)
        encrypted_data = fernet.encrypt(text.encode('utf-8'))
        return base64.urlsafe_b64encode(encrypted_data).decode('utf-8')
    except Exception as e:
        print(f"Error encrypting string: {e}")
        return text  # Return original text if encryption fails

def decrypt_string(encrypted_text: str) -> str:
    """Decrypt a base64 encoded encrypted string"""
    if not encrypted_text:
        return ""
    
    try:
        key = load_encryption_key()
        fernet = Fernet(key)
        encrypted_data = base64.urlsafe_b64decode(encrypted_text.encode('utf-8'))
        decrypted_data = fernet.decrypt(encrypted_data)
        return decrypted_data.decode('utf-8')
    except Exception as e:
        print(f"Error decrypting string: {e}")
        return encrypted_text  # Return original text if decryption fails

# Initialize encryption on import
if __name__ == "__main__":
    # Test the encryption system
    print("Testing encryption system...")
    
    # Create test data
    test_data = decrypt_data()
    print("Loaded data:", test_data)
    
    # Save it back
    save_users_data(test_data)
    print("Data saved and encrypted successfully!")
