import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-6xl font-bold text-laranja">404</p>
      <h1 className="mt-3 text-xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-tinta-suave">A nota pode ter sido eliminada ou a ligação está incorreta.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/historico" className="botao-secundario">
          Ver histórico
        </Link>
        <Link href="/" className="botao-primario">
          Nova nota
        </Link>
      </div>
    </div>
  );
}
