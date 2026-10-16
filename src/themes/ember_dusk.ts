export default {
  id: 'ember_dusk',
  label: 'Ember Dusk',
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

    const embers = Array.from({ length: 45 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2 + 1,
      vy: Math.random() * 0.6 + 0.3,
      sway: Math.random() * 2 - 1,
      alpha: Math.random() * 0.6 + 0.2
    }));

    const render = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Deep brown-to-emerald gradient
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#1c100b');
      bg.addColorStop(0.5, '#121e14');
      bg.addColorStop(1, '#051810');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      embers.forEach(e => {
        e.y -= e.vy;
        e.x += Math.sin(e.y * 0.02) * 0.5 + e.sway * 0.1;

        if (e.y < 0) {
          e.y = height + 10;
          e.x = Math.random() * width;
        }

        ctx.fillStyle = `rgba(245, 158, 11, ${e.alpha})`;
        ctx.shadowColor = '#d97706';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
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
