/* Recovery storyboard — one task at a time (tabs), each a large 2x2 grid:
   rows = PPS / LoRA, columns = the failure and what the policy did next. */
(function () {
  'use strict';

  // frame: [src, caption, kind]  kind: 'fail' (red) | 'recover' (green)
  var TASKS = [
    {
      name: 'Pack the shoes', origin: 'self',
      pps:  [['../images/recovery/shoe_2_grey.png', 'handle slips', 'fail'], ['../images/recovery/shoe_3_grey.png', 'retries and re-grasps', 'recover']],
      lora: [['../images/recovery/shoe_2_2_grey.png', 'grasp fails', 'fail'], ['../images/recovery/shoe_2_3_grey.png', 'places anyway', 'fail']]
    },
    {
      name: 'Brew the coffee', origin: 'self',
      pps:  [['../images/recovery/coffee_2_grey.png', 'misses the lid', 'fail'], ['../images/recovery/coffee_3_grey.png', 'retries and seats it', 'recover']],
      lora: [['../images/recovery/coffee_2_2_grey.png', 'misses the lid', 'fail'], ['../images/recovery/coffee_2_3_grey.png', 'moves on regardless', 'fail']]
    },
    {
      name: 'Fold the jeans', origin: 'human',
      pps:  [['../images/recovery/ours_2_grey.png', 'a person nudges the jeans', 'fail'], ['../images/recovery/ours_3_grey.png', 'folds them again', 'recover']],
      lora: [['../images/recovery/lora_2_grey.png', 'a person nudges the jeans', 'fail'], ['../images/recovery/lora_4_grey.png', 'grabs the middle', 'fail']]
    }
  ];
  var ORIGIN = { self: 'the policy slips on its own', human: 'a person interferes' };

  var cur = 0;

  function frameEl(f) {
    var cell = document.createElement('div'); cell.className = 'cell';
    var fr = document.createElement('div'); fr.className = 'frame kind-' + f[2];
    var img = document.createElement('img'); img.src = f[0]; img.alt = f[1];
    fr.appendChild(img);
    var band = document.createElement('div'); band.className = 'band kind-' + f[2];
    var dot = document.createElement('span'); dot.className = 'bdot';
    band.appendChild(dot); band.appendChild(document.createTextNode(f[1]));
    cell.appendChild(fr); cell.appendChild(band);
    return cell;
  }

  function rowLabel(tag, cls, ours) {
    var lab = document.createElement('div'); lab.className = 'rowlab ' + cls;
    lab.innerHTML = '<span class="tag">' + tag + '</span>' + (ours ? '<span class="ours">ours</span>' : '');
    return lab;
  }
  function colHead(text) { var h = document.createElement('div'); h.className = 'colhead'; h.textContent = text; return h; }

  function render(i) {
    cur = i;
    var t = TASKS[i], grid = document.getElementById('rgrid');
    grid.innerHTML = '';
    // header row: spacer, two column titles
    grid.appendChild(document.createElement('div'));
    grid.appendChild(colHead('What goes wrong'));
    grid.appendChild(colHead('What happens next'));
    // PPS row
    grid.appendChild(rowLabel('PPS', 'pps', true));
    t.pps.forEach(function (f) { grid.appendChild(frameEl(f)); });
    // LoRA row
    grid.appendChild(rowLabel('LoRA', 'lora', false));
    t.lora.forEach(function (f) { grid.appendChild(frameEl(f)); });

    document.querySelectorAll('#rtabs button').forEach(function (b, bi) { b.classList.toggle('on', bi === i); });
    var note = document.getElementById('rorigin');
    if (note) note.textContent = ORIGIN[t.origin];
  }
  window.RecoveryStory = { go: render };

  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function () {
    var tabs = document.getElementById('rtabs');
    TASKS.forEach(function (t, i) {
      var b = document.createElement('button');
      b.innerHTML = '<span class="tn">' + (i + 1) + '</span>' + t.name;
      b.onclick = function () { render(i); };
      tabs.appendChild(b);
    });
    render(0);
  });
})();
