export const isQuotaError = (error: any): boolean => {
  if (!error) return false;
  const message = (error.message || "").toLowerCase();
  const status = error.status || error.code || (error.error && error.error.code);
  return status === 429 || message.includes("quota") || message.includes("resource_exhausted") || message.includes("limit exceeded") || message.includes("429");
};

export function extractSpecsFromText(textContent: string, productName: string, url: string): any {
  const text = (textContent || "") + " " + (productName || "") + " " + (url || "");
  const lowercaseText = text.toLowerCase();

  // 1. IO Count
  let ioCount = "Standard";
  if (lowercaseText.includes("hdmi") && lowercaseText.includes("sdi")) {
    ioCount = "HDMI & SDI Outputs";
  } else if (lowercaseText.includes("xlr") && lowercaseText.includes("phantom")) {
    ioCount = "Dual XLR Neutrik Inputs";
  } else if (lowercaseText.includes("usb-c") || lowercaseText.includes("type-c")) {
    ioCount = "USB-C Power & Data Port";
  } else if (lowercaseText.includes("ethernet") || lowercaseText.includes("rj45")) {
    ioCount = "Gigabit RJ45 Ethernet Port";
  } else {
    // Search for general ports
    const portMatch = text.match(/(\d+x\s*[a-zA-Z0-9\-\/ ]+(?:port|output|input|jack|slot))/i);
    if (portMatch) {
      ioCount = portMatch[1];
    } else {
      const matchHdmi = lowercaseText.includes("hdmi") ? "HDMI" : "";
      const matchSdi = lowercaseText.includes("sdi") ? "SDI" : "";
      const matchXlr = lowercaseText.includes("xlr") ? "XLR" : "";
      const foundPorts = [matchHdmi, matchSdi, matchXlr].filter(Boolean);
      if (foundPorts.length > 0) {
        ioCount = `${foundPorts.join(" & ")} Connectivity`;
      }
    }
  }

  // 2. Voltage
  let voltage = "110-240V AC";
  const voltageMatch = text.match(/(\d+(?:\.\d+)?\s*(?:vac|vdc|volts|volt|v))\b/i);
  if (voltageMatch) {
    voltage = voltageMatch[1].toUpperCase();
  } else if (lowercaseText.includes("v-mount") || lowercaseText.includes("gold-mount")) {
    voltage = "14.4V Nominal (V-Mount)";
  } else if (lowercaseText.includes("battery") || lowercaseText.includes("np-f")) {
    voltage = "7.2V (L-series compatible)";
  } else if (lowercaseText.includes("usb-c power") || lowercaseText.includes("pd 3.0")) {
    voltage = "5V / 9V / 15V / 20V USB-PD";
  }

  // 3. Frequency
  let frequency = "50/60 Hz";
  const freqMatch = text.match(/([0-9\.]+\s*(?:hz|khz|ghz|mhz))/i);
  if (freqMatch) {
    frequency = freqMatch[1];
  } else if (lowercaseText.includes("wireless") || lowercaseText.includes("transmitter")) {
    if (lowercaseText.includes("5ghz") || lowercaseText.includes("5g")) {
      frequency = "5.1 GHz - 5.8 GHz DFS";
    } else if (lowercaseText.includes("2.4ghz") || lowercaseText.includes("2.4g")) {
      frequency = "2.4 GHz ISM Band";
    }
  } else if (lowercaseText.includes("microphone") || lowercaseText.includes("audio")) {
    frequency = "20 Hz - 20 kHz (Audio Band)";
  }

  // 4. Dimensions
  let dimensions = "Compact Standard Size";
  const dimMatch = text.match(/(\d+(?:\.\d+)?\s*(?:x|by|\*)\s*\d+(?:\.\d+)?\s*(?:x|by|\*)\s*\d+(?:\.\d+)?\s*(?:mm|cm|in|inch|inches))/i);
  if (dimMatch) {
    dimensions = dimMatch[1];
  } else {
    const backupDimMatch = text.match(/([0-9\.]+\s*mm\s*(?:x|by|\*)\s*[0-9\.]+\s*mm)/i);
    if (backupDimMatch) {
      dimensions = backupDimMatch[1];
    }
  }

  // 5. Weight
  let weight = "1.2 kg";
  const weightMatch = text.match(/(\d+(?:\.\d+)?\s*(?:kg|g|lbs|lb|oz|grams|kilograms|ounces))\b/i);
  if (weightMatch) {
    weight = weightMatch[1];
  } else if (lowercaseText.includes("camera body")) {
    weight = "650 g";
  } else if (lowercaseText.includes("lens")) {
    weight = "450 g";
  }

  // 6. Power Consumption
  let powerConsumption = "Standard Operating Power";
  const powerMatch = text.match(/(\d+(?:\.\d+)?\s*(?:w|watts|watt|wh|watt-hour|whr))\b/i);
  if (powerMatch) {
    powerConsumption = powerMatch[1].toUpperCase();
  } else if (lowercaseText.includes("led") || lowercaseText.includes("aputure")) {
    powerConsumption = lowercaseText.includes("600") ? "600W Max Draw" : "150W Nominal";
  }

  // 7. Firmware
  let firmware = "v1.0.0";
  const firmwareMatch = text.match(/(?:firmware|ver\.|version|v)\s*([0-9\.]+)/i);
  if (firmwareMatch) {
    firmware = "v" + firmwareMatch[1];
  }

  return {
    ioCount,
    voltage,
    frequency,
    dimensions,
    weight,
    powerConsumption,
    firmware
  };
}
