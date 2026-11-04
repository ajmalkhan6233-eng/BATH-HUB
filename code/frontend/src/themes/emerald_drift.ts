export default {
  id: 'emerald_drift',
  label: 'Emerald Drift (Calm)',
  mount(container: HTMLElement) {
    container.style.backgroundColor = '#021810';
    container.style.overflow = 'hidden';
    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';

    const styleId = 'theme-emerald-drift-style';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        @keyframes drift1 { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(10vw, 10vh) scale(1.1); } 66% { transform: translate(-5vw, 15vh) scale(0.9); } 100% { transform: translate(0, 0) scale(1); } }
        @keyframes drift2 { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-10vw, -15vh) scale(1.2); } 66% { transform: translate(15vw, -5vh) scale(0.8); } 100% { transform: translate(0, 0) scale(1); } }
        @keyframes drift3 { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(15vw, -10vh) scale(0.9); } 66% { transform: translate(-10vw, 5vh) scale(1.1); } 100% { transform: translate(0, 0) scale(1); } }
      `;
      document.head.appendChild(styleEl);
    }

    const createBlob = (color: string, size: string, animation: string, top: string, left: string) => {
      const blob = document.createElement('div');
      blob.style.position = 'absolute';
      blob.style.width = size;
      blob.style.height = size;
      blob.style.background = color;
      blob.style.borderRadius = '50%';
      blob.style.filter = 'blur(80px)';
      blob.style.top = top;
      blob.style.left = left;
      blob.style.opacity = '0.6';
      blob.style.animation = `${animation} 20s infinite alternate ease-in-out`;
      
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        blob.style.animation = 'none';
      }
      return blob;
    };

    const blobs = [
      createBlob('#0a4531', '40vw', 'drift1', '-10%', '-10%'),
      createBlob('#062e21', '50vw', 'drift2', '40%', '50%'),
      createBlob('#d4af37', '30vw', 'drift3', '60%', '-10%'),
    ];

    blobs.forEach(b => container.appendChild(b));

    return {
      resize() {},
      dispose() {
        container.innerHTML = '';
        container.style.cssText = '';
      }
    };
  }
};
