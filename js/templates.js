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
  { id: 'rooms', label: 'Комнаты', icon: 'sofa' },
  { id: 'kitchen', label: 'Кухня', icon: 'hob' },
  { id: 'bathroom', label: 'Ванная', icon: 'bath' },
  { id: 'heating', label: 'Отопление', icon: 'radiator' },
  { id: 'ac', label: 'Кондиционер', icon: 'ac' },
  { id: 'ventilation', label: 'Вентиляция', icon: 'fan' },
  { id: 'appliances', label: 'Бытовая техника', icon: 'washer' },
  { id: 'house', label: 'Дом и участок', icon: 'house' },
  { id: 'power', label: 'Силовые линии', icon: 'bolt' },
  { id: 'panel', label: 'Электрощит', icon: 'panel' },
  { id: 'groups', label: 'Автоматы и группы', icon: 'breaker' },
  { id: 'numbers', label: 'Номера и фазы', icon: 'info' },
  { id: 'lowcurrent', label: 'Слаботочные системы', icon: 'intercom' },
  { id: 'network', label: 'Сеть и интернет', icon: 'wifi' },
  { id: 'office', label: 'Офис и магазин', icon: 'server' },
  { id: 'door', label: 'Дверца щита', icon: 'lock' },
  { id: 'warning', label: 'Предупреждения', icon: 'warning' },
  { id: 'custom', label: 'Пользовательские', icon: 'info' },
];

// Sizes, mm. Vertical labels follow DIN-rail modules; horizontal ones go on the
// cover strip, the door or next to the panel.
const M1 = [MODULE_WIDTH, 50];
const M1S = [MODULE_WIDTH, 30];           // short label for a narrow cover strip
const M2 = [MODULE_WIDTH * 2, 50];
const M3 = [MODULE_WIDTH * 3, 50];
const M4 = [MODULE_WIDTH * 4, 50];
const NUM = [MODULE_WIDTH, 12];           // group number above / below a device
const H40 = [40, 15];
const H60 = [60, 20];
const H80 = [80, 30];
const DOOR = [100, 30];

const NUM_STYLE = { style: { border: false, fontSize: 11 } };
const PHASE = (bg, fg = '#FFFFFF') => ({ style: { bgColor: bg, textColor: fg, borderColor: bg, fontSize: 16, radius: 1.5 } });

