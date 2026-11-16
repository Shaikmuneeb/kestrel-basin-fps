export const WEAPONS = {
  sidearm: { id: 'sidearm', name: 'K-9 / COMPACT', short: 'K-9', price: 0, magSize: 15, reserve: 60, damage: 25, head: 68, rate: 3.2, reload: 1.25, spread: 0.013, recoil: 0.012, pellets: 1, automatic: false },
  carbine: { id: 'carbine', name: 'R-17 / SERVICE CARBINE', short: 'R-17', price: 0, magSize: 30, reserve: 90, damage: 24, head: 82, rate: 8.8, reload: 1.65, spread: 0.012, recoil: 0.0064, pellets: 1, automatic: true },
  smg: { id: 'smg', name: 'S-4 / DECK SMG', short: 'S-4', price: 950, magSize: 32, reserve: 96, damage: 19, head: 65, rate: 12.5, reload: 1.45, spread: 0.021, recoil: 0.0048, pellets: 1, automatic: true },
  marksman: { id: 'marksman', name: 'M-22 / TIDEGLASS', short: 'M-22', price: 2450, magSize: 10, reserve: 40, damage: 56, head: 135, rate: 2.0, reload: 1.9, spread: 0.004, recoil: 0.018, pellets: 1, automatic: false },
  scatter: { id: 'scatter', name: 'B-12 / BREAKER', short: 'B-12', price: 1850, magSize: 7, reserve: 35, damage: 13, head: 17, rate: 1.1, reload: 2.0, spread: 0.075, recoil: 0.028, pellets: 8, automatic: false },
};
export const BUY_ITEMS = [
  { id: 'smg', title: 'S-4 / DECK SMG', subtitle: '32 rounds · close lanes', price: 950, kind: 'weapon' },
  { id: 'marksman', title: 'M-22 / TIDEGLASS', subtitle: '10 rounds · long sightlines', price: 2450, kind: 'weapon' },
  { id: 'scatter', title: 'B-12 / BREAKER', subtitle: '8-pellet · room clearing', price: 1850, kind: 'weapon' },
  { id: 'armor', title: 'CERAMIC PLATE', subtitle: 'Restore armor to 100', price: 650, kind: 'armor' },
  { id: 'frag', title: 'FRAG / PRESSURE', subtitle: 'One fragmentation charge', price: 400, kind: 'frag' },
  { id: 'ammo', title: 'AMMUNITION', subtitle: 'Refill reserve magazines', price: 300, kind: 'ammo' },
];
