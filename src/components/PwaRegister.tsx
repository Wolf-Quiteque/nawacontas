"use client";

import { useEffect, useState } from "react";
import { IconeFechar, IconeInstalar } from "./Icones";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CHAVE_DISPENSADO = "nawanotas.instalacao.dispensada";

function emModoApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOS;
}

/** Regista o service worker e mostra um convite discreto para instalar a app. */
export function PwaRegister() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarIOS, setMostrarIOS] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    let dispensado = false;
    try {
      dispensado = localStorage.getItem(CHAVE_DISPENSADO) === "1";
    } catch {}
    if (emModoApp() || dispensado) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
      setVisivel(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if (ehIOS()) {
      // Deteção do dispositivo (sistema externo) feita uma vez após a hidratação.
      /* eslint-disable react-hooks/set-state-in-effect */
      setMostrarIOS(true);
      setVisivel(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dispensar = () => {
    setVisivel(false);
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {}
  };

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "accepted") setVisivel(false);
    setEvento(null);
  };

  if (!visivel) return null;

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+5.25rem)] lg:pb-6">
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-linha bg-white/95 p-3.5 shadow-suave backdrop-blur">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-laranja-claro text-laranja-escuro">
          <IconeInstalar />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Instalar NawaNotas</p>
          {mostrarIOS && !evento ? (
            <p className="mt-0.5 text-xs leading-relaxed text-tinta-suave">
              No Safari, toque em <strong>Partilhar</strong> e depois em{" "}
              <strong>Adicionar ao ecrã principal</strong>.
            </p>
          ) : (
            <p className="mt-0.5 text-xs leading-relaxed text-tinta-suave">
              Use a app como se fosse nativa, mesmo sem ligação à internet.
            </p>
          )}
          {evento && (
            <button className="botao-primario mt-2 px-3 py-1.5 text-xs" onClick={instalar}>
              Instalar
            </button>
          )}
        </div>
        <button className="botao-fantasma -mr-1 -mt-1 px-2" onClick={dispensar} aria-label="Dispensar">
          <IconeFechar />
        </button>
      </div>
    </div>
  );
}
