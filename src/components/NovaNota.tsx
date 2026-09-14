"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { IconeAviso, IconeDescarregar, IconeImprimir, IconePartilhar, IconeVerificado } from "./Icones";
import { type Formulario, NotaForm, paraEntrada, paraFormulario, quantidadeDe } from "./NotaForm";
import { NotaSvg, useLayoutNota } from "./NotaPreview";
import { descarregarPdf, imprimirPdf, type ModoImpressao, partilharPdf, suportaPartilha } from "@/lib/acoes";
import { apiCriar, apiProximoNumero } from "@/lib/api";
import { consumirReutilizada, guardarRascunho, lerRascunho, limparRascunho } from "@/lib/armazenamento";
import { anoDaData, formatarKz, notaPadrao, type NotaData, type NotaRegisto, registoParaNota, totalDaNota } from "@/lib/nota";

type Acao = "pdf" | "partilhar" | "imprimir";
type Aviso = { tipo: "ok" | "erro"; texto: string; ligacao?: { href: string; rotulo: string } };

const ROTULO_ACAO: Record<Acao, string> = {
  pdf: "Registar e gerar PDF",
  partilhar: "Registar e partilhar",
  imprimir: "Registar e imprimir",
};

const MENSAGEM_IMPRESSAO: Record<ModoImpressao, string> = {
  pdf: "Enviada para impressão.",
  partilha: "Escolha “Imprimir” no menu de partilha.",
  descarga: "PDF descarregado — imprima a partir do visualizador.",
  janela: "PDF aberto noutro separador — use Imprimir (Cmd+P).",
  html: "Enviada para impressão.",
};

