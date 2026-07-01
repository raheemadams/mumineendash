// Client-side PDF text extraction. Statement PDFs from banks/payment apps are
// digitally generated (not scanned), so plain text extraction — no OCR — is
// enough to recover every line. This is the only module that touches pdfjs;
// everything downstream (the per-bank adapters) works on plain strings.
//
// pdfjs-dist requires a worker script. We point it at the package's own
// worker bundle via `new URL(..., import.meta.url)`, which Next.js's webpack
// build resolves and copies automatically — no manual asset wiring needed.

import type { PDFDocumentProxy, TextItem } from "pdfjs-dist/types/src/display/api";

let workerConfigured = false;

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }
  return pdfjs;
}

/**
 * Extract all text from a PDF, reconstructed into reading-order lines.
 * Text items are grouped by their vertical position (y) per page, then
 * ordered left-to-right (x) within each group — this recovers table rows
 * even though pdfjs returns text items in an arbitrary internal order.
 */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await loadPdfjs();
  const doc: PDFDocumentProxy = await pdfjs.getDocument({ data }).promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as TextItem[];

    // Group items into lines by rounded y-coordinate (baseline). A small
    // tolerance absorbs sub-pixel jitter between items on the same line.
    const lines = new Map<number, { x: number; str: string }[]>();
    for (const item of items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5] / 2) * 2; // 2px bucket
      const bucket = lines.get(y) ?? [];
      bucket.push({ x: item.transform[4], str: item.str });
      lines.set(y, bucket);
    }

    const orderedY = [...lines.keys()].sort((a, b) => b - a); // top to bottom
    const pageLines = orderedY.map((y) =>
      lines
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((it) => it.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    pageTexts.push(pageLines.filter(Boolean).join("\n"));
  }

  return pageTexts.join("\n");
}
