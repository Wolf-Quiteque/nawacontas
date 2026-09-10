"use client";

import { kwanzasPorExtenso } from "@/lib/extenso";
import { formatarKz, type NotaData, valorLiquido } from "@/lib/nota";

/** Valores do formulário (números como texto para edição livre). */
export interface Formulario {
  numero: string;
  nome: string;
  motivo: string;
  periodo: string;
  remuneracao: string;
  taxaRemuneracao: string;
  desconto: string;
  taxaDesconto: string;
  cidade: string;
  data: string;
}

export function numeroDe(texto: string): number {
  const limpo = texto.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const v = parseFloat(limpo);
  return Number.isFinite(v) ? v : 0;
}

export function paraFormulario(n: NotaData): Formulario {
  return {
    numero: n.numero,
    nome: n.nome,
    motivo: n.motivo ?? "",
    periodo: n.periodo,
    remuneracao: n.remuneracao ? String(n.remuneracao) : "",
    taxaRemuneracao: n.taxaRemuneracao,
    desconto: n.desconto ? String(n.desconto) : "",
    taxaDesconto: n.taxaDesconto,
    cidade: n.cidade,
    data: n.data,
  };
}

export function paraNota(f: Formulario): NotaData {
  return {
    numero: f.numero,
    nome: f.nome,
    motivo: f.motivo,
    periodo: f.periodo,
    remuneracao: numeroDe(f.remuneracao),
    taxaRemuneracao: f.taxaRemuneracao,
    desconto: numeroDe(f.desconto),
    taxaDesconto: f.taxaDesconto,
    cidade: f.cidade,
    data: f.data,
  };
}

/** Percentagem numérica de um texto de taxa ("3%", "3", "3,5 %"). */
function percentagemDe(taxa: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*%?\s*$/.exec(taxa);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
}

interface Props {
  valores: Formulario;
  onChange: (valores: Formulario) => void;
}

export function NotaForm({ valores, onChange }: Props) {
  const nota = paraNota(valores);
  const liquido = valorLiquido(nota);

  const set = (campo: keyof Formulario, valor: string) => {
    const novo = { ...valores, [campo]: valor };
    // Recalcula o desconto quando a taxa é uma percentagem numérica.
    if (campo === "taxaDesconto" || campo === "remuneracao") {
      const pct = percentagemDe(novo.taxaDesconto);
      if (pct !== null) {
        const base = numeroDe(novo.remuneracao);
        novo.desconto = base ? String(Math.round(base * pct) / 100) : "";
      }
    }
    onChange(novo);
  };

  return (
    <form
      className="space-y-7"
      onSubmit={(e) => e.preventDefault()}
      autoComplete="off"
      aria-label="Dados da nota de pagamento"
    >
      <Seccao titulo="Documento" descricao="Número, data e local que aparecem na nota.">
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <div>
            <label className="rotulo" htmlFor="numero">
              N.º
            </label>
            <input
              id="numero"
              className="campo"
              inputMode="numeric"
              value={valores.numero}
              onChange={(e) => set("numero", e.target.value)}
              placeholder="18"
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="data">
              Data
            </label>
            <input
              id="data"
              type="date"
              className="campo"
              value={valores.data}
              onChange={(e) => set("data", e.target.value)}
              required
            />
          </div>
          <div className="col-span-2">
            <label className="rotulo" htmlFor="cidade">
              Local
            </label>
            <input
              id="cidade"
              className="campo"
              value={valores.cidade}
              onChange={(e) => set("cidade", e.target.value)}
              placeholder="Luanda"
            />
          </div>
        </div>
      </Seccao>

      <Seccao titulo="Trabalhador" descricao="Identificação de quem recebe o pagamento.">
        <div className="space-y-3">
          <div>
            <label className="rotulo" htmlFor="nome">
              Nome do trabalhador
            </label>
            <input
              id="nome"
              className="campo"
              value={valores.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex.: Isaac"
              autoCapitalize="words"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="motivo">
                Motivo
              </label>
              <input
                id="motivo"
                className="campo"
                value={valores.motivo}
                onChange={(e) => set("motivo", e.target.value)}
                placeholder="Ex.: Salário, Adiantamento"
                autoCapitalize="sentences"
                list="motivos"
              />
              <datalist id="motivos">
                <option value="Salário" />
                <option value="Adiantamento" />
                <option value="Subsídio" />
                <option value="Horas extra" />
                <option value="Prémio" />
              </datalist>
            </div>
            <div>
              <label className="rotulo" htmlFor="periodo">
                Período de pagamento
              </label>
              <input
                id="periodo"
                className="campo"
                value={valores.periodo}
                onChange={(e) => set("periodo", e.target.value)}
                placeholder="Ex.: Agosto de 2026"
              />
            </div>
          </div>
        </div>
      </Seccao>

      <Seccao titulo="Valores" descricao="Montantes em kwanzas (Kz).">
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div>
              <label className="rotulo" htmlFor="remuneracao">
                Remuneração de referência
              </label>
              <input
                id="remuneracao"
                className="campo text-right tabular-nums"
                inputMode="decimal"
                value={valores.remuneracao}
                onChange={(e) => set("remuneracao", e.target.value)}
                placeholder="42000"
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="taxaRemuneracao">
                Taxa
              </label>
              <input
                id="taxaRemuneracao"
                className="campo text-center"
                value={valores.taxaRemuneracao}
                onChange={(e) => set("taxaRemuneracao", e.target.value)}
                placeholder="—"
              />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div>
              <label className="rotulo" htmlFor="desconto">
                Desconto para a Segurança Social
              </label>
              <input
                id="desconto"
                className="campo text-right tabular-nums"
                inputMode="decimal"
                value={valores.desconto}
                onChange={(e) => set("desconto", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="taxaDesconto">
                Taxa
              </label>
              <input
                id="taxaDesconto"
                className="campo text-center"
                inputMode="decimal"
                value={valores.taxaDesconto}
                onChange={(e) => set("taxaDesconto", e.target.value)}
                placeholder="3%"
              />
            </div>
          </div>
          <p className="text-xs text-tinta-suave">
            Se escrever uma percentagem na taxa (ex.: 3%), o desconto é calculado automaticamente.
          </p>

          <div className="rounded-2xl border border-laranja/30 bg-laranja-claro/70 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-tinta-suave">Valor líquido a pagar</span>
              <span className="text-xl font-bold tabular-nums text-laranja-escuro">
                {formatarKz(liquido)} <span className="text-sm font-semibold">Kz</span>
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-tinta-suave">{kwanzasPorExtenso(liquido)}</p>
          </div>
        </div>
      </Seccao>
    </form>
  );
}

function Seccao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
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
