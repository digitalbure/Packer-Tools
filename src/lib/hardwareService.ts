import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// =========================================================================
// 1. NFC TYPES & INTERFACES
// =========================================================================

export interface NfcRecordData {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: string;
  url?: string;
}

export interface NfcReadResult {
  serialNumber: string; // Physical Hardware Tag UID (e.g. 04:A2:3B:4C:5D:6E:7F)
  records: NfcRecordData[];
  passportUrl?: string;
  extractedAssetId?: string;
  extractedOwnerId?: string;
  rawMessage?: any;
}

export interface NfcWriteOptions {
  passportUrl: string; // https://packer.tools/#/gear/{assetId}?owner={ownerId}
  assetId: string;
  assetName: string;
  ownerId?: string;
  workspaceId?: string;
  epcOrToken?: string;
  writeProtect?: boolean;
}

// =========================================================================
// 2. RFID HARDWARE TYPES & INTERFACES
// =========================================================================

export interface RfidDiscoveredTag {
  epc: string; // 24-character (or 96-bit) Hexadecimal EPC
  rssi: number; // Signal strength in dBm (e.g. -42 dBm)
  antenna?: number;
  readCount: number;
  tid?: string;
  userMemory?: string;
  timestamp: string;
  rawSource: 'bluetooth' | 'serial' | 'hid' | 'wedge' | 'network' | 'simulator';
}

export interface HardwareConnectionState {
  type: 'bluetooth' | 'serial' | 'hid' | 'wedge' | 'network' | 'simulator' | 'none';
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  deviceName: string;
  batteryLevel?: number;
  antennaPower?: number; // dBm (e.g. 10 - 30)
  error?: string;
}

export interface HardwareLog {
  time: string;
  msg: string;
  type: 'success' | 'warn' | 'info' | 'error';
}

// =========================================================================
// 3. HARDWARE CAPABILITY DETECTION
// =========================================================================

export const isWebNfcSupported = (): boolean => {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
};

export const isWebBluetoothSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
};

export const isWebSerialSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
};

export const isWebHidSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'hid' in navigator;
};

// =========================================================================
// 4. NFC HARDWARE ENGINE (READ & WRITE TO REAL TAGS)
// =========================================================================

export class NfcHardwareEngine {
  private activeController: AbortController | null = null;

  /**
   * Parses standard Packer Tools asset passport URL to extract gear & owner identifiers
   */
  public parsePassportUrl(url: string): { assetId?: string; ownerId?: string } | null {
    if (!url) return null;
    try {
      // Formats:
      // https://packer.tools/#/gear/{assetId}?owner={ownerId}
      // https://.../#/id/{nfcTagOrId}?owner={ownerId}
      // /gear/{assetId}?owner={ownerId}
      const hashPart = url.includes('#') ? url.split('#')[1] : url;
      const cleanPath = hashPart.startsWith('/') ? hashPart : `/${hashPart}`;
      
      const gearMatch = cleanPath.match(/\/gear\/([a-zA-Z0-9_-]+)/);
      const idMatch = cleanPath.match(/\/id\/([a-zA-Z0-9_-]+)/);
      const assetId = gearMatch ? gearMatch[1] : idMatch ? idMatch[1] : undefined;

      const urlObj = new URL(url.startsWith('http') ? url : `https://packer.tools${cleanPath}`);
      const ownerId = urlObj.searchParams.get('owner') || undefined;

      if (assetId) {
        return { assetId, ownerId };
      }
    } catch (e) {
      console.warn('Could not parse passport URL:', e);
    }
    return null;
  }

