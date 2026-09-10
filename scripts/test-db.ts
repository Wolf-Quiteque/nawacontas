/**
 * Teste rápido da camada de dados com o Postgres embebido (PGlite) numa pasta temporária.
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
  origem: "Caixa",
  periodo: "Setembro de 2026",
  itens: [
    { descricao: "Cabo", qtd: "", valor: 2000 },
    { descricao: "Portagem", qtd: "3", valor: 9000 },
  ],
  cidade: "Luanda",
  data: "2026-09-10",
  ...extra,
});

async function main() {
  const { criarNota, listarNotas, obterNota, atualizarNota, eliminarNota, proximoNumero, NUMERO_INICIAL } =
    await import("../src/lib/db/notas");

  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`FALHOU: ${msg}`);
    console.log("✓", msg);
  };

  assert((await proximoNumero()) === NUMERO_INICIAL + 1, `próximo número inicial é ${NUMERO_INICIAL + 1}`);

  const a = await criarNota(base({}));
  assert(a.numero === NUMERO_INICIAL + 1, `primeira nota recebe o número ${NUMERO_INICIAL + 1}`);
  assert(a.data === "2026-09-10", "data guardada como AAAA-MM-DD");
  assert(a.itens.length === 2 && a.itens[1].qtd === "3" && a.itens[1].valor === 9000, "itens guardados em JSON");
  assert(a.total === 11000, "total calculado a partir dos itens");

  const b = await criarNota(base({ beneficiario: "Maria", origem: "Cartão", data: "2026-08-20", itens: [{ descricao: "Adiantamento", qtd: "", valor: 15000 }] }));
  assert(b.numero === a.numero + 1, "número sequencial");

  const [c1, c2] = await Promise.all([
    criarNota(base({ beneficiario: "P1", data: "2026-09-11" })),
    criarNota(base({ beneficiario: "P2", data: "2026-09-11" })),
  ]);
  assert(c1.numero !== c2.numero, "criações concorrentes recebem números diferentes");

  const todas = await listarNotas();
  assert(todas.length === 4 && todas[0].numero > todas[3].numero, "lista ordenada por número decrescente");
  assert((await listarNotas({ de: "2026-08-01", ate: "2026-08-31" })).length === 1, "filtro por intervalo de datas");
  assert((await listarNotas({ q: "isaac" })).length === 1, "pesquisa por beneficiário (sem distinção de maiúsculas)");
  assert((await listarNotas({ q: String(b.numero) })).length === 1, "pesquisa por número");
  assert((await listarNotas({ q: "cartão" })).length === 1, "pesquisa por origem");
  assert((await listarNotas({ q: "portagem" })).length === 3, "pesquisa por descrição de item");

  const atualizada = await atualizarNota(a.id, base({ beneficiario: "Isaac Gonçalves", itens: [{ descricao: "Cabo", qtd: "", valor: 2500 }] }));
  assert(atualizada?.beneficiario === "Isaac Gonçalves" && atualizada.numero === a.numero, "atualizar mantém o número");
  assert(atualizada?.total === 2500, "atualizar recalcula o total");
  assert((await obterNota(a.id))?.beneficiario === "Isaac Gonçalves", "obter por id");

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
