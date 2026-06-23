/* PPS interactive velocity-residual diagram engine (vanilla, theme + variant aware) */
(function () {
  'use strict';

  // ---- Faithful 2D toy of the PPS dynamics -------------------------------
  // Each denoising sample starts as Gaussian noise x1 ~ N(0,I) (k=1) and is
  // integrated to a clean action (k=0). Per sample we draw a base target b_i
  // (near the base/wrong mode B) and a task target t_i (near the task mode T);
  // the reference proxy matches the base, so the residual is g*(t_i - b_i).
  //   v_pps = v_base + g*(v_task - v_ref)  =>  attractor L_i = (1-g)b_i + g t_i
  // So the steered sample slides from the base prior (g=0) to the task mode
  // (g=1) and overshoots beyond it (g>1), reproducing the paper's Fig.4a peak.

  var WORLD = { x0: -1.32, x1: 1.32, y0: -1.04, y1: 1.06 };
  var N  = { x: -0.04, y: -0.66 };      // noise distribution centre (k=1)
  var NS = 0.135;                        // noise std-dev (world units)
  var B  = { x: -0.66, y: 0.52 };       // base / wrong mode
  var T  = { x:  0.62, y: 0.52 };       // task mode (demos)
  var MS = 0.135;                        // mode spread (world units)
  var GAIN = 2.05;
  var STEPS = 72;

  var PAL = {
    a: { bg:'#fdfaf4', ink:'#1b1b1b', sub:'#6b6453', grid:'#e4dcc8', soft:'#f4eed8',
         noise:'#3a3a3a', base:'#7b5ea7', task:'#3f7fc4', resid:'#e0863a', pps:'#4f9d5d',
         dim:'rgba(60,55,48,0.16)', good:'#3f8f6a', warn:'#c08a3a', bad:'#bf5a45',
         band:'rgba(79,157,93,0.14)' },
    b: { bg:'#1c1913', ink:'#efe8d7', sub:'#a99e84', grid:'#332e23', soft:'#262019',
         noise:'#cfc8bb', base:'#a98fd0', task:'#5fa0e0', resid:'#e8a05a', pps:'#6fc080',
         dim:'rgba(239,232,215,0.16)', good:'#5cbf93', warn:'#e0b25a', bad:'#df7a63',
         band:'rgba(111,192,128,0.16)' }
  };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function gauss() { // standard normal via Box-Muller
    var u = Math.random() + 1e-9, v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function sampleAround(c, sd, clampR) {
    var x, y, r;
    do { x = gauss() * sd; y = gauss() * sd; r = Math.hypot(x, y); }
    while (clampR && r > clampR);
    return { x: c.x + x, y: c.y + y };
  }

  // Traced from Fig. 4a of the main paper (simulation). Peaks at γ=0.4 (~64%)
  // then declines back toward the base as steering overshoots.
  var YMAX = 0.70;
  var SWEEP = [
    [0.0, 0.12], [0.1, 0.22], [0.2, 0.29], [0.3, 0.58], [0.4, 0.64], [0.5, 0.61],
    [0.6, 0.59], [0.7, 0.44], [0.8, 0.41], [0.9, 0.29], [1.0, 0.24], [1.1, 0.26], [1.2, 0.22]
  ];
  var BASE_REF = 0.12, SPEC_REF = 0.38;
  function successAt(g) {
    if (g <= SWEEP[0][0]) return SWEEP[0][1];
    for (var i = 0; i < SWEEP.length - 1; i++) {
      if (g <= SWEEP[i + 1][0]) {
        var t = (g - SWEEP[i][0]) / (SWEEP[i + 1][0] - SWEEP[i][0]);
        t = t * t * (3 - 2 * t);
        return lerp(SWEEP[i][1], SWEEP[i + 1][1], t);
      }
    }
    return SWEEP[SWEEP.length - 1][1];
  }
  function meanAttractor(g) { return { x: lerp(B.x, T.x, g), y: lerp(B.y, T.y, g) }; }

  // ---- Renderer -----------------------------------------------------------
  function Diagram(opts) {
    this.field = opts.field;
    this.curve = opts.curve;
    this.gamma = 0.5;
    this.playing = true;
    this.phase = 0;
    this.theme = 'a';
    this.variant = 'combo';       // 'combo' | 'traj' | 'flow' | 'dist'
    this._spawn();
    this._spawnDist();
    this._sizeAll();
    var self = this;
    window.addEventListener('resize', function () { self._sizeAll(); });
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }
  Diagram.prototype.pal = function () { return PAL[this.theme]; };

  Diagram.prototype._spawn = function () {
    this.particles = [];
    for (var i = 0; i < 26; i++) {
      var e = sampleAround(N, NS, NS * 2.2);
      this.particles.push({
        ex: e.x, ey: e.y,
        bi: sampleAround(B, MS, MS * 2.4),
        ti: sampleAround(T, MS, MS * 2.4),
        off: i / 26 * 0.18
      });
    }
  };
  Diagram.prototype._spawnDist = function () {
    this.dist = [];
    for (var i = 0; i < 150; i++) {
      this.dist.push({
        bi: sampleAround(B, MS, MS * 2.6),
        ti: sampleAround(T, MS, MS * 2.6)
      });
    }
  };

  Diagram.prototype._sizeAll = function () { this._size(this.field); this._size(this.curve); };
  Diagram.prototype._size = function (cv) {
    var dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    cv._dpr = dpr; cv._w = r.width; cv._h = r.height;
  };
  Diagram.prototype.W2S = function (p) {
    var pad = 30, w = this.field._w, h = this.field._h;
    return {
      x: pad + (p.x - WORLD.x0) / (WORLD.x1 - WORLD.x0) * (w - 2 * pad),
      y: pad + (p.y - WORLD.y0) / (WORLD.y1 - WORLD.y0) * (h - 2 * pad)
    };
  };

  Diagram.prototype.integrate = function (pt, g, sMax) {
    var Lx = lerp(pt.bi.x, pt.ti.x, g), Ly = lerp(pt.bi.y, pt.ti.y, g);
    var x = pt.ex, y = pt.ey, dt = 1 / STEPS;
    var path = [{ x: x, y: y }];
    var n = Math.max(1, Math.round(sMax * STEPS));
    for (var i = 0; i < n; i++) {
      var s = i / STEPS;
      var vx = (Lx - x) * GAIN, vy = (Ly - y) * GAIN;
      var env = Math.sin(Math.min(1, s) * Math.PI) * 0.9;
      vx += -(Ly - y) * 0.22 * env; vy += (Lx - x) * 0.22 * env;
      x += vx * dt; y += vy * dt;
      path.push({ x: x, y: y });
    }
    return path;
  };

  Diagram.prototype._loop = function (ts) {
    if (this._last == null) this._last = ts;
    var d = Math.min(0.05, (ts - this._last) / 1000); this._last = ts;
    if (this.playing) {
      this.phase += d * 0.30;
      if (this.phase >= 1) { this.phase -= 1; this._spawn(); }
    }
    this.drawField(ts);
    this.drawCurve();
    requestAnimationFrame(this._loop);
  };

  // ---- primitives ---------------------------------------------------------
  function arrow(ctx, a, b, color, width, head) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    var ang = Math.atan2(b.y - a.y, b.x - a.x), hs = head || 8;
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - hs * Math.cos(ang - 0.42), b.y - hs * Math.sin(ang - 0.42));
    ctx.lineTo(b.x - hs * Math.cos(ang + 0.42), b.y - hs * Math.sin(ang + 0.42));
    ctx.closePath(); ctx.fill();
  }
  Diagram.prototype.worldCircle = function (ctx, c, r, segs) {
    segs = segs || 56;
    for (var i = 0; i <= segs; i++) {
      var a = i / segs * Math.PI * 2, sp = this.W2S({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
      if (i === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
    }
  };
  Diagram.prototype.modeBlob = function (ctx, c, r, fill, ring, dash) {
    ctx.beginPath(); this.worldCircle(ctx, c, r); ctx.fillStyle = fill; ctx.fill();
    ctx.beginPath(); this.worldCircle(ctx, c, r); ctx.strokeStyle = ring; ctx.lineWidth = 1.5;
    if (dash) ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
  };

  // ---- richer primitives: density blobs, k-coloured paths, glyph legend ----
  function rgbaStr(col, a) { var c = parse(col); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  Diagram.prototype.blobRadius = function (rWorld, c) {
    var cs = this.W2S(c), ex = this.W2S({ x: c.x + rWorld, y: c.y }), ey = this.W2S({ x: c.x, y: c.y + rWorld });
    return (Math.abs(ex.x - cs.x) + Math.abs(ey.y - cs.y)) / 2;
  };
  // soft probability-density blob drawn as smooth contour bands (teaser style)
  Diagram.prototype.densityBlob = function (ctx, c, rWorld, col, peak) {
    var cs = this.W2S(c), R = this.blobRadius(rWorld, c), bands = 6;
    for (var i = bands; i >= 1; i--) {
      var rr = R * (i / bands);
      ctx.beginPath(); ctx.arc(cs.x, cs.y, rr, 0, Math.PI * 2);
      ctx.fillStyle = rgbaStr(col, peak * (1 - 0.72 * (i - 1) / (bands - 1)));
      ctx.fill();
    }
  };

  // Anisotropic version of densityBlob: stacks tilted ellipse bands. Used to
  // mirror the elongated / tilted multivariate-normal contours from
  // plot_flow_matching.py (its `Greens`/`Purples`/`Blues` contourf bands).
  Diagram.prototype.ellipseBands = function (ctx, c, rxW, ryW, theta, col, peak) {
    var cs = this.W2S(c);
    var Rx = this.blobRadius(rxW, c), Ry = this.blobRadius(ryW, c);
    var bands = 6;
    for (var i = bands; i >= 1; i--) {
      var sx = Rx * (i / bands), sy = Ry * (i / bands);
      ctx.save();
      ctx.translate(cs.x, cs.y);
      ctx.rotate(theta);
      ctx.beginPath();
      ctx.ellipse(0, 0, sx, sy, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgbaStr(col, peak * (1 - 0.72 * (i - 1) / (bands - 1)));
      ctx.fill();
      ctx.restore();
    }
  };
  // denoising trajectory coloured along k (noise -> action) with step dots
  Diagram.prototype.denoisePath = function (ctx, path, c0, c1, width, dots) {
    ctx.lineCap = 'round';
    for (var j = 0; j < path.length - 1; j++) {
      var a = this.W2S(path[j]), b = this.W2S(path[j + 1]);
      ctx.strokeStyle = mix(c0, c1, j / (path.length - 1)); ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    if (dots) {
      var step = Math.max(1, Math.floor(path.length / 6));
      for (var d = step; d < path.length - 1; d += step) {
        var sp = this.W2S(path[d]);
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = mix(c0, c1, d / (path.length - 1)); ctx.fill();
      }
    }
    var hp = this.W2S(path[path.length - 1]);
    ctx.beginPath(); ctx.arc(hp.x, hp.y, width + 1.6, 0, Math.PI * 2); ctx.fillStyle = c1; ctx.fill();
  };
  // Math font stack — used for italic single-letter variables in legend
  // labels (e.g. the italic v in v_PPS). Inherits from --font-math when
  // the host page defines it; falls back to a serif math face otherwise.
  function mathFontStack() {
    var v = getComputedStyle(document.body).getPropertyValue('--font-math');
    return (v && v.trim()) || '"Cambria Math", "Latin Modern Math", Georgia, "Times New Roman", serif';
  }

  // Per-part font for legend labels expressed as parts:
  //   { t: 'v', i: true }   → italic math letter
  //   { t: 'base', sub: true } → smaller upright subscript
  //   { t: 'plain text' }   → regular sans body text
  function partFont(part) {
    if (part.sub) return '500 9.5px ' + fontStack();
    if (part.i)   return 'italic 600 14px ' + mathFontStack();
    return '500 12.5px ' + fontStack();
  }
  function measureParts(ctx, parts) {
    var w = 0;
    for (var i = 0; i < parts.length; i++) {
      ctx.font = partFont(parts[i]);
      w += ctx.measureText(parts[i].t).width + (parts[i].gap || 0);
    }
    return w;
  }
  function drawParts(ctx, x, y, parts) {
    var cur = x;
    for (var i = 0; i < parts.length; i++) {
      ctx.font = partFont(parts[i]);
      var dy = parts[i].sub ? 3 : 0; // drop subscripts slightly below baseline
      ctx.fillText(parts[i].t, cur, y + dy);
      cur += ctx.measureText(parts[i].t).width + (parts[i].gap || 0);
    }
  }

  // glyph legend card (arrow / gradient / dots / quiver swatches)
  // Each item may carry either:
  //   label: 'plain string'        — back-compat, single-font line
  //   parts: [{t,i?,sub?,gap?}]    — multi-segment label with math typesetting
  Diagram.prototype.legendCard = function (ctx, p, items) {
    var pad = 11, gw = 28, rowH = 20, tw = 0;
    for (var i = 0; i < items.length; i++) {
      var w;
      if (items[i].parts) w = measureParts(ctx, items[i].parts);
      else { ctx.font = '500 12.5px ' + fontStack(); w = ctx.measureText(items[i].label).width; }
      tw = Math.max(tw, w);
    }
    var W = pad * 2 + gw + 7 + tw, H = pad * 2 + items.length * rowH - (rowH - 13), x0 = 14, y0 = 14;
    ctx.fillStyle = rgbaStr(p.bg, 0.85); roundRect(ctx, x0, y0, W, H, 9); ctx.fill();
    ctx.strokeStyle = rgbaStr(p.sub, 0.28); ctx.lineWidth = 1; roundRect(ctx, x0, y0, W, H, 9); ctx.stroke();
    for (var k = 0; k < items.length; k++) {
      var it = items[k], cy = y0 + pad + 5 + k * rowH, gx = x0 + pad, gx2 = gx + gw;
      if (it.type === 'arrow') { arrow(ctx, { x: gx, y: cy }, { x: gx2, y: cy }, it.color, 2.4, 7); }
      else if (it.type === 'grad') {
        for (var s = 0; s < 6; s++) { var aa = gx + (gx2 - gx) * s / 6, bb = gx + (gx2 - gx) * (s + 1) / 6; ctx.strokeStyle = mix(it.color, it.color2, s / 6); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(aa, cy); ctx.lineTo(bb, cy); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(gx2, cy, 2.6, 0, Math.PI * 2); ctx.fillStyle = it.color2; ctx.fill();
      } else if (it.type === 'dots') {
        var off = [[-5, -2], [3, -3], [-1, 3], [6, 2], [0, 0]];
        ctx.globalAlpha = 0.82; for (var dd = 0; dd < off.length; dd++) { ctx.beginPath(); ctx.arc((gx + gx2) / 2 + off[dd][0], cy + off[dd][1], 2.1, 0, Math.PI * 2); ctx.fillStyle = it.color; ctx.fill(); } ctx.globalAlpha = 1;
      } else if (it.type === 'quiver') {
        ctx.globalAlpha = 0.6; for (var q = 0; q < 3; q++) { var qx = gx + q * 9; arrow(ctx, { x: qx, y: cy + 2 }, { x: qx + 7, y: cy - 2 }, it.color, 1.2, 3.5); } ctx.globalAlpha = 1;
      }
      ctx.fillStyle = p.ink; ctx.textAlign = 'left';
      if (it.parts) drawParts(ctx, gx2 + 7, cy + 4, it.parts);
      else { ctx.font = '500 12.5px ' + fontStack(); ctx.fillText(it.label, gx2 + 7, cy + 4); }
    }
  };

  // Scaffold for the simplified ("new") variant. The base-prior and task-mode
  // density blobs (and their text captions) are intentionally NOT drawn here;
  // a single PPS distribution blob is drawn in drawCombined instead.
  Diagram.prototype.scaffold = function (ctx, p, opts) {
    var Ns = this.W2S(N);
    if (opts.noise !== false) this.densityBlob(ctx, N, NS * 2.1, p.noise, 0.15);
    ctx.font = '600 15px ' + fontStack(); ctx.textAlign = 'center';
    ctx.fillStyle = p.noise;
    ctx.fillText('init noise  x₁ ~ N(0, I)', Ns.x, this.W2S({ x: N.x, y: N.y + NS * 2.1 }).y + 17);
  };

  // Three-stop color interpolation that mirrors plot_flow_matching.py's
  // base → pps → task progression: purple (γ=0) → green (γ=0.5) → blue (γ=1).
  // For γ outside [0,1] we clamp to the endpoint colour.
  function ppsColorAt(g, p) {
    if (g <= 0) return p.base;
    if (g >= 1) return p.task;
    if (g <= 0.5) return mix(p.base, p.pps, g * 2);
    return mix(p.pps, p.task, (g - 0.5) * 2);
  }

  // Linear interpolation of two Gaussian kernels (mean + covariance).
  // Covariance is stored compactly as [σxx, σxy, σyy].
  function lerpMu(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }
  function lerpCov(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
  // Closed-form 2×2 covariance eigendecomposition. Returns the eigenvalues
  // (λ_max, λ_min) and the angle of the major-axis eigenvector measured in
  // standard math convention (counter-clockwise from +x with y pointing up).
  function covEig(c) {
    var a = c[0], b = c[1], d = c[2];
    var s = Math.sqrt(Math.max(0, (a - d) * (a - d) / 4 + b * b));
    var lmax = (a + d) / 2 + s, lmin = (a + d) / 2 - s;
    var theta;
    if (Math.abs(b) > 1e-9) theta = Math.atan2(lmax - a, b);
    else theta = a >= d ? 0 : Math.PI / 2;
    return { lmax: Math.max(1e-9, lmax), lmin: Math.max(1e-9, lmin), theta: theta };
  }

  Diagram.prototype.legend = function (ctx, p, rows) {
    // legacy line legend (kept for compatibility; variants use legendCard)
    var x = 16, y = 18, gap = 18;
    ctx.textAlign = 'left'; ctx.font = '500 11.5px ' + fontStack();
    for (var i = 0; i < rows.length; i++) {
      ctx.strokeStyle = rows[i][1]; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y + i * gap); ctx.lineTo(x + 20, y + i * gap); ctx.stroke();
      ctx.fillStyle = p.sub; ctx.fillText(rows[i][0], x + 27, y + i * gap + 4);
    }
  };

  Diagram.prototype.attractorMark = function (ctx, p, ts) {
    var L = meanAttractor(this.gamma), Ls = this.W2S(L);
    var pulse = 6 + Math.sin(ts / 1000 * 3) * 1.6;
    ctx.beginPath(); ctx.arc(Ls.x, Ls.y, pulse + 6, 0, Math.PI * 2);
    ctx.strokeStyle = p.pps; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(Ls.x, Ls.y, 5, 0, Math.PI * 2); ctx.fillStyle = p.pps; ctx.fill();
    // label lifted clear of the action cloud, on a small legibility pill
    ctx.font = '700 14px ' + fontStack(); ctx.textAlign = 'center';
    var lbl = 'steered target  L(γ)', tw = ctx.measureText(lbl).width, ly = Ls.y - this.blobRadius(MS * 1.5, meanAttractor(this.gamma)) - 16;
    ctx.fillStyle = rgbaStr(p.bg, 0.82); roundRect(ctx, Ls.x - tw / 2 - 7, ly - 12, tw + 14, 19, 6); ctx.fill();
    ctx.fillStyle = p.pps; ctx.fillText(lbl, Ls.x, ly + 2);
  };

  Diagram.prototype.drawField = function (ts) {
    var cv = this.field, ctx = cv.getContext('2d'), p = this.pal();
    ctx.setTransform(cv._dpr, 0, 0, cv._dpr, 0, 0);
    ctx.clearRect(0, 0, cv._w, cv._h);
    if (this.variant === 'flow') this.drawFlow(ctx, p, ts);
    else if (this.variant === 'dist') this.drawDist(ctx, p, ts);
    else if (this.variant === 'traj') this.drawTraj(ctx, p, ts);
    else this.drawCombined(ctx, p, ts);
  };

  // VARIANT 1 — trajectories + vector inset
  Diagram.prototype.drawTraj = function (ctx, p, ts) {
    this.scaffold(ctx, p, {});
    var g = this.gamma;
    // faint sample rollouts (drawn under the bold one)
    for (var i = this.particles.length - 1; i >= 1; i--) {
      var pt = this.particles[i];
      var s = Math.max(0, Math.min(1, this.phase + pt.off));
      var path = this.integrate(pt, g, s);
      ctx.beginPath();
      for (var j = 0; j < path.length; j++) { var sp = this.W2S(path[j]); j ? ctx.lineTo(sp.x, sp.y) : ctx.moveTo(sp.x, sp.y); }
      ctx.strokeStyle = rgbaStr(p.sub, 0.16); ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.stroke();
      var hp = this.W2S(path[path.length - 1]);
      ctx.beginPath(); ctx.arc(hp.x, hp.y, 2.3, 0, Math.PI * 2); ctx.fillStyle = rgbaStr(p.sub, 0.5); ctx.fill();
    }
    // bold rollout coloured along k (init noise -> steered action)
    var lead0 = this.particles[0], s0 = Math.max(0.12, Math.min(1, this.phase + lead0.off));
    this.denoisePath(ctx, this.integrate(lead0, g, s0), p.noise, p.pps, 2.6, true);
    // vector inset at lead particle
    var lead = this.particles[0];
    var sLead = Math.max(0.06, Math.min(0.9, this.phase + lead.off));
    var pp = this.integrate(lead, g, sLead), probe = pp[pp.length - 1], ps = this.W2S(probe), SC = 0.30;
    var self = this;
    function tip(vx, vy) { return self.W2S({ x: probe.x + vx * SC, y: probe.y + vy * SC }); }
    var vBx = (lead.bi.x - probe.x) * GAIN, vBy = (lead.bi.y - probe.y) * GAIN;
    var vRx = (lead.ti.x - lead.bi.x) * GAIN * g, vRy = (lead.ti.y - lead.bi.y) * GAIN * g;
    var baseTip = tip(vBx, vBy), ppsTip = tip(vBx + vRx, vBy + vRy);
    arrow(ctx, ps, baseTip, p.base, 2.6, 9);
    if (g > 0.001) arrow(ctx, baseTip, ppsTip, p.resid, 2.6, 9);
    arrow(ctx, ps, ppsTip, p.pps, 3.2, 11);
    ctx.beginPath(); ctx.arc(ps.x, ps.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = p.pps; ctx.fill();
    this.attractorMark(ctx, p, ts);
    this.legendCard(ctx, p, [
      { type: 'grad', color: p.noise, color2: p.pps, label: 'denoising rollout  noise → action' },
      { type: 'arrow', color: p.base, label: 'v_base' },
      { type: 'arrow', color: p.resid, label: 'γ · (v_task − v_ref)' },
      { type: 'arrow', color: p.pps, label: 'v_PPS' }
    ]);
  };

  // VARIANT 2 — steered velocity field (grid of arrows) + streamlines
  Diagram.prototype.drawFlow = function (ctx, p, ts) {
    this.scaffold(ctx, p, { noise: false });
    var g = this.gamma, L = meanAttractor(g);
    var cols = 13, rows = 9;
    for (var ci = 0; ci < cols; ci++) for (var ri = 0; ri < rows; ri++) {
      var wx = lerp(WORLD.x0 + 0.12, WORLD.x1 - 0.12, ci / (cols - 1));
      var wy = lerp(WORLD.y0 + 0.10, WORLD.y1 - 0.10, ri / (rows - 1));
      var dx = L.x - wx, dy = L.y - wy, m = Math.hypot(dx, dy) + 1e-6;
      var len = Math.min(0.10, m * 0.5);
      var a = this.W2S({ x: wx, y: wy }), b = this.W2S({ x: wx + dx / m * len, y: wy + dy / m * len });
      var prox = Math.max(0, 1 - m / 1.3);
      ctx.globalAlpha = 0.30 + prox * 0.55;
      arrow(ctx, a, b, m < 0.5 ? p.pps : p.sub, 1.6, 5.5);
    }
    ctx.globalAlpha = 1;
    // a few sample paths (streamlines) coloured along k
    for (var i = 0; i < 5; i++) {
      var pt = this.particles[i];
      var s = Math.max(0.05, Math.min(1, this.phase + i * 0.12));
      this.denoisePath(ctx, this.integrate(pt, g, s), p.noise, p.pps, 2.2, false);
    }
    this.attractorMark(ctx, p, ts);
    this.legendCard(ctx, p, [
      { type: 'quiver', color: p.pps, label: 'steered field  v_PPS' },
      { type: 'grad', color: p.noise, color2: p.pps, label: 'sample path  noise → action' }
    ]);
  };

  // VARIANT 3 — action distribution shifting base -> task
  Diagram.prototype.drawDist = function (ctx, p, ts) {
    this.scaffold(ctx, p, { noise: false });
    var g = this.gamma;
    // clean cloud of sampled steered actions (dots only, no halo)
    ctx.globalAlpha = 0.85;
    for (var i2 = 0; i2 < this.dist.length; i2++) {
      var d2 = this.dist[i2], sp2 = this.W2S({ x: lerp(d2.bi.x, d2.ti.x, g), y: lerp(d2.bi.y, d2.ti.y, g) });
      ctx.beginPath(); ctx.arc(sp2.x, sp2.y, 2.4, 0, Math.PI * 2); ctx.fillStyle = p.pps; ctx.fill();
    }
    ctx.globalAlpha = 1;
    var Bs = this.W2S(B), L = meanAttractor(g), Ls = this.W2S(L);
    if (g > 0.02) arrow(ctx, Bs, Ls, p.resid, 2.2, 9);
    this.attractorMark(ctx, p, ts);
    this.legendCard(ctx, p, [
      { type: 'dots', color: p.pps, label: 'steered actions' },
      { type: 'arrow', color: p.resid, label: 'distribution shift  base → task' }
    ]);
  };

  // Simplified single-path variant. Draws the noise distribution, a single
  // PPS distribution blob that interpolates between base and task as γ
  // changes (purple → green → blue), one denoising rollout noise → action,
  // and the velocity-decomposition inset at the rollout's head.
  Diagram.prototype.drawCombined = function (ctx, p, ts) {
    this.scaffold(ctx, p, {});
    var g = this.gamma, self = this;
    var ppsCol = ppsColorAt(g, p);

    // (1) PPS distribution as two Gaussian kernels, each interpolated in
    // mean *and* covariance between a base config (γ=0) and a task config
    // (γ=1). At γ=1 both kernels collapse onto the task mode, so the pair
    // visually reads as the single tilted ellipse from _right_pdf_task.
    // Covariances are taken from plot_flow_matching.py's PDFs; means are
    // placed around B and T to fit the canvas.
    var muA0 = { x: B.x - 0.08, y: B.y - 0.18 };
    var muB0 = { x: B.x + 0.07, y: B.y + 0.16 };
    var muA1 = { x: T.x,        y: T.y        };
    var muB1 = { x: T.x,        y: T.y        };
    var covA0 = [0.60, -0.40, 1.00];   // plot.base[0]
    var covB0 = [0.80,  0.00, 0.55];   // plot.base[1]
    var covA1 = [0.43, -0.10, 0.98];   // plot.task
    var covB1 = [0.43, -0.10, 0.98];   // plot.task

    var gC = Math.min(1, Math.max(0, g));
    var muA = lerpMu(muA0, muA1, gC), muB = lerpMu(muB0, muB1, gC);
    var covA = lerpCov(covA0, covA1, gC), covB = lerpCov(covB0, covB1, gC);
    var eA = covEig(covA), eB = covEig(covB);

    // visScale: world units per source-σ. Tuned so the outer 2-σ band of
    // the largest plot covariance still fits the canvas.
    var KS = MS * 0.95;
    var rxA = KS * Math.sqrt(eA.lmax) * 2, ryA = KS * Math.sqrt(eA.lmin) * 2;
    var rxB = KS * Math.sqrt(eB.lmax) * 2, ryB = KS * Math.sqrt(eB.lmin) * 2;
    // Canvas y points down (world y is flipped on screen) → negate angle.
    this.ellipseBands(ctx, muA, rxA, ryA, -eA.theta, ppsCol, 0.22);
    this.ellipseBands(ctx, muB, rxB, ryB, -eB.theta, ppsCol, 0.22);

    // Caption: place under the visually-bottom edge of either mode
    // (largest world-y after adding the outer radius).
    var botA = muA.y + rxA, botB = muB.y + rxB;
    var labelAnchor = { x: (muA.x + muB.x) / 2, y: Math.max(botA, botB) };
    ctx.font = '600 15px ' + fontStack(); ctx.textAlign = 'center';
    ctx.fillStyle = ppsCol;
    ctx.fillText('PPS distribution', this.W2S(labelAnchor).x,
                 this.W2S(labelAnchor).y + 18);

    // (2) Single denoising rollout noise → action; end-of-path colour
    // matches the PPS-distribution colour so the path lands inside its mode.
    var lead = this.particles[0];
    var sLead = Math.max(0.10, Math.min(0.96, this.phase + lead.off));
    var pp = this.integrate(lead, g, sLead);
    this.denoisePath(ctx, pp, p.noise, ppsCol, 2.6, true);

    // (3) Velocity-decomposition inset at the current head of the path.
    var probe = pp[pp.length - 1], ps = this.W2S(probe), SC = 0.30;
    function tip(vx, vy) { return self.W2S({ x: probe.x + vx * SC, y: probe.y + vy * SC }); }
    var vBx = (lead.bi.x - probe.x) * GAIN, vBy = (lead.bi.y - probe.y) * GAIN;
    var vRx = (lead.ti.x - lead.bi.x) * GAIN * g, vRy = (lead.ti.y - lead.bi.y) * GAIN * g;
    var baseTip = tip(vBx, vBy), ppsTip = tip(vBx + vRx, vBy + vRy);
    arrow(ctx, ps, baseTip, p.base, 2.4, 8.5);
    if (g > 0.001) arrow(ctx, baseTip, ppsTip, p.resid, 2.4, 8.5);
    arrow(ctx, ps, ppsTip, ppsCol, 3.0, 10.5);
    ctx.beginPath(); ctx.arc(ps.x, ps.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = ppsCol; ctx.fill();

    this.legendCard(ctx, p, [
      { type: 'grad', color: p.noise, color2: ppsCol,
        parts: [{ t: 'flow-matching path' }] },
      { type: 'arrow', color: p.base,
        parts: [{ t: 'v', i: true }, { t: 'base', sub: true }] },
      { type: 'arrow', color: p.resid,
        parts: [
          { t: 'γ · (' },
          { t: 'v', i: true }, { t: 'task', sub: true },
          { t: ' − ' },
          { t: 'v', i: true }, { t: 'ref', sub: true },
          { t: ')' }
        ] },
      { type: 'arrow', color: ppsCol,
        parts: [{ t: 'v', i: true }, { t: 'PPS', sub: true }] }
    ]);
  };

  Diagram.prototype.drawCurve = function () {
    var cv = this.curve, ctx = cv.getContext('2d'), p = this.pal();
    ctx.setTransform(cv._dpr, 0, 0, cv._dpr, 0, 0);
    ctx.clearRect(0, 0, cv._w, cv._h);
    var padL = 38, padR = 14, padT = 14, padB = 26, w = cv._w, h = cv._h;
    var gx0 = padL, gx1 = w - padR, gy0 = padT, gy1 = h - padB;
    function X(g) { return gx0 + g / 1.2 * (gx1 - gx0); }
    function Y(v) { return gy1 - (v / YMAX) * (gy1 - gy0); }
    ctx.fillStyle = p.band; ctx.fillRect(X(0.3), gy0, X(0.5) - X(0.3), gy1 - gy0);
    ctx.strokeStyle = p.grid; ctx.lineWidth = 1; ctx.fillStyle = p.sub;
    ctx.font = '500 10px ' + fontStack(); ctx.textAlign = 'right';
    [0, 0.2, 0.4, 0.6].forEach(function (v) {
      ctx.beginPath(); ctx.moveTo(gx0, Y(v)); ctx.lineTo(gx1, Y(v)); ctx.stroke();
      ctx.fillText(Math.round(v * 100) + '%', gx0 - 6, Y(v) + 3);
    });
    ctx.textAlign = 'center';
    [0, 0.4, 0.6, 1.0, 1.2].forEach(function (g) { ctx.fillText(g.toFixed(1), X(g), gy1 + 15); });
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4;
    ctx.strokeStyle = p.base; ctx.beginPath(); ctx.moveTo(gx0, Y(BASE_REF)); ctx.lineTo(gx1, Y(BASE_REF)); ctx.stroke();
    ctx.strokeStyle = p.sub; ctx.beginPath(); ctx.moveTo(gx0, Y(SPEC_REF)); ctx.lineTo(gx1, Y(SPEC_REF)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = p.pps; ctx.lineWidth = 2.6; ctx.beginPath();
    for (var g = 0; g <= 1.2001; g += 0.02) { var px = X(g), py = Y(successAt(g)); g === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.stroke();
    var cg = this.gamma;
    ctx.strokeStyle = p.resid; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(cg), gy0); ctx.lineTo(X(cg), gy1); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(X(cg), Y(successAt(cg)), 5, 0, Math.PI * 2); ctx.fillStyle = p.resid; ctx.fill();
    ctx.strokeStyle = p.bg; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'left'; ctx.font = '600 10px ' + fontStack();
    ctx.fillStyle = p.base; ctx.fillText('base', gx0 + 4, Y(BASE_REF) - 4);
    ctx.fillStyle = p.sub; ctx.fillText('specialist', gx0 + 4, Y(SPEC_REF) - 4);
  };

  function fontStack() {
    var v = getComputedStyle(document.body).getPropertyValue('--font-original');
    return (v && v.trim()) || '"Helvetica Neue", Helvetica, Arial, sans-serif';
  }
  function mix(c1, c2, t) {
    var a = parse(c1), b = parse(c2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }
  function parse(c) {
    if (c[0] === '#') { var n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    var m = c.match(/(\d+)/g); return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
  }

  window.PPSDiagramNew = Diagram;
  if (!window.PPS_successAt) window.PPS_successAt = successAt;
})();
