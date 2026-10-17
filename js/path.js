// SVG path data -> list of absolute segments using only M, L, C, Z.
// Both the SVG preview and the PDF writer draw from this normalized form,
// so icons are guaranteed to have identical geometry in both outputs.

const ARG_COUNT = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function tokenize(d) {
  const tokens = [];
  const re = /([MLHVCSQTAZmlhvcsqtaz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let m;
  while ((m = re.exec(d))) tokens.push(m[1] ? m[1] : Number(m[2]));
  return tokens;
}

export function parsePath(d) {
  const tokens = tokenize(d);
  const out = [];
  let i = 0;
  let cmd = null;
  let cx = 0, cy = 0;     // current point
  let sx = 0, sy = 0;     // subpath start
  let lastCtrl = null;    // for S/T reflection
  let lastCmd = '';

  const take = (n) => {
    const a = tokens.slice(i, i + n);
    if (a.length < n || a.some((t) => typeof t !== 'number')) throw new Error('Некорректные данные пути SVG');
    i += n;
    return a;
  };

  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') cmd = tokens[i++];
    else if (!cmd) throw new Error('Путь SVG должен начинаться с команды');
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    if (up === 'Z') {
      out.push({ op: 'Z' });
      cx = sx; cy = sy; lastCtrl = null; lastCmd = 'Z';
      cmd = null;
      continue;
    }
    const a = take(ARG_COUNT[up]);
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    switch (up) {
      case 'M':
        cx = a[0] + ox; cy = a[1] + oy; sx = cx; sy = cy;
        out.push({ op: 'M', x: cx, y: cy });
        cmd = rel ? 'l' : 'L'; // implicit lineto after moveto
        lastCtrl = null;
        break;
      case 'L': cx = a[0] + ox; cy = a[1] + oy; out.push({ op: 'L', x: cx, y: cy }); lastCtrl = null; break;
      case 'H': cx = a[0] + (rel ? cx : 0); out.push({ op: 'L', x: cx, y: cy }); lastCtrl = null; break;
      case 'V': cy = a[0] + (rel ? cy : 0); out.push({ op: 'L', x: cx, y: cy }); lastCtrl = null; break;
      case 'C': {
        const seg = { op: 'C', x1: a[0] + ox, y1: a[1] + oy, x2: a[2] + ox, y2: a[3] + oy, x: a[4] + ox, y: a[5] + oy };
        out.push(seg); lastCtrl = [seg.x2, seg.y2]; cx = seg.x; cy = seg.y;
        break;
      }
      case 'S': {
        const [rx, ry] = (lastCmd === 'C' || lastCmd === 'S') && lastCtrl ? [2 * cx - lastCtrl[0], 2 * cy - lastCtrl[1]] : [cx, cy];
        const seg = { op: 'C', x1: rx, y1: ry, x2: a[0] + ox, y2: a[1] + oy, x: a[2] + ox, y: a[3] + oy };
        out.push(seg); lastCtrl = [seg.x2, seg.y2]; cx = seg.x; cy = seg.y;
        break;
      }
      case 'Q': case 'T': {
        let qx, qy, x, y;
        if (up === 'Q') { qx = a[0] + ox; qy = a[1] + oy; x = a[2] + ox; y = a[3] + oy; }
        else {
          [qx, qy] = (lastCmd === 'Q' || lastCmd === 'T') && lastCtrl ? [2 * cx - lastCtrl[0], 2 * cy - lastCtrl[1]] : [cx, cy];
          x = a[0] + ox; y = a[1] + oy;
        }
        // Quadratic -> cubic: control points at 2/3 towards the quad control point.
        out.push({ op: 'C', x1: cx + (2 / 3) * (qx - cx), y1: cy + (2 / 3) * (qy - cy), x2: x + (2 / 3) * (qx - x), y2: y + (2 / 3) * (qy - y), x, y });
        lastCtrl = [qx, qy]; cx = x; cy = y;
        break;
      }
      case 'A': {
        const x = a[5] + ox, y = a[6] + oy;
        out.push(...arcToCubics(cx, cy, a[0], a[1], a[2], a[3], a[4], x, y));
        cx = x; cy = y; lastCtrl = null;
        break;
      }
      default: break;
    }
    lastCmd = up === 'M' ? 'L' : up;
  }
  return out;
}

// SVG endpoint arc -> centre parameterization -> cubic Bézier pieces of <= 90°.
// Formulae follow the SVG 1.1 implementation notes, section F.6.
function arcToCubics(x1, y1, rx, ry, angle, largeArc, sweep, x2, y2) {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [{ op: 'L', x: x2, y: y2 }];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (angle * Math.PI) / 180;
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (Boolean(largeArc) === Boolean(sweep)) coef = -coef;
  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * (-(ry * x1p) / rx);
  const cxA = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cyA = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9);
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const pt = (t) => {
    const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    return [cos * ex - sin * ey + cxA, sin * ex + cos * ey + cyA];
  };
  const dpt = (t) => {
    const ex = -rx * Math.sin(t), ey = ry * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  const segs = [];
  let t = t1;
  for (let s = 0; s < n; s++) {
    const p0 = pt(t), d0 = dpt(t);
    const t2 = t + step;
    const p3 = pt(t2), d3 = dpt(t2);
    segs.push({ op: 'C', x1: p0[0] + k * d0[0], y1: p0[1] + k * d0[1], x2: p3[0] - k * d3[0], y2: p3[1] - k * d3[1], x: p3[0], y: p3[1] });
    t = t2;
  }
  // Snap the final point exactly onto the requested endpoint.
  const last = segs[segs.length - 1];
  last.x = x2; last.y = y2;
  return segs;
}

/** Applies a point transform (x, y) => [x', y'] to every coordinate. */
export function transformSegments(segs, fn) {
  return segs.map((s) => {
    if (s.op === 'Z') return s;
    if (s.op === 'C') {
      const [x1, y1] = fn(s.x1, s.y1);
      const [x2, y2] = fn(s.x2, s.y2);
      const [x, y] = fn(s.x, s.y);
      return { op: 'C', x1, y1, x2, y2, x, y };
    }
    const [x, y] = fn(s.x, s.y);
    return { op: s.op, x, y };
  });
}

export function segmentsToD(segs, digits = 3) {
  const f = (n) => String(Math.round(n * 10 ** digits) / 10 ** digits);
  return segs.map((s) => {
    if (s.op === 'Z') return 'Z';
    if (s.op === 'C') return `C${f(s.x1)} ${f(s.y1)} ${f(s.x2)} ${f(s.y2)} ${f(s.x)} ${f(s.y)}`;
    return `${s.op}${f(s.x)} ${f(s.y)}`;
  }).join('');
}

/* ---------- Shape helpers (output path data) ---------- */

const KAPPA = 0.5522847498;

export function circleD(cx, cy, r) {
  return ellipseD(cx, cy, r, r);
}

export function ellipseD(cx, cy, rx, ry) {
  const kx = rx * KAPPA, ky = ry * KAPPA;
  return `M${cx + rx} ${cy}C${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry}`
    + `C${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy}`
    + `C${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry}`
    + `C${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy}Z`;
}

/** Rectangle with optional corner radius as path data. */
export function rectD(x, y, w, h, r = 0) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r === 0) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  const k = r * (1 - KAPPA);
  return `M${x + r} ${y}H${x + w - r}C${x + w - k} ${y} ${x + w} ${y + k} ${x + w} ${y + r}`
    + `V${y + h - r}C${x + w} ${y + h - k} ${x + w - k} ${y + h} ${x + w - r} ${y + h}`
    + `H${x + r}C${x + k} ${y + h} ${x} ${y + h - k} ${x} ${y + h - r}`
    + `V${y + r}C${x} ${y + k} ${x + k} ${y} ${x + r} ${y}Z`;
}

/** Converts an element-ish shape description (from user SVG upload) to path data. */
export function shapeToD(tag, attr) {
  const n = (k, def = 0) => {
    const v = parseFloat(attr[k]);
    return Number.isFinite(v) ? v : def;
  };
  switch (tag) {
    case 'path': return attr.d || '';
    case 'circle': return circleD(n('cx'), n('cy'), n('r'));
    case 'ellipse': return ellipseD(n('cx'), n('cy'), n('rx'), n('ry'));
    case 'rect': return rectD(n('x'), n('y'), n('width'), n('height'), n('rx', n('ry')));
    case 'line': return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
    case 'polyline':
    case 'polygon': {
      const pts = String(attr.points || '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
      if (pts.length < 4) return '';
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      return tag === 'polygon' ? d + 'Z' : d;
    }
    default: return '';
  }
}
