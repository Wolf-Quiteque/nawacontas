import { nomeFicheiro, type NotaData } from "./nota";
import { gerarPdf } from "./pdf";

/** Indica se o dispositivo suporta partilhar ficheiros (share sheet do iOS/Android). */
export function suportaPartilha(): boolean {
  try {
    const f = new File(["x"], "x.pdf", { type: "application/pdf" });
    return typeof navigator.share === "function" && !!navigator.canShare?.({ files: [f] });
  } catch {
    return false;
  }
}

export async function descarregarPdf(nota: NotaData): Promise<void> {
  const bytes = await gerarPdf(nota);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFicheiro(nota);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Devolve `false` se o utilizador cancelou a partilha. */
export async function partilharPdf(nota: NotaData): Promise<boolean> {
  const bytes = await gerarPdf(nota);
  const ficheiro = new File([bytes as BlobPart], nomeFicheiro(nota), { type: "application/pdf" });
  try {
    await navigator.share({ files: [ficheiro], title: `Nota de Pagamento N.º ${nota.numero}` });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return false;
    throw e;
  }
}
