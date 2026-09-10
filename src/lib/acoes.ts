import { nomeFicheiro, type NotaData } from "./nota";
import { gerarPdf } from "./pdf";
import { ehAndroid, ehIOS, ehSafari } from "./pwa";

/** Indica se o dispositivo suporta partilhar ficheiros (share sheet do iOS/Android). */
export function suportaPartilha(): boolean {
  try {
    const f = new File(["x"], "x.pdf", { type: "application/pdf" });
    return typeof navigator.share === "function" && !!navigator.canShare?.({ files: [f] });
  } catch {
    return false;
  }
}

async function blobDoPdf(nota: NotaData): Promise<Blob> {
  const bytes = await gerarPdf(nota);
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export async function descarregarPdf(nota: NotaData): Promise<void> {
  const url = URL.createObjectURL(await blobDoPdf(nota));
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
    await navigator.share({ files: [ficheiro], title: `Nota de Saída de Caixa N.º ${nota.numero}` });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return false;
    throw e;
  }
}

export type ModoImpressao = "pdf" | "partilha" | "descarga" | "janela" | "html";

/**
 * Imprime a nota a partir do PDF gerado (página A4 exata, sem margens nem cabeçalhos do navegador).
 *
 * - Computador (Chrome/Edge/Firefox): PDF carregado num iframe escondido e enviado para a impressora.
 * - iPhone/iPad: o Safari não imprime bem HTML; abre-se a folha de partilha, onde existe "Imprimir" (AirPrint).
 * - Android: descarrega o PDF, que pode ser impresso a partir do visualizador.
 * - Safari de computador: abre o PDF num novo separador para imprimir com Cmd+P.
 */
export async function imprimirPdf(nota: NotaData): Promise<ModoImpressao> {
  if (ehIOS()) {
    if (suportaPartilha()) {
      await partilharPdf(nota);
      return "partilha";
    }
    window.print();
    return "html";
  }
  if (ehAndroid()) {
    if (suportaPartilha()) {
      await partilharPdf(nota);
      return "partilha";
    }
    await descarregarPdf(nota);
    return "descarga";
  }

  const blob = await blobDoPdf(nota);
  const url = URL.createObjectURL(blob);

  if (ehSafari()) {
    const w = window.open(url, "_blank");
    if (!w) {
      await descarregarPdf(nota);
      return "descarga";
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return "janela";
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
  iframe.src = url;

  await new Promise<void>((resolve) => {
    let feito = false;
    const concluir = () => {
      if (feito) return;
      feito = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print(); // no Chrome bloqueia até o diálogo fechar
      } catch {
        window.print();
      }
      resolve();
    };
    iframe.addEventListener("load", () => window.setTimeout(concluir, 150));
    window.setTimeout(concluir, 4000); // recurso caso o evento load não dispare
    document.body.appendChild(iframe);
  });

  // Mantém o iframe algum tempo para o diálogo de impressão terminar de ler o documento.
  window.setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 120_000);
  return "pdf";
}
