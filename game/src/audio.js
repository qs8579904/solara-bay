// Sound, all synthesized with WebAudio: no audio files, no network. An engine hum
// that follows the speed, a two-tone siren while the SBPD chases, short blips for
// pickups and crashes, little melodies for winning and losing, and a quiet bass loop.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineFilter = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let muted = false;
  let musicOn = false;
  let musicStep = 0;
  let musicNext = 0;
  const bassLine = [55, 0, 55, 65.41, 0, 55, 49, 58.27];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass, gain follows the throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Siren: a square wave that flips between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function beep(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(master);
    src.start(t);
  }

  function melody(notes, noteDur, type, vol) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + 0.02;
    notes.forEach((freq, i) => {
      const t = t0 + i * noteDur;
      const osc = ctx.createOscillator();
      osc.type = type || 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + noteDur * 0.95);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + noteDur);
    });
  }

  function update(dt, speedNorm, inCar) {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    // Engine hum: pitch with speed, idle when parked, silent on foot.
    if (engineGain) {
      const target = inCar ? 0.05 + speedNorm * 0.075 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      const freq = 52 + speedNorm * 130;
      engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(freq * 1.5, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(280 + speedNorm * 900, ctx.currentTime, 0.1);
    }
    // Siren flip-flop.
    if (sirenOsc && sirenGain.gain.value > 0.001) {
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.02);
      }
    }
    // Bass loop: eight steps, one note per step, very quiet.
    if (musicOn && !muted) {
      if (musicNext <= 0) musicNext = ctx.currentTime + 0.05;
      while (musicNext < ctx.currentTime + 0.25) {
        const freq = bassLine[musicStep % bassLine.length];
        if (freq > 0) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.07, musicNext);
          g.gain.exponentialRampToValueAtTime(0.001, musicNext + 0.32);
          osc.connect(g);
          g.connect(master);
          osc.start(musicNext);
          osc.stop(musicNext + 0.35);
        }
        musicStep += 1;
        musicNext += 0.34;
      }
    }
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    setMusic(on) {
      musicOn = on;
    },
    update,
    siren(on) {
      if (!ensure()) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0, ctx.currentTime, 0.1);
    },
    pickup() {
      beep(880, 0.09, 'sine', 0.22);
      setTimeout(() => beep(1320, 0.12, 'sine', 0.2), 70);
    },
    crash(strength) {
      noiseBurst(0.18, 0.12 + 0.3 * strength);
      beep(90, 0.16, 'sine', 0.2, 45);
    },
    thud() {
      beep(140, 0.1, 'sine', 0.22, 70);
    },
    door() {
      beep(220, 0.06, 'square', 0.1);
    },
    spray() {
      noiseBurst(0.5, 0.06);
      beep(660, 0.2, 'sine', 0.12, 990);
    },
    success() {
      melody([523.25, 659.25, 783.99, 1046.5], 0.14, 'triangle', 0.24);
    },
    fail() {
      melody([392, 329.63, 261.63, 196], 0.18, 'triangle', 0.22);
    },
  };
}
