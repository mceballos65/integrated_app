import { getBackendUrl } from '../configStorage';

class AppLogger {
  constructor() {
    this.logQueue = [];
    this.isProcessing = false;
  }

  async log(level, category, message, details = null) {
    // Format timestamp for backend compatibility: "2025-07-02 22:30:15"
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace('T', ' ');
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      category,
      message,
      details,
      user: this.getCurrentUser(),
      session: this.getSessionId()
    };

    // Add to queue for backend logging
    this.logQueue.push(logEntry);
    
    // Also log to console for development
    console.log(`[${logEntry.level}] ${logEntry.category}: ${logEntry.message}`, details || '');
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processLogQueue();
    }

    return logEntry;
  }

  async processLogQueue() {
    if (this.isProcessing || this.logQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.logQueue.length > 0) {
      const logEntry = this.logQueue.shift();
      
      try {
        const backendUrl = getBackendUrl();
        // Note: backendUrl can be empty string for relative URLs in development
        if (backendUrl !== null && backendUrl !== undefined) {
          await fetch(`${backendUrl}/api/logs/app`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('kyndryl_token') || ''}`
            },
            body: JSON.stringify(logEntry)
          });
        }
      } catch (error) {
        console.error('Failed to send log to backend:', error);
        // If failed, put it back in queue to retry later
        this.logQueue.unshift(logEntry);
        break;
      }
    }
    
    this.isProcessing = false;
  }

  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('kyndryl_user');
      return userStr ? JSON.parse(userStr).username : 'anonymous';
    } catch {
      return 'anonymous';
    }
  }

  getSessionId() {
    let sessionId = sessionStorage.getItem('kyndryl_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('kyndryl_session_id', sessionId);
    }
    return sessionId;
  }

  // Convenience methods for different log levels
  info(category, message, details) {
    return this.log('info', category, message, details);
  }

  warn(category, message, details) {
    return this.log('warn', category, message, details);
  }

  error(category, message, details) {
    return this.log('error', category, message, details);
  }

  success(category, message, details) {
    return this.log('success', category, message, details);
  }

  // Specific logging methods for different activities
  logConfigChange(section, changes) {
    return this.info('CONFIG_CHANGE', `Configuration updated: ${section}`, changes);
  }

  logUserAction(action, target, details) {
    return this.info('USER_ACTION', `User ${action}: ${target}`, details);
  }

  logLogin(username) {
    return this.info('AUTH', `User logged in: ${username}`);
  }

  logLogout(username) {
    return this.info('AUTH', `User logged out: ${username}`);
  }

  logSetup(step, details) {
    return this.info('SETUP', `Initial setup: ${step}`, details);
  }

  logError(category, error) {
    return this.error('ERROR', `Error in ${category}`, {
      message: error.message,
      stack: error.stack
    });
  }
}

// Create singleton instance
const appLogger = new AppLogger();

export default appLogger;
