// MWEDONDAY — WebAudio chiptune SFX
// Square-wave envelope synthesis for 8/16-bit blips. No samples needed.

export class Chiptune {
  constructor() {
    this.enabled = true;
    this._ctx = null;
  }

  _ensure() {
    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this._ctx = new Ctx();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  // Play a single tone: {freq, dur, type, vol, attack, release}
  _tone(at, { freq = 440, dur = 0.08, type = 'square', vol = 0.18, attack = 0.005, release = 0.04, sweep = null }) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (sweep) {
      osc.frequency.exponentialRampToValueAtTime(sweep, at + dur);
    }
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol, at + attack);
    gain.gain.setValueAtTime(vol, at + Math.max(attack, dur - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  // Play a sequence of tones, sequenced from "now"
  _sequence(notes) {
    if (!this.enabled) return;
    const ctx = this._ensure();
    if (!ctx) return;
    let t = ctx.currentTime + 0.005;
    for (const note of notes) {
      const dur = note.dur ?? 0.08;
      this._tone(t, note);
      t += note.gap ?? dur;
    }
  }

  // Public SFX --------------------------------------------------------------
  tick()         { this._sequence([{ freq: 880, dur: 0.05, vol: 0.12 }]); }
  tickFinal()    { this._sequence([{ freq: 1320, dur: 0.09, vol: 0.18 }]); }

  workStart() {
    this._sequence([
      { freq: 523, dur: 0.07, vol: 0.18 },           // C5
      { freq: 659, dur: 0.07, vol: 0.18 },           // E5
      { freq: 880, dur: 0.14, vol: 0.22, sweep: 988 }, // A5 → B5
    ]);
  }

  restStart() {
    this._sequence([
      { freq: 659, dur: 0.08, vol: 0.16 },
      { freq: 523, dur: 0.08, vol: 0.16 },
      { freq: 440, dur: 0.14, vol: 0.18, sweep: 392 },
    ]);
  }

  roundClear() {
    this._sequence([
      { freq: 523, dur: 0.06, vol: 0.18 },
      { freq: 659, dur: 0.06, vol: 0.18 },
      { freq: 784, dur: 0.06, vol: 0.18 },
      { freq: 1047, dur: 0.18, vol: 0.22, sweep: 1175 },
    ]);
  }

  buttonTap()    { this._sequence([{ freq: 660, dur: 0.04, vol: 0.10, type: 'triangle' }]); }

  // Ladder navigation — ascending blip for UP, descending for DOWN,
  // stable double-tap for AGAIN.
  ladderUp()   { this._sequence([
    { freq: 523, dur: 0.05, vol: 0.16 },
    { freq: 698, dur: 0.05, vol: 0.16 },
    { freq: 880, dur: 0.10, vol: 0.18, sweep: 988 },
  ]); }
  ladderDown() { this._sequence([
    { freq: 698, dur: 0.05, vol: 0.16 },
    { freq: 523, dur: 0.05, vol: 0.16 },
    { freq: 392, dur: 0.10, vol: 0.18, sweep: 330 },
  ]); }
  ladderStay() { this._sequence([
    { freq: 587, dur: 0.05, vol: 0.14, type: 'triangle' },
    { freq: 587, dur: 0.08, vol: 0.16, type: 'triangle' },
  ]); }

  modeSwitch()   { this._sequence([
    { freq: 440, dur: 0.04, vol: 0.12, type: 'triangle' },
    { freq: 880, dur: 0.06, vol: 0.12, type: 'triangle' },
  ]); }

  pauseSfx()     { this._sequence([
    { freq: 392, dur: 0.06, vol: 0.14 },
    { freq: 330, dur: 0.10, vol: 0.14 },
  ]); }
  resumeSfx()    { this._sequence([
    { freq: 392, dur: 0.06, vol: 0.14 },
    { freq: 523, dur: 0.10, vol: 0.14 },
  ]); }

  // 90s arcade-style victory jingle: dotted rhythm, sweep up
  finishFanfare() {
    this._sequence([
      { freq: 523, dur: 0.10, vol: 0.20 },  // C5
      { freq: 659, dur: 0.10, vol: 0.20 },  // E5
      { freq: 784, dur: 0.10, vol: 0.20 },  // G5
      { freq: 1047, dur: 0.18, vol: 0.22 }, // C6
      { freq: 988, dur: 0.06, vol: 0.18 },  // B5
      { freq: 1047, dur: 0.28, vol: 0.24, sweep: 1568 }, // C6 → G6
    ]);
  }

  fail() {
    this._sequence([
      { freq: 440, dur: 0.10, vol: 0.18 },
      { freq: 330, dur: 0.18, vol: 0.18, sweep: 220 },
    ]);
  }

  warmupBeep() {
    this._sequence([{ freq: 600, dur: 0.06, vol: 0.14, type: 'triangle' }]);
  }
}
