import React, { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import PredictionPage from "./pages/PredictionPage";
import ConfigurationPage from "./pages/ConfigurationPage";
import TestMatchingPage from "./pages/TestMatchingPage";
import LogsPage from "./pages/LogsPage";
import LoginPageNew from "./components/LoginPageNew";
import LoginFormSimple from "./components/LoginFormSimple";
import DebugPage from "./pages/DebugPage";
import SimpleTest from "./pages/SimpleTest";
import kyndrylLogo from "./assets/kyndryl_logo.svg";
import useConfigStore from "./store";
import { getBackendUrl, isInitialSetupCompleted } from "./configStorage";
import appLogger from "./services/appLogger";

// Loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <img src={kyndrylLogo} alt="Kyndryl Logo" className="h-12" />
        </div>
        <div className="text-kyndryl-orange font-bold text-xl">Loading configuration...</div>
      </div>
    </div>
  );
}

// Initial setup component for unconfigured state
function InitialSetupScreen() {
  return (
    <div className="min-h-screen bg-kyndryl-gray py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center p-8 bg-white rounded-lg shadow">
          <div className="flex justify-center mb-4">
            <img src={kyndrylLogo} alt="Kyndryl Logo" className="h-12" />
          </div>
          
          <h1 className="text-3xl font-bold text-kyndryl-orange mb-4">🚀 Welcome to Kyndryl AI Event Automation</h1>
          <p className="text-gray-600 mb-6">This appears to be your first time running the application. Let's get you set up!</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-blue-800 mb-2">What happens next?</h2>
            <ul className="text-sm text-blue-700 text-left space-y-1">
              <li>• <strong>Configure Backend Server URL</strong> - Set the address of your backend server</li>
              <li>• Test backend connection to ensure it's reachable</li>
              <li>• Configure your prediction URL and account code</li>
              <li>• Set up GitHub integration (optional)</li>
              <li>• Configure security settings</li>
              <li>• Create admin user if needed</li>
            </ul>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="text-md font-semibold text-yellow-800 mb-2">📡 Backend Server Required</h3>
            <p className="text-sm text-yellow-700">
              You'll need to configure the backend server URL first. This could be:
            </p>
            <ul className="text-sm text-yellow-700 text-left mt-2 space-y-1">
              <li>• http://localhost:8000 (if running locally)</li>
              <li>• http://127.0.0.1:8000 (alternative local address)</li>
              <li>• Any other server address where your backend is hosted</li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <a 
              href="/config" 
              className="inline-block bg-kyndryl-orange text-white px-6 py-3 rounded-lg hover:bg-opacity-90 font-semibold"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/config';
              }}
            >
              🔧 Configure Backend Server
            </a>
            <br />
            <a 
              href="/debug" 
              className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-opacity-90"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/debug';
              }}
            >
              Debug Page (Advanced)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App Component wrapped with Auth
