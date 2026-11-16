export function createAudio() {
  let context = null; let master = null;
  function boot() {
    if (context) { if (context.state === 'suspended') context.resume(); return; }
    const AudioContext = window.AudioContext || window.webkitAudioContext; if (!AudioContext) return;
    context = new AudioContext(); master = context.createGain(); master.gain.value = 0.24; master.connect(context.destination);
  }
  function tone({ frequency = 220, end = 90, duration = 0.12, type = 'sine', gain = 0.25, delay = 0 } = {}) {
    if (!context || !master) return;
    const start = context.currentTime + delay; const osc = context.createOscillator(); const amp = context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, start); osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), start + duration);
    amp.gain.setValueAtTime(gain, start); amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(amp); amp.connect(master); osc.start(start); osc.stop(start + duration + 0.01);
  }
  function noise(duration = 0.12, level = 0.14, cutoff = 1000) {
    if (!context || !master) return;
    const frames = Math.max(1, Math.floor(context.sampleRate * duration)); const buffer = context.createBuffer(1, frames, context.sampleRate); const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = context.createBufferSource(); source.buffer = buffer; const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cutoff;
    const amp = context.createGain(); amp.gain.value = level; source.connect(filter); filter.connect(amp); amp.connect(master); source.start();
  }
  return {
    boot,
    shot(id = 'carbine') {
      const params = id === 'marksman' ? [128, 42, 0.22] : id === 'scatter' ? [88, 32, 0.19] : id === 'smg' ? [182, 72, 0.085] : id === 'sidearm' ? [150, 52, 0.13] : [166, 55, 0.11];
      tone({ frequency: params[0], end: params[1], duration: params[2], type: 'triangle', gain: 0.32 }); noise(id === 'marksman' ? 0.18 : 0.1, 0.16, id === 'marksman' ? 850 : 1450);
    },
    hit() { tone({ frequency: 220, end: 90, duration: 0.12, type: 'sine', gain: 0.18 }); },
    headshot() { tone({ frequency: 960, end: 540, duration: 0.11, type: 'triangle', gain: 0.22 }); tone({ frequency: 1440, end: 1300, duration: 0.07, gain: 0.1, delay: 0.035 }); },
    reload() { tone({ frequency: 280, end: 190, duration: 0.12, type: 'square', gain: 0.09 }); tone({ frequency: 390, end: 230, duration: 0.16, type: 'triangle', gain: 0.08, delay: 0.26 }); },
    plant() { tone({ frequency: 400, end: 700, duration: 0.34, gain: 0.18 }); },
    beep() { tone({ frequency: 840, end: 840, duration: 0.045, type: 'square', gain: 0.08 }); },
    defuse() { tone({ frequency: 630, end: 1100, duration: 0.6, gain: 0.18 }); },
    blast() { noise(0.8, 0.35, 320); tone({ frequency: 70, end: 22, duration: 0.75, type: 'sawtooth', gain: 0.4 }); },
    footstep() { noise(0.035, 0.07, 320); },
    dry() { tone({ frequency: 380, end: 340, duration: 0.035, type: 'square', gain: 0.05 }); },
  };
}
