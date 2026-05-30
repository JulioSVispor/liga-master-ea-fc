import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const supabase = createServerClient();
    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase
      .from('allowed_emails')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('email', normalizedEmail);

    if (error) {
      console.error('Erro ao marcar e-mail como usado:', error);
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro inesperado:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
