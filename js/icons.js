// Sticker icon library. Icons are drawn on a 24×24 grid. Each part is SVG path
// data plus a tone:
//   ink     dark outline (stroke by default), uses the sticker's icon colour
//   accent  the icon's highlight colour (overridable per sticker)
//   paper   white details on top of accent fills
//   #hex    fixed secondary colour (e.g. blue airflow on a yellow AC icon)
// In monochrome mode accent/#hex parts become ink, except decorative fills that
// are simply dropped (`solid: false`). Both renderers (SVG and PDF) resolve
// colours through resolvePartColor(), so preview and print always match.

import { circleD, rectD, parsePath, transformSegments, segmentsToD, shapeToD } from './path.js';
import { MATERIAL } from './icons-material.js';

const c = circleD;
const r = rectD;

// Part builders.
const S = (d) => d;                                                     // ink stroke
const F = (d) => ({ d, fill: true });                                   // ink fill
const A = (d, solid = false) => ({ d, fill: true, tone: 'accent', solid }); // accent fill
const AL = (d) => ({ d, tone: 'accent' });                              // accent stroke
const P = (d) => ({ d, tone: 'paper' });                                // paper stroke
const K = (d, hex, solid = false) => ({ d, fill: true, tone: hex, solid }); // fixed colour fill
const KL = (d, hex) => ({ d, tone: hex });                              // fixed colour stroke
const dot = (x, y, rad = 1) => F(c(x, y, rad));


export const ICON_COLORS = {
  yellow: '#F6C40F', paleYellow: '#FCE59A', blue: '#3D8FE0', paleBlue: '#BFDDF7',
  red: '#E23B3B', orange: '#F28A1E', paleOrange: '#FFD3A3', green: '#2FA557', paleGreen: '#BFE8CB',
};
const Y = ICON_COLORS.yellow, PY = ICON_COLORS.paleYellow, B = ICON_COLORS.blue, PB = ICON_COLORS.paleBlue;
const R = ICON_COLORS.red, O = ICON_COLORS.orange, PO = ICON_COLORS.paleOrange, G = ICON_COLORS.green, PG = ICON_COLORS.paleGreen;

export const ICON_GROUPS = [
  { id: 'light', label: 'Свет' },
  { id: 'power', label: 'Розетки и щит' },
  { id: 'appliance', label: 'Техника' },
  { id: 'climate', label: 'Климат и вода' },
  { id: 'lowcurrent', label: 'Связь и слаботочка' },
  { id: 'rooms', label: 'Помещения' },
  { id: 'signs', label: 'Знаки' },
];

// Line weights. Material icons ship an outline per weight; our own stroked
// icons use the matching stroke width on the 24-unit grid.
export const ICON_WEIGHTS = { light: 1.3, regular: 1.7, bold: 2.3 };

// Material Symbols (Rounded), Google, Apache-2.0. `ms` names the source icon.
const M = (id, label, group, ms, accent) => ({ id, label, group, ms, accent });

const triangle = 'M12 3.4 21.4 19.8H2.6Z';

