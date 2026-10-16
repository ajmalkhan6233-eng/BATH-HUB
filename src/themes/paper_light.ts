export default {
  id: 'paper_light',
  label: 'Paper (Light)',
  mount(container: HTMLElement) {
    container.dataset.mode = 'light';
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.inset = '0';
    el.style.pointerEvents = 'none';
    el.style.background = 'linear-gradient(135deg, #f7f3e8 0%, #ede6d1 50%, #f4eee1 100%)';

    el.innerHTML = `
      <div style="position:absolute; inset:0; opacity:0.04; background-image: radial-gradient(#0b1b3a 1px, transparent 1px); background-size: 16px 16px;"></div>
    `;

    container.appendChild(el);

    return {
      resize() {},
      dispose() {
        delete container.dataset.mode;
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };
  }
};
