import { NextResponse } from "next/server";
import { obterUtilizadorAtual, respostaNaoAutenticado } from "@/lib/auth/sessao";
import { criarNota, listarNotas } from "@/lib/db/notas";
import { validarEntrada } from "@/lib/validacao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function erro(mensagem: string, status = 500) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function GET(req: Request) {
  try {
    if (!(await obterUtilizadorAtual())) return respostaNaoAutenticado();
    const { searchParams } = new URL(req.url);
    const notas = await listarNotas({
      de: searchParams.get("de") || undefined,
      ate: searchParams.get("ate") || undefined,
      q: searchParams.get("q") || undefined,
      limite: Number(searchParams.get("limite")) || undefined,
    });
    return NextResponse.json({ notas });
  } catch (e) {
    console.error(e);
    return erro("Não foi possível obter as notas.");
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return erro("Corpo do pedido inválido.", 400);
  }
  try {
    const utilizador = await obterUtilizadorAtual();
    if (!utilizador) return respostaNaoAutenticado();
    const v = validarEntrada(body);
    if (!v.ok) return erro(v.erro, 400);
    const nota = await criarNota(v.valor, utilizador.id);
    return NextResponse.json({ nota }, { status: 201 });
  } catch (e) {
    console.error(e);
    return erro("Não foi possível guardar a nota.");
  }
}
