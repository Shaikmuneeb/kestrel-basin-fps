import * as THREE from 'three';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createRaider, createFirstPersonRig, makeBlast } from './actors.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { BUY_ITEMS, WEAPONS } from './weapons.js';

const $ = (id) => document.getElementById(id);
const mount = $('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
mount.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.06, 150); camera.rotation.order = 'YXZ'; scene.add(camera);
const world = createWorld(scene);
const audio = createAudio(); const hud = createHud();
const input = createInput(renderer.domElement, onLockChange);
const weaponRig = createFirstPersonRig(camera);
const mapCanvas = $('mapCanvas').getContext('2d');
const raycaster = new THREE.Raycaster(); raycaster.far = 90;
const params = new URLSearchParams(location.search); const shotMode = params.get('shot');
const random = (() => { let seed = 99173; return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; })();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

const player = {
  position: new THREE.Vector3(0, 0, 29), velocity: new THREE.Vector3(), yaw: 0, pitch: -0.035, jumpVelocity: 0,
  health: 100, armor: 50, cash: 800, grenades: 1, weapon: 'carbine', mag: 30, reserve: 90,
  alive: true, crouched: false, moving: false, sprinting: false, shotCooldown: 0, reloadTime: 0,
  footstep: 0, kills: 0,
};
const game = {
  phase: 'menu', round: 1, scoreBlue: 0, scoreRed: 0, time: 90, buyTime: 0, roundWins: 5,
  bomb: { status: 'carried', carrier: null, site: null, x: 0, z: 0, fuse: 0, defuseProgress: 0 },
  matchOver: false, paused: false,
};
const botNames = ['Sable', 'Rook', 'Vanta', 'Moth', 'Quarry'];
const bots = botNames.map((name, i) => {
  const bot = createRaider(scene, i, name);
  bot.hitMeshes = bot.group.children.filter((child) => child.userData.zone);
  bot.group.userData.actor = bot;
  scene.add(bot.group); return bot;
});
const bombMesh = new THREE.Group();
const bombBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: '#402a25', roughness: 0.5, metalness: 0.5 }));
bombBody.castShadow = true; bombMesh.add(bombBody);
const bombLight = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff5549' })); bombLight.position.set(0, 0.17, -0.13); bombMesh.add(bombLight); scene.add(bombMesh);
const staticObjects = world.occluders;
const tracers = []; const blasts = []; const grenades = [];
const FIXED_STEP = 1 / 60;
let lastFrame = performance.now(); let accumulator = 0; let frameCount = 0; let fireAnimation = 0;

function activeWeapon() { return WEAPONS[player.weapon] || WEAPONS.carbine; }
function totalAlive() { return bots.reduce((count, bot) => count + Number(bot.alive), 0); }
function setObjective() {
  if (game.bomb.status === 'planted') return `DEVICE ARMED / SITE ${game.bomb.site} · ${Math.ceil(game.bomb.fuse)} SEC TO DETONATION`;
  if (game.bomb.status === 'defused') return 'DEVICE DISARMED · BASIN SECURE';
  if (game.bomb.status === 'exploded') return 'BREACH COMPLETE · FLOODGATE LOST';
  if (totalAlive() === 0) return 'NO RAIDERS REMAINING · CLEAR THE BASIN';
  return 'DEFEND THE SITE · DENY THE PLANT';
}
function updateHud() {
  const weapon = activeWeapon(); const isNearBomb = game.bomb.status === 'planted' && Math.hypot(player.position.x - game.bomb.x, player.position.z - game.bomb.z) < 3.3;
  const interaction = isNearBomb ? `HOLD TO DEFUSE · ${Math.min(100, Math.round(game.bomb.defuseProgress / 5.2 * 100))}%` : '';
  hud.update({ health: player.health, armor: player.armor, cash: player.cash, mag: player.mag, reserve: player.reserve, weaponName: weapon.name, grenades: player.grenades,
    time: game.phase === 'buy' ? game.buyTime : game.time, round: game.round, scoreBlue: game.scoreBlue, scoreRed: game.scoreRed,
    objective: game.phase === 'buy' ? 'ARMORY OPEN · PREPARE TO DEPLOY' : setObjective(), bombPlanted: game.bomb.status === 'planted',
    spreadScale: clamp(1 + Math.hypot(player.velocity.x, player.velocity.z) * 0.17 + (player.crouched ? -0.2 : 0) + (input.aim ? -0.12 : 0), 0.78, 2.25), interaction,
    phase: game.phase,
  });
  hud.drawMap(mapCanvas, { x: player.position.x, z: player.position.z, yaw: player.yaw }, bots, game.bomb.status === 'planted' ? game.bomb : null, null);
}

