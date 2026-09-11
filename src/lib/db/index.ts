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
CREATE TABLE IF NOT EXISTS utilizadores (
  id TEXT PRIMARY KEY,
  telefone TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  falhas INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessoes (
  token_hash TEXT PRIMARY KEY,
  utilizador_id TEXT NOT NULL REFERENCES utilizadores(id) ON DELETE CASCADE,
  expira_em TIMESTAMPTZ NOT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessoes_utilizador_idx ON sessoes (utilizador_id);
CREATE INDEX IF NOT EXISTS sessoes_expira_idx ON sessoes (expira_em);
CREATE TABLE IF NOT EXISTS saidas (
  id TEXT PRIMARY KEY,
  numero INTEGER NOT NULL UNIQUE,
  beneficiario TEXT NOT NULL DEFAULT '',
  origem TEXT NOT NULL DEFAULT '',
  periodo TEXT NOT NULL DEFAULT '',
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  cidade TEXT NOT NULL DEFAULT 'Luanda',
  data DATE NOT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saidas_data_idx ON saidas (data);
CREATE INDEX IF NOT EXISTS saidas_beneficiario_idx ON saidas (lower(beneficiario));
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'saidas' AND column_name = 'criado_por'
  ) THEN
    ALTER TABLE saidas ADD COLUMN criado_por TEXT REFERENCES utilizadores(id);
    CREATE INDEX saidas_criado_por_idx ON saidas (criado_por);
  END IF;
END $$;
`;

/**
 * Repara listas de itens gravadas como texto JSON (o driver postgres codificava o JSON duas vezes
 * quando o parâmetro era `$n::jsonb`). O conteúdo das notas não muda, apenas o formato.
 */
export const REPARAR_ITENS_SQL = `UPDATE saidas SET itens = (itens #>> '{}')::jsonb WHERE jsonb_typeof(itens) = 'string';`;

/** Migra notas da versão anterior (tabela "notas") para "saidas", mantendo os números. */
const MIGRACAO_LEGADO = `
DO $$
BEGIN
  IF to_regclass('public.notas') IS NOT NULL THEN
    INSERT INTO saidas (id, numero, beneficiario, origem, periodo, itens, total, cidade, data, criada_em, atualizada_em)
    SELECT n.id, n.numero, n.nome, n.motivo, n.periodo,
           jsonb_build_array(
             jsonb_build_object('descricao', 'Remuneração de referência', 'qtd', '', 'valor', n.remuneracao),
             jsonb_build_object('descricao', 'Desconto para a Segurança Social', 'qtd', n.taxa_desconto, 'valor', -n.desconto)
           ),
           n.remuneracao - n.desconto, n.cidade, n.data, n.criada_em, n.atualizada_em
    FROM notas n
    WHERE NOT EXISTS (SELECT 1 FROM saidas s WHERE s.id = n.id OR s.numero = n.numero);
    ALTER TABLE notas RENAME TO notas_legado;
  END IF;
END $$;
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
    prepare: false, // compatível com poolers (pgbouncer / Supabase / Neon pooler)
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

// Guardado em globalThis para ser partilhado por todos os módulos do processo
// (o Next.js pode carregar páginas e rotas de API como instâncias separadas do módulo).
const global = globalThis as unknown as { __nawanotasDb?: Promise<Db> | null };

/** Devolve a ligação (partilhada) à base de dados, criando o esquema na primeira utilização. */
export function getDb(): Promise<Db> {
  if (!global.__nawanotasDb) {
    global.__nawanotasDb = (async () => {
      const url = urlDaBaseDeDados();
      const db = url ? await ligarPostgres(url) : await ligarPglite();
      await db.exec(SCHEMA);
      await db.exec(MIGRACAO_LEGADO);
      await db.exec(REPARAR_ITENS_SQL);
      return db;
    })().catch((e) => {
      global.__nawanotasDb = null;
      throw e;
    });
  }
  return global.__nawanotasDb;
}
