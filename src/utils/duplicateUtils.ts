import { GearItem } from '../types';

/**
 * Generates an intelligent duplicate name with auto-incrementing numbers or copy suffixes.
 * Handles existing formats like:
 * - "Camera" -> "Camera [#2]"
 * - "Camera [#2]" -> "Camera [#3]"
 * - "Camera #1" -> "Camera #2"
 * - "Camera (Copy 1)" -> "Camera (Copy 2)"
 */
export function generateDuplicateName(
  originalName: string,
  copyIndex?: number,
  existingNames: string[] = []
): string {
  const cleanName = (originalName || 'Untitled Item').trim();

  // If a specific copyIndex is supplied (e.g. for batch cloning index 2, 3, 4)
  if (copyIndex !== undefined && copyIndex > 1) {
    // Check if name already has a suffix like [#N] or #N or (Copy N)
    const bracketMatch = cleanName.match(/^(.*?)\s*\[#(\d+)\]$/);
    const hashMatch = cleanName.match(/^(.*?)\s*#(\d+)$/);
    const copyMatch = cleanName.match(/^(.*?)\s*\(Copy\s*(\d+)\)$/i);

    let baseName = cleanName;
    if (bracketMatch) baseName = bracketMatch[1].trim();
    else if (hashMatch) baseName = hashMatch[1].trim();
    else if (copyMatch) baseName = copyMatch[1].trim();

    return `${baseName} [#${copyIndex}]`;
  }

  // Single duplicate logic: inspect original name pattern
  const bracketMatch = cleanName.match(/^(.*?)\s*\[#(\d+)\]$/);
  const hashMatch = cleanName.match(/^(.*?)\s*#(\d+)$/);
  const copyMatch = cleanName.match(/^(.*?)\s*\(Copy\s*(\d+)\)$/i);

  if (bracketMatch) {
    const baseName = bracketMatch[1].trim();
    const currentNum = parseInt(bracketMatch[2], 10) || 1;
    let nextNum = currentNum + 1;
    let candidate = `${baseName} [#${nextNum}]`;
    while (existingNames.some(n => n.toLowerCase() === candidate.toLowerCase())) {
      nextNum++;
      candidate = `${baseName} [#${nextNum}]`;
    }
    return candidate;
  }

  if (hashMatch) {
    const baseName = hashMatch[1].trim();
    const currentNum = parseInt(hashMatch[2], 10) || 1;
    let nextNum = currentNum + 1;
    let candidate = `${baseName} [#${nextNum}]`;
    while (existingNames.some(n => n.toLowerCase() === candidate.toLowerCase())) {
      nextNum++;
      candidate = `${baseName} [#${nextNum}]`;
    }
    return candidate;
  }

  if (copyMatch) {
    const baseName = copyMatch[1].trim();
    const currentNum = parseInt(copyMatch[2], 10) || 1;
    let nextNum = currentNum + 1;
    let candidate = `${baseName} (Copy ${nextNum})`;
    while (existingNames.some(n => n.toLowerCase() === candidate.toLowerCase())) {
      nextNum++;
      candidate = `${baseName} (Copy ${nextNum})`;
    }
    return candidate;
  }

  // Base name without existing numeric suffix
  let candidate = `${cleanName} [#2]`;
  if (existingNames.some(n => n.toLowerCase() === candidate.toLowerCase())) {
    let nextNum = 3;
    candidate = `${cleanName} [#${nextNum}]`;
    while (existingNames.some(n => n.toLowerCase() === candidate.toLowerCase())) {
      nextNum++;
      candidate = `${cleanName} [#${nextNum}]`;
    }
  }
  return candidate;
}

/**
 * Generates a unique, non-colliding Asset Tag code.
 */
export function generateDuplicateAssetTag(
  originalTag?: string,
  existingTags: string[] = []
): string {
  const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();

  if (originalTag && originalTag.trim()) {
    const tagMatch = originalTag.trim().match(/^(.*?)-?(\d+)$/);
    if (tagMatch) {
      const prefix = tagMatch[1];
      let num = parseInt(tagMatch[2], 10) + 1;
      let candidate = `${prefix}-${num}`;
      while (existingTags.includes(candidate)) {
        num++;
        candidate = `${prefix}-${num}`;
      }
      return candidate;
    }
    // Prefix with original tag base or random
    const cleanTag = originalTag.trim().replace(/\s+/g, '-').toUpperCase();
    let candidate = `${cleanTag}-${randSuffix}`;
    while (existingTags.includes(candidate)) {
      const newSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      candidate = `${cleanTag}-${newSuffix}`;
    }
    return candidate;
  }

  let candidate = `TAG-${randSuffix}`;
  while (existingTags.includes(candidate)) {
    const newSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    candidate = `TAG-${newSuffix}`;
  }
  return candidate;
}

export interface DuplicateOptions {
  copyCount?: number;
  resetStatus?: boolean;
  clearSerial?: boolean;
  clearAssignment?: boolean;
  copyIndex?: number;
  existingNames?: string[];
  existingTags?: string[];
  namingFormat?: 'bracket' | 'copy' | 'custom';
  customPrefix?: string;
}

/**
 * Creates a cloned payload for a GearItem ready to write to Firestore.
 */
export function cloneGearItemData(
  item: GearItem,
  options: DuplicateOptions = {}
): Omit<GearItem, 'id'> {
  const {
    resetStatus = true,
    clearSerial = true,
    clearAssignment = false,
    copyIndex = 2,
    existingNames = [],
    existingTags = [],
    namingFormat = 'bracket',
  } = options;

  let newName = generateDuplicateName(item.name, copyIndex, existingNames);
  if (namingFormat === 'copy') {
    const base = item.name.replace(/\s*\[#\d+\]|\s*\(Copy\s*\d+\)/gi, '').trim();
    newName = `${base} (Copy ${copyIndex})`;
  }

  const newAssetTag = generateDuplicateAssetTag(item.assetTag, existingTags);
  const now = new Date().toISOString();

  // Strip id and offline pending metadata
  const { id, isOfflinePending, offlineOpId, ...baseData } = item;

  return {
    ...baseData,
    name: newName,
    assetTag: newAssetTag,
    serialNumber: clearSerial ? '' : (item.serialNumber ? `${item.serialNumber}-COPY` : ''),
    status: resetStatus ? 'available' : (item.status || 'available'),
    assignedTo: clearAssignment ? undefined : item.assignedTo,
    currentHolder: clearAssignment ? undefined : item.currentHolder,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    // Duplicate child addOns safely with new itemIds if present
    addOns: item.addOns ? item.addOns.map(addon => ({
      ...addon,
      itemId: addon.itemId ? `${addon.itemId}-dup` : undefined
    })) : undefined
  };
}
