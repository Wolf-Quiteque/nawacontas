import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import { normalizarItem, type NotaEntrada, type NotaRegisto, subtotalItem, totalDaNota } from "../nota";

/** Última nota emitida antes da app existir; a primeira nota registada recebe NUMERO_INICIAL + 1. */
export const NUMERO_INICIAL = Number.parseInt(process.env.NOTAS_NUMERO_INICIAL ?? "35", 10) || 35;

const COLUNAS = `
  s.id,
  s.numero,
  s.beneficiario,
  s.origem,
  s.periodo,
  s.itens,
  s.total::float8 AS "total",
  s.cidade,
  to_char(s.data, 'YYYY-MM-DD') AS "data",
  to_char(s.criada_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "criadaEm",
  to_char(s.atualizada_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "atualizadaEm",
  u.nome AS "criadoPorNome",
  u.telefone AS "criadoPorTelefone"
`;

const ORIGEM = `saidas s LEFT JOIN utilizadores u ON u.id = s.criado_por`;

export interface FiltrosNotas {
  /** Data inicial (AAAA-MM-DD), inclusive. */
  de?: string;
  /** Data final (AAAA-MM-DD), inclusive. */
  ate?: string;
  /** Pesquisa por beneficiário, origem, período, itens, autor ou número. */
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
  return {
    ...r,
    itens: Array.isArray(itens) ? itens.map(normalizarItem) : [],
    numero: Number(r.numero),
    total: Number(r.total) || 0,
    criadoPorNome: r.criadoPorNome ?? null,
    criadoPorTelefone: r.criadoPorTelefone ?? null,
  };
}

export async function listarNotas(f: FiltrosNotas = {}): Promise<NotaRegisto[]> {
  const db = await getDb();
  const q = f.q?.trim() || null;
  const limite = Math.min(Math.max(f.limite ?? 500, 1), 2000);
  const rows = await db.query<NotaRegisto>(
    `SELECT ${COLUNAS} FROM ${ORIGEM}
     WHERE ($1::date IS NULL OR s.data >= $1::date)
       AND ($2::date IS NULL OR s.data <= $2::date)
       AND ($3::text IS NULL
            OR s.beneficiario ILIKE '%' || $3 || '%'
            OR s.origem ILIKE '%' || $3 || '%'
            OR s.periodo ILIKE '%' || $3 || '%'
            OR s.itens::text ILIKE '%' || $3 || '%'
            OR u.nome ILIKE '%' || $3 || '%'
            OR s.numero::text = $3)
     ORDER BY s.numero DESC
     LIMIT ${limite}`,
    [f.de || null, f.ate || null, q],
  );
  return rows.map(normalizar);
}

export async function obterNota(id: string): Promise<NotaRegisto | null> {
  const db = await getDb();
  const rows = await db.query<NotaRegisto>(`SELECT ${COLUNAS} FROM ${ORIGEM} WHERE s.id = $1`, [id]);
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

/**
 * Cria uma nota atribuindo o próximo número sequencial (com repetição em caso de concorrência).
 * As notas registadas são imutáveis: não existem operações de atualização nem eliminação.
 */
export async function criarNota(entrada: NotaEntrada, criadoPor: string | null): Promise<NotaRegisto> {
  const db = await getDb();
  const id = randomUUID();
  const itens = entrada.itens.map((i) => ({ descricao: i.descricao, qtd: i.qtd, preco: i.preco, subtotal: subtotalItem(i) }));
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      await db.query(
        `INSERT INTO saidas
           (id, numero, beneficiario, origem, periodo, itens, total, cidade, data, criado_por)
         VALUES
           ($1, (SELECT COALESCE(MAX(numero), $2::int) + 1 FROM saidas),
            $3, $4, $5, $6::text::jsonb, $7::numeric, $8, $9::date, $10)`,
        [
          id,
          NUMERO_INICIAL,
          entrada.beneficiario,
          entrada.origem,
          entrada.periodo,
          JSON.stringify(itens),
          totalDaNota(entrada),
          entrada.cidade,
          entrada.data,
          criadoPor,
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
