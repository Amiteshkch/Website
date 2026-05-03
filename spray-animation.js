/* ═══════════════════════════════════════════════════════════════
   PHYSICALLY REALISTIC SPRAY ANIMATION
   Rayleigh-Plateau instability → ligament pinch-off → satellite
   drops → oscillating droplets → evaporation
   Three.js r160 + UnrealBloom EffectComposer
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── wait for THREE + addons ─────────────────────────────────── */
  if (!window.THREE) return;
  const THREE = window.THREE;

  const canvas = document.getElementById('spray-canvas');
  if (!canvas) return;

  /* ── RENDERER ─────────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
  renderer.toneMapping    = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene  = new THREE.Scene();
  scene.fog    = new THREE.FogExp2(0x020810, 0.028);

  const camera = new THREE.PerspectiveCamera(50, canvas.offsetWidth / canvas.offsetHeight, 0.1, 200);
  camera.position.set(0, 2, 22);

  function onResize() {
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  /* ── SCROLL ──────────────────────────────────────────────────── */
  let scrollP = 0;
  function updateScroll() {
    const hero = document.getElementById('hero');
    if (!hero) return;
    scrollP = Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight));
  }
  window.addEventListener('scroll', updateScroll, { passive: true });

  /* ══════════════════════════════════════════════════════════════
     SIMPLEX NOISE (2D, embedded)
  ══════════════════════════════════════════════════════════════ */
  function snoise2(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s  = (x + y) * F2;
    const i  = Math.floor(x + s), j = Math.floor(y + s);
    const t  = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = x - X0, y0 = y - Y0;
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2*G2, y2 = y0 - 1 + 2*G2;
    const grad = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    function g(h, px, py) { const v = grad[h & 7]; return v[0]*px + v[1]*py; }
    function p(n) {
      const h = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
      return h[n & 255];
    }
    let n0=0, n1=0, n2=0;
    let t0 = 0.5 - x0*x0 - y0*y0; if(t0>=0){t0*=t0; n0=t0*t0*g(p(i+p(j)),x0,y0);}
    let t1 = 0.5 - x1*x1 - y1*y1; if(t1>=0){t1*=t1; n1=t1*t1*g(p(i+i1+p(j+j1)),x1,y1);}
    let t2 = 0.5 - x2*x2 - y2*y2; if(t2>=0){t2*=t2; n2=t2*t2*g(p(i+1+p(j+1)),x2,y2);}
    return 70 * (n0 + n1 + n2);
  }

  /* ══════════════════════════════════════════════════════════════
     PHYSICS CONSTANTS (dimensionless, scaled to scene units)
     Based on water/polymer solution properties
  ══════════════════════════════════════════════════════════════ */
  const PHYSICS = {
    gravity:       0.0012,   // g downward per frame
    windSpeed:     0.0015,   // global horizontal breeze force
    drag:          0.9965,   // velocity damping
    surfaceTension:0.0018,   // drives oscillation restoring force
    viscosity:     0.994,    // oscillation damping (polymer > water)
    jetRadius:     0.18,     // unperturbed jet radius (scene units)
    perturbAmp:    0.06,     // initial Rayleigh perturbation amplitude
    perturbWave:   2.8,      // wavenumber of fastest-growing mode (≈ 2π r₀)
    pinchThresh:   0.022,    // radius threshold for pinch-off
    satelliteProb: 0.55,     // probability of satellite drop at pinch-off
  };

  /* ══════════════════════════════════════════════════════════════
     JET — Rayleigh-Plateau instability model
  ══════════════════════════════════════════════════════════════ */
  const JET_NODES = 120;
  const JET_LENGTH = 14;   // scene units

  class JetNode {
    constructor(index) {
      this.index   = index;
      this.frac    = index / (JET_NODES - 1); // 0=top, 1=bottom
      this.y       = 4.5 - this.frac * JET_LENGTH;
      this.r       = PHYSICS.jetRadius;
      this.phase   = this.frac * PHYSICS.perturbWave * Math.PI * 2
                     + (Math.random() - 0.5) * 0.3;
      this.pertAmp = PHYSICS.perturbAmp * (0.7 + Math.random() * 0.6);
      this.growthRate = 0.0;
      this.pinched = false;
    }
  }

  const jetNodes = Array.from({ length: JET_NODES }, (_, i) => new JetNode(i));

  const jetTubeGeo = new THREE.BufferGeometry();
  const jetTubePts = new Float32Array(JET_NODES * 3);
  const jetTubeAlp = new Float32Array(JET_NODES);
  const jetTubeSze = new Float32Array(JET_NODES);

  jetTubeGeo.setAttribute('position', new THREE.BufferAttribute(jetTubePts, 3));
  jetTubeGeo.setAttribute('aAlpha',   new THREE.BufferAttribute(jetTubeAlp, 1));
  jetTubeGeo.setAttribute('aSize',    new THREE.BufferAttribute(jetTubeSze, 1));

  const JET_VERT = `
    attribute float aAlpha;
    attribute float aSize;
    varying float vA;
    varying float vS;
    void main(){
      vA = aAlpha; vS = aSize;
      vec4 mv = modelViewMatrix * vec4(position,1.);
      gl_Position  = projectionMatrix * mv;
      gl_PointSize = aSize * 280. / (-mv.z);
    }`;
  const JET_FRAG = `
    varying float vA; varying float vS;
    void main(){
      vec2 uv = gl_PointCoord - .5;
      float d = length(uv);
      if(d>.5) discard;
      float core  = 1. - smoothstep(.0, .28, d);
      float rim   = smoothstep(.32, .48, d) * (1. - smoothstep(.48,.5,d));
      float body  = 1. - smoothstep(.0, .45, d);
      vec3 col = mix(vec3(.88,.97,1.), vec3(.12,.56,.9), d*1.8);
      col += vec3(.6,.9,1.) * core * .55;
      col += vec3(.3,.7,.9) * rim  * .35;
      gl_FragColor = vec4(col, vA * body);
    }`;

  const jetMat = new THREE.ShaderMaterial({
    vertexShader: JET_VERT, fragmentShader: JET_FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    uniforms: {},
  });
  const jetPointCloud = new THREE.Points(jetTubeGeo, jetMat);
  scene.add(jetPointCloud);

  function updateJetGeometry(appear) {
    const pos = jetTubeGeo.attributes.position;
    const alp = jetTubeGeo.attributes.aAlpha;
    const sze = jetTubeGeo.attributes.aSize;
    for (let i = 0; i < JET_NODES; i++) {
      const n = jetNodes[i];
      const wobX = n.pinched ? 0 : snoise2(n.frac * 4, n.phase * 0.1) * 0.28;
      pos.setXYZ(i, wobX, n.y * appear, 0);
      alp.setX(i, n.pinched ? 0 : appear * (0.6 + 0.4 * (1 - n.frac)));
      sze.setX(i, n.pinched ? 0 : Math.max(0, n.r) * 85);
    }
    pos.needsUpdate = true; alp.needsUpdate = true; sze.needsUpdate = true;
  }

  function evolveJet(breakup, t, dt) {
    const omega = breakup * 0.042;
    for (let i = 0; i < JET_NODES; i++) {
      const n = jetNodes[i];
      if (n.pinched) continue;
      const taper   = Math.pow(n.frac, 0.6);
      const phase   = n.phase + t * PHYSICS.perturbWave * 0.4;
      const perturb = n.pertAmp * taper * Math.cos(phase) * Math.exp(omega * t * taper);
      n.r = PHYSICS.jetRadius + perturb;
      n.r += snoise2(n.frac * 8 + t * 0.3, n.index * 0.05) * 0.012 * taper;
      n.r  = Math.max(0, n.r);
    }
  }

  function detectPinchOff(breakup) {
    if (breakup < 0.15) return [];
    const events = [];
    for (let i = 1; i < JET_NODES - 1; i++) {
      const n = jetNodes[i];
      if (!n.pinched && n.r < PHYSICS.pinchThresh) {
        n.pinched = true;
        events.push({ x: 0, y: n.y, frac: n.frac, index: i });
      }
    }
    return events;
  }

  /* ══════════════════════════════════════════════════════════════
     DROPLET — physically based oscillating sphere
  ══════════════════════════════════════════════════════════════ */
  class Droplet {
    constructor(x, y, z, r, type, vx, vy, vz) {
      this.x = x; this.y = y; this.z = z;
      this.r = r; this.currentR = r;
      this.type = type;
      this.vx = vx; this.vy = vy; this.vz = vz;
      this.life = 0;
      this.maxLife = type === 'micro'    ? 140 + Math.random() * 80
                   : type === 'satellite'? 220 + Math.random() * 100
                   : 320 + Math.random() * 140;
      this.oscAmp     = type === 'primary' ? 0.22 + Math.random() * 0.18 : 0.1;
      this.oscFreq    = Math.sqrt(PHYSICS.surfaceTension / (r * r * r)) * (0.8 + Math.random() * 0.4);
      this.oscPhase   = Math.random() * Math.PI * 2;
      this.oscDamp    = Math.pow(PHYSICS.viscosity, 0.5);
      this.evapK      = type === 'micro'    ? 0.000045
                      : type === 'satellite'? 0.000018
                      : 0.000006;
      this.D2_0       = (2 * r) ** 2;
    }

    update(dt) {
      this.life++;
      this.vx += PHYSICS.windSpeed; // apply global wind force
      this.x  += this.vx;
      this.y  += this.vy;
      this.z  += this.vz;
      this.vy -= PHYSICS.gravity;
      this.vx *= PHYSICS.drag;
      this.vy *= PHYSICS.drag;
      this.vz *= PHYSICS.drag;

      const D2 = Math.max(0, this.D2_0 - this.evapK * this.life);
      this.currentR = Math.sqrt(D2) / 2;

      const oscAngle = this.oscFreq * this.life + this.oscPhase;
      const damp     = Math.pow(this.oscDamp, this.life * 0.02);
      this.aspect    = 1 + this.oscAmp * damp * Math.sin(oscAngle);

      return this.currentR > 0.003 && this.life < this.maxLife && this.y > -14;
    }

    get alpha() {
      return Math.min(1, this.life / 18)
           * Math.max(0, 1 - (this.life - this.maxLife + 50) / 50);
    }
  }

  const MAX_DROPS = 800;
  const dPos   = new Float32Array(MAX_DROPS * 3);
  const dSzX   = new Float32Array(MAX_DROPS);
  const dSzY   = new Float32Array(MAX_DROPS);
  const dAlpha = new Float32Array(MAX_DROPS);
  const dType  = new Float32Array(MAX_DROPS);

  for (let i = 0; i < MAX_DROPS; i++) dPos[i*3+1] = -30;

  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dropGeo.setAttribute('aSzX',     new THREE.BufferAttribute(dSzX, 1));
  dropGeo.setAttribute('aSzY',     new THREE.BufferAttribute(dSzY, 1));
  dropGeo.setAttribute('aAlpha',   new THREE.BufferAttribute(dAlpha, 1));
  dropGeo.setAttribute('aType',    new THREE.BufferAttribute(dType, 1));

  const dropMat = new THREE.ShaderMaterial({
    vertexShader: DROP_VERT, fragmentShader: DROP_FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    uniforms: {},
  });
  const dropCloud = new THREE.Points(dropGeo, dropMat);
  scene.add(dropCloud);

  const drops = [];
  const dropSlots = new Array(MAX_DROPS).fill(false);
  function findSlot() {
    for (let i = 0; i < MAX_DROPS; i++) if (!dropSlots[i]) return i;
    return -1;
  }

  function createDrop(x, y, z, r, type, vx, vy, vz) {
    const slot = findSlot();
    if (slot < 0) return;
    const d = new Droplet(x, y, z, r, type, vx, vy, vz);
    d.slot = slot;
    dropSlots[slot] = true;
    drops.push(d);
  }

  function syncDropGPU() {
    for (const d of drops) {
      const s = d.slot;
      dPos[s*3]   = d.x; dPos[s*3+1] = d.y; dPos[s*3+2] = d.z;
      dSzX[s]     = d.currentR * (d.aspect || 1);
      dSzY[s]     = d.currentR / (d.aspect || 1);
      dAlpha[s]   = d.alpha;
      dType[s]    = d.type === 'primary' ? 0 : d.type === 'satellite' ? 1 : 2;
    }
    dropGeo.attributes.position.needsUpdate = true;
    dropGeo.attributes.aSzX.needsUpdate     = true;
    dropGeo.attributes.aSzY.needsUpdate     = true;
    dropGeo.attributes.aAlpha.needsUpdate   = true;
    dropGeo.attributes.aType.needsUpdate    = true;
  }

  function updateDropPool() {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (!d.update()) {
        dPos[d.slot*3+1] = -30;
        dAlpha[d.slot]   = 0;
        dropSlots[d.slot]= false;
        drops.splice(i, 1);
      }
    }
    syncDropGPU();
  }

  function handlePinchOff(events, breakup) {
    for (const ev of events) {
      const lambda  = (2 * Math.PI) / PHYSICS.perturbWave;
      const r_drop  = Math.pow(1.5 * PHYSICS.jetRadius * PHYSICS.jetRadius * lambda, 1/3);
      const r_clamp = Math.min(r_drop, 0.45);
      const jetVy = -(0.02 + ev.frac * 0.06);
      const vxOff = (Math.random() - 0.5) * 0.14 * breakup;
      const vzOff = (Math.random() - 0.5) * 0.13 * breakup;
      createDrop(ev.x + vxOff, ev.y, vzOff, r_clamp, 'primary', vxOff * 1.5, jetVy, vzOff * 1.5);
      if (Math.random() < PHYSICS.satelliteProb) {
        const r_sat = r_clamp * (0.38 + Math.random() * 0.18);
        createDrop(ev.x + (Math.random()-0.5)*0.15, ev.y + 0.2, (Math.random()-0.5)*0.1, r_sat, 'satellite', (Math.random()-0.5)*0.06, jetVy * 0.85, (Math.random()-0.5)*0.05);
      }
      const nMicro = 2 + Math.floor(Math.random() * 4);
      for (let m = 0; m < nMicro; m++) {
        createDrop(ev.x + (Math.random()-0.5)*0.4, ev.y + (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.2, 0.018 + Math.random() * 0.04, 'micro', (Math.random()-0.5)*0.18, jetVy*0.4 + (Math.random()-0.5)*0.08, (Math.random()-0.5)*0.18);
      }
    }
  }

  let dripTimer = 0;
  function emitDrips(appear, breakup) {
    dripTimer++;
    const rate = breakup > 0.05 ? 0 : Math.floor(appear * 12);
    if (dripTimer % Math.max(1, 18 - rate) !== 0) return;
    const r = 0.08 + Math.random() * 0.06;
    createDrop(0.24, 4.3, 0, r, 'primary', (Math.random()-0.5)*0.012, -0.012, (Math.random()-0.5)*0.008);
  }

  const threads = [];
  const MAX_THREADS = 30;

  function spawnThread(x, y, breakup) {
    if (threads.length >= MAX_THREADS) return;
    const segs  = 20;
    const len   = 0.4 + Math.random() * 1.8 * breakup;
    const angle = -Math.PI/2 + (Math.random()-0.5) * 1.2;
    const pts   = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      pts.push(new THREE.Vector3(x + Math.cos(angle)*len*t + snoise2(t*6, angle)*0.06, y + Math.sin(angle)*len*t, (Math.random()-0.5)*0.1));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x90caf9, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    threads.push({ line, life: 0, maxLife: 60 + Math.random() * 50 });
  }

  function updateThreads(breakup) {
    if (breakup > 0.08 && threads.length < MAX_THREADS && Math.random() < 0.18 * breakup) {
      spawnThread((Math.random()-0.5)*1.5*breakup, 3 - Math.random() * 9 * breakup, breakup);
    }
    for (let i = threads.length-1; i >= 0; i--) {
      const th = threads[i];
      th.life++;
      const f = Math.min(1, th.life/10) * Math.max(0, 1-(th.life-th.maxLife+15)/15);
      th.line.material.opacity = f * 0.7;
      if (th.life >= th.maxLife) { scene.remove(th.line); th.line.geometry.dispose(); th.line.material.dispose(); threads.splice(i, 1); }
    }
  }

  const MIST_N  = 500;
  const mistPos = new Float32Array(MIST_N * 3);
  const mistPh  = new Float32Array(MIST_N);
  for (let i = 0; i < MIST_N; i++) { mistPos[i*3] = (Math.random()-.5)*30; mistPos[i*3+1] = (Math.random()-.5)*24; mistPos[i*3+2] = (Math.random()-.5)*12 - 4; mistPh[i] = Math.random()*Math.PI*2; }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  mistGeo.setAttribute('aPhase',   new THREE.BufferAttribute(mistPh, 1));
  const mistUni = { uT: { value: 0 } };
  const mistMat = new THREE.ShaderMaterial({ vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, uniforms: mistUni, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(mistGeo, mistMat));

  scene.add(new THREE.AmbientLight(0x3060a0, 0.6));
  const ptA = new THREE.PointLight(0x4fc3f7, 4, 40); ptA.position.set(0, 6, 12); scene.add(ptA);
  const ptB = new THREE.PointLight(0x0277bd, 2.5, 30); ptB.position.set(-6,-2, 8); scene.add(ptB);
  const ptC = new THREE.PointLight(0x00e5ff, 2, 22); ptC.position.set(5, 3, 7); scene.add(ptC);

  const ov = document.createElement('canvas');
  ov.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;';
  canvas.parentElement.appendChild(ov);
  const oc = ov.getContext('2d');
  function resizeOv() { const dpr = window.devicePixelRatio||1; ov.width = canvas.offsetWidth*dpr; ov.height = canvas.offsetHeight*dpr; oc.setTransform(dpr,0,0,dpr,0,0); }
  resizeOv(); window.addEventListener('resize', resizeOv);

  function drawNozzle(t, appear) {
    oc.clearRect(0,0,canvas.offsetWidth,canvas.offsetHeight);
    if (appear < 0.05) return;
    const W = canvas.offsetWidth; const cx = W*0.5;
    oc.save(); oc.globalAlpha = appear; oc.shadowBlur = 20; oc.shadowColor='#4fc3f7';
    oc.strokeStyle='rgba(79,195,247,0.6)'; oc.lineWidth=3; oc.beginPath(); oc.moveTo(cx-60,30); oc.lineTo(cx+60,30); oc.stroke(); oc.beginPath(); oc.moveTo(cx+26,30); oc.lineTo(cx+26,65); oc.stroke();
    oc.strokeStyle='rgba(79,195,247,0.95)'; oc.lineWidth=4; oc.beginPath(); oc.moveTo(cx+14,65); oc.lineTo(cx+38,65); oc.stroke();
    const dripT = (t % 2.8) / 2.8; const rDrip = dripT < 0.7 ? 3 + dripT * 8 : 3 + 0.7 * 8 - (dripT - 0.7) * 20; const yDrip = 65 + dripT * 14;
    if (rDrip > 0.5) { const grd = oc.createRadialGradient(cx+26-rDrip*.3, yDrip-rDrip*.3, 0, cx+26, yDrip, rDrip*1.5); grd.addColorStop(0,'rgba(220,248,255,0.95)'); grd.addColorStop(0.4,'rgba(79,195,247,0.88)'); grd.addColorStop(1,'rgba(13,71,161,0.5)'); oc.beginPath(); oc.arc(cx+26, yDrip, Math.max(0,rDrip), 0, Math.PI*2); oc.fillStyle = grd; oc.fill(); if (dripT > 0.55 && dripT < 0.78) { const neck = (0.78 - dripT) / 0.23; oc.strokeStyle = `rgba(129,212,250,${neck*0.8})`; oc.lineWidth = neck * 2; oc.beginPath(); oc.moveTo(cx+26, 65); oc.lineTo(cx+26, yDrip-rDrip); oc.stroke(); } }
    oc.restore();
  }

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.to(camera.position, { z: 16, y: -1, ease: 'none', scrollTrigger: { trigger:'#hero', start:'top top', end:'bottom top', scrub:2 } });
  }

  const clock  = new THREE.Clock();
  let lastPinchResetTime = -999;
  let t_breakup_start   = -1;

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    updateScroll();
    const p = scrollP; const appear = Math.min(1, p / 0.18); const breakup = Math.max(0, Math.min(1, (p - 0.18) / 0.38));
    if (breakup < 0.02 && t - lastPinchResetTime > 2) { jetNodes.forEach(n => { n.pinched = false; n.r = PHYSICS.jetRadius; }); lastPinchResetTime = t; t_breakup_start = -1; }
    if (breakup > 0.02 && t_breakup_start < 0) t_breakup_start = t;
    const t_rel = t_breakup_start > 0 ? t - t_breakup_start : 0;
    evolveJet(breakup, t_rel, 1/60);
    const events = detectPinchOff(breakup); if (events.length) handlePinchOff(events, breakup);
    emitDrips(appear, breakup);
    updateJetGeometry(appear);
    updateThreads(breakup);
    updateDropPool();
    mistUni.uT.value = t;
    ptA.intensity = 3.8 + 1.2 * Math.sin(t*1.2); ptA.position.x = Math.sin(t*0.3)*2; ptC.position.set(5+Math.cos(t*0.4)*2, 3+Math.sin(t*0.55)*2, 7);
    drawNozzle(t, appear > 0.05 ? 1 : appear / 0.05);
    renderer.render(scene, camera);
  }
  animate();
})();
