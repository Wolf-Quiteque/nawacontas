"use client";

import { IconeLixo, IconeMais } from "./Icones";
import { kwanzasPorExtenso } from "@/lib/extenso";
import {
  formatarKz,
  formatarQtd,
  MAX_ITENS,
  type NotaEntrada,
  ORIGENS_SUGERIDAS,
  subtotalItem,
  totalDaNota,
} from "@/lib/nota";

export interface ItemFormulario {
  descricao: string;
  qtd: string;
  /** Preço unitário. */
  preco: string;
}

/** Valores do formulário (números como texto para edição livre). */
export interface Formulario {
  beneficiario: string;
  origem: string;
  periodo: string;
  itens: ItemFormulario[];
  cidade: string;
  data: string;
}

export function numeroDe(texto: string): number {
  const limpo = texto.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const v = parseFloat(limpo);
  return Number.isFinite(v) ? v : 0;
}

/** Quantidade de uma linha: vazio conta como 1. */
export function quantidadeDe(texto: string): number {
  return texto.trim() ? numeroDe(texto) : 1;
}

const itemVazio = (): ItemFormulario => ({ descricao: "", qtd: "1", preco: "" });

export function paraFormulario(n: NotaEntrada): Formulario {
  const itens = (n.itens ?? []).map((i) => ({
    descricao: i.descricao ?? "",
    qtd: formatarQtd(Number(i.qtd) || 1),
    preco: i.preco ? String(Math.round(i.preco * 100) / 100).replace(".", ",") : "",
  }));
  return {
    beneficiario: n.beneficiario ?? "",
    origem: n.origem ?? "",
    periodo: n.periodo ?? "",
    itens: itens.length ? itens : [itemVazio()],
    cidade: n.cidade ?? "Luanda",
    data: n.data,
  };
}

export function paraEntrada(f: Formulario): NotaEntrada {
  return {
    beneficiario: f.beneficiario,
    origem: f.origem,
    periodo: f.periodo,
    itens: f.itens.map((i) => ({ descricao: i.descricao, qtd: quantidadeDe(i.qtd), preco: numeroDe(i.preco) })),
    cidade: f.cidade,
    data: f.data,
  };
}

interface Props {
  valores: Formulario;
  onChange: (valores: Formulario) => void;
  /** Cabeçalho com o número da nota (atribuído pelo servidor). */
  cabecalho?: React.ReactNode;
}

