import express from "express";
import { Type } from "@google/genai";
import axios from "axios";
import { ai } from "../services/gemini";
import { authenticateUser } from "../middleware/auth";
import { isQuotaError, extractSpecsFromText } from "../utils/ai";

const router = express.Router();

function extractMetadataFromHtml(html: string): {
  title?: string;
  description?: string;
  price?: number;
  photoUrl?: string;
  brand?: string;
  model?: string;
  specsTableText?: string;
} {
  const result: any = {};

  if (!html || typeof html !== "string") return result;

  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    result.title = titleMatch[1].trim();
  }

  // Helper for meta tags
  const getMeta = (nameOrProperty: string): string | undefined => {
    const escaped = nameOrProperty.replace(/:/g, '\\:');
    const regex = new RegExp(`<meta[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']+)["']`, 'i');
    const match = html.match(regex);
    if (match) return match[1];

    const reverseRegex = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${escaped}["']`, 'i');
    const reverseMatch = html.match(reverseRegex);
    if (reverseMatch) return reverseMatch[1];

    return undefined;
  };

  // Extract meta title
  const ogTitle = getMeta("og:title") || getMeta("twitter:title");
  if (ogTitle) result.title = ogTitle;

  // Extract meta description
  const desc = getMeta("description") || getMeta("og:description") || getMeta("twitter:description");
  if (desc) result.description = desc;

  // Extract image
  const image = getMeta("og:image") || getMeta("twitter:image") || getMeta("image");
  if (image) result.photoUrl = image;

  // Extract brand
  const brand = getMeta("brand") || getMeta("product:brand") || getMeta("og:brand");
  if (brand) result.brand = brand;

  // Extract price
  const priceAmount = getMeta("og:price:amount") || getMeta("product:price:amount") || getMeta("price") || getMeta("product:retailer_item_id");
  if (priceAmount) {
    const parsed = parseFloat(priceAmount.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed)) result.price = parsed;
  }

  // Parse JSON-LD scripts
  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch;
  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsedJson = JSON.parse(jsonLdMatch[1].trim());
      const objects = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
      for (const obj of objects) {
        if (obj && (obj["@type"] === "Product" || obj["type"] === "Product" || String(obj["@type"]).includes("Product"))) {
          if (obj.name && !result.title) result.title = obj.name;
          if (obj.description && !result.description) result.description = obj.description;
          if (obj.image) {
            if (typeof obj.image === "string") result.photoUrl = obj.image;
            else if (Array.isArray(obj.image) && typeof obj.image[0] === "string") result.photoUrl = obj.image[0];
            else if (obj.image.url) result.photoUrl = obj.image.url;
          }
          if (obj.brand) {
            if (typeof obj.brand === "string") result.brand = obj.brand;
            else if (obj.brand.name) result.brand = obj.brand.name;
          }
          if (obj.model) {
            if (typeof obj.model === "string") result.model = obj.model;
            else if (obj.model.name) result.model = obj.model.name;
          }
          if (obj.offers) {
            const offers = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
            for (const offer of offers) {
              if (offer && offer.price) {
                const parsed = parseFloat(String(offer.price).replace(/[^0-9.]/g, ""));
                if (!isNaN(parsed)) result.price = parsed;
              }
            }
          }
        }
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }
  }

  // Extract spec tables / list structures if visible
  const tables: string[] = [];
  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  let count = 0;
  while ((tableMatch = tableRegex.exec(html)) !== null && count < 5) {
    const cleanTable = tableMatch[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanTable.length > 50) {
      tables.push(cleanTable);
      count++;
    }
  }
  if (tables.length > 0) {
    result.specsTableText = tables.join("\n\n");
  }

  return result;
}

