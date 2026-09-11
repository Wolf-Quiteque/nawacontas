import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioAuth } from "@/components/FormularioAuth";
import { destinoSeguro } from "@/lib/auth/constantes";
import { obterUtilizadorAtual } from "@/lib/auth/sessao";

export const metadata: Metadata = { title: "Entrar · NawaNotas" };

type Props = { searchParams: Promise<{ voltar?: string | string[] }> };

export default async function Page({ searchParams }: Props) {
  const { voltar } = await searchParams;
  const destino = destinoSeguro(Array.isArray(voltar) ? voltar[0] : voltar);
  const utilizador = await obterUtilizadorAtual().catch(() => null);
  if (utilizador) redirect(destino);
  return <FormularioAuth modo="entrar" destino={destino} />;
}