export function NotaForm({ valores, onChange, cabecalho }: Props) {
  const total = totalDaNota(paraEntrada(valores));

  const set = (campo: keyof Omit<Formulario, "itens">, valor: string) => onChange({ ...valores, [campo]: valor });

  const setItem = (idx: number, campo: keyof ItemFormulario, valor: string) => {
    const itens = valores.itens.map((i, k) => (k === idx ? { ...i, [campo]: valor } : i));
    onChange({ ...valores, itens });
  };

  const adicionarItem = () => {
    if (valores.itens.length >= MAX_ITENS) return;
    onChange({ ...valores, itens: [...valores.itens, itemVazio()] });
    // Foca a nova linha após o React a desenhar.
    window.setTimeout(() => document.getElementById(`item-desc-${valores.itens.length}`)?.focus(), 0);
  };

  const removerItem = (idx: number) => {
    const itens = valores.itens.filter((_, k) => k !== idx);
    onChange({ ...valores, itens: itens.length ? itens : [itemVazio()] });
  };

  const onEnterNoPreco = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (idx === valores.itens.length - 1) adicionarItem();
    else document.getElementById(`item-desc-${idx + 1}`)?.focus();
  };

  return (
    <form className="space-y-7" onSubmit={(e) => e.preventDefault()} autoComplete="off" aria-label="Dados da nota de saída de caixa">
      <Seccao titulo="Documento" descricao="Número, data e local que aparecem na nota.">
        {cabecalho}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="rotulo" htmlFor="data">
              Data
            </label>
            <input id="data" type="date" className="campo" value={valores.data} onChange={(e) => set("data", e.target.value)} required />
          </div>
          <div>
            <label className="rotulo" htmlFor="cidade">
              Local
            </label>
            <input id="cidade" className="campo" value={valores.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Luanda" />
          </div>
        </div>
      </Seccao>

      <Seccao titulo="Saída" descricao="Quem recebe o dinheiro e de onde sai.">
        <div className="space-y-3">
          <div>
            <label className="rotulo" htmlFor="beneficiario">
              Beneficiário
            </label>
            <input
              id="beneficiario"
              className="campo"
              value={valores.beneficiario}
              onChange={(e) => set("beneficiario", e.target.value)}
              placeholder="Quem recebe o dinheiro (ex.: Isaac, Fornecedor X)"
              autoCapitalize="words"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="origem">
                Origem
              </label>
              <input
                id="origem"
                className="campo"
                value={valores.origem}
                onChange={(e) => set("origem", e.target.value)}
                placeholder="Ex.: Numerário, Cartão"
                autoCapitalize="sentences"
                list="origens"
              />
              <datalist id="origens">
                {ORIGENS_SUGERIDAS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="rotulo" htmlFor="periodo">
                Período <span className="font-normal text-tinta-suave/70">(opcional)</span>
              </label>
              <input
                id="periodo"
                className="campo"
                value={valores.periodo}
                onChange={(e) => set("periodo", e.target.value)}
                placeholder="Ex.: Setembro de 2026"
              />
            </div>
          </div>
        </div>
      </Seccao>

      <Seccao titulo="Itens" descricao="O valor de cada linha é a quantidade × o preço unitário, em kwanzas (Kz).">
        <div className="space-y-3 sm:space-y-2">
          <div className="hidden grid-cols-[minmax(0,1fr)_4.5rem_7.5rem_2.25rem] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-tinta-suave sm:grid">
            <span>Descrição</span>
            <span className="text-center">Qtd.</span>
            <span className="text-right">Preço unit.</span>
            <span />
          </div>
          {valores.itens.map((item, idx) => {
            const qtd = quantidadeDe(item.qtd);
            const preco = numeroDe(item.preco);
            return (
              <div
                key={idx}
                className="grid grid-cols-[6rem_minmax(0,1fr)_2.25rem] gap-2 border-b border-linha/70 pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_4.5rem_7.5rem_2.25rem] sm:border-0 sm:pb-0"
              >
                <input
                  id={`item-desc-${idx}`}
                  className="campo col-span-2 sm:col-span-1"
                  value={item.descricao}
                  onChange={(e) => setItem(idx, "descricao", e.target.value)}
                  placeholder={idx === 0 ? "Ex.: Cabo" : "Descrição"}
                  aria-label={`Descrição do item ${idx + 1}`}
                />
                <button
                  type="button"
                  className="botao-fantasma col-start-3 row-start-1 px-2 text-tinta-suave/70 hover:text-red-600 sm:col-start-4"
                  onClick={() => removerItem(idx)}
                  aria-label={`Remover item ${idx + 1}`}
                  disabled={valores.itens.length === 1 && !item.descricao && !item.preco}
                >
                  <IconeLixo />
                </button>
                <div className="relative col-start-1 row-start-2 sm:col-start-2 sm:row-start-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[11px] font-medium text-tinta-suave/70 sm:hidden">
                    Qtd.
                  </span>
                  <input
                    className="campo pl-10 text-right tabular-nums sm:pl-2 sm:text-center"
                    inputMode="decimal"
                    value={item.qtd}
                    onChange={(e) => setItem(idx, "qtd", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="1"
                    aria-label={`Quantidade do item ${idx + 1}`}
                  />
                </div>
                <div className="relative col-span-2 col-start-2 row-start-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[11px] font-medium text-tinta-suave/70 sm:hidden">
                    Preço unit.
                  </span>
                  <input
                    className="campo pl-20 text-right tabular-nums sm:pl-3.5"
                    inputMode="decimal"
                    value={item.preco}
                    onChange={(e) => setItem(idx, "preco", e.target.value)}
                    onKeyDown={(e) => onEnterNoPreco(e, idx)}
                    placeholder="0"
                    aria-label={`Preço unitário do item ${idx + 1}`}
                  />
                </div>
                {preco > 0 && (
                  <p className="col-span-full text-right text-xs tabular-nums text-tinta-suave sm:pr-11" aria-live="polite">
                    {formatarQtd(qtd)} × {formatarKz(preco)} ={" "}
                    <span className="font-semibold text-tinta">{formatarKz(subtotalItem({ qtd, preco }))} Kz</span>
                  </p>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button type="button" className="botao-secundario" onClick={adicionarItem} disabled={valores.itens.length >= MAX_ITENS}>
              <IconeMais />
              Adicionar item
            </button>
            <span className="text-xs text-tinta-suave">
              {valores.itens.length} / {MAX_ITENS}
            </span>
          </div>

          <div className="mt-2 rounded-2xl border border-laranja/30 bg-laranja-claro/70 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-tinta-suave">Total da saída</span>
              <span className="text-xl font-bold tabular-nums text-laranja-escuro">
                {formatarKz(total)} <span className="text-sm font-semibold">Kz</span>
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-tinta-suave">{kwanzasPorExtenso(total)}</p>
          </div>
        </div>
      </Seccao>
    </form>
  );
}

function Seccao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3">
        <span className="block text-base font-semibold text-tinta">{titulo}</span>
        {descricao && <span className="mt-0.5 block text-xs text-tinta-suave">{descricao}</span>}
      </legend>
      {children}
    </fieldset>
  );
}
