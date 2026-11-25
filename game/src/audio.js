// Sound: every effect is synthesised with WebAudio — no audio files, no
// network. The game runs silent until the first user gesture creates the
// AudioContext, which is how browsers require it.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(g).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur + 0.02);
  }

  function noise(dur, gain, lowpass) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(c.destination);
    src.start();
  }

  return {
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (muted) this.stopMusic();
      else this.startMusic();
    },
    isMuted() {
      return muted;
    },
    chop() {
      noise(0.07, 0.25, 1800);
      tone(180, 0.06, 'square', 0.08, 90);
    },
    pickup() {
      tone(520, 0.07, 'sine', 0.12, 660);
    },
    place() {
      tone(340, 0.08, 'triangle', 0.12, 260);
    },
    ding() {
      tone(880, 0.25, 'sine', 0.14);
      tone(1320, 0.3, 'sine', 0.08);
    },
    coin() {
      tone(988, 0.09, 'square', 0.07);
      setTimeout(() => tone(1319, 0.14, 'square', 0.07), 80);
    },
    reject() {
      tone(160, 0.16, 'sawtooth', 0.1, 110);
    },
    burn() {
      noise(0.4, 0.12, 500);
      tone(220, 0.35, 'sawtooth', 0.06, 90);
    },
    expire() {
      tone(392, 0.18, 'triangle', 0.12, 330);
      tone(311, 0.24, 'triangle', 0.12, 262);
    },
    /** A tiny bassline loop: two bars, quiet, so the kitchen hums. */
    startMusic() {
      if (muted || musicTimer || !ensure()) return;
      const notes = [110, 0, 131, 0, 147, 0, 131, 0, 110, 0, 98, 0, 110, 0, 165, 0];
      let step = 0;
      musicTimer = setInterval(() => {
        const f = notes[step % notes.length];
        if (f) tone(f, 0.22, 'triangle', 0.035);
        step += 1;
      }, 240);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
