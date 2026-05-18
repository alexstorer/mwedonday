// MWEDONDAY — Monkey sprite + speech system
// Pixel-art monkey rendered as inline SVG. Frames defined as text grids so
// they're easy to tweak without an image editor.

const COLORS = {
  '.': null,         // transparent
  B: '#7a4823',      // body brown (lighter, friendlier)
  b: '#4a2810',      // body outline
  H: '#c79264',      // ear-inner / body highlight (pinkish tan)
  f: '#f5c89b',      // face tan (lighter)
  F: '#d49a6a',      // face shadow
  e: '#1a0a2e',      // eye outline / pupil
  I: '#fff8e1',      // eye white
  S: '#ffd23f',      // eye sparkle (banana)
  m: '#1a0a2e',      // mouth line
  M: '#7a1d2e',      // open mouth (deep red)
  T: '#ff8aa3',      // tongue
  w: '#fff8e1',      // teeth (cream)
  p: '#ff85a8',      // pink cheek blush
  y: '#ffd23f',      // banana
  Y: '#d49000',      // banana shadow
  g: '#3a7a2c',      // banana stem
};

// 16x16 chibi monkey. The key tell: rounded ears stick OUT of the head
// silhouette on cols 0-2 and 13-15, so it reads as a monkey not a bear.

const FRAMES = {
  idleA: `
................
bb..........bb..
bHb..bbBBb..bHb.
bHB.bBBBBBBb.BHb
bHBbBBBBBBBBBBHb
bbBBffffffffBBbb
.bBffIeIfIeIfBb.
.bBffIeIfIeIfBb.
.bBfFFFFFFFFFFBb
.bBpFFmwmwmFFpBb
..bbFFFmmmFFFbb.
...bbBBBBBBbb...
..bBBBBBBBBBBb..
..bBHBBBBBBHBBb.
...bbBBBBBBbb...
....BB....BB....`,

  idleB: `
................
bb..........bb..
bHb..bBBBb..bHb.
bHB.bBBBBBBb.BHb
bHBbBBBBBBBBBBHb
bbBBffffffffBBbb
.bBffIeIfIeIfBb.
.bBffIeIfIeIfBb.
.bBfFFFFFFFFFFBb
.bBpFFmwmwmFFpBb
..bbFFFmmmFFFbb.
...bbBBBBBBbb...
...bBBBBBBBBb...
..bBHBBBBBBHBBb.
...bbBBBBBBbb...
....BB....BB....`,

  blink: `
................
bb..........bb..
bHb..bbBBb..bHb.
bHB.bBBBBBBb.BHb
bHBbBBBBBBBBBBHb
bbBBffffffffBBbb
.bBffeeefeeefBb.
.bBffffffffffBb.
.bBfFFFFFFFFFFBb
.bBpFFmwmwmFFpBb
..bbFFFmmmFFFbb.
...bbBBBBBBbb...
..bBBBBBBBBBBb..
..bBHBBBBBBHBBb.
...bbBBBBBBbb...
....BB....BB....`,

  speakOpen: `
................
bb..........bb..
bHb..bbBBb..bHb.
bHB.bBBBBBBb.BHb
bHBbBBBBBBBBBBHb
bbBBffffffffBBbb
.bBffIeIfIeIfBb.
.bBffIeIfIeIfBb.
.bBfFFFFFFFFFFBb
.bBpFFMMMMMFFpBb
..bbFFMTTTMFFbb.
...bbFFMMMFFbb..
..bBBBBBBBBBBb..
..bBHBBBBBBHBBb.
...bbBBBBBBbb...
....BB....BB....`,

  cheer: `
B............B..
Bb..........Bb..
bbb........bbb..
.bb..bBBBb..bb..
.bBbBBBBBBBBBBb.
bbBBffffffffBBbb
.bBffIeIfIeIfBb.
.bBfFFFFFFFFFFBb
.bBpFFMwmwMFFpBb
..bbFFMmmmMFFbb.
...bbFFmmmFFbb..
....bBBBBBBb....
...bBBBBBBBBb...
...bBBBBBBBBb...
...bbBBBBBBbb...
....BB....BB....`,

  point: `
................
bb..........bb..
bHb..bbBBb..bHb.
bHB.bBBBBBBb.BHb
bHBbBBBBBBBBBBHb
bbBBffffffffBBbb
.bBffIeIfIeIfBb.
.bBffIeIfIeIfBb.
.bBfFFFFFFFFFFBb
.bBpFFmmmmmFFpBb
..bbFFFmmmFFFbb.
...bbBBBBBBbb...
..bBBBBBBBBBBBBB
..bBHBBBBBBBBBBb
...bbBBBBBBbb...
....BB....BB....`,

  tired: `
................
................
bb..........bb..
bHb..bbBBb..bHb.
bHBbBBBBBBBBBBHb
bbBBffffffffBBbb
.bBffeeefeeefBb.
.bBffFFffffFFBb.
.bBfFFFFFFFFFFBb
.bBpFFmmwwwFFpBb
..bbFFFmmmFFFbb.
...bbBBBBBBbb...
..bBBBBBBBBBBb..
...bBBBBBBBBb...
....bb....bb....
................`,

  bananaIdle: `
................
bb..........bb..
bHb..bbBBb..bHb.
bHB.bBBBBBBb.BHb
bHBbBBBBBBBBBBHb
bbBBffffffffBBbb
.bBffIeIfIeIfBb.
.bBffIeIfIeIfBb.
.bBfFFFFFFFFFFBb
.bBpFFmwmwmFFpBb
..bbFFFmmmFFFbb.
...bbBBBBBByg...
..bBBBBBBBBBYy..
..bBHBBBBBBBYb..
...bbBBBBBBbb...
....BB....BB....`,
};

