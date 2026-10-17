// Font registry. Preview and PDF use the very same TTF files, and text is measured
// from the font's own hmtx advances, which is exactly what jsPDF writes into the
// PDF /W array. SVG text disables kerning so on-screen widths match too.

import { ptToMm } from './utils.js';

export const FONT_FAMILIES = {
  sans:   { label: 'PT Sans',        hint: 'Гротеск',       css: 'Fusey PT Sans',        pdf: 'FuseyPTSans',        files: { normal: 'PTSans-Regular.ttf', bold: 'PTSans-Bold.ttf' } },
  narrow: { label: 'PT Sans Narrow', hint: 'Узкий',         css: 'Fusey PT Sans Narrow', pdf: 'FuseyPTSansNarrow',  files: { normal: 'PTSansNarrow-Regular.ttf', bold: 'PTSansNarrow-Bold.ttf' } },
  serif:  { label: 'PT Serif',       hint: 'С засечками',   css: 'Fusey PT Serif',       pdf: 'FuseyPTSerif',       files: { normal: 'PTSerif-Regular.ttf', bold: 'PTSerif-Bold.ttf' } },
  mono:   { label: 'PT Mono',        hint: 'Моноширинный',  css: 'Fusey PT Mono',        pdf: 'FuseyPTMono',        files: { normal: 'PTMono-Regular.ttf' } },
};

// Vertical metrics read from the fonts' OS/2 tables (units of em). Cap height is
// 0.70 em for the whole PT family, so text blocks are centred on cap height.
export const FONT_METRICS = {
  sans:   { ascent: 1.018, descent: 0.276, capHeight: 0.70 },
  narrow: { ascent: 1.018, descent: 0.276, capHeight: 0.70 },
  serif:  { ascent: 1.039, descent: 0.286, capHeight: 0.70 },
  mono:   { ascent: 0.885, descent: 0.235, capHeight: 0.70 },
};

/** Real face used for a requested family/weight. Mono has no bold, so it falls back. */
export function resolveFace(family, weight) {
  const fam = FONT_FAMILIES[family] ? family : 'sans';
  const w = FONT_FAMILIES[fam].files[weight] ? weight : 'normal';
  return { family: fam, weight: w, key: `${fam}-${w}`, file: FONT_FAMILIES[fam].files[w] };
}

export function supportsBold(family) {
  return Boolean(FONT_FAMILIES[family]?.files.bold);
}

/* ---------- Minimal TrueType parser: cmap (formats 4 and 12) + hmtx ---------- */

export function parseTTF(buffer) {
  const view = new DataView(buffer);
  const numTables = view.getUint16(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(view.getUint8(rec), view.getUint8(rec + 1), view.getUint8(rec + 2), view.getUint8(rec + 3));
    tables[tag] = { offset: view.getUint32(rec + 8), length: view.getUint32(rec + 12) };
  }
  for (const t of ['head', 'hhea', 'hmtx', 'cmap']) {
    if (!tables[t]) throw new Error(`TTF: нет таблицы ${t}`);
  }
  const unitsPerEm = view.getUint16(tables.head.offset + 18);
  const numHMetrics = view.getUint16(tables.hhea.offset + 34);
  const advances = new Uint16Array(numHMetrics);
  for (let i = 0; i < numHMetrics; i++) advances[i] = view.getUint16(tables.hmtx.offset + i * 4);

  const cmap = new Map();
  const cmapOff = tables.cmap.offset;
  const nSub = view.getUint16(cmapOff + 2);
  let best = null;
  for (let i = 0; i < nSub; i++) {
    const platform = view.getUint16(cmapOff + 4 + i * 8);
    const encoding = view.getUint16(cmapOff + 6 + i * 8);
    const off = cmapOff + view.getUint32(cmapOff + 8 + i * 8);
    const format = view.getUint16(off);
    const score = (platform === 3 && encoding === 10 && format === 12) ? 3
      : (platform === 3 && encoding === 1 && format === 4) ? 2
      : (platform === 0 && (format === 4 || format === 12)) ? 1 : 0;
    if (score && (!best || score > best.score)) best = { off, format, score };
  }
  if (!best) throw new Error('TTF: не найдена Unicode-таблица cmap');

  if (best.format === 4) {
    const o = best.off;
    const segX2 = view.getUint16(o + 6);
    const ends = o + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (let s = 0; s < segX2; s += 2) {
      const end = view.getUint16(ends + s);
      const start = view.getUint16(starts + s);
      const delta = view.getInt16(deltas + s);
      const rangeOffset = view.getUint16(ranges + s);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g;
        if (rangeOffset === 0) g = (c + delta) & 0xffff;
        else {
          const gi = view.getUint16(ranges + s + rangeOffset + (c - start) * 2);
          g = gi === 0 ? 0 : (gi + delta) & 0xffff;
        }
        if (g) cmap.set(c, g);
      }
    }
  } else {
    const o = best.off;
    const nGroups = view.getUint32(o + 12);
    for (let i = 0; i < nGroups; i++) {
      const g0 = o + 16 + i * 12;
      const start = view.getUint32(g0);
      const end = view.getUint32(g0 + 4);
      const gid = view.getUint32(g0 + 8);
      for (let c = start; c <= end; c++) cmap.set(c, gid + (c - start));
    }
  }

  const advanceOf = (gid) => advances[Math.min(gid, numHMetrics - 1)];
  return {
    unitsPerEm,
    has: (cp) => cmap.has(cp),
    /** Advance width of a code point in em units (missing glyphs use .notdef). */
    advance: (cp) => advanceOf(cmap.get(cp) ?? 0) / unitsPerEm,
  };
}

