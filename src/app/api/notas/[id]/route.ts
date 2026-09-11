import { NextResponse } from "next/server";
import { obterUtilizadorAtual, respostaNaoAutenticado } from "@/lib/auth/sessao";
import { obterNota } from "@/lib/db/notas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Notas registadas são imutáveis: apenas leitura (não há PUT nem DELETE). */
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
