import { NextResponse } from "next/server";
import { obterUtilizadorAtual, respostaNaoAutenticado, respostaProibido } from "@/lib/auth/sessao";
import { eliminarNota, obterNota } from "@/lib/db/notas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Notas registadas não podem ser alteradas (não há PUT); só administradores as eliminam. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    if (!(await obterUtilizadorAtual())) return respostaNaoAutenticado();
    const nota = await obterNota(id);
    if (!nota) return NextResponse.json({ erro: "Nota não encontrada." }, { status: 404 });
    return NextResponse.json({ nota });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: "Não foi possível obter a nota." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const utilizador = await obterUtilizadorAtual();
    if (!utilizador) return respostaNaoAutenticado();
    if (!utilizador.admin) return respostaProibido("Apenas administradores podem eliminar notas.");
    const eliminada = await eliminarNota(id, utilizador.id);
    if (!eliminada) return NextResponse.json({ erro: "Nota não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true, ...eliminada });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: "Não foi possível eliminar a nota." }, { status: 500 });
  }
}
