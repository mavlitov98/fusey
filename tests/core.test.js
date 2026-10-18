import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMm, fromMm, parseNumber, formatLength, ptToMm } from '../js/utils.js';
import { parsePath, rectD } from '../js/path.js';
import { ICONS } from '../js/icons.js';
import { createProject, createSticker, pageSize, normalizeProject, demoProject } from '../js/model.js';
import { BUILTIN_TEMPLATES, findTemplate, CATEGORIES } from '../js/templates.js';
import { computeLayout, cutSegments, orderCopies, effectiveCopyOrder, copyKey } from '../js/layout-engine.js';
import { layoutSticker, wrapText } from '../js/sticker-layout.js';
import { nodeFonts } from './helpers.js';
import { buildPreviewSvgs, WATERMARK_TEXT } from '../js/preview-export.js';

const fontsP = nodeFonts();

test('unit conversion keeps physical size', () => {
  assert.equal(toMm(4, 'cm'), 40);
  assert.equal(fromMm(40, 'cm'), 4);
  assert.equal(toMm(fromMm(37.5, 'cm'), 'cm'), 37.5);
  assert.ok(Math.abs(ptToMm(72) - 25.4) < 1e-9);
  assert.equal(parseNumber('12,5'), 12.5);
  assert.ok(Number.isNaN(parseNumber('12a')));
  assert.ok(Number.isNaN(parseNumber('')));
  assert.equal(formatLength(15, 'cm'), '1,5 см');
});

test('page formats and orientation', () => {
  const p = createProject();
  assert.deepEqual(pageSize(p.page), { width: 210, height: 297 });
  assert.deepEqual(pageSize({ ...p.page, orientation: 'landscape' }), { width: 297, height: 210 });
  assert.deepEqual(pageSize({ ...p.page, format: 'A3' }), { width: 297, height: 420 });
  assert.deepEqual(pageSize({ ...p.page, format: 'A5' }), { width: 148, height: 210 });
  assert.deepEqual(pageSize({ ...p.page, format: 'Letter' }), { width: 215.9, height: 279.4 });
  assert.deepEqual(pageSize({ format: 'Custom', orientation: 'landscape', customWidth: 100, customHeight: 150 }), { width: 150, height: 100 });
});

test('path parser normalizes all commands to M/L/C/Z', () => {
  const segs = parsePath('M1 1h4v4H1zm10 0l2 2q1 1 2 0t2 0 a3 3 0 0 1 3 3 c1 1 2 2 3 3s1 1 2 2');
  assert.ok(segs.every((s) => ['M', 'L', 'C', 'Z'].includes(s.op)));
  const last = segs[segs.length - 1];
  assert.ok(Math.abs(last.x - 25) < 1e-9 && Math.abs(last.y - 11) < 1e-9, `got ${last.x},${last.y}`);
  for (const icon of ICONS.values()) {
    for (const p of icon.parts) assert.ok(p.segments.length > 0, icon.id);
  }
  assert.ok(ICONS.size >= 40);
  assert.ok(parsePath(rectD(0, 0, 10, 5, 1)).length > 4);
});

test('font parser reads Cyrillic advance widths', async () => {
  const fonts = await fontsP;
  const w = fonts.measure('ОСВЕЩЕНИЕ', 'sans', 'bold', 10);
  assert.ok(w > 15 && w < 30, `width ${w}`);
  assert.ok(fonts.measure('ОСВЕЩЕНИЕ', 'narrow', 'bold', 10) < w, 'narrow is narrower');
  assert.deepEqual(fonts.missingChars('Привет, мир! 220 В', 'sans', 'normal'), []);
  assert.ok(fonts.missingChars('漢', 'sans', 'normal').length === 1);
});

test('templates cover all categories', () => {
  for (const c of CATEGORIES) {
    assert.ok(BUILTIN_TEMPLATES.some((t) => t.category === c.id), c.id);
  }
  for (const t of BUILTIN_TEMPLATES) if (t.icon.id) assert.ok(ICONS.has(t.icon.id), `${t.id}: ${t.icon.id}`);
  assert.equal(new Set(BUILTIN_TEMPLATES.map((t) => t.id)).size, BUILTIN_TEMPLATES.length, 'template ids are unique');
});

