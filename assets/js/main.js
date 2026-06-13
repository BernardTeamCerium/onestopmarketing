/* =================================================================
   MERIDIAN — interactions
   ================================================================= */
(function () {
  "use strict";

  // Where contact-form submissions are emailed. Update to the real inbox.
  var CONTACT_EMAIL = "info@onestopmarketing.com";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Sticky header condense ---- */
  var header = document.getElementById("header");
  function onScroll() {
    if (window.scrollY > 24) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Mobile menu ---- */
  var toggle = document.getElementById("menuToggle");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---- Scroll reveal ---- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !prefersReduced) {
    var revObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          revObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el, i) {
      // subtle stagger for grouped siblings
      el.style.transitionDelay = ((i % 4) * 70) + "ms";
      revObserver.observe(el);
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- Animated counters ---- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-target"));
    var hasDecimal = target % 1 !== 0;
    var dur = 1600;
    var start = null;

    function fmt(n) {
      if (hasDecimal) return n.toFixed(1);
      return Math.round(n).toLocaleString("en-US");
    }
    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = fmt(target);
    }
    requestAnimationFrame(frame);
  }

  var counters = document.querySelectorAll(".count");
  if ("IntersectionObserver" in window && !prefersReduced) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          // trigger the stat-card bar fill if present
          var card = entry.target.closest(".stat-card");
          if (card) card.classList.add("in");
          countObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { countObserver.observe(c); });
  } else {
    counters.forEach(function (c) {
      var t = parseFloat(c.getAttribute("data-target"));
      c.textContent = (t % 1 !== 0) ? t.toFixed(1) : t.toLocaleString("en-US");
    });
    var sc = document.querySelector(".stat-card");
    if (sc) sc.classList.add("in");
  }

  /* ---- Pointer tilt on glass cards ---- */
  if (!prefersReduced && window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".tilt").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          "rotateY(" + (px * 7).toFixed(2) + "deg) rotateX(" + (-py * 7).toFixed(2) + "deg) translateY(-4px)";
      });
      card.addEventListener("mouseleave", function () {
        card.style.transform = "";
      });
    });
  }

  /* ---- Contact form (front-end demo handling) ---- */
  var form = document.getElementById("contactForm");
  var note = document.getElementById("formNote");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      note.className = "form-note";
      note.textContent = "";

      var name = form.elements.namedItem("name");
      var email = form.elements.namedItem("email");
      var valid = true;

      [name, email].forEach(function (f) { f.classList.remove("invalid"); });

      if (!name.value.trim()) { name.classList.add("invalid"); valid = false; }
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
      if (!emailOk) { email.classList.add("invalid"); valid = false; }

      if (!valid) {
        note.classList.add("err");
        note.textContent = "Please enter your name and a valid email so we can reach you.";
        return;
      }

      // Compose a pre-filled email to the agency from the form contents.
      var get = function (id) {
        var el = form.elements.namedItem(id);
        return el && el.value ? el.value.trim() : "";
      };
      var firm = get("firm");
      var subject = "Strategy call request — " + name.value.trim() + (firm ? " (" + firm + ")" : "");
      var bodyLines = [
        "Name: " + name.value.trim(),
        "Firm: " + (firm || "—"),
        "Email: " + email.value.trim(),
        "Phone: " + (get("phone") || "—"),
        "",
        "What they'd like to grow:",
        get("message") || "—"
      ];
      var mailto = "mailto:" + CONTACT_EMAIL +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(bodyLines.join("\n"));

      window.location.href = mailto;

      note.classList.add("ok");
      note.textContent = "Thanks, " + name.value.trim().split(" ")[0] +
        "! Your email app should open with your request ready to send. Prefer to write us directly? " + CONTACT_EMAIL;
    });
  }

  /* ---- Footer year ---- */
  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();
