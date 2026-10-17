// Shared helpers. Pure functions only: this module is imported by Node tests too.

export const MM_PER_CM = 10;
export const MM_PER_INCH = 25.4;
export const MM_PER_PT = 25.4 / 72;
export const EPS = 1e-6;

export const UNITS = {
  mm: { label: 'мм', factor: 1, step: 0.5, digits: 1 },
  cm: { label: 'см', factor: MM_PER_CM, step: 0.05, digits: 2 },
};

/** Physical length in mm -> number shown in the given unit. */
export function fromMm(mm, unit = 'mm') {
  return mm / (UNITS[unit] || UNITS.mm).factor;
}

/** Number entered in the given unit -> physical length in mm. */
export function toMm(value, unit = 'mm') {
  return value * (UNITS[unit] || UNITS.mm).factor;
}

export const ptToMm = (pt) => pt * MM_PER_PT;
export const mmToPt = (mm) => mm / MM_PER_PT;

/** Rounds away float noise (e.g. 0.1 + 0.2) without losing real precision. */
export function round(value, digits = 3) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Formats a mm length for display in the chosen unit, with Russian decimal comma. */
export function formatLength(mm, unit = 'mm', withUnit = true) {
  const u = UNITS[unit] || UNITS.mm;
  const v = round(fromMm(mm, unit), u.digits);
  const s = String(v).replace('.', ',');
  return withUnit ? `${s} ${u.label}` : s;
}

export function formatSize(w, h, unit = 'mm') {
  const u = UNITS[unit] || UNITS.mm;
  return `${formatLength(w, unit, false)} × ${formatLength(h, unit, false)} ${u.label}`;
}

/** Accepts "12,5" and "12.5"; returns NaN for anything that is not a finite number. */
export function parseNumber(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  const s = String(input ?? '').trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function uid(prefix = 'id') {
  const rnd = (globalThis.crypto && crypto.getRandomValues)
    ? Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')
    : Math.random().toString(16).slice(2, 14);
  return `${prefix}_${rnd}`;
}

export function deepClone(v) {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

export function debounce(fn, ms) {
  let t = null;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
  return wrapped;
}

export function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function isHexColor(s) {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}

export function todayStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Russian plural: plural(5, ['наклейка','наклейки','наклеек']). */
export function plural(n, forms) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

/** Relative luminance contrast ratio between two #rrggbb colors (WCAG formula). */
export function contrastRatio(hexA, hexB) {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [l1, l2] = [lum(hexA), lum(hexB)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
