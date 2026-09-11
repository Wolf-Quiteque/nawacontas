import type { Metadata } from "next";
import { HistoricoLista } from "@/components/HistoricoLista";
import { exigirUtilizador } from "@/lib/auth/sessao";

export const metadata: Metadata = { title: "Histórico · NawaNotas" };

export default async function Page() {
  await exigirUtilizador();
  return <HistoricoLista />;
}