const LIST = [
  // Lighting
  M('bulb', 'Лампочка', 'light', 'lightbulb', Y),
  M('ceiling', 'Светильник', 'light', 'light', Y),
  M('wallwash', 'Бра, подсветка стены', 'light', 'wall_lamp', PY),
  M('sun', 'Уличный свет', 'light', 'sunny', Y),
  M('switch', 'Выключатель', 'light', 'switch', PY),
  { id: 'strip', label: 'LED-лента', group: 'light', accent: Y, parts: [S(r(2.5, 9, 19, 6, 2)), A(c(6.5, 12, 1.3), true), A(c(12, 12, 1.3), true), A(c(17.5, 12, 1.3), true)] },

  // Power and panel
  // Euro socket (two round pins), as used in Russia; Material's outlet is the US type.
  { id: 'socket', label: 'Розетка', group: 'power', accent: PY, parts: [S(r(2.6, 2.6, 18.8, 18.8, 4.6)), A(c(12, 12, 6.3)), S(c(12, 12, 6.3)), dot(9.6, 12, 1.15), dot(14.4, 12, 1.15)] },
  M('plug', 'Вилка', 'power', 'power', PY),
  M('bolt', 'Молния', 'power', 'electric_bolt', Y),
  M('meter', 'Счётчик', 'power', 'electric_meter', PY),
  M('ev', 'Зарядка авто', 'power', 'ev_station', PG),
  M('solar', 'Солнечные панели', 'power', 'solar_power', PB),
  { id: 'power', label: 'Ввод, отключение', group: 'power', accent: R, parts: [A(r(2.5, 2.5, 19, 19, 5), true), P('M12 7v5'), P('M8.6 8.9a4.9 4.9 0 1 0 6.8 0')] },
  { id: 'panel', label: 'Электрощит', group: 'power', accent: PY, parts: [A(r(4, 2.5, 16, 19, 2.5)), S(r(4, 2.5, 16, 19, 2.5)), S('M4 9h16'), S('M8 12.5v5'), S('M12 12.5v5'), S('M16 12.5v5'), S('M7.5 5.8h3')] },
  { id: 'breaker', label: 'Автомат', group: 'power', accent: Y, parts: [S(r(7, 2.5, 10, 19, 2.5)), A(r(9.9, 8.8, 4.2, 6.4, 1.2), true), S(r(9.9, 8.8, 4.2, 6.4, 1.2)), dot(12, 5.6, 0.9), dot(12, 18.4, 0.9)] },
  { id: 'rcd', label: 'УЗО', group: 'power', accent: Y, parts: [S(r(3.5, 2.5, 17, 19, 2.5)), A(r(6.6, 9, 3.8, 6.2, 1.2), true), A(r(13.6, 9, 3.8, 6.2, 1.2), true), S(r(6.6, 9, 3.8, 6.2, 1.2)), S(r(13.6, 9, 3.8, 6.2, 1.2)), S('M8.6 5.6h6.8')] },
  { id: 'relay', label: 'Реле напряжения', group: 'power', accent: Y, parts: [S(r(5, 1.8, 14, 20.4, 2.5)), c(8.5, 4.6, 0.85), c(12, 4.6, 0.85), c(15.5, 4.6, 0.85), c(8.5, 19.4, 0.85), c(12, 19.4, 0.85), c(15.5, 19.4, 0.85), F(r(7.4, 7.6, 9.2, 4.6, 1)), AL('M9.2 9.9h5.6'), A('M12.6 13.2 10.8 16h2.2l-1.4 2.6', false), AL('M12.6 13.2 10.8 16h2.2l-1.4 2.6')] },
  { id: 'master', label: 'Мастер-выключатель', group: 'power', accent: PY, parts: [S(r(4.5, 2.5, 15, 19, 3)), A(r(7.5, 5.5, 9, 13, 2)), S(r(7.5, 5.5, 9, 13, 2)), K(c(12, 9.5, 1.4), R, true), K(c(12, 14.5, 1.4), G, true)] },
  { id: 'ground', label: 'Заземление', group: 'power', accent: G, parts: [AL('M12 3v9'), S('M5 12h14'), S('M8 15.5h8'), S('M10.5 19h3')] },

  // Appliances
  M('washer', 'Стиральная машина', 'appliance', 'local_laundry_service', PB),
  M('fridge', 'Холодильник', 'appliance', 'kitchen', PB),
  M('oven', 'Духовой шкаф', 'appliance', 'oven_gen', PO),
  { id: 'hob', label: 'Варочная панель', group: 'appliance', accent: O, parts: [S(r(3, 3, 18, 18, 3)), AL(c(8.5, 8.5, 2.5)), AL(c(15.5, 8.5, 2.5)), AL(c(8.5, 15.5, 2.5)), AL(c(15.5, 15.5, 2.5))] },
  M('stove', 'Газовая плита', 'appliance', 'local_fire_department', B),
  M('dishwasher', 'Посудомоечная машина', 'appliance', 'dishwasher_gen', PB),
  M('microwave', 'Микроволновка', 'appliance', 'microwave_gen', PO),
  M('hood', 'Вытяжка', 'appliance', 'range_hood', PB),
  M('boiler', 'Бойлер', 'appliance', 'water_heater', PO),
  M('tv', 'Телевизор', 'appliance', 'tv', PB),
  M('pump', 'Насос', 'appliance', 'water_pump', PB),
  M('kettle', 'Чайник', 'appliance', 'kettle', PB),
  M('iron', 'Утюг', 'appliance', 'iron', PO),

  // Climate and water
  M('thermostat', 'Термостат', 'climate', 'thermostat', '#F7B4B4'),
  { id: 'radiator', label: 'Радиатор', group: 'climate', accent: PO, parts: [A(r(3.5, 5, 4, 14, 1.8)), A(r(10, 5, 4, 14, 1.8)), A(r(16.5, 5, 4, 14, 1.8)), S(r(3.5, 5, 4, 14, 1.8)), S(r(10, 5, 4, 14, 1.8)), S(r(16.5, 5, 4, 14, 1.8)), S('M7.5 8.5H10'), S('M14 8.5h2.5'), S('M7.5 15.5H10'), S('M14 15.5h2.5')] },
  M('floor', 'Тёплый пол', 'climate', 'heat', O),
  M('flame', 'Котёл', 'climate', 'local_fire_department', PO),
  { id: 'ac', label: 'Кондиционер', group: 'climate', accent: PB, parts: [A(r(2.5, 4, 19, 8, 2.5)), S(r(2.5, 4, 19, 8, 2.5)), S('M7 9.2h10'), KL('M7.5 15.5c-.8.9-.8 1.8 0 2.7s.8 1.8 0 2.7', B), KL('M12 15.5c-.8.9-.8 1.8 0 2.7s.8 1.8 0 2.7', B), KL('M16.5 15.5c-.8.9-.8 1.8 0 2.7s.8 1.8 0 2.7', B)] },
  M('heatpump', 'Тепловой насос', 'climate', 'heat_pump', PB),
  M('fan', 'Вентилятор', 'climate', 'mode_fan', PB),
  M('drop', 'Капля воды', 'climate', 'water_drop', PB),
  M('snow', 'Мороз', 'climate', 'ac_unit', B),
  { id: 'towel', label: 'Полотенцесушитель', group: 'climate', accent: O, parts: [S('M6 3v18'), S('M18 3v18'), AL('M6 7h12'), AL('M6 12h12'), AL('M6 17h12')] },

  // Low current and network
  M('wifi', 'Wi-Fi', 'lowcurrent', 'wifi', B),
  M('router', 'Роутер', 'lowcurrent', 'router', PG),
  M('ethernet', 'Сеть LAN', 'lowcurrent', 'lan', PY),
  { id: 'server', label: 'Сервер', group: 'lowcurrent', accent: G, parts: [S(r(4, 3.5, 16, 7, 2)), S(r(4, 13.5, 16, 7, 2)), A(c(7.5, 7, 1), true), A(c(7.5, 17, 1), true), S('M11 7h5.5'), S('M11 17h5.5')] },
  M('camera', 'Видеонаблюдение', 'lowcurrent', 'videocam', PB),
  { id: 'intercom', label: 'Домофон', group: 'lowcurrent', accent: PB, parts: [S(r(5.5, 2.5, 13, 19, 3)), A(r(8, 5, 8, 6, 1.2)), S(r(8, 5, 8, 6, 1.2)), S(c(12, 16, 2.2)), dot(12, 16, 0.7)] },
  M('bell', 'Звонок', 'lowcurrent', 'doorbell', PY),

  // Rooms
  M('house', 'Дом', 'rooms', 'home', PY),
  M('bed', 'Спальня', 'rooms', 'bed', PB),
  M('sofa', 'Гостиная', 'rooms', 'weekend', PO),
  M('bath', 'Ванная', 'rooms', 'bathtub', PB),
  M('shower', 'Душ', 'rooms', 'shower', PB),
  M('kid', 'Детская', 'rooms', 'child_care', PY),
  M('tree', 'Улица, сад', 'rooms', 'yard', PG),
  M('garage', 'Гараж', 'rooms', 'garage', PY),

  // Signs
  M('warning', 'Предупреждение', 'signs', 'warning', Y),
  { id: 'hv', label: 'Высокое напряжение', group: 'signs', accent: Y, parts: [A(triangle, false), S(triangle), F('M13.4 8.4 9.8 14h3l-1.6 4.4 4-6h-3Z')] },
  M('ban', 'Запрет', 'signs', 'block', '#F7B4B4'),
  M('danger', 'Опасно', 'signs', 'dangerous', '#F7B4B4'),
  M('lock', 'Замок', 'signs', 'lock', PY),
  M('info', 'Информация', 'signs', 'info', PB),
];