test('every built-in template fits its sticker without overflow or warnings', async () => {
  const fonts = await nodeFonts();
  for (const t of BUILTIN_TEMPLATES) {
    const L = layoutSticker(createSticker(t), fonts);
    assert.ok(!L.overflow && !L.warnings.length, `${t.id}: ${L.warnings.map((w) => w.code).join(', ')}`);
    assert.ok(L.fitSizePt >= 6, `${t.id}: title shrinks to ${L.fitSizePt.toFixed(1)} pt`);
  }
});

test('word wrap breaks long words and keeps explicit newlines', () => {
  const measure = (s) => s.length;
  assert.deepEqual(wrapText('AB CD EF', 5, measure), ['AB CD', 'EF']);
  assert.deepEqual(wrapText('АБВГДЕЖ', 3, measure), ['АБ-', 'ВГ-', 'ДЕЖ'], 'hard split when nothing else fits');
  assert.deepEqual(wrapText('КОНДИЦИОНЕР', 7, measure), ['КОНДИ-', 'ЦИОНЕР'], 'syllable break');
  assert.equal(wrapText('КОНДИЦИОНЕР', 4, measure, 2), null, 'piece limit');
  assert.deepEqual(wrapText('ABCDEFG', 3, measure, 1), ['ABCDEFG'], 'no breaking when disabled');
  assert.deepEqual(wrapText('ПОЛОТЕНЦЕ-СУШИТЕЛЬ', 10, measure), ['ПОЛОТЕНЦЕ-', 'СУШИТЕЛЬ'], 'breaks after an existing hyphen');
  assert.deepEqual(wrapText('A\nB', 10, measure), ['A', 'B']);
});

test('sticker layout fits text inside the sticker', async () => {
  const fonts = await fontsP;
  for (const t of BUILTIN_TEMPLATES) {
    const s = createSticker(t);
    const L = layoutSticker(s, fonts);
    const text = L.ops.find((o) => o.type === 'text');
    if (!text) continue;
    for (const line of text.lines) {
      assert.ok(line.x >= -1e-6 && line.x + line.width <= s.width + 1e-6, `${t.id} line inside horizontally`);
      assert.ok(line.baseline > 0 && line.baseline < s.height, `${t.id} baseline inside`);
    }
    assert.equal(L.overflow, false, `${t.id} should fit by default (size ${L.fitSizePt})`);
  }
});

test('long text shrinks, then reports overflow at the minimum size', async () => {
  const fonts = await fontsP;
  const s = createSticker(null, { text: 'ОЧЕНЬ ДЛИННАЯ НАДПИСЬ ДЛЯ НАКЛЕЙКИ', width: 40, height: 12 });
  s.style = { ...s.style, fontSize: 12 };
  const fit = layoutSticker(s, fonts);
  assert.ok(fit.fitSizePt < s.style.fontSize, `size ${fit.fitSizePt}`);
  assert.equal(fit.overflow, false);
  const tiny = createSticker(null, { text: 'ОЧЕНЬ ДЛИННАЯ НАДПИСЬ ДЛЯ МАЛЕНЬКОЙ НАКЛЕЙКИ ЕЩЁ ДЛИННЕЕ', width: 20, height: 8 });
  const r = layoutSticker(tiny, fonts);
  assert.equal(r.overflow, true);
  assert.ok(r.warnings.some((w) => w.code === 'overflow'));
  const fixed = createSticker(null, { text: 'ОДНО ДВА ТРИ ЧЕТЫРЕ ПЯТЬ', width: 20, height: 8 });
  fixed.style = { ...fixed.style, fit: 'wrap', fontSize: 14 };
  assert.equal(layoutSticker(fixed, fonts).fitSizePt, 14, 'wrap mode never changes the font size');
});

function projectWith(stickers, layout = {}, page = {}) {
  const p = createProject();
  p.stickers = stickers;
  p.layout = { ...p.layout, center: false, ...layout };
  p.page = { ...p.page, ...page };
  return p;
}

test('grid packing places exact positions on A4', () => {
  const p = projectWith([createSticker(null, { width: 40, height: 15, quantity: 4 })], { gapX: 2, gapY: 3 });
  const L = computeLayout(p);
  assert.equal(L.pages.length, 1);
  const xs = L.pages[0].items.map((i) => i.x);
  assert.deepEqual(xs, [10, 52, 94, 136]);
  assert.ok(L.pages[0].items.every((i) => i.y === 10 && i.w === 40 && i.h === 15));
});

