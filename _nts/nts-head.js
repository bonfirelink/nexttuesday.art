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
  /* Arriving from a non-world page (the home orb), the hero entity is the
     `orb` of the view transition. `pagereveal` can fire before the deferred
     nts.js runs, and before the entity is parsed, so the name is a rule added
     here, in the head: it applies whenever the entity exists, and goes when
     the transition ends. World to world stays the plain crossfade. */
  addEventListener("pagereveal", function (e) {
    var vt = e.viewTransition, a = window.navigation && navigation.activation;
    if (!vt || !a || !a.from) return;
    if (/\/(embers|not-not-philo|intersect|events)\/(index\.html)?$/.test(new URL(a.from.url).pathname)) return;
    var st = document.createElement("style");
    st.textContent = ".hero .entity{view-transition-name:orb}";
    document.head.appendChild(st);
    var clear = function () { st.remove(); };
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
