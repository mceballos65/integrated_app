// src/configStorage.js
import permanentConfigService from './services/permanentConfig';
import appLogger from './services/appLogger';

// Backend configuration
let BACKEND_URL = "http://localhost:8000";
const CONFIG_FILE_NAME = "./app_data/config/app_config.json"; // Nombre del archivo de configuración en el backend
const CONFIG_API_PATH = "/api/config"; // Ruta base para la API de configuración

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
  // If we're running in development with Vite proxy, use relative URLs
  if (import.meta.env.DEV) {
    return ''; // Empty string means relative URLs
  }
  // In production, use the configured backend URL
  return BACKEND_URL;
}

export function getBackendUrlForConfig() {
  // This function is specifically for configuration purposes
  // Always returns the actual backend URL
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
    // Verificar específicamente si el archivo de configuración existe en el backend
    const response = await fetch(`${BACKEND_URL}${CONFIG_API_PATH}/exists?file=${CONFIG_FILE_NAME}`);
    const data = await response.json();
    
    // El backend debe responder con un campo "exists" que indica si el archivo existe
    if (data && typeof data.exists === 'boolean') {
      return data.exists;
    }
    
    // Compatibilidad con la API anterior
    if (data && typeof data.configured === 'boolean') {
      return data.configured;
    }
    
    return false;
  } catch (e) {
    console.error("Error checking config file existence:", e);
    // If backend is not available, check if we have fallback config
    const fallbackConfig = getFallbackConfig();
    return fallbackConfig !== null;
  }
}

