import React from 'react';
import useComponents from '../hooks/useComponents';

const ComponentSelector = ({ 
  value, 
  onChange, 
  className = "w-full border rounded px-2 py-1",
  placeholder = "-- Select --",
  includeEmpty = true,
  disabled = false,
  ...props 
}) => {
  const { components, loading, error } = useComponents();

  if (loading) {
    return (
      <select 
        disabled 
        className={className}
        {...props}
      >
        <option>Loading components...</option>
      </select>
    );
  }

  if (error) {
    console.warn('ComponentSelector: Error loading components, using fallback', error);
  }

  const enabledComponents = components.filter(component => component.enabled);

  return (
    <select
      value={value}
      onChange={onChange}
      className={className}
      disabled={disabled}
      {...props}
    >
      {includeEmpty && <option value="">{placeholder}</option>}
      {enabledComponents.map((component) => (
        <option 
          key={component.id || component.value} 
          value={component.value}
          title={component.description}
        >
          {component.name || component.value}
        </option>
      ))}
    </select>
  );
};

export default ComponentSelector;
