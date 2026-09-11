import { NextResponse } from "next/server";
import { validarRegisto } from "@/lib/auth/validacao";
import { registarUtilizador } from "@/lib/db/utilizadores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Cria um pedido de acesso: a conta fica pendente e só entra depois de um administrador a aprovar. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const v = validarRegisto(body);
  if (!v.ok) return NextResponse.json({ erro: v.erro }, { status: 400 });
  try {
    const r = await registarUtilizador(v.valor);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status });
    return NextResponse.json(
      { pendente: true, mensagem: "Conta criada. Aguarde a aprovação de um administrador para entrar." },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: "Não foi possível criar a conta. Tente novamente." }, { status: 500 });
  }
}
