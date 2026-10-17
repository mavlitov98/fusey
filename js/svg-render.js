// Layout result -> SVG markup (sticker-local coordinates, mm). Used by the sheet
// preview and by template thumbnails. Mirrors pdf-export.js operation by operation.

import { escapeXml } from './utils.js';
import { rectD, segmentsToD } from './path.js';
import { resolvePartColor } from './icons.js';

const f = (n) => String(Math.round(n * 1000) / 1000);
const TEXT_STYLE = 'font-kerning:none;font-variant-ligatures:none;font-feature-settings:"kern" 0,"liga" 0';

const partD = new WeakMap();
function iconPartD(part) {
  if (!partD.has(part)) partD.set(part, segmentsToD(part.segments));
  return partD.get(part);
}

export function renderOps(L) {
  let out = '';
  for (const op of L.ops) {
    if (op.type === 'rect') {
      const d = rectD(op.x, op.y, op.w, op.h, op.r);
      out += op.fill
        ? `<path d="${d}" fill="${op.fill}"/>`
        : `<path d="${d}" fill="none" stroke="${op.stroke}" stroke-width="${f(op.strokeWidth)}"/>`;
    } else if (op.type === 'icon') {
      const k = op.size / 24;
      out += `<g transform="translate(${f(op.x)} ${f(op.y)}) scale(${f(k)})" fill="none" stroke-width="${f(op.stroke)}" stroke-linecap="round" stroke-linejoin="round">`;
      for (const p of op.parts) {
        const col = resolvePartColor(p, op);
        if (!col) continue;
        out += p.fill ? `<path d="${iconPartD(p)}" fill="${col}"/>` : `<path d="${iconPartD(p)}" stroke="${col}"/>`;
      }
      out += '</g>';
    } else if (op.type === 'text') {
      const weight = op.weight === 'bold' ? 700 : 400;
      out += `<g font-family="'${op.cssFamily}'" font-weight="${weight}" font-size="${f(op.sizeMm)}" fill="${op.color}" style='${TEXT_STYLE}'>`;
      for (const line of op.lines) {
        if (!line.text) continue;
        out += `<text x="${f(line.x)}" y="${f(line.baseline)}" xml:space="preserve">${escapeXml(line.text)}</text>`;
      }
      out += '</g>';
    }
  }
  return out;
}

/** Sticker content clipped to its contour, so overflowing text can never spill onto neighbours. */
export function renderStickerGroup(L, clipId) {
  return `<clipPath id="${clipId}"><rect width="${f(L.width)}" height="${f(L.height)}"/></clipPath>`
    + `<g clip-path="url(#${clipId})">${renderOps(L)}</g>`;
}

let thumbSeq = 0;
/** Standalone SVG for a thumbnail. Paper is drawn white so styles read correctly on dark UI. */
export function stickerThumbnailSVG(L, { paper = '#FFFFFF', title = '' } = {}) {
  const id = `th${++thumbSeq}`;
  const pad = Math.max(L.width, L.height) * 0.015; // tight frame: the sticker fills the preview
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(-pad)} ${f(-pad)} ${f(L.width + 2 * pad)} ${f(L.height + 2 * pad)}" role="img" aria-label="${escapeXml(title)}">`
    + `<rect width="${f(L.width)}" height="${f(L.height)}" fill="${paper}"/>`
    + renderStickerGroup(L, id)
    + `<rect width="${f(L.width)}" height="${f(L.height)}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="${f(Math.max(L.width, L.height) * 0.006)}" stroke-dasharray="${f(Math.max(L.width, L.height) * 0.02)}"/>`
    + '</svg>';
}