function resetBots() {
  const spawns = [[-8, -30], [-4, -31], [0, -32], [4, -31], [8, -30]];
  bots.forEach((bot, i) => {
    const [x, z] = spawns[i]; bot.alive = true; bot.hp = 100; bot.group.visible = true; bot.group.position.set(x, 0, z);
    bot.lane = i % 2 === 0 ? 'A' : 'B'; bot.routeIndex = 0; bot.state = 'advance'; bot.cooldown = 0.9 + random() * 1.3; bot.plantProgress = 0; bot.movePhase = i * 1.4;
  });
  game.bomb = { status: 'carried', carrier: bots[0], site: null, x: 0, z: 0, fuse: 0, defuseProgress: 0 };
  bombMesh.visible = false;
}
function beginBuy() {
  game.phase = 'buy'; game.buyTime = 18; game.matchOver = false; player.alive = true; player.health = 100; player.position.set(0, 0, 29); player.velocity.set(0, 0, 0);
  resetBots(); hud.hideRound(); hud.nodes.start.hidden = true; hud.showBuy(true); updateHud();
}
function beginLive() {
  if (game.phase !== 'buy') return;
  game.phase = 'live'; game.time = 90; player.position.set(0, 0, 29); player.velocity.set(0, 0, 0); player.alive = true;
  hud.showBuy(false); hud.nodes.start.hidden = true; input.requestLock(); updateHud();
  hud.toast(`ROUND ${String(game.round).padStart(2, '0')} · HOLD THE BASIN`, 1800); audio.boot();
}
function endRound(winner, title, detail) {
  if (game.phase !== 'live') return;
  game.phase = 'round'; game.matchOver = game.scoreBlue + (winner === 'blue' ? 1 : 0) >= game.roundWins || game.scoreRed + (winner === 'red' ? 1 : 0) >= game.roundWins;
  if (winner === 'blue') { game.scoreBlue++; player.cash += 3200; }
  else { game.scoreRed++; player.cash += 1900; }
  player.cash += Math.min(600, player.kills * 100); player.kills = 0; input.exitLock();
  hud.showRound({ winner, title, detail, scoreBlue: game.scoreBlue, scoreRed: game.scoreRed, matchOver: game.matchOver }); updateHud();
}
function newMatch() {
  game.scoreBlue = 0; game.scoreRed = 0; game.round = 1; game.matchOver = false; player.cash = 800; player.armor = 50; player.weapon = 'carbine'; player.mag = 30; player.reserve = 90; player.grenades = 1;
  beginBuy();
}
function onLockChange(locked) {
  if (locked) { hud.nodes.start.hidden = true; game.paused = false; }
  else if (game.phase === 'live' && !shotMode) {
    hud.nodes.start.hidden = false;
    const title = hud.nodes.start.querySelector('h1'); const copy = hud.nodes.start.querySelector('.lead'); const button = $('startButton');
    if (title) title.innerHTML = 'Deployment<br>paused'; if (copy) copy.textContent = 'The basin is still live. Click resume when you are ready.'; if (button) button.textContent = 'Resume deployment';
    game.paused = true;
  }
}

