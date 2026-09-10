import { partesData, type NotaEntrada } from "./nota";

type Resultado = { ok: true; valor: NotaEntrada } | { ok: false; erro: string };

function texto(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function numero(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) return null;
  return Math.round(n * 100) / 100;
}

/** Valida e normaliza o corpo recebido pela API. */
export function validarEntrada(body: unknown): Resultado {
  if (!body || typeof body !== "object") return { ok: false, erro: "Dados inválidos." };
  const b = body as Record<string, unknown>;

  const data = texto(b.data, 10);
  const p = partesData(data);
  if (!p) return { ok: false, erro: "Data inválida (use AAAA-MM-DD)." };
  const d = new Date(Date.UTC(p.ano, p.mes - 1, p.dia));
  if (d.getUTCMonth() !== p.mes - 1 || d.getUTCDate() !== p.dia) return { ok: false, erro: "Data inexistente." };

  const remuneracao = numero(b.remuneracao ?? 0);
  const desconto = numero(b.desconto ?? 0);
  if (remuneracao === null) return { ok: false, erro: "Remuneração inválida." };
  if (desconto === null) return { ok: false, erro: "Desconto inválido." };

  return {
    ok: true,
    valor: {
      nome: texto(b.nome),
      motivo: texto(b.motivo),
      periodo: texto(b.periodo),
      remuneracao,
      taxaRemuneracao: texto(b.taxaRemuneracao, 40),
      desconto,
      taxaDesconto: texto(b.taxaDesconto, 40),
      cidade: texto(b.cidade, 80) || "Luanda",
      data,
    },
  };
}
