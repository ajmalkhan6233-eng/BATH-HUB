export default {
  id: 'nature',
  label: 'Nature (Default)',
  mount(container: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const resize = () => {
      width = canvas.width = container.clientWidth || window.innerWidth;
      height = canvas.height = container.clientHeight || window.innerHeight;
    };
    resize();

    // Floating gold / emerald geometry
    const particles = Array.from({ length: 24 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 80 + 40,
      angle: Math.random() * Math.PI * 2,
      vAngle: (Math.random() - 0.5) * 0.005,
      alpha: Math.random() * 0.12 + 0.03
    }));

    const render = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Deep gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#062e21');
      bgGrad.addColorStop(1, '#0a4531');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render drifting shapes
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.vAngle;

        if (p.x < -p.size) p.x = width + p.size;
        if (p.x > width + p.size) p.x = -p.size;
        if (p.y < -p.size) p.y = height + p.size;
        if (p.y > height + p.size) p.y = -p.size;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.strokeStyle = `rgba(212, 175, 55, ${p.alpha})`;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return {
      resize,
      dispose() {
        cancelAnimationFrame(animationFrameId);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }
};
