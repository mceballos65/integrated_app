// src/configStorage.js
import permanentConfigService from './services/permanentConfig';
import appLogger from './services/appLogger';

let BACKEND_URL = "http://192.168.100.48:8000";

// Fallback storage for when backend is not available
const FALLBACK_CONFIG_KEY = "kyndryl_fallback_config";
const BACKEND_URL_KEY = "kyndryl_backend_url";

// Initialize backend URL using permanent config service
function initializeBackendUrl() {
  // Try to migrate old configuration first
  permanentConfigService.migrateOldConfig();
  
  // Get backend URL from permanent config
  const configuredUrl = permanentConfigService.getConfiguredBackendUrl();
  if (configuredUrl) {
    BACKEND_URL = configuredUrl;
    return;
  }
  
  // Fallback to old localStorage method if permanent config not available
  const storedBackendUrl = localStorage.getItem(BACKEND_URL_KEY);
  if (storedBackendUrl) {
    BACKEND_URL = storedBackendUrl;
    // Migrate to permanent config
    permanentConfigService.setPermanentConfig({
      backendUrl: storedBackendUrl,
      setupCompleted: true,
      setupDate: new Date().toISOString()
    });
  }
}

// Initialize on load
initializeBackendUrl();

export function getBackendUrl() {
  return BACKEND_URL;
}

export function setBackendUrl(url) {
  BACKEND_URL = url;
  
  // Save to both old and new storage for compatibility
  localStorage.setItem(BACKEND_URL_KEY, url);
  
  // Update permanent config
  permanentConfigService.setPermanentConfig({
    backendUrl: url,
    setupCompleted: true,
    setupDate: new Date().toISOString()
  });
  
  // Log the configuration change
  appLogger.logSetup('Backend URL configured', { url });
}

export function isInitialSetupCompleted() {
  return permanentConfigService.isSetupCompleted();
}

export function markSetupCompleted() {
  const success = permanentConfigService.markSetupCompleted(BACKEND_URL);
  if (success) {
    appLogger.logSetup('Initial setup completed', { backendUrl: BACKEND_URL });
  }
  return success;
}

export function resetConfiguration() {
  permanentConfigService.resetPermanentConfig();
  localStorage.removeItem(BACKEND_URL_KEY);
  localStorage.removeItem(FALLBACK_CONFIG_KEY);
  BACKEND_URL = "http://localhost:8000";
  appLogger.logSetup('Configuration reset', {});
}

function getFallbackConfig() {
  try {
    const stored = localStorage.getItem(FALLBACK_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}

function setFallbackConfig(config) {
  try {
    localStorage.setItem(FALLBACK_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Error saving fallback config:", e);
  }
}

export async function checkConfigExists() {
  try {
    const response = await fetch(`${BACKEND_URL}/config/check`);
    const data = await response.json();
    return data.configured;
  } catch (e) {
    console.error("Error checking config:", e);
    // If backend is not available, check if we have fallback config
    const fallbackConfig = getFallbackConfig();
    return fallbackConfig !== null;
  }
}

export async function loadConfig() {
  try {
    const response = await fetch(`${BACKEND_URL}/config`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.config; // Extract the config object from the response
  } catch (e) {
    console.error("Error loading config:", e);
    // Try to load from fallback storage
    const fallbackConfig = getFallbackConfig();
    if (fallbackConfig) {
      return fallbackConfig;
    }
    return null;
  }
}

export async function saveConfig(config) {
  try {
    const response = await fetch(`${BACKEND_URL}/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result.config; // Return the saved config
  } catch (e) {
    console.error("Error saving config:", e);
    // Save to fallback storage
    setFallbackConfig(config);
    return config;
  }
}

export async function updateConfig(configUpdate) {
  try {
    const response = await fetch(`${BACKEND_URL}/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(configUpdate),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result.config; // Return the updated config
  } catch (e) {
    console.error("Error updating config:", e);
    // Try to update fallback config
    const currentConfig = getFallbackConfig() || {};
    const updatedConfig = { ...currentConfig, ...configUpdate };
    setFallbackConfig(updatedConfig);
    return updatedConfig;
  }
}

export async function replaceConfig(config) {
  try {
    const response = await fetch(`${BACKEND_URL}/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result.config; // Return the replaced config
  } catch (e) {
    console.error("Error replacing config:", e);
    throw e;
  }
}
