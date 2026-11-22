import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installGlobalDiagnosticListeners } from './services/diagnosticsCollector';
import { pruneOversizedAssistedCraftStores } from './services/assistedCraftsStorage';
import './index.css';

// Capture unhandled runtime & promise errors into the bounded local diagnostics buffer
installGlobalDiagnosticListeners();

// Trim oversized legacy assisted-craft lists across all characters before polling begins
pruneOversizedAssistedCraftStores();

// Auto-refresh fail-safe on stale dynamic chunk preload errors
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
