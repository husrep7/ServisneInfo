import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

// Parse free-text address description into structured list using Claude
export async function parseAddressesFromText(text: string): Promise<string[]> {
  if (!config.anthropicApiKey) {
    console.warn("No ANTHROPIC_API_KEY — skipping LLM address parsing");
    return [text];
  }

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Iz sljedećeg teksta izvuci listu ulica i adresa koje su zahvaćene prekidom komunalne usluge u Sarajevu.
Vrati SAMO JSON array stringova, bez ikakvog drugog teksta.
Primjer outputa: ["Ulica Ferhadija 1-15", "Ulica Skenderija 3-21"]

Tekst: "${text}"`,
      },
    ],
  });

  const raw = (message.content[0] as { type: string; text: string }).text.trim();
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [text];
  }
}

// Geocode a single address string to [lon, lat] using Nominatim
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const res = await axios.get<NominatimResult[]>(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: `${address}, Sarajevo, Bosnia and Herzegovina`,
          format: "json",
          limit: 1,
          addressdetails: 0,
        },
        headers: { "User-Agent": "KomunalniInfo/1.0 (komunalniinfo@example.com)" },
        timeout: 5000,
      }
    );
    if (res.data.length === 0) return null;
    const { lon, lat } = res.data[0];
    return [parseFloat(lon), parseFloat(lat)];
  } catch {
    return null;
  }
}

// Build a rough polygon by buffering ~150m around all geocoded points
export async function buildPolygonFromAddresses(
  addresses: string[]
): Promise<string | null> {
  const points: [number, number][] = [];

  for (const addr of addresses) {
    // Rate-limit: 1 req/sec per Nominatim ToS
    await new Promise((r) => setTimeout(r, 1100));
    const pt = await geocodeAddress(addr);
    if (pt) points.push(pt);
  }

  if (points.length === 0) return null;

  // ST_Buffer in PostGIS works in degrees; ~150m ≈ 0.0014 degrees at this latitude
  // We return a WKT MULTIPOINT and let PostGIS build the convex-hull buffer
  const wktPoints = points.map(([lon, lat]) => `${lon} ${lat}`).join(",");
  return `MULTIPOINT(${wktPoints})`;
}
