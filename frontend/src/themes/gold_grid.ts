export default {
  id: 'gold_grid',
  label: 'Gold Grid',
  mount(container: HTMLElement) {
    container.style.backgroundColor = '#062e21';
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
    let offset = 0;
    const speed = 0.5;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)'; // gold
      
      const horizon = height * 0.4;
      
      // Vertical lines
      for (let x = -width; x < width * 2; x += 100) {
        ctx.beginPath();
        ctx.moveTo(width/2, horizon);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      // Horizontal lines
      offset = prefersReducedMotion ? 0 : (offset + speed) % 50;
      for (let y = horizon + 10; y < height; y += (y - horizon) * 0.1) {
        const actualY = y + (offset/50) * ((y - horizon) * 0.1);
        if (actualY > height) continue;
        ctx.beginPath();
        ctx.moveTo(0, actualY);
        ctx.lineTo(width, actualY);
        ctx.stroke();
      }
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
