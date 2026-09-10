import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VerNota } from "@/components/VerNota";
import { obterNota } from "@/lib/db/notas";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const nota = await obterNota(id).catch(() => null);
  return { title: nota ? `Nota N.º ${nota.numero} · NawaNotas` : "Nota · NawaNotas" };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const nota = await obterNota(id);
  if (!nota) notFound();
  return <VerNota nota={nota} />;
}
