import type { AssetData } from './model';

/**
 * Picks the best starter label for an item from its category and name, so a person can select gear and print
 * without choosing a layout. Anything unclear gets the general "Property of" tag.
 */
export function recommendTemplateId(asset: Pick<AssetData, 'category' | 'name' | 'ownerName'>): string {
  const t = `${asset.category ?? ''} ${asset.name ?? ''}`.toLowerCase();
  const has = (...w: string[]) => w.some(x => new RegExp(`\\b${x}`).test(t));
  if (has('flight case', 'road case', 'rack case')) return 'starter-flight-100x150';
  if (has('cable', 'lead', 'cord', 'xlr', 'hdmi', 'sdi', 'extension', 'loom')) return 'starter-cable-25x38';
  if (has('case', 'pelican', 'nanuk', 'bag', 'backpack', 'bin', 'box', 'trolley')) return 'starter-case-76x51';
  if (has('battery', 'batteries', 'charger', 'card', 'adapter', 'filter', 'cap', 'plate', 'clamp')) return 'starter-small-30x22';
  return asset.ownerName ? 'starter-property-50x30' : 'starter-asset-50x30';
}
