/* ============================================
   SoftBaseLabs — GSAP + Lenis interactions
   Plugins (all free in GSAP 3.13+):
     • ScrollTrigger — scroll-driven animation
     • SplitText     — animated headlines
     • Lenis         — smooth scrolling
   ============================================ */

gsap.registerPlugin(ScrollTrigger, SplitText, Flip);

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;

/* --------------------------------------------
   1. Smooth scrolling (Lenis) wired to ScrollTrigger
   -------------------------------------------- */
let lenis;
function initSmoothScroll() {
  if (prefersReduced) return;
  lenis = new Lenis({ duration: 1.1, smoothWheel: true });

  // Progress bar + scroll-velocity skew, all driven off Lenis
  const progressBar = document.getElementById("progressBar");
  const skewEls = gsap.utils.toArray("[data-skew]");
  const skewSetters = skewEls.map((el) => gsap.quickTo(el, "skewY", { duration: 0.4, ease: "power3" }));
  const clampSkew = gsap.utils.clamp(-6, 6);

  lenis.on("scroll", (e) => {
    ScrollTrigger.update();
    const p = typeof e.progress === "number" ? e.progress : e.scroll / (e.limit || 1);
    gsap.set(progressBar, { scaleX: p || 0 });
    const sk = clampSkew(e.velocity * 0.35);
    skewSetters.forEach((set) => set(sk));
  });

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Anchor links route through Lenis for smooth jumps
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length > 1) {
        e.preventDefault();
        lenis.scrollTo(id, { offset: 0 });
      }
    });
  });
}

/* --------------------------------------------
   2. Loader — counts to 100, then reveals the hero
   -------------------------------------------- */
function initLoader(onComplete) {
  const loader = document.getElementById("loader");
  const countEl = document.getElementById("loaderCount");

  if (prefersReduced) {
    loader.style.display = "none";
    onComplete();
    return;
  }

  const counter = { v: 0 };
  const tl = gsap.timeline({ onComplete });

  tl.to(counter, {
    v: 100,
    duration: 2,
    ease: "power2.inOut",
    onUpdate: () => (countEl.textContent = Math.round(counter.v)),
  })
    .to(loader, { yPercent: -100, duration: 1, ease: "expo.inOut" }, "+=0.2")
    .set(loader, { display: "none" });
}

/* --------------------------------------------
   3. Hero headline reveal (SplitText, line masks)
   -------------------------------------------- */
function initHero() {
  const title = document.querySelector(".hero__title");

  // Each .line already has overflow:hidden; animate inner text up
  const lines = gsap.utils.toArray(".hero__title .line");

  if (prefersReduced) {
    gsap.set([".hero__lede", ".scrollcue"], { opacity: 1 });
    return;
  }

  gsap.set(lines, { yPercent: 110 });

  const tl = gsap.timeline({ delay: 0.1 });
  tl.to(lines, {
    yPercent: 0,
    duration: 1.1,
    ease: "expo.out",
    stagger: 0.12,
  }).from(
    [".hero__lede", ".scrollcue"],
    { y: 24, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.1 },
    "-=0.6"
  );
}

/* --------------------------------------------
   4. Scroll reveals — generic fade/slide up
   -------------------------------------------- */
function initReveals() {
  if (prefersReduced) return;

  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    // Skip hero items — they're handled in the intro timeline
    if (el.closest(".hero")) return;
    gsap.from(el, {
      y: 40,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });
}

/* --------------------------------------------
   5. About paragraph — TYPES OUT as you scroll
   -------------------------------------------- */
