from fastapi import FastAPI, HTTPException, Request, APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

import numpy as np
import logging
import uuid
import fnmatch
import json
import os
from fastapi.middleware.cors import CORSMiddleware
import subprocess

from utils import (
    normalize_text,
    load_data,
    save_data,
    load_model,
    generate_embeddings,
    setup_logging,
    load_disabled_by_matcher,
    save_disabled_by_matcher,
    log_event
)

from user_encryption import (
    decrypt_data,
    save_users_data,
    get_user_by_username,
    update_user,
    delete_user,
    hash_password,
    verify_password,
    initialize_default_users,
    get_all_users,
    create_user
)

from config import SIMILARITY_THRESHOLD, ENABLE_LOGGING

setup_logging()

app = FastAPI()

# Initialize user management system
print("Initializing user management system...")
initialize_default_users()
print("User management system ready!")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # O reemplazá "*" por ["http://localhost:5173"] si querés restringirlo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Load accounts DB
disabled_by_matcher = load_disabled_by_matcher()

# Initialize model and data
model = load_model()
data = load_data()
embeddings = generate_embeddings(data, model)

# Reuqest models
class PredictRequest(BaseModel):
    account: str
    abstract: str
    component: Optional[str] = None

class AddRequest(BaseModel):
    phrase: str
    playbook: str
    threshold: Optional[float] = None
    component: Optional[str] = None
    only_on_component_match: Optional[bool] = None

class ModifyRequest(BaseModel):
    id: str
    phrase: Optional[str] = None
    playbook: Optional[str] = None
    threshold: Optional[float] = None
    component: Optional[str] = None
    only_on_component_match: Optional[bool] = None

class DeleteRequest(BaseModel):
    id: str

class MatcherActionRequest(BaseModel):
    matcher_id: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    is_active: Optional[bool] = True

class UserUpdate(BaseModel):
    password: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    username: str
    is_active: bool
    is_default: bool
    created_at: str
    last_login: Optional[str]
    login_attempts: int

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class ConfigRequest(BaseModel):
    app: Optional[dict] = None
    logging: Optional[dict] = None
    security: Optional[dict] = None
    github: Optional[dict] = None

class AppConfig(BaseModel):
    prediction_url: Optional[str] = ""
    account_code: Optional[str] = "ACM"

class LoggingConfig(BaseModel):
    logFileLocation: Optional[str] = "./logs/predictions.log"
    maxLogEntries: Optional[int] = 50000

class SecurityConfig(BaseModel):
    adminUserDisabled: Optional[bool] = False
    debugRequiresAuth: Optional[bool] = False

class GitHubConfig(BaseModel):
    githubToken: Optional[str] = ""
    githubUsername: Optional[str] = ""
    repositoryUrl: Optional[str] = ""
    branchName: Optional[str] = ""
    localPath: Optional[str] = ""

class FullConfig(BaseModel):
    app: AppConfig
    logging: LoggingConfig
    security: SecurityConfig
    github: GitHubConfig

def update_embeddings():
    global embeddings
    embeddings = generate_embeddings(data, model)

# Configuration management functions
CONFIG_FILE_PATH = "config.json"

def get_default_config():
    """Returns the default configuration structure"""
    return {
        "app": {
            "prediction_url": "",
            "account_code": "ACM"
        },
        "logging": {
            "logFileLocation": "./logs/predictions.log",
            "maxLogEntries": 50000
        },
        "security": {
            "adminUserDisabled": False,
            "debugRequiresAuth": False
        },
        "github": {
            "githubToken": "",
            "githubUsername": "",
            "repositoryUrl": "",
            "branchName": "",
            "localPath": ""
        }
    }

def config_exists():
    """Check if config.json exists"""
    return os.path.exists(CONFIG_FILE_PATH)

