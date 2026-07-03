import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: any;
const swSelf = self as any;

// Precache resources compiled by VitePWA
precacheAndRoute(self.__WB_MANIFEST || []);

// SPA Navigation Fallback (forces offline refreshes of deep-links like /library to fall back to index.html)
try {
  const handler = createHandlerBoundToURL('/index.html');
  const navigationRoute = new NavigationRoute(handler);
  registerRoute(navigationRoute);
} catch (e) {
  console.warn('[SW] NavigationRoute registration failed:', e);
}

// Cache Google Fonts stylesheets with StaleWhileRevalidate
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
);

// Cache Google Fonts webfonts with CacheFirst
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        maxEntries: 30,
      }),
    ],
  })
);

// Cache images (local and remote/CDN) with CacheFirst strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Cache dynamic API fetch requests (like check-compatibility, suppliers, etc.) with NetworkFirst
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
      }),
    ],
  })
);

const DB_NAME = 'packer-offline-sync';
const STORE_NAME = 'operations';
const METADATA_STORE_NAME = 'inventory_metadata';
const DB_VERSION = 2;

// Initialize IndexedDB in the Service Worker
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
        db.createObjectStore(METADATA_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Fetch a metadata record by key/id
async function getMetadataRecord(id: string): Promise<any> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(METADATA_STORE_NAME, 'readonly');
      const store = transaction.objectStore(METADATA_STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[SW] Error retrieving metadata:', err);
    return null;
  }
}

// Put a metadata record by key/id
async function saveMetadataRecord(id: string, data: any): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(METADATA_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(METADATA_STORE_NAME);
      const request = store.put({ id, data });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[SW] Error saving metadata:', err);
  }
}

// Fetch all queued operations
async function getQueuedOperations(): Promise<any[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[SW] Error retrieving queue:', err);
    return [];
  }
}

// Add an operation to the queue
async function addOperation(operation: any): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        ...operation,
        id: operation.id || Date.now().toString() + Math.random().toString(36).substring(2, 7),
        status: 'pending',
        timestamp: operation.timestamp || Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[SW] Error adding to queue:', err);
  }
}

// Remove an operation from the queue
async function removeOperation(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[SW] Error removing operation:', err);
  }
}

// Clear the entire queue
async function clearQueue(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[SW] Error clearing queue:', err);
  }
}

// Notify all clients of a state change or trigger
async function notifyClients(message: any) {
  const clientsList = await swSelf.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clientsList) {
    client.postMessage(message);
  }
}

// Self and Active claims
swSelf.addEventListener('install', () => {
  swSelf.skipWaiting();
});

swSelf.addEventListener('activate', (event) => {
  event.waitUntil(swSelf.clients.claim());
});

// Messages from active clients (the front-end React application)
swSelf.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'QUEUE_OPERATION':
      await addOperation(data.payload);
      // Notify other tabs that an operation was queued
      await notifyClients({ type: 'QUEUE_UPDATED' });
      break;

    case 'GET_QUEUE':
      const queue = await getQueuedOperations();
      event.ports[0].postMessage({ type: 'QUEUE_RESPONSE', queue });
      break;

    case 'REMOVE_OPERATION':
      await removeOperation(data.payload.id);
      await notifyClients({ type: 'QUEUE_UPDATED' });
      break;

    case 'CLEAR_QUEUE':
      await clearQueue();
      await notifyClients({ type: 'QUEUE_UPDATED' });
      break;

    case 'FORCE_SYNC':
      // Client explicitly telling service worker to announce a sync trigger
      await notifyClients({ type: 'BACKGROUND_SYNC_TRIGGER' });
      break;

    case 'CACHE_GEAR_LIST':
      if (data.payload && data.payload.userId) {
        await saveMetadataRecord(`gear_${data.payload.userId}`, data.payload.gearList);
      }
      break;

    case 'GET_CACHED_GEAR_LIST':
      if (data.payload && data.payload.userId && event.ports && event.ports[0]) {
        const gearList = await getMetadataRecord(`gear_${data.payload.userId}`);
        event.ports[0].postMessage({ type: 'GEAR_LIST_RESPONSE', gearList: gearList || [] });
      }
      break;

    case 'CACHE_INVENTORIES':
      if (data.payload && data.payload.userId) {
        await saveMetadataRecord(`inventories_${data.payload.userId}`, data.payload.inventories);
      }
      break;

    case 'GET_CACHED_INVENTORIES':
      if (data.payload && data.payload.userId && event.ports && event.ports[0]) {
        const inventories = await getMetadataRecord(`inventories_${data.payload.userId}`);
        event.ports[0].postMessage({ type: 'INVENTORIES_RESPONSE', inventories: inventories || [] });
      }
      break;

    case 'CACHE_METADATA_RECORD':
      if (data.payload && data.payload.id) {
        await saveMetadataRecord(data.payload.id, data.payload.data);
      }
      break;

    case 'GET_CACHED_METADATA_RECORD':
      if (data.payload && data.payload.id && event.ports && event.ports[0]) {
        const recordData = await getMetadataRecord(data.payload.id);
        event.ports[0].postMessage({ type: 'METADATA_RECORD_RESPONSE', id: data.payload.id, data: recordData });
      }
      break;

    default:
      break;
  }
});

// Listen for browser background sync event
swSelf.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-inventory-updates') {
    console.log('[SW] Background sync event triggered for inventory updates');
    event.waitUntil(
      notifyClients({ type: 'BACKGROUND_SYNC_TRIGGER' })
    );
  }
});
