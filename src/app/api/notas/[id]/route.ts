import { NextResponse } from "next/server";
import { atualizarNota, eliminarNota, obterNota } from "@/lib/db/notas";
import { validarEntrada } from "@/lib/validacao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function erro(mensagem: string, status = 500) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const nota = await obterNota(id);
    if (!nota) return erro("Nota não encontrada.", 404);
    return NextResponse.json({ nota });
  } catch (e) {
    console.error(e);
    return erro("Não foi possível obter a nota.");
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return erro("Corpo do pedido inválido.", 400);
  }
  const v = validarEntrada(body);
  if (!v.ok) return erro(v.erro, 400);
  try {
    const nota = await atualizarNota(id, v.valor);
    if (!nota) return erro("Nota não encontrada.", 404);
    return NextResponse.json({ nota });
  } catch (e) {
    console.error(e);
    return erro("Não foi possível atualizar a nota.");
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const ok = await eliminarNota(id);
    if (!ok) return erro("Nota não encontrada.", 404);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return erro("Não foi possível eliminar a nota.");
  }
}
