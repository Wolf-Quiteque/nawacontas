import { Shell } from "@/components/Shell";
import { exigirUtilizador } from "@/lib/auth/sessao";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const utilizador = await exigirUtilizador();
  return <Shell utilizador={utilizador}>{children}</Shell>;
}
