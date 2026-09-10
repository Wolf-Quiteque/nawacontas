import type { Metadata } from "next";
import { HistoricoLista } from "@/components/HistoricoLista";

export const metadata: Metadata = { title: "Histórico · NawaNotas" };

export default function Page() {
  return <HistoricoLista />;
}