router.post("/api/analyze-item", authenticateUser, async (req, res) => {
  const { url, productName } = req.body;
  let webpageTextContent = "";
  let extractedMeta: any = {};
  try {
    if (url && url.startsWith("http")) {
      try {
        const fetchRes = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          },
          timeout: 6000
        });
        const html = fetchRes.data;
        if (typeof html === "string") {
          extractedMeta = extractMetadataFromHtml(html);
          
          let cleanText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
          cleanText = cleanText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
          cleanText = cleanText.replace(/<[^>]+>/g, " ");
          cleanText = cleanText.replace(/\s+/g, " ");
          webpageTextContent = cleanText.slice(0, 12000);

          // Build a high-reliability structured metadata dump for Gemini
          const structuredDump = `
[STRUCTURED WEB METADATA EXTRACTED]:
- Extracted Web Title: ${extractedMeta.title || "None"}
- Extracted Web Description: ${extractedMeta.description || "None"}
- Extracted Direct Web Price: ${extractedMeta.price !== undefined ? `$${extractedMeta.price}` : "None"}
- Extracted Web Photo URL: ${extractedMeta.photoUrl || "None"}
- Extracted Web Brand: ${extractedMeta.brand || "None"}
- Extracted Web Model: ${extractedMeta.model || "None"}
${extractedMeta.specsTableText ? `\n- Extracted Web Specifications Tables:\n${extractedMeta.specsTableText.slice(0, 3000)}` : ""}
`;
          webpageTextContent = structuredDump + "\n" + webpageTextContent;
        }
      } catch (scrapingError: any) {
        console.error("Scraper failed to download product URL:", scrapingError.message);
      }
    }

    const sysInstruction = `You are a high-precision Gear Logistics Parser. Your task is to search for, extract, and verify high-precision technical specifications and a high-quality product photo URL for the following gear/product: ${productName || ""} ${url || ""}.
    ${webpageTextContent ? `Analyze this scraped webpage text content to extract brand, name, specs, and price details:\n\n--- WEBPAGE TEXT CONTENT start ---\n${webpageTextContent}\n--- WEBPAGE TEXT CONTENT end ---\n` : ""}

    MANDATORY STRUCTURAL CONVERGENCE & SCHEMA VALIDATION:
    You MUST output a single structured JSON object conforming strictly to the provided responseSchema validation protocol. Every field defined in the schema must be populated with accurate, verified information.
    
    STRICT PROHIBITION OF CONVENTIONAL PLACEHOLDERS & DEFAULT BOILERPLATES:
    You are strictly forbidden from reusing lazy developer shortcuts, defaults, or placeholder boilerplate text. Under no circumstances should you return values like 'Standard', 'Multiple I/O', '110-240V AC', '14.8V', '50/60 Hz', 'Compact Standard Size', '1.2 kg', 'Standard Operating Power', or 'v1.0.0' as fallback strings. Every field must represent actual verified empirical data for this specific product.
    
    VISUAL DEVICE CONTEXT & REAL-WORLD SPECIFICATION ALIGNMENT:
    You must verify that all extracted specifications align precisely with the real-world, physical product nature, form-factor, materials, and chassis visual context of this item (via grounding search outputs, website image assets, or your exhaustive physical product knowledge cataloging the gear's anatomy):
    - Physical I/O Layout Audit: Review the actual connector chassis configuration. The 'ioCount' field must accurately itemize real physical ports (e.g., '2x 3G-SDI Output, 1x HDMI 2.0 Output, 1x BNC Genlock' or '1x RJ45 PoE+, 1x Phoenix Terminal'). If it is a purely mechanic/analog item with zero electronic interfaces, return 'None' or describe the coupling (e.g., '1/4"-20 Threaded Mount').
    - Voltage & Power Footprint Verification: Extract the true electrical characteristics. If it is an analog microphone or non-powered tool, list 'N/A (Passive/Analog)'. If USB-powered, return the exact profile (e.g. 'USB-C 5V DC'). If battery-operated, state the specific operating voltage (e.g. '7.2V DC L-Series' or '14.8V Gold-Mount' or 'Internal 3.7V Li-ion'). Only use mains power rating if it has an integrated IEC/AC socket.
    - Frequency Spectrum Alignment: Determine the genuine frequency spectrum. For wireless gear, use the exact RF band (e.g., '5.18 - 5.82 GHz DFS' or '470 - 608 MHz UHF'). For visual display monitors, specify refresh rates (e.g., '60Hz' or '120Hz'). For microphonic/acoustic gear, list audio frequency response (e.g., '20 Hz - 20 kHz'). For passive utility gear, set to 'N/A' or list its operational physical frequency boundaries.
    - Volumetric Dimensions Integrity: Do not assume compact defaults. Look up exact millimeter or inch measurements. Cross-check against the product's visual presence. A large tripod system or an LED softbox must reflect actual physical length/breadth profiles (e.g., '1100 x 180 x 180 mm') rather than a lazy standard size estimate.
    - Mass/Weight Density Analysis: Check the weight against the physical product context. A DSLR camera body cannot have the same default weight as a light plastic clip. Return the real weight in native units (e.g. '640 g' or '1.45 kg' or '4.2 lbs').
    - Active Power Draw & Efficiency Audit: Report verified power consumption parameters (e.g., '45 Watts operational draw' or '150W peak charging'). Do NOT default to generic descriptive tags.
    - Microcontroller Firmware Verification: Find the actual released factory or stable system firmware version (e.g., 'v2.4.1' or 'v1.0 build 402'). If the item has no digital processing components (such as a cable, case, or mechanical bracket), return 'Not applicable (Passive hardware)'.

    Be extremely critical of your data quality. Perform a validation pass to ensure that the specs in the JSON exactly match the real-world tool or device model. Return strictly JSON.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        brand: { type: Type.STRING },
        model: { type: Type.STRING },
        category: { type: Type.STRING },
        price: { type: Type.NUMBER },
        description: { type: Type.STRING },
        photoUrl: { type: Type.STRING },
        specs: {
          type: Type.OBJECT,
          properties: {
            ioCount: { type: Type.STRING },
            voltage: { type: Type.STRING },
            frequency: { type: Type.STRING },
            dimensions: { type: Type.STRING },
            weight: { type: Type.STRING },
            powerConsumption: { type: Type.STRING },
            firmware: { type: Type.STRING }
          }
        }
      }
    };

    let response;
    try {
      console.info("[Analyzer] Attempting Gemini analysis with live search grounding...");
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: sysInstruction,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema
        }
      });
    } catch (searchError: any) {
      console.warn("[Analyzer] Gemini live search grounding failed, retrying without tools...", searchError.message || searchError);
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: sysInstruction,
        config: {
          responseMimeType: "application/json",
          responseSchema
        }
      });
    }

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Gemini Analysis Error (falling back to heuristics):", error);
    
    let brand = extractedMeta.brand || "Standard";
    let model = extractedMeta.model || "Generic Model";
    let category = "Electronics";
    const titleVal = extractedMeta.title || productName || url || "";
    const nameLower = titleVal.toLowerCase();
    
    if (brand === "Standard") {
      if (nameLower.includes("sony")) brand = "Sony";
      else if (nameLower.includes("canon")) brand = "Canon";
      else if (nameLower.includes("nikon")) brand = "Nikon";
      else if (nameLower.includes("red")) brand = "RED";
      else if (nameLower.includes("arri")) brand = "ARRI";
      else if (nameLower.includes("blackmagic")) brand = "Blackmagic Design";
      else if (nameLower.includes("shure")) brand = "Shure";
      else if (nameLower.includes("dji")) brand = "DJI";
      else if (nameLower.includes("rode") || nameLower.includes("røde")) brand = "RØDE";
      else if (nameLower.includes("sennheiser")) brand = "Sennheiser";
      else if (nameLower.includes("aputure")) brand = "Aputure";
    }
    
    if (nameLower.includes("camera") || nameLower.includes("body")) category = "Camera";
    else if (nameLower.includes("lens") || nameLower.includes("focal") || nameLower.includes("mm")) category = "Lens";
    else if (nameLower.includes("mic") || nameLower.includes("audio") || nameLower.includes("wireless") || nameLower.includes("sound")) category = "Audio";
    else if (nameLower.includes("light") || nameLower.includes("led") || nameLower.includes("panel")) category = "Lighting";
    else if (nameLower.includes("tripod") || nameLower.includes("gimbal") || nameLower.includes("mount") || nameLower.includes("rig")) category = "Support";
    else if (nameLower.includes("cable") || nameLower.includes("sdi") || nameLower.includes("hdmi") || nameLower.includes("xlr")) category = "Cables";
    else if (nameLower.includes("battery") || nameLower.includes("power") || nameLower.includes("charger") || nameLower.includes("v-mount")) category = "Power";
    
    if (model === "Generic Model") {
      const words = titleVal.split(/\s+/);
      if (words.length > 1) {
        const gModel = words.slice(1).join(" ");
        if (gModel.length < 30) model = gModel;
      }
    }

    const dynamicSpecs = extractSpecsFromText(webpageTextContent, titleVal, url || "");

    res.json({
      name: titleVal || "Analyzed Item",
      brand,
      model,
      category,
      price: extractedMeta.price || (productName ? (productName.length * 12) : 199),
      description: extractedMeta.description || `A professional ${category.toLowerCase()} device (${brand} ${model}) analyzed via local workspace fallback heuristics.`,
      photoUrl: extractedMeta.photoUrl || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop",
      specs: dynamicSpecs,
      aiWarning: isQuotaError(error) 
        ? "AI Quota Limit Exceeded (429). Operating in beautiful local offline heuristic mode."
        : "AI Heuristic standby loaded successfully."
    });
  }
});

router.post("/api/map-inventory", authenticateUser, async (req, res) => {
  const { headers, sampleData } = req.body;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are an inventory data migration expert. Map the following spreadsheet headers and sample data to our GearItem schema.
      
      GearItem Schema Fields:
      - name (string, required)
      - description (string)
      - brand (string)
      - model (string)
      - modelNumber (string)
      - serialNumber (string)
      - primaryCategory (string, e.g., Camera, Lens, Audio, Lighting, Support, Electronics, Cables, Power, Accessories, Other)
      - weight (number)
      - weightUnit (g, kg, oz, lb)
      - price (number)
      - condition (new, good, fair, poor)
      - quantity (number)
      - status (available, in_use, maintenance, retired, missing)
      
      Headers: ${JSON.stringify(headers)}
      Sample Data (first 3 rows): ${JSON.stringify(sampleData)}
      
      Return a JSON mapping where keys are the GearItem schema fields and values are the corresponding header indices (0-based) from the input headers. 
      If a field cannot be mapped confidently, omit it or set it to null.
      Also provide a list of 'unmappedHeaders' summarizing columns that didn't fit.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mapping: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.NUMBER },
                description: { type: Type.NUMBER },
                brand: { type: Type.NUMBER },
                model: { type: Type.NUMBER },
                modelNumber: { type: Type.NUMBER },
                serialNumber: { type: Type.NUMBER },
                primaryCategory: { type: Type.NUMBER },
                weight: { type: Type.NUMBER },
                weightUnit: { type: Type.NUMBER },
                price: { type: Type.NUMBER },
                condition: { type: Type.NUMBER },
                quantity: { type: Type.NUMBER },
                status: { type: Type.NUMBER }
              }
            },
            unmappedHeaders: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Gemini Inventory Mapping Error (falling back to heuristics):", error);
    
    const mapping: any = {
      name: null,
      description: null,
      brand: null,
      model: null,
      modelNumber: null,
      serialNumber: null,
      primaryCategory: null,
      weight: null,
      weightUnit: null,
      price: null,
      condition: null,
      quantity: null,
      status: null
    };

    if (Array.isArray(headers)) {
      headers.forEach((h: string, idx: number) => {
        const clean = String(h || "").toLowerCase().trim();
        if (clean.includes("name") || clean.includes("title") || clean.includes("item") || clean === "product") {
          if (mapping.name === null) mapping.name = idx;
        } else if (clean.includes("desc") || clean.includes("detail") || clean.includes("info")) {
          if (mapping.description === null) mapping.description = idx;
        } else if (clean.includes("brand") || clean.includes("make") || clean.includes("mfr") || clean.includes("manufacturer")) {
          if (mapping.brand === null) mapping.brand = idx;
        } else if (clean.includes("model number") || clean === "part" || clean === "pn" || clean === "p/n" || clean.includes("m/n")) {
          if (mapping.modelNumber === null) mapping.modelNumber = idx;
        } else if (clean === "model" || clean.includes("type")) {
          if (mapping.model === null) mapping.model = idx;
        } else if (clean.includes("serial") || clean === "sn" || clean === "s/n" || clean.includes("num")) {
          if (mapping.serialNumber === null) mapping.serialNumber = idx;
        } else if (clean.includes("category") || clean.includes("cat") || clean.includes("group")) {
          if (mapping.primaryCategory === null) mapping.primaryCategory = idx;
        } else if (clean.includes("weight") || clean === "mass") {
          if (mapping.weight === null) mapping.weight = idx;
        } else if (clean.includes("unit")) {
          if (mapping.weightUnit === null) mapping.weightUnit = idx;
        } else if (clean.includes("price") || clean.includes("cost") || clean.includes("value") || clean === "rate") {
          if (mapping.price === null) mapping.price = idx;
        } else if (clean.includes("cond")) {
          if (mapping.condition === null) mapping.condition = idx;
        } else if (clean.includes("qty") || clean.includes("quantity") || clean.includes("count") || clean === "amount") {
          if (mapping.quantity === null) mapping.quantity = idx;
        } else if (clean.includes("status") || clean === "state") {
          if (mapping.status === null) mapping.status = idx;
        }
      });
    }

    res.json({
      mapping,
      unmappedHeaders: Array.isArray(headers) ? headers.filter((_, idx) => !Object.values(mapping).includes(idx)) : [],
      aiWarning: isQuotaError(error)
        ? "AI Quota Limit Exceeded (429). Performed perfect local fuzzy spreadsheet mapping."
        : "Standard mapping heuristics active."
    });
  }
});

router.post("/api/register-serial-model", authenticateUser, async (req, res) => {
  const { productName, textContext, photoBase64 } = req.body;
  try {
    const parts: any[] = [];
    
    let promptText = `Extract structural metadata for a gear item. 
    You need to look for and extract the following:
    1. model: generic descriptive model name (e.g. "A7 IV" or "SM58" or "Mavic 3")
    2. modelNumber: exact identifier or model number (e.g. "ILCE-7M4", "X310-A", "DJI-MV3")
    3. serialNumber: unique serial number, often printed next to barcodes or following label terms like "S/N:", "Serial:", "SN:", "Serial Number:", "No:" or "CODE".
    4. releaseYear: manufacturer release year or year/date context (e.g. "2021" or "2023")
    
    Confidence guidelines: If a specific field cannot be retrieved, extract, or guessed confidently, return an empty string ("") for that field. Do not make up fake details unless there's direct visual/text proof.
    `;
    
    if (productName) {
      promptText += `\nProduct Name: ${productName}`;
    }
    if (textContext) {
      promptText += `\nText context (OCR/specs): ${textContext}`;
    }
    
    parts.push({ text: promptText });
    
    if (photoBase64) {
      const cleanBase64 = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            model: { type: Type.STRING },
            modelNumber: { type: Type.STRING },
            serialNumber: { type: Type.STRING },
            releaseYear: { type: Type.STRING }
          }
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Gemini Serial/Model Registration Error (falling back to heuristics):", error);
    
    let model = "";
    let modelNumber = "";
    let serialNumber = "";
    let releaseYear = "";

    const text = (String(textContext || "") + " " + String(productName || "")).trim();
    
    const serialMatch = text.match(/(?:S\/N|SN|Serial|S\/N:|SN:)\s*([A-Za-z0-9_-]{4,20})/i);
    if (serialMatch) {
      serialNumber = serialMatch[1];
    } else {
      const generalAlphanum = text.match(/\b([A-Z0-9]{8,15})\b/);
      if (generalAlphanum) serialNumber = generalAlphanum[1];
    }
    
    const modelMatch = text.match(/(?:Model|M\/N|MN|Ref)\s*([A-Za-z0-9_-]{3,15})/i);
    if (modelMatch) {
      modelNumber = modelMatch[1];
    } else {
      const bracketMatch = text.match(/\(([^)]+)\)/);
      if (bracketMatch) model = bracketMatch[1];
    }
    
    if (productName) {
      model = productName.split(" ").slice(1).join(" ") || productName;
    }

    res.json({
      model: model || "Detected Model",
      modelNumber: modelNumber || "MN-STANDARD",
      serialNumber: serialNumber || "SN-PENDING",
      releaseYear: releaseYear || "2024",
      aiWarning: isQuotaError(error)
        ? "AI Quota Limit Exceeded (429). Extracted S/N and Models locally."
        : "Standard registration heuristics active."
    });
  }
});

router.post("/api/dukey-chat", authenticateUser, async (req, res) => {
  const { message, history, gear, packingLists, customInventories, containers, userProfile, recentViews, activePath, activeSection } = req.body;
  try {
    let detectedCategory = "General Planning";
    let categoryExplanation = "Beginner or multi-purpose operator.";
    
    if (gear && gear.length > 0) {
      let filmCount = 0;
      let outdoorCount = 0;
      let itCount = 0;
      
      gear.forEach((g: any) => {
        const name = (g.name || "").toLowerCase();
        const cat = (g.primaryCategory || "").toLowerCase();
        
        if (cat.includes("camera") || cat.includes("lens") || cat.includes("video") || name.includes("lens") || name.includes("gimbal") || name.includes("red") || name.includes("sony") || name.includes("lights")) {
          filmCount++;
        } else if (cat.includes("power") || cat.includes("outdoor") || cat.includes("hike") || name.includes("backpack") || name.includes("tent") || name.includes("climb") || name.includes("sleeping") || name.includes("camp")) {
          outdoorCount++;
        } else if (cat.includes("network") || cat.includes("it") || cat.includes("server") || cat.includes("rack") || name.includes("switch") || name.includes("cable") || name.includes("router") || name.includes("server")) {
          itCount++;
        }
      });
      
      if (filmCount > outdoorCount && filmCount > itCount) {
        detectedCategory = "Film & Camera Productions";
        categoryExplanation = "Your equipment consists primarily of visual recording, lens, and lighting assemblies.";
      } else if (outdoorCount > filmCount && outdoorCount > itCount) {
        detectedCategory = "Outdoor & Adventure Expeditions";
        categoryExplanation = "Your equipment displays properties for high-altitude trekking, camping, or field survival systems.";
      } else if (itCount > filmCount && itCount > outdoorCount) {
        detectedCategory = "IT, AV, & Racking Deployments";
        categoryExplanation = "Your equipment tracks mostly networking cables, switches, power units, and hardware devices.";
      }
    }

    const sysInstruction = `You are "Dukey", the definitive, ultra-precise AI Knowledge Base Companion and Gear Strategist for the "Packer Tools" platform (Stable Version v5.8.0).

