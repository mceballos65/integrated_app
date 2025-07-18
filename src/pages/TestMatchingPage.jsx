import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import useConfigStore from "../store";
import { useAuth } from "../hooks/useAuth.jsx";
import ComponentSelector from "../components/ComponentSelector.jsx";

export default function TestMatchingPage() {
  const { config } = useConfigStore();
  const { securityWarning } = useAuth();
  
  // If there are security warnings, block access to this critical page
  if (securityWarning) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 border border-red-300 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-red-700 mb-4">⚠️ Security Warning</h2>
            <p className="text-red-600 mb-4">
              The test matching page is currently unavailable due to security issues. Please review security settings to ensure the default admin user is disabled and debug access is properly configured.
            </p>
            <NavLink 
              to="/config?from=security" 
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Go to Configuration
            </NavLink>
          </div>
        </div>
      </div>
    );
  }
  
  // Get values directly from config
  const predictionUrl = config?.app?.prediction_url || "";
  const accountCode = config?.app?.account_code || "";
  
  console.log("TestMatchingPage - Config values:", { predictionUrl, accountCode, config });
  const [abstract, setAbstract] = useState("");
  const [component, setComponent] = useState("");
  const [result, setResult] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const showStatusMessage = (text, error = false) => {
    setStatusMessage(text);
    setIsError(error);
    setTimeout(() => setStatusMessage(""), 5000);
  };

  const handleSend = () => {
    console.log("handleSend called with predictionUrl:", predictionUrl);
    if (!predictionUrl) {
      showStatusMessage("Prediction URL is not configured. Please go to Configuration page and set the Prediction URL.", true);
      return;
    }

    console.log("Sending prediction request to:", `${predictionUrl}/predict`);
    fetch(`${predictionUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: accountCode, abstract, component })
    })
      .then((res) => {
        console.log("Prediction response status:", res.status);
        return res.json();
      })
      .then((data) => {
        console.log("Prediction response data:", data);
        setResult(data);
        showStatusMessage("Prediction completed successfully!");
      })
      .catch((err) => {
        console.error("Error sending prediction request:", err);
        showStatusMessage("Error sending request: " + err.message, true);
      });
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow space-y-6 border border-gray-200">
      <h2 className="text-2xl font-bold text-kyndryl-orange">Test Matcher</h2>

      {statusMessage && (
        <div className={`px-4 py-2 rounded border ${
          isError 
            ? 'bg-red-100 border-red-400 text-red-800' 
            : 'bg-green-100 border-green-400 text-green-800'
        }`}>
          {statusMessage}
        </div>
      )}

      <div>
        <label className="block font-semibold mb-1">Phrase</label>
        <input
          type="text"
          value={abstract}
          onChange={(e) => setAbstract(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="ex: Device is not responding to ping"
        />
      </div>

      <div>
        <label className="block font-semibold mb-1">Account</label>
        <input
          type="text"
          value={accountCode}
          readOnly
          className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
          title="This value is automatically taken from App Configuration"
        />
        <p className="text-sm text-gray-600 mt-1">
          Configured in App Configuration → Account Code
        </p>
      </div>

      <div>
        <label className="block font-semibold mb-1">Component</label>
        <ComponentSelector
          value={component}
          onChange={(e) => setComponent(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        />
      </div>

      <button
        onClick={handleSend}
        className="bg-kyndryl-orange text-white px-4 py-2 rounded hover:bg-orange-600"
      >
        Send
      </button>

      {result && (
        <div className="mt-6 bg-gray-100 p-4 rounded border border-gray-300 space-y-4">
          <div>
            <span className="font-semibold">Playbook:</span>{" "}
            <span className="text-gray-800">{result.playbook}</span>
          </div>
          <div>
            <span className="font-semibold">Execute Approved:</span>{" "}
            <span
              className={`font-bold ${
                result.execute_approved ? "text-green-600" : "text-red-600"
              }`}
            >
              {result.execute_approved ? "YES" : "NO"}
            </span>
          </div>
          <div>
            <span className="font-semibold">Abstract:</span>
            <div className="text-gray-700 mt-1 bg-white border rounded px-3 py-2">
              {result.abstract}
            </div>
          </div>

          <button
            onClick={() => setShowRaw((prev) => !prev)}
            className="text-sm text-kyndryl-orange underline hover:text-orange-600"
          >
            {showRaw ? "Hide raw data" : "See all raw data"}
          </button>

          {showRaw && (
            <pre className="text-sm bg-white border rounded p-3 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
