// Device location for the home location pill.
//
// Strategy: try the REAL device GPS first (with the runtime location permission + reverse-geocode
// to a city name). If the user denies permission, has location off, or GPS times out, fall back to
// IP-based geolocation (no permission) so the pill still shows something sensible. A total miss
// returns null and the caller shows a tappable "Set location" hint instead of a wrong guess.

import * as Location from 'expo-location';

export interface DetectedCity {
  /** What the pill shows, e.g. "Bucharest, Romania". */
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

// --- Real device GPS (precise, needs permission) ---------------------------------------------
// Returns null on denied permission / disabled services / timeout → caller falls back to IP.
export async function detectGpsCity(): Promise<DetectedCity | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const p = places?.[0];
    if (!p) return null;
    // city is sometimes null on Android; fall back to the finer admin areas before giving up.
    return toCity(p.city || p.subregion || p.district || p.region, p.country);
  } catch {
    return null;
  }
}

// --- IP-based fallback (no permission) -------------------------------------------------------
// The free providers each rate-limit or hiccup occasionally (ipapi.co returns {error:true} with
// HTTP 200 when throttled), so we try a few keyless services in turn, each with a short timeout.
async function fetchJson(url: string, ms = 4000): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null; // network error, timeout/abort, or non-JSON body
  } finally {
    clearTimeout(timer);
  }
}

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

// Public: real device GPS first, IP as graceful fallback.
export async function detectCity(): Promise<DetectedCity | null> {
  return (await detectGpsCity()) ?? (await detectIpCity());
}
