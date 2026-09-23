import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-side Supabase handle. Deliberately does NOT throw when env vars are
 * missing — AppContext uses `isSupabaseConfigured` to decide whether to try
 * the real backend at all, and falls back to local mock data otherwise (see
 * src/context/AppContext.tsx). Copy .env.example to .env.local to enable it.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