test('multiple pages are created when the sheet is full', () => {
  // 190 x 277 area; 40x15 + 0 gap -> 4 per row, 18 rows -> 72 per page.
  const p = projectWith([createSticker(null, { width: 40, height: 15, quantity: 150 })]);
  const L = computeLayout(p);
  assert.equal(L.pages[0].items.length, 72);
  assert.equal(L.pages.length, 3);
  assert.equal(L.stats.placed, 150);
  for (const page of L.pages) {
    for (const i of page.items) {
      assert.ok(i.x >= 10 - 1e-9 && i.y >= 10 - 1e-9 && i.x + i.w <= 200 + 1e-9 && i.y + i.h <= 287 + 1e-9, 'inside printable area');
    }
    // No overlaps.
    for (let a = 0; a < page.items.length; a++) for (let b = a + 1; b < page.items.length; b++) {
      const A = page.items[a], B = page.items[b];
      const overlap = A.x < B.x + B.w - 1e-9 && B.x < A.x + A.w - 1e-9 && A.y < B.y + B.h - 1e-9 && B.y < A.y + A.h - 1e-9;
      assert.ok(!overlap, 'items overlap');
    }
  }
});

test('layout is deterministic', () => {
  const p = demoProject();
  assert.deepEqual(JSON.stringify(computeLayout(p)), JSON.stringify(computeLayout(p)));
});

test('oversized sticker produces an error and is not placed', () => {
  const p = projectWith([createSticker(null, { width: 250, height: 40 }), createSticker(null, { width: 40, height: 15 })]);
  const L = computeLayout(p);
  assert.equal(L.errors.length, 1);
  assert.equal(L.errors[0].code, 'tooLarge');
  assert.match(L.errors[0].message, /250 × 40 мм/);
  assert.match(L.errors[0].message, /190 × 277 мм/);
  assert.equal(L.stats.placed, 1);
  // Rotation solves 250x40 on landscape? No: 250 > 277? Fits rotated in portrait (40 x 250).
  const R = computeLayout(projectWith([createSticker(null, { width: 250, height: 40 })], { allowRotate: true }));
  assert.equal(R.errors.length, 0);
  assert.equal(R.pages[0].items[0].rotated, true);
  assert.equal(R.pages[0].items[0].w, 40);
});

test('orientation change keeps sticker sizes', () => {
  const s = createSticker(null, { width: 60, height: 25, quantity: 5 });
  const a = computeLayout(projectWith([s]));
  const b = computeLayout(projectWith([s], {}, { orientation: 'landscape' }));
  assert.equal(b.area.pageWidth, 297);
  assert.ok([...a.pages[0].items, ...b.pages[0].items].every((i) => i.w === 60 && i.h === 25));
});

test('cut segments merge shared edges', () => {
  const segs = cutSegments([{ x: 0, y: 0, w: 10, h: 5 }, { x: 10, y: 0, w: 10, h: 5 }]);
  // 2 long horizontals + 3 verticals instead of 8 edges.
  assert.equal(segs.length, 5);
  assert.ok(segs.some((s) => s.y1 === 0 && s.x1 === 0 && s.x2 === 20));
  const gap = cutSegments([{ x: 0, y: 0, w: 10, h: 5 }, { x: 12, y: 0, w: 10, h: 5 }]);
  assert.equal(gap.length, 8);
});

test('cut offset warnings', () => {
  const p = projectWith([createSticker(null, { quantity: 3 })], { gapX: 1, gapY: 1 });
  p.cutLines = { ...p.cutLines, offset: 1 };
  assert.ok(computeLayout(p).warnings.some((w) => w.code === 'cutOverlap'));
  p.layout = { ...p.layout, gapX: 2, gapY: 2 };
  assert.ok(!computeLayout(p).warnings.some((w) => w.code === 'cutOverlap'));
});

test('centering moves the group to the middle of the printable area', () => {
  const L = computeLayout(projectWith([createSticker(null, { width: 50, height: 20 })], { center: true }));
  const it = L.pages[0].items[0];
  assert.ok(Math.abs(it.x - 80) < 1e-6 && Math.abs(it.y - 138.5) < 1e-6);
});

