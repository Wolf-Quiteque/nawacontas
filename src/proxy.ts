import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, opcoesCookieSessao, pedidoSeguro } from "@/lib/auth/constantes";

const PAGINAS_PUBLICAS = ["/entrar", "/registar"];

/**
 * Verificação otimista: sem cookie de sessão, as páginas redirecionam para /entrar.
 * A validação real da sessão é feita nas páginas e nas rotas de API (base de dados).
 * Com cookie, renova-se a sua validade para que a sessão não expire enquanto a app é usada.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(COOKIE_SESSAO)?.value;
  const publica = PAGINAS_PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!token && !publica) {
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("voltar", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  if (token) res.cookies.set(COOKIE_SESSAO, token, opcoesCookieSessao(pedidoSeguro(req)));
  return res;
}

export const config = {
  // Não se aplica à API (tem a sua própria verificação), ficheiros do Next.js, ícones, manifesto e service worker.
  matcher: ["/((?!api/|_next/|icons/|sw.js|manifest.webmanifest|icon.png|apple-icon.png|favicon.ico).*)"],
};
