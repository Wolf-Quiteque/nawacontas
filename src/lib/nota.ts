import { kwanzasPorExtenso } from "./extenso";

/** Linha da lista de saídas (ex.: "Cabo", 2 × 3.000 Kz = 6.000 Kz). */
export interface ItemSaida {
  descricao: string;
  /** Quantidade (pode ter decimais, ex.: 2,5 litros). */
  qtd: number;
  /** Preço unitário em kwanzas; o valor da linha é qtd × preço. */
  preco: number;
}

/** Número máximo de itens que cabem numa página A4. */
export const MAX_ITENS = 12;

/** Dados de uma nota de saída de caixa. */
export interface NotaData {
  /** Número sequencial da nota (ex.: "36"). */
  numero: string;
  /** Quem recebe o dinheiro. */
  beneficiario: string;
  /** De onde sai o dinheiro: Numerário, Cartão, Transferência, ... */
  origem: string;
  /** Período ou referência a que a saída diz respeito (opcional). */
  periodo: string;
  itens: ItemSaida[];
  cidade: string;
  /** Data no formato ISO (AAAA-MM-DD). */
  data: string;
}

/** Dados enviados para a base de dados (o número é atribuído pelo servidor). */
export type NotaEntrada = Omit<NotaData, "numero">;

/** Nota registada na base de dados. */
export interface NotaRegisto extends NotaEntrada {
  id: string;
  numero: number;
  total: number;
  /** Quem registou a nota (null nas notas anteriores às contas de utilizador). */
  criadoPorNome: string | null;
  criadoPorTelefone: string | null;
  criadaEm: string;
  atualizadaEm: string;
}

function numeroSolto(v: unknown): number {
  const n = typeof v === "string" ? Number.parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Normaliza um item guardado em qualquer versão da app.
 * Na versão anterior, `valor` era o total da linha e `qtd` um texto opcional; converte-se
 * para preço unitário de forma a manter o mesmo total.
 */
export function normalizarItem(raw: unknown): ItemSaida {
  const i = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const descricao = String(i.descricao ?? "");
  const q = numeroSolto(i.qtd);
  if (i.preco !== undefined) {
    return { descricao, qtd: q > 0 ? q : 1, preco: numeroSolto(i.preco) || 0 };
  }
  const valor = numeroSolto(i.valor) || 0;
  return q > 0 ? { descricao, qtd: q, preco: valor / q } : { descricao, qtd: 1, preco: valor };
}

export function arredondar(v: number): number {
  return Math.round((Number(v) || 0) * 100) / 100;
}

export function subtotalItem(i: Pick<ItemSaida, "qtd" | "preco">): number {
  return arredondar((Number(i.qtd) || 0) * (Number(i.preco) || 0));
}

export function registoParaNota(r: NotaRegisto): NotaData {
  return {
    numero: String(r.numero),
    beneficiario: r.beneficiario,
    origem: r.origem,
    periodo: r.periodo,
    itens: (r.itens ?? []).map(normalizarItem),
    cidade: r.cidade,
    data: r.data,
  };
}

export const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export const ORIGENS_SUGERIDAS = ["Numerário", "Caixa", "Cartão", "Transferência bancária", "Multicaixa Express", "Depósito"];

/** Data de hoje em formato ISO local (AAAA-MM-DD). */
export function hojeISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function partesData(iso: string): { dia: number; mes: number; ano: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

/** "17 de agosto de 2026" */
export function dataPorExtenso(iso: string): string {
  const p = partesData(iso);
  if (!p) return "";
  return `${p.dia} de ${MESES[p.mes - 1] ?? ""} de ${p.ano}`;
}

export function anoDaData(iso: string): string {
  const p = partesData(iso);
  return p ? String(p.ano) : String(new Date().getFullYear());
}

function comPontosMilhar(inteiro: string): string {
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Formata um valor como "42.000,00". */
export function formatarKz(valor: number): string {
  if (!Number.isFinite(valor)) valor = 0;
  const negativo = valor < 0;
  const [inteiro, dec] = Math.abs(valor).toFixed(2).split(".");
  return `${negativo ? "-" : ""}${comPontosMilhar(inteiro)},${dec}`;
}

/** Formata uma quantidade: "2", "2,5", "1.000". */
export function formatarQtd(qtd: number): string {
  if (!Number.isFinite(qtd)) return "";
  const r = Math.round(qtd * 1000) / 1000;
  const [inteiro, dec] = Math.abs(r).toString().split(".");
  return `${r < 0 ? "-" : ""}${comPontosMilhar(inteiro)}${dec ? `,${dec}` : ""}`;
}

export function totalDaNota(n: Pick<NotaData, "itens">): number {
  return arredondar((n.itens ?? []).reduce((s, i) => s + subtotalItem(i), 0));
}

export function notaPadrao(numero = ""): NotaData {
  const hoje = hojeISO();
  const p = partesData(hoje)!;
  const mes = MESES[p.mes - 1];
  return {
    numero,
    beneficiario: "",
    origem: "",
    periodo: `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${p.ano}`,
    itens: [{ descricao: "", qtd: 1, preco: 0 }],
    cidade: "Luanda",
    data: hoje,
  };
}

/** Todos os textos finais que aparecem no documento, derivados dos dados. */
export interface NotaTextos {
  numeroCompleto: string;
  introducao: string;
  beneficiario: string;
  origem: string;
  periodo: string;
  itens: Array<{ descricao: string; qtd: string; preco: string; subtotal: string }>;
  total: string;
  extenso: string;
  declaracao: string;
  localData: string;
}

export function textosDaNota(n: NotaData): NotaTextos {
  const total = totalDaNota(n);
  const itens = (n.itens ?? [])
    .filter((i) => i.descricao.trim() || Number(i.preco))
    .map((i) => ({
      descricao: i.descricao.trim(),
      qtd: formatarQtd(Number(i.qtd) || 0),
      preco: formatarKz(Number(i.preco) || 0),
      subtotal: formatarKz(subtotalItem(i)),
    }));
  return {
    numeroCompleto: `N.º ${n.numero.trim() || "—"} / ${anoDaData(n.data)}`,
    introducao:
      "A empresa NawaBus declara, para os devidos efeitos, a saída de caixa abaixo identificada, " +
      "entregue ao beneficiário indicado e referente aos itens discriminados neste documento.",
    beneficiario: n.beneficiario.trim(),
    origem: n.origem.trim(),
    periodo: n.periodo.trim(),
    itens,
    total: formatarKz(total),
    extenso: `Valor por extenso: ${kwanzasPorExtenso(total)}`,
    declaracao:
      "Declaro ter recebido da NawaBus o valor total acima indicado, relativo aos itens discriminados neste documento.",
    localData: `${n.cidade.trim() || "Luanda"}, ${dataPorExtenso(n.data)}`,
  };
}

/** Nome de ficheiro sugerido para o PDF. */
export function nomeFicheiro(n: NotaData): string {
  const nome = n.beneficiario
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const num = (n.numero.trim() || "0").replace(/[^0-9A-Za-z]+/g, "-");
  return `Nota_de_Saida_de_Caixa_NawaBus_${num}_${anoDaData(n.data)}${nome ? `_${nome}` : ""}.pdf`;
}
