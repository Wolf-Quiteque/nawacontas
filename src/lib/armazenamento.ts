import type { NotaEntrada } from "./nota";

/** Rascunho da nota em edição (apenas para a nota nova), guardado no dispositivo. */
const CHAVE_RASCUNHO = "nawanotas.rascunho.v2";

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
