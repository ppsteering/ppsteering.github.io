/* Shared embed helper: when a module is loaded inside an iframe, strip its
   standalone page chrome (header/lede/foot/background) so the host page's
   section intro carries the story, and report content height to the parent
   so the iframe can size itself with no inner scrollbar. */
(function () {
  'use strict';
  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
  if (!embedded) return;

  document.documentElement.classList.add('pps-embedded');
  // Apply the embed class as early as possible to kill the first-load race
  // (don't wait only on DOMContentLoaded — body may already exist).
  function markEmbed() { if (document.body) document.body.classList.add('embed'); }
  markEmbed();
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  ready(function () {
    document.body.classList.add('embed');
    var post = function () {
      try {
        var h = Math.ceil(document.body.scrollHeight);
        parent.postMessage({ ppsEmbedHeight: h, id: location.pathname.split('/').pop() }, '*');
      } catch (e) {}
    };
    post();
    // re-measure after fonts/canvas settle and on resize
    setTimeout(post, 120); setTimeout(post, 450); setTimeout(post, 1000);
    window.addEventListener('resize', post);
    window.addEventListener('load', post);
    if ('ResizeObserver' in window) { new ResizeObserver(post).observe(document.body); }
    // bursts after clicks (toggles change height)
    document.addEventListener('click', function () { setTimeout(post, 80); setTimeout(post, 360); });
  });
})();
