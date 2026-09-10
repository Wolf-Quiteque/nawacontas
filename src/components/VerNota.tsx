"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconeAviso, IconeDescarregar, IconeEditar, IconeImprimir, IconeLixo, IconePartilhar, IconeVerificado } from "./Icones";
import { NotaSvg, useLayoutNota } from "./NotaPreview";
import { descarregarPdf, partilharPdf, suportaPartilha } from "@/lib/acoes";
import { apiEliminar } from "@/lib/api";
import { anoDaData, dataPorExtenso, formatarKz, type NotaRegisto, registoParaNota } from "@/lib/nota";

type Aviso = { tipo: "ok" | "erro"; texto: string };

export function VerNota({ nota }: { nota: NotaRegisto }) {
  const router = useRouter();
  const dados = registoParaNota(nota);
  const primitivas = useLayoutNota(dados);
  const [ocupado, setOcupado] = useState<null | "pdf" | "partilhar" | "eliminar">(null);
  const [podePartilhar, setPodePartilhar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
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

  const eliminar = async () => {
    setOcupado("eliminar");
    try {
      await apiEliminar(nota.id);
      router.push("/historico");
      router.refresh();
    } catch (e) {
      mostrarAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Não foi possível eliminar." });
      setOcupado(null);
      setConfirmar(false);
    }
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
            <Link href={`/notas/${nota.id}/editar`} className="botao-secundario">
              <IconeEditar />
              Editar
            </Link>
            <button className="botao-secundario text-red-700 hover:border-red-200 hover:bg-red-50" onClick={() => setConfirmar(true)}>
              <IconeLixo />
              <span className="hidden sm:inline">Eliminar</span>
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

        {confirmar && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
            <button className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" aria-label="Cancelar" onClick={() => setConfirmar(false)} />
            <div className="relative w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-sm sm:rounded-3xl">
              <h2 className="text-lg font-semibold">Eliminar a nota N.º {nota.numero}?</h2>
              <p className="mt-1 text-sm text-tinta-suave">
                Esta ação não pode ser anulada. O número {nota.numero} não será reutilizado se já existirem notas posteriores.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button className="botao-secundario" onClick={() => setConfirmar(false)} disabled={ocupado === "eliminar"}>
                  Cancelar
                </button>
                <button className="botao bg-red-600 text-white hover:bg-red-700" onClick={eliminar} disabled={ocupado === "eliminar"}>
                  {ocupado === "eliminar" ? "A eliminar…" : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        )}

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
        <button className="botao-secundario" onClick={() => window.print()} disabled={!!ocupado} aria-label="Imprimir">
          <IconeImprimir />
          <span className="hidden sm:inline">Imprimir</span>
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
