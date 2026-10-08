/* Runs in <head>, before paint, so nothing flashes. Two jobs:
   1. mark <html class="js">, which the stylesheet uses to hold things back
      until they draw themselves in (with scripts off everything is drawn);
   2. on a world page loaded with data-bleed="scroll", decide
      whether the world bleeds in. Only when the visitor arrived from the
      home page of the same site: a flag the home's links set in
      sessionStorage, or the same-origin referrer. Then
      html[data-bleed-state="before"] holds the page in the NTS colours until
      nts.js lets the world in. Anything else, a direct landing, a reload,
      reduced motion, is the world from the first frame ("world"). */
(function () {
  var d = document.documentElement;
  d.classList.add("js");
  /* The orb morph between the home and the world pages (the events page is
     one too). NTS.world(url): the world a same-site URL is, else null; the
     one list of world paths. NTS.body(world): the home's body for it, its
     bead if on screen, else its orb; null off the home. */
  var NTS = window.NTS = window.NTS || {};
  var BODY = { "embers": "embers", "not-not-philo": "philo", "intersect": "intersect", "events": "star" };
  NTS.world = function (url) {
    var u; try { u = new URL(url, location.href); } catch (err) { return null; }
    var m = u.origin === location.origin && /\/(embers|not-not-philo|intersect|events)\/(index\.html)?$/.exec(u.pathname);
    return m ? m[1] : null;
  };
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
    var root = location.pathname.replace(/[^/]*\/[^/]*$/, "");
    if (flag === "home") from = true;
    else if (document.referrer) {
      var r = new URL(document.referrer);
      if (r.origin === location.origin && (r.pathname === root || r.pathname === root + "index.html")) from = true;
    }
  } catch (e) { from = false; }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) from = false;
  d.setAttribute("data-bleed", mode || "scroll");
  d.setAttribute("data-bleed-state", from ? "before" : "world");
})();
