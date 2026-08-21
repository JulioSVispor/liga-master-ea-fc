import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { success: false, message: 'O convite é consumido atomicamente durante o cadastro.' },
    { status: 410 }
  );
}
