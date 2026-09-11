import { NextResponse } from "next/server";
import { ACOES_GESTAO, type AcaoGestao } from "@/lib/auth/constantes";
import { obterUtilizadorAtual, respostaNaoAutenticado, respostaProibido } from "@/lib/auth/sessao";
import { gerirUtilizador } from "@/lib/db/utilizadores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Ações de administrador: aprovar, remover, tornar/retirar administrador e renomear. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { acao?: unknown; nome?: unknown } | null;
  const acao = body?.acao;
  if (typeof acao !== "string" || !(ACOES_GESTAO as readonly string[]).includes(acao))
    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  try {
    const ator = await obterUtilizadorAtual();
    if (!ator) return respostaNaoAutenticado();
    if (!ator.admin) return respostaProibido();
    const r = await gerirUtilizador(ator.id, id, acao as AcaoGestao, typeof body?.nome === "string" ? body.nome : undefined);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status });
    return NextResponse.json({ utilizador: r.utilizador });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: "Não foi possível guardar a alteração." }, { status: 500 });
  }
}