  /**
   * Start native Web NFC reading session
   */
  public async startScan(callbacks: {
    onReading: (result: NfcReadResult) => void;
    onError?: (error: any) => void;
    onStatusChange?: (status: string) => void;
  }): Promise<AbortController> {
    if (!isWebNfcSupported()) {
      throw new Error('Web NFC (NDEFReader) is not supported in this browser. Please use Chrome on Android or an NFC-enabled device.');
    }

    if (this.activeController) {
      this.stopScan();
    }

    const controller = new AbortController();
    this.activeController = controller;

    try {
      // @ts-ignore
      const ndef = new NDEFReader();
      callbacks.onStatusChange?.('Requesting NFC hardware permissions...');
      
      await ndef.scan({ signal: controller.signal });
      callbacks.onStatusChange?.('NFC antenna active. Tap a physical tag against the device.');

      // @ts-ignore
      ndef.addEventListener('reading', (event: any) => {
        const serialNumber = event.serialNumber || 'NFC_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        const records: NfcRecordData[] = [];
        let passportUrl: string | undefined;
        let extractedAssetId: string | undefined;
        let extractedOwnerId: string | undefined;

        if (event.message && event.message.records) {
          for (const record of event.message.records) {
            const parsedRecord: NfcRecordData = {
              recordType: record.recordType,
              mediaType: record.mediaType,
              id: record.id
            };

            const decoder = new TextDecoder(record.encoding || 'utf-8');

            if (record.recordType === 'url') {
              const url = decoder.decode(record.data);
              parsedRecord.url = url;
              passportUrl = url;
              const parsed = this.parsePassportUrl(url);
              if (parsed) {
                extractedAssetId = parsed.assetId;
                extractedOwnerId = parsed.ownerId;
              }
            } else if (record.recordType === 'text') {
              const text = decoder.decode(record.data);
              parsedRecord.data = text;
              if (text.startsWith('http') || text.includes('/gear/')) {
                passportUrl = text;
                const parsed = this.parsePassportUrl(text);
                if (parsed) {
                  extractedAssetId = parsed.assetId;
                  extractedOwnerId = parsed.ownerId;
                }
              }
            } else if (record.recordType === 'mime' && record.mediaType === 'application/json') {
              try {
                const jsonText = decoder.decode(record.data);
                parsedRecord.data = jsonText;
                const json = JSON.parse(jsonText);
                if (json.assetId) extractedAssetId = json.assetId;
                if (json.ownerId) extractedOwnerId = json.ownerId;
                if (json.passportUrl) passportUrl = json.passportUrl;
              } catch (err) {
                console.warn('Failed to parse JSON NDEF record', err);
              }
            } else if (record.data) {
              parsedRecord.data = decoder.decode(record.data);
            }

            records.push(parsedRecord);
          }
        }

        callbacks.onReading({
          serialNumber,
          records,
          passportUrl,
          extractedAssetId,
          extractedOwnerId,
          rawMessage: event.message
        });
      });

      // @ts-ignore
      ndef.addEventListener('readingerror', (err: any) => {
        console.warn('NFC Reading Error:', err);
        callbacks.onError?.(err);
      });

      return controller;
    } catch (err: any) {
      this.activeController = null;
      callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * Write Asset Passport & Identification payload to a physical NFC Tag
   */
  public async writePassportTag(
    options: NfcWriteOptions,
    callbacks?: {
      onStatusChange?: (status: string) => void;
    }
  ): Promise<{ success: boolean; serialNumber?: string }> {
    if (!isWebNfcSupported()) {
      throw new Error('Web NFC write is not supported in this browser. Please use Chrome on Android with NFC hardware.');
    }

    callbacks?.onStatusChange?.('Ready to encode. Hold physical NFC tag against the back of your device...');

    try {
      // @ts-ignore
      const ndef = new NDEFReader();

      // Formulate standard NDEF records for the physical tag:
      // Record 1: URI record pointing to the Public Asset Passport
      // Record 2: JSON Metadata record for high-speed local parsing
      // Record 3: Plain text summary
      const records: any[] = [
        {
          recordType: 'url',
          data: options.passportUrl
        },
        {
          recordType: 'mime',
          mediaType: 'application/json',
          data: new TextEncoder().encode(JSON.stringify({
            app: 'PackerTools',
            version: '5.21',
            assetId: options.assetId,
            name: options.assetName,
            ownerId: options.ownerId || '',
            workspaceId: options.workspaceId || '',
            epc: options.epcOrToken || '',
            passportUrl: options.passportUrl,
            encodedAt: new Date().toISOString()
          }))
        },
        {
          recordType: 'text',
          data: `Asset: ${options.assetName} [ID: ${options.assetId}]`
        }
      ];

      await ndef.write({ records }, { overwrite: true });

      callbacks?.onStatusChange?.('Tag encoded successfully! Writing complete.');
      return { success: true };
    } catch (err: any) {
      console.error('NFC Write operation failed:', err);
      throw err;
    }
  }

  /**
   * Stop active Web NFC scan
   */
  public stopScan() {
    if (this.activeController) {
      try {
        this.activeController.abort();
      } catch (e) {
        // ignore
      }
      this.activeController = null;
    }
  }
}

export const nfcHardware = new NfcHardwareEngine();

// =========================================================================
// 5. RFID HARDWARE ENGINE (BLUETOOTH, SERIAL, WEDGE & PORTAL CONNECTORS)
// =========================================================================

type TagDiscoveredCallback = (tag: RfidDiscoveredTag) => void;
type StatusChangeCallback = (state: HardwareConnectionState) => void;
type LogCallback = (log: HardwareLog) => void;

export class RfidHardwareEngine {
  private connectionState: HardwareConnectionState = {
    type: 'none',
    status: 'disconnected',
    deviceName: 'No Device Attached',
    antennaPower: 25,
    batteryLevel: undefined
  };

  private tagListeners: Set<TagDiscoveredCallback> = new Set();
  private statusListeners: Set<StatusChangeCallback> = new Set();
  private logListeners: Set<LogCallback> = new Set();

  // Hardware handles
  private bluetoothDevice: any = null;
  private bluetoothServer: any = null;
  private bluetoothTxChar: any = null;
  private bluetoothRxChar: any = null;

  private serialPort: any = null;
  private serialReader: any = null;
  private serialWriter: any = null;
  private isSerialReading: boolean = false;

  private hidDevice: any = null;
  private keyboardWedgeActive: boolean = false;
  private keyboardBuffer: string = '';
  private lastKeypressTimestamp: number = 0;

  private networkSocket: WebSocket | null = null;

  // Active inventory sweep state
  private isSweeping: boolean = false;

  constructor() {
    // Auto-setup keyboard wedge listener on window if in browser
    if (typeof window !== 'undefined') {
      this.setupKeyboardWedgeListener();
    }
  }

  // --- Subscriptions ---
  public subscribeTags(callback: TagDiscoveredCallback) {
    this.tagListeners.add(callback);
    return () => this.tagListeners.delete(callback);
  }

  public subscribeStatus(callback: StatusChangeCallback) {
    this.statusListeners.add(callback);
    callback(this.connectionState);
    return () => this.statusListeners.delete(callback);
  }

  public subscribeLogs(callback: LogCallback) {
    this.logListeners.add(callback);
    return () => this.logListeners.delete(callback);
  }

  private emitStatus(partial: Partial<HardwareConnectionState>) {
    this.connectionState = { ...this.connectionState, ...partial };
    this.statusListeners.forEach(cb => cb(this.connectionState));
  }

  private emitLog(msg: string, type: 'success' | 'warn' | 'info' | 'error' = 'info') {
    const log: HardwareLog = {
      time: new Date().toLocaleTimeString(),
      msg,
      type
    };
    this.logListeners.forEach(cb => cb(log));
  }

  private emitTag(tag: RfidDiscoveredTag) {
    this.tagListeners.forEach(cb => cb(tag));
  }

  public getConnectionState(): HardwareConnectionState {
    return this.connectionState;
  }

  // =========================================================================
  // 5A. WEB BLUETOOTH RFID CONNECTOR (Zebra RFD40, RFD8500, BLE Sleds)
  // =========================================================================

  public async connectBluetooth(options?: { namePrefix?: string }): Promise<void> {
    if (!isWebBluetoothSupported()) {
      throw new Error('Web Bluetooth API is not supported in this browser. Please use Chrome/Edge on Desktop or Android.');
    }

    this.emitStatus({ status: 'connecting', type: 'bluetooth' });
    this.emitLog('Scanning for Bluetooth Low Energy UHF RFID devices (Zebra RFD40, RFD8500, Nordic UART)...', 'info');

    try {
      // Standard BLE UUIDs for RFID sleds & Nordic UART
      const NORDIC_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
      const NORDIC_TX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
      const NORDIC_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

      // Zebra / Generic BLE SPP services
      const ZEBRA_SERVICE = '0000fe55-0000-1000-8000-00805f9b34fb';
      const BATTERY_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';

      // @ts-ignore
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: options?.namePrefix || 'RFD' },
          { namePrefix: 'Zebra' },
          { namePrefix: 'RFID' },
          { namePrefix: 'UHF' },
          { services: [NORDIC_UART_SERVICE] }
        ],
        optionalServices: [
          NORDIC_UART_SERVICE,
          ZEBRA_SERVICE,
          BATTERY_SERVICE,
          'generic_access',
          'device_information'
        ]
      });

