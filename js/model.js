// Project data model: entity factories, defaults and validation.
// All lengths are millimetres. Font sizes are points. Nothing here touches the DOM.

import { uid, clamp, isHexColor, deepClone } from './utils.js';
import { BASE_STYLE, BASE_ICON, STYLE_PRESETS, findTemplate } from './templates.js';
import { FONT_FAMILIES } from './fonts.js';
import { ICONS } from './icons.js';

export const SCHEMA = 'fusey.project';
export const SCHEMA_VERSION = 1;

export const PAGE_FORMATS = {
  A4: { label: 'A4', width: 210, height: 297 },
  A3: { label: 'A3', width: 297, height: 420 },
  A5: { label: 'A5', width: 148, height: 210 },
  Letter: { label: 'Letter', width: 215.9, height: 279.4 },
  Legal: { label: 'Legal', width: 215.9, height: 355.6 },
  Custom: { label: 'Свой', width: null, height: null },
};

export const LIMITS = {
  stickerSize: [3, 1000],
  quantity: [1, 999],
  fontSize: [3, 200],
  minFontSize: [3, 200],
  lineHeight: [0.8, 3],
  padding: [0, 50],
  borderWidth: [0.05, 5],
  radius: [0, 50],
  iconSize: [2, 500],
  iconGap: [0, 50],
  margin: [0, 200],
  gap: [0, 200],
  pageSize: [20, 3000],
  cutWidth: [0.05, 2],
  cutOffset: [0, 20],
  dash: [0.2, 20],
  subScale: [0.4, 1.5],
  inset: [0, 20],
  lines: 12,
  lineLength: 120,
  badgeLength: 16,
};

/** @returns {PageSettings} */
export function defaultPage() {
  return { format: 'A4', orientation: 'portrait', customWidth: 210, customHeight: 297 };
}

/** @returns {LayoutSettings} */
export function defaultLayout() {
  return {
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    gapX: 0,
    gapY: 0,
    allowRotate: false,
    center: true,
    // 'grid': rows of equal height for straight ruler cuts (default),
    // 'compact': sorted by height for density, 'order': keeps project order
    strategy: 'grid',
    rowAlign: 'top',      // vertical alignment of stickers within a row
    // Manual order of printed copies ("<sticker id>:<copy index>"), set by dragging on
    // the preview; null = project order. See orderCopies() in layout-engine.js.
    copyOrder: null,
  };
}

/** @returns {CutLineSettings} */
export function defaultCutLines() {
  // Dashed lines extended to the sheet edges, so a ruler can be laid along them.
  return { enabled: true, color: '#000000', width: 0.2, style: 'dashed', dash: 1.5, offset: 0, extend: true };
}

/**
 * Physical page size after applying the format and orientation.
 * Custom pages keep the entered width/height; orientation swaps them.
 */
export function pageSize(page) {
  if (page.format === 'Custom') {
    const w = page.customWidth, h = page.customHeight;
    const portrait = page.orientation === 'portrait';
    return portrait ? { width: Math.min(w, h), height: Math.max(w, h) } : { width: Math.max(w, h), height: Math.min(w, h) };
  }
  const f = PAGE_FORMATS[page.format] || PAGE_FORMATS.A4;
  return page.orientation === 'landscape' ? { width: f.height, height: f.width } : { width: f.width, height: f.height };
}

export function createProject(overrides = {}) {
  const now = new Date().toISOString();
  return {
    schema: SCHEMA,
    version: SCHEMA_VERSION,
    id: uid('prj'),
    name: 'Новый проект',
    createdAt: now,
    updatedAt: now,
    displayUnit: 'mm',
    page: defaultPage(),
    layout: defaultLayout(),
    cutLines: defaultCutLines(),
    stickers: [],
    customIcons: [],
    ...overrides,
  };
}

/** New independent sticker instance copied from a template (or blank defaults). */
export function createSticker(template = null, overrides = {}) {
  const t = template ? deepClone(template) : null;
  return {
    id: uid('stk'),
    templateId: t ? t.id : null,
    text: t ? t.text : 'НАДПИСЬ',
    lines: t ? [...(t.lines || [])] : [],
    badge: t ? (t.badge || '') : '',
    width: t ? t.width : 17.5,
    height: t ? t.height : 50,
    quantity: 1,
    style: { ...BASE_STYLE, ...(t ? t.style : {}) },
    icon: { ...BASE_ICON, ...(t ? t.icon : { position: 'none' }) },
    ...overrides,
  };
}

/** A user template snapshot from a configured sticker. */
export function templateFromSticker(sticker, name, category = 'custom') {
  return {
    id: uid('tpl'),
    builtin: false,
    category,
    name: (name || sticker.text || 'Шаблон').replace(/\s+/g, ' ').trim().slice(0, 80),
    text: sticker.text,
    lines: [...sticker.lines],
    badge: sticker.badge,
    width: sticker.width,
    height: sticker.height,
    style: deepClone(sticker.style),
    icon: deepClone(sticker.icon),
  };
}

