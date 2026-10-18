// Application bootstrap and wiring.

import { createBrowserFontRegistry } from './fonts.js';
import { createStore, actions } from './state.js';
import { createLayoutCache } from './sticker-layout.js';
import { computeLayout } from './layout-engine.js';
import { loadSession, attachAutosave, clearSession, projectToJSON, projectFileName, parseProjectFile, downloadText } from './storage.js';
import { createProject } from './model.js';
import { initLibrary } from './library.js';
import { initStickerList } from './sticker-list.js';
import { initSheetSettings } from './sheet-settings.js';
import { initStickerEditor } from './sticker-editor.js';
import { initPreview } from './preview.js';
import { initExportDialog } from './export-dialog.js';
import { icon, on, toast, confirmDialog, isMobile, initAccordions, initSegmentedInk, smoothScrollTo, $, $$ } from './ui.js';
import { plural } from './utils.js';

const fonts = createBrowserFontRegistry();
const session = loadSession();
const store = createStore(session);
const layoutCache = createLayoutCache(fonts);

// Derived sheet layout, recomputed only when an input it depends on changes.
let sheetMemo = { key: null, value: null };
function getSheet() {
  const p = store.project;
  const key = [p.page, p.layout, p.cutLines, p.stickers];
  if (!sheetMemo.key || sheetMemo.key.some((k, i) => k !== key[i])) sheetMemo = { key, value: computeLayout(p) };
  return sheetMemo.value;
}

const ctx = {
  store,
  fonts,
  getSheet,
  getLayout: (s) => layoutCache.get(s, store.project.customIcons),
  addBlank: () => actions.addBlank(store),
  revealSticker: (id) => preview?.reveal(id),
  showPanel,
  openEditor,
  deleteStickers,
};

let preview = null;
let editor = null;

/* ---------- Panels: desktop tabs and the mobile step flow ---------- */

const MOBILE_VIEWS = ['library', 'stickers', 'sheet', 'preview'];

function showPanel(name) {
  if (isMobile()) store.setUI({ mobileView: name });
  else if (name !== 'preview') store.setUI({ leftTab: name });
}

function syncPanels() {
  const { leftTab, mobileView } = store.ui;
  $$('.tab[data-tab]').forEach((t) => {
    const active = t.dataset.tab === leftTab;
    t.setAttribute('aria-selected', String(active));
    t.tabIndex = active ? 0 : -1;
  });
  document.body.dataset.leftTab = leftTab;
  // Mobile steps slide in from the side they come from.
  const prev = MOBILE_VIEWS.indexOf(document.body.dataset.mview);
  const next = MOBILE_VIEWS.indexOf(mobileView);
  if (prev >= 0 && next >= 0 && prev !== next) document.body.style.setProperty('--step-dir', next > prev ? 1 : -1);
  // Each step scrolls inside its own panel and keeps its position, like native tabs.
  document.body.dataset.mview = mobileView;
  moveTabInk();
  $$('[data-mview-btn]').forEach((b) => b.setAttribute('aria-current', b.dataset.mviewBtn === mobileView ? 'page' : 'false'));
  moveNavInk(); // after aria-current is updated
}

/** Slides the tab indicator under the active tab. */
/** Slides the capsule behind the active mobile step. Whole-pixel offsets: no blur. */
function moveNavInk() {
  const ink = $('#navInk');
  const btn = $('.mobile-nav__btn[aria-current="page"]');
  if (!ink || !btn || !btn.offsetWidth) return;
  const first = !ink.dataset.ready;
  if (first) ink.classList.add('no-anim');
  ink.style.setProperty('--nx', `${Math.round(btn.offsetLeft)}px`);
  ink.style.setProperty('--ny', `${Math.round(btn.offsetTop)}px`);
  ink.style.setProperty('--nw', `${Math.round(btn.offsetWidth)}px`);
  ink.dataset.ready = '1';
  if (first) requestAnimationFrame(() => requestAnimationFrame(() => ink.classList.remove('no-anim')));
}

