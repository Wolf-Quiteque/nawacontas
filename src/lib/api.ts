import type { NotaEntrada, NotaRegisto } from "./nota";

export class ErroApi extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ErroApi("Sem ligação ao servidor. Verifique a internet e tente novamente.", 0);
  }
  let corpo: unknown = null;
  try {
    corpo = await res.json();
  } catch {
    /* sem corpo */
  }
  if (res.status === 401 && typeof window !== "undefined") {
    // Sessão expirada: volta ao ecrã de entrada e regressa a esta página depois.
    window.location.replace(`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`);
  }
  if (!res.ok) {
    const erro = (corpo as { erro?: string } | null)?.erro ?? `Erro ${res.status}`;
    throw new ErroApi(erro, res.status);
  }
  return corpo as T;
}

export interface FiltrosApi {
  de?: string;
  ate?: string;
  q?: string;
}

export async function apiListar(f: FiltrosApi = {}): Promise<NotaRegisto[]> {
  const p = new URLSearchParams();
  if (f.de) p.set("de", f.de);
  if (f.ate) p.set("ate", f.ate);
  if (f.q) p.set("q", f.q);
  const s = p.toString();
  const r = await pedir<{ notas: NotaRegisto[] }>(`/api/notas${s ? `?${s}` : ""}`);
  return r.notas;
}

export async function apiObter(id: string): Promise<NotaRegisto> {
  return (await pedir<{ nota: NotaRegisto }>(`/api/notas/${encodeURIComponent(id)}`)).nota;
}

export async function apiCriar(entrada: NotaEntrada): Promise<NotaRegisto> {
  return (await pedir<{ nota: NotaRegisto }>("/api/notas", { method: "POST", body: JSON.stringify(entrada) })).nota;
}

export async function apiProximoNumero(): Promise<number> {
  return (await pedir<{ numero: number }>("/api/notas/proximo")).numero;
}
