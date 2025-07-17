// src/services/userApi.js
// User Management API Service
import { getBackendUrl } from '../configStorage';

// No usamos una constante fija, sino que obtenemos la URL del servicio de configuración
class UserApiService {
  constructor() {
    // La URL base se actualiza dinámicamente
    this.baseUrl = getBackendUrl();
  }
  
  // Asegurarse de que siempre usamos la última URL configurada
  getBaseUrl() {
    return getBackendUrl();
  }

  // Helper method for making API requests
  async makeRequest(endpoint, options = {}) {
    // Siempre obtenemos la URL más reciente para cada solicitud
    const currentBaseUrl = this.getBaseUrl();
    const url = `${currentBaseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      console.log(`Making API request to: ${url}`);
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    return await this.makeRequest('/api/health');
  }

  // Authentication
  async login(username, password) {
    // Intentamos cargar la configuración del backend primero
    let adminUserDisabled = false;
    try {
      // Hacemos una solicitud directa para obtener la configuración actual
      const configResponse = await fetch(`${this.getBaseUrl()}${'/api/config/load'}`);
      if (configResponse.ok) {
        const configData = await configResponse.json();
        const config = configData.config || configData;
        adminUserDisabled = config?.security?.admin_user_disabled || false;
      } else {
        // Si no podemos cargar del backend, intentamos usar la configuración de respaldo
        const fallbackConfig = localStorage.getItem('kyndryl_fallback_config');
        if (fallbackConfig) {
          const parsedConfig = JSON.parse(fallbackConfig);
          adminUserDisabled = parsedConfig?.security?.admin_user_disabled || false;
        }
      }
    } catch (error) {
      console.error("Error al obtener la configuración para login:", error);
      // Si hay error, asumimos que el admin no está deshabilitado para permitir el acceso
    }
    
    console.log('Login attempt by:', username);
    console.log('Admin disabled status:', adminUserDisabled);
    
    // The admin user can be in two states:
    // 1. Disabled via security settings (adminUserDisabled) - blocks all login attempts
    // 2. Inactive in user management (is_active=false) - can be toggled in UI
    // Both conditions are independent - security setting takes precedence
    if (username.toLowerCase() === 'admin' && adminUserDisabled === true) {
      console.warn('Admin login attempt blocked due to security setting');
      throw new Error('The default admin user has been disabled for security reasons. Please use a different administrator account.');
    }

    const response = await this.makeRequest('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    // Store user session (optional - you might want to use a proper auth token)
    if (response.user) {
      sessionStorage.setItem('currentUser', JSON.stringify(response.user));
    }
    
    return response;
  }

  // Logout (clear session)
  logout() {
    sessionStorage.removeItem('currentUser');
  }

  // Get current user from session
  getCurrentUser() {
    try {
      const userData = sessionStorage.getItem('currentUser');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // User management
  async getUsers() {
    return await this.makeRequest('/api/users');
  }

  async getUser(username) {
    return await this.makeRequest(`/api/users/${username}`);
  }

  async createUser(username, password, isActive = true) {
    const result = await this.makeRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        is_active: isActive
      })
    });
    
    // Mark user_management config section as edited
    await this.markConfigAsEdited("user_management");
    return result;
  }

  async updateUser(username, userData) {
    const result = await this.makeRequest(`/api/users/${username}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
    
    // Mark user_management config section as edited
    await this.markConfigAsEdited("user_management");
    return result;
  }

  async deleteUser(username) {
    const result = await this.makeRequest(`/api/users/${username}`, {
      method: 'DELETE'
    });
    
    // Mark user_management config section as edited
    await this.markConfigAsEdited("user_management");
    return result;
  }

  async toggleUserStatus(username) {
    const result = await this.makeRequest(`/api/users/${username}/toggle`, {
      method: 'PUT'
    });
    
    // Mark user_management config section as edited
    await this.markConfigAsEdited("user_management");
    return result;
  }

  async changePassword(username, currentPassword, newPassword) {
    const result = await this.makeRequest(`/api/users/${username}/password`, {
      method: 'PUT',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    });
    
    // Mark user_management config section as edited
    await this.markConfigAsEdited("user_management");
    return result;
  }

  // Mark config section as edited in backend
  async markConfigAsEdited(section) {
    try {
      return await this.makeRequest('/api/config/mark-edited', {
        method: 'POST',
        body: JSON.stringify({ section })
      });
    } catch (error) {
      console.error(`Error marking config section ${section} as edited:`, error);
      // Still mark it in localStorage as a fallback
      try {
        const storedConfigs = localStorage.getItem('kyndryl_edited_configs');
        const editedConfigs = storedConfigs ? JSON.parse(storedConfigs) : {};
        editedConfigs[section] = true;
        localStorage.setItem('kyndryl_edited_configs', JSON.stringify(editedConfigs));
      } catch (localError) {
        console.error('Error updating local edited configs:', localError);
      }
    }
  }

  // Utility methods
  isLoggedIn() {
    return this.getCurrentUser() !== null;
  }

  isAdmin() {
    const user = this.getCurrentUser();
    // Get config to check if admin is disabled
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    
    // If admin is disabled in config, only other admin users can be admins
    if (config.adminUserDisabled === true && user && user.username === 'admin') {
      return false;
    }
    
    return user && (user.username === 'admin' || user.is_admin === true);
  }

  // Configuration for API base URL (for production deployment)
  setApiBaseUrl(url) {
    this.baseUrl = url;
  }
}

// Create singleton instance
const userApiService = new UserApiService();

export default userApiService;

// Named exports for convenience
export const {
  login,
  logout,
  getCurrentUser,
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  changePassword,
  isLoggedIn,
  isAdmin,
  healthCheck
} = userApiService;
