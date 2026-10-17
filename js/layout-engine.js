// Sheet layout engine. Pure and deterministic: identical input -> identical output.
//
// Packing uses shelf (row) placement:
//   * "grid" (default, made for cutting with a ruler): copies are grouped into
//     bands of equal height (in order of first appearance), sorted by width inside
//     a band, and filled row by row. Every row has a single height, so each row
//     boundary is a straight cut across the whole sheet, and stickers of equal
//     width line up in columns whose vertical cuts run through several rows.
//   * "compact": First-Fit Decreasing Height. Copies are sorted by height, width,
//     then project order, and each goes into the first row (on any page) with room.
//   * "order": Next-Fit. Copies keep the project order, rows fill left to right.
//
// Coordinates are millimetres in sheet space: origin at the top-left corner of
// the page, y pointing down (same as SVG). The PDF writer converts as needed.

import { pageSize } from './model.js';
import { formatSize, round } from './utils.js';

const EPS = 1e-6;

export function printableArea(project) {
  const { width, height } = pageSize(project.page);
  const m = project.layout.margins;
  return { x: m.left, y: m.top, w: width - m.left - m.right, h: height - m.top - m.bottom, pageWidth: width, pageHeight: height };
}

function label(sticker) {
  const t = sticker.text.replace(/\s+/g, ' ').trim();
  return t ? `«${t.length > 28 ? t.slice(0, 27) + '…' : t}»` : 'Без текста';
}

/** Expands stickers into individual copies with the orientation they will use. */
function expandCopies(project, area, errors) {
  const { allowRotate } = project.layout;
  const copies = [];
  project.stickers.forEach((s, order) => {
    const fitsNormal = s.width <= area.w + EPS && s.height <= area.h + EPS;
    const fitsRotated = s.height <= area.w + EPS && s.width <= area.h + EPS;
    let rotated;
    if (allowRotate && fitsRotated && (!fitsNormal || s.height > s.width)) rotated = true; // lay tall stickers flat
    else if (fitsNormal) rotated = false;
    else {
      errors.push({
        code: 'tooLarge',
        stickerId: s.id,
        message: `${label(s)} ${formatSize(s.width, s.height)} не помещается в рабочую область листа ${formatSize(Math.max(area.w, 0), Math.max(area.h, 0))}.`,
        hint: !allowRotate && fitsRotated
          ? 'Разрешите поворот наклеек, уменьшите размер наклейки или поля, либо выберите больший формат листа.'
          : 'Уменьшите размер наклейки или поля листа, либо выберите больший формат листа или альбомную ориентацию.',
      });
      return;
    }
    const w = rotated ? s.height : s.width;
    const h = rotated ? s.width : s.height;
    for (let c = 0; c < s.quantity; c++) copies.push({ stickerId: s.id, copy: c, order, w, h, rotated, sw: s.width, sh: s.height });
  });
  return copies;
}

function pack(copies, area, layout) {
  const { gapX, gapY, strategy } = layout;
  const pages = [];
  const newPage = () => { const p = { shelves: [], bottom: 0, items: [] }; pages.push(p); return p; };

  const sameHeight = strategy === 'grid';
  const tryShelf = (shelf, it) => {
    const x = shelf.items.length ? shelf.cursor + gapX : 0;
    if (sameHeight && Math.abs(it.h - shelf.h) > EPS) return false;
    if (x + it.w <= area.w + EPS && it.h <= shelf.h + EPS) {
      shelf.items.push({ ...it, rx: x });
      shelf.cursor = x + it.w;
      return true;
    }
    return false;
  };
  const openShelf = (page, it) => {
    const y = page.shelves.length ? page.bottom + gapY : 0;
    if (y + it.h > area.h + EPS) return false;
    const shelf = { y, h: it.h, cursor: it.w, items: [{ ...it, rx: 0 }] };
    page.shelves.push(shelf);
    page.bottom = y + it.h;
    return true;
  };

  let sequence = copies;
  if (strategy === 'grid') {
    // Bands of equal height in order of first appearance; widest first inside a band.
    const bands = new Map();
    for (const it of copies) {
      const k = Math.round(it.h * 1000);
      if (!bands.has(k)) bands.set(k, []);
      bands.get(k).push(it);
    }
    sequence = [...bands.values()].flatMap((b) => b.sort((a, c) => (c.w - a.w) || (a.order - c.order) || (a.copy - c.copy)));
  }

  if (strategy === 'order' || strategy === 'grid') {
    for (const it of sequence) {
      let page = pages[pages.length - 1] || newPage();
      const shelf = page.shelves[page.shelves.length - 1];
      if (shelf && tryShelf(shelf, it)) continue;
      if (openShelf(page, it)) continue;
      page = newPage();
      openShelf(page, it);
    }
  } else {
    const sorted = [...copies].sort((a, b) => (b.h - a.h) || (b.w - a.w) || (a.order - b.order) || (a.copy - b.copy));
    for (const it of sorted) {
      let placed = false;
      for (const page of pages) {
        for (const shelf of page.shelves) if (tryShelf(shelf, it)) { placed = true; break; }
        if (placed) break;
      }
      if (placed) continue;
      for (const page of pages) if (openShelf(page, it)) { placed = true; break; }
      if (placed) continue;
      openShelf(newPage(), it);
    }
  }
  return pages;
}

