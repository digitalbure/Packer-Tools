import { GearItem, BatteryLog, BatteryHealthStatus, BatteryChemistry } from '../types';

export interface BatteryChemistryProfile {
  name: string;
  nominalVoltage: number;
  maxVoltage: number;
  minVoltage: number;
  typicalMaxCycles: number;
  criticalResistanceMOhms: number;
  warningResistanceMOhms: number;
  description: string;
}

export const CHEMISTRY_PROFILES: Record<string, BatteryChemistryProfile> = {
  'V-Mount': {
    name: 'V-Mount Broadcast Li-ion',
    nominalVoltage: 14.8,
    maxVoltage: 16.8,
    minVoltage: 11.0,
    typicalMaxCycles: 500,
    warningResistanceMOhms: 120,
    criticalResistanceMOhms: 180,
    description: 'High-draw cinema camera and LED light standard',
  },
  'Gold-Mount': {
    name: 'Gold-Mount (Anton Bauer)',
    nominalVoltage: 14.4,
    maxVoltage: 16.8,
    minVoltage: 11.0,
    typicalMaxCycles: 500,
    warningResistanceMOhms: 120,
    criticalResistanceMOhms: 180,
    description: 'Studio standard with secure three-stud locking',
  },
  'B-Mount': {
    name: 'B-Mount High-Voltage',
    nominalVoltage: 28.8,
    maxVoltage: 33.6,
    minVoltage: 22.0,
    typicalMaxCycles: 600,
    warningResistanceMOhms: 90,
    criticalResistanceMOhms: 140,
    description: 'Modern 24V/28V standard for ARRI Alexa 35 & high-power rigs',
  },
  'NP-F': {
    name: 'Sony L-Series / NP-F',
    nominalVoltage: 7.4,
    maxVoltage: 8.4,
    minVoltage: 6.0,
    typicalMaxCycles: 400,
    warningResistanceMOhms: 180,
    criticalResistanceMOhms: 250,
    description: 'Standard for wireless video, field monitors, and small LED lights',
  },
  'BP-U': {
    name: 'Sony BP-U Series',
    nominalVoltage: 14.4,
    maxVoltage: 16.8,
    minVoltage: 11.0,
    typicalMaxCycles: 500,
    warningResistanceMOhms: 130,
    criticalResistanceMOhms: 190,
    description: 'Standard for Sony FX6, FX9, and broadcast camcorders',
  },
  'Li-ion': {
    name: 'Standard Lithium-Ion',
    nominalVoltage: 14.8,
    maxVoltage: 16.8,
    minVoltage: 10.8,
    typicalMaxCycles: 400,
    warningResistanceMOhms: 150,
    criticalResistanceMOhms: 220,
    description: 'Universal cylindrical or prismatic lithium cells',
  },
  'LiPo': {
    name: 'Lithium Polymer (LiPo)',
    nominalVoltage: 14.8,
    maxVoltage: 16.8,
    minVoltage: 13.0,
    typicalMaxCycles: 250,
    warningResistanceMOhms: 30,
    criticalResistanceMOhms: 60,
    description: 'Extreme burst discharge rate cells for drones and gimbals',
  },
  'LiFePO4': {
    name: 'Lithium Iron Phosphate',
    nominalVoltage: 12.8,
    maxVoltage: 14.6,
    minVoltage: 10.0,
    typicalMaxCycles: 2000,
    warningResistanceMOhms: 80,
    criticalResistanceMOhms: 130,
    description: 'Ultra-durable, thermally safe power station chemistry',
  },
  'NiMH': {
    name: 'Nickel-Metal Hydride',
    nominalVoltage: 1.2,
    maxVoltage: 1.45,
    minVoltage: 0.9,
    typicalMaxCycles: 500,
    warningResistanceMOhms: 250,
    criticalResistanceMOhms: 400,
    description: 'Rechargeable AA/AAA cells for audio transmitters and flashes',
  },
  'Lead-Acid': {
    name: 'Sealed Lead Acid (SLA)',
    nominalVoltage: 12.0,
    maxVoltage: 13.8,
    minVoltage: 10.5,
    typicalMaxCycles: 300,
    warningResistanceMOhms: 50,
    criticalResistanceMOhms: 100,
    description: 'Heavy duty inverter and UPS battery backup',
  },
  'Other': {
    name: 'Custom / Other Chemistry',
    nominalVoltage: 14.4,
    maxVoltage: 16.8,
    minVoltage: 10.0,
    typicalMaxCycles: 400,
    warningResistanceMOhms: 150,
    criticalResistanceMOhms: 220,
    description: 'Generic secondary rechargeable battery',
  }
};