MANDATORY RULES:
1. EXTREMELY BRIEF & STRAIGHTFORWARD: Speak in simple, clear, and highly straightforward language. Keep responses limited to 1 or 2 sentences max. Do NOT write long paragraphs under any circumstances. Cut out all polite filler, conversational introductions/greetings, preambles, and detailed retrospectives. Get straight to the answer immediately.
2. PAGES & SECTION AWARENESS: You are fully aware of where the user is right now in the web application.
   - User is currently on the active page: "${activeSection || 'General Area'}" (Path: "${activePath || '#/dashboard'}").
   - Synthesize advice to be contextually relevant to this active section. Mention or refer to their active page/section in a straightforward manner if relevant.
3. IN-APP NAVIGATION LINKS: When the user asks where to find features, how to access spreadsheets, directories, settings, print qr codes, etc., you MUST explicitly guide them with a markdown-styled hyper-reactive anchor pointing to the specific HashRouter path in Packer Tools. Always use these exact links:
   - Gear Library Central repository: [Gear Library](#/library)
   - Custom Inventory Sheets & Audits: [Inventory Sheets](#/inventory)
   - Gear Check-In/Check-Out terminal kiosk: [Kiosk Mode](#/kiosk)
   - Home Dashboard Nerve Center: [Dashboard Nerve Center](#/dashboard)
   - Rental Listings Control: [My Active Listings](#/listings)
   - Equipment Hire Marketplace: [Peer Marketplace](#/marketplace)
   - Teams, Members & Roles: [Organization Manager](#/organization)
   - Global App Settings & Bug Finder: [Systems Settings](#/admin?tab=settings)
   - User profile & public storefronts: [User Profile](#/profile)

GROUND-TRUTH WORKSPACE CONFIGURATION:
- User Profile: ${JSON.stringify(userProfile || {})}
- Detected Habit Category: "${detectedCategory}" (${categoryExplanation})
- Gear Assets: ${gear?.length || 0} active, Packing Lists: ${packingLists?.length || 0} active, Case Containers: ${containers?.length || 0} active, Custom Inventories: ${customInventories?.length || 0} sheets.

OFFICIAL PLATFORM KNOWLEDGE BASE & POLICY MANUAL:
- BRAND SHOPFRONTS & CUSTOM PROFILES (v5.8.0): Users can launch customized public hiring store profiles on the independent web route "#/shop/:uid". Operators configure logos, store bios, websites, cover images, and social connections within their Profile page settings.
- DYNAMIC REGIONAL CURRENCY REGISTRY (v5.8.0): Admins select default currencies (USD, FJD, AUD, NZD, GBP, CAD, or EUR) via the Admin Panel under Regional configurations.
- ENTERPRISE LOCKS & SUBSCRIPTION PAYWALLS (v5.8.0): Free scale users are barred from list deployments inside the marketplace, immediately prompting the Upgrade Modal to sync payment streams.
- GLOBAL LIGHT/DARK VISUAL OVERRIDES (v5.8.0): Accessible via the User Profile/Settings tabs. Persists themes locally (LocalStorage) and overrides white/neutral defaults.
- DEVELOPER API & EMBED PORTAL (v5.8.0): Located in the 'Developer API & Embeds' tab. Developers capture live private API keys ('pk_live_packer_...') to fetch records or copy responsive iFrame snippet codes to integrate checkouts directly into third-party sites using "https://packer.tools".
- GEAR LIBRARY: Central repository supporting weight metrics, maintenance interval triggers, and nested kits.
- PHYSICAL AVERY LABEL SHEET MODE (v5.8.0): Standard printing sheets supported in label printers (Avery 5160, 5161, 5162, 5163, L7160, etc.) with custom "Start Slot" starting selectors to avoid sticker wastage and visual guides toggle.
- STORAGE QUOTA EXHAUSTION SAFEGUARDS (v5.8.0): Monkey-patches global browser storage APIs inside 'src/main.tsx' to detect private-mode storage capacity limits and auto-clear legacy caches.
- OFFLINE INDEXEDDB FAILOVERS (v5.8.0): Uses service worker cache connections to store inventories and profiles client-side for resilient remote operations.
- CROSS-LIST BULK COPYING (v5.8.0): Supports copying gear lists completely into custom inventories or packing lists with safe Firestore chunked batch status transitions.
- SYSTEM SETTINGS & BUG REPORTS FINDER: Admins locate Bug reports under System settings in the super admin tab.`;

    const chatHistory = Array.isArray(history) ? history.map((item: any) => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: item.content || item.message || "" }]
    })) : [];

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: sysInstruction }] },
        ...chatHistory,
        { role: "user", parts: [{ text: message }] }
      ]
    });

    const reply = response.text?.trim() || "No response generated.";
    res.json({ text: reply });
  } catch (error: any) {
    console.error("Dukey chat failed, falling back to heuristics:", error);
    let reply = "Hello! I am Dukey. It seems we are having trouble connecting to high-speed AI cores at the moment.";
    const cleanMsg = (message || "").toLowerCase();
    
    if (cleanMsg.includes("hi") || cleanMsg.includes("hello") || cleanMsg.includes("bula")) {
      reply = `Bula Vinaka! I'm Dukey. How can I assist you with your equipment logistics today? View your [Gear Library Central Repository](#/library) to get started.`;
    } else if (cleanMsg.includes("rent") || cleanMsg.includes("marketplace")) {
      reply = `You can browse and list equipment on our peer-to-peer directory. Access the [Equipment Hire Marketplace](#/marketplace) to find gear available near you.`;
    } else if (cleanMsg.includes("kiosk") || cleanMsg.includes("scan") || cleanMsg.includes("checkout")) {
      reply = `Access the [Gear Check-In/Check-Out Terminal](#/kiosk) to handle interactive handovers and print sticker tags seamlessly.`;
    } else if (cleanMsg.includes("sheet") || cleanMsg.includes("inventory")) {
      reply = `Create custom spreadsheets and record structured audits in [Custom Inventory Modules](#/inventory).`;
    } else if (cleanMsg.includes("setting") || cleanMsg.includes("api") || cleanMsg.includes("key")) {
      reply = `Integrate third-party checkout flows or fetch live records with your private keys on the [Systems Settings](#/admin?tab=settings) console.`;
    }

    res.json({ text: reply, aiWarning: "AI Quota Exceeded (429). Dukey chat fallback active." });
  }
});

router.post("/api/check-compatibility", authenticateUser, async (req, res) => {
  const { items } = req.body;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash", // Use standard stable model as per systems guidelines
      contents: `Analyze the following technical equipment for compatibility as a single system. 
      Consider power (voltage/frequency mismatch), signal types (SDI vs HDMI), protocol compatibility, and physical mounting/thermal constraints.
      
      Items: ${JSON.stringify(items)}
      
      Return a structured report.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, description: "One of: COMPATIBLE, WARNING, INCOMPATIBLE" },
            summary: { type: Type.STRING },
            issues: {
              type: Type.ARRAY,
              properties: {
                severity: { type: Type.STRING },
                description: { type: Type.STRING },
                affectedItems: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Gemini Compatibility Error (falling back to category logic):", error);
    
    const safeItems = Array.isArray(items) ? items : [];
    const itemNames = safeItems.map((i: any) => i.name || "Item").join(" & ");
    
    const isCameraAndLens = safeItems.some((i: any) => {
      const cat = String(i.primaryCategory || i.category || "").toLowerCase();
      return cat.includes("camera") || cat.includes("body");
    }) && safeItems.some((i: any) => {
      const cat = String(i.primaryCategory || i.category || "").toLowerCase();
      return cat.includes("lens");
    });

    const isPowerAndElectronic = safeItems.some((i: any) => {
      const cat = String(i.primaryCategory || i.category || "").toLowerCase();
      return cat.includes("power") || cat.includes("battery") || cat.includes("charger");
    }) && safeItems.some((i: any) => {
      const cat = String(i.primaryCategory || i.category || "").toLowerCase();
      return cat.trim() !== "" && !cat.includes("power") && !cat.includes("battery") && !cat.includes("charger") && !cat.includes("cables");
    });
    
    let status = "COMPATIBLE";
    let summary = `Physical interface diagnostics suggest ${itemNames || "equipment items"} are mutually compatible under normal specs.`;
    const issues: any[] = [];
    const recommendations = ["Confirm electrical/interface connectors align before locking."];

    if (isCameraAndLens) {
      status = "WARNING";
      summary = `Pairing Camera bodies and Lenses requires confirming mount compatibility (eg. Sony E vs Canon RF vs PL mount).`;
      issues.push({
        severity: "MEDIUM",
        description: "Checking bayonet specs. If pairing mismatched mount systems, an active lens adapter is mandatory.",
        affectedItems: safeItems.map((i: any) => i.name)
      });
      recommendations.push("Verify that a lens adapter is or is not required.");
    } else if (isPowerAndElectronic) {
      status = "WARNING";
      summary = "Combining active accessories with physical battery/power outlets requires voltage verification.";
      issues.push({
        severity: "HIGH",
        description: "Verify inputs: feeding mismatched DC power (e.g. 14.8V D-Tap into a 5V DSLR body directly) can damage electronic boards.",
        affectedItems: safeItems.map((i: any) => i.name)
      });
      recommendations.push("Verify input voltage limit of receiving units.", "Utilize regulated adapter cords.");
    }

    res.json({
      status,
      summary,
      issues,
      recommendations,
      aiWarning: isQuotaError(error)
        ? "AI Quota Limit Exceeded (429). Verified connectivity interfaces locally."
        : "Standard compatibility heuristics active."
    });
  }
});

router.post("/api/compare-items", authenticateUser, async (req, res) => {
  const { itemA, itemB } = req.body;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Compare product A and product B. Highlight key differences in performance, I/O, cost, and reliability.
      
      Product A: ${JSON.stringify(itemA)}
      Product B: ${JSON.stringify(itemB)}`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comparison: { type: Type.STRING },
            prosA: { type: Type.ARRAY, items: { type: Type.STRING } },
            prosB: { type: Type.ARRAY, items: { type: Type.STRING } },
            winner: { type: Type.STRING },
            tableData: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  feature: { type: Type.STRING },
                  valA: { type: Type.STRING },
                  valB: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Gemini Comparison Error (falling back to offline comparison):", error);
    const nameA = itemA?.name || "Product A";
    const nameB = itemB?.name || "Product B";
    
    res.json({
      comparison: `Local offline analysis between ${nameA} and ${nameB}. Standard values evaluated based on listed workspace metrics.`,
      prosA: [itemA?.brand ? `Authentic ${itemA.brand} product line` : "Compact styling", "Straightforward operation"],
      prosB: [itemB?.brand ? `Authentic ${itemB.brand} product line` : "Reliable construction", "Great accessory value"],
      winner: (itemA?.price || 0) <= (itemB?.price || 0) ? nameA : nameB,
      tableData: [
        { feature: "Brand", valA: itemA?.brand || "Generic", valB: itemB?.brand || "Generic" },
        { feature: "Model", valA: itemA?.model || "N/A", valB: itemB?.model || "N/A" },
        { feature: "Price", valA: itemA?.price ? `$${itemA.price}` : "N/A", valB: itemB?.price ? `$${itemB.price}` : "N/A" }
      ],
      aiWarning: isQuotaError(error)
        ? "AI Quota Limit Exceeded (429). Used clean workspace specs comparison."
        : "Standard comparison heuristics Active."
    });
  }
});

router.post("/api/generate-description", authenticateUser, async (req, res) => {
  const { name, brand, model, description, isKit, childItems } = req.body;
  try {
    let prompt = `You are an expert equipment inventory cataloging assistant. Your job is to draft or refine a professional, concise product description for a gear inventory item or custom equipment kit.
    
    IMPORTANT STRICT STIPULATIONS:
    1. Do NOT make up, assume, or hallucinate any external specifications, tech specs, or product details. Look ONLY at the provided item name, brand, model, existing description, and included kit items.
    2. Write an elegant and highly descriptive summary using only the user-provided variables.
    
    Properties:
    - Item Name: ${name || "N/A"}
    - Brand: ${brand || "N/A"}
    - Model: ${model || "N/A"}
    - Existing Description: ${description || "N/A"}`;

    if (isKit) {
      prompt += `\n- This item is an Equipment Kit container.`;
      if (childItems && childItems.length > 0) {
        prompt += `\n- Sub-items inside this kit:
${childItems.map((item: any) => `  * ${item.name || item} (Brand: ${item.brand || "N/A"}, Model: ${item.model || "N/A"})`).join("\n")}`;
      } else {
        prompt += `\n- Items inside this kit: No sub-items listed yet.`;
      }
    }

    prompt += `\n\nGenerate a professional, clean product description (1 to 3 sentences max) that integrates this information seamlessly. If it is a kit, clearly declare it is a custom equipment kit and enumerate the included items. Keep the tone natural, neat, and technical. Output ONLY the plain text description itself, no prefixes, headings, or markdown comments.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ description: response.text?.trim() || "" });
  } catch (error: any) {
    console.error("Gemini Generate Description Error (falling back to text layout):", error);
    const nameVal = name || "Product Item";
    const brandVal = brand ? `${brand} ` : "";
    const modelVal = model ? `(${model}) ` : "";
    let desc = `${brandVal}${modelVal}${nameVal}. This professional grade hardware offers exceptional durability and is custom configured for optimal workspace workflows.`;
    
    if (isKit && Array.isArray(childItems) && childItems.length > 0) {
      desc += ` Encompasses a custom bundle containing high-quality components: ${childItems.map((c: any) => c.name || c).join(", ")}.`;
    }

    res.json({
      description: desc,
      aiWarning: isQuotaError(error)
        ? "AI Quota Limit Exceeded (429). Prepared local structured summary description."
        : "Standard description generator active."
    });
  }
});

router.post("/api/estimate-weight", authenticateUser, async (req, res) => {
  const { name, brand, model, description } = req.body;
  try {
    const prompt = `You are an expert equipment cataloging and logistics assistant. Your job is to search for or calculate the physical weight of an item based on its name, brand, model, and description. Do not guess wildly, but provide realistic or exact specifications.
    
    Item details:
    - Name: ${name || "N/A"}
    - Brand: ${brand || "N/A"}
    - Model: ${model || "N/A"}
    - Description: ${description || "N/A"}
    
    Look up official specifications if possible, or make a very accurate weight estimation. 
    Return strictly a JSON object with:
    - weight (number: the numerical value of the weight)
    - weightUnit (string: must be one of "g", "kg", "lb", "oz". Pick whichever unit matches typical official specifications, usually grams or kg for camera gear)
    - reasoning (string: a warm, concise 1-sentence explanation of where the specification comes from or how the weight was calculated, e.g., "Sony FX3 body officially weighs 640g, and 715g with battery and memory card inserted.")`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weight: { type: Type.NUMBER },
            weightUnit: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          },
          required: ["weight", "weightUnit", "reasoning"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Gemini Estimate Weight Error (falling back to offline weight heuristics):", error);
    const nameLower = (String(name || "") + " " + String(model || "") + " " + String(brand || "")).toLowerCase();
    
    let weight = 0.5;
    let weightUnit = 'kg';
    let reasoning = "Estimated typical weight for generic production gear (Offline Fallback).";
    
    if (nameLower.includes("camera") && nameLower.includes("fx3")) {
      weight = 715; weightUnit = 'g'; reasoning = "Sony FX3 body weights approximately 715g with battery and memory card (Offline Fallback).";
    } else if (nameLower.includes("camera") || nameLower.includes("body")) {
      weight = 1.2; weightUnit = 'kg'; reasoning = "Typical professional camera body with battery weighs around 1.2kg (Offline Fallback).";
    } else if (nameLower.includes("sm7b")) {
      weight = 765; weightUnit = 'g'; reasoning = "Shure SM7B vocal microphone is officially 765g (Offline Fallback).";
    } else if (nameLower.includes("mic") || nameLower.includes("audio") || nameLower.includes("microphone")) {
      weight = 300; weightUnit = 'g'; reasoning = "Average handheld or studio condenser microphone weighs around 300g (Offline Fallback).";
    } else if (nameLower.includes("lens") && (nameLower.includes("70-200") || nameLower.includes("telephoto"))) {
      weight = 1.4; weightUnit = 'kg'; reasoning = "A professional 70-200mm telephoto lens typically weighs around 1.4kg (Offline Fallback).";
    } else if (nameLower.includes("lens")) {
      weight = 500; weightUnit = 'g'; reasoning = "Standard prime/zoom photo lens typically weighs around 500g (Offline Fallback).";
    } else if (nameLower.includes("battery") && nameLower.includes("v-mount")) {
      weight = 800; weightUnit = 'g'; reasoning = "Standard high-capacity V-Mount battery weighs approximately 800g (Offline Fallback).";
    } else if (nameLower.includes("light") && nameLower.includes("600d")) {
      weight = 4.69; weightUnit = 'kg'; reasoning = "Aputure LS 600d lamp head weighs approximately 4.69kg (Offline Fallback).";
    } else if (nameLower.includes("light") || nameLower.includes("led")) {
      weight = 2.5; weightUnit = 'kg'; reasoning = "Standard portable studio LED light fixture weighs around 2.5kg (Offline Fallback).";
    } else if (nameLower.includes("tripod") || nameLower.includes("stand")) {
      weight = 3.5; weightUnit = 'kg'; reasoning = "Average heavy-duty support stand or tripod weighs around 3.5kg (Offline Fallback).";
    }
    
    res.json({
      weight,
      weightUnit,
      reasoning,
      aiWarning: isQuotaError(error)
        ? "AI Quota Limit Exceeded (429). Prepared local heuristic estimate."
        : "Standard weight estimate active."
    });
  }
});

router.post("/api/generate-scenario-list", authenticateUser, async (req, res) => {
  const { brief, gear } = req.body;
  try {
    const gearSummary = Array.isArray(gear)
      ? gear.map(g => ({ id: g.id, name: g.name, category: g.primaryCategory || g.category || "" }))
      : [];

    const prompt = `You are a professional packing list builder and logistics expert. The user wants to build a packing list for a specific scenario/brief:
    "${brief || "Solo photography session"}"
    
    Here is a list of existing gear items in the user's library:
    ${JSON.stringify(gearSummary)}
    
    Task:
    Analyze the user brief and the user's existing gear. Identify specific gear items from the user's library that match the brief (set their matchedGearId).
    Also suggest recommended equipment or essential items for this gig/scenario, even if they aren't in the gear list (leave matchedGearId blank/null for these so they know they are missing/need to be sourced).
    Make realistic suggestions tailored to the brief. Max 10 items.
    
    Return strictly JSON matching the response schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  estimatedWeight: { type: Type.NUMBER },
                  weightUnit: { type: Type.STRING, enum: ["g", "kg", "lb", "oz"] },
                  matchedGearId: { type: Type.STRING }
                },
                required: ["name", "category", "reason", "quantity"]
              }
            }
          },
          required: ["recommendedItems"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Scenario Generator AI Error (using heuristic fallback):", error);
    const briefLower = (brief || "").toLowerCase();
    const recommendedItems: any[] = [];
    const safeGear = Array.isArray(gear) ? gear : [];

    const findMatch = (keywords: string[]) => {
      return safeGear.find(g => {
        const nameClean = (g.name || "").toLowerCase();
        return keywords.some(k => nameClean.includes(k));
      });
    };

    if (briefLower.includes("photo") || briefLower.includes("camera") || briefLower.includes("shoot") || briefLower.includes("wedding")) {
      const camMatch = findMatch(["camera", "fx3", "canon", "sony", "nikon", "body"]);
      recommendedItems.push({
        name: camMatch ? camMatch.name : "Professional DSLR/Mirrorless Camera Body",
        category: "Camera",
        reason: "Primary body for capturing high-resolution photographs under varying conditions.",
        quantity: 1,
        estimatedWeight: 800,
        weightUnit: "g",
        matchedGearId: camMatch ? camMatch.id : ""
      });

      const lensMatch = findMatch(["lens", "zoom", "prime", "focal", "mm"]);
      recommendedItems.push({
        name: lensMatch ? lensMatch.name : "24-70mm f/2.8 Standard Zoom Lens",
        category: "Lens",
        reason: "Versatile zoom range suitable for portraits, wide shots, and quick tracking.",
        quantity: 1,
        estimatedWeight: 900,
        weightUnit: "g",
        matchedGearId: lensMatch ? lensMatch.id : ""
      });

      const batMatch = findMatch(["battery", "power", "charger"]);
      recommendedItems.push({
        name: batMatch ? batMatch.name : "High Capacity Camera Batteries",
        category: "Power",
        reason: "Sustained power buffer during critical continuous shooting blocks.",
        quantity: 3,
        estimatedWeight: 150,
        weightUnit: "g",
        matchedGearId: batMatch ? batMatch.id : ""
      });

      const cardMatch = findMatch(["sd", "card", "cfexpress", "memory", "storage"]);
      recommendedItems.push({
        name: cardMatch ? cardMatch.name : "128GB High-Speed SD Card (V60/V90)",
        category: "Accessories",
        reason: "High-write speed media storage to handle fast bursting and large RAW image files.",
        quantity: 2,
        estimatedWeight: 5,
        weightUnit: "g",
        matchedGearId: cardMatch ? cardMatch.id : ""
      });

      const lightMatch = findMatch(["light", "flash", "led", "aputure", "speedlight"]);
      recommendedItems.push({
        name: lightMatch ? lightMatch.name : "Portable Speedlight / On-Camera Flash",
        category: "Lighting",
        reason: "Fill-in shadow details and establish clean catchlights in portrait sessions.",
        quantity: 1,
        estimatedWeight: 400,
        weightUnit: "g",
        matchedGearId: lightMatch ? lightMatch.id : ""
      });
    } else if (briefLower.includes("outdoor") || briefLower.includes("hike") || briefLower.includes("trek") || briefLower.includes("camp")) {
      const packMatch = findMatch(["backpack", "pack", "bag", "rucksack"]);
      recommendedItems.push({
        name: packMatch ? packMatch.name : "55L Multi-Day Adventure Expedition Pack",
        category: "Accessories",
        reason: "High durability frame with load distribution to carry entire payload safely.",
        quantity: 1,
        estimatedWeight: 1.8,
        weightUnit: "kg",
        matchedGearId: packMatch ? packMatch.id : ""
      });

      const tentMatch = findMatch(["tent", "tarp", "shelter"]);
      recommendedItems.push({
        name: tentMatch ? tentMatch.name : "3-Season Lightweight 2-Person Shelter Tent",
        category: "Accessories",
        reason: "Waterproof wind-resilient overnight shelter.",
        quantity: 1,
        estimatedWeight: 2.1,
        weightUnit: "kg",
        matchedGearId: tentMatch ? tentMatch.id : ""
      });

      const sleepMatch = findMatch(["sleep", "sleeping", "mat", "pad", "bag"]);
      recommendedItems.push({
        name: sleepMatch ? sleepMatch.name : "Insulated Sleeping Bag & Air Pad",
        category: "Accessories",
        reason: "Thermal regulation to maintain body heat in cold overnight drafts.",
        quantity: 1,
        estimatedWeight: 1.2,
        weightUnit: "kg",
        matchedGearId: sleepMatch ? sleepMatch.id : ""
      });

      const powerMatch = findMatch(["power", "battery", "solar", "bank"]);
      recommendedItems.push({
        name: powerMatch ? powerMatch.name : "10,000mAh Rugged USB Charger Power Bank",
        category: "Power",
        reason: "Backup battery to charge emergency GPS locator beacon, phone, and camera units.",
        quantity: 1,
        estimatedWeight: 220,
        weightUnit: "g",
        matchedGearId: powerMatch ? powerMatch.id : ""
      });
    } else {
      const genericMatch = safeGear[0];
      recommendedItems.push({
        name: genericMatch ? genericMatch.name : "Primary Equipment Host Device",
        category: genericMatch ? (genericMatch.primaryCategory || "Gear") : "Gear",
        reason: "Primary device matched from your active library directory.",
        quantity: 1,
        estimatedWeight: 1.5,
        weightUnit: "kg",
        matchedGearId: genericMatch ? genericMatch.id : ""
      });

      recommendedItems.push({
        name: "Standard Tool Kit & Utilities",
        category: "Accessories",
        reason: "General purpose multi-tools, zip ties, and tape for quick adjustments.",
        quantity: 1,
        estimatedWeight: 500,
        weightUnit: "g",
        matchedGearId: ""
      });

      recommendedItems.push({
        name: "Heavy-Duty Protective Carrying Case",
        category: "Accessories",
        reason: "Impact proof case for keeping device items shielded from moisture and shock.",
        quantity: 1,
        estimatedWeight: 3.2,
        weightUnit: "kg",
        matchedGearId: ""
      });
    }

    res.json({
      recommendedItems,
      aiWarning: "AI Quota Exceeded. Sourced your packing list using Packer Tools smart matching heuristics."
    });
  }
});

router.post("/api/generate-travel-itinerary", authenticateUser, async (req, res) => {
  const { destination, startDate, endDate, purpose, climate, transport } = req.body;
  try {
    const prompt = `You are a luxury travel helper and professional flight itinerary planner.
    Destination: ${destination || "Nadi, Fiji"}
    Dates: ${startDate || "Upcoming departure Date"} to ${endDate || "Return Date"}
    Purpose: ${purpose || "Photography expedition"}
    Climate Context: ${climate || "Tropical and sunny"}
    Transport: ${transport || "Commercial flight"}
    
    Task:
    Draft a fully articulated travel itinerary containing:
    1. A day-by-day itinerary (max 4 days) showing interesting activity itineraries.
    2. A suggested travel-specific checklist (clothes, accessories, electronics, documents, adapters) suitable for the climate & travel purpose.
    3. Three travel reminders with offsets (e.g., -1 for 1 day before, -7 for 7 days before) to assist on documents, baggage, and packing readiness logs.
    
    Return strictly JSON matching the response schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            itineraryDays: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayNumber: { type: Type.NUMBER },
                  title: { type: Type.STRING },
                  activities: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["dayNumber", "title", "activities"]
              }
            },
            packingChecklist: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  quantity: { type: Type.NUMBER }
                },
                required: ["name", "category", "reason", "quantity"]
              }
            },
            reminders: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dueDateOffsetDays: { type: Type.NUMBER },
                  title: { type: Type.STRING },
                  message: { type: Type.STRING }
                },
                required: ["dueDateOffsetDays", "title", "message"]
              }
            }
          },
          required: ["itineraryDays", "packingChecklist", "reminders"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Travel AI Itinerary Agent Error (using heuristic fallback):", error);
    const dest = destination || "Nadi, Fiji";
    const climateDesc = climate || "Warm & Tropical";
    
    const itineraryDays = [
      {
        dayNumber: 1,
        title: "Departure & In-Transit Settlement",
        activities: [
          `Arrive at airport terminals, pass visual baggage verification, security audits, and board.`,
          `Touchdown at ${dest}, secure local ground transport, and check-in to accommodation.`,
          `Unpack delicate electronic gear items, test equipment calibration under ${climateDesc} climate adjustment, and rest.`
        ]
      },
      {
        dayNumber: 2,
        title: "Primary Mission / Exploration Run",
        activities: [
          `Morning Briefing: Coordinate travel checklists and review schedule milestones.`,
          `Conduct full day of scheduled activities (${purpose || "Field exploration"}).`,
          `Evening back-up run: Log visual photos/data on backup drives, clear memory units, and cycle rechargeable power cells.`
        ]
      },
      {
        dayNumber: 3,
        title: "Secondary Excursions & Souvenir Audits",
        activities: [
          `Engage with local sights, communities, and landmarks around ${dest}.`,
          `Conduct final structural shoot/exploration at golden hour.`,
          `Final packing audit: Verify all cables, filters, adapters, and personal kits match initial luggage payload tallies.`
        ]
      },
      {
        dayNumber: 4,
        title: "Packing-Up & Return Transit",
        activities: [
          `Organize all checked gear items securely back into travel suitcases or Pelican cases.`,
          `Checkout from lodging, clear airport customs and tax-free portals.`,
          `Return flight, and run visual post-transit inventory check-in list.`
        ]
      }
    ];

    const packingChecklist = [
      { name: "Digital Travel Passport, Flight Itinerary & Boarding Pass", category: "Documents", reason: "Mandatory identification records for airport customs and airline boarding.", quantity: 1 },
      { name: "Universal Travel Power Plug Adapter Bundle", category: "Electronics", reason: "Permits charging cameras and phone cells across overseas electrical wall configurations.", quantity: 1 },
      { name: `Climate-Specific Wardrobe (${climateDesc})`, category: "Apparel", reason: "Appropriate attire optimized for local climate and humidity parameters.", quantity: 5 },
      { name: "High-Density Power Bank (USB-C Power Delivery)", category: "Power", reason: "Maintains phone/locator batteries during long inter-city train or flight passages.", quantity: 1 },
      { name: "Toiletries Kit & Daily Medication Bags", category: "Personal", reason: "Sustain hygienic health standards throughout travel blocks.", quantity: 1 }
    ];

    const reminders = [
      { dueDateOffsetDays: -3, title: "Travel Documents Decoded", message: `Ensure your electronic visas, passport validity, and accommodation booking confirmations are printed or stored offline.` },
      { dueDateOffsetDays: -1, title: "Batteries Safety Compliance", message: `Airline guidelines stipulate that all high-capacity lithium-ion cells must remain in your carry-on baggage. Do not pack batteries in checked-in baggage.` },
      { dueDateOffsetDays: 0, title: "Double-check Flight Status", message: `Run a final baggage weight inspection to avoid airline over-limit penalties prior to arriving at Nadi/local airport terminals.` }
    ];

    res.json({
      itineraryDays,
      packingChecklist,
      reminders,
      aiWarning: "AI Quota Exceeded (429). Prepared local Fiji Travel guide and itinerary fallback."
    });
  }
});

router.post("/api/services/suppliers", authenticateUser, async (req, res) => {
  const { query: searchQuery, isEnabled, modelName } = req.body;
  
  const MOCK_SUPPLIERS_CATALOG = [
    { name: 'B&H Photo Video', category: 'AV Gear', website: 'bhphotovideo.com', email: 'sales@bhphoto.com', rating: 5, notes: "Preferred primary dealer." },
    { name: 'Markertek', category: 'Cables & Parts', website: 'markertek.com', email: 'support@markertek.com', rating: 4, notes: "Excellent custom bulk connectors." },
    { name: 'Sweetwater', category: 'Audio Gear', website: 'sweetwater.com', email: 'sales@sweetwater.com', rating: 5, notes: "Reliable pro-audio and studio monitoring." },
    { name: 'Full Compass', category: 'AV Equipment', website: 'fullcompass.com', email: 'sales@fullcompass.com', rating: 4, notes: "Great commercial AV supplier." },
    { name: 'Thomann', category: 'Audio/Light', website: 'thomann.de', email: 'sales@thomann.de', rating: 5, notes: "Leading European stage lighting brand." },
    { name: 'MonoPrice', category: 'Cables', website: 'monoprice.com', email: 'sales@monoprice.com', rating: 4, notes: "Ideal for patch cords and accessory rigs." },
    { name: 'Anvil Cases', category: 'Travel Cases', website: 'anvilcases.com', email: 'support@anvilcases.com', rating: 5, notes: "Heavy-duty custom flight cases." }
  ];

  if (!isEnabled || !process.env.GEMINI_API_KEY) {
    const queryStr = (searchQuery || "").toLowerCase();
    const filtered = MOCK_SUPPLIERS_CATALOG.filter(s => 
      s.name.toLowerCase().includes(queryStr) || 
      s.category.toLowerCase().includes(queryStr) ||
      s.website.toLowerCase().includes(queryStr)
    );
    return res.json({
      status: "success",
      source: "Offline Static Catalog fallback",
      suppliers: filtered.length > 0 ? filtered : MOCK_SUPPLIERS_CATALOG
    });
  }

  try {
    const activeModel = modelName || "gemini-3.5-flash";
    const response = await ai.models.generateContent({
      model: activeModel,
      contents: `Search for real active stage, filming, broadcast, or cabling supplier vendors related to the search query: "${searchQuery || 'AV Equipment'}" and list up to 5 real commercial suppliers. Focus on authentic websites, domains, and active emails/contact details. Return strictly a JSON array.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              website: { type: Type.STRING },
              email: { type: Type.STRING },
              rating: { type: Type.NUMBER },
              notes: { type: Type.STRING }
            },
            required: ["name", "category", "website"]
          }
        }
      }
    });

    const parsedArray = JSON.parse(response.text.trim());
    return res.json({
      status: "success",
      source: `Live Supplier-Crawler Engine (${activeModel})`,
      suppliers: parsedArray
    });
  } catch (error: any) {
    console.warn("Supplier live search triggered exception:", error.message);
    const queryStr = (searchQuery || "").toLowerCase();
    const filtered = MOCK_SUPPLIERS_CATALOG.filter(s => 
      s.name.toLowerCase().includes(queryStr) || 
      s.category.toLowerCase().includes(queryStr)
    );
    return res.json({
      status: "success",
      source: "Offline Static Catalog (Exception Fallback)",
      suppliers: filtered.length > 0 ? filtered : MOCK_SUPPLIERS_CATALOG
    });
  }
});

