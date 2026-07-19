import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface NfcTagInfo {
  uid: string;
  payload: string;
  type: string;
  ndefCapacity: number;
  writable: boolean;
  lockStatus: 'unlocked' | 'locked';
}

export interface RfidTagInfo {
  epc: string;
  tid: string;
  protocol: string;
  frequencyBand: string;
}

export interface IdentificationDevice {
  id: string;
  name: string;
  type: 'nfc_reader' | 'rfid_handheld' | 'rfid_portal' | 'barcode_scanner';
  manufacturer: string;
  model: string;
  serialNumber: string;
  connectionType: 'usb' | 'bluetooth' | 'network' | 'embedded';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  batteryLevel?: number;
  firmware: string;
  capabilities: string[];
}

export interface IdentificationEvent {
  eventType: 'qr_scan' | 'nfc_tap' | 'nfc_write' | 'nfc_verify' | 'rfid_detect' | 'rfid_encode' | 'rfid_verify' | 'tag_assign' | 'tag_replace' | 'tag_retire';
  identifierId?: string;
  assetId: string;
  assetName?: string;
  deviceId?: string;
  deviceName?: string;
  locationId?: string;
  result: 'success' | 'partial' | 'failed';
  errorMsg?: string;
  metadata?: any;
}

// Global helper to log verification and scan events to firestore
export async function logIdentificationEvent(userId: string, event: IdentificationEvent) {
  try {
    const path = `users/${userId}/identification_events`;
    await addDoc(collection(db, path), {
      ...event,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Failed to write identification event to Firestore', err);
  }
}

// Simple unique token generator for NFC URIs
export function generateSecureToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return `tok_${token}`;
}

// Standard EPC generator - 24 Hex characters (96 bits)
export function generatePackerEpc(assetTag?: string): string {
  const baseHex = 'E2801130'; // Packer standard prefix
  const chars = '0123456789ABCDEF';
  let randomPadding = '';
  for (let i = 0; i < 16; i++) {
    randomPadding += chars[Math.floor(Math.random() * 16)];
  }
  if (assetTag) {
    // Map alphanumeric tag values to Hex safely
    const tagClean = assetTag.replace(/[^0-9A-Fa-f]/g, '').padEnd(16, '0').slice(0, 16).toUpperCase();
    return `${baseHex}${tagClean}`;
  }
  return `${baseHex}${randomPadding}`;
}