export function demoProject() {
  const p = createProject({ name: 'Щит квартиры' });
  const ids = [['t_input', 1], ['t_relay', 1], ['t_sock_rooms', 1], ['t_kitchen', 1], ['t_ac_kitchen', 1], ['t_sock_bath', 1],
    ['t_light', 1], ['t_light_hall', 1], ['t_laundry', 1], ['t_router', 1], ['t_intercom', 1], ['t_floor', 1]];
  p.stickers = ids.map(([id, q]) => createSticker(findTemplate(id), { quantity: q }));
  return p;
}

/* ---------- Validation / normalization ---------- */

const num = (v, [min, max], def) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : def);
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const bool = (v, def) => (typeof v === 'boolean' ? v : def);
const color = (v, def) => (isHexColor(v) ? v.toUpperCase() : def);

export function normalizeStyle(s = {}) {
  const b = BASE_STYLE;
  const out = {
    preset: oneOf(s.preset, STYLE_PRESETS.map((p) => p.id), 'custom'),
    fontFamily: oneOf(s.fontFamily, Object.keys(FONT_FAMILIES), b.fontFamily),
    fontWeight: oneOf(s.fontWeight, ['normal', 'bold'], b.fontWeight),
    fontSize: num(s.fontSize, LIMITS.fontSize, b.fontSize),
    minFontSize: num(s.minFontSize, LIMITS.minFontSize, b.minFontSize),
    fit: oneOf(s.fit, ['shrink', 'wrap'], b.fit),
    align: oneOf(s.align, ['left', 'center', 'right'], b.align),
    uppercase: bool(s.uppercase, b.uppercase),
    lineHeight: num(s.lineHeight, LIMITS.lineHeight, b.lineHeight),
    padding: num(s.padding, LIMITS.padding, b.padding),
    inset: num(s.inset, LIMITS.inset, b.inset),
    textColor: color(s.textColor, b.textColor),
    subColor: color(s.subColor, b.subColor),
    subWeight: oneOf(s.subWeight, ['normal', 'bold'], b.subWeight),
    subScale: num(s.subScale, LIMITS.subScale, b.subScale),
    divider: bool(s.divider, b.divider),
    accentColor: color(s.accentColor, b.accentColor),
    badgeBg: color(s.badgeBg, b.badgeBg),
    badgeColor: color(s.badgeColor, b.badgeColor),
    bgColor: s.bgColor === null ? null : color(s.bgColor, null),
    iconColor: color(s.iconColor, b.iconColor),
    border: bool(s.border, b.border),
    borderColor: color(s.borderColor, b.borderColor),
    borderWidth: num(s.borderWidth, LIMITS.borderWidth, b.borderWidth),
    radius: num(s.radius, LIMITS.radius, b.radius),
  };
  out.minFontSize = Math.min(out.minFontSize, out.fontSize);
  return out;
}

export function normalizeIcon(i = {}, customIcons = []) {
  const b = BASE_ICON;
  const validId = typeof i.id === 'string' && (ICONS.has(i.id) || customIcons.some((c) => c.id === i.id));
  return {
    id: validId ? i.id : null,
    position: oneOf(i.position, ['left', 'right', 'top', 'none'], validId ? b.position : 'none'),
    size: i.size === null || i.size === undefined ? null : num(i.size, LIMITS.iconSize, null),
    // Older projects stored a numeric stroke; map it onto the nearest weight.
    weight: oneOf(i.weight, ['light', 'regular', 'bold'], typeof i.stroke === 'number' ? (i.stroke < 1.5 ? 'light' : i.stroke < 2.3 ? 'regular' : 'bold') : b.weight),
    gap: num(i.gap, LIMITS.iconGap, b.gap),
    colored: bool(i.colored, b.colored),
    accent: i.accent === null || i.accent === undefined ? null : color(i.accent, null),
  };
}

export function normalizeSticker(s, customIcons = []) {
  if (!s || typeof s !== 'object') throw new Error('Некорректная наклейка');
  if (!(s.width > 0) || !(s.height > 0)) throw new Error('У наклейки нет корректных размеров');
  const w = num(s.width, LIMITS.stickerSize, NaN);
  const h = num(s.height, LIMITS.stickerSize, NaN);
  if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error('У наклейки нет корректных размеров');
  return {
    id: typeof s.id === 'string' && s.id ? s.id : uid('stk'),
    templateId: typeof s.templateId === 'string' ? s.templateId : null,
    text: typeof s.text === 'string' ? s.text.slice(0, 500) : '',
    lines: Array.isArray(s.lines) ? s.lines.filter((l) => typeof l === 'string').slice(0, LIMITS.lines).map((l) => l.replace(/[\r\n]+/g, ' ').slice(0, LIMITS.lineLength)) : [],
    badge: typeof s.badge === 'string' ? s.badge.replace(/[\r\n]+/g, ' ').slice(0, LIMITS.badgeLength) : '',
    width: w,
    height: h,
    quantity: Math.round(num(s.quantity, LIMITS.quantity, 1)),
    style: normalizeStyle(s.style),
    icon: normalizeIcon(s.icon, customIcons),
  };
}

