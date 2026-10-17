// Contextual sticker editor (right panel on desktop, bottom sheet on mobile).
// Works on one sticker or on a multi-selection; with several stickers each field
// shows a value only when all selected stickers agree, and edits apply to all.

import { actions, getPath } from './state.js';
import { LIMITS } from './model.js';
import { STYLE_PRESETS, SIZE_PRESETS, MODULE_SIZES, MODULE_WIDTH, findTemplate } from './templates.js';
import { FONT_FAMILIES, supportsBold } from './fonts.js';
import { ICONS, ICON_GROUPS, ICON_WEIGHTS, importSvgIcon, iconParts, resolvePartColor } from './icons.js';
import { lengthField, numberField, segmented, switchField, colorField, selectField, bindFields } from './fields.js';
import { stickerThumbnailSVG } from './svg-render.js';
import { icon, on, toast, promptDialog, $ } from './ui.js';
import { escapeXml, formatSize, round, plural } from './utils.js';

// Picker previews use the same two-tone colours as the printed icon; outlines follow
// the text colour so they stay visible on the dark UI.
const iconBtn = (ic) => {
  const op = { color: 'currentColor', accent: ic.accent || '#F2C200', colored: true };
  const paths = iconParts(ic, 'regular').map((p) => {
    const col = resolvePartColor(p, op);
    if (!col) return '';
    return p.fill ? `<path d="${escapeXml(p.d)}" fill="${col}"/>` : `<path d="${escapeXml(p.d)}" stroke="${col}"/>`;
  }).join('');
  return `<button type="button" class="icon-pick" data-icon="${ic.id}" title="${escapeXml(ic.label)}" aria-label="${escapeXml(ic.label)}" aria-pressed="false">
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke-width="${ICON_WEIGHTS.regular}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>
</button>`;
};

