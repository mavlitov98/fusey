// Export dialog: job summary, validation, filename and the actual PDF download.

import { exportPdf, defaultFileName, PdfExportError } from './pdf-export.js';
import { exportPreviewJpg } from './preview-export.js';
import { actions } from './state.js';
import { icon, toast, $ } from './ui.js';
import { escapeXml, formatSize, formatLength, plural } from './utils.js';
import { PAGE_FORMATS } from './model.js';

export function initExportDialog(ctx) {
  const { store } = ctx;
  const dlg = $('#exportDialog');
  const body = $('#exportBody');
  const btn = $('#exportGo');
  const previewBtn = $('#exportPreview');
  const nameInput = $('#exportName');
  const status = $('#exportStatus');
  let busy = false;

  // Static part built once: re-creating the switch on every project change made it
  // jump to its new state instead of sliding. Only the summary is re-rendered.
  body.innerHTML = `
    <dl class="stats stats--export" id="exportStats"></dl>
    <div class="export-issues" id="exportIssues"></div>
    <label class="switch switch--inline">
      <span class="switch__text"><span class="field-label">Линии реза</span><span class="field-hint">Тонкие линии по контуру наклеек</span></span>
      <input type="checkbox" role="switch" id="exportCuts">
      <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
    </label>
    <div class="print-hint">
      ${icon('print', { size: 18 })}
      <div>
        <p><strong>Для сохранения размеров печатайте в масштабе 100%</strong></p>
        <p class="field-hint">Итоговая точность зависит также от принтера и его непечатаемых полей. Проверьте размер первой наклейки линейкой.</p>
      </div>
    </div>`;
  const stats$ = $('#exportStats', body), issues$ = $('#exportIssues', body);
  const patch = (el, html) => { if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } };
  const cuts = $('#exportCuts', body);
  cuts.addEventListener('change', () => actions.setProject(store, 'cutLines.enabled', cuts.checked, false));

  const render = () => {
    const p = store.project;
    const sheet = ctx.getSheet();
    const { stats } = sheet;
    const overflow = p.stickers.filter((s) => ctx.getLayout(s).overflow);
    const glyphs = p.stickers.filter((s) => ctx.getLayout(s).warnings.some((w) => w.code === 'glyphs'));
    const fmt = PAGE_FORMATS[p.page.format]?.label || p.page.format;

    const rows = [
      ['Формат', `${fmt}, ${formatSize(stats.pageWidth, stats.pageHeight)}, ${p.page.orientation === 'portrait' ? 'книжная' : 'альбомная'}`],
      ['Страниц', String(stats.pageCount)],
      ['Наклеек', `${stats.placed} ${plural(stats.placed, ['копия', 'копии', 'копий'])} (${p.stickers.length} ${plural(p.stickers.length, ['вид', 'вида', 'видов'])})`],
      ['Линии реза', p.cutLines.enabled ? `${p.cutLines.style === 'solid' ? 'сплошные' : 'пунктир'}, ${formatLength(p.cutLines.width)}${p.cutLines.offset ? `, отступ ${formatLength(p.cutLines.offset)}` : ''}` : 'не печатаются'],
    ];
    const issues = [];
    sheet.errors.forEach((e) => issues.push(['error', `${e.message} ${e.hint || ''}`]));
    if (!p.stickers.length) issues.push(['error', 'В проекте нет наклеек. Добавьте хотя бы одну.']);
    if (overflow.length) issues.push(['warn', `Текст не помещается в ${overflow.length} ${plural(overflow.length, ['наклейку', 'наклейки', 'наклеек'])}: ${overflow.slice(0, 3).map((s) => `«${s.text.slice(0, 24)}»`).join(', ')}. Лишнее будет обрезано по контуру.`]);
    if (glyphs.length) issues.push(['warn', `Некоторые символы не поддерживаются шрифтом и не будут напечатаны (${glyphs.length} ${plural(glyphs.length, ['наклейка', 'наклейки', 'наклеек'])}).`]);
    sheet.warnings.forEach((w) => issues.push(['warn', w.message]));

    // Each part is replaced only when it changed, so callouts do not replay their entrance.
    patch(stats$, rows.map(([k, v]) => `<div class="stats__row"><dt>${k}</dt><dd>${escapeXml(v)}</dd></div>`).join(''));
    patch(issues$, issues.map(([k, m]) => `<div class="callout callout--${k}" role="${k === 'error' ? 'alert' : 'note'}">${icon('alert', { size: 16 })}<span>${escapeXml(m)}</span></div>`).join(''));
    cuts.checked = p.cutLines.enabled;
    const blocked = sheet.errors.length > 0 || !p.stickers.length;
    btn.disabled = blocked || busy;
    btn.setAttribute('aria-disabled', String(blocked));
    previewBtn.disabled = blocked || busy;
  };

  const setBusy = (v) => {
    busy = v;
    btn.disabled = v;
    previewBtn.disabled = v;
    btn.classList.toggle('is-loading', v);
    btn.querySelector('.btn__label').textContent = v ? 'Создаём PDF…' : 'Скачать PDF';
    dlg.setAttribute('aria-busy', String(v));
  };

  btn.addEventListener('click', async () => {
    if (busy) return;
    let name = nameInput.value.trim() || defaultFileName();
    if (!/\.pdf$/i.test(name)) name += '.pdf';
    name = name.replace(/[\\/:*?"<>|]+/g, '-');
    status.innerHTML = '';
    setBusy(true);
    try {
      const sheet = ctx.getSheet();
      const res = await exportPdf({ project: store.project, layout: sheet, getLayout: ctx.getLayout, fonts: ctx.fonts, title: store.project.name }, name);
      // Brief success state on the button before the dialog closes.
      setBusy(false);
      btn.classList.add('is-done');
      btn.querySelector('.btn__label').textContent = 'Готово';
      await new Promise((r) => setTimeout(r, 450));
      btn.classList.remove('is-done');
      dlg.close();
      toast(`PDF сохранён: ${name}, ${res.pages} ${plural(res.pages, ['страница', 'страницы', 'страниц'])}`, { type: 'success', timeout: 5000 });
    } catch (err) {
      const msg = err instanceof PdfExportError ? err.message : `Не удалось создать PDF: ${err.message || err}`;
      status.innerHTML = `<div class="callout callout--error" role="alert">${icon('alert', { size: 16 })}<span>${escapeXml(msg)}</span></div>`;
      console.error(err);
    } finally {
      setBusy(false);
      render();
    }
  });

  // Watermarked low-res JPG for approving the layout with a client; the dialog stays open.
  previewBtn.addEventListener('click', async () => {
    if (busy) return;
    const name = (nameInput.value.trim() || defaultFileName()).replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '-') + '-preview.jpg';
    status.innerHTML = '';
    busy = true;
    btn.disabled = previewBtn.disabled = true;
    previewBtn.classList.add('is-loading');
    try {
      const res = await exportPreviewJpg({ project: store.project, layout: ctx.getSheet(), getLayout: ctx.getLayout, fonts: ctx.fonts }, name);
      toast(`Превью сохранено: ${name}, ${res.pages} ${plural(res.pages, ['страница', 'страницы', 'страниц'])}`, { type: 'success', timeout: 5000 });
    } catch (err) {
      status.innerHTML = `<div class="callout callout--error" role="alert">${icon('alert', { size: 16 })}<span>${escapeXml(`Не удалось создать превью: ${err.message || err}`)}</span></div>`;
      console.error(err);
    } finally {
      busy = false;
      previewBtn.classList.remove('is-loading');
      render();
    }
  });

  store.subscribe((cur, prev) => { if (dlg.open && cur.doc.project !== prev.doc.project) render(); });

  return {
    open() {
      nameInput.value = defaultFileName();
      status.innerHTML = '';
      render();
      dlg.showModal();
      // No focus ring on open by tap; keyboard users still land on the main action.
      (btn.disabled ? $('#exportCancel') : btn).focus({ focusVisible: false });
    },
  };
}
