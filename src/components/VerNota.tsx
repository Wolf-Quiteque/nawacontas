"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconeAviso, IconeCopiar, IconeDescarregar, IconeImprimir, IconePartilhar, IconeVerificado } from "./Icones";
import { NotaSvg, useLayoutNota } from "./NotaPreview";
import { descarregarPdf, imprimirPdf, partilharPdf, suportaPartilha } from "@/lib/acoes";
import { reutilizarNota } from "@/lib/armazenamento";
import { anoDaData, dataPorExtenso, formatarKz, hojeISO, type NotaRegisto, registoParaNota } from "@/lib/nota";

type Aviso = { tipo: "ok" | "erro"; texto: string };

/** Página de uma nota registada: apenas consulta e reimpressão (as notas são imutáveis). */
export function VerNota({ nota }: { nota: NotaRegisto }) {
  const router = useRouter();
  const dados = registoParaNota(nota);
  const primitivas = useLayoutNota(dados);
  const [ocupado, setOcupado] = useState<null | "pdf" | "partilhar" | "imprimir">(null);
  const [podePartilhar, setPodePartilhar] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setPodePartilhar(suportaPartilha());
  }, []);

  const mostrarAviso = (a: Aviso) => {
    setAviso(a);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAviso(null), a.tipo === "erro" ? 5000 : 2800);
  };

  const pdf = async () => {
    setOcupado("pdf");
    try {
      await descarregarPdf(dados);
    } catch (e) {
      mostrarAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Não foi possível gerar o PDF." });
    } finally {
      setOcupado(null);
    }
  };

  const partilhar = async () => {
    setOcupado("partilhar");
    try {
      await partilharPdf(dados);
    } catch (e) {
      mostrarAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Não foi possível partilhar." });
    } finally {
      setOcupado(null);
    }
  };

  const imprimir = async () => {
    setOcupado("imprimir");
    try {
      const modo = await imprimirPdf(dados);
      if (modo === "partilha") mostrarAviso({ tipo: "ok", texto: "Escolha “Imprimir” no menu de partilha." });
      else if (modo === "descarga") mostrarAviso({ tipo: "ok", texto: "PDF descarregado — imprima a partir do visualizador." });
      else if (modo === "janela") mostrarAviso({ tipo: "ok", texto: "PDF aberto noutro separador — use Imprimir (Cmd+P)." });
    } catch (e) {
      mostrarAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Não foi possível imprimir." });
    } finally {
      setOcupado(null);
    }
  };

  /** Copia os dados desta nota para uma nova nota (com novo número e data de hoje). */
  const reutilizar = () => {
    reutilizarNota(
      { beneficiario: nota.beneficiario, origem: nota.origem, periodo: nota.periodo, itens: nota.itens, cidade: nota.cidade, data: nota.data },
      nota.numero,
      hojeISO(),
    );
    router.push("/");
  };

  const total = Number(nota.total) || 0;

  return (
    <>
      <div className="no-print">
        <nav className="mb-3 text-xs text-tinta-suave" aria-label="Navegação">
          <Link href="/historico" className="hover:text-tinta">
            Histórico
          </Link>
          <span className="mx-1.5">/</span>
          <span>Nota N.º {nota.numero}</span>
        </nav>

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Nota N.º {nota.numero} <span className="font-normal text-tinta-suave">/ {anoDaData(nota.data)}</span>
            </h1>
            <p className="mt-1 text-sm text-tinta-suave">
              {nota.beneficiario || "Sem beneficiário"}
              {nota.origem ? ` · ${nota.origem}` : ""} · {dataPorExtenso(nota.data)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-laranja-claro px-3 py-1 text-xs font-semibold text-laranja-escuro">Registada · não editável</span>
            <button className="botao-secundario" onClick={reutilizar} title="Criar uma nova nota com os mesmos dados">
              <IconeCopiar />
              Reutilizar
            </button>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <aside className="space-y-3">
            <div className="rounded-3xl border border-linha bg-white p-5 shadow-suave">
              <dl className="space-y-3 text-sm">
                <Linha rotulo="Beneficiário" valor={nota.beneficiario || "—"} />
                <Linha rotulo="Origem" valor={nota.origem || "—"} />
                <Linha rotulo="Período" valor={nota.periodo || "—"} />
              </dl>
              <div className="mt-4 border-t border-linha pt-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-tinta-suave">Itens</p>
                <ul className="space-y-1.5 text-sm">
                  {nota.itens.map((i, k) => (
                    <li key={k} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {i.descricao || <span className="text-tinta-suave">Sem descrição</span>}
                        {i.qtd && <span className="ml-1.5 text-xs text-tinta-suave">× {i.qtd}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatarKz(i.valor)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-baseline justify-between border-t border-linha pt-3">
                  <span className="text-sm text-tinta-suave">Total</span>
                  <span className="text-base font-bold tabular-nums text-laranja-escuro">{formatarKz(total)} Kz</span>
                </div>
              </div>
              <p className="mt-4 text-[11px] text-tinta-suave">
                {nota.cidade}, {dataPorExtenso(nota.data)} · registada em {new Date(nota.criadaEm).toLocaleString("pt-PT")}
              </p>
            </div>
            <div className="hidden flex-wrap gap-2 lg:flex">
              <Acoes />
            </div>
          </aside>

          <section className="mt-6 lg:mt-0">
            <h2 className="mb-3 text-sm font-semibold text-tinta-suave">Documento</h2>
            <div className="overflow-hidden rounded-2xl border border-linha bg-white shadow-suave ring-1 ring-tinta/5">
              <NotaSvg primitivas={primitivas} className="block h-auto w-full" />
            </div>
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-white/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-2">
            <Acoes />
          </div>
        </div>

        {aviso && (
          <div
            role="status"
            className={`fixed left-1/2 top-16 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${
              aviso.tipo === "erro" ? "bg-red-700" : "bg-tinta"
            }`}
          >
            {aviso.tipo === "erro" ? <IconeAviso className="text-amarelo" /> : <IconeVerificado className="text-amarelo" />}
            {aviso.texto}
          </div>
        )}
      </div>

      <div id="print-area" aria-hidden>
        <NotaSvg primitivas={primitivas} />
      </div>
    </>
  );

  function Acoes() {
    return (
      <>
        <button className="botao-primario flex-1 lg:flex-none" onClick={pdf} disabled={!!ocupado}>
          <IconeDescarregar />
          {ocupado === "pdf" ? "A gerar…" : "Descarregar PDF"}
        </button>
        {podePartilhar && (
          <button className="botao-secundario" onClick={partilhar} disabled={!!ocupado} aria-label="Partilhar PDF">
            <IconePartilhar />
            <span className="hidden sm:inline">Partilhar</span>
          </button>
        )}
        <button className="botao-secundario" onClick={imprimir} disabled={!!ocupado} aria-label="Reimprimir">
          <IconeImprimir />
          <span className="hidden sm:inline">{ocupado === "imprimir" ? "A preparar…" : "Reimprimir"}</span>
        </button>
      </>
    );
  }
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-tinta-suave">{rotulo}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}
