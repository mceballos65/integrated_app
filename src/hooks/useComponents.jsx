import { useState, useEffect } from 'react';
import useConfigStore from '../store';

const useComponents = () => {
  const { config } = useConfigStore();
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get backend URL from config
  const getBackendUrl = () => {
    return config?.app?.prediction_url || '';
  };

  const fetchComponents = async () => {
    setLoading(true);
    setError(null);
    
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      setError('Prediction URL not configured in App Configuration');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${backendUrl}/api/components`);
      if (!response.ok) {
        throw new Error(`Failed to fetch components: ${response.status}`);
      }
      
      const data = await response.json();
      const enabledComponents = data.components?.filter(component => component.enabled) || [];
      setComponents(enabledComponents);
    } catch (err) {
      console.error('Error fetching components:', err);
      setError(err.message);
      // Fallback to default components if API call fails
      setComponents([
        { id: 'windows', name: 'Windows', value: 'windows', enabled: true },
        { id: 'linux', name: 'Linux', value: 'linux', enabled: true },
        { id: 'network', name: 'Network', value: 'network', enabled: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const addComponent = async (newComponent) => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      setError('Prediction URL not configured in App Configuration');
      return null;
    }

    try {
      const response = await fetch(`${backendUrl}/api/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComponent)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to add component: ${response.status}`);
      }
      
      const addedComponent = await response.json();
      
      // Refresh components list
      await fetchComponents();
      return addedComponent;
    } catch (err) {
      console.error('Error adding component:', err);
      setError(err.message);
      return null;
    }
  };

  const updateComponent = async (componentId, updates) => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      setError('Prediction URL not configured in App Configuration');
      return false;
    }

    try {
      const response = await fetch(`${backendUrl}/api/components/${componentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to update component: ${response.status}`);
      }
      
      // Refresh components list
      await fetchComponents();
      return true;
    } catch (err) {
      console.error('Error updating component:', err);
      setError(err.message);
      return false;
    }
  };

  const removeComponent = async (componentId) => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      setError('Prediction URL not configured in App Configuration');
      return false;
    }

    try {
      const response = await fetch(`${backendUrl}/api/components/${componentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to remove component: ${response.status}`);
      }
      
      // Refresh components list
      await fetchComponents();
      return true;
    } catch (err) {
      console.error('Error removing component:', err);
      setError(err.message);
      return false;
    }
  };

  const toggleComponent = async (componentId) => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      setError('Prediction URL not configured in App Configuration');
      return false;
    }

    try {
      const response = await fetch(`${backendUrl}/api/components/${componentId}/toggle`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to toggle component: ${response.status}`);
      }
      
      // Refresh components list
      await fetchComponents();
      return true;
    } catch (err) {
      console.error('Error toggling component:', err);
      setError(err.message);
      return false;
    }
  };

  const getEnabledComponents = () => {
    return components.filter(component => component.enabled);
  };

  const getComponentOptions = () => {
    return getEnabledComponents().map(component => ({
      value: component.value,
      label: component.name || component.value,
      description: component.description
    }));
  };

  useEffect(() => {
    if (config?.app?.prediction_url) {
      fetchComponents();
    }
  }, [config?.app?.prediction_url]);

  return {
    components,
    loading,
    error,
    fetchComponents,
    addComponent,
    updateComponent,
    removeComponent,
    toggleComponent,
    getEnabledComponents,
    getComponentOptions
  };
};

export default useComponents;
