import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          minHeight: '100vh', 
          backgroundColor: '#020617', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '2rem', 
          color: 'white',
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{ color: '#ef4444', textTransform: 'uppercase', fontWeight: 900 }}>System Fault Detected</h1>
          <pre style={{ 
            backgroundColor: '#0f172a', 
            padding: '1.5rem', 
            borderRadius: '1rem', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            fontSize: '0.75rem', 
            overflow: 'auto', 
            maxWidth: '100%' 
          }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              marginTop: '2rem', 
              backgroundColor: '#2563eb', 
              color: 'white', 
              padding: '0.75rem 2rem', 
              borderRadius: '0.75rem', 
              border: 'none', 
              fontWeight: 900, 
              cursor: 'pointer' 
            }}
          >
            REBOOT SYSTEM
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Suppress Recharts defaultProps deprecation warnings
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('defaultProps will be removed from function components')) {
    return;
  }
  originalConsoleError(...args);
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);