function moveTabInk() {
  const active = $('.tab[aria-selected="true"]');
  const ink = $('#tabsInk');
  if (!active || !ink || !active.offsetWidth) return;
  ink.style.setProperty('--ink-x', `${active.offsetLeft}px`);
  ink.style.setProperty('--ink-w', `${active.offsetWidth}px`);
}

function openEditor({ focusText = false } = {}) {
  if (!store.ui.selection.length) return;
  if (isMobile()) {
    if (!document.body.classList.contains('editor-open')) $('#inspector-body').scrollTo({ top: 0, behavior: 'instant' });
    document.body.classList.add('editor-open');
    $('#inspector').setAttribute('aria-modal', 'true');
    $('#inspector').setAttribute('role', 'dialog');
    setTimeout(() => (focusText ? editor.focusText() : $('#inspectorClose').focus({ focusVisible: false })), 60);
  } else if (focusText) {
    setTimeout(() => editor.focusText(), 0);
  }
}

/**
 * Mobile editor sheet: drag down to dismiss, from the header or from the body when it
 * is scrolled to the top (like native iOS sheets). The offset is written once per
 * frame, snapped to device pixels so text does not shimmer, and the scrim fades with
 * it. A quick flick dismisses even over a short distance.
 */
function initSheetSwipe() {
  const sheet = $('#inspector');
  const head = $('.inspector__head', sheet);
  const body = $('#inspector-body');
  const scrim = $('#sheetScrim');
  const dpr = window.devicePixelRatio || 1;
  let startY = null, dy = 0, raf = 0, samples = [], height = 1;

  const paint = () => {
    raf = 0;
    const y = Math.round(dy * dpr) / dpr;
    sheet.style.setProperty('--drag', `${y}px`);
    scrim.style.opacity = String(Math.min(1, Math.max(0, 1 - y / height)));
  };
  const begin = (y) => {
    startY = y; dy = 0; samples = [{ y, t: performance.now() }]; height = sheet.offsetHeight || 1;
    sheet.classList.add('is-dragging');
    scrim.classList.add('is-dragging');
  };
  const move = (y) => {
    const raw = y - startY;
    // Pulling up past the resting position meets growing resistance instead of a hard stop.
    dy = raw >= 0 ? raw : -Math.min(24, Math.sqrt(-raw) * 2);
    const t = performance.now();
    samples.push({ y, t });
    while (samples.length > 2 && t - samples[0].t > 100) samples.shift();
    if (!raf) raf = requestAnimationFrame(paint);
  };
  const end = () => {
    if (startY === null) return;
    startY = null;
    cancelAnimationFrame(raf); raf = 0;
    const first = samples[0], last = samples[samples.length - 1];
    const v = last && last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0; // px/ms
    sheet.classList.remove('is-dragging');
    scrim.classList.remove('is-dragging');
    scrim.style.opacity = '';
    if (dy > Math.min(140, height * 0.3) || (v > 0.5 && dy > 12)) closeEditor();
    // Removing the offset lets the transition carry the sheet from where the finger left it.
    sheet.style.removeProperty('--drag');
  };
  const canStart = () => isMobile() && document.body.classList.contains('editor-open');

  head.addEventListener('pointerdown', (e) => {
    if (!canStart() || e.target.closest('button') || e.button > 0) return;
    begin(e.clientY);
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => { if (startY !== null) move(e.clientY); });
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);

  // Body: scrolling wins until the content is at its top and the finger moves down.
  let touchY = null;
  body.addEventListener('touchstart', (e) => {
    touchY = canStart() && e.touches.length === 1 && body.scrollTop <= 0 ? e.touches[0].clientY : null;
  }, { passive: true });
  body.addEventListener('touchmove', (e) => {
    if (touchY === null) return;
    const y = e.touches[0].clientY;
    if (startY === null) {
      if (y - touchY < 6 || body.scrollTop > 0) { if (y < touchY) touchY = null; return; }
      begin(y);
    }
    e.preventDefault();
    move(y);
  }, { passive: false });
  const touchEnd = () => { touchY = null; end(); };
  body.addEventListener('touchend', touchEnd);
  body.addEventListener('touchcancel', touchEnd);
}

