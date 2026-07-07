// themes/kim_forest.js
// "Kim Forest" background theme — extracted from the visual/3D layer of
// Desktop\BATHCO_VERSION_1\kimcord.md. Visuals only: the noise-displaced
// terrain, stones, shader water plane, drifting particles and gold ring are
// kept; kimcord.md's fake KPI numbers, transaction table, and stub download
// buttons (alert()-based) were NOT ported — those belong to app pages, not a
// background theme (see FINAL_BUILD.md Phase 1 rule 3).
//
// Ported from three.js r128 (kimcord.md's CDN build) to this project's
// installed three 0.185 (served at /vendor/three.module.min.js): the only
// API changes needed were `renderer.outputEncoding = THREE.sRGBEncoding`
// -> `renderer.outputColorSpace = THREE.SRGBColorSpace`, and light
// intensities re-tuned for three's physically-based lighting (default since
// r155; kimcord.md's original values were authored for the older,
// non-physical default and rendered near-black under 0.185).
//
// Particle/terrain/stone counts reduced from kimcord.md's originals
// (FINAL_BUILD_2.md Task 1 item 5, 8GB RAM target) - see the constants below.
function makeNoise() {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  return {
    simplex3(x, y, z) {
      const F3 = 1 / 3, G3 = 1 / 6;
      const s = (x + y + z) * F3;
      const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
      const t = (i + j + k) * G3;
      const X0 = i - t, Y0 = j - t, Z0 = k - t;
      const x0 = x - X0, y0 = y - Y0, z0 = z - Z0;
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      let n0, n1, n2, n3;
      let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * grad(perm[ii + perm[jj + perm[kk]]], x0, y0, z0));
      let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * grad(perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]], x1, y1, z1));
      let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * grad(perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]], x2, y2, z2));
      let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      n3 = t3 < 0 ? 0 : (t3 *= t3, t3 * t3 * grad(perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]], x3, y3, z3));
      return 32 * (n0 + n1 + n2 + n3);
    },
  };
}

// Fragment shaders declare highp (not the GLSL ES default mediump) to match
// vertex shaders' implicit highp default for the shared uTime uniform -
// mismatched precision between stages is a WebGL shader-link error, not just
// a warning (found via Task 3's bug-hunt pass, 2026-07-05).
const waterVertexShader = `
  varying vec2 vUv;
  varying float vElevation;
  uniform float uTime;
  void main(){
    vUv = uv;
    vec3 pos = position;
    float wave1 = sin(pos.x * 1.5 + uTime * 0.8) * 0.15;
    float wave2 = sin(pos.y * 2.3 + uTime * 0.6) * 0.1;
    float wave3 = sin((pos.x + pos.y) * 0.8 + uTime * 0.4) * 0.08;
    pos.z += wave1 + wave2 + wave3;
    vElevation = pos.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
const waterFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  varying float vElevation;
  uniform float uTime;
  uniform vec3 uColorDeep;
  uniform vec3 uColorSurface;
  uniform vec3 uAccent;
  void main(){
    float mixStrength = (vElevation + 0.25) * 1.8;
    vec3 color = mix(uColorDeep, uColorSurface, clamp(mixStrength, 0.0, 1.0));
    float shimmer = sin(vUv.x * 40.0 + uTime * 1.5) * sin(vUv.y * 30.0 + uTime * 1.2) * 0.03;
    color += shimmer;
    float edge = 1.0 - smoothstep(0.3, 0.5, length(vUv - 0.5));
    color += uAccent * edge * 0.15;
    gl_FragColor = vec4(color, 0.85);
  }
`;
const particleVertexShader = `
  attribute float size;
  varying float vAlpha;
  uniform float uTime;
  void main(){
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (180.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = 0.3 + 0.3 * sin(uTime + position.x * 0.5);
  }
`;
const particleFragmentShader = `
  precision highp float;
  varying float vAlpha;
  uniform vec3 uColor;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    if(d > 0.5) discard;
    float glow = 1.0 - smoothstep(0.0, 0.5, d);
    gl_FragColor = vec4(uColor, vAlpha * glow * 0.6);
  }
`;

