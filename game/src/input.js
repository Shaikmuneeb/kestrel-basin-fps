export function createInput(canvas, onLockChange = () => {}) {
  const keys = new Set(); const pressed = new Set();
  let locked = false; let fire = false; let aim = false; let dx = 0; let dy = 0;
  const noDefault = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  function keyDown(event) { if (noDefault.has(event.code)) event.preventDefault(); if (!event.repeat) pressed.add(event.code); keys.add(event.code); }
  function keyUp(event) { keys.delete(event.code); }
  function move(event) { if (locked) { dx += event.movementX; dy += event.movementY; } }
  function down(event) { if (event.button === 0) fire = true; if (event.button === 2) { aim = true; event.preventDefault(); } }
  function up(event) { if (event.button === 0) fire = false; if (event.button === 2) aim = false; }
  function lockChange() { locked = document.pointerLockElement === canvas; if (!locked) { fire = false; aim = false; keys.clear(); } onLockChange(locked); }
  function onBlur() { keys.clear(); fire = false; aim = false; }
  window.addEventListener('keydown', keyDown, { passive: false }); window.addEventListener('keyup', keyUp);
  window.addEventListener('mousemove', move); window.addEventListener('mousedown', down); window.addEventListener('mouseup', up);
  window.addEventListener('blur', onBlur); window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', lockChange);
  return {
    get keys() { return keys; }, get fire() { return fire && locked; }, get aim() { return aim; }, get locked() { return locked; },
    consume(code) { const value = pressed.has(code); pressed.delete(code); return value; },
    takeLook() { const result = { x: dx, y: dy }; dx = 0; dy = 0; return result; },
    requestLock() { if (!locked) canvas.requestPointerLock?.(); }, exitLock() { if (locked) document.exitPointerLock?.(); },
    dispose() { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('mousemove', move); window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); window.removeEventListener('blur', onBlur); document.removeEventListener('pointerlockchange', lockChange); },
  };
}