// ---- sprite rendering -----------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

function parseFrame(str) {
  const lines = str.replace(/^\n+|\n+$/g, '').split('\n');
  const w = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const padded = lines.map(line => line.padEnd(w, '.'));
  return { grid: padded, w, h: padded.length };
}

function renderFrame(frameKey) {
  const { grid, w, h } = parseFrame(FRAMES[frameKey]);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = grid[y]?.[x] ?? '.';
      const color = COLORS[ch];
      if (!color) continue;
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', '1');
      rect.setAttribute('height', '1');
      rect.setAttribute('fill', color);
      svg.appendChild(rect);
    }
  }
  return svg;
}

// ---- monkey controller ----------------------------------------------------

export class Monkey {
  constructor(el, bubbleEl) {
    this.el = el;
    this.bubbleEl = bubbleEl;
    this.currentFrame = null;
    this.pose = 'idle';
    this._bobTimer = null;
    this._blinkTimer = null;
    this._speakTimer = null;
    this._utterance = null;
    this._frameToggle = false;
    this.setFrame('idleA');
    this._startIdle();
  }

  setFrame(key) {
    if (this.currentFrame === key) return;
    this.currentFrame = key;
    this.el.replaceChildren(renderFrame(key));
  }

  _startIdle() {
    clearInterval(this._bobTimer);
    clearTimeout(this._blinkTimer);
    this._bobTimer = setInterval(() => {
      if (this.pose !== 'idle') return;
      this._frameToggle = !this._frameToggle;
      this.setFrame(this._frameToggle ? 'idleA' : 'idleB');
    }, 800);
    const scheduleBlink = () => {
      this._blinkTimer = setTimeout(() => {
        if (this.pose === 'idle') {
          const prev = this.currentFrame;
          this.setFrame('blink');
          setTimeout(() => { if (this.pose === 'idle') this.setFrame(prev); }, 120);
        }
        scheduleBlink();
      }, 2500 + Math.random() * 3500);
    };
    scheduleBlink();
  }

  setPose(pose) {
    this.pose = pose;
    this.el.classList.remove('cheering','tired','pointing','speaking');
    if (pose === 'cheer')    { this.setFrame('cheer'); this.el.classList.add('cheering'); }
    else if (pose === 'tired')    { this.setFrame('tired'); this.el.classList.add('tired'); }
    else if (pose === 'point')    { this.setFrame('point'); this.el.classList.add('pointing'); }
    else if (pose === 'banana')   { this.setFrame('bananaIdle'); }
    else                          { this.setFrame('idleA'); }
  }

