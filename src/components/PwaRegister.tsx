"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconeFechar, IconeInstalar } from "./Icones";
import { InstalarModal } from "./InstalarModal";
import { type BeforeInstallPromptEvent, definirPrompt, ehIOS, emModoApp, marcarInstalado, marcarSwAtivo, usePwa } from "@/lib/pwa";

const CHAVE_DISPENSADO = "nawanotas.instalacao.dispensada";

/** Regista o service worker, capta o evento de instalação e mostra um convite discreto. */
export function PwaRegister() {
  const { prompt, instalado } = usePwa();
  const pathname = usePathname();
  // Nos ecrãs de entrada o convite taparia o botão de submeter; aí existe a ligação "Instalar app".
  const paginaConta = pathname === "/entrar" || pathname === "/registar";
  const [visivel, setVisivel] = useState(false);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          const verificar = () => marcarSwAtivo(!!navigator.serviceWorker.controller || !!reg.active);
          verificar();
          navigator.serviceWorker.addEventListener("controllerchange", verificar);
          reg.addEventListener("updatefound", () => reg.installing?.addEventListener("statechange", verificar));
        })
        .catch(() => marcarSwAtivo(false));
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      definirPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalado = () => marcarInstalado();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalado);

    let dispensado = false;
    try {
      dispensado = localStorage.getItem(CHAVE_DISPENSADO) === "1";
    } catch {}
    if (!emModoApp() && !dispensado) {
      // Mostra o convite após um breve momento para não competir com o carregamento.
      const t = window.setTimeout(() => setVisivel(true), 1500);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.removeEventListener("appinstalled", onInstalado);
      };
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalado);
    };
  }, []);

  const dispensar = () => {
    setVisivel(false);
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {}
  };

  const instalar = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      definirPrompt(null);
      if (outcome === "accepted") setVisivel(false);
    } else {
      setModal(true);
    }
  };

  return (
    <>
      {visivel && !instalado && !paginaConta && (
        <div className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+5.25rem)] lg:pb-6">
          <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-linha bg-white/95 p-3.5 shadow-suave backdrop-blur">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-laranja-claro text-laranja-escuro">
              <IconeInstalar />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Instalar NawaNotas</p>
              <p className="mt-0.5 text-xs leading-relaxed text-tinta-suave">
                {ehIOS() && !prompt
                  ? "No Safari: Partilhar → Adicionar ao ecrã principal."
                  : "Use a app como se fosse nativa, no telemóvel e no computador."}
              </p>
              <button className="botao-primario mt-2 px-3 py-1.5 text-xs" onClick={instalar}>
                {prompt ? "Instalar" : "Como instalar"}
              </button>
            </div>
            <button className="botao-fantasma -mr-1 -mt-1 px-2" onClick={dispensar} aria-label="Dispensar">
              <IconeFechar />
            </button>
          </div>
        </div>
      )}
      <InstalarModal aberto={modal} onFechar={() => setModal(false)} />
    </>
  );
}
