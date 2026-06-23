// App localization (i18n) — react-i18next with bundled JSON locales.
//
// The language menu (ProfileScreen → LanguageSheet) calls setLanguage(code); the choice is
// persisted to a tiny file so it survives app restarts. On first launch we guess from the device
// locale (via Intl) and fall back to English. Importing this module initializes i18next as a
// side effect — App.tsx imports it once before anything renders.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
// SDK 56 moved the function-based file API to the /legacy entry; it's stable and enough here.
import * as FileSystem from 'expo-file-system/legacy';

import en from './locales/en.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import es from './locales/es.json';
import it from './locales/it.json';
import pl from './locales/pl.json';
import ro from './locales/ro.json';
import el from './locales/el.json';

export interface Language {
  code: string;
  /** English name (for the model / debugging). */
  label: string;
  /** Endonym — how speakers write their own language. */
  native: string;
  flag: string;
}

// The 8 demo languages. Endonyms + flags are what the menu shows; codes match the JSON files
// and the i18n codes the backend maps to a spoken language for Hoppy.
export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'German', native: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Spanish', native: 'Español', flag: '🇪🇸' },
  { code: 'it', label: 'Italian', native: 'Italiano', flag: '🇮🇹' },
  { code: 'pl', label: 'Polish', native: 'Polski', flag: '🇵🇱' },
  { code: 'ro', label: 'Romanian', native: 'Română', flag: '🇷🇴' },
  { code: 'el', label: 'Greek', native: 'Ελληνικά', flag: '🇬🇷' },
];

const SUPPORTED = LANGUAGES.map((l) => l.code);

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  de: { translation: de },
  es: { translation: es },
  it: { translation: it },
  pl: { translation: pl },
  ro: { translation: ro },
  el: { translation: el },
};

// Best-effort device language via Intl (Hermes ships Intl). Falls back to English.
function deviceLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale; // e.g. "fr-FR"
    const base = locale.split('-')[0].toLowerCase();
    return SUPPORTED.includes(base) ? base : 'en';
  } catch {
    return 'en';
  }
}

const PREF_FILE = `${FileSystem.documentDirectory ?? ''}language.txt`;

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED,
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

/** Restore a previously saved language (overrides the device-locale default). Call once on boot. */
export async function loadSavedLanguage(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(PREF_FILE);
    if (!info.exists) return;
    const code = (await FileSystem.readAsStringAsync(PREF_FILE)).trim();
    if (SUPPORTED.includes(code) && code !== i18n.language) {
      await i18n.changeLanguage(code);
    }
  } catch {
    /* no saved preference — keep the device/default language */
  }
}

/** Switch language now and persist the choice for next launch. */
export async function setLanguage(code: string): Promise<void> {
  if (!SUPPORTED.includes(code)) return;
  await i18n.changeLanguage(code);
  try {
    await FileSystem.writeAsStringAsync(PREF_FILE, code);
  } catch {
    /* persistence is best-effort; the in-memory switch still took effect */
  }
}

export default i18n;
