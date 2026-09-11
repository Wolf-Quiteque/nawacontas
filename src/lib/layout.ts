/**
 * Layout partilhado da nota de saída de caixa, em pontos (pt) sobre uma página A4.
 * Todas as coordenadas foram medidas no modelo original (Nota_de_Pagamento_..._NawaBus_issac.pdf)
 * e são usadas tanto pelo gerador de PDF (pdf-lib) como pela pré-visualização (SVG),
 * garantindo que ambos são idênticos.
 */
import { textosDaNota, type NotaData } from "./nota";

export const PAGE = { w: 595.28, h: 841.89 } as const;

export const CORES = {
  laranja: "#F28C1B",
  titulo: "#222222",
  tinta: "#111111",
  cinza: "#555555",
  cinzaClaro: "#888888",
  branco: "#FFFFFF",
  fundoRotulo: "#F1F1F1",
  bordaInfo: "#D2D2D2",
  cabecalhoTabela: "#303030",
  bordaTabela: "#D4D4D4",
  fundoTotal: "#FFF0E1",
  totalLaranja: "#C75A00",
  linhaAssinatura: "#777777",
} as const;

export type Align = "left" | "right" | "center";

export interface TextPrimitive {
  kind: "text";
  text: string;
  x: number;
  /** Linha de base (baseline), medida a partir do topo da página. */
  y: number;
  size: number;
  bold: boolean;
  color: string;
  align: Align;
}

export interface RectPrimitive {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

export interface LinePrimitive {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export type Primitive = TextPrimitive | RectPrimitive | LinePrimitive;

/** Mede a largura de um texto (em pt) para um tamanho e peso. */
export type Measure = (text: string, size: number, bold: boolean) => number;

/** Quebra um parágrafo em linhas que caibam em `maxWidth`. */
export function quebrarLinhas(
  text: string,
  size: number,
  bold: boolean,
  maxWidth: number,
  measure: Measure,
): string[] {
  const palavras = text.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (measure(tentativa, size, bold) <= maxWidth || !atual) {
      atual = tentativa;
    } else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [""];
}

const MARGEM_ESQ = 47.5;
const LARGURA_TEXTO = 481;
const BORDA_DIR = 529.78;

export function layoutNota(nota: NotaData, measure: Measure): Primitive[] {
  const t = textosDaNota(nota);
  const p: Primitive[] = [];

  const text = (
    text: string,
    x: number,
    y: number,
    size: number,
    opts: Partial<Pick<TextPrimitive, "bold" | "color" | "align">> = {},
  ) =>
    p.push({
      kind: "text",
      text,
      x,
      y,
      size,
      bold: opts.bold ?? false,
      color: opts.color ?? CORES.tinta,
      align: opts.align ?? "left",
    });
  const rect = (x: number, y: number, w: number, h: number, fill: string) =>
    p.push({ kind: "rect", x, y, w, h, fill });
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, width = 0.75) =>
    p.push({ kind: "line", x1, y1, x2, y2, color, width });

  /** Encurta um texto com reticências para caber em `max` (pt). */
  const cortar = (s: string, size: number, bold: boolean, max: number): string => {
    if (measure(s, size, bold) <= max) return s;
    let r = s;
    while (r.length > 1 && measure(`${r}…`, size, bold) > max) r = r.slice(0, -1);
    return `${r.trimEnd()}…`;
  };

  const paragrafo = (
    texto: string,
    yInicial: number,
    size: number,
    lineHeight: number,
    bold: boolean,
  ): number => {
    const linhas = quebrarLinhas(texto, size, bold, LARGURA_TEXTO, measure);
    let y = yInicial;
    linhas.forEach((linha, i) => {
      y = yInicial + i * lineHeight;
      text(linha, MARGEM_ESQ, y, size, { bold });
    });
    return y; // baseline da última linha
  };

  // ---- Cabeçalho ----
  text("NAWABUS", 75.25, 83.15, 22.5, { bold: true, color: CORES.laranja });
  text("NOTA DE SAÍDA DE CAIXA", 520, 77.05, 16, { bold: true, color: CORES.titulo, align: "right" });
  rect(69, 116, 457, 2, CORES.laranja);
  text(t.numeroCompleto, BORDA_DIR, 131.73, 9.5, { color: CORES.cinza, align: "right" });

  // ---- Introdução ----
  let y = paragrafo(t.introducao, 156.59, 10.5, 14, false);

