import React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './employee/App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// Register the service worker (production builds only — dev HMR + SW
// fight each other and stale assets are confusing during local dev).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[Wellness+] SW registration failed', err);
    });
  });
}
