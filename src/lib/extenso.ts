/**
 * Converte valores monetários em kwanzas para extenso (português europeu / Angola).
 * Ex.: 116400 -> "Cento e dezasseis mil e quatrocentos kwanzas."
 */

const UNIDADES = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quinze",
  "dezasseis",
  "dezassete",
  "dezoito",
  "dezanove",
];

const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];

const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

/** 0..999 por extenso ("" para 0 quando `vazioParaZero`). */
function ateMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

/** Ligação entre grupos (milhões/milhares) e o resto: "e" quando o resto é < 100 ou uma centena redonda. */
function ligacao(resto: number): string {
  if (resto === 0) return "";
  return resto < 100 || resto % 100 === 0 ? " e " : " ";
}

/** Número inteiro (0 .. 999 999 999 999) por extenso. */
export function inteiroPorExtenso(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "zero";

  const bilioes = Math.floor(n / 1_000_000_000);
  const milhoes = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  let texto = "";

  if (bilioes > 0) {
    texto += bilioes === 1 ? "mil milhões" : `${ateMil(bilioes)} mil milhões`;
    const seguinte = n % 1_000_000_000;
    if (seguinte > 0) texto += seguinte < 1_000_000 ? ligacao(seguinte) : ", ";
  }

  if (milhoes > 0) {
    texto += milhoes === 1 ? "um milhão" : `${ateMil(milhoes)} milhões`;
    const seguinte = n % 1_000_000;
    if (seguinte > 0) texto += seguinte < 1000 ? ligacao(seguinte) : ", ";
  }

  if (milhares > 0) {
    texto += milhares === 1 ? "mil" : `${ateMil(milhares)} mil`;
    if (resto > 0) texto += ligacao(resto);
  }

  if (resto > 0) texto += ateMil(resto);

  return texto;
}

/**
 * Valor em kwanzas por extenso, com a primeira letra maiúscula e ponto final.
 * Ex.: 42000 -> "Quarenta e dois mil kwanzas."
 *      1 -> "Um kwanza."
 *      1000000 -> "Um milhão de kwanzas."
 *      2500.5 -> "Dois mil e quinhentos kwanzas e cinquenta cêntimos."
 */
export function kwanzasPorExtenso(valor: number): string {
  if (!Number.isFinite(valor)) valor = 0;
  const negativo = valor < 0;
  const abs = Math.abs(valor);
  const inteiro = Math.floor(abs + 1e-9);
  const centimos = Math.round((abs - inteiro) * 100) % 100;

  let texto: string;
  if (inteiro === 0 && centimos > 0) {
    texto = "";
  } else {
    const numero = inteiroPorExtenso(inteiro);
    const moeda = inteiro === 1 ? "kwanza" : "kwanzas";
    // "um milhão de kwanzas" / "dois milhões de kwanzas" quando não há resto abaixo do milhão
    const de = inteiro >= 1_000_000 && inteiro % 1_000_000 === 0 ? " de" : "";
    texto = `${numero}${de} ${moeda}`;
  }

  if (centimos > 0) {
    const c = `${inteiroPorExtenso(centimos)} ${centimos === 1 ? "cêntimo" : "cêntimos"}`;
    texto = texto ? `${texto} e ${c}` : c;
  }

  if (negativo) texto = `menos ${texto}`;
  texto = texto.charAt(0).toUpperCase() + texto.slice(1);
  return `${texto}.`;
}