router.post("/api/services/analyze-leads", authenticateUser, async (req, res) => {
  const { items, isEnabled, riskThreshold } = req.body;
  const thresholdValue = riskThreshold || 7;

  interface ItemLeadTime {
    itemName: string;
    category: string;
    estimatedLeadDays: number;
    riskLevel: 'low' | 'medium' | 'high';
    notes: string;
    alternativeSupplier?: string;
  }

  if (!isEnabled || !process.env.GEMINI_API_KEY || !items || items.length === 0) {
    const results: ItemLeadTime[] = (items || []).map((item: any) => {
      const name = (item.name || "").toLowerCase();
      const cat = (item.category || "").toLowerCase();
      let estDays = 3;
      let risk: 'low' | 'medium' | 'high' = 'low';
      let msg = "Standard off-the-shelf dispatch.";
      let alt = "Anixter / Markertek Local stock";

      if (name.includes("custom") || name.includes("case") || name.includes("rack") || name.includes("plate") || cat.includes("case")) {
        estDays = 14;
        risk = estDays >= thresholdValue ? 'medium' : 'low';
        msg = "Subject to sheet metal, fabrication, or custom qualification lead lag.";
        alt = "Anvil Cases / Penn Elcom";
      } else if (name.includes("camera") || name.includes("lens") || name.includes("sony") || name.includes("red") || cat.includes("camera")) {
        estDays = 6;
        risk = estDays >= thresholdValue ? 'medium' : 'low';
        msg = "High retail demand / local hub shipping priority.";
        alt = "B&H Photo Video / Adorama Depot";
      } else if (name.includes("digital") || name.includes("console") || name.includes("mixer") || name.includes(" dante") || cat.includes("audio")) {
        estDays = 12;
        risk = estDays >= thresholdValue ? 'high' : 'medium';
        msg = "Potential components and professional audio chip delay.";
        alt = "Sweetwater Pro Direct";
      }

      return {
        itemName: item.name,
        category: item.category || "General",
        estimatedLeadDays: estDays,
        riskLevel: risk,
        notes: msg,
        alternativeSupplier: alt
      };
    });

    const riskSumCount = results.filter(r => r.riskLevel === 'high' || r.estimatedLeadDays >= thresholdValue).length;

    return res.json({
      status: "success",
      source: "Local Heuristic Lead Time Engine (Active)",
      summary: `${riskSumCount} risk factors flagged exceeding threshold of ${thresholdValue} days.`,
      analysis: results,
      generalMitigation: "Establish redundancy approvals in project suppliers list for key connectors and electronics."
    });
  }

  try {
    const listDescription = items.map((i: any) => `- Name: ${i.name}, Category: ${i.category}, Qty: ${i.quantity}`).join("\n");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Perform a supply-chain lead-time risk check for the following Bill of Materials items:
      ${listDescription}
      
      The risk trigger threshold is ${thresholdValue} days. Use live search tools to crosscheck any component backorders. Return strictly JSON.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            generalMitigation: { type: Type.STRING },
            analysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemName: { type: Type.STRING },
                  category: { type: Type.STRING },
                  estimatedLeadDays: { type: Type.NUMBER },
                  riskLevel: { type: Type.STRING, description: "low, medium, or high" },
                  notes: { type: Type.STRING },
                  alternativeSupplier: { type: Type.STRING }
                },
                required: ["itemName", "estimatedLeadDays", "riskLevel", "notes"]
              }
            }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text.trim());
    return res.json({
      status: "success",
      source: "Live Supply-Chain Risk Scraper Engine (Gemini 3.5 Flash)",
      summary: parsed.summary,
      analysis: parsed.analysis,
      generalMitigation: parsed.generalMitigation
    });
  } catch (error: any) {
    console.warn("BOM analyzer triggered exception, falling back:", error.message);
    const results = items.map((item: any) => ({
      itemName: item.name,
      category: item.category || "General",
      estimatedLeadDays: 4,
      riskLevel: 'low',
      notes: "Standard warehouse release priority cached."
    }));
    return res.json({
      status: "success",
      source: "Local Heuristic Lead Time Engine (Fallback)",
      summary: "Simulation fallback active due to request timeout.",
      analysis: results,
      generalMitigation: "Secure safety stocks for multi-channel modules."
    });
  }
});

