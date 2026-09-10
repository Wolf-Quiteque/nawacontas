import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Ligação à base de dados.
 *
 * - Em produção (Vercel) usa o Postgres da integração configurada, através de
 *   POSTGRES_URL / DATABASE_URL (Neon, Supabase, Vercel Postgres, ...).
 * - Sem variável de ambiente usa um Postgres embebido (PGlite) guardado em `.data/`,
 *   suficiente para desenvolvimento local.
 */

export type Row = object;

export interface Db {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS notas (
  id TEXT PRIMARY KEY,
  numero INTEGER NOT NULL UNIQUE,
  nome TEXT NOT NULL DEFAULT '',
  motivo TEXT NOT NULL DEFAULT '',
  periodo TEXT NOT NULL DEFAULT '',
  remuneracao NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxa_remuneracao TEXT NOT NULL DEFAULT '',
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxa_desconto TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL DEFAULT 'Luanda',
  data DATE NOT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notas_data_idx ON notas (data);
CREATE INDEX IF NOT EXISTS notas_nome_idx ON notas (lower(nome));
`;

export function urlDaBaseDeDados(): string | undefined {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    undefined
  );
}

async function ligarPostgres(url: string): Promise<Db> {
  const postgres = (await import("postgres")).default;
  const local = /localhost|127\.0\.0\.1/.test(url);
  const sql = postgres(url, {
    ssl: local ? undefined : "require",
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false, // compatível com poolers (pgbouncer / Supabase)
  });
  return {
    async query<T extends Row>(text: string, params: unknown[] = []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await sql.unsafe(text, params as any[]);
      return rows as unknown as T[];
    },
    async exec(text: string) {
      await sql.unsafe(text);
    },
  };
}

async function ligarPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "nawanotas");
  await mkdir(dir, { recursive: true });
  const pg = new PGlite(dir);
  await pg.waitReady;
  return {
    async query<T extends Row>(text: string, params: unknown[] = []) {
      const r = await pg.query<T>(text, params);
      return r.rows;
    },
    async exec(text: string) {
      await pg.exec(text);
    },
  };
}

let dbPromise: Promise<Db> | null = null;

/** Devolve a ligação (partilhada) à base de dados, criando o esquema na primeira utilização. */
export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const url = urlDaBaseDeDados();
      const db = url ? await ligarPostgres(url) : await ligarPglite();
      await db.exec(SCHEMA);
      return db;
    })().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}
