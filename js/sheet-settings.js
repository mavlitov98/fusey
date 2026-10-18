// Sheet, layout and cut-line settings plus a live summary of the print job.

import { actions, getPath } from './state.js';
import { PAGE_FORMATS, LIMITS, pageSize } from './model.js';
import { lengthField, numberField, segmented, switchField, colorField, bindFields } from './fields.js';
import { icon, $ } from './ui.js';
import { formatSize, formatLength, escapeXml } from './utils.js';

export function initSheetSettings(ctx) {
  const { store } = ctx;
  const root = $('#panel-sheet');
  root.innerHTML = `
    <details class="section" open>
      <summary class="section__head">${icon('sheet', { size: 16 })}<span>Лист</span>${icon('chevronDown', { size: 16, cls: 'section__caret' })}</summary>
      <div class="section__body">
        ${segmented({ path: 'page.format', label: 'Формат', cls: 'field--formats', options: Object.entries(PAGE_FORMATS).map(([k, f]) => ({ value: k, label: f.label, aria: k === 'Custom' ? 'Свой размер листа' : `${f.label}, ${f.width} × ${f.height} мм` })) })}
        <div class="grid-2" data-show-if="page.format=Custom">
          ${lengthField({ path: 'page.customWidth', label: 'Ширина листа', min: LIMITS.pageSize[0], max: LIMITS.pageSize[1] })}
          ${lengthField({ path: 'page.customHeight', label: 'Высота листа', min: LIMITS.pageSize[0], max: LIMITS.pageSize[1] })}
        </div>
        <div class="grid-2">
          ${segmented({ path: 'page.orientation', label: 'Ориентация', options: [{ value: 'portrait', icon: 'portrait', aria: 'Книжная', title: 'Книжная' }, { value: 'landscape', icon: 'landscape', aria: 'Альбомная', title: 'Альбомная' }] })}
          ${segmented({ path: 'displayUnit', label: 'Единицы', options: [{ value: 'mm', label: 'мм', aria: 'Миллиметры' }, { value: 'cm', label: 'см', aria: 'Сантиметры' }] })}
        </div>
        <p class="note" id="pageSizeNote"></p>
      </div>
    </details>

    <details class="section" open>
      <summary class="section__head">${icon('fit', { size: 16 })}<span>Поля листа</span>${icon('chevronDown', { size: 16, cls: 'section__caret' })}</summary>
      <div class="section__body">
        ${lengthField({ path: 'layout.margins.all', label: 'Все поля сразу', min: LIMITS.margin[0], max: LIMITS.margin[1] })}
        <div class="grid-2">
          ${lengthField({ path: 'layout.margins.top', label: 'Верхнее', min: LIMITS.margin[0], max: LIMITS.margin[1] })}
          ${lengthField({ path: 'layout.margins.bottom', label: 'Нижнее', min: LIMITS.margin[0], max: LIMITS.margin[1] })}
          ${lengthField({ path: 'layout.margins.left', label: 'Левое', min: LIMITS.margin[0], max: LIMITS.margin[1] })}
          ${lengthField({ path: 'layout.margins.right', label: 'Правое', min: LIMITS.margin[0], max: LIMITS.margin[1] })}
        </div>
      </div>
    </details>

    <details class="section" open>
      <summary class="section__head">${icon('library', { size: 16 })}<span>Раскладка</span>${icon('chevronDown', { size: 16, cls: 'section__caret' })}</summary>
      <div class="section__body">
        <div class="grid-2">
          ${lengthField({ path: 'layout.gapX', label: 'Между столбцами', min: LIMITS.gap[0], max: LIMITS.gap[1] })}
          ${lengthField({ path: 'layout.gapY', label: 'Между рядами', min: LIMITS.gap[0], max: LIMITS.gap[1] })}
        </div>
        ${segmented({ path: 'layout.strategy', label: 'Раскладка', options: [{ value: 'grid', label: 'Для резки', aria: 'Для резки: ровные ряды одной высоты, сквозные линии' }, { value: 'compact', label: 'Плотно', aria: 'Плотно: сортировка по размеру' }, { value: 'order', label: 'По списку', aria: 'В порядке списка наклеек' }] })}
        <p class="note" id="strategyNote"></p>
        ${segmented({ path: 'layout.rowAlign', label: 'Выравнивание в ряду', options: [{ value: 'top', label: 'Верх' }, { value: 'center', label: 'Центр' }, { value: 'bottom', label: 'Низ' }] })}
        ${switchField({ path: 'layout.allowRotate', label: 'Разрешить поворот на 90°', hint: 'Высокие наклейки ложатся горизонтально; не помещающиеся могут встать боком' })}
        ${switchField({ path: 'layout.center', label: 'Центрировать на листе', hint: 'Группа наклеек выравнивается по центру рабочей области' })}
      </div>
    </details>

    <details class="section" open>
      <summary class="section__head">${icon('scissors', { size: 16 })}<span>Линии реза</span>${icon('chevronDown', { size: 16, cls: 'section__caret' })}</summary>
      <div class="section__body">
        ${switchField({ path: 'cutLines.enabled', label: 'Печатать линии реза', hint: 'Отдельный слой поверх наклеек, не зависит от рамки' })}
        <div class="section__group" data-show-if="cutLines.enabled=true">
          ${switchField({ path: 'cutLines.extend', label: 'Продлевать до краёв листа', hint: 'Сквозные линии между рядами и метки на полях: удобно прикладывать линейку' })}
          ${segmented({ path: 'cutLines.style', label: 'Тип линии', options: [{ value: 'solid', label: 'Сплошная' }, { value: 'dashed', label: 'Пунктир' }] })}
          <div class="grid-2">
            ${numberField({ path: 'cutLines.width', label: 'Толщина', min: LIMITS.cutWidth[0], max: LIMITS.cutWidth[1], suffix: 'мм', digits: 2 })}
            <div data-show-if="cutLines.style=dashed">${numberField({ path: 'cutLines.dash', label: 'Длина штриха', min: LIMITS.dash[0], max: LIMITS.dash[1], suffix: 'мм', digits: 2 })}</div>
          </div>
          ${colorField({ path: 'cutLines.color', label: 'Цвет линии' })}
          ${lengthField({ path: 'cutLines.offset', label: 'Отступ от края наклейки', min: LIMITS.cutOffset[0], max: LIMITS.cutOffset[1], hint: '0 = линия точно по контуру. При отступе нужен промежуток не меньше двойного отступа.' })}
        </div>
      </div>
    </details>

    <section class="section section--static" aria-labelledby="sumTitle">
      <h3 class="section__head section__head--static" id="sumTitle">${icon('info', { size: 16 })}<span>Сводка печати</span></h3>
      <div class="section__body">
        <dl class="stats" id="sheetStats"></dl>
        <div id="sheetWarnings"></div>
      </div>
    </section>`;

  const get = (path) => {
    const p = store.project;
    if (path === 'layout.margins.all') {
      const m = p.layout.margins;
      return m.top === m.bottom && m.top === m.left && m.top === m.right ? m.top : NaN;
    }
    return getPath(p, path);
  };
  const set = (path, value, { coalesce } = {}) => {
    if (path === 'layout.margins.all') {
      actions.setProject(store, 'layout.margins', { top: value, right: value, bottom: value, left: value }, false);
    } else if (path === 'page.format' && value === 'Custom' && store.project.page.format !== 'Custom') {
      // Start the custom size from the current sheet so nothing jumps.
      const cur = pageSize(store.project.page);
      actions.setProject(store, 'page', { ...store.project.page, format: 'Custom', customWidth: cur.width, customHeight: cur.height }, false);
    } else {
      actions.setProject(store, path, value, coalesce);
    }
  };
  const binder = bindFields(root, { get, set, unit: () => store.project.displayUnit });

  const syncVisibility = () => {
    root.querySelectorAll('[data-show-if]').forEach((el) => {
      const [path, val] = el.dataset.showIf.split('=');
      el.hidden = String(get(path)) !== val;
    });
  };

  const renderStats = () => {
    const p = store.project;
    const sheet = ctx.getSheet();
    const { stats, area } = sheet;
    const unit = p.displayUnit;
    $('#pageSizeNote', root).textContent = `Рабочая область: ${formatSize(Math.max(0, area.w), Math.max(0, area.h), unit)}`;
    const rows = [
      ['Лист', `${formatSize(stats.pageWidth, stats.pageHeight, unit)}, ${p.page.orientation === 'portrait' ? 'книжная' : 'альбомная'}`],
      ['Наклеек на листах', `${stats.placed}${stats.placed !== stats.requested ? ` из ${stats.requested}` : ''}`],
      ['Страниц', String(stats.pageCount)],
      ['Заполнение', stats.pageCount ? `${Math.round(stats.usage * 100)}% рабочей области` : 'нет'],
      ['Площадь наклеек', `${formatLength(stats.usedArea / 100, 'cm', false)} см²`],
      ['Линии реза', p.cutLines.enabled ? `${p.cutLines.style === 'solid' ? 'сплошные' : 'пунктир'}, ${formatLength(p.cutLines.width, 'mm')}` : 'выключены'],
    ];
    $('#sheetStats', root).innerHTML = rows.map(([k, v]) => `<div class="stats__row"><dt>${k}</dt><dd>${escapeXml(v)}</dd></div>`).join('');
    const msgs = [...sheet.errors.map((e) => ['error', e.message + (e.hint ? ` ${e.hint}` : '')]), ...sheet.warnings.map((w) => ['warn', w.message])];
    $('#sheetWarnings', root).innerHTML = msgs.map(([k, m]) => `<div class="callout callout--${k}" role="${k === 'error' ? 'alert' : 'note'}">${icon('alert', { size: 16 })}<span>${escapeXml(m)}</span></div>`).join('');
  };

  const STRATEGY_NOTES = {
    grid: 'Ряды одной высоты: каждый ряд отрезается одним сквозным резом, наклейки одной ширины стоят столбцами, и вертикальные линии проходят через несколько рядов.',
    compact: 'Максимум наклеек на листе. Высота наклеек в ряду может различаться.',
    order: 'Порядок как в списке наклеек, ряды заполняются слева направо.',
  };
  const syncAll = () => { binder.sync(); syncVisibility(); renderStats(); $('#strategyNote', root).textContent = STRATEGY_NOTES[store.project.layout.strategy]; };
  syncAll();
  store.subscribe((cur, prev) => {
    if (cur.doc.project !== prev.doc.project) syncAll();
  });
}
