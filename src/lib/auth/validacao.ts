import { normalizarTelefone } from "../telefone";

export const SENHA_MIN = 6;
const SENHA_MAX = 128;

const ERRO_TELEFONE = "Número de telefone inválido. Use os 9 dígitos do telemóvel (ex.: 932 876 178).";

type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

function campo(body: unknown, nome: string): unknown {
  return body && typeof body === "object" ? (body as Record<string, unknown>)[nome] : undefined;
}

/** Nome de uma pessoa: espaços normalizados, 2 a 80 caracteres. */
export function validarNome(valor: unknown): Resultado<string> {
  const nome = String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (nome.length < 2) return { ok: false, erro: "Indique o nome (pelo menos 2 caracteres)." };
  if (nome.length > 80) return { ok: false, erro: "O nome é demasiado longo." };
  return { ok: true, valor: nome };
}

export function validarRegisto(body: unknown): Resultado<{ nome: string; telefone: string; senha: string }> {
  const nome = validarNome(campo(body, "nome"));
  if (!nome.ok) return nome;

  const telefone = normalizarTelefone(String(campo(body, "telefone") ?? ""));
  if (!telefone) return { ok: false, erro: ERRO_TELEFONE };

  const senha = campo(body, "senha");
  if (typeof senha !== "string" || senha.length < SENHA_MIN)
    return { ok: false, erro: `A palavra-passe deve ter pelo menos ${SENHA_MIN} caracteres.` };
  if (senha.length > SENHA_MAX) return { ok: false, erro: "A palavra-passe é demasiado longa." };

  return { ok: true, valor: { nome: nome.valor, telefone, senha } };
}

export function validarLogin(body: unknown): Resultado<{ telefone: string; senha: string }> {
  const telefone = normalizarTelefone(String(campo(body, "telefone") ?? ""));
  if (!telefone) return { ok: false, erro: ERRO_TELEFONE };
  const senha = campo(body, "senha");
  if (typeof senha !== "string" || !senha) return { ok: false, erro: "Indique a palavra-passe." };
  if (senha.length > SENHA_MAX) return { ok: false, erro: "Número de telefone ou palavra-passe incorretos." };
  return { ok: true, valor: { telefone, senha } };
}
