import "server-only";
import { randomUUID } from "node:crypto";
import type { AcaoGestao, EstadoConta, Utilizador, UtilizadorGestao } from "../auth/constantes";
import { gerarHashSenha, verificarSenha } from "../auth/senha";
import { terminarSessoesDe } from "../auth/sessoes-db";
import { validarNome } from "../auth/validacao";
import { getDb } from "./index";

/** Após este número de palavras-passe erradas seguidas, a conta fica bloqueada durante uns minutos. */
const MAX_FALHAS = 5;
const BLOQUEIO_MINUTOS = 10;

export type ResultadoConta = { ok: true; utilizador: Utilizador } | { ok: false; erro: string; status: number };
export type ResultadoGestao = { ok: true; utilizador: UtilizadorGestao } | { ok: false; erro: string; status: number };

function ehDuplicado(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === "23505" || /duplicate key|unique/i.test(err?.message ?? "");
}

function mensagemNumeroOcupado(estado: EstadoConta): string {
  if (estado === "pendente") return "Já existe um pedido de acesso com este número. Aguarde a aprovação de um administrador.";
  if (estado === "removido") return "Este número não tem acesso. Contacte um administrador.";
  return "Já existe uma conta com este número de telefone.";
}

/** Cria uma conta pendente: só pode entrar depois de um administrador a aprovar. */
export async function registarUtilizador(dados: { nome: string; telefone: string; senha: string }): Promise<ResultadoConta> {
  const db = await getDb();
  const existente = await db.query<{ estado: EstadoConta }>(`SELECT estado FROM utilizadores WHERE telefone = $1`, [dados.telefone]);
  if (existente[0]) return { ok: false, erro: mensagemNumeroOcupado(existente[0].estado), status: 409 };

  const id = randomUUID();
  const senhaHash = await gerarHashSenha(dados.senha);
  try {
    await db.query(
      `INSERT INTO utilizadores (id, telefone, nome, senha_hash, estado, admin) VALUES ($1, $2, $3, $4, 'pendente', false)`,
      [id, dados.telefone, dados.nome, senhaHash],
    );
  } catch (e) {
    if (ehDuplicado(e)) return { ok: false, erro: mensagemNumeroOcupado("aprovado"), status: 409 };
    throw e;
  }
  return { ok: true, utilizador: { id, nome: dados.nome, telefone: dados.telefone, admin: false } };
}

let hashFicticio: Promise<string> | null = null;

export async function autenticar(telefone: string, senha: string): Promise<ResultadoConta> {
  const db = await getDb();
  const rows = await db.query<
    Utilizador & { senha_hash: string; estado: EstadoConta; bloqueado: boolean; minutos: number | null }
  >(
    `SELECT id, nome, telefone, admin, estado, senha_hash,
            (bloqueado_ate IS NOT NULL AND bloqueado_ate > now()) AS bloqueado,
            CEIL(EXTRACT(EPOCH FROM (bloqueado_ate - now())) / 60)::int AS minutos
       FROM utilizadores
      WHERE telefone = $1`,
    [telefone],
  );
  const u = rows[0];
  const incorretos: ResultadoConta = { ok: false, erro: "Número de telefone ou palavra-passe incorretos.", status: 401 };

  if (!u) {
    // Mesmo custo de tempo que uma conta existente, para não revelar que números estão registados.
    hashFicticio ??= gerarHashSenha("nawanotas");
    await verificarSenha(senha, await hashFicticio);
    return incorretos;
  }

  if (u.bloqueado) {
    const m = Math.max(1, Number(u.minutos) || 1);
    return {
      ok: false,
      erro: `Demasiadas tentativas falhadas. Tente novamente dentro de ${m} ${m === 1 ? "minuto" : "minutos"}.`,
      status: 429,
    };
  }

  if (!(await verificarSenha(senha, u.senha_hash))) {
    await db.query(
      `UPDATE utilizadores SET
         bloqueado_ate = CASE WHEN falhas + 1 >= $2::int THEN now() + make_interval(mins => $3::int) ELSE bloqueado_ate END,
         falhas = CASE WHEN falhas + 1 >= $2::int THEN 0 ELSE falhas + 1 END
       WHERE id = $1`,
      [u.id, MAX_FALHAS, BLOQUEIO_MINUTOS],
    );
    return incorretos;
  }

  await db.query(`UPDATE utilizadores SET falhas = 0, bloqueado_ate = NULL WHERE id = $1`, [u.id]);

  // O estado da conta só é revelado a quem sabe a palavra-passe.
  if (u.estado === "pendente")
    return { ok: false, erro: "A sua conta aguarda aprovação de um administrador.", status: 403 };
  if (u.estado !== "aprovado") return { ok: false, erro: "Esta conta não tem acesso. Contacte um administrador.", status: 403 };

  return { ok: true, utilizador: { id: u.id, nome: u.nome, telefone: u.telefone, admin: Boolean(u.admin) } };
}

