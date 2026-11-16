import * as THREE from 'three';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 12, 10);
const capsuleMat = (color, roughness = 0.72, metalness = 0.12) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

export function createRaider(scene, index, name) {
  const group = new THREE.Group(); group.name = name;
  const dark = capsuleMat(index % 2 ? '#392f2b' : '#3e3830', 0.78, 0.08);
  const armor = capsuleMat(index % 2 ? '#a04d37' : '#88573b', 0.68, 0.14);
  const accent = capsuleMat(index % 2 ? '#d08a51' : '#c4a15e', 0.62, 0.24);
  const visor = new THREE.MeshStandardMaterial({ color: '#ff785d', emissive: '#7a1c12', emissiveIntensity: 0.65, roughness: 0.26, metalness: 0.5 });
  const gunMat = capsuleMat('#202728', 0.32, 0.75);
  function part(geometry, material, pos, scale, zone = null) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...pos); mesh.scale.set(...scale); mesh.castShadow = true; mesh.receiveShadow = true;
    if (zone) mesh.userData.zone = zone; group.add(mesh); return mesh;
  }
  const torso = part(boxGeo, armor, [0, 1.05, 0], [0.62, 0.76, 0.34], 'body');
  part(boxGeo, dark, [0, 1.13, -0.195], [0.48, 0.36, 0.035]);
  part(boxGeo, accent, [0, 0.91, -0.205], [0.34, 0.045, 0.035]);
  part(boxGeo, dark, [0, 1.53, 0.01], [0.5, 0.17, 0.38]);
  part(sphereGeo, dark, [0, 1.77, 0], [0.22, 0.23, 0.22]);
  part(boxGeo, visor, [0, 1.79, -0.18], [0.24, 0.07, 0.055], 'head');
  part(boxGeo, accent, [-0.19, 1.39, -0.03], [0.13, 0.12, 0.38]); part(boxGeo, accent, [0.19, 1.39, -0.03], [0.13, 0.12, 0.38]);
  const leftArm = part(boxGeo, dark, [-0.43, 1.0, -0.05], [0.18, 0.57, 0.21]); const rightArm = part(boxGeo, dark, [0.43, 1.0, -0.05], [0.18, 0.57, 0.21]);
  const leftLeg = part(boxGeo, dark, [-0.18, 0.38, 0], [0.23, 0.66, 0.26]); const rightLeg = part(boxGeo, dark, [0.18, 0.38, 0], [0.23, 0.66, 0.26]);
  part(boxGeo, armor, [-0.18, 0.18, -0.035], [0.25, 0.14, 0.37]); part(boxGeo, armor, [0.18, 0.18, -0.035], [0.25, 0.14, 0.37]);
  part(boxGeo, gunMat, [0.11, 1.05, -0.43], [0.14, 0.12, 0.54]);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb456' })); muzzle.position.set(0.11, 1.05, -0.73); muzzle.visible = false; group.add(muzzle);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), new THREE.MeshBasicMaterial({ color: '#030707', transparent: true, opacity: 0.32, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; group.add(shadow);
  const bot = { index, name, group, torso, legs: [leftLeg, rightLeg], arms: [leftArm, rightArm], muzzle, alive: true, hp: 100, speed: 2.0 + (index % 3) * 0.18, cooldown: 1.2 + index * 0.3, state: 'advance', lane: index % 2 === 0 ? 'A' : 'B', movePhase: index * 0.8 };
  torso.userData.actor = bot;
  group.userData.actor = bot;
  return bot;
}

export function createFirstPersonRig(camera) {
  const rig = new THREE.Group(); rig.position.set(0.4, -0.35, -0.58); rig.scale.setScalar(0.62); camera.add(rig);
  const metal = new THREE.MeshStandardMaterial({ color: '#4b5d53', metalness: 0.72, roughness: 0.34, emissive: '#101b16', emissiveIntensity: 0.12 });
  const weaponLight = new THREE.PointLight('#e6b273', 0.58, 3.2, 1.7); weaponLight.position.set(-0.18, 0.26, 0.12); rig.add(weaponLight);
  const receiver = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: '#56685c', metalness: 0.56, roughness: 0.48, emissive: '#101a14', emissiveIntensity: 0.1 })); receiver.position.set(0.02, 0.02, -0.31); receiver.scale.set(0.17, 0.16, 0.53); receiver.castShadow = true; rig.add(receiver);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.48, 12), metal); barrel.rotation.x = Math.PI / 2; barrel.position.set(0.02, 0.03, -0.71); rig.add(barrel);
  const stock = new THREE.Mesh(boxGeo, metal); stock.position.set(0.02, -0.01, 0.03); stock.scale.set(0.14, 0.11, 0.31); rig.add(stock);
  const grip = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: '#a36b45', roughness: 0.8 })); grip.position.set(0.06, -0.12, -0.18); grip.rotation.x = -0.2; grip.scale.set(0.085, 0.17, 0.12); rig.add(grip);
  const sight = new THREE.Mesh(boxGeo, metal); sight.position.set(0.02, 0.13, -0.29); sight.scale.set(0.1, 0.1, 0.11); rig.add(sight);
  const optic = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 12), new THREE.MeshStandardMaterial({ color: '#213331', metalness: 0.76, roughness: 0.18 })); optic.rotation.x = Math.PI / 2; optic.position.set(0.02, 0.185, -0.29); rig.add(optic);
  const handMat = new THREE.MeshStandardMaterial({ color: '#b38061', roughness: 0.92 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: '#344c48', roughness: 0.9 });
  const sleeve = new THREE.Mesh(boxGeo, sleeveMat); sleeve.position.set(-0.15, -0.105, -0.15); sleeve.scale.set(0.19, 0.13, 0.38); rig.add(sleeve);
  const hand = new THREE.Mesh(sphereGeo, handMat); hand.position.set(-0.105, -0.08, -0.29); hand.scale.set(0.11, 0.075, 0.13); rig.add(hand);
  const sleeve2 = new THREE.Mesh(boxGeo, sleeveMat); sleeve2.position.set(0.11, -0.2, -0.34); sleeve2.scale.set(0.18, 0.12, 0.32); rig.add(sleeve2);
  const flash = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 8), new THREE.MeshBasicMaterial({ color: '#ffe1a0', transparent: true, opacity: 0.78 })); flash.rotation.x = -Math.PI / 2; flash.position.set(0.02, 0.03, -0.96); flash.visible = false; rig.add(flash);
  rig.userData.flash = flash;
  return rig;
}

export function makeBlast(scene, position, color = '#ffb456') {
  const group = new THREE.Group(); group.position.copy(position); scene.add(group);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 })); group.add(glow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffe4ad', transparent: true, opacity: 0.9 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; group.add(ring);
  return { group, glow, ring, time: 0 };
}
