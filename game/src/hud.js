import { BUY_ITEMS } from './weapons.js';

export function createHud() {
  const byId = (id) => document.getElementById(id);
  const nodes = {
    health: byId('healthValue'), healthBar: byId('healthBar'), armor: byId('armorValue'), armorBar: byId('armorBar'), cash: byId('cashValue'),
    ammo: byId('ammoCurrent'), reserve: byId('ammoReserve'), weapon: byId('weaponName'), grenade: byId('grenadeCount'),
    timer: byId('roundTimer'), objective: byId('objectiveText'), banner: byId('objectiveBanner'), round: byId('roundLabel'), scoreBlue: byId('scoreBlue'), scoreRed: byId('scoreRed'),
    start: byId('startOverlay'), buy: byId('buyOverlay'), roundOverlay: byId('roundOverlay'), buyGrid: byId('buyGrid'), buyCash: byId('buyCash'),
    toast: byId('toast'), killfeed: byId('killfeed'), hit: byId('hitmarker'), damage: byId('damageFlash'), interaction: byId('interaction'), crosshair: byId('crosshair'),
  };
  let toastTimer = 0; let hitTimer = 0; let damageTimer = 0;
  function makeShop(onPurchase) {
    nodes.buyGrid.replaceChildren();
    for (const [index, item] of BUY_ITEMS.entries()) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'buy-item';
      button.innerHTML = `<span><strong>${item.title}</strong><small>${item.subtitle}</small></span><b>$${item.price.toLocaleString()}</b>`;
      button.addEventListener('click', () => onPurchase(item.id)); nodes.buyGrid.appendChild(button);
      window.addEventListener('keydown', (event) => { if (event.code === `Digit${index + 1}` && !nodes.buy.hidden) onPurchase(item.id); });
    }
  }
  function formatTime(seconds) { const value = Math.max(0, Math.ceil(seconds)); return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
  return {
    nodes, makeShop,
    update(state) {
      nodes.health.textContent = Math.max(0, Math.ceil(state.health)); nodes.healthBar.style.width = `${Math.max(0, state.health)}%`;
      nodes.armor.textContent = Math.max(0, Math.ceil(state.armor)); nodes.armorBar.style.width = `${Math.max(0, state.armor)}%`;
      nodes.cash.textContent = `$${Math.max(0, state.cash).toLocaleString()}`;
      nodes.ammo.textContent = state.mag; nodes.reserve.textContent = `/ ${state.reserve}`;
      nodes.weapon.textContent = state.weaponName; nodes.grenade.textContent = `FRAG × ${state.grenades}`;
      nodes.timer.textContent = formatTime(state.time); nodes.round.textContent = `ROUND ${String(state.round).padStart(2, '0')}`;
      nodes.scoreBlue.textContent = state.scoreBlue; nodes.scoreRed.textContent = state.scoreRed;
      nodes.buyCash.textContent = `$${state.cash.toLocaleString()}`;
      nodes.banner.classList.toggle('danger', state.bombPlanted);
      nodes.objective.textContent = state.objective;
      nodes.roundOverlay.querySelector('#scoreBlueEnd').textContent = state.scoreBlue;
      nodes.roundOverlay.querySelector('#scoreRedEnd').textContent = state.scoreRed;
      nodes.crosshair.style.transform = `translate(-50%,-50%) scale(${state.spreadScale})`;
      nodes.interaction.classList.toggle('show', Boolean(state.interaction)); nodes.interaction.innerHTML = state.interaction ? `<span class="keycap">E</span>${state.interaction}` : '';
      if (state.phase === 'live') { nodes.start.hidden = true; nodes.buy.hidden = true; }
    },
    hideStart() { nodes.start.hidden = true; },
    showBuy(value) { nodes.buy.hidden = !value; },
    showRound({ winner, title, detail, scoreBlue, scoreRed, matchOver }) {
      nodes.roundOverlay.hidden = false;
      nodes.roundOverlay.querySelector('#roundResult').textContent = matchOver ? 'MATCH COMPLETE' : (winner === 'blue' ? 'BASIN TEAM WINS ROUND' : 'RAIDERS WIN ROUND');
      nodes.roundOverlay.querySelector('#roundTitle').textContent = title;
      nodes.roundOverlay.querySelector('#roundDetail').textContent = detail;
      nodes.roundOverlay.querySelector('#scoreBlueEnd').textContent = scoreBlue;
      nodes.roundOverlay.querySelector('#scoreRedEnd').textContent = scoreRed;
      nodes.roundOverlay.querySelector('#continueButton').innerHTML = matchOver ? 'Run it back <span>↻</span>' : 'Prepare next round <span>→</span>';
    },
    hideRound() { nodes.roundOverlay.hidden = true; },
    toast(text, ms = 1500) { nodes.toast.textContent = text; nodes.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => nodes.toast.classList.remove('show'), ms); },
    hitmarker() { nodes.hit.classList.add('on'); clearTimeout(hitTimer); hitTimer = setTimeout(() => nodes.hit.classList.remove('on'), 130); },
    damageFlash() { nodes.damage.classList.add('show'); clearTimeout(damageTimer); damageTimer = setTimeout(() => nodes.damage.classList.remove('show'), 140); },
    kill(text, team = 'enemy') { const row = document.createElement('div'); row.className = 'kill'; row.style.borderColor = team === 'blue' ? '#68d7cc' : '#ffb456'; row.textContent = text; nodes.killfeed.prepend(row); setTimeout(() => row.remove(), 5200); },
    drawMap(ctx, player, bots, bomb, smoke) {
      const w = ctx.canvas.width; const h = ctx.canvas.height; const scale = w / 82;
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = 'rgba(18,39,40,.94)'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(198,222,197,.19)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(i * w / 8, 0); ctx.lineTo(i * w / 8, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * h / 8); ctx.lineTo(w, i * h / 8); ctx.stroke(); }
      ctx.fillStyle = 'rgba(158,185,159,.22)'; ctx.fillRect(26 * scale, 18 * scale, 30 * scale, 18 * scale);
      ctx.fillStyle = 'rgba(255,180,86,.42)'; ctx.beginPath(); ctx.arc(((-21 + 41) * scale), ((-9 + 41) * scale), 5.2 * scale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(196,243,107,.42)'; ctx.beginPath(); ctx.arc(((21 + 41) * scale), ((-9 + 41) * scale), 5.2 * scale, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffcc88'; ctx.fillText('A', 20 * scale, 32 * scale); ctx.fillStyle = '#d4ff91'; ctx.fillText('B', 62 * scale, 32 * scale);
      const px = (player.x + 41) * scale; const pz = (player.z + 41) * scale; ctx.save(); ctx.translate(px, pz); ctx.rotate(player.yaw); ctx.fillStyle = '#68d7cc'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#ff765d'; for (const bot of bots) if (bot.alive) { ctx.beginPath(); ctx.arc((bot.group.position.x + 41) * scale, (bot.group.position.z + 41) * scale, 3.5, 0, Math.PI * 2); ctx.fill(); }
      if (bomb) { ctx.strokeStyle = '#ff675c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((bomb.x + 41) * scale, (bomb.z + 41) * scale, 7, 0, Math.PI * 2); ctx.stroke(); }
      if (smoke) { ctx.fillStyle = 'rgba(202,220,207,.2)'; ctx.beginPath(); ctx.arc((smoke.x + 41) * scale, (smoke.z + 41) * scale, 6 * scale, 0, Math.PI * 2); ctx.fill(); }
    },
  };
}
