/* The rite: the incantation on the home page advances one line per scroll
   step while the stage stays put. Without JS every line is in flow; this
   script marks <html class="js"> so the stylesheet can stack them. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");
  var rite = document.querySelector(".rite");
  if (!rite) return;
  var lines = rite.querySelectorAll(".line");
  var sigil = rite.querySelector("pre[data-sigil]");
  var n = lines.length, active = -1, ticking = false;

  function stepHeight() {
    return innerHeight * 0.6;
  }
  function update() {
    ticking = false;
    var top = rite.getBoundingClientRect().top;
    var p = Math.round(-top / stepHeight());
    var i = Math.max(0, Math.min(n - 1, p));
    if (i === active) return;
    for (var k = 0; k < n; k++) {
      lines[k].classList.toggle("on", k === i);
      lines[k].classList.toggle("gone", k < i);
    }
    if (active >= 0 && sigil && sigil.stoke) sigil.stoke();
    active = i;
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  update();
})();
