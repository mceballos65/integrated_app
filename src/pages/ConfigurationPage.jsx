import React, { useState, useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import useConfigStore from "../store";
import { useAuth, useUserManagement } from "../hooks/useAuth.jsx";
import useComponents from "../hooks/useComponents.jsx";
import userApiService from "../services/userApi";
import { getBackendUrl, getBackendUrlForConfig, setBackendUrl, markSetupCompleted } from "../configStorage";
import appLogger from "../services/appLogger";
import UserManagementSection from "../components/UserManagementSection.jsx";

// GitHub Configuration Panel
function GitHubConfigPanel({ 
  localGithubToken, 
  setLocalGithubToken, 
  localGithubUsername, 
  setLocalGithubUsername, 
  localRepositoryUrl, 
  setLocalRepositoryUrl, 
  localBranchName, 
  setLocalBranchName, 
  localPath, 
  setLocalPath, 
  localFilesToSync,
  setLocalFilesToSync,
  handleGitAction, 
  gitStatus, 
  gitPushLoading, 
  gitPullLoading, 
  branchNotFoundError, 
  handleCreateBranch, 
  handleCancelBranchCreation, 
  createBranchLoading, 
  showStatusMessage, 
  markConfigAsEdited 
}) {
  const [hasCredentials, setHasCredentials] = useState(false);
  const [checkingCredentials, setCheckingCredentials] = useState(true);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [savingAdvancedSettings, setSavingAdvancedSettings] = useState(false);

  // Check if GitHub credentials exist on component mount
  useEffect(() => {
    checkGitHubCredentials();
  }, []);

  const checkGitHubCredentials = async () => {
    setCheckingCredentials(true);
    try {
      const response = await fetch('/api/config/github/token/exists', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setHasCredentials(data.hasToken || false);
      
      // Load username from backend if credentials exist
      if (data.hasToken && data.username) {
        setLocalGithubUsername(data.username);
      }
    } catch (error) {
      console.error('Error checking GitHub credentials:', error);
      setHasCredentials(false);
    } finally {
      setCheckingCredentials(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!localGithubToken.trim() || !localGithubUsername.trim()) {
      showStatusMessage('Please enter both GitHub token and username', true);
      return;
    }

    setSavingCredentials(true);
    try {
      const response = await fetch('/api/config/github/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: localGithubToken,
          username: localGithubUsername
        })
      });

      const data = await response.json();
      if (data.success) {
        setHasCredentials(true);
        setLocalGithubToken(''); // Clear token from frontend for security
        showStatusMessage('✅ GitHub credentials saved securely');
        markConfigAsEdited("github");
        appLogger.success('GITHUB_CONFIG', 'GitHub credentials saved securely');
      } else {
        showStatusMessage('❌ Failed to save credentials: ' + data.error, true);
        appLogger.error('GITHUB_CONFIG', 'Failed to save GitHub credentials', { error: data.error });
      }
    } catch (error) {
      showStatusMessage('❌ Error saving credentials: ' + error.message, true);
      appLogger.error('GITHUB_CONFIG', 'Error saving GitHub credentials', { error: error.message });
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleDeleteCredentials = async () => {
    if (!confirm('Are you sure you want to delete the stored GitHub credentials?')) {
      return;
    }

    try {
      const response = await fetch('/api/config/github/token', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success) {
        setHasCredentials(false);
        setLocalGithubToken('');
        setLocalGithubUsername('');
        showStatusMessage('✅ GitHub credentials deleted');
        appLogger.success('GITHUB_CONFIG', 'GitHub credentials deleted');
      } else {
        showStatusMessage('❌ Failed to delete credentials: ' + data.error, true);
        appLogger.error('GITHUB_CONFIG', 'Failed to delete GitHub credentials', { error: data.error });
      }
    } catch (error) {
      showStatusMessage('❌ Error deleting credentials: ' + error.message, true);
      appLogger.error('GITHUB_CONFIG', 'Error deleting GitHub credentials', { error: error.message });
    }
  };

  const handleSaveAdvancedSettings = async () => {
    if (!localBranchName.trim()) {
      showStatusMessage('Branch name cannot be empty', true);
      return;
    }

    if (!localPath.trim()) {
      showStatusMessage('Local path cannot be empty', true);
      return;
    }

    if (!localRepositoryUrl.trim()) {
      showStatusMessage('Repository URL cannot be empty', true);
      return;
    }

    if (!localFilesToSync.trim()) {
      showStatusMessage('Files to backup list cannot be empty', true);
      return;
    }

    setSavingAdvancedSettings(true);
    try {
      // First, check if the branch exists in the remote repository
      showStatusMessage('🔍 Checking if branch exists in remote repository...', false);
      
      const branchCheckResponse = await fetch('/api/config/github/branch/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_url: localRepositoryUrl.trim(),
          branch_name: localBranchName.trim()
        })
      });

      const branchCheckData = await branchCheckResponse.json();
      
      if (!branchCheckData.success) {
        showStatusMessage('❌ Failed to check branch existence: ' + branchCheckData.error, true);
        setSavingAdvancedSettings(false);
        return;
      }

      // If branch doesn't exist, ask user if they want to create it
      if (!branchCheckData.branch_exists) {
        setSavingAdvancedSettings(false);
        
        const shouldCreate = confirm(
          `The branch "${localBranchName.trim()}" does not exist in the remote repository "${localRepositoryUrl.trim()}".\n\n` +
          `Would you like to create this branch automatically?\n\n` +
          `Click "OK" to create the branch and save the configuration.\n` +
          `Click "Cancel" to change the branch name.`
        );

        if (!shouldCreate) {
          showStatusMessage('❌ Configuration not saved. Please choose an existing branch or a different branch name.', true);
          return;
        }

        // User wants to create the branch
        setSavingAdvancedSettings(true);
        showStatusMessage('🔨 Creating branch in remote repository...', false);
        
        try {
          const createBranchResponse = await fetch('/api/config/github/branch/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repository_url: localRepositoryUrl.trim(),
              branch_name: localBranchName.trim()
            })
          });

          const createBranchData = await createBranchResponse.json();
          
          if (!createBranchData.success) {
            showStatusMessage('❌ Failed to create branch: ' + createBranchData.error, true);
            setSavingAdvancedSettings(false);
            return;
          }

          showStatusMessage('✅ Branch created successfully! Now saving configuration...', false);
        } catch (createError) {
          showStatusMessage('❌ Error creating branch: ' + createError.message, true);
          setSavingAdvancedSettings(false);
          return;
        }
      } else {
        showStatusMessage('✅ Branch exists in remote repository. Saving configuration...', false);
      }

      // Now save the configuration
      const response = await fetch('/api/config/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github: {
            branchName: localBranchName.trim(),
            localPath: localPath.trim(),
            repositoryUrl: localRepositoryUrl.trim(),
            filesToSync: localFilesToSync.trim()
          }
        })
      });

      if (response.ok) {
        showStatusMessage('✅ Advanced settings saved successfully');
        markConfigAsEdited("github");
        appLogger.success('GITHUB_CONFIG', 'Advanced GitHub settings saved', { 
          branchName: localBranchName.trim(), 
          localPath: localPath.trim(),
          repositoryUrl: localRepositoryUrl.trim(),
          filesToSync: localFilesToSync.trim(),
          branchExisted: branchCheckData.branch_exists
        });
      } else {
        const errorData = await response.json();
        showStatusMessage('❌ Failed to save advanced settings: ' + (errorData.detail || 'Unknown error'), true);
        appLogger.error('GITHUB_CONFIG', 'Failed to save advanced GitHub settings', { 
          error: errorData.detail || 'Unknown error' 
        });
      }
    } catch (error) {
      showStatusMessage('❌ Error saving advanced settings: ' + error.message, true);
      appLogger.error('GITHUB_CONFIG', 'Error saving advanced GitHub settings', { 
        error: error.message 
      });
    } finally {
      setSavingAdvancedSettings(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <div className="flex items-center mb-6">
        <span className="text-2xl mr-3">📁</span>
        <h2 className="text-2xl font-bold text-kyndryl-orange">GitHub Integration</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-md font-semibold text-blue-800 mb-2">GitHub Repository Configuration</h3>
        <p className="text-sm text-blue-700">
          Configure GitHub integration to sync configuration files with your repository. 
          All credentials are encrypted and stored securely on the backend.
        </p>
      </div>

      {/* Basic Configuration Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          📝 Basic Configuration
        </h3>
        
        {/* GitHub Token */}
        <div className="mb-4">
          <label className="block font-semibold mb-1">
            GitHub Personal Access Token
            <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={localGithubToken}
              onChange={(e) => setLocalGithubToken(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2"
              placeholder={hasCredentials ? "Token is stored securely" : "Enter your GitHub token"}
              disabled={checkingCredentials}
            />
            {hasCredentials && (
              <button
                onClick={handleDeleteCredentials}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                title="Delete stored credentials"
              >
                🗑️ Delete
              </button>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {hasCredentials ? (
              <span className="text-green-600">✅ Token is securely stored on backend</span>
            ) : (
              "Generate at: GitHub → Settings → Developer settings → Personal access tokens"
            )}
          </p>
        </div>

        {/* GitHub Username */}
        <div className="mb-4">
          <label className="block font-semibold mb-1">
            GitHub Username
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={localGithubUsername}
            onChange={(e) => setLocalGithubUsername(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="your-github-username"
            disabled={checkingCredentials}
          />
          <p className="text-sm text-gray-600 mt-1">
            Your GitHub username (for authentication and commits)
          </p>
        </div>

        {/* Save Credentials Button */}
        <button
          onClick={handleSaveCredentials}
          disabled={savingCredentials || checkingCredentials || (!localGithubToken && !hasCredentials)}
          className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {savingCredentials ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : hasCredentials ? (
            "🔄 Update Credentials"
          ) : (
            "💾 Save Credentials"
          )}
        </button>
      </div>

      {/* Advanced Configuration Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          ⚙️ Advanced Configuration
        </h3>
        
        {/* Repository URL */}
        <div className="mb-4">
          <label className="block font-semibold mb-1">
            Repository URL
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={localRepositoryUrl}
            onChange={(e) => setLocalRepositoryUrl(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="https://github.com/username/repository.git"
          />
          <p className="text-sm text-gray-600 mt-1">
            The HTTPS URL of your GitHub repository
          </p>
        </div>
        
        {/* Branch Name */}
        <div className="mb-4">
          <label className="block font-semibold mb-1">Branch Name</label>
          <input
            type="text"
            value={localBranchName}
            onChange={(e) => setLocalBranchName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="main"
          />
          <p className="text-sm text-gray-600 mt-1">
            The branch to push to and pull from (default: main)
          </p>
        </div>

        {/* Local Path */}
        <div className="mb-4">
          <label className="block font-semibold mb-1">Local Path</label>
          <input
            type="text"
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="./app_data/config"
          />
          <p className="text-sm text-gray-600 mt-1">
            Local directory path to sync with the repository
          </p>
        </div>

        {/* Files to Sync */}
        <div className="mb-4">
          <label className="block font-semibold mb-1">Files to Backup</label>
          <textarea
            value={localFilesToSync}
            onChange={(e) => setLocalFilesToSync(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 h-32 font-mono text-sm"
            placeholder="./app_data/config/app_config.json&#10;./app_data/config/accounts.json&#10;./app_data/config/component_list.json"
          />
          <p className="text-sm text-gray-600 mt-1">
            List of specific files to backup/sync (one per line). Only these files will be pushed/pulled to/from the repository.
          </p>
        </div>

        {/* Save Advanced Settings Button */}
        <button
          onClick={handleSaveAdvancedSettings}
          disabled={savingAdvancedSettings || !localBranchName.trim() || !localPath.trim() || !localRepositoryUrl.trim() || !localFilesToSync.trim()}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {savingAdvancedSettings ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            "💾 Save Advanced Settings"
          )}
        </button>
      </div>

      {/* Git Actions */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          🚀 Git Actions
        </h3>
        
        <div className="flex gap-2">
          <button
            onClick={() => handleGitAction("pull")}
            disabled={gitPullLoading || !hasCredentials}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {gitPullLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Pulling...
              </>
            ) : (
              "⬇️ Git Pull"
            )}
          </button>
          <button
            onClick={() => handleGitAction("push")}
            disabled={gitPushLoading || !hasCredentials}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {gitPushLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Pushing...
              </>
            ) : (
              "⬆️ Git Push"
            )}
          </button>
        </div>
        
        {!hasCredentials && (
          <p className="text-sm text-orange-600 mt-2 text-center">
            ⚠️ Please save your credentials before using Git actions
          </p>
        )}
      </div>

      {/* Branch Not Found Error Dialog */}
      {branchNotFoundError && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
          <div className="flex items-center mb-3">
            <span className="text-xl mr-2">⚠️</span>
            <h3 className="text-md font-semibold text-yellow-800">Branch Not Found</h3>
          </div>
          <p className="text-sm text-yellow-700 mb-4">
            The specified branch "{branchNotFoundError.branchName}" does not exist in the remote repository.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCreateBranch}
              disabled={createBranchLoading}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {createBranchLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                "Create Branch"
              )}
            </button>
            <button
              onClick={handleCancelBranchCreation}
              disabled={createBranchLoading}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Git Status Display */}
      {gitStatus && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Git Status:</h3>
          <pre className="p-3 bg-gray-100 rounded text-xs whitespace-pre-wrap border">
            {gitStatus}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function ConfigurationPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  const {
    config,
    configLoaded,
    loading,
    error,
    updateConfig,
    loadConfig
  } = useConfigStore();
  
  // We'll use config values directly instead of getters
  const adminUserDisabled = config?.security?.admin_user_disabled || false;
  const debugRequiresAuth = config?.security?.debug_requires_auth || false;
  const { securityWarning } = useAuth();
  const { refreshUsers, users } = useUserManagement();

  // Check if we came from a security warning
  const fromSecurityWarning = searchParams.get('from') === 'security';
  const shouldHighlightSecurity = fromSecurityWarning || !!securityWarning;
  
  // Check if there are active users other than admin
  const hasAlternativeUsers = users.filter(user => user.username !== 'admin' && user.is_active).length > 0;
  
  const [localPredictionUrl, setLocalPredictionUrl] = useState("");
  const [localAccountCode, setLocalAccountCode] = useState("");
  const [isAdminUserActive, setIsAdminUserActive] = useState(false);

  const [localGithubToken, setLocalGithubToken] = useState("");
  const [localGithubUsername, setLocalGithubUsername] = useState("");
  const [localRepositoryUrl, setLocalRepositoryUrl] = useState("");
  const [localBranchName, setLocalBranchName] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [localFilesToSync, setLocalFilesToSync] = useState("");

  // Environment variables status
  const [environmentStatus, setEnvironmentStatus] = useState([]);
  const [loadingEnvironmentStatus, setLoadingEnvironmentStatus] = useState(true);
  const [gitStatus, setGitStatus] = useState("");
  const [localBackendUrl, setLocalBackendUrl] = useState("");
  
  // Git action loading states
  const [gitPushLoading, setGitPushLoading] = useState(false);
  const [gitPullLoading, setGitPullLoading] = useState(false);
  
  // Branch error handling states
  const [branchNotFoundError, setBranchNotFoundError] = useState(null);
  const [createBranchLoading, setCreateBranchLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);

  // Active panel state for the new sidebar layout
  const [activePanel, setActivePanel] = useState(() => {
    // If coming from security warning, go to security tab
    if (fromSecurityWarning) {
      return "security";
    }
    // Otherwise, recover from localStorage or use "extension" as default (first setup step)
    return localStorage.getItem('kyndryl_active_panel') || "extension";
  });

  // Debug logging (after activePanel is declared)
  console.log('ConfigurationPage Debug:', {
    users,
    hasAlternativeUsers,
    activePanel,
    adminUserDisabled,
    debugRequiresAuth
  });

  // Auto-switch to security panel if coming from security warning
  useEffect(() => {
    if (fromSecurityWarning && activePanel !== "security") {
      setActivePanel("security");
      localStorage.setItem('kyndryl_active_panel', "security");
    }
  }, [fromSecurityWarning, activePanel]);

  // Load users when component mounts
  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  // Load environment variables status
  useEffect(() => {
    const loadEnvironmentStatus = async () => {
      setLoadingEnvironmentStatus(true);
      try {
        const response = await fetch('/api/config/environment-status');
        if (response.ok) {
          const data = await response.json();
          setEnvironmentStatus(data.environment_status || []);
        } else {
          console.error('Failed to load environment status');
          setEnvironmentStatus([]);
        }
      } catch (error) {
        console.error('Error loading environment status:', error);
        setEnvironmentStatus([]);
      } finally {
        setLoadingEnvironmentStatus(false);
      }
    };

    loadEnvironmentStatus();
  }, []);

  // Función personalizada para cambiar el panel activo y guardarlo en localStorage
  const changeActivePanel = async (panel) => {
    // Refresh users list before validation to ensure we have the latest data
    await refreshUsers();
    
    // Recalculate hasAlternativeUsers with fresh data
    const currentHasAlternativeUsers = users.filter(user => user.username !== 'admin' && user.is_active).length > 0;
    
    // Only apply user validation if trying to leave "users" panel AND there are still security issues
    if (activePanel === "users" && panel !== "users" && !currentHasAlternativeUsers && !adminUserDisabled) {
      showStatusMessage('Please create a new user before leaving this section', true);
      return;
    }
    
    console.log(`Switching to panel: ${panel}, reloading config from backend...`);
    setActivePanel(panel);
    localStorage.setItem('kyndryl_active_panel', panel);
    
    // Reload configuration from backend when switching tabs
    try {
      await loadConfig();
      console.log('Configuration reloaded successfully');
    } catch (error) {
      console.error('Error reloading configuration:', error);
      showStatusMessage('Error reloading configuration from backend', true);
    }
  };

  // Helper function to reload config after making changes
  const reloadConfigAfterChange = async () => {
    try {
      await loadConfig();
      console.log('Configuration reloaded after change');
    } catch (error) {
      console.error('Error reloading configuration after change:', error);
    }
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
      const directAccountCode = config?.app?.account_code || "";
      const directGithubToken = config?.github?.token || "";
      const directGithubUsername = config?.github?.githubUsername || "";
      const directGithubRepoUrl = config?.github?.repositoryUrl || "";
      const directGithubBranch = config?.github?.branchName || "main";
      const directLocalPath = config?.github?.localPath || "./app_data/config";
      const directFilesToSync = config?.github?.filesToSync || `./app_data/config/app_config.json
./app_data/config/accounts.json
./app_data/config/component_list.json
./app_data/config/data.json
./app_data/logs/app_log.log
./app_data/logs/predictions.log`;
      const directDebugRequiresAuth = config?.security?.debug_requires_auth || false;
      
      // Actualizar localStorage para mantener consistencia
      localStorage.setItem('debugRequiresAuth', directDebugRequiresAuth ? 'true' : 'false');
      
      console.log("Setting local values from config directly:", {
        directPredictionUrl,
        directAccountCode,
        directGithubToken,
        directGithubUsername,
        directGithubRepoUrl,
        directGithubBranch,
        directLocalPath
      });
      
      setLocalPredictionUrl(directPredictionUrl);
      setLocalAccountCode(directAccountCode);
      // Never load the token into the frontend for security reasons
      // setLocalGithubToken(directGithubToken);
      setLocalGithubUsername(directGithubUsername);
      setLocalRepositoryUrl(directGithubRepoUrl);
      setLocalBranchName(directGithubBranch);
      setLocalPath(directLocalPath);
      setLocalFilesToSync(directFilesToSync);
      
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
    setLocalBackendUrl(getBackendUrlForConfig());
  }, [configLoaded, config]); // Simplified dependencies

  // Check admin user status and sync with backend config
  useEffect(() => {
    async function checkAdminStatus() {
      try {
        // Obtener la lista de usuarios para verificar si el admin está activo
        const users = await userApiService.getUsers();
        const adminUser = users.find(user => user.username === 'admin');
        
        if (adminUser) {
          setIsAdminUserActive(adminUser.is_active);
          console.log('Admin user status:', adminUser.is_active ? 'Active' : 'Inactive');
          
          // Sync backend config with actual user status if needed
          if (adminUserDisabled && adminUser.is_active) {
            // If config says admin should be disabled but user is active, disable the user
            console.log('Syncing: Disabling admin user to match backend config');
            await userApiService.toggleUserStatus('admin');
            setIsAdminUserActive(false);
          } else if (!adminUserDisabled && !adminUser.is_active) {
            // If config says admin should be enabled but user is inactive, enable the user
            console.log('Syncing: Enabling admin user to match backend config');
            await userApiService.toggleUserStatus('admin');
            setIsAdminUserActive(true);
          }
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
      // Also refresh the users list to ensure UI is in sync
      refreshUsers();
    }
  }, [adminUserDisabled, configLoaded, refreshUsers]);

  const handleSave = async () => {
    // Check if Account Code is empty
    if (!localAccountCode || localAccountCode.trim() === "") {
      showStatusMessage("Account Code is required. Please enter a 3-character code.", true);
      appLogger.warn('CONFIG_VALIDATION', 'Account code is required but not provided');
      return;
    }

    // Check if Account Code format is valid
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
        setLocalAccountCode(updatedConfig.app?.account_code || "");
        // Never load token into frontend - it should always start empty for security
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
    const endpoint = action === "pull" ? "/api/git/pull" : "/api/git/push";
    appLogger.info('GIT_ACTION', `Attempting git ${action}`, { endpoint });
    
    // Clear any previous branch errors
    setBranchNotFoundError(null);
    
    // Set loading state
    if (action === "push") {
      setGitPushLoading(true);
    } else {
      setGitPullLoading(true);
    }
    
    try {
      const res = await fetch(endpoint, {
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
        // Check if it's a branch not found error
        const errorMessage = data.error || '';
        console.log("Git action failed. Error message:", errorMessage);
        
        const branchNotFoundPattern = /src refspec (.+?) does not match any/;
        const match = errorMessage.match(branchNotFoundPattern);
        
        console.log("Branch not found pattern match:", match);
        
        if (match && action === "push") {
          const branchName = match[1];
          console.log("Branch not found detected. Branch name:", branchName);
          
          setBranchNotFoundError({
            branchName: branchName,
            originalAction: action,
            fullError: errorMessage
          });
          setGitStatus(`❌ Branch "${branchName}" does not exist on remote repository`);
        } else {
          setGitStatus(`❌ ${action.toUpperCase()} failed:\n${data.error}`);
        }
        
        appLogger.error('GIT_ACTION', `Git ${action} failed`, { error: data.error });
      }
    } catch (err) {
      setGitStatus(`❌ ${action.toUpperCase()} error:\n${err.message}`);
      appLogger.error('GIT_ACTION', `Git ${action} error`, { error: err.message });
    } finally {
      // Clear loading state
      if (action === "push") {
        setGitPushLoading(false);
      } else {
        setGitPullLoading(false);
      }
    }
  };

  const handleCreateBranch = async () => {
    if (!branchNotFoundError) return;
    
    const { branchName, originalAction } = branchNotFoundError;
    setCreateBranchLoading(true);
    
    try {
      // Call backend to create the branch
      const res = await fetch('/api/git/create-branch', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchName })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setGitStatus(`✅ Branch "${branchName}" created successfully!\nNow attempting ${originalAction}...`);
        setBranchNotFoundError(null);
        
        // Automatically perform the original action (push) after creating the branch
        setTimeout(() => {
          handleGitAction(originalAction);
        }, 1000);
        
        appLogger.success('GIT_ACTION', `Branch created successfully`, { branchName });
      } else {
        setGitStatus(`❌ Failed to create branch "${branchName}":\n${data.error}`);
        appLogger.error('GIT_ACTION', `Failed to create branch`, { branchName, error: data.error });
      }
    } catch (err) {
      setGitStatus(`❌ Error creating branch:\n${err.message}`);
      appLogger.error('GIT_ACTION', `Error creating branch`, { error: err.message });
    } finally {
      setCreateBranchLoading(false);
    }
  };

  const handleCancelBranchCreation = () => {
    setBranchNotFoundError(null);
    setGitStatus("❌ Branch creation cancelled");
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
            {/* Extension Settings - New first panel */}
            <button
              onClick={() => changeActivePanel("extension")}
              className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                activePanel === "extension" 
                  ? "bg-kyndryl-orange text-white" 
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center">
                <span className="text-lg mr-3">🔧</span>
                <span className="font-medium">Extension Settings</span>
              </div>
              {!editedConfigs.extension && (
                <span className="text-red-500 text-xl font-bold">!</span>
              )}
            </button>

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
                <span className="text-lg mr-3">�️</span>
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

            {/* Components Management */}
            <button
              onClick={() => changeActivePanel("components")}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                activePanel === "components" 
                  ? "bg-kyndryl-orange text-white" 
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center">
                <span className="text-lg mr-3">🧩</span>
                <span className="font-medium">Components</span>
              </div>
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
              {!editedConfigs.users && (
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
          {activePanel === "extension" && <ExtensionSettingsPanel 
            environmentStatus={environmentStatus}
            loadingEnvironmentStatus={loadingEnvironmentStatus}
            showStatusMessage={showStatusMessage}
            markConfigAsEdited={markConfigAsEdited}
            changeActivePanel={changeActivePanel}
          />}

          {activePanel === "backend" && <BackendConfigPanel 
            localBackendUrl={localBackendUrl}
            setLocalBackendUrl={setLocalBackendUrl}
            handleBackendUrlSave={handleBackendUrlSave}
            testBackendConnection={testBackendConnection}
            getBackendUrl={getBackendUrlForConfig}
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

          {activePanel === "components" && <ComponentsPanel 
            showStatusMessage={showStatusMessage}
          />}

          {activePanel === "users" && <UserManagementPanel 
            showStatusMessage={showStatusMessage}
            markConfigAsEdited={markConfigAsEdited}
            reloadConfig={reloadConfigAfterChange}
            updateConfig={updateConfig}
            refreshUsers={refreshUsers}
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
            reloadConfig={reloadConfigAfterChange}
            shouldHighlightSecurity={shouldHighlightSecurity}
            securityWarning={securityWarning}
            changeActivePanel={changeActivePanel}
            branchNotFoundError={branchNotFoundError}
            handleCreateBranch={handleCreateBranch}
            handleCancelBranchCreation={handleCancelBranchCreation}
            createBranchLoading={createBranchLoading}
            gitStatus={gitStatus}
          />}

          {activePanel === "logs" && <LogConfigPanel 
            updateConfig={updateConfig}
            markConfigAsEdited={markConfigAsEdited}
            showStatusMessage={showStatusMessage}
          />}

          {activePanel === "github" && <GitHubConfigPanel 
            localGithubToken={localGithubToken}
            setLocalGithubToken={setLocalGithubToken}
            localGithubUsername={localGithubUsername}
            setLocalGithubUsername={setLocalGithubUsername}
            localRepositoryUrl={localRepositoryUrl}
            setLocalRepositoryUrl={setLocalRepositoryUrl}
            localBranchName={localBranchName}
            setLocalBranchName={setLocalBranchName}
            localPath={localPath}
            setLocalPath={setLocalPath}
            localFilesToSync={localFilesToSync}
            setLocalFilesToSync={setLocalFilesToSync}
            handleGitAction={handleGitAction}
            gitStatus={gitStatus}
            gitPushLoading={gitPushLoading}
            gitPullLoading={gitPullLoading}
            branchNotFoundError={branchNotFoundError}
            handleCreateBranch={handleCreateBranch}
            handleCancelBranchCreation={handleCancelBranchCreation}
            createBranchLoading={createBranchLoading}
            showStatusMessage={showStatusMessage}
            markConfigAsEdited={markConfigAsEdited}
          />}
          
          {/* Need Help Link - appears at the bottom of all tabs */}
          <div className="mt-8 text-center border-t border-gray-200 pt-6">
            <Link
              to="/help"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline transition-colors duration-200"
            >
              Need Help?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Extension Settings Panel Component
function ExtensionSettingsPanel({ environmentStatus, loadingEnvironmentStatus, showStatusMessage, markConfigAsEdited, changeActivePanel }) {
  const [saving, setSaving] = useState(false);

  const handleSaveInitialConfig = async () => {
    setSaving(true);
    try {
      // Create initial app_config.json from environment variables
      const response = await fetch('/api/config/initialize-from-environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (data.success) {
        showStatusMessage('✅ Initial configuration created successfully! Moving to Backend Server setup...');
        await markConfigAsEdited("extension");
        
        // Automatically move to the next step (Backend Server) after a short delay
        setTimeout(() => {
          changeActivePanel("backend");
        }, 2000);
      } else {
        showStatusMessage('❌ Failed to create initial configuration: ' + (data.error || 'Unknown error'), true);
      }
    } catch (error) {
      showStatusMessage('❌ Error creating initial configuration: ' + error.message, true);
    } finally {
      setSaving(false);
    }
  };

  const hasRequiredVariables = environmentStatus.some(env => env.status === 'success');
  const hasAllRequiredVariables = environmentStatus.filter(env => env.required).every(env => env.status === 'success');

  if (loadingEnvironmentStatus) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">🔧</span>
          <h2 className="text-2xl font-bold text-kyndryl-orange">Extension Settings</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kyndryl-orange mr-3"></div>
          <span className="text-gray-600">Loading environment variables...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <div className="flex items-center mb-6">
        <span className="text-2xl mr-3">🔧</span>
        <h2 className="text-2xl font-bold text-kyndryl-orange">Extension Settings</h2>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-md font-semibold text-blue-800 mb-2">Environment Configuration</h3>
        <p className="text-sm text-blue-700">
          These settings are automatically detected from your VS Code extension properties. 
          Green indicates configured values, red indicates missing required values.
        </p>
      </div>

      {/* Environment Variables Status */}
      <div className="space-y-3 mb-8">
        {environmentStatus.map((env, index) => (
          <div 
            key={env.variable}
            className={`flex items-center justify-between p-4 rounded-lg border ${
              env.status === 'success' 
                ? 'bg-green-50 border-green-200' 
                : env.status === 'warning'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center">
              <span className={`text-xl mr-4 ${
                env.status === 'success' 
                  ? 'text-green-600' 
                  : env.status === 'warning'
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}>
                {env.status === 'success' ? '✅' : env.status === 'warning' ? '⚠️' : '❌'}
              </span>
              <div>
                <div className="font-semibold text-gray-900 text-lg">
                  {env.variable}
                </div>
                <div className={`text-sm ${
                  env.status === 'success' 
                    ? 'text-green-700' 
                    : env.status === 'warning'
                    ? 'text-yellow-700'
                    : 'text-red-700'
                }`}>
                  {env.message}
                </div>
              </div>
            </div>
            <div className={`text-xs px-2 py-1 rounded ${
              env.required 
                ? 'bg-red-100 text-red-800 border border-red-200' 
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}>
              {env.required ? 'Required' : 'Optional'}
            </div>
          </div>
        ))}
      </div>

      {environmentStatus.length === 0 && (
        <div className="text-center py-8 text-gray-500 mb-8">
          <span className="text-4xl mb-2 block">📋</span>
          <p className="text-lg font-medium">No environment variables detected</p>
          <p className="text-sm">Manual configuration will be required in the following steps</p>
        </div>
      )}

      {/* Configuration Status Summary */}
      {environmentStatus.length > 0 && (
        <div className={`p-4 rounded-lg border mb-6 ${
          hasAllRequiredVariables 
            ? 'bg-green-50 border-green-200' 
            : hasRequiredVariables
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center mb-2">
            <span className={`text-xl mr-3 ${
              hasAllRequiredVariables 
                ? 'text-green-600' 
                : hasRequiredVariables
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}>
              {hasAllRequiredVariables ? '✅' : hasRequiredVariables ? '⚠️' : '❌'}
            </span>
            <h3 className={`font-semibold ${
              hasAllRequiredVariables 
                ? 'text-green-800' 
                : hasRequiredVariables
                ? 'text-yellow-800'
                : 'text-red-800'
            }`}>
              Configuration Status
            </h3>
          </div>
          <p className={`text-sm ${
            hasAllRequiredVariables 
              ? 'text-green-700' 
              : hasRequiredVariables
              ? 'text-yellow-700'
              : 'text-red-700'
          }`}>
            {hasAllRequiredVariables 
              ? 'All required environment variables are configured. Ready to create initial configuration.'
              : hasRequiredVariables
              ? 'Some environment variables are configured. You can proceed, but some features may require manual setup.'
              : 'No environment variables are configured. Manual configuration will be required for all features.'
            }
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex flex-col space-y-4">
        <button
          onClick={handleSaveInitialConfig}
          disabled={saving}
          className={`w-full px-6 py-3 rounded-lg font-semibold text-white transition-colors flex items-center justify-center ${
            saving
              ? 'bg-gray-400 cursor-not-allowed'
              : hasRequiredVariables
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              Creating Initial Configuration...
            </>
          ) : (
            <>
              <span className="text-xl mr-2">💾</span>
              Save & Create Initial Configuration
            </>
          )}
        </button>
        
        <p className="text-sm text-gray-600 text-center">
          This will create the initial app_config.json file based on your environment variables
          and automatically move you to the next setup step.
        </p>
      </div>
    </div>
  );
}

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
            Enter the complete URL including protocol (http:// or https://) - http://localhost:8000 is the default for AIOps Extension.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">   
              <li>Steps: </li>
              <li>Test Connection (Wait for confirmation)</li>
              <li>Save URL</li>
              <li>Move to "App Configuration" section</li>
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
          <label className="block font-semibold mb-1">
            Account Code (tri-code) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={localAccountCode}
            onChange={(e) => setLocalAccountCode(e.target.value.toUpperCase())}
            maxLength="3"
            className={`w-full border rounded px-3 py-2 ${
              localAccountCode.trim() === "" 
                ? "border-red-300 focus:border-red-500 focus:ring-red-200" 
                : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
            } focus:outline-none focus:ring-2`}
            placeholder="Ex: ABC"
            required
          />
          <p className="text-sm text-gray-600 mt-1">
            <span className="text-red-500">*Required:</span> Three-character account identifier GSMA code.
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!localAccountCode || localAccountCode.trim() === ""}
        className={`w-full font-bold py-2 px-4 rounded mt-6 transition-colors duration-200 ${
          !localAccountCode || localAccountCode.trim() === ""
            ? "bg-gray-400 text-gray-200 cursor-not-allowed"
            : "bg-kyndryl-orange text-white hover:bg-orange-600"
        }`}
      >
        Save Configuration
      </button>
    </div>
  );
}

function UserManagementPanel({ showStatusMessage, markConfigAsEdited, reloadConfig, updateConfig, refreshUsers }) {
  // Mark as edited when user interacts with this panel
  const handleUserAction = async (action) => {
    markConfigAsEdited("users");
    const result = await action();
    // Refresh the main users list to ensure validation works correctly
    if (refreshUsers) {
      await refreshUsers();
    }
    return result;
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
          <h3 className="text-md font-semibold text-blue-800 mb-2">Please create a new user on this page</h3>
        </p>
      </div>

      <UserManagementSection 
        showStatusMessage={showStatusMessage}
        onUserAction={handleUserAction}
        reloadConfig={reloadConfig}
        updateConfig={updateConfig}
      />
    </div>
  );
}

function AdminSecurityPanel({ 
  adminUserDisabled, 
  debugRequiresAuth, 
  isAdminUserActive, 
  setIsAdminUserActive, 
  updateConfig, 
  refreshUsers, 
  showStatusMessage, 
  markConfigAsEdited, 
  reloadConfig, 
  shouldHighlightSecurity, 
  securityWarning,
  changeActivePanel, // Add this to allow navigation to user management
  branchNotFoundError,
  handleCreateBranch,
  handleCancelBranchCreation,
  createBranchLoading,
  gitStatus
}) {
  // Estado local para manejar el toggle de protección de la página de debug
  const [isDebugProtected, setIsDebugProtected] = useState(debugRequiresAuth);
  
  // Get users list to check if there are alternative admin users
  const { users, refreshUsers: refreshUsersList } = useUserManagement();
  
  // Sincronizar el estado local cuando cambia el prop
  useEffect(() => {
    setIsDebugProtected(debugRequiresAuth);
  }, [debugRequiresAuth]);

  // Load users when component mounts
  useEffect(() => {
    refreshUsersList();
  }, [refreshUsersList]);

  // Check if there are active users other than admin
  const hasAlternativeUsers = users.filter(user => user.username !== 'admin' && user.is_active).length > 0;

  // Determine which controls to highlight based on security issues
  const highlightAdminUser = shouldHighlightSecurity && !adminUserDisabled;
  const highlightDebugAccess = shouldHighlightSecurity && !debugRequiresAuth;
  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <div className="flex items-center mb-6">
        <span className="text-2xl mr-3">🔒</span>
        <h2 className="text-2xl font-bold text-kyndryl-orange">Admin Security</h2>
      </div>

      {/* Special warning if coming from security issue */}
      {shouldHighlightSecurity && securityWarning && (
        <div className="p-4 mb-6 bg-red-50 border border-red-300 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">🚨 Security Issues Detected</h3>
              <div className="mt-2 text-sm text-red-700">
                <p className="mb-2">{securityWarning}</p>
                <p className="font-medium">Please fix the highlighted security settings below:</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <p>The following security settings are enforced:</p>
              <ul className="list-disc pl-5 mt-2">
                <li><strong>Disable default "admin" user</strong> - Create a new administrator account with a different username.</li>
                <li><strong>Restrict debug page access</strong> - Make the debug page accessible only to authenticated users.</li>
              </ul>
              <div className="mt-2 text-sm">
              <p><strong>Prediction, Test Matcher and Log pages are unavailable until this is configured</strong></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Warning when no alternative users exist */}
      {!hasAlternativeUsers && (
        <div className="p-4 mb-6 bg-orange-50 border border-orange-300 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-orange-800">⚠️ Please create another user first</h3>
              <div className="mt-2 text-sm text-orange-700">
                <p className="mb-2">You cannot disable the default admin user until you create an alternative administrator account.</p>
                <button 
                  onClick={() => changeActivePanel('users')}
                  className="font-medium text-orange-800 underline hover:text-orange-900"
                >
                  Create another user →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin User Security Setting */}
      <div className={`flex items-center space-x-2 mb-6 p-3 rounded-lg ${highlightAdminUser ? 'border-2 border-red-500 bg-red-50' : ''}`}>
        {highlightAdminUser && (
          <div className="mr-2 text-red-500 text-xl">🚨</div>
        )}
        <div className="flex-1">
          <label className="inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={adminUserDisabled} 
              onChange={async (e) => {
                const newConfigValue = e.target.checked; // true = disabled, false = enabled
                
                // If trying to disable admin user, check if there are alternative users
                if (newConfigValue && !hasAlternativeUsers) {
                  showStatusMessage('Cannot disable admin user: Please create another user first', true);
                  return;
                }
                
                try {
                  // First update the backend configuration
                  await updateConfig({
                    security: { admin_user_disabled: newConfigValue }
                  });
                  
                  // Then sync the actual user status to match
                  if (newConfigValue && isAdminUserActive) {
                    // Config says disable, and user is currently active -> deactivate user
                    const userApiService = await import("../services/userApi");
                    await userApiService.default.toggleUserStatus('admin');
                    refreshUsers();
                    setIsAdminUserActive(false);
                  } else if (!newConfigValue && !isAdminUserActive) {
                    // Config says enable, and user is currently inactive -> activate user
                    const userApiService = await import("../services/userApi");
                    await userApiService.default.toggleUserStatus('admin');
                    refreshUsers();
                    setIsAdminUserActive(true);
                  }
                  
                  markConfigAsEdited("security");
                  showStatusMessage(newConfigValue ? '🔒 Default admin user disabled for security' : '⚠️ Warning: Default admin user is now enabled');
                  
                  // Reload configuration from backend to ensure UI shows real state
                  await reloadConfig();
                } catch (error) {
                  showStatusMessage(`Error updating admin user configuration: ${error.message}`, true);
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
            // Check if there are alternative users before disabling admin
            if (!hasAlternativeUsers) {
              showStatusMessage('Cannot disable admin user: Please create another user first', true);
              return;
            }
            
            try {
              // Update backend configuration first
              await updateConfig({
                security: { admin_user_disabled: true }
              });
              
              // Then ensure the user is actually deactivated
              if (isAdminUserActive) {
                const userApiService = await import("../services/userApi");
                await userApiService.default.toggleUserStatus('admin');
                refreshUsers();
                setIsAdminUserActive(false);
              }
              
              markConfigAsEdited("security");
              showStatusMessage("🔒 Security improvement applied: Default admin user has been disabled for security!");
              
              // Reload configuration from backend to ensure UI shows real state
              await reloadConfig();
            } catch (error) {
              showStatusMessage(`Error applying security setting: ${error.message}`, true);
            }
          }}
          disabled={adminUserDisabled || !hasAlternativeUsers}
          className={`px-4 py-2 text-sm text-white font-medium rounded ${(adminUserDisabled || !hasAlternativeUsers) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
        >
          Apply Security Setting
        </button>
      </div>

      {/* Debug Page Access Restriction Setting */}
      <div className={`flex items-center space-x-2 mb-6 p-3 rounded-lg ${highlightDebugAccess ? 'border-2 border-red-500 bg-red-50' : ''}`}>
        {highlightDebugAccess && (
          <div className="mr-2 text-red-500 text-xl">🚨</div>
        )}
        <div className="flex-1">
          <label className="inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={isDebugProtected} 
              onChange={async (e) => {
                const newValue = e.target.checked;
                setIsDebugProtected(newValue);
                
                try {
                  // Update backend configuration
                  await updateConfig({
                    security: { debug_requires_auth: newValue }
                  });
                  
                  markConfigAsEdited("security");
                  showStatusMessage(newValue ? '🔒 Debug page access is now restricted to authenticated users' : '⚠️ Warning: Debug page is now publicly accessible');
                  
                  // Update localStorage for immediate effect
                  localStorage.setItem('debugRequiresAuth', newValue ? 'true' : 'false');
                  
                  // Reload configuration from backend to ensure UI shows real state
                  await reloadConfig();
                } catch (error) {
                  setIsDebugProtected(!newValue); // Revert on error
                  showStatusMessage(`Error updating debug access configuration: ${error.message}`, true);
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
              // Update backend configuration
              await updateConfig({
                security: { debug_requires_auth: true }
              });
              
              setIsDebugProtected(true);
              markConfigAsEdited("security");
              showStatusMessage("🔒 Security improvement applied: Debug page access is now restricted to authenticated users!");
              
              // Update localStorage for immediate effect
              localStorage.setItem('debugRequiresAuth', 'true');
              
              // Reload configuration from backend to ensure UI shows real state
              await reloadConfig();
            } catch (error) {
              showStatusMessage(`Error applying security setting: ${error.message}`, true);
            }
          }}
          disabled={isDebugProtected}
          className={`px-4 py-2 text-sm text-white font-medium rounded ${isDebugProtected ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
        >
          Apply Security Setting
        </button>
      </div>

      {/* Debug: Force show branch error dialog for testing */}
      {/* Uncomment the next line to test the dialog UI:
      {true && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
          <div className="flex items-center mb-3">
            <span className="text-xl mr-2">⚠️</span>
            <h3 className="text-md font-semibold text-yellow-800">Branch Not Found (TEST)</h3>
          </div>
          <p className="text-sm text-yellow-700 mb-4">
            The specified branch "main-3" does not exist in the remote repository.
          </p>
          <div className="flex gap-2">
            <button className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              Create Branch
            </button>
            <button className="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}
      */}

      {/* Branch Not Found Error Dialog */}
      {branchNotFoundError && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
          <div className="flex items-center mb-3">
            <span className="text-xl mr-2">⚠️</span>
            <h3 className="text-md font-semibold text-yellow-800">Branch Not Found</h3>
          </div>
          <p className="text-sm text-yellow-700 mb-4">
            The specified branch "{branchNotFoundError.branchName}" does not exist in the remote repository.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCreateBranch}
              disabled={createBranchLoading}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {createBranchLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                "Create Branch"
              )}
            </button>
            <button
              onClick={handleCancelBranchCreation}
              disabled={createBranchLoading}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {gitStatus && (
        <pre className="mt-4 p-3 bg-gray-100 rounded text-xs whitespace-pre-wrap">
          {gitStatus}
        </pre>
      )}
    </div>
  );
}

// Components Management Panel
function ComponentsPanel({ showStatusMessage }) {
  const { 
    components, 
    loading, 
    error, 
    fetchComponents, 
    addComponent, 
    updateComponent, 
    removeComponent,
    toggleComponent 
  } = useComponents(true); // Include disabled components for management

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);

  const [newComponent, setNewComponent] = useState({
    name: '',
    value: '',
    description: '',
    enabled: true
  });

  const handleAddComponent = async (e) => {
    e.preventDefault();
    
    if (!newComponent.name || !newComponent.value) {
      showStatusMessage("Name and Value are required fields", true);
      return;
    }

    // Check if component with same value already exists
    if (components.some(comp => comp.value === newComponent.value)) {
      showStatusMessage("A component with this value already exists", true);
      return;
    }

    const result = await addComponent(newComponent);
    if (result) {
      showStatusMessage(`Component "${newComponent.name}" added successfully`);
      setNewComponent({ name: '', value: '', description: '', enabled: true });
      setShowAddForm(false);
    } else {
      showStatusMessage("Error adding component", true);
    }
  };

  const handleUpdateComponent = async (componentId, updates) => {
    const success = await updateComponent(componentId, updates);
    if (success) {
      showStatusMessage("Component updated successfully");
      setEditingComponent(null);
    } else {
      showStatusMessage("Error updating component", true);
    }
  };

  const handleRemoveComponent = async (componentId, componentName) => {
    if (!window.confirm(`Are you sure you want to remove the component "${componentName}"?`)) {
      return;
    }

    const success = await removeComponent(componentId);
    if (success) {
      showStatusMessage(`Component "${componentName}" removed successfully`);
    } else {
      showStatusMessage("Error removing component", true);
    }
  };

  const handleToggleComponent = async (componentId) => {
    const success = await toggleComponent(componentId);
    if (success) {
      showStatusMessage("Component status toggled successfully");
    } else {
      showStatusMessage("Error toggling component status", true);
    }
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (editingComponent) {
      handleUpdateComponent(editingComponent.id, editingComponent);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-center">Loading components...</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-kyndryl-orange">Component Management</h2>
          <p className="text-gray-600 text-sm mt-1">
            Manage components used in prediction matching and test matching
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchComponents}
            className="bg-gray-200 text-black px-4 py-2 rounded hover:bg-gray-300"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-kyndryl-orange text-white px-4 py-2 rounded hover:bg-orange-600"
          >
            {showAddForm ? 'Cancel' : 'Add Component'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded">
          Warning: {error}. Using fallback components.
        </div>
      )}

      {/* Add Component Form */}
      {showAddForm && (
        <div className="bg-gray-50 border rounded p-4">
          <h3 className="text-lg font-semibold text-kyndryl-orange mb-4">Add New Component</h3>
          <form onSubmit={handleAddComponent} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                               <label className="block font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={newComponent.name}
                  onChange={(e) => setNewComponent(prev => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., Windows Server"
                  required
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Value *</label>
                <input
                  type="text"
                  value={newComponent.value}
                  onChange={(e) => setNewComponent(prev => ({ ...prev, value: e.target.value }))
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., windows-server"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block font-medium mb-1">Description</label>
              <input
                type="text"
                value={newComponent.description}
                onChange={(e) => setNewComponent(prev => ({ ...prev, description: e.target.value }))
                }
                className="w-full border rounded px-3 py-2"
                placeholder="Brief description of the component"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="newEnabled"
                checked={newComponent.enabled}
                onChange={(e) => setNewComponent(prev => ({ ...prev, enabled: e.target.checked }))
                }
                className="rounded"
              />
              <label htmlFor="newEnabled" className="font-medium">Enabled</label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-kyndryl-orange text-white px-4 py-2 rounded hover:bg-orange-600"
              >
                Add Component
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-200 text-black px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Components List */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">
            Current Components ({components.length})
          </h3>
        </div>
        
        {components.length === 0 ? (
          <div className="p-4 text-center text-gray-600">
            No components found. Add some components to get started.
          </div>
        ) : (
          <div className="divide-y">
            {components.map((component) => (
              <div key={component.id} className="p-4">
                {editingComponent?.id === component.id ? (
                  /* Edit Form */
                  <form onSubmit={handleEditSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium mb-1">Name</label>
                        <input
                          type="text"
                          value={editingComponent.name}
                          onChange={(e) => setEditingComponent(prev => ({ ...prev, name: e.target.value }))
                          }
                          className="w-full border rounded px-2 py-1"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Value</label>
                        <input
                          type="text"
                          value={editingComponent.value}
                          onChange={(e) => setEditingComponent(prev => ({ ...prev, value: e.target.value }))
                          }
                          className="w-full border rounded px-2 py-1"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Description</label>
                      <input
                        type="text"
                        value={editingComponent.description || ''}
                        onChange={(e) => setEditingComponent(prev => ({ ...prev, description: e.target.value }))
                        }
                        className="w-full border rounded px-2 py-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`edit-enabled-${component.id}`}
                        checked={editingComponent.enabled}
                        onChange={(e) => setEditingComponent(prev => ({ ...prev, enabled: e.target.checked }))
                        }
                        className="rounded"
                      />
                      <label htmlFor={`edit-enabled-${component.id}`} className="font-medium">Enabled</label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="bg-kyndryl-orange text-white px-3 py-1 rounded text-sm hover:bg-orange-600"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingComponent(null)}
                        className="bg-gray-200 text-black px-3 py-1 rounded text-sm hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Display Component */
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-lg">{component.name}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          component.enabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {component.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        <strong>Value:</strong> {component.value}
                      </div>
                      {component.description && (
                        <div className="text-sm text-gray-600">
                          <strong>Description:</strong> {component.description}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleToggleComponent(component.id)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          component.enabled
                            ? 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
                            : 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'
                        }`}
                      >
                        {component.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => setEditingComponent({ ...component })}
                        className="bg-kyndryl-orange text-white px-3 py-1 rounded text-sm hover:bg-orange-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRemoveComponent(component.id, component.name)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h4 className="font-semibold text-blue-800 mb-2">ℹ️ Information</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Components are used in AI matchers creationg and test matching pages</li>
          <li>• Only enabled components will be available for selection</li>
          <li>• Component values should be created matching the component sent by the monitoring tool</li>          
          <li>• Changes take effect immediately across the application</li>
        </ul>
      </div>
    </div>
  );
}

function LogConfigPanel({ updateConfig, markConfigAsEdited, showStatusMessage }) {
  const [localLogFile, setLocalLogFile] = useState("");
  const [localMaxEntries, setLocalMaxEntries] = useState("");
  const [cleanupStatus, setCleanupStatus] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Load current configuration
  useEffect(() => {
    const config = useConfigStore.getState().config;
    if (config?.logging) {
      setLocalLogFile(config.logging.file_location || "./app_data/logs/predictions.log");
      setLocalMaxEntries(config.logging.max_entries?.toString() || "50000");
    }
  }, []);

  // Fetch cleanup status
  const fetchCleanupStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const response = await fetch('/api/logs/cleanup/status');
      if (response.ok) {
        const status = await response.json();
        setCleanupStatus(status);
      } else {
        showStatusMessage("❌ Failed to fetch log cleanup status", true);
      }
    } catch (error) {
      showStatusMessage("❌ Error fetching cleanup status: " + error.message, true);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Manual cleanup
  const handleManualCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const response = await fetch('/api/logs/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showStatusMessage(`✅ ${result.message}`);
          fetchCleanupStatus(); // Refresh status
        } else {
          showStatusMessage(`❌ Cleanup failed: ${result.message}`, true);
        }
      } else {
        showStatusMessage("❌ Failed to perform cleanup", true);
      }
    } catch (error) {
      showStatusMessage("❌ Error during cleanup: " + error.message, true);
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Save log configuration
  const handleSaveLogConfig = async () => {
    try {
      const maxEntries = parseInt(localMaxEntries);
      if (isNaN(maxEntries) || maxEntries <= 0) {
        showStatusMessage("❌ Max entries must be a positive number", true);
        return;
      }

      const response = await fetch('/api/config/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_location: localLogFile.trim(),
          max_entries: maxEntries
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showStatusMessage("✅ Log configuration updated successfully");
          markConfigAsEdited("logging");
          fetchCleanupStatus(); // Refresh status
        } else {
          showStatusMessage(`❌ Failed to update: ${result.message}`, true);
        }
      } else {
        showStatusMessage("❌ Failed to save log configuration", true);
      }
    } catch (error) {
      showStatusMessage("❌ Error saving configuration: " + error.message, true);
    }
  };

  // Load status on component mount
  useEffect(() => {
    fetchCleanupStatus();
  }, []);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <div className="flex items-center mb-6">
        <span className="text-2xl mr-3">📋</span>
        <h2 className="text-2xl font-bold text-kyndryl-orange">Log Configuration</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-md font-semibold text-blue-800 mb-2">Log Management Settings</h3>
        <p className="text-sm text-blue-700">
          Configure log file location and automatic cleanup settings. The system automatically cleans up old log entries to maintain performance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Log Configuration */}
        <div className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Log File Location</label>
            <input
              type="text"
              value={localLogFile}
              onChange={(e) => setLocalLogFile(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="./app_data/logs/predictions.log"
            />
            <p className="text-sm text-gray-600 mt-1">
              Path where prediction logs are stored
            </p>
          </div>

          <div>
            <label className="block font-semibold mb-1">Maximum Log Entries</label>
            <input
              type="number"
              value={localMaxEntries}
              onChange={(e) => setLocalMaxEntries(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="50000"
              min="1"
            />
            <p className="text-sm text-gray-600 mt-1">
              Maximum number of log entries to keep. Older entries are automatically removed.
            </p>
          </div>

          <button
            onClick={handleSaveLogConfig}
            className="bg-kyndryl-orange text-white px-4 py-2 rounded hover:bg-kyndryl-orange/80 font-semibold"
          >
            Save Log Configuration
          </button>
        </div>

        {/* Log Status */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Log Status</h3>
            <button
              onClick={fetchCleanupStatus}
              disabled={isLoadingStatus}
              className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
            >
              {isLoadingStatus ? "Loading..." : "Refresh"}
            </button>
          </div>

          {cleanupStatus && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium text-gray-700">Current Entries</div>
                  <div className="text-lg">{cleanupStatus.log_config?.current_entries?.toLocaleString() || 'N/A'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium text-gray-700">File Size</div>
                  <div className="text-lg">{cleanupStatus.log_config?.file_size_bytes ? formatFileSize(cleanupStatus.log_config.file_size_bytes) : 'N/A'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium text-gray-700">Last Cleanup</div>
                  <div className="text-sm">{cleanupStatus.last_cleanup ? new Date(cleanupStatus.last_cleanup).toLocaleString() : 'Never'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium text-gray-700">Cleanup Thread</div>
                  <div className={`text-sm font-medium ${cleanupStatus.cleanup_thread_status === 'running' ? 'text-green-600' : 'text-red-600'}`}>
                    {cleanupStatus.cleanup_thread_status || 'Unknown'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleManualCleanup}
                  disabled={isCleaningUp}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCleaningUp ? "Cleaning..." : "Manual Cleanup"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <h4 className="font-semibold text-blue-800 mb-2">ℹ️ Information</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Log cleanup runs automatically every 24 hours</li>
            <li>• Manual cleanup can be triggered anytime using the button above</li>
            <li>• Only the most recent entries (up to max entries) are kept</li>
            <li>• Changes to max entries take effect immediately when saved</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


