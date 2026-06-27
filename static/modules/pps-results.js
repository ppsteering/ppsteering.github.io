/* PPS results — Module 2 as responsive small multiples (3 domains side by side). */
(function () {
  'use strict';

  // Averages from the appendix figures. role: 1 = PPS (highlight), 2 = base ref, 0 = baseline.
  // Fixed method order across all panels so the green PPS bar is the top row everywhere.
  var ORDER = ['PPS', 'LoRA', 'Specialist', 'DSRL', 'Residual', 'BASE'];
  var PANELS = [
    { key: 'real', label: 'Real-world', sub: '8 tasks · 10 rollouts', baseName: 'π0.5',
      v: { PPS: 79, LoRA: 59, Specialist: 26, DSRL: 25, Residual: 19, BASE: 22 } },
    { key: 'sim', label: 'Simulation', sub: '4 tasks · 100 rollouts', baseName: 'π0.5',
      v: { PPS: 64, LoRA: 49, Specialist: 38, DSRL: 20, Residual: 32, BASE: 12 } },
    { key: 'pi0', label: 'π₀ transfer', sub: '8 real-world tasks', baseName: 'π0',
      v: { PPS: 55, LoRA: 46, Specialist: 26, DSRL: null, Residual: 19, BASE: 5 } }
  ];

  function roleOf(name) { return name === 'PPS' ? 1 : (name === 'BASE' ? 2 : 0); }
  function displayName(name, baseName) { return name === 'BASE' ? baseName : name; }

  function buildPanel(panel, idx) {
    var base = panel.v.BASE, pps = panel.v.PPS, gap = pps - base;
    var card = document.createElement('div'); card.className = 'panel'; card.dataset.idx = idx;

    var head = document.createElement('div'); head.className = 'phead';
    head.innerHTML = '<div class="ptitle">' + panel.label + '</div><div class="psub">' + panel.sub + '</div>';
    card.appendChild(head);

    var delta = document.createElement('div'); delta.className = 'pdelta';
    delta.innerHTML = '<span class="big">+' + gap + '</span><span class="dl">pts over ' + panel.baseName + '</span>';
    card.appendChild(delta);

    var chart = document.createElement('div'); chart.className = 'pchart';
    // dashed base-reference line, aligned to the bar track (after the 71px label gutter)
    var ref = document.createElement('div'); ref.className = 'pref';
    ref.style.left = 'calc(71px + (100% - 71px) * ' + (base / 100) + ')';
    chart.appendChild(ref);

    ORDER.forEach(function (name, ri) {
      var val = panel.v[name];
      var row = document.createElement('div'); row.className = 'prow role' + roleOf(name);
      var lbl = document.createElement('div'); lbl.className = 'plabel'; lbl.textContent = displayName(name, panel.baseName);
      var track = document.createElement('div'); track.className = 'ptrack';
      if (val == null) {
        row.classList.add('na');
        var na = document.createElement('div'); na.className = 'pna'; na.textContent = '—';
        track.appendChild(na);
      } else {
        var fill = document.createElement('div'); fill.className = 'pfill';
        var v = document.createElement('div'); v.className = 'pval'; v.textContent = val + '%';
        if (name === 'PPS') { var b = document.createElement('span'); b.className = 'pbadge'; b.textContent = 'ours'; lbl.appendChild(b); }
        track.appendChild(fill); track.appendChild(v);
        row.dataset.target = val;
      }
      row.classList.add('m-' + name.toLowerCase());   // per-method color class
      row.appendChild(lbl); row.appendChild(track); chart.appendChild(row);
    });
    card.appendChild(chart);

    var axis = document.createElement('div'); axis.className = 'paxis';
    axis.innerHTML = '<span>0</span><span>50</span><span>100%</span>';
    card.appendChild(axis);
    return card;
  }

  function setBars(card, animate) {
    var rows = card.querySelectorAll('.prow');
    rows.forEach(function (row, i) {
      var fill = row.querySelector('.pfill'), v = row.querySelector('.pval');
      if (!fill) return;
      var t = +row.dataset.target;
      if (animate) {
        fill.style.width = '0%'; if (v) { v.style.opacity = '0'; v.style.left = '0%'; }
        setTimeout(function () { fill.style.width = t + '%'; if (v) { v.style.left = t + '%'; v.style.opacity = '1'; } }, 80 + i * 55);
      } else { fill.style.width = t + '%'; if (v) { v.style.left = t + '%'; v.style.opacity = '1'; } }
    });
  }

  var mounted = false;
  function reduce() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function init() {
    var wrap = document.getElementById('rpanels');
    if (!wrap || mounted) return;
    mounted = true;
    var cards = PANELS.map(buildPanel);
    cards.forEach(function (c) { wrap.appendChild(c); });

    // Animation removed: just paint bars to their final width immediately and
    // never trigger the "grow from 0%" animation. (The IntersectionObserver
    // staggered-entrance block was removed.)
    cards.forEach(function (c) { setBars(c, false); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
