// Service to handle permanent configuration storage
class PermanentConfigService {
  constructor() {
    this.CONFIG_KEY = 'kyndryl_permanent_config';
    this.BACKEND_URL_KEY = 'kyndryl_backend_url';
  }

  // Get the permanent configuration
  getPermanentConfig() {
    try {
      const config = localStorage.getItem(this.CONFIG_KEY);
      return config ? JSON.parse(config) : null;
    } catch (error) {
      console.error('Error reading permanent config:', error);
      return null;
    }
  }

  // Save permanent configuration
  setPermanentConfig(config) {
    try {
      const permanentConfig = {
        backendUrl: config.backendUrl,
        setupCompleted: config.setupCompleted || false,
        setupDate: config.setupDate || new Date().toISOString(),
        version: '1.0'
      };
      
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(permanentConfig));
      return true;
    } catch (error) {
      console.error('Error saving permanent config:', error);
      return false;
    }
  }

  // Check if initial setup has been completed
  isSetupCompleted() {
    const config = this.getPermanentConfig();
    return config && config.setupCompleted && config.backendUrl;
  }

  // Mark setup as completed
  markSetupCompleted(backendUrl) {
    const config = this.getPermanentConfig() || {};
    config.backendUrl = backendUrl;
    config.setupCompleted = true;
    config.setupDate = new Date().toISOString();
    return this.setPermanentConfig(config);
  }

  // Get configured backend URL
  getConfiguredBackendUrl() {
    const config = this.getPermanentConfig();
    return config ? config.backendUrl : null;
  }

  // Reset permanent configuration (for troubleshooting)
  resetPermanentConfig() {
    try {
      localStorage.removeItem(this.CONFIG_KEY);
      localStorage.removeItem(this.BACKEND_URL_KEY);
      return true;
    } catch (error) {
      console.error('Error resetting permanent config:', error);
      return false;
    }
  }

  // Migrate old configuration format if needed
  migrateOldConfig() {
    try {
      // Check if we have old format backend URL but no permanent config
      const oldBackendUrl = localStorage.getItem(this.BACKEND_URL_KEY);
      const permanentConfig = this.getPermanentConfig();
      
      if (oldBackendUrl && !permanentConfig) {
        // Migrate to new format
        this.setPermanentConfig({
          backendUrl: oldBackendUrl,
          setupCompleted: true,
          setupDate: new Date().toISOString()
        });
        console.log('Migrated old backend URL configuration');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error migrating old config:', error);
      return false;
    }
  }
}

// Create singleton instance
const permanentConfigService = new PermanentConfigService();

export default permanentConfigService;
