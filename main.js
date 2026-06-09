/* ============================================
   SoftBaseLabs — GSAP + Lenis interactions
   Plugins (all free in GSAP 3.13+):
     • ScrollTrigger — scroll-driven animation
     • SplitText     — animated headlines
     • Lenis         — smooth scrolling
   ============================================ */

gsap.registerPlugin(ScrollTrigger, SplitText, Flip, ScrambleTextPlugin);

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
  const allCards = gsap.utils.toArray(".card");

  const mm = gsap.matchMedia();

  // DESKTOP / TABLET — pinned horizontal scroll
  mm.add("(min-width: 769px)", () => {
    const getScrollAmount = () => track.scrollWidth - window.innerWidth;
    const tween = gsap.to(track, { x: () => -getScrollAmount(), ease: "none" });

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
      trigger: section, start: "top top", end: () => "+=" + getScrollAmount(),
      pin: true, scrub: 1, animation: tween, invalidateOnRefresh: true,
      onUpdate: updateFeatured, onRefresh: updateFeatured,
    });

    if (prefersReduced) return;

    allCards.forEach((card) => {
      const media = card.querySelector(".card__media");
      const img = card.querySelector(".card__img");
      gsap.fromTo(media, { clipPath: "inset(0 0 100% 0)" }, {
        clipPath: "inset(0 0 0% 0)", ease: "power2.out",
        scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 92%", end: "left 50%", scrub: true },
      });
      gsap.fromTo(img, { xPercent: -8 }, {
        xPercent: 8, ease: "none",
        scrollTrigger: { trigger: card, containerAnimation: tween, start: "left right", end: "right left", scrub: true },
      });
    });
  });

  // MOBILE — cards stack vertically, simple reveal on scroll (no pin)
  mm.add("(max-width: 768px)", () => {
    allCards.forEach((card) => card.classList.remove("is-featured"));
    if (prefersReduced) return;
    allCards.forEach((card) => {
      gsap.from(card, {
        y: 40, autoAlpha: 0, duration: 0.8, ease: "power3.out",
        scrollTrigger: { trigger: card, start: "top 88%" },
      });
    });
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

  // A gallery item can be a CSS background string OR a { video, poster } object.
  const isVideo = (img) => img && typeof img === "object" && img.video;
  const bgValue = (img) => (isVideo(img) ? `url('${img.poster}')` : img);

  const projects = [
    { name: "PRODXSHANE", theme: { bg: "#1A0B0B", text: "#F2EFEA", accent: "#E23A2E" },
      desc: "Music producer & sound architect — helping artists build their signature sound.",
      specs: [["Completed", "2024"], ["Type", "Music / Brand"], ["Role", "Producer & Sound Design"], ["Client", "PRODXSHANE"]],
      images: [{ video: "images/hover.mp4", poster: "images/prodxshane.jpg" }, "url('images/prodxshane-2.jpg')", "url('images/prodxshane-3.jpg')", { video: "images/hover-4.mp4", poster: "images/prodxshane-4.jpg" }] },
    { name: "X-RAY", theme: { bg: "#0B0E14", text: "#EAF0F8", accent: "#3B82F6" },
      desc: "X-Ray — a BMW service & body shop site with cinematic build reveals.",
      specs: [["Completed", "2025"], ["Type", "Automotive / Web"], ["Role", "Design & Dev"], ["Client", "BMW Body Shop"]],
      images: [{ video: "images/bmw-hover-2.mp4", poster: "images/bmw-1.jpg" }, "url('images/bmw-2.jpg')", "url('images/bmw-3.jpg')", { video: "images/bmw-hover-1.mp4", poster: "images/bmw-4.jpg" }] },
    { name: "ROOF CO", theme: { bg: "#ECEAE4", text: "#16130E", accent: "#E4308A" },
      desc: "Roof Co — a roofing company site built layer by layer, with engineered curb appeal.",
      specs: [["Completed", "2025"], ["Type", "Service / Web"], ["Role", "Design & Dev"], ["Client", "The Roofing Co."]],
      images: ["url('images/roof-1.jpg')", "url('images/roof-2.jpg')", "url('images/roof-3.jpg')", "url('images/roof-4.jpg')"] },
    { name: "PROTYPE", theme: { bg: "#0A0D12", text: "#EAF2F4", accent: "#5FD0D6" },
      desc: "ProType — a snowboard brand site with particle-built type and signal-driven motion.",
      specs: [["Completed", "2025"], ["Type", "Brand / Web"], ["Role", "Design & Dev"], ["Client", "ProType"]],
      images: [{ video: "images/protype-hover-1.mp4", poster: "images/protype-1.jpg" }, "url('images/protype-2.jpg')", "url('images/protype-3.jpg')", { video: "images/protype-hover-4.mp4", poster: "images/protype-4.jpg" }] },
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
  let stageHover = false; // is the pointer over the stage (for hover-to-play video)

  const renderStack = () => {
    for (let i = 0; i < stackLayers.length; i++) {
      gsap.set(stackLayers[i], { y: (i - vProgress) * travel });
    }
  };

  // Play the in-frame video only while the stage is hovered; pause otherwise.
  const updateVideoPlayback = () => {
    stackLayers.forEach((el, i) => {
      if (el.tagName !== "VIDEO") return;
      if (i === galleryIndex && stageHover && !prefersReduced) {
        const p = el.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        el.pause();
      }
    });
  };

  const buildStack = (images) => {
    stackLayers.forEach((el) => el.remove());
    stackLayers = [];
    const r = media.getBoundingClientRect(); // resting frame rect
    // next image starts at the very bottom of the page, then travels up to the frame
    travel = Math.max(window.innerHeight - r.top, r.height + 40);
    images.forEach((img) => {
      let el;
      if (isVideo(img)) {
        el = document.createElement("video");
        el.src = img.video;
        el.muted = true; el.loop = true; el.playsInline = true;
        el.preload = "none"; el.poster = img.poster; // load on hover-play, not on build (better INP)
        el.className = "detail__media-layer detail__media-layer--video";
      } else {
        el = document.createElement("div");
        el.className = "detail__media-layer";
        el.style.backgroundImage = img;
      }
      el.style.left = r.left + "px";
      el.style.top = r.top + "px";
      el.style.width = r.width + "px";
      el.style.height = r.height + "px";
      detail.appendChild(el);
      stackLayers.push(el);
    });
    renderStack();
    updateVideoPlayback();
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
      updateVideoPlayback();
    }
  };
  gsap.ticker.add(vTick);

  const buildGallery = (p) => {
    galleryTrack.innerHTML = "";
    thumbs = [];
    p.images.forEach((img, i) => {
      const li = document.createElement("li");
      li.style.backgroundImage = bgValue(img);
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
    media.style.backgroundImage = bgValue(p.images[0]);
    thumbs[0].classList.add("is-active");
    positionGallery(0, false);
  };

  const open = (card) => {
    current = +card.dataset.project;
    activeCard = card;
    populate(current);
    vProgress = 0; vTarget = 0; galleryIndex = 0; stageHover = false;

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
    media.style.backgroundImage = bgValue(currentImages[galleryIndex] || currentImages[0]);
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

  // Hover over the stage to play the in-frame video; leaving pauses it
  const onStageEnter = () => { if (stageHover) return; stageHover = true; updateVideoPlayback(); };
  const onStageLeave = () => { stageHover = false; updateVideoPlayback(); };
  stage.addEventListener("pointerenter", onStageEnter);
  stage.addEventListener("pointermove", onStageEnter); // also catch the stage appearing under a still cursor
  stage.addEventListener("pointerleave", onStageLeave);

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
   13. Tech-stack — scramble/decode headline + logo grid
   -------------------------------------------- */
function initStack() {
  const section = document.getElementById("stack");
  const lines = gsap.utils.toArray("[data-scramble]");
  if (!section || !lines.length || prefersReduced) return;

  const scramble = (char, duration) =>
    gsap.to(char, {
      duration,
      ease: "none",
      overwrite: true,
      scrambleText: { text: char.dataset.char, chars: "upperCase", speed: 0.8 },
    });

  // Split each headline line into a masked inner wrapper + per-letter spans.
  // The inner wrapper rises from behind the line's mask; letters scramble on hover.
  const inners = [];
  lines.forEach((line) => {
    const text = line.textContent;
    line.textContent = "";
    const inner = document.createElement("span");
    inner.className = "stack__lineinner";
    [...text].forEach((ch) => {
      const s = document.createElement("span");
      if (ch === " ") {
        s.className = "stack__char stack__char--space";
        s.innerHTML = "&nbsp;";
        inner.appendChild(s);
        return;
      }
      s.className = "stack__char";
      s.textContent = ch;
      s.dataset.char = ch;
      s.addEventListener("mouseenter", () => scramble(s, 0.5)); // hover: re-scramble that letter
      inner.appendChild(s);
    });
    line.appendChild(inner);
    inners.push(inner);
  });

  // Headline: each line wipes UP from behind its mask, scrubbed to scroll
  gsap.timeline({
    scrollTrigger: { trigger: section, start: "top 82%", end: "top 32%", scrub: true },
  }).fromTo(inners, { yPercent: 118 }, { yPercent: 0, ease: "power3.out", stagger: 0.25 });

  // Grid: cells fly in from the sides and converge into the 3x3 grid, scrubbed.
  // Left column from the left, right column from the right, middle column up.
  gsap.from(gsap.utils.toArray(".stack__cell"), {
    x: (i) => (i % 3 === 0 ? -160 : i % 3 === 2 ? 160 : 0),
    y: (i) => (i % 3 === 1 ? 100 : 0),
    autoAlpha: 0,
    ease: "power3.out",
    stagger: { each: 0.06, from: "center" },
    scrollTrigger: { trigger: ".stack__grid", start: "top 88%", end: "top 42%", scrub: true },
  });
}

/* --------------------------------------------
   14. Our Process — pinned horizontal moodboard
   -------------------------------------------- */
function initProcess() {
  const section = document.getElementById("process");
  const track = document.getElementById("processTrack");
  const path = document.getElementById("processLine");
  const svg = document.getElementById("processPath");
  const mascot = document.getElementById("processMascot");
  if (!section || !track || !path) return;

  const grad = (a, b) => `linear-gradient(135deg, ${a}, ${b})`;

  // Each stop is an asymmetric composition: a text block + scattered images,
  // each placed at its own absolute coords for an editorial, non-templated look.
  const stops = [
    { label: "01 — Discover", title: "Listen<br>first.", cap: "Questions, research, and listening — we map the terrain before we move.",
      text: { x: 1360, y: 300 },
      imgs: [ { x: 740, y: 60, w: 360, h: 640, rot: -2, src: "images/process-1.jpg" }, { x: 1010, y: 480, w: 300, h: 280, rot: 5, g: grad("#CDD3DB", "#6B7686") } ] },
    { label: "02 — Define", title: "Find the<br>angle.", cap: "We sharpen the brief into a clear direction and a plan worth building.",
      text: { x: 2000, y: 560 },
      imgs: [ { x: 2000, y: 90, w: 660, h: 440, rot: 2, g: grad("#8E8BFF", "#2B2A8C") }, { x: 2720, y: 280, w: 270, h: 480, rot: -5, src: "images/process-2.jpg" } ] },
    { label: "03 — Design", title: "Make it<br>feel.", cap: "Type, motion and systems — the look and feel comes alive.",
      text: { x: 3300, y: 150 },
      imgs: [ { x: 3300, y: 410, w: 580, h: 370, rot: -3, g: grad("#6FE3B0", "#1B4D3E") }, { x: 3900, y: 120, w: 300, h: 270, rot: 6, g: grad("#FFD9A0", "#C2410C") } ] },
    { label: "04 — Build", title: "Build it<br>right.", cap: "We engineer it — animation-led, fast, and accessible by default.",
      text: { x: 4540, y: 650 },
      imgs: [ { x: 4560, y: 60, w: 360, h: 640, rot: 3, src: "images/process-3.jpg" }, { x: 4960, y: 340, w: 340, h: 260, rot: -4, g: grad("#A6EEF0", "#2B6E72") } ] },
    { label: "05 — Launch", title: "Ship &<br>shine.", cap: "Ship, measure, refine — then celebrate the work.",
      text: { x: 5840, y: 640 },
      imgs: [ { x: 5840, y: 200, w: 600, h: 400, rot: -2, g: grad("#FF8A4C", "#7A1E0A") }, { x: 6080, y: 90, w: 250, h: 240, rot: 7, g: grad("#FFB37A", "#FF3B14") } ] },
  ];

  const tileEls = [];
  stops.forEach((s) => {
    const block = document.createElement("div");
    block.className = "process__text";
    block.style.left = s.text.x + "px";
    block.style.top = s.text.y + "px";
    block.innerHTML = `<span class="process__label">${s.label}</span><h3 class="process__big"><span data-step-label>${s.title}</span></h3><p>${s.cap}</p>`;
    track.appendChild(block);
    s.imgs.forEach((t) => {
      const tile = document.createElement("div");
      tile.className = "process__tile";
      tile.style.cssText = `left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px;background-image:${t.src ? `url('${t.src}')` : t.g};`;
      tile.dataset.rot = t.rot;
      track.appendChild(tile);
      gsap.set(tile, { rotation: t.rot });
      tileEls.push(tile);
    });
  });

  // hover tilt (rotation/scale are gsap-managed so they compose with parallax)
  if (!isTouch) {
    tileEls.forEach((tile) => {
      const base = parseFloat(tile.dataset.rot) || 0;
      tile.addEventListener("mouseenter", () => gsap.to(tile, { rotation: 0, scale: 1.05, duration: 0.5, ease: "power3.out", overwrite: "auto" }));
      tile.addEventListener("mouseleave", () => gsap.to(tile, { rotation: base, scale: 1, duration: 0.6, ease: "power3.out", overwrite: "auto" }));
    });
  }

  const mm = gsap.matchMedia();

  // DESKTOP — pinned horizontal travel
  mm.add("(min-width: 769px)", () => {
    const getScroll = () => track.scrollWidth - window.innerWidth;
    const tween = gsap.to(track, { x: () => -getScroll(), ease: "none" });

    ScrollTrigger.create({
      trigger: section, start: "top top", end: () => "+=" + getScroll(),
      pin: true, scrub: 1, animation: tween, invalidateOnRefresh: true,
    });

    // dashed line draws in left-to-right
    gsap.fromTo(svg, { clipPath: "inset(0 100% 0 0)" }, {
      clipPath: "inset(0 0% 0 0)", ease: "none",
      scrollTrigger: { trigger: section, start: "top top", end: () => "+=" + getScroll(), scrub: true },
    });

    // mascot rides the path
    const len = path.getTotalLength();
    const place = (prog) => {
      const p = path.getPointAtLength(Math.max(0, Math.min(1, prog)) * len);
      gsap.set(mascot, { x: p.x, y: p.y });
    };
    place(0);
    ScrollTrigger.create({
      trigger: section, start: "top top", end: () => "+=" + getScroll(), scrub: true,
      onUpdate: (self) => place(self.progress),
    });

    if (prefersReduced) return;

    // parallax on the scattered images
    tileEls.forEach((tile, i) => {
      gsap.fromTo(tile, { y: 34 * (i % 2 ? 1 : -1) }, {
        y: -34 * (i % 2 ? 1 : -1), ease: "none",
        scrollTrigger: { trigger: tile, containerAnimation: tween, start: "left right", end: "right left", scrub: true },
      });
    });
    // serif phrases wipe up as each stop enters
    gsap.utils.toArray("[data-step-label]").forEach((label) => {
      gsap.from(label, { yPercent: 110, opacity: 0, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: label, containerAnimation: tween, start: "left 92%" } });
    });
  });

  // MOBILE — vertical timeline
  mm.add("(max-width: 768px)", () => {
    if (prefersReduced) return;
    gsap.utils.toArray(".process__text").forEach((b) =>
      gsap.from(b, { y: 40, autoAlpha: 0, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: b, start: "top 88%" } }));
  });
}

/* --------------------------------------------
   15. Full-screen menu overlay
   -------------------------------------------- */
function initMenu() {
  const menu = document.getElementById("menu");
  const btn = document.getElementById("menuBtn");
  const label = document.getElementById("menuLabel");
  if (!menu || !btn) return;

  const links = menu.querySelectorAll(".menu__link span");
  const meta = menu.querySelector(".menu__meta");

  const tl = gsap.timeline({ paused: true });
  tl.set(menu, { autoAlpha: 1 })
    .fromTo(menu, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.7, ease: "power4.inOut" })
    .fromTo(links, { yPercent: 120 }, { yPercent: 0, duration: 0.7, ease: "power3.out", stagger: 0.08 }, "-=0.35")
    .fromTo(meta, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.4");

  let open = false;
  const set = (state) => {
    if (state === open) return;
    open = state;
    btn.setAttribute("aria-expanded", String(state));
    menu.setAttribute("aria-hidden", String(!state));
    label.textContent = state ? "Close" : "Menu";
    document.body.classList.toggle("menu-open", state);
    if (state) { if (lenis) lenis.stop(); tl.timeScale(1).play(); }
    else { if (lenis) lenis.start(); tl.timeScale(1.5).reverse(); }
  };

  btn.addEventListener("click", () => set(!open));
  menu.querySelectorAll(".menu__link").forEach((a) => a.addEventListener("click", () => set(false)));
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) set(false); });

  // scroll-spy — highlight the section you're currently in
  ["work", "about", "stack", "process", "contact"].forEach((id) => {
    const sec = document.getElementById(id);
    const link = menu.querySelector(`.menu__link[href="#${id}"]`);
    if (!sec || !link) return;
    ScrollTrigger.create({
      trigger: sec, start: "top 50%", end: "bottom 50%",
      onToggle: (self) => link.classList.toggle("is-current", self.isActive),
    });
  });
}

