// Built-in style presets, template categories and starter templates.
// Templates are blueprints: adding one copies its data into an independent
// sticker instance, so later template edits never change placed stickers.

/** Width of one modular device on a DIN rail (EN 60715 / DIN 43880 module). */
export const MODULE_WIDTH = 17.5;

export const BASE_STYLE = {
  preset: 'din',
  fontFamily: 'sans',
  fontWeight: 'bold',
  fontSize: 9.5,         // pt, title (auto-fit shrinks it for narrow modules)
  minFontSize: 4.5,      // pt, lower bound for auto-fit
  fit: 'shrink',         // 'shrink' = wrap, then shrink to fit; 'wrap' = wrap only
  align: 'center',       // 'left' | 'center' | 'right'
  uppercase: true,       // applies to the title only
  lineHeight: 1.12,
  padding: 0.8,          // mm, inside the decorative border
  inset: 0.8,            // mm, white margin between the cut line and the label shape
  textColor: '#1F2023',
  subColor: '#4B4F55',   // additional inscriptions
  subWeight: 'bold',
  subScale: 0.82,        // inscription size relative to the title
  divider: true,         // short accent line between title and inscriptions
  accentColor: '#F2C200',
  badgeBg: '#1F2023',
  badgeColor: '#FFFFFF',
  bgColor: null,         // null = no fill (paper colour)
  iconColor: '#1F2023',
  border: true,
  borderColor: '#1F2023',
  borderWidth: 0.35,     // mm
  radius: 2,             // mm
};

export const BASE_ICON = {
  id: null,
  position: 'top',       // 'left' | 'right' | 'top' | 'none'
  size: null,            // mm; null = auto
  weight: 'regular',     // line weight: 'light' | 'regular' | 'bold'
  gap: 1.5,              // mm between icon and text
  colored: true,         // two-tone colour icon; false = single ink colour
  accent: null,          // null = the icon's own accent colour
};

export const STYLE_PRESETS = [
  {
    id: 'din', label: 'DIN-модуль', hint: 'Иконка сверху, надписи, номинал',
    style: {}, icon: { position: 'top' },
  },
  {
    id: 'minimal', label: 'Minimal', hint: 'Чистый текст и тонкая рамка',
    style: { fontWeight: 'normal', subWeight: 'normal', borderWidth: 0.2, radius: 1, divider: false },
    icon: { weight: 'light', colored: false },
  },
  {
    id: 'outline', label: 'Outline', hint: 'Иконка слева, чёткая граница',
    style: { borderWidth: 0.5, radius: 1.5, fontSize: 10 },
    icon: { position: 'left' },
  },
  {
    id: 'industrial', label: 'Industrial', hint: 'Строгая техническая типографика',
    style: { fontFamily: 'narrow', align: 'left', borderWidth: 0.35, radius: 0, lineHeight: 1.05, divider: false, fontSize: 10 },
    icon: { position: 'left', weight: 'bold', colored: false },
  },
  {
    id: 'bold', label: 'Bold', hint: 'Крупный жирный текст',
    style: { fontSize: 14, border: false, radius: 0, padding: 0.8 },
    icon: { position: 'left', weight: 'bold' },
  },
  {
    id: 'warning', label: 'Warning', hint: 'Контрастное предупреждение',
    style: { bgColor: '#FFD200', textColor: '#111111', subColor: '#111111', iconColor: '#111111', accentColor: '#111111', borderColor: '#111111', borderWidth: 0.6, radius: 1, fontSize: 11 },
    icon: { position: 'left', weight: 'bold', colored: false },
  },
  {
    id: 'textOnly', label: 'Text-only', hint: 'Только текст, без иконки',
    style: { borderWidth: 0.25, radius: 1.5 },
    icon: { position: 'none' },
  },
  {
    id: 'inverse', label: 'Inverse', hint: 'Белый текст на чёрном',
    style: { bgColor: '#1F2023', textColor: '#FFFFFF', subColor: '#D5D8DC', iconColor: '#FFFFFF', badgeBg: '#FFFFFF', badgeColor: '#1F2023', border: false, radius: 2 },
    icon: { position: 'top', colored: true },
  },
  {
    id: 'custom', label: 'Custom', hint: 'Свои параметры',
    style: {}, icon: {},
  },
];

export function getPreset(id) {
  return STYLE_PRESETS.find((p) => p.id === id) || STYLE_PRESETS[0];
}

