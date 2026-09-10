"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Historico } from "./Historico";
import {
  IconeDescarregar,
  IconeHistorico,
  IconeImprimir,
  IconeMais,
  IconePartilhar,
  IconeVerificado,
} from "./Icones";
import { type Formulario, NotaForm, paraFormulario, paraNota } from "./NotaForm";
import { NotaSvg, useLayoutNota } from "./NotaPreview";
import {
  guardarNoHistorico,
  guardarRascunho,
  lerHistorico,
  lerRascunho,
  proximoNumero,
  removerDoHistorico,
} from "@/lib/armazenamento";
import { anoDaData, hojeISO, nomeFicheiro, notaPadrao, type NotaGuardada } from "@/lib/nota";
import { gerarPdf } from "@/lib/pdf";

export function App() {
  const [form, setForm] = useState<Formulario | null>(null);
  const [idAtual, setIdAtual] = useState<string | undefined>(undefined);
  const [historico, setHistorico] = useState<NotaGuardada[]>([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [podePartilhar, setPodePartilhar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoTimer = useRef<number | null>(null);

  // Carrega rascunho e histórico apenas no cliente (evita divergências de hidratação com a data de hoje).
  useEffect(() => {
    // Leitura única do localStorage (sistema externo) após a hidratação.
    /* eslint-disable react-hooks/set-state-in-effect */
    const lista = lerHistorico();
    setHistorico(lista);
    const rascunho = lerRascunho();
    setForm(paraFormulario(rascunho ?? notaPadrao(proximoNumero(anoDaData(hojeISO()), lista))));
    try {
      const f = new File(["x"], "x.pdf", { type: "application/pdf" });
      setPodePartilhar(typeof navigator.share === "function" && !!navigator.canShare?.({ files: [f] }));
    } catch {
      setPodePartilhar(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (form) guardarRascunho(paraNota(form));
  }, [form]);

  const nota = useMemo(() => (form ? paraNota(form) : notaPadrao()), [form]);
  const primitivas = useLayoutNota(nota);

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), 2600);
  }, []);

  const guardar = useCallback(() => {
    const guardada = guardarNoHistorico(nota, idAtual);
    setIdAtual(guardada.id);
    setHistorico(lerHistorico());
    return guardada;
  }, [nota, idAtual]);

  const descarregar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const bytes = await gerarPdf(nota);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeFicheiro(nota);
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      guardar();
      mostrarAviso("PDF gerado e guardado no histórico.");
    } catch (e) {
      console.error(e);
      mostrarAviso("Não foi possível gerar o PDF.");
    } finally {
      setOcupado(false);
    }
  };

  const partilhar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const bytes = await gerarPdf(nota);
      const ficheiro = new File([bytes as BlobPart], nomeFicheiro(nota), { type: "application/pdf" });
      await navigator.share({ files: [ficheiro], title: `Nota de Pagamento N.º ${nota.numero}` });
      guardar();
      mostrarAviso("PDF partilhado e guardado no histórico.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.error(e);
        mostrarAviso("Não foi possível partilhar o PDF.");
      }
    } finally {
      setOcupado(false);
    }
  };

  const imprimir = () => {
    guardar();
    window.print();
  };

  const novaNota = () => {
    const ano = anoDaData(hojeISO());
    const base = notaPadrao(proximoNumero(ano, historico));
    setForm(paraFormulario({ ...base, cidade: nota.cidade || base.cidade }));
    setIdAtual(undefined);
    mostrarAviso("Nova nota iniciada.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const abrirGuardada = (n: NotaGuardada) => {
    setForm(paraFormulario(n));
    setIdAtual(n.id);
    setHistoricoAberto(false);
  };

  const eliminar = (id: string) => {
    setHistorico(removerDoHistorico(id));
    if (id === idAtual) setIdAtual(undefined);
  };

  const acoes = (
    <>
      <button className="botao-primario flex-1 lg:flex-none" onClick={descarregar} disabled={ocupado || !form}>
        <IconeDescarregar />
        {ocupado ? "A gerar…" : "Descarregar PDF"}
      </button>
      {podePartilhar && (
        <button className="botao-secundario" onClick={partilhar} disabled={ocupado || !form} aria-label="Partilhar PDF">
          <IconePartilhar />
          <span className="hidden sm:inline">Partilhar</span>
        </button>
      )}
      <button className="botao-secundario" onClick={imprimir} disabled={!form} aria-label="Imprimir">
        <IconeImprimir />
        <span className="hidden sm:inline">Imprimir</span>
      </button>
    </>
  );

  return (
    <>
      <div className="no-print flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b border-linha/80 bg-creme/85 backdrop-blur supports-[backdrop-filter]:bg-creme/70">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-laranja to-amarelo shadow-suave">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
                  <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="#fff" />
                  <path d="M14 3v4h4" fill="#FFE2B8" />
                  <rect x="8.5" y="11" width="7" height="1.6" rx=".8" fill="#F28C1B" />
                  <rect x="8.5" y="14.2" width="7" height="1.6" rx=".8" fill="#F28C1B" />
                  <rect x="8.5" y="17.4" width="4.5" height="1.6" rx=".8" fill="#FFC533" />
                </svg>
              </span>
              <div className="leading-tight">
                <span className="block text-[17px] font-bold tracking-tight">
                  Nawa<span className="text-laranja">Notas</span>
                </span>
                <span className="hidden text-[11px] text-tinta-suave sm:block">Notas de pagamento NawaBus</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button className="botao-fantasma px-3" onClick={() => setHistoricoAberto(true)}>
                <IconeHistorico />
                <span className="hidden sm:inline">Histórico</span>
                {historico.length > 0 && (
                  <span className="rounded-full bg-laranja-claro px-1.5 text-[11px] font-semibold text-laranja-escuro">
                    {historico.length}
                  </span>
                )}
              </button>
              <button className="botao-secundario px-3" onClick={novaNota}>
                <IconeMais />
                <span className="hidden sm:inline">Nova nota</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:pb-12">
          <section className="rounded-3xl border border-linha bg-white p-5 shadow-suave sm:p-6">
            {form ? (
              <NotaForm valores={form} onChange={setForm} />
            ) : (
              <div className="space-y-4 py-2" aria-busy="true" aria-label="A carregar">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-11 animate-pulse rounded-xl bg-creme-escuro" />
                ))}
              </div>
            )}
          </section>

          <section className="mt-6 lg:sticky lg:top-20 lg:mt-0">
            <div className="mb-3 hidden items-center justify-between gap-2 lg:flex">
              <h2 className="text-sm font-semibold text-tinta-suave">Pré-visualização</h2>
              <div className="flex items-center gap-2">{acoes}</div>
            </div>
            <h2 className="mb-3 text-sm font-semibold text-tinta-suave lg:hidden">Pré-visualização</h2>
            <div className="overflow-hidden rounded-2xl border border-linha bg-white shadow-suave ring-1 ring-tinta/5">
              <NotaSvg primitivas={primitivas} className="block h-auto w-full" />
            </div>
            <p className="mt-2 text-center text-[11px] text-tinta-suave">
              Página A4 · o PDF e a impressão são idênticos a esta pré-visualização.
            </p>
          </section>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-white/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-2">{acoes}</div>
        </div>

        {aviso && (
          <div
            role="status"
            className="fixed left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-tinta px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            <IconeVerificado className="text-amarelo" />
            {aviso}
          </div>
        )}
      </div>

      <Historico
        aberto={historicoAberto}
        notas={historico}
        onFechar={() => setHistoricoAberto(false)}
        onAbrir={abrirGuardada}
        onEliminar={eliminar}
      />

      {/* Cópia usada exclusivamente pela impressão (CSS @media print). */}
      <div id="print-area" aria-hidden>
        <NotaSvg primitivas={primitivas} />
      </div>
    </>
  );
}
