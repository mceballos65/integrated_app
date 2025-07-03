// src/pages/SimpleTest.jsx
// Simple test to verify React is working

import React from 'react';

console.log('🧪 SimpleTest.jsx loaded');

const SimpleTest = () => {
  console.log('🧪 SimpleTest component rendering');
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f0f0f0', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#333', fontSize: '24px', marginBottom: '20px' }}>
        🧪 Simple Test Page
      </h1>
      
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#555', fontSize: '18px', marginBottom: '10px' }}>
          ✅ React is Working!
        </h2>
        
        <div style={{ fontSize: '14px', color: '#666' }}>
          <p>Current URL: {window.location.href}</p>
          <p>Timestamp: {new Date().toISOString()}</p>
          <p>User Agent: {navigator.userAgent.substring(0, 100)}...</p>
        </div>
        
        <button 
          onClick={() => {
            console.log('Button clicked!');
            alert('Button works!');
          }}
          style={{
            marginTop: '15px',
            padding: '10px 20px',
            backgroundColor: '#007cba',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Button
        </button>
        
        <div style={{ marginTop: '15px' }}>
          <a 
            href="/debug" 
            style={{ 
              color: '#007cba', 
              textDecoration: 'none',
              marginRight: '15px'
            }}
          >
            → Go to Debug Page
          </a>
          
          <a 
            href="/" 
            style={{ 
              color: '#007cba', 
              textDecoration: 'none'
            }}
          >
            → Go to Main App
          </a>
        </div>
      </div>
    </div>
  );
};

export default SimpleTest;