test('project normalization rejects foreign data and repairs values', () => {
  assert.throws(() => normalizeProject({ foo: 1 }), /не файл проекта/);
  assert.throws(() => normalizeProject(null));
  const raw = JSON.parse(JSON.stringify(demoProject()));
  raw.stickers[0].width = -5;
  raw.stickers[1].quantity = 99999;
  raw.layout.gapX = 'abc';
  const { project, warnings } = normalizeProject(raw);
  assert.equal(project.stickers.length, raw.stickers.length - 1);
  assert.equal(warnings.length, 1);
  assert.equal(project.stickers[0].quantity, 999);
  assert.equal(project.layout.gapX, 0);
});

test('DIN sticker: title, inscriptions, divider and badge fit in one module', async () => {
  const fonts = await fontsP;
  const s = createSticker(findTemplate('t_sock_rooms'));
  assert.equal(s.width, 17.5);
  const L = layoutSticker(s, fonts);
  assert.equal(L.overflow, false);
  const texts = L.ops.filter((o) => o.type === 'text').map((o) => o.lines.map((l) => l.text).join('|'));
  assert.deepEqual(texts, ['C16', 'РОЗЕТКИ', 'Спальня|Гостевая|Коридор']);
  const rects = L.ops.filter((o) => o.type === 'rect');
  assert.ok(rects.some((r) => r.fill === s.style.accentColor), 'accent divider');
  assert.ok(rects.some((r) => r.fill === s.style.badgeBg), 'badge');
  const badge = rects.find((r) => r.fill === s.style.badgeBg);
  const sub = L.ops.filter((o) => o.type === 'text')[2];
  assert.ok(sub.lines.every((l) => l.baseline < badge.y), 'inscriptions above the badge');
  // Border stays inside the inset margin.
  const border = rects.find((r) => r.stroke);
  assert.ok(border.x >= s.style.inset - 1e-9);
});

test('grid layout: equal-height rows, full-width horizontal cuts, columns cut through all rows', () => {
  const one = createSticker(null, { width: 17.5, height: 50, quantity: 25 });
  const two = createSticker(null, { width: 35, height: 50, quantity: 2 });
  const p = projectWith([one, two], { strategy: 'grid' });
  const L = computeLayout(p);
  const page = L.pages[0];
  // 190 mm usable -> 10 modules per row; the two 35 mm stickers come first in the band.
  const rowsY = [...new Set(page.items.map((i) => i.y))];
  assert.equal(rowsY.length, 3);
  assert.ok(page.items.every((i) => i.h === 50));
  const hor = page.cuts.filter((c) => c.y1 === c.y2);
  assert.ok(hor.every((c) => c.x1 === 0 && c.x2 === 210), 'horizontal cuts span the sheet');
  assert.equal(hor.length, 4, 'one line per row boundary, no duplicates');
  // Column boundary at x = 10 + 17.5*5 = 97.5 exists in rows 2 and 3 only; at 10 + 17.5*9 = 167.5 in all rows.
  const ver = page.cuts.filter((c) => c.x1 === c.x2);
  const through = ver.find((c) => Math.abs(c.x1 - 167.5) < 1e-6);
  assert.ok(through && through.y1 === 0 && through.y2 === 297, `through cut ${JSON.stringify(through)}`);
});

test('grid layout bridges row gaps so vertical cuts stay continuous', () => {
  const p = projectWith([createSticker(null, { width: 17.5, height: 50, quantity: 20 })], { strategy: 'grid', gapY: 4 });
  p.cutLines = { ...p.cutLines, extend: false };
  const ver = computeLayout(p).pages[0].cuts.filter((c) => c.x1 === c.x2);
  assert.equal(ver.length, 11, 'one continuous line per column boundary');
  assert.ok(ver.every((c) => Math.abs(c.y2 - c.y1 - 104) < 1e-6));
});

test('hyphenation never starts a line with a soft sign', () => {
  const measure = (s) => s.length;
  const lines = wrapText('МОРОЗИЛЬНИК', 7, measure);
  assert.ok(lines.every((l) => !/^[ЬЪЙ]/.test(l)), lines.join('|'));
  assert.deepEqual(wrapText('МОРОЗИЛЬНИК', 9, measure), ['МОРОЗИЛЬ-', 'НИК'], 'soft sign stays with its consonant');
});

