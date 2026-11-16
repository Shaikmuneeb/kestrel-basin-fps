import * as THREE from 'three';

const PALETTE = { night: '#10191c', concrete: '#465957', pale: '#a9b2a2', deep: '#223334', sea: '#183f43', rust: '#b75d40', signal: '#c4f36b', amber: '#ffb456', glass: '#385b59' };

export function createWorld(scene) {
  const colliders = []; const occluders = []; const sites = [];
  const mats = {};
  const mat = (name, color, roughness = 0.82, metalness = 0.08) => mats[name] || (mats[name] = new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  const addBox = (x, y, z, w, h, d, color, opts = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(`${color}-${opts.roughness ?? 0.82}`, color, opts.roughness ?? 0.82, opts.metalness ?? 0.06));
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = opts.shadow !== false; mesh.receiveShadow = true;
    scene.add(mesh);
    if (opts.solid !== false) {
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: y + h });
      occluders.push(mesh);
    }
    return mesh;
  };
  const addCylinder = (x, y, z, rTop, rBottom, h, color, segments = 12, opts = {}) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat(`${color}-${opts.roughness ?? 0.82}`, color, opts.roughness ?? 0.82, opts.metalness ?? 0.12));
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    if (opts.solid) { colliders.push({ minX: x - rBottom, maxX: x + rBottom, minZ: z - rBottom, maxZ: z + rBottom, height: y + h }); occluders.push(mesh); }
    return mesh;
  };
  const addLine = (a, b, color, radius = 0.04) => {
    const start = new THREE.Vector3(...a); const end = new THREE.Vector3(...b); const dir = new THREE.Vector3().subVectors(end, start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 7), mat(`${color}-line`, color, 0.45, 0.35));
    mesh.position.copy(start).add(end).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); scene.add(mesh); return mesh;
  };
  const addLabel = (text, x, y, z, color = '#c4f36b') => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'rgba(7,16,17,.90)'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = color; ctx.font = '700 48px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 0.92), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
    board.position.set(x, y, z); scene.add(board); return board;
  };

  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 4; skyCanvas.height = 512;
  const skyContext = skyCanvas.getContext('2d'); const skyGradient = skyContext.createLinearGradient(0, 0, 0, 512);
  skyGradient.addColorStop(0, '#182d3b'); skyGradient.addColorStop(0.48, '#375b65'); skyGradient.addColorStop(0.78, '#bb714e'); skyGradient.addColorStop(1, '#f0b26b');
  skyContext.fillStyle = skyGradient; skyContext.fillRect(0, 0, 4, 512);
  const skyTexture = new THREE.CanvasTexture(skyCanvas); skyTexture.colorSpace = THREE.SRGBColorSpace;
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(95, 40, 28), new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false, toneMapped: false })); skyDome.renderOrder = -10; scene.add(skyDome);
  scene.background = new THREE.Color('#45554f');
  scene.fog = new THREE.FogExp2('#8c8a73', 0.012);
  scene.add(new THREE.HemisphereLight('#e6e8d1', '#233530', 2.0));
  const sun = new THREE.DirectionalLight('#ffd39a', 3.0); sun.position.set(-28, 42, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536); sun.shadow.camera.left = -48; sun.shadow.camera.right = 48; sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48; sun.shadow.bias = -0.0005; scene.add(sun);
  const fill = new THREE.DirectionalLight('#67aaa2', 0.8); fill.position.set(30, 18, -28); scene.add(fill);
  const sunDisk = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 14), new THREE.MeshBasicMaterial({ color: '#f3b878' })); sunDisk.position.set(-18, 22, -52); scene.add(sunDisk);
  for (const [x, height, scale] of [[-32, 15, 1], [-11, 10, 0.78], [24, 13, 0.9], [39, 17, 1.1]]) {
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(13 * scale, height, 6), new THREE.MeshStandardMaterial({ color: '#354745', roughness: 1 })); ridge.position.set(x, height * 0.46, -51); ridge.castShadow = false; ridge.receiveShadow = true; scene.add(ridge);
  }

  const terrain = document.createElement('canvas'); terrain.width = 512; terrain.height = 512;
  const terrainContext = terrain.getContext('2d'); terrainContext.fillStyle = '#586960'; terrainContext.fillRect(0, 0, 512, 512);
  let grainSeed = 4127; const grain = () => { grainSeed = (grainSeed * 16807) % 2147483647; return (grainSeed - 1) / 2147483646; };
  for (let i = 0; i < 2600; i++) {
    const shade = grain() > 0.5 ? 'rgba(218,207,171,.08)' : 'rgba(12,26,22,.10)';
    terrainContext.fillStyle = shade; terrainContext.beginPath(); terrainContext.ellipse(grain() * 512, grain() * 512, 1 + grain() * 5, 1 + grain() * 3, grain() * 3, 0, Math.PI * 2); terrainContext.fill();
  }
  terrainContext.strokeStyle = 'rgba(205,198,165,.09)'; terrainContext.lineWidth = 1;
  for (let i = 0; i <= 512; i += 256) { terrainContext.beginPath(); terrainContext.moveTo(i, 0); terrainContext.lineTo(i, 512); terrainContext.stroke(); terrainContext.beginPath(); terrainContext.moveTo(0, i); terrainContext.lineTo(512, i); terrainContext.stroke(); }
  const groundTexture = new THREE.CanvasTexture(terrain); groundTexture.wrapS = THREE.RepeatWrapping; groundTexture.wrapT = THREE.RepeatWrapping; groundTexture.repeat.set(8, 8); groundTexture.colorSpace = THREE.SRGBColorSpace;
  groundTexture.anisotropy = 4;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(82, 82), new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.98 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; scene.add(ground);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(12, 84), new THREE.MeshStandardMaterial({ color: '#143c42', roughness: 0.28, metalness: 0.28, transparent: true, opacity: 0.94 }));
  water.rotation.x = -Math.PI / 2; water.position.set(-39.2, 0.015, 0); scene.add(water);
  const waterline = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 84), mat('waterline', '#8fc8aa', 0.24, 0.35)); waterline.rotation.x = -Math.PI / 2; waterline.position.set(-33.1, 0.025, 0); scene.add(waterline);

  // Floodwall perimeter and the two narrow approaches from the raider's east and west gates.
  addBox(0, 0, -39, 80, 8, 1.4, '#293a39'); addBox(0, 0, 39, 80, 7, 1.3, '#293a39');
  addBox(-39.2, 0, 0, 1.5, 8, 80, '#2a3a39'); addBox(39.2, 0, 0, 1.5, 8, 80, '#2a3a39');
  for (let i = -3; i <= 3; i++) { addBox(i * 10, 7.9, -39, 0.2, 0.2, 1.8, PALETTE.pale, { solid: false, shadow: false }); }
  // Lower floodgate at the north end, with yellow-and-black hazard ribs.
  addBox(-11, 0, -35.4, 9, 5, 1.1, '#485a55'); addBox(11, 0, -35.4, 9, 5, 1.1, '#485a55');
  addBox(0, 0, -35.4, 10, 0.55, 1.2, '#9b6845');
  for (let i = -4; i <= 4; i++) addBox(i * 1.05, 1.2, -34.65, 0.16, 2.7, 0.22, i % 2 ? '#d2ad63' : '#283432', { solid: false });
  addLabel('KESTREL / FLOODGATE 04', 0, 5.7, -34.35, '#ffb456');

  // Two raised control sites, with distinctly colored perimeter paint and sightline cover.
  function makeSite(id, x, z, color) {
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.08, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.24 }));
    disk.position.set(x, 0.07, z); scene.add(disk);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.85, 0.08, 6, 48), mat(`ring-${color}`, color, 0.38, 0.2)); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.13, z); scene.add(ring);
    const site = { id, x, z, radius: 4.7, marker: ring }; sites.push(site);
    addLabel(`${id} / ${id === 'A' ? 'SALT YARD' : 'PUMP HALL'}`, x, 3.2, z - 3.5, color);
    return site;
  }
  makeSite('A', -21, -9, '#ffb456'); makeSite('B', 21, -9, '#c4f36b');
  // Salt-yard lane: low cover keeps long angles readable but not effortless.
  addBox(-27, 0, -15, 4.5, 1.5, 3.4, '#788474'); addBox(-14, 0, -17, 3.7, 1.0, 3.6, '#a47c59');
  addBox(-25, 0, -3, 3.3, 1.35, 3.3, '#536560'); addBox(-10, 0, -9, 4.4, 1.0, 2.5, '#8d775e');
  // Pump-hall approach: tank farm and a concrete elbow create a short, close-range route.
  addBox(28, 0, -15, 4.2, 1.25, 3.3, '#728076'); addBox(14, 0, -17, 4.2, 1.15, 3.1, '#596b63');
  addBox(26, 0, -3, 3.4, 1.55, 3.5, '#967452'); addBox(10, 0, -8, 3.8, 0.95, 2.7, '#746b57');
  // Central splitter and broken pump works. Cover silhouettes carve three route choices.
  addBox(0, 0, -9.4, 8, 2.45, 1.25, '#5f7169'); addBox(0, 0, -1.9, 3.5, 1.0, 3.5, '#8b8065');
  addBox(-5.8, 0, -19.5, 2.2, 3.2, 2.3, '#365452'); addBox(5.8, 0, -19.5, 2.2, 3.2, 2.3, '#365452');
  addBox(-1.7, 0, -25.5, 4.7, 2.0, 2.3, '#7a705b'); addBox(3.9, 0, -29.2, 4.1, 1.45, 2.1, '#a17855');
  // Retired desalination tanks, supports, pipes and catwalks add a distinctive silhouette.
  for (const [x, z, h] of [[-31, 7, 7], [-29, 20, 5], [31, 8, 8], [29, 22, 5], [-9, 13, 4], [10, 13, 4]]) {
    addCylinder(x, 0, z, 1.8, 2.2, h, '#56655b', 12, { solid: true, metalness: 0.2 });
    addCylinder(x, h - 0.4, z, 2.05, 2.05, 0.4, '#a9865c', 12, { solid: false });
    addCylinder(x, 1.4, z, 2.24, 2.24, 0.12, '#d1a35d', 16, { solid: false });
  }
  addBox(-18, 0, 12, 10, 0.32, 0.5, '#a98456', { solid: false });
  addBox(17, 0, 12, 10, 0.32, 0.5, '#a98456', { solid: false });
  // Mid catwalk and industrial gantry: visually anchors the central lane without sealing it.
  addBox(0, 5.1, 9, 25, 0.34, 2.0, '#435a55', { solid: false });
  addBox(0, 5.1, 10, 25, 0.12, 0.16, '#c19558', { solid: false });
  for (const x of [-11.6, 11.6]) { addBox(x, 0, 9.1, 0.45, 5.1, 0.45, '#53645e'); addBox(x, 0, 10.8, 0.45, 5.1, 0.45, '#53645e'); }
  for (let x = -10; x <= 10; x += 2.5) addBox(x, 5.48, 9.9, 0.1, 0.5, 2.0, '#a48657', { solid: false });
  // Yard cargo, small barriers, signal poles and painted path chevrons.
  for (const [x, z, c] of [[-7, 20, '#536966'], [6, 22, '#805f48'], [-17, 24, '#7a5e49'], [18, 25, '#52675f']]) {
    addBox(x, 0, z, 4.2, 1.25, 2.6, c); addBox(x - 1.8, 1.25, z, 0.12, 0.42, 2.65, '#d5ac68', { solid: false });
  }
  for (const [x, z, col] of [[-7, 3, '#7d9b7b'], [8, -2, '#7d9b7b'], [-26, -27, '#bd754e'], [26, -27, '#bd754e']]) {
    addBox(x, 0, z, 0.22, 4.0, 0.22, '#334745', { solid: false });
    addBox(x, 3.05, z, 0.8, 0.32, 0.8, col, { solid: false, roughness: 0.4, metalness: 0.1 });
    const light = new THREE.PointLight(col, 0.8, 8, 2); light.position.set(x, 3.4, z); scene.add(light);
  }
  // Warm runway markers, set on the floor as paint rather than HUD decoration.
  for (const z of [18, 12, 6, 0, -6, -12, -18, -24, -30]) {
    for (const x of [-4.2, 4.2]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 1.25), mat('lane-stripe', '#bca26f', 0.9, 0)); stripe.position.set(x, 0.035, z); scene.add(stripe);
    }
  }
  // Cross-basin service pipes and cable spans.
  for (const z of [-27, -4, 19]) {
    addLine([-31, 7.2, z], [31, 7.2, z], '#3c514c', 0.12);
    for (const x of [-23, -12, 0, 12, 23]) addLine([x, 7.1, z], [x, 5.3, z], '#687a6c', 0.045);
  }
  // A collapsed seawall and two ramps create low-profile rotation routes.
  for (let i = 0; i < 7; i++) {
    const x = -31 + i * 2.6;
    addBox(x, 0, 30 + (i % 2) * 0.7, 2.2, 0.9 + (i % 3) * 0.35, 1.0, i % 2 ? '#746b5b' : '#596761');
  }
  // Safe spawns are open and distinct; borders sit outside the playable volume.
  addBox(-35.8, 0, 28, 0.4, 2.8, 5, '#314847'); addBox(35.8, 0, 28, 0.4, 2.8, 5, '#314847');
  addLabel('BASIN TEAM / SPAWN', 0, 2.9, 32, '#68d7cc');
  // Small atmospheric lights in the site wells.
  for (const s of sites) {
    const light = new THREE.PointLight(s.id === 'A' ? '#ffad65' : '#b5ed71', 1.05, 13, 2); light.position.set(s.x, 4.5, s.z); scene.add(light);
    for (const side of [-1, 1]) {
      const pole = addCylinder(s.x + side * 5.4, 0, s.z, 0.11, 0.15, 4.1, '#435650', 8, { solid: false });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), new THREE.MeshBasicMaterial({ color: s.id === 'A' ? '#ffb456' : '#c4f36b' })); lamp.position.set(s.x + side * 5.4, 4.2, s.z); scene.add(lamp); pole.userData.lamp = lamp;
    }
  }
  return { colliders, occluders, sites, addBox, addCylinder, palette: PALETTE };
}
