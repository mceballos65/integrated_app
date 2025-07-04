import React, { useEffect, useState } from "react";
import useConfigStore from "../store";
import { loadConfig, getBackendUrl } from "../configStorage";
import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

export default function LogsPage() {
  const { predictionUrl, accountCode, logFileLocation, maxLogEntries, adminUserDisabled } = useConfigStore();
  const { securityWarning } = useAuth();
  
  // Prediction logs state
  const [predictionLogs, setPredictionLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loadingPredictionLogs, setLoadingPredictionLogs] = useState(false);
  
  // Application logs state
  const [applicationLogs, setApplicationLogs] = useState([]);
  const [loadingApplicationLogs, setLoadingApplicationLogs] = useState(false);
  
  const [statusMessage, setStatusMessage] = useState("");

  // Search and pagination state for prediction logs
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination state for application logs
  const [appCurrentPage, setAppCurrentPage] = useState(1);
  const [appLogsPerPage] = useState(50);

  // Log type filter state for prediction logs panel
  const [logTypeFilter, setLogTypeFilter] = useState({
    predictionLogs: true,
    systemLogs: true
  });

  // State for expanded logs
  const [expandedLogs, setExpandedLogs] = useState(new Set());

  const showStatusMessage = (text) => {
    setStatusMessage(text);
    setTimeout(() => setStatusMessage(""), 3000);
  };

  const toggleLogExpansion = (logIndex) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logIndex)) {
      newExpanded.delete(logIndex);
    } else {
      newExpanded.add(logIndex);
    }
    setExpandedLogs(newExpanded);
  };

  // Process logs in batches to avoid blocking the UI
  const processLogsInBatches = async (logLines, batchSize = 1000) => {
    setIsProcessing(true);
    const allParsedLogs = [];
    
    for (let i = 0; i < logLines.length; i += batchSize) {
      const batch = logLines.slice(i, i + batchSize);
      const parsedBatch = batch
        .map(formatPredictionLogEntry)
        .filter(log => log !== null);
      
      allParsedLogs.push(...parsedBatch);
      
      const progress = Math.round(((i + batchSize) / logLines.length) * 100);
      showStatusMessage(`Processing logs... ${progress}%`);
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    setIsProcessing(false);
    return allParsedLogs;
  };

  // Filter and sort logs efficiently
  const filterAndSortLogs = (logs, searchTerm, sortOrder, typeFilter) => {
    let filtered = logs;
    
    // Apply type filter first
    if (typeFilter && (!typeFilter.systemLogs || !typeFilter.predictionLogs)) {
      filtered = logs.filter(log => {
        const isSystemLog = log.type === "system" || log.type === "matcher_action" || log.type === "account_event" || log.type === "account_processing" || log.action === "ADD";
        const isPredictionLog = log.type === "enhanced_prediction" || log.type === "legacy_prediction";
        
        if (typeFilter.systemLogs && typeFilter.predictionLogs) {
          return true; // Show all if both selected
        } else if (typeFilter.systemLogs && !typeFilter.predictionLogs) {
          return isSystemLog;
        } else if (!typeFilter.systemLogs && typeFilter.predictionLogs) {
          return isPredictionLog;
        } else {
          return false; // Show none if neither selected
        }
      });
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        log.account.toLowerCase().includes(term) ||
        (log.abstract && log.abstract.toLowerCase().includes(term)) ||
        (log.match && log.match.toLowerCase().includes(term))
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const timeA = new Date(a.timestamp.replace(',', '.'));
      const timeB = new Date(b.timestamp.replace(',', '.'));
      
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
    
    return filtered;
  };

  // Get paginated logs
  const getPaginatedLogs = (logs, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return logs.slice(startIndex, endIndex);
  };

  const formatPredictionLogEntry = (logLine) => {
    const timestampMatch = logLine.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[,.]?\d{0,3})/);
    if (!timestampMatch) return null;

    const timestamp = timestampMatch[1];
    const content = logLine.substring(timestamp.length).replace(/^[\s\-]+/, ''); // Remove leading spaces and dashes

    let action = "Unknown";
    let account = "N/A";
    let message = content;
    let abstract = "";
    let match = "";
    let score = "";
    let automation = "";
    let enabled = "";
    let ip = "";
    let thresholdMet = "";
    let componentAllowed = "";
    let accountEnabled = "";
    let executeApproved = "";

    // Enhanced prediction format with all fields: [ACM] 'text' => Match 'match' | Score: 0.31 | Threshold Met: False | Component Allowed: True | Account Enabled: True | Execute Approved: False | IP: 192.168.100.53
    const enhancedPredictionMatch = content.match(/\[([^\]]+)\] '([^']+)' => Match '([^']+)' \| Score: ([\d.]+) \| Threshold Met: (\w+) \| Component Allowed: (\w+) \| Account Enabled: (\w+) \| Execute Approved: (\w+) \| IP: ([\d.]+)/);
    if (enhancedPredictionMatch) {
      return {
        timestamp,
        action: "Prediction",
        account: enhancedPredictionMatch[1],
        message: `Prediction analysis completed`,
        abstract: enhancedPredictionMatch[2],
        match: enhancedPredictionMatch[3],
        score: enhancedPredictionMatch[4],
        thresholdMet: enhancedPredictionMatch[5],
        componentAllowed: enhancedPredictionMatch[6],
        accountEnabled: enhancedPredictionMatch[7],
        executeApproved: enhancedPredictionMatch[8],
        ip: enhancedPredictionMatch[9],
        type: "enhanced_prediction",
        fullContent: content
      };
    }

    // Legacy prediction format: [ABC] 'text' => Match 'match' | Score: 0.85 | Automation: True | Enabled: True | IP: 192.168.1.1
    const fullPredictionMatch = content.match(/\[([^\]]+)\] '([^']+)' => Match '([^']+)' \| Score: ([\d.]+) \| Automation: (\w+) \| Enabled: (\w+) \| IP: ([\d.]+)/);
    if (fullPredictionMatch) {
      return {
        timestamp,
        action: "Prediction",
        account: fullPredictionMatch[1],
        message: `Prediction completed with score ${fullPredictionMatch[4]}`,
        abstract: fullPredictionMatch[2],
        match: fullPredictionMatch[3],
        score: fullPredictionMatch[4],
        automation: fullPredictionMatch[5],
        enabled: fullPredictionMatch[6],
        ip: fullPredictionMatch[7],
        type: "legacy_prediction",
        fullContent: content
      };
    }

    // Simple account code format: [ABC]
    const simpleAccountMatch = content.match(/^\[([A-Z]{3})\]$/);
    if (simpleAccountMatch) {
      return {
        timestamp,
        action: "Event",
        account: simpleAccountMatch[1],
        message: `Event received for account ${simpleAccountMatch[1]}`,
        abstract: "",
        match: "",
        score: "",
        automation: "",
        enabled: "",
        ip: "",
        type: "account_event",
        fullContent: content
      };
    }

    // Account with additional info: [ABC] Additional text
    const accountWithInfoMatch = content.match(/^\[([A-Z]{3})\]\s+(.+)/);
    if (accountWithInfoMatch) {
      return {
        timestamp,
        action: "Processing",
        account: accountWithInfoMatch[1],
        message: accountWithInfoMatch[2],
        abstract: "",
        match: "",
        score: "",
        automation: "",
        enabled: "",
        ip: "",
        type: "account_processing",
        fullContent: content
      };
    }

    // System messages (Load pretrained SentenceTransformer, Use pytorch device_name, etc.)
    if (content.includes("Load pretrained SentenceTransformer") || 
        content.includes("Use pytorch device_name") ||
        content.includes("device_name") ||
        content.includes("SentenceTransformer") ||
        content.includes("pytorch")) {
      return {
        timestamp,
        action: "System",
        account: "SYSTEM",
        message: content,
        abstract: "",
        match: "",
        score: "",
        automation: "",
        enabled: "",
        ip: "",
        type: "system",
        fullContent: content
      };
    }

    // System operations with brackets that are NOT account codes (like [list_entries])
    const systemOperationMatch = content.match(/^\[([^\]]+)\]\s*(.+)/);
    if (systemOperationMatch) {
      const operation = systemOperationMatch[1];
      const operationContent = systemOperationMatch[2];
      
      // Check if it's NOT a 3-letter account code (system operations are usually longer)
      if (operation.length !== 3 || !operation.match(/^[A-Z]{3}$/)) {
        const ipMatch = operationContent.match(/IP: ([\d.]+)/);
        return {
          timestamp,
          action: "System",
          account: "SYSTEM",
          message: content,
          abstract: "",
          match: "",
          score: "",
          automation: "",
          enabled: "",
          ip: ipMatch?.[1] || "",
          type: "system",
          fullContent: content
        };
      }
    }

    // Enable/disable matcher actions
    if (content.includes("enable_matcher_for_account") || content.includes("disable_matcher_for_account")) {
      const ipMatch = content.match(/IP: ([\d.]+)/);
      const accountMatch = content.match(/account '([^']+)'/);
      const isEnable = content.includes("enable_matcher_for_account");
      
      return {
        timestamp,
        action: isEnable ? "Enable Matcher" : "Disable Matcher",
        account: accountMatch?.[1] || "N/A",
        message: content,
        abstract: "",
        match: "",
        score: "",
        automation: "",
        enabled: "",
        ip: ipMatch?.[1] || "",
        type: "matcher_action",
        fullContent: content
      };
    }

    // Fallback for any other log entry - treat as system
    return {
      timestamp,
      action: "System",
      account: "SYSTEM",
      message: content,
      abstract: "",
      match: "",
      score: "",
      automation: "",
      enabled: "",
      ip: "",
      type: "system",
      fullContent: content
    };
  };

  // Load prediction logs
  const loadPredictionLogs = async () => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      showStatusMessage("Backend URL not configured");
      return;
    }

    setLoadingPredictionLogs(true);
    showStatusMessage("Loading prediction logs...");

    try {
      const response = await fetch(`${backendUrl}/logs/predictions?limit=${maxLogEntries || 1000}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch prediction logs: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.logs && data.logs.length > 0) {
        const parsedLogs = await processLogsInBatches(data.logs);
        setPredictionLogs(parsedLogs);
        showStatusMessage(`Loaded ${parsedLogs.length} prediction log entries`);
      } else {
        showStatusMessage(data.message || "No prediction logs found");
        setPredictionLogs([]);
      }
    } catch (error) {
      console.error("Error loading prediction logs:", error);
      showStatusMessage(`Error: ${error.message}`);
      setPredictionLogs([]);
    } finally {
      setLoadingPredictionLogs(false);
    }
  };

  // Load application logs from backend
  const loadApplicationLogs = async () => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      showStatusMessage("Backend URL not configured");
      return;
    }

    setLoadingApplicationLogs(true);
    showStatusMessage("Loading application logs...");

    try {
      const response = await fetch(`${backendUrl}/logs/app?limit=1000`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch application logs: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.logs) {
        // Reverse to show newest first
        const reversedLogs = [...data.logs].reverse();
        setApplicationLogs(reversedLogs);
        showStatusMessage(`Loaded ${data.logs.length} application log entries`);
      } else {
        showStatusMessage("No application logs found");
        setApplicationLogs([]);
      }
    } catch (error) {
      console.error("Error loading application logs:", error);
      showStatusMessage(`Error loading application logs: ${error.message}`);
      setApplicationLogs([]);
    } finally {
      setLoadingApplicationLogs(false);
    }
  };

  // Load both types of logs on component mount
  useEffect(() => {
    loadPredictionLogs();
    loadApplicationLogs();
  }, []);

  // Update filtered logs when search term, sort order, or log type filter changes
  useEffect(() => {
    const filtered = filterAndSortLogs(predictionLogs, searchTerm, sortOrder, logTypeFilter);
    setFilteredLogs(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  }, [predictionLogs, searchTerm, sortOrder, logTypeFilter]);

  // Get logs for current page
  const paginatedLogs = getPaginatedLogs(filteredLogs, currentPage, logsPerPage);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  const handleRefresh = () => {
    loadPredictionLogs();
    loadApplicationLogs();
  };

  const formatApplicationLogEntry = (logLine) => {
    // Parse format: 2025-07-02 22:30:15 [INFO] CONFIG_CHANGE: Backend URL configured - {"url": "http://192.168.100.48:8000", "user": "admin"}
    const match = logLine.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (\w+): (.+?)( - (.+))?$/);
    
    if (!match) {
      return {
        timestamp: "Unknown",
        level: "INFO",
        category: "UNKNOWN",
        message: logLine,
        details: ""
      };
    }

    const [, timestamp, level, category, message, , details] = match;
    
    return {
      timestamp,
      level,
      category,
      message,
      details: details || "",
      fullContent: logLine
    };
  };

  const getLevelColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'ERROR': return 'bg-red-100 text-red-800 border border-red-200';
      case 'WARNING': case 'WARN': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'INFO': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'SUCCESS': return 'bg-green-100 text-green-800 border border-green-200';
      case 'DEBUG': return 'bg-gray-100 text-gray-700 border border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'CONFIG_CHANGE': return 'bg-blue-100 text-blue-800';
      case 'USER_ACTION': return 'bg-green-100 text-green-800';
      case 'AUTH': return 'bg-purple-100 text-purple-800';
      case 'SETUP': return 'bg-yellow-100 text-yellow-800';
      case 'ERROR': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (securityWarning && adminUserDisabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 border border-red-300 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-red-700 mb-4">⚠️ Security Warning</h2>
            <p className="text-red-600 mb-4">
              The logs page is currently unavailable because the admin user is disabled for security reasons.
            </p>
            <NavLink 
              to="/configuration" 
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Go to Configuration
            </NavLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">System Logs</h1>
              <p className="text-gray-600 mt-1">Monitor prediction activities and application events</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loadingPredictionLogs || loadingApplicationLogs}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {(loadingPredictionLogs || loadingApplicationLogs) ? "Loading..." : "Refresh"}
            </button>
          </div>
          
          {statusMessage && (
            <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
              <p className="text-blue-700">{statusMessage}</p>
            </div>
          )}
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-fr">
          
          {/* Left Column: Prediction Logs */}
          <div className="bg-white rounded-lg shadow-md flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Backend Logs</h2>
              
              {/* Search and Filter Controls */}
              <div className="flex flex-col gap-4 mb-4">
                {/* First row: Search and Sort */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
                
                {/* Second row: Log type filter toggles */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-700 self-center">Show (filters):</span>
                  <button
                    onClick={() => setLogTypeFilter(prev => ({...prev, predictionLogs: !prev.predictionLogs}))}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      logTypeFilter.predictionLogs
                        ? 'bg-kyndryl-blue text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    Prediction Logs
                  </button>
                  <button
                    onClick={() => setLogTypeFilter(prev => ({...prev, systemLogs: !prev.systemLogs}))}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      logTypeFilter.systemLogs
                        ? 'bg-kyndryl-blue text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    System Logs
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="text-sm text-gray-600">
                Showing {paginatedLogs.length} of {filteredLogs.length} entries
                {searchTerm && ` (filtered from ${predictionLogs.length} total)`}
              </div>
            </div>

            {/* Prediction Logs Content */}
            <div className="p-6 flex-1">
              {loadingPredictionLogs ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading prediction logs...</p>
                </div>
              ) : paginatedLogs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">
                    {searchTerm ? "No logs match your search criteria" : "No prediction logs available"}
                  </p>
                </div>
              ) : (
                <>
                  {/* Log Entries */}
                  <div className="space-y-3 mb-6">
                    {paginatedLogs.map((log, index) => {
                      const isExpanded = expandedLogs.has(index);
                      const [date, time] = log.timestamp.split(' ');
                      
                      // Render system logs and non-prediction logs with simple format
                      if (log.type === "system" || log.type === "matcher_action" || log.type === "account_event" || log.type === "account_processing" || log.action === "ADD") {
                        return (
                          <div key={index} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300">
                            <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white p-2">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                  <span className="font-bold text-sm">{log.account || "SYSTEM"}</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-300">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-xs">{date}</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-300">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-xs">{time}</span>
                                </div>
                                {log.action && log.action !== "System" && (
                                  <span className="text-xs bg-gray-500 bg-opacity-50 px-1 py-0.5 rounded">
                                    {log.action}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="bg-white p-3">
                              <p className="text-gray-800 text-xs font-mono leading-relaxed">{log.message}</p>
                              {log.ip && (
                                <div className="mt-1 text-xs text-gray-500">
                                  IP: {log.ip}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      
                      // Render prediction logs with full format
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-kyndryl-orange">
                          {/* Header - Always visible */}
                          <div className="bg-gradient-to-r from-kyndryl-black via-gray-900 to-kyndryl-black text-white p-2">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-kyndryl-orange rounded-full"></div>
                                    <span className="font-bold text-sm tracking-wide">{log.account}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-gray-300">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-xs font-medium">{date}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-gray-300">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs font-medium">{time}</span>
                                  </div>
                                </div>
                                {/* Quick status indicator */}
                                <div className="flex items-center gap-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    log.executeApproved === 'True' 
                                      ? 'bg-green-100 text-green-800 border border-green-200' 
                                      : 'bg-red-100 text-red-800 border border-red-200'
                                  }`}>
                                    {log.executeApproved === 'True' ? '✓ Approved' : '✗ Denied'}
                                  </span>
                                  {log.score && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                      parseFloat(log.score) >= 0.7 ? 'bg-green-100 text-green-800 border-green-200' :
                                      parseFloat(log.score) >= 0.5 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                      'bg-red-100 text-red-800 border-red-200'
                                    }`}>
                                    Score: {Math.round(parseFloat(log.score) * 100)}%
                                  </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => toggleLogExpansion(index)}
                                className="ml-2 bg-kyndryl-orange bg-opacity-20 hover:bg-opacity-30 rounded-full p-1 transition-all duration-200 hover:scale-110"
                                title={isExpanded ? "Collapse details" : "Expand details"}
                              >
                                <svg 
                                  className={`w-3 h-3 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Main content */}
                          <div className="bg-gradient-to-b from-white to-gray-50 p-3">
                            <div className="space-y-2">
                              <div className="bg-white rounded-lg p-2 border-l-4 border-kyndryl-orange shadow-sm">
                                <div className="flex items-start gap-2">
                                  <div className="mt-0.5">
                                    <svg className="w-3 h-3 text-kyndryl-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Event Abstract</span>
                                    <p className="text-gray-900 mt-1 leading-relaxed text-xs">{log.abstract}</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="bg-white rounded-lg p-2 border-l-4 border-blue-500 shadow-sm">
                                <div className="flex items-start gap-2">
                                  <div className="mt-0.5">
                                    <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Matched Phrase</span>
                                    <p className="text-gray-900 mt-1 leading-relaxed text-xs font-medium bg-blue-50 px-2 py-1 rounded">{log.match}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="border-t border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100">
                              <div className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <svg className="w-4 h-4 text-kyndryl-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                  <h4 className="text-sm font-bold text-gray-800">Analysis Details</h4>
                                </div>
                                
                                {/* Score indicator */}
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 mb-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-gray-600">AI Score</span>
                                    <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                      parseFloat(log.score) >= 0.7 ? 'bg-green-100 text-green-800' :
                                      parseFloat(log.score) >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                      {Math.round(parseFloat(log.score) * 100)}%
                                    </div>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className={`h-1.5 rounded-full transition-all duration-500 ${
                                        parseFloat(log.score) >= 0.7 ? 'bg-green-500' :
                                        parseFloat(log.score) >= 0.5 ? 'bg-yellow-500' :
                                        'bg-red-500'
                                      }`}
                                      style={{ width: `${parseFloat(log.score) * 100}%` }}
                                    ></div>
                                  </div>
                                </div>

                                {/* Status indicators in a compact grid */}
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  <div className={`p-2 rounded text-center ${
                                    log.thresholdMet === 'True' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                                  }`}>
                                    <div className={`text-xs font-medium ${
                                      log.thresholdMet === 'True' ? 'text-green-700' : 'text-red-700'
                                    }`}>Threshold</div>
                                    <div className="flex items-center justify-center mt-1">
                                      {log.thresholdMet === 'True' ? (
                                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className={`p-2 rounded text-center ${
                                    log.componentAllowed === 'True' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                                  }`}>
                                    <div className={`text-xs font-medium ${
                                      log.componentAllowed === 'True' ? 'text-green-700' : 'text-red-700'
                                    }`}>Component</div>
                                    <div className="flex items-center justify-center mt-1">
                                      {log.componentAllowed === 'True' ? (
                                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className={`p-2 rounded text-center ${
                                    log.accountEnabled === 'True' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                                  }`}>
                                    <div className={`text-xs font-medium ${
                                      log.accountEnabled === 'True' ? 'text-green-700' : 'text-red-700'
                                    }`}>Account</div>
                                    <div className="flex items-center justify-center mt-1">
                                      {log.accountEnabled === 'True' ? (
                                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Source IP in a compact format */}
                                <div className="flex items-center gap-2 mb-3 bg-gray-50 p-2 rounded border border-gray-200 text-xs">
                                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                                  </svg>
                                  <span className="font-mono font-medium text-gray-700">Source IP: {log.ip}</span>
                                </div>
                                
                                {/* Final Decision Banner - more compact */}
                                <div className={`rounded-lg py-2 px-3 text-center ${
                                  log.executeApproved === 'True' 
                                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                                    : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                                }`}>
                                  <div className="flex items-center justify-center gap-2">
                                    {log.executeApproved === 'True' ? (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                      </svg>
                                    )}
                                    <span className="text-sm font-bold">
                                      {log.executeApproved === 'True' ? 'EXECUTION APPROVED' : 'EXECUTION DENIED'}
                                    </span>
                                  </div>
                                  <p className="text-xs mt-1 opacity-90">
                                    {log.executeApproved === 'True' 
                                      ? 'Security checks passed' 
                                      : 'Security checks failed'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      
                      <span className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Column: Application Logs */}
          <div className="bg-white rounded-lg shadow-md flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Application Logs</h2>
              <p className="text-sm text-gray-600 mt-1">Configuration changes, user actions, and system events</p>
              
              {/* Stats */}
              <div className="text-sm text-gray-600 mt-4">
                Showing {Math.min(appLogsPerPage, applicationLogs.length - (appCurrentPage - 1) * appLogsPerPage)} of {applicationLogs.length} entries
              </div>
            </div>

            {/* Application Logs Content */}
            <div className="p-6 flex-1">
              {loadingApplicationLogs ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading application logs...</p>
                </div>
              ) : applicationLogs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No application logs available</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {applicationLogs.slice((appCurrentPage - 1) * appLogsPerPage, appCurrentPage * appLogsPerPage).map((logLine, index) => {
                    const log = formatApplicationLogEntry(logLine);
                    const [date, time] = log.timestamp.split(' ');
                    
                    return (
                      <div key={index} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300">
                        <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white p-2">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                              <span className="font-bold text-sm">APPLICATION</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-300">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs">{date}</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-300">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-xs">{time}</span>
                            </div>
                            <span className={`text-xs px-1 py-0.5 rounded ${getCategoryColor(log.category)}`}>
                              {log.category}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${getLevelColor(log.level)}`}>
                              {log.level}
                            </span>
                          </div>
                        </div>
                        <div className="bg-white p-3">
                          <p className="text-gray-800 text-xs font-mono leading-relaxed">{log.message}</p>
                          {log.details && (
                            <div className="mt-1 text-xs text-gray-600 font-mono bg-gray-50 p-1 rounded border-l-2 border-gray-300">
                              {log.details}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination for Application Logs */}
                {Math.ceil(applicationLogs.length / appLogsPerPage) > 1 && (
                  <div className="flex justify-center items-center space-x-2">
                    <button
                      onClick={() => setAppCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={appCurrentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    
                    <span className="text-sm text-gray-600">
                      Page {appCurrentPage} of {Math.ceil(applicationLogs.length / appLogsPerPage)}
                    </span>
                    
                    <button
                      onClick={() => setAppCurrentPage(prev => Math.min(prev + 1, Math.ceil(applicationLogs.length / appLogsPerPage)))}
                      disabled={appCurrentPage === Math.ceil(applicationLogs.length / appLogsPerPage)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