/* ---------- Registry ---------- */

export class FontRegistry {
  /**
   * @param {(file: string) => Promise<ArrayBuffer>} fetchBuffer
   * @param {(face, buffer) => Promise<void>} [registerFace] browser hook (FontFace API)
   */
  constructor(fetchBuffer, registerFace) {
    this.fetchBuffer = fetchBuffer;
    this.registerFace = registerFace;
    this.faces = new Map();
    this.pending = new Map();
    this.listeners = new Set();
  }

  onLoad(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  isLoaded(family, weight) { return this.faces.has(resolveFace(family, weight).key); }

  load(family, weight) {
    const face = resolveFace(family, weight);
    if (this.faces.has(face.key)) return Promise.resolve(this.faces.get(face.key));
    if (this.pending.has(face.key)) return this.pending.get(face.key);
    const p = this.fetchBuffer(face.file)
      .then(async (buffer) => {
        const parsed = parseTTF(buffer);
        if (this.registerFace) await this.registerFace(face, buffer);
        const entry = { ...face, buffer, parsed };
        this.faces.set(face.key, entry);
        this.pending.delete(face.key);
        this.listeners.forEach((fn) => fn(face));
        return entry;
      })
      .catch((err) => { this.pending.delete(face.key); throw err; });
    this.pending.set(face.key, p);
    return p;
  }

  /**
   * Synchronous accessor used by layout. If the face is not loaded yet it starts the
   * load and returns null; the caller then uses an estimate and re-lays out on load.
   */
  get(family, weight) {
    const face = resolveFace(family, weight);
    const entry = this.faces.get(face.key);
    if (!entry) this.load(family, weight).catch(() => {});
    return entry || null;
  }

  /** Width of a string in mm at sizePt. */
  measure(text, family, weight, sizePt) {
    const entry = this.get(family, weight);
    let em = 0;
    for (const ch of text) {
      em += entry ? entry.parsed.advance(ch.codePointAt(0)) : 0.55;
    }
    return em * ptToMm(sizePt);
  }

  /** Characters the face cannot render (they would print as empty boxes). */
  missingChars(text, family, weight) {
    const entry = this.get(family, weight);
    if (!entry) return [];
    const out = new Set();
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp > 31 && !entry.parsed.has(cp)) out.add(ch);
    }
    return [...out];
  }

  base64(family, weight) {
    const entry = this.faces.get(resolveFace(family, weight).key);
    if (!entry) throw new Error('Шрифт не загружен');
    const bytes = new Uint8Array(entry.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
}

/** Browser registry: fetches from assets/fonts and registers FontFace objects for SVG. */
export function createBrowserFontRegistry(base = 'assets/fonts/') {
  return new FontRegistry(
    (file) => fetch(base + file).then((r) => {
      if (!r.ok) throw new Error(`Не удалось загрузить шрифт ${file}`);
      return r.arrayBuffer();
    }),
    async (face, buffer) => {
      const fam = FONT_FAMILIES[face.family];
      const ff = new FontFace(fam.css, buffer.slice(0), { weight: face.weight === 'bold' ? '700' : '400', style: 'normal' });
      await ff.load();
      document.fonts.add(ff);
    },
  );
}
