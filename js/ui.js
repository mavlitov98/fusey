// Shared UI primitives: interface icons, toasts, confirm dialog, small DOM helpers.

import { escapeXml } from './utils.js';

// Interface icons (24-unit grid, 1.75 stroke, round caps), consistent with the sticker set.
const UI_ICONS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  more: 'M12 5.5h.01M12 12h.01M12 18.5h.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.8-4.8',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  zoomIn: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.8-4.8M10.5 8v5M8 10.5h5',
  zoomOut: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.8-4.8M8 10.5h5',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  portrait: 'M7 3h10v18H7z',
  landscape: 'M3 7h18v10H3z',
  file: 'M14 3H6v18h12V7l-4-4ZM14 3v4h4',
  fileNew: 'M14 3H6v18h12V7l-4-4ZM14 3v4h4M12 11v6M9 14h6',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7M8 20v-6h8v6',
  bookmark: 'M6 4h12v17l-6-4-6 4z',
  reset: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.2 7.8 20 18M8.2 16.2 20 6',
  alert: 'M12 3.5 21.5 20H2.5ZM12 10v4.5M12 17.2h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  alignLeft: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  alignCenter: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  alignRight: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  swap: 'M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4',
  library: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  sheet: 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h3',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12ZM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z',
  design: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.8h.01',
  rotate: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  ruler: 'M3 16 16 3l5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2',
};

export function icon(name, { size = 18, label = null, cls = '' } = {}) {
  const d = UI_ICONS[name];
  const a11y = label ? `role="img" aria-label="${escapeXml(label)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="ui-icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${a11y}><path d="${d}"/></svg>`;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Delegated event listener: on(root, 'click', '[data-action]', (e, el) => ...). */
export function on(root, type, selector, handler, opts) {
  root.addEventListener(type, (e) => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) handler(e, el);
  }, opts);
}

/* ---------- Toasts ---------- */

export function toast(message, { type = 'info', timeout = 4000, action = null } = {}) {
  const region = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const ic = type === 'error' || type === 'warning' ? 'alert' : type === 'success' ? 'check' : 'info';
  el.innerHTML = `${icon(ic)}<span class="toast__msg"></span>`;
  el.querySelector('.toast__msg').textContent = message;
  if (action) {
    const b = document.createElement('button');
    b.className = 'btn btn--ghost btn--sm';
    b.textContent = action.label;
    b.addEventListener('click', () => { action.run(); dismiss(); });
    el.appendChild(b);
  }
  const close = document.createElement('button');
  close.className = 'icon-btn icon-btn--sm';
  close.setAttribute('aria-label', 'Закрыть уведомление');
  close.innerHTML = icon('close', { size: 16 });
  close.addEventListener('click', () => dismiss());
  el.appendChild(close);
  region.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  let t = timeout ? setTimeout(dismiss, timeout) : null;
  el.addEventListener('mouseenter', () => clearTimeout(t));
  el.addEventListener('mouseleave', () => { if (timeout) t = setTimeout(dismiss, 2000); });
  function dismiss() {
    clearTimeout(t);
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 200);
  }
  return dismiss;
}

/* ---------- Confirm dialog ---------- */

export function confirmDialog({ title, message, confirmLabel = 'Подтвердить', danger = false }) {
  const dlg = $('#confirmDialog');
  $('#confirmTitle', dlg).textContent = title;
  $('#confirmMessage', dlg).textContent = message;
  const ok = $('#confirmOk', dlg);
  ok.textContent = confirmLabel;
  ok.className = `btn ${danger ? 'btn--danger' : 'btn--primary'}`;
  return new Promise((resolve) => {
    const done = (v) => {
      dlg.removeEventListener('close', onClose);
      resolve(v);
    };
    const onClose = () => done(dlg.returnValue === 'ok');
    dlg.addEventListener('close', onClose);
    dlg.returnValue = '';
    dlg.showModal();
    $('#confirmCancel', dlg).focus();
  });
}

/** Prompt-like dialog with a single text field. Resolves with the string or null. */
export function promptDialog({ title, label, value = '', confirmLabel = 'Сохранить' }) {
  const dlg = $('#promptDialog');
  $('#promptTitle', dlg).textContent = title;
  $('#promptLabel', dlg).textContent = label;
  const input = $('#promptInput', dlg);
  input.value = value;
  $('#promptOk', dlg).textContent = confirmLabel;
  return new Promise((resolve) => {
    const onClose = () => {
      dlg.removeEventListener('close', onClose);
      resolve(dlg.returnValue === 'ok' && input.value.trim() ? input.value.trim() : null);
    };
    dlg.addEventListener('close', onClose);
    dlg.returnValue = '';
    dlg.showModal();
    input.select();
  });
}