function initTyping() {
  const el = document.querySelector("[data-type]");
  if (!el) return;

  // GSAP 3.13 SplitText must run AFTER webfonts load, otherwise it
  // measures the fallback font (or returns nothing) and the split is wrong.
  const ready = document.fonts && document.fonts.ready
    ? document.fonts.ready
    : Promise.resolve();

  ready.then(() => {
    const split = new SplitText(el, { type: "words,chars" });
    const chars = split.chars;
    const total = chars.length;
    if (!total) return;

    if (prefersReduced) {
      gsap.set(chars, { opacity: 1 });
      return;
    }

    gsap.set(chars, { opacity: 0 });

    // Blinking caret that rides along the typed position
    const caret = document.createElement("span");
    caret.className = "caret";
    el.appendChild(caret);

    let typed = 0; // how many chars are currently shown
    const placeCaret = (count) => {
      const ref = chars[Math.min(count, total - 1)];
      if (!ref) return;
      const atEnd = count >= total;
      // Measure relative to the paragraph (chars are nested inside word wrappers,
      // so offsetTop/Left would be relative to the word, not the paragraph).
      const base = el.getBoundingClientRect();
      const r = ref.getBoundingClientRect();
      caret.style.left = r.left - base.left + (atEnd ? r.width : 0) + "px";
      caret.style.top = r.top - base.top + "px";
      caret.style.height = r.height + "px";
    };

    ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      end: "top 15%",
      scrub: 0.25,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const count = Math.round(self.progress * total);
        if (count === typed) return;
        if (count > typed) {
          for (let i = typed; i < count; i++) if (chars[i]) chars[i].style.opacity = "1";
        } else {
          for (let i = typed - 1; i >= count; i--) if (chars[i]) chars[i].style.opacity = "0";
        }
        typed = count;
        placeCaret(count);
      },
    });

    placeCaret(0);
    ScrollTrigger.refresh(); // recalc positions now that chars exist
  });
}

/* --------------------------------------------
   6. Work — pinned horizontal scroll
   -------------------------------------------- */
function initHorizontalWork() {
  const section = document.querySelector(".work");
  const track = document.querySelector(".work__track");
  if (!section || !track) return;

  const getScrollAmount = () => track.scrollWidth - window.innerWidth;

  const tween = gsap.to(track, {
    x: () => -getScrollAmount(),
    ease: "none",
  });

  const allCards = gsap.utils.toArray(".card");

  // Highlight the project nearest screen-center as "featured" while scrolling
  const updateFeatured = () => {
    const cx = window.innerWidth / 2;
    let best = null, bestDist = Infinity;
    allCards.forEach((card) => {
      const r = card.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - cx);
      if (d < bestDist) { bestDist = d; best = card; }
    });
    allCards.forEach((card) => card.classList.toggle("is-featured", card === best));
  };

  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => "+=" + getScrollAmount(),
    pin: true,
    scrub: 1,
    animation: tween,
    invalidateOnRefresh: true,
    onUpdate: updateFeatured,
    onRefresh: updateFeatured,
  });

  if (prefersReduced) return;

  // Per-card effects tied to HORIZONTAL motion via containerAnimation
  gsap.utils.toArray(".card").forEach((card) => {
    const media = card.querySelector(".card__media");
    const img = card.querySelector(".card__img");

    // Clip-path wipe reveal as the card enters from the right
    gsap.fromTo(
      media,
      { clipPath: "inset(0 0 100% 0)" },
      {
        clipPath: "inset(0 0 0% 0)",
        ease: "power2.out",
        scrollTrigger: {
          trigger: card,
          containerAnimation: tween,
          start: "left 92%",
          end: "left 50%",
          scrub: true,
        },
      }
    );

    // Image parallax inside its frame
    gsap.fromTo(
      img,
      { xPercent: -8 },
      {
        xPercent: 8,
        ease: "none",
        scrollTrigger: {
          trigger: card,
          containerAnimation: tween,
          start: "left right",
          end: "right left",
          scrub: true,
        },
      }
    );
  });
}

/* --------------------------------------------
   7. Contact CTA reveal
   -------------------------------------------- */
function initContact() {
  const lines = gsap.utils.toArray(".contact__cta .line");
  if (prefersReduced) return;

  gsap.set(lines, { yPercent: 110 });
  gsap.to(lines, {
    yPercent: 0,
    duration: 1,
    ease: "expo.out",
    scrollTrigger: { trigger: ".contact__cta", start: "top 85%" },
  });
}

/* --------------------------------------------
   8. Magnetic buttons + custom cursor
   -------------------------------------------- */
function initMagnetic() {
  if (isTouch || prefersReduced) return;

  document.querySelectorAll(".magnetic").forEach((el) => {
    const strength = 0.4;
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: x * strength, y: y * strength, duration: 0.6, ease: "power3.out" });
    });
    el.addEventListener("mouseleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.3)" });
    });
  });
}

