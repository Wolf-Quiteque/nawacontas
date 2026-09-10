"use client";

import { useSyncExternalStore } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface EstadoPwa {
  /** Evento de instalação diferido (Chrome/Edge/Android); null quando não disponível. */
  prompt: BeforeInstallPromptEvent | null;
  /** Ficou instalada durante esta sessão. */
  instalado: boolean;
  /** Service worker a controlar a página. */
  swAtivo: boolean;
}

const ESTADO_INICIAL: EstadoPwa = { prompt: null, instalado: false, swAtivo: false };
let estado: EstadoPwa = ESTADO_INICIAL;
const subscritores = new Set<() => void>();

function atualizar(parcial: Partial<EstadoPwa>) {
  estado = { ...estado, ...parcial };
  subscritores.forEach((s) => s());
}

export const definirPrompt = (prompt: BeforeInstallPromptEvent | null) => atualizar({ prompt });
export const marcarInstalado = () => atualizar({ instalado: true, prompt: null });
export const marcarSwAtivo = (swAtivo: boolean) => atualizar({ swAtivo });

function subscrever(cb: () => void) {
  subscritores.add(cb);
  return () => {
    subscritores.delete(cb);
  };
}

export function usePwa(): EstadoPwa {
  return useSyncExternalStore(
    subscrever,
    () => estado,
    () => ESTADO_INICIAL,
  );
}

export function emModoApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || iPadOS;
}

export function ehAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function ehSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/.test(ua);
}
