import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * The single shared household account. Supabase needs an identifier behind
 * every password, so the app supplies this one and the sign-in screen asks
 * only for the password.
 */
export const HOUSEHOLD_EMAIL = import.meta.env.VITE_HOUSEHOLD_EMAIL

/** False when any of the three are missing, so the app can show setup help. */
export const isSupabaseConfigured = Boolean(url && anonKey && HOUSEHOLD_EMAIL)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // No magic links to catch on the way back in.
        detectSessionInUrl: false,
      },
    })
  : null