function AppContent() {
  const { isLoggedIn, user, logout, isLoading: authLoading, securityWarning } = useAuth();
  const [appInitialized, setAppInitialized] = useState(false);
  const [isUnconfigured, setIsUnconfigured] = useState(false);
  
  const { 
    configLoaded, 
    configExists, 
    loading: configLoading, 
    checkConfigExists, 
    loadConfig,
    debugRequiresAuth 
  } = useConfigStore(state => ({
    configLoaded: state.configLoaded,
    configExists: state.configExists,
    loading: state.loading,
    checkConfigExists: state.checkConfigExists,
    loadConfig: state.loadConfig,
    debugRequiresAuth: state.debugRequiresAuth
  }));

  // Initialize app configuration
  useEffect(() => {
    async function initializeApp() {
      try {
        // Log app startup
        appLogger.info('APP_STARTUP', 'Application initializing');
        
        // Get the backend URL (either from permanent config or default)
        const currentBackendUrl = getBackendUrl();
        console.log("Attempting to connect to backend URL:", currentBackendUrl);
        appLogger.info('APP_STARTUP', 'Attempting to connect to backend', { backendUrl: currentBackendUrl });
        
        // First try to check if the backend is available and has config
        try {
          const exists = await checkConfigExists();
          
          if (!exists) {
            console.log("Configuration not found on backend, showing setup screen");
            appLogger.warn('CONFIG', 'Configuration not found on backend');
            setIsUnconfigured(true);
            setAppInitialized(true);
            return;
          }
          
          // Load config from backend
          const config = await loadConfig();
          if (config) {
            appLogger.success('APP_STARTUP', 'Application configuration loaded from backend successfully');
            setAppInitialized(true);
            return;
          }
        } catch (backendError) {
          console.warn("Could not connect to backend:", backendError);
          appLogger.warn('APP_STARTUP', 'Could not connect to backend', { 
            error: backendError.message,
            backendUrl: currentBackendUrl 
          });
          
          // Check if initial setup has been completed locally
          const setupCompleted = isInitialSetupCompleted();
          if (!setupCompleted) {
            console.log("Initial setup not completed, showing setup screen");
            appLogger.logSetup('Setup required', 'Initial setup not completed');
            setIsUnconfigured(true);
            setAppInitialized(true);
            return;
          }
        }
        
        appLogger.success('APP_STARTUP', 'Application initialized successfully');
        setAppInitialized(true);
      } catch (error) {
        console.error("Failed to initialize app:", error);
        appLogger.error('APP_STARTUP', 'Failed to initialize application', {
          error: error.message,
          backendUrl: getBackendUrl()
        });
        // If we can't connect to backend, assume unconfigured state
        setIsUnconfigured(true);
        setAppInitialized(true);
      }
    }
    
    if (!appInitialized) {
      initializeApp();
    }
  }, [appInitialized, checkConfigExists, loadConfig]);

  // Show loading screen while initializing
  if (!appInitialized || configLoading || authLoading) {
    return <LoadingScreen />;
  }

  // Show setup screen for unconfigured state or connection issues
  if (isUnconfigured) {
    // Allow direct access to debug page when unconfigured
    if (window.location.pathname === '/debug' || window.location.pathname === '/config') {
      if (window.location.pathname === '/debug') {
        return <DebugPage />;
      }
      // For config page, we need to be logged in unless unconfigured
      if (!isLoggedIn) {
        return <LoginPageNew />;
      }
      // Return the normal app routing for config page
    } else {
      return <InitialSetupScreen />;
    }
  }

  // Handle access to the debug page
  if (window.location.pathname === '/debug') {
    // Always allow debug access when unconfigured or can't connect to backend
    if (isUnconfigured || !configExists) {
      return <DebugPage />;
    }
    
    // Check both the config store and localStorage to ensure consistency
    const isDebugRestricted = debugRequiresAuth || localStorage.getItem('debugRequiresAuth') === 'true';
    
    // If authentication is required and user is not logged in
    if (isDebugRestricted && !isLoggedIn) {
      // Store the current URL to redirect back after login
      sessionStorage.setItem('returnUrl', window.location.pathname);
      
      return (
        <div className="min-h-screen bg-kyndryl-gray py-8">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center p-8 bg-white rounded-lg shadow">
              {/* Logo centrado */}
              <div className="flex justify-center mb-4">
                <div className="h-12 flex items-center">
                  <img src={kyndrylLogo} alt="Kyndryl Logo" className="h-12" />
                </div>
              </div>
              
              <h1 className="text-2xl font-bold text-kyndryl-orange mb-2">🔐 Authentication Required</h1>
              <p className="text-gray-600 mb-4">Debug page access is restricted. Please log in to continue.</p>
              
              <div className="flex justify-center">
                <LoginFormSimple onLoginSuccess={() => window.location.reload()} />
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Otherwise, allow access to the debug page
    return <DebugPage />;
  }

  // Handle access to config page when unconfigured
  if (window.location.pathname === '/config' && isUnconfigured) {
    // For unconfigured state, we can access config page without login to set initial config
    return (
      <div className="min-h-screen bg-white text-black">
        <nav className="bg-kyndryl-black text-white px-6 py-4 shadow-md">
          <div className="container mx-auto flex items-center">
            <div className="flex items-center mr-8">
              <img src={kyndrylLogo} alt="Kyndryl Logo" className="h-8" />
            </div>
            <h1 className="text-xl font-semibold">Initial Configuration</h1>
          </div>
        </nav>
        <main className="p-6">
          <ConfigurationPage />
        </main>
      </div>
    );
  }

  // Allow direct access to simple test page
  if (window.location.pathname === '/test-simple') {
    return <SimpleTest />;
  }

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!isLoggedIn) {
    return <LoginPageNew />;
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Top Navigation Bar */}
      <nav className="bg-kyndryl-black text-white px-6 py-4 shadow-md">
        <div className="container mx-auto flex flex-wrap justify-between items-center">
          <div className="flex items-center">
            <div className="flex items-center mr-8">
              <div className="flex items-center">
                <img src={kyndrylLogo} alt="Kyndryl Logo" className="h-8" />
              </div>
            </div>
            <div className="space-x-4">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  isActive
                    ? "font-semibold border-b-2 border-kyndryl-orange pb-1"
                    : "text-gray-300 hover:text-white"
                }
              >
                Prediction
              </NavLink>
              <NavLink
                to="/test"
                className={({ isActive }) =>
                  isActive
                    ? "font-semibold border-b-2 border-kyndryl-orange pb-1"
                    : "text-gray-300 hover:text-white"
                }
              >
                Test Matcher
              </NavLink>
              <NavLink
                to="/logs"
                className={({ isActive }) =>
                  isActive
                    ? "font-semibold border-b-2 border-kyndryl-orange pb-1"
                    : "text-gray-300 hover:text-white"
                }
              >
                Logs
              </NavLink>
              <NavLink
                to="/config"
                className={({ isActive }) =>
                  isActive
                    ? "font-semibold border-b-2 border-kyndryl-orange pb-1"
                    : "text-gray-300 hover:text-white"
                }
              >
                Configuration
              </NavLink>
              <NavLink
                to="/debug"
                className={({ isActive }) =>
                  isActive
                    ? "font-semibold border-b-2 border-kyndryl-orange pb-1"
                    : "text-gray-300 hover:text-white"
                }
              >
                Debug
              </NavLink>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <span className="opacity-75">Logged in as:</span>{" "}
              <span className="font-semibold">{user?.username || "User"}</span>
            </div>
            <button
              onClick={logout}
              className="text-xs bg-kyndryl-orange text-white px-3 py-1 rounded hover:bg-opacity-90"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Security Warning Banner */}
      {securityWarning && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700">
          <div className="container mx-auto py-3 px-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm ml-3">{securityWarning} <NavLink to="/config" className="font-bold underline">Go to Configuration</NavLink></p>
            </div>
          </div>
        </div>
      )}
      
      <main className="p-6">
        <Routes>
          <Route path="/" element={<PredictionPage />} />
          <Route path="/test" element={<TestMatchingPage />} />
          <Route path="/config" element={<ConfigurationPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/debug" element={<DebugPage />} />
        </Routes>
      </main>
    </div>
  );
}

// Main App with Auth Provider
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