test('no cut line ever crosses a sticker, in every strategy', () => {
  const stickers = BUILTIN_TEMPLATES.map((t, i) => createSticker(t, { quantity: 1 + (i % 3) }));
  for (const strategy of ['grid', 'compact', 'order']) {
    for (const gap of [0, 3]) {
      const L = computeLayout(projectWith(stickers, { strategy, gapX: gap, gapY: gap, center: true }));
      for (const page of L.pages) {
        for (const c of page.cuts) {
          for (const i of page.items) {
            const e = 1e-6;
            const crosses = c.x1 === c.x2
              ? c.x1 > i.x + e && c.x1 < i.x + i.w - e && c.y1 < i.y + i.h - e && c.y2 > i.y + e
              : c.y1 > i.y + e && c.y1 < i.y + i.h - e && c.x1 < i.x + i.w - e && c.x2 > i.x + e;
            assert.ok(!crosses, `${strategy} gap ${gap}: cut ${JSON.stringify(c)} crosses item at ${i.x},${i.y}`);
          }
        }
      }
    }
  }
});

test('manual copy order: any single copy can take any slot', () => {
  const a = createSticker(null, { id: 'a', width: 17.5, height: 50, quantity: 3 });
  const b = createSticker(null, { id: 'b', width: 17.5, height: 50, quantity: 2 });
  const p = createProject({ stickers: [a, b] });
  assert.deepEqual(effectiveCopyOrder(p), ['a:0', 'a:1', 'a:2', 'b:0', 'b:1']);
  const reading = (proj) => computeLayout(proj).pages.flatMap((pg) => pg.items.map(copyKey));
  // b:1 between a:0 and a:1; equal heights, so the default grid layout honours it.
  const manual = ['a:0', 'b:1', 'a:1', 'a:2', 'b:0'];
  for (const strategy of ['grid', 'order', 'compact']) {
    assert.deepEqual(reading({ ...p, layout: { ...p.layout, strategy, copyOrder: manual } }), manual, strategy);
  }
  // New copies follow the last copy of their sticker, unknown keys are ignored.
  const grown = { ...p, stickers: [a, { ...b, quantity: 3 }] };
  assert.deepEqual(effectiveCopyOrder({ ...grown, layout: { ...p.layout, copyOrder: [...manual, 'gone:0'] } }), ['a:0', 'b:1', 'a:1', 'a:2', 'b:0', 'b:2']);
  assert.deepEqual(orderCopies([{ stickerId: 'x', copy: 0 }], null), [{ stickerId: 'x', copy: 0 }]);
  // Survives a JSON round trip; garbage is dropped.
  const raw = JSON.parse(JSON.stringify({ ...p, layout: { ...p.layout, copyOrder: [...manual, 42, 'bad'] } }));
  assert.deepEqual(normalizeProject(raw).project.layout.copyOrder, manual);
});

test('manual order in grid keeps rows of one height', () => {
  const tall = createSticker(null, { id: 't', width: 17.5, height: 50, quantity: 2 });
  const short = createSticker(null, { id: 's', width: 40, height: 15, quantity: 1 });
  const p = createProject({ stickers: [tall, short] });
  const sheet = computeLayout({ ...p, layout: { ...p.layout, copyOrder: ['t:0', 's:0', 't:1'] } });
  const items = sheet.pages[0].items;
  const t0 = items.find((i) => copyKey(i) === 't:0'), t1 = items.find((i) => copyKey(i) === 't:1');
  assert.equal(t0.y, t1.y, 'tall copies share their row');
});

test('client preview: one watermarked SVG per page, fonts embedded, no cut lines', async () => {
  const fonts = await nodeFonts();
  const p = demoProject();
  p.stickers[0].quantity = 60; // force a second page
  const sheet = computeLayout(p);
  assert.ok(sheet.pages.length > 1);
  const cache = new Map();
  const getLayout = (s) => cache.get(s) || cache.set(s, layoutSticker(s, fonts)).get(s);
  const svgs = await buildPreviewSvgs({ project: p, layout: sheet, getLayout, fonts });
  assert.equal(svgs.length, sheet.pages.length);
  for (const svg of svgs) {
    assert.ok(svg.includes(`>${WATERMARK_TEXT}<`), 'watermark text');
    assert.ok(svg.includes('Превью макета'), 'footer band');
    assert.ok(/@font-face\{[^}]*base64,/.test(svg), 'embedded font');
    assert.ok(!svg.includes('stroke-dasharray'), 'no cut lines');
  }
  await assert.rejects(buildPreviewSvgs({ project: createProject(), layout: computeLayout(createProject()), getLayout, fonts }));
});
