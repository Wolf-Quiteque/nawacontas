/** Constantes e utilitários de sessão partilhados pelo proxy, rotas de API e páginas. */

export const COOKIE_SESSAO = "nawanotas_sessao";

/** Validade da sessão; é renovada automaticamente enquanto a app for usada. */
export const DURACAO_SESSAO_DIAS = 30;

export interface Utilizador {
  id: string;
  nome: string;
  telefone: string;
  /** Administradores aprovam contas, gerem utilizadores e podem eliminar notas. */
  admin: boolean;
}

/** Contas novas ficam pendentes até um administrador as aprovar; só as aprovadas entram. */
export type EstadoConta = "pendente" | "aprovado" | "removido";

export interface UtilizadorGestao extends Utilizador {
  estado: EstadoConta;
  criadoEm: string;
  /** Número de notas registadas (sem contar as eliminadas). */
  notas: number;
}

export const ACOES_GESTAO = ["aprovar", "remover", "tornarAdmin", "retirarAdmin", "renomear"] as const;
export type AcaoGestao = (typeof ACOES_GESTAO)[number];

export function opcoesCookieSessao(seguro: boolean) {
  return {
    httpOnly: true,
    secure: seguro,
    sameSite: "lax" as const,
    path: "/",
    maxAge: DURACAO_SESSAO_DIAS * 24 * 60 * 60,
  };
}

/** O pedido chegou por HTTPS (diretamente ou através do proxy do Vercel)? */
export function pedidoSeguro(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return new URL(req.url).protocol === "https:";
}

/** Caminho interno para onde voltar depois de entrar (evita redirecionamentos para outros sites). */
export function destinoSeguro(voltar?: string | null): string {
  if (!voltar || voltar.length > 512 || !voltar.startsWith("/")) return "/";
  // Os navegadores ignoram tabulações/quebras de linha e tratam "\" como "/" nos URLs
  // (ex.: "/\t/site.com" passaria a "//site.com"), por isso esses caracteres não são aceites.
  const inseguro = [...voltar].some((c) => {
    const cp = c.codePointAt(0) ?? 0;
    // espaço e caracteres de controlo (<= 0x20), DEL (0x7f), barra invertida (0x5c) e outros espaços
    return cp <= 0x20 || cp === 0x7f || cp === 0x5c || c.trim() === "";
  });
  if (inseguro) return "/";
  const base = "http://nawanotas.local";
  let url: URL;
  try {
    url = new URL(voltar, base);
  } catch {
    return "/";
  }
  if (url.origin !== base) return "/";
  if (url.pathname.startsWith("/entrar") || url.pathname.startsWith("/registar")) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
