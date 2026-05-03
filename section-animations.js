/* ═══════════════════════════════════════════════════════════════
   SECTION CANVAS ANIMATIONS
   Each research section gets its own WebGL mini-canvas:
   • Research Overview  → rotating rheology viscosity curves
   • Atomization        → laser sheet + spray shadowgraphy sim
   • Evaporation        → D²-law droplet shrinking + temperature field
   • Prototype          → wireframe CAD schematic
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── wait for GSAP + ScrollTrigger ── */
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  /* ══════════════════════════════════════════════════════════════
     HELPER: create a canvas overlay inside a section figure
  ══════════════════════════════════════════════════════════════ */
  function makeCanvas(parentSelector, id) {
    const parent = document.querySelector(parentSelector);
    if (!parent) return null;
    const c = document.createElement('canvas');
    c.id = id;
    c.style.cssText = 'width:100%;height:100%;display:block;position:absolute;inset:0;';
    parent.style.position = 'relative';
    parent.appendChild(c);
    return c;
  }

  /* ── DPR-aware resize ── */
  function fitCanvas(c) {
    const dpr = window.devicePixelRatio || 1;
    c.width  = c.offsetWidth  * dpr;
    c.height = c.offsetHeight * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  /* ── easing ── */
  const easeInOut = t => t < .5 ? 2*t*t : -1+(4-2*t)*t;
  const lerp      = (a, b, t) => a + (b - a) * t;

  /* ══════════════════════════════════════════════════════════════
     1. RESEARCH OVERVIEW — Rheology viscosity curve animation
        Shear-thinning (power-law) curves for different conc.
  ══════════════════════════════════════════════════════════════ */
  (function initRheologyCurve() {
    // Inject a canvas into the first .fig-placeholder in #research
    const ph = document.querySelector('#research .fig-placeholder');
    if (!ph) return;

    // replace the placeholder text with a canvas
    ph.innerHTML = '';
    const c   = document.createElement('canvas');
    c.style.cssText = 'width:100%;height:100%;display:block;';
    ph.appendChild(c);

    let raf, visible = false, phase = 0;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const W = c.offsetWidth, H = c.offsetHeight;
      if (!W || !H) return;
      c.width = W * dpr; c.height = H * dpr;
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, W, H);

      // background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0a1628'); bg.addColorStop(1, '#071018');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      const PAD  = { l: 52, r: 20, t: 20, b: 48 };
      const CW   = W - PAD.l - PAD.r;
      const CH   = H - PAD.t - PAD.b;

      // Grid
      ctx.strokeStyle = 'rgba(79,195,247,0.08)';
      ctx.lineWidth   = 1;
      for (let i = 0; i <= 5; i++) {
        const x = PAD.l + i * CW / 5;
        ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + CH); ctx.stroke();
        const y = PAD.t + i * CH / 5;
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + CW, y); ctx.stroke();
      }

      // Axis labels
      ctx.fillStyle = 'rgba(179,229,252,0.45)';
      ctx.font      = `${Math.max(9, W*0.028)}px DM Mono, monospace`;
      ctx.fillText('Shear Rate γ̇ (s⁻¹) →', PAD.l, H - 8);
      ctx.save(); ctx.translate(14, PAD.t + CH/2); ctx.rotate(-Math.PI/2);
      ctx.fillText('Viscosity η (Pa·s)', 0, 0); ctx.restore();

      // Concentrations: 0.1, 0.5, 1.0, 2.0, 4.0 wt%
      const concs = [
        { c: 0.1, n: 0.92, K: 0.04, col: '#4fc3f7' },
        { c: 0.5, n: 0.78, K: 0.18, col: '#26c6da' },
        { c: 1.0, n: 0.65, K: 0.55, col: '#00bcd4' },
        { c: 2.0, n: 0.52, K: 1.80, col: '#0097a7' },
        { c: 4.0, n: 0.38, K: 6.50, col: '#006064' },
      ];

      const gammaMin = 0.1, gammaMax = 1000;
      const etaMin   = 0.001, etaMax = 100;

      function toX(gamma) { return PAD.l + CW * (Math.log10(gamma) - Math.log10(gammaMin)) / (Math.log10(gammaMax) - Math.log10(gammaMin)); }
      function toY(eta)   { return PAD.t + CH * (1 - (Math.log10(eta) - Math.log10(etaMin)) / (Math.log10(etaMax) - Math.log10(etaMin))); }

      const drawFrac = Math.min(1, phase);
      concs.forEach((cr, ci) => {
        const nPts = 80;
        ctx.beginPath();
        for (let i = 0; i <= Math.floor(nPts * drawFrac); i++) {
          const gamma = Math.pow(10, Math.log10(gammaMin) + i / nPts * (Math.log10(gammaMax) - Math.log10(gammaMin)));
          const eta   = cr.K * Math.pow(gamma, cr.n - 1);
          const x = toX(gamma), y = toY(eta);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = cr.col;
        ctx.lineWidth   = 2;
        ctx.shadowBlur  = 8; ctx.shadowColor = cr.col;
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // Legend
        if (drawFrac > (ci + 1) / concs.length * 0.8) {
          ctx.fillStyle = cr.col;
          ctx.fillText(`${cr.c} wt%`, W - 56, PAD.t + 16 + ci * 18);
        }
      });

      // Axes
      ctx.strokeStyle = 'rgba(79,195,247,0.4)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + CH); ctx.lineTo(PAD.l + CW, PAD.t + CH);
      ctx.stroke();

      // Caption
      ctx.fillStyle = 'rgba(179,229,252,0.5)';
      ctx.font = `${Math.max(8, W*0.024)}px DM Mono, monospace`;
      ctx.fillText('Shear-thinning (power-law) — Xanthan gum solutions', PAD.l + 4, PAD.t - 6);

      if (visible) phase = Math.min(1, phase + 0.008);
      raf = requestAnimationFrame(draw);
    }

    ScrollTrigger.create({
      trigger: ph,
      start: 'top 88%',
      onEnter:    () => { visible = true;  if (!raf) draw(); },
      onLeaveBack:() => { visible = false; },
    });
    draw();
  })();

  /* ══════════════════════════════════════════════════════════════
     2. ATOMIZATION — Laser sheet shadowgraphy simulation
        Shows: illuminated spray cone + ligament/droplet shadows
  ══════════════════════════════════════════════════════════════ */
  (function initShadowgraphy() {
    const phs = document.querySelectorAll('#atomization .fig-placeholder');
    const ph  = phs[0]; if (!ph) return;
    ph.innerHTML = '';
    const c = document.createElement('canvas');
    c.style.cssText = 'width:100%;height:100%;display:block;';
    ph.appendChild(c);

    /* seeded random spray particles */
    class SprayParticle {
      constructor(seed) {
        this.reset(seed);
      }
      reset(seed) {
        const angle = (Math.random() - 0.5) * 55 * Math.PI / 180;
        this.speed  = 0.3 + Math.random() * 1.2;
        this.vx     = Math.sin(angle) * this.speed;
        this.vy     = Math.cos(angle) * this.speed;
        this.x      = 0.5 + (Math.random() - 0.5) * 0.04;
        this.y      = 0.18;
        this.r      = seed < 0.15 ? 0.016 + Math.random() * 0.012  // large
                    : seed < 0.45 ? 0.007 + Math.random() * 0.007  // medium
                    : 0.002 + Math.random() * 0.004;                 // small
        this.type   = seed < 0.15 ? 'large' : seed < 0.45 ? 'medium' : 'small';
        this.alpha  = 0;
        this.life   = 0;
        this.maxL   = 60 + Math.random() * 80;
        this.isLig  = Math.random() < 0.12;
        this.ligLen = 0.04 + Math.random() * 0.1;
        this.ligAng = angle + (Math.random() - 0.5) * 0.4;
      }
      update(W, H) {
        this.life++;
        this.x += this.vx * 0.006;
        this.y += this.vy * 0.006;
        this.vy += 0.008; // gravity
        this.alpha = Math.min(1, this.life / 10) * Math.max(0, 1 - (this.life - this.maxL + 20) / 20);
        if (this.life >= this.maxL) this.reset(Math.random());
      }
      draw(ctx, W, H) {
        const px = this.x * W, py = this.y * H;
        const rx = this.r * W;
        if (this.isLig) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(this.ligAng)*this.ligLen*W, py + Math.sin(this.ligAng)*this.ligLen*H);
          ctx.strokeStyle = `rgba(10,30,50,${this.alpha * 0.85})`;
          ctx.lineWidth = rx * 1.2;
          ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(px, py, Math.max(1, rx), 0, Math.PI*2);
          ctx.fillStyle = `rgba(5,20,40,${this.alpha * (this.type === 'large' ? 0.9 : 0.75)})`;
          ctx.fill();
        }
      }
    }

    const particles = Array.from({ length: 120 }, (_, i) => new SprayParticle(i / 120));
    let raf2, vis2 = false;

    function draw2() {
      const dpr = window.devicePixelRatio || 1;
      const W = c.offsetWidth, H = c.offsetHeight;
      if (!W || !H) return;
      c.width = W*dpr; c.height = H*dpr;
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Backlit background (bright diffuse illumination)
      const bg = ctx.createRadialGradient(W/2, H*0.5, 0, W/2, H*0.5, W*0.7);
      bg.addColorStop(0, '#d8eaf5'); bg.addColorStop(0.6, '#b8d4e8'); bg.addColorStop(1, '#8ab0c8');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Laser sheet glow (vertical strip)
      const sheet = ctx.createLinearGradient(W*0.35, 0, W*0.65, 0);
      sheet.addColorStop(0, 'rgba(100,200,100,0)');
      sheet.addColorStop(0.45, 'rgba(100,220,80,0.12)');
      sheet.addColorStop(0.55, 'rgba(100,220,80,0.12)');
      sheet.addColorStop(1, 'rgba(100,200,100,0)');
      ctx.fillStyle = sheet; ctx.fillRect(0, 0, W, H);

      // Rotary disk (simplified top-down view)
      ctx.save();
      ctx.translate(W/2, H*0.12);
      ctx.beginPath(); ctx.arc(0, 0, W*0.045, 0, Math.PI*2);
      ctx.fillStyle = '#2a4a6a'; ctx.fill();
      ctx.strokeStyle = '#4a7a9a'; ctx.lineWidth = 1.5; ctx.stroke();
      // Rotation indicator
      const rot = Date.now() * 0.003;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(rot)*W*0.04, Math.sin(rot)*W*0.04);
      ctx.strokeStyle = '#78b8d8'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();

      // Update and draw spray particles (dark silhouettes on bright bg = shadowgraphy)
      particles.forEach(p => { p.update(W, H); p.draw(ctx, W, H); });

      // Scale bar
      ctx.strokeStyle = 'rgba(10,30,50,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(W-80, H-18); ctx.lineTo(W-20, H-18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W-80, H-22); ctx.lineTo(W-80, H-14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W-20, H-22); ctx.lineTo(W-20, H-14); ctx.stroke();
      ctx.fillStyle = 'rgba(10,30,50,0.7)';
      ctx.font = `${Math.max(8, W*0.025)}px DM Mono, monospace`;
      ctx.fillText('500 μm', W-78, H-5);

      // Caption
      ctx.fillStyle = 'rgba(10,30,50,0.55)';
      ctx.fillText('Shadowgraphy — rotary atomizer spray field', 8, H-5);

      if (vis2) raf2 = requestAnimationFrame(draw2);
    }

    ScrollTrigger.create({
      trigger: ph, start: 'top 88%',
      onEnter:    () => { vis2 = true;  draw2(); },
      onLeaveBack:() => { vis2 = false; cancelAnimationFrame(raf2); },
    });
    draw2();
  })();

  /* ══════════════════════════════════════════════════════════════
     3. EVAPORATION — D²-law plot + pendant droplet sequence
        Shows: D²(t) curves at different temperatures,
               with numerical model overlay
  ══════════════════════════════════════════════════════════════ */
  (function initEvaporation() {
    const phs = document.querySelectorAll('#evaporation .fig-placeholder');
    const ph  = phs[0]; if (!ph) return;
    ph.innerHTML = '';
    const c = document.createElement('canvas');
    c.style.cssText = 'width:100%;height:100%;display:block;';
    ph.appendChild(c);

    let t3 = 0, vis3 = false, raf3;

    function draw3() {
      const dpr = window.devicePixelRatio || 1;
      const W = c.offsetWidth, H = c.offsetHeight;
      if (!W || !H) return;
      c.width = W*dpr; c.height = H*dpr;
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#080f1e'); bg.addColorStop(1, '#040a14');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      const PAD = { l: 54, r: 80, t: 22, b: 46 };
      const CW  = W - PAD.l - PAD.r;
      const CH  = H - PAD.t - PAD.b;

      // Grid
      ctx.strokeStyle = 'rgba(79,195,247,0.07)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const x = PAD.l + i*CW/4;
        ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t+CH); ctx.stroke();
        const y = PAD.t + i*CH/4;
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l+CW, y); ctx.stroke();
      }

      // Evaporation constants K at different temps (D²-law: D²=D₀²-K·t)
      const series = [
        { T: '298 K', K: 0.0012, col: '#4fc3f7' },
        { T: '348 K', K: 0.0028, col: '#26c6da' },
        { T: '398 K', K: 0.0055, col: '#00bcd4' },
        { T: '448 K', K: 0.0095, col: '#0097a7' },
        { T: '473 K', K: 0.014,  col: '#00838f' },
      ];
      const D0sq = 1.0, tMax = 90;
      const drawT = Math.min(tMax, t3 * 1.1);

      function toX(time) { return PAD.l + CW * time / tMax; }
      function toY(D2)   { return PAD.t + CH * (1 - D2); }

      series.forEach(s => {
        // Experimental dots (noisy)
        ctx.fillStyle = s.col + 'cc';
        for (let ti = 0; ti <= drawT; ti += 3.5) {
          const D2 = Math.max(0, D0sq - s.K * ti);
          const noise = (Math.random()-0.5)*0.025;
          const x = toX(ti), y = toY(D2 + noise);
          ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fill();
        }
        // Model line (smooth)
        ctx.beginPath();
        for (let ti = 0; ti <= drawT; ti += 0.5) {
          const D2 = Math.max(0, D0sq - s.K * ti);
          const x = toX(ti), y = toY(D2);
          ti === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = s.col;
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.shadowBlur  = 6; ctx.shadowColor = s.col;
        ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0;

        // Label at end
        const D2end = Math.max(0, D0sq - s.K * drawT);
        if (drawT >= 5) {
          ctx.fillStyle = s.col;
          ctx.font = `${Math.max(8,W*0.025)}px DM Mono,monospace`;
          ctx.fillText(s.T, PAD.l + CW + 4, toY(D2end) + 4);
        }
      });

      // Axes
      ctx.strokeStyle = 'rgba(79,195,247,0.4)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t+CH); ctx.lineTo(PAD.l+CW, PAD.t+CH);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = 'rgba(179,229,252,0.45)';
      ctx.font = `${Math.max(8,W*0.026)}px DM Mono,monospace`;
      ctx.fillText('Time t (s) →', PAD.l+CW/2-30, H-6);
      ctx.save(); ctx.translate(14, PAD.t+CH/2+20); ctx.rotate(-Math.PI/2);
      ctx.fillText('(D/D₀)² →', 0, 0); ctx.restore();

      // Caption
      ctx.fillStyle = 'rgba(179,229,252,0.45)';
      ctx.fillText('D²-law — experiment (·) vs. 1-D model (---)', PAD.l+4, PAD.t-6);

      // Legend: model vs exp
      ctx.strokeStyle = 'rgba(179,229,252,0.4)'; ctx.lineWidth=1.5;
      ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.moveTo(PAD.l+2, PAD.t+8); ctx.lineTo(PAD.l+20, PAD.t+8); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(PAD.l+26, PAD.t+8, 2, 0, Math.PI*2);
      ctx.fillStyle='rgba(179,229,252,0.4)'; ctx.fill();
      ctx.fillStyle='rgba(179,229,252,0.35)'; ctx.font=`${Math.max(7,W*0.022)}px DM Mono,monospace`;
      ctx.fillText('model / exp', PAD.l+30, PAD.t+12);

      if (vis3) { t3 = Math.min(tMax, t3 + 0.35); raf3 = requestAnimationFrame(draw3); }
    }

    ScrollTrigger.create({
      trigger: ph, start: 'top 88%',
      onEnter:    () => { vis3 = true;  draw3(); },
      onLeaveBack:() => { vis3 = false; t3 = 0;  cancelAnimationFrame(raf3); },
    });
    draw3();
  })();

  /* ══════════════════════════════════════════════════════════════
     4. PROTOTYPE — Animated spray dryer schematic (wireframe)
        Shows: chamber cross-section + spray cone + particle paths
  ══════════════════════════════════════════════════════════════ */
  (function initPrototype() {
    const ph = document.querySelector('#prototype .proto-visual');
    if (!ph) return;
    ph.innerHTML = '';
    const c = document.createElement('canvas');
    c.style.cssText = 'width:100%;height:100%;display:block;';
    ph.appendChild(c);

    let t4 = 0, vis4 = false, raf4;

    // Particle paths through the dryer
    const NPART = 40;
    const partY = Array.from({length: NPART}, () => Math.random());
    const partX = Array.from({length: NPART}, () => (Math.random()-0.5)*0.18);
    const partR = Array.from({length: NPART}, () => 0.008 + Math.random()*0.014);
    const partSpeed = Array.from({length: NPART}, () => 0.003 + Math.random()*0.004);
    const partAlpha = Array.from({length: NPART}, () => 0);

    function draw4() {
      const dpr = window.devicePixelRatio || 1;
      const W = c.offsetWidth, H = c.offsetHeight;
      if (!W || !H) return;
      c.width = W*dpr; c.height = H*dpr;
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr,0,0,dpr,0,0);

      ctx.clearRect(0,0,W,H);
      const bg = ctx.createLinearGradient(0,0,0,H);
      bg.addColorStop(0,'#06101e'); bg.addColorStop(1,'#030810');
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

      const cx = W/2;
      // Chamber dimensions
      const top   = H*0.08;
      const bot   = H*0.88;
      const chamW = W*0.42;

      // Draw chamber outline (cylindrical dryer)
      ctx.save();
      ctx.strokeStyle = 'rgba(79,195,247,0.55)';
      ctx.lineWidth   = 1.8;
      ctx.shadowBlur  = 10; ctx.shadowColor = '#4fc3f7';

      // Main chamber cylinder
      ctx.beginPath();
      ctx.moveTo(cx - chamW/2, top);
      ctx.lineTo(cx - chamW/2, bot - H*0.12);
      ctx.lineTo(cx - chamW*0.12, bot);
      ctx.lineTo(cx + chamW*0.12, bot);
      ctx.lineTo(cx + chamW/2, bot - H*0.12);
      ctx.lineTo(cx + chamW/2, top);
      ctx.closePath();
      ctx.stroke();

      // Top dome
      ctx.beginPath();
      ctx.ellipse(cx, top, chamW/2, H*0.04, 0, 0, Math.PI*2);
      ctx.stroke();

      // Rotary atomizer disk (top center)
      ctx.strokeStyle = 'rgba(100,200,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(cx, top + H*0.04, chamW*0.12, H*0.02, 0, 0, Math.PI*2);
      ctx.stroke();
      // spinning blades
      const spin = t4 * 0.04;
      for (let b = 0; b < 6; b++) {
        const ang = spin + b * Math.PI/3;
        ctx.beginPath();
        ctx.moveTo(cx, top + H*0.04);
        ctx.lineTo(cx + Math.cos(ang)*chamW*0.1, top + H*0.04 + Math.sin(ang)*H*0.018);
        ctx.strokeStyle = 'rgba(79,195,247,0.5)'; ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Hot air inlet (side, arrows)
      ctx.strokeStyle = 'rgba(255,160,50,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - chamW/2 - 28, H*0.3); ctx.lineTo(cx - chamW/2, H*0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - chamW/2 - 8, H*0.3-6); ctx.lineTo(cx - chamW/2, H*0.3); ctx.lineTo(cx - chamW/2 - 8, H*0.3+6); ctx.stroke();
      ctx.fillStyle = 'rgba(255,160,50,0.5)'; ctx.font = `${Math.max(7,W*0.022)}px DM Mono,monospace`;
      ctx.fillText('Hot air', cx - chamW/2 - 52, H*0.3 - 10);
      ctx.fillText(`(${Math.round(298 + (t4 % 180) * 0.97)} K)`, cx - chamW/2 - 52, H*0.3 + 18);

      // Exhaust outlet (top)
      ctx.strokeStyle = 'rgba(150,220,255,0.4)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx + chamW*0.25, top - 2); ctx.lineTo(cx + chamW*0.25, top - 28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + chamW*0.25 - 6, top-20); ctx.lineTo(cx + chamW*0.25, top-28); ctx.lineTo(cx + chamW*0.25 + 6, top-20); ctx.stroke();
      ctx.fillStyle = 'rgba(150,220,255,0.4)';
      ctx.fillText('exhaust', cx + chamW*0.25 - 20, top - 32);

      // Product outlet (bottom)
      ctx.strokeStyle = 'rgba(100,220,100,0.5)';
      ctx.beginPath(); ctx.moveTo(cx, bot); ctx.lineTo(cx, bot + 24); ctx.stroke();
      ctx.fillStyle = 'rgba(100,220,100,0.5)';
      ctx.fillText('product', cx - 22, bot + 36);

      ctx.shadowBlur = 0;

      // Spray cone (triangle from atomizer)
      const coneH = H * 0.55, coneW = chamW * 0.38;
      const spray = ctx.createLinearGradient(cx, top+H*0.06, cx, top+H*0.06+coneH);
      spray.addColorStop(0,'rgba(79,195,247,0.22)');
      spray.addColorStop(1,'rgba(79,195,247,0.0)');
      ctx.beginPath();
      ctx.moveTo(cx, top+H*0.06);
      ctx.lineTo(cx-coneW, top+H*0.06+coneH);
      ctx.lineTo(cx+coneW, top+H*0.06+coneH);
      ctx.closePath();
      ctx.fillStyle = spray; ctx.fill();

      // Cone edges
      ctx.strokeStyle = 'rgba(79,195,247,0.3)'; ctx.lineWidth = 1;
      ctx.setLineDash([4,4]);
      ctx.beginPath();
      ctx.moveTo(cx, top+H*0.06);
      ctx.lineTo(cx-coneW, top+H*0.06+coneH);
      ctx.moveTo(cx, top+H*0.06);
      ctx.lineTo(cx+coneW, top+H*0.06+coneH);
      ctx.stroke(); ctx.setLineDash([]);

      // Particles flowing through chamber
      for (let i = 0; i < NPART; i++) {
        partY[i] += partSpeed[i];
        if (partY[i] > 1) { partY[i] = 0; partX[i] = (Math.random()-0.5)*0.18; }
        const frac = partY[i];
        const px = cx + partX[i] * chamW + Math.sin(frac*12 + i)*0.02*chamW;
        const py = top + H*0.06 + frac*(coneH + H*0.25);
        const r  = Math.max(1, partR[i] * W * (1 - frac * 0.6));
        const alpha = Math.min(1, frac*5) * Math.max(0, 1-(frac-0.8)/0.2);

        const grd = ctx.createRadialGradient(px-r*0.3, py-r*0.3, 0, px, py, r*2);
        grd.addColorStop(0,'rgba(200,240,255,0.9)');
        grd.addColorStop(0.5,'rgba(79,195,247,0.7)');
        grd.addColorStop(1,'rgba(79,195,247,0)');
        ctx.beginPath(); ctx.arc(px, py, r*1.8, 0, Math.PI*2);
        ctx.fillStyle = grd; ctx.globalAlpha = alpha * 0.8; ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Dimension labels
      ctx.strokeStyle = 'rgba(79,195,247,0.25)'; ctx.lineWidth = 0.8;
      ctx.setLineDash([2,4]);
      ctx.beginPath(); ctx.moveTo(cx+chamW/2+8, top); ctx.lineTo(cx+chamW/2+8, bot); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(179,229,252,0.4)';
      ctx.font = `${Math.max(7,W*0.022)}px DM Mono,monospace`;
      ctx.save(); ctx.translate(cx+chamW/2+20, (top+bot)/2); ctx.rotate(-Math.PI/2);
      ctx.fillText('chamber height', 0, 0); ctx.restore();

      ctx.restore();

      // Title
      ctx.fillStyle = 'rgba(79,195,247,0.5)';
      ctx.font = `600 ${Math.max(9,W*0.028)}px Barlow Condensed,sans-serif`;
      ctx.fillText('SPRAY DRYER — SCHEMATIC CROSS-SECTION', W/2 - 120, H*0.97);

      if (vis4) { t4++; raf4 = requestAnimationFrame(draw4); }
    }

    ScrollTrigger.create({
      trigger: ph, start: 'top 88%',
      onEnter:    () => { vis4 = true;  draw4(); },
      onLeaveBack:() => { vis4 = false; cancelAnimationFrame(raf4); },
    });
    draw4();
  })();

})();
