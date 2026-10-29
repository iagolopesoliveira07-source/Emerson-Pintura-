import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function isPublicSite() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('vercel.app');
}

/** No site público os dados e a senha são partilhados. No localhost ficam só neste navegador, para testes. */
export const useSharedSystem = Boolean(isSupabaseConfigured && isPublicSite());

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