function closeEditor() {
  document.body.classList.remove('editor-open');
  $('#inspector').removeAttribute('aria-modal');
  $('#inspector').removeAttribute('role');
}

function deleteStickers(ids) {
  if (!ids.length) return;
  const n = ids.length;
  actions.remove(store, ids);
  closeEditor();
  toast(n === 1 ? 'Наклейка удалена' : `Удалено ${n} ${plural(n, ['наклейка', 'наклейки', 'наклеек'])}`, {
    action: { label: 'Отменить', run: () => store.undo() },
  });
}

/* ---------- Top bar ---------- */

/** Updates a counter and plays a short "bump" when the value actually changes. */
function bump(el, value) {
  const v = String(value);
  if (el.textContent === v) return;
  const first = el.textContent === '' || el.textContent === '0' && !el.dataset.ready;
  el.textContent = v;
  el.dataset.ready = '1';
  if (first) return;
  const stat = el.closest('.stat');
  stat.classList.remove('is-bumped');
  void stat.offsetWidth;
  stat.classList.add('is-bumped');
}

function initTopbar(exportDlg) {
  // The top-bar field on desktop and the one in the project menu on phones.
  const names = $$('[data-project-name]');
  names.forEach((name) => {
    name.value = store.project.name;
    name.addEventListener('input', () => actions.setProject(store, 'name', name.value.slice(0, 120) || 'Без названия', true));
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });
  });

  const undo = $('#undoBtn'), redo = $('#redoBtn');
  undo.addEventListener('click', () => store.undo());
  redo.addEventListener('click', () => store.redo());
  $$('[data-action="export"]').forEach((b) => b.addEventListener('click', () => exportDlg.open()));

  const sync = () => {
    const sheet = getSheet();
    const n = sheet.stats.requested;
    bump($('#statStickers'), n);
    $('#statStickersLabel').textContent = plural(n, ['наклейка', 'наклейки', 'наклеек']);
    bump($('#statPages'), sheet.stats.pageCount);
    $('#statPagesLabel').textContent = plural(sheet.stats.pageCount, ['лист', 'листа', 'листов']);
    $('#stickersTabCount').textContent = store.project.stickers.length || '';
    undo.disabled = !store.canUndo;
    redo.disabled = !store.canRedo;
    names.forEach((name) => { if (document.activeElement !== name) name.value = store.project.name; });
    $('#statErrors').hidden = !sheet.errors.length;
  };
  sync();
  store.subscribe((cur, prev) => { if (cur.doc !== prev.doc) sync(); });

  // Project menu
  const menuBtn = $('#menuBtn'), menu = $('#projectMenu');
  const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    // Focusing the name field on phones would pop the keyboard up uninvited.
    if (open) menu.querySelector('button').focus({ preventScroll: true });
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#projectMenu, #menuBtn')) closeMenu(); });
  menu.addEventListener('keydown', (e) => {
    if (e.target.matches('input')) { if (e.key === 'Enter') closeMenu(); if (e.key !== 'Escape') return; }
    const items = $$('button', menu);
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { closeMenu(); menuBtn.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  on(menu, 'click', '[data-menu]', async (e, el) => {
    closeMenu();
    switch (el.dataset.menu) {
      case 'new': {
        const ok = !store.project.stickers.length || await confirmDialog({ title: 'Создать новый проект?', message: 'Текущий проект будет закрыт. Сохраните его в JSON, если он понадобится. Пользовательские шаблоны останутся.', confirmLabel: 'Создать' });
        if (ok) { store.replace(createProject()); toast('Создан новый проект', { type: 'success' }); }
        break;
      }
      case 'export-json':
        downloadText(projectToJSON(store.project, store.customTemplates), projectFileName(store.project));
        toast('Проект сохранён в JSON', { type: 'success' });
        break;
      case 'import-json':
        $('#importFile').click();
        break;
      case 'reset': {
        const ok = await confirmDialog({ title: 'Сбросить все данные?', message: 'Проект, пользовательские шаблоны и иконки будут удалены из этого браузера. Действие нельзя отменить.', confirmLabel: 'Сбросить всё', danger: true });
        if (ok) { clearSession(); store.replace(createProject(), []); toast('Все данные сброшены'); }
        break;
      }
      default: break;
    }
  });

  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Файл слишком большой для проекта Fusey', { type: 'error' }); return; }
    try {
      const { project, customTemplates, warnings } = parseProjectFile(await file.text());
      const ok = !store.project.stickers.length || await confirmDialog({ title: 'Открыть проект из файла?', message: `«${project.name}»: ${project.stickers.length} ${plural(project.stickers.length, ['наклейка', 'наклейки', 'наклеек'])}. Текущий проект будет заменён.`, confirmLabel: 'Открыть' });
      if (!ok) return;
      const known = new Set(store.customTemplates.map((t) => t.id));
      store.replace(project, [...store.customTemplates, ...customTemplates.filter((t) => !known.has(t.id))]);
      toast(warnings.length ? `Проект открыт, но ${warnings.length} ${plural(warnings.length, ['элемент пропущен', 'элемента пропущено', 'элементов пропущено'])}: ${warnings[0]}` : `Проект «${project.name}» открыт`, { type: warnings.length ? 'warning' : 'success', timeout: 6000 });
    } catch (err) {
      toast(`Не удалось открыть файл: ${err.message}`, { type: 'error', timeout: 6000 });
    }
  });
}

