import fs from "fs";
import { kwanzasPorExtenso } from "../src/lib/extenso";
import { gerarPdf } from "../src/lib/pdf";

async function main() {
  for (const v of [0, 1, 21, 100, 101, 116400, 42000, 1000, 1001, 1100, 2500.5, 1000000, 2340500, 100000])
    console.log(v, kwanzasPorExtenso(v));
  const bytes = await gerarPdf({
    numero: "36",
    beneficiario: "Isaac Gonçalves",
    origem: "Caixa",
    periodo: "Setembro de 2026",
    itens: [
      { descricao: "Cabo", qtd: "", valor: 2000 },
      { descricao: "Portagem", qtd: "3", valor: 9000 },
      { descricao: "Combustível", qtd: "", valor: 99000 },
    ],
    cidade: "Luanda",
    data: "2026-09-10",
  });
  const out = process.argv[2] || "out-teste.pdf";
  fs.writeFileSync(out, bytes);
  console.log("pdf bytes", bytes.length, "->", out);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
