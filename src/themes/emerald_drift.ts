export default {
  id: 'emerald_drift',
  label: 'Emerald Drift (Calm)',
  mount(container: HTMLElement) {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.inset = '0';
    el.style.overflow = 'hidden';
    el.style.pointerEvents = 'none';
    el.style.background = '#041d14';

    // Create drifting blurred blobs
    el.innerHTML = `
      <div style="position:absolute; width:45vw; height:45vw; border-radius:50%; background:radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%); filter:blur(60px); top:-10%; left:-10%; animation:drift1 24s ease-in-out infinite alternate;"></div>
      <div style="position:absolute; width:50vw; height:50vw; border-radius:50%; background:radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%); filter:blur(80px); bottom:-15%; right:-10%; animation:drift2 28s ease-in-out infinite alternate;"></div>
      <div style="position:absolute; width:35vw; height:35vw; border-radius:50%; background:radial-gradient(circle, rgba(6,78,59,0.25) 0%, transparent 70%); filter:blur(70px); top:40%; left:35%; animation:drift3 20s ease-in-out infinite alternate;"></div>
      <style>
        @keyframes drift1 { from { transform: translate(0, 0); } to { transform: translate(15vw, 12vh); } }
        @keyframes drift2 { from { transform: translate(0, 0); } to { transform: translate(-12vw, -15vh); } }
        @keyframes drift3 { from { transform: translate(0, 0); } to { transform: translate(-10vw, 8vh); } }
      </style>
    `;

    container.appendChild(el);

    return {
      resize() {},
      dispose() {
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };
  }
};
