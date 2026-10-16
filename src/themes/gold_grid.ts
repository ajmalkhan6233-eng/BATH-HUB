export default {
  id: 'gold_grid',
  label: 'Gold Grid',
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
    let offset = 0;

    const resize = () => {
      width = canvas.width = container.clientWidth || window.innerWidth;
      height = canvas.height = container.clientHeight || window.innerHeight;
    };
    resize();

    // Floating gold dust
    const dust = Array.from({ length: 30 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vy: Math.random() * 0.2 + 0.1,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1
    }));

    const render = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Deep dark background
      ctx.fillStyle = '#051810';
      ctx.fillRect(0, 0, width, height);

      // Ground perspective grid in bottom 50%
      const horizon = height * 0.45;
      const groundH = height - horizon;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizon, width, height);
      ctx.clip();

      // Translucent gold gradient
      const grad = ctx.createLinearGradient(0, horizon, 0, height);
      grad.addColorStop(0, 'rgba(212, 175, 55, 0.02)');
      grad.addColorStop(1, 'rgba(212, 175, 55, 0.18)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, horizon, width, height);

      offset = (offset + 0.35) % 40;

      // Horizontal lines receding into perspective
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
      ctx.lineWidth = 1;
      for (let y = 0; y < groundH; y += 18) {
        const py = horizon + (y + offset);
        if (py <= height) {
          ctx.beginPath();
          ctx.moveTo(0, py);
          ctx.lineTo(width, py);
          ctx.stroke();
        }
      }

      // Vanishing lines to center
      const centerX = width / 2;
      for (let x = -width; x < width * 2; x += 60) {
        ctx.beginPath();
        ctx.moveTo(centerX, horizon);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      ctx.restore();

      // Render dust
      dust.forEach(d => {
        d.y -= d.vy;
        if (d.y < 0) {
          d.y = height;
          d.x = Math.random() * width;
        }
        ctx.fillStyle = `rgba(232, 207, 122, ${d.alpha})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
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
