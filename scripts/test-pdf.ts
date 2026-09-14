import fs from "fs";
import { kwanzasPorExtenso } from "../src/lib/extenso";
import { gerarPdf } from "../src/lib/pdf";

async function main() {
  for (const v of [0, 1, 21, 100, 101, 116400, 42000, 1000, 1001, 1100, 2500.5, 1000000, 2340500, 100000])
    console.log(v, kwanzasPorExtenso(v));
  const bytes = await gerarPdf({
    numero: "36",
    beneficiario: "Isaac Gonçalves",
    origem: "Numerário",
    periodo: "Setembro de 2026",
    itens: [
      { descricao: "Cabo", qtd: 2, preco: 3000 },
      { descricao: "Portagem", qtd: 3, preco: 3000 },
      { descricao: "Combustível gasóleo para a viatura LD-12-34-AB (viagem Luanda–Benguela)", qtd: 2.5, preco: 400 },
      { descricao: "Pintura viatura", qtd: 1, preco: 500000 },
    ],
    cidade: "Luanda",
    data: "2026-09-10",
    emitidoPor: "Márcio Quiteque",
  });
  const out = process.argv[2] || "out-teste.pdf";
  fs.writeFileSync(out, bytes);
  console.log("pdf bytes", bytes.length, "->", out);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
