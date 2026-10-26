import type { GeoContext } from '@/types';

// Free OpenStreetMap-based services (no keys). All are best-effort: on failure the
// app keeps working, the priority reason says the check was unavailable, and the
// cron job retries the lookup later (lib/scoring.ts).
const UA = 'NyayaSetu-siNUsoid/1.0 (civic issue tracker demo)';
const RADIUS_M = 250;

const empty = (source: GeoContext['source']): GeoContext => ({
  source, radius_m: RADIUS_M, hospitals: [], schools: [], markets: [], busStops: [], majorRoad: null,
});

// --- Provider 1: Photon (komoot's OSM geocoder). Fast, but rejects bursts. -----------------
const GROUPS = {
  hospitals: { radiusKm: RADIUS_M / 1000, tags: ['amenity:hospital', 'amenity:clinic', 'amenity:doctors'] },
  schools: { radiusKm: RADIUS_M / 1000, tags: ['amenity:school', 'amenity:college', 'amenity:kindergarten', 'amenity:university'] },
  markets: { radiusKm: RADIUS_M / 1000, tags: ['amenity:marketplace', 'shop:mall'] },
  busStops: { radiusKm: RADIUS_M / 1000, tags: ['highway:bus_stop', 'amenity:bus_station'] },
  roads: { radiusKm: 0.15, tags: ['highway:motorway', 'highway:trunk', 'highway:primary', 'highway:secondary'] },
} as const;

type PhotonFeature = { properties: { name?: string; osm_value?: string; ref?: string } };

async function photonNames(lat: number, lon: number, radiusKm: number, tags: readonly string[]): Promise<string[]> {
  const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=5&radius=${radiusKm}&` + tags.map((t) => `osm_tag=${t}`).join('&');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (res?.ok) {
      const { features = [] } = (await res.json()) as { features?: PhotonFeature[] };
      return features.map((f) => f.properties.name || f.properties.ref || (f.properties.osm_value ?? 'place').replace('_', ' '));
    }
    // A group that keeps failing fails the whole lookup: "no hospital nearby" when we simply
    // couldn't check would mis-score the issue.
    if (attempt >= 2) throw new Error(`photon ${res?.status ?? 'unreachable'}`);
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
}

async function viaPhoton(lat: number, lon: number): Promise<GeoContext> {
  // ponytail: sequential (~1 s per group) because the free server rejects bursts; self-host Photon if this gets slow.
  const found: string[][] = [];
  for (const g of Object.values(GROUPS)) found.push(await photonNames(lat, lon, g.radiusKm, g.tags));
  const [hospitals, schools, markets, busStops, roads] = found;
  return { source: 'osm', radius_m: RADIUS_M, hospitals, schools, markets, busStops, majorRoad: roads[0] ?? null };
}

// --- Provider 2: Overpass mirrors. Precise (true distance to roads) but often at capacity. ---
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

async function viaOverpass(lat: number, lon: number): Promise<GeoContext> {
  const at = `${lat},${lon}`;
  const query = `[out:json][timeout:8];(
    nwr(around:${RADIUS_M},${at})[amenity~"^(hospital|clinic|doctors)$"];
    nwr(around:${RADIUS_M},${at})[amenity~"^(school|college|kindergarten|university)$"];
    nwr(around:${RADIUS_M},${at})[amenity=marketplace];
    nwr(around:${RADIUS_M},${at})[highway=bus_stop];
    way(around:60,${at})[highway~"^(motorway|trunk|primary|secondary)$"];
  );out tags 80;`;
  for (const url of OVERPASS) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.timeout(7000),
    }).catch(() => null);
    if (!res?.ok) continue;
    const { elements = [] } = (await res.json()) as { elements?: { tags?: Record<string, string> }[] };
    const ctx = empty('osm');
    for (const { tags = {} } of elements) {
      const name = tags.name || tags['name:en'] || '';
      const a = tags.amenity, h = tags.highway;
      if (a && /^(hospital|clinic|doctors)$/.test(a)) ctx.hospitals.push(name || a);
      else if (a && /^(school|college|kindergarten|university)$/.test(a)) ctx.schools.push(name || a);
      else if (a === 'marketplace') ctx.markets.push(name || 'market');
      else if (h === 'bus_stop') ctx.busStops.push(name || 'bus stop');
      else if (h && !ctx.majorRoad) ctx.majorRoad = tags.ref || name || `${h} road`;
    }
    return ctx;
  }
  throw new Error('overpass unavailable');
}

/** Schools, hospitals, markets, bus stops and main roads around a point (OpenStreetMap data). */
export async function fetchGeoContext(lat: number, lon: number): Promise<GeoContext> {
  for (const provider of [viaPhoton, viaOverpass]) {
    try {
      return await provider(lat, lon);
    } catch { /* try the next provider */ }
  }
  return empty('unavailable');
}

export interface ReverseGeocode {
  address: string;
  city: string | null;
  state: string | null;
}

// ponytail: in-memory cache + 1 req/s throttle per server process; fine for a demo, use a shared cache if deployed at scale.
const cache = new Map<string, ReverseGeocode | null>();
let lastCall = 0;

/** Address, city and state for a point (Nominatim). Works anywhere in India. */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocode | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key)!;
  const wait = lastCall + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    const a = j.address ?? {};
    const out: ReverseGeocode = {
      address: j.display_name ?? key,
      city: a.city || a.town || a.village || a.suburb || a.county || null,
      state: a.state || null,
    };
    cache.set(key, out);
    return out;
  } catch {
    return null;
  }
}

/** True for coordinates inside India's bounding box. */
export function inIndia(lat: number, lon: number): boolean {
  return lat >= 6 && lat <= 37.5 && lon >= 68 && lon <= 97.5;
}
