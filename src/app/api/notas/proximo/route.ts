import { NextResponse } from "next/server";
import { proximoNumero } from "@/lib/db/notas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const numero = await proximoNumero();
    return NextResponse.json({ numero });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: "Não foi possível obter o próximo número." }, { status: 500 });
  }
}
