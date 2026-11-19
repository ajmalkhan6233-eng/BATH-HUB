// ux-extra.js - Lightweight micro-interactions & utilities
window.RBH = window.RBH || {};

// 5. Depth Card 3D tilt
function rbhTilt(e) {
  const cards = document.querySelectorAll('.depth-card');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      const xc = rect.width / 2;
      const yc = rect.height / 2;
      const dx = (x - xc) / xc;
      const dy = (y - yc) / yc;
      card.style.transform = `perspective(1000px) rotateX(${dy * -10}deg) rotateY(${dx * 10}deg) scale3d(1.02, 1.02, 1.02)`;
    } else {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    }
  });
}
document.addEventListener('mousemove', rbhTilt);
document.addEventListener('touchmove', function (e) { if (e.touches[0]) rbhTilt(e.touches[0]); }, { passive: true });
document.addEventListener('touchend', function () { document.querySelectorAll('.depth-card').forEach(function (c) { c.style.transform = ''; }); });

// 6. RBH.particleText(el)
RBH.particleText = function(el) {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const text = el.innerText;
  el.innerText = '';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  el.appendChild(canvas);
  canvas.width = el.offsetWidth || 300;
  canvas.height = 50;
  ctx.font = '16px -apple-system, sans-serif';
  ctx.fillStyle = '#C9A227';
  ctx.fillText(text, 10, 30);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const particles = [];
  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      const index = (y * canvas.width + x) * 4 + 3;
      if (imgData.data[index] > 128) {
        particles.push({x: Math.random() * canvas.width, y: Math.random() * canvas.height, tx: x, ty: y});
      }
    }
  }
  let startTime = Date.now();
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += (p.tx - p.x) * 0.1;
      p.y += (p.ty - p.y) * 0.1;
      ctx.fillRect(p.x, p.y, 2, 2);
    });
    if (Date.now() - startTime < 2000) {
      requestAnimationFrame(animate);
    } else {
      el.innerText = text;
      canvas.remove();
    }
  }
  animate();
};