const COLUNAS_GESTAO = `
  u.id, u.nome, u.telefone, u.admin, u.estado,
  to_char(u.criado_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "criadoEm",
  (SELECT COUNT(*)::int FROM saidas s WHERE s.criado_por = u.id AND s.eliminada_em IS NULL) AS notas
`;

function normalizarGestao(r: UtilizadorGestao): UtilizadorGestao {
  return { ...r, admin: Boolean(r.admin), notas: Number(r.notas) || 0 };
}

export async function listarUtilizadores(): Promise<UtilizadorGestao[]> {
  const db = await getDb();
  const rows = await db.query<UtilizadorGestao>(
    `SELECT ${COLUNAS_GESTAO} FROM utilizadores u ORDER BY u.admin DESC, lower(u.nome), u.criado_em`,
  );
  return rows.map(normalizarGestao);
}

async function obterGestao(id: string): Promise<UtilizadorGestao | null> {
  const db = await getDb();
  const rows = await db.query<UtilizadorGestao>(`SELECT ${COLUNAS_GESTAO} FROM utilizadores u WHERE u.id = $1`, [id]);
  return rows[0] ? normalizarGestao(rows[0]) : null;
}

export async function contarPendentes(): Promise<number> {
  const db = await getDb();
  const rows = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM utilizadores WHERE estado = 'pendente'`);
  return Number(rows[0]?.n) || 0;
}

/**
 * Ações de administrador sobre uma conta. A permissão (ser administrador) é verificada na rota de API;
 * aqui aplicam-se as regras: ninguém se remove a si próprio nem retira o próprio papel de administrador,
 * o que garante que existe sempre pelo menos um administrador.
 */
export async function gerirUtilizador(
  atorId: string,
  alvoId: string,
  acao: AcaoGestao,
  nome?: string,
): Promise<ResultadoGestao> {
  const alvo = await obterGestao(alvoId);
  if (!alvo) return { ok: false, erro: "Utilizador não encontrado.", status: 404 };
  const proprio = atorId === alvoId;
  const db = await getDb();

  switch (acao) {
    case "aprovar":
      if (alvo.estado !== "aprovado")
        await db.query(`UPDATE utilizadores SET estado = 'aprovado', falhas = 0, bloqueado_ate = NULL WHERE id = $1`, [alvoId]);
      break;
    case "remover":
      if (proprio) return { ok: false, erro: "Não pode remover a sua própria conta.", status: 400 };
      await db.query(`UPDATE utilizadores SET estado = 'removido', admin = false WHERE id = $1`, [alvoId]);
      await terminarSessoesDe(alvoId);
      break;
    case "tornarAdmin":
      if (alvo.estado !== "aprovado")
        return { ok: false, erro: "Aprove a conta antes de lhe dar permissões de administrador.", status: 400 };
      await db.query(`UPDATE utilizadores SET admin = true WHERE id = $1`, [alvoId]);
      break;
    case "retirarAdmin":
      if (proprio) return { ok: false, erro: "Não pode retirar a si próprio as permissões de administrador.", status: 400 };
      await db.query(`UPDATE utilizadores SET admin = false WHERE id = $1`, [alvoId]);
      break;
    case "renomear": {
      const v = validarNome(nome);
      if (!v.ok) return { ok: false, erro: v.erro, status: 400 };
      await db.query(`UPDATE utilizadores SET nome = $2 WHERE id = $1`, [alvoId, v.valor]);
      break;
    }
    default:
      return { ok: false, erro: "Ação inválida.", status: 400 };
  }

  const atualizado = await obterGestao(alvoId);
  if (!atualizado) return { ok: false, erro: "Utilizador não encontrado.", status: 404 };
  return { ok: true, utilizador: atualizado };
}

/**
 * Cria uma conta de administrador aprovada, ou aprova e promove a conta existente com esse número
 * (mantendo o nome e definindo a palavra-passe indicada). Usado pelo script `npm run criar-admin`.
 */
export async function garantirAdministrador(dados: {
  telefone: string;
  nome: string;
  senha: string;
}): Promise<{ criado: boolean; utilizador: Utilizador }> {
  const db = await getDb();
  const senhaHash = await gerarHashSenha(dados.senha);
  const existente = (await db.query<{ id: string; nome: string }>(`SELECT id, nome FROM utilizadores WHERE telefone = $1`, [dados.telefone]))[0];
  if (existente) {
    await db.query(
      `UPDATE utilizadores SET senha_hash = $2, estado = 'aprovado', admin = true, falhas = 0, bloqueado_ate = NULL WHERE id = $1`,
      [existente.id, senhaHash],
    );
    return { criado: false, utilizador: { id: existente.id, nome: existente.nome, telefone: dados.telefone, admin: true } };
  }
  const id = randomUUID();
  await db.query(
    `INSERT INTO utilizadores (id, telefone, nome, senha_hash, estado, admin) VALUES ($1, $2, $3, $4, 'aprovado', true)`,
    [id, dados.telefone, dados.nome, senhaHash],
  );
  return { criado: true, utilizador: { id, nome: dados.nome, telefone: dados.telefone, admin: true } };
}
