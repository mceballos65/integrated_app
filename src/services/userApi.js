// src/services/userApi.js
// User Management API Service

const API_BASE_URL = 'http://192.168.100.48:8000';

class UserApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // Helper method for making API requests
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
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
    return await this.makeRequest('/health');
  }

  // Authentication
  async login(username, password) {
    // Get fresh config from localStorage for security settings
    const config = JSON.parse(localStorage.getItem('kyndryl_app_config') || '{}');
    console.log('Login attempt by:', username);
    console.log('Admin disabled status:', config.adminUserDisabled);
    
    // The admin user can be in two states:
    // 1. Disabled via security settings (adminUserDisabled) - blocks all login attempts
    // 2. Inactive in user management (is_active=false) - can be toggled in UI
    // Both conditions are independent - security setting takes precedence
    if (username.toLowerCase() === 'admin' && config.adminUserDisabled === true) {
      console.warn('Admin login attempt blocked due to security setting');
      throw new Error('The default admin user has been disabled for security reasons. Please use a different administrator account.');
    }

    const response = await this.makeRequest('/users/login', {
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
    return await this.makeRequest('/users');
  }

  async getUser(username) {
    return await this.makeRequest(`/users/${username}`);
  }

  async createUser(username, password, isActive = true) {
    return await this.makeRequest('/users', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        is_active: isActive
      })
    });
  }

  async updateUser(username, userData) {
    return await this.makeRequest(`/users/${username}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  async deleteUser(username) {
    return await this.makeRequest(`/users/${username}`, {
      method: 'DELETE'
    });
  }

  async toggleUserStatus(username) {
    return await this.makeRequest(`/users/${username}/toggle`, {
      method: 'PUT'
    });
  }

  async changePassword(username, currentPassword, newPassword) {
    return await this.makeRequest(`/users/${username}/password`, {
      method: 'PUT',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    });
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
