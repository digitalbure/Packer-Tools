import { PRESET_STUDIO_TEMPLATES, StudioTemplate } from '../components/QRPrintModal';

export interface LabelRecommendation {
  suggestedTemplateId: string;
  recommendedPrinterType: string;
  recommendedMaterial: string;
  justification: string;
  labelDimensions: { width: number; height: number; unit: string };
  recommendedAveryTemplateId: string;
  durabilityRating: 'Standard' | 'Medium Duty' | 'High Durability' | 'Extreme Duty';
  printSettings: {
    darkness: number; // 1-30 scale
    speed: number; // inches per sec
    resolution: string; // "203 dpi" | "300 dpi" | "600 dpi"
    printMethod: 'Direct Thermal' | 'Thermal Transfer';
  };
}

/**
 * Service to analyze item names/categories and dynamically match them
 * to the most appropriate printer label templates and print specifications.
 */
export const getLabelRecommendation = (
  itemName: string,
  category: string,
  options?: { brand?: string; model?: string }
): LabelRecommendation => {
  const nameLower = (itemName || '').toLowerCase();
  const catLower = (category || '').toLowerCase();
  const brandLower = (options?.brand || '').toLowerCase();

  // 1. CABLES, XLR, SDI, WIRE, CORDS
  if (
    nameLower.includes('cable') || nameLower.includes('sdi') || nameLower.includes('xlr') || 
    nameLower.includes('wire') || nameLower.includes('lead') || nameLower.includes('cord') || 
    nameLower.includes('d-tap') || nameLower.includes('interconnect') || nameLower.includes('jumper') ||
    catLower.includes('cable') || catLower.includes('wire') || catLower.includes('cord')
  ) {
    return {
      suggestedTemplateId: 'tpl_cable_wrap',
      recommendedPrinterType: 'Industrial Cable-Tag Printer (e.g. Brother PTE550W / DYMO XTL)',
      recommendedMaterial: 'Self-Laminating Flexible Vinyl (Waterproof, UV-Resistant)',
      justification: 'Flexible self-laminating vinyl protects the printed thermal barcode wrap under a clear plastic shield layer, crucial for high-friction cable coiling, dynamic pulling, and outdoor field deployment.',
      labelDimensions: { width: 75, height: 15, unit: 'mm' },
      recommendedAveryTemplateId: 'avery5161',
      durabilityRating: 'High Durability',
      printSettings: {
        darkness: 18,
        speed: 2,
        resolution: '300 dpi',
        printMethod: 'Thermal Transfer'
      }
    };
  }

  // 2. RACK MOUNT EQUIPMENT, SERVERS, SWITCHES, ROUTERS
  if (
    nameLower.includes('rack') || nameLower.includes('server') || nameLower.includes('switch') || 
    nameLower.includes('router') || nameLower.includes('patch panel') || nameLower.includes('pdu') ||
    catLower.includes('rack') || catLower.includes('networking') || catLower.includes('server') ||
    catLower.includes('rack-mount') || catLower.includes('racking')
  ) {
    return {
      suggestedTemplateId: 'tpl_rack_mount_tag',
      recommendedPrinterType: 'High-Resolution Industrial Labeler (e.g. Zebra ZT411)',
      recommendedMaterial: 'Aggressive-Adhesive Metalized Polyester / Silver Matte Poly',
      justification: 'Ultra-thin, high-adhesion metalized film resists high server rack operating temperatures (up to 150°C), prevents edge curling in tight equipment clearances, and guarantees high-contrast barcode reads under dense server racking.',
      labelDimensions: { width: 90, height: 12, unit: 'mm' },
      recommendedAveryTemplateId: 'avery5162',
      durabilityRating: 'Extreme Duty',
      printSettings: {
        darkness: 24,
        speed: 3,
        resolution: '600 dpi',
        printMethod: 'Thermal Transfer'
      }
    };
  }

  // 3. FLIGHT CASES, PELICAN, BOXES, CONTAINERS, CRATES
  if (
    nameLower.includes('case') || nameLower.includes('pelican') || nameLower.includes('flight') || 
    nameLower.includes('box') || nameLower.includes('kit') || nameLower.includes('bag') || 
    nameLower.includes('chest') || nameLower.includes('container') || nameLower.includes('trunk') ||
    catLower.includes('case') || catLower.includes('bag') || catLower.includes('box') || catLower.includes('luggage')
  ) {
    return {
      suggestedTemplateId: 'tpl_pelican_case',
      recommendedPrinterType: 'Heavy-Duty Wide Format Desktop Printer (e.g. Brother QL-1100)',
      recommendedMaterial: 'Ultra-Rugged Premium Polycarbonate Plate or Heavy-Duty Coated Matte Vinyl',
      justification: 'Flight cases are subjected to extreme impact, moisture, scraping, and chemical exposure in transport. A large, thick polyplate with heavy-duty backing adhesive ensures long-term readability on rough case shells.',
      labelDimensions: { width: 100, height: 50, unit: 'mm' },
      recommendedAveryTemplateId: 'avery5163',
      durabilityRating: 'Extreme Duty',
      printSettings: {
        darkness: 22,
        speed: 4,
        resolution: '300 dpi',
        printMethod: 'Direct Thermal'
      }
    };
  }

  // 4. BATTERIES, CHARGERS, CELLS, GOLD/V-MOUNT UNITS
  if (
    nameLower.includes('battery') || nameLower.includes('power') || nameLower.includes('v-mount') || 
    nameLower.includes('gold-mount') || nameLower.includes('charger') || nameLower.includes('cell') ||
    nameLower.includes('ups') || nameLower.includes('accumulator') ||
    catLower.includes('battery') || catLower.includes('power') || catLower.includes('energy')
  ) {
    return {
      suggestedTemplateId: 'tpl_battery_tag',
      recommendedPrinterType: 'Precision Desktop Barcode Printer (e.g. Zebra ZD620)',
      recommendedMaterial: 'Heat-Resistant Chemical-Shield Synthetic Polyester',
      justification: 'Batteries experience localized thermal cycling during fast charging and occasional chemical off-gassing. Heat-stabilized synthetic polyester prevents label shrinkage, ink fading, and chemical degradation.',
      labelDimensions: { width: 45, height: 45, unit: 'mm' },
      recommendedAveryTemplateId: 'averyL7160',
      durabilityRating: 'High Durability',
      printSettings: {
        darkness: 20,
        speed: 3,
        resolution: '300 dpi',
        printMethod: 'Thermal Transfer'
      }
    };
  }

  // 5. SMALL ELECTRONICS, SENSORS, MICROPHONES, LENSES, ADAPTERS, HARDWARE
  if (
    nameLower.includes('sensor') || nameLower.includes('mic') || nameLower.includes('lens') || 
    nameLower.includes('adapter') || nameLower.includes('dongle') || nameLower.includes('reader') ||
    nameLower.includes('card') || nameLower.includes('module') || nameLower.includes('gopro') ||
    nameLower.includes('audio') || nameLower.includes('video') || nameLower.includes('converter') ||
    catLower.includes('electronics') || catLower.includes('sensor') || catLower.includes('mic') ||
    catLower.includes('audio') || catLower.includes('lens') || catLower.includes('small') ||
    catLower.includes('accessory') || catLower.includes('component')
  ) {
    return {
      suggestedTemplateId: 'tpl_small_electronics_thermal',
      recommendedPrinterType: 'Micro-Label Specialty Printer (e.g. Brady BMP61 / Zebra ZD621t)',
      recommendedMaterial: 'High-Res High-Density Thermal Gloss Polyester (Small Footprint)',
      justification: 'Small-footprint electronic devices require ultra-high print density (600 DPI) for tiny QR code resolution (down to 5mm). Aggressive non-conductive adhesives ensure no signal interference and no peel-off from warm chassis.',
      labelDimensions: { width: 35, height: 15, unit: 'mm' },
      recommendedAveryTemplateId: 'avery5160',
      durabilityRating: 'Medium Duty',
      printSettings: {
        darkness: 16,
        speed: 2,
        resolution: '600 dpi',
        printMethod: 'Thermal Transfer'
      }
    };
  }

  // 6. DEFAULT GENERAL ASSETS (CAMERAS, MONITORS, LIGHTS, TRIPODS, RIGS, OTHER)
  return {
    suggestedTemplateId: 'tpl_asset_tag',
    recommendedPrinterType: 'Standard Desktop Thermal Transfer Printer (e.g. TSC TX210)',
    recommendedMaterial: 'Premium Gloss White Polyester with Resin Ribbon backing',
    justification: 'Standard gloss polyester with high-performance acrylic adhesive provides a perfect balance of scratch resistance, cost efficiency, and clean-removability for primary production rigs, lighting, and camera bodies.',
    labelDimensions: { width: 60, height: 30, unit: 'mm' },
    recommendedAveryTemplateId: 'avery5160',
    durabilityRating: 'Medium Duty',
    printSettings: {
      darkness: 15,
      speed: 4,
      resolution: '300 dpi',
      printMethod: 'Thermal Transfer'
    }
  };
};
