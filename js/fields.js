// Declarative form fields bound to state paths.
// Markup helpers emit inputs tagged with data-bind="<path>" and data-kind; bindFields()
// wires them to get/set callbacks, validates numbers inline and keeps values in sync
// with the store (without clobbering the field the user is typing in).

import { escapeXml, fromMm, toMm, parseNumber, round, UNITS } from './utils.js';
import { icon } from './ui.js';

let seq = 0;
const fid = (path) => `f_${path.replace(/[^a-z0-9]/gi, '_')}_${++seq}`;

/** Physical length in mm, displayed and entered in the project's display unit. */
export function lengthField({ path, label, min, max, unitLabel = true, hint = '' }) {
  const id = fid(path);
  return `<div class="field">
    <label class="field-label" for="${id}">${escapeXml(label)}</label>
    <div class="input-wrap">
      <input id="${id}" class="input" type="text" inputmode="decimal" data-bind="${path}" data-kind="length" data-min="${min}" data-max="${max}" aria-describedby="${id}_err">
      ${unitLabel ? '<span class="input-suffix" data-unit-label></span>' : ''}
    </div>
    ${hint ? `<p class="field-hint">${escapeXml(hint)}</p>` : ''}
    <p class="field-error" id="${id}_err" aria-live="polite"></p>
  </div>`;
}

export function numberField({ path, label, min, max, step = 1, suffix = '', digits = 2, range = false }) {
  const id = fid(path);
  return `<div class="field${range ? ' field--range' : ''}">
    <label class="field-label" for="${id}">${escapeXml(label)}</label>
    <div class="field-row">
      ${range ? `<input class="range" name="${path}-range" type="range" min="${min}" max="${max}" step="${step}" data-bind="${path}" data-kind="range" aria-label="${escapeXml(label)}" tabindex="-1">` : ''}
      <div class="input-wrap">
        <input id="${id}" class="input" type="text" inputmode="decimal" data-bind="${path}" data-kind="number" data-min="${min}" data-max="${max}" data-digits="${digits}" aria-describedby="${id}_err">
        ${suffix ? `<span class="input-suffix">${escapeXml(suffix)}</span>` : ''}
      </div>
    </div>
    <p class="field-error" id="${id}_err" aria-live="polite"></p>
  </div>`;
}

export function segmented({ path, label, options, cls = '' }) {
  const id = fid(path);
  return `<div class="field ${cls}">
    <span class="field-label" id="${id}">${escapeXml(label)}</span>
    <div class="segmented" role="radiogroup" aria-labelledby="${id}" data-bind="${path}" data-kind="segmented">
      ${options.map((o) => `<button type="button" role="radio" class="segmented__btn" data-value="${escapeXml(String(o.value))}" ${o.title ? `title="${escapeXml(o.title)}"` : ''} aria-label="${escapeXml(o.aria || o.title || o.label)}">${o.icon ? icon(o.icon, { size: 16 }) : ''}${o.label ? `<span>${escapeXml(o.label)}</span>` : ''}</button>`).join('')}
    </div>
  </div>`;
}

export function switchField({ path, label, hint = '' }) {
  const id = fid(path);
  return `<div class="field field--switch">
    <label class="switch" for="${id}">
      <span class="switch__text"><span class="field-label">${escapeXml(label)}</span>${hint ? `<span class="field-hint">${escapeXml(hint)}</span>` : ''}</span>
      <input id="${id}" type="checkbox" role="switch" data-bind="${path}" data-kind="switch">
      <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
    </label>
  </div>`;
}

export function selectField({ path, label, options }) {
  const id = fid(path);
  return `<div class="field">
    <label class="field-label" for="${id}">${escapeXml(label)}</label>
    <div class="select-wrap">
      <select id="${id}" class="input select" data-bind="${path}" data-kind="select">
        ${options.map((o) => `<option value="${escapeXml(o.value)}">${escapeXml(o.label)}</option>`).join('')}
      </select>
      ${icon('chevronDown', { size: 16, cls: 'select-caret' })}
    </div>
  </div>`;
}

/** Colour picker; with `nullable` an extra toggle allows "no colour" (transparent). */
export function colorField({ path, label, nullable = false, nullLabel = 'Нет', nullDefault = '#FFFFFF' }) {
  const id = fid(path);
  return `<div class="field field--color">
    <label class="field-label" for="${id}">${escapeXml(label)}</label>
    <div class="color-row" data-color-row>
      <input id="${id}" class="color-swatch" type="color" data-bind="${path}" data-kind="color">
      <input class="input input--mono" name="${path}-hex" type="text" maxlength="7" spellcheck="false" data-bind="${path}" data-kind="hex" aria-label="${escapeXml(label)}: HEX">
      ${nullable ? `<button type="button" class="chip chip--sm" data-bind="${path}" data-kind="nullcolor" data-default="${nullDefault}" aria-pressed="false">${escapeXml(nullLabel)}</button>` : ''}
    </div>
  </div>`;
}

/**
 * @param root container
 * @param {{ get(path): any, set(path, value, opts): void, unit(): string, onError?(msg): void }} api
 */
