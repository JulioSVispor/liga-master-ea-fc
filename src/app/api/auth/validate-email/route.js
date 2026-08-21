import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const attempts = new Map();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

function isRateLimited(key) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > MAX_ATTEMPTS;
}

export async function POST(request) {
  try {
    const clientKey = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(clientKey)) {
      return NextResponse.json({ allowed: false }, { status: 429, headers: { 'Retry-After': '60' } });
    }
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ allowed: false }, { status: 400 });
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
      return NextResponse.json({ allowed: false }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ allowed: false });
    }

    if (data.used) {
      return NextResponse.json({ allowed: false });
    }

    return NextResponse.json({ allowed: true });
  } catch (err) {
    console.error('Erro inesperado na validação:', err);
    return NextResponse.json({ allowed: false }, { status: 500 });
  }
}
