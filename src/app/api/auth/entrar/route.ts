import { NextResponse } from "next/server";
import { COOKIE_SESSAO, opcoesCookieSessao, pedidoSeguro } from "@/lib/auth/constantes";
import { criarSessao } from "@/lib/auth/sessoes-db";
import { validarLogin } from "@/lib/auth/validacao";
import { autenticar } from "@/lib/db/utilizadores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const v = validarLogin(body);
  if (!v.ok) return NextResponse.json({ erro: v.erro }, { status: 400 });
  try {
    const r = await autenticar(v.valor.telefone, v.valor.senha);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status });
    const token = await criarSessao(r.utilizador.id);
    const res = NextResponse.json({ utilizador: r.utilizador });
    res.cookies.set(COOKIE_SESSAO, token, opcoesCookieSessao(pedidoSeguro(req)));
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: "Não foi possível entrar. Tente novamente." }, { status: 500 });
  }
}
