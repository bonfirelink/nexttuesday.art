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
  /* Arriving, the new side is named at `pagereveal`, the frame its snapshot
     is taken. That can come before the deferred scripts run, so the listener
     is here; each page's <link rel="expect" blocking="render"> holds that
     frame until what is named here is parsed. From a non-world page the
     hero entity is the `orb` (a rule, gone when the transition ends); from a
     world, the home's body for it. World to world stays the plain
     crossfade (no body off the home). */
  addEventListener("pagereveal", function (e) {
    var vt = e.viewTransition, a = window.navigation && navigation.activation;
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
