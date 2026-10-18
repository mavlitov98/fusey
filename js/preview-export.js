// Client preview: a low-resolution JPG of the sheets with a diagonal "ОБРАЗЕЦ"
// watermark across the stickers. Meant for approving a layout in a chat: it shows
// the design but is not to scale and is unfit for printing, unlike the PDF.

import { renderStickerGroup } from './svg-render.js';
import { resolveFace, FONT_FAMILIES } from './fonts.js';
import { todayStamp } from './utils.js';

/** Long side of one page in the JPG, px. About 100 dpi on A4: readable, but too coarse to print. */
export const PREVIEW_LONG_SIDE = 1200;
export const WATERMARK_TEXT = 'ОБРАЗЕЦ';

const PAGE_GAP = 24; // px between stacked pages
const f = (n) => String(Math.round(n * 1000) / 1000);

export function defaultPreviewName(date = new Date()) {
  return `fusey-preview-${todayStamp(date)}.jpg`;
}

/** Diagonal rows of watermark text covering the whole page; offset every other row so no sticker escapes it. */
export function watermarkMarkup(W, H, text = WATERMARK_TEXT) {
  const size = Math.max(W, H) / 22;
  const stepX = size * text.length * 0.9, stepY = size * 2.6;
  const diag = Math.hypot(W, H);
  let rows = '';
  for (let y = -diag / 2, i = 0; y < diag / 2; y += stepY, i++) {
    let line = '';
    for (let x = -diag / 2 + (i % 2) * stepX / 2; x < diag / 2; x += stepX) line += `<tspan x="${f(x)}">${text}</tspan>`;
    rows += `<text y="${f(y)}">${line}</text>`;
  }
  const family = FONT_FAMILIES.sans.css;
  return `<g transform="translate(${f(W / 2)} ${f(H / 2)}) rotate(-32)" font-family="'${family}'" font-weight="700" font-size="${f(size)}" fill="#D7263D" fill-opacity="0.3" style="letter-spacing:${f(size * 0.08)}px">${rows}</g>`
    + `<rect y="${f(H - size * 1.6)}" width="${f(W)}" height="${f(size * 1.6)}" fill="#1F2023"/>`
    + `<text x="${f(W / 2)}" y="${f(H - size * 0.52)}" text-anchor="middle" font-family="'${family}'" font-weight="700" font-size="${f(size * 0.62)}" fill="#FFFFFF">Превью макета · не для печати</text>`;
}

/** Faces used by the placed stickers plus PT Sans Bold for the watermark. */
function usedFaces(layout, byId, getLayout) {
  const faces = new Map();
  const add = (family, weight) => { const face = resolveFace(family, weight); faces.set(face.key, face); };
  add('sans', 'bold');
  for (const s of new Set(layout.pages.flatMap((p) => p.items.map((i) => byId.get(i.stickerId))))) {
    for (const op of getLayout(s).ops) if (op.type === 'text') add(op.family, op.weight);
  }
  return [...faces.values()];
}

/**
 * One standalone SVG per page (viewBox in mm), fonts embedded so the SVG renders
 * identically when rasterized through an <img>. Cut lines are left out on purpose.
 */
export async function buildPreviewSvgs({ project, layout, getLayout, fonts }) {
  if (!layout.pages.length) throw new Error('В проекте нет наклеек для превью.');
  const W = layout.area.pageWidth, H = layout.area.pageHeight;
  const byId = new Map(project.stickers.map((s) => [s.id, s]));
  const faces = usedFaces(layout, byId, getLayout);
  await Promise.all(faces.map((face) => fonts.load(face.family, face.weight)));
  const fontCss = faces.map((face) => `@font-face{font-family:'${FONT_FAMILIES[face.family].css}';font-weight:${face.weight === 'bold' ? 700 : 400};src:url(data:font/ttf;base64,${fonts.base64(face.family, face.weight)}) format('truetype')}`).join('');

  return layout.pages.map((page, p) => {
    let items = '';
    page.items.forEach((it, n) => {
      const L = getLayout(byId.get(it.stickerId));
      const tf = it.rotated ? `translate(${f(it.x + it.sh)} ${f(it.y)}) rotate(90)` : `translate(${f(it.x)} ${f(it.y)})`;
      items += `<g transform="${tf}">${renderStickerGroup(L, `pv${p}_${n}`)}</g>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}"><style>${fontCss}</style>`
      + `<rect width="${f(W)}" height="${f(H)}" fill="#FFFFFF"/>${items}${watermarkMarkup(W, H)}</svg>`;
  });
}

function loadImage(svg, w, h) {
  const url = URL.createObjectURL(new Blob([svg.replace('<svg ', `<svg width="${w}" height="${h}" `)], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось отрисовать превью')); };
    img.src = url;
  });
}

/** Rasterizes all pages, stacked vertically, into one JPG and downloads it. */
export async function exportPreviewJpg(opts, fileName = defaultPreviewName()) {
  const svgs = await buildPreviewSvgs(opts);
  const W = opts.layout.area.pageWidth, H = opts.layout.area.pageHeight;
  const k = PREVIEW_LONG_SIDE / Math.max(W, H);
  const pw = Math.round(W * k), ph = Math.round(H * k);
  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = svgs.length * ph + (svgs.length - 1) * PAGE_GAP;
  const g = canvas.getContext('2d');
  g.fillStyle = '#D5D8DC';
  g.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < svgs.length; i++) g.drawImage(await loadImage(svgs[i], pw, ph), 0, i * (ph + PAGE_GAP), pw, ph);

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { size: blob.size, pages: svgs.length };
}
