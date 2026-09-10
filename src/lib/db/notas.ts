import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import type { NotaEntrada, NotaRegisto } from "../nota";

/** Última nota emitida antes da app existir; a primeira nota registada recebe NUMERO_INICIAL + 1. */
export const NUMERO_INICIAL = Number.parseInt(process.env.NOTAS_NUMERO_INICIAL ?? "35", 10) || 35;

const COLUNAS = `
  id,
  numero,
  nome,
  motivo,
  periodo,
  remuneracao::float8 AS "remuneracao",
  taxa_remuneracao AS "taxaRemuneracao",
  desconto::float8 AS "desconto",
  taxa_desconto AS "taxaDesconto",
  cidade,
  to_char(data, 'YYYY-MM-DD') AS "data",
  to_char(criada_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "criadaEm",
  to_char(atualizada_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "atualizadaEm"
`;

export interface FiltrosNotas {
  /** Data inicial (AAAA-MM-DD), inclusive. */
  de?: string;
  /** Data final (AAAA-MM-DD), inclusive. */
  ate?: string;
  /** Pesquisa por nome, motivo ou número. */
  q?: string;
  limite?: number;
}

export async function listarNotas(f: FiltrosNotas = {}): Promise<NotaRegisto[]> {
  const db = await getDb();
  const q = f.q?.trim() || null;
  const limite = Math.min(Math.max(f.limite ?? 500, 1), 2000);
  return db.query<NotaRegisto>(
    `SELECT ${COLUNAS} FROM notas
     WHERE ($1::date IS NULL OR data >= $1::date)
       AND ($2::date IS NULL OR data <= $2::date)
       AND ($3::text IS NULL
            OR nome ILIKE '%' || $3 || '%'
            OR motivo ILIKE '%' || $3 || '%'
            OR periodo ILIKE '%' || $3 || '%'
            OR numero::text = $3)
     ORDER BY numero DESC
     LIMIT ${limite}`,
    [f.de || null, f.ate || null, q],
  );
}

export async function obterNota(id: string): Promise<NotaRegisto | null> {
  const db = await getDb();
  const rows = await db.query<NotaRegisto>(`SELECT ${COLUNAS} FROM notas WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function proximoNumero(): Promise<number> {
  const db = await getDb();
  const rows = await db.query<{ proximo: number }>(
    `SELECT (COALESCE(MAX(numero), $1::int) + 1)::int AS proximo FROM notas`,
    [NUMERO_INICIAL],
  );
  return Number(rows[0]?.proximo ?? NUMERO_INICIAL + 1);
}

function ehConflitoDeNumero(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === "23505" || /duplicate key|unique/i.test(err?.message ?? "");
}

/** Cria uma nota atribuindo o próximo número sequencial (com repetição em caso de concorrência). */
export async function criarNota(entrada: NotaEntrada): Promise<NotaRegisto> {
  const db = await getDb();
  const id = randomUUID();
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      await db.query(
        `INSERT INTO notas
           (id, numero, nome, motivo, periodo, remuneracao, taxa_remuneracao, desconto, taxa_desconto, cidade, data)
         VALUES
           ($1, (SELECT COALESCE(MAX(numero), $2::int) + 1 FROM notas),
            $3, $4, $5, $6::numeric, $7, $8::numeric, $9, $10, $11::date)`,
        [
          id,
          NUMERO_INICIAL,
          entrada.nome,
          entrada.motivo,
          entrada.periodo,
          entrada.remuneracao,
          entrada.taxaRemuneracao,
          entrada.desconto,
          entrada.taxaDesconto,
          entrada.cidade,
          entrada.data,
        ],
      );
      const nota = await obterNota(id);
      if (!nota) throw new Error("Nota criada mas não encontrada.");
      return nota;
    } catch (e) {
      if (!ehConflitoDeNumero(e) || tentativa === 4) throw e;
    }
  }
  throw new Error("Não foi possível atribuir um número à nota.");
}

export async function atualizarNota(id: string, entrada: NotaEntrada): Promise<NotaRegisto | null> {
  const db = await getDb();
  await db.query(
    `UPDATE notas SET
       nome = $2, motivo = $3, periodo = $4, remuneracao = $5::numeric, taxa_remuneracao = $6,
       desconto = $7::numeric, taxa_desconto = $8, cidade = $9, data = $10::date, atualizada_em = now()
     WHERE id = $1`,
    [
      id,
      entrada.nome,
      entrada.motivo,
      entrada.periodo,
      entrada.remuneracao,
      entrada.taxaRemuneracao,
      entrada.desconto,
      entrada.taxaDesconto,
      entrada.cidade,
      entrada.data,
    ],
  );
  return obterNota(id);
}

export async function eliminarNota(id: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.query<{ id: string }>(`DELETE FROM notas WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}
