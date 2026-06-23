// WEB twin of location.ts. expo-location's reverseGeocodeAsync isn't supported on web, so:
//   • try the browser Geolocation API + a keyless reverse-geocode (BigDataCloud) for a precise city
//   • fall back to keyless IP geolocation (same providers as native) if denied/unavailable
// Public shape (DetectedCity, detectCity) matches the native module exactly.

export interface DetectedCity {
  label: string;
  city: string;
  country: string;
}

function toCity(city?: string | null, country?: string | null): DetectedCity | null {
  const c = (city || '').trim();
  const k = (country || '').trim();
  if (!c) return null;
  return { city: c, country: k, label: k ? `${c}, ${k}` : c };
}

async function fetchJson(url: string, ms = 4000): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// --- Browser GPS (precise, needs permission) -------------------------------------------------
function getPosition(ms = 8000): Promise<GeolocationPosition | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: ms, maximumAge: 600000 }
    );
  });
}

export async function detectGpsCity(): Promise<DetectedCity | null> {
  const pos = await getPosition();
  if (!pos) return null;
  // BigDataCloud's reverse-geocode is keyless and CORS-enabled.
  const j = await fetchJson(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}`
      + `&longitude=${pos.coords.longitude}&localityLanguage=en`
  );
  if (!j) return null;
  return toCity(j.city || j.locality || j.principalSubdivision, j.countryName);
}

// --- IP fallback (no permission) -------------------------------------------------------------
type Parsed = { city?: string; country?: string } | null;

const PROVIDERS: { url: string; parse: (j: any) => Parsed }[] = [
  { url: 'https://ipapi.co/json/', parse: (j) => (j && !j.error ? { city: j.city, country: j.country_name } : null) },
  { url: 'https://ipwho.is/', parse: (j) => (j && j.success !== false ? { city: j.city, country: j.country } : null) },
  { url: 'https://get.geojs.io/v1/ip/geo.json', parse: (j) => (j ? { city: j.city, country: j.country } : null) },
];

export async function detectIpCity(): Promise<DetectedCity | null> {
  for (const p of PROVIDERS) {
    const parsed = p.parse(await fetchJson(p.url));
    const found = toCity(parsed?.city, parsed?.country);
    if (found) return found;
  }
  return null;
}

export async function detectCity(): Promise<DetectedCity | null> {
  return (await detectGpsCity()) ?? (await detectIpCity());
}