export function NovaNota({ emitidoPor }: { emitidoPor: string }) {
  const [form, setForm] = useState<Formulario | null>(null);
  const [proximo, setProximo] = useState<number | null>(null);
  const [erroProximo, setErroProximo] = useState<string | null>(null);
  /** Número definitivo atribuído pelo servidor, enquanto a ação (PDF/impressão) decorre. */
  const [numeroFixo, setNumeroFixo] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState<Acao | null>(null);
  const [confirmar, setConfirmar] = useState<Acao | null>(null);
  const [podePartilhar, setPodePartilhar] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const avisoTimer = useRef<number | null>(null);

  const mostrarAviso = useCallback((a: Aviso) => {
    setAviso(a);
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), a.tipo === "erro" ? 6000 : 8000);
  }, []);

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
    const rascunho = lerRascunho();
    setForm(paraFormulario(rascunho ?? notaPadrao()));
    setPodePartilhar(suportaPartilha());
    const reutilizada = consumirReutilizada();
    if (reutilizada) mostrarAviso({ tipo: "ok", texto: `Dados da nota N.º ${reutilizada} copiados. Reveja e registe como nova nota.` });
    /* eslint-enable react-hooks/set-state-in-effect */
    void carregarProximo();
  }, [carregarProximo, mostrarAviso]);

  // Rascunho automático da nota em preenchimento.
  useEffect(() => {
    if (form && numeroFixo === null) guardarRascunho(paraEntrada(form));
  }, [form, numeroFixo]);

  const numero = numeroFixo !== null ? String(numeroFixo) : proximo !== null ? String(proximo) : "";
  const nota: NotaData = useMemo(
    () => ({ ...(form ? paraEntrada(form) : notaPadrao()), numero, emitidoPor }),
    [form, numero, emitidoPor],
  );
  const primitivas = useLayoutNota(nota);
  const total = totalDaNota(nota);

  /** Validação rápida antes de pedir confirmação. */
  const problema = (): string | null => {
    if (!form) return "Formulário não carregado.";
    if (!form.beneficiario.trim()) return "Indique o beneficiário (quem recebe o dinheiro).";
    const itens = form.itens.filter((i) => i.descricao.trim() || i.preco.trim());
    if (itens.length === 0) return "Adicione pelo menos um item.";
    if (itens.some((i) => !i.descricao.trim())) return "Todos os itens precisam de descrição.";
    if (itens.some((i) => quantidadeDe(i.qtd) <= 0)) return "As quantidades têm de ser superiores a zero.";
    if (total <= 0) return "O total da saída tem de ser superior a zero.";
    return null;
  };

  const pedirConfirmacao = (acao: Acao) => {
    if (ocupado) return;
    const p = problema();
    if (p) {
      mostrarAviso({ tipo: "erro", texto: p });
      return;
    }
    setConfirmar(acao);
  };

  /** Regista a nota, executa a ação escolhida e abre automaticamente uma nova nota. */
  const registar = async (acao: Acao) => {
    if (!form || ocupado) return;
    setConfirmar(null);
    setOcupado(acao);
    let registada: NotaRegisto | null = null;
    let detalhe = "";
    try {
      registada = await apiCriar(paraEntrada(form));
      // Garante que a pré-visualização/impressão usa o número definitivo antes de agir.
      flushSync(() => setNumeroFixo(registada!.numero));
      const dados = registoParaNota(registada);
      if (acao === "pdf") await descarregarPdf(dados);
      else if (acao === "partilhar") await partilharPdf(dados);
      else detalhe = MENSAGEM_IMPRESSAO[await imprimirPdf(dados)];
    } catch (e) {
      if (!registada) {
        mostrarAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Não foi possível registar a nota." });
        setOcupado(null);
        return;
      }
      // A nota ficou registada mas a ação falhou (ex.: partilha cancelada): continua para a nova nota.
    }

    // Nova nota automática.
    limparRascunho();
    const base = notaPadrao();
    setForm(paraFormulario({ ...base, cidade: form.cidade || base.cidade, origem: form.origem }));
    setNumeroFixo(null);
    setOcupado(null);
    void carregarProximo();
    window.scrollTo({ top: 0, behavior: "smooth" });
    mostrarAviso({
      tipo: "ok",
      texto: `Nota N.º ${registada.numero} registada. ${detalhe ? `${detalhe} ` : ""}Nova nota pronta.`,
      ligacao: { href: `/notas/${registada.id}`, rotulo: "Ver" },
    });
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
      {erroProximo ? (
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
      <button className="botao-primario flex-1 lg:flex-none" onClick={() => pedirConfirmacao("pdf")} disabled={!!ocupado || !form}>
        <IconeDescarregar />
        {ocupado === "pdf" ? "A registar…" : "Registar e gerar PDF"}
      </button>
      {podePartilhar && (
        <button className="botao-secundario" onClick={() => pedirConfirmacao("partilhar")} disabled={!!ocupado || !form} aria-label="Registar e partilhar PDF">
          <IconePartilhar />
          <span className="hidden sm:inline">Partilhar</span>
        </button>
      )}
      <button className="botao-secundario" onClick={() => pedirConfirmacao("imprimir")} disabled={!!ocupado || !form} aria-label="Registar e imprimir">
        <IconeImprimir />
        <span className="hidden sm:inline">Imprimir</span>
      </button>
    </>
  );

  return (
    <>
      <div className="no-print">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Nova nota de saída</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Preencha os dados e registe. O número é atribuído automaticamente e, depois de registada, a nota não pode ser alterada.
          </p>
        </div>

        {erroProximo && (
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
              <NotaForm valores={form} onChange={setForm} cabecalho={cabecalhoNumero} />
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

        {confirmar && form && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirmar-titulo">
            <button className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" aria-label="Cancelar" onClick={() => setConfirmar(null)} />
            <div className="relative w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl">
              <h2 id="confirmar-titulo" className="text-lg font-semibold">
                Registar a nota N.º {numero || "…"}?
              </h2>
              <p className="mt-1 text-sm text-tinta-suave">Depois de registada, a nota não pode ser editada; só um administrador a pode eliminar.</p>
              <dl className="mt-4 space-y-2 rounded-2xl bg-creme px-4 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-tinta-suave">Beneficiário</dt>
                  <dd className="text-right font-medium">{form.beneficiario.trim()}</dd>
                </div>
                {form.origem.trim() && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-tinta-suave">Origem</dt>
                    <dd className="text-right font-medium">{form.origem.trim()}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-tinta-suave">Itens</dt>
                  <dd className="text-right font-medium">{form.itens.filter((i) => i.descricao.trim() || i.preco.trim()).length}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-linha pt-2">
                  <dt className="text-tinta-suave">Total</dt>
                  <dd className="text-right text-base font-bold tabular-nums text-laranja-escuro">{formatarKz(total)} Kz</dd>
                </div>
              </dl>
              <div className="mt-4 flex justify-end gap-2">
                <button className="botao-secundario" onClick={() => setConfirmar(null)}>
                  Cancelar
                </button>
                <button className="botao-primario" onClick={() => registar(confirmar)} autoFocus>
                  {ROTULO_ACAO[confirmar]}
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
            <span>{aviso.texto}</span>
            {aviso.ligacao && (
              <Link href={aviso.ligacao.href} className="ml-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-amarelo hover:bg-white/25">
                {aviso.ligacao.rotulo}
              </Link>
            )}
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
