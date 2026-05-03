/* ═══════════════════════════════════════════════════════════════
   GSAP ScrollTrigger — Section reveal animations
   Runs after DOM ready; depends on gsap + ScrollTrigger + Lenis
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (!window.gsap || !window.ScrollTrigger) {
    console.warn('GSAP or ScrollTrigger not loaded');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // ── LENIS SMOOTH SCROLL ──────────────────────────────────────
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      syncTouch: false,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // ── HERO TEXT ENTRANCE ───────────────────────────────────────
  const heroTl = gsap.timeline({ delay: 0.2 });
  heroTl
    .from('.hero-tag', {
      opacity: 0, y: 18, duration: 0.7, ease: 'power3.out',
    })
    .from('.hero-name', {
      opacity: 0, y: 32, duration: 0.85, ease: 'power3.out',
    }, '-=0.4')
    .from('.hero-degree', {
      opacity: 0, y: 16, duration: 0.6, ease: 'power2.out',
    }, '-=0.5')
    .from('.hero-bio', {
      opacity: 0, y: 12, duration: 0.6, ease: 'power2.out',
    }, '-=0.45')
    .from('.hero-actions', {
      opacity: 0, y: 10, duration: 0.5, ease: 'power2.out',
    }, '-=0.4')
    .from('.hero-stats', {
      opacity: 0, y: 10, duration: 0.5, ease: 'power2.out',
    }, '-=0.3')
    .from('.hero-card', {
      opacity: 0, x: 24, duration: 0.5, stagger: 0.1, ease: 'power2.out',
    }, '-=0.5');

  // ── SCROLL-REVEAL HELPER ─────────────────────────────────────
  function revealFrom(selector, vars, triggerEl) {
    const els = document.querySelectorAll(selector);
    if (!els.length) return;
    gsap.from(els, {
      ...vars,
      scrollTrigger: {
        trigger: triggerEl || els[0],
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    });
  }

  // ── SECTION LABELS + TITLES ───────────────────────────────────
  document.querySelectorAll('section:not(#hero)').forEach(section => {
    const label = section.querySelector('.section-label');
    const title = section.querySelector('.section-title');
    const sub   = section.querySelector('.section-sub');

    if (label) gsap.from(label, {
      opacity: 0, x: -20, duration: 0.6, ease: 'power2.out',
      scrollTrigger: { trigger: section, start: 'top 85%', toggleActions: 'play none none none' },
    });
    if (title) gsap.from(title, {
      opacity: 0, y: 28, duration: 0.75, ease: 'power3.out',
      scrollTrigger: { trigger: section, start: 'top 82%', toggleActions: 'play none none none' },
    });
    if (sub) gsap.from(sub, {
      opacity: 0, y: 16, duration: 0.6, ease: 'power2.out',
      scrollTrigger: { trigger: section, start: 'top 80%', toggleActions: 'play none none none' },
    });
  });

  // ── RESEARCH CARDS ────────────────────────────────────────────
  gsap.from('.research-card', {
    opacity: 0, y: 40, duration: 0.7, stagger: 0.15, ease: 'power3.out',
    scrollTrigger: {
      trigger: '.research-grid',
      start: 'top 84%',
      toggleActions: 'play none none none',
    },
  });

  // ── STUDY LAYOUT (alternating slide-in) ──────────────────────
  document.querySelectorAll('.study-layout').forEach((layout, i) => {
    const content = layout.querySelector('.study-content');
    const visual  = layout.querySelector('.study-visual');
    const isReverse = layout.classList.contains('reverse');

    if (content) gsap.from(content, {
      opacity: 0, x: isReverse ? 40 : -40, duration: 0.85, ease: 'power3.out',
      scrollTrigger: { trigger: layout, start: 'top 82%', toggleActions: 'play none none none' },
    });
    if (visual) gsap.from(visual, {
      opacity: 0, x: isReverse ? -40 : 40, duration: 0.85, ease: 'power3.out',
      scrollTrigger: { trigger: layout, start: 'top 82%', toggleActions: 'play none none none' },
    });
  });

  // finding list items stagger
  document.querySelectorAll('.finding-list').forEach(list => {
    gsap.from(list.querySelectorAll('li'), {
      opacity: 0, x: -16, duration: 0.45, stagger: 0.08, ease: 'power2.out',
      scrollTrigger: { trigger: list, start: 'top 88%', toggleActions: 'play none none none' },
    });
  });

  // method chips
  document.querySelectorAll('.method-chip').forEach((chip, i) => {
    gsap.from(chip, {
      opacity: 0, scale: 0.85, duration: 0.35, delay: i * 0.05, ease: 'back.out(1.4)',
      scrollTrigger: {
        trigger: chip.closest('.method-chips'),
        start: 'top 90%',
        toggleActions: 'play none none none',
      },
    });
  });

  // ── PROTOTYPE SECTION ─────────────────────────────────────────
  gsap.from('.proto-card', {
    opacity: 0, y: 32, duration: 0.65, stagger: 0.12, ease: 'power3.out',
    scrollTrigger: { trigger: '#prototype', start: 'top 80%', toggleActions: 'play none none none' },
  });
  gsap.from('.proto-visual', {
    opacity: 0, scale: 0.96, duration: 0.8, ease: 'power2.out',
    scrollTrigger: { trigger: '#prototype', start: 'top 78%', toggleActions: 'play none none none' },
  });

  // ── SKILLS COLUMNS ────────────────────────────────────────────
  gsap.from('.skill-col', {
    opacity: 0, y: 36, duration: 0.65, stagger: 0.1, ease: 'power3.out',
    scrollTrigger: { trigger: '.skills-grid', start: 'top 82%', toggleActions: 'play none none none' },
  });

  // skill bars animate width
  document.querySelectorAll('.bar-fill').forEach(bar => {
    const targetW = bar.style.width;
    bar.style.width = '0%';
    gsap.to(bar, {
      width: targetW,
      duration: 1.1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: bar.closest('.skill-item'),
        start: 'top 90%',
        toggleActions: 'play none none none',
      },
    });
  });

  // ── PUBLICATIONS ─────────────────────────────────────────────
  gsap.from('.pub-item', {
    opacity: 0, y: 20, duration: 0.5, stagger: 0.1, ease: 'power2.out',
    scrollTrigger: { trigger: '.pub-list', start: 'top 85%', toggleActions: 'play none none none' },
  });

  // ── CONTACT ───────────────────────────────────────────────────
  gsap.from('#contact > div:first-child', {
    opacity: 0, x: -40, duration: 0.85, ease: 'power3.out',
    scrollTrigger: { trigger: '#contact', start: 'top 82%', toggleActions: 'play none none none' },
  });
  gsap.from('#contact > div:last-child', {
    opacity: 0, x: 40, duration: 0.85, ease: 'power3.out',
    scrollTrigger: { trigger: '#contact', start: 'top 82%', toggleActions: 'play none none none' },
  });

  // ── NAV LINK ACTIVE STATE ─────────────────────────────────────
  const sections = ['research', 'atomization', 'evaporation', 'prototype', 'skills', 'publications', 'contact'];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    ScrollTrigger.create({
      trigger: el,
      start: 'top 60%',
      end: 'bottom 40%',
      onEnter:    () => setActiveNav(id),
      onEnterBack:() => setActiveNav(id),
    });
  });

  function setActiveNav(id) {
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.style.color = a.getAttribute('href') === '#' + id
        ? 'rgba(79,195,247,0.95)'
        : 'rgba(255,255,255,0.6)';
    });
  }

  // ── HOVER GLOW ON HERO CARDS ──────────────────────────────────
  document.querySelectorAll('.hero-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      gsap.to(card, { scale: 1.02, duration: 0.25, ease: 'power2.out' });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { scale: 1, duration: 0.25, ease: 'power2.out' });
    });
  });

  // ── RESEARCH CARD HOVER ───────────────────────────────────────
  document.querySelectorAll('.research-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      gsap.to(card, { y: -4, duration: 0.3, ease: 'power2.out' });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { y: 0, duration: 0.3, ease: 'power2.out' });
    });
  });

  // ── STAT NUMBER COUNT-UP ──────────────────────────────────────
  document.querySelectorAll('.stat-num').forEach(el => {
    const text    = el.textContent;
    const numMatch = text.match(/\d+/);
    if (!numMatch) return;
    const target = parseInt(numMatch[0]);
    const suffix  = text.replace(/\d+/, '');
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: () => {
        // keep inner span if present
        const span = el.querySelector('span');
        el.textContent = Math.round(obj.val);
        if (span) el.appendChild(span);
      },
      scrollTrigger: {
        trigger: '.hero-stats',
        start: 'top 90%',
        toggleActions: 'play none none none',
      },
    });
  });

})();
