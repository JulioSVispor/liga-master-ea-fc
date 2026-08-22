import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Cliente para uso em Route Handlers e Server Actions
// Usa a service_role key — NUNCA exposta ao browser (sem NEXT_PUBLIC_)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Atenção: SUPABASE_SERVICE_ROLE_KEY ausente! Configure em .env.local');
}

export function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
