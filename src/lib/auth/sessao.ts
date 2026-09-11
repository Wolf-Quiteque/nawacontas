import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { cache } from "react";
import { COOKIE_SESSAO, type Utilizador } from "./constantes";
import { utilizadorDoToken } from "./sessoes-db";

/** Utilizador da sessão atual (uma consulta por pedido). */
export const obterUtilizadorAtual = cache(async (): Promise<Utilizador | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  return utilizadorDoToken(token);
});

/** Para páginas: redireciona para /entrar quando não há sessão válida. */
export async function exigirUtilizador(): Promise<Utilizador> {
  const utilizador = await obterUtilizadorAtual();
  if (!utilizador) redirect("/entrar");
  return utilizador;
}

export function respostaNaoAutenticado() {
  return NextResponse.json({ erro: "Sessão expirada. Entre novamente." }, { status: 401 });
}