function collidesAt(x, z, radius = 0.38) {
  if (x < -37.1 + radius || x > 37.1 - radius || z < -37 + radius || z > 37 - radius) return true;
  for (const box of world.colliders) {
    const closestX = clamp(x, box.minX, box.maxX); const closestZ = clamp(z, box.minZ, box.maxZ);
    if ((x - closestX) ** 2 + (z - closestZ) ** 2 < radius * radius) return true;
  }
  return false;
}
function cameraDirection() { const v = new THREE.Vector3(); camera.getWorldDirection(v); return v.normalize(); }
function makeTracer(start, end, color = '#ffd28b') {
  const geometry = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(geometry, material); scene.add(line); tracers.push({ line, time: 0.11, duration: 0.11 });
}
function findActor(mesh) { return mesh?.userData?.actor || mesh?.parent?.userData?.actor || null; }
function shotObjects() { const targets = []; for (const bot of bots) if (bot.alive) for (const child of bot.hitMeshes) targets.push(child); return staticObjects.concat(targets); }
function fireWeapon() {
  const weapon = activeWeapon();
  if (player.reloadTime > 0 || player.shotCooldown > 0 || !player.alive || game.phase !== 'live') return;
  if (player.mag <= 0) { audio.dry(); player.shotCooldown = 0.22; return; }
  player.mag--; player.shotCooldown = 1 / weapon.rate; fireAnimation = 0.08; weaponRig.userData.flash.visible = true; audio.shot(player.weapon);
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const movingPenalty = clamp(speed / 5.5, 0, 1) * (player.crouched ? 0.45 : 1.15);
  const spread = weapon.spread * (1 + movingPenalty + (player.jumpVelocity > 0.6 ? 1.6 : 0)) * (input.aim ? 0.45 : 1) * (player.crouched ? 0.72 : 1);
  const base = cameraDirection();
  let gotHit = false;
  for (let pellet = 0; pellet < weapon.pellets; pellet++) {
    const direction = base.clone().add(new THREE.Vector3((random() - 0.5) * spread, (random() - 0.5) * spread, (random() - 0.5) * spread)).normalize();
    raycaster.set(camera.position, direction); raycaster.far = 64;
    const hits = raycaster.intersectObjects(shotObjects(), false);
    const end = hits.length ? hits[0].point : camera.position.clone().addScaledVector(direction, 54);
    makeTracer(camera.position.clone().addScaledVector(direction, 0.7), end, pellet === 0 ? '#ffd895' : '#d59b61');
    if (!hits.length) continue;
    const hit = hits[0]; const bot = findActor(hit.object); if (!bot || !bot.alive) continue;
    const headshot = hit.object.userData.zone === 'head'; const damage = headshot ? weapon.head : weapon.damage;
    bot.hp -= damage; gotHit = true; audio[headshot ? 'headshot' : 'hit'](); hud.hitmarker();
    if (bot.hp <= 0) {
      bot.alive = false; bot.group.visible = false; player.cash += 300; player.kills++;
      hud.kill(`YOU  ▸  ${bot.name.toUpperCase()}${headshot ? '  /  HEADSHOT' : ''}`, 'blue'); hud.toast(headshot ? 'CLEAN HEADSHOT' : 'TARGET NEUTRALIZED', 850);
      if (totalAlive() === 0) endRound('blue', 'Basin held', 'All five raiders are down. The floodgate holds.');
    }
  }
  if (gotHit && weapon.pellets > 1) hud.hitmarker();
  player.pitch = clamp(player.pitch - weapon.recoil * (input.aim ? 0.58 : 1), -1.35, 1.35);
}
function reload() {
  const weapon = activeWeapon(); if (player.reloadTime > 0 || player.mag >= weapon.magSize || player.reserve <= 0 || game.phase !== 'live') return;
  player.reloadTime = weapon.reload; audio.reload(); hud.toast('RELOADING', 750);
}
function buy(id) {
  const item = BUY_ITEMS.find((entry) => entry.id === id); if (!item || game.phase !== 'buy') return;
  if (player.cash < item.price) { hud.toast('INSUFFICIENT CREDITS', 900); return; }
  if (item.kind === 'weapon') {
    const chosen = WEAPONS[id]; player.weapon = id; player.mag = chosen.magSize; player.reserve = chosen.reserve;
  } else if (item.kind === 'armor') { if (player.armor >= 100) { hud.toast('PLATE ALREADY FULL', 850); return; } player.armor = 100; }
  else if (item.kind === 'frag') { if (player.grenades >= 2) { hud.toast('MAXIMUM FRAGS CARRIED', 850); return; } player.grenades++; }
  else if (item.kind === 'ammo') { player.reserve = Math.min(player.reserve + 60, 180); }
  player.cash -= item.price; audio.beep(); updateHud(); hud.toast(`${item.title} PURCHASED`, 950);
}
function throwGrenade() {
  if (player.grenades <= 0 || game.phase !== 'live') return;
  const dir = cameraDirection(); const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), new THREE.MeshStandardMaterial({ color: '#b7a767', roughness: 0.7, metalness: 0.2, emissive: '#4b3c13', emissiveIntensity: 0.24 }));
  mesh.position.copy(camera.position).addScaledVector(dir, 0.8); mesh.castShadow = true; scene.add(mesh);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.027, 5, 8), new THREE.MeshBasicMaterial({ color: '#ffb456' })); ring.position.set(0, 0.02, 0); mesh.add(ring);
  grenades.push({ mesh, velocity: dir.multiplyScalar(13).add(new THREE.Vector3(0, 3.2, 0)), time: 2.1 }); player.grenades--; audio.beep(); updateHud();
}
function explode(position, radius = 6) {
  blasts.push(makeBlast(scene, position.clone(), '#ffb456')); audio.blast();
  for (const bot of bots) if (bot.alive) {
    const dist = bot.group.position.distanceTo(position); if (dist < radius) {
      bot.hp -= Math.round(78 * (1 - dist / radius));
      if (bot.hp <= 0) { bot.alive = false; bot.group.visible = false; player.cash += 300; player.kills++; hud.kill(`FRAG  ▸  ${bot.name.toUpperCase()}`, 'blue'); }
    }
  }
  if (player.position.distanceTo(position) < radius) hurtPlayer(36, null);
  if (totalAlive() === 0) endRound('blue', 'Basin held', 'A pressure frag cleared the final lane.');
}
function hurtPlayer(amount, attacker) {
  if (!player.alive || game.phase !== 'live') return;
  let remaining = amount;
  const absorbed = Math.min(player.armor, remaining * 0.56); player.armor -= absorbed; remaining -= absorbed;
  player.health -= remaining; hud.damageFlash(); audio.hit(); if (attacker) hud.kill(`${attacker.name.toUpperCase()}  ▸  YOU`, 'enemy');
  if (player.health <= 0) { player.health = 0; player.alive = false; endRound('red', 'Basin breached', 'The raiders overwhelmed the defense line.'); }
}