/**
 * Collinear edge segments are merged so shared borders between touching
 * stickers are drawn once (no double-thickness lines on common edges).
 */
export function cutSegments(rects, { tolX = 0, tolY = 0 } = {}) {
  const key = (v) => Math.round(v * 1e4);
  const hor = new Map(), ver = new Map();
  const add = (map, k, coord, a, b) => {
    if (!map.has(k)) map.set(k, { coord, spans: [] });
    map.get(k).spans.push([Math.min(a, b), Math.max(a, b)]);
  };
  for (const r of rects) {
    add(hor, key(r.y), r.y, r.x, r.x + r.w);
    add(hor, key(r.y + r.h), r.y + r.h, r.x, r.x + r.w);
    add(ver, key(r.x), r.x, r.y, r.y + r.h);
    add(ver, key(r.x + r.w), r.x + r.w, r.y, r.y + r.h);
  }
  // `tol` bridges empty gaps between collinear segments (e.g. the gap between two
  // rows), so a single ruler stroke follows the cut through several rows.
  const merge = (spans, tol) => {
    spans.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const out = [];
    for (const s of spans) {
      const last = out[out.length - 1];
      if (last && s[0] <= last[1] + tol + 1e-4) last[1] = Math.max(last[1], s[1]);
      else out.push([...s]);
    }
    return out;
  };
  const segs = [];
  [...hor.keys()].sort((a, b) => a - b).forEach((k) => {
    const { coord, spans } = hor.get(k);
    for (const [a, b] of merge(spans, tolX)) segs.push({ x1: a, y1: coord, x2: b, y2: coord });
  });
  [...ver.keys()].sort((a, b) => a - b).forEach((k) => {
    const { coord, spans } = ver.get(k);
    for (const [a, b] of merge(spans, tolY)) segs.push({ x1: coord, y1: a, x2: coord, y2: b });
  });
  return segs;
}

/**
 * Extends cut lines to the sheet edges where that cannot cut through a sticker:
 *   - horizontal lines lying on a row boundary run across the full sheet width
 *     (nothing crosses a row boundary, so a full-width cut is always safe);
 *   - vertical lines touching the top or bottom of the whole block run out to the
 *     top or bottom edge, giving visible marks in the margins for the ruler.
 */