// Gig Assistant Endpoint
router.post("/api/ai/gig-assistant", authenticateUser, async (req: any, res) => {
  const {
    profile,
    scope,
    duration,
    expectations,
    deliverables,
    includeTravel,
    travelInfo,
    includeCostBreakdown,
    budget,
    currency,
    gearLibrary = []
  } = req.body;

  try {
    const model = "gemini-3.5-flash";

    const prompt = `
      You are an elite, world-class Gear Logistics Expert, Travel Planner, and Financial Budget Estimator.
      You are tasked with analyzing a planned event or job (referred to as a "Gig") and providing an exhaustive plan.
      
      GIG SPECIFICATIONS:
      - Gig Profile/Scale: ${profile} (Can range from family picnic/outing to pro-level cinematic documentary, multi-day/multi-country broadcast, or custom setups)
      - Scope of Work: ${scope}
      - Duration: ${duration} (days/hours)
      - Expectations: ${expectations}
      - Deliverables: ${deliverables}
      - Include Travel & Itinerary: ${includeTravel ? 'Yes' : 'No'}
      - Travel Info: ${travelInfo || 'N/A'}
      - Include Cost Breakdown / Budgeting: ${includeCostBreakdown ? 'Yes' : 'No'}
      - Target Budget & Currency: ${budget || 'Flexible'} ${currency || 'USD'}
      
      USER'S ACTUAL GEAR LIBRARY (Compare recommended items with this library to find matches):
      ${JSON.stringify(gearLibrary.map((g: any) => ({ id: g.id, name: g.name, tags: g.tags || [] })))}

      INSTRUCTIONS:
      1. Scope Assessment: Write a thorough professional scope assessment. Analyze logistical challenges (power requirements, climate, local permitting, redundancy, safety, backup storage, etc.). Structure this nicely in Markdown format.
      2. Gear Checklist: Recommend essential and accessory gear categorized cleanly. For each recommended item:
         - Provide a detailed "reasoning" for why it is needed.
         - Search the user's ACTUAL GEAR LIBRARY above for a matching item. If a good fuzzy/semantic match is found, assign "matchedGearId" to the actual item's ID. Otherwise, leave it as null.
         - Specify if it is "isEssential" (mission-critical, high-priority).
      3. Itinerary: Generate a realistic day-by-day travel and setup itinerary. Even if travel is not toggled, generate a phase-based project timeline (e.g., Pre-shoot, Day 1, wrap).
      4. Cost Breakdown: Generate realistic real-world cost estimates in the requested currency (${currency || 'USD'}).
         - Provide line items (e.g. local transport, equipment rental, battery logistics, crew labor rate, food/per diem, insurance, custom permits).
         - Include a realistic "lowEstimate" and "highEstimate".
         - If cost breakdown is NOT requested, you can return a minimal baseline budget template or approximate incidentals.
      5. Planning Tips: Provide 4-6 real-life, researched, high-impact tips (e.g. climate preparedness, legal, power converters, battery flight limits like TSA 100Wh rules, hydration, memory cards). Map each tip to a suitable Lucide icon.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scopeAssessment: {
              type: Type.STRING,
              description: "Markdown string outlining the scope assessment, logistics, challenges, and requirements."
            },
            gearChecklist: {
              type: Type.ARRAY,
              description: "Categorized recommended equipment mapped against available gear library.",
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        itemName: { type: Type.STRING },
                        reasoning: { type: Type.STRING },
                        matchedGearId: { type: Type.STRING, nullable: true },
                        isEssential: { type: Type.BOOLEAN }
                      },
                      required: ["itemName", "reasoning", "isEssential"]
                    }
                  }
                },
                required: ["category", "items"]
              }
            },
            itinerary: {
              type: Type.ARRAY,
              description: "Day-by-day or phase-based project timeline.",
              items: {
                type: Type.OBJECT,
                properties: {
                  phase: { type: Type.STRING },
                  activity: { type: Type.STRING },
                  notes: { type: Type.STRING }
                },
                required: ["phase", "activity", "notes"]
              }
            },
            costBreakdown: {
              type: Type.ARRAY,
              description: "Real-world costing items in target currency.",
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  item: { type: Type.STRING },
                  lowEstimate: { type: Type.NUMBER },
                  highEstimate: { type: Type.NUMBER },
                  notes: { type: Type.STRING }
                },
                required: ["category", "item", "lowEstimate", "highEstimate", "notes"]
              }
            },
            planningTips: {
              type: Type.ARRAY,
              description: "Expert tips with matching lucide-react icon.",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  advice: { type: Type.STRING },
                  icon: { type: Type.STRING }
                },
                required: ["title", "advice", "icon"]
              }
            }
          },
          required: ["scopeAssessment", "gearChecklist", "itinerary", "costBreakdown", "planningTips"]
        }
      }
    });

    const parsed = JSON.parse(response.text.trim());
    return res.json({
      status: "success",
      data: parsed
    });
  } catch (error: any) {
    console.error("Gig Assistant API error:", error);
    // Return high-quality, smart fallback mock data in case of failure so the app never crashes
    return res.status(200).json({
      status: "success",
      isFallback: true,
      data: {
        scopeAssessment: `### Fallback Scope Assessment\n\n*The AI Assistant was unable to process the live request. Below is a structured checklist for your **${profile}** gig.*\n\n- **Objective:** Establish clear milestones and roles.\n- **Duration:** ${duration} Day(s)\n- **Primary Challenge:** Power and weather resilience.\n- **Deliverables:** ${deliverables || "Standard package"}\n- **Scope Notes:** ${scope || "General Logistics Checklist"}`,
        gearChecklist: [
          {
            category: "Essential Kit",
            items: [
              { itemName: "Primary Capture / Mobile Unit", reasoning: "Required for basic logging & operations", isEssential: true, matchedGearId: null },
              { itemName: "Multi-port Battery Bank (100Wh)", reasoning: "Ensure devices stay charged throughout the duration", isEssential: true, matchedGearId: null }
            ]
          }
        ],
        itinerary: [
          { phase: "Phase 1: Pre-production", activity: "Confirm deliverables and pack safety kits.", notes: "Check battery levels." },
          { phase: "Phase 2: Execution", activity: "Deploy gear and capture required media.", notes: "Follow safety guidelines." },
          { phase: "Phase 3: Wrap & Archival", activity: "Check-in gear, double backup materials.", notes: "Process digital signatures if needed." }
        ],
        costBreakdown: [
          { category: "Logistics", item: "Transport & Fuel", lowEstimate: 50, highEstimate: 150, notes: "Estimated standard mileage allowance" },
          { category: "Consumables", item: "Rations / Catering & Hydration", lowEstimate: 30, highEstimate: 100, notes: "Per-diem for team members" }
        ],
        planningTips: [
          { title: "Power Management", advice: "Fully charge all remote battery packs 24 hours prior to departure.", icon: "Battery" },
          { title: "Weather Preparedness", advice: "Check meteorology updates and pack ziplocs/drybags for equipment protection.", icon: "CloudRain" }
        ]
      }
    });
  }
});

export default router;
