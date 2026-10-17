// Sticker layout: converts a sticker definition into a list of positioned drawing
// operations in the sticker's local coordinate system (mm, origin top-left, y down).
// The SVG preview and the PDF exporter both consume this output, so text wrapping,
// auto-fit and icon placement are computed exactly once.
//
// Composition (outside in):
//   contour (cut line) > inset margin > label shape (fill, border) > padding > content
//   content = [icon] + text block (title, accent divider, inscriptions) + [badge at the bottom]

import { ptToMm } from './utils.js';
import { FONT_METRICS, FONT_FAMILIES, resolveFace } from './fonts.js';
import { getIcon, iconParts, ICON_WEIGHTS } from './icons.js';

const FIT_STEP = 0.25; // pt
const NO_BREAK_FLOOR = 0.62;
const NO_LINE_START = /[ЬЪЙьъй]/; // shrink to 62% of the size before breaking words with hyphens

// Extra extents beyond cap height / baseline, in em, so overflow detection covers
// diacritics above capitals (Ё, Й) and descenders (lowercase, Д, Ц, Щ, commas).
function topExtent(line) {
  return /[ЁЙÀ-ÝĀ-ſ]/.test(line) ? 0.2 : (/[бдфhklbdfйё]/.test(line) ? 0.06 : 0);
}
function bottomExtent(line) {
  if (/[a-zа-яё,;()\[\]{}_|/]/.test(line)) return 0.22;
  if (/[ДЦЩQ]/.test(line)) return 0.16;
  return 0;
}

const VOWELS = /[аеёиоуыэюяaeiouy]/i;

/**
 * Splits a word into hyphenated pieces that each fit `fits`. Break points follow a
 * simple Russian syllable heuristic (after a vowel, or between two consonants),
 * never leave fewer than 2 letters on either side and never start a piece with
 * Ь, Ъ or Й. Returns null if the word needs more than `maxPieces` pieces.
 */
function hyphenate(word, fits, maxPieces) {
  const chars = [...word];
  const pieces = [];
  let start = 0;
  while (chars.length - start > 0) {
    const rest = chars.slice(start).join('');
    if (fits(rest)) { pieces.push(rest); break; }
    let best = -1, fallback = -1;
    for (let k = chars.length - 2; k >= start + 2; k--) {
      if (!fits(chars.slice(start, k).join('') + '-')) continue;
      // Never start a piece with Ь/Ъ/Й, and never tear a consonant from its soft sign (ЛЬ).
      if (NO_LINE_START.test(chars[k]) || /[ЬЪьъ]/.test(chars[k + 1] || '')) continue;
      if (fallback < 0) fallback = k;
      const a = chars[k - 1], b = chars[k];
      const syllable = VOWELS.test(a) || !VOWELS.test(b);
      const vowelsBothSides = VOWELS.test(chars.slice(start, k).join('')) && VOWELS.test(chars.slice(k).join(''));
      if (syllable && vowelsBothSides) { best = k; break; }
    }
    const k = best > 0 ? best : fallback;
    if (k < 0) {
      // Even two letters do not fit: hard split one character at a time.
      pieces.push(chars[start] + (start + 1 < chars.length ? '-' : ''));
      start += 1;
    } else {
      pieces.push(chars.slice(start, k).join('') + '-');
      start = k;
    }
    if (pieces.length > maxPieces) return null;
  }
  return pieces;
}

/**
 * Greedy word wrap. Spaces and existing hyphens are break opportunities.
 * `maxPieces` limits how many hyphenated pieces one word may be split into
 * (1 = never split words). Returns null when that limit makes wrapping impossible.
 */
export function wrapText(text, maxWidth, measure, maxPieces = Infinity) {
  if (maxPieces === true) maxPieces = Infinity;
  if (maxPieces === false) maxPieces = 1;
  const lines = [];
  const fits = (s) => measure(s) <= maxWidth + 1e-6;
  for (const para of text.split('\n')) {
    // Tokens keep their trailing hyphen ("ПОЛОТЕНЦЕ-") and remember the separator.
    const tokens = [];
    para.split(/ +/).forEach((word, wi) => {
      if (!word) return;
      word.split(/(?<=[^\s-]-)(?=[^\s-])/).forEach((part, pi) => tokens.push({ text: part, sep: wi > 0 && pi === 0 ? ' ' : '' }));
    });
    if (!tokens.length) { lines.push(''); continue; }
    let line = '';
    for (const tok of tokens) {
      const candidate = line ? line + tok.sep + tok.text : tok.text;
      if (fits(candidate)) { line = candidate; continue; }
      if (line) lines.push(line);
      if (fits(tok.text) || maxPieces <= 1) { line = tok.text; continue; }
      const pieces = hyphenate(tok.text, fits, maxPieces);
      if (!pieces) return null;
      lines.push(...pieces.slice(0, -1));
      line = pieces[pieces.length - 1];
    }
    lines.push(line);
  }
  return lines;
}

