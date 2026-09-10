import type { NotaEntrada } from "./nota";

/** Rascunho da nota em edição (apenas para a nota nova), guardado no dispositivo. */
const CHAVE_RASCUNHO = "nawanotas.rascunho.v3";
/** Número da nota cujos dados foram copiados para a nova nota ("Reutilizar"). */
const CHAVE_REUTILIZADA = "nawanotas.reutilizada";

export function lerRascunho(): NotaEntrada | null {
  try {
    const raw = localStorage.getItem(CHAVE_RASCUNHO);
    return raw ? (JSON.parse(raw) as NotaEntrada) : null;
  } catch {
    return null;
  }
}

export function guardarRascunho(nota: NotaEntrada) {
  try {
    localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(nota));
  } catch {
    /* armazenamento indisponível */
  }
}

export function limparRascunho() {
  try {
    localStorage.removeItem(CHAVE_RASCUNHO);
  } catch {
    /* ignorar */
  }
}

/** Prepara uma nova nota com os dados de uma nota já registada (data de hoje). */
export function reutilizarNota(nota: NotaEntrada, numeroOrigem: number, dataHoje: string) {
  guardarRascunho({ ...nota, data: dataHoje });
  try {
    sessionStorage.setItem(CHAVE_REUTILIZADA, String(numeroOrigem));
  } catch {
    /* ignorar */
  }
}

/** Devolve (e limpa) o número da nota reutilizada, se existir. */
export function consumirReutilizada(): number | null {
  try {
    const v = sessionStorage.getItem(CHAVE_REUTILIZADA);
    if (!v) return null;
    sessionStorage.removeItem(CHAVE_REUTILIZADA);
    return Number(v) || null;
  } catch {
    return null;
  }
}
