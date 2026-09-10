import { gerarPdf } from "../src/lib/pdf";
import { kwanzasPorExtenso } from "../src/lib/extenso";
import fs from "fs";

async function main() {
  for (const v of [0, 1, 21, 100, 101, 116400, 42000, 1000, 1001, 1100, 2500.5, 1000000, 2340500, 100000])
    console.log(v, kwanzasPorExtenso(v));
  const bytes = await gerarPdf({
    numero: "18", nome: "Isaac", motivo: "Salário", periodo: "", remuneracao: 42000,
    taxaRemuneracao: "", desconto: 0, taxaDesconto: "", cidade: "Luanda", data: "2026-08-17",
  });
  const out = process.argv[2];
  fs.writeFileSync(out, bytes);
  console.log("pdf bytes", bytes.length, "->", out);
}
main().catch((e) => { console.error(e); process.exit(1); });