/* --------------------------------------------
   15. Mouse-reactive hero parallax (depth)
   -------------------------------------------- */
function initHeroParallax() {
  if (prefersReduced || isTouch) return;
  const layers = [
    [".hero__title", 16],
    [".hero__meta", 30],
    [".hero__lede", 22],
    [".scrollcue", 22],
  ]
    .map(([sel, depth]) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return {
        depth,
        xTo: gsap.quickTo(el, "x", { duration: 0.7, ease: "power3" }),
        yTo: gsap.quickTo(el, "y", { duration: 0.7, ease: "power3" }),
      };
    })
    .filter(Boolean);
  if (!layers.length) return;

  window.addEventListener("mousemove", (e) => {
    const dx = (e.clientX / window.innerWidth - 0.5) * 2;  // -1..1
    const dy = (e.clientY / window.innerHeight - 0.5) * 2;
    layers.forEach((l) => { l.xTo(-dx * l.depth); l.yTo(-dy * l.depth); });
  });
}

/* --------------------------------------------
   16. Live clock in the nav (local time)
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
  initStack();
  initProcess();
  initMenu();
  initHeroParallax();

  // Loader runs, then hero plays
  initLoader(() => {
    initHero();
    ScrollTrigger.refresh();
  });
});

// Recalculate pinned/horizontal measurements on resize
window.addEventListener("resize", () => ScrollTrigger.refresh());
