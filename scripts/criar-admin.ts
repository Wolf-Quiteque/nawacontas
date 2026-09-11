/**
 * Cria (ou promove) uma conta de administrador aprovada.
 * Usa a base de dados do .env; sem POSTGRES_URL/DATABASE_URL usa o Postgres embebido (PGlite).
 * A palavra-passe é passada numa variável de ambiente para não ficar guardada em ficheiros:
 *
 *   ADMIN_TELEFONE=9XXXXXXXX ADMIN_NOME="Nome" ADMIN_SENHA="..." npm run criar-admin
 *
 * Se o número já tiver conta, esta é aprovada, promovida e fica com a palavra-passe indicada (o nome mantém-se).
 */
import fs from "node:fs";

// Carrega .env / .env.local sem sobrepor variáveis já definidas (sem dependências extra).
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
  const { normalizarTelefone, formatarTelefone } = await import("../src/lib/telefone");
  const { SENHA_MIN, validarNome } = await import("../src/lib/auth/validacao");
  const { urlDaBaseDeDados } = await import("../src/lib/db");
  const { autenticar, garantirAdministrador } = await import("../src/lib/db/utilizadores");

  const telefone = normalizarTelefone(process.env.ADMIN_TELEFONE ?? "");
  if (!telefone) throw new Error("ADMIN_TELEFONE inválido: use os 9 dígitos do telemóvel (começa por 9).");
  const senha = process.env.ADMIN_SENHA ?? "";
  if (senha.length < SENHA_MIN) throw new Error(`ADMIN_SENHA deve ter pelo menos ${SENHA_MIN} caracteres.`);
  const nome = validarNome(process.env.ADMIN_NOME || "Administrador");
  if (!nome.ok) throw new Error(nome.erro);

  const url = urlDaBaseDeDados();
  const destino = url ? `Postgres em ${new URL(url).host}` : "Postgres embebido (PGlite)";
  const r = await garantirAdministrador({ telefone, nome: nome.valor, senha });
  console.log(
    `${r.criado ? "Conta criada" : "Conta existente atualizada"} (${destino}): ${r.utilizador.nome}, ${formatarTelefone(telefone)} — administrador aprovado.`,
  );

  const teste = await autenticar(telefone, senha);
  if (teste.ok && teste.utilizador.admin) console.log("Verificação: a entrada com este número e palavra-passe funciona.");
  else {
    console.log(`Verificação falhou: ${teste.ok ? "a conta não ficou administradora" : teste.erro}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("Erro:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
