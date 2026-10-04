/* Sections arrive as they are scrolled to: the arc above each one draws
   itself. Without this script, or under reduced motion, they are simply
   there (see .sec in style.css). */
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const sections = document.querySelectorAll(".sec");
  if (!("IntersectionObserver" in window) || still.matches) {
    sections.forEach((s) => s.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  sections.forEach((s) => io.observe(s));
})();
