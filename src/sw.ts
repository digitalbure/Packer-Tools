import { precacheAndRoute } from 'workbox-precaching';

declare const self: any;
const swSelf = self as any;

// Precache resources compiled by VitePWA
precacheAndRoute(self.__WB_MANIFEST || []);

const DB_NAME = 'packer-offline-sync';
const STORE_NAME = 'operations';
const DB_VERSION = 1;

// Initialize IndexedDB in the Service Worker
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