function normalizeCustomIcons(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((i) => i && typeof i.id === 'string' && Array.isArray(i.parts))
    .map((i) => ({
      id: i.id,
      label: typeof i.label === 'string' ? i.label.slice(0, 60) : 'Своя иконка',
      group: 'custom',
      parts: i.parts.filter((p) => p && typeof p.d === 'string' && p.d.length < 20000).map((p) => ({ d: p.d, fill: Boolean(p.fill) })),
    }))
    .filter((i) => i.parts.length);
}

export function normalizeTemplate(t, customIcons = []) {
  const s = normalizeSticker({ ...t, quantity: 1 }, customIcons);
  return {
    id: typeof t.id === 'string' && t.id ? t.id : uid('tpl'),
    builtin: false,
    category: 'custom',
    name: typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 80) : (s.text || 'Шаблон'),
    text: s.text,
    lines: s.lines,
    badge: s.badge,
    width: s.width,
    height: s.height,
    style: s.style,
    icon: s.icon,
  };
}

/**
 * Validates arbitrary JSON (from localStorage or an imported file) and returns a
 * clean project. Unknown fields are dropped, out-of-range numbers are clamped,
 * broken stickers are skipped and reported in `warnings`.
 */
export function normalizeProject(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Файл не содержит проект Fusey');
  if (raw.schema !== SCHEMA) throw new Error('Это не файл проекта Fusey');
  if (typeof raw.version !== 'number' || raw.version > SCHEMA_VERSION) {
    throw new Error('Проект создан в более новой версии Fusey и не может быть открыт');
  }
  const warnings = [];
  const d = createProject();
  const customIcons = normalizeCustomIcons(raw.customIcons);

  const pg = raw.page || {};
  const page = {
    format: oneOf(pg.format, Object.keys(PAGE_FORMATS), d.page.format),
    orientation: oneOf(pg.orientation, ['portrait', 'landscape'], d.page.orientation),
    customWidth: num(pg.customWidth, LIMITS.pageSize, d.page.customWidth),
    customHeight: num(pg.customHeight, LIMITS.pageSize, d.page.customHeight),
  };

  const ly = raw.layout || {};
  const m = ly.margins || {};
  const layout = {
    margins: {
      top: num(m.top, LIMITS.margin, d.layout.margins.top),
      right: num(m.right, LIMITS.margin, d.layout.margins.right),
      bottom: num(m.bottom, LIMITS.margin, d.layout.margins.bottom),
      left: num(m.left, LIMITS.margin, d.layout.margins.left),
    },
    gapX: num(ly.gapX, LIMITS.gap, d.layout.gapX),
    gapY: num(ly.gapY, LIMITS.gap, d.layout.gapY),
    allowRotate: bool(ly.allowRotate, d.layout.allowRotate),
    center: bool(ly.center, d.layout.center),
    strategy: oneOf(ly.strategy, ['grid', 'compact', 'order'], d.layout.strategy),
    rowAlign: oneOf(ly.rowAlign, ['top', 'center', 'bottom'], d.layout.rowAlign),
    copyOrder: Array.isArray(ly.copyOrder) && ly.copyOrder.length
      ? ly.copyOrder.filter((k) => typeof k === 'string' && /^[^:]+:\d+$/.test(k)).slice(0, 20000) : null,
  };

  const cl = raw.cutLines || {};
  const cutLines = {
    enabled: bool(cl.enabled, d.cutLines.enabled),
    color: color(cl.color, d.cutLines.color),
    width: num(cl.width, LIMITS.cutWidth, d.cutLines.width),
    style: oneOf(cl.style, ['solid', 'dashed'], d.cutLines.style),
    dash: num(cl.dash, LIMITS.dash, d.cutLines.dash),
    offset: num(cl.offset, LIMITS.cutOffset, d.cutLines.offset),
    extend: bool(cl.extend, d.cutLines.extend),
  };

  const stickers = [];
  const seen = new Set();
  (Array.isArray(raw.stickers) ? raw.stickers : []).forEach((s, i) => {
    try {
      const n = normalizeSticker(s, customIcons);
      if (seen.has(n.id)) n.id = uid('stk');
      seen.add(n.id);
      stickers.push(n);
    } catch (e) {
      warnings.push(`Наклейка №${i + 1} пропущена: ${e.message}`);
    }
  });

  return {
    project: {
      schema: SCHEMA,
      version: SCHEMA_VERSION,
      id: typeof raw.id === 'string' ? raw.id : d.id,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 120) : d.name,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : d.createdAt,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : d.updatedAt,
      displayUnit: oneOf(raw.displayUnit, ['mm', 'cm'], 'mm'),
      page,
      layout,
      cutLines,
      stickers,
      customIcons,
    },
    customTemplates: Array.isArray(raw.customTemplates)
      ? raw.customTemplates.map((t) => { try { return normalizeTemplate(t, customIcons); } catch { return null; } }).filter(Boolean)
      : [],
    warnings,
  };
}
