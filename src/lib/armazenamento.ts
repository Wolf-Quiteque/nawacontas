import { anoDaData, type NotaData, type NotaGuardada } from "./nota";

const CHAVE_RASCUNHO = "nawanotas.rascunho";
const CHAVE_HISTORICO = "nawanotas.historico";

function ler<T>(chave: string): T | null {
  try {
    const raw = localStorage.getItem(chave);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function escrever(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* armazenamento indisponível (modo privado, etc.) */
  }
}

/** Compatibilidade com notas guardadas antes de "Função" passar a "Motivo". */
function migrar<T extends NotaData>(n: T & { funcao?: string }): T {
  if (n.motivo === undefined) n.motivo = n.funcao ?? "";
  delete n.funcao;
  return n;
}

export function lerRascunho(): NotaData | null {
  const n = ler<NotaData>(CHAVE_RASCUNHO);
  return n ? migrar(n) : null;
}

export function guardarRascunho(nota: NotaData) {
  escrever(CHAVE_RASCUNHO, nota);
}

export function lerHistorico(): NotaGuardada[] {
  return (ler<NotaGuardada[]>(CHAVE_HISTORICO) ?? []).map(migrar);
}

export function guardarNoHistorico(nota: NotaData, id?: string): NotaGuardada {
  const lista = lerHistorico();
  const existente = id ? lista.find((n) => n.id === id) : undefined;
  const guardada: NotaGuardada = {
    ...nota,
    id: existente?.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    criadaEm: existente?.criadaEm ?? new Date().toISOString(),
  };
  const nova = [guardada, ...lista.filter((n) => n.id !== guardada.id)].slice(0, 200);
  escrever(CHAVE_HISTORICO, nova);
  return guardada;
}

export function removerDoHistorico(id: string): NotaGuardada[] {
  const nova = lerHistorico().filter((n) => n.id !== id);
  escrever(CHAVE_HISTORICO, nova);
  return nova;
}

/** Próximo número sequencial para o ano indicado, com base no histórico. */
export function proximoNumero(ano: string, historico = lerHistorico()): string {
  let max = 0;
  for (const n of historico) {
    if (anoDaData(n.data) !== ano) continue;
    const v = parseInt(n.numero, 10);
    if (Number.isFinite(v) && v > max) max = v;
  }
  return String(max + 1);
}
