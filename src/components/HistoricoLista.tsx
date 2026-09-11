"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconeAviso, IconeCopiar, IconePesquisar, IconeSeta } from "./Icones";
import { apiListar, type FiltrosApi } from "@/lib/api";
import { reutilizarNota } from "@/lib/armazenamento";
import { anoDaData, dataPorExtenso, formatarKz, hojeISO, MESES, type NotaRegisto } from "@/lib/nota";

type Atalho = "tudo" | "hoje" | "mes" | "mesPassado" | "ano";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function intervaloDoAtalho(a: Atalho): { de: string; ate: string } {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  switch (a) {
    case "hoje":
      return { de: hojeISO(), ate: hojeISO() };
    case "mes":
      return { de: iso(new Date(y, m, 1)), ate: iso(new Date(y, m + 1, 0)) };
    case "mesPassado":
      return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m, 0)) };
    case "ano":
      return { de: `${y}-01-01`, ate: `${y}-12-31` };
    default:
      return { de: "", ate: "" };
  }
}

function dataCurta(isoData: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoData);
  if (!m) return isoData;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function resumoItens(n: NotaRegisto): string {
  const nomes = n.itens.map((i) => i.descricao).filter(Boolean);
  if (!nomes.length) return "";
  return nomes.length <= 3 ? nomes.join(", ") : `${nomes.slice(0, 3).join(", ")} +${nomes.length - 3}`;
}