function extendCuts(cuts, rects, rows, o, area) {
  if (!rects.length) return cuts;
  const near = (a, b) => Math.abs(a - b) < 1e-4;
  const top = Math.min(...rects.map((r) => r.y));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  const rowEdges = rows.flatMap((r) => [r.y - o, r.y + r.h + o]);
  const out = cuts.map((c) => {
    if (c.y1 === c.y2) {
      return rowEdges.some((y) => near(y, c.y1)) ? { ...c, x1: 0, x2: area.pageWidth } : c;
    }
    return { ...c, y1: near(c.y1, top) ? 0 : c.y1, y2: near(c.y2, bottom) ? area.pageHeight : c.y2 };
  });
  // Full-width horizontals can now coincide; keep one per y.
  const seen = new Set();
  return out.filter((c) => {
    if (c.y1 !== c.y2 || c.x1 !== 0) return true;
    const k = Math.round(c.y1 * 1e4);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function computeLayout(project) {
  const area = printableArea(project);
  const errors = [];
  const warnings = [];
  const { layout, cutLines } = project;

  if (area.w <= 0 || area.h <= 0) {
    errors.push({ code: 'noArea', message: 'Поля листа больше самого листа: рабочая область отсутствует.', hint: 'Уменьшите поля или выберите больший формат.' });
    return { area, pages: [], errors, warnings, stats: emptyStats(project) };
  }

  const copies = expandCopies(project, area, errors);
  const packed = pack(copies, area, layout);

  const pages = packed.map((p, index) => {
    let items = [];
    const rows = p.shelves.map((sh) => ({ y: sh.y, h: sh.h }));
    for (const shelf of p.shelves) {
      for (const it of shelf.items) {
        const dy = layout.rowAlign === 'center' ? (shelf.h - it.h) / 2 : layout.rowAlign === 'bottom' ? shelf.h - it.h : 0;
        items.push({ ...it, x: it.rx, y: shelf.y + dy });
      }
    }
    // Bounding box of the group in area coordinates (used for centring).
    const bw = Math.max(...items.map((i) => i.x + i.w));
    const bh = Math.max(...items.map((i) => i.y + i.h));
    const ox = area.x + (layout.center ? (area.w - bw) / 2 : 0);
    const oy = area.y + (layout.center ? (area.h - bh) / 2 : 0);
    items = items.map(({ rx, ...i }) => ({ ...i, x: round(i.x + ox, 6), y: round(i.y + oy, 6) }));
    // Stable drawing order: reading order on the sheet.
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    const o = cutLines.offset;
    const rects = items.map((i) => ({ x: i.x - o, y: i.y - o, w: i.w + 2 * o, h: i.h + 2 * o }));
    // Vertical cuts may bridge the gap between rows only when every row has one height
    // (grid mode); otherwise a bridged line could cross a shorter neighbour's free space.
    let cuts = cutSegments(rects, { tolY: layout.strategy === 'grid' ? Math.max(0, layout.gapY - 2 * o) : 0 });
    if (cutLines.extend) cuts = extendCuts(cuts, rects, rows.map((r) => ({ y: r.y + oy, h: r.h })), o, area);
    return { index, items, cuts, bbox: { x: ox, y: oy, w: bw, h: bh } };
  });

  // Cut-line offset sanity checks.
  if (cutLines.enabled && cutLines.offset > 0) {
    const o = cutLines.offset;
    const multi = pages.some((p) => p.items.length > 1);
    if (multi && (layout.gapX < 2 * o - EPS || layout.gapY < 2 * o - EPS)) {
      warnings.push({ code: 'cutOverlap', message: `Отступ линии реза ${String(o).replace('.', ',')} мм требует промежутков между наклейками не меньше ${String(round(2 * o, 3)).replace('.', ',')} мм, иначе контуры соседних наклеек пересекаются.` });
    }
    const outside = pages.some((p) => p.items.some((i) => i.x - o < -EPS || i.y - o < -EPS || i.x + i.w + o > area.pageWidth + EPS || i.y + i.h + o > area.pageHeight + EPS));
    if (outside) warnings.push({ code: 'cutOutside', message: 'Линия реза с заданным отступом выходит за край листа. Увеличьте поля или уменьшите отступ.' });
  }
  const m = layout.margins;
  if (Math.min(m.top, m.right, m.bottom, m.left) < 3) {
    warnings.push({ code: 'printerMargin', message: 'Поле меньше 3 мм: многие принтеры не печатают у самого края листа.' });
  }

  const placed = pages.reduce((n, p) => n + p.items.length, 0);
  const usedArea = pages.reduce((s, p) => s + p.items.reduce((a, i) => a + i.w * i.h, 0), 0);
  const capacity = pages.length * area.w * area.h;
  return {
    area,
    pages,
    errors,
    warnings,
    stats: {
      requested: project.stickers.reduce((n, s) => n + s.quantity, 0),
      placed,
      pageCount: pages.length,
      usedArea,
      usage: capacity ? usedArea / capacity : 0,
      pageWidth: area.pageWidth,
      pageHeight: area.pageHeight,
    },
  };
}

function emptyStats(project) {
  const { width, height } = pageSize(project.page);
  return { requested: project.stickers.reduce((n, s) => n + s.quantity, 0), placed: 0, pageCount: 0, usedArea: 0, usage: 0, pageWidth: width, pageHeight: height };
}
