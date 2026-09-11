"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { IconeAviso, IconeEditar, IconeVerificado } from "./Icones";
import { iniciais } from "./Shell";
import type { AcaoGestao, UtilizadorGestao } from "@/lib/auth/constantes";
import { formatarTelefone } from "@/lib/telefone";

interface Props {
  utilizadores: UtilizadorGestao[];
  /** Id do administrador com sessão iniciada. */
  atualId: string;
}

interface Confirmacao {
  alvo: UtilizadorGestao;
  acao: AcaoGestao;
  titulo: string;
  texto: string;
  rotulo: string;
  sucesso: string;
  perigo?: boolean;
}

type Aviso = { tipo: "ok" | "erro"; texto: string };

function dataCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-PT");
}

const BOTAO_PERIGO = "botao-secundario px-3 py-2 text-red-700 hover:border-red-200 hover:bg-red-50";

export function GestaoUtilizadores({ utilizadores, atualId }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [renomear, setRenomear] = useState<{ alvo: UtilizadorGestao; nome: string } | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const timer = useRef<number | null>(null);

  const pendentes = utilizadores.filter((u) => u.estado === "pendente");
  const ativos = utilizadores.filter((u) => u.estado === "aprovado");
  const removidos = utilizadores.filter((u) => u.estado === "removido");

  const mostrarAviso = (a: Aviso) => {
    setAviso(a);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAviso(null), a.tipo === "erro" ? 6000 : 3500);
  };

  const executar = async (alvo: UtilizadorGestao, acao: AcaoGestao, sucesso: string, nome?: string) => {
    setOcupado(alvo.id);
    try {
      const res = await fetch(`/api/utilizadores/${encodeURIComponent(alvo.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, nome }),
      });
      if (res.status === 401) {
        window.location.replace("/entrar");
        return;
      }
      const corpo = (await res.json().catch(() => null)) as { erro?: string } | null;
      if (!res.ok) throw new Error(corpo?.erro ?? `Erro ${res.status}`);
      setConfirmacao(null);
      setRenomear(null);
      mostrarAviso({ tipo: "ok", texto: sucesso });
      router.refresh();
    } catch (e) {
      mostrarAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Não foi possível guardar a alteração." });
    } finally {
      setOcupado(null);
    }
  };

  const pedirRemocao = (u: UtilizadorGestao) => {
    const pedido = u.estado === "pendente";
    setConfirmacao({
      alvo: u,
      acao: "remover",
      perigo: true,
      titulo: pedido ? `Recusar o pedido de ${u.nome}?` : `Remover ${u.nome}?`,
      texto: pedido
        ? "A pessoa não terá acesso à app. Pode restaurar o acesso mais tarde, na lista de removidos."
        : "A pessoa perde o acesso de imediato e as sessões abertas terminam. As notas que registou continuam no histórico com o seu nome.",
      rotulo: pedido ? "Recusar pedido" : "Remover",
      sucesso: pedido ? `Pedido de ${u.nome} recusado.` : `O acesso de ${u.nome} foi removido.`,
    });
  };

  const aguardar = ocupado !== null;

  return (
    <div className="no-print">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Utilizadores</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Só as contas aprovadas têm acesso à app. Os administradores aprovam pedidos, gerem utilizadores e podem eliminar notas.
        </p>
      </div>

      <Seccao titulo="Pedidos de acesso" contagem={pendentes.length} destaque={pendentes.length > 0}>
        {pendentes.length === 0 ? (
          <Vazio texto="Não há pedidos à espera de aprovação." />
        ) : (
          <ul className="divide-y divide-linha">
            {pendentes.map((u) => (
              <Linha key={u.id} u={u} atualId={atualId} detalhe={`Pediu acesso em ${dataCurta(u.criadoEm)}`}>
                <button className={BOTAO_PERIGO} disabled={aguardar} onClick={() => pedirRemocao(u)}>
                  Recusar
                </button>
                <button
                  className="botao-primario px-3 py-2"
                  disabled={aguardar}
                  onClick={() => executar(u, "aprovar", `${u.nome} já pode entrar.`)}
                >
                  {ocupado === u.id ? "A aprovar…" : "Aprovar"}
                </button>
              </Linha>
            ))}
          </ul>
        )}
      </Seccao>

      <Seccao titulo="Com acesso" contagem={ativos.length}>
        <ul className="divide-y divide-linha">
          {ativos.map((u) => {
            const proprio = u.id === atualId;
            return (
              <Linha key={u.id} u={u} atualId={atualId} detalhe={`${u.notas} ${u.notas === 1 ? "nota registada" : "notas registadas"}`}>
                <button
                  className="botao-fantasma px-2"
                  disabled={aguardar}
                  onClick={() => setRenomear({ alvo: u, nome: u.nome })}
                  aria-label={`Editar o nome de ${u.nome}`}
                  title="Editar nome"
                >
                  <IconeEditar />
                </button>
                {!proprio &&
                  (u.admin ? (
                    <button
                      className="botao-secundario px-3 py-2"
                      disabled={aguardar}
                      onClick={() =>
                        setConfirmacao({
                          alvo: u,
                          acao: "retirarAdmin",
                          titulo: `Retirar as permissões de administrador a ${u.nome}?`,
                          texto: "Deixa de poder aprovar e remover pessoas, nomear administradores e eliminar notas. Continua a poder usar a app.",
                          rotulo: "Retirar administrador",
                          sucesso: `${u.nome} já não é administrador.`,
                        })
                      }
                    >
                      Retirar admin
                    </button>
                  ) : (
                    <button
                      className="botao-secundario px-3 py-2"
                      disabled={aguardar}
                      onClick={() =>
                        setConfirmacao({
                          alvo: u,
                          acao: "tornarAdmin",
                          titulo: `Tornar ${u.nome} administrador?`,
                          texto: "Passa a poder aprovar e remover pessoas, nomear outros administradores e eliminar notas de saída.",
                          rotulo: "Tornar administrador",
                          sucesso: `${u.nome} é agora administrador.`,
                        })
                      }
                    >
                      Tornar admin
                    </button>
                  ))}
                {!proprio && (
                  <button className={BOTAO_PERIGO} disabled={aguardar} onClick={() => pedirRemocao(u)}>
                    Remover
                  </button>
                )}
              </Linha>
            );
          })}
        </ul>
      </Seccao>

      {removidos.length > 0 && (
        <Seccao titulo="Removidos" contagem={removidos.length}>
          <ul className="divide-y divide-linha">
            {removidos.map((u) => (
              <Linha key={u.id} u={u} atualId={atualId} detalhe="Sem acesso">
                <button
                  className="botao-secundario px-3 py-2"
                  disabled={aguardar}
                  onClick={() => executar(u, "aprovar", `O acesso de ${u.nome} foi restaurado.`)}
                >
                  {ocupado === u.id ? "A restaurar…" : "Restaurar acesso"}
                </button>
              </Linha>
            ))}
          </ul>
        </Seccao>
      )}

      {confirmacao && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="gestao-titulo">
          <button className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" aria-label="Cancelar" onClick={() => setConfirmacao(null)} />
          <div className="relative w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <h2 id="gestao-titulo" className="text-lg font-semibold">
              {confirmacao.titulo}
            </h2>
            <p className="mt-1 text-sm text-tinta-suave">{confirmacao.texto}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="botao-secundario" onClick={() => setConfirmacao(null)} disabled={aguardar}>
                Cancelar
              </button>
              <button
                className={confirmacao.perigo ? "botao bg-red-600 text-white hover:bg-red-700" : "botao-primario"}
                onClick={() => executar(confirmacao.alvo, confirmacao.acao, confirmacao.sucesso)}
                disabled={aguardar}
              >
                {aguardar ? "A guardar…" : confirmacao.rotulo}
              </button>
            </div>
          </div>
        </div>
      )}

      {renomear && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="renomear-titulo">
          <button className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" aria-label="Cancelar" onClick={() => setRenomear(null)} />
          <form
            className="relative w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-sm sm:rounded-3xl"
            onSubmit={(e) => {
              e.preventDefault();
              void executar(renomear.alvo, "renomear", "Nome atualizado.", renomear.nome);
            }}
          >
            <h2 id="renomear-titulo" className="text-lg font-semibold">
              Editar nome
            </h2>
            <p className="mt-1 text-sm text-tinta-suave">O nome aparece nas notas que esta pessoa registar.</p>
            <label className="rotulo mt-4" htmlFor="novo-nome">
              Nome
            </label>
            <input
              id="novo-nome"
              className="campo"
              value={renomear.nome}
              onChange={(e) => setRenomear({ ...renomear, nome: e.target.value })}
              autoCapitalize="words"
              autoComplete="off"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="botao-secundario" onClick={() => setRenomear(null)}>
                Cancelar
              </button>
              <button type="submit" className="botao-primario" disabled={aguardar}>
                {aguardar ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className={`fixed left-1/2 top-16 z-[60] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${
            aviso.tipo === "erro" ? "bg-red-700" : "bg-tinta"
          }`}
        >
          {aviso.tipo === "erro" ? <IconeAviso className="shrink-0 text-amarelo" /> : <IconeVerificado className="shrink-0 text-amarelo" />}
          {aviso.texto}
        </div>
      )}
    </div>
  );
}

function Seccao({
  titulo,
  contagem,
  destaque,
  children,
}: {
  titulo: string;
  contagem: number;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-linha bg-white shadow-suave">
      <h2 className="flex items-center gap-2 border-b border-linha bg-creme px-4 py-3 text-sm font-semibold sm:px-5">
        {titulo}
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
            destaque ? "bg-amarelo text-tinta" : "bg-white text-tinta-suave"
          }`}
        >
          {contagem}
        </span>
      </h2>
      {children}
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="px-5 py-6 text-center text-sm text-tinta-suave">{texto}</p>;
}

function Linha({
  u,
  atualId,
  detalhe,
  children,
}: {
  u: UtilizadorGestao;
  atualId: string;
  detalhe: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold ${
          u.admin ? "bg-laranja text-white" : "bg-amarelo-claro text-laranja-escuro"
        }`}
        aria-hidden
      >
        {iniciais(u.nome)}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{u.nome}</span>
          {u.id === atualId && (
            <span className="rounded-full bg-creme-escuro px-2 py-0.5 text-[10px] font-semibold text-tinta-suave">Você</span>
          )}
          {u.admin && (
            <span className="rounded-full bg-laranja-claro px-2 py-0.5 text-[10px] font-semibold text-laranja-escuro">Administrador</span>
          )}
        </span>
        <span className="mt-0.5 block text-xs tabular-nums text-tinta-suave">
          {formatarTelefone(u.telefone)} · {detalhe}
        </span>
      </span>
      <span className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">{children}</span>
    </li>
  );
}
