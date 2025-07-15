import { useState, useEffect } from 'react';
import useConfigStore from '../store';
import { getBackendUrl } from '../configStorage';

const useComponents = (includeDisabled = false) => {
  const { config } = useConfigStore();
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get backend URL from config - use main backend server
  const getBackendUrlForComponents = () => {
    return getBackendUrl();
  };

  const fetchComponents = async () => {
    setLoading(true);
    setError(null);
    
    const backendUrl = getBackendUrlForComponents();
    if (!backendUrl) {
      setError('Backend URL not configured');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${backendUrl}/api/components`);
      if (!response.ok) {
        throw new Error(`Failed to fetch components: ${response.status}`);
      }
      
      const data = await response.json();
      // If includeDisabled is true, return all components, otherwise only enabled ones
      const filteredComponents = includeDisabled 
        ? data.components || []
        : data.components?.filter(component => component.enabled) || [];
      setComponents(filteredComponents);
    } catch (err) {
      console.error('Error fetching components:', err);
      setError(err.message);
      // Fallback to default components if API call fails
      const fallbackComponents = [
        { id: 'windows', name: 'Windows', value: 'windows', enabled: true },
        { id: 'linux', name: 'Linux', value: 'linux', enabled: true },
        { id: 'network', name: 'Network', value: 'network', enabled: true }
      ];
      setComponents(includeDisabled ? fallbackComponents : fallbackComponents.filter(c => c.enabled));
    } finally {
      setLoading(false);
    }
  };

  const addComponent = async (newComponent) => {
    const backendUrl = getBackendUrlForComponents();
    if (!backendUrl) {
      setError('Backend URL not configured');
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
    const backendUrl = getBackendUrlForComponents();
    if (!backendUrl) {
      setError('Backend URL not configured');
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
    const backendUrl = getBackendUrlForComponents();
    if (!backendUrl) {
      setError('Backend URL not configured');
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
    const backendUrl = getBackendUrlForComponents();
    if (!backendUrl) {
      setError('Backend URL not configured');
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
    const backendUrl = getBackendUrlForComponents();
    if (backendUrl) {
      fetchComponents();
    }
  }, []);

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