def load_config():
    """Load configuration from config.json with encryption for sensitive data"""
    try:
        if not config_exists():
            return None
        
        with open(CONFIG_FILE_PATH, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
        
        # Decrypt sensitive data (GitHub token) if it exists and is encrypted
        if config_data.get("github", {}).get("githubToken"):
            try:
                # Try to decrypt the token (if it's encrypted)
                from user_encryption import decrypt_string
                encrypted_token = config_data["github"]["githubToken"]
                config_data["github"]["githubToken"] = decrypt_string(encrypted_token)
            except:
                # If decryption fails, assume it's plain text (backward compatibility)
                pass
        
        return config_data
    except Exception as e:
        print(f"Error loading config: {e}")
        return None

def save_config(config_data):
    """Save configuration to config.json with encryption for sensitive data"""
    try:
        # Make a copy to avoid modifying the original
        config_to_save = config_data.copy()
        
        # Encrypt sensitive data (GitHub token) before saving
        if config_to_save.get("github", {}).get("githubToken"):
            try:
                from user_encryption import encrypt_string
                plain_token = config_to_save["github"]["githubToken"]
                config_to_save["github"]["githubToken"] = encrypt_string(plain_token)
            except Exception as e:
                print(f"Warning: Could not encrypt GitHub token: {e}")
                # Continue with plain text if encryption fails
        
        with open(CONFIG_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(config_to_save, f, indent=2, ensure_ascii=False)
        
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False

def get_github_config():
    """Get GitHub configuration for git operations"""
    config = load_config()
    if not config or not config.get("github"):
        return None
    
    github_config = config["github"]
    
    # Validate required fields
    required_fields = ["githubToken", "githubUsername", "repositoryUrl", "branchName", "localPath"]
    for field in required_fields:
        if not github_config.get(field):
            return None
    
    return github_config

@app.post("/predict")
def predict(request: PredictRequest, http_request: Request):
    message = normalize_text(request.abstract)
    raw_component = request.component or ""
    lowered_component = raw_component.lower()
    account = request.account.upper()

    if not data or embeddings.size == 0:
        raise HTTPException(status_code=404, detail="No data available for prediction.")

    filtered_data = []
    filtered_embeddings = []
    allowed_by_component_match = {}  # Mapped to boolean values

    for i, entry in enumerate(data):
        only_on_component_match = entry.get("only_on_component_match", False)
        entry_component = entry.get("component", "")

        if only_on_component_match:
            patterns = [p.strip().lower() for p in entry_component.replace(",", " ").split() if p.strip()]
            wildcard_patterns = [p if "*" in p else f"*{p}*" for p in patterns]
            matches = any(fnmatch.fnmatch(lowered_component, pattern) for pattern in wildcard_patterns)

            if not matches:
                allowed_by_component_match[entry["id"]] = False
                continue

            allowed_by_component_match[entry["id"]] = True
        else:
            allowed_by_component_match[entry["id"]] = True

        filtered_data.append(entry)
        filtered_embeddings.append(embeddings[i])

    if not filtered_data:
        raise HTTPException(status_code=404, detail="No matchers apply to the given component.")

    filtered_embeddings = np.array(filtered_embeddings)
    message_embedding = model.encode([message])
    similarities = np.inner(message_embedding, filtered_embeddings)[0]

    best_idx = np.argmax(similarities)
    best_match = filtered_data[best_idx]
    similarity_score = similarities[best_idx]
    threshold = best_match.get("threshold", SIMILARITY_THRESHOLD)
    match_id = best_match.get("id", "")

    meets_threshold = bool(similarity_score >= threshold)
    account_enabled = bool(account not in disabled_by_matcher.get(match_id, set()))
    component_match = bool(allowed_by_component_match.get(match_id, True))

    execute_approved = meets_threshold and account_enabled and component_match

    if ENABLE_LOGGING:
        log_event(
            tag=account,
            message=f"'{message}' => Match '{best_match['phrase']}' | Score: {similarity_score:.2f} | "
                    f"Threshold Met: {meets_threshold} | Component Allowed: {component_match} | "
                    f"Account Enabled: {account_enabled} | Execute Approved: {execute_approved}",
            request=http_request
        )

    timestamp = datetime.utcnow().isoformat(timespec='milliseconds') + 'Z'

    return {
        "id": match_id,
        "timestamp": timestamp,
        "abstract": message,
        "account": account,
        "matched_phrase": best_match["phrase"],
        "playbook": best_match["playbook"],
        "similarity": f"{similarity_score * 100:.2f}",
        "threshold": f"{threshold * 100:.2f}",
        "meets_threshold": meets_threshold,
        "account_enabled": account_enabled,           
        "component_matched": best_match.get("component", ""),
        "allowed_by_component_match": component_match,     
        "only_on_component_match": best_match.get("only_on_component_match", False),
        "received_component": raw_component,
        "execute_approved": execute_approved
    }


# Endpoint: Add phrase
@app.post("/add")
def add_entry(request: AddRequest, http_request: Request):
    new_entry = {
        "id": str(uuid.uuid4()),
        "phrase": request.phrase,
        "playbook": request.playbook,
        "threshold": request.threshold or SIMILARITY_THRESHOLD,
        "component": request.component or "",
        "only_on_component_match": request.only_on_component_match if request.only_on_component_match is not None else False
    }
    data.append(new_entry)
    save_data(data)
    update_embeddings()

    if ENABLE_LOGGING:
        log_event(
            "ADD",
            f"New entry added: Phrase='{request.phrase}', Playbook='{request.playbook}', "
            f"Threshold={new_entry['threshold']:.2f}, Component='{new_entry['component']}', "
            f"OnlyOnComponentMatch={new_entry['only_on_component_match']}, ID={new_entry['id']}",
            http_request
        )
    return {"message": "Entry added successfully", "id": new_entry["id"]}

# Endpoint: Modify phrase
@app.put("/modify")
def modify_entry(request: ModifyRequest, http_request: Request):
    for entry in data:
        if entry["id"] == request.id:
            if request.phrase:
                entry["phrase"] = request.phrase
            if request.playbook:
                entry["playbook"] = request.playbook
            if request.threshold is not None:
                entry["threshold"] = request.threshold
            if request.component is not None:
                entry["component"] = request.component
            if request.only_on_component_match is not None:
                entry["only_on_component_match"] = request.only_on_component_match

            save_data(data)
            update_embeddings()

            # Add logging
            if ENABLE_LOGGING:
                log_event(
                    tag=request.id,
                    message=(
                        f"Modified entry with ID: {request.id}, updated fields: "
                        f"phrase={request.phrase}, playbook={request.playbook}, "
                        f"threshold={request.threshold}, component={request.component}, "
                        f"only_on_component_match={request.only_on_component_match}"
                    ),
                    request=http_request
                )

            return {"message": "Entry modified successfully"}

    raise HTTPException(status_code=404, detail="Entry not found")
# Endpoint: Delete Phrase
@app.delete("/delete")
def delete_entry(request: DeleteRequest, http_request: Request):
    global data
    original_len = len(data)
    data = [entry for entry in data if entry["id"] != request.id]
    if len(data) == original_len:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    save_data(data)
    update_embeddings()

    # logging section
    if ENABLE_LOGGING:
        log_event(
            tag=request.id,
            message=f"Deleted entry with ID: {request.id}",
            request=http_request
        )
    return {"message": "Entry deleted successfully"}

# Endpoint: List phrases
@app.get("/list")
def list_entries(http_request: Request):
    # logging section
    if ENABLE_LOGGING:
        log_event(
            tag="list_entries",
            message="Listing all entries",
            request=http_request
        )
    
    return data

# Endpoint: Health check
@app.get("/")
def health_check(http_request: Request):
    # logging section
    if ENABLE_LOGGING:
        log_event(
            tag="health_check",
            message="Health check status request",
            request=http_request
        )
    
    return {"status": "ok"}

# Endpoint: List accounts with disabled playbooks
@app.get("/accounts/{account}")
def list_disabled_matchers(account: str, http_request: Request):
    global disabled_by_matcher
    matchers = [matcher for matcher, accounts in disabled_by_matcher.items() if account in accounts]
    
    # logging section
    if ENABLE_LOGGING:
        log_event(
            tag="list_disabled_matchers",
            message=f"Listing disabled matchers for account: {account}",
            request=http_request
        )
    
    return {"account": account, "disabled_matchers": matchers}


# Endpoint: Disable matcher for account
@app.post("/accounts/{account}/disable")
def disable_matcher_for_account(account: str, request: MatcherActionRequest, http_request: Request):
    global disabled_by_matcher
    matcher_id = request.matcher_id
    
    if matcher_id not in disabled_by_matcher:
        disabled_by_matcher[matcher_id] = set()
        
    disabled_by_matcher[matcher_id].add(account)
    save_disabled_by_matcher(disabled_by_matcher)

    # logging section
    if ENABLE_LOGGING:
        log_event(
            tag="disable_matcher_for_account",
            message=f"Matcher '{matcher_id}' disabled for account '{account}'.",
            request=http_request
        )

    return {"message": f"Matcher '{matcher_id}' disabled for account '{account}'."}

# Endpoint: Enable matcher for account
@app.post("/accounts/{account}/enable")
def enable_matcher_for_account(account: str, request: MatcherActionRequest, http_request: Request):
    global disabled_by_matcher
    matcher_id = request.matcher_id
    
    if matcher_id in disabled_by_matcher and account in disabled_by_matcher[matcher_id]:
        disabled_by_matcher[matcher_id].remove(account)
        if not disabled_by_matcher[matcher_id]:
            del disabled_by_matcher[matcher_id]  # in case it comes empty
        save_disabled_by_matcher(disabled_by_matcher)

        # logging section
        if ENABLE_LOGGING:
            log_event(
                tag="enable_matcher_for_account",
                message=f"Matcher '{matcher_id}' enabled for account '{account}'.",
                request=http_request
            )

        return {"message": f"Matcher '{matcher_id}' enabled for account '{account}'."}
    else:
        # logging section upon failure
        if ENABLE_LOGGING:
            log_event(
                tag="enable_matcher_for_account",
                message=f"Account or matcher not found for account '{account}' and matcher '{matcher_id}'.",
                request=http_request
            )

        return JSONResponse(status_code=404, content={"error": "Account or matcher not found."})
    

# User Management Endpoints

@app.post("/users/login")
async def login_user(user_data: UserLogin):
    """Login endpoint"""
    try:
        user = get_user_by_username(user_data.username)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        if not user.get("is_active", False):
            raise HTTPException(status_code=401, detail="Account is disabled")
        
        if not verify_password(user_data.password, user.get("password_hash", "")):
            # Increment login attempts
            user["login_attempts"] = user.get("login_attempts", 0) + 1
            update_user(user_data.username, user)
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Successful login - reset attempts and update last login
        user["login_attempts"] = 0
        user["last_login"] = datetime.now().isoformat()
        update_user(user_data.username, user)
        
        return {
            "message": "Login successful",
            "user": {
                "username": user["username"],
                "is_active": user["is_active"],
                "is_default": user.get("is_default", False)
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")

@app.get("/users", response_model=List[UserResponse])
async def list_users():
    """List all users (admin only endpoint in production)"""
    try:
        data = decrypt_data()
        users = data.get("users", [])
        
        user_responses = []
        for user in users:
            user_responses.append(UserResponse(
                username=user["username"],
                is_active=user.get("is_active", False),
                is_default=user.get("is_default", False),
                created_at=user.get("created_at", ""),
                last_login=user.get("last_login"),
                login_attempts=user.get("login_attempts", 0)
            ))
        
        return user_responses
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing users: {str(e)}")

@app.post("/users")
async def create_user(user_data: UserCreate):
    """Create a new user"""
    try:
        # Check if user already exists
        existing_user = get_user_by_username(user_data.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists")
        
        # Create new user
        new_user = {
            "username": user_data.username,
            "password_hash": hash_password(user_data.password),
            "is_active": user_data.is_active,
            "is_default": False,
            "created_at": datetime.now().isoformat(),
            "last_login": None,
            "login_attempts": 0
        }
        
        if update_user(user_data.username, new_user):
            return {"message": f"User {user_data.username} created successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to create user")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")

@app.put("/users/{username}")
async def update_user_endpoint(username: str, user_data: UserUpdate):
    """Update an existing user"""
    try:
        existing_user = get_user_by_username(username)
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prepare update data
        update_data = {}
        if user_data.password is not None:
            update_data["password_hash"] = hash_password(user_data.password)
        if user_data.is_active is not None:
            update_data["is_active"] = user_data.is_active
        
        if update_user(username, update_data):
            return {"message": f"User {username} updated successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update user")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating user: {str(e)}")

@app.put("/users/{username}/password")
async def change_password(username: str, password_data: PasswordChange):
    """Change user password"""
    try:
        user = get_user_by_username(username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify current password
        if not verify_password(password_data.current_password, user.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        
        # Update password
        update_data = {
            "password_hash": hash_password(password_data.new_password)
        }
        
        if update_user(username, update_data):
            return {"message": "Password changed successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to change password")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error changing password: {str(e)}")

@app.put("/users/{username}/toggle")
async def toggle_user_status(username: str):
    """Enable/disable a user (admin can be disabled for security)"""
    try:
        user = get_user_by_username(username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Special warning for admin
        if username == "admin" and user.get("is_active", False):
            # Admin is being disabled - add warning in response
            update_data = {"is_active": False}
            if update_user(username, update_data):
                return {
                    "message": "Admin user disabled successfully", 
                    "warning": "Admin user has been disabled. Make sure you have another active admin user."
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to disable admin user")
        else:
            # Toggle status for non-admin or enabling admin
            new_status = not user.get("is_active", False)
            update_data = {"is_active": new_status}
            
            if update_user(username, update_data):
                action = "enabled" if new_status else "disabled"
                return {"message": f"User {username} {action} successfully"}
            else:
                raise HTTPException(status_code=500, detail="Failed to update user status")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error toggling user status: {str(e)}")

@app.delete("/users/{username}")
async def delete_user_endpoint(username: str):
    """Delete a user (admin can only be deleted if disabled)"""
    try:
        user = get_user_by_username(username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Special handling for admin user
        if username == "admin":
            if user.get("is_active", False):
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot delete active admin user. Disable the admin user first."
                )
            # Admin is disabled, allow deletion with warning
            if delete_user(username):
                return {
                    "message": "Admin user deleted successfully",
                    "warning": "Admin user has been permanently deleted. Make sure you have another admin user."
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to delete admin user")
        else:
            # Regular user deletion
            if delete_user(username):
                return {"message": f"User {username} deleted successfully"}
            else:
                raise HTTPException(status_code=500, detail="Failed to delete user")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting user: {str(e)}")

@app.get("/users/{username}")
async def get_user_info(username: str):
    """Get user information"""
    try:
        user = get_user_by_username(username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserResponse(
            username=user["username"],
            is_active=user.get("is_active", False),
            is_default=user.get("is_default", False),
            created_at=user.get("created_at", ""),
            last_login=user.get("last_login"),
            login_attempts=user.get("login_attempts", 0)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting user info: {str(e)}")

# Configuration Management Endpoints

@app.get("/config/check")
def check_config():
    """Check if configuration exists (for initial setup detection)"""
    try:
        exists = config_exists()
        config_data = None
        
        if exists:
            config_data = load_config()
            if config_data is None:
                # File exists but couldn't be loaded
                exists = False
        
        return {
            "configured": exists,
            "config_file_exists": os.path.exists(CONFIG_FILE_PATH),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "configured": False,
            "config_file_exists": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/config")
def get_config():
    """Get current configuration"""
    try:
        if not config_exists():
            # Return default config if file doesn't exist
            default_config = get_default_config()
            return {
                "config": default_config,
                "is_default": True,
                "message": "Using default configuration - no config.json found"
            }
        
        config_data = load_config()
        if config_data is None:
            raise HTTPException(status_code=500, detail="Could not load configuration file")
        
        return {
            "config": config_data,
            "is_default": False,
            "message": "Configuration loaded from config.json"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading configuration: {str(e)}")

@app.post("/config")
def save_config_endpoint(config_request: ConfigRequest):
    """Save configuration to config.json"""
    try:
        # Load existing config or use defaults
        current_config = load_config() or get_default_config()
        
        # Update only provided sections
        if config_request.app is not None:
            current_config["app"].update(config_request.app)
        
        if config_request.logging is not None:
            current_config["logging"].update(config_request.logging)
        
        if config_request.security is not None:
            current_config["security"].update(config_request.security)
        
        if config_request.github is not None:
            current_config["github"].update(config_request.github)
        
        # Add timestamp
        current_config["last_modified"] = datetime.now().isoformat()
        
        # Save to file
        if save_config(current_config):
            return {
                "message": "Configuration saved successfully",
                "config": current_config,
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to save configuration")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving configuration: {str(e)}")

@app.put("/config")
def update_config(full_config: FullConfig):
    """Update entire configuration"""
    try:
        config_dict = {
            "app": full_config.app.dict(),
            "logging": full_config.logging.dict(),
            "security": full_config.security.dict(),
            "github": full_config.github.dict(),
            "last_modified": datetime.now().isoformat()
        }
        
        if save_config(config_dict):
            return {
                "message": "Configuration updated successfully",
                "config": config_dict,
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update configuration")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating configuration: {str(e)}")

# ========================================
# APPLICATION LOGGING ENDPOINTS
# ========================================

APP_LOG_FILE = "./logs/app_log.log"

def ensure_app_log_directory():
    """Ensure the logs directory exists"""
    os.makedirs(os.path.dirname(APP_LOG_FILE), exist_ok=True)

def write_app_log(timestamp, level, category, message, details=None, user="anonymous", session=""):
    """Write an application log entry"""
    ensure_app_log_directory()
    
    # Format: 2025-07-02 22:30:15 [INFO] CONFIG_CHANGE: Backend URL configured - {"url": "http://192.168.100.48:8000", "user": "admin"}
    log_details = ""
    if details:
        # Sanitize details - remove passwords
        if isinstance(details, dict):
            sanitized_details = {}
            for key, value in details.items():
                if any(pwd_key in key.lower() for pwd_key in ['password', 'pass', 'token', 'secret']):
                    sanitized_details[key] = "***HIDDEN***"
                else:
                    sanitized_details[key] = value
            log_details = f" - {json.dumps(sanitized_details, ensure_ascii=False)}"
        else:
            log_details = f" - {details}"
    
    # Include user info in details
    user_info = {"user": user}
    if session:
        user_info["session"] = session
    
    if log_details:
        # Merge user info with existing details
        try:
            existing_details = json.loads(log_details[3:])  # Remove " - "
            if isinstance(existing_details, dict):
                existing_details.update(user_info)
                log_details = f" - {json.dumps(existing_details, ensure_ascii=False)}"
            else:
                log_details += f" | User: {user}"
        except:
            log_details += f" | User: {user}"
    else:
        log_details = f" - {json.dumps(user_info, ensure_ascii=False)}"
    
    log_entry = f"{timestamp} [{level}] {category}: {message}{log_details}\n"
    
    try:
        with open(APP_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception as e:
        print(f"Failed to write app log: {e}")

class AppLogEntry(BaseModel):
    timestamp: str
    level: str
    category: str
    message: str
    details: Optional[dict] = None
    user: Optional[str] = "anonymous"
    session: Optional[str] = ""

@app.post("/logs/app")
async def save_app_log(log_entry: AppLogEntry, request: Request):
    """Save an application log entry"""
    try:
        write_app_log(
            timestamp=log_entry.timestamp,
            level=log_entry.level,
            category=log_entry.category,
            message=log_entry.message,
            details=log_entry.details,
            user=log_entry.user,
            session=log_entry.session
        )
        return {"success": True, "message": "Log entry saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save log entry: {str(e)}")

@app.get("/logs/app")
async def get_app_logs(request: Request, limit: int = 1000):
    """Get application log entries"""
    try:
        ensure_app_log_directory()
        
        if not os.path.exists(APP_LOG_FILE):
            return {"logs": [], "total": 0}
        
        logs = []
        with open(APP_LOG_FILE, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            
        # Get the last 'limit' lines
        recent_lines = all_lines[-limit:] if len(all_lines) > limit else all_lines
        
        for line in recent_lines:
            line = line.strip()
            if line:
                logs.append(line)
        
        return {
            "logs": logs,
            "total": len(logs),
            "file_exists": True,
            "total_lines_in_file": len(all_lines)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read app logs: {str(e)}")

# PREDICTION LOGS ENDPOINT
# ========================================

PREDICTION_LOG_FILE = "./logs/predictions.log"

@app.get("/logs/predictions")
async def get_prediction_logs(request: Request, limit: int = 1000):
    """Get prediction log entries"""
    try:
        # Ensure the logs directory exists
        os.makedirs(os.path.dirname(PREDICTION_LOG_FILE), exist_ok=True)
        
        if not os.path.exists(PREDICTION_LOG_FILE):
            return {
                "logs": [], 
                "total": 0, 
                "file_exists": False,
                "message": "Prediction log file not found"
            }
        
        logs = []
        with open(PREDICTION_LOG_FILE, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            
        # Get the last 'limit' lines (most recent entries)
        recent_lines = all_lines[-limit:] if len(all_lines) > limit else all_lines
        
        for line in recent_lines:
            line = line.strip()
            if line:
                logs.append(line)
        
        return {
            "logs": logs,
            "total": len(logs),
            "file_exists": True,
            "total_lines_in_file": len(all_lines),
            "file_path": PREDICTION_LOG_FILE
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read prediction logs: {str(e)}")

# Endpoint the push y pull para github
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess

class GitRequest(BaseModel):
    github_token: str
    github_username: str
    repository_url: str
    branch_name: str
    local_path: str

def run_git_command(commands, cwd):
    try:
        result = subprocess.run(
            commands,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        return {"success": True, "output": result.stdout}
    except subprocess.CalledProcessError as e:
        return {"success": False, "error": e.stderr}

@app.post("/git/pull")
def git_pull(request: Optional[GitRequest] = None):
    """Git pull using configuration from config.json or provided parameters"""
    try:
        # Try to get GitHub config from config.json first
        github_config = get_github_config()
        
        if github_config:
            # Use config from file
            repo_url_with_auth = github_config["repositoryUrl"].replace(
                "https://", f"https://{github_config['githubUsername']}:{github_config['githubToken']}@"
            )
            
            run_git_command(["git", "remote", "set-url", "origin", repo_url_with_auth], github_config["localPath"])
            run_git_command(["git", "checkout", github_config["branchName"]], github_config["localPath"])
            result = run_git_command(["git", "pull", "origin", github_config["branchName"]], github_config["localPath"])
            
            return {
                **result,
                "source": "config.json",
                "message": "Git pull completed using configuration from config.json"
            }
        
        elif request:
            # Fallback to provided parameters
            repo_url_with_auth = request.repository_url.replace(
                "https://", f"https://{request.github_username}:{request.github_token}@"
            )

            run_git_command(["git", "remote", "set-url", "origin", repo_url_with_auth], request.local_path)
            run_git_command(["git", "checkout", request.branch_name], request.local_path)
            result = run_git_command(["git", "pull", "origin", request.branch_name], request.local_path)
            
            return {
                **result,
                "source": "request_parameters",
                "message": "Git pull completed using provided parameters"
            }
        
        else:
            raise HTTPException(
                status_code=400, 
                detail="No GitHub configuration found in config.json and no parameters provided. Please configure GitHub settings first."
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Git pull error: {str(e)}")

@app.post("/git/push")
def git_push(request: Optional[GitRequest] = None):
    """Git push using configuration from config.json or provided parameters"""
    try:
        # Try to get GitHub config from config.json first
        github_config = get_github_config()
        
        if github_config:
            # Use config from file
            repo_url_with_auth = github_config["repositoryUrl"].replace(
                "https://", f"https://{github_config['githubUsername']}:{github_config['githubToken']}@"
            )
            
            run_git_command(["git", "remote", "set-url", "origin", repo_url_with_auth], github_config["localPath"])
            run_git_command(["git", "checkout", github_config["branchName"]], github_config["localPath"])
            run_git_command(["git", "add", "."], github_config["localPath"])
            run_git_command(["git", "commit", "-m", "Automated commit from web app"], github_config["localPath"])
            result = run_git_command(["git", "push", "origin", github_config["branchName"]], github_config["localPath"])
            
            return {
                **result,
                "source": "config.json",
                "message": "Git push completed using configuration from config.json"
            }
        
        elif request:
            # Fallback to provided parameters
            repo_url_with_auth = request.repository_url.replace(
                "https://", f"https://{request.github_username}:{request.github_token}@"
            )

            run_git_command(["git", "remote", "set-url", "origin", repo_url_with_auth], request.local_path)
            run_git_command(["git", "checkout", request.branch_name], request.local_path)
            run_git_command(["git", "add", "."], request.local_path)
            run_git_command(["git", "commit", "-m", "Automated commit from web app"], request.local_path)
            result = run_git_command(["git", "push", "origin", request.branch_name], request.local_path)
            
            return {
                **result,
                "source": "request_parameters", 
                "message": "Git push completed using provided parameters"
            }
        
        else:
            raise HTTPException(
                status_code=400,
                detail="No GitHub configuration found in config.json and no parameters provided. Please configure GitHub settings first."
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Git push error: {str(e)}")

# Endpoint: User system health check
@app.get("/health")
def user_health_check():
    """Health check endpoint specifically for user management system"""
    try:
        # Test that we can decrypt user data
        data = decrypt_data()
        users = data.get("users", [])
        user_count = len(users)
        
        # Check if admin user exists
        admin_exists = any(user["username"] == "admin" for user in users)
        
        # Check configuration status
        config_status = {
            "file_exists": config_exists(),
            "can_load": False,
            "github_configured": False
        }
        
        if config_status["file_exists"]:
            config_data = load_config()
            config_status["can_load"] = config_data is not None
            
            if config_data:
                github_config = config_data.get("github", {})
                config_status["github_configured"] = all([
                    github_config.get("githubToken"),
                    github_config.get("githubUsername"),
                    github_config.get("repositoryUrl"),
                    github_config.get("branchName"),
                    github_config.get("localPath")
                ])
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "user_system": {
                "encryption": "working",
                "total_users": user_count,
                "admin_exists": admin_exists,
                "files": {
                    "encrypted_data": "userandpassword.encrypted",
                    "encryption_key": "encryption.key",
                    "salt_key": "salt.key"
                }
            },
            "configuration": config_status,
            "version": "1.0"
        }
    except Exception as e:
        return {
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
            "user_system": "failed",
            "configuration": {"status": "unknown"}
        }

# Endpoint: Health check
@app.get("/")
def health_check(http_request: Request):
    # logging section
    if ENABLE_LOGGING:
        log_event(
            tag="health_check",
            message="Health check status request",
            request=http_request
        )
    
    return {"status": "ok"}