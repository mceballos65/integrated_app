import { create } from "zustand";
import { 
  loadConfig, 
  saveConfig, 
  updateConfig, 
  checkConfigExists, 
  saveGithubToken, 
  checkGithubTokenExists, 
  deleteGithubToken,
  saveGithubConfig 
} from "./configStorage";

const defaultConfig = {
  app: {
    prediction_url: "http://localhost:8000",
    account_code: ""
  },
  logging: {
    file_location: "./app_data/logs/predictions.log",
    max_entries: 50000
  },
  security: {
    admin_user_disabled: false,
    debug_requires_auth: false,
    admin_username: "",
    admin_password_hash: ""
  },
  github: {
    token: "",
    repo_url: "",
    branch: "main"
  }
};

const useConfigStore = create((set, get) => ({
  // Config state
  config: defaultConfig,
  configLoaded: false,
  configExists: false,
  loading: false,
  error: null,

  // Convenience getters for commonly used values
  get predictionUrl() { 
    const value = get().config?.app?.prediction_url || "";
    console.log("predictionUrl getter:", { config: get().config, value });
    return value;
  },
  get accountCode() { 
    const value = get().config?.app?.account_code || "";
    console.log("accountCode getter:", { config: get().config, value });
    return value;
  },
  get logFileLocation() { return get().config?.logging?.file_location || "./app_data/logs/predictions.log"; },
  get maxLogEntries() { return get().config?.logging?.max_entries || 50000; },
  get adminUserDisabled() { return get().config?.security?.admin_user_disabled || false; },
  get debugRequiresAuth() { 
    // Check config first, then fall back to localStorage for backward compatibility
    const configValue = get().config?.security?.debug_requires_auth || false;
    const localStorageValue = localStorage.getItem('debugRequiresAuth') === 'true';
    return configValue || localStorageValue; 
  },
  get adminUsername() { return get().config?.security?.admin_username || ""; },
  get githubToken() { return get().config?.github?.token || ""; },
  get githubRepoUrl() { return get().config?.github?.repo_url || ""; },
  get githubBranch() { return get().config?.github?.branch || "main"; },

  // Actions
  checkConfigExists: async () => {
    set({ loading: true, error: null });
    try {
      const exists = await checkConfigExists();
      set({ configExists: exists, loading: false });
      return exists;
    } catch (error) {
      set({ error: error.message, loading: false });
      return false;
    }
  },

  loadConfig: async () => {
    set({ loading: true, error: null });
    try {
      const response = await loadConfig();
      if (response && response.config) {
        set({ 
          config: response.config, 
          configLoaded: true, 
          configExists: !response.is_default,
          loading: false 
        });
        
        // Clear any legacy localStorage configuration items to avoid conflicts
        localStorage.removeItem('kyndryl_app_config');
        localStorage.removeItem('debugDisabled');
        
        // Ensure debugRequiresAuth in localStorage matches backend config
        if (response.config?.security?.debug_requires_auth !== undefined) {
          localStorage.setItem('debugRequiresAuth', 
            response.config.security.debug_requires_auth ? 'true' : 'false');
        }
        
        return response.config;
      } else if (response) {
        // Handle case where config is returned directly
        set({ 
          config: response, 
          configLoaded: true, 
          configExists: true,
          loading: false 
        });
        
        // Clear any legacy localStorage configuration items to avoid conflicts
        localStorage.removeItem('kyndryl_app_config');
        localStorage.removeItem('debugDisabled');
        
        // Ensure debugRequiresAuth in localStorage matches backend config
        if (response?.security?.debug_requires_auth !== undefined) {
          localStorage.setItem('debugRequiresAuth', 
            response.security.debug_requires_auth ? 'true' : 'false');
        }
        
        return response;
      } else {
        set({ 
          config: defaultConfig, 
          configLoaded: true, 
          configExists: false,
          loading: false 
        });
        return null;
      }
    } catch (error) {
      set({ 
        error: error.message, 
        loading: false,
        config: defaultConfig,
        configLoaded: true,
        configExists: false
      });
      return null;
    }
  },

  updateConfig: async (configUpdate) => {
    set({ loading: true, error: null });
    try {
      const response = await updateConfig(configUpdate);
      console.log("Store updateConfig response:", response);
      
      // The response should be the config object directly
      const updatedConfig = response;
      console.log("Store setting config to:", updatedConfig);
      
      set({ 
        config: updatedConfig, 
        configExists: true,
        loading: false 
      });
      return updatedConfig;
    } catch (error) {
      console.error("Store updateConfig error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  saveConfig: async (newConfig) => {
    set({ loading: true, error: null });
    try {
      const response = await saveConfig(newConfig);
      const savedConfig = response.config || response;
      set({ 
        config: savedConfig, 
        configExists: true,
        loading: false 
      });
      return savedConfig;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Convenience setters
  setPredictionUrl: async (url) => {
    await get().updateConfig({ app: { prediction_url: url } });
  },
  
  setAccountCode: async (code) => {
    await get().updateConfig({ app: { account_code: code } });
  },
  
  setLogFileLocation: async (location) => {
    await get().updateConfig({ logging: { file_location: location } });
  },
  
  setMaxLogEntries: async (entries) => {
    await get().updateConfig({ logging: { max_entries: entries } });
  },
  
  setAdminUserDisabled: async (disabled) => {
    await get().updateConfig({ security: { admin_user_disabled: disabled } });
  },
  
  setDebugRequiresAuth: async (requires) => {
    await get().updateConfig({ security: { debug_requires_auth: requires } });
  },

  setGithubSettings: async (githubConfig) => {
    await get().updateConfig({ github: githubConfig });
  },

  setSecuritySettings: async (securityConfig) => {
    await get().updateConfig({ security: securityConfig });
  },

  // GitHub token management functions
  saveGithubSettings: async (token, config) => {
    // Save the GitHub config (repo_url, branch) via the regular config endpoint
    if (config) {
      await get().updateConfig({ github: config });
    }
    
    // Save the token separately via the secure token endpoint (only if token is provided)
    if (token && token.trim()) {
      await saveGithubToken(token);
    }
  },

  checkGithubTokenExists: async () => {
    return await checkGithubTokenExists();
  },

  deleteGithubToken: async () => {
    return await deleteGithubToken();
  }
}));

export default useConfigStore;
