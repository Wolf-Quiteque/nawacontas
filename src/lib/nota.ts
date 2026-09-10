import { kwanzasPorExtenso } from "./extenso";

/** Linha da lista de saídas (ex.: "Portagem", qtd "3", 9000). */
export interface ItemSaida {
  descricao: string;
  /** Quantidade ou observação curta (texto livre, opcional). */
  qtd: string;
  /** Valor da linha em kwanzas. */
  valor: number;
}

/** Número máximo de itens que cabem numa página A4. */
export const MAX_ITENS = 12;

/** Dados de uma nota de saída de caixa. */
export interface NotaData {
  /** Número sequencial da nota (ex.: "36"). */
  numero: string;
  /** Quem recebe o dinheiro. */
  beneficiario: string;
  /** De onde sai o dinheiro: Caixa, Cartão, Transferência, ... */
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
  criadaEm: string;
  atualizadaEm: string;
}

export function registoParaNota(r: NotaRegisto): NotaData {
  return {
    numero: String(r.numero),
    beneficiario: r.beneficiario,
    origem: r.origem,
    periodo: r.periodo,
    itens: (r.itens ?? []).map((i) => ({ descricao: i.descricao, qtd: i.qtd ?? "", valor: Number(i.valor) || 0 })),
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

export const ORIGENS_SUGERIDAS = ["Caixa", "Cartão", "Transferência bancária", "Multicaixa Express", "Depósito"];

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

/** Formata um valor como "42.000,00". */
export function formatarKz(valor: number): string {
  if (!Number.isFinite(valor)) valor = 0;
  const negativo = valor < 0;
  const abs = Math.abs(valor);
  const fixo = abs.toFixed(2);
  const [inteiro, dec] = fixo.split(".");
  const comPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-" : ""}${comPontos},${dec}`;
}

export function totalDaNota(n: Pick<NotaData, "itens">): number {
  const soma = (n.itens ?? []).reduce((s, i) => s + (Number(i.valor) || 0), 0);
  return Math.round(soma * 100) / 100;
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
    itens: [{ descricao: "", qtd: "", valor: 0 }],
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
  itens: Array<{ descricao: string; qtd: string; valor: string }>;
  total: string;
  extenso: string;
  declaracao: string;
  localData: string;
}

export function textosDaNota(n: NotaData): NotaTextos {
  const total = totalDaNota(n);
  const itens = (n.itens ?? [])
    .filter((i) => i.descricao.trim() || i.valor)
    .map((i) => ({ descricao: i.descricao.trim(), qtd: (i.qtd ?? "").trim(), valor: formatarKz(Number(i.valor) || 0) }));
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