export function HistoricoLista() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [atalho, setAtalho] = useState<Atalho>("tudo");
  const [notas, setNotas] = useState<NotaRegisto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(true);

  const filtros: FiltrosApi = useMemo(() => ({ q: q.trim() || undefined, de: de || undefined, ate: ate || undefined }), [q, de, ate]);

  const carregar = useCallback(async (f: FiltrosApi) => {
    setACarregar(true);
    setErro(null);
    try {
      setNotas(await apiListar(f));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o histórico.");
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void carregar(filtros), 250);
    return () => window.clearTimeout(t);
  }, [filtros, carregar]);

  const aplicarAtalho = (a: Atalho) => {
    setAtalho(a);
    const { de: d, ate: t } = intervaloDoAtalho(a);
    setDe(d);
    setAte(t);
  };

  const total = useMemo(() => (notas ?? []).reduce((s, n) => s + (Number(n.total) || 0), 0), [notas]);

  const reutilizar = (n: NotaRegisto) => {
    reutilizarNota(
      { beneficiario: n.beneficiario, origem: n.origem, periodo: n.periodo, itens: n.itens, cidade: n.cidade, data: n.data },
      n.numero,
      hojeISO(),
    );
    router.push("/");
  };

  const atalhos: Array<[Atalho, string]> = [
    ["tudo", "Tudo"],
    ["hoje", "Hoje"],
    ["mes", `${MESES[new Date().getMonth()]}`],
    ["mesPassado", "Mês passado"],
    ["ano", `${new Date().getFullYear()}`],
  ];

  return (
    <div className="no-print">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>
          <p className="mt-1 text-sm text-tinta-suave">Todas as saídas de caixa registadas. Toque numa nota para ver ou reimprimir.</p>
        </div>
        <Link href="/" className="botao-primario">
          Nova nota
        </Link>
      </div>

      {/* Filtros */}
      <div className="rounded-3xl border border-linha bg-white p-4 shadow-suave sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
          <div className="relative">
            <label className="rotulo" htmlFor="pesquisa">
              Pesquisar
            </label>
            <IconePesquisar className="pointer-events-none absolute bottom-3 left-3.5 text-tinta-suave/70" />
            <input
              id="pesquisa"
              className="campo pl-10"
              placeholder="Beneficiário, origem, item, autor ou número"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="de">
              De
            </label>
            <input
              id="de"
              type="date"
              className="campo"
              value={de}
              max={ate || undefined}
              onChange={(e) => {
                setDe(e.target.value);
                setAtalho("tudo");
              }}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="ate">
              Até
            </label>
            <input
              id="ate"
              type="date"
              className="campo"
              value={ate}
              min={de || undefined}
              onChange={(e) => {
                setAte(e.target.value);
                setAtalho("tudo");
              }}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {atalhos.map(([a, rotulo]) => (
            <button
              key={a}
              onClick={() => aplicarAtalho(a)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                atalho === a && (a !== "tudo" || (!de && !ate))
                  ? "bg-laranja text-white shadow-suave"
                  : "bg-creme text-tinta-suave hover:bg-laranja-claro"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-tinta-suave">
        <span>
          {notas === null ? "…" : `${notas.length} ${notas.length === 1 ? "nota" : "notas"}`}
          {aCarregar && notas !== null && <span className="ml-2 text-xs">a atualizar…</span>}
        </span>
        {notas && notas.length > 0 && (
          <span>
            Total: <strong className="tabular-nums text-laranja-escuro">{formatarKz(total)} Kz</strong>
          </span>
        )}
      </div>

      {erro && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <IconeAviso className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Não foi possível carregar o histórico</p>
            <p className="text-xs">{erro}</p>
            <button className="botao-secundario mt-2 px-3 py-1.5 text-xs" onClick={() => void carregar(filtros)}>
              Tentar de novo
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="mt-3 overflow-hidden rounded-3xl border border-linha bg-white shadow-suave">
        {notas === null && !erro ? (
          <div className="space-y-3 p-5" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-creme-escuro" />
            ))}
          </div>
        ) : notas && notas.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-tinta-suave">
            {q || de || ate ? "Nenhuma nota corresponde aos filtros." : "Ainda não há notas registadas."}
          </p>
        ) : notas ? (
          <>
            {/* Tabela (computador) */}
            <table className="hidden w-full text-sm xl:table">
              <thead className="bg-creme text-left text-[11px] uppercase tracking-wide text-tinta-suave">
                <tr>
                  <th className="px-5 py-3 font-semibold">N.º</th>
                  <th className="px-3 py-3 font-semibold">Beneficiário</th>
                  <th className="px-3 py-3 font-semibold">Origem</th>
                  <th className="px-3 py-3 font-semibold">Itens</th>
                  <th className="px-3 py-3 font-semibold">Data</th>
                  <th className="px-3 py-3 font-semibold">Criada por</th>
                  <th className="px-3 py-3 text-right font-semibold">Total (Kz)</th>
                  <th className="w-24 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {notas.map((n) => (
                  <tr key={n.id} className="group transition hover:bg-laranja-claro/50">
                    <td className="px-5 py-3">
                      <Link href={`/notas/${n.id}`} className="font-bold tabular-nums text-laranja-escuro">
                        {n.numero}
                        <span className="font-normal text-tinta-suave">/{anoDaData(n.data)}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-medium">
                      <Link href={`/notas/${n.id}`} className="block">
                        {n.beneficiario || <span className="text-tinta-suave">Sem beneficiário</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-tinta-suave">{n.origem || "—"}</td>
                    <td className="max-w-[16rem] truncate px-3 py-3 text-tinta-suave" title={resumoItens(n)}>
                      {resumoItens(n) || "—"}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-tinta-suave">{dataCurta(n.data)}</td>
                    <td className="max-w-40 truncate px-3 py-3 text-tinta-suave" title={n.criadoPorNome ?? undefined}>
                      {n.criadoPorNome ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatarKz(Number(n.total) || 0)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <button
                        className="botao-fantasma px-2"
                        onClick={() => reutilizar(n)}
                        aria-label={`Reutilizar dados da nota ${n.numero}`}
                        title="Reutilizar numa nova nota"
                      >
                        <IconeCopiar />
                      </button>
                      <Link href={`/notas/${n.id}`} className="botao-fantasma px-2" aria-label={`Abrir nota ${n.numero}`}>
                        <IconeSeta />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cartões (telemóvel) */}
            <ul className="divide-y divide-linha xl:hidden">
              {notas.map((n) => (
                <li key={n.id}>
                  <Link href={`/notas/${n.id}`} className="flex items-center gap-3 px-4 py-3 transition active:bg-laranja-claro/60">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amarelo-claro text-sm font-bold tabular-nums text-laranja-escuro">
                      {n.numero}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{n.beneficiario || "Sem beneficiário"}</span>
                      <span className="block truncate text-xs text-tinta-suave">
                        {[n.origem, resumoItens(n)].filter(Boolean).join(" · ") || dataPorExtenso(n.data)}
                      </span>
                      <span className="block truncate text-[11px] tabular-nums text-tinta-suave/80">
                        {dataCurta(n.data)}
                        {n.criadoPorNome ? ` · por ${n.criadoPorNome}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-laranja-escuro">{formatarKz(Number(n.total) || 0)}</span>
                    <IconeSeta className="shrink-0 text-tinta-suave/60" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
