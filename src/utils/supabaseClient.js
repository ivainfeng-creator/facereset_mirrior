import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const expectedProjectRef = 'rymhaqrqalpejzzjvlxf';
const configuredProjectRef = getProjectRef(supabaseUrl);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

console.info('[Face Reset][Supabase] Client configuration', {
  configured: isSupabaseConfigured,
  hasUrl: Boolean(supabaseUrl),
  hasPublishableKey: Boolean(supabasePublishableKey),
  projectRef: configuredProjectRef || 'unavailable',
  matchesExpectedProject: configuredProjectRef === expectedProjectRef,
});

if (isSupabaseConfigured && configuredProjectRef !== expectedProjectRef) {
  console.error('[Face Reset][Supabase] Project mismatch. Expected rymhaqrqalpejzzjvlxf.', {
    actualProjectRef: configuredProjectRef || 'unavailable',
  });
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : null;

function getProjectRef(url) {
  try {
    return new URL(url).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}