  // ---- Tabela de identificação ----
  const infoTop = y + 14.92;
  const infoX0 = 68.5;
  const infoX1 = 212.5;
  const infoX2 = 526.5;
  const infoLinhas: Array<[string, string]> = [
    ["Beneficiário", t.beneficiario],
    ["Origem", t.origem],
    ["Período", t.periodo],
  ];
  const alturaInfo = 25;
  infoLinhas.forEach(([rotulo, valor], i) => {
    const top = infoTop + i * alturaInfo;
    rect(infoX0, top, infoX1 - infoX0, alturaInfo, CORES.fundoRotulo);
    text(rotulo, 74.5, top + 16.6, 10.5, { bold: true });
    if (valor) text(cortar(valor, 10.5, false, infoX2 - 218.5 - 6), 218.5, top + 16.6, 10.5);
  });
  const infoBottom = infoTop + alturaInfo * infoLinhas.length;
  for (let i = 0; i <= infoLinhas.length; i++) {
    const yy = infoTop + i * alturaInfo;
    line(infoX0 - 0.5, yy, infoX2 - 0.5, yy, CORES.bordaInfo);
  }
  for (const x of [infoX0, infoX1, infoX2]) line(x, infoTop - 0.5, x, infoBottom + 0.5, CORES.bordaInfo);

  // ---- Tabela de itens: Descrição | Qtd. | Preço unit. | Total ----
  const payTop = infoBottom + 12;
  const colX = [70.5, 262.5, 314.5, 420.5, 525.5];
  const alturaCabecalho = 23;
  const alturaLinha = 24;
  const xDesc = 76;
  const xQtd = (colX[1] + colX[2]) / 2;
  const xPreco = colX[3] - 6.25;
  const xTotal = colX[4] - 6.25;
  const larguraDesc = colX[1] - xDesc - 6;
  const larguraTabela = colX[colX.length - 1] - colX[0];

  rect(colX[0], payTop, larguraTabela, alturaCabecalho, CORES.cabecalhoTabela);
  const yCab = payTop + 15.96;
  text("Descrição", xDesc, yCab, 10.5, { bold: true, color: CORES.branco });
  text("Qtd.", xQtd, yCab, 10.5, { bold: true, color: CORES.branco, align: "center" });
  text("Preço unit. (Kz)", xPreco, yCab, 10.5, { bold: true, color: CORES.branco, align: "right" });
  text("Total (Kz)", xTotal, yCab, 10.5, { bold: true, color: CORES.branco, align: "right" });

  const itens = t.itens.length ? t.itens : [{ descricao: "", qtd: "", preco: "", subtotal: "" }];
  const linhasTabela: Array<{ desc: string; qtd: string; preco: string; valor: string; total?: boolean }> = [
    ...itens.map((i) => ({ desc: i.descricao, qtd: i.qtd, preco: i.preco, valor: i.subtotal })),
    { desc: "Total", qtd: "", preco: "", valor: t.total, total: true },
  ];
  linhasTabela.forEach((l, i) => {
    const top = payTop + alturaCabecalho + i * alturaLinha;
    if (l.total) rect(colX[0], top, larguraTabela, alturaLinha, CORES.fundoTotal);
    const yb = top + 16.58;
    const bold = !!l.total;
    if (l.desc) text(cortar(l.desc, 10.5, bold, larguraDesc), xDesc, yb, 10.5, { bold });
    if (l.qtd) text(l.qtd, xQtd, yb, 10.5, { align: "center" });
    if (l.preco) text(l.preco, xPreco, yb, 10.5, { align: "right" });
    if (l.valor)
      text(l.valor, xTotal, yb, 10.5, {
        bold,
        align: "right",
        color: l.total ? CORES.totalLaranja : CORES.tinta,
      });
  });
  const payBottom = payTop + alturaCabecalho + alturaLinha * linhasTabela.length;
  const yLinhasH = [payTop, payTop + alturaCabecalho];
  for (let i = 1; i <= linhasTabela.length; i++) yLinhasH.push(payTop + alturaCabecalho + i * alturaLinha);
  for (const yy of yLinhasH) line(colX[0] - 0.5, yy, colX[colX.length - 1] + 0.5, yy, CORES.bordaTabela);
  for (const x of colX) line(x, payTop - 0.5, x, payBottom + 0.5, CORES.bordaTabela);

  // ---- Valor por extenso + declaração ----
  y = paragrafo(t.extenso, payBottom + 19.73, 10.5, 14, true);
  y = paragrafo(t.declaracao, y + 18.14, 9.5, 12.65, false);

  // ---- Local e data ----
  y += 26.13;
  text(t.localData, BORDA_DIR, y, 10, { align: "right" });

  // ---- Assinaturas ----
  y += 24.35;
  line(81, y, 513, y, CORES.linhaAssinatura);
  const cEmpresa = 189.25;
  const cTrabalhador = 405.25;
  y += 18.62;
  text("Pela NawaBus", cEmpresa, y, 10.5, { bold: true, align: "center" });
  text("O Beneficiário", cTrabalhador, y, 10.5, { bold: true, align: "center" });
  y += 12.19;
  text("Nome e assinatura", cEmpresa, y, 8.5, { color: CORES.cinzaClaro, align: "center" });
  text("Nome e assinatura", cTrabalhador, y, 8.5, { color: CORES.cinzaClaro, align: "center" });

  // ---- Rodapé ----
  text("NawaBus — Documento interno de saída de caixa", PAGE.w / 2, 809.6, 8, {
    color: CORES.cinzaClaro,
    align: "center",
  });

  return p;
}
