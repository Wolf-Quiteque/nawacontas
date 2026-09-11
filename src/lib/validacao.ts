import { type ItemSaida, MAX_ITENS, type NotaEntrada, partesData } from "./nota";

type Resultado = { ok: true; valor: NotaEntrada } | { ok: false; erro: string };

function texto(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function numero(v: unknown, max = 1e12): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return n;
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

  if (!Array.isArray(b.itens)) return { ok: false, erro: "Lista de itens inválida." };
  const itens: ItemSaida[] = [];
  for (const raw of b.itens) {
    if (!raw || typeof raw !== "object") continue;
    const i = raw as Record<string, unknown>;
    const descricao = texto(i.descricao, 120);
    const nome = descricao || "sem descrição";
    const precoBruto = numero(i.preco ?? i.valor ?? 0);
    if (precoBruto === null) return { ok: false, erro: `Preço inválido no item "${nome}".` };
    const preco = Math.round(precoBruto * 100) / 100;
    if (!descricao && !preco) continue; // linha vazia
    const qtdBruta = i.qtd === undefined || i.qtd === "" ? 1 : numero(i.qtd, 1e6);
    if (qtdBruta === null || qtdBruta <= 0) return { ok: false, erro: `Quantidade inválida no item "${nome}".` };
    itens.push({ descricao, qtd: Math.round(qtdBruta * 1000) / 1000, preco });
  }
  if (itens.length === 0) return { ok: false, erro: "Adicione pelo menos um item com descrição e preço." };
  if (itens.length > MAX_ITENS) return { ok: false, erro: `Máximo de ${MAX_ITENS} itens por nota.` };

  return {
    ok: true,
    valor: {
      beneficiario: texto(b.beneficiario),
      origem: texto(b.origem, 80),
      periodo: texto(b.periodo),
      itens,
      cidade: texto(b.cidade, 80) || "Luanda",
      data,
    },
  };
}
