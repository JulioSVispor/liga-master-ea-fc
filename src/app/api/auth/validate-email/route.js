import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      allowed: false,
      message: "A elegibilidade é validada durante o cadastro.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