/** Number stepper markup used across panels. */
export function stepper({ id, value, min, max, step = 1, label, action }) {
  return `<div class="stepper" data-stepper>
    <button type="button" class="icon-btn icon-btn--sm" data-step="-1" aria-label="Уменьшить: ${escapeXml(label)}">${icon('minus', { size: 16 })}</button>
    <input id="${id}" name="${id}" class="stepper__input" type="text" inputmode="numeric" value="${value}" data-min="${min}" data-max="${max}" data-stepv="${step}" ${action ? `data-action="${action}"` : ''} aria-label="${escapeXml(label)}">
    <button type="button" class="icon-btn icon-btn--sm" data-step="1" aria-label="Увеличить: ${escapeXml(label)}">${icon('plus', { size: 16 })}</button>
  </div>`;
}

export const isMobile = () => window.matchMedia('(max-width: 899px)').matches;

/**
 * Animated <details class="section"> accordions. The native toggle is instant,
 * so summary clicks are intercepted and the body height is animated with the
 * Web Animations API. Reduced motion keeps a short fade without movement.
 */
export function initAccordions(root = document) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  root.addEventListener('click', (e) => {
    const summary = e.target.closest('details.section > summary');
    if (!summary) return;
    const details = summary.parentElement;
    const body = details.querySelector(':scope > .section__body');
    if (!body) return;
    e.preventDefault();
    // An interrupted animation continues from wherever it is right now.
    const from = details._anim ? { h: body.getBoundingClientRect().height, o: Number(getComputedStyle(body).opacity) } : null;
    details._anim?.cancel();
    const opening = details.classList.contains('is-closing') || !details.open;
    details.open = true;
    details.classList.toggle('is-closing', !opening);
    // Measure the natural size (height includes padding: box-sizing is border-box).
    body.style.height = '';
    const cs = getComputedStyle(body);
    const full = { height: `${body.offsetHeight}px`, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: 1 };
    const zero = { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 };
    const start = from ? { ...(opening ? zero : full), height: `${from.h}px`, opacity: from.o } : (opening ? zero : full);
    const frames = reduce.matches ? [{ opacity: start.opacity }, { opacity: opening ? 1 : 0 }] : [start, opening ? full : zero];
    body.style.overflow = 'hidden';
    const anim = body.animate(frames, { duration: opening ? 240 : 190, easing: EASE });
    details._anim = anim;
    anim.onfinish = () => {
      if (!opening) details.open = false;
      details.classList.remove('is-closing');
      body.style.overflow = '';
      details._anim = null;
    };
  });
}

/**
 * Sliding thumb for every .segmented group. A MutationObserver catches checked
 * state changes, newly rendered groups and panels becoming visible, so the
 * component markup stays plain buttons with aria-checked.
 */
export function initSegmentedInk() {
  let raf = 0;
  const place = (group) => {
    let ink = group.querySelector(':scope > .segmented__ink');
    const fresh = !ink;
    if (fresh) {
      ink = document.createElement('span');
      ink.className = 'segmented__ink no-anim';
      ink.setAttribute('aria-hidden', 'true');
      group.prepend(ink);
      group.classList.add('has-ink');
    }
    const btn = group.querySelector('.segmented__btn[aria-checked="true"]');
    if (!btn || !btn.offsetWidth) { ink.style.opacity = btn ? ink.style.opacity : '0'; return; }
    // A group that just became visible jumps into place instead of sliding from 0.
    const wasHidden = ink.dataset.w === '0' || !ink.dataset.w;
    if (wasHidden) ink.classList.add('no-anim');
    ink.style.opacity = '1';
    ink.style.setProperty('--sx', `${btn.offsetLeft}px`);
    ink.style.setProperty('--sy', `${btn.offsetTop}px`);
    ink.style.setProperty('--sw', `${btn.offsetWidth}px`);
    ink.style.setProperty('--sh', `${btn.offsetHeight}px`);
    ink.dataset.w = String(btn.offsetWidth);
    if (fresh || wasHidden) requestAnimationFrame(() => requestAnimationFrame(() => ink.classList.remove('no-anim')));
  };
  const update = () => {
    raf = 0;
    document.querySelectorAll('.segmented').forEach((g) => {
      if (!g.offsetWidth) { const ink = g.querySelector(':scope > .segmented__ink'); if (ink) ink.dataset.w = '0'; return; }
      place(g);
    });
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-checked', 'data-left-tab', 'data-mview', 'open', 'hidden', 'class'] });
  window.addEventListener('resize', schedule);
  schedule();
}

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Smooth scroll that respects reduced motion. `target` is window or a scrolling element. */
export function smoothScrollTo(target, top) {
  target.scrollTo({ top: Math.max(0, top), behavior: reduceMotionQuery.matches ? 'auto' : 'smooth' });
}

/** Scroll position of the panel that holds `el`: the window on mobile, the panel on desktop. */
export function scrollerOf(el) {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return window;
}
