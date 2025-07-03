// src/components/LoginPageNew.jsx
// Updated Login Page using the new User API

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import kyndrylLogo from '../assets/kyndryl_logo.svg';

const LoginPageNew = ({ onLoginSuccess }) => {
  const { login, isLoading, error, clearError } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  // Debug access is now controlled by authentication status

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (error) {
      clearError();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      alert('Please fill in all fields');
      return;
    }

    // Verificar si es un intento de inicio de sesión como admin cuando está deshabilitado
    const config = JSON.parse(localStorage.getItem('kyndryl_app_config') || '{}');
    if (formData.username.toLowerCase() === 'admin' && config.adminUserDisabled === true) {
      alert('The default admin user has been disabled for security reasons. Please use a different administrator account.');
      return;
    }

    const result = await login(formData.username, formData.password);
    
    if (result.success) {
      // Reset form
      setFormData({ username: '', password: '' });
      
      // Check if there's a return URL stored in session storage
      const returnUrl = sessionStorage.getItem('returnUrl');
      if (returnUrl) {
        // Clear the return URL from session storage
        sessionStorage.removeItem('returnUrl');
        // Redirect to the stored URL
        window.location.href = returnUrl;
      }
      
      // Call success callback if provided
      if (onLoginSuccess) {
        onLoginSuccess(result.user);
      }
    }
    // Error handling is done by the useAuth hook
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-kyndryl-gray py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-6">
            <div className="h-12 flex items-center">
              <img src={kyndrylLogo} alt="Kyndryl Logo" className="h-12" />
            </div>
          </div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-kyndryl-orange bg-opacity-10">
            <svg 
              className="h-6 w-6 text-kyndryl-orange" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-kyndryl-black">
            Sign In
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            IA Event Management Tool
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
              <button
                type="button"
                onClick={clearError}
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
              >
                <svg className="fill-current h-6 w-6 text-red-500" role="button" viewBox="0 0 20 20">
                  <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
                </svg>
              </button>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={formData.username}
                onChange={handleInputChange}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-kyndryl-orange focus:border-kyndryl-orange focus:z-10 sm:text-sm"
                placeholder="Username"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-kyndryl-orange focus:border-kyndryl-orange focus:z-10 sm:text-sm"
                placeholder="Password"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-kyndryl-orange hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-kyndryl-orange disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <svg 
                      className="h-5 w-5 text-kyndryl-black group-hover:text-gray-700" 
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                  </span>
                  Sign In
                </>
              )}
            </button>
          </div>

          {/* Debug access hint - only show if debug is public */}
          {localStorage.getItem('debugRequiresAuth') !== 'true' && (
            <div className="text-center">
              <div className="bg-kyndryl-gray border border-gray-300 rounded-md p-4">
                <div className="text-sm">
                  <a 
                    href="/debug" 
                    className="text-kyndryl-orange hover:underline font-medium"
                  >
                    Access the Debug page at /debug
                  </a>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginPageNew;