  // Show speech bubble + animate mouth flap while speaking
  _startMouthFlap() {
    clearInterval(this._speakTimer);
    let open = true;
    this.el.classList.add('speaking');
    this._speakTimer = setInterval(() => {
      open = !open;
      this.setFrame(open ? 'speakOpen' : 'idleA');
    }, 130);
  }
  _stopMouthFlap() {
    clearInterval(this._speakTimer);
    this._speakTimer = null;
    this.el.classList.remove('speaking');
    if (this.pose === 'idle') this.setFrame('idleA');
  }

  showBubble(text) {
    if (!this.bubbleEl) return;
    this.bubbleEl.textContent = text;
    this.bubbleEl.hidden = false;
    clearTimeout(this._bubbleTimer);
    this._bubbleTimer = setTimeout(() => { this.bubbleEl.hidden = true; }, 3500);
  }

  // entry points the app uses
  speakStart(text) {
    this.showBubble(text);
    this._startMouthFlap();
  }
  speakEnd() {
    this._stopMouthFlap();
  }
}

// ---- Speech (Web Speech API) ----------------------------------------------
//
// Reliability notes:
// - Chrome has a long-standing race where cancel() + speak() back-to-back drops
//   the new utterance. We use a tiny setTimeout to let cancel() flush.
// - Safari requires a user gesture before the first speak() — until then,
//   utterances silently fail. We track "unlocked" state and skip earlier ones.
// - getVoices() is async on Chrome; we listen for voiceschanged to pick one.

export class Voice {
  constructor() {
    this.enabled = true;
    this.tone = 'supportive'; // off | supportive | mean
    this.voice = null;
    this._voices = [];
    this._unlocked = false;
    this._voiceListeners = [];
    this._badVoices = new Set();      // voices that have *never* fired onstart
    this._goodVoices = new Set();     // voices that have fired onstart at least once
    this._synthEverStarted = false;   // any utterance has actually started speaking
    this._keepalive = null;
    this._onStart = null;
    this._onEnd = null;
    this._loadVoices();
    if (typeof speechSynthesis !== 'undefined') {
      // addEventListener so we don't fight other handlers (Chrome lets you
      // attach multiple; the older `.onvoiceschanged = ...` would replace).
      speechSynthesis.addEventListener?.('voiceschanged', () => this._loadVoices());
      // Some browsers (Safari, some Android) don't fire voiceschanged
      // reliably. Poll until voices appear.
      let tries = 0;
      const poll = () => {
        const v = speechSynthesis.getVoices();
        if (v.length) { this._loadVoices(); return; }
        if (++tries > 40) return; // give up after ~10s
        setTimeout(poll, 250);
      };
      poll();
    }
  }

  onVoicesChanged(fn) { this._voiceListeners.push(fn); }

  _loadVoices() {
    if (typeof speechSynthesis === 'undefined') return;
    const prev = this._voices.length;
    this._voices = speechSynthesis.getVoices();
    if (!this.voice && this._voices.length) {
      // Prefer system default → local English → any English → any voice.
      // NEVER auto-pick macOS novelty voices (Bubbles, Trinoids, Cellos, etc.)
      // — Chrome lists them but the backend can't actually synthesize them.
      const isNovelty = (v) =>
        /bubbles|trinoids|cellos|hysterical|deranged|good news|bad news|whisper|bahh|jester|organ|albert|zarvox|junior|kathy|fred|ralph|princess|boing|bells/i
        .test(v.name);
      const ok = this._voices.filter(v => !isNovelty(v));
      const preferred =
        ok.find(v => v.default) ||
        ok.find(v => v.localService && /^en[-_]/i.test(v.lang)) ||
        ok.find(v => /^en[-_]/i.test(v.lang)) ||
        ok[0] ||
        this._voices[0];
      this.voice = preferred?.name || this._voices[0]?.name;
    }
    if (this._voices.length !== prev) {
      for (const fn of this._voiceListeners) { try { fn(); } catch {} }
    }
  }

  availableVoices() { return this._voices; }
  setVoice(name) { this.voice = name; }
  setHandlers({ onStart, onEnd }) {
    this._onStart = onStart;
    this._onEnd = onEnd;
  }

  // Just set the flag — don't speak a warm-up. The warm-up was supposed to
  // satisfy Safari/iOS's "first speak must be in a gesture" rule, but if it
  // silently stalls, the whole queue gets wedged behind it. We instead rely
  // on the first real say() being called synchronously from a click handler.
  unlock() {
    this._unlocked = true;
    if (typeof speechSynthesis === 'undefined') return;
    try { speechSynthesis.resume(); } catch {}
  }

