"use client";

import Link from "next/link";
import { useState } from "react";
import { IconeAviso, IconeInstalar } from "./Icones";
import { InstalarModal } from "./InstalarModal";
import { Marca } from "./Shell";
import { digitosTelefone, formatarTelefone, normalizarTelefone } from "@/lib/telefone";

const SENHA_MIN = 6;

interface Props {
  modo: "entrar" | "registar";
  /** Página para onde ir depois de entrar. */
  destino: string;
}

export function FormularioAuth({ modo, destino }: Props) {
  const registar = modo === "registar";
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [instalar, setInstalar] = useState(false);

  const sufixo = destino !== "/" ? `?voltar=${encodeURIComponent(destino)}` : "";

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aEnviar) return;
    setErro(null);
    const tel = normalizarTelefone(telefone);
    if (registar && nome.trim().length < 2) return setErro("Indique o seu nome.");
    if (!tel) return setErro("Número de telefone inválido. Use os 9 dígitos do telemóvel (ex.: 932 876 178).");
    if (registar && senha.length < SENHA_MIN) return setErro(`A palavra-passe deve ter pelo menos ${SENHA_MIN} caracteres.`);
    if (!registar && !senha) return setErro("Indique a palavra-passe.");
    if (registar && senha !== confirmar) return setErro("As palavras-passe não coincidem.");

    setAEnviar(true);
    try {
      const res = await fetch(`/api/auth/${modo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registar ? { nome, telefone: tel, senha } : { telefone: tel, senha }),
      });
      const corpo = (await res.json().catch(() => null)) as { erro?: string } | null;
      if (!res.ok) {
        setErro(corpo?.erro ?? `Erro ${res.status}`);
        setAEnviar(false);
        return;
      }
      window.location.replace(destino);
    } catch {
      setErro("Sem ligação ao servidor. Verifique a internet e tente novamente.");
      setAEnviar(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex justify-center">
        <Marca href={registar ? `/registar${sufixo}` : `/entrar${sufixo}`} />
      </div>

      <div className="rounded-3xl border border-linha bg-white p-6 shadow-suave">
        <h1 className="text-xl font-bold tracking-tight">{registar ? "Criar conta" : "Entrar"}</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          {registar
            ? "Registe-se com o seu número de telefone. O seu nome fica associado às notas que registar."
            : "Use o seu número de telefone e a palavra-passe."}
        </p>

        <form className="mt-5 space-y-4" onSubmit={submeter} noValidate>
          {registar && (
            <div>
              <label className="rotulo" htmlFor="nome">
                Nome
              </label>
              <input
                id="nome"
                className="campo"
                autoComplete="name"
                autoCapitalize="words"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome e apelido"
              />
            </div>
          )}

          <div>
            <label className="rotulo" htmlFor="telefone">
              Número de telefone
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[16px] text-tinta-suave">+244</span>
              <input
                id="telefone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                className="campo pl-[3.75rem] tabular-nums tracking-wide"
                value={formatarTelefone(telefone)}
                onChange={(e) => setTelefone(digitosTelefone(e.target.value))}
                placeholder="932 876 178"
              />
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="senha">
              Palavra-passe
            </label>
            <div className="relative">
              <input
                id="senha"
                type={verSenha ? "text" : "password"}
                autoComplete={registar ? "new-password" : "current-password"}
                className="campo pr-20"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={registar ? `Mínimo ${SENHA_MIN} caracteres` : ""}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs font-semibold text-laranja-escuro hover:bg-laranja-claro"
                onClick={() => setVerSenha((v) => !v)}
                aria-pressed={verSenha}
              >
                {verSenha ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {registar && (
            <div>
              <label className="rotulo" htmlFor="confirmar">
                Confirmar palavra-passe
              </label>
              <input
                id="confirmar"
                type={verSenha ? "text" : "password"}
                autoComplete="new-password"
                className="campo"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            </div>
          )}

          {erro && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <IconeAviso className="mt-0.5 shrink-0" />
              {erro}
            </p>
          )}

          <button type="submit" className="botao-primario w-full" disabled={aEnviar}>
            {aEnviar ? (registar ? "A criar conta…" : "A entrar…") : registar ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-tinta-suave">
          {registar ? "Já tem conta? " : "Ainda não tem conta? "}
          <Link href={registar ? `/entrar${sufixo}` : `/registar${sufixo}`} className="font-semibold text-laranja-escuro hover:underline">
            {registar ? "Entrar" : "Criar conta"}
          </Link>
        </p>
      </div>

      <div className="mt-4 flex justify-center">
        <button className="botao-fantasma text-xs" onClick={() => setInstalar(true)}>
          <IconeInstalar />
          Instalar app
        </button>
      </div>
      <InstalarModal aberto={instalar} onFechar={() => setInstalar(false)} />
    </div>
  );
}
