# SoftBaseLabs — Motion Portfolio

A kinetic, animation-led personal portfolio built with plain HTML/CSS/JS and GSAP.

## Stack
- **GSAP 3.13** (free, incl. ScrollTrigger, SplitText, Flip) via CDN
- **Lenis** smooth scrolling
- **Chillax** variable font (self-hosted) + Space Mono

## Features
- Counter loader and SplitText headline reveals
- Lenis smooth scroll wired into ScrollTrigger
- Pinned horizontal "Selected Work" row with a featured-on-scroll state
- Scroll-typing About section
- Project takeover via GSAP Flip morph, with:
  - per-project light/dark theming
  - a scroll-driven image stack (images travel up the page, tied to scroll)
  - a masked filmstrip thumbnail gallery
  - a clickable film-strip frame counter
- Magnetic buttons, custom cursor, scroll-velocity skew, count-up stats, self-drawing SVG

## Run locally
It's a static site — open `index.html` directly, or serve it:

```bash
python3 -m http.server 5577
# then visit http://localhost:5577
```
