/* ═══════════════════════════════════════════════════════════════
   SPRAY DRYING ANIMATION — Three.js WebGL + GSAP ScrollTrigger
   Jet → Ligament breakup → 3D Droplet cloud → Evaporation
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const canvas = document.getElementById('spray-canvas');
  if (!canvas) return;

  // ── THREE.JS SCENE SETUP ──────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    55,
    canvas.offsetWidth / canvas.offsetHeight,
    0.1,
    200
  );
  camera.position.set(0, 0, 18);

  // resize handler
  function onResize() {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  // ── SCROLL PROGRESS ──────────────────────────────────────────
  let scrollProgress = 0;
  function updateScroll() {
    const hero = document.getElementById('hero');
    if (!hero) return;
    scrollProgress = Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight));
  }
  window.addEventListener('scroll', updateScroll, { passive: true });

  // ── COLOR HELPERS ────────────────────────────────────────────
  const jetColor    = new THREE.Color(0x4fc3f7);
  const dropColor   = new THREE.Color(0x81d4fa);
  const mistColor   = new THREE.Color(0xb3e5fc);

  // ── NOZZLE / TAP (2D canvas overlay drawn on top via 2D canvas) ─
  // We'll keep the 2D tap drawing on a separate overlay canvas
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  canvas.parentElement.appendChild(overlayCanvas);
  const oc = overlayCanvas.getContext('2d');

  function resizeOverlay() {
    const dpr = window.devicePixelRatio || 1;
    overlayCanvas.width  = canvas.offsetWidth  * dpr;
    overlayCanvas.height = canvas.offsetHeight * dpr;
    oc.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeOverlay();
  window.addEventListener('resize', resizeOverlay);

  function drawNozzle() {
    const W = canvas.offsetWidth;
    oc.clearRect(0, 0, W, canvas.offsetHeight);
    const cx = W * 0.5;
    const ty = 0;
    const drip = 0.5 + 0.5 * Math.sin(Date.now() * 0.003);

    oc.save();
    oc.strokeStyle = 'rgba(79,195,247,0.6)';
    oc.lineWidth = 2.5;
    // horizontal pipe
    oc.beginPath(); oc.moveTo(cx - 52, ty + 30); oc.lineTo(cx + 52, ty + 30); oc.stroke();
    // vertical spout
    oc.beginPath(); oc.moveTo(cx + 22, ty + 30); oc.lineTo(cx + 22, ty + 58); oc.stroke();
    // flare
    oc.strokeStyle = 'rgba(79,195,247,0.95)';
    oc.lineWidth = 3;
    oc.beginPath(); oc.moveTo(cx + 12, ty + 58); oc.lineTo(cx + 32, ty + 58); oc.stroke();
    // drip
    oc.beginPath();
    oc.arc(cx + 22, ty + 58 + drip * 7, 3.5 + drip * 2.5, 0, Math.PI * 2);
    const dAlpha = 0.5 + drip * 0.45;
    oc.fillStyle = `rgba(79,195,247,${dAlpha})`;
    oc.shadowBlur = 12; oc.shadowColor = '#4fc3f7';
    oc.fill();
    oc.shadowBlur = 0;
    oc.restore();
  }

  // ── JET PARTICLES ────────────────────────────────────────────
  const JET_COUNT = 800;
  const jetPositions = new Float32Array(JET_COUNT * 3);
  const jetAlphas    = new Float32Array(JET_COUNT);
  const jetSpeeds    = new Float32Array(JET_COUNT);
  const jetPhases    = new Float32Array(JET_COUNT);

  for (let i = 0; i < JET_COUNT; i++) {
    jetPositions[i * 3 + 1] = (Math.random() - 0.5) * 12; // y spread along jet
    jetSpeeds[i]  = 0.5 + Math.random() * 1.2;
    jetPhases[i]  = Math.random() * Math.PI * 2;
    jetAlphas[i]  = Math.random();
  }

  const jetGeo = new THREE.BufferGeometry();
  jetGeo.setAttribute('position', new THREE.BufferAttribute(jetPositions, 3));
  const jetMat = new THREE.PointsMaterial({
    color: jetColor,
    size: 0.12,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const jetPoints = new THREE.Points(jetGeo, jetMat);
  jetPoints.position.y = 2;
  scene.add(jetPoints);

  // ── DROPLET CLOUD (instanced spheres) ─────────────────────────
  const DROP_COUNT = 400;
  const dropGeo = new THREE.SphereGeometry(1, 8, 8);
  const dropMat = new THREE.MeshPhongMaterial({
    color: dropColor,
    emissive: new THREE.Color(0x1a6080),
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.82,
    shininess: 120,
    specular: new THREE.Color(0xffffff),
  });

  // store drop state
  const drops = [];
  const dropMeshes = [];

  function spawnDrop(progress) {
    if (drops.length >= DROP_COUNT) return null;
    const breakup = Math.max(0, (progress - 0.20) / 0.35);
    if (breakup < 0.08) return null;

    const rand = Math.random();
    let r, type;
    if (rand < 0.05)      { r = 0.28 + Math.random() * 0.18; type = 'large'; }
    else if (rand < 0.22) { r = 0.14 + Math.random() * 0.12; type = 'medium'; }
    else if (rand < 0.55) { r = 0.06 + Math.random() * 0.08; type = 'small'; }
    else                  { r = 0.02 + Math.random() * 0.04; type = 'mist'; }

    const spread = breakup * 5;
    const x  =  (Math.random() - 0.5) * spread;
    const y  =  2 - Math.random() * 7;
    const z  =  (Math.random() - 0.5) * spread * 0.6;
    const vx =  (Math.random() - 0.5) * 0.06 * (1 + breakup);
    const vy = -(0.01 + Math.random() * 0.04);
    const vz =  (Math.random() - 0.5) * 0.04;

    const mesh = new THREE.Mesh(dropGeo, dropMat.clone());
    mesh.scale.setScalar(r);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    dropMeshes.push(mesh);

    const drop = { mesh, x, y, z, vx, vy, vz, r,
      life: 0,
      maxLife: type === 'mist' ? 180 + Math.random() * 80
             : type === 'small'? 280 + Math.random() * 80
             : 380 + Math.random() * 100,
      evapRate: type === 'mist' ? 0.0006 : type === 'small' ? 0.00025 : 0.00008,
      currentR: r, type,
    };
    drops.push(drop);
    return drop;
  }

  function updateDrops(progress) {
    const breakup = Math.max(0, (progress - 0.20) / 0.35);

    // spawn
    const spawnRate = breakup < 0.08 ? 0 : Math.floor(breakup * 6);
    for (let s = 0; s < spawnRate; s++) spawnDrop(progress);

    // update each
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.life++;
      d.x += d.vx; d.y += d.vy; d.z += d.vz;
      d.vy -= 0.0008; // gravity
      d.vx *= 0.997; d.vy *= 0.997; d.vz *= 0.997;
      d.currentR = Math.max(0.005, d.r - d.evapRate * d.life);

      const fade = Math.min(1, d.life / 20) *
                   Math.max(0, 1 - (d.life - d.maxLife + 40) / 40);

      d.mesh.position.set(d.x, d.y, d.z);
      d.mesh.scale.setScalar(d.currentR);
      d.mesh.material.opacity = fade * (d.type === 'mist' ? 0.35 : 0.8);

      if (d.life >= d.maxLife || d.currentR <= 0.005 || d.y < -10) {
        scene.remove(d.mesh);
        d.mesh.material.dispose();
        drops.splice(i, 1);
        dropMeshes.splice(i, 1);
      }
    }
  }

  // ── LIGAMENT LINES ────────────────────────────────────────────
  const ligaments = [];
  const MAX_LIGS  = 40;

  function spawnLigament(progress) {
    if (ligaments.length >= MAX_LIGS) return;
    const breakup = Math.max(0, (progress - 0.22) / 0.32);
    if (breakup < 0.05) return;

    const pts = [];
    const ox = (Math.random() - 0.5) * breakup * 3;
    const oy = -1 - Math.random() * 5;
    const angle = Math.PI * (0.3 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
    const len   = 0.8 + Math.random() * 2.5 * breakup;
    const segs  = 8;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      pts.push(new THREE.Vector3(
        ox + Math.cos(angle) * len * t + (Math.random() - 0.5) * 0.15,
        oy + Math.sin(angle) * len * t,
        (Math.random() - 0.5) * 0.5
      ));
    }
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    const mat  = new THREE.LineBasicMaterial({
      color: 0x81d4fa,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    ligaments.push({ line, life: 0, maxLife: 90 + Math.random() * 60 });
  }

  function updateLigaments(progress) {
    const breakup = Math.max(0, (progress - 0.22) / 0.32);
    if (breakup > 0.05 && ligaments.length < MAX_LIGS && Math.random() < 0.25) {
      spawnLigament(progress);
    }
    for (let i = ligaments.length - 1; i >= 0; i--) {
      const l = ligaments[i];
      l.life++;
      const fade = Math.min(1, l.life / 15) *
                   Math.max(0, 1 - (l.life - l.maxLife + 20) / 20);
      l.line.material.opacity = fade * 0.75;
      if (l.life >= l.maxLife) {
        scene.remove(l.line);
        l.line.geometry.dispose();
        l.line.material.dispose();
        ligaments.splice(i, 1);
      }
    }
  }

  // ── LIGHTS ───────────────────────────────────────────────────
  const ambLight = new THREE.AmbientLight(0x4fc3f7, 0.4);
  scene.add(ambLight);
  const ptLight = new THREE.PointLight(0x4fc3f7, 2.5, 30);
  ptLight.position.set(0, 3, 8);
  scene.add(ptLight);
  const ptLight2 = new THREE.PointLight(0x00b4d8, 1.5, 25);
  ptLight2.position.set(-4, -3, 5);
  scene.add(ptLight2);

  // ── BACKGROUND STARS / MIST FIELD ────────────────────────────
  const STAR_COUNT = 600;
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    starPositions[i * 3]     = (Math.random() - 0.5) * 40;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 30;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xb3e5fc,
    size: 0.04,
    transparent: true,
    opacity: 0.25,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  scene.add(new THREE.Points(starGeo, starMat));

  // ── JET GEOMETRY UPDATE ───────────────────────────────────────
  function updateJet(progress, t) {
    const appear  = Math.min(1, progress / 0.22);
    const breakup = Math.max(0, Math.min(1, (progress - 0.22) / 0.32));
    const pos = jetGeo.attributes.position;

    for (let i = 0; i < JET_COUNT; i++) {
      const frac = (i / JET_COUNT);
      const y    = 4 - frac * 10 * appear;

      // Rayleigh wobble growing with breakup
      const wobX = breakup * 1.8 * frac * Math.sin(frac * 18 + t * 2.5 + jetPhases[i]);
      const wobZ = breakup * 0.6 * frac * Math.cos(frac * 12 + t * 1.8 + jetPhases[i]);

      pos.setXYZ(i, wobX, y, wobZ);
    }
    pos.needsUpdate = true;
    jetMat.opacity = appear * (1 - breakup * 0.65);
    jetPoints.visible = appear > 0.01;
  }

  // ── GSAP ScrollTrigger integration ───────────────────────────
  // Animate camera slightly with scroll for parallax depth feel
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    gsap.to(camera.position, {
      z: 14,
      y: -1.5,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 1.5,
      },
    });

    // gentle camera sway
    gsap.to(camera.rotation, {
      x: 0.06,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 2,
      },
    });
  }

  // ── RENDER LOOP ───────────────────────────────────────────────
  let frame = 0;
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    frame++;
    const t   = clock.getElapsedTime();
    updateScroll();
    const p = scrollProgress;

    // jet
    updateJet(p, t);

    // ligaments
    if (frame % 6 === 0) updateLigaments(p);
    else {
      // still update life/fade each frame
      for (let i = ligaments.length - 1; i >= 0; i--) {
        const l = ligaments[i];
        l.life++;
        const fade = Math.min(1, l.life / 15) *
                     Math.max(0, 1 - (l.life - l.maxLife + 20) / 20);
        l.line.material.opacity = fade * 0.75;
        if (l.life >= l.maxLife) {
          scene.remove(l.line);
          l.line.geometry.dispose();
          l.line.material.dispose();
          ligaments.splice(i, 1);
        }
      }
    }

    // droplets (every 2nd frame for perf)
    if (frame % 2 === 0) updateDrops(p);

    // gentle point light pulse
    ptLight.intensity = 2.2 + 0.6 * Math.sin(t * 1.4);
    ptLight.position.x = Math.sin(t * 0.4) * 2;

    // draw 2D nozzle overlay
    drawNozzle();

    renderer.render(scene, camera);
  }
  animate();

})();
