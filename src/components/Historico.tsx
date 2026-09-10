"use client";

import { useEffect } from "react";
import { IconeFechar, IconeLixo } from "./Icones";
import { dataPorExtenso, formatarKz, type NotaGuardada, valorLiquido } from "@/lib/nota";

interface Props {
  aberto: boolean;
  notas: NotaGuardada[];
  onFechar: () => void;
  onAbrir: (nota: NotaGuardada) => void;
  onEliminar: (id: string) => void;
}

export function Historico({ aberto, notas, onFechar, onAbrir, onEliminar }: Props) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="historico-titulo">
      <button className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" aria-label="Fechar" onClick={onFechar} />
      <div className="relative flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-linha px-5 py-4">
          <h2 id="historico-titulo" className="text-lg font-semibold">
            Histórico de notas
          </h2>
          <button className="botao-fantasma -mr-2 px-2" onClick={onFechar} aria-label="Fechar">
            <IconeFechar />
          </button>
        </div>
        <div className="overflow-y-auto px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {notas.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-tinta-suave">
              Ainda não há notas guardadas. As notas ficam aqui quando gera o PDF.
            </p>
          ) : (
            <ul className="space-y-1">
              {notas.map((n) => (
                <li key={n.id} className="group flex items-center gap-2 rounded-2xl transition hover:bg-laranja-claro/60">
                  <button className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left" onClick={() => onAbrir(n)}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amarelo-claro text-sm font-bold text-laranja-escuro">
                      {n.numero || "—"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{n.nome || "Sem nome"}</span>
                      <span className="block truncate text-xs text-tinta-suave">
                        {[n.motivo, n.periodo].filter(Boolean).join(" · ") || dataPorExtenso(n.data)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-laranja-escuro">
                      {formatarKz(valorLiquido(n))}
                    </span>
                  </button>
                  <button
                    className="botao-fantasma mr-1 px-2 text-tinta-suave/70 hover:text-red-600"
                    onClick={() => onEliminar(n.id)}
                    aria-label={`Eliminar nota ${n.numero}`}
                  >
                    <IconeLixo />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
