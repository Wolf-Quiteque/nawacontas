/**
 * Testes da camada de dados e das contas, com o Postgres embebido (PGlite) numa pasta temporária.
 * Executar: npm run test:db
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NotaEntrada } from "../src/lib/nota";

process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nawanotas-test-"));
delete process.env.POSTGRES_URL;
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_PRISMA_URL;
delete process.env.POSTGRES_URL_NON_POOLING;

const base = (extra: Partial<NotaEntrada>): NotaEntrada => ({
  beneficiario: "Isaac",
  origem: "Numerário",
  periodo: "Setembro de 2026",
  itens: [
    { descricao: "Cabo", qtd: 2, preco: 3000 },
    { descricao: "Portagem", qtd: 1, preco: 9000 },
  ],
  cidade: "Luanda",
  data: "2026-09-10",
  ...extra,
});

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
  console.log("✓", msg);
};

async function main() {
  const { criarNota, listarNotas, obterNota, proximoNumero, NUMERO_INICIAL } = await import("../src/lib/db/notas");
  const { getDb, REPARAR_ITENS_SQL } = await import("../src/lib/db");
  const { registarUtilizador, autenticar } = await import("../src/lib/db/utilizadores");
  const { criarSessao, utilizadorDoToken, terminarSessao } = await import("../src/lib/auth/sessoes-db");
  const { validarRegisto, validarLogin } = await import("../src/lib/auth/validacao");
  const { destinoSeguro } = await import("../src/lib/auth/constantes");
  const { validarEntrada } = await import("../src/lib/validacao");
  const { normalizarTelefone, formatarTelefone } = await import("../src/lib/telefone");
  const { normalizarItem, subtotalItem, totalDaNota, textosDaNota } = await import("../src/lib/nota");
  const db = await getDb();

  console.log("\n— Telefone");
  assert(normalizarTelefone("932876178") === "932876178", "aceita 9 dígitos começados por 9");
  assert(normalizarTelefone("+244 932 876 178") === "932876178", "remove o indicativo +244");
  assert(normalizarTelefone("00244932876178") === "932876178", "remove o indicativo 00244");
  assert(normalizarTelefone("832876178") === null, "rejeita números que não começam por 9");
  assert(normalizarTelefone("93287617") === null, "rejeita números com 8 dígitos");
  assert(formatarTelefone("932876178") === "932 876 178", "formata 932 876 178");

  console.log("\n— Validação de contas");
  assert(!validarRegisto({ nome: "M", telefone: "932876178", senha: "123456" }).ok, "nome demasiado curto");
  assert(!validarRegisto({ nome: "Márcio", telefone: "932876178", senha: "12345" }).ok, "palavra-passe com menos de 6 caracteres");
  assert(validarRegisto({ nome: "  Márcio   Quiteque ", telefone: "932 876 178", senha: "123456" }).ok, "registo válido");
  assert(!validarLogin({ telefone: "12", senha: "x" }).ok, "login com telefone inválido");

  console.log("\n— Destino depois de entrar (?voltar=)");
  assert(destinoSeguro("/historico?q=cabo") === "/historico?q=cabo", "aceita caminhos internos");
  for (const externo of ["https://exemplo.com", "//exemplo.com", "/\\exemplo.com", "/\t/exemplo.com", "/\n/exemplo.com", "exemplo.com"])
    assert(destinoSeguro(externo) === "/", `rejeita destino externo ${JSON.stringify(externo)}`);
  assert(destinoSeguro("/entrar") === "/" && destinoSeguro(undefined) === "/", "ignora /entrar e destino vazio");

  console.log("\n— Contas e bloqueio");
  const conta = await registarUtilizador({ nome: "Márcio", telefone: "932876178", senha: "segredo1" });
  if (!conta.ok) throw new Error("FALHOU: registar utilizador");
  assert(conta.utilizador.id, "registar utilizador");
  const hash = (await db.query<{ senha_hash: string }>("SELECT senha_hash FROM utilizadores"))[0].senha_hash;
  assert(hash.startsWith("scrypt$") && !hash.includes("segredo1"), "palavra-passe guardada como hash scrypt");
  const dup = await registarUtilizador({ nome: "Outro", telefone: "932876178", senha: "xxxxxx" });
  assert(!dup.ok && dup.status === 409, "número já registado é rejeitado");
  assert((await autenticar("932876178", "segredo1")).ok, "entrar com a palavra-passe certa");
  const errada = await autenticar("932876178", "errada");
  assert(!errada.ok && errada.status === 401, "palavra-passe errada é rejeitada");
  const inexistente = await autenticar("923000000", "segredo1");
  assert(!inexistente.ok && inexistente.status === 401, "número sem conta é rejeitado com a mesma mensagem");
  for (let k = 0; k < 4; k++) await autenticar("932876178", "errada");
  const bloqueada = await autenticar("932876178", "segredo1");
  assert(!bloqueada.ok && bloqueada.status === 429, "conta bloqueada após 5 tentativas falhadas");
  await db.query("UPDATE utilizadores SET bloqueado_ate = now() - interval '1 second'");
  assert((await autenticar("932876178", "segredo1")).ok, "entra de novo quando o bloqueio termina");

  console.log("\n— Sessões");
  const token = await criarSessao(conta.utilizador.id);
  const [{ dias }] = await db.query<{ dias: number }>(
    "SELECT (EXTRACT(EPOCH FROM (MAX(expira_em) - now())) / 86400)::float8 AS dias FROM sessoes",
  );
  assert(dias >= 29.9, `sessão válida durante ${Math.round(dias)} dias (≥ 7)`);
  assert((await db.query("SELECT 1 FROM sessoes WHERE token_hash = $1", [token])).length === 0, "token não é guardado em claro");
  assert((await utilizadorDoToken(token))?.telefone === "932876178", "sessão válida devolve o utilizador");
  assert((await utilizadorDoToken("token-invalido")) === null, "token inválido é rejeitado");
  await db.query("UPDATE sessoes SET expira_em = now() + interval '2 days'");
  await utilizadorDoToken(token);
  const [{ dias: renovada }] = await db.query<{ dias: number }>(
    "SELECT (EXTRACT(EPOCH FROM (MAX(expira_em) - now())) / 86400)::float8 AS dias FROM sessoes",
  );
  assert(renovada >= 29.9, "sessão em uso é renovada automaticamente");
  await db.query("UPDATE sessoes SET expira_em = now() - interval '1 minute'");
  assert((await utilizadorDoToken(token)) === null, "sessão expirada é rejeitada");
  const token2 = await criarSessao(conta.utilizador.id);
  await terminarSessao(token2);
  assert((await utilizadorDoToken(token2)) === null, "terminar sessão invalida o token");

  console.log("\n— Itens: quantidade × preço");
  assert(subtotalItem({ qtd: 2, preco: 3000 }) === 6000, "Cabo: 2 × 3.000 = 6.000");
  assert(subtotalItem({ qtd: 2.5, preco: 1000 }) === 2500, "quantidades decimais (2,5 × 1.000)");
  const v = validarEntrada({ ...base({}), itens: [{ descricao: "Cabo", qtd: "2", preco: "3000" }] });
  assert(v.ok && totalDaNota(v.valor) === 6000, "API aceita qtd e preço e multiplica");
  const semQtd = validarEntrada({ ...base({}), itens: [{ descricao: "Cabo", qtd: "", preco: 3000 }] });
  assert(semQtd.ok && semQtd.valor.itens[0].qtd === 1, "quantidade vazia conta como 1");
  assert(!validarEntrada({ ...base({}), itens: [{ descricao: "Cabo", qtd: 0, preco: 3000 }] }).ok, "quantidade zero é rejeitada");
  const legado = normalizarItem({ descricao: "Portagem", qtd: "3", valor: 9000 });
  assert(legado.qtd === 3 && legado.preco === 3000 && subtotalItem(legado) === 9000, "notas antigas mantêm o total (valor era o total da linha)");
  const t = textosDaNota({ ...base({}), numero: "36" });
  assert(t.itens[0].qtd === "2" && t.itens[0].preco === "3.000,00" && t.itens[0].subtotal === "6.000,00", "documento mostra qtd, preço unitário e total da linha");
  assert(t.total === "15.000,00", "documento: total 15.000,00");

  console.log("\n— Notas");
  assert((await proximoNumero()) === NUMERO_INICIAL + 1, `próximo número inicial é ${NUMERO_INICIAL + 1}`);
  const a = await criarNota(base({}), conta.utilizador.id);
  assert(a.numero === NUMERO_INICIAL + 1, `primeira nota recebe o número ${NUMERO_INICIAL + 1}`);
  assert(a.total === 15000, "total guardado = 2 × 3.000 + 1 × 9.000");
  assert(a.itens[0].qtd === 2 && a.itens[0].preco === 3000, "itens guardados com quantidade e preço");
  assert(a.criadoPorNome === "Márcio" && a.criadoPorTelefone === "932876178", "nota regista quem a criou");
  const [{ tipo }] = await db.query<{ tipo: string }>("SELECT jsonb_typeof(itens) AS tipo FROM saidas WHERE id = $1", [a.id]);
  assert(tipo === "array", "itens gravados como array JSON (não como texto)");

  const b = await criarNota(base({ beneficiario: "Maria", origem: "Cartão", data: "2026-08-20", itens: [{ descricao: "Adiantamento", qtd: 1, preco: 15000 }] }), null);
  assert(b.numero === a.numero + 1 && b.criadoPorNome === null, "número sequencial; nota sem autor fica em branco");

  const [c1, c2] = await Promise.all([
    criarNota(base({ beneficiario: "P1", data: "2026-09-11" }), conta.utilizador.id),
    criarNota(base({ beneficiario: "P2", data: "2026-09-11" }), conta.utilizador.id),
  ]);
  assert(c1.numero !== c2.numero, "criações concorrentes recebem números diferentes");

  const todas = await listarNotas();
  assert(todas.length === 4 && todas[0].numero > todas[3].numero, "lista ordenada por número decrescente");
  assert((await listarNotas({ de: "2026-08-01", ate: "2026-08-31" })).length === 1, "filtro por intervalo de datas");
  assert((await listarNotas({ q: "isaac" })).length === 1, "pesquisa por beneficiário (sem distinção de maiúsculas)");
  assert((await listarNotas({ q: String(b.numero) })).length === 1, "pesquisa por número");
  assert((await listarNotas({ q: "Cartão" })).length === 1, "pesquisa por origem");
  assert((await listarNotas({ q: "portagem" })).length === 3, "pesquisa por descrição de item");
  assert((await listarNotas({ q: "Márcio" })).length === 3, "pesquisa por autor");
  assert((await obterNota(a.id))?.beneficiario === "Isaac", "obter por id");
  assert((await obterNota("inexistente")) === null, "obter inexistente devolve null");

  console.log("\n— Reparação de itens gravados como texto");
  await db.query("UPDATE saidas SET itens = to_jsonb(itens::text) WHERE id = $1", [b.id]);
  const [{ antes }] = await db.query<{ antes: string }>("SELECT jsonb_typeof(itens) AS antes FROM saidas WHERE id = $1", [b.id]);
  assert(antes === "string", "simula nota com itens em texto (como em produção)");
  assert((await obterNota(b.id))?.itens[0].descricao === "Adiantamento", "leitura funciona mesmo com itens em texto");
  await db.exec(REPARAR_ITENS_SQL);
  const [{ depois }] = await db.query<{ depois: string }>("SELECT jsonb_typeof(itens) AS depois FROM saidas WHERE id = $1", [b.id]);
  assert(depois === "array" && (await obterNota(b.id))?.total === 15000, "reparação converte para array sem alterar a nota");

  console.log("\nTodos os testes passaram.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      fs.rmSync(process.env.PGLITE_DIR!, { recursive: true, force: true });
    } catch {}
    process.exit();
  });
