import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "../db";
import { DURACAO_SESSAO_DIAS, type Utilizador } from "./constantes";

/** Na base de dados guarda-se apenas o hash do token; o token só existe no cookie. */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function criarSessao(utilizadorId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.query(
    `INSERT INTO sessoes (token_hash, utilizador_id, expira_em)
     VALUES ($1, $2, now() + make_interval(days => $3::int))`,
    [hashToken(token), utilizadorId, DURACAO_SESSAO_DIAS],
  );
  // Limpeza oportunista de sessões expiradas.
  await db.query(`DELETE FROM sessoes WHERE expira_em < now()`);
  return token;
}

/** Devolve o utilizador de uma sessão válida, prolongando-a quando passou metade da validade. */
export async function utilizadorDoToken(token: string): Promise<Utilizador | null> {
  if (!token || token.length > 200) return null;
  const db = await getDb();
  const h = hashToken(token);
  const rows = await db.query<Utilizador & { renovar: boolean }>(
    `SELECT u.id, u.nome, u.telefone,
            (s.expira_em < now() + make_interval(days => $2::int)) AS renovar
       FROM sessoes s
       JOIN utilizadores u ON u.id = s.utilizador_id
      WHERE s.token_hash = $1 AND s.expira_em > now()`,
    [h, Math.floor(DURACAO_SESSAO_DIAS / 2)],
  );
  const r = rows[0];
  if (!r) return null;
  if (r.renovar) {
    await db.query(`UPDATE sessoes SET expira_em = now() + make_interval(days => $2::int) WHERE token_hash = $1`, [
      h,
      DURACAO_SESSAO_DIAS,
    ]);
  }
  return { id: r.id, nome: r.nome, telefone: r.telefone };
}

export async function terminarSessao(token: string): Promise<void> {
  const db = await getDb();
  await db.query(`DELETE FROM sessoes WHERE token_hash = $1`, [hashToken(token)]);
}
