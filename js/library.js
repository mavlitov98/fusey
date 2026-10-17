// Template library: categories, search, visual cards, one-tap add.

import { BUILTIN_TEMPLATES, CATEGORIES } from './templates.js';
import { ICONS } from './icons.js';
import { actions } from './state.js';
import { stickerThumbnailSVG } from './svg-render.js';
import { icon, on, stepper, toast, confirmDialog, isMobile, smoothScrollTo, scrollerOf, $ } from './ui.js';
import { escapeXml, formatSize, clamp, parseNumber } from './utils.js';

export function initLibrary(ctx) {
  const { store } = ctx;
  const root = $('#panel-library');
  root.innerHTML = `
    <div class="panel-head">
      <div class="search">
        ${icon('search', { size: 16 })}
        <label class="sr-only" for="tplSearch">Поиск шаблонов</label>
        <input id="tplSearch" type="search" placeholder="Поиск: кухня, бойлер…" autocomplete="off">
      </div>
      <div class="chips chips--scroll" id="tplCats" role="radiogroup" aria-label="Категории шаблонов"></div>
      <div class="lib-tools">
        <div class="lib-qty">
          <span class="field-label" id="addQtyLabel">Добавлять по</span>
          ${stepper({ id: 'addQty', value: store.ui.addQty, min: 1, max: 99, label: 'Количество экземпляров при добавлении' })}
        </div>
        <button class="btn btn--ghost btn--sm" data-action="blank">${icon('plus', { size: 16 })}Своя наклейка</button>
      </div>
    </div>
    <div class="tpl-grid" id="tplGrid"></div>`;

  const grid = $('#tplGrid', root);
  const cats = $('#tplCats', root);
  const search = $('#tplSearch', root);

  const renderCats = () => {
    const cur = store.ui.category;
    const all = [{ id: 'all', label: 'Все' }, ...CATEGORIES];
    cats.innerHTML = all.map((c) => `<button type="button" class="chip${c.id === cur ? ' is-active' : ''}" role="radio" aria-checked="${c.id === cur}" data-cat="${c.id}">${escapeXml(c.label)}</button>`).join('');
  };

  const templateList = () => [...BUILTIN_TEMPLATES, ...store.customTemplates.map((t) => ({ ...t, category: 'custom' }))];

  const matches = (t, q) => {
    if (!q) return true;
    const cat = CATEGORIES.find((c) => c.id === t.category)?.label || '';
    const ic = t.icon.id ? ICONS.get(t.icon.id)?.label || '' : '';
    return `${t.name} ${t.text} ${cat} ${ic}`.toLowerCase().includes(q);
  };

  let animTimer = null;
  /** Staggered entrance, only when the visible set changes (filter, search). */
  const animateGrid = () => {
    grid.classList.remove('is-anim');
    void grid.offsetWidth;
    grid.classList.add('is-anim');
    clearTimeout(animTimer);
    animTimer = setTimeout(() => grid.classList.remove('is-anim'), 1000);
  };

  const renderGrid = () => {
    const q = store.ui.search.trim().toLowerCase();
    const cat = store.ui.category;
    const list = templateList().filter((t) => (cat === 'all' || t.category === cat) && matches(t, q));
    if (!list.length) {
      grid.innerHTML = `<div class="empty empty--compact">${icon('search', { size: 22 })}<p class="empty__title">Ничего не найдено</p><p class="empty__text">${cat === 'custom' && !q ? 'Сохраните настроенную наклейку как шаблон, и она появится здесь.' : 'Измените запрос или создайте свою наклейку.'}</p><button class="btn btn--ghost btn--sm" data-action="blank">${icon('plus', { size: 16 })}Создать наклейку</button></div>`;
      return;
    }
    grid.innerHTML = list.map((t, i) => {
      const L = ctx.getLayout(t);
      const custom = !t.builtin;
      return `<div class="tpl-card${custom ? ' tpl-card--custom' : ''}" style="--i:${Math.min(i, 18)}">
        <button type="button" class="tpl-card__main" data-tpl="${t.id}" aria-label="Добавить «${escapeXml(t.name)}», ${formatSize(t.width, t.height)}">
          <span class="tpl-card__thumb">${stickerThumbnailSVG(L, { title: t.name })}</span>
          <span class="tpl-card__name">${escapeXml(t.name)}</span>
          <span class="tpl-card__meta">${formatSize(t.width, t.height, store.project.displayUnit)}</span>
        </button>
        ${custom ? `<button type="button" class="icon-btn icon-btn--sm tpl-card__del" data-del-tpl="${t.id}" aria-label="Удалить шаблон «${escapeXml(t.name)}»">${icon('trash', { size: 15 })}</button>` : ''}
      </div>`;
    }).join('');
  };

  let holdTimer = null;
  on(cats, 'click', '[data-cat]', (e, el) => {
    // If the list was scrolled past its start, glide back so the new category is seen from the top.
    const scroller = scrollerOf(grid);
    const gridTop = grid.getBoundingClientRect().top;
    const headBottom = root.querySelector('.panel-head').getBoundingClientRect().bottom;
    const viewTop = scroller === window ? headBottom : Math.max(scroller.getBoundingClientRect().top, headBottom);
    const offset = gridTop - viewTop;
    if (offset < 0) {
      // Hold the old height while gliding up; otherwise the shorter list would make
      // the browser clamp the scroll position and the page would jump.
      grid.style.minHeight = `${grid.offsetHeight}px`;
      const cur = scroller === window ? window.scrollY : scroller.scrollTop;
      smoothScrollTo(scroller, cur + offset);
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => { grid.style.minHeight = ''; }, 700);
    }
    store.setUI({ category: el.dataset.cat });
    const chip = cats.querySelector(`[data-cat="${el.dataset.cat}"]`);
    if (chip) cats.scrollTo({ left: chip.offsetLeft - (cats.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' });
  });
  // Vertical mouse wheel scrolls the category row sideways.
  cats.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.ctrlKey) return;
    e.preventDefault();
    cats.scrollLeft += e.deltaY;
  }, { passive: false });
  search.addEventListener('input', () => store.setUI({ search: search.value }));

  on(root, 'click', '[data-tpl]', (e, el) => {
    const t = templateList().find((x) => x.id === el.dataset.tpl);
    if (!t) return;
    const s = actions.addFromTemplate(store, t, store.ui.addQty);
    el.closest('.tpl-card').classList.remove('is-added');
    void el.offsetWidth; // restart the confirmation animation
    el.closest('.tpl-card').classList.add('is-added');
    ctx.revealSticker(s.id);
    if (isMobile()) {
      toast(`Добавлено: ${t.name}${s.quantity > 1 ? ` × ${s.quantity}` : ''}`, { type: 'success', timeout: 2500, action: { label: 'Изменить', run: () => ctx.openEditor() } });
    }
  });

  on(root, 'click', '[data-action="blank"]', () => {
    const s = actions.addBlank(store);
    ctx.revealSticker(s.id);
    ctx.openEditor({ focusText: true });
  });

  on(root, 'click', '[data-del-tpl]', async (e, el) => {
    const t = store.customTemplates.find((x) => x.id === el.dataset.delTpl);
    if (!t) return;
    const ok = await confirmDialog({ title: 'Удалить шаблон?', message: `Шаблон «${t.name}» будет удалён из библиотеки. Уже добавленные наклейки не изменятся.`, confirmLabel: 'Удалить', danger: true });
    if (ok) actions.deleteTemplate(store, t.id);
  });

  bindStepper($('#addQty', root).closest('[data-stepper]'), (v) => store.setUI({ addQty: v }));

  renderCats();
  renderGrid();
  animateGrid();

  store.subscribe((cur, prev) => {
    if (cur.ui.category !== prev.ui.category) { renderCats(); renderGrid(); animateGrid(); return; }
    if (cur.ui.search !== prev.ui.search) { renderGrid(); animateGrid(); return; }
    if (cur.doc.customTemplates !== prev.doc.customTemplates
      || cur.doc.project.displayUnit !== prev.doc.project.displayUnit || cur.doc.project.customIcons !== prev.doc.project.customIcons) renderGrid();
  });
  ctx.fonts.onLoad(() => renderGrid());
}

/** Wires a stepper: -/+ buttons and typed input, clamped to data-min/max. */
export function bindStepper(el, onChange) {
  const input = el.querySelector('input');
  const min = Number(input.dataset.min), max = Number(input.dataset.max), step = Number(input.dataset.stepv || 1);
  const commit = (v) => {
    const n = clamp(Math.round(v), min, max);
    input.value = n;
    input.removeAttribute('aria-invalid');
    onChange(n);
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    const cur = parseNumber(input.value);
    commit((Number.isFinite(cur) ? cur : min) + Number(b.dataset.step) * step);
  });
  input.addEventListener('change', () => {
    const v = parseNumber(input.value);
    if (!Number.isFinite(v)) { input.setAttribute('aria-invalid', 'true'); return; }
    commit(v);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const cur = parseNumber(input.value);
      commit((Number.isFinite(cur) ? cur : min) + (e.key === 'ArrowUp' ? step : -step));
    }
  });
}
