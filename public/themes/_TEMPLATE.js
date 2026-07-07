// themes/_TEMPLATE.js
// Copy this file to themes/<id>.js to add a new BATHCO_NATURE background theme
// (e.g. themes/ocean.js, themes/desert.js, themes/city.js), then add
// { id: '<id>', label: '<Human Label>' } to THEME_REGISTRY in BATHCO_NATURE.html.
// No other core file needs to change — the switcher loads themes by id via
// dynamic import() of /themes/<id>.js.
//
// RULES (do not break these):
// - Visuals only. Never fetch data, touch app pages, or read/write anything
//   outside the canvas + THREE objects you create here.
// - Only ever runs on the Dashboard ('home') page and the login screen — the
//   engine in BATHCO_NATURE.html handles that gating, not this file.
// - `build()` must be cheap to call repeatedly (theme can be switched at any
//   time) and `dispose()` must free every GPU resource you allocated, since
//   switching themes calls dispose() on the outgoing one.
export default {
  id: 'template',              // must match the filename (themes/<id>.js)
  label: 'Template (not registered — do not add to THEME_REGISTRY as-is)',

  // Called once per activation with the shared <canvas> element and the
  // already-loaded THREE module (imported once from /vendor/three.module.min.js
  // and reused across all themes). Build your renderer/scene/camera here.
  build(canvas, THREE) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 12;

    // ... add your lights/meshes/shaders to `scene` here ...

    return {
      renderer, scene, camera,

      // Called every animation frame with elapsed seconds since this theme
      // was built. Do NOT call renderer.render() yourself — the engine does
      // that right after calling update().
      update(elapsed) {},

      // Optional. Called on window resize with the new pixel size. If you
      // don't need custom resize behavior, omit this — the engine falls back
      // to updating camera.aspect + calling updateProjectionMatrix().
      resize(width, height) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      },

      // Called when this theme is switched away from, or the page/login
      // screen it was running on is left. Dispose every geometry/material/
      // texture/renderer you created in build() — the engine does not track
      // these for you.
      dispose() {
        renderer.dispose();
      },
    };
  },
};