export default {
  id: 'kim_forest',
  label: 'Kim Forest',

  build(canvas, THREE) {
    const Noise = makeNoise();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f0a);
    scene.fog = new THREE.FogExp2(0x0a0f0a, 0.035);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 5, 14);
    camera.lookAt(0, 0, 0);

    // Light intensities re-tuned (see file header) for three 0.185's
    // physically-based defaults; kimcord.md's original values are in comments.
    const hemiLight = new THREE.HemisphereLight(0x8a9a8a, 0x1a2015, 1.4); // was 0.6
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xfff8e7, 3.2); // was 1.2
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);
    const accentLight = new THREE.PointLight(0xc8a45c, 2.2, 30); // was 0.8
    accentLight.position.set(-8, 6, -5);
    scene.add(accentLight);

    /* Terrain */
    const terrainGeo = new THREE.PlaneGeometry(60, 60, 96, 96); // was 128x128
    const terrainPos = terrainGeo.attributes.position;
    for (let i = 0; i < terrainPos.count; i++) {
      const x = terrainPos.getX(i);
      const y = terrainPos.getY(i);
      let h = Noise.simplex3(x * 0.06, y * 0.06, 0) * 2.2;
      h += Noise.simplex3(x * 0.15, y * 0.15, 1) * 0.6;
      h += Noise.simplex3(x * 0.4, y * 0.4, 2) * 0.15;
      const d = Math.sqrt(x * x + y * y);
      const centerMask = Math.min(1, Math.max(0, (d - 4) / 6));
      h *= centerMask;
      terrainPos.setZ(i, h);
    }
    terrainGeo.computeVertexNormals();
    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x1a241a, roughness: 0.92, metalness: 0.05, flatShading: false });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    scene.add(terrain);

    /* Stones */
    const stoneCount = 50; // was 80
    const stoneGeo = new THREE.DodecahedronGeometry(1, 0);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3a4038, roughness: 0.85, metalness: 0.15, flatShading: true });
    const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, stoneCount);
    const dummy = new THREE.Object3D();
    const stoneData = [];
    for (let i = 0; i < stoneCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 20;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      let y = Noise.simplex3(x * 0.06, -z * 0.06, 0) * 2.2 + Noise.simplex3(x * 0.15, -z * 0.15, 1) * 0.6;
      const d = Math.sqrt(x * x + z * z);
      const centerMask = Math.min(1, Math.max(0, (d - 4) / 6));
      y *= centerMask;
      y += 0.3;
      dummy.position.set(x, y, z);
      const scale = 0.3 + Math.random() * 1.2;
      dummy.scale.set(scale, scale * (0.6 + Math.random() * 0.6), scale);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.updateMatrix();
      stones.setMatrixAt(i, dummy.matrix);
      stoneData.push({ rotSpeed: (Math.random() - 0.5) * 0.002 });
    }
    stones.castShadow = true;
    stones.receiveShadow = true;
    scene.add(stones);

    /* Water */
    const waterUniforms = {
      uTime: { value: 0 },
      uColorDeep: { value: new THREE.Color(0x0a1518) },
      uColorSurface: { value: new THREE.Color(0x1a2e2e) },
      uAccent: { value: new THREE.Color(0xc8a45c) },
    };
    const waterGeo = new THREE.PlaneGeometry(12, 12, 64, 64);
    const waterMat = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: waterUniforms,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.2;
    scene.add(water);

    /* Particles */
    const particleCount = 700; // was 1200
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleData = [];
    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 50;
      const y = Math.random() * 12;
      const z = (Math.random() - 0.5) * 50;
      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;
      particleSizes[i] = 1.5 + Math.random() * 3;
      particleData.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 0.01,
        vy: (Math.random() - 0.5) * 0.005 + 0.003,
        vz: (Math.random() - 0.5) * 0.01,
        phase: Math.random() * Math.PI * 2,
      });
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    const particleUniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x8a9a7a) },
    };
    const particleMat = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: particleUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    /* Ring */
    const ringGeo = new THREE.TorusGeometry(7, 0.15, 8, 64);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xc8a45c, roughness: 0.3, metalness: 0.8, emissive: 0xc8a45c, emissiveIntensity: 0.15 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    scene.add(ring);

    /* Mouse / device-tilt parallax, scoped to this theme instance */
    let mouseX = 0, mouseY = 0;
    let camX = 0, camY = 5, camZ = 14;
    const onMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onDeviceOrientation = (e) => {
      if (e.gamma !== null) {
        mouseX = Math.max(-1, Math.min(1, e.gamma / 45));
        mouseY = Math.max(-1, Math.min(1, e.beta / 45));
      }
    };
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    }

    return {
      renderer, scene, camera,
      update(elapsed) {
        waterUniforms.uTime.value = elapsed;
        particleUniforms.uTime.value = elapsed;

        const posAttr = particleGeo.attributes.position;
        for (let i = 0; i < particleCount; i++) {
          const d = particleData[i];
          d.x += d.vx + Math.sin(elapsed * 0.3 + d.phase) * 0.002;
          d.y += d.vy;
          d.z += d.vz + Math.cos(elapsed * 0.2 + d.phase) * 0.002;
          if (d.y > 14) d.y = 0;
          if (Math.abs(d.x) > 25) d.x *= -0.9;
          if (Math.abs(d.z) > 25) d.z *= -0.9;
          posAttr.setXYZ(i, d.x, d.y, d.z);
        }
        posAttr.needsUpdate = true;

        ring.rotation.z = elapsed * 0.05;

        const targetCamX = mouseX * 3;
        const targetCamY = 5 + mouseY * 1.5;
        const targetCamZ = 14 - Math.abs(mouseX) * 0.5;
        camX += (targetCamX - camX) * 0.04;
        camY += (targetCamY - camY) * 0.04;
        camZ += (targetCamZ - camZ) * 0.04;
        camera.position.set(camX, camY, camZ);
        camera.lookAt(0, 0, 0);

        for (let i = 0; i < stoneCount; i++) {
          stones.getMatrixAt(i, dummy.matrix);
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
          dummy.rotation.y += stoneData[i].rotSpeed;
          dummy.updateMatrix();
          stones.setMatrixAt(i, dummy.matrix);
        }
        stones.instanceMatrix.needsUpdate = true;
      },
      dispose() {
        document.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('deviceorientation', onDeviceOrientation);
        renderer.dispose();
        terrainGeo.dispose(); terrainMat.dispose();
        stoneGeo.dispose(); stoneMat.dispose();
        waterGeo.dispose(); waterMat.dispose();
        particleGeo.dispose(); particleMat.dispose();
        ringGeo.dispose(); ringMat.dispose();
      },
    };
  },
};
