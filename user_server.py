"""
Simple FastAPI server for user management only
This version doesn't include the AI/ML features to avoid dependency issues
"""

from fastapi import FastAPI, HTTPException, Request, APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

# User management imports
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

# Importar el módulo de manejo de configuración
import config_handler

# User management models
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

# Modelos para la configuración
class ConfigUpdate(BaseModel):
    config: Dict[str, Any]

# Create FastAPI app
app = FastAPI(title="User Management API", version="1.0.0")

# Initialize user management system
print("Initializing user management system...")
initialize_default_users()
print("User management system ready!")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or replace "*" with ["http://localhost:5173"] to restrict it
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
async def root():
    return {"message": "User Management API is running", "version": "1.0.0"}

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

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
async def create_user_endpoint(user_data: UserCreate):
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
    """Enable/disable a user (cannot disable admin)"""
    try:
        if username == "admin":
            raise HTTPException(status_code=400, detail="Cannot disable admin user")
        
        user = get_user_by_username(username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Toggle status
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
    """Delete a user (cannot delete admin)"""
    try:
        if username == "admin":
            raise HTTPException(status_code=400, detail="Cannot delete admin user")
        
        user = get_user_by_username(username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
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

# Endpoints para manejo de configuración

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
        return {"config": config, "is_default": is_default}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading config: {str(e)}")

@app.post("/api/config/save")
async def save_config_endpoint(config_update: Dict[str, Any], file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Guarda la configuración completa en un archivo específico"""
    try:
        config = config_handler.save_config(config_update, file)
        return {"config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving config: {str(e)}")

@app.patch("/api/config/update")
async def update_config_endpoint(config_update: Dict[str, Any], file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Actualiza parcialmente la configuración existente"""
    try:
        config = config_handler.update_config(config_update, file)
        return {"config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating config: {str(e)}")

@app.put("/api/config/replace")
async def replace_config_endpoint(config_update: Dict[str, Any], file: str = Query(config_handler.DEFAULT_CONFIG_FILENAME)):
    """Reemplaza completamente la configuración existente"""
    try:
        config = config_handler.save_config(config_update, file)
        return {"config": config}
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

# Endpoints de compatibilidad con la API anterior
@app.get("/config")
async def get_config_compat():
    """Endpoint de compatibilidad para cargar la configuración"""
    try:
        config = config_handler.load_config(config_handler.DEFAULT_CONFIG_FILENAME)
        is_default = not config_handler.config_exists(config_handler.DEFAULT_CONFIG_FILENAME)
        return {"config": config, "is_default": is_default}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading config: {str(e)}")

@app.post("/config")
async def post_config_compat(config_update: Dict[str, Any]):
    """Endpoint de compatibilidad para actualizar la configuración"""
    try:
        config = config_handler.update_config(config_update, config_handler.DEFAULT_CONFIG_FILENAME)
        return {"config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating config: {str(e)}")

@app.put("/config")
async def put_config_compat(config_update: Dict[str, Any]):
    """Endpoint de compatibilidad para reemplazar la configuración"""
    try:
        config = config_handler.save_config(config_update, config_handler.DEFAULT_CONFIG_FILENAME)
        return {"config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error replacing config: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