/** Lays out title, divider and inscriptions inside a box, shrinking to fit. */
function layoutTextBlock(title, inscriptions, style, box, fonts) {
  const tFace = resolveFace(style.fontFamily, style.fontWeight);
  const sFace = resolveFace(style.fontFamily, style.subWeight);
  const tm = FONT_METRICS[tFace.family];
  const minSize = style.fit === 'shrink' ? Math.min(style.minFontSize, style.fontSize) : style.fontSize;

  const attempt = (sizePt, maxPieces) => {
    const subPt = Math.round(sizePt * style.subScale * 100) / 100;
    const mT = (s) => fonts.measure(s, tFace.family, tFace.weight, sizePt);
    const mS = (s) => fonts.measure(s, sFace.family, sFace.weight, subPt);
    const w = Math.max(box.w, 0.1);
    const tWrap = title ? wrapText(title, w, mT, maxPieces) : [];
    const sWrap = inscriptions.map((l) => wrapText(l, w, mS, maxPieces));
    if (!tWrap || sWrap.some((x) => !x)) return { fits: false, impossible: true };
    const tLines = tWrap;
    const sLines = sWrap.flat();
    const sT = ptToMm(sizePt), sS = ptToMm(subPt);
    const leadT = sT * style.lineHeight, leadS = sS * style.lineHeight;

    let y = 0;
    const title_ = { baselines: [], widths: tLines.map(mT) };
    if (tLines.length) {
      y += sT * (tm.capHeight + topExtent(tLines[0]));
      tLines.forEach((_, i) => title_.baselines.push(y + i * leadT));
      y = title_.baselines[title_.baselines.length - 1];
    }
    let divider = null;
    const sub = { baselines: [], widths: sLines.map(mS) };
    if (sLines.length) {
      if (tLines.length && style.divider) {
        const thick = Math.max(0.35, sT * 0.13);
        const gap = sT * 0.42;
        divider = { y: y + sT * bottomExtent(tLines[tLines.length - 1]) + gap, h: thick };
        y = divider.y + thick + gap;
      } else if (tLines.length) {
        y += sT * bottomExtent(tLines[tLines.length - 1]) + sT * 0.35;
      }
      y += sS * (tm.capHeight + topExtent(sLines[0]));
      sLines.forEach((_, i) => sub.baselines.push(y + i * leadS));
      y = sub.baselines[sub.baselines.length - 1] + sS * bottomExtent(sLines[sLines.length - 1]);
    } else if (tLines.length) {
      y += sT * bottomExtent(tLines[tLines.length - 1]);
    }
    const width = Math.max(0, ...title_.widths, ...sub.widths);
    if (divider) divider.w = Math.min(width || box.w, Math.max(3, Math.min(box.w * 0.5, sT * 3.2)));
    const fits = width <= box.w + 0.01 && y <= box.h + 0.01;
    return { sizePt, subPt, sT, sS, tLines, sLines, title: title_, sub, divider, width, height: y, fits };
  };

  // Pass 1: shrink without splitting words (down to a floor).
  // Pass 2: allow one hyphen per word. Pass 3: any number of hyphens.
  const floor = Math.max(minSize, style.fontSize * NO_BREAK_FLOOR);
  const passes = [[1, floor], [2, minSize], [Infinity, minSize]];
  let res = null, last = null;
  outer: for (const [pieces, lowest] of passes) {
    for (let size = style.fontSize; size >= lowest - 1e-9; size -= FIT_STEP) {
      res = attempt(Math.round(size * 100) / 100, pieces);
      if (!res.impossible) last = res;
      if (res.fits) break outer;
    }
  }
  if (!res.fits) res = last || attempt(minSize, Infinity);
  return { ...res, tFace, sFace, overflow: !res.fits };
}

function textOp(face, sizePt, color, lines) {
  const fam = FONT_FAMILIES[face.family];
  return { type: 'text', family: face.family, weight: face.weight, cssFamily: fam.css, pdfFamily: fam.pdf, sizePt, sizeMm: ptToMm(sizePt), color, lines };
}

/**
 * @param sticker sticker instance
 * @param fonts FontRegistry (measure + missingChars)
 * @param customIcons project.customIcons
 */
