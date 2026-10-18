// In-browser end-to-end checks. Drives the real UI through DOM events and reads
// results back from the store. Run in a page with Fusey loaded (e.g. via Chrome
// DevTools "evaluate"), it returns { passed, failed, results }.
async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { store, getSheet } = window.fusey;
  const results = [];
  const check = (name, cond, info = '') => results.push({ name, ok: Boolean(cond), info: cond ? '' : String(info) });
  const setInput = async (el, v) => {
    el.focus();
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    await sleep(30);
  };
  const tab = async (name) => { $(`[data-tab="${name}"]`).click(); await sleep(50); };
  const seg = (path, value, root = document) => $(`[data-bind="${path}"] [data-value="${value}"]`, root);
  const sticker = () => store.project.stickers.find((s) => s.id === store.ui.selection[0]);

  // Start from a clean project.
  store.replace((await import('/js/model.js')).createProject());
  await sleep(50);

  // 19. Empty project state
  check('19 empty canvas state shown', !$('#canvasEmpty').hidden && /Лист пуст/.test($('#canvasEmpty').innerText));
  await tab('stickers');
  check('19 empty sticker list state', /В проекте нет наклеек/.test($('#panel-stickers').innerText));
  $('.topbar-export').click(); await sleep(100);
  check('19 export blocked for empty project', $('#exportGo').disabled, 'button enabled');
  $('#exportDialog').close();

  // 10 (multiple inscriptions) and badge are checked right after creating the sticker.
  // 1. Create a custom sticker and type text
  await tab('library');
  $('#panel-library [data-action="blank"]').click(); await sleep(80);
  check('1 blank sticker added and selected', store.project.stickers.length === 1 && store.ui.selection.length === 1);
  const ta = $('#edText');
  ta.value = 'Розетки\nкухня'; ta.dispatchEvent(new Event('input', { bubbles: true })); await sleep(60);
  check('1 text stored', sticker().text === 'Розетки\nкухня', sticker().text);
  const svgText = $$('#sheetStage text').map((t) => t.textContent).join('|');
  check('1 preview shows uppercase Cyrillic lines', svgText.includes('РОЗЕТКИ') && svgText.includes('КУХНЯ'), svgText);
  $('[data-line-add]').click(); await sleep(40);
  let li = $('[data-line="0"]'); li.value = 'Коридор'; li.dispatchEvent(new Event('input', { bubbles: true })); await sleep(30);
  li.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(60);
  li = $('[data-line="1"]'); li.value = 'Туалет'; li.dispatchEvent(new Event('input', { bubbles: true })); await sleep(30);
  check('10 several inscriptions on one sticker', JSON.stringify(sticker().lines) === '["Коридор","Туалет"]', JSON.stringify(sticker().lines));
  $('[data-badge="C16"]').click(); await sleep(30);
  check('10 badge set', sticker().badge === 'C16');
  const txt2 = $$('#sheetStage text').map((t) => t.textContent);
  check('10 inscriptions and badge on sheet', ['Коридор', 'Туалет', 'C16'].every((t) => txt2.includes(t)), txt2.join('|'));
  $('[data-line-del="1"]').click(); await sleep(30);
  check('10 inscription removed', sticker().lines.length === 1);

  // 2. Add from library (with quantity 3)
  const addQty = $('#addQty');
  await setInput(addQty, '3');
  $('[data-tpl="t_boiler"]').click(); await sleep(80);
  const boiler = store.project.stickers.find((s) => s.templateId === 't_boiler');
  check('2 template added with quantity 3', boiler && boiler.quantity === 3 && boiler.text === 'БОЙЛЕР' && boiler.width === 17.5 && boiler.height === 50);
  check('2 template copy is independent', boiler.style !== (await import('/js/templates.js')).BUILTIN_TEMPLATES.find((t) => t.id === 't_boiler').style);
  $('#tplSearch').value = 'посудом'; $('#tplSearch').dispatchEvent(new Event('input', { bubbles: true })); await sleep(50);
  check('2 search filters templates', $$('#tplGrid [data-tpl]').length === 1, $$('#tplGrid [data-tpl]').length);
  $('#tplSearch').value = ''; $('#tplSearch').dispatchEvent(new Event('input', { bubbles: true }));
  // Category change waits for the old cards' leave animation before re-rendering.
  $('[data-cat="warning"]').click(); await sleep(250);
  const warnCount = (await import('/js/templates.js')).BUILTIN_TEMPLATES.filter((t) => t.category === 'warning').length;
  check('2 category filter', $$('#tplGrid [data-tpl]').length === warnCount, $$('#tplGrid [data-tpl]').length);
  $('[data-cat="all"]').click(); await sleep(250);

  // 3. Icon and style
  $('[data-icon="fridge"]').click(); await sleep(50);
  check('3 icon changed', sticker().icon.id === 'fridge' && sticker().icon.position === 'top', JSON.stringify(sticker().icon));
  check('3 colored icon parts in preview', $$('#sheetStage path[fill="#BFDDF7"]').length >= 1);
  seg('icon.position', 'left').click(); await sleep(30);
  check('3 icon position left', sticker().icon.position === 'left');
  seg('icon.position', 'top').click(); await sleep(30);
  $('[data-preset="warning"]').click(); await sleep(50);
  check('3 warning preset applied', sticker().style.bgColor === '#FFD200' && sticker().style.preset === 'warning');
  check('3 preview shows yellow fill', $$('#sheetStage path[fill="#FFD200"]').length >= 1);
  const borderSwitch = $('#inspector-body [data-bind="style.border"]');
  borderSwitch.click(); await sleep(30);
  check('3 decorative border can be disabled', sticker().style.border === false && sticker().style.preset === 'custom');
  check('3 cut lines remain with border off', $('#sheetStage .cut-lines') !== null);
  $('[data-preset="minimal"]').click(); await sleep(30);

  // 4. mm <-> cm without changing physical size
  const w = $('#inspector-body [data-bind="width"]');
  await setInput(w, '50');
  check('4 width 50 mm', sticker().width === 50);
  seg('displayUnit', 'cm', $('#inspector-body')).click(); await sleep(50);
  check('4 cm shows 5', w.value === '5', w.value);
  check('4 physical size unchanged after unit switch', sticker().width === 50);
  await setInput(w, '4,5');
  check('4 entering 4,5 cm stores 45 mm', sticker().width === 45, sticker().width);
  seg('displayUnit', 'mm', $('#inspector-body')).click(); await sleep(50);
  check('4 back to mm shows 45', w.value === '45', w.value);
  await setInput(w, '-3');
  check('4 negative width rejected inline', w.getAttribute('aria-invalid') === 'true' && sticker().width === 45);
  await setInput(w, 'abc');
  check('4 non-number rejected', sticker().width === 45);
  await setInput(w, '45');

  // 5/6. Page formats and orientation
  await tab('sheet');
  const sheetRoot = $('#panel-sheet');
  for (const [fmt, W, H] of [['A3', 297, 420], ['A5', 148, 210], ['Letter', 215.9, 279.4], ['Legal', 215.9, 355.6], ['A4', 210, 297]]) {
    seg('page.format', fmt, sheetRoot).click(); await sleep(30);
    const a = getSheet().area;
    check(`5 format ${fmt}`, a.pageWidth === W && a.pageHeight === H, `${a.pageWidth}x${a.pageHeight}`);
  }
  seg('page.format', 'Custom', sheetRoot).click(); await sleep(30);
  await setInput($('[data-bind="page.customWidth"]', sheetRoot), '100');
  await setInput($('[data-bind="page.customHeight"]', sheetRoot), '150');
  check('5 custom 100x150', getSheet().area.pageWidth === 100 && getSheet().area.pageHeight === 150, JSON.stringify(getSheet().area));
  check('5 svg viewBox in mm', $('#sheetStage svg').getAttribute('viewBox') === '0 0 100 150', $('#sheetStage svg').getAttribute('viewBox'));
  seg('page.format', 'A4', sheetRoot).click(); await sleep(30);
  seg('page.orientation', 'landscape', sheetRoot).click(); await sleep(30);
  check('6 landscape A4 297x210', getSheet().area.pageWidth === 297 && getSheet().area.pageHeight === 210);
  check('6 sticker size kept on orientation', getSheet().pages[0].items.every((i) => (i.w === 45 && i.h === 50) || (i.w === 17.5 && i.h === 50)), JSON.stringify(getSheet().pages[0].items.map((i) => [i.w, i.h])));
  seg('page.orientation', 'portrait', sheetRoot).click(); await sleep(30);

  // 7. Margins and gaps
  await setInput($('[data-bind="layout.margins.all"]', sheetRoot), '15');
  check('7 all margins 15', Object.values(store.project.layout.margins).every((v) => v === 15));
  await setInput($('[data-bind="layout.gapX"]', sheetRoot), '3');
  await setInput($('[data-bind="layout.gapY"]', sheetRoot), '4');
  const centerSw = $('[data-bind="layout.center"]', sheetRoot);
  if (centerSw.checked) { centerSw.click(); await sleep(30); }
  const items2 = getSheet().pages[0].items;
  check('7 first item at margin', items2[0].x === 15 && items2[0].y === 15, `${items2[0].x},${items2[0].y}`);
  const row = items2.filter((i) => i.y === items2[0].y);
  check('7 horizontal gap applied', row.length < 2 || Math.abs(row[1].x - (row[0].x + row[0].w) - 3) < 1e-6);

  // 8. Multiple pages
  const id0 = store.project.stickers[0].id;
  store.setUI({ selection: [id0] }); await sleep(30);
  await setInput($('#inspector-body [data-bind="quantity"]'), '150');
  const pages = getSheet().pages.length;
  check('8 several pages created', pages >= 2, pages);
  check('8 page counter in top bar', $('#statPages').textContent === String(pages));
  $('#pageNext').click(); await sleep(50);
  check('8 pager moves to page 2', $('#pageLabel').textContent === `2 / ${pages}`, $('#pageLabel').textContent);
  check('8 every copy placed', getSheet().stats.placed === store.project.stickers.reduce((n, s) => n + s.quantity, 0));
  await setInput($('#inspector-body [data-bind="quantity"]'), '2');

  // 9. Too-large sticker
  await setInput($('#inspector-body [data-bind="width"]'), '400');
  check('9 error for oversized sticker', getSheet().errors.length === 1 && !$('#canvasAlerts').hidden, getSheet().errors.length);
  check('9 error names sizes', /400 × 50 мм/.test($('#canvasAlerts').innerText) && /180 × 267 мм/.test($('#canvasAlerts').innerText), $('#canvasAlerts').innerText);
  $('.topbar-export').click(); await sleep(100);
  check('9 PDF export blocked', $('#exportGo').disabled && /не помещается/.test($('#exportBody').innerText));
  $('#exportDialog').close();
  await setInput($('#inspector-body [data-bind="width"]'), '45');
  check('9 error clears after fix', getSheet().errors.length === 0);

  // Undo / redo
  const before = sticker().width;
  await setInput($('#inspector-body [data-bind="width"]'), '60');
  store.undo(); await sleep(30);
  check('undo restores width', sticker().width === before, sticker().width);
  store.redo(); await sleep(30);
  check('redo reapplies width', sticker().width === 60);

  // Duplicate / reorder / delete
  const count = store.project.stickers.length;
  $('#inspector-body [data-ed="duplicate"]').click(); await sleep(30);
  check('duplicate adds a sticker', store.project.stickers.length === count + 1);
  await tab('stickers');
  const firstId = store.project.stickers[0].id;
  store.setUI({ selection: [firstId] }); await sleep(30);
  $(`[data-move="1"][data-id="${firstId}"]`).click(); await sleep(30);
  check('move down reorders', store.project.stickers[1].id === firstId);
  $(`[data-del="${firstId}"]`).click(); await sleep(30);
  check('delete removes', !store.project.stickers.some((s) => s.id === firstId));
  $$('#toasts .toast button').find((b) => b.textContent === 'Отменить')?.click(); await sleep(30);
  check('undo toast restores deleted', store.project.stickers.some((s) => s.id === firstId));

  // Multi-select bulk resize
  store.setUI({ selection: store.project.stickers.map((s) => s.id) }); await sleep(50);
  check('multi-select editor', /Выбрано/.test($('#inspectorTitle').textContent));
  $('#inspector-body [data-size="35x50"]').click(); await sleep(30);
  check('bulk size applied to all (2 modules)', store.project.stickers.every((s) => s.width === 35 && s.height === 50));

  // 10. Autosave
  await sleep(500);
  const saved = JSON.parse(localStorage.getItem('fusey:project:v1'));
  check('10 autosaved to localStorage', saved && saved.stickers.length === store.project.stickers.length && saved.layout.margins.top === 15);

  // 11. JSON round-trip through the import UI
  const { projectToJSON, parseProjectFile } = await import('/js/storage.js');
  const json = projectToJSON(store.project, store.customTemplates);
  const parsed = parseProjectFile(json);
  check('11 export/import round-trip identical', JSON.stringify(parsed.project.stickers) === JSON.stringify(store.project.stickers));
  const file = new File([json.replace('"name": "Новый проект"', '"name": "Импорт"')], 'p.json', { type: 'application/json' });
  const dt = new DataTransfer(); dt.items.add(file);
  $('#importFile').files = dt.files;
  $('#importFile').dispatchEvent(new Event('change'));
  await sleep(150);
  if ($('#confirmDialog').open) { $('#confirmOk').click(); }
  await sleep(150);
  check('11 import via UI replaced project', store.project.name === 'Импорт', store.project.name);
  const bad = new File(['{"foo": 1}'], 'bad.json');
  const dt2 = new DataTransfer(); dt2.items.add(bad);
  $('#importFile').files = dt2.files;
  $('#importFile').dispatchEvent(new Event('change'));
  await sleep(150);
  check('11 invalid file rejected with message', /не файл проекта/.test($('#toasts').innerText) && store.project.name === 'Импорт');

  // 12/13. PDF export through the UI; capture the generated blob.
  const origURL = URL.createObjectURL;
  let blob = null;
  URL.createObjectURL = (b) => { blob = b; return origURL(b); };
  const origClick = HTMLAnchorElement.prototype.click;
  let downloadName = null;
  HTMLAnchorElement.prototype.click = function () { downloadName = this.download; };
  store.setUI({ selection: [store.project.stickers[0].id] }); await sleep(30);
  await setInput($('#inspector-body [data-bind="quantity"]'), '400');
  $('.topbar-export').click(); await sleep(100);
  check('export file name default', /^fusey-stickers-\d{4}-\d{2}-\d{2}\.pdf$/.test($('#exportName').value), $('#exportName').value);
  check('print 100% hint present', /100% \/ Actual Size/.test($('#exportBody').innerText) && /Fit to page/.test($('#exportBody').innerText));
  $('#exportGo').click();
  for (let i = 0; i < 50 && !blob; i++) await sleep(100);
  URL.createObjectURL = origURL;
  HTMLAnchorElement.prototype.click = origClick;
  const text = blob ? new TextDecoder('latin1').decode(await blob.arrayBuffer()) : '';
  const nPages = (text.match(/\/Type \/Page\b/g) || []).length;
  const boxes = [...new Set((text.match(/\/MediaBox \[[^\]]+\]/g) || []))];
  check('13 multipage PDF generated', blob && nPages === getSheet().pages.length && nPages > 1, `${nPages} vs ${getSheet().pages.length}`);
  check('14 page MediaBox is A4 in points', boxes.length === 1 && /595\.2\d+ 841\.8\d+/.test(boxes[0]), boxes.join());
  check('12 download triggered with name', downloadName && downloadName.endsWith('.pdf'), downloadName);
  check('17 Cyrillic font embedded', /FontFile2/.test(text) && /FuseyPTSans/.test(text));
  check('PDF has no raster images', !/\/Subtype \/Image/.test(text));

  // Regression: clicks elsewhere must not switch the left tab (bug: body had data-tab).
  await tab('stickers');
  $('#zoomIn').click(); await sleep(30);
  $$('.stk-row__main')[0].click(); await sleep(30);
  check('tab stays on Наклейки after zoom and row click', store.ui.leftTab === 'stickers' && !document.body.hasAttribute('data-tab'));
  const zoomBefore = $('#zoomLabel').textContent;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '=', ctrlKey: true, bubbles: true, cancelable: true }));
  await sleep(30);
  check('Ctrl+= zooms the sheet, not the page', $('#zoomLabel').textContent !== zoomBefore);

  // 18. no horizontal overflow at 320px is checked separately (viewport emulation)
  await sleep(200);
  const passed = results.filter((r) => r.ok).length;
  return { passed, failed: results.length - passed, failures: results.filter((r) => !r.ok) };
}
