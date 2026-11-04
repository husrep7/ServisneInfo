import axios from "axios";
import { config } from "../config";
import { db } from "../db";

// Objekti u blizini (bankomat, pumpa, pošta, apoteka, banka) iz OpenStreetMapa (ADR-0004).
// Jednom dnevno se cijeli Kanton uveze u tabelu places (jedan Overpass upit, ~600 objekata),
// a "u blizini" je PostGIS upit nad našom bazom: brzo i bez zavisnosti od javnih servera
// u trenutku kad korisnik otvori aplikaciju.

export const PLACE_CATEGORIES = ["atm", "fuel", "post", "pharmacy", "bank"] as const;
export type PlaceCategory = typeof PLACE_CATEGORIES[number];

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  atm: "Bankomat", fuel: "Pumpa", post: "Pošta", pharmacy: "Apoteka", bank: "Banka",
};

const AMENITY_CATEGORY: Record<string, PlaceCategory> = {
  atm: "atm", fuel: "fuel", post_office: "post", pharmacy: "pharmacy", bank: "bank",
};

// Kanton Sarajevo (jug, zapad, sjever, istok)
const CANTON_BBOX = "43.70,18.10,44.05,18.65";

export interface Place {
  id:            string;
  category:      PlaceCategory;
  name:          string;
  lat:           number;
  lng:           number;
  distance_m:    number;
  address:       string | null;
  opening_hours: string | null;
  // Brend ili operator iz OSM-a ("UniCredit Bank"), za logo banke na webu
  brand:         string | null;
  // Aktivni prekid struje ili interneta čija zona pokriva objekat: možda ne radi
  outages:       string[];
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// Javni Overpass serveri su često preopterećeni: OVERPASS_URL može biti lista (zarezom), pokušava se redom
const OVERPASS_URLS = config.overpassUrl.split(",").map((u) => u.trim()).filter(Boolean);

// HTTP poziv prema Overpassu; testovi ga zamjenjuju
export const overpass = {
  query: async (ql: string): Promise<OverpassElement[]> => {
    let lastError: unknown = new Error("OVERPASS_URL nije postavljen");
    for (const url of OVERPASS_URLS) {
      try {
        const res = await axios.post<{ elements: OverpassElement[] }>(url, `data=${encodeURIComponent(ql)}`, {
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ServisneInfo/1.0 (info@servisneinfo.ba)" },
          timeout: 150_000,
        });
        return res.data.elements ?? [];
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  },
};

export const IMPORT_QUERY =
  `[out:json][timeout:120];(nwr["amenity"~"^(atm|fuel|post_office|pharmacy|bank)$"](${CANTON_BBOX}););out center tags;`;

export interface ImportedPlace {
  osmId:        string;
  category:     PlaceCategory;
  name:         string;
  address:      string | null;
  openingHours: string | null;
  brand:        string | null;
  hasAtm:       boolean;
  lat:          number;
  lng:          number;
}

export function toImportedPlace(el: OverpassElement): ImportedPlace | null {
  const tags = el.tags ?? {};
  const category = AMENITY_CATEGORY[tags.amenity ?? ""];
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!category || lat === undefined || lng === undefined) return null;
  const street = tags["addr:street"];
  return {
    osmId: `${el.type}/${el.id}`,
    category,
    name: tags.name ?? tags.brand ?? tags.operator ?? CATEGORY_LABEL[category],
    address: street ? (tags["addr:housenumber"] ? `${street} ${tags["addr:housenumber"]}` : street) : null,
    openingHours: tags.opening_hours ?? null,
    brand: tags.brand ?? tags.operator ?? null,
    hasAtm: category === "bank" && tags.atm === "yes",
    lat,
    lng,
  };
}

// Uvoz cijelog Kantona. Objekti koji su nestali iz OSM-a se brišu, ali samo kad je uvoz
// vratio razuman broj objekata (prazan odgovor preopterećenog servera ne smije obrisati sve).
export const MIN_IMPORT = 100;

export async function importPlaces(): Promise<number> {
  const places = (await overpass.query(IMPORT_QUERY)).map(toImportedPlace).filter((p): p is ImportedPlace => p !== null);
  if (places.length < MIN_IMPORT) throw new Error(`Overpass vratio samo ${places.length} objekata`);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows: [{ started }] } = await client.query<{ started: Date }>("SELECT NOW() AS started");
    await client.query(
      `INSERT INTO places (osm_id, category, name, address, opening_hours, brand, has_atm, location, updated_at)
       SELECT t.osm_id, t.category, t.name, t.address, t.opening_hours, t.brand, t.has_atm,
              ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326), NOW()
         FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::bool[], $7::float8[], $8::float8[], $9::text[])
           AS t(osm_id, category, name, address, opening_hours, has_atm, lng, lat, brand)
       ON CONFLICT (osm_id) DO UPDATE SET
         category = EXCLUDED.category, name = EXCLUDED.name, address = EXCLUDED.address,
         opening_hours = EXCLUDED.opening_hours, brand = EXCLUDED.brand, has_atm = EXCLUDED.has_atm,
         location = EXCLUDED.location, updated_at = NOW()`,
      [
        places.map((p) => p.osmId), places.map((p) => p.category), places.map((p) => p.name),
        places.map((p) => p.address), places.map((p) => p.openingHours), places.map((p) => p.hasAtm),
        places.map((p) => p.lng), places.map((p) => p.lat), places.map((p) => p.brand),
      ]
    );
    // NOW() je isti tokom cijele transakcije, pa su osvježeni redovi tačno updated_at = started
    await client.query("DELETE FROM places WHERE updated_at < $1", [started]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return places.length;
}

export async function nearbyPlaces(category: PlaceCategory, lat: number, lng: number, radius = 2000, limit = 8): Promise<Place[]> {
  const { rows } = await db.query<Omit<Place, "outages"> & { outages: string[] | null }>(
    `SELECT p.osm_id AS id, p.category, p.name, p.address, p.opening_hours, p.brand,
            ST_Y(p.location) AS lat, ST_X(p.location) AS lng,
            ROUND(ST_Distance(p.location::geography, me.pt::geography))::int AS distance_m,
            (SELECT array_agg(DISTINCT i.type::text) FROM incidents i
              WHERE i.status = 'active' AND i.affected_area IS NOT NULL
                -- Samo prekidi zbog kojih objekat možda ne radi (bankomat i kasa trebaju struju i mrežu)
                AND i.type IN ('electricity', 'internet')
                AND ST_Contains(i.affected_area, p.location)) AS outages
       FROM places p, (SELECT ST_SetSRID(ST_MakePoint($2, $3), 4326) AS pt) me
      WHERE (p.category = $1 OR ($1 = 'atm' AND p.has_atm))
        AND ST_DWithin(p.location::geography, me.pt::geography, $4)
      ORDER BY distance_m
      LIMIT $5`,
    [category, lng, lat, radius, limit]
  );
  return rows.map((r) => ({ ...r, outages: r.outages ?? [] }));
}

export async function placesStatus(): Promise<{ count: number; updatedAt: Date | null }> {
  const { rows } = await db.query<{ count: string; updated_at: Date | null }>(
    "SELECT COUNT(*) AS count, MAX(updated_at) AS updated_at FROM places"
  );
  return { count: Number(rows[0].count), updatedAt: rows[0].updated_at };
}
