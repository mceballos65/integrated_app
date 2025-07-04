// src/hooks/useAuth.jsx
// Custom hook for user authentication and management

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import userApiService from '../services/userApi';
import useConfigStore from '../store';
import appLogger from '../services/appLogger';

// Create Auth Context
const AuthContext = createContext(null);

// Auth Provider Component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [securityWarning, setSecurityWarning] = useState(null);
  
  // Get the complete config and compute security values
  const { config, configLoaded } = useConfigStore(state => ({
    config: state.config,
    configLoaded: state.configLoaded
  }));
  
  const adminUserDisabled = config?.security?.admin_user_disabled || false;
  const debugRequiresAuth = config?.security?.debug_requires_auth || false;

  // Initialize auth state
  useEffect(() => {
    const currentUser = userApiService.getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
    
    // Check for security warnings
    const debugIsPublic = localStorage.getItem('debugRequiresAuth') !== 'true' && !debugRequiresAuth;
    const adminUserEnabled = !adminUserDisabled; // Admin user is enabled when admin_user_disabled is false
    
    console.log('Security check:', {
      adminUserDisabled,
      debugRequiresAuth,
      debugIsPublic,
      adminUserEnabled,
      configLoaded,
      config
    });
    
    if (adminUserEnabled && debugIsPublic) {
      setSecurityWarning('Multiple security issues: 1) Default administrator account is enabled. 2) Debug page is publicly accessible. Please review security settings.');
    } else if (adminUserEnabled) {
      setSecurityWarning('Default administrator account is enabled. For security reasons, please disable it and create a new administrator account.');
    } else if (debugIsPublic) {
      setSecurityWarning('Debug page is publicly accessible. For security reasons, please restrict access to authenticated users only.');
    } else {
      setSecurityWarning(null);
    }
  }, [adminUserDisabled, debugRequiresAuth, configLoaded]);

  // Login function
  const login = async (username, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await userApiService.login(username, password);
      setUser(response.user);
      setIsLoading(false);
      
      // Log successful login
      appLogger.logLogin(username);
      
      return { success: true, user: response.user };
    } catch (error) {
      setError(error.message);
      setIsLoading(false);
      
      // Log failed login attempt
      appLogger.warn('AUTH', 'Failed login attempt', { username, error: error.message });
      
      return { success: false, error: error.message };
    }
  };

  // Logout function
  const logout = () => {
    const currentUsername = user?.username;
    userApiService.logout();
    setUser(null);
    setError(null);
    
    // Log logout
    if (currentUsername) {
      appLogger.logLogout(currentUsername);
    }
  };

  // Clear error
  const clearError = () => setError(null);

  const value = {
    user,
    isLoading,
    error,
    login,
    logout,
    clearError,
    securityWarning,
    isLoggedIn: user !== null,
    isAdmin: user && user.username === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for user management operations
export function useUserManagement() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load users
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const userList = await userApiService.getUsers();
      setUsers(userList);
      setIsLoading(false);
      return { success: true, users: userList };
    } catch (error) {
      setError(error.message);
      setIsLoading(false);
      return { success: false, error: error.message };
    }
  }, []);

  // Create user
  const createUser = useCallback(async (username, password, isActive = true) => {
    setError(null);
    
    try {
      await userApiService.createUser(username, password, isActive);
      await loadUsers(); // Refresh list
      
      // Log user creation
      appLogger.logUserAction('CREATE', username, { isActive });
      
      return { success: true };
    } catch (error) {
      setError(error.message);
      appLogger.error('USER_MANAGEMENT', 'Failed to create user', { username, error: error.message });
      return { success: false, error: error.message };
    }
  }, [loadUsers]);

  // Update user
  const updateUser = useCallback(async (username, userData) => {
    setError(null);
    
    try {
      await userApiService.updateUser(username, userData);
      await loadUsers(); // Refresh list
      return { success: true };
    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
  }, [loadUsers]);

  // Delete user
  const deleteUser = useCallback(async (username) => {
    setError(null);
    
    try {
      await userApiService.deleteUser(username);
      await loadUsers(); // Refresh list
      
      // Log user deletion
      appLogger.logUserAction('DELETE', username);
      
      return { success: true };
    } catch (error) {
      setError(error.message);
      appLogger.error('USER_MANAGEMENT', 'Failed to delete user', { username, error: error.message });
      return { success: false, error: error.message };
    }
  }, [loadUsers]);

  // Toggle user status
  const toggleUserStatus = useCallback(async (username) => {
    setError(null);
    
    try {
      await userApiService.toggleUserStatus(username);
      await loadUsers(); // Refresh list
      
      // Log user status toggle
      appLogger.logUserAction('TOGGLE_STATUS', username);
      
      return { success: true };
    } catch (error) {
      setError(error.message);
      appLogger.error('USER_MANAGEMENT', 'Failed to toggle user status', { username, error: error.message });
      return { success: false, error: error.message };
    }
  }, [loadUsers]);

  // Change password
  const changePassword = useCallback(async (username, newPassword, currentPassword = null) => {
    setError(null);
    
    try {
      // For admin operations, we might not need current password
      // Let's try without current password first, then fall back if needed
      try {
        await userApiService.changePassword(username, currentPassword || '', newPassword);
      } catch (error) {
        if (error.message.includes('current_password') && !currentPassword) {
          // If current password is required but not provided, throw a more specific error
          throw new Error('Current password is required for this operation');
        }
        throw error;
      }
      
      // Log password change
      appLogger.logUserAction('CHANGE_PASSWORD', username);
      
      return { success: true };
    } catch (error) {
      setError(error.message);
      appLogger.error('USER_MANAGEMENT', 'Failed to change password', { username, error: error.message });
      return { success: false, error: error.message };
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  return {
    users,
    isLoading,
    error,
    loadUsers,
    refreshUsers: loadUsers, // Alias for loadUsers
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    changePassword,
    clearError
  };
}