/**
 * Compiles an icon. Material icons get one part list per weight: the filled
 * silhouette as the colour layer under the outline of that weight. Our own
 * icons share one part list; their stroke width follows the weight.
 */
function compile(icon) {
  const part = (p) => {
    const q = typeof p === 'string' ? { d: p } : p;
    return { fill: Boolean(q.fill), tone: q.tone || 'ink', solid: q.solid ?? true, segments: parsePath(q.d), d: q.d };
  };
  if (icon.ms) {
    const src = MATERIAL[icon.ms];
    if (!src) throw new Error(`Нет иконки ${icon.ms}`);
    const layer = src.fill.map((d) => part({ d, fill: true, tone: 'accent', solid: false }));
    const variants = {};
    for (const w of Object.keys(ICON_WEIGHTS)) variants[w] = [...layer, ...src[w].map((d) => part({ d, fill: true }))];
    return { ...icon, source: 'material', variants, parts: variants.regular };
  }
  return { ...icon, accent: icon.accent || null, parts: icon.parts.map(part) };
}

/** Parts to draw for a weight. */
export function iconParts(icon, weight = 'regular') {
  return icon.variants ? (icon.variants[weight] || icon.variants.regular) : icon.parts;
}

/**
 * Colour of one icon part, or null when the part is not drawn.
 * @param part compiled part
 * @param op icon draw op: { color (ink), accent, colored }
 */
