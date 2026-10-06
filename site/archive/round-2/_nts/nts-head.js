/* Runs in <head>, before paint, so nothing flashes. Two jobs:
   1. mark <html class="js">, which the stylesheet uses to hold things back
      until they draw themselves in (with scripts off everything is drawn);
   2. decide day or night on a page with data-nts-nightfall. Day only when
      the visitor arrived from the home page of the same variant: a flag the
      home links set in sessionStorage, or the same-origin referrer. Anything
      else, including a direct landing or a reload, is night. */
(function () {
  var d = document.documentElement;
  d.classList.add("js");
  var body = document.currentScript && document.currentScript.getAttribute("data-nightfall");
  if (body === null || body === undefined) return;
  var day = false;
  try {
    var flag = sessionStorage.getItem("nts:from");
    if (flag) sessionStorage.removeItem("nts:from");
    var root = location.pathname.replace(/[^/]*\/[^/]*$/, "");
    if (flag === "home") day = true;
    else if (document.referrer) {
      var r = new URL(document.referrer);
      if (r.origin === location.origin && (r.pathname === root || r.pathname === root + "index.html")) day = true;
    }
  } catch (e) { day = false; }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) day = false;
  d.setAttribute("data-nightfall", "");
  d.setAttribute("data-theme", day ? "day" : "night");
})();
