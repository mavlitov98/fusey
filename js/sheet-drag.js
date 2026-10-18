// Drag to rearrange on the sheet preview, sortable-style: while one printed copy
// is held, the others make room for it live, laid out exactly as the engine will
// lay them out; on release it glides into the free slot and only then the order
// is committed. Any single copy can move, the sticker list is not touched.
//
// Positions are never stored. The order goes to layout.copyOrder (orderCopies()
// in layout-engine.js). While dragging, the candidate order is laid out with the
// real engine and every item is CSS-translated from its start position to its
// candidate one, so what you see is what the drop will produce, in every layout.
//
// The slot is found in the frame of the drag's start (the positions before
// anything moved), so items sliding under the finger never make it flicker.
//
// Mouse: press and move a few pixels. Touch: long-press (one finger keeps
// scrolling, two fingers keep pinch zoom), then drag; the sheet auto-scrolls near
// the edges of the viewport.

import { actions } from './state.js';
import { clamp } from './utils.js';
import { computeLayout, copyKey, effectiveCopyOrder } from './layout-engine.js';

const LONG_PRESS_MS = 380;
const TOUCH_SLOP = 8; // px a finger may wander before the long-press gives way to scrolling
const MOUSE_SLOP = 4;
const EDGE = 56; // auto-scroll zone at the viewport edges, px; full speed at the edge
const SPEED = 16; // px per frame at full speed
const SETTLE = 200; // ms of the glide into the free slot before the commit

/**
 * @param {{ freezeNextRender(): void }} hooks  the commit re-renders the preview with
 *   items already in place, so its FLIP animation must not replay the move
 */
