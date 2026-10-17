// Persistence: localStorage autosave plus JSON project files.

import { normalizeProject, normalizeTemplate, demoProject, SCHEMA, SCHEMA_VERSION } from './model.js';
import { todayStamp, debounce } from './utils.js';

const KEY_PROJECT = 'fusey:project:v1';
const KEY_TEMPLATES = 'fusey:templates:v1';
const KEY_UI = 'fusey:ui:v1';
const KEY_CORRUPT = 'fusey:project:corrupt';

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Loads the saved session. Corrupted data is backed up and replaced with a fresh project. */
export function loadSession() {
  const notices = [];
  let project = null;
  let customTemplates = [];
  const raw = read(KEY_PROJECT);
  if (raw) {
    try {
      const res = normalizeProject(JSON.parse(raw));
      project = res.project;
      if (res.warnings.length) notices.push(`Часть данных проекта восстановлена с исправлениями (${res.warnings.length}).`);
    } catch {
      try { localStorage.setItem(KEY_CORRUPT, raw); } catch { /* ignore */ }
      notices.push('Сохранённый проект повреждён и не может быть открыт. Создан новый проект, копия старых данных сохранена.');
    }
  }
  const rawT = read(KEY_TEMPLATES);
  if (rawT) {
    try {
      const list = JSON.parse(rawT);
      customTemplates = Array.isArray(list) ? list.map((t) => { try { return normalizeTemplate(t, project?.customIcons || []); } catch { return null; } }).filter(Boolean) : [];
    } catch {
      notices.push('Пользовательские шаблоны повреждены и были сброшены.');
    }
  }
  let ui = {};
  try { ui = JSON.parse(read(KEY_UI) || '{}') || {}; } catch { ui = {}; }
  const pickUi = {};
  if (['design', 'print'].includes(ui.viewMode)) pickUi.viewMode = ui.viewMode;
  if (['library', 'stickers', 'sheet'].includes(ui.leftTab)) pickUi.leftTab = ui.leftTab;
  return { project: project || demoProject(), customTemplates, ui: pickUi, notices, firstRun: !raw };
}

/** Subscribes autosave to the store. Returns a flush function. */
export function attachAutosave(store, onError) {
  let failed = false;
  const save = () => {
    try {
      localStorage.setItem(KEY_PROJECT, JSON.stringify(store.project));
      localStorage.setItem(KEY_TEMPLATES, JSON.stringify(store.customTemplates));
      localStorage.setItem(KEY_UI, JSON.stringify({ viewMode: store.ui.viewMode, leftTab: store.ui.leftTab }));
      failed = false;
    } catch (e) {
      if (!failed) onError?.(e);
      failed = true;
    }
  };
  const debounced = debounce(save, 350);
  store.subscribe((cur, prev) => {
    if (cur.doc !== prev.doc || cur.ui.viewMode !== prev.ui.viewMode || cur.ui.leftTab !== prev.ui.leftTab) debounced();
  });
  window.addEventListener('pagehide', () => debounced.flush());
  return () => debounced.flush();
}

export function clearSession() {
  [KEY_PROJECT, KEY_TEMPLATES, KEY_UI].forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
}

export function projectToJSON(project, customTemplates) {
  return JSON.stringify({ ...project, schema: SCHEMA, version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), customTemplates }, null, 2);
}

export function projectFileName(project) {
  const slug = project.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project';
  return `fusey-${slug}-${todayStamp()}.json`;
}

/** Parses an imported file. Throws an Error with a user-facing message on failure. */
export function parseProjectFile(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Файл повреждён или не является JSON.'); }
  return normalizeProject(data);
}

export function downloadText(text, fileName, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
