import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import { type ItemSaida, type NotaEntrada, type NotaRegisto, totalDaNota } from "../nota";

/** Última nota emitida antes da app existir; a primeira nota registada recebe NUMERO_INICIAL + 1. */
export const NUMERO_INICIAL = Number.parseInt(process.env.NOTAS_NUMERO_INICIAL ?? "35", 10) || 35;

const COLUNAS = `
  id,
  numero,
  beneficiario,
  origem,
  periodo,
  itens,
  total::float8 AS "total",
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
  /** Pesquisa por beneficiário, origem, período, itens ou número. */
  q?: string;
  limite?: number;
}

function normalizar(r: NotaRegisto): NotaRegisto {
  let itens: unknown = r.itens;
  if (typeof itens === "string") {
    try {
      itens = JSON.parse(itens);
    } catch {
      itens = [];
    }
  }
  const lista: ItemSaida[] = Array.isArray(itens)
    ? itens.map((i) => ({
        descricao: String((i as ItemSaida).descricao ?? ""),
        qtd: String((i as ItemSaida).qtd ?? ""),
        valor: Number((i as ItemSaida).valor) || 0,
      }))
    : [];
  return { ...r, itens: lista, numero: Number(r.numero), total: Number(r.total) || 0 };
}

export async function listarNotas(f: FiltrosNotas = {}): Promise<NotaRegisto[]> {
  const db = await getDb();
  const q = f.q?.trim() || null;
  const limite = Math.min(Math.max(f.limite ?? 500, 1), 2000);
  const rows = await db.query<NotaRegisto>(
    `SELECT ${COLUNAS} FROM saidas
     WHERE ($1::date IS NULL OR data >= $1::date)
       AND ($2::date IS NULL OR data <= $2::date)
       AND ($3::text IS NULL
            OR beneficiario ILIKE '%' || $3 || '%'
            OR origem ILIKE '%' || $3 || '%'
            OR periodo ILIKE '%' || $3 || '%'
            OR itens::text ILIKE '%' || $3 || '%'
            OR numero::text = $3)
     ORDER BY numero DESC
     LIMIT ${limite}`,
    [f.de || null, f.ate || null, q],
  );
  return rows.map(normalizar);
}

export async function obterNota(id: string): Promise<NotaRegisto | null> {
  const db = await getDb();
  const rows = await db.query<NotaRegisto>(`SELECT ${COLUNAS} FROM saidas WHERE id = $1`, [id]);
  return rows[0] ? normalizar(rows[0]) : null;
}

export async function proximoNumero(): Promise<number> {
  const db = await getDb();
  const rows = await db.query<{ proximo: number }>(
    `SELECT (COALESCE(MAX(numero), $1::int) + 1)::int AS proximo FROM saidas`,
    [NUMERO_INICIAL],
  );
  return Number(rows[0]?.proximo ?? NUMERO_INICIAL + 1);
}

function ehConflitoDeNumero(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === "23505" || /duplicate key|unique/i.test(err?.message ?? "");
}

function parametros(entrada: NotaEntrada): unknown[] {
  return [
    entrada.beneficiario,
    entrada.origem,
    entrada.periodo,
    JSON.stringify(entrada.itens),
    totalDaNota(entrada),
    entrada.cidade,
    entrada.data,
  ];
}

/** Cria uma nota atribuindo o próximo número sequencial (com repetição em caso de concorrência). */
export async function criarNota(entrada: NotaEntrada): Promise<NotaRegisto> {
  const db = await getDb();
  const id = randomUUID();
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      await db.query(
        `INSERT INTO saidas
           (id, numero, beneficiario, origem, periodo, itens, total, cidade, data)
         VALUES
           ($1, (SELECT COALESCE(MAX(numero), $2::int) + 1 FROM saidas),
            $3, $4, $5, $6::jsonb, $7::numeric, $8, $9::date)`,
        [id, NUMERO_INICIAL, ...parametros(entrada)],
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

// Nota: as notas registadas são imutáveis — não existem operações de atualização nem eliminação.
