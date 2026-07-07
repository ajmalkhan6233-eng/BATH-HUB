// themes/nature.js
// Default BATHCO_NATURE background theme — floating gold/emerald wireframe
// polyhedra. This is the scene that was previously inlined directly in
// BATHCO_NATURE.html; extracted verbatim (same geometry, materials, motion)
// so the theme switcher can restore it after trying other themes. Stays the
// default theme — nothing about its behavior changed in this extraction.
export default {
  id: 'nature',
  label: 'Nature (Default)',

  build(canvas, THREE) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 12;

    const goldMat = new THREE.MeshBasicMaterial({ color: 0xc9a227, wireframe: true, transparent: true, opacity: 0.35 });
    const emeraldMat = new THREE.MeshBasicMaterial({ color: 0x14532d, wireframe: true, transparent: true, opacity: 0.3 });
    const geoms = [
      new THREE.IcosahedronGeometry(1.4, 0),
      new THREE.OctahedronGeometry(1.1, 0),
      new THREE.TorusGeometry(1, 0.35, 8, 16),
    ];
    const meshes = [];
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(geoms[i % geoms.length], i % 2 === 0 ? goldMat : emeraldMat);
      mesh.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8 - 4);
      mesh.userData.spin = (Math.random() * 0.006) + 0.002;
      scene.add(mesh);
      meshes.push(mesh);
    }

    return {
      renderer, scene, camera,
      update() {
        meshes.forEach(m => { m.rotation.x += m.userData.spin; m.rotation.y += m.userData.spin * 0.7; });
      },
      dispose() {
        renderer.dispose();
        geoms.forEach(g => g.dispose());
        goldMat.dispose();
        emeraldMat.dispose();
      },
    };
  },
};
