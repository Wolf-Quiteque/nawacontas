import "server-only";
import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from "node:crypto";

/** Parâmetros do scrypt (guardados junto do hash para permitir alterá-los no futuro). */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const TAMANHO_CHAVE = 64;

function derivar(senha: string, salt: Buffer, opcoes: ScryptOptions, tamanho = TAMANHO_CHAVE): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(senha.normalize("NFKC"), salt, tamanho, { ...opcoes, maxmem: 64 * 1024 * 1024 }, (erro, chave) =>
      erro ? reject(erro) : resolve(chave),
    ),
  );
}

/** Formato: scrypt$N$r$p$salt(base64)$chave(base64) */
export async function gerarHashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const chave = await derivar(senha, salt, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), chave.toString("base64")].join("$");
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, chaveB64] = partes;
  const esperado = Buffer.from(chaveB64, "base64");
  try {
    const chave = await derivar(
      senha,
      Buffer.from(saltB64, "base64"),
      { N: Number(n), r: Number(r), p: Number(p) },
      esperado.length,
    );
    return chave.length === esperado.length && timingSafeEqual(chave, esperado);
  } catch {
    return false;
  }
}