/* ---------- Keyboard ---------- */

function initShortcuts(exportDlg) {
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z' && !typing) { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
    if (mod && k === 'y' && !typing) { e.preventDefault(); store.redo(); return; }
    if (mod && k === 'p') { e.preventDefault(); exportDlg.open(); return; }
    if (typing || document.querySelector('dialog[open]')) return;
    const sel = store.ui.selection;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); deleteStickers(sel); }
    else if (mod && k === 'd' && sel.length) { e.preventDefault(); actions.duplicate(store, sel); }
    else if (mod && k === 'a' && store.project.stickers.length) { e.preventDefault(); store.setUI({ selection: store.project.stickers.map((s) => s.id) }); }
    else if (e.key === 'Escape') { if (document.body.classList.contains('editor-open')) closeEditor(); else store.setUI({ selection: [] }); }
    else if (e.key === 'PageDown') { e.preventDefault(); store.setUI({ page: store.ui.page + 1 }); }
    else if (e.key === 'PageUp') { e.preventDefault(); store.setUI({ page: Math.max(0, store.ui.page - 1) }); }
  });
}

/* ---------- Page zoom guard ---------- */

// The app is a fixed-scale workspace: browser page zoom is disabled and the
// usual zoom gestures/shortcuts zoom the sheet preview instead.
function initZoomGuard() {
  document.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (['+', '=', '-', '_', '0'].includes(e.key) || ['NumpadAdd', 'NumpadSubtract', 'Numpad0'].includes(e.code)) {
      e.preventDefault();
      if (e.key === '0' || e.code === 'Numpad0') preview.fit();
      else preview.zoomBy(e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' ? 1 / 1.25 : 1.25);
    }
  });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  // Double-tap zoom is disabled in CSS (touch-action: manipulation) so fast taps still click.
}

/* ---------- Boot ---------- */