function routeFor(bot) {
  if (bot.lane === 'A') return [[-25, -27], [-25, -21], [-24, -16], [-21, -12], [-21, -9]];
  return [[25, -27], [25, -21], [24, -16], [21, -12], [21, -9]];
}
function seesPlayer(bot, distance) {
  if (distance > 31 || !player.alive) return false;
  const origin = bot.group.position.clone().add(new THREE.Vector3(0, 1.42, 0));
  const target = player.position.clone().add(new THREE.Vector3(0, player.crouched ? 0.95 : 1.35, 0));
  const dir = target.sub(origin); const dist = dir.length(); dir.normalize(); raycaster.set(origin, dir); raycaster.far = dist - 0.7;
  return raycaster.intersectObjects(staticObjects, false).length === 0;
}
function updateBots(dt) {
  if (game.phase !== 'live') return;
  for (const bot of bots) {
    if (!bot.alive) continue;
    const pos = bot.group.position; const dist = Math.hypot(player.position.x - pos.x, player.position.z - pos.z);
    const canSee = seesPlayer(bot, dist); bot.cooldown -= dt;
    let target = null;
    if (game.bomb.status === 'planted') {
      target = bot.plantedPost || new THREE.Vector3(bot.lane === 'A' ? -17 : 17, 0, -3);
      bot.state = 'hold';
    } else if (game.bomb.carrier === bot && game.bomb.status === 'carried') {
      const route = routeFor(bot); target = new THREE.Vector3(route[Math.min(bot.routeIndex, route.length - 1)][0], 0, route[Math.min(bot.routeIndex, route.length - 1)][1]);
      if (Math.hypot(pos.x - target.x, pos.z - target.z) < 2.1 && bot.routeIndex < route.length - 1) bot.routeIndex++;
      const site = world.sites.find((entry) => entry.id === bot.lane);
      if (Math.hypot(pos.x - site.x, pos.z - site.z) < site.radius + 0.7) {
        bot.plantProgress += dt; game.bomb.plantProgress = bot.plantProgress; bot.state = 'planting';
        target = new THREE.Vector3(site.x, 0, site.z);
        if (bot.plantProgress >= 3.9) {
          game.bomb.status = 'planted'; game.bomb.carrier = null; game.bomb.site = site.id; game.bomb.x = site.x + 0.8; game.bomb.z = site.z + 0.5; game.bomb.fuse = 34; game.bomb.defuseProgress = 0;
          bombMesh.visible = true; bombMesh.position.set(game.bomb.x, 0.16, game.bomb.z); bot.plantedPost = new THREE.Vector3(site.x + (bot.index % 2 ? -4 : 4), 0, site.z - 2); bot.state = 'hold';
          audio.plant(); hud.toast(`DEVICE ARMED / SITE ${site.id}`, 1800);
        }
      } else { bot.state = canSee ? 'engage' : 'advance'; }
    } else if (canSee) {
      bot.state = 'engage'; target = new THREE.Vector3(pos.x, 0, pos.z);
    } else if (game.bomb.status !== 'planted') {
      const route = routeFor(bot); target = new THREE.Vector3(route[Math.min(bot.routeIndex, route.length - 1)][0], 0, route[Math.min(bot.routeIndex, route.length - 1)][1]); bot.state = 'advance';
    }

    if (target && bot.state !== 'engage' && bot.state !== 'planting') {
      const dx = target.x - pos.x; const dz = target.z - pos.z; const distTo = Math.hypot(dx, dz);
      if (distTo > 0.4) {
        const speed = bot.speed * (bot.state === 'advance' ? 1 : 0.62); const nx = pos.x + dx / distTo * speed * dt; const nz = pos.z + dz / distTo * speed * dt;
        if (!collidesAt(nx, pos.z, 0.38)) pos.x = nx; else if (!collidesAt(pos.x + Math.sign(dx) * 0.5, pos.z, 0.38)) pos.x += Math.sign(dx) * 0.5;
        if (!collidesAt(pos.x, nz, 0.38)) pos.z = nz; else if (!collidesAt(pos.x, pos.z + Math.sign(dz) * 0.5, 0.38)) pos.z += Math.sign(dz) * 0.5;
        bot.group.rotation.y = Math.atan2(dx, -dz); bot.movePhase += dt * (4.1 + speed);
        bot.legs[0].rotation.x = Math.sin(bot.movePhase) * 0.42; bot.legs[1].rotation.x = -Math.sin(bot.movePhase) * 0.42;
        bot.arms[0].rotation.x = -Math.sin(bot.movePhase) * 0.22; bot.arms[1].rotation.x = Math.sin(bot.movePhase) * 0.22;
      } else { bot.legs.forEach((leg) => leg.rotation.x = 0); }
    }
    if (canSee) {
      bot.group.rotation.y = Math.atan2(player.position.x - pos.x, -(player.position.z - pos.z));
      if (bot.cooldown <= 0) {
        bot.cooldown = 0.92 + random() * 1.2; bot.muzzle.visible = true; setTimeout(() => { if (bot.muzzle) bot.muzzle.visible = false; }, 72);
        const from = pos.clone().add(new THREE.Vector3(0, 1.5, 0)); const targetPoint = player.position.clone().add(new THREE.Vector3(0, player.crouched ? 0.85 : 1.35, 0));
        const aimError = 0.3 + Math.max(0, dist - 9) * 0.017 + (player.moving ? 0.2 : 0);
        targetPoint.x += (random() - 0.5) * aimError; targetPoint.y += (random() - 0.5) * aimError; targetPoint.z += (random() - 0.5) * aimError;
        makeTracer(from, targetPoint, '#f3785b');
        if (random() < clamp(0.5 - dist * 0.012 - (player.sprinting ? 0.08 : 0), 0.12, 0.42)) hurtPlayer(7 + random() * 8, bot);
      }
    }
  }
}
function updatePlayer(dt) {
  if (game.phase !== 'live' || !player.alive || !input.locked) return;
  const look = input.takeLook(); player.yaw -= look.x * 0.0018; player.pitch = clamp(player.pitch - look.y * 0.0018, -1.42, 1.42);
  const keys = input.keys; player.crouched = keys.has('ControlLeft') || keys.has('ControlRight'); player.sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const strafe = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const yaw = player.yaw; let dx = Math.sin(yaw) * forward + Math.cos(yaw) * strafe; let dz = -Math.cos(yaw) * forward + Math.sin(yaw) * strafe;
  const mag = Math.hypot(dx, dz); if (mag > 0) { dx /= mag; dz /= mag; }
  player.moving = mag > 0; const topSpeed = player.crouched ? 1.85 : player.sprinting ? 5.7 : 3.55;
  const response = player.moving ? 1 - Math.exp(-dt * (player.crouched ? 13 : 9)) : 1 - Math.exp(-dt * 12);
  player.velocity.x = lerp(player.velocity.x, dx * topSpeed, response); player.velocity.z = lerp(player.velocity.z, dz * topSpeed, response);
  const nx = player.position.x + player.velocity.x * dt; const nz = player.position.z + player.velocity.z * dt;
  if (!collidesAt(nx, player.position.z, 0.39)) player.position.x = nx; else player.velocity.x = 0;
  if (!collidesAt(player.position.x, nz, 0.39)) player.position.z = nz; else player.velocity.z = 0;
  if (input.consume('Space') && player.position.y <= 0.01 && !player.crouched) player.jumpVelocity = 5.6;
  player.jumpVelocity -= 15.5 * dt; player.position.y = Math.max(0, player.position.y + player.jumpVelocity * dt); if (player.position.y === 0) player.jumpVelocity = 0;
  if (player.moving && Math.hypot(player.velocity.x, player.velocity.z) > 0.8) { player.footstep -= dt; if (player.footstep <= 0) { audio.footstep(); player.footstep = player.crouched ? 0.46 : player.sprinting ? 0.24 : 0.34; } }
  if (input.consume('KeyR')) reload();
  if (input.consume('KeyG')) throwGrenade();
  if (input.consume('KeyB')) { if (game.phase === 'buy') hud.showBuy(hud.nodes.buy.hidden); else hud.toast('ARMORY LOCKED DURING LIVE ROUND', 900); }
  if (input.consume('KeyQ')) { player.weapon = player.weapon === 'sidearm' ? 'carbine' : 'sidearm'; const w = activeWeapon(); player.mag = Math.min(player.mag, w.magSize); player.reserve = Math.min(player.reserve, w.reserve); hud.toast(`EQUIPPED ${w.short}`, 750); }
  if (input.consume('Digit1')) { player.weapon = 'carbine'; player.mag = Math.min(player.mag, 30); player.reserve = Math.min(player.reserve, 90); }
  if (input.consume('Digit2')) { player.weapon = 'sidearm'; player.mag = Math.min(player.mag, 15); player.reserve = Math.min(player.reserve, 60); }
  if (player.reloadTime > 0) { player.reloadTime = Math.max(0, player.reloadTime - dt); if (player.reloadTime === 0) { const need = activeWeapon().magSize - player.mag; const amount = Math.min(need, player.reserve); player.mag += amount; player.reserve -= amount; } }
  if (player.shotCooldown > 0) player.shotCooldown -= dt;
  if (input.fire) fireWeapon();
  const bombDistance = Math.hypot(player.position.x - game.bomb.x, player.position.z - game.bomb.z);
  if (game.bomb.status === 'planted' && bombDistance < 3.3 && (keys.has('KeyE') || keys.has('KeyF'))) {
    game.bomb.defuseProgress += dt;
    if (game.bomb.defuseProgress >= 5.2) { game.bomb.status = 'defused'; audio.defuse(); endRound('blue', 'Device defused', 'The breach charge is safe. The basin is still yours.'); }
  } else if (game.bomb.status === 'planted') game.bomb.defuseProgress = Math.max(0, game.bomb.defuseProgress - dt * 1.3);
  const near = game.bomb.status === 'planted' && bombDistance < 3.3;
  player.position.y = Math.max(0, player.position.y);
}
function updateObjective(dt) {
  if (game.phase !== 'live') return;
  game.time = Math.max(0, game.time - dt);
  if (game.bomb.status === 'planted') {
    game.bomb.fuse -= dt;
    if (Math.floor(game.bomb.fuse) !== Math.floor(game.bomb.fuse + dt)) audio.beep();
    bombLight.material.color.set(game.bomb.fuse < 10 ? '#ff3029' : '#ff5549'); bombLight.material.emissive?.set?.('#ff3029');
    bombLight.scale.setScalar(1 + 0.18 * Math.sin(performance.now() / 90));
    if (game.bomb.fuse <= 0) { game.bomb.status = 'exploded'; explode(new THREE.Vector3(game.bomb.x, 0, game.bomb.z), 12); endRound('red', 'Breach complete', 'The device detonated before the defense could reach it.'); }
  } else if (game.time <= 0) endRound('blue', 'Time held', 'The raiders ran out of time. The basin remains secure.');
  if (game.phase === 'live' && totalAlive() === 0) endRound('blue', 'Basin held', 'Every raider has been neutralized.');
}
function updateWorldEffects(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) { const item = tracers[i]; item.time -= dt; item.line.material.opacity = Math.max(0, item.time / item.duration); if (item.time <= 0) { scene.remove(item.line); item.line.geometry.dispose(); item.line.material.dispose(); tracers.splice(i, 1); } }
  for (let i = grenades.length - 1; i >= 0; i--) {
    const item = grenades[i]; item.time -= dt; item.velocity.y -= 8.8 * dt;
    const next = item.mesh.position.clone().addScaledVector(item.velocity, dt);
    if (collidesAt(next.x, next.z, 0.19) || next.y < 0.18) { item.velocity.multiplyScalar(0.42); item.velocity.y = Math.max(1.2, Math.abs(item.velocity.y) * 0.38); }
    else item.mesh.position.copy(next);
    item.mesh.rotation.x += dt * 5; item.mesh.rotation.z += dt * 3;
    if (item.time <= 0) { explode(item.mesh.position.clone(), 6.8); scene.remove(item.mesh); item.mesh.geometry.dispose(); item.mesh.material.dispose(); grenades.splice(i, 1); }
  }
  for (let i = blasts.length - 1; i >= 0; i--) {
    const blast = blasts[i]; blast.time += dt; const t = blast.time / 0.82; blast.group.scale.setScalar(0.25 + t * 5.2); blast.glow.material.opacity = Math.max(0, 0.75 * (1 - t)); blast.ring.material.opacity = Math.max(0, 1 - t); if (t >= 1) { scene.remove(blast.group); blasts.splice(i, 1); }
  }
  if (game.bomb.status === 'carried' && game.bomb.carrier) { const p = game.bomb.carrier.group.position; game.bomb.x = p.x; game.bomb.z = p.z; }
}
function syncCamera(dt) {
  const eye = player.crouched ? 1.08 : 1.62; camera.position.set(player.position.x, player.position.y + eye, player.position.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  const targetFov = input.aim ? (player.weapon === 'marksman' ? 43 : 58) : 74; camera.fov = lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 10)); camera.updateProjectionMatrix();
  const moving = Math.hypot(player.velocity.x, player.velocity.z); const bob = player.moving ? Math.sin(performance.now() / (player.sprinting ? 70 : 105)) * 0.016 * Math.min(1.2, moving) : 0;
  weaponRig.position.y = -0.32 + bob - (player.crouched ? 0.075 : 0); weaponRig.position.x = 0.4 + (player.moving ? Math.sin(performance.now() / 220) * 0.009 : 0);
  weaponRig.position.z = -0.56 + (fireAnimation > 0 ? Math.sin((fireAnimation / 0.08) * Math.PI) * 0.075 : 0);
  fireAnimation = Math.max(0, fireAnimation - dt); if (fireAnimation <= 0) weaponRig.userData.flash.visible = false;
}
function update(dt) {
  if (game.phase === 'buy') {
    game.buyTime = Math.max(0, game.buyTime - dt); if (game.buyTime <= 0) beginLive();
  }
  if (game.phase === 'live') { updatePlayer(dt); updateBots(dt); updateObjective(dt); }
  updateWorldEffects(dt); syncCamera(dt); updateHud();
}
function animate(now) {
  requestAnimationFrame(animate); const elapsed = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now; frameCount++;
  if (!shotMode) {
    accumulator += elapsed; let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 6) { update(FIXED_STEP); accumulator -= FIXED_STEP; steps++; }
  }
  else { syncCamera(1 / 60); updateHud(); }
  renderer.render(scene, camera);
  if (shotMode && frameCount > 3) window.__shotReady = true;
}