export function initStickerEditor(ctx) {
  const { store } = ctx;
  const root = $('#inspector-body');
  const titleEl = $('#inspectorTitle');
  let builtFor = null;
  let binder = null;

  const selected = () => {
    const ids = new Set(store.ui.selection);
    return store.project.stickers.filter((s) => ids.has(s.id));
  };

  /** Common value across the selection, or undefined when they differ. */
  const get = (path) => {
    const list = selected();
    if (!list.length) return undefined;
    if (path === 'displayUnit') return store.project.displayUnit;
    if (path === 'icon.sizeAuto') return list.every((s) => s.icon.size === null);
    const first = getPath(list[0], path);
    return list.every((s) => getPath(s, path) === first) ? first : (typeof first === 'number' ? NaN : undefined);
  };
  const set = (path, value, { coalesce } = {}) => {
    const ids = store.ui.selection;
    if (path === 'displayUnit') return actions.setProject(store, 'displayUnit', value, false);
    if (path === 'icon.sizeAuto') {
      if (value) return actions.updateField(store, ids, 'icon.size', null, false);
      const op = ctx.getLayout(selected()[0]).ops.find((o) => o.type === 'icon');
      return actions.updateField(store, ids, 'icon.size', round(op ? op.size : 8, 2), false);
    }
    if (path === 'quantity') value = Math.round(value);
    if (path === 'style.fontWeight' && value === 'bold' && selected().every((s) => !supportsBold(s.style.fontFamily))) return;
    actions.updateField(store, ids, path, value, coalesce);
  };

  let swapTimer = null;
  const build = () => {
    const list = selected();
    builtFor = store.ui.selection.join(',');
    // Content cross-fade when the edited sticker changes.
    root.classList.remove('is-swapping');
    void root.offsetWidth;
    root.classList.add('is-swapping');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => root.classList.remove('is-swapping'), 600);
    if (!list.length) {
      titleEl.textContent = 'Редактор';
      binder = null;
      linesKey = null;
      root.innerHTML = `<div class="empty">
        <div class="empty__art">${icon('edit', { size: 26 })}</div>
        <p class="empty__title">Наклейка не выбрана</p>
        <p class="empty__text">Нажмите на наклейку на листе или в списке, чтобы изменить текст, иконку, размер и стиль. Удерживайте Shift, чтобы выбрать несколько.</p>
        <div class="empty__actions">
          <button class="btn btn--ghost btn--sm" data-ed="blank">${icon('plus', { size: 16 })}Своя наклейка</button>
        </div>
      </div>`;
      return;
    }
    const multi = list.length > 1;
    const s = list[0];
    titleEl.textContent = multi ? `Выбрано ${list.length} ${plural(list.length, ['наклейка', 'наклейки', 'наклеек'])}` : 'Наклейка';

    const iconGroups = ICON_GROUPS.map((g) => {
      const icons = [...ICONS.values()].filter((i) => i.group === g.id);
      return `<div class="icon-group"><p class="icon-group__label">${g.label}</p><div class="icon-grid">${icons.map(iconBtn).join('')}</div></div>`;
    }).join('');
    const customIcons = store.project.customIcons;

    root.innerHTML = `
      <div class="ed-head">
        ${multi ? '' : `<div class="ed-preview" id="edPreview"></div>`}
        <div class="ed-actions">
          <button class="btn btn--ghost btn--xs" data-ed="duplicate">${icon('copy', { size: 14 })}Копия</button>
          ${multi ? '' : `<button class="btn btn--ghost btn--xs" data-ed="save-template">${icon('bookmark', { size: 14 })}В шаблоны</button>`}
          ${list.some((x) => x.templateId && findTemplate(x.templateId, store.customTemplates)) ? `<button class="btn btn--ghost btn--xs" data-ed="reset" title="Вернуть настройки шаблона">${icon('reset', { size: 14 })}Сбросить</button>` : ''}
          <button class="btn btn--ghost btn--xs btn--danger-text" data-ed="delete">${icon('trash', { size: 14 })}Удалить</button>
        </div>
        <div id="edWarnings"></div>
      </div>

      ${multi ? '' : `<details class="section" open>
        <summary class="section__head">${icon('edit', { size: 16 })}<span>Текст</span>${icon('chevronDown', { size: 16, cls: 'section__caret' })}</summary>
        <div class="section__body">
          <div class="field">
            <label class="field-label" for="edText">Заголовок</label>
            <textarea id="edText" class="input textarea" rows="1" data-bind="text" data-kind="text" spellcheck="true" aria-describedby="edTextHint"></textarea>
            <p class="field-hint" id="edTextHint">Например: РОЗЕТКИ, СВЕТ, ВВОД. Длинные слова переносятся с дефисом.</p>
          </div>
          <div class="field">
            <span class="field-label" id="edLinesLabel">Надписи</span>
            <ul class="lines-list" id="edLines" aria-labelledby="edLinesLabel"></ul>
            <button type="button" class="btn btn--ghost btn--xs lines-add" data-line-add>${icon('plus', { size: 14 })}Добавить надпись</button>
            <p class="field-hint">Помещения или потребители этой линии: Коридор, Туалет, Ванная. Enter добавляет следующую.</p>
          </div>
          <div class="field">
            <label class="field-label" for="edBadge">Значок внизу</label>
            <input id="edBadge" class="input input--mono" type="text" maxlength="${LIMITS.badgeLength}" data-bind="badge" data-kind="text" autocomplete="off" spellcheck="false" placeholder="C16">
            <div class="chips chips--wrap" aria-label="Быстрый выбор значка">
              ${['C6', 'C10', 'C16', 'C20', 'C25', 'C32', '12V', ''].map((b) => `<button type="button" class="chip chip--sm" data-badge="${b}">${b || 'Нет'}</button>`).join('')}
            </div>
          </div>
        </div>
      </details>`}

      <details class="section" open>
        <summary class="section__head">${icon('ruler', { size: 16 })}<span>Размер и количество</span>${icon('chevronDown', { size: 16, cls: 'section__caret' })}</summary>
        <div class="section__body">
          <div class="size-row">
            ${lengthField({ path: 'width', label: 'Ширина', min: LIMITS.stickerSize[0], max: LIMITS.stickerSize[1] })}
            <button type="button" class="icon-btn size-swap" data-ed="swap" aria-label="Поменять ширину и высоту местами" title="Поменять местами">${icon('swap', { size: 16 })}</button>
            ${lengthField({ path: 'height', label: 'Высота', min: LIMITS.stickerSize[0], max: LIMITS.stickerSize[1] })}
          </div>
          <div class="field">
            <span class="field-label">Ширина в модулях DIN-рейки (1 модуль = ${String(MODULE_WIDTH).replace('.', ',')} мм)</span>
            <div class="chips chips--wrap">
              ${MODULE_SIZES.map((m) => `<button type="button" class="chip chip--sm" data-size="${m.w}x${m.h}" title="${String(m.w).replace('.', ',')} × ${m.h} мм">${m.label}</button>`).join('')}
            </div>
          </div>
          <div class="chips chips--wrap" aria-label="Готовые размеры">
            ${SIZE_PRESETS.map(([w, h]) => `<button type="button" class="chip chip--sm" data-size="${w}x${h}">${String(w).replace('.', ',')} × ${h}</button>`).join('')}
          </div>
          <div class="grid-2">
            ${segmented({ path: 'displayUnit', label: 'Единицы', options: [{ value: 'mm', label: 'мм', aria: 'Миллиметры' }, { value: 'cm', label: 'см', aria: 'Сантиметры' }] })}
            ${numberField({ path: 'quantity', label: 'Количество копий', min: LIMITS.quantity[0], max: LIMITS.quantity[1], digits: 0, suffix: 'шт.' })}
          </div>
          <p class="note" id="edPhysical"></p>
        </div>
      </details>

      <details class="section" open>
        <summary class="section__head">${icon('design', { size: 16 })}<span>Стиль</span>${icon('chevronDown', { size: 16, cls: 'section__caret' })}</summary>
        <div class="section__body">
          <div class="preset-grid" role="group" aria-label="Пресеты стиля">
            ${STYLE_PRESETS.map((p) => `<button type="button" class="preset" data-preset="${p.id}" aria-pressed="false"><span class="preset__name">${p.label}</span><span class="preset__hint">${p.hint}</span></button>`).join('')}
          </div>
          <div class="grid-2">
            ${colorField({ path: 'style.textColor', label: 'Заголовок' })}
            ${colorField({ path: 'style.subColor', label: 'Надписи' })}
            ${colorField({ path: 'style.accentColor', label: 'Акцент, черта' })}
            ${colorField({ path: 'style.bgColor', label: 'Фон', nullable: true, nullLabel: 'Нет' })}
            ${colorField({ path: 'style.badgeBg', label: 'Фон значка' })}
            ${colorField({ path: 'style.badgeColor', label: 'Текст значка' })}
          </div>
          ${switchField({ path: 'style.divider', label: 'Черта под заголовком', hint: 'Видна, когда есть надписи' })}
          ${switchField({ path: 'style.border', label: 'Декоративная рамка', hint: 'Не влияет на линии реза' })}
          <div class="grid-2" data-show-if="style.border=true">
            ${colorField({ path: 'style.borderColor', label: 'Цвет рамки' })}
            ${numberField({ path: 'style.borderWidth', label: 'Толщина рамки', min: LIMITS.borderWidth[0], max: LIMITS.borderWidth[1], suffix: 'мм', digits: 2 })}
          </div>
          <div class="grid-2">
            ${numberField({ path: 'style.radius', label: 'Скругление углов', min: LIMITS.radius[0], max: LIMITS.radius[1], suffix: 'мм', digits: 2 })}
            ${numberField({ path: 'style.padding', label: 'Внутренний отступ', min: LIMITS.padding[0], max: LIMITS.padding[1], suffix: 'мм', digits: 2 })}
          </div>
          ${numberField({ path: 'style.inset', label: 'Белое поле до линии реза', min: LIMITS.inset[0], max: LIMITS.inset[1], suffix: 'мм', digits: 2 })}
        </div>
      </details>

      <details class="section" open>
        <summary class="section__head">${icon('alignLeft', { size: 16 })}<span>Типографика</span>${icon('chevronDown', { size: 16, cls: 'section__caret' })}</summary>
        <div class="section__body">
          ${selectField({ path: 'style.fontFamily', label: 'Шрифт', options: Object.entries(FONT_FAMILIES).map(([k, f]) => ({ value: k, label: `${f.label} · ${f.hint}` })) })}
          <div class="grid-2">
            ${segmented({ path: 'style.fontWeight', label: 'Начертание', options: [{ value: 'normal', label: 'Обычный' }, { value: 'bold', label: 'Жирный' }] })}
            ${segmented({ path: 'style.align', label: 'Выравнивание', options: [{ value: 'left', icon: 'alignLeft', aria: 'По левому краю' }, { value: 'center', icon: 'alignCenter', aria: 'По центру' }, { value: 'right', icon: 'alignRight', aria: 'По правому краю' }] })}
          </div>
          ${numberField({ path: 'style.fontSize', label: 'Размер шрифта', min: LIMITS.fontSize[0], max: 72, step: 0.5, suffix: 'pt', digits: 2, range: true })}
          ${segmented({ path: 'style.fit', label: 'Если текст не помещается', options: [{ value: 'shrink', label: 'Уменьшать', aria: 'Переносить и уменьшать шрифт' }, { value: 'wrap', label: 'Только переносить', aria: 'Только переносить строки' }] })}
          <div data-show-if="style.fit=shrink">
            ${numberField({ path: 'style.minFontSize', label: 'Минимальный размер', min: LIMITS.minFontSize[0], max: 72, suffix: 'pt', digits: 2 })}
          </div>
          <p class="note" id="edFitNote"></p>
          ${numberField({ path: 'style.subScale', label: 'Размер надписей относительно заголовка', min: LIMITS.subScale[0], max: LIMITS.subScale[1], step: 0.02, digits: 2, range: true })}
          ${segmented({ path: 'style.subWeight', label: 'Начертание надписей', options: [{ value: 'normal', label: 'Обычный' }, { value: 'bold', label: 'Жирный' }] })}
          ${numberField({ path: 'style.lineHeight', label: 'Межстрочный интервал', min: LIMITS.lineHeight[0], max: 2.5, step: 0.05, digits: 2, range: true })}
          ${switchField({ path: 'style.uppercase', label: 'ЗАГОЛОВОК ЗАГЛАВНЫМИ' })}
        </div>
      </details>

      <details class="section" open>
        <summary class="section__head">${icon('bookmark', { size: 16 })}<span>Иконка</span>${icon('chevronDown', { size: 16, cls: 'section__caret' })}</summary>
        <div class="section__body">
          ${segmented({ path: 'icon.position', label: 'Положение', options: [{ value: 'none', label: 'Нет' }, { value: 'left', label: 'Слева' }, { value: 'top', label: 'Сверху' }, { value: 'right', label: 'Справа' }] })}
          <div class="icon-picker" id="iconPicker" role="group" aria-label="Выбор иконки">
            ${iconGroups}
            <div class="icon-group">
              <p class="icon-group__label">Свои иконки</p>
              <div class="icon-grid">
                ${customIcons.map(iconBtn).join('')}
                <button type="button" class="icon-pick icon-pick--upload" data-ed="upload-icon" aria-label="Загрузить свою иконку из SVG" title="Загрузить SVG">${icon('upload', { size: 20 })}</button>
              </div>
              <p class="field-hint">SVG-файл с контурами или заливкой. Иконка сохраняется в проекте.</p>
            </div>
          </div>
          ${switchField({ path: 'icon.colored', label: 'Цветная иконка', hint: 'Выключите для чёрно-белой печати' })}
          <div data-show-if="icon.colored=true">
            ${colorField({ path: 'icon.accent', label: 'Цвет акцента иконки', nullable: true, nullLabel: 'Свой', nullDefault: '#F6C40F' })}
          </div>
          ${switchField({ path: 'icon.sizeAuto', label: 'Автоматический размер иконки', hint: 'Подстраивается под размер наклейки' })}
          <div data-show-if="icon.sizeAuto=false">
            ${lengthField({ path: 'icon.size', label: 'Размер иконки', min: LIMITS.iconSize[0], max: LIMITS.iconSize[1] })}
          </div>
          ${segmented({ path: 'icon.weight', label: 'Толщина линий', options: [{ value: 'light', label: 'Тонкие' }, { value: 'regular', label: 'Обычные' }, { value: 'bold', label: 'Жирные' }] })}
          <div class="grid-2">
            ${colorField({ path: 'style.iconColor', label: 'Контур иконки' })}
            ${lengthField({ path: 'icon.gap', label: 'Отступ до текста', min: LIMITS.iconGap[0], max: LIMITS.iconGap[1] })}
          </div>
        </div>
      </details>`;

    binder = bindFields(root, { get, set, unit: () => store.project.displayUnit });
    linesKey = null;
    update();
  };

  const update = () => {
    if (!binder) return;
    const list = selected();
    if (!list.length) return;
    binder.sync();
    root.querySelectorAll('[data-show-if]').forEach((el) => {
      const [path, val] = el.dataset.showIf.split('=');
      el.hidden = String(get(path)) !== val;
    });
    const s = list[0];
    const multi = list.length > 1;
    const L = ctx.getLayout(s);

    const prev = $('#edPreview', root);
    if (prev) prev.innerHTML = stickerThumbnailSVG(L, { title: s.text });
    renderLines(s);
    root.querySelectorAll('[data-badge]').forEach((b) => b.classList.toggle('is-active', b.dataset.badge === (s.badge || '')));

    const iconId = get('icon.id');
    root.querySelectorAll('[data-icon]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.icon === iconId)));
    const preset = get('style.preset');
    root.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === preset)));
    root.querySelectorAll('[data-size]').forEach((b) => {
      const [w, h] = b.dataset.size.split('x').map(Number);
      b.classList.toggle('is-active', list.every((x) => x.width === w && x.height === h));
    });
    const boldBtn = root.querySelector('[data-bind="style.fontWeight"] [data-value="bold"]');
    if (boldBtn) {
      const noBold = list.every((x) => !supportsBold(x.style.fontFamily));
      boldBtn.disabled = noBold;
      boldBtn.title = noBold ? 'У моноширинного шрифта нет жирного начертания' : '';
    }

    const phys = $('#edPhysical', root);
    if (phys) {
      phys.textContent = multi
        ? (Number.isFinite(get('width')) && Number.isFinite(get('height')) ? `Все: ${formatSize(s.width, s.height)} (${formatSize(s.width, s.height, 'cm')})` : 'Размеры различаются. Новое значение применится ко всем выбранным.')
        : `Физический размер: ${formatSize(s.width, s.height)} = ${formatSize(s.width, s.height, 'cm')}. В PDF наклейка будет ровно такой.`;
    }
    const fitNote = $('#edFitNote', root);
    if (fitNote) {
      fitNote.textContent = !multi && L.fitSizePt < s.style.fontSize - 1e-9 && !L.overflow
        ? `Шрифт уменьшен до ${String(L.fitSizePt).replace('.', ',')} pt, чтобы текст поместился.` : '';
    }

    const sheet = ctx.getSheet();
    const warns = [];
    for (const x of list) {
      const err = sheet.errors.find((e) => e.stickerId === x.id);
      if (err) warns.push(['error', `${err.message} ${err.hint}`]);
      for (const w of ctx.getLayout(x).warnings) warns.push(['warn', multi ? `«${x.text.slice(0, 20)}»: ${w.message}` : w.message]);
    }
    const unique = [...new Map(warns.map((w) => [w[1], w])).values()].slice(0, 4);
    $('#edWarnings', root).innerHTML = unique.map(([k, m]) => `<div class="callout callout--${k}" role="${k === 'error' ? 'alert' : 'status'}">${icon('alert', { size: 16 })}<span>${escapeXml(m)}</span></div>`).join('');
  };

  /* Inscriptions list: one input per line, rebuilt only when the count changes. */
  let linesKey = null;
  const renderLines = (s) => {
    const host = $('#edLines', root);
    if (!host) return;
    const key = `${s.id}:${s.lines.length}`;
    if (key !== linesKey) {
      linesKey = key;
      host.innerHTML = s.lines.map((l, i) => `<li class="lines-item">
        <input class="input" type="text" name="line-${i}" maxlength="${LIMITS.lineLength}" data-line="${i}" aria-label="Надпись ${i + 1}" autocomplete="off">
        <button type="button" class="icon-btn icon-btn--sm" data-line-del="${i}" aria-label="Удалить надпись ${i + 1}">${icon('close', { size: 15 })}</button>
      </li>`).join('');
    }
    host.querySelectorAll('[data-line]').forEach((inp) => {
      if (inp !== document.activeElement) inp.value = s.lines[Number(inp.dataset.line)] ?? '';
    });
    $('[data-line-add]', root).disabled = s.lines.length >= LIMITS.lines;
  };
  const setLines = (fn, coalesce = false) => {
    const s = selected()[0];
    if (!s) return;
    actions.updateField(store, [s.id], 'lines', fn([...s.lines]), coalesce);
  };
  const addLineAfter = (i) => {
    setLines((l) => { l.splice(i + 1, 0, ''); return l; });
    requestAnimationFrame(() => $(`[data-line="${i + 1}"]`, root)?.focus());
  };
  root.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-line]');
    if (inp) setLines((l) => { l[Number(inp.dataset.line)] = inp.value; return l; }, true);
  });
  root.addEventListener('keydown', (e) => {
    const inp = e.target.closest('[data-line]');
    if (!inp) return;
    const i = Number(inp.dataset.line);
    if (e.key === 'Enter') { e.preventDefault(); if (selected()[0].lines.length < LIMITS.lines) addLineAfter(i); }
    if (e.key === 'Backspace' && !inp.value && selected()[0].lines.length) {
      e.preventDefault();
      setLines((l) => { l.splice(i, 1); return l; });
      requestAnimationFrame(() => $(`[data-line="${Math.max(0, i - 1)}"]`, root)?.focus());
    }
  });
  on(root, 'click', '[data-line-add]', () => addLineAfter(selected()[0].lines.length - 1));
  on(root, 'click', '[data-line-del]', (e, el) => setLines((l) => { l.splice(Number(el.dataset.lineDel), 1); return l; }));
  on(root, 'click', '[data-badge]', (e, el) => actions.updateField(store, store.ui.selection, 'badge', el.dataset.badge, false));

  on(root, 'click', '[data-icon]', (e, el) => {
    const ids = store.ui.selection;
    actions.updateField(store, ids, 'icon.id', el.dataset.icon, false);
  });
  on(root, 'click', '[data-preset]', (e, el) => actions.applyPreset(store, store.ui.selection, el.dataset.preset));
  on(root, 'click', '[data-size]', (e, el) => {
    const [w, h] = el.dataset.size.split('x').map(Number);
    actions.resize(store, store.ui.selection, w, h);
  });
  on(root, 'click', '[data-ed]', async (e, el) => {
    const ids = store.ui.selection;
    switch (el.dataset.ed) {
      case 'blank': { const s = actions.addBlank(store); ctx.revealSticker(s.id); ctx.openEditor({ focusText: true }); break; }
      case 'duplicate': actions.duplicate(store, ids); break;
      case 'delete': ctx.deleteStickers(ids); break;
      case 'reset': actions.resetToTemplate(store, ids, findTemplate); toast('Настройки возвращены к шаблону', { type: 'success', action: { label: 'Отменить', run: () => store.undo() } }); break;
      case 'swap': actions.swapSize(store, ids); break;
      case 'upload-icon': $('#iconFile').click(); break;
      case 'save-template': {
        const s = selected()[0];
        const name = await promptDialog({ title: 'Сохранить как шаблон', label: 'Название шаблона', value: s.text.replace(/\s+/g, ' ').trim() });
        if (name) {
          actions.saveAsTemplate(store, s, name);
          toast(`Шаблон «${name}» сохранён в разделе «Пользовательские»`, { type: 'success' });
        }
        break;
      }
      default: break;
    }
  });

  $('#iconFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 300 * 1024) { toast('SVG-файл слишком большой (больше 300 КБ)', { type: 'error' }); return; }
    try {
      const text = await file.text();
      const { icon: ic, skippedTransforms } = importSvgIcon(text, new DOMParser(), file.name.replace(/\.svg$/i, ''));
      actions.addCustomIcon(store, ic, store.ui.selection);
      toast(skippedTransforms ? 'Иконка добавлена. Трансформации из SVG не применяются, проверьте вид иконки.' : 'Иконка добавлена и назначена наклейке', { type: skippedTransforms ? 'warning' : 'success' });
    } catch (err) {
      toast(`Не удалось загрузить иконку: ${err.message}`, { type: 'error' });
    }
  });

  build();
  store.subscribe((cur, prev) => {
    const key = cur.ui.selection.join(',');
    if (key !== builtFor || cur.doc.project.customIcons !== prev.doc.project.customIcons || cur.doc.customTemplates !== prev.doc.customTemplates) { build(); return; }
    if (cur.doc.project !== prev.doc.project) update();
  });
  ctx.fonts.onLoad(() => update());

  return {
    focusText() { $('#edText', root)?.focus(); $('#edText', root)?.select(); },
  };
}