// [id, category, title, inscriptions, badge, icon, preset, [w, h], extra]
const RAW = [
  // Освещение
  ['t_light', 'lighting', 'СВЕТ', ['Кухня', 'Гостиная'], 'C10', 'bulb', 'din', M1],
  ['t_light_hall', 'lighting', 'СВЕТ', ['Коридор', 'Туалет', 'Ванная'], 'C10', 'bulb', 'din', M1],
  ['t_light_rooms', 'lighting', 'СВЕТ', ['Спальня', 'Детская'], 'C10', 'ceiling', 'din', M1],
  ['t_light_all', 'lighting', 'СВЕТ', ['Вся квартира'], 'C10', 'ceiling', 'din', M1],
  ['t_light_ceiling', 'lighting', 'ЛЮСТРА', ['Гостиная'], 'C10', 'ceiling', 'din', M1],
  ['t_light_spots', 'lighting', 'СПОТЫ', ['Потолок'], 'C10', 'ceiling', 'din', M1],
  ['t_light_wall', 'lighting', 'БРА', ['Спальня'], 'C10', 'wallwash', 'din', M1],
  ['t_light_out', 'lighting', 'УЛИЦА', ['Освещение'], 'C10', 'sun', 'din', M1],
  ['t_light_strip', 'lighting', 'Подсветка стены в коридоре', [], '12V', 'wallwash', 'din', [30, 58], { style: { uppercase: false, fontSize: 9 } }],
  ['t_light_led', 'lighting', 'ПОДСВЕТКА', ['Кухонный фартук'], '12V', 'strip', 'din', M1],
  ['t_light_led24', 'lighting', 'LED-ЛЕНТА', ['Потолок'], '24V', 'strip', 'din', M1],
  ['t_light_psu', 'lighting', 'БЛОК ПИТАНИЯ', ['LED-подсветка'], '12V', 'strip', 'din', M2],
  ['t_light_switch', 'lighting', 'СВЕТ', ['Лестница', 'Проходной'], 'C10', 'switch', 'din', M1],
  ['t_light_emerg', 'lighting', 'СВЕТ', ['Аварийный'], 'C6', 'bulb', 'din', M1],
  ['t_light_short', 'lighting', 'СВЕТ', [], 'C10', 'bulb', 'din', M1S],
  ['t_light_dark', 'lighting', 'СВЕТ', ['Кухня', 'Коридор'], 'C10', 'bulb', 'inverse', M1],
  ['t_light_wide', 'lighting', 'ОСВЕЩЕНИЕ', [], '', 'bulb', 'outline', H40],

  // Розетки
  ['t_sock', 'sockets', 'РОЗЕТКИ', ['Кухня'], 'C16', 'socket', 'din', M1],
  ['t_sock_rooms', 'sockets', 'РОЗЕТКИ', ['Спальня', 'Гостевая', 'Коридор'], 'C16', 'socket', 'din', M1],
  ['t_sock_bath', 'sockets', 'РОЗЕТКИ', ['Туалет', 'Ванная'], 'C16', 'socket', 'din', M1],
  ['t_sock_kid', 'sockets', 'РОЗЕТКИ', ['Детская'], 'C16', 'socket', 'din', M1],
  ['t_sock_living', 'sockets', 'РОЗЕТКИ', ['Гостиная'], 'C16', 'socket', 'din', M1],
  ['t_sock_bed', 'sockets', 'РОЗЕТКИ', ['Спальня'], 'C16', 'socket', 'din', M1],
  ['t_sock_hall', 'sockets', 'РОЗЕТКИ', ['Прихожая'], 'C16', 'socket', 'din', M1],
  ['t_sock_balcony', 'sockets', 'РОЗЕТКИ', ['Балкон'], 'C16', 'socket', 'din', M1],
  ['t_sock_study', 'sockets', 'РОЗЕТКИ', ['Кабинет'], 'C16', 'socket', 'din', M1],
  ['t_sock_router', 'sockets', 'РОЗЕТКА', ['Роутер'], 'C16', 'socket', 'din', M1],
  ['t_sock_tv', 'sockets', 'РОЗЕТКИ', ['ТВ-зона'], 'C16', 'tv', 'din', M1],
  ['t_sock_bath2', 'sockets', 'РОЗЕТКА', ['Ванная'], 'C16', 'socket', 'din', M2],
  ['t_sock_power', 'sockets', 'СИЛОВАЯ РОЗЕТКА', ['32 А'], 'C32', 'plug', 'din', M1],
  ['t_sock_short', 'sockets', 'РОЗЕТКИ', [], 'C16', 'socket', 'din', M1S],
  ['t_sock_dark', 'sockets', 'РОЗЕТКИ', ['Комнаты'], 'C16', 'socket', 'inverse', M1],
  ['t_sock_wide', 'sockets', 'РОЗЕТКИ', [], '', 'socket', 'outline', H40],

  // Комнаты: группа «свет + розетки» на одну комнату
  ['t_room_bed', 'rooms', 'СПАЛЬНЯ', ['Свет', 'Розетки'], 'C16', 'bed', 'din', M1],
  ['t_room_kid', 'rooms', 'ДЕТСКАЯ', ['Свет', 'Розетки'], 'C16', 'kid', 'din', M1],
  ['t_room_living', 'rooms', 'ГОСТИНАЯ', ['Свет', 'Розетки'], 'C16', 'sofa', 'din', M1],
  ['t_room_study', 'rooms', 'КАБИНЕТ', ['Свет', 'Розетки'], 'C16', 'house', 'din', M1],
  ['t_room_hall', 'rooms', 'ПРИХОЖАЯ', ['Свет', 'Розетки'], 'C16', 'house', 'din', M1],
  ['t_room_wardrobe', 'rooms', 'ГАРДЕРОБ', [], 'C10', 'house', 'din', M1],
  ['t_room_balcony', 'rooms', 'БАЛКОН', ['Лоджия'], 'C16', 'sun', 'din', M1],
  ['t_room_storage', 'rooms', 'КЛАДОВАЯ', [], 'C10', 'lock', 'din', M1],
  ['t_room_guest', 'rooms', 'ГОСТЕВАЯ', ['Свет', 'Розетки'], 'C16', 'bed', 'din', M1],
  ['t_room_floor2', 'rooms', '2 ЭТАЖ', ['Свет'], 'C10', 'house', 'din', M1],
  ['t_room_attic', 'rooms', 'МАНСАРДА', [], 'C16', 'house', 'din', M1],
  ['t_room_basement', 'rooms', 'ПОДВАЛ', [], 'C16', 'house', 'din', M1],
  ['t_room_wide', 'rooms', 'СПАЛЬНЯ', ['Свет и розетки'], '', 'bed', 'outline', H60],

  // Кухня
  ['t_kitchen', 'kitchen', 'РОЗЕТКИ', ['Кухня', 'Рабочая зона'], 'C16', 'socket', 'din', M1],
  ['t_oven', 'kitchen', 'ДУХОВКА', [], 'C16', 'oven', 'din', M1],
  ['t_hob', 'kitchen', 'ВАРОЧНАЯ ПАНЕЛЬ', [], 'C32', 'hob', 'din', M1],
  ['t_hob2', 'kitchen', 'ВАРОЧНАЯ ПАНЕЛЬ', ['380 В'], 'C16', 'hob', 'din', M3],
  ['t_stove', 'kitchen', 'ЭЛЕКТРО-ПЛИТА', [], 'C32', 'stove', 'din', M2],
  ['t_gas', 'kitchen', 'РОЗЕТКИ', ['Духовка', 'Газовая плита'], 'C16', 'stove', 'din', M1],
  ['t_dish', 'kitchen', 'ПОСУДО-МОЕЧНАЯ МАШИНА', [], 'C16', 'dishwasher', 'din', M1],
  ['t_fridge', 'kitchen', 'ХОЛОДИЛЬНИК', [], 'C16', 'fridge', 'din', M1],
  ['t_fridge_micro', 'kitchen', 'РОЗЕТКИ', ['Холодильник', 'Микроволновка'], 'C16', 'fridge', 'din', M1],
  ['t_microwave', 'kitchen', 'МИКРО-ВОЛНОВКА', [], 'C16', 'microwave', 'din', M1],
  ['t_hood', 'kitchen', 'ВЫТЯЖКА', [], 'C10', 'hood', 'din', M1],
  ['t_kettle', 'kitchen', 'РОЗЕТКИ', ['Чайник', 'Кофемашина'], 'C16', 'kettle', 'din', M1],
  ['t_disposer', 'kitchen', 'МОЙКА', ['Измельчитель'], 'C10', 'drop', 'din', M1],
  ['t_kitchen_light', 'kitchen', 'СВЕТ', ['Кухня'], 'C10', 'bulb', 'din', M1],

  // Ванная
  ['t_bath', 'bathroom', 'ВАННАЯ', ['Свет', 'Розетки'], 'C16', 'bath', 'din', M1],
  ['t_shower', 'bathroom', 'ДУШЕВАЯ', [], 'C16', 'shower', 'din', M1],
  ['t_washer', 'bathroom', 'СТИРАЛЬНАЯ МАШИНА', [], 'C16', 'washer', 'din', M1],
  ['t_dryer', 'bathroom', 'СУШИЛЬНАЯ МАШИНА', [], 'C16', 'washer', 'din', M1],
  ['t_laundry', 'bathroom', 'РОЗЕТКИ', ['Прачечная'], 'C16', 'washer', 'din', M1],
  ['t_towel', 'bathroom', 'ПОЛОТЕНЦЕ-СУШИТЕЛЬ', [], 'C10', 'towel', 'din', M1],
  ['t_boiler', 'bathroom', 'БОЙЛЕР', [], 'C16', 'boiler', 'din', M1],
  ['t_boiler_flow', 'bathroom', 'ПРОТОЧНЫЙ НАГРЕВАТЕЛЬ', [], 'C40', 'boiler', 'din', M2],
  ['t_bath_floor', 'bathroom', 'ТЁПЛЫЙ ПОЛ', ['Санузел'], 'C16', 'floor', 'din', M1],
  ['t_jacuzzi', 'bathroom', 'ДЖАКУЗИ', [], 'C16', 'bath', 'din', M1],
  ['t_wc', 'bathroom', 'САНУЗЕЛ', ['Свет', 'Вытяжка'], 'C10', 'shower', 'din', M1],

  // Отопление
  ['t_floor', 'heating', 'ТЁПЛЫЙ ПОЛ', ['Ванная'], 'C16', 'floor', 'din', M1],
  ['t_floor_kitchen', 'heating', 'ТЁПЛЫЙ ПОЛ', ['Кухня'], 'C16', 'floor', 'din', M1],
  ['t_floor_hall', 'heating', 'ТЁПЛЫЙ ПОЛ', ['Коридор'], 'C16', 'floor', 'din', M1],
  ['t_kotel', 'heating', 'КОТЁЛ', ['Газовый'], 'C10', 'flame', 'din', M1],
  ['t_kotel_el', 'heating', 'ЭЛЕКТРО-КОТЁЛ', ['380 В'], 'C25', 'flame', 'din', M3],
  ['t_kotel_tv', 'heating', 'РОЗЕТКИ', ['Котёл', 'ТВ'], 'C16', 'flame', 'din', M1],
  ['t_heat', 'heating', 'ОТОПЛЕНИЕ', [], 'C16', 'radiator', 'din', M1],
  ['t_convector', 'heating', 'ОБОГРЕВ', ['Конвекторы', 'Спальня'], 'C16', 'radiator', 'din', M1],
  ['t_thermo', 'heating', 'ТЕРМОСТАТ', [], 'C10', 'thermostat', 'din', M1],
  ['t_heat_pump', 'heating', 'НАСОС', ['Отопление'], 'C10', 'pump', 'din', M1],
  ['t_heatpump', 'heating', 'ТЕПЛОВОЙ НАСОС', [], 'C25', 'heatpump', 'din', M2],
  ['t_antifreeze', 'heating', 'ГРЕЮЩИЙ КАБЕЛЬ', ['Водосток'], 'C16', 'snow', 'din', M1],

  // Кондиционер
  ['t_ac_kitchen', 'ac', 'КОНДИЦИОНЕР', ['Кухня'], 'C16', 'ac', 'din', M1],
  ['t_ac_bed', 'ac', 'КОНДИЦИОНЕР', ['Спальня'], 'C16', 'ac', 'din', M1],
  ['t_ac_living', 'ac', 'КОНДИЦИОНЕР', ['Гостиная'], 'C16', 'ac', 'din', M1],
  ['t_ac_kid', 'ac', 'КОНДИЦИОНЕР', ['Детская'], 'C16', 'ac', 'din', M1],
  ['t_ac_study', 'ac', 'КОНДИЦИОНЕР', ['Кабинет'], 'C16', 'ac', 'din', M1],
  ['t_ac_multi', 'ac', 'МУЛЬТИ-СПЛИТ', ['Наружный блок'], 'C20', 'ac', 'din', M1],
  ['t_ac_all', 'ac', 'КОНДИЦИОНЕР', ['Все блоки'], 'C20', 'ac', 'din', M1],
  ['t_ac_wide', 'ac', 'КОНДИЦИОНЕР', [], '', 'ac', 'outline', H40],

  // Вентиляция
  ['t_vent', 'ventilation', 'ВЕНТИЛЯЦИЯ', [], 'C10', 'fan', 'din', M1],
  ['t_vent_wc', 'ventilation', 'ВЫТЯЖКА', ['Санузел'], 'C10', 'fan', 'din', M1],
  ['t_vent_supply', 'ventilation', 'ПРИТОЧНАЯ УСТАНОВКА', [], 'C16', 'fan', 'din', M2],
  ['t_vent_recup', 'ventilation', 'РЕКУПЕРАТОР', [], 'C10', 'fan', 'din', M1],
  ['t_vent_breezer', 'ventilation', 'БРИЗЕР', ['Спальня'], 'C10', 'fan', 'din', M1],
  ['t_vent_heater', 'ventilation', 'КАЛОРИФЕР', ['Приточка'], 'C25', 'flame', 'din', M2],

  // Бытовая техника
  ['t_tv', 'appliances', 'ТЕЛЕВИЗОР', [], 'C16', 'tv', 'din', M1],
  ['t_freezer', 'appliances', 'МОРОЗИЛЬНИК', [], 'C16', 'snow', 'din', M1],
  ['t_pc', 'appliances', 'КОМПЬЮТЕР', ['Кабинет'], 'C16', 'server', 'din', M1],
  ['t_iron', 'appliances', 'ГЛАДИЛЬНАЯ ЗОНА', [], 'C16', 'iron', 'din', M1],
  ['t_vacuum', 'appliances', 'ПЫЛЕСОС', ['Встроенный'], 'C16', 'plug', 'din', M1],
  ['t_aquarium', 'appliances', 'АКВАРИУМ', [], 'C6', 'drop', 'din', M1],
  ['t_washer_app', 'appliances', 'СТИРАЛКА', ['Сушилка'], 'C16', 'washer', 'din', M1],
  ['t_micro', 'appliances', 'МИКРО-ВОЛНОВКА', [], 'C16', 'microwave', 'din', M1],

  // Дом и участок
  ['t_garage', 'house', 'ГАРАЖ', [], 'C16', 'garage', 'din', M1],
  ['t_garage_gate', 'house', 'ВОРОТА', ['Привод'], 'C10', 'garage', 'din', M1],
  ['t_gate', 'house', 'КАЛИТКА', ['Электрозамок'], 'C6', 'lock', 'din', M1],
  ['t_yard_light', 'house', 'ОСВЕЩЕНИЕ УЧАСТКА', [], 'C10', 'sun', 'din', M1],
  ['t_facade', 'house', 'ФАСАД', ['Подсветка'], 'C10', 'wallwash', 'din', M1],
  ['t_well', 'house', 'СКВАЖИНА', ['Насос'], 'C16', 'pump', 'din', M1],
  ['t_septic', 'house', 'СЕПТИК', [], 'C10', 'drop', 'din', M1],
  ['t_drain', 'house', 'ДРЕНАЖНЫЙ НАСОС', [], 'C10', 'pump', 'din', M1],
  ['t_sauna', 'house', 'БАНЯ', ['Электрокаменка'], 'C25', 'flame', 'din', M3],
  ['t_sauna_light', 'house', 'БАНЯ', ['Свет', 'Розетки'], 'C10', 'house', 'din', M1],
  ['t_pool', 'house', 'БАССЕЙН', ['Фильтр', 'Насос'], 'C16', 'drop', 'din', M1],
  ['t_greenhouse', 'house', 'ТЕПЛИЦА', [], 'C16', 'tree', 'din', M1],
  ['t_watering', 'house', 'ПОЛИВ', ['Автоматический'], 'C10', 'drop', 'din', M1],
  ['t_gazebo', 'house', 'БЕСЕДКА', ['Барбекю'], 'C16', 'tree', 'din', M1],
  ['t_workshop', 'house', 'МАСТЕРСКАЯ', [], 'C16', 'plug', 'din', M1],
  ['t_shed', 'house', 'ХОЗБЛОК', [], 'C16', 'house', 'din', M1],
  ['t_boiler_room', 'house', 'КОТЕЛЬНАЯ', [], 'C16', 'flame', 'din', M1],
  ['t_cellar', 'house', 'ПОГРЕБ', [], 'C10', 'snow', 'din', M1],
  ['t_guest_house', 'house', 'ГОСТЕВОЙ ДОМ', [], 'C25', 'house', 'din', M2],
  ['t_outdoor_sock', 'house', 'УЛИЧНЫЕ РОЗЕТКИ', [], 'C16', 'tree', 'din', M1],

  // Силовые линии
  ['t_input', 'power', 'ВВОД', [], 'C32', 'power', 'din', M2, { style: { fontSize: 13 } }],
  ['t_input3', 'power', 'ВВОД', ['380 В'], 'C40', 'power', 'din', M3, { style: { fontSize: 13 } }],
  ['t_380', 'power', 'СИЛОВАЯ ЛИНИЯ', ['380 В'], 'C25', 'bolt', 'din', M1],
  ['t_ev', 'power', 'ЗАРЯДКА', ['Электромобиль'], 'C32', 'ev', 'din', M2],
  ['t_solar', 'power', 'СОЛНЕЧНЫЕ ПАНЕЛИ', ['Инвертор'], 'C20', 'solar', 'din', M2],
  ['t_generator', 'power', 'ГЕНЕРАТОР', [], 'C32', 'bolt', 'din', M2],
  ['t_ups', 'power', 'ИБП', ['Котёл'], 'C10', 'bolt', 'din', M1],
  ['t_stab', 'power', 'СТАБИЛИЗАТОР', [], 'C40', 'bolt', 'din', M2],
  ['t_welder', 'power', 'СВАРКА', ['Мастерская'], 'C25', 'bolt', 'din', M1],
  ['t_machine', 'power', 'СТАНОК', ['380 В'], 'C16', 'bolt', 'din', M3],
  ['t_power_sock', 'power', 'РОЗЕТКА 380 В', ['Гараж'], 'C16', 'plug', 'din', M3],
  ['t_power_wide', 'power', 'СИЛОВАЯ ЛИНИЯ 380 В', [], '', 'bolt', 'industrial', H60],

  // Электрощит
  ['t_relay', 'panel', 'КОНТРОЛЬ НАПРЯЖЕНИЯ', [], '63A', 'relay', 'din', M2],
  ['t_relay2', 'panel', 'РЕЛЕ НАПРЯЖЕНИЯ', [], '', 'relay', 'din', M2],
  ['t_relay3', 'panel', 'РЕЛЕ НАПРЯЖЕНИЯ', ['3 фазы'], '', 'relay', 'din', M3],
  ['t_master', 'panel', 'МАСТЕР-ВЫКЛЮЧАТЕЛЬ', [], '', 'master', 'din', M2],
  ['t_meter', 'panel', 'СЧЁТЧИК', [], '', 'meter', 'din', M2],
  ['t_meter3', 'panel', 'СЧЁТЧИК', ['3 фазы'], '', 'meter', 'din', M4],
  ['t_spd', 'panel', 'УЗИП', ['Защита от перенапряжений'], '', 'bolt', 'din', M2],
  ['t_contactor', 'panel', 'КОНТАКТОР', ['Бойлер'], '25A', 'relay', 'din', M1],
  ['t_impulse', 'panel', 'РЕЛЕ', ['Импульсное', 'Свет'], '', 'relay', 'din', M1],
  ['t_timer', 'panel', 'ТАЙМЕР', ['Подсветка'], '', 'thermostat', 'din', M1],
  ['t_ats', 'panel', 'АВР', ['Генератор / сеть'], '', 'power', 'din', M4],
  ['t_switch_load', 'panel', 'ВЫКЛЮЧАТЕЛЬ НАГРУЗКИ', [], '63A', 'power', 'din', M2],
  ['t_din_sock', 'panel', 'РОЗЕТКА НА DIN', [], 'C16', 'socket', 'din', M3],
  ['t_main_off', 'panel', 'ОБЩЕЕ ОТКЛЮЧЕНИЕ', [], '', 'power', 'inverse', [50, 20], { icon: { position: 'left' } }],
  ['t_pe', 'panel', 'ЗАЗЕМЛЕНИЕ PE', [], '', 'ground', 'industrial', H40],
  ['t_n_bus', 'panel', 'НОЛЬ N', [], '', null, 'industrial', H40, { style: { bgColor: '#E3EEFF', align: 'center' } }],
  ['t_reserve', 'panel', 'РЕЗЕРВ', [], '', null, 'textOnly', M1],
  ['t_reserve_short', 'panel', 'РЕЗЕРВ', [], '', null, 'textOnly', M1S],
  ['t_spare', 'panel', 'СВОБОДНО', [], '', null, 'textOnly', M1],

  // Автоматы и группы
  ['t_qf', 'groups', 'ГРУППА', [], '1', 'breaker', 'din', M1],
  ['t_qf_main', 'groups', 'ВВОДНОЙ АВТОМАТ', [], 'C40', 'breaker', 'din', M2],
  ['t_qf_name', 'groups', 'QF1', ['Розетки кухня'], 'C16', null, 'textOnly', M1],
  ['t_rcd', 'groups', 'УЗО', ['30 мА'], '40A', 'rcd', 'din', M2],
  ['t_rcd10', 'groups', 'УЗО', ['10 мА', 'Ванная'], '25A', 'rcd', 'din', M2],
  ['t_rcd_fire', 'groups', 'УЗО ПРОТИВО-ПОЖАРНОЕ', ['100 мА'], '63A', 'rcd', 'din', M2],
  ['t_rcd4', 'groups', 'УЗО', ['30 мА', '3 фазы'], '40A', 'rcd', 'din', M4],
  ['t_difav', 'groups', 'ДИФ-АВТОМАТ', [], 'C16', 'rcd', 'din', M1],
  ['t_difav2', 'groups', 'ДИФ-АВТОМАТ', ['Ванная'], 'C16', 'rcd', 'din', M2],
  ['t_qf_group_rcd', 'groups', 'ГРУППА УЗО 1', ['Кухня, ванная'], '', 'rcd', 'outline', H60],
  ['t_qf_short', 'groups', 'C16', [], '', 'breaker', 'textOnly', M1S, { style: { fontSize: 14 } }],

  // Номера и фазы
  ['t_qf_num', 'numbers', '', [], '1', null, 'textOnly', NUM, NUM_STYLE],
  ['t_qf_num2', 'numbers', '', [], '2', null, 'textOnly', NUM, NUM_STYLE],
  ['t_qf_num3', 'numbers', '', [], '3', null, 'textOnly', NUM, NUM_STYLE],
  ['t_qf_numqf', 'numbers', 'QF1', [], '', null, 'textOnly', NUM, { style: { fontSize: 12, border: false } }],
  ['t_qf_numgr', 'numbers', 'ГР. 1', [], '', null, 'textOnly', NUM, { style: { fontSize: 10, border: false } }],
  ['t_qf_num_dark', 'numbers', '1', [], '', null, 'inverse', NUM, { style: { fontSize: 18 } }],
  ['t_phase_l1', 'numbers', 'L1', [], '', null, 'textOnly', NUM, PHASE('#8B5A2B')],
  ['t_phase_l2', 'numbers', 'L2', [], '', null, 'textOnly', NUM, PHASE('#1F2023')],
  ['t_phase_l3', 'numbers', 'L3', [], '', null, 'textOnly', NUM, PHASE('#8A9099')],
  ['t_phase_n', 'numbers', 'N', [], '', null, 'textOnly', NUM, PHASE('#2F7BF6')],
  ['t_phase_pe', 'numbers', 'PE', [], '', null, 'textOnly', NUM, PHASE('#F2C200', '#1F2023')],
  ['t_phase_a', 'numbers', 'ФАЗА A', [], '', null, 'textOnly', H40, { style: { fontSize: 14 } }],
  ['t_floor_num', 'numbers', '1 ЭТАЖ', [], '', 'house', 'outline', H40],

  // Слаботочные системы
  ['t_intercom', 'lowcurrent', 'ДОМОФОН', [], 'C6', 'intercom', 'din', M1],
  ['t_cctv', 'lowcurrent', 'ВИДЕО-НАБЛЮДЕНИЕ', [], 'C6', 'camera', 'din', M1],
  ['t_alarm', 'lowcurrent', 'ОХРАНА', ['Сигнализация'], 'C6', 'lock', 'din', M1],
  ['t_fire', 'lowcurrent', 'ПОЖАРНАЯ', ['Сигнализация'], 'C6', 'danger', 'din', M1],
  ['t_bell', 'lowcurrent', 'ЗВОНОК', [], 'C6', 'bell', 'din', M1],
  ['t_leak', 'lowcurrent', 'ПРОТЕЧКИ', ['Защита', 'Краны'], 'C6', 'drop', 'din', M1],
  ['t_smart', 'lowcurrent', 'УМНЫЙ ДОМ', ['Контроллер'], 'C6', 'house', 'din', M1],
  ['t_blinds', 'lowcurrent', 'ШТОРЫ', ['Электрокарниз'], 'C6', 'switch', 'din', M1],
  ['t_skud', 'lowcurrent', 'СКУД', ['Доступ'], 'C6', 'lock', 'din', M1],
  ['t_psu12', 'lowcurrent', 'БЛОК ПИТАНИЯ', ['Слаботочка'], '12V', 'plug', 'din', M2],

  // Сеть и интернет
  ['t_internet', 'network', 'ИНТЕРНЕТ', [], 'C10', 'wifi', 'din', M1],
  ['t_router', 'network', 'РОЗЕТКИ', ['Роутер'], 'C16', 'router', 'din', M1],
  ['t_lan', 'network', 'СЕТЬ LAN', [], '', 'ethernet', 'din', M1],
  ['t_switch_lan', 'network', 'КОММУТАТОР', [], 'C6', 'ethernet', 'din', M1],
  ['t_server', 'network', 'СЕРВЕР', [], 'C16', 'server', 'din', M1],
  ['t_rack', 'network', 'СЕРВЕРНЫЙ ШКАФ', [], 'C16', 'server', 'din', M2],
  ['t_mesh', 'network', 'WI-FI', ['Точки доступа'], 'C6', 'wifi', 'din', M1],
  ['t_tv_antenna', 'network', 'ТВ-АНТЕННА', ['Усилитель'], 'C6', 'tv', 'din', M1],

  // Офис и магазин
  ['t_off_light', 'office', 'СВЕТ', ['Торговый зал'], 'C10', 'ceiling', 'din', M1],
  ['t_off_sock', 'office', 'РОЗЕТКИ', ['Рабочие места'], 'C16', 'socket', 'din', M1],
  ['t_off_cash', 'office', 'КАССА', ['Терминал'], 'C16', 'plug', 'din', M1],
  ['t_off_sign', 'office', 'ВЫВЕСКА', [], 'C10', 'strip', 'din', M1],
  ['t_off_showcase', 'office', 'ВИТРИНА', ['Холодильная'], 'C16', 'snow', 'din', M1],
  ['t_off_printer', 'office', 'ПРИНТЕР', ['Оргтехника'], 'C16', 'plug', 'din', M1],
  ['t_off_coffee', 'office', 'КОФЕ-МАШИНА', [], 'C16', 'kettle', 'din', M1],
  ['t_off_server', 'office', 'СЕРВЕРНАЯ', [], 'C20', 'server', 'din', M1],
  ['t_off_reception', 'office', 'РЕСЕПШН', [], 'C16', 'info', 'din', M1],
  ['t_off_emerg', 'office', 'ЭВАКУАЦИОННОЕ ОСВЕЩЕНИЕ', [], 'C6', 'warning', 'din', M2],

  // Дверца щита
  ['t_door_flat', 'door', 'ЩИТ КВАРТИРНЫЙ', ['Кв. 45'], '', 'panel', 'outline', DOOR, { style: { fontSize: 14 } }],
  ['t_door_house', 'door', 'ЩИТ ДОМА', [], '', 'house', 'outline', DOOR, { style: { fontSize: 16 } }],
  ['t_door_garage', 'door', 'ЩИТ ГАРАЖА', [], '', 'garage', 'outline', DOOR, { style: { fontSize: 16 } }],
  ['t_door_shr', 'door', 'ЩР-1', ['Распределительный щит'], '', 'panel', 'industrial', DOOR, { style: { fontSize: 18 } }],
  ['t_door_sauna', 'door', 'ЩИТ БАНИ', [], '', 'flame', 'outline', DOOR, { style: { fontSize: 16 } }],
  ['t_door_lock', 'door', 'ЭЛЕКТРОЩИТ', ['Посторонним не открывать'], '', 'lock', 'inverse', DOOR, { icon: { position: 'left' }, style: { fontSize: 14 } }],
  ['t_door_master', 'door', 'ОТВЕТСТВЕННЫЙ', ['Тел.: +7 ___ ___-__-__'], '', 'info', 'outline', DOOR, { style: { fontSize: 14 } }],
  ['t_door_scheme', 'door', 'СХЕМА ЩИТА ВНУТРИ', [], '', 'info', 'outline', H80],
  ['t_door_check', 'door', 'УЗО ПРОВЕРЯТЬ', ['Кнопкой «Т» раз в месяц'], '', 'rcd', 'warning', H80, { icon: { colored: true } }],

  // Предупреждения
  ['t_no_switch', 'warning', 'НЕ ВКЛЮЧАТЬ', [], '', 'ban', 'warning', H60, { icon: { colored: true } }],
  ['t_hv', 'warning', 'ОПАСНО: ВЫСОКОЕ НАПРЯЖЕНИЕ', [], '', 'hv', 'warning', H80],
  ['t_people', 'warning', 'НЕ ВКЛЮЧАТЬ!', ['Работают люди'], '', 'warning', 'warning', H80],
  ['t_live', 'warning', 'ПОД НАПРЯЖЕНИЕМ', [], '', 'bolt', 'warning', H60],
  ['t_danger', 'warning', 'ОПАСНО ДЛЯ ЖИЗНИ', [], '', 'danger', 'warning', H80],
  ['t_380_warn', 'warning', 'ВНИМАНИЕ! 380 В', [], '', 'hv', 'warning', H60],
  ['t_two_sources', 'warning', 'ДВА ИСТОЧНИКА ПИТАНИЯ', ['Сеть и генератор'], '', 'warning', 'warning', H80],
  ['t_no_off', 'warning', 'НЕ ОТКЛЮЧАТЬ', ['Холодильник'], '', 'ban', 'warning', H60, { icon: { colored: true } }],
  ['t_kids', 'warning', 'ДЕТЯМ НЕ ОТКРЫВАТЬ', [], '', 'lock', 'warning', H60],
  ['t_hv_mini', 'warning', '', [], '', 'hv', 'warning', [20, 20], { icon: { position: 'top' } }],
  ['t_earth_here', 'warning', 'ЗАЗЕМЛИТЬ ЗДЕСЬ', [], '', 'ground', 'warning', H60],

  // Пользовательские (пустые заготовки)
  ['t_blank', 'custom', 'НАДПИСЬ', ['Помещение'], 'C16', 'info', 'din', M1],
  ['t_blank2', 'custom', 'НАДПИСЬ', ['Помещение'], 'C16', 'info', 'din', M2],
  ['t_blank_text', 'custom', 'НАДПИСЬ', [], '', null, 'textOnly', H40],
  ['t_blank_dark', 'custom', 'НАДПИСЬ', ['Помещение'], 'C16', 'info', 'inverse', M1],
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
