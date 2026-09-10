"use client";

import { useEffect, useState } from "react";
import { IconeFechar, IconeInstalar, IconeVerificado } from "./Icones";
import { definirPrompt, ehAndroid, ehIOS, ehSafari, emModoApp, usePwa } from "@/lib/pwa";

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

export function InstalarModal({ aberto, onFechar }: Props) {
  const { prompt, instalado, swAtivo } = usePwa();
  const [aInstalar, setAInstalar] = useState(false);
  const [plataforma, setPlataforma] = useState<"ios" | "android" | "desktop">("desktop");
  const [safari, setSafari] = useState(true);
  const [jaEmApp, setJaEmApp] = useState(false);
  const [https, setHttps] = useState(true);

  useEffect(() => {
    if (!aberto) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPlataforma(ehIOS() ? "ios" : ehAndroid() ? "android" : "desktop");
    setSafari(ehSafari());
    setJaEmApp(emModoApp());
    setHttps(location.protocol === "https:" || location.hostname === "localhost");
    /* eslint-enable react-hooks/set-state-in-effect */
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const instalarAgora = async () => {
    if (!prompt) return;
    setAInstalar(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } finally {
      definirPrompt(null);
      setAInstalar(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="instalar-titulo">
      <button className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" aria-label="Fechar" onClick={onFechar} />
      <div className="relative w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-laranja to-amarelo text-white shadow-suave">
              <IconeInstalar />
            </span>
            <div>
              <h2 id="instalar-titulo" className="text-lg font-semibold">
                Instalar NawaNotas
              </h2>
              <p className="text-xs text-tinta-suave">Abre como uma app, com ícone no ecrã principal.</p>
            </div>
          </div>
          <button className="botao-fantasma -mr-2 -mt-1 px-2" onClick={onFechar} aria-label="Fechar">
            <IconeFechar />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm">
          {jaEmApp || instalado ? (
            <p className="flex items-center gap-2 rounded-2xl bg-laranja-claro/70 px-4 py-3 font-medium text-laranja-escuro">
              <IconeVerificado /> A app já está instalada neste dispositivo.
            </p>
          ) : prompt ? (
            <>
              <p>O seu navegador permite instalar diretamente:</p>
              <button className="botao-primario w-full" onClick={instalarAgora} disabled={aInstalar}>
                {aInstalar ? "A instalar…" : "Instalar agora"}
              </button>
            </>
          ) : plataforma === "ios" ? (
            <Passos
              titulo={safari ? "No iPhone / iPad (Safari)" : "No iPhone / iPad"}
              aviso={!safari ? "Abra esta página no Safari — é o único navegador do iPhone que instala apps." : undefined}
              passos={[
                "Toque no botão Partilhar (quadrado com seta para cima) na barra inferior.",
                "Deslize a lista e toque em “Adicionar ao ecrã principal”.",
                "Confirme em “Adicionar”. O ícone NawaNotas aparece no ecrã principal.",
              ]}
            />
          ) : plataforma === "android" ? (
            <Passos
              titulo="No Android (Chrome)"
              passos={[
                "Toque no menu ⋮ no canto superior direito.",
                "Toque em “Instalar app” ou “Adicionar ao ecrã principal”.",
                "Confirme em “Instalar”.",
              ]}
            />
          ) : (
            <Passos
              titulo="No computador (Chrome ou Edge)"
              passos={[
                "Procure o ícone de instalação no lado direito da barra de endereço (um monitor com seta).",
                "Ou abra o menu ⋮ → “Transmitir, guardar e partilhar” → “Instalar página como app…”.",
                "Confirme em “Instalar”. A app abre numa janela própria.",
              ]}
            />
          )}

          <div className="rounded-2xl border border-linha bg-creme px-4 py-3 text-xs text-tinta-suave">
            <p className="font-semibold text-tinta">Estado</p>
            <ul className="mt-1 space-y-0.5">
              <li>Ligação segura (HTTPS): {https ? "sim" : "não — a instalação exige HTTPS"}</li>
              <li>Modo offline (service worker): {swAtivo ? "ativo" : "a preparar… recarregue a página e tente de novo"}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Passos({ titulo, passos, aviso }: { titulo: string; passos: string[]; aviso?: string }) {
  return (
    <div>
      <p className="font-semibold">{titulo}</p>
      {aviso && <p className="mt-1 rounded-xl bg-amarelo-claro px-3 py-2 text-xs text-tinta">{aviso}</p>}
      <ol className="mt-2 space-y-2">
        {passos.map((p, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-laranja text-xs font-bold text-white">{i + 1}</span>
            <span className="leading-relaxed">{p}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
