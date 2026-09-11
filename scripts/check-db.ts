/**
 * Verifica a ligação à base de dados configurada em .env (POSTGRES_URL / DATABASE_URL).
 * Aplica o esquema tal como a app ao arrancar (tabelas em falta, reparações) e mostra contagens.
 * Executar: npm run check:db
 */
import fs from "node:fs";

// Carrega .env / .env.local (sem dependências extra).
for (const f of [".env", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const linha of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(linha);
    if (!m || linha.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

async function main() {
  const { getDb, urlDaBaseDeDados } = await import("../src/lib/db");
  const url = urlDaBaseDeDados();
  if (!url) {
    console.log("Sem POSTGRES_URL/DATABASE_URL: a app usaria o Postgres embebido (PGlite).");
    return;
  }
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "(url inválida)";
    }
  })();
  console.log("A ligar a", host, "…");
  const db = await getDb();
  const [{ versao }] = await db.query<{ versao: string }>("SELECT version() AS versao");
  console.log("Ligado:", versao.split(",")[0]);
  const [{ n, maximo }] = await db.query<{ n: number; maximo: number | null }>(
    "SELECT COUNT(*)::int AS n, MAX(numero) AS maximo FROM saidas",
  );
  console.log(`Notas registadas: ${n}; último número: ${maximo ?? "(nenhum)"}`);
  const [{ u }] = await db.query<{ u: number }>("SELECT COUNT(*)::int AS u FROM utilizadores");
  console.log(`Utilizadores: ${u}`);
}

main()
  .catch((e) => {
    console.error("Falha na ligação:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => process.exit());
