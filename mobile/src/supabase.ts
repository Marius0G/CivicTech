// Supabase client + auth helpers — real per-user accounts.
//
// One client works on BOTH native (Expo) and web (react-native-web): we persist the session in
// AsyncStorage (which has a localStorage-backed web implementation) and pull in the URL polyfill
// that supabase-js needs under React Native. `detectSessionInUrl` is off because we don't use
// the OAuth-redirect-in-URL web flow here.
//
// Every backend call attaches `authHeaders()` so the FastAPI side can identify the user and
// load/save THEIR profile. When SUPABASE_CONFIGURED is false (placeholder keys), callers fall
// back to guest/demo mode and these helpers simply return no token.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** The current access token, or null when signed out / not configured. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Authorization header for backend calls — `{}` when signed out (backend then uses demo mode). */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email: email.trim(), password });
}

/** Guest mode = an anonymous Supabase user (real token, no email). Must be enabled in the
 *  project's Auth settings; if it isn't, the caller surfaces the returned error. */
export async function signInAsGuest() {
  return supabase.auth.signInAnonymously();
}

export async function signOut() {
  return supabase.auth.signOut();
}
