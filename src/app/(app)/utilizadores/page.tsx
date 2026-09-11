import type { Metadata } from "next";
import { GestaoUtilizadores } from "@/components/GestaoUtilizadores";
import { exigirAdmin } from "@/lib/auth/sessao";
import { listarUtilizadores } from "@/lib/db/utilizadores";

export const metadata: Metadata = { title: "Utilizadores · NawaNotas" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const utilizador = await exigirAdmin();
  const utilizadores = await listarUtilizadores();
  return <GestaoUtilizadores utilizadores={utilizadores} atualId={utilizador.id} />;
}