  cancel() {
    if (typeof speechSynthesis === 'undefined') return;
    try { speechSynthesis.cancel(); } catch {}
    this._onEnd?.();
  }

  // Dead simple: cancel the queue, wait one tick for Chrome's cancel race,
  // then speak. No watchdog, no fallback retry, no keepalive — those layers
  // were creating duplicates and 30s-late playback when they fought each
  // other or got out of sync. If a single speak fails, we drop that
  // announcement. The screen still shows the exercise.
  say(text, opts = {}) {
    if (!this.enabled || !text || typeof speechSynthesis === 'undefined') return;
    if (!this._unlocked) return;
    // Pick voice with fallback chain.
    let chosen = this._voices.find(v => v.name === this.voice);
    if (chosen && this._badVoices.has(chosen.name)) chosen = null;
    if (!chosen && this._voices.length) {
      chosen = this._voices.find(v => /^en[-_]/i.test(v.lang) && !this._badVoices.has(v.name))
            || this._voices.find(v => !this._badVoices.has(v.name))
            || null;
    }
    // Always cancel first — interrupt any in-flight or queued speech.
    try { speechSynthesis.cancel(); } catch {}
    // Build the utterance now (synchronous) so the closure captures it.
    const u = new SpeechSynthesisUtterance(text);
    if (chosen) u.voice = chosen;
    u.lang = chosen?.lang || 'en-US';
    u.rate = opts.rate ?? 1.18;
    u.pitch = opts.pitch ?? 1.05;
    u.volume = opts.volume ?? 1;
    u.onstart = () => {
      if (chosen) this._goodVoices.add(chosen.name);
      this._onStart?.(text);
    };
    u.onend   = () => this._onEnd?.();
    u.onerror = () => this._onEnd?.();
    // Small delay so cancel() actually flushes before speak() — without this,
    // Chrome silently drops the new utterance roughly half the time.
    setTimeout(() => {
      try {
        speechSynthesis.resume();
        speechSynthesis.speak(u);
      } catch { this._onEnd?.(); }
    }, 80);
  }

  // Returns an encouragement line for the given moment, in current tone.
  // moments: 'workStart', 'restStart', 'roundComplete', 'halfway', 'finish', 'idle'
  encouragement(moment) {
    if (this.tone === 'off') return null;
    const bank = ENCOURAGEMENT[this.tone]?.[moment];
    if (!bank || !bank.length) return null;
    return bank[Math.floor(Math.random() * bank.length)];
  }
}

const ENCOURAGEMENT = {
  supportive: {
    workStart: ["Let's go!", "You got this.", "Strong start.", "Make it count."],
    restStart: ["Nice work.", "Breathe.", "Recover up.", "Good job."],
    roundComplete: ["Round done!", "One more like that.", "Great pace.", "Keep stacking."],
    halfway: ["Halfway there!", "Locked in.", "Don't slow down."],
    finish: ["You did it!", "That was awesome.", "Stage clear, champ.", "Proud of you."],
    idle: ["Tap start when you're ready.", "Pick a workout, friend."],
  },
  mean: {
    workStart: ["Move it!", "Stop stalling.", "Wake up!", "Hands up, soldier.", "Don't embarrass me."],
    restStart: ["Don't get comfortable.", "Catch your breath, princess.", "Clock's ticking.", "Less wheezing."],
    roundComplete: ["Was that it?", "My grandma goes harder.", "One down, plenty to go.", "Pick up the pace."],
    halfway: ["Halfway. Are you serious?", "Try harder.", "I've seen plants move faster."],
    finish: ["Finally.", "About time.", "Don't celebrate yet.", "We'll fix the form tomorrow."],
    idle: ["Press start. I haven't got all day.", "Pick a mode. Any mode."],
  },
  off: {},
};

// Cheap announcement helpers used by the timer
export function announceExercise(name, reps) {
  if (!name) return null;
  if (reps) return `${reps} ${name}!`;
  return `${name}!`;
}

export function spokenCountdown(n) {
  if (n === 3) return "Three";
  if (n === 2) return "Two";
  if (n === 1) return "One";
  if (n === 0) return "Go!";
  return null;
}
