export default {
  id: 'ember_dusk',
  label: 'Ember Dusk',
  mount(container: HTMLElement) {
    container.style.background = 'linear-gradient(to bottom, #1a1005, #062e21)';
    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d')!;
    let width = 0, height = 0;
    let frameId: number;
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    type Particle = { x: number; y: number; s: number; v: number; a: number; op: number };
    let particles: Particle[] = [];

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < 50; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          s: Math.random() * 2 + 1,
          v: Math.random() * 0.5 + 0.1,
          a: Math.random() * Math.PI * 2,
          op: Math.random() * 0.5 + 0.1
        });
      }
    };

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width;
      canvas.height = height;
      initParticles();
    };
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        if (!prefersReducedMotion) {
          p.y -= p.v;
          p.x += Math.sin(p.a) * 0.5;
          p.a += 0.01;
          if (p.y < 0) p.y = height;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${p.op})`;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#d4af37';
      });
      ctx.shadowBlur = 0;
    };

    const loop = () => {
      if (document.hidden) {
        frameId = requestAnimationFrame(loop);
        return;
      }
      draw();
      frameId = requestAnimationFrame(loop);
    };
    
    if (!prefersReducedMotion) {
       frameId = requestAnimationFrame(loop);
    } else {
       draw();
    }

    return {
      resize,
      dispose() {
        cancelAnimationFrame(frameId);
        container.innerHTML = '';
        container.style.cssText = '';
      }
    };
  }
};
