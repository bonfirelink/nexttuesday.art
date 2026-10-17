/* Runs in <head>, before paint, so nothing flashes. Two jobs:
   1. mark <html class="js">, which the stylesheet uses to hold things back
      until they draw themselves in (with scripts off everything is drawn);
   2. on a world page loaded with data-bleed="scroll", decide
      whether the world bleeds in. It does when the visitor comes from a page
      that is not a world page (the events page counts as ordinary) or from a
      world page whose own bleed has not settled: nts.js sets the flag "home"
      in sessionStorage when such a page's link to a world is clicked, and the
      same-origin referrer is the fallback for such a page when no flag was
      set. A link from a block already in the destination world's colours sets
      the flag "direct", which skips both. Then
      html[data-bleed-state="before"] holds the page in the NTS colours until
      nts.js lets the world in. A direct landing or reduced motion is
      the world from the first frame ("world"); a reload keeps the referrer it
      had, so it decides again as the first visit did. */
(function () {
  var d = document.documentElement;
  d.classList.add("js");
  /* The orb morph between the home and the world pages (the events page is
     one too). NTS.world(url): the world a same-site URL is, else null; the
     one list of world paths. NTS.body(world): the home's body for it, its
     bead if on screen, else its orb; null off the home. BODY and PATHS are
     generated from site.json's `initiatives` (tools/sync.mjs). */
  var NTS = window.NTS = window.NTS || {};
  /* nts:worlds */
  var BODY = { "embers": "embers", "not-not-philo": "philo", "intersect": "intersect", "events": "star" };
  var PATHS = /\/(embers|not-not-philo|intersect|events)\/(index\.html)?$/;
  /* /nts:worlds */
  NTS.world = function (url) {
    var u; try { u = new URL(url, location.href); } catch (err) { return null; }
    var m = u.origin === location.origin && PATHS.exec(u.pathname);
    return m ? m[1] : null;
  };
  /* the [data-world] key the home uses for a world's slug, else null */
  NTS.key = function (world) { return BODY[world] || null; };
  NTS.body = function (world) {
    var b = BODY[world];
    if (!b) return null;
    var bead = document.querySelector('.bead[data-body="' + b + '"] .face');
    var orb = document.querySelector('.orb[data-body="' + b + '"]');
    var seen = function (el) { var r = el && el.getBoundingClientRect(); return !!r && r.bottom > 0 && r.top < innerHeight && r.width > 0; };
    return seen(bead) ? bead : seen(orb) ? orb : bead || orb;
  };
  /* The current page's bar stretches as it travels: at half time it spans
     both links, the leading edge on the new one, then the trailing edge
     catches up. The UA's own keyframes for its group hold both boxes,
     measured at the snapshots, so nothing is read from the layout here;
     each half keeps the CSS timing function. Anything missing leaves the
     UA's slide as it is. */
  function stretch() {
    var d = document.documentElement;
    if (!d.getAnimations) return;
    var g = d.getAnimations({ subtree: true }).filter(function (x) {
      return x.effect && x.effect.pseudoElement === "::view-transition-group(nts-mark)";
    })[0];
    if (!g || !g.effect.setKeyframes) return;
    var k = g.effect.getKeyframes(), m = /^matrix\(1, 0, 0, 1, (-?[\d.e-]+), (-?[\d.e-]+)\)$/;
    if (k.length !== 2) return;
    var p0 = m.exec(k[0].transform), p1 = m.exec(k[1].transform), w0 = parseFloat(k[0].width), w1 = parseFloat(k[1].width);
    if (!p0 || !p1 || !(w0 >= 0) || !(w1 >= 0)) return;
    var x0 = +p0[1], x1 = +p1[1], x = Math.min(x0, x1), w = Math.max(x0 + w0, x1 + w1) - x;
    var y = (+p0[2] + +p1[2]) / 2, h = k[0].height, ease = k[0].easing;
    /* the end is left implicit: the group's own style, which the UA keeps on
       the new bar's live box, so the bar comes to rest where the page settles */
    g.effect.setKeyframes([
      { offset: 0, transform: k[0].transform, width: k[0].width, height: h, easing: ease },
      { offset: 0.5, transform: "matrix(1, 0, 0, 1, " + x + ", " + y + ")", width: w + "px", height: h, easing: ease }
    ]);
  }
  /* Arriving, the new side is named at `pagereveal`, the frame its snapshot
     is taken. That can come before the deferred scripts run, so the listener
     is here; each page's <link rel="expect" blocking="render"> holds that
     frame until what is named here is parsed. From a non-world page the
     hero entity is the `orb` (a rule, gone when the transition ends); from a
     world, the home's body for it. World to world stays the plain
     crossfade (no body off the home). */
  addEventListener("pagereveal", function (e) {
    var vt = e.viewTransition, a = window.navigation && navigation.activation;
    /* a throw in stretch, or a skipped transition, leaves the slide, quietly */
    if (vt && vt.ready) vt.ready.then(stretch).catch(function () {});
    if (!vt || !a || !a.from) return;
    var from = NTS.world(a.from.url), el = null, st = null;
    if (from) {
      el = NTS.body(from);
      if (!el) return;
      el.style.viewTransitionName = "orb";
    } else {
      st = document.createElement("style");
      st.textContent = ".hero .entity{view-transition-name:orb}";
      document.head.appendChild(st);
    }
    var clear = function () { if (st) st.remove(); if (el) el.style.viewTransitionName = ""; };
    vt.finished.then(clear, clear);
  });
  var s = document.currentScript;
  var mode = s && s.getAttribute("data-bleed");
  if (mode === null || mode === undefined) return;
  var from = false;
  try {
    var flag = sessionStorage.getItem("nts:from");
    if (flag) sessionStorage.removeItem("nts:from");
    if (flag === "home") from = true;
    else if (flag === "direct") from = false;
    else if (document.referrer) {
      /* a same-origin page that is not a world page (the events page runs no bleed) */
      var w = NTS.world(document.referrer);
      if (new URL(document.referrer).origin === location.origin && (!w || w === "events")) from = true;
    }
  } catch (e) { from = false; }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) from = false;
  d.setAttribute("data-bleed", mode || "scroll");
  d.setAttribute("data-bleed-state", from ? "before" : "world");
})();