function captureSetup(mode) {
  hud.nodes.start.hidden = true; game.phase = 'live'; game.time = 48; game.round = 6; game.scoreBlue = 3; game.scoreRed = 2; player.health = 74; player.armor = 38; player.cash = 3150;
  resetBots();
  const positions = mode === 'plant'
    ? [[29, -8], [14, -13], [31, -12], [11, -2], [18, -17]]
    : mode === 'site'
      ? [[-21, -10], [-25, -15], [-17, -16], [-27, -6], [-12, -13]]
      : [[-10, 12], [7, 8], [-15, 2], [14, -3], [0, 4]];
  bots.forEach((bot, i) => { bot.group.position.set(positions[i][0], 0, positions[i][1]); bot.lane = i % 2 ? 'B' : 'A'; bot.state = i < 2 ? 'engage' : 'advance'; bot.group.rotation.y = mode === 'site' ? 0.3 : Math.PI; });
  if (mode === 'cover') bots[0].muzzle.visible = true;
  player.weapon = mode === 'site' ? 'marksman' : mode === 'plant' ? 'smg' : 'carbine'; const current = activeWeapon(); player.mag = Math.min(current.magSize, mode === 'plant' ? 18 : current.magSize); player.reserve = current.reserve;
  if (mode === 'site') { player.position.set(-12, 0, -3); player.yaw = 0.91; player.pitch = -0.035; }
  else if (mode === 'plant') { player.position.set(20.3, 0, -6); player.yaw = -0.54; player.pitch = -0.43; game.bomb.status = 'planted'; game.bomb.carrier = null; game.bomb.site = 'B'; game.bomb.x = 21.8; game.bomb.z = -8.5; game.bomb.fuse = 19; bombMesh.visible = true; bombMesh.position.set(game.bomb.x, 0.17, game.bomb.z); }
  else { player.position.set(0, 0, 27); player.yaw = 0.02; player.pitch = -0.045; }
  if (mode === 'armory') { game.phase = 'buy'; game.buyTime = 16; hud.showBuy(true); }
  else hud.showBuy(false);
  window.__shotReady = false;
}
function enterFromMenu() {
  audio.boot();
  if (game.paused) { hud.nodes.start.hidden = true; input.requestLock(); game.paused = false; return; }
  game.round = 1; beginBuy();
  const title = hud.nodes.start.querySelector('h1'); const copy = hud.nodes.start.querySelector('.lead'); const button = $('startButton');
  if (title) title.innerHTML = 'Breakwater<br>Protocol'; if (copy) copy.textContent = 'The tide wall is compromised. Five intruders are moving on the desalination works. Hold the basin, control the lanes, and stop the device before the floodgate fails.'; if (button) button.textContent = 'Deploy to basin';
}
window.addEventListener('keydown', (event) => {
  if (game.phase !== 'buy' || event.repeat) return;
  if (event.code === 'KeyB') { input.consume('KeyB'); hud.showBuy(hud.nodes.buy.hidden); event.preventDefault(); }
  else if (event.code === 'Escape') { input.consume('Escape'); hud.showBuy(false); event.preventDefault(); }
  else if (event.code === 'Enter') { input.consume('Enter'); beginLive(); event.preventDefault(); }
});
$('scene').addEventListener('click', () => { if (game.phase === 'live' && !input.locked) input.requestLock(); });
$('startButton').addEventListener('click', enterFromMenu);
$('buyClose').addEventListener('click', () => { if (game.phase === 'buy') beginLive(); else hud.showBuy(false); });
$('continueButton').addEventListener('click', () => {
  if (game.matchOver) { newMatch(); return; }
  game.round++; beginBuy();
});
hud.makeShop(buy);
if (shotMode) captureSetup(shotMode);
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
window.addEventListener('beforeunload', () => input.dispose());
updateHud(); requestAnimationFrame((time) => { lastFrame = time; animate(time); });
