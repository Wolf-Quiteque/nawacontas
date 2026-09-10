import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { layoutNota, PAGE, type Measure } from "./layout";
import type { NotaData } from "./nota";

interface Fontes {
  regular: PDFFont;
  bold: PDFFont;
  suportados: Set<number>;
}

async function carregarFontes(doc: PDFDocument): Promise<Fontes> {
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const suportados = new Set<number>(regular.getCharacterSet());
  return { regular, bold, suportados };
}

/** Substitui caracteres fora do WinAnsi (emojis, etc.) para não rebentar a codificação. */
function limpar(texto: string, suportados: Set<number>): string {
  let out = "";
  for (const ch of texto.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    if (suportados.has(cp)) out += ch;
    else if (cp === 0x2011 || cp === 0x2010) out += "-";
    else if (cp === 0x2018 || cp === 0x2019) out += "'";
    else if (cp === 0x201c || cp === 0x201d) out += '"';
    else if (cp === 0x00a0) out += " ";
    else {
      const sem = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += sem && suportados.has(sem.codePointAt(0)!) ? sem : "?";
    }
  }
  return out;
}

function hex(cor: string) {
  const n = parseInt(cor.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

let measurePromise: Promise<Measure> | null = null;

/**
 * Medidor de texto baseado nas métricas da Helvetica (idênticas às da Arial),
 * partilhado com a pré-visualização para que as quebras de linha coincidam com o PDF.
 */
export function obterMedidor(): Promise<Measure> {
  if (!measurePromise) {
    measurePromise = (async () => {
      const doc = await PDFDocument.create();
      const f = await carregarFontes(doc);
      return (text, size, bold) =>
        (bold ? f.bold : f.regular).widthOfTextAtSize(limpar(text, f.suportados), size);
    })();
  }
  return measurePromise;
}

/** Gera o PDF da nota (bytes). */
export async function gerarPdf(nota: NotaData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f = await carregarFontes(doc);
  const measure: Measure = (text, size, bold) =>
    (bold ? f.bold : f.regular).widthOfTextAtSize(limpar(text, f.suportados), size);

  doc.setTitle(`Nota de Pagamento NawaBus N.º ${nota.numero}`);
  doc.setAuthor("NawaBus");
  doc.setProducer("NawaNotas");
  doc.setCreator("NawaNotas");
  doc.setLanguage("pt");

  const page = doc.addPage([PAGE.w, PAGE.h]);
  const H = PAGE.h;

  for (const prim of layoutNota(nota, measure)) {
    if (prim.kind === "rect") {
      page.drawRectangle({
        x: prim.x,
        y: H - prim.y - prim.h,
        width: prim.w,
        height: prim.h,
        color: hex(prim.fill),
      });
    } else if (prim.kind === "line") {
      page.drawLine({
        start: { x: prim.x1, y: H - prim.y1 },
        end: { x: prim.x2, y: H - prim.y2 },
        thickness: prim.width,
        color: hex(prim.color),
      });
    } else {
      const texto = limpar(prim.text, f.suportados);
      if (!texto) continue;
      const font = prim.bold ? f.bold : f.regular;
      const w = font.widthOfTextAtSize(texto, prim.size);
      const x = prim.align === "right" ? prim.x - w : prim.align === "center" ? prim.x - w / 2 : prim.x;
      page.drawText(texto, {
        x,
        y: H - prim.y,
        size: prim.size,
        font,
        color: hex(prim.color),
      });
    }
  }

  return doc.save();
}
