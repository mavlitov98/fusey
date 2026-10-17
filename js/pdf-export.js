// Client-side vector PDF generation with jsPDF.
//
// Coordinate system: the document unit is millimetres and jsPDF's user space has
// its origin at the top-left with y pointing down, exactly like our sheet model
// and the SVG preview. jsPDF flips y into PDF space (origin bottom-left) itself,
// so every coordinate below is passed through unchanged from the layout engine.
// Rotated stickers are transformed numerically (point by point), not via a
// graphics-state matrix, so the same math is shared by paths and text origins.

import { parsePath, rectD } from './path.js';
import { resolveFace, FONT_FAMILIES } from './fonts.js';
import { resolvePartColor } from './icons.js';
import { todayStamp } from './utils.js';

const LOCAL_JSPDF = 'js/vendor/jspdf.umd.min.js';
const CDN_JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';

export class PdfExportError extends Error {
  constructor(message, details = []) {
    super(message);
    this.details = details;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => { el.remove(); reject(new Error(`Не удалось загрузить ${src}`)); };
    document.head.appendChild(el);
  });
}

let jsPdfPromise = null;
/** Loads the bundled jsPDF, falling back to the CDN. Rejects if neither is reachable. */
export function loadJsPDF({ sources = [LOCAL_JSPDF, CDN_JSPDF] } = {}) {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jsPdfPromise) {
    jsPdfPromise = (async () => {
      for (const src of sources) {
        try {
          await loadScript(src);
          if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
        } catch { /* try next source */ }
      }
      throw new PdfExportError('Библиотека PDF недоступна. Проверьте подключение к сети или наличие файла js/vendor/jspdf.umd.min.js и повторите попытку.');
    })();
    jsPdfPromise.catch(() => { jsPdfPromise = null; });
  }
  return jsPdfPromise;
}

export function defaultFileName(date = new Date()) {
  return `fusey-stickers-${todayStamp(date)}.pdf`;
}

/** Point transform from sticker-local mm to sheet mm for a placed item. */
export function placementTransform(item) {
  if (!item.rotated) return (u, v) => [item.x + u, item.y + v];
  // 90° clockwise: local top-left lands on the item's top-right corner.
  return (u, v) => [item.x + item.sh - v, item.y + u];
}

function tracePath(doc, segs, T) {
  for (const s of segs) {
    if (s.op === 'M') doc.moveTo(...T(s.x, s.y));
    else if (s.op === 'L') doc.lineTo(...T(s.x, s.y));
    else if (s.op === 'C') doc.curveTo(...T(s.x1, s.y1), ...T(s.x2, s.y2), ...T(s.x, s.y));
    else if (s.op === 'Z') doc.close();
  }
}

function drawSticker(doc, item, L) {
  const T = placementTransform(item);
  doc.saveGraphicsState();
  // Clip to the sticker contour (same as the SVG clipPath in the preview).
  tracePath(doc, parsePath(rectD(0, 0, L.width, L.height)), T);
  doc.clip();
  doc.discardPath();

  for (const op of L.ops) {
    if (op.type === 'rect') {
      tracePath(doc, parsePath(rectD(op.x, op.y, op.w, op.h, op.r)), T);
      if (op.fill) { doc.setFillColor(op.fill); doc.fill(); }
      else { doc.setDrawColor(op.stroke); doc.setLineWidth(op.strokeWidth); doc.setLineJoin('miter'); doc.stroke(); }
    } else if (op.type === 'icon') {
      const k = op.size / 24;
      const IT = (px, py) => T(op.x + px * k, op.y + py * k);
      doc.setLineCap('round');
      doc.setLineJoin('round');
      doc.setLineWidth(op.stroke * k);
      for (const p of op.parts) {
        const col = resolvePartColor(p, op);
        if (!col) continue;
        tracePath(doc, p.segments, IT);
        if (p.fill) { doc.setFillColor(col); doc.fill(); }
        else { doc.setDrawColor(col); doc.stroke(); }
      }
    } else if (op.type === 'text') {
      doc.setFont(op.pdfFamily, op.weight === 'bold' ? 'bold' : 'normal');
      doc.setFontSize(op.sizePt);
      doc.setTextColor(op.color);
      for (const line of op.lines) {
        if (!line.text) continue;
        const [x, y] = T(line.x, line.baseline);
        doc.text(line.text, x, y, { baseline: 'alphabetic', angle: item.rotated ? -90 : 0 });
      }
    }
  }
  doc.restoreGraphicsState();
}

function drawCutLines(doc, cuts, settings) {
  doc.setDrawColor(settings.color);
  doc.setLineWidth(settings.width);
  doc.setLineCap('butt');
  if (settings.style === 'dashed') doc.setLineDashPattern([settings.dash, settings.dash * 0.75], 0);
  for (const s of cuts) doc.line(s.x1, s.y1, s.x2, s.y2, 'S');
  if (settings.style === 'dashed') doc.setLineDashPattern([], 0);
}

/**
 * Builds the PDF document. Environment-independent: jsPDF and the font registry
 * are injected, so the very same code runs in the browser and in Node tests.
 */
export async function buildPdf({ project, layout, getLayout, fonts, jsPDF, title = 'Fusey' }) {
  if (layout.errors.length) {
    throw new PdfExportError('Некоторые наклейки не помещаются на лист. Исправьте размеры, и экспорт станет доступен.', layout.errors);
  }
  if (!layout.pages.length) throw new PdfExportError('В проекте нет наклеек для экспорта.');

  const W = layout.area.pageWidth;
  const H = layout.area.pageHeight;
  const orientation = W > H ? 'landscape' : 'portrait';
  const byId = new Map(project.stickers.map((s) => [s.id, s]));

  // Embed only the faces that text operations actually use.
  const faces = new Map();
  for (const s of new Set(layout.pages.flatMap((p) => p.items.map((i) => byId.get(i.stickerId))))) {
    for (const op of getLayout(s).ops) {
      if (op.type !== 'text') continue;
      const face = resolveFace(op.family, op.weight);
      faces.set(face.key, face);
    }
  }
  await Promise.all([...faces.values()].map((f) => fonts.load(f.family, f.weight)));

  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation, compress: true, putOnlyUsedFonts: true });
  doc.setProperties({ title, creator: 'Fusey', subject: 'Наклейки для электрощита' });
  for (const f of faces.values()) {
    doc.addFileToVFS(f.file, fonts.base64(f.family, f.weight));
    doc.addFont(f.file, FONT_FAMILIES[f.family].pdf, f.weight === 'bold' ? 'bold' : 'normal');
  }

  layout.pages.forEach((page, i) => {
    if (i > 0) doc.addPage([W, H], orientation);
    for (const it of page.items) drawSticker(doc, it, getLayout(byId.get(it.stickerId)));
    if (project.cutLines.enabled) drawCutLines(doc, page.cuts, project.cutLines);
  });
  return doc;
}

export async function exportPdf(opts, fileName = defaultFileName()) {
  const jsPDF = await loadJsPDF();
  const doc = await buildPdf({ ...opts, jsPDF });
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { size: blob.size, pages: doc.getNumberOfPages() };
}
