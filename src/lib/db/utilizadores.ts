import "server-only";
import { randomUUID } from "node:crypto";
import type { Utilizador } from "../auth/constantes";
import { gerarHashSenha, verificarSenha } from "../auth/senha";
import { getDb } from "./index";

/** Após este número de palavras-passe erradas seguidas, a conta fica bloqueada durante uns minutos. */
const MAX_FALHAS = 5;
const BLOQUEIO_MINUTOS = 10;

export type ResultadoConta = { ok: true; utilizador: Utilizador } | { ok: false; erro: string; status: number };

function ehDuplicado(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === "23505" || /duplicate key|unique/i.test(err?.message ?? "");
}

export async function registarUtilizador(dados: { nome: string; telefone: string; senha: string }): Promise<ResultadoConta> {
  const db = await getDb();
  const id = randomUUID();
  const senhaHash = await gerarHashSenha(dados.senha);
  try {
    await db.query(`INSERT INTO utilizadores (id, telefone, nome, senha_hash) VALUES ($1, $2, $3, $4)`, [
      id,
      dados.telefone,
      dados.nome,
      senhaHash,
    ]);
  } catch (e) {
    if (ehDuplicado(e)) return { ok: false, erro: "Já existe uma conta com este número de telefone.", status: 409 };
    throw e;
  }
  return { ok: true, utilizador: { id, nome: dados.nome, telefone: dados.telefone } };
}

let hashFicticio: Promise<string> | null = null;

export async function autenticar(telefone: string, senha: string): Promise<ResultadoConta> {
  const db = await getDb();
  const rows = await db.query<Utilizador & { senha_hash: string; bloqueado: boolean; minutos: number | null }>(
    `SELECT id, nome, telefone, senha_hash,
            (bloqueado_ate IS NOT NULL AND bloqueado_ate > now()) AS bloqueado,
            CEIL(EXTRACT(EPOCH FROM (bloqueado_ate - now())) / 60)::int AS minutos
       FROM utilizadores
      WHERE telefone = $1`,
    [telefone],
  );
  const u = rows[0];
  const incorretos: ResultadoConta = { ok: false, erro: "Número de telefone ou palavra-passe incorretos.", status: 401 };

  if (!u) {
    // Mesmo custo de tempo que uma conta existente, para não revelar que números estão registados.
    hashFicticio ??= gerarHashSenha("nawanotas");
    await verificarSenha(senha, await hashFicticio);
    return incorretos;
  }

  if (u.bloqueado) {
    const m = Math.max(1, Number(u.minutos) || 1);
    return {
      ok: false,
      erro: `Demasiadas tentativas falhadas. Tente novamente dentro de ${m} ${m === 1 ? "minuto" : "minutos"}.`,
      status: 429,
    };
  }

  if (!(await verificarSenha(senha, u.senha_hash))) {
    await db.query(
      `UPDATE utilizadores SET
         bloqueado_ate = CASE WHEN falhas + 1 >= $2::int THEN now() + make_interval(mins => $3::int) ELSE bloqueado_ate END,
         falhas = CASE WHEN falhas + 1 >= $2::int THEN 0 ELSE falhas + 1 END
       WHERE id = $1`,
      [u.id, MAX_FALHAS, BLOQUEIO_MINUTOS],
    );
    return incorretos;
  }

  await db.query(`UPDATE utilizadores SET falhas = 0, bloqueado_ate = NULL WHERE id = $1`, [u.id]);
  return { ok: true, utilizador: { id: u.id, nome: u.nome, telefone: u.telefone } };
}
