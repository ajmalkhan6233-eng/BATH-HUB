// Hyperspace background theme (Task Batch D, 2026-07-21) — a stationary-
// viewpoint Canvas2D starfield with particles streaming toward the viewer.
// Shared by daily-entry.html and BATHCO_NATURE.html (the "BATHCO COMMAND"
// dashboard's non-3D pages). 100% procedurally generated — no images, no
// network requests, so there is zero imagery-licensing surface for this
// theme (a real photo cannot convincingly "stream" anyway; that motion is
// inherently a stylized effect, not something any telescope has footage of).
//
// Replaces the old flat 12-swatch CSS-gradient "Sunrise" picker
// (localStorage key "bathco-theme") entirely — not extended. Does NOT touch
// the separate WebGL nature/kim_forest 3D engine (localStorage key
// "bathco_theme", themes/*.js, home page + login screen only) — that is a
// different, already-working system this task was not asked to replace.
//
// Contract exposed on window.HyperspaceTheme:
//   mount()      - call once per page after DOM ready
//   isEnabled()  - current on/off state (persisted)
//   enable() / disable() / toggle()
(function(){
  const KEY = 'bathco-hyperspace';
  const reduceMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const CLEAR = '5,7,10';   // near-black navy clear color
  const WARM = '212,162,78'; // brass accent, matches the existing UI palette

  function isEnabled(){ return localStorage.getItem(KEY) !== 'off'; }
  // Host pages with their OWN richer background on certain views (e.g.
  // BATHCO_NATURE.html's WebGL nature/kim_forest scene, home page + login
  // screen only) can call setPageActive(false) there so the two don't
  // visually compete; the user's on/off preference is untouched either way.
  let pageActive = true;

  let canvas, ctx, particles = [], raf = null, running = false, W = 0, H = 0, lastT = 0;

  function createCanvas(){
    let c = document.getElementById('hyperspaceCanvas');
    if (c) return c;
    c = document.createElement('canvas');
    c.id = 'hyperspaceCanvas';
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
    document.body.insertBefore(c, document.body.firstChild);
    return c;
  }

  function makeParticle(){
    return { x: Math.random()*2-1, y: Math.random()*2-1, z: Math.random()*0.98+0.02, warm: Math.random() < 0.12 };
  }
  function resize(){
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  function initParticles(){
    const count = Math.min(260, Math.max(90, Math.round((W*H)/9000)));
    particles = Array.from({ length: count }, makeParticle);
  }

  function drawParticle(p, alphaBoost){
    const cx = W/2, cy = H/2;
    const k = 0.5/p.z;
    const sx = cx + p.x*k*cx, sy = cy + p.y*k*cy;
    if (sx < -50 || sx > W+50 || sy < -50 || sy > H+50) return;
    const size = Math.max(0.5, 2.6*(1-p.z));
    const alpha = Math.min(1, (1-p.z)*1.3 + 0.15) * alphaBoost;
    ctx.beginPath();
    ctx.fillStyle = p.warm ? `rgba(${WARM},${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.arc(sx, sy, size, 0, Math.PI*2);
    ctx.fill();
  }

  // Reduced-motion: a single still frame, no rAF loop started at all.
  function drawStatic(){
    ctx.fillStyle = `rgb(${CLEAR})`;
    ctx.fillRect(0, 0, W, H);
    particles.forEach(p => drawParticle(p, 1));
  }

  const SPEED = 0.16; // fraction of remaining depth crossed per second
  function step(dt){
    // Low-alpha repaint instead of a full clear — leaves a soft trail behind
    // each particle, which is what actually reads as "streaming" motion.
    ctx.fillStyle = `rgba(${CLEAR},0.35)`;
    ctx.fillRect(0, 0, W, H);
    for (const p of particles){
      p.z -= SPEED*dt;
      if (p.z <= 0.02){ p.x = Math.random()*2-1; p.y = Math.random()*2-1; p.z = 1; p.warm = Math.random() < 0.12; }
      drawParticle(p, 1);
    }
  }
  function loop(t){
    if (!running) return;
    const dt = Math.min(0.05, (t - lastT)/1000 || 0.016);
    lastT = t;
    step(dt);
    raf = requestAnimationFrame(loop);
  }
  function start(){
    if (running) return;
    running = true; lastT = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop(){
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }
  function render(){
    if (!canvas) return;
    if (!isEnabled() || !pageActive){ canvas.style.display = 'none'; stop(); return; }
    canvas.style.display = 'block';
    if (reduceMotionMQ.matches){ stop(); drawStatic(); }
    else start();
  }
  function setEnabled(v){ localStorage.setItem(KEY, v ? 'on' : 'off'); render(); }

  function mount(){
    canvas = createCanvas();
    ctx = canvas.getContext('2d');
    resize(); initParticles();
    window.addEventListener('resize', () => { resize(); initParticles(); if (!running) render(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else render();
    });
    reduceMotionMQ.addEventListener?.('change', render);
    render();
  }

  window.HyperspaceTheme = {
    mount, isEnabled,
    enable(){ setEnabled(true); },
    disable(){ setEnabled(false); },
    toggle(){ setEnabled(!isEnabled()); return isEnabled(); },
    setPageActive(v){ pageActive = !!v; render(); },
  };
})();
