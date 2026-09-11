import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VerNota } from "@/components/VerNota";
import { exigirUtilizador, obterUtilizadorAtual } from "@/lib/auth/sessao";
import { obterNota } from "@/lib/db/notas";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const utilizador = await obterUtilizadorAtual().catch(() => null);
  const nota = utilizador ? await obterNota(id).catch(() => null) : null;
  return { title: nota ? `Nota N.º ${nota.numero} · NawaNotas` : "Nota · NawaNotas" };
}

export default async function Page({ params }: Props) {
  await exigirUtilizador();
  const { id } = await params;
  const nota = await obterNota(id);
  if (!nota) notFound();
  return <VerNota nota={nota} />;
}