function initCursor() {
  if (isTouch) return;
  const cursor = document.querySelector(".cursor");
  let x = 0, y = 0, cx = 0, cy = 0;

  window.addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; });

  gsap.ticker.add(() => {
    cx += (x - cx) * 0.18;
    cy += (y - cy) * 0.18;
    gsap.set(cursor, { x: cx, y: cy });
  });

  document.querySelectorAll("a, .magnetic").forEach((el) => {
    el.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
    el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
  });

  // Project cards get the larger "View" badge
  document.querySelectorAll("[data-card]").forEach((el) => {
    el.addEventListener("mouseenter", () => cursor.classList.add("is-view"));
    el.addEventListener("mouseleave", () => cursor.classList.remove("is-view"));
  });
}

/* --------------------------------------------
   9. Section background color morphing
   -------------------------------------------- */
function initThemeMorph() {
  const setBg = (c) =>
    gsap.to(document.body, { backgroundColor: c, duration: 0.7, ease: "power2.out", overwrite: "auto" });

  gsap.utils.toArray("[data-bg]").forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: "top 55%",
      end: "bottom 45%",
      onToggle: (self) => self.isActive && setBg(sec.dataset.bg),
    });
  });
}

/* --------------------------------------------
   10. Count-up stats
   -------------------------------------------- */
function initCounters() {
  gsap.utils.toArray("[data-count]").forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || "";

    if (prefersReduced) {
      el.textContent = end + suffix;
      return;
    }

    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () =>
        gsap.to(obj, {
          v: end,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => (el.textContent = Math.round(obj.v) + suffix),
        }),
    });
  });
}

/* --------------------------------------------
   11. Self-drawing SVG lines (stroke-dashoffset)
   -------------------------------------------- */
function initDraw() {
  gsap.utils.toArray("[data-draw]").forEach((path) => {
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: prefersReduced ? 0 : len });
    if (prefersReduced) return;

    gsap.to(path, {
      strokeDashoffset: 0,
      ease: "none",
      scrollTrigger: { trigger: path, start: "top 85%", end: "bottom 65%", scrub: true },
    });
  });
}

/* --------------------------------------------
   12. Project detail takeover (Flip morph)
   -------------------------------------------- */
