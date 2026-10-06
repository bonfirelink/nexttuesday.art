/* Runs in <head>, before paint, so nothing flashes. Two jobs:
   1. mark <html class="js">, which the stylesheet uses to hold things back
      until they draw themselves in (with scripts off everything is drawn);
   2. on a world page loaded with data-bleed="scroll" or "time", decide
      whether the world bleeds in. Only when the visitor arrived from the
      home page of the same site: a flag the home's links set in
      sessionStorage, or the same-origin referrer. Then
      html[data-bleed-state="before"] holds the page in the NTS colours until
      nts.js lets the world in. Anything else, a direct landing, a reload,
      reduced motion, is the world from the first frame ("world"). */
(function () {
  var d = document.documentElement;
  d.classList.add("js");
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
  var after = s.getAttribute("data-bleed-after");
  if (after) d.setAttribute("data-bleed-after", after);
  d.setAttribute("data-bleed-state", from ? "before" : "world");
})();
