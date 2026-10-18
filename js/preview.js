// Sheet preview. The SVG viewBox is the physical page in millimetres; zoom only
// changes the rendered CSS size of the <svg>, never the geometry.

import { renderStickerGroup } from './svg-render.js';
import { icon, on, isMobile, $ } from './ui.js';
import { escapeXml, formatSize, clamp, plural } from './utils.js';

const PX_PER_MM = 96 / 25.4; // CSS reference pixel: 100% zoom ~ real size on a calibrated screen
const MIN_SCALE = 0.4, MAX_SCALE = 30;
const f = (n) => String(Math.round(n * 1000) / 1000);

export function initPreview(ctx) {
  const { store } = ctx;
  const scroller = $('#canvasScroll');
  const stage = $('#sheetStage');
  const alerts = $('#canvasAlerts');
  let fit = true;
  let scale = 2;
  // Previous item positions for FLIP animations (key = sticker id + copy index).
  let lastPos = null;
  let lastPage = null;
  let lastCutsD = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const fitScale = (W, H) => {
    const pad = isMobile() ? 24 : 56;
    const w = Math.max(100, scroller.clientWidth - pad * 2);
    const h = Math.max(100, scroller.clientHeight - pad * 2);
    return clamp(Math.min(w / W, h / H), MIN_SCALE, MAX_SCALE);
  };

  // While the workspace is hidden (mobile steps) rendering would use a 0-px viewport
  // and a wrong fit scale; skip it and render once when the workspace is shown.
  let dirty = false;
  const render = () => {
    if (!scroller.clientWidth) { dirty = true; return; }
    dirty = false;
    const { project, ui } = store;
    const sheet = ctx.getSheet();
    const W = sheet.area.pageWidth, H = sheet.area.pageHeight;
    const pageCount = sheet.pages.length;
    const pageIdx = clamp(ui.page, 0, Math.max(0, pageCount - 1));
    const page = sheet.pages[pageIdx];
    const design = ui.viewMode === 'design';
    if (fit) scale = fitScale(W, H);

    const byId = new Map(project.stickers.map((s) => [s.id, s]));
    let items = '';
    (page ? page.items : []).forEach((it, n) => {
      const s = byId.get(it.stickerId);
      const L = ctx.getLayout(s);
      const tf = it.rotated ? `translate(${f(it.x + it.sh)} ${f(it.y)}) rotate(90)` : `translate(${f(it.x)} ${f(it.y)})`;
      items += `<g class="sheet-anim" data-key="${s.id}:${it.copy}"><g class="sheet-item" data-id="${s.id}" transform="${tf}"><title>${escapeXml([s.text, ...s.lines].filter(Boolean).join(', ') || 'Без текста')}, ${formatSize(s.width, s.height)}</title>`
        + renderStickerGroup(L, `cp${pageIdx}_${n}`)
        + `<rect class="hit" width="${f(L.width)}" height="${f(L.height)}"/></g></g>`;
    });

    const cl = project.cutLines;
    let cuts = '';
    if (cl.enabled && page) {
      const dash = cl.style === 'dashed' ? ` stroke-dasharray="${f(cl.dash)} ${f(cl.dash * 0.75)}"` : '';
      cuts = `<path class="cut-lines" d="${page.cuts.map((c) => `M${f(c.x1)} ${f(c.y1)}L${f(c.x2)} ${f(c.y2)}`).join('')}" fill="none" stroke="${cl.color}" stroke-width="${f(cl.width)}" stroke-linecap="butt"${dash}/>`;
    }
    const a = sheet.area;
    const margin = design && a.w > 0 && a.h > 0
      ? `<rect class="margin-guide" x="${f(a.x)}" y="${f(a.y)}" width="${f(a.w)}" height="${f(a.h)}" vector-effect="non-scaling-stroke"/>` : '';

    const label = `Лист ${pageIdx + 1} из ${Math.max(1, pageCount)}, ${formatSize(W, H)}, ${page ? page.items.length : 0} ${plural(page ? page.items.length : 0, ['наклейка', 'наклейки', 'наклеек'])}`;
    // Keep the outgoing nodes so removed stickers can fade out instead of vanishing.
    const oldNodes = new Map([...stage.querySelectorAll('.sheet-anim')].map((g) => [g.dataset.key, g]));
    stage.innerHTML = `<svg class="sheet${design ? ' is-design' : ' is-print'}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W * scale)}" height="${f(H * scale)}" role="img" aria-label="${escapeXml(label)}">`
      + `<rect class="paper" width="${f(W)}" height="${f(H)}" fill="#FFFFFF"/>`
      + margin + `<g class="items">${items}</g>` + cuts + `<g class="overlay">${overlayMarkup(page, byId, design)}</g>`
      + '</svg>';

    animate(page, pageIdx, oldNodes);
    renderEmpty(project, sheet);
    renderChrome(sheet, pageIdx, pageCount);
  };

  /** Selection and overflow outlines; UI-only, never part of the PDF. */
  const overlayMarkup = (page, byId, design) => {
    if (!design || !page) return '';
    const sel = new Set(store.ui.selection);
    let out = '';
    for (const it of page.items) {
      const s = byId.get(it.stickerId);
      const box = `x="${f(it.x)}" y="${f(it.y)}" width="${f(it.w)}" height="${f(it.h)}" vector-effect="non-scaling-stroke"`;
      // Dark halo + accent stroke keeps the selection visible on white and on coloured stickers.
      if (sel.has(s.id)) out += `<rect class="sel-outline-bg" ${box}/><rect class="sel-outline" ${box}/>`;
      else if (ctx.getLayout(s).overflow) out += `<rect class="warn-outline" ${box}/>`;
    }
    return out;
  };

  /** Selection change only: refresh the overlay so running animations are not interrupted. */
  const renderSelection = () => {
    if (!scroller.clientWidth) { dirty = true; return; }
    const g = stage.querySelector('.overlay');
    if (!g) return render();
    const sheet = ctx.getSheet();
    const page = sheet.pages[clamp(store.ui.page, 0, Math.max(0, sheet.pages.length - 1))];
    g.innerHTML = overlayMarkup(page, new Map(store.project.stickers.map((s) => [s.id, s])), store.ui.viewMode === 'design');
  };

  /**
   * FLIP: items that moved start at their old position and glide to the new one;
   * new items scale in; switching pages slides the sheet in from the side.
   */
  const animate = (page, pageIdx, oldNodes) => {
    const svg = stage.querySelector('svg');
    const pos = new Map((page ? page.items : []).map((it) => [`${it.stickerId}:${it.copy}`, { x: it.x, y: it.y }]));
    const cuts = svg.querySelector('.cut-lines');
    const cutsD = cuts ? cuts.getAttribute('d') : null;
    if (lastPage !== null && lastPage !== pageIdx) {
      svg.style.setProperty('--dir', pageIdx > lastPage ? 1 : -1);
      svg.classList.add('is-page-in');
    } else {
      const moved = [];
      let entering = 0;
      svg.querySelectorAll('.sheet-anim').forEach((g) => {
        const prev = lastPos ? lastPos.get(g.dataset.key) : null;
        const cur = pos.get(g.dataset.key);
        if (!prev) {
          g.classList.add('is-entering');
          g.style.animationDelay = `${Math.min(entering++, 24) * (lastPos ? 30 : 12)}ms`;
        } else if (!reduceMotion.matches && (Math.abs(prev.x - cur.x) > 1e-3 || Math.abs(prev.y - cur.y) > 1e-3)) {
          // CSS translate on an SVG element is in user units, i.e. millimetres here.
          g.style.transition = 'none';
          g.style.transform = `translate(${prev.x - cur.x}px, ${prev.y - cur.y}px)`;
          moved.push(g);
        }
      });
      if (moved.length) {
        svg.getBoundingClientRect(); // commit the start position before transitioning
        moved.forEach((g) => { g.style.transition = ''; g.style.transform = ''; });
      }
      if (cuts && lastCutsD !== null && cutsD !== lastCutsD) cuts.classList.add('is-fresh');
      // Removed stickers: re-insert the old node as a non-interactive ghost that fades out.
      const layer = svg.querySelector('.items');
      oldNodes.forEach((node, key) => {
        if (pos.has(key)) return;
        node.classList.remove('is-entering');
        node.classList.add('is-leaving');
        node.style.transform = '';
        node.querySelectorAll('[id]').forEach((el) => { el.id += '_ghost'; });
        node.querySelectorAll('[clip-path]').forEach((el) => el.setAttribute('clip-path', el.getAttribute('clip-path').replace(')', '_ghost)')));
        node.querySelector('.sheet-item')?.removeAttribute('data-id');
        layer.appendChild(node);
        setTimeout(() => node.remove(), 240);
      });
    }
    lastPos = pos;
    lastPage = pageIdx;
    lastCutsD = cutsD;
  };

  const renderEmpty = (project, sheet) => {
    const el = $('#canvasEmpty');
    if (project.stickers.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div class="empty empty--canvas">
      <div class="empty__art">${icon('sheet', { size: 30 })}</div>
      <p class="empty__title">Лист пуст</p>
      <p class="empty__text">Добавьте наклейки из библиотеки шаблонов или создайте свою. Раскладка на листе ${formatSize(sheet.area.pageWidth, sheet.area.pageHeight)} строится автоматически.</p>
      <div class="empty__actions">
        <button class="btn btn--primary" data-cv="library">${icon('library', { size: 16 })}Открыть шаблоны</button>
        <button class="btn btn--ghost" data-cv="blank">${icon('plus', { size: 16 })}Своя наклейка</button>
      </div>
    </div>`;
  };

  const bumpText = (el, text) => {
    if (el.textContent === text) return;
    const had = el.textContent !== '' && el.dataset.ready;
    el.textContent = text;
    el.dataset.ready = '1';
    if (!had) return;
    el.classList.remove('is-bumped');
    void el.offsetWidth;
    el.classList.add('is-bumped');
  };

  const renderChrome = (sheet, pageIdx, pageCount) => {
    bumpText($('#pageLabel'), `${pageCount ? pageIdx + 1 : 0} / ${pageCount}`);
    $('#pagePrev').disabled = pageIdx <= 0;
    $('#pageNext').disabled = pageIdx >= pageCount - 1;
    bumpText($('#zoomLabel'), `${Math.round((scale / PX_PER_MM) * 100)}%`);
    $('#zoomFit').setAttribute('aria-pressed', String(fit));
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.view === store.ui.viewMode)));
    $('#sheetInfo').textContent = `${formatSize(sheet.area.pageWidth, sheet.area.pageHeight)} · заполнено ${Math.round(sheet.stats.usage * 100)}%`;

    const msgs = sheet.errors.map((e) => `<div class="callout callout--error" role="alert">${icon('alert', { size: 16 })}<span><strong>Не помещается.</strong> ${escapeXml(e.message)} ${escapeXml(e.hint || '')}</span>${e.stickerId ? `<button class="btn btn--ghost btn--sm" data-fix="${e.stickerId}">Изменить</button>` : ''}</div>`);
    alerts.innerHTML = msgs.join('');
    alerts.hidden = !msgs.length;
  };

  /* ---------- Zoom ---------- */

  const setScale = (next, anchor) => {
    const prev = scale;
    next = clamp(next, MIN_SCALE, MAX_SCALE);
    if (Math.abs(next - prev) < 1e-6) return;
    const rect = scroller.getBoundingClientRect();
    const ax = anchor ? anchor.x - rect.left : scroller.clientWidth / 2;
    const ay = anchor ? anchor.y - rect.top : scroller.clientHeight / 2;
    const svg = stage.querySelector('svg');
    const sr = svg.getBoundingClientRect();
    // Point under the anchor in sheet millimetres, kept fixed while zooming.
    const mmX = (ax + rect.left - sr.left) / prev;
    const mmY = (ay + rect.top - sr.top) / prev;
    fit = false;
    scale = next;
    render();
    const sr2 = stage.querySelector('svg').getBoundingClientRect();
    scroller.scrollLeft += (sr2.left + mmX * scale) - (rect.left + ax);
    scroller.scrollTop += (sr2.top + mmY * scale) - (rect.top + ay);
  };

  $('#zoomIn').addEventListener('click', () => setScale(scale * 1.25));
  $('#zoomOut').addEventListener('click', () => setScale(scale / 1.25));
  $('#zoomFit').addEventListener('click', () => { fit = true; render(); });
  $('#zoomLabel').addEventListener('click', () => setScale(PX_PER_MM)); // 100% = physical size
  scroller.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setScale(scale * Math.exp(-e.deltaY * 0.002), { x: e.clientX, y: e.clientY });
  }, { passive: false });

  /*
   * Two-finger pinch zoom on touch screens (one finger keeps native scrolling).
   * Touch events, not pointer events: iOS cancels pointers once it starts a native
   * pan and sometimes drops pointerup, and a stale pointer map left pinch dead until
   * reload. `e.touches` is the real list of fingers on every event, so the state can
   * not drift. During the gesture the stage is only CSS-transformed (compositor, one
   * write per frame); the SVG is re-rendered once at the new scale when it ends.
   */
  let pinch = null, pinchRaf = 0;
  const touchInfo = (t) => {
    const [a, b] = [t[0], t[1]];
    return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  };
  const pinchScale = () => clamp(pinch.s * (pinch.cur.d / pinch.start.d), MIN_SCALE, MAX_SCALE);
  const paintPinch = () => {
    pinchRaf = 0;
    if (!pinch) return;
    const k = pinchScale() / pinch.s;
    stage.style.transform = `translate3d(${pinch.cur.x - pinch.start.x}px, ${pinch.cur.y - pinch.start.y}px, 0) scale(${k})`;
  };
  const startPinch = (touches) => {
    const svg = stage.querySelector('svg');
    if (!svg) return;
    const start = touchInfo(touches);
    const st = stage.getBoundingClientRect(), sr = svg.getBoundingClientRect();
    // Sheet point (mm) under the fingers' midpoint; it stays under the midpoint.
    pinch = { s: scale, start, cur: start, mmX: (start.x - sr.left) / scale, mmY: (start.y - sr.top) / scale };
    stage.style.transformOrigin = `${start.x - st.left}px ${start.y - st.top}px`;
    stage.style.willChange = 'transform';
  };
  const endPinch = () => {
    if (!pinch) return;
    cancelAnimationFrame(pinchRaf); pinchRaf = 0;
    const { mmX, mmY, cur } = pinch;
    const next = pinchScale();
    pinch = null;
    stage.style.transform = '';
    stage.style.transformOrigin = '';
    stage.style.willChange = '';
    fit = false;
    scale = next;
    render();
    const sr = stage.querySelector('svg').getBoundingClientRect();
    scroller.scrollLeft += sr.left + mmX * scale - cur.x;
    scroller.scrollTop += sr.top + mmY * scale - cur.y;
  };
  scroller.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) startPinch(e.touches);
    else if (e.touches.length > 2) endPinch();
  }, { passive: true });
  scroller.addEventListener('touchmove', (e) => {
    if (!pinch) {
      // A second finger can land while iOS is already scrolling; pick the gesture up here.
      if (e.touches.length !== 2) return;
      startPinch(e.touches);
      if (!pinch) return;
    }
    if (e.touches.length !== 2) { endPinch(); return; }
    if (e.cancelable) e.preventDefault();
    pinch.cur = touchInfo(e.touches);
    if (!pinchRaf) pinchRaf = requestAnimationFrame(paintPinch);
  }, { passive: false });
  scroller.addEventListener('touchend', (e) => { if (e.touches.length < 2) endPinch(); });
  scroller.addEventListener('touchcancel', endPinch);
  // Safety net: a gesture interrupted by the system (app switch, notification) never strands the stage.
  window.addEventListener('blur', endPinch);
  document.addEventListener('visibilitychange', endPinch);

  /* ---------- Pages, modes, selection ---------- */

  $('#pagePrev').addEventListener('click', () => store.setUI({ page: Math.max(0, store.ui.page - 1) }));
  $('#pageNext').addEventListener('click', () => store.setUI({ page: store.ui.page + 1 }));
  on(document, 'click', '[data-view]', (e, el) => store.setUI({ viewMode: el.dataset.view }));

  stage.addEventListener('click', (e) => {
    if (store.ui.viewMode !== 'design') return;
    const g = e.target.closest('.sheet-item');
    if (!g) {
      if (e.target.closest('svg')) store.setUI({ selection: [] });
      return;
    }
    const id = g.dataset.id;
    const cur = store.ui.selection;
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      store.setUI({ selection: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
    } else {
      store.setUI({ selection: [id] });
      if (isMobile()) ctx.openEditor();
    }
  });
  stage.addEventListener('dblclick', (e) => {
    if (e.target.closest('.sheet-item')) ctx.openEditor({ focusText: true });
  });
  on(alerts, 'click', '[data-fix]', (e, el) => {
    store.setUI({ selection: [el.dataset.fix] });
    ctx.openEditor();
  });
  on($('#canvasEmpty'), 'click', '[data-cv]', (e, el) => {
    if (el.dataset.cv === 'library') ctx.showPanel('library');
    else { const s = ctx.addBlank(); ctx.revealSticker(s.id); ctx.openEditor({ focusText: true }); }
  });

  new ResizeObserver(() => { if (fit || dirty) render(); }).observe(scroller);

  store.subscribe((cur, prev) => {
    if (cur.doc.project !== prev.doc.project || cur.ui.page !== prev.ui.page || cur.ui.viewMode !== prev.ui.viewMode) render();
    else if (cur.ui.selection !== prev.ui.selection) renderSelection();
  });
  ctx.fonts.onLoad(() => render());
  render();

  return {
    render,
    zoomBy: (k) => setScale(scale * k),
    fit: () => { fit = true; render(); },
    /** Switches to the page that holds the first copy of a sticker. */
    reveal(id) {
      const sheet = ctx.getSheet();
      const idx = sheet.pages.findIndex((p) => p.items.some((i) => i.stickerId === id));
      if (idx >= 0 && idx !== store.ui.page) store.setUI({ page: idx });
    },
  };
}