function initProjectDetail() {
  const detail = document.getElementById("detail");
  const titleEl = document.getElementById("detailTitle");
  const media = document.getElementById("detailMedia");
  const stage = detail.querySelector(".detail__stage");
  const gallery = document.getElementById("detailGallery");        // masked viewport
  const galleryTrack = document.getElementById("detailGalleryTrack"); // moving strip
  const bar = detail.querySelector(".detail__bar");
  const metaEl = detail.querySelector(".detail__meta");
  const specsEl = document.getElementById("detailSpecs");
  const descEl = document.getElementById("detailDesc");
  const veil = detail.querySelector(".detail__veil");
  const frameCur = document.getElementById("frameCur");
  const frameTotal = document.getElementById("frameTotal");
  const frameTicks = document.getElementById("frameTicks");
  const frameHead = document.getElementById("frameHead");
  const closeBtn = document.getElementById("detailClose");
  const prevBtn = document.getElementById("detailPrev");
  const nextBtn = document.getElementById("detailNext");
  const cards = gsap.utils.toArray("[data-project]");
  if (!detail || !cards.length) return;

  // Placeholder "images" = layered gradients (swap for real <img> later)
  const grad = (c, c2) =>
    `radial-gradient(120% 130% at 18% 8%, ${c2}, transparent 55%), linear-gradient(150deg, ${c}, #0b0a08 165%)`;

  const projects = [
    { name: "AURORA", theme: { bg: "#0E0D10", text: "#F2EFEA", accent: "#FF3B14" },
      desc: "The brand site of Aurora Studios — scroll-driven 3D type and a generative hero.",
      specs: [["Completed", "March 2021"], ["Type", "Promotional"], ["Role", "Fullstack Dev & Motion"], ["Client", "Aurora Studios"]],
      images: [grad("#FF3B14", "#FFB37A"), grad("#7A1E0A", "#FF8A4C"), grad("#2A0E07", "#FFB37A"), grad("#B3300F", "#FFD9A0")] },
    { name: "NOCTURNE", theme: { bg: "#0B1512", text: "#EAF3EE", accent: "#6FE3B0" },
      desc: "A late-night radio platform with audio-reactive visuals and buttery transitions.",
      specs: [["Completed", "Nov 2022"], ["Type", "Product"], ["Role", "Design & Dev"], ["Client", "Nocturne FM"]],
      images: [grad("#1B4D3E", "#6FE3B0"), grad("#0C2B22", "#9CF0C9"), grad("#114A3A", "#5ED1A0"), grad("#06150F", "#6FE3B0")] },
    { name: "FIELD NOTES", theme: { bg: "#E9E3D6", text: "#16130E", accent: "#2B2A8C" },
      desc: "Editorial publication with kinetic typography and pinned chapter scenes.",
      specs: [["Completed", "Feb 2020"], ["Type", "Editorial"], ["Role", "Type & Dev"], ["Client", "Field Notes"]],
      images: [grad("#2B2A8C", "#8E8BFF"), grad("#1A1A5C", "#B6B4FF"), grad("#3D3CB0", "#C9C8FF"), grad("#101040", "#8E8BFF")] },
    { name: "TERRA", theme: { bg: "#ECE4D6", text: "#2A1A10", accent: "#C2410C" },
      desc: "An e-commerce rebrand with playful micro-interactions and a magnetic cart.",
      specs: [["Completed", "Aug 2017"], ["Type", "Commerce"], ["Role", "Brand & Web"], ["Client", "Terra Coffee"]],
      images: [grad("#C2410C", "#F2C14E"), grad("#7A2A08", "#F2C14E"), grad("#9A3A0C", "#FFD98A"), grad("#3A1606", "#F2C14E")] },
  ];

  let current = -1;
  let activeCard = null;
  let currentImages = [];
  let galleryIndex = 0;
  const isOpen = () => detail.getAttribute("aria-hidden") === "false";
  const pad = (n) => String(n).padStart(2, "0");

  // Build the decorative film-strip ticks once
  const TICK_COUNT = 24;
  for (let t = 0; t < TICK_COUNT; t++) {
    frameTicks.insertBefore(document.createElement("i"), frameHead);
  }
  const moveHead = (i, animate) => {
    const frac = projects.length > 1 ? i / (projects.length - 1) : 0;
    // keep the playhead inside the track ends (4%..96%)
    const left = (4 + frac * 92) + "%";
    if (animate && !prefersReduced) {
      gsap.to(frameHead, { left, duration: 0.5, ease: "power3.out", overwrite: true });
    } else {
      gsap.set(frameHead, { left });
    }
  };

  const applyTheme = (t) => {
    detail.style.setProperty("--d-bg", t.bg);
    detail.style.setProperty("--d-text", t.text);
    detail.style.setProperty("--d-accent", t.accent);
  };

  const buildTitle = (name) => {
    titleEl.innerHTML = "";
    [...name].forEach((ch) => {
      const s = document.createElement("span");
      s.textContent = ch === " " ? "  " : ch;
      titleEl.appendChild(s);
    });
  };

  const buildSpecs = (specs) => {
    specsEl.innerHTML = "";
    specs.forEach(([k, v]) => {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      specsEl.append(dt, dd);
    });
  };

  let thumbs = [];

  // Slide the masked strip so the active thumb rises into focus (center)
  const positionGallery = (idx, animate) => {
    const thumb = thumbs[idx];
    if (!thumb) return;
    if (getComputedStyle(galleryTrack).flexDirection !== "column") {
      gsap.set(galleryTrack, { clearProps: "y" }); // mobile = horizontal row
      return;
    }
    const y = gallery.clientHeight / 2 - (thumb.offsetTop + thumb.offsetHeight / 2);
    if (animate && !prefersReduced) {
      gsap.to(galleryTrack, { y, duration: 0.85, ease: "power4.out", overwrite: true });
    } else {
      gsap.set(galleryTrack, { y });
    }
  };

  // ---- Scroll-attached image stack -------------------------------------
  // Full-frame image layers stacked vertically; a smoothed "progress" value
  // (driven by wheel/touch) slides them UP the page, tied to the scroll.
  let stackLayers = [];
  let vProgress = 0; // smoothed (rendered) position
  let vTarget = 0;   // where the input wants to be
  let travel = 0;    // vertical distance between consecutive images

  const renderStack = () => {
    for (let i = 0; i < stackLayers.length; i++) {
      gsap.set(stackLayers[i], { y: (i - vProgress) * travel });
    }
  };

  const buildStack = (images) => {
    stackLayers.forEach((el) => el.remove());
    stackLayers = [];
    const r = media.getBoundingClientRect(); // resting frame rect
    // next image starts at the very bottom of the page, then travels up to the frame
    travel = Math.max(window.innerHeight - r.top, r.height + 40);
    images.forEach((img) => {
      const el = document.createElement("div");
      el.className = "detail__media-layer";
      el.style.backgroundImage = img;
      el.style.left = r.left + "px";
      el.style.top = r.top + "px";
      el.style.width = r.width + "px";
      el.style.height = r.height + "px";
      detail.appendChild(el);
      stackLayers.push(el);
    });
    renderStack();
  };

  const clearStack = () => {
    stackLayers.forEach((el) => el.remove());
    stackLayers = [];
  };

  // Per-frame smoothing: ease vProgress toward vTarget so wheel input feels
  // like a scrubbed scroll rather than discrete jumps.
  const vTick = () => {
    if (!isOpen() || !stackLayers.length) return;
    const diff = vTarget - vProgress;
    if (Math.abs(diff) < 0.0008) {
      if (vProgress !== vTarget) { vProgress = vTarget; renderStack(); }
      return;
    }
    vProgress += diff * 0.12;
    renderStack();
    const idx = Math.round(vProgress);
    if (idx !== galleryIndex) {
      galleryIndex = idx;
      thumbs.forEach((li, i) => li.classList.toggle("is-active", i === idx));
      positionGallery(idx, true);
    }
  };
  gsap.ticker.add(vTick);

  const buildGallery = (p) => {
    galleryTrack.innerHTML = "";
    thumbs = [];
    p.images.forEach((img, i) => {
      const li = document.createElement("li");
      li.style.backgroundImage = img;
      li.className = "magnetic";
      li.addEventListener("click", () => { vTarget = i; }); // smooth-scroll to it
      galleryTrack.appendChild(li);
      thumbs.push(li);
    });
  };

  const populate = (i, animateHead) => {
    const p = projects[i];
    applyTheme(p.theme);
    buildTitle(p.name);
    buildSpecs(p.specs);
    descEl.textContent = p.desc;
    frameCur.textContent = pad(i + 1);
    frameTotal.textContent = pad(projects.length);
    moveHead(i, animateHead);
    buildGallery(p);
    currentImages = p.images;
    galleryIndex = 0;
    media.style.backgroundImage = p.images[0];
    thumbs[0].classList.add("is-active");
    positionGallery(0, false);
  };

  const open = (card) => {
    current = +card.dataset.project;
    activeCard = card;
    populate(current);
    vProgress = 0; vTarget = 0; galleryIndex = 0;

    if (lenis) lenis.stop();
    document.body.classList.add("detail-open");
    detail.setAttribute("aria-hidden", "false");
    gsap.set(detail, { autoAlpha: 1 });
    gsap.set(titleEl, { autoAlpha: 1 });
    gsap.set(media, { autoAlpha: 1 });

    const chrome = [bar, gallery, metaEl];
    gsap.set(chrome, { autoAlpha: 0, y: 18 });
    gsap.set(titleEl.children, { yPercent: 120, opacity: 0 });

    if (prefersReduced) {
      gsap.set(veil, { autoAlpha: 1 });
      gsap.set(chrome, { autoAlpha: 1, y: 0 });
      gsap.set(titleEl.children, { yPercent: 0, opacity: 1 });
      return;
    }

    // soft backdrop wash so the recolor doesn't hard-cut (esp. light themes)
    gsap.fromTo(veil, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: "power2.out" });

    const cardImg = card.querySelector(".card__img");
    const state = Flip.getState(media);            // full-screen layout
    Flip.fit(media, cardImg, { absolute: true });  // snap onto the clicked card
    Flip.from(state, {
      duration: 0.92, ease: "power4.inOut", absolute: true,
      onComplete: () => {
        gsap.set(media, { clearProps: "width,height,transform,position,top,left,inset" });
        buildStack(currentImages);          // hand off to the scroll-driven stack
        gsap.set(media, { autoAlpha: 0 });   // hide; the stack renders the image now
      },
    });

    // chrome and title settle in AFTER the media has mostly arrived
    gsap.to(chrome, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.07, delay: 0.42, ease: "power3.out" });
    gsap.to(titleEl.children, {
      yPercent: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.035, delay: 0.34,
    });
  };

  const close = () => {
    detail.setAttribute("aria-hidden", "true");
    document.body.classList.remove("detail-open");

    const finish = () => {
      gsap.set(detail, { autoAlpha: 0 });
      gsap.set(media, { clearProps: "position,top,left,width,height,transform,opacity" });
      if (lenis) lenis.start();
    };

    // restore the single media element to the currently-shown image, drop the stack
    media.style.backgroundImage = currentImages[galleryIndex] || currentImages[0];
    gsap.set(media, { autoAlpha: 1 });
    clearStack();

    if (prefersReduced || !activeCard) { finish(); return; }

    const cardImg = activeCard.querySelector(".card__img");
    gsap.to([bar, gallery, metaEl, titleEl], { autoAlpha: 0, duration: 0.3, ease: "power2.in" });
    gsap.to(veil, { autoAlpha: 0, duration: 0.5, ease: "power2.in", delay: 0.15 });
    Flip.fit(media, cardImg, { duration: 0.65, ease: "power4.inOut", absolute: true, onComplete: finish });
  };

  // Switch to a specific project without closing (rebuilds the stack, resets scroll)
  const goToProject = (n) => {
    if (n === current || n < 0 || n >= projects.length) return;
    current = n;
    activeCard = cards.find((c) => +c.dataset.project === n) || activeCard;
    populate(n, true);
    vProgress = 0; vTarget = 0; galleryIndex = 0;
    if (prefersReduced) return;
    buildStack(currentImages);
    gsap.set(media, { autoAlpha: 0 });
    gsap.from(stackLayers, { autoAlpha: 0, duration: 0.4 });
    gsap.set(titleEl.children, { yPercent: 110, opacity: 0 });
    gsap.to(titleEl.children, { yPercent: 0, opacity: 1, duration: 0.6, ease: "expo.out", stagger: 0.03 });
  };
  const go = (dir) => goToProject((current + dir + projects.length) % projects.length);

  // Jump one image (keyboard / used at the ends)
  const goImage = (dir) => {
    vTarget = gsap.utils.clamp(0, currentImages.length - 1, Math.round(vTarget) + dir);
  };

  cards.forEach((card) => {
    card.addEventListener("click", () => open(card));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(card); }
    });
  });
  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  // Clicking the top slider jumps to the project at that position
  const frameEl = document.getElementById("detailFrame");
  const sliderJump = (clientX) => {
    const r = frameTicks.getBoundingClientRect();
    const frac = gsap.utils.clamp(0, 1, (clientX - r.left) / r.width);
    goToProject(Math.round(frac * (projects.length - 1)));
  };
  frameEl.addEventListener("click", (e) => { if (isOpen()) sliderJump(e.clientX); });
  frameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(1); }
  });

  // Wheel / trackpad drives the image stack continuously (scrubbed, clamped)
  detail.addEventListener("wheel", (e) => {
    if (!isOpen()) return;
    e.preventDefault();
    vTarget = gsap.utils.clamp(0, currentImages.length - 1, vTarget + e.deltaY * 0.0016);
  }, { passive: false });

  // Touch swipe drives it on mobile
  let touchY = null;
  detail.addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  detail.addEventListener("touchmove", (e) => {
    if (!isOpen() || touchY === null) return;
    const cur = e.touches[0].clientY;
    vTarget = gsap.utils.clamp(0, currentImages.length - 1, vTarget + (touchY - cur) * 0.01);
    touchY = cur;
  }, { passive: true });

  window.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") go(-1);            // previous project
    else if (e.key === "ArrowRight") go(1);            // next project
    else if (e.key === "ArrowUp") { e.preventDefault(); goImage(-1); }  // image up
    else if (e.key === "ArrowDown") { e.preventDefault(); goImage(1); } // image down
  });
}

/* --------------------------------------------
   13. Live clock in the nav (local time)
   -------------------------------------------- */
function initClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };
  tick();
  setInterval(tick, 1000);
}

/* --------------------------------------------
   Boot
   -------------------------------------------- */
window.addEventListener("load", () => {
  initSmoothScroll();
  initClock();
  initCursor();
  initMagnetic();

  // Build scroll-driven animations first so positions are correct
  initReveals();
  initTyping();
  initHorizontalWork();
  initContact();
  initThemeMorph();
  initCounters();
  initDraw();
  initProjectDetail();

  // Loader runs, then hero plays
  initLoader(() => {
    initHero();
    ScrollTrigger.refresh();
  });
});

// Recalculate pinned/horizontal measurements on resize
window.addEventListener("resize", () => ScrollTrigger.refresh());
