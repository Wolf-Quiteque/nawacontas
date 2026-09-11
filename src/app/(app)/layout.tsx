import { Shell } from "@/components/Shell";
import { exigirUtilizador } from "@/lib/auth/sessao";
import { contarPendentes } from "@/lib/db/utilizadores";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const utilizador = await exigirUtilizador();
  const pendentes = utilizador.admin ? await contarPendentes() : 0;
  return (
    <Shell utilizador={utilizador} pendentes={pendentes}>
      {children}
    </Shell>
  );
}
