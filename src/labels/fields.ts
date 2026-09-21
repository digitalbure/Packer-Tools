/** What can go in a text or code box. Shown as a dropdown in the editor; "Customize" lets people type their own. */
export interface FieldOption { label: string; value: string; group: 'Item' | 'Owner' | 'Fixed text' }

export const FIELD_OPTIONS: FieldOption[] = [
  { group: 'Item', label: 'Item name', value: '{{asset.name}}' },
  { group: 'Item', label: 'Asset tag', value: '{{asset.assetTag}}' },
  { group: 'Item', label: 'Brand', value: '{{asset.brand}}' },
  { group: 'Item', label: 'Model', value: '{{asset.model}}' },
  { group: 'Item', label: 'Serial number', value: '{{asset.serial}}' },
  { group: 'Item', label: 'Category', value: '{{asset.category}}' },
  { group: 'Item', label: 'Link to the item page', value: '{{asset.url}}' },
  { group: 'Owner', label: 'Owner name', value: '{{owner.name}}' },
  { group: 'Owner', label: 'Owner phone', value: '{{owner.phone}}' },
  { group: 'Owner', label: 'Owner email', value: '{{owner.email}}' },
  { group: 'Fixed text', label: 'PROPERTY OF', value: 'PROPERTY OF' },
  { group: 'Fixed text', label: 'IF FOUND, RETURN TO', value: 'IF FOUND, RETURN TO' },
  { group: 'Fixed text', label: 'DO NOT REMOVE', value: 'DO NOT REMOVE' },
  { group: 'Fixed text', label: 'FRAGILE', value: 'FRAGILE' },
];

export const labelForValue = (value: string) => FIELD_OPTIONS.find(o => o.value === value)?.label;
