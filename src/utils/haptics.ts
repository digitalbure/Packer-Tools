/**
 * Packer Tools Haptic Feedback Utility (Vibration API)
 * Standardized tactile physical vibration routines for mobile UI interactions,
 * button presses, drag-and-drop column resizing, and QR/barcode scanning events.
 */

export const isHapticsSupported = (): boolean => {
  return typeof window !== 'undefined' && 'navigator' in window && typeof window.navigator.vibrate === 'function';
};

/**
 * Trigger custom vibration pattern safely
 */
export const triggerHaptic = (pattern: number | number[]): void => {
  if (isHapticsSupported()) {
    try {
      window.navigator.vibrate(pattern);
    } catch {
      // Safe fallback for restricted iframe or permissions
    }
  }
};

/**
 * Standard Light Tap (8-12ms)
 * Ideal for tab switches, icon toggles, navigation buttons, and small mobile controls.
 */
export const hapticLight = (): void => triggerHaptic(10);

/**
 * Standard Medium Impact (18-25ms)
 * Ideal for selection toggles, modal open triggers, filter changes, and checkbox clicks.
 */
export const hapticMedium = (): void => triggerHaptic(20);

/**
 * Heavy Impact (35-50ms)
 * Ideal for primary form submissions, destructive confirmations, status updates.
 */
export const hapticHeavy = (): void => triggerHaptic(40);

/**
 * Drag & Drop / Column Resize Tick (6-8ms)
 * Triggered on column resize handle dragging steps or item drag ticks.
 */
export const hapticResizeTick = (): void => triggerHaptic(8);

/**
 * Long Press Activation Pulse ([15, 20, 30]ms)
 * Triggered when a long press gesture activates drag mode, batch selection, or context menu.
 */
export const hapticLongPress = (): void => triggerHaptic([15, 20, 30]);

/**
 * Successful Scan Double Pulse ([20, 30, 20]ms)
 * Triggered on QR code, barcode, or NFC scan success.
 */
export const hapticScanSuccess = (): void => triggerHaptic([20, 30, 20]);

/**
 * Generic Success Pulse (15ms)
 * Triggered on quick action completion or item check-off.
 */
export const hapticSuccess = (): void => triggerHaptic(15);

/**
 * Error Warning Dual Pulse ([80, 40, 80]ms)
 * Triggered on scan errors, validation failures, or quota warnings.
 */
export const hapticError = (): void => triggerHaptic([80, 40, 80]);
