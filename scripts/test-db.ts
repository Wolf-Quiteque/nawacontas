/**
 * Teste rápido da camada de dados com o Postgres embebido (PGlite) numa pasta temporária.
 * Executar: npm run test:db
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nawanotas-test-"));
delete process.env.POSTGRES_URL;
delete process.env.DATABASE_URL;

async function main() {
  const { criarNota, listarNotas, obterNota, atualizarNota, eliminarNota, proximoNumero, NUMERO_INICIAL } =
    await import("../src/lib/db/notas");

  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`FALHOU: ${msg}`);
    console.log("✓", msg);
  };

  assert((await proximoNumero()) === NUMERO_INICIAL + 1, `próximo número inicial é ${NUMERO_INICIAL + 1}`);

  const a = await criarNota({
    nome: "Isaac", motivo: "Salário", periodo: "Agosto de 2026", remuneracao: 42000,
    taxaRemuneracao: "", desconto: 1260, taxaDesconto: "3%", cidade: "Luanda", data: "2026-08-17",
  });
  assert(a.numero === NUMERO_INICIAL + 1, `primeira nota recebe o número ${NUMERO_INICIAL + 1}`);
  assert(a.data === "2026-08-17", "data guardada como AAAA-MM-DD");
  assert(a.remuneracao === 42000 && a.desconto === 1260, "valores numéricos");

  const b = await criarNota({
    nome: "Maria", motivo: "Adiantamento", periodo: "Setembro de 2026", remuneracao: 10000,
    taxaRemuneracao: "", desconto: 0, taxaDesconto: "", cidade: "Luanda", data: "2026-09-10",
  });
  assert(b.numero === a.numero + 1, "número sequencial");

  const [c1, c2] = await Promise.all([
    criarNota({ nome: "P1", motivo: "", periodo: "", remuneracao: 1, taxaRemuneracao: "", desconto: 0, taxaDesconto: "", cidade: "Luanda", data: "2026-09-11" }),
    criarNota({ nome: "P2", motivo: "", periodo: "", remuneracao: 2, taxaRemuneracao: "", desconto: 0, taxaDesconto: "", cidade: "Luanda", data: "2026-09-11" }),
  ]);
  assert(c1.numero !== c2.numero, "criações concorrentes recebem números diferentes");

  const todas = await listarNotas();
  assert(todas.length === 4 && todas[0].numero > todas[3].numero, "lista ordenada por número decrescente");
  assert((await listarNotas({ de: "2026-09-01", ate: "2026-09-10" })).length === 1, "filtro por intervalo de datas");
  assert((await listarNotas({ q: "isaac" })).length === 1, "pesquisa por nome (sem distinção de maiúsculas)");
  assert((await listarNotas({ q: String(b.numero) })).length === 1, "pesquisa por número");
  assert((await listarNotas({ q: "adiant" })).length === 1, "pesquisa por motivo");

  const atualizada = await atualizarNota(a.id, { ...a, nome: "Isaac Gonçalves" });
  assert(atualizada?.nome === "Isaac Gonçalves" && atualizada.numero === a.numero, "atualizar mantém o número");
  assert((await obterNota(a.id))?.nome === "Isaac Gonçalves", "obter por id");

  assert(await eliminarNota(b.id), "eliminar");
  assert((await obterNota(b.id)) === null, "nota eliminada não existe");
  assert((await eliminarNota("inexistente")) === false, "eliminar inexistente devolve false");
  assert((await proximoNumero()) === Math.max(c1.numero, c2.numero) + 1, "próximo número após eliminação continua a sequência");

  console.log("\nTodos os testes passaram.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    try {
      fs.rmSync(process.env.PGLITE_DIR!, { recursive: true, force: true });
    } catch {}
    process.exit();
  });
