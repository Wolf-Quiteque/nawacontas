import { kwanzasPorExtenso } from "./extenso";

/** Dados introduzidos pelo utilizador para uma nota de pagamento. */
export interface NotaData {
  /** Número sequencial da nota (ex.: "18"). */
  numero: string;
  nome: string;
  motivo: string;
  periodo: string;
  /** Remuneração de referência em kwanzas. */
  remuneracao: number;
  /** Texto livre da coluna "Taxa" na linha de remuneração (normalmente vazio). */
  taxaRemuneracao: string;
  /** Desconto para a Segurança Social em kwanzas. */
  desconto: number;
  /** Texto da coluna "Taxa" na linha do desconto (ex.: "3%"). */
  taxaDesconto: string;
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
  criadaEm: string;
  atualizadaEm: string;
}

export function registoParaNota(r: NotaRegisto): NotaData {
  return {
    numero: String(r.numero),
    nome: r.nome,
    motivo: r.motivo,
    periodo: r.periodo,
    remuneracao: Number(r.remuneracao) || 0,
    taxaRemuneracao: r.taxaRemuneracao,
    desconto: Number(r.desconto) || 0,
    taxaDesconto: r.taxaDesconto,
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

export function valorLiquido(n: Pick<NotaData, "remuneracao" | "desconto">): number {
  const v = (n.remuneracao || 0) - (n.desconto || 0);
  return Math.round(v * 100) / 100;
}

export function notaPadrao(numero = "1"): NotaData {
  const hoje = hojeISO();
  const p = partesData(hoje)!;
  const mes = MESES[p.mes - 1];
  return {
    numero,
    nome: "",
    motivo: "",
    periodo: `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${p.ano}`,
    remuneracao: 0,
    taxaRemuneracao: "",
    desconto: 0,
    taxaDesconto: "",
    cidade: "Luanda",
    data: hoje,
  };
}

/** Todos os textos finais que aparecem no documento, derivados dos dados. */
export interface NotaTextos {
  numeroCompleto: string;
  introducao: string;
  nome: string;
  motivo: string;
  periodo: string;
  remuneracao: string;
  taxaRemuneracao: string;
  desconto: string;
  taxaDesconto: string;
  liquido: string;
  extenso: string;
  declaracao: string;
  localData: string;
}

export function textosDaNota(n: NotaData): NotaTextos {
  const liquido = valorLiquido(n);
  return {
    numeroCompleto: `N.º ${n.numero.trim() || "—"} / ${anoDaData(n.data)}`,
    introducao:
      "A empresa NawaBus declara, para os devidos efeitos, o pagamento ao trabalhador abaixo identificado, " +
      "referente aos serviços prestados na função de motorista.",
    nome: n.nome.trim(),
    motivo: (n.motivo ?? "").trim(),
    periodo: n.periodo.trim(),
    remuneracao: formatarKz(n.remuneracao || 0),
    taxaRemuneracao: n.taxaRemuneracao.trim(),
    desconto: formatarKz(n.desconto || 0),
    taxaDesconto: n.taxaDesconto.trim(),
    liquido: formatarKz(liquido),
    extenso: `Valor por extenso: ${kwanzasPorExtenso(liquido)}`,
    declaracao:
      "Declaro ter recebido da NawaBus o valor líquido acima indicado, relativo ao período de pagamento assinalado neste documento.",
    localData: `${n.cidade.trim() || "Luanda"}, ${dataPorExtenso(n.data)}`,
  };
}

/** Nome de ficheiro sugerido para o PDF. */
export function nomeFicheiro(n: NotaData): string {
  const nome = n.nome
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const num = (n.numero.trim() || "0").replace(/[^0-9A-Za-z]+/g, "-");
  return `Nota_de_Pagamento_NawaBus_${num}_${anoDaData(n.data)}${nome ? `_${nome}` : ""}.pdf`;
}