/**
 * Calculates Watt-hours (Wh) from mAh and Voltage or direct Wh.
 */
export function calculateWh(capacityMah?: number, voltage?: number, capacityWh?: number): number {
  if (capacityWh && capacityWh > 0) {
    return Number(capacityWh.toFixed(1));
  }
  if (capacityMah && capacityMah > 0 && voltage && voltage > 0) {
    return Number(((capacityMah * voltage) / 1000).toFixed(1));
  }
  return 0;
}

/**
 * Determines whether a gear asset should be tracked as a battery.
 */
export function isBatteryAsset(item: Partial<GearItem>): boolean {
  if (item.isBattery === true) return true;
  
  const text = `${item.name || ''} ${item.primaryCategory || ''} ${item.category || ''} ${item.brand || ''} ${item.model || ''}`.toLowerCase();
  
  const batteryKeywords = [
    'battery', 'batteries', 'v-mount', 'v mount', 'gold-mount', 'gold mount', 
    'b-mount', 'b mount', 'np-f', 'np-fz100', 'en-el15', 'lp-e6', 'bp-u', 
    'lipo', 'power station', 'powerbank', 'power bank', 'wh pack', 'mah pack'
  ];
  
  return batteryKeywords.some(kw => text.includes(kw));
}

/**
 * Evaluates State of Health (SOH) and determines categorical status.
 */
export function determineHealthStatus(
  healthPercentage: number = 100,
  cycleCount: number = 0,
  maxCycles: number = 400,
  internalResistanceMOhms?: number,
  chemistry?: string
): BatteryHealthStatus {
  // Check critical internal resistance
  const profile = chemistry ? CHEMISTRY_PROFILES[chemistry] : undefined;
  if (internalResistanceMOhms && profile && internalResistanceMOhms >= profile.criticalResistanceMOhms) {
    return 'critical';
  }

  // Calculate cycle wear ratio
  const safeMaxCycles = maxCycles > 0 ? maxCycles : 400;
  const cycleRatio = cycleCount / safeMaxCycles;

  if (healthPercentage >= 90 && cycleRatio < 0.7) {
    return 'excellent';
  }
  if (healthPercentage >= 80 && cycleRatio < 0.95) {
    return 'good';
  }
  if (healthPercentage >= 65 || cycleRatio < 1.15) {
    return 'degraded';
  }
  if (healthPercentage >= 50 || cycleRatio < 1.35) {
    return 'replace_soon';
  }
  return 'critical';
}

/**
 * Estimates degradation State of Health (SOH) based on cycle life if no lab test capacity is available.
 */
export function estimateDegradationSOH(
  cycleCount: number = 0,
  maxCycles: number = 400
): number {
  if (cycleCount <= 0) return 100;
  const safeMax = maxCycles > 0 ? maxCycles : 400;
  
  // Standard lithium degradation model: ~20% capacity loss at 100% rated cycles
  // Quadratic taper as cycles exceed rated life
  const progress = cycleCount / safeMax;
  if (progress <= 1.0) {
    // Linear drop from 100% to 80%
    const est = 100 - (progress * 20);
    return Math.max(50, Math.round(est));
  } else {
    // Accelerated drop after 100% cycles: 80% down to 30%
    const extra = progress - 1.0;
    const est = 80 - (extra * 40);
    return Math.max(10, Math.round(est));
  }
}

export interface FlightComplianceInfo {
  compliance: 'unrestricted' | 'airline_approval' | 'cargo_only' | 'hazardous';
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  summary: string;
  details: string;
  airlineRule: string;
}

/**
 * IATA / FAA Passenger Aircraft Lithium Battery Regulation Evaluator
 */
