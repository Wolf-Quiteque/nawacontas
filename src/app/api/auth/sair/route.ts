import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, opcoesCookieSessao, pedidoSeguro } from "@/lib/auth/constantes";
import { terminarSessao } from "@/lib/auth/sessoes-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_SESSAO)?.value;
  if (token) {
    try {
      await terminarSessao(token);
    } catch (e) {
      console.error(e);
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESSAO, "", { ...opcoesCookieSessao(pedidoSeguro(req)), maxAge: 0 });
  return res;
}