export function layoutSticker(sticker, fonts, customIcons = []) {
  const { width: W, height: H, style } = sticker;
  const ops = [];
  const warnings = [];
  const inset = Math.min(style.inset ?? 0, W / 4, H / 4);
  const shape = { x: inset, y: inset, w: W - 2 * inset, h: H - 2 * inset };
  const bw = style.border ? style.borderWidth : 0;
  const radius = Math.min(style.radius, shape.w / 2, shape.h / 2);

  if (style.bgColor) ops.push({ type: 'rect', x: shape.x, y: shape.y, w: shape.w, h: shape.h, r: radius, fill: style.bgColor, stroke: null, strokeWidth: 0 });
  if (style.border) {
    // Decorative border is drawn inside the label shape and never touches the cut line.
    ops.push({ type: 'rect', x: shape.x + bw / 2, y: shape.y + bw / 2, w: shape.w - bw, h: shape.h - bw, r: Math.max(0, radius - bw / 2), fill: null, stroke: style.borderColor, strokeWidth: bw });
  }

  const pad = style.padding + bw + radius * 0.15;
  const inner = { x: shape.x + pad, y: shape.y + pad, w: shape.w - 2 * pad, h: shape.h - 2 * pad };
  const empty = { width: W, height: H, radius, ops, warnings, overflow: true, fitSizePt: style.fontSize, lineCount: 0 };
  if (inner.w <= 0.5 || inner.h <= 0.5) {
    warnings.push({ code: 'padding', message: 'Поля и рамка не оставляют места для содержимого' });
    return empty;
  }

  const allText = [];
  const alignOffset = (avail, used) => (style.align === 'center' ? (avail - used) / 2 : style.align === 'right' ? avail - used : 0);

  const title = (style.uppercase ? sticker.text.toLocaleUpperCase('ru') : sticker.text).replace(/\r/g, '').trim();
  const inscriptions = (sticker.lines || []).map((l) => l.trim()).filter(Boolean);
  const hasText = Boolean(title || inscriptions.length);
  const icon = sticker.icon.position !== 'none' ? getIcon(sticker.icon.id, customIcons) : null;

  // Badge (rating, voltage, group number) pinned to the bottom of the content.
  const badgeText = (sticker.badge || '').trim();
  let content = { ...inner };
  if (badgeText) {
    // A badge alone (e.g. just a group number) fills the label; otherwise it is a bar at the bottom.
    const alone = !hasText && !icon;
    const hB = alone ? Math.min(inner.h, inner.w * 0.75) : Math.max(2.6, Math.min(inner.h * 0.15, inner.w * 0.42, 7));
    const face = resolveFace('sans', 'bold');
    let sizeMm = (hB * 0.56) / FONT_METRICS.sans.capHeight;
    const tall = H >= W * 1.2;
    const textW = (mm) => fonts.measure(badgeText, 'sans', 'bold', mm / ptToMm(1));
    const maxW = inner.w;
    const full = tall || alone;
    const pillW = () => Math.min(maxW, Math.max(textW(sizeMm) + hB * 1.4, hB * 2.4));
    let bwid = full ? maxW : pillW();
    while (textW(sizeMm) > bwid - hB * 0.5 && sizeMm > 1.2) sizeMm -= 0.05;
    if (!full) bwid = pillW();
    const bx = inner.x + (full ? 0 : alignOffset(inner.w, bwid));
    const by = alone ? inner.y + (inner.h - hB) / 2 : inner.y + inner.h - hB;
    ops.push({ type: 'rect', x: bx, y: by, w: bwid, h: hB, r: hB * 0.28, fill: style.badgeBg, stroke: null, strokeWidth: 0 });
    const tw = textW(sizeMm);
    ops.push(textOp(face, sizeMm / ptToMm(1), style.badgeColor, [{ text: badgeText, width: tw, x: bx + (bwid - tw) / 2, baseline: by + hB / 2 + (sizeMm * FONT_METRICS.sans.capHeight) / 2 }]));
    allText.push(['sans', 'bold', badgeText]);
    content = { ...inner, h: inner.h - hB - Math.max(1, hB * 0.35) };
  }

  const pos = icon ? sticker.icon.position : 'none';
  const gap = hasText ? sticker.icon.gap : 0;

  let iconSize = 0;
  if (icon) {
    const side = pos === 'left' || pos === 'right';
    const auto = side
      ? Math.min(content.h, content.w * (hasText ? 0.42 : 1))
      : (hasText ? Math.min(content.w * 0.86, content.h * 0.42) : Math.min(content.w, content.h));
    const maxAllowed = side ? Math.min(content.h, content.w - (hasText ? gap + 1 : 0)) : Math.min(content.w, content.h - (hasText ? gap + 1.5 : 0));
    iconSize = Math.max(0, Math.min(sticker.icon.size ?? auto, maxAllowed));
    if (sticker.icon.size && sticker.icon.size > maxAllowed + 0.01) {
      warnings.push({ code: 'iconClamped', message: `Иконка уменьшена до ${iconSize.toFixed(1).replace('.', ',')} мм, чтобы поместиться` });
    }
  }

  // Text area depends on where the icon sits.
  let textBox = { ...content };
  if (icon && hasText) {
    if (pos === 'left' || pos === 'right') textBox = { x: 0, y: content.y, w: content.w - iconSize - gap, h: content.h };
    else textBox = { x: content.x, y: content.y + iconSize + gap, w: content.w, h: content.h - iconSize - gap };
  }

  let block = null;
  if (hasText) {
    block = layoutTextBlock(title, inscriptions, style, textBox, fonts);
    if (block.overflow) warnings.push({ code: 'overflow', message: 'Текст не помещается: сократите надписи, уменьшите шрифт или увеличьте наклейку' });
    if (title) allText.push([block.tFace.family, block.tFace.weight, title]);
    if (inscriptions.length) allText.push([block.sFace.family, block.sFace.weight, inscriptions.join(' ')]);
  }
  const missing = new Set();
  for (const [fam, wt, t] of allText) fonts.missingChars(t, fam, wt).forEach((ch) => missing.add(ch));
  if (missing.size) warnings.push({ code: 'glyphs', message: `Шрифт не содержит символы: ${[...missing].join(' ')}` });

  let iconX = 0, iconY = 0, blockX = content.x, blockW = content.w, blockTop = content.y;

  if (icon && hasText && (pos === 'left' || pos === 'right')) {
    const groupW = iconSize + gap + Math.min(block.width, textBox.w);
    const gx = content.x + Math.max(0, alignOffset(content.w, groupW));
    iconY = content.y + (content.h - iconSize) / 2;
    if (pos === 'left') { iconX = gx; blockX = gx + iconSize + gap; }
    else { blockX = gx; iconX = gx + Math.min(block.width, textBox.w) + gap; }
    blockW = Math.min(block.width, textBox.w);
    blockTop = content.y + (content.h - block.height) / 2;
  } else if (icon && hasText) {
    // Icon at the top; text centred in the space that remains below it.
    iconX = content.x + alignOffset(content.w, iconSize);
    iconY = content.y;
    blockTop = textBox.y + (textBox.h - block.height) / 2;
  } else if (icon) {
    iconX = content.x + alignOffset(content.w, iconSize);
    iconY = content.y + (content.h - iconSize) / 2;
  } else if (hasText) {
    blockTop = content.y + (content.h - block.height) / 2;
  }

  if (icon && iconSize > 0) {
    ops.push({
      type: 'icon', icon, parts: iconParts(icon, sticker.icon.weight), x: iconX, y: iconY, size: iconSize, stroke: ICON_WEIGHTS[sticker.icon.weight] || ICON_WEIGHTS.regular,
      color: style.iconColor, accent: sticker.icon.accent || icon.accent || style.accentColor, colored: sticker.icon.colored,
    });
  }

  if (block) {
    const lineX = (w) => blockX + alignOffset(blockW, w);
    if (block.tLines.length) {
      ops.push(textOp(block.tFace, block.sizePt, style.textColor, block.tLines.map((t, i) => ({
        text: t, width: block.title.widths[i], x: lineX(block.title.widths[i]), baseline: blockTop + block.title.baselines[i],
      }))));
    }
    if (block.divider) {
      const d = block.divider;
      ops.push({ type: 'rect', x: lineX(d.w), y: blockTop + d.y, w: d.w, h: d.h, r: d.h / 2, fill: style.accentColor, stroke: null, strokeWidth: 0 });
    }
    if (block.sLines.length) {
      ops.push(textOp(block.sFace, block.subPt, style.subColor, block.sLines.map((t, i) => ({
        text: t, width: block.sub.widths[i], x: lineX(block.sub.widths[i]), baseline: blockTop + block.sub.baselines[i],
      }))));
    }
  }

  return {
    width: W,
    height: H,
    radius,
    ops,
    warnings,
    overflow: Boolean(block?.overflow),
    fitSizePt: block ? block.sizePt : style.fontSize,
    lineCount: block ? block.tLines.length + block.sLines.length : 0,
  };
}

/** Per-sticker memo. Invalidated when the sticker object or the font version changes. */
export function createLayoutCache(fonts) {
  let version = 0;
  let cache = new WeakMap();
  fonts.onLoad(() => { version++; cache = new WeakMap(); });
  return {
    get version() { return version; },
    get(sticker, customIcons) {
      const hit = cache.get(sticker);
      if (hit && hit.icons === customIcons) return hit.result;
      const result = layoutSticker(sticker, fonts, customIcons);
      cache.set(sticker, { icons: customIcons, result });
      return result;
    },
  };
}