export function initSheetDrag({ store, stage, scroller, getScale, hooks }) {
  let pending = null; // press that may turn into a drag
  let drag = null; // active drag
  let settling = null; // drop glide in progress
  let suppressClickUntil = 0;

  const itemEl = (target) => (store.ui.viewMode === 'design' ? target.closest?.('.sheet-item[data-id]') : null);

  /** Floating copy of the grabbed sticker that follows the pointer. */
  const makeGhost = (el, it, scale) => {
    const inner = el.cloneNode(true);
    inner.querySelector('title')?.remove();
    inner.querySelector('.hit')?.remove();
    inner.removeAttribute('data-id');
    inner.setAttribute('transform', it.rotated ? `translate(${it.sh} 0) rotate(90)` : '');
    inner.querySelectorAll('[id]').forEach((n) => { n.id += '_drag'; });
    inner.querySelectorAll('[clip-path]').forEach((n) => n.setAttribute('clip-path', n.getAttribute('clip-path').replace(')', '_drag)')));
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${it.w} ${it.h}" width="${it.w * scale}" height="${it.h * scale}"><rect width="${it.w}" height="${it.h}" fill="#FFFFFF"/></svg>`;
    ghost.firstChild.appendChild(inner);
    document.body.appendChild(ghost);
    return ghost;
  };

  const activate = () => {
    const { el, x, y } = pending;
    pending = null;
    const svg = stage.querySelector('svg');
    const key = el.parentElement?.dataset.key;
    const project = store.project;
    const pageIdx = store.ui.page;
    const sheet = computeLayout(project);
    const page = sheet.pages[clamp(pageIdx, 0, Math.max(0, sheet.pages.length - 1))];
    const start = new Map((page ? page.items : []).map((i) => [copyKey(i), i]));
    const it = start.get(key);
    if (!it || !svg) return;
    const scale = getScale();
    const sr = svg.getBoundingClientRect();
    // Grab point inside the sticker, so it does not jump to the finger.
    const ox = x - (sr.left + it.x * scale), oy = y - (sr.top + it.y * scale);
    drag = {
      key, it, x, y, ox, oy, svg, project, pageIdx, start,
      order: effectiveCopyOrder(project),
      nodes: new Map([...stage.querySelectorAll('.sheet-anim')].map((g) => [g.dataset.key, g])),
      slot: null, result: null, raf: 0,
      ghost: makeGhost(el, it, scale),
    };
    drag.ghost.firstChild.style.transformOrigin = `${ox}px ${oy}px`;
    drag.nodes.get(key)?.classList.add('is-drag-source');
    svg.classList.add('is-sorting');
    document.body.classList.add('is-sheet-dragging');
    navigator.vibrate?.(8);
    update();
    drag.raf = requestAnimationFrame(tick);
  };

  /**
   * Slot under the pointer, in the start frame: the nearest other copy and whether
   * the held one goes before or after it in reading order. Gaps and empty paper
   * count too, so a copy can be dropped at the very end of the page.
   */
  const slotAt = () => {
    const scale = getScale();
    const sr = drag.svg.getBoundingClientRect();
    const px = (drag.x - sr.left) / scale, py = (drag.y - sr.top) / scale;
    let best = null, bestD = Infinity;
    for (const [k, it] of drag.start) {
      if (k === drag.key) continue;
      const dx = Math.max(it.x - px, 0, px - (it.x + it.w));
      const dy = Math.max(it.y - py, 0, py - (it.y + it.h));
      const d = Math.hypot(dx, dy);
      if (d < bestD) { bestD = d; best = it; }
    }
    if (!best) return null;
    return { key: copyKey(best), after: py > best.y + best.h || (py >= best.y && px > best.x + best.w / 2) };
  };

  /** Lays out the candidate order and slides every item to its place in it. */
  const reflow = (slot) => {
    const keys = drag.order.filter((k) => k !== drag.key);
    keys.splice(keys.indexOf(slot.key) + (slot.after ? 1 : 0), 0, drag.key);
    const { project } = drag;
    const sheet = computeLayout({ ...project, layout: { ...project.layout, copyOrder: keys } });
    const page = sheet.pages[drag.pageIdx];
    const next = new Map((page ? page.items : []).map((i) => [copyKey(i), i]));
    drag.nodes.forEach((g, k) => {
      const a = drag.start.get(k), b = next.get(k);
      // Copies pushed to another page fade where they stand.
      g.classList.toggle('is-pushed-out', !b);
      // CSS translate on an SVG element is in user units, i.e. millimetres here.
      g.style.transform = a && b && (a.x !== b.x || a.y !== b.y) ? `translate(${b.x - a.x}px, ${b.y - a.y}px)` : '';
    });
    const unchanged = keys.every((k, i) => k === drag.order[i]);
    drag.result = unchanged ? null : { keys, at: next.get(drag.key) || null };
  };

  const update = () => {
    drag.ghost.style.transform = `translate3d(${drag.x - drag.ox}px, ${drag.y - drag.oy}px, 0)`;
    const slot = slotAt();
    if (!slot || (drag.slot && slot.key === drag.slot.key && slot.after === drag.slot.after)) return;
    drag.slot = slot;
    reflow(slot);
    navigator.vibrate?.(4);
  };

  // Every frame while dragging: auto-scroll near the edges, then follow the pointer.
  const tick = () => {
    if (!drag) return;
    const r = scroller.getBoundingClientRect();
    const speed = (d) => (d < EDGE ? Math.round(((EDGE - Math.max(0, d)) / EDGE) ** 2 * SPEED) || 1 : 0);
    const dx = speed(r.right - drag.x) - speed(drag.x - r.left);
    const dy = speed(r.bottom - drag.y) - speed(drag.y - r.top);
    if (dx || dy) { scroller.scrollLeft += dx; scroller.scrollTop += dy; }
    update();
    drag.raf = requestAnimationFrame(tick);
  };

  /** Puts everything back without committing. */
  const restore = (d) => {
    d.nodes.forEach((g) => { g.style.transform = ''; g.classList.remove('is-pushed-out', 'is-drag-source'); });
    d.svg.classList.remove('is-sorting');
  };

  const finish = (drop) => {
    if (pending) { clearTimeout(pending.timer); pending = null; }
    if (!drag) return; // a plain tap: its click must still select / open the editor
    suppressClickUntil = performance.now() + 450;
    const d = drag;
    drag = null;
    cancelAnimationFrame(d.raf);
    document.body.classList.remove('is-sheet-dragging');
    if (!drop || !d.result || !d.result.at) {
      // Back to where it was: the ghost glides home while the others slide back.
      const scale = getScale(), sr = d.svg.getBoundingClientRect();
      glide(d.ghost, sr.left + d.it.x * scale, sr.top + d.it.y * scale);
      restore(d);
      setTimeout(() => d.ghost.remove(), SETTLE);
      return;
    }
    // Glide into the free slot, then commit the order the preview already shows.
    const scale = getScale(), sr = d.svg.getBoundingClientRect();
    glide(d.ghost, sr.left + d.result.at.x * scale, sr.top + d.result.at.y * scale);
    settling = setTimeout(() => {
      settling = null;
      hooks.freezeNextRender();
      actions.setProject(store, 'layout.copyOrder', d.result.keys, false);
      d.ghost.remove();
    }, SETTLE);
  };

  const glide = (ghost, x, y) => {
    ghost.classList.add('is-settling');
    ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  /* ---------- Touch: long-press, then drag ---------- */

  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { finish(false); return; }
    const el = !settling && itemEl(e.target);
    if (!el) return;
    const t = e.touches[0];
    pending = { el, x: t.clientX, y: t.clientY, timer: setTimeout(() => pending && activate(), LONG_PRESS_MS) };
  }, { passive: true });
  stage.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) { finish(false); return; }
    const t = e.touches[0];
    if (pending) {
      if (Math.hypot(t.clientX - pending.x, t.clientY - pending.y) > TOUCH_SLOP) { clearTimeout(pending.timer); pending = null; }
      return;
    }
    if (!drag) return;
    if (e.cancelable) e.preventDefault(); // the finger drags the sticker, not the page
    drag.x = t.clientX; drag.y = t.clientY;
    update();
  }, { passive: false });
  stage.addEventListener('touchend', (e) => { if (pending || drag) finish(e.touches.length === 0); });
  stage.addEventListener('touchcancel', () => finish(false));

  /* ---------- Mouse and pen: press and move ---------- */

  const onMove = (e) => {
    if (pending && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > MOUSE_SLOP) activate();
    if (drag) { drag.x = e.clientX; drag.y = e.clientY; update(); }
  };
  const onUp = (e) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    if (drag) { drag.x = e.clientX; drag.y = e.clientY; update(); finish(e.type === 'pointerup'); } else pending = null;
  };
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey || settling) return;
    const el = itemEl(e.target);
    if (!el) return;
    pending = { el, x: e.clientX, y: e.clientY, timer: 0 };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });

  // A drag ends without the click that would select the sticker or open the editor.
  stage.addEventListener('click', (e) => {
    if (performance.now() < suppressClickUntil) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  stage.addEventListener('contextmenu', (e) => { if (drag || pending) e.preventDefault(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag) finish(false); });
  window.addEventListener('blur', () => finish(false));

  return {
    /** The preview is about to replace its DOM; a drag cannot survive that. */
    cancel: () => { if (drag || pending) finish(false); },
  };
}
