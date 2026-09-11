import { NovaNota } from "@/components/NovaNota";
import { exigirUtilizador } from "@/lib/auth/sessao";

export default async function Page() {
  await exigirUtilizador();
  return <NovaNota />;
}