export function getFlightCompliance(wattHours: number): FlightComplianceInfo {
  if (wattHours <= 0) {
    return {
      compliance: 'unrestricted',
      label: 'Rating Pending',
      badgeBg: 'bg-neutral-100 dark:bg-neutral-800',
      badgeText: 'text-neutral-700 dark:text-neutral-300',
      badgeBorder: 'border-neutral-300 dark:border-neutral-700',
      summary: 'Watt-hour rating required for flight assessment',
      details: 'Inspect manufacturer label for nominal voltage & mAh capacity.',
      airlineRule: 'Provide Wh rating to verify airline clearance.'
    };
  }

  if (wattHours <= 100) {
    return {
      compliance: 'unrestricted',
      label: 'FAA/IATA ≤100Wh Clear',
      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      badgeBorder: 'border-emerald-500/30',
      summary: 'Unrestricted Carry-On Luggage Approved',
      details: 'Permitted in passenger cabin carry-on baggage. Most airlines allow up to 20 individual units.',
      airlineRule: 'Never place in checked luggage. Must be in carry-on with terminal protection.'
    };
  }

  if (wattHours <= 160) {
    return {
      compliance: 'airline_approval',
      label: '101Wh–160Wh Special Approval',
      badgeBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      badgeText: 'text-amber-700 dark:text-amber-300',
      badgeBorder: 'border-amber-500/30',
      summary: 'Passenger Carry-On (Limit 2 with Operator Approval)',
      details: 'Strict limit of max 2 spare batteries per passenger between 101Wh and 160Wh. Must declare at airline check-in.',
      airlineRule: 'Strictly prohibited in checked luggage. Carry-on only, terminals insulated.'
    };
  }

  return {
    compliance: 'cargo_only',
    label: '>160Wh Cargo Freight Only',
    badgeBg: 'bg-rose-500/10 dark:bg-rose-500/20',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-500/30',
    summary: 'Prohibited on Passenger Flights (Class 9 Dangerous Goods)',
    details: 'Exceeds passenger aviation safety ceilings. Must be shipped via certified air/ground cargo freight.',
    airlineRule: 'Strictly forbidden on passenger aircraft under IATA Section II.'
  };
}

/**
 * Calculates runtime under specific workload factoring SOH.
 */
export function estimateRuntime(
  ratedWh: number,
  healthPercentage: number = 100,
  loadWatts: number = 45
): { hours: number; minutes: number; formatted: string } {
  if (ratedWh <= 0 || loadWatts <= 0) {
    return { hours: 0, minutes: 0, formatted: '0m' };
  }
  
  // Real usable capacity is rated * health% * 0.90 (inverter/converter efficiency factor)
  const usableWh = ratedWh * (Math.max(10, healthPercentage) / 100) * 0.90;
  const totalHours = usableWh / loadWatts;
  
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  
  const formatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return { hours, minutes, formatted };
}

export interface StatusBadgeTheme {
  label: string;
  bg: string;
  text: string;
  border: string;
  fillBar: string;
  actionText: string;
  indicator: string;
}

export function getBatteryStatusTheme(status: BatteryHealthStatus): StatusBadgeTheme {
  switch (status) {
    case 'excellent':
      return {
        label: 'Optimal (90%+)',
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-500/30',
        fillBar: 'bg-emerald-500',
        actionText: 'Ready for peak mission-critical deployment',
        indicator: 'bg-emerald-500',
      };
    case 'good':
      return {
        label: 'Good (80-89%)',
        bg: 'bg-teal-500/10 dark:bg-teal-500/20',
        text: 'text-teal-700 dark:text-teal-400',
        border: 'border-teal-500/30',
        fillBar: 'bg-teal-500',
        actionText: 'Standard field rotation ready',
        indicator: 'bg-teal-500',
      };
    case 'degraded':
      return {
        label: 'Degraded (65-79%)',
        bg: 'bg-amber-500/10 dark:bg-amber-500/20',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-500/30',
        fillBar: 'bg-amber-500',
        actionText: 'Use for secondary accessories / non-critical rigs',
        indicator: 'bg-amber-500',
      };
    case 'replace_soon':
      return {
        label: 'Replace Soon (50-64%)',
        bg: 'bg-orange-500/10 dark:bg-orange-500/20',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-500/30',
        fillBar: 'bg-orange-500',
        actionText: 'Order replacement cell soon; discharge slope is steep',
        indicator: 'bg-orange-500',
      };
    case 'critical':
    default:
      return {
        label: 'Critical (<50%)',
        bg: 'bg-rose-500/10 dark:bg-rose-500/20',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-500/30',
        fillBar: 'bg-rose-500',
        actionText: 'Retire or send for certified re-celling',
        indicator: 'bg-rose-500',
      };
  }
}
