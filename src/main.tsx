import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA install prompt handler as early as possible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).deferredPWAInstallPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-prompt-available'));
});

if (import.meta.env.PROD) {
  try {
    registerSW({ immediate: true });
  } catch (e) {
    console.warn('Service worker registration failed:', e);
  }
} else {
  // Explicitly unregister any active service worker in development to prevent interception and "Failed to fetch dynamically imported module" errors.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('Successfully unregistered stale service worker in development:', registration.scope);
          }
        });
      }
    }).catch((err) => {
      console.warn('Error fetching service worker registrations:', err);
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
