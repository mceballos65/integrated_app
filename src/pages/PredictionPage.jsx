import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import useConfigStore from "../store";
import { useAuth } from "../hooks/useAuth.jsx";
import ComponentSelector from "../components/ComponentSelector.jsx";

const defaultItem = {
  phrase: "",
  playbook: "",
  threshold: 0,
  component: "",
  only_on_component_match: false
};

export default function PredictionPage() {
  const { config } = useConfigStore();
  const { securityWarning } = useAuth();
  
  // Security check - same as LogsPage
  const adminUserDisabled = config?.security?.admin_user_disabled || false;
  
  // If there are security warnings, block access to this critical page
  if (securityWarning) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 border border-red-300 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-red-700 mb-4">⚠️ Security Warning</h2>
            <p className="text-red-600 mb-4">
              The prediction page is currently unavailable due to security issues. Please review security settings to ensure the default admin user is disabled and debug access is properly configured.
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
  
  console.log("PredictionPage - Config values:", { predictionUrl, accountCode, config });
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editedItem, setEditedItem] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newItem, setNewItem] = useState({ ...defaultItem });
  const [statusMessage, setStatusMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "enabled", or "disabled"
  const [disabledMatchers, setDisabledMatchers] = useState([]);
  const [loadingMatcherStatus, setLoadingMatcherStatus] = useState(false);

  const showStatusMessage = (text) => {
    setStatusMessage(text);
    setTimeout(() => setStatusMessage(""), 3000);
  };

  const fetchMatcherStatus = async () => {
    if (!predictionUrl || !accountCode) return;
    
    setLoadingMatcherStatus(true);
    try {
      const response = await fetch(`${predictionUrl}/accounts/${accountCode}`, {
        method: 'GET',
        headers: { "Content-Type": "application/json" }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDisabledMatchers(data.disabled_matchers || []);
      } else {
        console.error('Error fetching matcher status:', response.status);
        setDisabledMatchers([]);
      }
    } catch (err) {
      console.error("Error fetching matcher status:", err);
      setDisabledMatchers([]);
    } finally {
      setLoadingMatcherStatus(false);
    }
  };

  const toggleMatcherStatus = async (matcherId, currentlyDisabled) => {
    if (!predictionUrl || !accountCode) return;

    const endpoint = currentlyDisabled ? 'enable' : 'disable';
    const action = currentlyDisabled ? 'enabled' : 'disabled';
    
    try {
      const response = await fetch(`${predictionUrl}/accounts/${accountCode}/${endpoint}`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matcher_id: matcherId })
      });
      
      if (response.ok) {
        showStatusMessage(`Matcher successfully ${action}`);
        // Refresh the matcher status after successful toggle
        await fetchMatcherStatus();
      } else {
        throw new Error(`Failed to ${endpoint} matcher`);
      }
    } catch (err) {
      console.error(`Error ${action} matcher:`, err);
      showStatusMessage(`Error ${action} matcher: ${err.message}`);
    }
  };

  const fetchItems = async () => {
    console.log("fetchItems called with predictionUrl:", predictionUrl);
    if (!predictionUrl) {
      console.log("No prediction URL configured, skipping fetch");
      return;
    }
    
    try {
      console.log("Fetching items from:", `${predictionUrl}/list`);
      const response = await fetch(`${predictionUrl}/list`, {
        headers: { "Content-Type": "application/json" }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("Fetched items:", data);
        setItems(data);
        setFilteredItems(data);
        setSelectedId(null);
        setEditedItem(null);
        
        // Fetch matcher status after getting the list
        await fetchMatcherStatus();
      } else {
        console.error("Failed to fetch items, status:", response.status);
        throw new Error('Failed to fetch items');
      }
    } catch (err) {
      console.error("Error fetching list:", err);
    }
  };

  useEffect(() => {
    console.log("PredictionPage useEffect triggered with:", { predictionUrl, accountCode });
    fetchItems();
  }, [predictionUrl, accountCode]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    let filtered = items.filter(
      (item) =>
        (item.phrase.toLowerCase().includes(term) ||
        item.playbook?.toLowerCase().includes(term))
    );
    
    // Apply status filter
    if (statusFilter !== "all") {
      const isDisabled = statusFilter === "disabled";
      filtered = filtered.filter(item => 
        disabledMatchers.includes(item.id) === isDisabled
      );
    }
    
    setFilteredItems(filtered);
  }, [searchTerm, items, statusFilter, disabledMatchers]);

  const handleSelect = (item) => {
    setSelectedId(item.id);
    setEditedItem({ ...defaultItem, ...item });
    setShowNewForm(false);
  };

  const handleEditChange = (key, value) => {
    setEditedItem((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpdate = () => {
    fetch(`${predictionUrl}/modify`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editedItem)
    })
      .then((res) => res.json())
      .then(() => {
        showStatusMessage(`Matcher ID ${editedItem.id} successfully modified`);
        fetchItems();
      })
      .catch((err) => showStatusMessage("Error updating item: " + err.message));
  };

  const handleNewChange = (key, value) => {
    setNewItem((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddNew = () => {
    fetch(`${predictionUrl}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem)
    })
      .then((res) => res.json())
      .then(() => {
        showStatusMessage(`Matcher name: ${newItem.phrase} successfully added`);
        setNewItem({ ...defaultItem });
        setShowNewForm(false);
        fetchItems();
      })
      .catch((err) => showStatusMessage("Error adding item: " + err.message));
  };

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    fetch(`${predictionUrl}/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    })
      .then((res) => res.json())
      .then(() => {
        showStatusMessage(`Matcher ID ${id} successfully deleted`);
        fetchItems();
      })
      .catch((err) => showStatusMessage("Error deleting item: " + err.message));
  };

  const renderForm = (item, onChange, onSubmit, isNew = false) => (
    <div className="bg-white border rounded p-4 shadow space-y-4">
      <h3 className="text-lg font-semibold text-kyndryl-orange">
        {isNew ? "New Item" : "Edit Item"}
      </h3>
      {["phrase", "playbook", "threshold", "component", "only_on_component_match"].map((key) => (
        <div key={key}>
          <label className="block font-medium capitalize">{key.replace(/_/g, " ")}</label>
          {key === "component" ? (
            <ComponentSelector
              value={item[key]}
              onChange={(e) => onChange(key, e.target.value)}
              className="w-full border rounded px-2 py-1"
            />
          ) : key === "only_on_component_match" ? (
            <select
              value={item[key] ? "true" : "false"}
              onChange={(e) => onChange(key, e.target.value === "true")}
              className="w-full border rounded px-2 py-1"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : key === "threshold" ? (
            <input
              type="number"
              step="0.01"
              value={item[key]}
              onChange={(e) => onChange(key, parseFloat(e.target.value))}
              className="w-full border rounded px-2 py-1"
            />
          ) : (
            <input
              type="text"
              value={item[key]}
              onChange={(e) => onChange(key, e.target.value)}
              className="w-full border rounded px-2 py-1"
            />
          )}
        </div>
      ))}
      <button
        onClick={onSubmit}
        className="bg-kyndryl-orange text-white px-4 py-2 rounded hover:bg-orange-600"
      >
        {isNew ? "Add" : "Accept"}
      </button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-8rem)] overflow-hidden">
      <div className="lg:col-span-2 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-kyndryl-orange">Prediction Matchers</h2>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-gray-500">🔍</span>
            <input
              type="text"
              placeholder="Search by phrase or playbook..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1"
              style={{ flex: 1, minWidth: "250px" }}
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-gray-700 whitespace-nowrap">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 bg-white"
              >
                <option value="all">All</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            
            <div className="flex gap-2 ml-auto">
              <button
                onClick={fetchItems}
                className="bg-gray-200 text-black px-3 py-1 rounded hover:bg-gray-300"
              >
                Refresh
              </button>
              <button
                onClick={() => {
                  setShowNewForm(true);
                  setSelectedId(null);
                  setEditedItem(null);
                }}
                className="bg-kyndryl-orange text-white px-3 py-1 rounded hover:bg-orange-600"
              >
                Add New
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 pr-1">
          <ul className="space-y-2">
            {filteredItems.map((item) => {
              const isDisabled = disabledMatchers.includes(item.id);
              return (
                <li
                  key={item.id}
                  className="p-3 border rounded bg-gray-100 flex justify-between items-center"
                >
                  <span className="flex-1 cursor-pointer" onClick={() => handleSelect(item)}>
                    {item.phrase}
                  </span>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => toggleMatcherStatus(item.id, isDisabled)}
                      disabled={loadingMatcherStatus}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        isDisabled
                          ? 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
                          : 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'
                      } ${loadingMatcherStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {loadingMatcherStatus ? '...' : (isDisabled ? 'Disabled' : 'Enabled')}
                    </button>
                    <button
                      onClick={() => handleSelect(item)}
                      className="bg-kyndryl-orange text-white px-2 py-1 rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="bg-red-600 text-white px-2 py-1 rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="lg:col-span-3 space-y-4 overflow-y-auto pr-2">
        {statusMessage && (
          <div className="bg-green-100 border border-green-400 text-green-800 px-4 py-2 rounded">
            {statusMessage}
          </div>
        )}
        {showNewForm && renderForm(newItem, handleNewChange, handleAddNew, true)}
        {editedItem && !showNewForm && (
          <div>
            <h3 className="text-lg font-semibold text-kyndryl-orange mb-2">Edit Item</h3>
            {renderForm(editedItem, handleEditChange, handleUpdate)}
          </div>
        )}
        {selectedId && !showNewForm && (
          <div className="bg-white border rounded p-4 shadow space-y-4">
            <h3 className="text-lg font-semibold text-kyndryl-orange">
              Selected Item Details
            </h3>
            <div>
              <strong>Phrase:</strong> {editedItem.phrase}
            </div>
            <div>
              <strong>Playbook:</strong> {editedItem.playbook}
            </div>
            <div>
              <strong>Threshold:</strong> {editedItem.threshold}
            </div>
            <div>
              <strong>Component:</strong> {editedItem.component || "N/A"}
            </div>
            <div>
              <strong>Only on Component Match:</strong>{" "}
              {editedItem.only_on_component_match ? "Yes" : "No"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}