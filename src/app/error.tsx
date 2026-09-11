"use client";

import { useEffect } from "react";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar a página</h1>
      <p className="mt-2 text-sm text-tinta-suave">Verifique a ligação à internet e tente novamente.</p>
      <button className="botao-primario mt-6" onClick={reset}>
        Tentar de novo
      </button>
    </main>
  );
}
