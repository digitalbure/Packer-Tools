import { db } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export interface OfflineOperation {
  id: string;
  type: 'set' | 'update' | 'delete';
  collectionPath: string[]; // e.g. ['users', 'uid', 'gearLibrary'] or ['inventories', 'invId', 'items']
  docId: string;
  data?: any;
  label: string; // e.g. "Add Sony FX3", "Update Drone Quantity"
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

type SyncListener = (queue: OfflineOperation[], isOnline: boolean, isSyncing: boolean) => void;

class OfflineSyncManager {
  private queue: OfflineOperation[] = [];
  private isOnlineStatus: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncingStatus: boolean = false;
  private listeners: Set<SyncListener> = new Set();
  private registrationRetryCount = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      
      // Listen for messages from the service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', this.handleSWMessage.bind(this));
      }
      
      // Perform initial load
      this.loadQueue();
    }
  }

  // Check if we are online
  get isOnline(): boolean {
    return this.isOnlineStatus;
  }

  // Check if we are actively syncing
  get isSyncing(): boolean {
    return this.isSyncingStatus;
  }

  // Get current queue
  getQueue(): OfflineOperation[] {
    return this.queue;
  }

  // Subscribe to changes (for reactive UI)
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Initial emission
    listener([...this.queue], this.isOnlineStatus, this.isSyncingStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      listener([...this.queue], this.isOnlineStatus, this.isSyncingStatus);
    });
  }

  private handleOnline() {
    this.isOnlineStatus = true;
    this.notify();
    toast.success('Internet connection restored. Synchronizing queued operations...');
    this.syncAll();
    this.registerBackgroundSync();
  }

  private handleOffline() {
    this.isOnlineStatus = false;
    this.notify();
    toast.warning('Working offline. Updates will be queued and synchronized automatically when connection is restored.');
  }

  private handleSWMessage(event: MessageEvent) {
    if (!event.data) return;
    
    switch (event.data.type) {
      case 'QUEUE_UPDATED':
        this.loadQueue();
        break;
      case 'BACKGROUND_SYNC_TRIGGER':
        console.log('[OfflineSync] SW triggered background sync');
        this.syncAll();
        break;
    }
  }

  // Request the latest queue from the Service Worker
  async loadQueue(): Promise<OfflineOperation[]> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      const fallback = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('packer_offline_queue_fallback') || '[]') : [];
      this.queue = fallback;
      this.notify();
      return fallback;
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data && event.data.type === 'QUEUE_RESPONSE') {
          this.queue = event.data.queue || [];
          this.notify();
          resolve(this.queue);
        }
      };

      navigator.serviceWorker.controller?.postMessage(
        { type: 'GET_QUEUE' },
        [channel.port2]
      );
    });
  }

  // Push a new operation to the offline sync queue
  async queueOperation(op: Omit<OfflineOperation, 'id' | 'timestamp' | 'status'>): Promise<string> {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    const operation: OfflineOperation = {
      ...op,
      id,
      timestamp: Date.now(),
      status: 'pending'
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'QUEUE_OPERATION',
        payload: operation
      });
      
      // Update local cache and notify immediately for snappy response
      this.queue.push(operation);
      this.notify();
      
      toast.info(`Queued offline action: "${op.label}"`);
      this.registerBackgroundSync();
    } else {
      // Fallback if Service Worker is not ready or active
      const localQueue = JSON.parse(localStorage.getItem('packer_offline_queue_fallback') || '[]');
      localQueue.push(operation);
      localStorage.setItem('packer_offline_queue_fallback', JSON.stringify(localQueue));
      this.queue = localQueue;
      this.notify();
      toast.info(`Queued action: "${op.label}" (Local Fallback)`);
    }

    return id;
  }

  // Register background sync request with the browser
  async registerBackgroundSync() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('SyncManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('sync-inventory-updates');
      console.log('[OfflineSync] Registered sync-inventory-updates background sync tag');
    } catch (err) {
      console.warn('[OfflineSync] Failed to register background sync tag (unsupported or blocked):', err);
    }
  }

  // Explicitly delete an item from the Service Worker's database
  async removeOperation(id: string): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'REMOVE_OPERATION',
        payload: { id }
      });
      this.queue = this.queue.filter(op => op.id !== id);
      this.notify();
    } else {
      const localQueue = JSON.parse(localStorage.getItem('packer_offline_queue_fallback') || '[]');
      const filtered = localQueue.filter((op: any) => op.id !== id);
      localStorage.setItem('packer_offline_queue_fallback', JSON.stringify(filtered));
      this.queue = filtered;
      this.notify();
    }
  }

  // Explicitly clear the sync queue
  async clearQueue(): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_QUEUE'
      });
      this.queue = [];
      this.notify();
    } else {
      localStorage.removeItem('packer_offline_queue_fallback');
      this.queue = [];
      this.notify();
    }
  }

  // Trigger manual or automatic background synchronization
  async syncAll(): Promise<void> {
    if (this.isSyncingStatus) return;
    
    // First refresh queue list from SW
    await this.loadQueue();
    
    if (this.queue.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      toast.error('Cannot sync: browser is currently offline.');
      return;
    }

    this.isSyncingStatus = true;
    this.notify();
    
    let successCount = 0;
    let failCount = 0;

    // Process operations in sequential order (FIFO) to maintain consistency
    for (const op of [...this.queue]) {
      try {
        const docRef = doc(db, op.collectionPath[0], ...op.collectionPath.slice(1));
        
        if (op.type === 'set') {
          await setDoc(docRef, op.data);
        } else if (op.type === 'update') {
          await updateDoc(docRef, op.data);
        } else if (op.type === 'delete') {
          await deleteDoc(docRef);
        }
        
        // Remove from SW IndexedDB
        await this.removeOperation(op.id);
        successCount++;
      } catch (err: any) {
        console.error(`[OfflineSync] Sync failed for operation ${op.id} (${op.label}):`, err);
        failCount++;
        // Update error inside local tracking
        op.status = 'failed';
        op.error = err.message || String(err);
      }
    }

    this.isSyncingStatus = false;
    await this.loadQueue(); // Final queue reload

    if (successCount > 0) {
      toast.success(`Successfully synchronized ${successCount} offline operation(s)!`);
    }
    if (failCount > 0) {
      toast.error(`Failed to synchronize ${failCount} offline operation(s). Check queue details.`);
    }
  }

  // Cache gear list locally in the Service Worker's IndexedDB
  async cacheGearList(userId: string, gearList: any[]): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_GEAR_LIST',
        payload: { userId, gearList }
      });
    }
  }

  // Retrieve gear list cached in the Service Worker's IndexedDB
  async getCachedGearList(userId: string): Promise<any[]> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      try {
        const local = localStorage.getItem(`gear_cache_${userId}`);
        return local ? JSON.parse(local) : [];
      } catch {
        return [];
      }
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data && event.data.type === 'GEAR_LIST_RESPONSE') {
          resolve(event.data.gearList || []);
        } else {
          resolve([]);
        }
      };

      navigator.serviceWorker.controller?.postMessage(
        { type: 'GET_CACHED_GEAR_LIST', payload: { userId } },
        [channel.port2]
      );
    });
  }

  // Cache custom inventories metadata in the Service Worker's IndexedDB
  async cacheInventories(userId: string, inventories: any[]): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_INVENTORIES',
        payload: { userId, inventories }
      });
    }
  }

  // Retrieve custom inventories cached in the Service Worker's IndexedDB
  async getCachedInventories(userId: string): Promise<any[]> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      try {
        const local = localStorage.getItem(`inventories_cache_${userId}`);
        return local ? JSON.parse(local) : [];
      } catch {
        return [];
      }
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data && event.data.type === 'INVENTORIES_RESPONSE') {
          resolve(event.data.inventories || []);
        } else {
          resolve([]);
        }
      };

      navigator.serviceWorker.controller?.postMessage(
        { type: 'GET_CACHED_INVENTORIES', payload: { userId } },
        [channel.port2]
      );
    });
  }

  // General metadata caching
  async cacheMetadataRecord(id: string, data: any): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_METADATA_RECORD',
        payload: { id, data }
      });
    }
  }

  // Retrieve general metadata
  async getCachedMetadataRecord(id: string): Promise<any> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      try {
        const local = localStorage.getItem(`meta_cache_${id}`);
        return local ? JSON.parse(local) : null;
      } catch {
        return null;
      }
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data && event.data.type === 'METADATA_RECORD_RESPONSE' && event.data.id === id) {
          resolve(event.data.data);
        } else {
          resolve(null);
        }
      };

      navigator.serviceWorker.controller?.postMessage(
        { type: 'GET_CACHED_METADATA_RECORD', payload: { id } },
        [channel.port2]
      );
    });
  }
}

export const offlineSync = new OfflineSyncManager();
