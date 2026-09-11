"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconeFechar, IconeHistorico, IconeInstalar, IconeMais, IconeMenu, IconeSair } from "./Icones";
import { InstalarModal } from "./InstalarModal";
import { limparRascunho } from "@/lib/armazenamento";
import type { Utilizador } from "@/lib/auth/constantes";
import { formatarTelefone } from "@/lib/telefone";

const NAV = [
  { href: "/", rotulo: "Nova nota", descricao: "Criar e imprimir", Icone: IconeMais, ativo: (p: string) => p === "/" },
  {
    href: "/historico",
    rotulo: "Histórico",
    descricao: "Consultar e reimprimir",
    Icone: IconeHistorico,
    ativo: (p: string) => p.startsWith("/historico") || p.startsWith("/notas/"),
  },
];

export function Marca({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-laranja to-amarelo shadow-suave">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
          <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="#fff" />
          <path d="M14 3v4h4" fill="#FFE2B8" />
          <rect x="8.5" y="11" width="7" height="1.6" rx=".8" fill="#F28C1B" />
          <rect x="8.5" y="14.2" width="7" height="1.6" rx=".8" fill="#F28C1B" />
          <rect x="8.5" y="17.4" width="4.5" height="1.6" rx=".8" fill="#FFC533" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[17px] font-bold tracking-tight">
          Nawa<span className="text-laranja">Notas</span>
        </span>
        <span className="block text-[11px] text-tinta-suave">Saídas de caixa NawaBus</span>
      </span>
    </Link>
  );
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return `${primeira}${ultima}`.toUpperCase();
}

function Navegacao({ pathname, onNavegar }: { pathname: string; onNavegar?: () => void }) {
  return (
    <nav className="space-y-1" aria-label="Menu principal">
      {NAV.map(({ href, rotulo, descricao, Icone, ativo }) => {
        const estaAtivo = ativo(pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavegar}
            aria-current={estaAtivo ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
              estaAtivo ? "bg-laranja text-white shadow-suave" : "text-tinta hover:bg-laranja-claro/70"
            }`}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                estaAtivo ? "bg-white/20" : "bg-laranja-claro text-laranja-escuro"
              }`}
            >
              <Icone />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">{rotulo}</span>
              <span className={`block text-[11px] ${estaAtivo ? "text-white/80" : "text-tinta-suave"}`}>{descricao}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function BotaoInstalar({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-linha bg-amarelo-claro/60 px-3 py-2.5 text-left transition hover:bg-amarelo-claro"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-laranja-escuro">
        <IconeInstalar />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">Instalar app</span>
        <span className="block text-[11px] text-tinta-suave">Telemóvel e computador</span>
      </span>
    </button>
  );
}

function CartaoUtilizador({ utilizador }: { utilizador: Utilizador }) {
  const [aSair, setASair] = useState(false);

  const sair = async () => {
    setASair(true);
    try {
      await fetch("/api/auth/sair", { method: "POST" });
    } catch {
      /* mesmo sem ligação, sai localmente */
    }
    limparRascunho();
    window.location.replace("/entrar");
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-linha bg-white px-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-laranja text-xs font-bold text-white" aria-hidden>
        {iniciais(utilizador.nome)}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-semibold">{utilizador.nome}</span>
        <span className="block text-[11px] tabular-nums text-tinta-suave">{formatarTelefone(utilizador.telefone)}</span>
      </span>
      <button className="botao-fantasma -mr-1 px-2" onClick={sair} disabled={aSair} aria-label="Terminar sessão" title="Sair">
        <IconeSair />
      </button>
    </div>
  );
}

export function Shell({ utilizador, children }: { utilizador: Utilizador; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const [instalarAberto, setInstalarAberto] = useState(false);

  useEffect(() => {
    if (!menuAberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuAberto(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuAberto]);

  const abrirInstalar = () => {
    setMenuAberto(false);
    setInstalarAberto(true);
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Menu lateral (computador) */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-linha bg-white/70 px-4 py-5 backdrop-blur lg:flex">
        <div className="px-1">
          <Marca />
        </div>
        <div className="mt-8">
          <Navegacao pathname={pathname} />
        </div>
        <div className="mt-auto space-y-2">
          <BotaoInstalar onClick={abrirInstalar} />
          <CartaoUtilizador utilizador={utilizador} />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/* Barra superior (telemóvel) */}
        <header className="no-print sticky top-0 z-30 border-b border-linha/80 bg-creme/85 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button className="botao-fantasma px-2" onClick={() => setMenuAberto(true)} aria-label="Abrir menu" aria-expanded={menuAberto}>
              <IconeMenu />
            </button>
            <Marca />
            <button
              className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-laranja text-xs font-bold text-white"
              onClick={() => setMenuAberto(true)}
              aria-label={`Conta de ${utilizador.nome}`}
            >
              {iniciais(utilizador.nome)}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      {/* Gaveta (telemóvel) */}
      {menuAberto && (
        <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <Marca />
              <button className="botao-fantasma -mr-2 px-2" onClick={() => setMenuAberto(false)} aria-label="Fechar">
                <IconeFechar />
              </button>
            </div>
            <div className="mt-6">
              <Navegacao pathname={pathname} onNavegar={() => setMenuAberto(false)} />
            </div>
            <div className="mt-auto space-y-2">
              <BotaoInstalar onClick={abrirInstalar} />
              <CartaoUtilizador utilizador={utilizador} />
            </div>
          </div>
        </div>
      )}

      <InstalarModal aberto={instalarAberto} onFechar={() => setInstalarAberto(false)} />
    </div>
  );
}