/** Full style + icon visuals for a preset, starting from the base defaults. */
export function presetValues(presetId) {
  const p = getPreset(presetId);
  return {
    style: { ...BASE_STYLE, ...p.style, preset: p.id },
    icon: { ...BASE_ICON, ...p.icon },
  };
}

/** Quick sizes: DIN modules (vertical) and classic horizontal labels. */
export const MODULE_SIZES = [
  { label: '1 мод.', w: MODULE_WIDTH, h: 50 },
  { label: '2 мод.', w: MODULE_WIDTH * 2, h: 50 },
  { label: '3 мод.', w: MODULE_WIDTH * 3, h: 50 },
  { label: '4 мод.', w: MODULE_WIDTH * 4, h: 50 },
];
export const SIZE_PRESETS = [
  [17.5, 30], [17.5, 40], [17.5, 50], [35, 50], [30, 58], [40, 15], [60, 20], [80, 30],
];

export const CATEGORIES = [
  { id: 'lighting', label: 'Освещение', icon: 'bulb' },
  { id: 'sockets', label: 'Розетки', icon: 'socket' },
  { id: 'kitchen', label: 'Кухня', icon: 'hob' },
  { id: 'bathroom', label: 'Ванная', icon: 'bath' },
  { id: 'heating', label: 'Отопление', icon: 'radiator' },
  { id: 'ac', label: 'Кондиционер', icon: 'ac' },
  { id: 'ventilation', label: 'Вентиляция', icon: 'fan' },
  { id: 'appliances', label: 'Бытовая техника', icon: 'washer' },
  { id: 'power', label: 'Силовые линии', icon: 'bolt' },
  { id: 'panel', label: 'Электрощит', icon: 'panel' },
  { id: 'groups', label: 'Автоматы и группы', icon: 'breaker' },
  { id: 'lowcurrent', label: 'Слаботочные системы', icon: 'intercom' },
  { id: 'network', label: 'Сеть и интернет', icon: 'wifi' },
  { id: 'warning', label: 'Предупреждения', icon: 'warning' },
  { id: 'custom', label: 'Пользовательские', icon: 'info' },
];

const M1 = [MODULE_WIDTH, 50];
const M2 = [MODULE_WIDTH * 2, 50];

