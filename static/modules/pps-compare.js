/* PPS baseline comparison carousel: big Ours on top, Base + LoRA below, task carousel.
   Videos load from videos/compare/<task>_<method>.mp4 (relative to this module).
   Methods: pps (ours) | base | lora. Tasks below. Missing files show a placeholder. */
(function () {
  'use strict';

  var VIDEO_DIR = '../videos/compare/';   // static/modules/ -> static/videos/compare/
  var TASKS = [
    { id: 'coffee', label: 'Coffee Brewing' },
    { id: 'flower', label: 'Flower Arrangement' },
    { id: 'jeans',  label: 'Jeans Folding' },
    { id: 'tissue', label: 'Tissue Wiping' }
  ];
  var cur = 0;

  function src(task, method) { return VIDEO_DIR + task + '_' + method + '.mp4'; }

  function load(method, task) {
    var v = document.getElementById('v-' + method);
    var miss = document.getElementById('m-' + method);
    miss.hidden = true;
    v.style.visibility = 'visible';
    v.onerror = function () {
      v.style.visibility = 'hidden';
      miss.hidden = false;
      miss.textContent = task.id + '_' + method + '.mp4 — add to ' + VIDEO_DIR;
    };
    v.src = src(task.id, method);
    var p = v.play && v.play(); if (p && p.catch) p.catch(function () {});
  }

  function render(i) {
    cur = (i + TASKS.length) % TASKS.length;
    var t = TASKS[cur];
    ['pps', 'base', 'lora'].forEach(function (m) { load(m, t); });
    document.querySelectorAll('#tabs button').forEach(function (b, bi) { b.classList.toggle('on', bi === cur); });
    document.querySelectorAll('#dots button').forEach(function (b, bi) { b.classList.toggle('on', bi === cur); });
    var foot = document.getElementById('foot');
    if (foot) foot.textContent = t.label + '  ·  ' + (cur + 1) + ' / ' + TASKS.length;
  }
  window.PPSCompare = { go: render, next: function () { render(cur + 1); }, prev: function () { render(cur - 1); } };

  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function () {
    var tabs = document.getElementById('tabs'), dots = document.getElementById('dots');
    TASKS.forEach(function (t, i) {
      var b = document.createElement('button'); b.textContent = t.label;
      b.onclick = function () { render(i); }; tabs.appendChild(b);
      var d = document.createElement('button'); d.setAttribute('aria-label', t.label);
      d.onclick = function () { render(i); }; dots.appendChild(d);
    });
    document.getElementById('prev').onclick = function () { render(cur - 1); };
    document.getElementById('next').onclick = function () { render(cur + 1); };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') render(cur - 1);
      else if (e.key === 'ArrowRight') render(cur + 1);
    });
    render(0);
  });
})();
