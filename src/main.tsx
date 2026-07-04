import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Safe LocalStorage and SessionStorage monkey-patch to prevent QuotaExceededError crashes
if (typeof window !== 'undefined') {
  if (window.localStorage) {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = function (key, value) {
      try {
        originalSetItem.call(window.localStorage, key, value);
      } catch (e: any) {
        console.warn('LocalStorage write failed. Attempting to clear cache keys to free up space:', key, e);
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && (k.includes('_cache') || k.includes('recent_views') || k.includes('autosave') || k.includes('packer_recent_views'))) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach((k) => {
            window.localStorage.removeItem(k);
          });
          
          // Retry setting the item after cleaning up
          originalSetItem.call(window.localStorage, key, value);
        } catch (retryError) {
          console.warn('LocalStorage is still full or threw an exception after cleanup. Gracefully ignoring to prevent crash.', retryError);
        }
      }
    };
  }

  if (window.sessionStorage) {
    const originalSessionSetItem = window.sessionStorage.setItem;
    window.sessionStorage.setItem = function (key, value) {
      try {
        originalSessionSetItem.call(window.sessionStorage, key, value);
      } catch (e: any) {
        console.warn('SessionStorage write failed. Attempting to clean session keys:', key, e);
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const k = window.sessionStorage.key(i);
            if (k && (k.includes('cache') || k.includes('recent') || k.includes('reloaded'))) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach((k) => {
            window.sessionStorage.removeItem(k);
          });
          originalSessionSetItem.call(window.sessionStorage, key, value);
        } catch (retryError) {
          console.warn('SessionStorage is still full. Gracefully ignoring to prevent crash.', retryError);
        }
      }
    };
  }
}

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
