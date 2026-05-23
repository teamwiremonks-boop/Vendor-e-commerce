import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SUPABASE CLIENT INITIALIZATION
// Grabs actual credentials from environment variables injected by AI Studio
// Supports extracting project endpoint from a PostgreSQL connection string.
// ============================================================================
const RawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://cumrqwvwvmodzzshgxot.supabase.co';

export function formatSupabaseUrl(input: string): string {
  if (!input) return 'https://your-supabase-project.supabase.co';
  const trimmed = input.trim();
  
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // Try to parse standard connection string (e.g. postgresql://postgres.ref:pass@host)
  const connectionMatch = trimmed.match(/postgres\.([a-z0-9]{20})/i);
  if (connectionMatch && connectionMatch[1]) {
    return `https://${connectionMatch[1].toLowerCase()}.supabase.co`;
  }
  
  const hostMatch = trimmed.match(/db\.([a-z0-9]{20})\.supabase\.(?:co|com)/i);
  if (hostMatch && hostMatch[1]) {
    return `https://${hostMatch[1].toLowerCase()}.supabase.co`;
  }

  // General 20-character alphanumeric project ref extraction
  const words = trimmed.split(/[^a-zA-Z0-9]/);
  for (const word of words) {
    if (word.length === 20 && /^[a-z0-9]{20}$/i.test(word)) {
      return `https://${word.toLowerCase()}.supabase.co`;
    }
  }
  
  return trimmed;
}

const SUPABASE_URL = formatSupabaseUrl(RawUrl);
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZR955bkqPNNLD6FX5ma3dA_GEsH4GQD';

export const isSupabaseConfigured = 
  SUPABASE_URL !== 'https://your-supabase-project.supabase.co' && 
  SUPABASE_ANON_KEY !== 'your-supabase-anon-key-placeholder' &&
  !!SUPABASE_URL && 
  !!SUPABASE_ANON_KEY;

// Create Supabase client instance
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// App-wide User role and profile model
export interface CurrentUserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'vendor' | 'user';
  vendorName?: string;
  storeLocation?: string;
}

// Persistent user cache key for fluid loading states
const LOCAL_STORAGE_SESSION_KEY = 'tc_contractor_profile_cache';

// Helper to get cached user profile
export function getCachedProfile(): CurrentUserProfile | null {
  const cached = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

// Helper to save user profile cache
export function setCachedProfile(profile: CurrentUserProfile | null) {
  if (profile) {
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
  }
}
