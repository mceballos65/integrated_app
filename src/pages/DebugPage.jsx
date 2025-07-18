// src/pages/DebugPage.jsx
// Debug page to test the system

import React, { useState, useEffect } from 'react';
import userApiService from '../services/userApi';
import useConfigStore from '../store';

console.log('🔧 DebugPage.jsx loaded');

const DebugPage = () => {
  console.log('🔧 DebugPage component rendering');
  
  const [status, setStatus] = useState('ready');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [customUrl, setCustomUrl] = useState('http://localhost:5173');
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [adminCreationEnabled, setAdminCreationEnabled] = useState(() => {
    // Initialize from localStorage, default to true if not set
    const stored = localStorage.getItem('adminCreationEnabled');
    return stored === null ? true : stored === 'true';
  });
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);

  const configLoaded = useConfigStore(state => state.configLoaded);
  const loadConfig = useConfigStore(state => state.loadConfig);
  
  // Initial page load
  useEffect(() => {
    console.log('DebugPage loaded');
    setIsPageLoaded(true);
    
    // Check if a user is logged in
    const currentUser = userApiService.getCurrentUser();
    setIsUserLoggedIn(currentUser !== null);
    
    // Check if we should show security warning
    const checkAdminExists = async () => {
      try {
        const health = await userApiService.healthCheck();
        if (health.user_system && health.user_system.admin_exists) {
          setShowSecurityWarning(true);
        }
      } catch (err) {
        console.log('Could not check admin status:', err);
      }
    };
    
    checkAdminExists();
    
    // Load config if not already loaded
    if (!configLoaded) {
      loadConfig();
    }
  }, [configLoaded, loadConfig]);
  
  // Effect to check backend availability periodically
  useEffect(() => {
    const checkBackendAvailability = async () => {
      try {
        const { checkConfigExists } = await import('../configStorage');
        const exists = await checkConfigExists();
        if (exists) {
          console.log("Backend is available and has configuration");
        }
      } catch (error) {
        console.warn("Backend is unavailable:", error.message);
      }
    };
    
    // Check once on component mount
    checkBackendAvailability();
    
    // Check periodically (every 30 seconds)
    const intervalId = setInterval(checkBackendAvailability, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  const testAPI = async (url = null) => {
    const apiUrl = url || customUrl;
    setStatus('loading');
    setError(null);
    
    try {
      console.log('Testing API connection to:', apiUrl);
      
      // Update the service URL temporarily
      const originalUrl = userApiService.baseUrl;
      userApiService.baseUrl = apiUrl;
      
      const health = await userApiService.healthCheck();
      console.log('Health check response:', health);
      setData(health);
      setStatus('success');
      
      // Restore original URL
      userApiService.baseUrl = originalUrl;
      
    } catch (err) {
      console.error('API test failed:', err);
      setError(err.message);
      setStatus('error');
      
      // Restore original URL
      userApiService.baseUrl = userApiService.baseUrl;
    }
  };

  const testLogin = async () => {
    setError(null);
    
    try {
      console.log('Testing login...');
      
      // Update the service URL temporarily
      const originalUrl = userApiService.baseUrl;
      userApiService.baseUrl = customUrl;
      
      const response = await userApiService.login('admin', '!Passw0rd');
      console.log('Login response:', response);
      setData({ ...data, login: response });
      
      // Restore original URL
      userApiService.baseUrl = originalUrl;
      
    } catch (err) {
      console.error('Login test failed:', err);
      setError(err.message);
      
      // Restore original URL
      userApiService.baseUrl = userApiService.baseUrl;
    }
  };

  // Removing code for creation of initial admin
  /*
  const createAdminUser = async () => {
    // Check localStorage directly to ensure we have the latest value
    const isAdminCreationEnabled = localStorage.getItem('adminCreationEnabled') !== 'false';
    
    if (!isAdminCreationEnabled) {
      setError('Admin creation has been disabled for security reasons');
      return;
    }
    
    setError(null);
    
    try {
      console.log('Creating admin user...');
      
      // Update the service URL temporarily
      const originalUrl = userApiService.baseUrl;
      userApiService.baseUrl = customUrl;
      
      const response = await userApiService.createUser('admin', '!Passw0rd', true);
      console.log('Create admin response:', response);
      setData({ ...data, createAdmin: response });
      setStatus('success');
      
      // Automatically disable admin creation after successful creation
      setAdminCreationEnabled(false);
      localStorage.setItem('adminCreationEnabled', 'false');
      setShowSecurityWarning(true);
      
      // Restore original URL
      userApiService.baseUrl = originalUrl;
      
    } catch (err) {
      console.error('Create admin failed:', err);
      setError(err.message);
      
      // Restore original URL
      userApiService.baseUrl = userApiService.baseUrl;
    }
  };
  */

  const toggleAdminCreation = () => {
    const newValue = !adminCreationEnabled;
    setAdminCreationEnabled(newValue);
    localStorage.setItem('adminCreationEnabled', newValue.toString());
    if (adminCreationEnabled) { // If currently enabled (will be disabled)
      setShowSecurityWarning(true);
    }
  };

  const updateApiUrl = async () => {
    try {
      console.log('Updating API URL to:', customUrl);
      
      // Update the service URL in memory
      userApiService.baseUrl = customUrl;
      
      // Update the backend URL in configuration storage
      const { setBackendUrl } = await import('../configStorage');
      setBackendUrl(customUrl);
      
      // Update the UI state
      setStatus('ready');
      setData(null);
      setError(null);
      
      // Give feedback to user
      alert(`API URL updated to: ${customUrl}`);
    } catch (error) {
      console.error('Failed to update API URL:', error);
      setError(`Failed to update API URL: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">🔧 Debug Page</h1>
        
        {/* Quick Actions - Moved to top */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🚀 Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => setCustomUrl('http://localhost:5173')}
              className="p-3 text-left border border-gray-200 rounded hover:bg-gray-50 border-blue-300 bg-blue-50"
            >
              <div className="font-medium">Frontend (Recommended)</div>
              <div className="text-sm text-gray-500">http://localhost:5173</div>
              <div className="text-xs text-blue-600">✅ Uses Vite proxy</div>
            </button>
            
            <button
              onClick={() => setCustomUrl('http://localhost:8000')}
              className="p-3 text-left border border-gray-200 rounded hover:bg-gray-50"
            >
              <div className="font-medium">Direct Backend</div>
              <div className="text-sm text-gray-500">http://localhost:8000</div>
              <div className="text-xs text-orange-600">⚠️ Direct access</div>
            </button>
            
            <button
              onClick={() => setCustomUrl('http://127.0.0.1:5173')}
              className="p-3 text-left border border-gray-200 rounded hover:bg-gray-50"
            >
              <div className="font-medium">Frontend Alternative</div>
              <div className="text-sm text-gray-500">http://127.0.0.1:5173</div>
              <div className="text-xs text-blue-600">✅ Uses Vite proxy</div>
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="p-3 text-left border border-gray-200 rounded hover:bg-gray-50"
            >
              <div className="font-medium">Go to App</div>
              <div className="text-sm text-gray-500">Return to main app</div>
            </button>
            
            <button
              onClick={() => {
                if (confirm('¿Estás seguro que deseas restringir el acceso a la página Debug? Después de esto, los usuarios necesitarán iniciar sesión para acceder.')) {
                  alert('Acceso restringido. Ahora los usuarios necesitan iniciar sesión para acceder a la página Debug.');
                }
              }}
              className="p-3 text-left border border-gray-200 rounded hover:bg-gray-50"
            >
              <div className="font-medium">🔒 Security Info</div>
              <div className="text-sm text-gray-500">Debug page security</div>
            </button>
          </div>
        </div>

        {/* This code is commented due to initial admin creation functionality is removed */}
        {/* Security Warning
        {showSecurityWarning && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">🔒 Security Warning</h2>
            <div className="text-sm text-red-700 mb-3">
              ⚠️ Admin user creation should be disabled in production environments!<br />
              ⚠️ This debug page contains sensitive functionality.
            </div>
            <button
              onClick={toggleAdminCreation}
              className={`px-4 py-2 text-white rounded text-sm ${
                adminCreationEnabled 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {adminCreationEnabled ? '🔒 Disable Admin Creation' : '🔓 Enable Admin Creation'}
            </button>
          </div>
        )} */}
        
        {/* Page Load Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">Page Status</h2>
          <div className="text-sm text-blue-700">
            ✅ Debug page loaded successfully: {isPageLoaded ? 'YES' : 'NO'}<br />
            ✅ React is working: YES<br />
            ✅ JavaScript is working: YES
          </div>
        </div>

        {/* API Configuration */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🌐 API Configuration</h2>
          
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm text-blue-800">
              <strong>ℹ️ How it works now:</strong>
              <ul className="mt-2 ml-4 list-disc">
                <li><strong>Frontend (port 5173):</strong> All API calls go through Vite proxy → Backend</li>
                <li><strong>Direct Backend (port 8000):</strong> Direct connection (debug only)</li>
                <li><strong>Production:</strong> Only frontend port exposed, backend internal</li>
              </ul>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test URL:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="http://localhost:5173"
              />
              <button
                onClick={updateApiUrl}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Update URL
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Recommended: http://localhost:5173 (proxy), Direct: http://localhost:8000
            </p>
          </div>

          <div className="text-sm text-gray-600">
            <div><span className="font-medium">Current API Base:</span> {userApiService.baseUrl}</div>
            <div><span className="font-medium">Test URL:</span> {customUrl}</div>
          </div>
        </div>
        
        {/* API Connection Test */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🔗 API Connection Test</h2>
          
          <div className="mb-4">
            <span className="font-medium">Status: </span>
            <span className={`px-2 py-1 rounded text-sm ${
              status === 'loading' ? 'bg-yellow-100 text-yellow-800' :
              status === 'success' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {status}
            </span>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded">
              <span className="font-medium text-red-800">Error: </span>
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {data && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">API Response:</h3>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}

          <div className="space-x-4 mb-4">
            <button
              onClick={() => testAPI()}
              disabled={status === 'loading'}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
            >
              {status === 'loading' ? '🔄 Testing...' : '🏥 Test Health Check'}
            </button>
            
            <button
              onClick={testLogin}
              disabled={status === 'loading'}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
            >
              🔐 Test Login
            </button>

            {/* Removing code for creation of initial admin */}
            {/*
            {(adminCreationEnabled || isUserLoggedIn) && (
              <button
                onClick={createAdminUser}
                disabled={status === 'loading' || !adminCreationEnabled}
                className={`px-4 py-2 text-white rounded ${
                  !adminCreationEnabled 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : status === 'loading'
                    ? 'bg-gray-300'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {!adminCreationEnabled 
                  ? '🔒 Admin Creation Disabled' 
                  : '👤 Create Admin User'
                }
              </button>
            )}
            */}

            <button
              onClick={() => window.open(`${customUrl}/docs`, '_blank')}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              📖 Open API Docs
            </button>
          </div>
          
          {/* Removing code for creation of initial admin */}
          {/*
          {(!adminCreationEnabled && isUserLoggedIn) && (
            <div className="mt-3 text-xs text-gray-500">
              💡 Admin creation is disabled for security. Use the toggle above to enable if needed.
            </div>
          )}
          
          {(!adminCreationEnabled && !isUserLoggedIn) && (
            <div className="mt-3 text-xs text-red-500 font-medium">
              ⚠️ Admin creation controls are hidden for security. Log in to manage these settings.
            </div>
          )}
          */}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📊 System Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">Frontend Info:</h3>
              <div className="space-y-1 text-gray-600">
                <div><span className="font-medium">Current URL:</span> {window.location.href}</div>
                <div><span className="font-medium">Protocol:</span> {window.location.protocol}</div>
                <div><span className="font-medium">Host:</span> {window.location.host}</div>
                <div><span className="font-medium">User Agent:</span> {navigator.userAgent.substring(0, 50)}...</div>
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2">API Info:</h3>
              <div className="space-y-1 text-gray-600">
                <div><span className="font-medium">Service URL:</span> {userApiService.baseUrl}</div>
                <div><span className="font-medium">Test URL:</span> {customUrl}</div>
                <div><span className="font-medium">Health Endpoint:</span> {customUrl}/api/health</div>
                <div><span className="font-medium">Login Endpoint:</span> {customUrl}/api/users/login</div>
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2">Security Status:</h3>
              <div className="space-y-1 text-gray-600">
                <div>
                  <span className="font-medium">Admin Creation:</span> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    adminCreationEnabled 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {adminCreationEnabled ? '🔓 ENABLED' : '🔒 DISABLED'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Authentication:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    isUserLoggedIn 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {isUserLoggedIn ? '✓ LOGGED IN' : '⚠️ NOT LOGGED IN'}
                  </span>
                </div>
                <div><span className="font-medium">Debug Mode:</span> <span className="text-yellow-600">⚠️ ACTIVE</span></div>
                <div><span className="font-medium">Environment:</span> Development</div>
                <div>
                  <span className="font-medium">Login Status:</span> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    isUserLoggedIn 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {isUserLoggedIn ? '✓ AUTHENTICATED' : '⚠️ NOT LOGGED IN'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugPage;
