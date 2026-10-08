/* The orrery's behaviours, on the home page. Deferred; the page reads fully
   without it (the sky turns in CSS, the worlds are plain sections).
     compass   .compass shows once the orrery has scrolled away, and its
               data-near names the body whose section holds the middle of
               the viewport (sections carry data-orbit-body); a tap goes
               back to the sun (a plain #top link: the stylesheet
               scrolls smoothly when motion is welcome); it steps aside
               (.is-aside) while the footer is in view
     emblem    the eye (.e-stop) stops the machine: every part glides to the
               symmetric stop pose and .is-stopped on .threshold hollows
               the dial, flips the pyramid, draws the star and shows the
               secret; again, it carries on from where it stands. The ground picker (.e-pick)
               sets html[data-ground] and stores the choice
     falling   on a cross-document view transition, the body you tapped
               (its bead if the sky is on screen, else its orb) is named
               "orb", so it grows into the world page's entity; coming back,
               the entity shrinks into the same body (named in nts-head.js)
   Everything checks prefers-reduced-motion. */
(function () {
  "use strict";

  /* compass */
  var compass = document.querySelector(".compass");
  var sky = document.querySelector(".orrery");
  if (compass && sky && "IntersectionObserver" in window) {
    var names = { sun: "the great sigil", embers: "EMBERS", philo: "NOT NOT PHILO", intersect: "INTERSECT", star: "what is yet to come" };
    /* paused while hidden (orrery.css), the dots fall behind their beads: as
       the compass shows they take the beads' time again, so each dot sits
       where its bead is */
    var shown = false;
    var rejoin = function () {
      var now = compass.classList.contains("is-on") && !compass.classList.contains("is-aside");
      if (now && !shown) {
        ["star", "embers", "philo", "intersect"].forEach(function (b) {
          var bead = sky.querySelector('.bead[data-body="' + b + '"]');
          var orbit = compass.querySelector(".c-" + b);
          if (!bead || !orbit) return;
          var t = null;
          bead.getAnimations().forEach(function (a) { if (a.animationName === "orbit") t = a.currentTime; });
          var kids = [].slice.call(orbit.children);
          if (t === null) {
            /* the bead is held (the emblem is stopped, or nothing turns): its
               dot stands at the bead's angle, held by an inline play state
               (script play()/pause() would outlast the stylesheet's own) */
            var m = getComputedStyle(bead).transform.match(/matrix\(([^)]+)\)/);
            if (!m) return;
            var n = m[1].split(",").map(Number), deg = Math.atan2(n[4], -n[5]) * 180 / Math.PI;
            kids.forEach(function (c) {
              c.style.rotate = deg.toFixed(2) + "deg";
              c.style.animationPlayState = "paused";
              c.getAnimations().forEach(function (a) {
                if (a.animationName !== "c-turn") return;
                var a0 = parseFloat(getComputedStyle(c).getPropertyValue("--a")) || 0;
                var dir = a.effect.getTiming().direction === "reverse" ? -1 : 1;
                a.currentTime = ((((deg - a0) * dir) % 360) + 360) % 360 / 360 * a.effect.getComputedTiming().duration;
              });
            });
            return;
          }
          kids.forEach(function (c) { c.style.rotate = ""; c.style.animationPlayState = ""; });
          orbit.getAnimations({ subtree: true }).forEach(function (a) { if (a.animationName === "c-turn") a.currentTime = t; });
        });
      }
      shown = now;
    };
    var away = new IntersectionObserver(function (es) {
      es.forEach(function (e) { compass.classList.toggle("is-on", !e.isIntersecting && e.boundingClientRect.bottom < 0); });
      rejoin();
    }, { threshold: 0 });
    away.observe(sky);
    var near = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var b = e.target.getAttribute("data-orbit-body");
        compass.setAttribute("data-near", b);
        compass.setAttribute("aria-label", "Near " + (names[b] || b) + ". Back to the great sigil");
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    document.querySelectorAll("[data-orbit-body]").forEach(function (s) { near.observe(s); });
    /* the footer holds the page's last lines where the compass sits: it steps
       aside from just before the footer's top reaches the compass until the
       footer leaves again. The footer is not under the compass's transform,
       so this cannot feed back into itself. */
    var foot = document.querySelector(".nts-footer");
    if (foot) {
      var footWatch = null, footTimer = 0;
      /* "in view" starts when the footer's top reaches the compass's bottom
         edge, so the root's bottom margin is that edge's distance from the
         viewport bottom: the compass's computed `bottom` (the inset varies by
         width). Read at setup and again after a resize settles. */
      var watchFooter = function () {
        if (footWatch) footWatch.disconnect();
        var gap = parseFloat(getComputedStyle(compass).bottom) || 0;
        footWatch = new IntersectionObserver(function (es) {
          compass.classList.toggle("is-aside", es[es.length - 1].isIntersecting);
          rejoin();
        }, { rootMargin: "0px 0px -" + gap + "px 0px", threshold: 0 });
        footWatch.observe(foot);
      };
      watchFooter();
      addEventListener("resize", function () { clearTimeout(footTimer); footTimer = setTimeout(watchFooter, 150); });
    }
  }

  /* the emblem. Stop: read each moving part's angle once (its computed
     rotate and transform), drop its animation and pin it there inline,
     then let the glide carry it to its stop angle by the shorter way. Go:
     read the angles again (a glide may still run), give the animations
     back and start each at the time that matches where its part stands.
     No per-frame script. */
  var hero = document.querySelector(".threshold");
  var emb = hero && hero.querySelector(".orrery");
  var stopBtn = emb && emb.querySelector(".e-stop");
  if (stopBtn) {
    /* the stop pose, a twelve-point clock round the flipped pyramid: its tip
       points down at Events (6 o'clock), each world faces the face of its
       own colour (Not Not Philo 12, Intersect 4, Embers 8); the dots fill
       the other hours colour by colour, in mirror pairs */
    var STOP_BODY = { embers: 240, philo: 0, intersect: 120, star: 180 };
    var STOP_DOTS = { "66": [[60, "e"], [180, "e"], [300, "e"]], "78.4": [[90, "p"], [270, "p"]], "84": [[150, "i"], [210, "i"]], "96.4": [[330, "s"], [0, "g"], [30, "s"]] };
    var secret = hero.querySelector(".turn .secret"), SECRET = secret ? secret.textContent : "";
    var layers = [].slice.call(emb.querySelectorAll(".e-ring, .e-bands, .e-orbit, .e-tick"));
    var beads = [].slice.call(emb.querySelectorAll(".pivot > .bead"));
    var dots = [].slice.call(emb.querySelectorAll(".e-pv"));
    /* each dot's own place, as drawn: a reduced-motion resume returns to it */
    var home = dots.map(function (d) { return d.style.transform; });
    var norm = function (a) { return ((a % 360) + 360) % 360; };
    var near = function (from, to) { return from + ((((to - from) % 360) + 540) % 360 - 180); };
    var matrix = function (t) { var v = t && t.match(/matrix\(([^)]+)\)/); return v ? v[1].split(",").map(Number) : null; };
    var turnOf = function (el) {
      var cs = getComputedStyle(el), m = matrix(cs.transform);
      return (cs.rotate && cs.rotate !== "none" ? parseFloat(cs.rotate) : 0) + (m ? Math.atan2(m[1], m[0]) * 180 / Math.PI : 0);
    };
    /* a bead's pose is rotate(a) translateY(-r) rotate(-a): a translation */
    var beadAt = function (el) { var m = matrix(getComputedStyle(el).transform); return m ? Math.atan2(m[4], -m[5]) * 180 / Math.PI : 0; };
    var pose = function (el, a) { var r = getComputedStyle(el).getPropertyValue("--r").trim(); return "rotate(" + a.toFixed(2) + "deg) translateY(calc(-1 * " + r + ")) rotate(" + (-a).toFixed(2) + "deg)"; };
    var rot = function (a) { return "rotate(" + a.toFixed(2) + "deg)"; };
    /* each orbit's dots go to its targets in clockwise order, matched by
       code, with the shift that travels least */
    var dotTargets = function (nowL, finL) {
      var out = [];
      layers.forEach(function (l, i) {
        var ds = dots.filter(function (d) { return d.parentNode === l; });
        if (!ds.length) return;
        var tg = STOP_DOTS[ds[0].firstElementChild.getAttribute("data-orbit")];
        var abs = ds.map(function (d) { return nowL[i] + turnOf(d); });
        var order = ds.map(function (d, j) { return j; }).sort(function (p, q) { return norm(abs[p]) - norm(abs[q]); });
        var best = null;
        for (var k = 0; k < tg.length; k++) {
          var ok = order.every(function (j, n) { return ds[j].firstElementChild.getAttribute("data-code") === tg[(n + k) % tg.length][1]; });
          if (!ok) continue;
          var cost = order.reduce(function (c, j, n) { return c + Math.abs(near(abs[j], tg[(n + k) % tg.length][0]) - abs[j]); }, 0);
          if (best === null || cost < best.cost) best = { k: k, cost: cost };
        }
        order.forEach(function (j, n) { out.push([ds[j], near(abs[j], tg[(n + best.k) % tg.length][0]) - finL[i]]); });
      });
      return out;
    };
    var stopped = false;
    stopBtn.addEventListener("click", function () {
      var nowL = layers.map(turnOf), nowB = beads.map(beadAt), nowD = dots.map(turnOf);
      stopped = !stopped;
      stopBtn.setAttribute("aria-pressed", String(stopped));
      hero.classList.toggle("is-stopped", stopped);
      if (stopped) {
        if (secret) { secret.textContent = ""; secret.textContent = SECRET; }
        var finL = nowL.map(function (a) { return near(a, 0); });
        var to = dotTargets(nowL, finL);
        emb.classList.remove("is-gliding");
        emb.classList.add("is-still");
        layers.forEach(function (l, i) { l.style.transform = rot(nowL[i]); });
        beads.forEach(function (b, i) { b.style.transform = pose(b, nowB[i]); });
        void emb.offsetWidth;
        emb.classList.add("is-gliding");
        layers.forEach(function (l, i) { l.style.transform = rot(finL[i]); });
        beads.forEach(function (b, i) { b.style.transform = pose(b, near(nowB[i], STOP_BODY[b.getAttribute("data-body")])); });
        to.forEach(function (t) { t[0].style.transform = rot(near(turnOf(t[0]), t[1])); });
      } else {
        emb.classList.remove("is-gliding", "is-still");
        /* where nothing turns (reduced motion), resuming undoes the stop: the
           dots go back to their own places; else they carry on from here */
        var moving = matchMedia("(prefers-reduced-motion: no-preference)").matches;
        dots.forEach(function (d, i) { d.style.transform = moving ? rot(nowD[i]) : home[i]; });
        layers.forEach(function (l, i) { l.style.transform = ""; restart(l, nowL[i], 0); });
        beads.forEach(function (b, i) { b.style.transform = ""; restart(b, nowB[i], parseFloat(getComputedStyle(b).getPropertyValue("--a")) || 0); });
      }
    });
    /* start a part's animation at the time that puts it at angle a (a0 is
       where it starts); the tick snaps to its nearest second */
    function restart(el, a, a0) {
      var list = el.getAnimations();
      list.forEach(function (q) { if (q instanceof CSSTransition) q.cancel(); });
      var sec = Math.round(norm(-a) / 6) % 60;
      list.forEach(function (q) {
        if (!(q instanceof CSSAnimation)) return;
        if (el.classList.contains("e-tick")) { q.currentTime = sec * 1000; return; }
        var t = q.effect.getTiming(), d = t.direction === "reverse" ? -1 : 1;
        q.currentTime = norm((a - a0) * d) / 360 * q.effect.getComputedTiming().duration;
      });
    }
  }

  /* the ground picker: html[data-ground] carries the choice (nts-head.js
     sets it before paint from storage); the radios follow it */
  var pick = document.querySelector(".e-pick");
  if (pick) {
    var root = document.documentElement;
    var chosen = pick.querySelector('input[value="' + (root.getAttribute("data-ground") === "opening" ? "opening" : "sun") + '"]');
    if (chosen) chosen.checked = true;
    pick.addEventListener("change", function (e) {
      var v = e.target.value;
      if (v === "opening") root.setAttribute("data-ground", "opening"); else root.removeAttribute("data-ground");
      try { localStorage.setItem("nts:ground", v); } catch (err) { /* storage off: the choice lasts this page */ }
    });
  }

  /* falling in (coming back is named in nts-head.js, which owns the world
     list and the body lookup) */
  var NTS = window.NTS;
  addEventListener("pageswap", function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry || !NTS || !NTS.world) return;
    var w = NTS.world(e.activation.entry.url), el = w && NTS.body(w);
    if (!el) return;
    el.style.viewTransitionName = "orb";
    var clear = function () { el.style.viewTransitionName = ""; };
    e.viewTransition.finished.then(clear, clear);
  });
})();