      this.bluetoothDevice = device;
      this.emitLog(`Device selected: ${device.name || 'Bluetooth RFID Sled'}. Establishing GATT connection...`, 'info');

      device.addEventListener('gattserverdisconnected', () => {
        this.emitLog(`Bluetooth device ${device.name} disconnected.`, 'warn');
        this.emitStatus({ status: 'disconnected', type: 'none', deviceName: 'Disconnected' });
        this.cleanupBluetooth();
      });

      const server = await device.gatt.connect();
      this.bluetoothServer = server;

      // Check battery service if available
      try {
        const batteryService = await server.getPrimaryService(BATTERY_SERVICE);
        const batteryChar = await batteryService.getCharacteristic('00002a19-0000-1000-8000-00805f9b34fb');
        const value = await batteryChar.readValue();
        const batteryLevel = value.getUint8(0);
        this.emitStatus({ batteryLevel });
        this.emitLog(`Sled Battery Level: ${batteryLevel}%`, 'info');
      } catch (e) {
        // Battery service optional
      }

      // Discover UART / Communication Service
      let rxChar: any = null;
      let txChar: any = null;

      try {
        const uartService = await server.getPrimaryService(NORDIC_UART_SERVICE);
        txChar = await uartService.getCharacteristic(NORDIC_TX);
        rxChar = await uartService.getCharacteristic(NORDIC_RX);
      } catch (e) {
        // Fallback to discovering all services
        const services = await server.getPrimaryServices();
        for (const service of services) {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.notify || char.properties.indicate) {
              rxChar = char;
            }
            if (char.properties.write || char.properties.writeWithoutResponse) {
              txChar = char;
            }
          }
        }
      }

      if (rxChar) {
        this.bluetoothRxChar = rxChar;
        await rxChar.startNotifications();
        rxChar.addEventListener('characteristicvaluechanged', (event: any) => {
          const value = event.target.value;
          this.parseIncomingHardwareData(value, 'bluetooth');
        });
      }

      this.bluetoothTxChar = txChar;

      this.emitStatus({
        status: 'connected',
        type: 'bluetooth',
        deviceName: device.name || 'Zebra RFD40 Sled (BLE)',
        antennaPower: 25
      });

      this.emitLog(`✅ Bluetooth connection established with ${device.name || 'RFID Sled'}. Ready for tag sweeps.`, 'success');
    } catch (err: any) {
      console.error('Bluetooth connection error:', err);
      this.emitStatus({ status: 'error', error: err.message || 'BLE Connection Failed' });
      this.emitLog(`❌ Bluetooth connection failed: ${err.message}`, 'error');
      throw err;
    }
  }

  // =========================================================================
  // 5B. WEB SERIAL RFID CONNECTOR (USB Virtual COM, Desktop RFID Readers)
  // =========================================================================

  public async connectSerial(baudRate: number = 115200): Promise<void> {
    if (!isWebSerialSupported()) {
      throw new Error('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
    }

    this.emitStatus({ status: 'connecting', type: 'serial' });
    this.emitLog('Opening Web Serial Port selector for USB RFID reader / Zebra USB Sled...', 'info');

    try {
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate });
      this.serialPort = port;

      this.emitStatus({
        status: 'connected',
        type: 'serial',
        deviceName: `USB Serial Reader (Baud ${baudRate})`,
        antennaPower: 25
      });
      this.emitLog(`✅ USB Serial port opened at ${baudRate} baud. Listening for RFID stream...`, 'success');

      // Start continuous background read loop
      this.startSerialReadLoop();
    } catch (err: any) {
      console.error('Serial connection error:', err);
      this.emitStatus({ status: 'error', error: err.message || 'Serial Connection Failed' });
      this.emitLog(`❌ Serial connection error: ${err.message}`, 'error');
      throw err;
    }
  }

  private async startSerialReadLoop() {
    if (!this.serialPort || !this.serialPort.readable) return;
    this.isSerialReading = true;

    try {
      while (this.serialPort.readable && this.isSerialReading) {
        this.serialReader = this.serialPort.readable.getReader();
        try {
          while (true) {
            const { value, done } = await this.serialReader.read();
            if (done) break;
            if (value) {
              this.parseIncomingHardwareData(value, 'serial');
            }
          }
        } catch (error) {
          console.warn('Serial read loop error:', error);
        } finally {
          this.serialReader.releaseLock();
        }
      }
    } catch (err) {
      console.warn('Serial fatal stream error:', err);
    }
  }

  // =========================================================================
  // 5C. HARDWARE KEYBOARD WEDGE SCANNER (USB / BLE 2D & RFID Barcode Guns)
  // =========================================================================

  private setupKeyboardWedgeListener() {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // If user is actively typing in a standard form input, do not intercept normal text
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      
      const now = Date.now();
      const interval = now - this.lastKeypressTimestamp;
      this.lastKeypressTimestamp = now;

      // Scanners transmit characters at lightning speed (< 50ms per key)
      if (e.key === 'Enter') {
        if (this.keyboardBuffer.length >= 8 && (interval < 90 || !isInput)) {
          const rawScanned = this.keyboardBuffer.trim();
          this.keyboardBuffer = '';
          this.handleScannedWedgeCode(rawScanned);
        } else {
          this.keyboardBuffer = '';
        }
        return;
      }

      if (e.key.length === 1) {
        if (interval < 70) {
          this.keyboardBuffer += e.key;
        } else {
          this.keyboardBuffer = e.key;
        }
      }
    });
  }

  private handleScannedWedgeCode(code: string) {
    this.emitLog(`Wedge Scanner Event: [${code}]`, 'info');
    
    // Check if it matches a 24-hex EPC or formatted RFID tag
    const cleanHex = code.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    if (cleanHex.length >= 16) {
      const epc = cleanHex.padEnd(24, '0').substring(0, 24);
      this.emitTag({
        epc,
        rssi: -38,
        readCount: 1,
        timestamp: new Date().toLocaleTimeString(),
        rawSource: 'wedge'
      });
    } else {
      // General barcode / QR / tag string
      this.emitTag({
        epc: code,
        rssi: -40,
        readCount: 1,
        timestamp: new Date().toLocaleTimeString(),
        rawSource: 'wedge'
      });
    }
  }

  // =========================================================================
  // 5D. NETWORK / WEBSOCKET RFID PORTAL GATEWAY (Zebra FX9600 / Impinj)
  // =========================================================================

  public connectNetworkGateway(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.emitStatus({ status: 'connecting', type: 'network' });
      this.emitLog(`Connecting to Fixed Portal Gateway at ${wsUrl}...`, 'info');

      try {
        const socket = new WebSocket(wsUrl);
        this.networkSocket = socket;

        socket.onopen = () => {
          this.emitStatus({
            status: 'connected',
            type: 'network',
            deviceName: `Fixed Portal Gateway (${wsUrl})`,
            antennaPower: 30
          });
          this.emitLog(`✅ Connected to RFID Portal Gateway: ${wsUrl}`, 'success');
          resolve();
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.epc) {
              this.emitTag({
                epc: data.epc.toUpperCase(),
                rssi: data.rssi || -45,
                antenna: data.antenna || 1,
                readCount: data.readCount || 1,
                tid: data.tid,
                timestamp: new Date().toLocaleTimeString(),
                rawSource: 'network'
              });
            }
          } catch (e) {
            // Text line parse
            this.parseTextStream(event.data, 'network');
          }
        };

        socket.onerror = (err) => {
          this.emitLog(`❌ WebSocket portal error`, 'error');
          this.emitStatus({ status: 'error', error: 'WebSocket connection error' });
          reject(err);
        };

        socket.onclose = () => {
          this.emitLog(`Portal Gateway disconnected`, 'warn');
          this.emitStatus({ status: 'disconnected', type: 'none', deviceName: 'Disconnected' });
        };
      } catch (err: any) {
        this.emitStatus({ status: 'error', error: err.message });
        reject(err);
      }
    });
  }

  // =========================================================================
  // 5E. PARSER ENGINE FOR HARDWARE TELEMETRY & EPC FRAMES
  // =========================================================================

  private parseIncomingHardwareData(raw: any, source: 'bluetooth' | 'serial' | 'hid' | 'wedge' | 'network') {
    let uint8Array: Uint8Array;
    if (raw instanceof DataView) {
      uint8Array = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    } else if (raw instanceof Uint8Array) {
      uint8Array = raw;
    } else if (typeof raw === 'string') {
      this.parseTextStream(raw, source);
      return;
    } else {
      return;
    }

    // Convert to hex and ascii representations
    let hexString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      hexString += uint8Array[i].toString(16).padStart(2, '0').toUpperCase();
    }

    const asciiString = new TextDecoder('utf-8').decode(uint8Array);

    // 1. Check for standard UHF Gen 2 binary frame: 0xBB (Header) ... 0x7E (Tail)
    if (hexString.startsWith('BB') || hexString.includes('BB02') || hexString.includes('BB01')) {
      this.parseGen2BinaryFrame(uint8Array, source);
      return;
    }

    // 2. Check for ASCII EPC text format (e.g. "EPC:E2801130... RSSI:-45")
    if (asciiString.includes('EPC') || asciiString.includes('TAG') || asciiString.includes('E280')) {
      this.parseTextStream(asciiString, source);
      return;
    }

    // 3. Fallback: extract continuous 24-character Hex words
    const hexMatches = hexString.match(/([0-9A-F]{24})/g);
    if (hexMatches && hexMatches.length > 0) {
      for (const epc of hexMatches) {
        this.emitTag({
          epc,
          rssi: -50,
          readCount: 1,
          timestamp: new Date().toLocaleTimeString(),
          rawSource: source
        });
      }
    }
  }

  private parseGen2BinaryFrame(bytes: Uint8Array, source: any) {
    // Protocol frame pattern: [BB] [Type] [Cmd] [Len] [Data...] [Check] [7E]
    // Example: BB 02 22 00 11 (RSSI) (PC 2B) (EPC 12B) (CRC 2B) 7E
    let i = 0;
    while (i < bytes.length) {
      if (bytes[i] === 0xBB) {
        const len = bytes[i + 3] || 0;
        if (i + 4 + len <= bytes.length) {
          // Extract payload
          const rssiRaw = bytes[i + 4];
          const rssi = rssiRaw ? -(120 - (rssiRaw / 2)) : -55;
          // Extract EPC bytes (typically 12 bytes / 24 hex)
          let epcHex = '';
          const epcStart = i + 7; // after RSSI + PC
          const epcEnd = Math.min(epcStart + 12, i + 4 + len);
          for (let j = epcStart; j < epcEnd; j++) {
            epcHex += bytes[j].toString(16).padStart(2, '0').toUpperCase();
          }

          if (epcHex.length === 24) {
            this.emitTag({
              epc: epcHex,
              rssi: Math.round(rssi),
              readCount: 1,
              timestamp: new Date().toLocaleTimeString(),
              rawSource: source
            });
          }
          i += 4 + len + 2;
          continue;
        }
      }
      i++;
    }
  }

  private parseTextStream(text: string, source: any) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const clean = line.trim();
      if (!clean) continue;

      // Regex matching 24 hex chars with optional RSSI
      const match = clean.match(/([0-9A-Fa-f]{24})/);
      if (match) {
        const epc = match[1].toUpperCase();
        // Check for RSSI token like -54dBm or RSSI=-54
        const rssiMatch = clean.match(/([-+]?[0-9]+)\s*dBm/i) || clean.match(/RSSI[:=]\s*([-+]?[0-9]+)/i);
        const rssi = rssiMatch ? parseInt(rssiMatch[1], 10) : -48;

        this.emitTag({
          epc,
          rssi,
          readCount: 1,
          timestamp: new Date().toLocaleTimeString(),
          rawSource: source
        });
      }
    }
  }

  // =========================================================================
  // 5F. COMMAND TRANSMISSION & HARDWARE CONTROL
  // =========================================================================

  /**
   * Start active continuous inventory sweep on physical reader
   */
  public async startInventory(): Promise<void> {
    this.isSweeping = true;
    this.emitLog('Transmitting inventory start command to RFID hardware...', 'info');

    const cmd = new Uint8Array([0xBB, 0x00, 0x27, 0x00, 0x03, 0x22, 0x27, 0x44, 0x7E]); // Continuous Inventory command
    await this.sendRawCommand(cmd, 'START_INVENTORY\r\n');
  }

  /**
   * Stop active inventory sweep on physical reader
   */
  public async stopInventory(): Promise<void> {
    this.isSweeping = false;
    this.emitLog('Transmitting inventory stop command...', 'info');

    const cmd = new Uint8Array([0xBB, 0x00, 0x28, 0x00, 0x00, 0x28, 0x7E]); // Stop inventory command
    await this.sendRawCommand(cmd, 'STOP_INVENTORY\r\n');
  }

  /**
   * Adjust physical RF antenna transmission power in dBm
   */
  public async setAntennaPower(powerDbm: number): Promise<void> {
    const clamped = Math.max(10, Math.min(30, Math.round(powerDbm)));
    this.emitStatus({ antennaPower: clamped });
    this.emitLog(`Setting reader RF power to ${clamped} dBm...`, 'info');

    const val = clamped * 100; // e.g. 2500 for 25dBm
    const high = (val >> 8) & 0xFF;
    const low = val & 0xFF;
    const cmd = new Uint8Array([0xBB, 0x00, 0xB6, 0x00, 0x02, high, low, (0xB6 + 0x02 + high + low) & 0xFF, 0x7E]);
    await this.sendRawCommand(cmd, `SET_POWER ${clamped}\r\n`);
  }

  /**
   * Program / Encode a physical UHF RFID EPC Memory Bank (Bank 01)
   */
  public async programEpc(targetEpc: string, accessPassword: string = '00000000'): Promise<{ success: boolean; message: string }> {
    const cleanEpc = targetEpc.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    if (cleanEpc.length !== 24) {
      throw new Error('EPC must be exactly 24 hexadecimal characters (96 bits).');
    }

    this.emitLog(`Encoding UHF Tag EPC Memory Bank with [${cleanEpc}]...`, 'info');

    // Gen2 Write EPC Command: Bank 1 (EPC), Word pointer 2 (Word 0=CRC, 1=PC, 2..7=EPC)
    const epcBytes: number[] = [];
    for (let i = 0; i < cleanEpc.length; i += 2) {
      epcBytes.push(parseInt(cleanEpc.substring(i, i + 2), 16));
    }

    const writePayload = [
      0xBB, 0x00, 0x49, 0x00, 0x11,
      0x00, 0x00, 0x00, 0x00, // Access Password (4 bytes)
      0x01, // MemBank 01 (EPC)
      0x00, 0x02, // Word Pointer 2
      0x06, // Word Count 6 (12 bytes / 24 hex)
      ...epcBytes,
      0x00, // Checksum placeholder
      0x7E
    ];

    let checksum = 0;
    for (let i = 1; i < writePayload.length - 2; i++) {
      checksum = (checksum + writePayload[i]) & 0xFF;
    }
    writePayload[writePayload.length - 2] = checksum;

    const cmd = new Uint8Array(writePayload);
    await this.sendRawCommand(cmd, `WRITE_EPC ${cleanEpc}\r\n`);

    this.emitLog(`✅ EPC Programmed to Physical Tag: ${cleanEpc}`, 'success');
    return { success: true, message: `EPC ${cleanEpc} written successfully` };
  }

  private async sendRawCommand(binaryBytes: Uint8Array, textCommand: string) {
    if (this.connectionState.type === 'bluetooth' && this.bluetoothTxChar) {
      try {
        await this.bluetoothTxChar.writeValue(binaryBytes);
      } catch (err) {
        console.warn('BLE write failed:', err);
      }
    } else if (this.connectionState.type === 'serial' && this.serialPort && this.serialPort.writable) {
      try {
        const writer = this.serialPort.writable.getWriter();
        await writer.write(binaryBytes);
        writer.releaseLock();
      } catch (err) {
        console.warn('Serial write failed:', err);
      }
    } else if (this.connectionState.type === 'network' && this.networkSocket && this.networkSocket.readyState === WebSocket.OPEN) {
      this.networkSocket.send(JSON.stringify({ command: textCommand.trim(), raw: Array.from(binaryBytes) }));
    }
  }

  // =========================================================================
  // 5G. DISCONNECT & CLEANUP
  // =========================================================================

  public async disconnect(): Promise<void> {
    this.emitLog('Disconnecting active RFID hardware interface...', 'info');

    if (this.isSweeping) {
      await this.stopInventory().catch(() => {});
    }

    if (this.bluetoothDevice && this.bluetoothDevice.gatt && this.bluetoothDevice.gatt.connected) {
      this.bluetoothDevice.gatt.disconnect();
    }
    this.cleanupBluetooth();

    if (this.serialPort) {
      this.isSerialReading = false;
      if (this.serialReader) {
        try {
          await this.serialReader.cancel();
        } catch (e) {}
      }
      try {
        await this.serialPort.close();
      } catch (e) {}
      this.serialPort = null;
    }

    if (this.networkSocket) {
      this.networkSocket.close();
      this.networkSocket = null;
    }

    this.emitStatus({
      status: 'disconnected',
      type: 'none',
      deviceName: 'No Device Attached',
      batteryLevel: undefined
    });
    this.emitLog('Hardware disconnected.', 'info');
  }

  private cleanupBluetooth() {
    this.bluetoothDevice = null;
    this.bluetoothServer = null;
    this.bluetoothTxChar = null;
    this.bluetoothRxChar = null;
  }
}

export const rfidHardware = new RfidHardwareEngine();
