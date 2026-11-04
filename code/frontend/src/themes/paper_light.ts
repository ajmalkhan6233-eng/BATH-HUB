export default {
  id: 'paper_light',
  label: 'Paper (Light)',
  mount(container: HTMLElement) {
    container.dataset.mode = 'light';
    container.style.background = '#f4f1ea';
    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';
    
    const grain = document.createElement('div');
    grain.style.position = 'absolute';
    grain.style.inset = '0';
    grain.style.opacity = '0.4';
    grain.style.mixBlendMode = 'multiply';
    grain.style.pointerEvents = 'none';

    const svgNoise = `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)"/>
      </svg>
    `;
    const encodedSvg = `data:image/svg+xml;base64,${btoa(svgNoise)}`;
    grain.style.backgroundImage = `url(${encodedSvg})`;

    container.appendChild(grain);

    const styleId = 'theme-paper-light-style';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        @keyframes paper-grain { 0%, 100% { transform: translate(0, 0); } 10% { transform: translate(-1%, -1%); } 30% { transform: translate(1%, -2%); } 50% { transform: translate(-2%, 1%); } 70% { transform: translate(2%, 2%); } 90% { transform: translate(-1%, 2%); } }
        .animate-paper-grain { animation: paper-grain 1s steps(2) infinite; }
      `;
      document.head.appendChild(styleEl);
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion) {
      grain.classList.add('animate-paper-grain');
    }

    return {
      resize() {},
      dispose() {
        delete container.dataset.mode;
        container.innerHTML = '';
        container.style.cssText = '';
      }
    };
  }
};