export function bindFields(root, api) {
  const displayLength = (mm) => {
    const unit = api.unit();
    return String(round(fromMm(mm, unit), UNITS[unit].digits + 1)).replace('.', ',');
  };
  const setError = (input, msg) => {
    const err = root.querySelector(`#${CSS.escape(input.getAttribute('aria-describedby') || '')}`);
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    if (err) err.textContent = msg || '';
  };
  const validate = (input) => {
    const v = parseNumber(input.value);
    const kind = input.dataset.kind;
    const min = Number(input.dataset.min), max = Number(input.dataset.max);
    const unit = api.unit();
    const mm = kind === 'length' ? toMm(v, unit) : v;
    if (!Number.isFinite(v)) return { error: 'Введите число' };
    if (mm < min - 1e-9 || mm > max + 1e-9) {
      if (kind === 'length') {
        const f = (n) => String(round(fromMm(n, unit), 3)).replace('.', ',');
        return { error: `Допустимо от ${f(min)} до ${f(max)} ${UNITS[unit].label}` };
      }
      return { error: `Допустимо от ${String(min).replace('.', ',')} до ${String(max).replace('.', ',')}` };
    }
    return { value: kind === 'length' ? round(mm, 4) : v };
  };

  const commitNumber = (input) => {
    const r = validate(input);
    setError(input, r.error);
    if (!r.error) api.set(input.dataset.bind, r.value, { coalesce: false });
  };

  root.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset?.bind) return;
    const k = el.dataset.kind;
    if (k === 'length' || k === 'number') {
      // Live feedback without committing half-typed values.
      const r = validate(el);
      setError(el, el.value.trim() === '' ? 'Введите число' : r.error);
    } else if (k === 'range') {
      api.set(el.dataset.bind, Number(el.value), { coalesce: true });
    } else if (k === 'color') {
      api.set(el.dataset.bind, el.value.toUpperCase(), { coalesce: true });
    } else if (k === 'hex' && /^#[0-9a-fA-F]{6}$/.test(el.value)) {
      api.set(el.dataset.bind, el.value.toUpperCase(), { coalesce: true });
    } else if (k === 'text') {
      api.set(el.dataset.bind, el.value, { coalesce: true });
    }
  });
  root.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.dataset?.bind) return;
    const k = el.dataset.kind;
    if (k === 'length' || k === 'number') commitNumber(el);
    else if (k === 'switch') api.set(el.dataset.bind, el.checked, { coalesce: false });
    else if (k === 'select') api.set(el.dataset.bind, el.value, { coalesce: false });
    else if (k === 'hex' && !/^#[0-9a-fA-F]{6}$/.test(el.value)) sync();
  });
  root.addEventListener('keydown', (e) => {
    const el = e.target;
    if (e.key === 'Enter' && (el.dataset?.kind === 'length' || el.dataset?.kind === 'number')) { e.preventDefault(); commitNumber(el); }
  });
  root.addEventListener('click', (e) => {
    const seg = e.target.closest('.segmented__btn');
    if (seg) {
      const group = seg.closest('[data-kind="segmented"]');
      if (seg.disabled || seg.getAttribute('aria-disabled') === 'true') return;
      const raw = seg.dataset.value;
      const val = raw === 'true' ? true : raw === 'false' ? false : raw === 'null' ? null : raw;
      api.set(group.dataset.bind, val, { coalesce: false });
      return;
    }
    const nc = e.target.closest('[data-kind="nullcolor"]');
    if (nc) {
      const cur = api.get(nc.dataset.bind);
      api.set(nc.dataset.bind, cur ? null : (nc.dataset.default || '#FFFFFF'), { coalesce: false });
    }
  });
  // Arrow keys move between segmented options (radio group pattern).
  root.addEventListener('keydown', (e) => {
    const seg = e.target.closest?.('.segmented__btn');
    if (!seg || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const btns = [...seg.parentElement.querySelectorAll('.segmented__btn:not([disabled])')];
    const i = btns.indexOf(seg) + (e.key === 'ArrowRight' ? 1 : -1);
    const next = btns[(i + btns.length) % btns.length];
    next.focus();
    next.click();
    e.preventDefault();
  });

  function sync() {
    const unitLabel = UNITS[api.unit()].label;
    root.querySelectorAll('[data-unit-label]').forEach((el) => { el.textContent = unitLabel; });
    root.querySelectorAll('[data-bind]').forEach((el) => {
      const v = api.get(el.dataset.bind);
      const k = el.dataset.kind;
      const focused = el === document.activeElement;
      if (k === 'length') {
        if (!focused && el.getAttribute('aria-invalid') !== 'true') el.value = Number.isFinite(v) ? displayLength(v) : '';
      } else if (k === 'number') {
        if (!focused && el.getAttribute('aria-invalid') !== 'true') el.value = Number.isFinite(v) ? String(round(v, Number(el.dataset.digits))).replace('.', ',') : '';
      } else if (k === 'range') {
        if (!focused) el.value = v;
      } else if (k === 'segmented') {
        el.querySelectorAll('.segmented__btn').forEach((b) => {
          const on = b.dataset.value === String(v);
          b.setAttribute('aria-checked', String(on));
          b.tabIndex = on ? 0 : -1;
        });
        if (!el.querySelector('[aria-checked="true"]')) el.querySelector('.segmented__btn').tabIndex = 0;
      } else if (k === 'switch') {
        el.checked = Boolean(v);
      } else if (k === 'select') {
        el.value = v;
      } else if (k === 'color') {
        el.value = v || '#FFFFFF';
        el.closest('[data-color-row]')?.classList.toggle('is-null', !v);
      } else if (k === 'hex') {
        if (!focused) el.value = v || '';
        el.disabled = !v;
      } else if (k === 'nullcolor') {
        el.setAttribute('aria-pressed', String(!v));
        el.classList.toggle('is-active', !v);
      } else if (k === 'text') {
        if (!focused) el.value = v ?? '';
      }
    });
  }
  return { sync };
}
