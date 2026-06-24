/* ═══════════════════════════════════════════════════════════════
   SECTION CANVAS ANIMATIONS — perf-tuned
   • Each draw() does NOT touch canvas.width/height (no reflow)
   • Canvas sized only on init + window resize (ResizeObserver)
   • IntersectionObserver pauses RAF when off-screen (saves CPU)
   • DPR capped at 1.5 so retina laptops don't render 4× pixels
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  /* shared helper — installs a canvas inside `host` and returns
     { ctx, getSize, onResize } so the draw loop never touches DOM */
  function makeCanvas(host) {
    if (!host) return null;
    host.innerHTML = '';
    host.style.position = host.style.position || 'relative';
    const c = document.createElement('canvas');
    c.style.cssText = 'width:100%;height:100%;display:block;';
    host.appendChild(c);
    const ctx = c.getContext('2d', { alpha: false });
    let w = 0, h = 0;
    function sync() {
      const nw = host.clientWidth;
      const nh = host.clientHeight;
      if (nw === w && nh === h) return false;
      w = nw; h = nh;
      c.width  = Math.max(1, Math.round(w * DPR));
      c.height = Math.max(1, Math.round(h * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      return true;
    }
    sync();
    /* ResizeObserver is fired only on actual size changes — cheap. */
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(sync);
      ro.observe(host);
    } else {
      window.addEventListener('resize', sync);
    }
    return {
      ctx,
      getSize: () => ({ w, h }),
    };
  }

  /* shared visibility gate — RAF only runs while host is in viewport */
  function withVisibility(host, frameFn) {
    let raf = null, visible = false;
    function tick() {
      raf = null;
      if (!visible) return;
      frameFn();
      raf = requestAnimationFrame(tick);
    }
    function start() {
      if (raf || !visible) return;
      raf = requestAnimationFrame(tick);
    }
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          visible = e.isIntersecting;
          if (visible) start();
        });
      }, { rootMargin: '120px 0px' });
      io.observe(host);
    } else {
      visible = true; start();
    }
    return { start, isVisible: () => visible };
  }

  /* ══════════════════════════════════════════════════════════════
     1. RHEOLOGY — viscosity vs shear rate (log-log)
  ══════════════════════════════════════════════════════════════ */
  (function rheology() {
    const host = document.querySelector('#research .fig-placeholder');
    if (!host) return;
    const stage = makeCanvas(host); if (!stage) return;
    const { ctx, getSize } = stage;

    const concs = [
      { c: 0.1, n: 0.92, K: 0.04, col: '#4fc3f7' },
      { c: 0.5, n: 0.78, K: 0.18, col: '#26c6da' },
      { c: 1.0, n: 0.65, K: 0.55, col: '#00bcd4' },
      { c: 2.0, n: 0.52, K: 1.80, col: '#0097a7' },
      { c: 4.0, n: 0.38, K: 6.50, col: '#006064' },
    ];
    const gammaMin = 0.1, gammaMax = 1000, etaMin = 0.001, etaMax = 100;
    let phase = 0;
    const PAD = { l: 52, r: 60, t: 18, b: 38 };

    function draw() {
      const { w: W, h: H } = getSize();
      if (!W || !H) return;
      ctx.fillStyle = '#0a1628'; ctx.fillRect(0, 0, W, H);

      const CW = W - PAD.l - PAD.r;
      const CH = H - PAD.t - PAD.b;

      ctx.strokeStyle = 'rgba(79,195,247,0.08)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const x = PAD.l + i * CW / 5;
        ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + CH); ctx.stroke();
        const y = PAD.t + i * CH / 5;
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + CW, y); ctx.stroke();
      }

      ctx.fillStyle = 'rgba(179,229,252,0.55)';
      ctx.font = '10px DM Mono, monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('Shear rate γ̇ (s⁻¹) →', PAD.l, H - 12);
      ctx.save();
      ctx.translate(14, PAD.t + CH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Viscosity η (Pa·s)', 0, 0);
      ctx.restore();

      function toX(g) { return PAD.l + CW * (Math.log10(g) - Math.log10(gammaMin)) / (Math.log10(gammaMax) - Math.log10(gammaMin)); }
      function toY(e) { return PAD.t + CH * (1 - (Math.log10(e) - Math.log10(etaMin)) / (Math.log10(etaMax) - Math.log10(etaMin))); }

      const drawFrac = Math.min(1, phase);
      const nPts = 60;
      concs.forEach((cr, ci) => {
        ctx.beginPath();
        const last = Math.floor(nPts * drawFrac);
        for (let i = 0; i <= last; i++) {
          const gamma = Math.pow(10, Math.log10(gammaMin) + i / nPts * (Math.log10(gammaMax) - Math.log10(gammaMin)));
          const eta = cr.K * Math.pow(gamma, cr.n - 1);
          const x = toX(gamma), y = toY(eta);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = cr.col;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        if (drawFrac > (ci + 1) / concs.length * 0.85) {
          ctx.fillStyle = cr.col;
          ctx.fillText(cr.c + ' wt%', PAD.l + CW + 6, PAD.t + 12 + ci * 14);
        }
      });

      ctx.strokeStyle = 'rgba(79,195,247,0.4)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + CH); ctx.lineTo(PAD.l + CW, PAD.t + CH);
      ctx.stroke();

      ctx.fillStyle = 'rgba(179,229,252,0.55)';
      ctx.fillText('Shear-thinning (power-law) — Xanthan gum', PAD.l + 4, PAD.t - 4);

      if (phase < 1) phase = Math.min(1, phase + 0.008);
    }

    withVisibility(host, draw);
  })();

  /* ══════════════════════════════════════════════════════════════
     2. SHADOWGRAPHY — backlit spray field
  ══════════════════════════════════════════════════════════════ */
  (function shadowgraphy() {
    const host = document.querySelector('#atomization .fig-placeholder');
    if (!host) return;
    const stage = makeCanvas(host); if (!stage) return;
    const { ctx, getSize } = stage;

    const N = 112;
    const P = [];
    const dust = Array.from({ length: 90 }, () => ({
      x: Math.random(), y: Math.random(), r: 0.35 + Math.random() * 1.1,
      a: 0.04 + Math.random() * 0.08,
    }));
    const scan = Array.from({ length: 24 }, () => ({
      y: Math.random(), a: 0.012 + Math.random() * 0.02,
    }));

    function reset(p, warmStart) {
      const angle = (Math.random() - 0.5) * 74 * Math.PI / 180;
      const speed = 0.55 + Math.random() * 1.85;
      const kindSeed = Math.random();
      p.x = 0.5 + (Math.random() - 0.5) * 0.05;
      p.y = 0.145 + (warmStart ? Math.random() * 0.82 : 0);
      p.vx = Math.sin(angle) * speed;
      p.vy = Math.cos(angle) * speed * (0.86 + Math.random() * 0.28);
      p.life = warmStart ? Math.random() * 120 : 0;
      p.maxL = 95 + Math.random() * 135;
      p.r = kindSeed < 0.10 ? 0.018 + Math.random() * 0.018
        : kindSeed < 0.42 ? 0.007 + Math.random() * 0.010
          : 0.0018 + Math.random() * 0.0045;
      p.lig = kindSeed > 0.73;
      p.tail = 0.035 + Math.random() * 0.12;
      p.spin = angle + (Math.random() - 0.5) * 0.75;
      p.wobble = Math.random() * Math.PI * 2;
    }
    for (let i = 0; i < N; i++) { const p = {}; reset(p, true); P.push(p); }

    let t = 0;

    function drawDrop(px, py, r, alpha, wobble) {
      const stretch = 1 + Math.sin(wobble) * 0.14;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(stretch, 1 / stretch);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6,18,34,' + (alpha * 0.76) + ')';
      ctx.fill();
      ctx.lineWidth = Math.max(0.7, r * 0.18);
      ctx.strokeStyle = 'rgba(245,252,255,' + (alpha * 0.34) + ')';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.28, Math.max(0.6, r * 0.22), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.18) + ')';
      ctx.fill();
      ctx.restore();
    }

    function draw() {
      const { w: W, h: H } = getSize();
      if (!W || !H) return;
      t++;

      const flicker = 1 + Math.sin(t * 0.08) * 0.015 + Math.sin(t * 0.017) * 0.018;
      const bg = ctx.createRadialGradient(W * 0.52, H * 0.45, 0, W * 0.52, H * 0.45, W * 0.78);
      bg.addColorStop(0, 'rgb(' + Math.round(232 * flicker) + ',' + Math.round(244 * flicker) + ',250)');
      bg.addColorStop(0.58, '#c9dceb');
      bg.addColorStop(1, '#7d9ab2');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.12, W / 2, H / 2, W * 0.72);
      vignette.addColorStop(0, 'rgba(255,255,255,0)');
      vignette.addColorStop(1, 'rgba(8,20,36,0.30)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      for (let i = 0; i < scan.length; i++) {
        const y = ((scan[i].y + t * 0.0008) % 1) * H;
        ctx.globalAlpha = scan[i].a;
        ctx.fillRect(0, y, W, 1);
      }
      ctx.globalAlpha = 1;

      dust.forEach((d, i) => {
        ctx.beginPath();
        ctx.arc(d.x * W, ((d.y + t * 0.00012 * (i % 3)) % 1) * H, d.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8,20,35,' + d.a + ')';
        ctx.fill();
      });

      const cx = W / 2;
      const diskY = H * 0.105;
      const diskR = Math.min(W, H) * 0.082;
      const rot = t * 0.18;

      ctx.save();
      ctx.translate(cx, diskY);
      const hubGrad = ctx.createRadialGradient(-diskR * 0.22, -diskR * 0.22, 0, 0, 0, diskR);
      hubGrad.addColorStop(0, '#5c7f9b');
      hubGrad.addColorStop(0.6, '#223a57');
      hubGrad.addColorStop(1, '#071321');
      ctx.fillStyle = hubGrad;
      ctx.beginPath();
      ctx.arc(0, 0, diskR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(5,18,32,0.34)';
      ctx.lineWidth = Math.max(2, diskR * 0.11);
      for (let b = 0; b < 8; b++) {
        const a = rot + b * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * diskR * 0.2, Math.sin(a) * diskR * 0.2);
        ctx.lineTo(Math.cos(a) * diskR * 0.9, Math.sin(a) * diskR * 0.9);
        ctx.stroke();
      }
      ctx.restore();

      const sheet = ctx.createRadialGradient(cx, diskY + diskR * 0.5, 0, cx, diskY + H * 0.42, W * 0.34);
      sheet.addColorStop(0, 'rgba(6,20,34,0.18)');
      sheet.addColorStop(0.34, 'rgba(6,20,34,0.055)');
      sheet.addColorStop(1, 'rgba(6,20,34,0)');
      ctx.fillStyle = sheet;
      ctx.beginPath();
      ctx.moveTo(cx, diskY + diskR * 0.54);
      ctx.lineTo(cx - W * 0.31, H * 0.9);
      ctx.lineTo(cx + W * 0.31, H * 0.9);
      ctx.closePath();
      ctx.fill();

      for (let i = 0; i < N; i++) {
        const p = P[i];
        p.life++;
        p.x += p.vx * 0.0042;
        p.y += p.vy * 0.0048;
        p.vy += 0.0027 + Math.min(0.012, p.r * 0.25);
        p.vx *= 0.996;
        p.alpha = Math.min(1, p.life / 12) * Math.max(0, 1 - (p.life - p.maxL + 24) / 24);
        if (p.life >= p.maxL || p.y > 1.04 || p.x < -0.08 || p.x > 1.08) reset(p, false);

        const px = p.x * W + Math.sin(t * 0.035 + p.wobble) * W * 0.004;
        const py = p.y * H;
        const r = Math.max(0.9, p.r * W * (1 + p.y * 0.12));

        if (p.lig) {
          const len = p.tail * W * (0.55 + p.y * 0.8);
          const a = Math.atan2(p.vy, p.vx) + Math.PI / 2 + Math.sin(t * 0.03 + p.wobble) * 0.16;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a);
          const grad = ctx.createLinearGradient(0, -len * 0.5, 0, len * 0.5);
          grad.addColorStop(0, 'rgba(6,18,34,0)');
          grad.addColorStop(0.5, 'rgba(6,18,34,' + (p.alpha * 0.72) + ')');
          grad.addColorStop(1, 'rgba(6,18,34,0)');
          ctx.strokeStyle = grad;
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(1.1, r * 0.55);
          ctx.beginPath();
          ctx.moveTo(0, -len * 0.5);
          ctx.quadraticCurveTo(Math.sin(t * 0.04 + p.wobble) * r * 1.6, 0, 0, len * 0.5);
          ctx.stroke();
          drawDrop(0, -len * 0.48, r * 0.72, p.alpha * 0.75, p.wobble);
          drawDrop(0, len * 0.48, r * 0.92, p.alpha * 0.65, p.wobble + 2);
          ctx.restore();
        } else {
          drawDrop(px, py, r, p.alpha, t * 0.08 + p.wobble);
        }
      }

      ctx.fillStyle = 'rgba(5,16,30,0.26)';
      ctx.fillRect(0, 0, W, 18);
      ctx.fillStyle = 'rgba(235,248,255,0.64)';
      ctx.font = '9px DM Mono,monospace';
      ctx.fillText('CAM 02  |  12,000 fps  |  rotary atomizer', 8, 12);
      ctx.fillText('frame ' + String(4200 + t).padStart(5, '0'), W - 106, 12);

      ctx.strokeStyle = 'rgba(5,18,32,0.72)';
      ctx.lineWidth = 1.4;
      const sx = W - 86, sy = H - 18;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 62, sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, sy - 5); ctx.lineTo(sx, sy + 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 62, sy - 5); ctx.lineTo(sx + 62, sy + 5); ctx.stroke();
      ctx.fillStyle = 'rgba(5,18,32,0.76)';
      ctx.fillText('500 μm', sx + 16, H - 4);
      ctx.fillStyle = 'rgba(5,18,32,0.52)';
      ctx.fillText('shadowgraphy - rotary spray', 8, H - 6);
    }

    withVisibility(host, draw);
  })();

  /* ══════════════════════════════════════════════════════════════
     3. EVAPORATION — D² law plot
  ══════════════════════════════════════════════════════════════ */
  (function evap() {
    const host = document.querySelector('#evaporation .fig-placeholder');
    if (!host) return;
    const stage = makeCanvas(host); if (!stage) return;
    const { ctx, getSize } = stage;

    const series = [
      { T: '298 K', K: 0.0012, col: '#4fc3f7' },
      { T: '348 K', K: 0.0028, col: '#26c6da' },
      { T: '398 K', K: 0.0055, col: '#00bcd4' },
      { T: '448 K', K: 0.0095, col: '#0097a7' },
      { T: '473 K', K: 0.014,  col: '#00838f' },
    ];
    const tMax = 90;
    let tNow = 0;
    const PAD = { l: 50, r: 64, t: 18, b: 36 };

    // pre-compute experimental noise so it isn't random per-frame
    const noiseTable = series.map(() => {
      const arr = [];
      for (let ti = 0; ti < tMax; ti += 3.5) arr.push((Math.random() - 0.5) * 0.025);
      return arr;
    });

    function draw() {
      const { w: W, h: H } = getSize();
      if (!W || !H) return;
      ctx.fillStyle = '#080f1e'; ctx.fillRect(0, 0, W, H);

      const CW = W - PAD.l - PAD.r;
      const CH = H - PAD.t - PAD.b;

      ctx.strokeStyle = 'rgba(79,195,247,0.07)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const x = PAD.l + i*CW/4;
        ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t+CH); ctx.stroke();
        const y = PAD.t + i*CH/4;
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l+CW, y); ctx.stroke();
      }
      const drawT = Math.min(tMax, tNow);
      function toX(time) { return PAD.l + CW * time / tMax; }
      function toY(D2)   { return PAD.t + CH * (1 - D2); }

      series.forEach((s, si) => {
        const nt = noiseTable[si];
        ctx.fillStyle = s.col;
        let ni = 0;
        for (let ti = 0; ti <= drawT; ti += 3.5) {
          const D2 = Math.max(0, 1 - s.K * ti);
          const n = nt[ni++] || 0;
          ctx.beginPath();
          ctx.arc(toX(ti), toY(D2 + n), 1.6, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.beginPath();
        for (let ti = 0; ti <= drawT; ti += 1) {
          const D2 = Math.max(0, 1 - s.K * ti);
          ti === 0 ? ctx.moveTo(toX(ti), toY(D2)) : ctx.lineTo(toX(ti), toY(D2));
        }
        ctx.strokeStyle = s.col;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        const D2end = Math.max(0, 1 - s.K * drawT);
        if (drawT >= 5) {
          ctx.fillStyle = s.col;
          ctx.font = '10px DM Mono,monospace';
          ctx.fillText(s.T, PAD.l + CW + 4, toY(D2end) + 3);
        }
      });

      ctx.strokeStyle = 'rgba(79,195,247,0.4)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t+CH); ctx.lineTo(PAD.l+CW, PAD.t+CH);
      ctx.stroke();

      ctx.fillStyle = 'rgba(179,229,252,0.55)';
      ctx.font = '10px DM Mono,monospace';
      ctx.fillText('Time t (s) →', PAD.l + CW/2 - 30, H - 12);
      ctx.save();
      ctx.translate(13, PAD.t + CH/2 + 16);
      ctx.rotate(-Math.PI/2);
      ctx.fillText('(D/D₀)² →', 0, 0);
      ctx.restore();
      ctx.fillText('D²-law — experiment (·) vs. 1-D model (---)', PAD.l + 4, PAD.t - 4);

      if (tNow < tMax) tNow = Math.min(tMax, tNow + 0.4);
    }

    withVisibility(host, draw);
  })();

  /* ══════════════════════════════════════════════════════════════
     4. PROTOTYPE — spray dryer schematic
  ══════════════════════════════════════════════════════════════ */
  (function proto() {
    const host = document.querySelector('#prototype .proto-visual');
    if (!host) return;
    const stage = makeCanvas(host); if (!stage) return;
    const { ctx, getSize } = stage;

    const NPART = 54;
    const part = Array.from({length: NPART}, (_, i) => ({
      y:  Math.random(),
      lane: (i / NPART - 0.5) * 0.7 + (Math.random() - 0.5) * 0.12,
      r:  0.006 + Math.random() * 0.015,
      sp: 0.0018 + Math.random() * 0.0038,
      phase: Math.random() * Math.PI * 2,
    }));
    const vort = Array.from({ length: 34 }, () => ({
      y: Math.random(),
      side: Math.random() > 0.5 ? 1 : -1,
      phase: Math.random() * Math.PI * 2,
      sp: 0.001 + Math.random() * 0.0018,
    }));
    let t = 0;

    function arrow(x1, y1, x2, y2, col) {
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(a - 0.55) * 7, y2 - Math.sin(a - 0.55) * 7);
      ctx.lineTo(x2 - Math.cos(a + 0.55) * 7, y2 - Math.sin(a + 0.55) * 7);
      ctx.closePath();
      ctx.fill();
    }

    function draw() {
      const { w: W, h: H } = getSize();
      if (!W || !H) return;
      t++;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#06101e');
      bg.addColorStop(0.54, '#08182a');
      bg.addColorStop(1, '#03101b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2;
      const top = H * 0.085;
      const bot = H * 0.86;
      const chamW = Math.min(W * 0.48, H * 0.58);
      const neckW = chamW * 0.16;
      const wall = {
        lt: cx - chamW * 0.48,
        rt: cx + chamW * 0.48,
        lb: cx - chamW * 0.17,
        rb: cx + chamW * 0.17,
      };

      const chamberFill = ctx.createLinearGradient(cx - chamW / 2, top, cx + chamW / 2, bot);
      chamberFill.addColorStop(0, 'rgba(72,120,160,0.16)');
      chamberFill.addColorStop(0.46, 'rgba(255,156,74,0.10)');
      chamberFill.addColorStop(1, 'rgba(77,195,247,0.08)');
      ctx.beginPath();
      ctx.moveTo(wall.lt, top);
      ctx.lineTo(wall.lt + chamW * 0.06, bot - H * 0.16);
      ctx.lineTo(wall.lb, bot);
      ctx.lineTo(wall.rb, bot);
      ctx.lineTo(wall.rt - chamW * 0.06, bot - H * 0.16);
      ctx.lineTo(wall.rt, top);
      ctx.closePath();
      ctx.fillStyle = chamberFill;
      ctx.fill();
      ctx.strokeStyle = 'rgba(129,212,250,0.62)';
      ctx.lineWidth = 1.35;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, top, chamW * 0.48, H * 0.036, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(129,212,250,0.14)';
      for (let i = 1; i < 6; i++) {
        const y = top + i * (bot - top) / 6;
        const f = i / 6;
        const half = chamW * (0.48 - 0.29 * Math.max(0, f - 0.72));
        ctx.beginPath();
        ctx.ellipse(cx, y, half, H * 0.018, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      const feedY = top + H * 0.045;
      ctx.strokeStyle = 'rgba(175,226,255,0.72)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, top - H * 0.08);
      ctx.lineTo(cx, feedY);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, feedY, neckW, H * 0.017, 0, 0, Math.PI * 2);
      ctx.stroke();

      const spin = t * 0.11;
      for (let b = 0; b < 8; b++) {
        const a = spin + b * Math.PI / 4;
        ctx.strokeStyle = 'rgba(79,195,247,0.34)';
        ctx.beginPath();
        ctx.moveTo(cx, feedY);
        ctx.lineTo(cx + Math.cos(a) * neckW * 1.15, feedY + Math.sin(a) * H * 0.025);
        ctx.stroke();
      }

      const inletY = H * 0.30;
      arrow(cx - chamW * 0.82, inletY, wall.lt + 5, inletY, 'rgba(255,176,82,0.72)');
      ctx.fillStyle = 'rgba(255,176,82,0.72)';
      ctx.font = '9px DM Mono,monospace';
      ctx.fillText('heated drying air', cx - chamW * 0.98, inletY - 12);

      arrow(cx + chamW * 0.28, top - H * 0.01, cx + chamW * 0.28, top - H * 0.095, 'rgba(150,220,255,0.56)');
      ctx.fillStyle = 'rgba(150,220,255,0.62)';
      ctx.fillText('humid exhaust', cx + chamW * 0.15, top - H * 0.11);

      arrow(cx, bot, cx, Math.min(H - 12, bot + H * 0.10), 'rgba(117,222,147,0.68)');
      ctx.fillStyle = 'rgba(117,222,147,0.7)';
      ctx.fillText('powder outlet', cx - 30, Math.min(H - 4, bot + H * 0.13));

      vort.forEach((v) => {
        v.y += v.sp;
        if (v.y > 1) v.y = 0;
        const yy = top + v.y * (bot - top) * 0.86;
        const taper = 1 - Math.max(0, v.y - 0.72) * 0.65;
        const amp = chamW * 0.30 * taper;
        const x = cx + Math.sin(v.y * 10 + t * 0.035 + v.phase) * amp;
        const x2 = x + v.side * (18 + Math.sin(t * 0.03 + v.phase) * 8);
        ctx.strokeStyle = 'rgba(255,176,82,' + (0.14 + (1 - v.y) * 0.12) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.quadraticCurveTo((x + x2) / 2, yy - 8, x2, yy - 16);
        ctx.stroke();
      });

      const coneH = H * 0.56;
      const coneW = chamW * 0.34;
      const spray = ctx.createLinearGradient(cx, feedY, cx, feedY + coneH);
      spray.addColorStop(0, 'rgba(79,195,247,0.24)');
      spray.addColorStop(0.42, 'rgba(255,176,82,0.13)');
      spray.addColorStop(1, 'rgba(117,222,147,0.035)');
      ctx.beginPath();
      ctx.moveTo(cx, feedY + H * 0.02);
      ctx.lineTo(cx - coneW, feedY + coneH);
      ctx.lineTo(cx + coneW, feedY + coneH);
      ctx.closePath();
      ctx.fillStyle = spray;
      ctx.fill();

      for (let i = 0; i < NPART; i++) {
        const p = part[i];
        p.y += p.sp;
        if (p.y > 1) {
          p.y = 0;
          p.lane = (Math.random() - 0.5) * 0.82;
          p.r = 0.006 + Math.random() * 0.015;
        }
        const spread = coneW * (0.1 + p.y * 0.9);
        const px = cx + p.lane * spread + Math.sin(p.y * 14 + t * 0.05 + p.phase) * chamW * 0.025;
        const py = feedY + H * 0.03 + p.y * (coneH + H * 0.20);
        const dry = Math.min(1, p.y * 1.25);
        const r = Math.max(1, p.r * W * (1 - dry * 0.58));
        const alpha = Math.min(1, p.y * 6) * Math.max(0, 1 - Math.max(0, p.y - 0.94) / 0.06);
        const rr = Math.round(93 + dry * 122);
        const gg = Math.round(203 + dry * 13);
        const bb = Math.round(247 - dry * 130);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + rr + ',' + gg + ',' + bb + ',' + (alpha * 0.76) + ')';
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(7,17,30,0.58)';
      ctx.fillRect(0, H - 24, W, 24);
      ctx.fillStyle = 'rgba(129,212,250,0.72)';
      ctx.font = '600 10px Barlow Condensed,sans-serif';
      ctx.fillText('SPRAY DRYER - CROSS-SECTION', 12, H - 9);
      ctx.font = '9px DM Mono,monospace';
      ctx.fillStyle = 'rgba(230,238,248,0.52)';
      ctx.fillText('feed atomization -> hot air contact -> dried powder', W - 250, H - 9);
    }

    withVisibility(host, draw);
  })();

})();
