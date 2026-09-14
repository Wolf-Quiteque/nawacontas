import { NovaNota } from "@/components/NovaNota";
import { exigirUtilizador } from "@/lib/auth/sessao";

export default async function Page() {
  const utilizador = await exigirUtilizador();
  return <NovaNota emitidoPor={utilizador.nome} />;
}
