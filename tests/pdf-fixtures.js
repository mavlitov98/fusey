// Builds PDF fixtures through the real export code path (js/pdf-export.js) and
// writes them, plus a JSON manifest of expected geometry, into an output dir.
// Usage: node tests/pdf-fixtures.js <outDir>
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, nodeFonts } from './helpers.js';
import { createProject, createSticker, demoProject } from '../js/model.js';
import { findTemplate, BUILTIN_TEMPLATES } from '../js/templates.js';
import { computeLayout } from '../js/layout-engine.js';
import { createLayoutCache } from '../js/sticker-layout.js';
import { buildPdf } from '../js/pdf-export.js';

// The vendored UMD bundle is CommonJS-shaped; the package is "type": "module",
// so evaluate it with an explicit module/exports pair.
const umd = { exports: {} };
new Function('module', 'exports', await readFile(path.join(ROOT, 'js/vendor/jspdf.umd.min.js'), 'utf8'))(umd, umd.exports);
const { jsPDF } = umd.exports;

const out = process.argv[2] || path.join(ROOT, 'tests/out');
await mkdir(out, { recursive: true });
const fonts = await nodeFonts();
const cache = createLayoutCache(fonts);

function fixture(name, project) {
  return { name, project };
}

const single = demoProject();

const multi = createProject({ name: 'Много страниц' });
multi.stickers = [
  createSticker(findTemplate('t_light'), { quantity: 80 }),
  createSticker(findTemplate('t_hv'), { quantity: 12 }),
];
multi.cutLines = { ...multi.cutLines, style: 'dashed', color: '#FF0000', width: 0.3 };

const exact = createProject({ name: 'Геометрия' });
exact.layout = { ...exact.layout, gapX: 5, gapY: 5 };
exact.stickers = [createSticker(null, { text: 'ПРОВЕРКА 40×15', width: 40, height: 15, quantity: 2 })];

const rotated = createProject({ name: 'Поворот' });
rotated.layout = { ...rotated.layout, allowRotate: true };
rotated.stickers = [createSticker(findTemplate('t_ac_icon'), { text: 'ПОВОРОТ', width: 20, height: 60 })];

const custom = createProject({ name: 'Свой лист' });
custom.page = { format: 'Custom', orientation: 'landscape', customWidth: 100, customHeight: 150 };
custom.layout = { ...custom.layout, margins: { top: 5, right: 5, bottom: 5, left: 5 } };
custom.stickers = [createSticker(findTemplate('t_sock'), { text: 'Розетки: кухня, 16 А', quantity: 3 })];
custom.stickers[0].style = { ...custom.stickers[0].style, uppercase: false };

const a3l = createProject({ name: 'A3 альбом' });
a3l.page = { ...a3l.page, format: 'A3', orientation: 'landscape' };
a3l.stickers = [createSticker(findTemplate('t_floor'), { quantity: 10 })];

const catalog = createProject({ name: 'Каталог' });
catalog.stickers = BUILTIN_TEMPLATES.map((t) => createSticker(t));

const mono = createProject({ name: 'Монохром, сплошные' });
mono.stickers = BUILTIN_TEMPLATES.slice(0, 12).map((t) => createSticker(t));
mono.stickers.forEach((s) => { s.icon = { ...s.icon, colored: false }; });
mono.cutLines = { ...mono.cutLines, style: 'solid', extend: false };
mono.layout = { ...mono.layout, strategy: 'compact', gapX: 3, gapY: 3 };

const fixtures = [
  fixture('catalog', catalog),
  fixture('mono', mono),
  fixture('single', single),
  fixture('multi', multi),
  fixture('exact', exact),
  fixture('rotated', rotated),
  fixture('custom', custom),
  fixture('a3-landscape', a3l),
];

const manifest = {};
for (const { name, project } of fixtures) {
  const layout = computeLayout(project);
  const doc = await buildPdf({ project, layout, getLayout: (s) => cache.get(s, project.customIcons), fonts, jsPDF, title: project.name });
  const buf = Buffer.from(doc.output('arraybuffer'));
  await writeFile(path.join(out, `${name}.pdf`), buf);
  const byId = new Map(project.stickers.map((s) => [s.id, s]));
  manifest[name] = {
    page: { width: layout.area.pageWidth, height: layout.area.pageHeight },
    pages: layout.pages.map((p) => ({
      items: p.items.map((i) => ({ x: i.x, y: i.y, w: i.w, h: i.h, rotated: i.rotated })),
      cuts: p.cuts,
      texts: p.items.flatMap((i) => {
        const L = cache.get(byId.get(i.stickerId), project.customIcons);
        // Text origin in sheet space; rotated stickers map local (u, v) -> (x + sh - v, y + u).
        return L.ops.filter((o) => o.type === 'text').flatMap((t) => t.lines.filter((l) => l.text).map((l) => ({
          text: l.text,
          rotated: i.rotated,
          x: i.rotated ? i.x + i.sh - l.baseline : i.x + l.x,
          baseline: i.rotated ? i.y + l.x : i.y + l.baseline,
          sizePt: t.sizePt,
        })));
      }),
    })),
    cutLines: project.cutLines,
    bytes: buf.length,
  };
  console.log(`${name}.pdf  pages=${layout.pages.length}  bytes=${buf.length}`);
}
await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