async function boot() {
  // Load the faces used by the project before the first paint so the first
  // layout is already measured with real glyph widths.
  const needed = new Set([['sans', 'bold'], ['sans', 'normal'], ...store.project.stickers.map((s) => [s.style.fontFamily, s.style.fontWeight])].map((x) => x.join(':')));
  const timeout = new Promise((r) => setTimeout(r, 5000));
  try {
    await Promise.race([Promise.all([...needed].map((k) => fonts.load(...k.split(':')))), timeout]);
  } catch {
    toast('Не удалось загрузить шрифты. Проверьте, что приложение открыто через локальный HTTP-сервер.', { type: 'error', timeout: 0 });
  }

  // Keep the current page index valid when the page count shrinks.
  store.subscribe((cur) => {
    const n = getSheet().pages.length;
    if (cur.ui.page > 0 && cur.ui.page >= n) store.setUI({ page: Math.max(0, n - 1) });
  });

  const exportDlg = initExportDialog(ctx);
  initLibrary(ctx);
  initStickerList(ctx);
  initSheetSettings(ctx);
  editor = initStickerEditor(ctx);
  preview = initPreview(ctx);
  initTopbar(exportDlg);
  initShortcuts(exportDlg);
  initZoomGuard();
  initAccordions();
  initSegmentedInk();
  initSheetSwipe();

  on($('#tabs'), 'click', '.tab[data-tab]', (e, el) => {
    if (store.ui.leftTab === el.dataset.tab) smoothScrollTo($(`#panel-${el.dataset.tab}`), 0);
    else showPanel(el.dataset.tab);
  });
  $('#tabs').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = $$('.tab[data-tab]');
    const i = tabs.findIndex((t) => t.dataset.tab === store.ui.leftTab) + (e.key === 'ArrowRight' ? 1 : -1);
    const next = tabs[(i + tabs.length) % tabs.length];
    showPanel(next.dataset.tab);
    next.focus();
  });
  // Tapping the current step scrolls smoothly back to the top (native tab-bar behaviour).
  on(document, 'click', '[data-mview-btn]', (e, el) => {
    closeEditor();
    const view = el.dataset.mviewBtn;
    if (store.ui.mobileView !== view) store.setUI({ mobileView: view });
    else if (view !== 'preview') smoothScrollTo($(`#panel-${view}`), 0);
  });
  $('#inspectorClose').addEventListener('click', closeEditor);
  $('#sheetScrim').addEventListener('click', closeEditor);
  store.subscribe((cur, prev) => {
    if (cur.ui.leftTab !== prev.ui.leftTab || cur.ui.mobileView !== prev.ui.mobileView) syncPanels();
    if (!cur.ui.selection.length && document.body.classList.contains('editor-open')) closeEditor();
  });
  window.matchMedia('(max-width: 899px)').addEventListener('change', () => { closeEditor(); preview.render(); moveTabInk(); moveNavInk(); });
  new ResizeObserver(moveTabInk).observe($('#tabs'));
  new ResizeObserver(() => { const ink = $('#navInk'); ink.dataset.ready = ''; moveNavInk(); }).observe($('.mobile-nav'));
  if (!MOBILE_VIEWS.includes(store.ui.mobileView)) store.setUI({ mobileView: 'library' });
  syncPanels();

  attachAutosave(store, () => toast('Не удалось сохранить проект в браузере: хранилище заполнено или недоступно. Экспортируйте проект в JSON.', { type: 'error', timeout: 0 }));
  session.notices.forEach((n) => toast(n, { type: 'warning', timeout: 8000 }));

  document.body.classList.remove('is-loading');
  $('#appLoading').remove();
  window.fusey = { store, getSheet, fonts }; // debugging / automated checks
}

boot().catch((err) => {
  console.error(err);
  const el = $('#appLoading');
  if (el) el.innerHTML = `<div class="callout callout--error" role="alert">${icon('alert', { size: 16 })}<span>Не удалось запустить Fusey: ${err.message}. Откройте приложение через локальный HTTP-сервер (см. README).</span></div>`;
});