export async function loadConfig() {
  try {
    // Cargar la configuración desde el archivo específico en el backend
    const response = await fetch(`${BACKEND_URL}${CONFIG_API_PATH}/load?file=${CONFIG_FILE_NAME}`);
    
    if (!response.ok) {
      // Si el archivo no existe, intentar la API antigua como compatibilidad
      const legacyResponse = await fetch(`${BACKEND_URL}/config`);
      if (!legacyResponse.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const legacyData = await legacyResponse.json();
      return legacyData.config;
    }
    
    const data = await response.json();
    
    // Si la carga desde el backend fue exitosa, podemos eliminar cualquier configuración de respaldo
    localStorage.removeItem(FALLBACK_CONFIG_KEY);
    
    // El backend debe devolver la configuración directamente en la respuesta
    return data.config || data; 
  } catch (e) {
    console.error("Error loading config:", e);
    // Usar la configuración de respaldo SOLO si no se puede alcanzar el backend
    const fallbackConfig = getFallbackConfig();
    if (fallbackConfig) {
      console.warn("Using fallback configuration from localStorage. This is temporary until backend is available.");
      return fallbackConfig;
    }
    return null;
  }
}

export async function saveConfig(config) {
  try {
    // Guardar la configuración en el archivo específico del backend
    const response = await fetch(`${BACKEND_URL}${CONFIG_API_PATH}/save?file=${CONFIG_FILE_NAME}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      // Compatibilidad con API antigua
      const legacyResponse = await fetch(`${BACKEND_URL}/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      
      if (!legacyResponse.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const legacyResult = await legacyResponse.json();
      
      // Clear any fallback config since we've successfully saved to backend
      localStorage.removeItem(FALLBACK_CONFIG_KEY);
      
      return legacyResult.config; // Return the saved config
    }
    
    const result = await response.json();
    
    // Clear any fallback config since we've successfully saved to backend
    localStorage.removeItem(FALLBACK_CONFIG_KEY);
    
    return result.config || result; // Return the saved config
  } catch (e) {
    console.error("Error saving config:", e);
    // Save to fallback storage ONLY if backend is unavailable
    setFallbackConfig(config);
    return config;
  }
}

export async function updateConfig(configUpdate) {
  try {
    // Actualizar la configuración en el archivo específico del backend
    const response = await fetch(`${BACKEND_URL}${CONFIG_API_PATH}/update?file=${CONFIG_FILE_NAME}`, {
      method: "PATCH",  // PATCH es más apropiado para actualizaciones parciales
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(configUpdate),
    });
    
    if (!response.ok) {
      // Compatibilidad con API antigua
      const legacyResponse = await fetch(`${BACKEND_URL}/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configUpdate),
      });
      
      if (!legacyResponse.ok) {
        throw new Error(`HTTP error! status: ${legacyResponse.status}`);
      }
      
      const legacyResult = await legacyResponse.json();
      
      // If we have local fallback config, update it or remove it
      if (getFallbackConfig()) {
        // If backend save succeeded, remove the fallback config
        localStorage.removeItem(FALLBACK_CONFIG_KEY);
      }
      
      return legacyResult.config; // Return the updated config
    }
    
    const result = await response.json();
    
    // If we have local fallback config, update it or remove it
    if (getFallbackConfig()) {
      // If backend save succeeded, remove the fallback config
      localStorage.removeItem(FALLBACK_CONFIG_KEY);
    }
    
    return result.config || result; // Return the updated config
  } catch (e) {
    console.error("Error updating config:", e);
    // Try to update fallback config ONLY if backend is unreachable
    const currentConfig = getFallbackConfig() || {};
    const updatedConfig = { ...currentConfig, ...configUpdate };
    setFallbackConfig(updatedConfig);
    return updatedConfig;
  }
}

export async function replaceConfig(config) {
  try {
    // Reemplazar toda la configuración en el archivo específico del backend
    const response = await fetch(`${BACKEND_URL}${CONFIG_API_PATH}/replace?file=${CONFIG_FILE_NAME}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      // Compatibilidad con API antigua
      const legacyResponse = await fetch(`${BACKEND_URL}/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      
      if (!legacyResponse.ok) {
        throw new Error(`HTTP error! status: ${legacyResponse.status}`);
      }
      
      const legacyResult = await legacyResponse.json();
      return legacyResult.config; // Return the replaced config
    }
    
    const result = await response.json();
    
    // Eliminar cualquier configuración de respaldo
    localStorage.removeItem(FALLBACK_CONFIG_KEY);
    
    return result.config || result; // Return the replaced config
  } catch (e) {
    console.error("Error replacing config:", e);
    throw e;
  }
}

// GitHub token management functions
export async function saveGithubToken(token) {
  try {
    appLogger.info('GITHUB_TOKEN', 'Saving GitHub token securely');
    const response = await fetch(`${BACKEND_URL}/config/github/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    appLogger.success('GITHUB_TOKEN', 'GitHub token saved successfully');
    return result;
  } catch (e) {
    appLogger.error('GITHUB_TOKEN', 'Error saving GitHub token', { error: e.message });
    throw e;
  }
}

export async function checkGithubTokenExists() {
  try {
    const response = await fetch(`${BACKEND_URL}/config/github/token/exists`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    return result.exists;
  } catch (e) {
    appLogger.error('GITHUB_TOKEN', 'Error checking GitHub token existence', { error: e.message });
    return false;
  }
}

export async function deleteGithubToken() {
  try {
    appLogger.info('GITHUB_TOKEN', 'Deleting GitHub token');
    const response = await fetch(`${BACKEND_URL}/config/github/token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    appLogger.success('GITHUB_TOKEN', 'GitHub token deleted successfully');
    return result;
  } catch (e) {
    appLogger.error('GITHUB_TOKEN', 'Error deleting GitHub token', { error: e.message });
    throw e;
  }
}

export async function saveGithubConfig(config) {
  try {
    appLogger.info('GITHUB_CONFIG', 'Saving GitHub configuration', { config });
    const response = await fetch(`${BACKEND_URL}${CONFIG_API_PATH}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        github: {
          repositoryUrl: config.repositoryUrl || "",
          branchName: config.branchName || "main",
          githubUsername: config.githubUsername || ""
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    appLogger.success('GITHUB_CONFIG', 'GitHub configuration saved successfully');
    return result;
  } catch (e) {
    appLogger.error('GITHUB_CONFIG', 'Error saving GitHub configuration', { error: e.message });
    throw e;
  }
}
