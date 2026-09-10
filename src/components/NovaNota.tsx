"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { IconeAviso, IconeDescarregar, IconeImprimir, IconeMais, IconePartilhar, IconeVerificado } from "./Icones";
import { type Formulario, NotaForm, paraEntrada, paraFormulario } from "./NotaForm";
import { NotaSvg, useLayoutNota } from "./NotaPreview";
import { descarregarPdf, partilharPdf, suportaPartilha } from "@/lib/acoes";
import { apiAtualizar, apiCriar, apiProximoNumero } from "@/lib/api";
import { guardarRascunho, lerRascunho, limparRascunho } from "@/lib/armazenamento";
import { anoDaData, notaPadrao, type NotaData, type NotaRegisto, registoParaNota } from "@/lib/nota";

interface Props {
  /** Nota existente a editar; ausente para criar uma nova. */
  inicial?: NotaRegisto;
}

type Aviso = { tipo: "ok" | "erro"; texto: string };

export function NovaNota({ inicial }: Props) {
  const [form, setForm] = useState<Formulario | null>(null);
  const [registo, setRegisto] = useState<NotaRegisto | null>(inicial ?? null);
  const [proximo, setProximo] = useState<number | null>(null);
  const [erroProximo, setErroProximo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<null | "pdf" | "partilhar" | "imprimir" | "guardar">(null);
  const [podePartilhar, setPodePartilhar] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const avisoTimer = useRef<number | null>(null);
  const [sujo, setSujo] = useState(false);

  const carregarProximo = useCallback(async () => {
    setErroProximo(null);
    try {
      setProximo(await apiProximoNumero());
    } catch (e) {
      setErroProximo(e instanceof Error ? e.message : "Sem ligação à base de dados.");
    }
  }, []);

  // Estado inicial apenas no cliente (rascunho, data de hoje, próximo número).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (inicial) {
      setForm(paraFormulario(registoParaNota(inicial)));
    } else {
      const rascunho = lerRascunho();
      setForm(paraFormulario(rascunho ?? notaPadrao()));
      void carregarProximo();
    }
    setPodePartilhar(suportaPartilha());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [inicial, carregarProximo]);

  // Rascunho automático (só para notas novas ainda não guardadas).
  useEffect(() => {
    if (form && !registo) guardarRascunho(paraEntrada(form));
  }, [form, registo]);

  const numero = registo ? String(registo.numero) : proximo !== null ? String(proximo) : "";
  const nota: NotaData = useMemo(() => ({ ...(form ? paraEntrada(form) : notaPadrao()), numero }), [form, numero]);
  const primitivas = useLayoutNota(nota);

  const mostrarAviso = useCallback((a: Aviso) => {
    setAviso(a);
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), a.tipo === "erro" ? 5000 : 2800);
  }, []);

  const alterar = (f: Formulario) => {
    setForm(f);
    setSujo(true);
  };

  /** Guarda na base de dados (cria ou atualiza) e devolve o registo com o número definitivo. */
  const guardar = async (): Promise<NotaRegisto> => {
    if (!form) throw new Error("Formulário não carregado.");
    const entrada = paraEntrada(form);
    const guardada = registo && !sujo ? registo : registo ? await apiAtualizar(registo.id, entrada) : await apiCriar(entrada);
    flushSync(() => {
      setRegisto(guardada);
      setForm(paraFormulario(guardada));
      setSujo(false);
    });
    if (!registo) limparRascunho();
    return guardada;
  };

  const executar = async (acao: "pdf" | "partilhar" | "imprimir" | "guardar") => {
    if (ocupado || !form) return;
    setOcupado(acao);
    try {
      const era = registo;
      const guardada = await guardar();
      const dados = registoParaNota(guardada);
      const msg = era ? `Nota N.º ${guardada.numero} atualizada.` : `Nota N.º ${guardada.numero} registada.`;
      if (acao === "pdf") {
        await descarregarPdf(dados);
        mostrarAviso({ tipo: "ok", texto: `${msg} PDF gerado.` });
      } else if (acao === "partilhar") {
        const feito = await partilharPdf(dados);
        mostrarAviso({ tipo: "ok", texto: feito ? `${msg} PDF partilhado.` : msg });
      } else if (acao === "imprimir") {
        mostrarAviso({ tipo: "ok", texto: msg });
        window.print();
      } else {
        mostrarAviso({ tipo: "ok", texto: msg });
      }
    } catch (e) {
      mostrarAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Ocorreu um erro." });
    } finally {
      setOcupado(null);
    }
  };

  const novaNota = () => {
    const base = notaPadrao();
    setForm(paraFormulario({ ...base, cidade: form?.cidade || base.cidade }));
    setRegisto(null);
    setSujo(false);
    limparRascunho();
    void carregarProximo();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ano = anoDaData(nota.data);
  const cabecalhoNumero = (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-linha bg-creme px-4 py-3">
      <div>
        <span className="block text-[11px] font-medium uppercase tracking-wide text-tinta-suave">Número da nota</span>
        <span className="block text-lg font-bold tabular-nums text-tinta">
          {numero ? `N.º ${numero} / ${ano}` : erroProximo ? "—" : "a obter…"}
        </span>
      </div>
      {registo ? (
        <span className="rounded-full bg-laranja-claro px-2.5 py-1 text-[11px] font-semibold text-laranja-escuro">Registada</span>
      ) : erroProximo ? (
        <button className="botao-secundario px-3 py-1.5 text-xs" onClick={carregarProximo}>
          Tentar de novo
        </button>
      ) : (
        <span className="rounded-full bg-amarelo-claro px-2.5 py-1 text-[11px] font-semibold text-laranja-escuro">Automático</span>
      )}
    </div>
  );

  const acoes = (
    <>
      <button className="botao-primario flex-1 lg:flex-none" onClick={() => executar("pdf")} disabled={!!ocupado || !form}>
        <IconeDescarregar />
        {ocupado === "pdf" ? "A gerar…" : registo && !sujo ? "Descarregar PDF" : "Guardar e gerar PDF"}
      </button>
      {podePartilhar && (
        <button className="botao-secundario" onClick={() => executar("partilhar")} disabled={!!ocupado || !form} aria-label="Partilhar PDF">
          <IconePartilhar />
          <span className="hidden sm:inline">Partilhar</span>
        </button>
      )}
      <button className="botao-secundario" onClick={() => executar("imprimir")} disabled={!!ocupado || !form} aria-label="Imprimir">
        <IconeImprimir />
        <span className="hidden sm:inline">Imprimir</span>
      </button>
    </>
  );

  return (
    <>
      <div className="no-print">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{registo ? `Nota N.º ${registo.numero}` : "Nova nota de saída"}</h1>
            <p className="mt-1 text-sm text-tinta-suave">
              {registo
                ? "A editar uma nota já registada. As alterações são guardadas ao gerar o PDF ou imprimir."
                : "Preencha os dados; o número é atribuído automaticamente ao guardar."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {registo && (
              <Link href={`/notas/${registo.id}`} className="botao-secundario">
                Ver nota
              </Link>
            )}
            {registo && (
              <button className="botao-secundario" onClick={novaNota}>
                <IconeMais />
                Nova nota
              </button>
            )}
            {registo && sujo && (
              <button className="botao-primario" onClick={() => executar("guardar")} disabled={!!ocupado}>
                {ocupado === "guardar" ? "A guardar…" : "Guardar alterações"}
              </button>
            )}
          </div>
        </div>

        {erroProximo && !registo && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <IconeAviso className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Sem ligação à base de dados</p>
              <p className="text-xs">{erroProximo}</p>
            </div>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <section className="rounded-3xl border border-linha bg-white p-5 shadow-suave sm:p-6">
            {form ? (
              <NotaForm valores={form} onChange={alterar} cabecalho={cabecalhoNumero} />
            ) : (
              <div className="space-y-4 py-2" aria-busy="true" aria-label="A carregar">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-11 animate-pulse rounded-xl bg-creme-escuro" />
                ))}
              </div>
            )}
          </section>

          <section className="mt-6 lg:sticky lg:top-8 lg:mt-0">
            <div className="mb-3 hidden items-center justify-between gap-2 lg:flex">
              <h2 className="text-sm font-semibold text-tinta-suave">Pré-visualização</h2>
              <div className="flex items-center gap-2">{acoes}</div>
            </div>
            <h2 className="mb-3 text-sm font-semibold text-tinta-suave lg:hidden">Pré-visualização</h2>
            <div className="overflow-hidden rounded-2xl border border-linha bg-white shadow-suave ring-1 ring-tinta/5">
              <NotaSvg primitivas={primitivas} className="block h-auto w-full" />
            </div>
            <p className="mt-2 text-center text-[11px] text-tinta-suave">Página A4 · o PDF e a impressão são idênticos a esta pré-visualização.</p>
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-white/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-2">{acoes}</div>
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

      {/* Cópia usada exclusivamente pela impressão (CSS @media print). */}
      <div id="print-area" aria-hidden>
        <NotaSvg primitivas={primitivas} />
      </div>
    </>
  );
}
