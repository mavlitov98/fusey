// Single source of truth. The document (project + user templates) is immutable:
// every action returns new objects only along the changed path, so subscribers
// can cheaply detect what changed by reference. UI state (selection, zoom, tabs)
// lives next to it but is excluded from undo history.

import { createSticker, templateFromSticker, createProject, LIMITS } from './model.js';
import { presetValues } from './templates.js';
import { clamp, deepClone, uid } from './utils.js';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 900;

export function createStore({ project, customTemplates = [], ui = {} }) {
  let doc = { project, customTemplates };
  let uiState = {
    selection: [],
    page: 0,
    viewMode: 'design',
    leftTab: 'library',
    mobileView: 'library',
    category: 'all',
    search: '',
    addQty: 1,
    ...ui,
  };
  const past = [];
  const future = [];
  let lastCommit = { key: null, at: 0 };
  const listeners = new Set();

  const emit = (prevDoc, prevUi) => listeners.forEach((fn) => fn({ doc, ui: uiState }, { doc: prevDoc, ui: prevUi }));

  const store = {
    get project() { return doc.project; },
    get customTemplates() { return doc.customTemplates; },
    get ui() { return uiState; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /**
     * Applies a document change. `coalesce` merges rapid edits of the same field
     * (typing, slider drags) into a single undo step.
     */
    commit(mutator, { coalesce = null } = {}) {
      const prev = doc;
      const next = mutator(doc);
      if (!next || next === doc) return;
      const now = Date.now();
      const merge = coalesce && lastCommit.key === coalesce && now - lastCommit.at < COALESCE_MS;
      if (!merge) {
        past.push(prev);
        if (past.length > HISTORY_LIMIT) past.shift();
      }
      future.length = 0;
      lastCommit = { key: coalesce, at: now };
      doc = { ...next, project: { ...next.project, updatedAt: new Date().toISOString() } };
      const prevUi = uiState;
      uiState = sanitizeUi(uiState, doc.project);
      emit(prev, prevUi);
    },

    setUI(patch) {
      const prevUi = uiState;
      uiState = sanitizeUi({ ...uiState, ...patch }, doc.project);
      emit(doc, prevUi);
    },

    undo() {
      if (!past.length) return;
      const prev = doc;
      future.push(doc);
      doc = past.pop();
      lastCommit = { key: null, at: 0 };
      const prevUi = uiState;
      uiState = sanitizeUi(uiState, doc.project);
      emit(prev, prevUi);
    },

    redo() {
      if (!future.length) return;
      const prev = doc;
      past.push(doc);
      doc = future.pop();
      lastCommit = { key: null, at: 0 };
      const prevUi = uiState;
      uiState = sanitizeUi(uiState, doc.project);
      emit(prev, prevUi);
    },

    /** Replaces the whole document (new project / import). Clears history. */
    replace(project, customTemplates = doc.customTemplates) {
      const prev = doc;
      past.length = 0;
      future.length = 0;
      doc = { project, customTemplates };
      const prevUi = uiState;
      uiState = sanitizeUi({ ...uiState, selection: [], page: 0 }, project);
      emit(prev, prevUi);
    },
  };
  return store;
}

function sanitizeUi(ui, project) {
  const ids = new Set(project.stickers.map((s) => s.id));
  const selection = ui.selection.filter((id) => ids.has(id));
  return selection.length === ui.selection.length ? ui : { ...ui, selection };
}

/* ---------- Pure document transforms ---------- */

const withProject = (doc, patch) => ({ ...doc, project: { ...doc.project, ...patch } });
// Reordering the sticker list means "arrange by the list": a manual copy order would hide it.
const listOrder = (doc) => (doc.project.layout.copyOrder ? { ...doc.project.layout, copyOrder: null } : doc.project.layout);
const mapStickers = (doc, ids, fn) => {
  const set = new Set(ids);
  let changed = false;
  const stickers = doc.project.stickers.map((s) => {
    if (!set.has(s.id)) return s;
    const n = fn(s);
    if (n !== s) changed = true;
    return n;
  });
  return changed ? withProject(doc, { stickers }) : doc;
};

/** Sets a nested value ("style.fontSize") immutably. */
export function setPath(obj, path, value) {
  const [head, ...rest] = path.split('.');
  if (!rest.length) return obj[head] === value ? obj : { ...obj, [head]: value };
  const child = setPath(obj[head] ?? {}, rest.join('.'), value);
  return child === obj[head] ? obj : { ...obj, [head]: child };
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

// Style fields that turn the preset into "Custom" when edited by hand.
const PRESET_FIELDS = /^(style\.(?!preset)|icon\.(weight|position|gap|colored|accent))/;

export const actions = {
  addFromTemplate(store, template, qty = 1) {
    const s = createSticker(template, { quantity: clamp(Math.round(qty), ...LIMITS.quantity) });
    store.commit((d) => withProject(d, { stickers: [...d.project.stickers, s] }));
    store.setUI({ selection: [s.id] });
    return s;
  },

  addBlank(store) {
    return actions.addFromTemplate(store, null, 1);
  },

  updateField(store, ids, path, value, coalesce = true) {
    store.commit((d) => mapStickers(d, ids, (s) => {
      let n = setPath(s, path, value);
      if (n !== s && PRESET_FIELDS.test(path) && n.style.preset !== 'custom') n = setPath(n, 'style.preset', 'custom');
      if (path === 'style.fontSize' && n.style.minFontSize > value) n = setPath(n, 'style.minFontSize', value);
      if (path === 'icon.id' && value && n.icon.position === 'none') n = setPath(n, 'icon.position', n.height >= n.width ? 'top' : 'left');
      return n;
    }), { coalesce: coalesce ? `${ids.join(',')}:${path}` : null });
  },

  applyPreset(store, ids, presetId) {
    const v = presetValues(presetId);
    store.commit((d) => mapStickers(d, ids, (s) => {
      if (presetId === 'custom') return setPath(s, 'style.preset', 'custom');
      const icon = { ...v.icon, id: s.icon.id, size: s.icon.size };
      if (!s.icon.id) icon.position = 'none';
      return { ...s, style: { ...v.style }, icon };
    }));
  },

  resize(store, ids, width, height) {
    store.commit((d) => mapStickers(d, ids, (s) => (s.width === width && s.height === height ? s : { ...s, width, height })));
  },

  swapSize(store, ids) {
    store.commit((d) => mapStickers(d, ids, (s) => (s.width === s.height ? s : { ...s, width: s.height, height: s.width })));
  },

  duplicate(store, ids) {
    const set = new Set(ids);
    const created = [];
    store.commit((d) => {
      const stickers = [];
      for (const s of d.project.stickers) {
        stickers.push(s);
        if (set.has(s.id)) {
          const copy = { ...deepClone(s), id: uid('stk') };
          created.push(copy.id);
          stickers.push(copy);
        }
      }
      return withProject(d, { stickers });
    });
    store.setUI({ selection: created });
  },

  remove(store, ids) {
    const set = new Set(ids);
    store.commit((d) => withProject(d, { stickers: d.project.stickers.filter((s) => !set.has(s.id)) }));
  },

  move(store, id, delta) {
    store.commit((d) => {
      const list = [...d.project.stickers];
      const i = list.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j], list[i]];
      return withProject(d, { stickers: list, layout: listOrder(d) });
    });
  },

  reorder(store, id, toIndex) {
    store.commit((d) => {
      const list = [...d.project.stickers];
      const i = list.findIndex((s) => s.id === id);
      if (i < 0 || i === toIndex) return d;
      const [item] = list.splice(i, 1);
      list.splice(clamp(toIndex, 0, list.length), 0, item);
      return withProject(d, { stickers: list, layout: listOrder(d) });
    });
  },

  resetToTemplate(store, ids, findTemplate) {
    store.commit((d) => mapStickers(d, ids, (s) => {
      const t = findTemplate(s.templateId, d.customTemplates);
      const base = createSticker(t);
      return { ...base, id: s.id, quantity: s.quantity };
    }));
  },

  setProject(store, path, value, coalesce = true) {
    store.commit((d) => {
      const project = setPath(d.project, path, value);
      return project === d.project ? d : { ...d, project };
    }, { coalesce: coalesce ? `project:${path}` : null });
  },

  saveAsTemplate(store, sticker, name) {
    const t = templateFromSticker(sticker, name);
    store.commit((d) => ({ ...d, customTemplates: [...d.customTemplates, t] }));
    return t;
  },

  deleteTemplate(store, id) {
    store.commit((d) => ({ ...d, customTemplates: d.customTemplates.filter((t) => t.id !== id) }));
  },

  addCustomIcon(store, icon, applyTo = []) {
    store.commit((d) => {
      let next = withProject(d, { customIcons: [...d.project.customIcons, icon] });
      if (applyTo.length) {
        next = mapStickers(next, applyTo, (s) => ({ ...s, icon: { ...s.icon, id: icon.id, position: s.icon.position === 'none' ? 'left' : s.icon.position } }));
      }
      return next;
    });
  },

  newProject(store) {
    store.replace(createProject());
  },
};
