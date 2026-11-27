import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Atenção: Variáveis do Supabase ausentes em .env.local!');
}

// Cliente para uso em componentes client-side ("use client")
// Usa a anon key pública — sempre protegida pelas políticas RLS do banco
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // A página de recuperação valida o tipo de código antes de liberar o formulário.
    detectSessionInUrl: typeof window !== 'undefined' && window.location.pathname !== '/reset-password',
  },
});