export function resolvePartColor(part, op) {
  if (part.tone === 'ink') return op.color;
  if (part.tone === 'paper') return '#FFFFFF';
  if (op.colored) return part.tone === 'accent' ? op.accent : part.tone;
  // Monochrome: decorative accent fills disappear, everything else turns ink.
  if (part.fill && !part.solid) return null;
  return op.color;
}

export const ICONS = new Map(LIST.map((i) => [i.id, compile(i)]));

/** Built-in icon or a user icon stored in the project (custom icons have id "u_..."). */
export function getIcon(id, customIcons = []) {
  if (!id) return null;
  if (ICONS.has(id)) return ICONS.get(id);
  const u = customIcons.find((i) => i.id === id);
  return u ? compileCustom(u) : null;
}

const customCache = new WeakMap();
function compileCustom(u) {
  if (!customCache.has(u)) customCache.set(u, compile({ ...u, parts: u.parts }));
  return customCache.get(u);
}

function styleProp(el, name) {
  const m = (el.getAttribute('style') || '').match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`));
  return m ? m[1] : null;
}

/**
 * Parses an uploaded SVG into the icon format. Shapes with a fill become solid
 * parts, the rest are stroked. The viewBox is mapped onto a 24-unit square.
 * Uses a DOMParser instance passed in so the function stays testable.
 */
export function importSvgIcon(svgText, domParser, name = 'Своя иконка') {
  const doc = domParser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg || doc.querySelector('parsererror')) throw new Error('Файл не похож на SVG');
  let vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) {
    const w = parseFloat(svg.getAttribute('width')) || 24;
    const h = parseFloat(svg.getAttribute('height')) || 24;
    vb = [0, 0, w, h];
  }
  const parts = [];
  let skippedTransforms = false;
  // Presentation attributes inherit down the tree; SVG's initial fill is black.
  const inherited = (el, name, fallback) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const v = n.getAttribute(name) ?? styleProp(n, name);
      if (v != null) return v.trim();
    }
    return fallback;
  };
  svg.querySelectorAll('path, circle, ellipse, rect, line, polyline, polygon').forEach((el) => {
    if (el.closest('defs, clipPath, mask, symbol')) return;
    if (el.closest('[transform]')) skippedTransforms = true;
    const tag = el.tagName.toLowerCase();
    const attr = {};
    for (const a of el.attributes) attr[a.name] = a.value;
    const d = shapeToD(tag, attr);
    if (!d) return;
    const fill = inherited(el, 'fill', 'black');
    const stroke = inherited(el, 'stroke', 'none');
    const open = tag === 'line' || tag === 'polyline';
    // An element may be both filled and stroked (e.g. a line with the default black fill).
    if (fill !== 'none' && !open) parts.push({ d, fill: true });
    if (stroke !== 'none') parts.push({ d, fill: false });
  });
  if (!parts.length) throw new Error('В SVG не найдено фигур');
  // Fit the viewBox into 0..24 keeping the aspect ratio, centred.
  const scale = 24 / Math.max(vb[2], vb[3]);
  const ox = (24 - vb[2] * scale) / 2 - vb[0] * scale;
  const oy = (24 - vb[3] * scale) / 2 - vb[1] * scale;
  const norm = parts.map((p) => ({
    fill: p.fill,
    d: segmentsToD(transformSegments(parsePath(p.d), (x, y) => [x * scale + ox, y * scale + oy])),
  }));
  return { icon: { id: `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, label: name, group: 'custom', parts: norm }, skippedTransforms };
}
