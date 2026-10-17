// Project sticker list: selection (single and multiple), quantities, reorder,
// duplicate/delete and bulk actions.

import { actions } from './state.js';
import { stickerThumbnailSVG } from './svg-render.js';
import { icon, on, confirmDialog, toast, $ } from './ui.js';
import { escapeXml, formatSize, plural, clamp, parseNumber } from './utils.js';
import { LIMITS } from './model.js';

export function initStickerList(ctx) {
  const { store } = ctx;
  const root = $('#panel-stickers');
  root.innerHTML = `
    <div class="panel-head panel-head--row">
      <label class="check">
        <input type="checkbox" id="selectAll" name="selectAll">
        <span class="check__box" aria-hidden="true">${icon('check', { size: 14 })}</span>
        <span class="sr-only">Выбрать все наклейки</span>
      </label>
      <p class="panel-head__title" id="listSummary" aria-live="polite"></p>
      <button class="btn btn--ghost btn--sm" data-action="add-more">${icon('plus', { size: 15 })}Добавить</button>
    </div>
    <div class="bulkbar" id="bulkbar" hidden></div>
    <ul class="stk-list" id="stkList" aria-label="Наклейки проекта"></ul>
    <div id="stkEmpty"></div>`;

  const list = $('#stkList', root);
  const bulk = $('#bulkbar', root);
  const summary = $('#listSummary', root);
  const selectAll = $('#selectAll', root);
  const empty = $('#stkEmpty', root);

  const issuesFor = (s, sheet) => {
    const out = [];
    if (sheet.errors.some((e) => e.stickerId === s.id)) out.push(['error', 'Не помещается на лист']);
    const L = ctx.getLayout(s);
    if (L.overflow) out.push(['warn', 'Текст не помещается']);
    else if (L.warnings.some((w) => w.code === 'glyphs')) out.push(['warn', 'Неподдерживаемые символы']);
    return out;
  };

  let known = null; // ids rendered last time, to animate newly added rows
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const render = () => {
    const { project, ui } = store;
    const sheet = ctx.getSheet();
    const sel = new Set(ui.selection);
    const total = project.stickers.reduce((n, s) => n + s.quantity, 0);
    summary.textContent = project.stickers.length
      ? `${project.stickers.length} ${plural(project.stickers.length, ['наклейка', 'наклейки', 'наклеек'])}, ${total} ${plural(total, ['копия', 'копии', 'копий'])}`
      : 'Наклеек пока нет';
    selectAll.checked = project.stickers.length > 0 && sel.size === project.stickers.length;
    selectAll.indeterminate = sel.size > 0 && sel.size < project.stickers.length;
    selectAll.disabled = !project.stickers.length;

    const fk = document.activeElement?.closest?.('#stkList') ? document.activeElement.dataset.fk : null;
    // FLIP: remember row positions so reordered/shifted rows glide instead of jumping.
    const before = new Map([...list.children].map((r) => [r.dataset.id, r.getBoundingClientRect().top]));

    list.innerHTML = project.stickers.map((s, i) => {
      const L = ctx.getLayout(s);
      const issues = issuesFor(s, sheet);
      const selected = sel.has(s.id);
      const name = [s.text, ...s.lines].map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ') || s.badge || 'Без текста';
      return `<li class="stk-row${known && !known.has(s.id) ? ' is-new' : ''}${selected ? ' is-selected' : ''}${issues.some((x) => x[0] === 'error') ? ' has-error' : ''}" data-id="${s.id}" draggable="true">
        <label class="check">
          <input type="checkbox" name="select-${s.id}" data-check="${s.id}" data-fk="chk-${s.id}" ${selected ? 'checked' : ''}>
          <span class="check__box" aria-hidden="true">${icon('check', { size: 14 })}</span>
          <span class="sr-only">Выбрать «${escapeXml(name)}»</span>
        </label>
        <button type="button" class="stk-row__main" data-select="${s.id}" data-fk="sel-${s.id}" aria-pressed="${selected}">
          <span class="stk-row__thumb">${stickerThumbnailSVG(L, { title: name })}</span>
          <span class="stk-row__body">
            <span class="stk-row__name">${escapeXml(name)}</span>
            <span class="stk-row__meta">${formatSize(s.width, s.height, project.displayUnit)}${s.badge ? ` · ${escapeXml(s.badge)}` : ''}</span>
            ${issues.map(([k, t]) => `<span class="badge badge--${k}">${icon('alert', { size: 12 })}${t}</span>`).join('')}
          </span>
        </button>
        <div class="stk-row__qty">
          <button type="button" class="icon-btn icon-btn--sm" data-qty="-1" data-id="${s.id}" aria-label="Уменьшить количество">${icon('minus', { size: 14 })}</button>
          <input class="qty-input" name="qty-${s.id}" type="text" inputmode="numeric" value="${s.quantity}" data-qty-input="${s.id}" data-fk="qty-${s.id}" aria-label="Количество копий «${escapeXml(name)}»">
          <button type="button" class="icon-btn icon-btn--sm" data-qty="1" data-id="${s.id}" aria-label="Увеличить количество">${icon('plus', { size: 14 })}</button>
        </div>
        ${selected && sel.size === 1 ? `<div class="stk-row__actions">
          <button type="button" class="btn btn--ghost btn--xs btn--icon" data-move="-1" data-id="${s.id}" data-fk="up-${s.id}" aria-label="Переместить выше" title="Выше" ${i === 0 ? 'disabled' : ''}>${icon('arrowUp', { size: 14 })}</button>
          <button type="button" class="btn btn--ghost btn--xs btn--icon" data-move="1" data-id="${s.id}" data-fk="down-${s.id}" aria-label="Переместить ниже" title="Ниже" ${i === project.stickers.length - 1 ? 'disabled' : ''}>${icon('arrowDown', { size: 14 })}</button>
          <button type="button" class="btn btn--ghost btn--xs" data-dup="${s.id}">${icon('copy', { size: 14 })}Копия</button>
          <button type="button" class="btn btn--ghost btn--xs btn--danger-text" data-del="${s.id}">${icon('trash', { size: 14 })}Удалить</button>
        </div>` : ''}
      </li>`;
    }).join('');

    empty.innerHTML = project.stickers.length ? '' : `
      <div class="empty">
        <div class="empty__art">${icon('library', { size: 28 })}</div>
        <p class="empty__title">В проекте нет наклеек</p>
        <p class="empty__text">Выберите готовый шаблон или создайте свою надпись. Размеры задаются в миллиметрах.</p>
        <div class="empty__actions">
          <button class="btn btn--primary btn--sm" data-action="open-library">${icon('library', { size: 16 })}Открыть шаблоны</button>
          <button class="btn btn--ghost btn--sm" data-action="blank">${icon('plus', { size: 16 })}Своя наклейка</button>
        </div>
      </div>`;

    if (sel.size > 1) {
      bulk.hidden = false;
      bulk.innerHTML = `<span class="bulkbar__count">Выбрано: ${sel.size}</span>
        <button class="btn btn--ghost btn--xs" data-bulk="duplicate">${icon('copy', { size: 14 })}Копия</button>
        <button class="btn btn--ghost btn--xs btn--danger-text" data-bulk="delete">${icon('trash', { size: 14 })}Удалить</button>
        <button class="btn btn--ghost btn--xs btn--icon" data-bulk="clear" aria-label="Снять выбор" title="Снять выбор">${icon('close', { size: 14 })}</button>`;
    } else bulk.hidden = true;

    if (fk) list.querySelector(`[data-fk="${fk}"]`)?.focus();
    known = new Set(project.stickers.map((s) => s.id));
    if (!reduceMotion.matches && before.size) {
      const moved = [];
      for (const row of list.children) {
        const top = before.get(row.dataset.id);
        if (top === undefined) continue;
        const dy = top - row.getBoundingClientRect().top;
        if (Math.abs(dy) < 1) continue;
        row.style.transition = 'none';
        row.style.transform = `translateY(${dy}px)`;
        moved.push(row);
      }
      if (moved.length) {
        list.getBoundingClientRect();
        moved.forEach((r) => { r.style.transition = ''; r.style.transform = ''; });
      }
    }
  };

  const toggleSelect = (id, additive) => {
    const cur = store.ui.selection;
    if (additive) store.setUI({ selection: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
    else store.setUI({ selection: [id] });
  };

  // Tapping a sticker opens it in the editor (bottom sheet on mobile).
  on(list, 'click', '[data-select]', (e, el) => {
    const id = el.dataset.select;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    toggleSelect(id, additive);
    ctx.revealSticker(id);
    if (!additive) ctx.openEditor();
  });
  on(list, 'change', '[data-check]', (e, el) => toggleSelect(el.dataset.check, true));
  selectAll.addEventListener('change', () => {
    store.setUI({ selection: selectAll.checked ? store.project.stickers.map((s) => s.id) : [] });
  });

  const setQty = (id, v) => actions.updateField(store, [id], 'quantity', clamp(Math.round(v), ...LIMITS.quantity));
  on(list, 'click', '[data-qty]', (e, el) => {
    const s = store.project.stickers.find((x) => x.id === el.dataset.id);
    if (s) setQty(s.id, s.quantity + Number(el.dataset.qty));
  });
  on(list, 'change', '[data-qty-input]', (e, el) => {
    const v = parseNumber(el.value);
    if (!Number.isFinite(v) || v < 1) {
      el.setAttribute('aria-invalid', 'true');
      toast('Количество должно быть целым числом от 1 до 999', { type: 'warning' });
      return;
    }
    setQty(el.dataset.qtyInput, v);
  });
  on(list, 'click', '[data-move]', (e, el) => actions.move(store, el.dataset.id, Number(el.dataset.move)));
  on(list, 'click', '[data-dup]', (e, el) => actions.duplicate(store, [el.dataset.dup]));
  on(list, 'click', '[data-del]', (e, el) => ctx.deleteStickers([el.dataset.del]));
  on(root, 'click', '[data-action="add-more"], [data-action="open-library"]', () => ctx.showPanel('library'));
  on(root, 'click', '[data-action="blank"]', () => {
    const s = actions.addBlank(store);
    ctx.revealSticker(s.id);
    ctx.openEditor({ focusText: true });
  });
  on(bulk, 'click', '[data-bulk]', (e, el) => {
    const ids = store.ui.selection;
    if (el.dataset.bulk === 'duplicate') actions.duplicate(store, ids);
    if (el.dataset.bulk === 'delete') ctx.deleteStickers(ids);
    if (el.dataset.bulk === 'clear') store.setUI({ selection: [] });
  });

  // Drag-and-drop reordering (pointer devices). Keyboard users use the Выше/Ниже buttons.
  let dragId = null;
  list.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.stk-row');
    if (!row) return;
    dragId = row.dataset.id;
    row.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  list.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault();
    const row = e.target.closest('.stk-row');
    list.querySelectorAll('.drop-before, .drop-after').forEach((r) => r.classList.remove('drop-before', 'drop-after'));
    if (!row || row.dataset.id === dragId) return;
    const r = row.getBoundingClientRect();
    row.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  list.addEventListener('drop', (e) => {
    e.preventDefault();
    const row = e.target.closest('.stk-row');
    if (!dragId || !row || row.dataset.id === dragId) return;
    const ids = store.project.stickers.map((s) => s.id);
    let to = ids.indexOf(row.dataset.id);
    const from = ids.indexOf(dragId);
    if (row.classList.contains('drop-after')) to += 1;
    if (from < to) to -= 1;
    actions.reorder(store, dragId, to);
  });
  list.addEventListener('dragend', () => {
    dragId = null;
    list.querySelectorAll('.is-dragging, .drop-before, .drop-after').forEach((r) => r.classList.remove('is-dragging', 'drop-before', 'drop-after'));
  });

  render();
  store.subscribe((cur, prev) => {
    if (cur.doc.project !== prev.doc.project || cur.ui.selection !== prev.ui.selection) render();
  });
  ctx.fonts.onLoad(() => render());
}
