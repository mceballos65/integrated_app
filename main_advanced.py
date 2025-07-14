from fastapi import FastAPI, HTTPException, Request, APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
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
    create_user,
    save_github_token,
    get_github_token,
    delete_github_token,
    github_token_exists
)

# Importar config_handler para los nuevos endpoints
import config_handler

from config import SIMILARITY_THRESHOLD, ENABLE_LOGGING

setup_logging()

app = FastAPI()

# Nombre de archivo de configuración por defecto
CONFIG_FILE = "app_data/config/app_config.json"

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
    account_code: Optional[str] = ""

class LoggingConfig(BaseModel):
    logFileLocation: Optional[str] = "./app_data/logs/predictions.log"
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
CONFIG_FILE_PATH = "app_data/config/app_config.json"

def get_default_config():
    """Returns the default configuration structure"""
    return {
        "app": {
            "prediction_url": "",
            "account_code": ""
        },
        "logging": {
            "logFileLocation": "./app_data/logs/predictions.log",
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
    return config_handler.config_exists(config_handler.DEFAULT_CONFIG_FILENAME)

def load_config():
    """Load configuration from config.json (tokens managed separately)"""
    try:
        config = config_handler.load_config(config_handler.DEFAULT_CONFIG_FILENAME)
        # Ensure no tokens are returned from this function
        if config and "github" in config:
            config["github"].pop("githubToken", None)
            config["github"].pop("token", None)
        return config
    except Exception as e:
        print(f"Error loading config: {e}")
        return None

def save_config(config_data):
    """Save configuration to config.json (tokens managed separately)"""
    try:
        # Use config_handler which automatically sanitizes tokens
        saved_config = config_handler.save_config(config_data, config_handler.DEFAULT_CONFIG_FILENAME)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False

def get_github_config():
    """Get GitHub configuration for git operations"""
    config = load_config()
    if not config or not config.get("github"):
        return None
    
    github_config = config["github"].copy()
    
    # Get the encrypted token from secure storage
    encrypted_token = get_github_token()
    if not encrypted_token:
        print("No GitHub token found in encrypted storage")
        return None
    
    # Add the token to the config (this is only in memory, never saved to file)
    github_config["githubToken"] = encrypted_token
    
    # Validate required fields
    required_fields = ["githubToken", "githubUsername", "repositoryUrl", "branchName", "localPath"]
    for field in required_fields:
        if not github_config.get(field):
            print(f"Missing required GitHub config field: {field}")
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
def put_config(config_data: dict):
    """Replace entire configuration"""
    try:
        saved_config = save_config(config_data)
        
        # Update local disabled matchers
        if 'disabled_matchers' in config_data:
            save_disabled_by_matcher(config_data['disabled_matchers'])
            
        return {
            "config": saved_config,
            "message": "Configuration updated successfully",
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating configuration: {str(e)}")

# Nuevos endpoints para el manejo de configuración con app_config.json

@app.get("/api/config/exists")
async def check_config_exists(file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Verifica si existe un archivo de configuración específico"""
    try:
        exists = config_handler.config_exists(file)
        return {"exists": exists}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking config file: {str(e)}")

@app.get("/api/config/load")
async def load_config_endpoint(file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Carga la configuración desde un archivo específico"""
    try:
        config = config_handler.load_config(file)
        is_default = not config_handler.config_exists(file)
        
        # Sanitize response to add hasToken flag and remove any token fields
        sanitized_config = sanitize_config_response(config)
        
        return {"config": sanitized_config, "is_default": is_default}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading config: {str(e)}")

@app.post("/api/config/save")
async def save_config_endpoint(config_update: Dict[str, Any], file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Guarda la configuración completa en un archivo específico"""
    try:
        # Handle GitHub token separately if provided
        github_token = None
        if "github" in config_update and "githubToken" in config_update["github"]:
            github_token = config_update["github"]["githubToken"]
            # Remove token from config_update to prevent storage in config file
            del config_update["github"]["githubToken"]
        
        # Save main config (without token)
        config = config_handler.save_config(config_update, file)
        
        # Handle GitHub token securely if provided
        if github_token:
            if github_token.strip():  # Only save non-empty tokens
                save_github_token(github_token.strip())
            else:
                # Empty token means delete existing token
                delete_github_token()
        
        # Sanitize response
        sanitized_config = sanitize_config_response(config)
        
        return {"config": sanitized_config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving config: {str(e)}")

@app.patch("/api/config/update")
async def update_config_endpoint(config_update: Dict[str, Any], file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Actualiza parcialmente la configuración existente"""
    try:
        # Handle GitHub token separately if provided
        github_token = None
        if "github" in config_update and "githubToken" in config_update["github"]:
            github_token = config_update["github"]["githubToken"]
            # Remove token from config_update to prevent storage in config file
            del config_update["github"]["githubToken"]
            # If github section is now empty, remove it entirely
            if not config_update["github"]:
                del config_update["github"]
        
        # Update main config (without token)
        config = config_handler.update_config(config_update, file)
        
        # Handle GitHub token securely if provided
        if github_token:
            if github_token.strip():  # Only save non-empty tokens
                save_github_token(github_token.strip())
            else:
                # Empty token means delete existing token
                delete_github_token()
        
        # Remove any potential token fields from response and add hasToken flag
        response_config = sanitize_config_response(config)
        
        return {"config": response_config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating config: {str(e)}")

@app.put("/api/config/replace")
async def replace_config_endpoint(config_update: Dict[str, Any], file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Reemplaza completamente la configuración existente"""
    try:
        # Handle GitHub token separately if provided
        github_token = None
        if "github" in config_update and "githubToken" in config_update["github"]:
            github_token = config_update["github"]["githubToken"]
            # Remove token from config_update to prevent storage in config file
            del config_update["github"]["githubToken"]
        
        # Replace main config (without token)
        config = config_handler.save_config(config_update, file)
        
        # Handle GitHub token securely if provided
        if github_token:
            if github_token.strip():  # Only save non-empty tokens
                save_github_token(github_token.strip())
            else:
                # Empty token means delete existing token
                delete_github_token()
        
        # Remove any potential token fields from response and add hasToken flag
        response_config = sanitize_config_response(config)
        
        return {"config": response_config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error replacing config: {str(e)}")

@app.delete("/api/config/delete")
async def delete_config_endpoint(file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Elimina un archivo de configuración específico"""
    try:
        success = config_handler.delete_config(file)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting config: {str(e)}")
# ========================================
# APPLICATION LOGGING ENDPOINTS
# ========================================

APP_LOG_FILE = "./app_data/logs/app_log.log"

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

PREDICTION_LOG_FILE = "./app_data/logs/predictions.log"

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
                    "encrypted_data": "app_data/config/userandpassword.encrypted",
                    "encryption_key": "app_data/config/encryption.key",
                    "salt_key": "app_data/config/salt.key"
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

@app.post("/api/config/mark-edited")
async def mark_config_as_edited(request: Request, file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Marca una sección de configuración como editada"""
    try:
        data = await request.json()
        section = data.get("section")
        
        if not section:
            raise HTTPException(status_code=400, detail="Section parameter is required")
            
        # Cargar configuración actual
        config = config_handler.load_config(file)
        
        # Verificar que existe la sección de edited_configs
        if "edited_configs" not in config:
            config["edited_configs"] = {
                "backend": False,
                "app": False,
                "security": False,
                "github": False,
                "logging": False,
                "user_management": False
            }
            
        # Marcar la sección como editada
        if section in config["edited_configs"]:
            config["edited_configs"][section] = True
            
            # Guardar la configuración actualizada
            result = config_handler.save_config(config, file)
            return {"success": True, "config": result}
        else:
            raise HTTPException(status_code=400, detail=f"Unknown config section: {section}")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error marking config as edited: {str(e)}")

@app.get("/api/config/edited-status")
def get_edited_status(file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Obtiene el estado de edición de todas las secciones de configuración"""
    try:
        config = config_handler.load_config(file)
        
        # Si no existe la sección de edited_configs, crearla con valores predeterminados
        if "edited_configs" not in config:
            config["edited_configs"] = {
                "backend": False,
                "app": False,
                "security": False,
                "github": False,
                "logging": False,
                "user_management": False
            }
            # Guardar la configuración actualizada
            config_handler.save_config(config, file)
            
        return {"edited_configs": config["edited_configs"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting edited status: {str(e)}")

# ========================================
# LOG CLEANUP FUNCTIONALITY
# ========================================

import time
import threading
from datetime import datetime, timedelta

def clean_logs(log_file_path=None, max_entries=None):
    """
    Limpia un archivo de log para mantener solo las entradas más recientes
    según el máximo configurado en app_config.json
    
    Args:
        log_file_path: Ruta al archivo de log (si es None, se toma de la configuración)
        max_entries: Número máximo de entradas a mantener (si es None, se toma de la configuración)
        
    Returns:
        dict: Información sobre la operación de limpieza
    """
    try:
        # Obtener la configuración actual
        config = config_handler.load_config(CONFIG_FILE)
        
        # Si no se proporcionaron parámetros, usar los valores de la configuración
        if log_file_path is None:
            log_file_path = config.get("logging", {}).get("file_location", "./app_data/logs/predictions.log")
        
        if max_entries is None:
            max_entries = config.get("logging", {}).get("max_entries", 50000)
            
        # Asegurar que max_entries sea un número entero positivo
        max_entries = max(1, int(max_entries))
        
        # Verificar que el archivo existe
        if not os.path.exists(log_file_path):
            return {
                "success": False, 
                "message": f"Log file not found: {log_file_path}",
                "entries_removed": 0,
                "entries_kept": 0
            }
        
        # Leer todas las líneas del archivo
        with open(log_file_path, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            
        total_entries = len(all_lines)
        
        # Si el archivo tiene menos entradas que el máximo, no hay que hacer nada
        if total_entries <= max_entries:
            return {
                "success": True,
                "message": f"No cleanup needed. Current entries ({total_entries}) are below max limit ({max_entries})",
                "entries_removed": 0,
                "entries_kept": total_entries
            }
            
        # Mantener solo las últimas 'max_entries' líneas
        entries_to_keep = all_lines[-max_entries:]
        entries_removed = total_entries - len(entries_to_keep)
        
        # Escribir las líneas a mantener de vuelta al archivo
        with open(log_file_path, "w", encoding="utf-8") as f:
            f.writelines(entries_to_keep)
            
        return {
            "success": True,
            "message": f"Log cleanup successful. Removed {entries_removed} old entries, kept {len(entries_to_keep)} recent entries",
            "entries_removed": entries_removed,
            "entries_kept": len(entries_to_keep),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Error cleaning logs: {str(e)}",
            "error": str(e)
        }

# Variables para llevar registro de la limpieza de logs
last_log_cleanup = datetime.now()
cleanup_interval = timedelta(hours=24)  # Limpiar cada 24 horas
cleanup_thread = None
cleanup_thread_running = False  # Flag to control thread execution

# Función que se ejecuta en un hilo separado para limpiar logs periódicamente
def periodic_log_cleanup():
    global last_log_cleanup, cleanup_thread_running
    
    while cleanup_thread_running:
        try:
            # Verificar si han pasado 24 horas desde la última limpieza
            now = datetime.now()
            if now - last_log_cleanup >= cleanup_interval:
                print(f"[{now.isoformat()}] Running scheduled log cleanup...")
                config = config_handler.load_config(CONFIG_FILE)
                log_file_path = config.get("logging", {}).get("file_location", "./app_data/logs/predictions.log")
                max_entries = config.get("logging", {}).get("max_entries", 50000)
                result = clean_logs(log_file_path, max_entries)
                print(f"[{now.isoformat()}] Cleanup result: {result['message']}")
                last_log_cleanup = now
                
            # Esperar 1 hora antes de volver a verificar
            time.sleep(3600)  # 3600 segundos = 1 hora
            
        except Exception as e:
            print(f"Error in periodic log cleanup: {str(e)}")
            time.sleep(3600)  # En caso de error, esperar una hora e intentar de nuevo

@app.post("/api/logs/cleanup")
async def cleanup_logs_endpoint(request: Request):
    """
    Endpoint para limpiar los logs basado en la configuración de max_entries
    """
    try:
        # Obtener la configuración actual
        config = config_handler.load_config(CONFIG_FILE)
        log_file_path = config.get("logging", {}).get("file_location", "./app_data/logs/predictions.log")
        max_entries = config.get("logging", {}).get("max_entries", 50000)
        
        # Realizar la limpieza
        result = clean_logs(log_file_path, max_entries)
        
        # Registrar la acción
        if result["success"]:
            write_app_log(
                timestamp=datetime.now().isoformat(),
                level="INFO",
                category="LOG_MAINTENANCE",
                message=f"Manual log cleanup executed. {result['message']}",
                details={
                    "removed": result["entries_removed"],
                    "kept": result["entries_kept"],
                    "max_entries": max_entries,
                    "file_path": log_file_path
                },
                user="system"
            )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during log cleanup: {str(e)}")

# Endpoint para actualizar la configuración de logs y aplicar los cambios inmediatamente
@app.post("/api/config/logs")
async def update_logs_config(request: Request):
    """
    Actualiza la configuración de logs y aplica los cambios inmediatamente
    """
    try:
        # Obtener los datos JSON del cuerpo de la solicitud
        data = await request.json()
        
        # Validar los datos
        file_location = data.get("file_location")
        max_entries = data.get("max_entries")
        
        if file_location is None and max_entries is None:
            raise HTTPException(status_code=400, detail="At least one setting (file_location or max_entries) must be provided")
        
        # Construir el objeto de actualización
        config_update = {"logging": {}}
        
        if file_location is not None:
            config_update["logging"]["file_location"] = file_location
            
        if max_entries is not None:
            try:
                max_entries = int(max_entries)
                if max_entries <= 0:
                    raise ValueError("max_entries must be a positive integer")
                config_update["logging"]["max_entries"] = max_entries
            except ValueError:
                raise HTTPException(status_code=400, detail="max_entries must be a valid positive integer")
        
        # Actualizar la configuración
        updated_config = config_handler.update_config(config_update, CONFIG_FILE)
        
        # Marcar la configuración de logs como editada
        if "edited_configs" not in updated_config:
            updated_config["edited_configs"] = {}
        updated_config["edited_configs"]["logging"] = True
        config_handler.save_config(updated_config, CONFIG_FILE)
        
        # Aplicar inmediatamente los cambios si se actualizó max_entries
        cleanup_result = None
        if max_entries is not None:
            cleanup_result = clean_logs(
                log_file_path=updated_config.get("logging", {}).get("file_location"),
                max_entries=updated_config.get("logging", {}).get("max_entries")
            )
            
            # Registrar la acción
            if cleanup_result and cleanup_result["success"]:
                write_app_log(
                    timestamp=datetime.now().isoformat(),
                    level="INFO",
                    category="LOG_CONFIG",
                    message=f"Log settings updated and cleanup performed. {cleanup_result.get('message', '')}",
                    details={
                        "file_location": updated_config.get("logging", {}).get("file_location"),
                        "max_entries": updated_config.get("logging", {}).get("max_entries"),
                        "removed": cleanup_result.get("entries_removed", 0),
                        "kept": cleanup_result.get("entries_kept", 0)
                    }
                )
        
        return {
            "success": True,
            "config": updated_config,
            "cleanup_result": cleanup_result,
            "message": "Log configuration updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating log configuration: {str(e)}")

# Limpiar logs al iniciar la aplicación
@app.on_event("startup")
async def startup_event():
    """
    Evento ejecutado al iniciar la aplicación
    - Limpia los logs según la configuración actual
    - Inicia el hilo de limpieza periódica
    """
    try:
        print(f"[{datetime.now().isoformat()}] Application startup - Cleaning logs...")
        config = config_handler.load_config(CONFIG_FILE)
        log_file_path = config.get("logging", {}).get("file_location", "./app_data/logs/predictions.log")
        max_entries = config.get("logging", {}).get("max_entries", 50000)
        
        result = clean_logs(log_file_path, max_entries)
        print(f"[{datetime.now().isoformat()}] Initial log cleanup result: {result['message']}")
        
        # Iniciar el hilo de limpieza periódica
        global last_log_cleanup, cleanup_thread, cleanup_thread_running
        last_log_cleanup = datetime.now()  # Registrar el momento de la primera limpieza
        
        # Asegurarse de que no haya un hilo ya en ejecución
        if cleanup_thread is None or not cleanup_thread.is_alive():
            cleanup_thread_running = True
            cleanup_thread = threading.Thread(target=periodic_log_cleanup, daemon=True)
            cleanup_thread.start()
            print(f"[{datetime.now().isoformat()}] Log cleanup thread started")
        
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] Error during startup log cleanup: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """
    Evento ejecutado al detener la aplicación
    - Detiene el hilo de limpieza periódica
    """
    try:
        global cleanup_thread_running, cleanup_thread
        
        # Detener el hilo de limpieza
        if cleanup_thread and cleanup_thread.is_alive():
            print(f"[{datetime.now().isoformat()}] Stopping log cleanup thread...")
            cleanup_thread_running = False
            
            # Esperar hasta 5 segundos a que el hilo termine
            cleanup_thread.join(timeout=5.0)
            
            if cleanup_thread.is_alive():
                print(f"[{datetime.now().isoformat()}] Warning: Log cleanup thread did not terminate gracefully")
            else:
                print(f"[{datetime.now().isoformat()}] Log cleanup thread stopped successfully")
        
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] Error during application shutdown: {str(e)}")

@app.get("/api/logs/cleanup/status")
async def get_log_cleanup_status():
    """
    Obtener información sobre el estado de la limpieza de logs
    """
    global last_log_cleanup, cleanup_thread, cleanup_thread_running
    
    try:
        # Obtener la configuración actual
        config = config_handler.load_config(CONFIG_FILE)
        log_file_path = config.get("logging", {}).get("file_location", "./app_data/logs/predictions.log")
        max_entries = config.get("logging", {}).get("max_entries", 50000)
        
        # Verificar si el archivo existe
        file_exists = os.path.exists(log_file_path)
        file_size = 0
        line_count = 0
        
        if file_exists:
            file_size = os.path.getsize(log_file_path)
            
            # Contar líneas sin cargar todo el archivo en memoria
            with open(log_file_path, 'r', encoding='utf-8') as f:
                for _ in f:
                    line_count += 1
        
        next_cleanup = last_log_cleanup + cleanup_interval
        
        # Verificar el estado del hilo de limpieza
        thread_status = "running" if cleanup_thread and cleanup_thread.is_alive() else "stopped"
        
        return {
            "last_cleanup": last_log_cleanup.isoformat(),
            "next_scheduled_cleanup": next_cleanup.isoformat(),
            "cleanup_interval_hours": cleanup_interval.total_seconds() / 3600,
            "time_until_next_cleanup": str(next_cleanup - datetime.now()),
            "cleanup_thread_status": thread_status,
            "log_config": {
                "file_path": log_file_path,
                "max_entries": max_entries,
                "file_exists": file_exists,
                "file_size_bytes": file_size,
                "current_entries": line_count
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving log cleanup status: {str(e)}")

# Nuevos modelos Pydantic para la gestión de componentes
class ComponentCreate(BaseModel):
    name: str
    value: str
    description: Optional[str] = ""
    enabled: Optional[bool] = True

class ComponentUpdate(BaseModel):
    name: Optional[str] = None
    value: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None

class ComponentResponse(BaseModel):
    id: str
    name: str
    value: str
    description: str
    enabled: bool

# ========================================
# ENDPOINTS DE GESTIÓN DE COMPONENTES
# ========================================

components = []  # Almacenamiento en memoria para los componentes

# Endpoint: Agregar componente
@app.post("/components")
def add_component(component_data: ComponentCreate):
    """Agregar un nuevo componente"""
    new_component = {
        "id": str(uuid.uuid4()),
        "name": component_data.name,
        "value": component_data.value,
        "description": component_data.description or "",
        "enabled": component_data.enabled if component_data.enabled is not None else True
    }
    components.append(new_component)
    
    # Guardar en archivo (opcional)
    # save_components_to_file(components)
    
    return {"message": "Componente agregado", "id": new_component["id"]}

# Endpoint: Listar componentes
@app.get("/components", response_model=List[ComponentResponse])
def list_components():
    """Listar todos los componentes"""
    return components

# Endpoint: Obtener información de un componente
@app.get("/components/{component_id}", response_model=ComponentResponse)
def get_component(component_id: str):
    """Obtener información detallada de un componente"""
    component = next((c for c in components if c["id"] == component_id), None)
    if not component:
        raise HTTPException(status_code=404, detail="Componente no encontrado")
    
    return component

# Endpoint: Modificar componente
@app.put("/components/{component_id}")
def update_component(component_id: str, component_data: ComponentUpdate):
    """Modificar un componente existente"""
    component = next((c for c in components if c["id"] == component_id), None)
    if not component:
        raise HTTPException(status_code=404, detail="Componente no encontrado")
    
    # Actualizar campos
    if component_data.name is not None:
        component["name"] = component_data.name
    if component_data.value is not None:
        component["value"] = component_data.value
    if component_data.description is not None:
        component["description"] = component_data.description
    if component_data.enabled is not None:
        component["enabled"] = component_data.enabled
    
    # Guardar en archivo (opcional)
    # save_components_to_file(components)
    
    return {"message": "Componente modificado"}

# Endpoint: Eliminar componente
@app.delete("/components/{component_id}")
def delete_component(component_id: str):
    """Eliminar un componente"""
    global components
    components = [c for c in components if c["id"] != component_id]
    
    # Guardar en archivo (opcional)
    # save_components_to_file(components)
    
    return {"message": "Componente eliminado"}

# Component management functions
COMPONENT_LIST_FILE = "app_data/config/component_list.json"

def load_components():
    """Load components from component_list.json"""
    try:
        if not os.path.exists(COMPONENT_LIST_FILE):
            # Create default components if file doesn't exist
            default_components = {
                "components": [
                    {
                        "id": "windows",
                        "name": "Windows",
                        "value": "windows",
                        "description": "Windows operating system components",
                        "enabled": True
                    },
                    {
                        "id": "linux", 
                        "name": "Linux",
                        "value": "linux",
                        "description": "Linux operating system components",
                        "enabled": True
                    },
                    {
                        "id": "network",
                        "name": "Network",
                        "value": "network", 
                        "description": "Network infrastructure components",
                        "enabled": True
                    }
                ]
            }
            save_components(default_components)
            return default_components
        
        with open(COMPONENT_LIST_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Error loading components: {e}")
        return {"components": []}

def save_components(components_data):
    """Save components to component_list.json"""
    try:
        os.makedirs(os.path.dirname(COMPONENT_LIST_FILE), exist_ok=True)
        with open(COMPONENT_LIST_FILE, 'w', encoding='utf-8') as f:
            json.dump(components_data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error(f"Error saving components: {e}")
        return False

def get_component_by_id(component_id):
    """Get a specific component by ID"""
    components_data = load_components()
    for component in components_data.get("components", []):
        if component.get("id") == component_id:
            return component
    return None

def generate_component_id(name, value):
    """Generate a unique ID for a component"""
    # Use value as base, fallback to name, then random UUID
    base_id = (value or name or str(uuid.uuid4())).lower().replace(" ", "-")
    components_data = load_components()
    existing_ids = [comp.get("id") for comp in components_data.get("components", [])]
    
    if base_id not in existing_ids:
        return base_id
    
    # If ID exists, append number
    counter = 1
    while f"{base_id}-{counter}" in existing_ids:
        counter += 1
    return f"{base_id}-{counter}"

# Component management endpoints

@app.get("/api/components", response_model=Dict[str, List[ComponentResponse]])
async def get_components():
    """Get all components"""
    try:
        components_data = load_components()
        return {"components": components_data.get("components", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading components: {str(e)}")

@app.get("/api/components/enabled", response_model=Dict[str, List[ComponentResponse]])
async def get_enabled_components():
    """Get only enabled components"""
    try:
        components_data = load_components()
        enabled_components = [
            comp for comp in components_data.get("components", []) 
            if comp.get("enabled", True)
        ]
        return {"components": enabled_components}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading enabled components: {str(e)}")

@app.get("/api/components/{component_id}", response_model=ComponentResponse)
async def get_component(component_id: str):
    """Get a specific component by ID"""
    try:
        component = get_component_by_id(component_id)
        if not component:
            raise HTTPException(status_code=404, detail="Component not found")
        return component
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading component: {str(e)}")

@app.post("/api/components", response_model=ComponentResponse)
async def create_component(component: ComponentCreate):
    """Create a new component"""
    try:
        components_data = load_components()
        
        # Check if value already exists
        existing_values = [comp.get("value") for comp in components_data.get("components", [])]
        if component.value in existing_values:
            raise HTTPException(status_code=400, detail="Component value already exists")
        
        # Generate unique ID
        new_id = generate_component_id(component.name, component.value)
        
        # Create new component
        new_component = {
            "id": new_id,
            "name": component.name,
            "value": component.value,
            "description": component.description or "",
            "enabled": component.enabled
        }
        
        # Add to components list
        components_data["components"].append(new_component)
        
        # Save to file
        if not save_components(components_data):
            raise HTTPException(status_code=500, detail="Error saving component")
        
        return new_component
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating component: {str(e)}")

@app.put("/api/components/{component_id}", response_model=ComponentResponse)
async def update_component(component_id: str, component_update: ComponentUpdate):
    """Update an existing component"""
    try:
        components_data = load_components()
        
        # Find component index
        component_index = None
        for i, comp in enumerate(components_data.get("components", [])):
            if comp.get("id") == component_id:
                component_index = i
                break
        
        if component_index is None:
            raise HTTPException(status_code=404, detail="Component not found")
        
        # Check if new value conflicts with existing ones (excluding current component)
        if component_update.value:
            existing_values = [
                comp.get("value") for i, comp in enumerate(components_data.get("components", []))
                if i != component_index
            ]
            if component_update.value in existing_values:
                raise HTTPException(status_code=400, detail="Component value already exists")
        
        # Update component fields
        current_component = components_data["components"][component_index]
        if component_update.name is not None:
            current_component["name"] = component_update.name
        if component_update.value is not None:
            current_component["value"] = component_update.value
        if component_update.description is not None:
            current_component["description"] = component_update.description
        if component_update.enabled is not None:
            current_component["enabled"] = component_update.enabled
        
        # Save to file
        if not save_components(components_data):
            raise HTTPException(status_code=500, detail="Error saving component")
        
        return current_component
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating component: {str(e)}")

@app.delete("/api/components/{component_id}")
async def delete_component(component_id: str):
    """Delete a component"""
    try:
        components_data = load_components()
        
        # Find and remove component
        original_count = len(components_data.get("components", []))
        components_data["components"] = [
            comp for comp in components_data.get("components", [])
            if comp.get("id") != component_id
        ]
        
        if len(components_data["components"]) == original_count:
            raise HTTPException(status_code=404, detail="Component not found")
        
        # Save to file
        if not save_components(components_data):
            raise HTTPException(status_code=500, detail="Error saving components")
        
        return {"message": "Component deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting component: {str(e)}")

@app.post("/api/components/{component_id}/toggle")
async def toggle_component(component_id: str):
    """Toggle component enabled status"""
    try:
        components_data = load_components()
        
        # Find component
        component = None
        for comp in components_data.get("components", []):
            if comp.get("id") == component_id:
                component = comp
                break
        
        if not component:
            raise HTTPException(status_code=404, detail="Component not found")
        
        # Toggle enabled status
        component["enabled"] = not component.get("enabled", True)
        
        # Save to file
        if not save_components(components_data):
            raise HTTPException(status_code=500, detail="Error saving component")
        
        return {
            "message": f"Component {'enabled' if component['enabled'] else 'disabled'} successfully",
            "component": component
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error toggling component: {str(e)}")

def sanitize_config_response(config):
    """Remove GitHub tokens from config response and add hasToken flag"""
    import copy
    sanitized_config = copy.deepcopy(config)
    
    # Handle GitHub section
    if "github" in sanitized_config:
        # Add hasToken flag
        sanitized_config["github"]["hasToken"] = github_token_exists()
        # Remove any token field that might exist
        sanitized_config["github"].pop("githubToken", None)
        sanitized_config["github"].pop("token", None)
    
    return sanitized_config

@app.patch("/api/config/update")
async def update_config_endpoint(config_update: Dict[str, Any], file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Actualiza parcialmente la configuración existente"""
    try:
        config = config_handler.update_config(config_update, file)
        
        # Sanitize response
        sanitized_config = sanitize_config_response(config)
        
        return {"config": sanitized_config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating config: {str(e)}")

# ========================================
# GITHUB TOKEN MANAGEMENT ENDPOINTS
# ========================================

class GitHubTokenRequest(BaseModel):
    token: str

@app.post("/config/github/token")
async def save_github_token_endpoint(token_request: GitHubTokenRequest):
    """Save GitHub token securely in encrypted storage"""
    try:
        token = token_request.token.strip()
        if not token:
            raise HTTPException(status_code=400, detail="Token cannot be empty")
        
        success = save_github_token(token)
        if success:
            return {
                "success": True,
                "message": "GitHub token saved securely",
                "hasToken": True
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to save GitHub token")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving GitHub token: {str(e)}")

@app.get("/config/github/token/exists")
async def check_github_token_exists():
    """Check if GitHub token exists in encrypted storage"""
    try:
        exists = github_token_exists()
        return {
            "hasToken": exists,
            "message": "Token exists" if exists else "No token found"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking GitHub token: {str(e)}")

@app.delete("/config/github/token")
async def delete_github_token_endpoint():
    """Delete GitHub token from encrypted storage"""
    try:
        success = delete_github_token()
        if success:
            return {
                "success": True,
                "message": "GitHub token deleted successfully",
                "hasToken": False
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to delete GitHub token")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting GitHub token: {str(e)}")

# ========================================
