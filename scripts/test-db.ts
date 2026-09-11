/**
 * Testes da camada de dados, contas (aprovação, administradores) e sessões,
 * com o Postgres embebido (PGlite) numa pasta temporária.
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
  const { criarNota, listarNotas, obterNota, proximoNumero, eliminarNota, NUMERO_INICIAL } = await import("../src/lib/db/notas");
  const { getDb, REPARAR_ITENS_SQL } = await import("../src/lib/db");
  const { registarUtilizador, autenticar, garantirAdministrador, gerirUtilizador, listarUtilizadores, contarPendentes } =
    await import("../src/lib/db/utilizadores");
  const { criarSessao, utilizadorDoToken, terminarSessao } = await import("../src/lib/auth/sessoes-db");
  const { validarRegisto, validarLogin, validarNome } = await import("../src/lib/auth/validacao");
  const { destinoSeguro } = await import("../src/lib/auth/constantes");
  const { validarEntrada } = await import("../src/lib/validacao");
  const { normalizarTelefone, formatarTelefone } = await import("../src/lib/telefone");
  const { normalizarItem, subtotalItem, totalDaNota, textosDaNota } = await import("../src/lib/nota");
  const db = await getDb();
  const estadoDe = async (id: string) =>
    (await db.query<{ estado: string }>("SELECT estado FROM utilizadores WHERE id = $1", [id]))[0]?.estado;

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
  const nomeLimpo = validarNome("  Ana   Costa ");
  assert(nomeLimpo.ok && nomeLimpo.valor === "Ana Costa", "nome com espaços normalizados");

  console.log("\n— Destino depois de entrar (?voltar=)");
  assert(destinoSeguro("/historico?q=cabo") === "/historico?q=cabo", "aceita caminhos internos");
  for (const externo of ["https://exemplo.com", "//exemplo.com", "/\\exemplo.com", "/\t/exemplo.com", "/\n/exemplo.com", "exemplo.com"])
    assert(destinoSeguro(externo) === "/", `rejeita destino externo ${JSON.stringify(externo)}`);
  assert(destinoSeguro("/entrar") === "/" && destinoSeguro(undefined) === "/", "ignora /entrar e destino vazio");

  console.log("\n— Contas pendentes e aprovação");
  const conta = await registarUtilizador({ nome: "Márcio", telefone: "932876178", senha: "segredo1" });
  if (!conta.ok) throw new Error("FALHOU: registar utilizador");
  assert(!conta.utilizador.admin, "registar utilizador (sem permissões de administrador)");
  assert((await estadoDe(conta.utilizador.id)) === "pendente", "nova conta fica pendente de aprovação");
  const hash = (await db.query<{ senha_hash: string }>("SELECT senha_hash FROM utilizadores WHERE id = $1", [conta.utilizador.id]))[0]
    .senha_hash;
  assert(hash.startsWith("scrypt$") && !hash.includes("segredo1"), "palavra-passe guardada como hash scrypt");
  const dup = await registarUtilizador({ nome: "Outro", telefone: "932876178", senha: "xxxxxx" });
  assert(!dup.ok && dup.status === 409 && dup.erro.includes("pedido de acesso"), "novo registo com número pendente é rejeitado");
  const pendente = await autenticar("932876178", "segredo1");
  assert(!pendente.ok && pendente.status === 403 && pendente.erro.includes("aprovação"), "conta pendente não consegue entrar");
  const erradaPendente = await autenticar("932876178", "errada");
  assert(!erradaPendente.ok && erradaPendente.status === 401, "com palavra-passe errada não revela que a conta está pendente");
  const inexistente = await autenticar("923000000", "segredo1");
  assert(!inexistente.ok && inexistente.status === 401, "número sem conta é rejeitado com a mesma mensagem");
  assert((await contarPendentes()) === 1, "contagem de pedidos pendentes");

  const admin = await garantirAdministrador({ telefone: "922692380", nome: "Administrador", senha: "admin123" });
  assert(admin.criado && admin.utilizador.admin, "criar administrador inicial (aprovado)");
  const adminDeNovo = await garantirAdministrador({ telefone: "922692380", nome: "Outro Nome", senha: "nova-senha1" });
  assert(!adminDeNovo.criado && adminDeNovo.utilizador.nome === "Administrador", "voltar a correr mantém a conta e o nome");
  const entradaAdmin = await autenticar("922692380", "nova-senha1");
  assert(entradaAdmin.ok && entradaAdmin.utilizador.admin, "administrador entra com a palavra-passe atualizada");
  const adm = admin.utilizador.id;

  const aprovada = await gerirUtilizador(adm, conta.utilizador.id, "aprovar");
  assert(aprovada.ok && aprovada.utilizador.estado === "aprovado", "administrador aprova a conta");
  assert((await contarPendentes()) === 0, "sem pedidos pendentes depois de aprovar");
  const entrou = await autenticar("932876178", "segredo1");
  assert(entrou.ok && !entrou.utilizador.admin, "conta aprovada entra (sem ser administradora)");

  for (let k = 0; k < 5; k++) await autenticar("932876178", "errada");
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
  const daSessao = await utilizadorDoToken(token);
  assert(daSessao?.telefone === "932876178" && daSessao.admin === false, "sessão válida devolve o utilizador e o papel");
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

  console.log("\n— Gestão de utilizadores");
  const tokenMarcio = await criarSessao(conta.utilizador.id);
  const removida = await gerirUtilizador(adm, conta.utilizador.id, "remover");
  assert(removida.ok && removida.utilizador.estado === "removido", "administrador remove a pessoa");
  assert((await utilizadorDoToken(tokenMarcio)) === null, "remoção termina as sessões abertas");
  const semAcesso = await autenticar("932876178", "segredo1");
  assert(!semAcesso.ok && semAcesso.status === 403 && semAcesso.erro.includes("não tem acesso"), "pessoa removida não consegue entrar");
  const reregisto = await registarUtilizador({ nome: "Márcio", telefone: "932876178", senha: "segredo1" });
  assert(!reregisto.ok && reregisto.status === 409, "pessoa removida não pode criar nova conta com o mesmo número");
  const restaurada = await gerirUtilizador(adm, conta.utilizador.id, "aprovar");
  assert(restaurada.ok && (await autenticar("932876178", "segredo1")).ok, "restaurar acesso");

  const proprioRemover = await gerirUtilizador(adm, adm, "remover");
  assert(!proprioRemover.ok && proprioRemover.status === 400, "administrador não se pode remover a si próprio");
  const proprioRetirar = await gerirUtilizador(adm, adm, "retirarAdmin");
  assert(!proprioRetirar.ok && proprioRetirar.status === 400, "administrador não pode retirar o próprio papel");

  const outra = await registarUtilizador({ nome: "Ana", telefone: "923456789", senha: "senha1234" });
  if (!outra.ok) throw new Error("FALHOU: registar segunda conta");
  const adminPendente = await gerirUtilizador(adm, outra.utilizador.id, "tornarAdmin");
  assert(!adminPendente.ok && adminPendente.status === 400, "conta pendente não pode ser administradora");
  await gerirUtilizador(adm, outra.utilizador.id, "aprovar");
  const promovida = await gerirUtilizador(adm, outra.utilizador.id, "tornarAdmin");
  assert(promovida.ok && promovida.utilizador.admin, "tornar outra pessoa administradora");
  const tokenAna = await criarSessao(outra.utilizador.id);
  assert((await utilizadorDoToken(tokenAna))?.admin === true, "sessão reflete o novo papel de administrador");
  const despromovida = await gerirUtilizador(adm, outra.utilizador.id, "retirarAdmin");
  assert(despromovida.ok && !despromovida.utilizador.admin, "retirar o papel de administrador a outra pessoa");
  assert((await utilizadorDoToken(tokenAna))?.admin === false, "sessão reflete a perda do papel de imediato");

  const renomeInvalido = await gerirUtilizador(adm, conta.utilizador.id, "renomear", "A");
  assert(!renomeInvalido.ok && renomeInvalido.status === 400, "nome inválido é rejeitado");
  const renomeada = await gerirUtilizador(adm, conta.utilizador.id, "renomear", "  Márcio   Quiteque ");
  assert(renomeada.ok && renomeada.utilizador.nome === "Márcio Quiteque", "editar nome");
  const naoExiste = await gerirUtilizador(adm, "inexistente", "aprovar");
  assert(!naoExiste.ok && naoExiste.status === 404, "utilizador inexistente");
  const lista = await listarUtilizadores();
  assert(lista.length === 3 && lista[0].admin, "lista de utilizadores (administradores primeiro)");

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
  assert(a.criadoPorNome === "Márcio Quiteque" && a.criadoPorTelefone === "932876178", "nota regista quem a criou");
  const [{ tipo }] = await db.query<{ tipo: string }>("SELECT jsonb_typeof(itens) AS tipo FROM saidas WHERE id = $1", [a.id]);
  assert(tipo === "array", "itens gravados como array JSON (não como texto)");

  const b = await criarNota(
    base({ beneficiario: "Maria", origem: "Cartão", data: "2026-08-20", itens: [{ descricao: "Adiantamento", qtd: 1, preco: 15000 }] }),
    null,
  );
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

  console.log("\n— Eliminar notas (administradores)");
  const listaAntes = await listarNotas();
  const totalAntes = listaAntes.reduce((s, n) => s + n.total, 0);
  const ultima = listaAntes[0];
  const numeroSeguinte = await proximoNumero();
  const eliminada = await eliminarNota(ultima.id, adm);
  assert(eliminada?.numero === ultima.numero && eliminada.total === ultima.total, "eliminar devolve o número e o valor da nota");
  const listaDepois = await listarNotas();
  assert(listaDepois.length === listaAntes.length - 1 && !listaDepois.some((n) => n.id === ultima.id), "nota eliminada sai do histórico");
  assert(listaDepois.reduce((s, n) => s + n.total, 0) === totalAntes - ultima.total, "total desce o valor da nota eliminada");
  assert((await listarNotas({ q: String(ultima.numero) })).length === 0, "nota eliminada não aparece na pesquisa");
  assert((await obterNota(ultima.id)) === null, "nota eliminada deixa de abrir");
  assert((await proximoNumero()) === numeroSeguinte, "número da nota eliminada não é reutilizado");
  assert((await eliminarNota(ultima.id, adm)) === null, "eliminar de novo não faz nada");
  const [{ eliminada_por }] = await db.query<{ eliminada_por: string }>("SELECT eliminada_por FROM saidas WHERE id = $1", [ultima.id]);
  assert(eliminada_por === adm, "fica registado quem eliminou");
  const autor = (await listarUtilizadores()).find((u) => u.id === conta.utilizador.id);
  assert(
    autor?.notas === listaDepois.filter((n) => n.criadoPorTelefone === "932876178").length,
    "contagem de notas por utilizador ignora as eliminadas",
  );

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
