import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'leaflet/dist/leaflet.css';
import './styles/globals.css';

console.log('🚀 Atlased — Main entry point loaded');

const rootElement = document.getElementById('root');

// Fail loudly during development if the mount point is missing rather than
// rendering into nothing and producing a blank screen with no errors.
if (!rootElement) {
  const errorMsg = '[main] Root element #root not found. Check index.html.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

console.log('✅ Root element found, rendering React app');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

console.log('✅ React app mounted to #root');
