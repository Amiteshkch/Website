/* ═══════════════════════════════════════════════════════════════
   INTERACTIVE SPRAY DRYING PROCESS EXPLORER
   Static-host friendly: range inputs + compact D²-law visualization
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const root = document.getElementById('process-explorer');
  const canvas = document.getElementById('process-canvas');
  if (!root || !canvas) return;

  const ctx = canvas.getContext('2d');
  const inputs = {
    smd: document.querySelector('[data-process-input="smd"]'),
    temp: document.querySelector('[data-process-input="temp"]'),
    rh: document.querySelector('[data-process-input="rh"]'),
    solids: document.querySelector('[data-process-input="solids"]'),
  };
  const values = {
    smd: document.querySelector('[data-process-value="smd"]'),
    temp: document.querySelector('[data-process-value="temp"]'),
    rh: document.querySelector('[data-process-value="rh"]'),
    solids: document.querySelector('[data-process-value="solids"]'),
  };
  const out = {
    state: document.getElementById('process-state-text'),
    time: document.getElementById('process-time'),
    path: document.getElementById('process-path'),
    particle: document.getElementById('process-particle'),
    rate: document.getElementById('process-rate'),
  };

  const reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let t = 0;
  let model = null;
  let drops = [];

  function number(key) {
    return parseFloat(inputs[key].value);
  }

  function computeModel() {
    const smd = number('smd');
    const temp = number('temp');
    const rh = number('rh');
    const solids = number('solids');

    const tempFactor = Math.exp((temp - 298) / 92);
    const humidityFactor = Math.max(0.18, 1 - rh / 72);
    const solidsFactor = 1 + solids * 0.24;
    const evaporationConstant = 4.8e-10 * tempFactor * humidityFactor / solidsFactor;
    const diameter = smd * 1e-6;
    const time = Math.min(999, Math.max(0.4, (diameter * diameter) / evaporationConstant));
    const airVelocity = 0.38 + (temp - 298) / 410 + (50 - rh) / 240;
    const path = Math.min(28, time * airVelocity);
    const particle = smd * Math.cbrt(Math.max(0.004, solids / 100));
    const rate = evaporationConstant / 4.8e-10;

    let state = 'balanced';
    let message = 'Balanced drying window';
    if (rh > 38 && time > 24) {
      state = 'humid';
      message = 'Humidity-limited drying';
    } else if (time > 42) {
      state = 'slow';
      message = 'Slow drying: reduce SMD or raise temperature';
    } else if (time < 5.5 && temp > 430) {
      state = 'fast';
      message = 'Very fast: watch crusting and wall deposition';
    }

    return { smd, temp, rh, solids, time, path, particle, rate, state, message };
  }

  function formatSeconds(v) {
    return v >= 100 ? Math.round(v) + ' s' : v.toFixed(1) + ' s';
  }

  function syncUi() {
    model = computeModel();

    values.smd.textContent = Math.round(model.smd) + ' μm';
    values.temp.textContent = Math.round(model.temp) + ' K';
    values.rh.textContent = Math.round(model.rh) + '%';
    values.solids.textContent = model.solids.toFixed(1) + ' wt%';

    out.state.textContent = model.message;
    out.time.textContent = formatSeconds(model.time);
    out.path.textContent = model.path.toFixed(1) + ' m';
    out.particle.textContent = Math.max(1, model.particle).toFixed(0) + ' μm';
    out.rate.textContent = model.rate.toFixed(1) + '×';
    root.dataset.state = model.state;
  }

  function resetDrops() {
    const count = 26;
    drops = Array.from({ length: count }, (_, i) => ({
      phase: Math.random(),
      lane: (i / count - 0.5) * 0.86 + (Math.random() - 0.5) * 0.12,
      drift: (Math.random() - 0.5) * 0.35,
      seed: Math.random() * Math.PI * 2,
    }));
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function drawChamber() {
    ctx.fillStyle = '#06101e';
    ctx.fillRect(0, 0, W, H);

    const chamberTop = H * 0.11;
    const chamberBottom = H * 0.86;
    const chamberWidth = Math.min(W * 0.52, 250);
    const cx = W * 0.5;

    const air = ctx.createLinearGradient(0, chamberTop, 0, chamberBottom);
    air.addColorStop(0, 'rgba(255,138,91,0.18)');
    air.addColorStop(0.48, 'rgba(79,195,247,0.08)');
    air.addColorStop(1, 'rgba(120,214,163,0.10)');
    ctx.fillStyle = air;
    ctx.beginPath();
    ctx.moveTo(cx - chamberWidth * 0.48, chamberTop);
    ctx.lineTo(cx - chamberWidth * 0.38, chamberBottom - 34);
    ctx.lineTo(cx - chamberWidth * 0.13, chamberBottom);
    ctx.lineTo(cx + chamberWidth * 0.13, chamberBottom);
    ctx.lineTo(cx + chamberWidth * 0.38, chamberBottom - 34);
    ctx.lineTo(cx + chamberWidth * 0.48, chamberTop);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(129,212,250,0.52)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, chamberTop, chamberWidth * 0.48, 12, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,200,87,0.55)';
    ctx.beginPath();
    ctx.moveTo(cx - chamberWidth * 0.72, H * 0.33);
    ctx.lineTo(cx - chamberWidth * 0.48, H * 0.33);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - chamberWidth * 0.54, H * 0.33 - 6);
    ctx.lineTo(cx - chamberWidth * 0.48, H * 0.33);
    ctx.lineTo(cx - chamberWidth * 0.54, H * 0.33 + 6);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,200,87,0.68)';
    ctx.font = '10px DM Mono, monospace';
    ctx.fillText(Math.round(model.temp) + ' K air', cx - chamberWidth * 0.88, H * 0.33 - 10);

    ctx.fillStyle = 'rgba(129,212,250,0.72)';
    ctx.fillText('RH ' + Math.round(model.rh) + '%', cx + chamberWidth * 0.36, chamberTop - 18);
    ctx.fillText('SMD ' + Math.round(model.smd) + ' μm', 14, H - 14);
  }

  function drawSpray() {
    const cx = W * 0.5;
    const top = H * 0.16;
    const height = H * 0.67;
    const spread = Math.min(W * 0.24, 116);
    const sizeScale = Math.max(0.55, Math.min(1.9, model.smd / 150));
    const shrinkRate = Math.max(0.18, Math.min(0.96, 18 / model.time));

    ctx.strokeStyle = 'rgba(129,212,250,0.6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, top - 8, 30, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    const cone = ctx.createLinearGradient(cx, top, cx, top + height);
    cone.addColorStop(0, 'rgba(79,195,247,0.20)');
    cone.addColorStop(0.65, 'rgba(79,195,247,0.06)');
    cone.addColorStop(1, 'rgba(120,214,163,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx - spread, top + height);
    ctx.lineTo(cx + spread, top + height);
    ctx.closePath();
    ctx.fill();

    drops.forEach((drop, i) => {
      const p = (drop.phase + t * (0.0018 + 0.00005 * model.rate)) % 1;
      const width = spread * (0.13 + p * 0.87);
      const wobble = Math.sin(p * 10 + drop.seed) * 12 * p;
      const x = cx + drop.lane * width + wobble + drop.drift * 18;
      const y = top + p * height;
      const dry = Math.min(1, p * shrinkRate * 1.55);
      const r = Math.max(1.1, (4.4 * sizeScale) * (1 - dry * 0.72));
      const alpha = Math.min(1, p * 7) * Math.max(0, 1 - Math.max(0, p - 0.92) / 0.08);

      const heat = Math.max(0, Math.min(1, (model.temp - 298) / 175));
      const red = Math.round(79 + heat * 130 + dry * 36);
      const green = Math.round(195 + dry * 20);
      const blue = Math.round(247 - heat * 92 - dry * 70);

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + red + ',' + green + ',' + blue + ',' + (alpha * 0.78) + ')';
      ctx.fill();

      if (i % 5 === 0) {
        ctx.beginPath();
        ctx.arc(x - r * 0.32, y - r * 0.28, Math.max(0.6, r * 0.25), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.5) + ')';
        ctx.fill();
      }
    });
  }

  function drawTimeline() {
    const x = 16;
    const y = 18;
    const w = Math.min(190, W - 32);
    const fill = Math.max(0.03, Math.min(1, 24 / model.time));

    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = model.state === 'balanced'
      ? 'rgba(120,214,163,0.9)'
      : model.state === 'slow'
        ? 'rgba(255,200,87,0.9)'
        : 'rgba(255,138,91,0.9)';
    ctx.fillRect(x, y, w * fill, 5);
    ctx.fillStyle = 'rgba(230,238,248,0.56)';
    ctx.font = '10px DM Mono, monospace';
    ctx.fillText('drying intensity', x, y + 20);
  }

  function draw() {
    if (!model || !W || !H) return;
    drawChamber();
    drawSpray();
    drawTimeline();
  }

  function animate() {
    t += 1;
    draw();
    if (!reducedMotion) requestAnimationFrame(animate);
  }

  Object.keys(inputs).forEach((key) => {
    inputs[key].addEventListener('input', () => {
      syncUi();
      resetDrops();
      draw();
    });
  });

  if (window.ResizeObserver) {
    new ResizeObserver(resizeCanvas).observe(canvas);
  } else {
    window.addEventListener('resize', resizeCanvas);
  }

  syncUi();
  resetDrops();
  resizeCanvas();
  if (!reducedMotion) requestAnimationFrame(animate);
})();
