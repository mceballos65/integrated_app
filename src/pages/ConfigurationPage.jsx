import React, { useState, useEffect } from "react";
import useConfigStore from "../store";
import { useAuth, useUserManagement } from "../hooks/useAuth.jsx";
import userApiService from "../services/userApi";
import { getBackendUrl, setBackendUrl, markSetupCompleted } from "../configStorage";
import appLogger from "../services/appLogger";

export default function ConfigurationPage() {
  const {
    config,
    configLoaded,
    loading,
    error,
    updateConfig
  } = useConfigStore();
  
  // We'll use config values directly instead of getters
  const adminUserDisabled = config?.security?.admin_user_disabled || false;
  const debugRequiresAuth = config?.security?.debug_requires_auth || false;

  const { refreshUsers } = useUserManagement();
  const [localPredictionUrl, setLocalPredictionUrl] = useState("");
  const [localAccountCode, setLocalAccountCode] = useState("ACM");
  const [isAdminUserActive, setIsAdminUserActive] = useState(false);

  const [localGithubToken, setLocalGithubToken] = useState("");
  const [localGithubUsername, setLocalGithubUsername] = useState("");
  const [localRepositoryUrl, setLocalRepositoryUrl] = useState("");
  const [localBranchName, setLocalBranchName] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [gitStatus, setGitStatus] = useState("");
  const [localBackendUrl, setLocalBackendUrl] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);

  // Active panel state for the new sidebar layout
  const [activePanel, setActivePanel] = useState(() => {
    // Recuperar el panel activo de localStorage o usar "backend" como valor predeterminado
    return localStorage.getItem('kyndryl_active_panel') || "backend";
  });

  // Función personalizada para cambiar el panel activo y guardarlo en localStorage
  const changeActivePanel = (panel) => {
    setActivePanel(panel);
    localStorage.setItem('kyndryl_active_panel', panel);
  };

  // Track which configs have been edited to remove warning icons
  const [editedConfigs, setEditedConfigs] = useState(() => {
    // Intentar obtener primero desde el config
    if (config?.edited_configs) {
      return config.edited_configs;
    }
    // Si no está en el config, intentar con localStorage como fallback
    const saved = localStorage.getItem('kyndryl_edited_configs');
    return saved ? JSON.parse(saved) : {};
  });

  // Track if we just configured the backend URL for the first time
  const [showReloginButton, setShowReloginButton] = useState(false);

  const markConfigAsEdited = async (configName) => {
    const newEditedConfigs = { ...editedConfigs, [configName]: true };
    setEditedConfigs(newEditedConfigs);
    
    // Guardar tanto en localStorage como en el archivo app_config.json
    localStorage.setItem('kyndryl_edited_configs', JSON.stringify(newEditedConfigs));
    
    // Actualizar la configuración en el backend
    try {
      await updateConfig({
        edited_configs: {
          ...config?.edited_configs,
          [configName]: true
        }
      });
      console.log(`Configuración '${configName}' marcada como editada en app_config.json`);
    } catch (error) {
      console.error(`Error al guardar estado editado para ${configName} en app_config.json:`, error);
    }
  };

  const showStatusMessage = (text, error = false) => {
    setStatusMessage(text);
    setIsError(error);
    setTimeout(() => setStatusMessage(""), 5000);
  };

  // Panel collapse states
  const [isAppConfigCollapsed, setIsAppConfigCollapsed] = useState(false);
  const [isLogConfigCollapsed, setIsLogConfigCollapsed] = useState(true);
  const [isUserManagementCollapsed, setIsUserManagementCollapsed] = useState(false);
  const [isAdminSecurityCollapsed, setIsAdminSecurityCollapsed] = useState(false);
  const [isGitConfigCollapsed, setIsGitConfigCollapsed] = useState(true);
  const [isBackendConfigCollapsed, setIsBackendConfigCollapsed] = useState(false); // Expanded by default

  useEffect(() => {
    console.log("Config changed, updating local values:", { configLoaded, config });
    console.log("Full config object:", JSON.stringify(config, null, 2));
    if (configLoaded && config) {
      // Use values directly from config instead of getters
      const directPredictionUrl = config?.app?.prediction_url || "";
      const directAccountCode = config?.app?.account_code || "ACM";
      const directGithubToken = config?.github?.token || "";
      const directGithubRepoUrl = config?.github?.repo_url || "";
      const directGithubBranch = config?.github?.branch || "main";
      const directDebugRequiresAuth = config?.security?.debug_requires_auth || false;
      
      // Actualizar localStorage para mantener consistencia
      localStorage.setItem('debugRequiresAuth', directDebugRequiresAuth ? 'true' : 'false');
      
      console.log("Setting local values from config directly:", {
        directPredictionUrl,
        directAccountCode,
        directGithubToken,
        directGithubRepoUrl,
        directGithubBranch
      });
      
      setLocalPredictionUrl(directPredictionUrl);
      setLocalAccountCode(directAccountCode);
      setLocalGithubToken(directGithubToken);
      setLocalRepositoryUrl(directGithubRepoUrl);
      setLocalBranchName(directGithubBranch);
      
      // Sincronizar los estados de edición entre localStorage y el backend
      const localEditedConfigs = localStorage.getItem('kyndryl_edited_configs');
      if (localEditedConfigs) {
        const parsedLocalConfigs = JSON.parse(localEditedConfigs);
        const backendEditedConfigs = config?.edited_configs || {};
        
        // Combinar los estados editados locales con los del backend
        const combinedEditedConfigs = { ...backendEditedConfigs };
        
        // Para cada configuración local marcada como editada, actualizar el estado combinado
        let needsUpdate = false;
        for (const [key, value] of Object.entries(parsedLocalConfigs)) {
          if (value === true && !backendEditedConfigs[key]) {
            combinedEditedConfigs[key] = true;
            needsUpdate = true;
          }
        }
        
        // Si hay cambios, actualizar el backend
        if (needsUpdate) {
          updateConfig({
            edited_configs: combinedEditedConfigs
          }).then(() => {
            console.log("Estados de edición sincronizados con app_config.json");
          }).catch(err => {
            console.error("Error al sincronizar estados de edición:", err);
          });
        }
        
        // Actualizar el estado local
        setEditedConfigs(combinedEditedConfigs);
      }
    }
    // Initialize backend URL
    setLocalBackendUrl(getBackendUrl());
  }, [configLoaded, config]); // Simplified dependencies

  // Check admin user status
  useEffect(() => {
    async function checkAdminStatus() {
      try {
        // Obtener la lista de usuarios para verificar si el admin está activo
        const users = await userApiService.getUsers();
        const adminUser = users.find(user => user.username === 'admin');
        
        if (adminUser) {
          setIsAdminUserActive(adminUser.is_active);
          console.log('Admin user status:', adminUser.is_active ? 'Active' : 'Inactive');
        } else {
          console.log('Admin user not found');
          setIsAdminUserActive(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    }
    
    if (configLoaded) {
      checkAdminStatus();
    }
  }, [adminUserDisabled, configLoaded]);

  const handleSave = async () => {
    if (!/^[a-zA-Z0-9]{3}$/.test(localAccountCode)) {
      showStatusMessage("Account Code must be exactly 3 alphanumeric characters.", true);
      appLogger.warn('CONFIG_VALIDATION', 'Invalid account code format', { accountCode: localAccountCode });
      return;
    }

    try {
      const configChanges = {
        app: {
          prediction_url: localPredictionUrl,
          account_code: localAccountCode
        },
        github: {
          token: localGithubToken ? "***HIDDEN***" : "", // Don't log actual token
          repo_url: localRepositoryUrl,
          branch: localBranchName
        }
      };

      console.log("Saving config:", configChanges);
      appLogger.logConfigChange('APP_CONFIG', configChanges);

      // Mark both app and github sections as edited
      markConfigAsEdited("app");
      markConfigAsEdited("github");

      const updatedConfig = await updateConfig({
        app: {
          prediction_url: localPredictionUrl,
          account_code: localAccountCode
        },
        github: {
          token: localGithubToken,
          repo_url: localRepositoryUrl,
          branch: localBranchName
        }
      });

      console.log("Updated config received:", updatedConfig);

      // Marcar configuraciones como editadas
      await markConfigAsEdited("app");
      await markConfigAsEdited("github");

      // Manual check of getters after update
      const currentPredictionUrl = useConfigStore.getState().predictionUrl;
      const currentAccountCode = useConfigStore.getState().accountCode;
      console.log("Manual getter check after update:", {
        currentPredictionUrl,
        currentAccountCode
      });

      // Sync local state with updated config
      if (updatedConfig) {
        console.log("Syncing local state with updated config");
        // Use snake_case field names that come from backend
        setLocalPredictionUrl(updatedConfig.app?.prediction_url || "");
        setLocalAccountCode(updatedConfig.app?.account_code || "ACM");
        setLocalGithubToken(updatedConfig.github?.token || "");
        setLocalRepositoryUrl(updatedConfig.github?.repo_url || "");
        setLocalBranchName(updatedConfig.github?.branch || "");
      }

      showStatusMessage("Configuration saved successfully!");
      appLogger.success('CONFIG_CHANGE', 'App configuration saved successfully');
      markConfigAsEdited("app");
    } catch (error) {
      console.error("Error saving configuration:", error);
      appLogger.error('CONFIG_CHANGE', 'Failed to save app configuration', { error: error.message });
      showStatusMessage("Failed to save configuration: " + error.message, true);
    }
  };

  const handleGitAction = async (action) => {
    const endpoint = action === "pull" ? "/git/pull" : "/git/push";
    appLogger.info('GIT_ACTION', `Attempting git ${action}`, { endpoint });
    
    try {
      const res = await fetch(`${getBackendUrl()}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        setGitStatus(`✅ ${action.toUpperCase()} successful:\n${data.output}`);
        appLogger.success('GIT_ACTION', `Git ${action} successful`, { output: data.output });
        
        // Mark GitHub config as edited when a Git action is successfully performed
        markConfigAsEdited("github");
      } else {
        setGitStatus(`❌ ${action.toUpperCase()} failed:\n${data.error}`);
        appLogger.error('GIT_ACTION', `Git ${action} failed`, { error: data.error });
      }
    } catch (err) {
      setGitStatus(`❌ ${action.toUpperCase()} error:\n${err.message}`);
      appLogger.error('GIT_ACTION', `Git ${action} error`, { error: err.message });
    }
  };

  const handleBackendUrlSave = async () => {
    try {
      const wasBackendUrlConfigured = localStorage.getItem('kyndryl_backend_url') !== null;
      
      // Update the backend URL
      setBackendUrl(localBackendUrl);
      markConfigAsEdited("backend");
      
      // Mark setup as completed when backend URL is saved
      markSetupCompleted();
      
      // Save initial config to the new backend if this is the first time setting it
      if (!wasBackendUrlConfigured) {
        try {
          // Try to save current config to the new backend
          const { updateConfig, loadConfig } = await import("../configStorage");
          const currentConfig = await loadConfig();
          if (currentConfig) {
            await updateConfig(currentConfig);
          }
        } catch (configError) {
          console.warn("Could not transfer config to new backend:", configError);
        }
      }
      
      // If this is the first time setting the backend URL, show the relogin button
      if (!wasBackendUrlConfigured) {
        showStatusMessage("Backend URL configured for the first time! Please use the 'Relogin' button below to continue with the setup.");
        appLogger.logSetup('Backend URL configured for first time', { url: localBackendUrl });
        setShowReloginButton(true);
      } else {
        showStatusMessage("Backend URL updated successfully! The app will now use: " + localBackendUrl);
        appLogger.logConfigChange('BACKEND_URL', 'Backend URL updated', { url: localBackendUrl });
      }
    } catch (error) {
      console.error("Error updating backend URL:", error);
      appLogger.error('CONFIG_CHANGE', 'Failed to update backend URL', { error: error.message, url: localBackendUrl });
      showStatusMessage("Failed to update backend URL: " + error.message, true);
    }
  };

  const handleRelogin = () => {
    // Clear the current session and reload the page to start fresh with the new backend URL
    appLogger.info('AUTH', 'User initiated relogin after backend URL configuration');
    
    // Preserve only the backend URL
    const backendUrl = localStorage.getItem('kyndryl_backend_url');
    const permanentConfig = localStorage.getItem('kyndryl_permanent_config');
    
    // Clear all session and local storage
    sessionStorage.clear();
    
    // Remove all items except backend URL related items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== 'kyndryl_backend_url' && key !== 'kyndryl_permanent_config') {
        localStorage.removeItem(key);
      }
    }
    
    // Make sure backend URL and permanent config are preserved
    if (backendUrl) localStorage.setItem('kyndryl_backend_url', backendUrl);
    if (permanentConfig) localStorage.setItem('kyndryl_permanent_config', permanentConfig);
    
    // Redirect to home page
    window.location.href = '/';
  };

  const testBackendConnection = async () => {
    appLogger.info('CONNECTION_TEST', 'Testing backend connection', { url: localBackendUrl });
    
    try {
      const response = await fetch(`${localBackendUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        showStatusMessage("✅ Backend connection successful!\nStatus: " + data.status);
        appLogger.success('CONNECTION_TEST', 'Backend connection successful', { url: localBackendUrl, status: data.status });
      } else {
        showStatusMessage("❌ Backend connection failed with status: " + response.status, true);
        appLogger.error('CONNECTION_TEST', 'Backend connection failed with HTTP error', { url: localBackendUrl, status: response.status });
      }
    } catch (error) {
      showStatusMessage("❌ Backend connection failed: " + error.message, true);
      appLogger.error('CONNECTION_TEST', 'Backend connection failed with network error', { url: localBackendUrl, error: error.message });
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-gray-50">
      {/* Sidebar Navigation */}
      <div className="w-80 bg-white shadow-md border-r border-gray-200 overflow-y-auto">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-kyndryl-orange mb-6">Configuration</h1>
          
          <nav className="space-y-2">
            {/* Backend Configuration */}
            <button
              onClick={() => changeActivePanel("backend")}
              className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                activePanel === "backend" 
                  ? "bg-kyndryl-orange text-white" 
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center">
                <span className="text-lg mr-3">🔧</span>
                <span className="font-medium">Backend Server</span>
              </div>
              {!editedConfigs.backend && (
                <span className="text-red-500 text-xl font-bold">!</span>
              )}
            </button>

            {/* App Configuration */}
            <button
              onClick={() => changeActivePanel("app")}
              className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                activePanel === "app" 
                  ? "bg-kyndryl-orange text-white" 
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center">
                <span className="text-lg mr-3">⚙️</span>
                <span className="font-medium">App Configuration</span>
              </div>
              {!editedConfigs.app && (
                <span className="text-red-500 text-xl font-bold">!</span>
              )}
            </button>

            {/* User Management */}
            <button
              onClick={() => changeActivePanel("users")}
              className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                activePanel === "users" 
                  ? "bg-kyndryl-orange text-white" 
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center">
                <span className="text-lg mr-3">👥</span>
                <span className="font-medium">User Management</span>
              </div>
              {!editedConfigs.user_management && (
                <span className="text-red-500 text-xl font-bold">!</span>
              )}
            </button>

            {/* Admin Security */}
            <button
              onClick={() => changeActivePanel("security")}
              className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                activePanel === "security" 
                  ? "bg-kyndryl-orange text-white" 
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center">
                <span className="text-lg mr-3">🔒</span>
                <span className="font-medium">Admin Security</span>
              </div>
              {!editedConfigs.security && (
                <span className="text-red-500 text-xl font-bold">!</span>
              )}
            </button>

            {/* Log Configuration */}
            <button
              onClick={() => changeActivePanel("logs")}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                activePanel === "logs" 
                  ? "bg-kyndryl-orange text-white" 
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center">
                <span className="text-lg mr-3">📋</span>
                <span className="font-medium">Log Settings</span>
              </div>
            </button>

            {/* GitHub Configuration */}
            <button
              onClick={() => changeActivePanel("github")}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                activePanel === "github" 
                  ? "bg-kyndryl-orange text-white" 
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center">
                <span className="text-lg mr-3">📁</span>
                <span className="font-medium">GitHub Integration</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Status Message */}
          {statusMessage && (
            <div className={`px-4 py-2 rounded border mb-6 ${
              isError 
                ? 'bg-red-100 border-red-400 text-red-800' 
                : 'bg-green-100 border-green-400 text-green-800'
            }`}>
              {statusMessage}
            </div>
          )}

          {/* Dynamic Content Based on Active Panel */}
          {activePanel === "backend" && <BackendConfigPanel 
            localBackendUrl={localBackendUrl}
            setLocalBackendUrl={setLocalBackendUrl}
            handleBackendUrlSave={handleBackendUrlSave}
            testBackendConnection={testBackendConnection}
            getBackendUrl={getBackendUrl}
            showReloginButton={showReloginButton}
            handleRelogin={handleRelogin}
          />}

          {activePanel === "app" && <AppConfigPanel 
            localPredictionUrl={localPredictionUrl}
            setLocalPredictionUrl={setLocalPredictionUrl}
            localAccountCode={localAccountCode}
            setLocalAccountCode={setLocalAccountCode}
            handleSave={handleSave}
          />}

          {activePanel === "users" && <UserManagementPanel 
            showStatusMessage={showStatusMessage}
            markConfigAsEdited={markConfigAsEdited}
          />}

          {activePanel === "security" && <AdminSecurityPanel 
            adminUserDisabled={adminUserDisabled}
            debugRequiresAuth={debugRequiresAuth}
            isAdminUserActive={isAdminUserActive}
            setIsAdminUserActive={setIsAdminUserActive}
            updateConfig={updateConfig}
            refreshUsers={refreshUsers}
            showStatusMessage={showStatusMessage}
            markConfigAsEdited={markConfigAsEdited}
          />}

          {activePanel === "logs" && <LogConfigPanel 
            updateConfig={updateConfig}
            markConfigAsEdited={markConfigAsEdited}
            showStatusMessage={showStatusMessage}
          />}

          {activePanel === "github" && <GitHubConfigPanel 
            localGithubToken={localGithubToken}
            setLocalGithubToken={setLocalGithubToken}
            localRepositoryUrl={localRepositoryUrl}
            setLocalRepositoryUrl={setLocalRepositoryUrl}
            localBranchName={localBranchName}
            setLocalBranchName={setLocalBranchName}
            handleGitAction={handleGitAction}
            gitStatus={gitStatus}
          />}
        </div>
      </div>
    </div>
  );
}

// Individual Panel Components
function BackendConfigPanel({ localBackendUrl, setLocalBackendUrl, handleBackendUrlSave, testBackendConnection, getBackendUrl, showReloginButton, handleRelogin }) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <div className="flex items-center mb-6">
        <span className="text-2xl mr-3">🔧</span>
        <h2 className="text-2xl font-bold text-kyndryl-orange">Backend Server Configuration</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-md font-semibold text-blue-800 mb-2">Backend Server Setup</h3>
        <p className="text-sm text-blue-700">
          Configure the URL of your backend server. This is required for the application to function properly.
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block font-semibold mb-1">Backend Server URL</label>
          <input
            type="text"
            value={localBackendUrl}
            onChange={(e) => setLocalBackendUrl(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="http://localhost:8000"
          />
          <p className="text-sm text-gray-600 mt-1">
            Enter the complete URL including protocol (http:// or https://)
          </p>
        </div>
        
        <div>
          <label className="block font-semibold mb-2">Quick Presets:</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setLocalBackendUrl("http://localhost:8000")}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              localhost:8000
            </button>
            <button
              onClick={() => setLocalBackendUrl("http://localhost:8000")}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              localhost:8000
            </button>
            <button
              onClick={() => setLocalBackendUrl("http://127.0.0.1:8000")}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              127.0.0.1:8000
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={testBackendConnection}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          🔍 Test Connection
        </button>
        <button
          onClick={handleBackendUrlSave}
          className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          💾 Save Backend URL
        </button>
      </div>

      {/* Relogin Button - shown after saving backend URL for the first time */}
      {showReloginButton && (
        <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center mb-3">
            <span className="text-lg mr-2">🔄</span>
            <h3 className="text-md font-semibold text-orange-800">Next Step: Relogin Required</h3>
          </div>
          <p className="text-sm text-orange-700 mb-4">
            You've successfully configured the backend URL for the first time! Now the app needs to reload and connect to your backend server to continue the setup process.
          </p>
          <button
            onClick={handleRelogin}
            className="w-full bg-kyndryl-orange text-white px-4 py-3 rounded-lg hover:bg-opacity-90 font-semibold"
          >
            🚀 Relogin & Continue Setup
          </button>
        </div>
      )}
      
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <p><strong>Current Backend URL:</strong> {getBackendUrl()}</p>
        <p><strong>Status:</strong> {localStorage.getItem('kyndryl_backend_url') ? 'Custom URL configured' : 'Using default URL'}</p>
      </div>
    </div>
  );
}

function AppConfigPanel({ localPredictionUrl, setLocalPredictionUrl, localAccountCode, setLocalAccountCode, handleSave }) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <div className="flex items-center mb-6">
        <span className="text-2xl mr-3">⚙️</span>
        <h2 className="text-2xl font-bold text-kyndryl-orange">App Configuration</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-md font-semibold text-blue-800 mb-2">Application Settings</h3>
        <p className="text-sm text-blue-700">
          Configure the core URL and account information for your application.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block font-semibold mb-1">Prediction URL</label>
          <input
            type="text"
            value={localPredictionUrl}
            onChange={(e) => setLocalPredictionUrl(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="http://localhost:8000"
          />
          <p className="text-sm text-gray-600 mt-1">
            URL for the prediction API service
          </p>
        </div>

        <div>
          <label className="block font-semibold mb-1">Account Code (3 characters)</label>
          <input
            type="text"
            value={localAccountCode}
            onChange={(e) => setLocalAccountCode(e.target.value.toUpperCase())}
            maxLength="3"
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="ACM"
          />
          <p className="text-sm text-gray-600 mt-1">
            Three-character account identifier (used in Test Matcher and other features)
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-kyndryl-orange text-white font-bold py-2 px-4 rounded mt-6 hover:bg-orange-600"
      >
        Save Configuration
      </button>
    </div>
  );
}

function UserManagementPanel({ showStatusMessage, markConfigAsEdited }) {
  // Mark as edited when user interacts with this panel
  const handleUserAction = (action) => {
    markConfigAsEdited("users");
    return action();
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <div className="flex items-center mb-6">
        <span className="text-2xl mr-3">👥</span>
        <h2 className="text-2xl font-bold text-kyndryl-orange">User Management</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-md font-semibold text-blue-800 mb-2">User Account Management</h3>
        <p className="text-sm text-blue-700">
          Create, manage, and configure user accounts for system access.
        </p>
      </div>

      <UserManagementSection 
        showStatusMessage={showStatusMessage}
        onUserAction={handleUserAction}
      />
    </div>
  );
}

function AdminSecurityPanel({ adminUserDisabled, debugRequiresAuth, isAdminUserActive, setIsAdminUserActive, updateConfig, refreshUsers, showStatusMessage, markConfigAsEdited }) {
  // Estado local para manejar el toggle de protección de la página de debug
  const [isDebugProtected, setIsDebugProtected] = useState(debugRequiresAuth);
  
  // Sincronizar el estado local cuando cambia el prop
  useEffect(() => {
    setIsDebugProtected(debugRequiresAuth);
  }, [debugRequiresAuth]);
  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <div className="flex items-center mb-6">
        <span className="text-2xl mr-3">🔒</span>
        <h2 className="text-2xl font-bold text-kyndryl-orange">Admin Security</h2>
      </div>

      <div className="p-4 mb-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium">Security Best Practice</h3>
            <div className="mt-2 text-sm">
              <p>The following security settings are strongly recommended:</p>
              <ul className="list-disc pl-5 mt-2">
                <li><strong>Disable default "admin" user</strong> - Create a new administrator account with a different username.</li>
                <li><strong>Restrict debug page access</strong> - Make the debug page accessible only to authenticated users.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Admin User Security Setting */}
      <div className="flex items-center space-x-2 mb-6">
        <div className="flex-1">
          <label className="inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={adminUserDisabled} 
              onChange={async (e) => {
                const newValue = e.target.checked;
                try {
                  if ((isAdminUserActive && newValue) || (!isAdminUserActive && !newValue)) {
                    const userApiService = await import("../services/userApi");
                    await userApiService.default.toggleUserStatus('admin');
                    refreshUsers();
                    setIsAdminUserActive(!isAdminUserActive);
                  }
                  
                  await updateConfig({
                    security: { admin_user_disabled: newValue }
                  });
                  
                  markConfigAsEdited("security");
                  showStatusMessage(newValue ? '🔒 Default admin user disabled for security' : '⚠️ Warning: Default admin user is now enabled');
                } catch (error) {
                  showStatusMessage(`Error toggling admin user status: ${error.message}`, true);
                }
              }}
              className="sr-only peer" 
            />
            <div className={`relative w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 ${adminUserDisabled ? 'peer-checked:bg-green-600' : 'peer-checked:bg-gray-400'}`}></div>
            <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
              Disable Default Admin User
            </span>
          </label>
        </div>
        <button 
          onClick={async () => {
            try {
              if (isAdminUserActive) {
                const userApiService = await import("../services/userApi");
                await userApiService.default.toggleUserStatus('admin');
                refreshUsers();
                setIsAdminUserActive(false);
              }
              
              await updateConfig({
                security: { admin_user_disabled: true }
              });
              
              markConfigAsEdited("security");
              showStatusMessage("🔒 Security improvement applied: Default admin user has been disabled for security!");
            } catch (error) {
              showStatusMessage(`Error toggling admin user status: ${error.message}`, true);
            }
          }}
          disabled={adminUserDisabled}
          className={`px-4 py-2 text-sm text-white font-medium rounded ${adminUserDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
        >
          Apply Security Setting
        </button>
      </div>

      {/* Debug Page Security Setting */}
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          <label className="inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={isDebugProtected} 
              onChange={async (e) => {
                const newValue = e.target.checked;
                try {
                  // Actualizar la configuración en el backend
                  await updateConfig({
                    security: { debug_requires_auth: newValue }
                  });
                  
                  // También actualizar localStorage para mantener la configuración sincronizada
                  localStorage.setItem('debugRequiresAuth', newValue ? 'true' : 'false');
                  
                  // Asegurarnos de actualizar el estado local
                  setIsDebugProtected(newValue);
                  
                  markConfigAsEdited("security");
                  showStatusMessage(newValue ? '🔒 Debug page access restricted to authenticated users' : '⚠️ Debug page is now publicly accessible');
                } catch (error) {
                  showStatusMessage('Failed to update debug access setting: ' + error.message, true);
                }
              }}
              className="sr-only peer" 
            />
            <div className={`relative w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 ${isDebugProtected ? 'peer-checked:bg-green-600' : 'peer-checked:bg-gray-400'}`}></div>
            <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
              Restrict Debug Page Access
            </span>
          </label>
        </div>
        <button 
          onClick={async () => {
            try {
              // Actualizar la configuración en el backend
              await updateConfig({
                security: { debug_requires_auth: true }
              });
              
              // También actualizar localStorage para mantener la configuración sincronizada
              localStorage.setItem('debugRequiresAuth', 'true');
              
              // Asegurarnos de actualizar el estado local
              setIsDebugProtected(true);
              
              markConfigAsEdited("security");
              showStatusMessage("🔒 Security improvement applied: Debug page access is now restricted to authenticated users only!");
            } catch (error) {
              showStatusMessage('Failed to update debug access setting: ' + error.message, true);
            }
          }}
          disabled={isDebugProtected}
          className={`px-4 py-2 text-sm text-white font-medium rounded ${isDebugProtected ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
        >
          Apply Security Setting
        </button>
      </div>
    </div>
  );
}

function LogConfigPanel() {
  const {
    config,
    configLoaded,
    updateConfig,
  } = useConfigStore();

  // Inicializar con valores de la configuración
  const [logFileLocation, setLogFileLocation] = useState(() => 
    config?.logging?.file_location || "./logs/predictions.log"
  );
  const [maxLogEntries, setMaxLogEntries] = useState(() => 
    config?.logging?.max_entries || 50000
  );
  const [isCleaningLogs, setIsCleaningLogs] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState("");
  const [cleanupSuccess, setCleanupSuccess] = useState(null);

  // Sincronizar con cambios en la configuración
  useEffect(() => {
    if (configLoaded && config?.logging) {
      setLogFileLocation(config.logging.file_location || "./logs/predictions.log");
      setMaxLogEntries(config.logging.max_entries || 50000);
    }
  }, [configLoaded, config]);

  const handleSaveConfig = async () => {
    try {
      const backendUrl = getBackendUrl();
      
      // Usar el nuevo endpoint que actualiza la configuración y limpia los logs
      const response = await fetch(`${backendUrl}/api/config/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_location: logFileLocation,
          max_entries: maxLogEntries
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      // Actualizar store para mantener sincronización
      await updateConfig({
        logging: {
          file_location: logFileLocation,
          max_entries: maxLogEntries
        }
      });
      
      // Mark logging config as edited
      markConfigAsEdited("logging");
      
      // Mostrar resultados de la limpieza si se realizó
      if (result.cleanup_result) {
        setCleanupSuccess(result.cleanup_result.success);
        setCleanupMessage(result.cleanup_result.message);
        
        // Ocultar el mensaje después de 5 segundos
        setTimeout(() => {
          setCleanupMessage("");
        }, 5000);
      }
      
      showStatusMessage("Log settings saved successfully! Old entries have been cleaned up.");
      appLogger.success('CONFIG_CHANGE', 'Log configuration saved and cleanup performed', {
        file_location: logFileLocation,
        max_entries: maxLogEntries,
        cleanup_result: result.cleanup_result
      });
    } catch (error) {
      console.error("Error saving log configuration:", error);
      showStatusMessage("Failed to save log settings: " + error.message, true);
    }
  };

  const handleManualCleanup = async () => {
    try {
      setIsCleaningLogs(true);
      setCleanupMessage("Cleaning up logs...");
      const backendUrl = getBackendUrl();
      
      const response = await fetch(`${backendUrl}/api/logs/cleanup`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      setCleanupSuccess(result.success);
      setCleanupMessage(result.message);
      
      // Ocultar el mensaje después de 5 segundos
      setTimeout(() => {
        setCleanupMessage("");
      }, 5000);
      
      appLogger.info('LOG_MAINTENANCE', 'Manual log cleanup performed', result);
    } catch (error) {
      console.error("Error during log cleanup:", error);
      setCleanupSuccess(false);
      setCleanupMessage("Failed to clean logs: " + error.message);
    } finally {
      setIsCleaningLogs(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <div className="flex items-center mb-6">
        <span className="text-2xl mr-3">📋</span>
        <h2 className="text-2xl font-bold text-kyndryl-orange">Log File Settings</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-md font-semibold text-blue-800 mb-2">Log Configuration</h3>
        <p className="text-sm text-blue-700">
          Configure log file location and retention settings. The system will automatically clean up old log entries to maintain the maximum number specified.
        </p>
      </div>

      {/* Cleanup Status Message */}
      {cleanupMessage && (
        <div className={`p-3 mb-4 rounded-lg border ${
          cleanupSuccess === true 
            ? "bg-green-50 border-green-300 text-green-800" 
            : cleanupSuccess === false
              ? "bg-red-50 border-red-300 text-red-800"
              : "bg-blue-50 border-blue-300 text-blue-800"
        }`}>
          {cleanupSuccess === true ? "✅ " : cleanupSuccess === false ? "❌ " : "ℹ️ "}
          {cleanupMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block font-semibold mb-1">Log File Location</label>
          <input
            type="text"
            value={logFileLocation}
            onChange={(e) => setLogFileLocation(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="./logs/predictions.log"
          />
          <p className="text-xs text-gray-500 mt-1">
            Path to the predictions log file. Used by the Logs page to read log entries.
          </p>
        </div>

        <div>
          <label className="block font-semibold mb-1">Max Log Entries</label>
          <input
            type="number"
            value={maxLogEntries}
            onChange={(e) => setMaxLogEntries(parseInt(e.target.value) || 50000)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="50000"
            min="1000"
            max="1000000"
          />
          <p className="text-xs text-gray-500 mt-1">
            Maximum number of log entries to keep. When this limit is reached, older entries will be automatically removed. 
            The system checks this limit automatically every 24 hours.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={handleSaveConfig}
          className="flex-1 bg-kyndryl-orange text-white font-bold py-2 px-4 rounded hover:bg-orange-600"
        >
          Save & Apply Settings
        </button>
        
        <button
          onClick={handleManualCleanup}
          disabled={isCleaningLogs}
          className={`flex-1 ${
            isCleaningLogs 
              ? "bg-gray-400 cursor-not-allowed" 
              : "bg-blue-600 hover:bg-blue-700"
          } text-white font-bold py-2 px-4 rounded`}
        >
          {isCleaningLogs ? "Cleaning..." : "Clean Logs Now"}
        </button>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        <p>
          <strong>Note:</strong> The system automatically cleans up log entries every 24 hours to maintain the specified maximum. 
          You can also trigger a manual cleanup by clicking the "Clean Logs Now" button.
        </p>
      </div>
    </div>
  );
}

function GitHubConfigPanel({ localGithubToken, setLocalGithubToken, localRepositoryUrl, setLocalRepositoryUrl, localBranchName, setLocalBranchName, handleGitAction, gitStatus }) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <div className="flex items-center mb-6">
        <span className="text-2xl mr-3">📁</span>
        <h2 className="text-2xl font-bold text-kyndryl-orange">GitHub Integration</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-md font-semibold text-blue-800 mb-2">Source Control Integration</h3>
        <p className="text-sm text-blue-700">
          Configure GitHub integration for version control and collaboration.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block font-semibold mb-1">GitHub Token</label>
          <input
            type="password"
            value={localGithubToken}
            onChange={(e) => setLocalGithubToken(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          />
          <p className="text-xs text-gray-500 mt-1">
            Personal access token for GitHub API access
          </p>
        </div>

        <div>
          <label className="block font-semibold mb-1">Repository URL</label>
          <input
            type="text"
            value={localRepositoryUrl}
            onChange={(e) => setLocalRepositoryUrl(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="https://github.com/username/repository.git"
          />
          <p className="text-xs text-gray-500 mt-1">
            Full URL to your GitHub repository
          </p>
        </div>

        <div>
          <label className="block font-semibold mb-1">Branch Name</label>
          <input
            type="text"
            value={localBranchName}
            onChange={(e) => setLocalBranchName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="main"
          />
          <p className="text-xs text-gray-500 mt-1">
            Git branch to work with
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={() => handleGitAction("pull")}
          className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Git Pull
        </button>
        <button
          onClick={() => handleGitAction("push")}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Git Push
        </button>
      </div>

      {gitStatus && (
        <pre className="mt-4 p-3 bg-gray-100 rounded text-xs whitespace-pre-wrap">
          {gitStatus}
        </pre>
      )}
    </div>
  );
}

// User Management Section Component
function UserManagementSection({ showStatusMessage, onUserAction }) {
  const { user: currentUser } = useAuth();
  const {
    users,
    isLoading,
    error,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    changePassword,
    refreshUsers
  } = useUserManagement();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    refreshUsers();
  }, []); // Empty dependency array to run only once on mount

  const handleCreateUser = async () => {
    if (!formData.username || !formData.password) {
      showStatusMessage('Please fill in all fields', true);
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      showStatusMessage('Passwords do not match', true);
      return;
    }
    
    if (formData.password.length < 6) {
      showStatusMessage('Password must be at least 6 characters long', true);
      return;
    }

    try {
      await createUser(formData.username, formData.password);
      setFormData({ username: '', password: '', confirmPassword: '' });
      setShowCreateForm(false);
      showStatusMessage('User created successfully');
      if (onUserAction) onUserAction(() => {}); // Mark as edited
      markConfigAsEdited("user_management");
    } catch (error) {
      showStatusMessage(`Error creating user: ${error.message}`, true);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      showStatusMessage('Please fill in all password fields', true);
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showStatusMessage('New passwords do not match', true);
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      showStatusMessage('Password must be at least 6 characters long', true);
      return;
    }

    try {
      await changePassword(selectedUser, passwordData.newPassword);
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setShowPasswordModal(false);
      setSelectedUser(null);
      showStatusMessage('Password changed successfully');
    } catch (error) {
      showStatusMessage(`Error changing password: ${error.message}`, true);
    }
  };

  const handleToggleStatus = async (username) => {
    if (username === currentUser?.username) {
      showStatusMessage('You cannot disable your own account', true);
      return;
    }
    
    try {
      await toggleUserStatus(username);
      showStatusMessage('User status updated successfully');
    } catch (error) {
      showStatusMessage(`Error updating user status: ${error.message}`, true);
    }
  };

  const handleDeleteUser = async (username) => {
    if (username === currentUser?.username) {
      showStatusMessage('You cannot delete your own account', true);
      return;
    }
    
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(username);
      showStatusMessage('User deleted successfully');
    } catch (error) {
      showStatusMessage(`Error deleting user: ${error.message}`, true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4">
        <div className="text-red-800">Error loading users: {error}</div>
        <button
          onClick={refreshUsers}
          className="mt-2 text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create User Section */}
      <div className="border-b pb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Create New User</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-kyndryl-orange text-white px-4 py-2 rounded hover:bg-orange-600"
          >
            {showCreateForm ? 'Cancel' : 'Add User'}
          </button>
        </div>

        {showCreateForm && (
          <div className="space-y-4 bg-gray-50 p-4 rounded">
            <div>
              <label className="block font-semibold mb-1">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Enter username"
              />
            </div>
            
            <div>
              <label className="block font-semibold mb-1">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Enter password (min 6 characters)"
              />
            </div>
            
            <div>
              <label className="block font-semibold mb-1">Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Confirm password"
              />
            </div>
            
            <button
              onClick={handleCreateUser}
              className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Create User
            </button>
          </div>
        )}
      </div>

      {/* Users List Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Existing Users</h3>
          <button
            onClick={refreshUsers}
            className="text-sm bg-gray-200 text-black px-3 py-1 rounded hover:bg-gray-300"
          >
            Refresh
          </button>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No users found</div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.username}
                className={`p-4 border rounded ${
                  user.is_default ? 'bg-blue-50 border-blue-200' : 
                  user.is_active === false ? 'bg-red-50 border-red-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{user.username}</span>
                      {user.is_default && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                          Default Admin
                        </span>
                      )}
                      {user.is_active === false && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-medium">
                          Disabled
                        </span>
                      )}
                      {user.username === currentUser?.username && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                          Current User
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Created: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user.username);
                        setShowPasswordModal(true);
                      }}
                      className="px-3 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Change Password
                    </button>
                    
                    <button
                      onClick={() => handleToggleStatus(user.username)}
                      disabled={user.username === currentUser?.username}
                      className={`px-3 py-1 rounded text-xs ${
                        user.username === currentUser?.username
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : user.is_active === false
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-yellow-600 text-white hover:bg-yellow-700'
                      }`}
                    >
                      {user.is_active === false ? 'Enable' : 'Disable'}
                    </button>
                    
                    <button
                      onClick={() => handleDeleteUser(user.username)}
                      disabled={user.is_default || user.username === currentUser?.username}
                      className={`px-3 py-1 rounded text-xs ${
                        user.is_default || user.username === currentUser?.username
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {user.is_default ? 'Protected' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Change Password for: {selectedUser}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleChangePassword}
                className="flex-1 bg-kyndryl-orange text-white px-4 py-2 rounded hover:bg-orange-600"
              >
                Change Password
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setSelectedUser(null);
                  setPasswordData({ newPassword: '', confirmPassword: '' });
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
