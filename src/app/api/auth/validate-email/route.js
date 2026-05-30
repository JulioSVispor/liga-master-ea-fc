import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ allowed: false, reason: 'invalid_input' }, { status: 400 });
    }

    const supabase = createServerClient();
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase
      .from('allowed_emails')
      .select('id, used')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error('Erro ao validar e-mail:', error);
      return NextResponse.json({ allowed: false, reason: 'server_error' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ allowed: false, reason: 'not_found' });
    }

    if (data.used) {
      return NextResponse.json({ allowed: false, reason: 'already_used' });
    }

    return NextResponse.json({ allowed: true });
  } catch (err) {
    console.error('Erro inesperado na validação:', err);
    return NextResponse.json({ allowed: false, reason: 'server_error' }, { status: 500 });
  }
}