// [id, category, title, inscriptions, badge, icon, preset, [w, h], extra]
const RAW = [
  ['t_light', 'lighting', 'СВЕТ', ['Кухня', 'Гостиная'], 'C10', 'bulb', 'din', M1],
  ['t_light_hall', 'lighting', 'СВЕТ', ['Коридор', 'Туалет', 'Ванная'], 'C10', 'bulb', 'din', M1],
  ['t_light_rooms', 'lighting', 'СВЕТ', ['Спальня', 'Детская'], 'C10', 'ceiling', 'din', M1],
  ['t_light_out', 'lighting', 'УЛИЦА', ['Освещение'], 'C10', 'sun', 'din', M1],
  ['t_light_strip', 'lighting', 'Подсветка стены в коридоре', [], '12V', 'wallwash', 'din', [30, 58], { style: { uppercase: false, fontSize: 9 } }],
  ['t_light_led', 'lighting', 'ПОДСВЕТКА', ['Кухонный фартук'], '12V', 'strip', 'din', M1],
  ['t_light_wide', 'lighting', 'ОСВЕЩЕНИЕ', [], '', 'bulb', 'outline', [40, 15]],

  ['t_sock', 'sockets', 'РОЗЕТКИ', ['Кухня'], 'C16', 'socket', 'din', M1],
  ['t_sock_rooms', 'sockets', 'РОЗЕТКИ', ['Спальня', 'Гостевая', 'Коридор'], 'C16', 'socket', 'din', M1],
  ['t_sock_bath', 'sockets', 'РОЗЕТКИ', ['Туалет', 'Ванная'], 'C16', 'socket', 'din', M1],
  ['t_sock_kid', 'sockets', 'РОЗЕТКИ', ['Детская'], 'C16', 'socket', 'din', M1],
  ['t_sock_router', 'sockets', 'РОЗЕТКА', ['Роутер'], 'C16', 'socket', 'din', M1],
  ['t_sock_bath2', 'sockets', 'РОЗЕТКА', ['Ванная'], 'C16', 'socket', 'din', M2],
  ['t_sock_wide', 'sockets', 'РОЗЕТКИ', [], '', 'socket', 'outline', [40, 15]],

  ['t_kitchen', 'kitchen', 'РОЗЕТКИ', ['Кухня', 'Рабочая зона'], 'C16', 'socket', 'din', M1],
  ['t_oven', 'kitchen', 'ДУХОВКА', [], 'C16', 'oven', 'din', M1],
  ['t_hob', 'kitchen', 'ВАРОЧНАЯ ПАНЕЛЬ', [], 'C32', 'hob', 'din', M1],
  ['t_stove', 'kitchen', 'РОЗЕТКИ', ['Духовка', 'Газовая плита'], 'C16', 'stove', 'din', M1],
  ['t_dish', 'kitchen', 'РОЗЕТКИ', ['Посудомойка', 'Рабочая зона'], 'C16', 'dishwasher', 'din', M1],
  ['t_fridge', 'kitchen', 'РОЗЕТКИ', ['Холодильник', 'Микроволновка'], 'C16', 'fridge', 'din', M1],
  ['t_hood', 'kitchen', 'ВЫТЯЖКА', [], 'C10', 'hood', 'din', M1],

  ['t_bath', 'bathroom', 'ВАННАЯ', ['Свет', 'Розетки'], 'C16', 'bath', 'din', M1],
  ['t_washer', 'bathroom', 'СТИРАЛЬНАЯ МАШИНА', [], 'C16', 'washer', 'din', M1],
  ['t_laundry', 'bathroom', 'РОЗЕТКИ', ['Прачечная'], 'C16', 'washer', 'din', M1],
  ['t_towel', 'bathroom', 'ПОЛОТЕНЦЕ-СУШИТЕЛЬ', [], 'C10', 'towel', 'din', M1],
  ['t_boiler', 'bathroom', 'БОЙЛЕР', [], 'C16', 'boiler', 'din', M1],

  ['t_floor', 'heating', 'ТЁПЛЫЙ ПОЛ', ['Ванная'], 'C16', 'floor', 'din', M1],
  ['t_kotel', 'heating', 'РОЗЕТКИ', ['Котёл', 'ТВ'], 'C16', 'flame', 'din', M1],
  ['t_heat', 'heating', 'ОТОПЛЕНИЕ', [], 'C16', 'radiator', 'din', M1],
  ['t_thermo', 'heating', 'ТЕРМОСТАТ', [], 'C10', 'thermostat', 'din', M1],
  ['t_heat_pump', 'heating', 'НАСОС', ['Отопление'], 'C10', 'pump', 'din', M1],

  ['t_ac_kitchen', 'ac', 'КОНДИЦИОНЕР', ['Кухня'], 'C16', 'ac', 'din', M1],
  ['t_ac_bed', 'ac', 'КОНДИЦИОНЕР', ['Спальня'], 'C16', 'ac', 'din', M1],
  ['t_ac_multi', 'ac', 'РОЗЕТКА', ['Кондиционер мульти'], 'C20', 'ac', 'din', M1],

  ['t_vent', 'ventilation', 'ВЕНТИЛЯЦИЯ', [], 'C10', 'fan', 'din', M1],
  ['t_vent_wc', 'ventilation', 'ВЫТЯЖКА', ['Санузел'], 'C10', 'fan', 'din', M1],
  ['t_vent_supply', 'ventilation', 'ПРИТОЧНАЯ УСТАНОВКА', [], 'C16', 'fan', 'din', M2],

  ['t_tv', 'appliances', 'ТЕЛЕВИЗОР', [], 'C16', 'tv', 'din', M1],
  ['t_freezer', 'appliances', 'МОРОЗИЛЬНИК', [], 'C16', 'snow', 'din', M1],
  ['t_pump', 'appliances', 'НАСОС', ['Скважина'], 'C16', 'pump', 'din', M1],
  ['t_micro', 'appliances', 'МИКРО-ВОЛНОВКА', [], 'C16', 'microwave', 'din', M1],

  ['t_input', 'power', 'ВВОД', [], 'C32', 'power', 'din', M2, { style: { fontSize: 13 } }],
  ['t_380', 'power', 'СИЛОВАЯ ЛИНИЯ', ['380 В'], 'C25', 'bolt', 'din', M1],
  ['t_ev', 'power', 'ЗАРЯДКА', ['Электромобиль'], 'C32', 'ev', 'din', M1],
  ['t_garage', 'power', 'ГАРАЖ', [], 'C16', 'garage', 'din', M1],

  ['t_relay', 'panel', 'КОНТРОЛЬ НАПРЯЖЕНИЯ', [], '63A', 'relay', 'din', M2,],
  ['t_relay2', 'panel', 'РЕЛЕ НАПРЯЖЕНИЯ', [], '', 'relay', 'din', M2,],
  ['t_master', 'panel', 'МАСТЕР-ВЫКЛЮЧАТЕЛЬ', [], '', 'master', 'din', M2,],
  ['t_meter', 'panel', 'СЧЁТЧИК', [], '', 'meter', 'din', M2],
  ['t_main_off', 'panel', 'ОБЩЕЕ ОТКЛЮЧЕНИЕ', [], '', 'power', 'inverse', [50, 20], { icon: { position: 'left' } }],
  ['t_pe', 'panel', 'ЗАЗЕМЛЕНИЕ PE', [], '', 'ground', 'industrial', [40, 15]],
  ['t_reserve', 'panel', 'РЕЗЕРВ', [], '', null, 'textOnly', M1],

  ['t_qf', 'groups', 'ГРУППА', [], '1', 'breaker', 'din', M1],
  ['t_qf_num', 'groups', '', [], '4', null, 'textOnly', [MODULE_WIDTH, 12], { style: { border: false } }],
  ['t_rcd', 'groups', 'УЗО', ['30 мА'], '40A', 'rcd', 'din', M2],
  ['t_difav', 'groups', 'ДИФ-АВТОМАТ', [], 'C16', 'rcd', 'din', M1],

  ['t_intercom', 'lowcurrent', 'ДОМОФОН', [], 'C6', 'intercom', 'din', M1],
  ['t_cctv', 'lowcurrent', 'ВИДЕО-НАБЛЮДЕНИЕ', [], 'C6', 'camera', 'din', M1],
  ['t_alarm', 'lowcurrent', 'СИГНАЛИЗАЦИЯ', [], 'C6', 'lock', 'din', M1],
  ['t_bell', 'lowcurrent', 'ЗВОНОК', [], 'C6', 'bell', 'din', M1],

  ['t_internet', 'network', 'ИНТЕРНЕТ', [], 'C10', 'wifi', 'din', M1],
  ['t_router', 'network', 'РОЗЕТКИ', ['Роутер'], 'C16', 'router', 'din', M1],
  ['t_lan', 'network', 'СЕТЬ LAN', [], '', 'ethernet', 'din', M1],
  ['t_server', 'network', 'СЕРВЕР', [], 'C16', 'server', 'din', M1],

  ['t_no_switch', 'warning', 'НЕ ВКЛЮЧАТЬ', [], '', 'ban', 'warning', [60, 20], { icon: { colored: true } }],
  ['t_hv', 'warning', 'ОПАСНО: ВЫСОКОЕ НАПРЯЖЕНИЕ', [], '', 'hv', 'warning', [80, 30]],
  ['t_people', 'warning', 'НЕ ВКЛЮЧАТЬ!', ['Работают люди'], '', 'warning', 'warning', [80, 30]],
  ['t_live', 'warning', 'ПОД НАПРЯЖЕНИЕМ', [], '', 'bolt', 'warning', [60, 20]],

  ['t_blank', 'custom', 'НАДПИСЬ', ['Помещение'], 'C16', 'info', 'din', M1],
  ['t_blank_text', 'custom', 'НАДПИСЬ', [], '', null, 'textOnly', [40, 15]],
];

export const BUILTIN_TEMPLATES = RAW.map(([id, category, text, lines, badge, icon, preset, [width, height], extra = {}]) => {
  const v = presetValues(preset);
  return {
    id,
    builtin: true,
    category,
    name: [text, ...lines].filter(Boolean).join(' · ') || badge,
    text,
    lines,
    badge,
    width,
    height,
    // Wider modules have room for a larger title.
    style: { ...v.style, ...(preset === 'din' && width >= MODULE_WIDTH * 2 ? { fontSize: 11 } : {}), ...(extra.style || {}) },
    icon: { ...v.icon, id: icon, ...(icon ? {} : { position: 'none' }), ...(extra.icon || {}) },
  };
});

export function findTemplate(id, customTemplates = []) {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) || customTemplates.find((t) => t.id === id) || null;
}
