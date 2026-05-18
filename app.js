// MWEDONDAY — main controller
import { Monkey, Voice, announceExercise, spokenCountdown } from './monkey.js';
import { Chiptune } from './audio.js';

// ---------- elements -------------------------------------------------------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const stage          = $('#stage');
const marqueeText    = $('#marquee-text');
const monkeyEl       = $('#monkey');
const bubbleEl       = $('#speech-bubble');
const timerEl        = $('#timer');
const exerciseRepsEl = $('#exercise-reps');
const exerciseNameEl = $('#exercise-name');
const upnextEl       = $('#upnext');
const progressFill   = $('#progress-fill');
const modePill       = $('#mode-pill');
const roundPill      = $('#round-pill');
const startBtn       = $('#start-btn');
const pauseBtn       = $('#pause-btn');
const advanceBtn     = $('#advance-btn');
const stopBtn        = $('#stop-btn');
const shareBtn       = $('#share-btn');
const shareStatus    = $('#share-status');
const settingsModal  = $('#settings-modal');
const settingsBtn    = $('#settings-btn');
const optMonkey      = $('#opt-monkey');
const optSfx         = $('#opt-sfx');
const optWake        = $('#opt-wake');
const optCrt         = $('#opt-crt');
const optVoice       = $('#opt-voice');
const stageClearEl   = $('#stage-clear');
const scStats        = $('#sc-stats');
const scClose        = $('#sc-close');
const stopModal      = $('#stop-modal');
const exerciseLineEl = $('#exercise-line');
const exerciseListEl = $('#exercise-list');
const sessionLogEl   = $('#session-log');
const logListEl      = $('#log-list');
const scShareBtn     = $('#sc-share');
const scShareStatus  = $('#sc-share-status');
const levelMapEl     = $('#level-map');
const upBtn          = $('#up-btn');
const stayBtn        = $('#stay-btn');
const downBtn        = $('#down-btn');
const finishRoundBtn = $('#finish-round-btn');
const timeWorkedEl   = $('#time-worked');
const twValueEl      = $('#tw-value');

// ---------- services -------------------------------------------------------
const monkey = new Monkey(monkeyEl, bubbleEl);
const voice = new Voice();
const sfx = new Chiptune();
voice.setHandlers({
  onStart: (text) => monkey.speakStart(text),
  onEnd:   () => monkey.speakEnd(),
});

// ---------- state ----------------------------------------------------------
const PREFS_KEY = 'mwedonday:prefs';
const defaultPrefs = {
  monkeyMode: true,
  tone: 'supportive',
  sfx: true,
  wake: false,
  crt: false,
  voiceName: null,
};

let prefs = loadPrefs();

let currentMode = 'circuit';
let workout = null;     // built schedule for the current run
let run = null;         // runtime state
let tickHandle = null;
let wakeLock = null;
let sessionHistory = []; // completed workouts this session

// ---------- utilities ------------------------------------------------------
function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...defaultPrefs };
    return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch { return { ...defaultPrefs }; }
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
}
function applyPrefs() {
  voice.enabled = prefs.monkeyMode;
  voice.tone = prefs.tone;
  sfx.enabled = prefs.sfx;
  document.body.classList.toggle('crt', prefs.crt);
  if (prefs.voiceName) voice.setVoice(prefs.voiceName);
  optMonkey.checked = prefs.monkeyMode;
  optSfx.checked = prefs.sfx;
  optWake.checked = prefs.wake;
  optCrt.checked = prefs.crt;
  $$('#opt-tone button').forEach(b => {
    b.dataset.selected = b.dataset.tone === prefs.tone ? 'true' : 'false';
  });
  if (prefs.wake) requestWakeLock(); else releaseWakeLock();
}

function fmtTime(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function fmtTimeCs(ms) {
  // hundredths-of-second for count-up "score" times
  const t = Math.max(0, ms);
  const total = Math.floor(t / 10);
  const cs = total % 100;
  const s  = Math.floor(total / 100) % 60;
  const m  = Math.floor(total / 6000);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

// Parse "Pushups x 10" or "Pushups" or "Pushups 10" or "10 pushups"
function parseExerciseLine(line) {
  const raw = line.trim();
  if (!raw) return null;
  // "Pushups x 10"  or  "Pushups × 10"
  let m = raw.match(/^(.+?)\s*[x×*]\s*(\d+)$/i);
  if (m) return { name: m[1].trim(), reps: parseInt(m[2], 10) };
  // "Pushups 10"
  m = raw.match(/^(.+?)\s+(\d+)$/);
  if (m) return { name: m[1].trim(), reps: parseInt(m[2], 10) };
  // "10 pushups"
  m = raw.match(/^(\d+)\s+(.+)$/);
  if (m) return { name: m[2].trim(), reps: parseInt(m[1], 10) };
  return { name: raw, reps: null };
}
function parseExerciseList(text) {
  return text.split('\n').map(parseExerciseLine).filter(Boolean);
}

// ---------- URL hash persistence ------------------------------------------
function readConfigFromUI() {
  const cfg = { mode: currentMode };
  if (currentMode === 'circuit') {
    cfg.circuit = {
      warmupSec: +$('#c-warmup').value || 0,
      workSec:   +$('#c-work').value || 30,
      restSec:   +$('#c-rest').value || 15,
      cycles:    +$('#c-cycles').value || 8,
      exercises: parseExerciseList($('#c-exercises').value),
    };
  } else if (currentMode === 'amrap') {
    cfg.amrap = {
      warmupSec: +$('#a-warmup').value || 0,
      minutes:   +$('#a-mins').value || 12,
      exercises: parseExerciseList($('#a-exercises').value),
    };
  } else if (currentMode === 'reps') {
    cfg.reps = {
      warmupSec: +$('#r-warmup').value || 0,
      rounds:    +$('#r-rounds').value || 1,
      exercises: parseExerciseList($('#r-exercises').value),
    };
  } else if (currentMode === 'ladder') {
    cfg.ladder = {
      warmupSec:  +$('#l-warmup').value || 0,
      startRung:  +$('#l-start').value || 1,
      timeCapMin: +$('#l-timecap').value || 10,
      exercises:  parseExerciseList($('#l-exercises').value)
                    .map(e => ({ name: e.name, mult: e.reps || 1 })),
    };
  }
  return cfg;
}

function writeConfigToUI(cfg) {
  if (!cfg || !cfg.mode) return;
  setMode(cfg.mode, false);
  if (cfg.circuit) {
    $('#c-warmup').value = cfg.circuit.warmupSec ?? 10;
    $('#c-work').value   = cfg.circuit.workSec ?? 30;
    $('#c-rest').value   = cfg.circuit.restSec ?? 15;
    $('#c-cycles').value = cfg.circuit.cycles ?? 8;
    $('#c-exercises').value = (cfg.circuit.exercises || []).map(e => e.reps ? `${e.name} x ${e.reps}` : e.name).join('\n');
  }
  if (cfg.amrap) {
    $('#a-warmup').value = cfg.amrap.warmupSec ?? 10;
    $('#a-mins').value   = cfg.amrap.minutes ?? 12;
    $('#a-exercises').value = (cfg.amrap.exercises || []).map(e => e.reps ? `${e.name} x ${e.reps}` : e.name).join('\n');
  }
  if (cfg.reps) {
    $('#r-warmup').value = cfg.reps.warmupSec ?? 10;
    $('#r-rounds').value = cfg.reps.rounds ?? 1;
    $('#r-exercises').value = (cfg.reps.exercises || []).map(e => e.reps ? `${e.name} x ${e.reps}` : e.name).join('\n');
  }
  if (cfg.ladder) {
    $('#l-warmup').value   = cfg.ladder.warmupSec ?? 10;
    $('#l-start').value    = cfg.ladder.startRung ?? 1;
    $('#l-timecap').value  = cfg.ladder.timeCapMin ?? 10;
    $('#l-exercises').value = (cfg.ladder.exercises || []).map(e => `${e.name} x ${e.mult ?? 1}`).join('\n');
  }
}

function encodeHash(cfg) {
  try {
    const json = JSON.stringify(cfg);
    return 'w=' + btoa(unescape(encodeURIComponent(json))).replace(/=+$/,'');
  } catch { return ''; }
}
function decodeHash(hash) {
  const m = (hash || '').replace(/^#/, '').match(/w=([A-Za-z0-9+/=_-]+)/);
  if (!m) return null;
  try {
    const pad = (4 - (m[1].length % 4)) % 4;
    return JSON.parse(decodeURIComponent(escape(atob(m[1] + '='.repeat(pad)))));
  } catch { return null; }
}

// ---------- mode/config UI -------------------------------------------------
function setMode(mode, animate = true) {
  currentMode = mode;
  $$('.mode-card').forEach(c => c.setAttribute('aria-selected', c.dataset.mode === mode ? 'true' : 'false'));
  $$('.config-panel').forEach(p => p.classList.toggle('active', p.dataset.config === mode));
  modePill.textContent = mode.toUpperCase();
  if (animate) sfx.modeSwitch();
}

// ---------- workout builders ----------------------------------------------
// Each builder returns { phases: [{type, label, exercise, dur (ms) or null}], type: 'timed'|'tap' }
function buildWorkout(cfg) {
  const mode = cfg.mode;
  const phases = [];
  if (mode === 'circuit') {
    const c = cfg.circuit;
    const exs = (c.exercises && c.exercises.length) ? c.exercises : [{ name: 'Work', reps: null }];
    if (c.warmupSec > 0) phases.push({ kind: 'warmup', label: 'GET READY', dur: c.warmupSec * 1000 });
    // ONE CYCLE = one full pass through every exercise. So N cycles of
    // M exercises = N*M work intervals, with rest between each (except
    // after the very last one).
    const totalWorks = c.cycles * exs.length;
    for (let cycle = 1; cycle <= c.cycles; cycle++) {
      exs.forEach((ex, exIdx) => {
        phases.push({
          kind: 'work',
          label: 'WORK',
          exercise: ex,
          dur: c.workSec * 1000,
          cycle,
          exIdx,
          perCycle: exs.length,
          cyclesTotal: c.cycles,
        });
        const isLast = (cycle === c.cycles && exIdx === exs.length - 1);
        if (!isLast && c.restSec > 0) {
          const nextEx = (exIdx + 1 < exs.length) ? exs[exIdx + 1] : exs[0];
          phases.push({ kind: 'rest', label: 'REST', dur: c.restSec * 1000, nextExercise: nextEx });
        }
      });
    }
    phases.push({ kind: 'finished', label: 'STAGE CLEAR', dur: 0 });
    return { kind: 'circuit', timed: true, phases, totalCycles: c.cycles, totalWorks };
  }
  if (mode === 'amrap') {
    const a = cfg.amrap;
    if (a.warmupSec > 0) phases.push({ kind: 'warmup', label: 'GET READY', dur: a.warmupSec * 1000 });
    phases.push({ kind: 'amrap', label: 'AMRAP', dur: a.minutes * 60 * 1000, exercises: a.exercises });
    phases.push({ kind: 'finished', label: 'TIME', dur: 0 });
    return { kind: 'amrap', timed: true, phases, durationMs: a.minutes * 60 * 1000 };
  }
  if (mode === 'reps') {
    const r = cfg.reps;
    if (r.warmupSec > 0) phases.push({ kind: 'warmup', label: 'GET READY', dur: r.warmupSec * 1000 });
    const rounds = Math.max(1, r.rounds || 1);
    const perRound = r.exercises.length;
    for (let round = 1; round <= rounds; round++) {
      r.exercises.forEach((ex, idx) => {
        phases.push({
          kind: 'reps',
          label: 'REPS',
          exercise: ex,
          idx,
          round,
          totalRounds: rounds,
          perRound,
        });
      });
    }
    phases.push({ kind: 'finished', label: 'STAGE CLEAR' });
    return { kind: 'reps', timed: false, phases, totalRounds: rounds };
  }
  if (mode === 'ladder') {
    const l = cfg.ladder;
    if (l.warmupSec > 0) phases.push({ kind: 'warmup', label: 'GET READY', dur: l.warmupSec * 1000 });
    const timeCapMs = Math.max(1, l.timeCapMin || 10) * 60 * 1000;
    const startRung = Math.max(1, l.startRung || 1);
    phases.push({
      kind: 'ladder',
      label: 'LADDER',
      dur: timeCapMs,
      startRung,
      exercises: l.exercises,
    });
    phases.push({ kind: 'finished', label: 'STAGE CLEAR', dur: 0 });
    return {
      kind: 'ladder',
      timed: true,
      phases,
      timeCapMs,
    };
  }
  return null;
}

// ---------- run engine -----------------------------------------------------
function startWorkout() {
  const cfg = readConfigFromUI();
  workout = buildWorkout(cfg);
  if (!workout || !workout.phases.length) return;
  // Force-create AudioContext on user gesture so SFX/Speech are allowed
  sfx.tick();
  run = {
    phaseIdx: -1,
    phaseStart: 0,
    paused: false,
    totalStart: performance.now(),
    totalElapsed: 0,
    rounds: 0,        // AMRAP
    splits: [],       // reps/ladder
    lastCountdownSec: null,
    phaseTimes: {},   // phaseIdx → elapsed ms (filled when phase ends)
  };
  enterPhase(0);
  showControls('running');
  tickHandle = setInterval(tick, 100);
  if (prefs.wake) requestWakeLock();
}

function enterPhase(idx) {
  if (idx >= workout.phases.length) { finish(); return; }
  // Record time spent in the previous phase before switching
  if (run.phaseIdx >= 0) {
    run.phaseTimes[run.phaseIdx] = performance.now() - run.phaseStart;
  }
  run.phaseIdx = idx;
  run.phaseStart = performance.now();
  run.lastCountdownSec = null;
  const ph = workout.phases[idx];

  stage.setAttribute('data-phase', ph.kind);
  marqueeText.textContent = phaseMarquee(ph);

  // monkey pose
  if (ph.kind === 'warmup') monkey.setPose('point');
  else if (ph.kind === 'work' || ph.kind === 'reps' || ph.kind === 'ladder' || ph.kind === 'amrap') monkey.setPose('idle');
  else if (ph.kind === 'rest') monkey.setPose('tired');
  else if (ph.kind === 'finished') monkey.setPose('cheer');

  // Ladder phase: initialize free-climb state
  if (ph.kind === 'ladder') {
    run.currentRung = ph.startRung;
    run.rungVisits = {};   // {rung: count}
    run.splits = [];       // [{rung, ms}]
  }

  // SFX
  if (ph.kind === 'warmup')   sfx.warmupBeep();
  if (ph.kind === 'work')     sfx.workStart();
  if (ph.kind === 'amrap')    sfx.workStart();
  if (ph.kind === 'rest')     sfx.restStart();
  if (ph.kind === 'reps')     sfx.workStart();
  if (ph.kind === 'ladder')   sfx.workStart();

  // labels
  updateLabels(ph);
  updateHud(ph, 0);

  // Speech
  speakForPhase(ph);

  // Show / hide controls per phase
  const isAdvance = ph.kind === 'amrap' || ph.kind === 'reps';
  advanceBtn.hidden = !isAdvance;
  advanceBtn.textContent = ph.kind === 'amrap' ? '+1 ROUND' : '✓ FINISH SET';
  // FINISH ROUND only useful in reps mode with rounds > 1, OR multi-exercise
  // single-round reps (to skip remaining sets in this round).
  const isReps = ph.kind === 'reps';
  finishRoundBtn.hidden = !isReps;
  // Ladder gets UP / STAY / DOWN instead of FINISH SET
  const isLadder = ph.kind === 'ladder';
  upBtn.hidden = !isLadder;
  stayBtn.hidden = !isLadder;
  downBtn.hidden = !isLadder;

  if (ph.kind === 'finished') {
    onFinished();
  }
}

function phaseMarquee(ph) {
  if (ph.kind === 'warmup')   return 'GET READY';
  if (ph.kind === 'work')     return `WORK · ${ph.exercise?.name?.toUpperCase() || ''}`;
  if (ph.kind === 'rest')     return 'REST';
  if (ph.kind === 'amrap')    return 'AMRAP — TAP +1 ROUND';
  if (ph.kind === 'reps')     return `REPS · ${ph.exercise?.name?.toUpperCase() || ''}`;
  if (ph.kind === 'ladder')   return `LADDER · RUNG ${run?.currentRung ?? ph.startRung}`;
  if (ph.kind === 'finished') return 'STAGE CLEAR';
  return '';
}

function renderExerciseList(items) {
  exerciseListEl.replaceChildren();
  for (const it of items) {
    const li = document.createElement('li');
    const r = document.createElement('span'); r.className = 'reps';
    r.textContent = it.reps ? `${it.reps}×` : '—';
    const n = document.createElement('span'); n.className = 'name';
    n.textContent = (it.name || '').toUpperCase();
    li.append(r, n);
    exerciseListEl.appendChild(li);
  }
}

function showSingleExercise() {
  exerciseLineEl.hidden = false;
  exerciseListEl.hidden = true;
}
function showExerciseList(items) {
  exerciseLineEl.hidden = true;
  exerciseListEl.hidden = false;
  renderExerciseList(items);
}

// Reps mode checklist — render only the CURRENT round's exercises. The
// round pill already shows "RND 2/3" so we don't visually duplicate every
// round on screen. As the user advances past the last exercise of the
// round, the list re-renders with the next round.
function renderRepsChecklist() {
  exerciseLineEl.hidden = true;
  exerciseListEl.hidden = false;
  exerciseListEl.replaceChildren();
  const currentPhase = workout.phases[run.phaseIdx];
  const currentRound = currentPhase?.round || 1;
  workout.phases.forEach((p, idx) => {
    if (p.kind !== 'reps') return;
    if (p.round !== currentRound) return;
    const li = document.createElement('li');
    li.className = 'checkable';
    if (idx < run.phaseIdx) li.classList.add('done');
    else if (idx === run.phaseIdx) li.classList.add('current');
    const r = document.createElement('span'); r.className = 'reps';
    r.textContent = p.exercise?.reps ? `${p.exercise.reps}×` : '—';
    const n = document.createElement('span'); n.className = 'name';
    n.textContent = (p.exercise?.name || '').toUpperCase();
    const c = document.createElement('span'); c.className = 'check';
    c.textContent = (idx < run.phaseIdx) ? '✓' : (idx === run.phaseIdx ? '▸' : '○');
    li.append(r, n, c);
    li.addEventListener('click', () => {
      if (idx >= run.phaseIdx) {
        const split = performance.now() - run.totalStart;
        run.splits.push({
          label: `${p.exercise?.reps || ''} ${p.exercise?.name || ''}`.trim(),
          ms: split,
        });
        sfx.roundClear();
        monkey.setPose('cheer');
        setTimeout(() => monkey.setPose('idle'), 200);
        enterPhase(idx + 1);
      }
    });
    exerciseListEl.appendChild(li);
  });
}

// 2D level-map — Mario-overworld-style tile sequence. For most modes one
// tile per phase; for free-climb ladders, one tile per rung 1..top showing
// the visit count (since the user steers freely the rung map matters more
// than the phase sequence).
function renderLevelMap() {
  if (!workout || !run) { levelMapEl.hidden = true; levelMapEl.replaceChildren(); return; }
  levelMapEl.hidden = false;
  levelMapEl.replaceChildren();

  // Total time worked = sum of phaseTimes so far + live elapsed of current
  let totalMs = 0;
  for (const k in run.phaseTimes) totalMs += run.phaseTimes[k] || 0;
  if (!run.paused) {
    const live = performance.now() - run.phaseStart;
    if (live > 0) totalMs += live;
  }
  const total = document.createElement('div');
  total.className = 'map-total';
  total.innerHTML = `TIME WORKED<strong>${fmtTime(totalMs)}</strong>`;
  levelMapEl.appendChild(total);

  // Ladder: rung-tiles instead of phase-tiles. With no fixed top, we render
  // rungs from 1 up to max(currentRung, highest-visited, 5) so there's
  // always at least a couple of upcoming-rung tiles to suggest where to go.
  if (workout.kind === 'ladder') {
    const visits = run.rungVisits || {};
    const visitedMax = Object.keys(visits).reduce((m, k) => Math.max(m, +k), 0);
    const maxRung = Math.max(run.currentRung + 2, visitedMax, 5);
    for (let r = 1; r <= maxRung; r++) {
      const tile = document.createElement('div');
      tile.className = 'map-tile kind-rung';
      const count = visits[r] || 0;
      if (count > 0) tile.classList.add('done');
      if (run.currentRung === r) {
        tile.classList.remove('done');
        tile.classList.add('current');
      }
      const icon = document.createElement('div');
      icon.className = 'map-tile-icon';
      icon.textContent = String(r);
      tile.appendChild(icon);
      const name = document.createElement('div');
      name.className = 'map-tile-name';
      name.textContent = 'RUNG';
      tile.appendChild(name);
      const cnt = document.createElement('div');
      cnt.className = 'map-tile-time';
      cnt.textContent = count > 0 ? `×${count}` : '·';
      tile.appendChild(cnt);
      levelMapEl.appendChild(tile);
    }
    return;
  }

  workout.phases.forEach((p, idx) => {
    if (p.kind === 'finished') return;
    const tile = document.createElement('div');
    tile.className = 'map-tile kind-' + p.kind;
    if (idx < run.phaseIdx) tile.classList.add('done');
    else if (idx === run.phaseIdx) tile.classList.add('current');

    const icon = document.createElement('div');
    icon.className = 'map-tile-icon';
    icon.textContent = phaseTileIcon(p);
    tile.appendChild(icon);

    const name = document.createElement('div');
    name.className = 'map-tile-name';
    name.textContent = phaseTileName(p);
    tile.appendChild(name);

    const t = document.createElement('div');
    t.className = 'map-tile-time';
    t.textContent = phaseTileTime(p, idx);
    tile.appendChild(t);

    levelMapEl.appendChild(tile);
  });
}

function phaseTileIcon(p) {
  if (p.kind === 'warmup') return 'W';
  if (p.kind === 'rest')   return 'Z';
  if (p.kind === 'work')   return '●';
  if (p.kind === 'reps')   return '#';
  if (p.kind === 'amrap')  return '∞';
  if (p.kind === 'ladder') return '▲';
  return '·';
}
function phaseTileName(p) {
  if (p.kind === 'warmup') return 'READY';
  if (p.kind === 'rest')   return 'REST';
  if (p.kind === 'work' || p.kind === 'reps') {
    const n = (p.exercise?.name || '').slice(0, 8);
    return p.exercise?.reps ? `${p.exercise.reps}× ${n}` : n;
  }
  if (p.kind === 'amrap')  return 'AMRAP';
  if (p.kind === 'ladder') return 'LADDER';
  return '';
}
function phaseTileTime(p, idx) {
  // Completed: actual time taken
  if (idx < run.phaseIdx && run.phaseTimes[idx] != null) {
    return fmtTime(run.phaseTimes[idx]);
  }
  // Current: live elapsed
  if (idx === run.phaseIdx) {
    if (run.paused) return 'PAUSE';
    const live = Math.max(0, performance.now() - run.phaseStart);
    return fmtTime(live);
  }
  // Upcoming: planned duration if known, else '·'
  if (p.dur > 0) return fmtTime(p.dur);
  return '·';
}

function updateLabels(ph) {
  if (ph.kind === 'warmup') {
    showSingleExercise();
    exerciseRepsEl.textContent = '';
    exerciseNameEl.textContent = nextWorkLabel() || 'GET READY';
    upnextEl.textContent = '';
  } else if (ph.kind === 'work') {
    showSingleExercise();
    exerciseRepsEl.textContent = ph.exercise?.reps ? `${ph.exercise.reps}×` : '';
    exerciseNameEl.textContent = (ph.exercise?.name || 'WORK').toUpperCase();
    upnextEl.textContent = peekUpcoming();
  } else if (ph.kind === 'rest') {
    showSingleExercise();
    exerciseRepsEl.textContent = '';
    exerciseNameEl.textContent = 'REST';
    upnextEl.textContent = ph.nextExercise ? `UP NEXT — ${ph.nextExercise.name.toUpperCase()}` : '';
  } else if (ph.kind === 'amrap') {
    // The exercise list IS the workout in AMRAP — make it prominent.
    showExerciseList(ph.exercises);
    upnextEl.textContent = 'TAP +1 ROUND PER CYCLE';
  } else if (ph.kind === 'reps') {
    // Full checklist of every rep phase — current one highlighted, done
    // ones strike-through. Tapping any row marks it done and advances.
    renderRepsChecklist();
    upnextEl.textContent = 'TAP DONE! OR ANY EXERCISE TO ADVANCE';
  } else if (ph.kind === 'ladder') {
    const rung = run?.currentRung ?? ph.startRung;
    const items = ph.exercises.map(e => ({ name: e.name, reps: rung * (e.mult || 1) }));
    showExerciseList(items);
    upnextEl.textContent = `RUNG ${rung} · ▲ UP ↻ AGAIN ▼ DOWN`;
  } else if (ph.kind === 'finished') {
    showSingleExercise();
    exerciseRepsEl.textContent = '';
    exerciseNameEl.textContent = 'STAGE CLEAR';
    upnextEl.textContent = '';
  }

  // Round pill
  roundPill.textContent = roundPillText();
  // 2D level map below the controls
  renderLevelMap();
}

function roundPillText() {
  const ph = workout.phases[run.phaseIdx];
  if (!ph) return '';
  if (workout.kind === 'circuit') {
    if (ph.kind === 'work') return `CYC ${ph.cycle}/${ph.cyclesTotal} · EX ${ph.exIdx + 1}/${ph.perCycle}`;
    if (ph.kind === 'rest') return `REST`;
  }
  if (workout.kind === 'amrap')  return `RND ${run.rounds}`;
  if (workout.kind === 'reps' && ph.kind === 'reps') {
    if ((workout.totalRounds || 1) > 1) {
      return `RND ${ph.round}/${ph.totalRounds} · EX ${ph.idx + 1}/${ph.perRound}`;
    }
    return `EX ${ph.idx + 1}/${ph.perRound}`;
  }
  if (workout.kind === 'ladder' && ph.kind === 'ladder') {
    const visits = Object.values(run.rungVisits || {}).reduce((a, b) => a + b, 0);
    return `RUNG ${run.currentRung} · ${visits} SETS`;
  }
  return ph.label || '';
}

function repsCount() {
  return workout.phases.filter(p => p.kind === 'reps').length;
}

function peekUpcoming() {
  if (workout.kind === 'circuit') {
    const next = workout.phases[run.phaseIdx + 1];
    if (next?.kind === 'rest' && next.nextExercise) return `NEXT — ${next.nextExercise.name.toUpperCase()}`;
    const nextWork = workout.phases.slice(run.phaseIdx + 1).find(p => p.kind === 'work');
    if (nextWork) return `NEXT — ${nextWork.exercise.name.toUpperCase()}`;
  }
  if (workout.kind === 'reps') {
    const cur = workout.phases[run.phaseIdx];
    const next = workout.phases.slice(run.phaseIdx + 1).find(p => p.kind === 'reps');
    if (next) {
      if (cur?.round && next.round !== cur.round) return `NEXT — ROUND ${next.round} START`;
      return `NEXT — ${next.exercise.name.toUpperCase()}`;
    }
  }
  return '';
}

function nextWorkLabel() {
  const nextWork = workout.phases.slice(run.phaseIdx + 1).find(p => p.kind === 'work' || p.kind === 'reps' || p.kind === 'ladder' || p.kind === 'amrap');
  if (!nextWork) return '';
  if (nextWork.kind === 'ladder') return 'LADDER';
  if (nextWork.kind === 'amrap') return 'AMRAP';
  return (nextWork.exercise?.name || 'WORK').toUpperCase();
}

function speakForPhase(ph) {
  if (!voice.enabled) return;
  // Keep announcements as terse as possible — one word when we can manage it.
  if (ph.kind === 'warmup') voice.say('Get ready.');
  else if (ph.kind === 'work')   voice.say(announceExercise(ph.exercise?.name, ph.exercise?.reps));
  else if (ph.kind === 'rest')   voice.say('Rest.');
  else if (ph.kind === 'reps')   voice.say(announceExercise(ph.exercise?.name, ph.exercise?.reps));
  else if (ph.kind === 'ladder') voice.say(`Rung ${run?.currentRung ?? ph.startRung}.`);
  else if (ph.kind === 'amrap')  voice.say('Go!');
}

function tick() {
  if (!run || run.paused) return;
  const ph = workout.phases[run.phaseIdx];
  if (!ph) return;

  const phaseElapsed = performance.now() - run.phaseStart;

  // Warmup is always a countdown, even in count-up modes (reps/ladder).
  if (ph.kind === 'warmup' && ph.dur > 0) {
    const remaining = Math.max(0, ph.dur - phaseElapsed);
    updateHud(ph, phaseElapsed);
    const secLeft = Math.ceil(remaining / 1000);
    if (secLeft <= 3 && secLeft > 0 && secLeft !== run.lastCountdownSec) {
      run.lastCountdownSec = secLeft;
      if (secLeft === 1) sfx.tickFinal(); else sfx.tick();
      timerEl.classList.remove('tick'); void timerEl.offsetWidth; timerEl.classList.add('tick');
    }
    if (remaining <= 0) {
      // In count-up modes, restart the total clock from end-of-warmup so the
      // score doesn't include warmup time.
      if (!workout.timed) run.totalStart = performance.now();
      enterPhase(run.phaseIdx + 1);
      return;
    }
  } else if (workout.timed && ph.dur > 0) {
    // Count-down within the phase (circuit work/rest, AMRAP total time)
    const remaining = Math.max(0, ph.dur - phaseElapsed);
    updateHud(ph, phaseElapsed);

    const secLeft = Math.ceil(remaining / 1000);
    if (secLeft <= 3 && secLeft > 0 && secLeft !== run.lastCountdownSec) {
      run.lastCountdownSec = secLeft;
      if (secLeft === 1) sfx.tickFinal(); else sfx.tick();
      timerEl.classList.remove('tick'); void timerEl.offsetWidth; timerEl.classList.add('tick');
    }
    if (remaining <= 0) {
      if (ph.kind === 'work') {
        const enc = voice.encouragement('roundComplete');
        if (enc && Math.random() < 0.5) voice.say(enc);
      }
      enterPhase(run.phaseIdx + 1);
      return;
    }
  } else if (ph.kind === 'reps') {
    // count-up the total run time (since end of warmup)
    const totalElapsed = performance.now() - run.totalStart;
    updateHud(ph, totalElapsed);
  } else if (ph.kind === 'finished') {
    // freeze
  }

  updateTabTitle(ph);

  // Refresh the level map ~1x/second so live elapsed time updates on the
  // current tile + the TIME WORKED total.
  run._mapTickCounter = (run._mapTickCounter || 0) + 1;
  if (run._mapTickCounter >= 10) {
    run._mapTickCounter = 0;
    renderLevelMap();
  }
}

function updateHud(ph, elapsedInPhase) {
  if (!ph) return;
  // Update "TIME WORKED" secondary display — visible only for the long
  // time-capped phases where you want to see both clocks.
  if (ph.kind === 'amrap' || ph.kind === 'ladder') {
    timeWorkedEl.hidden = false;
    twValueEl.textContent = fmtTime(elapsedInPhase);
  } else {
    timeWorkedEl.hidden = true;
  }
  if (ph.kind === 'warmup' || ph.kind === 'work' || ph.kind === 'rest'
      || ph.kind === 'amrap' || ph.kind === 'ladder') {
    // Countdown big timer (remaining = cap - elapsed).
    const remaining = Math.max(0, ph.dur - elapsedInPhase);
    timerEl.textContent = fmtTime(remaining);
    progressFill.style.width = `${100 * (elapsedInPhase / ph.dur)}%`;
  } else if (ph.kind === 'reps') {
    // Count-up score timer
    const total = performance.now() - run.totalStart;
    timerEl.textContent = fmtTimeCs(total);
    const totalCount = workout.phases.filter(p => p.kind === 'reps').length;
    progressFill.style.width = `${100 * ((ph.idx + 1) / Math.max(1, totalCount))}%`;
  } else if (ph.kind === 'finished') {
    progressFill.style.width = `100%`;
  }
}

function updateTabTitle(ph) {
  if (!ph) { document.title = 'MWEDONDAY'; return; }
  let prefix = run.paused ? '⏸ ' : '▶ ';
  let body = timerEl.textContent;
  let label = '';
  if (ph.kind === 'work' || ph.kind === 'reps') label = ph.exercise?.name || '';
  else if (ph.kind === 'ladder') label = `R${run.currentRung}`;
  else if (ph.kind === 'rest') label = 'rest';
  else if (ph.kind === 'amrap') label = 'AMRAP';
  else if (ph.kind === 'warmup') label = 'ready';
  else if (ph.kind === 'finished') { prefix = '★ '; label = 'done'; }
  document.title = `${prefix}${body}${label ? ' · ' + label : ''}`;
}

// ---------- tap advance / pause / stop -------------------------------------
function tapAdvance() {
  if (!run || !workout) return;
  const ph = workout.phases[run.phaseIdx];
  if (!ph) return;

  if (ph.kind === 'amrap') {
    run.rounds += 1;
    sfx.roundClear();
    monkey.setPose('cheer');
    setTimeout(() => monkey.setPose('idle'), 500);
    roundPill.textContent = `RND ${run.rounds}`;
    if (voice.enabled && run.rounds % 3 === 0) {
      const enc = voice.encouragement('roundComplete');
      if (enc) voice.say(enc);
    }
    return;
  }
  if (ph.kind === 'reps') {
    const split = performance.now() - run.totalStart;
    run.splits.push({
      label: `${ph.exercise?.reps || ''} ${ph.exercise?.name || ''}`.trim(),
      ms: split,
    });
    sfx.roundClear();
    monkey.setPose('cheer');
    setTimeout(() => {
      const enc = voice.encouragement('roundComplete');
      if (enc && Math.random() < 0.5) voice.say(enc);
    }, 200);
    enterPhase(run.phaseIdx + 1);
  }
}

// Ladder free-climb: record a visit at the current rung, then optionally
// move up/down. The user freely steers; workout ends when the time cap
// expires. Visit counts are tallied for the stage-clear summary.
// Record a visit (no SFX here — the caller picks a directional sound so
// UP / AGAIN / DOWN each feel distinct).
function ladderRecordVisit() {
  if (!run || !workout) return false;
  const ph = workout.phases[run.phaseIdx];
  if (ph?.kind !== 'ladder') return false;
  const r = run.currentRung;
  run.rungVisits[r] = (run.rungVisits[r] || 0) + 1;
  run.splits.push({ rung: r, ms: performance.now() - run.phaseStart });
  monkey.setPose('cheer');
  setTimeout(() => monkey.setPose('idle'), 300);
  return true;
}

// Finish all remaining sets in the current round of a reps workout —
// records splits for each skipped set and jumps to the first phase of the
// next round (or to the finished phase if we were on the last round).
function finishRound() {
  if (!run || !workout) return;
  const ph = workout.phases[run.phaseIdx];
  if (ph?.kind !== 'reps') return;
  const curRound = ph.round;
  // Record splits for every set in this round from the current onward.
  let target = run.phaseIdx;
  for (let i = run.phaseIdx; i < workout.phases.length; i++) {
    const p = workout.phases[i];
    if (p.kind !== 'reps' || p.round !== curRound) { target = i; break; }
    run.splits.push({
      label: `${p.exercise?.reps || ''} ${p.exercise?.name || ''}`.trim(),
      ms: performance.now() - run.totalStart,
    });
    target = i + 1;
  }
  sfx.roundClear();
  monkey.setPose('cheer');
  setTimeout(() => monkey.setPose('idle'), 300);
  enterPhase(target);
}

function ladderRefresh(ph) {
  updateLabels(ph);
  marqueeText.textContent = phaseMarquee(ph);
  renderLevelMap();
}

function ladderUp() {
  if (!ladderRecordVisit()) return;
  const ph = workout.phases[run.phaseIdx];
  run.currentRung += 1;
  sfx.ladderUp();
  if (voice.enabled) voice.say(`Rung ${run.currentRung}.`);
  ladderRefresh(ph);
}

function ladderStay() {
  if (!ladderRecordVisit()) return;
  const ph = workout.phases[run.phaseIdx];
  sfx.ladderStay();
  if (voice.enabled) voice.say('Again.');
  ladderRefresh(ph);
}

function ladderDown() {
  if (!ladderRecordVisit()) return;
  const ph = workout.phases[run.phaseIdx];
  if (run.currentRung > 1) {
    run.currentRung -= 1;
    sfx.ladderDown();
    if (voice.enabled) voice.say(`Rung ${run.currentRung}.`);
  } else {
    sfx.ladderStay(); // already at floor
  }
  ladderRefresh(ph);
}

function togglePause() {
  if (!run) return;
  if (run.paused) resumeRun(); else pauseRun();
}
function pauseRun() {
  if (!run || run.paused) return;
  run.paused = true;
  run.pausedAt = performance.now();
  sfx.pauseSfx();
  voice.cancel();
  pauseBtn.textContent = 'RESUME';
  marqueeText.textContent = 'PAUSED';
}
function resumeRun() {
  if (!run || !run.paused) return;
  const dur = performance.now() - run.pausedAt;
  run.phaseStart += dur;
  run.totalStart += dur;
  run.paused = false;
  sfx.resumeSfx();
  pauseBtn.textContent = 'PAUSE';
  const ph = workout.phases[run.phaseIdx];
  marqueeText.textContent = phaseMarquee(ph);
}

function stopRun(silent = false) {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
  if (!silent) sfx.fail();
  voice.cancel();
  run = null;
  workout = null;
  monkey.setPose('idle');
  stage.setAttribute('data-phase', 'idle');
  marqueeText.textContent = 'READY';
  timerEl.textContent = '00:00';
  exerciseRepsEl.textContent = '';
  exerciseNameEl.textContent = 'PRESS START';
  upnextEl.textContent = '';
  progressFill.style.width = '0%';
  roundPill.textContent = 'RND 0/0';
  levelMapEl.hidden = true;
  levelMapEl.replaceChildren();
  timeWorkedEl.hidden = true;
  document.title = 'MWEDONDAY';
  showControls('idle');
  releaseWakeLock();
}

function showControls(state) {
  if (state === 'idle') {
    document.body.classList.remove('running');
    startBtn.hidden = false;     // lives in config section now
    pauseBtn.hidden = true;
    advanceBtn.hidden = true;
    finishRoundBtn.hidden = true;
    upBtn.hidden = true;
    stayBtn.hidden = true;
    downBtn.hidden = true;
    stopBtn.hidden = true;
  } else if (state === 'running') {
    document.body.classList.add('running');
    startBtn.hidden = true;
    pauseBtn.hidden = false;
    stopBtn.hidden = false;
    // up/down vs advance is set per-phase in enterPhase()
  }
}

function finish() {
  // Should be caught by 'finished' phase, but be safe
  enterPhase(workout.phases.length - 1);
}

function onFinished() {
  clearInterval(tickHandle); tickHandle = null;
  sfx.finishFanfare();
  monkey.setPose('cheer');
  marqueeText.textContent = 'STAGE CLEAR';
  exerciseNameEl.textContent = 'STAGE CLEAR';
  exerciseRepsEl.textContent = '';
  upnextEl.textContent = '';
  progressFill.style.width = '100%';
  // Blank the background timer so it doesn't peek through the stage-clear
  // modal showing 00:00 or some half-finished value.
  timerEl.textContent = '';
  timeWorkedEl.hidden = true;
  // Capture the final phase's elapsed and render one last map
  if (run && run.phaseIdx >= 0) {
    run.phaseTimes[run.phaseIdx] = performance.now() - run.phaseStart;
  }
  renderLevelMap();
  setTimeout(() => {
    if (voice.enabled) {
      const enc = voice.encouragement('finish');
      if (enc) voice.say(enc);
    }
  }, 600);
  document.title = '★ STAGE CLEAR — MWEDONDAY';
  logCompletedWorkout();
  showStageClear();
  showControls('idle');
  releaseWakeLock();
}

const MODE_ICONS = { circuit: '⏱', amrap: '∞', reps: '#', ladder: '▲' };

function logCompletedWorkout() {
  if (!workout) return;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  let stat = '';
  if (workout.kind === 'circuit')      stat = `${workout.totalCycles} cycles · ${fmtTime((workout.totalCycles*30 || 0)*1000)}`; // placeholder; recompute properly below
  if (workout.kind === 'amrap')        stat = `${run.rounds} rounds · ${fmtTime(workout.durationMs)}`;
  if (workout.kind === 'reps') {
    const total = run.splits.at(-1)?.ms || 0;
    stat = `${run.splits.length} exercises · ${fmtTimeCs(total)}`;
  }
  if (workout.kind === 'ladder') {
    const visits = run.rungVisits || {};
    const totalSets = Object.values(visits).reduce((a, b) => a + b, 0);
    const uniqueRungs = Object.keys(visits).length;
    stat = `${totalSets} sets · ${uniqueRungs} rungs · ${fmtTime(workout.timeCapMs)}`;
  }
  // Recompute circuit total properly from the actual config
  if (workout.kind === 'circuit') {
    const cfg = readConfigFromUI();
    const c = cfg.circuit;
    const exCount = (c.exercises || []).length || 1;
    const works = c.cycles * exCount;
    const totalSec = (c.warmupSec || 0) + works * c.workSec + Math.max(0, works - 1) * c.restSec;
    stat = `${c.cycles} × ${exCount} ex · ${fmtTime(totalSec * 1000)}`;
  }
  // Capture a shareable URL snapshot of the config that produced this entry
  const cfgSnapshot = readConfigFromUI();
  sessionHistory.push({
    mode: workout.kind,
    icon: MODE_ICONS[workout.kind] || '★',
    stat,
    time,
    hash: '#' + encodeHash(cfgSnapshot),
  });
  renderSessionLog();
}

function renderSessionLog() {
  if (!sessionHistory.length) {
    sessionLogEl.hidden = true;
    return;
  }
  sessionLogEl.hidden = false;
  logListEl.replaceChildren();
  // Show newest first
  for (let i = sessionHistory.length - 1; i >= 0; i--) {
    const entry = sessionHistory[i];
    const li = document.createElement('li');
    li.title = 'Click to reload this workout config';
    li.style.cursor = 'pointer';
    const icon = document.createElement('span'); icon.className = 'log-icon'; icon.textContent = entry.icon;
    const body = document.createElement('span'); body.className = 'log-body';
    const mode = document.createElement('span'); mode.className = 'log-mode'; mode.textContent = entry.mode;
    const stat = document.createElement('span'); stat.className = 'log-stat'; stat.textContent = entry.stat;
    body.append(mode, stat);
    const time = document.createElement('span'); time.className = 'log-time'; time.textContent = entry.time;
    li.append(icon, body, time);
    li.addEventListener('click', () => {
      const cfg = decodeHash(entry.hash);
      if (cfg) { writeConfigToUI(cfg); updateShareUrl(); updateSummaries(); }
    });
    logListEl.appendChild(li);
  }
}

function showStageClear() {
  scStats.replaceChildren();
  const rows = [];
  // Just the accomplishments — no clock numbers. Time is saved in the
  // session log if the user wants to look back.
  if (workout.kind === 'circuit') {
    const cfg = readConfigFromUI();
    const ex = (cfg.circuit?.exercises || []).length || 0;
    rows.push(['CYCLES', String(workout.totalCycles)]);
    if (ex > 0) rows.push(['SETS', String(workout.totalCycles * ex)]);
  } else if (workout.kind === 'amrap') {
    rows.push(['ROUNDS', String(run.rounds)]);
  } else if (workout.kind === 'reps') {
    rows.push(['EXERCISES', String(run.splits.length)]);
  } else if (workout.kind === 'ladder') {
    const visits = run.rungVisits || {};
    const totalSets = Object.values(visits).reduce((a, b) => a + b, 0);
    const uniqueRungs = Object.keys(visits).length;
    rows.push(['SETS', String(totalSets)]);
    rows.push(['RUNGS', String(uniqueRungs)]);
    const sorted = Object.entries(visits).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length) {
      rows.push(['TOP RUNGS', sorted.map(([r, n]) => `${r}×${n}`).join(', ')]);
    }
  }
  rows.forEach(([k,v]) => {
    const row = document.createElement('div');
    row.className = 'sc-stat-row';
    const a = document.createElement('span'); a.textContent = k;
    const b = document.createElement('span'); b.textContent = v;
    row.append(a, b);
    scStats.appendChild(row);
  });
  stageClearEl.hidden = false;
}

// ---------- wake lock ------------------------------------------------------
async function requestWakeLock() {
  try {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {}
}
function releaseWakeLock() {
  if (wakeLock) { wakeLock.release(); wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && prefs.wake && run) requestWakeLock();
});

// ---------- config summaries (total-time preview) -------------------------
function updateSummaries() {
  const cfg = readConfigFromUI();
  if (cfg.circuit) {
    const c = cfg.circuit;
    const cycles = Math.max(0, c.cycles);
    const exCount = (c.exercises || []).length || 1;
    const works = cycles * exCount;
    const totalSec = (c.warmupSec || 0)
      + works * (c.workSec || 0)
      + Math.max(0, works - 1) * (c.restSec || 0);
    const el = $('#c-summary');
    if (el) el.innerHTML = `${cycles} × ${exCount} EX · TOTAL <strong>${fmtTime(totalSec * 1000)}</strong>`;
  }
  if (cfg.amrap) {
    const totalSec = (cfg.amrap.warmupSec || 0) + (cfg.amrap.minutes || 0) * 60;
    const el = $('#a-summary');
    if (el) el.innerHTML = `TOTAL TIME <strong>${fmtTime(totalSec * 1000)}</strong>`;
  }
  if (cfg.ladder) {
    const cap = Math.max(1, cfg.ladder.timeCapMin || 10);
    const startRung = cfg.ladder.startRung || 1;
    const el = $('#l-summary');
    if (!el) return;
    const totalSec = (cfg.ladder.warmupSec || 0) + cap * 60;
    el.innerHTML = `START RUNG ${startRung} · TIME CAP <strong>${fmtTime(totalSec * 1000)}</strong>`;
  }
}

// ---------- share URL ------------------------------------------------------
function updateShareUrl() {
  const cfg = readConfigFromUI();
  const hash = '#' + encodeHash(cfg);
  history.replaceState(null, '', hash);
}

async function copyShare() {
  updateShareUrl();
  try {
    await navigator.clipboard.writeText(location.href);
    shareStatus.textContent = 'COPIED!';
  } catch {
    shareStatus.textContent = 'COPY MANUALLY';
  }
  setTimeout(() => { shareStatus.textContent = ''; }, 2000);
  sfx.buttonTap();
}

// ---------- settings UI ----------------------------------------------------
function populateVoices() {
  optVoice.replaceChildren();
  const voices = voice.availableVoices();
  if (!voices.length) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = '(loading…)';
    optVoice.appendChild(opt);
    return;
  }
  for (const v of voices) {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.name === voice.voice) opt.selected = true;
    optVoice.appendChild(opt);
  }
}

// ---------- wire-up --------------------------------------------------------
function bindUI() {
  $$('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      setMode(card.dataset.mode);
      updateShareUrl();
      updateSummaries();
    });
  });

  // Mode form changes auto-update URL
  ['#c-warmup','#c-work','#c-rest','#c-cycles','#c-exercises',
   '#a-warmup','#a-mins','#a-exercises',
   '#r-warmup','#r-rounds','#r-exercises',
   '#l-warmup','#l-top','#l-start','#l-timecap','#l-exercises'].forEach(sel => {
     const el = $(sel);
     if (!el) return;
     el.addEventListener('input',  () => { updateShareUrl(); updateSummaries(); });
     el.addEventListener('change', () => { updateShareUrl(); updateSummaries(); });
   });

  startBtn.addEventListener('click', () => {
    voice.unlock();
    sfx.buttonTap();
    startWorkout();
  });
  pauseBtn.addEventListener('click', togglePause);
  advanceBtn.addEventListener('click', tapAdvance);
  upBtn.addEventListener('click',   ladderUp);
  stayBtn.addEventListener('click', ladderStay);
  downBtn.addEventListener('click', ladderDown);
  finishRoundBtn.addEventListener('click', finishRound);
  stopBtn.addEventListener('click', () => {
    stopModal.showModal();
  });
  stopModal.addEventListener('close', () => {
    if (stopModal.returnValue === 'stop') stopRun();
  });
  shareBtn.addEventListener('click', copyShare);

  // Settings modal
  settingsBtn.addEventListener('click', () => {
    populateVoices();
    settingsModal.showModal();
  });
  optMonkey.addEventListener('change', () => {
    prefs.monkeyMode = optMonkey.checked;
    voice.enabled = prefs.monkeyMode;
    if (prefs.monkeyMode) { voice.unlock(); voice.say('Monkey mode on'); }
    else voice.cancel();
    savePrefs();
  });
  optSfx.addEventListener('change', () => {
    prefs.sfx = optSfx.checked; sfx.enabled = prefs.sfx; savePrefs();
  });
  optWake.addEventListener('change', () => {
    prefs.wake = optWake.checked;
    if (prefs.wake && run) requestWakeLock(); else releaseWakeLock();
    savePrefs();
  });
  optCrt.addEventListener('change', () => {
    prefs.crt = optCrt.checked;
    document.body.classList.toggle('crt', prefs.crt);
    savePrefs();
  });
  optVoice.addEventListener('change', () => {
    prefs.voiceName = optVoice.value;
    voice.setVoice(optVoice.value);
    savePrefs();
    // Sample
    if (voice.enabled) voice.say('Hello! Ready to train?');
  });
  // Raw test: simplest possible speak() call. No watchdog, no cancel, no
  // fallback, no helpers. Just create utterance, call speak(), observe.
  $('#opt-test-raw').addEventListener('click', () => {
    const status = $('#opt-test-status');
    const log = (s) => { status.textContent = s; console.log('[RAW]', s); };
    console.log('[RAW] === click ===');
    if (typeof speechSynthesis === 'undefined') { log('NO API'); return; }
    console.log('[RAW] state before: speaking=', speechSynthesis.speaking, 'pending=', speechSynthesis.pending, 'paused=', speechSynthesis.paused);
    // Hard reset any stuck queue first
    try { speechSynthesis.cancel(); } catch {}
    setTimeout(() => {
      console.log('[RAW] state after cancel: speaking=', speechSynthesis.speaking, 'pending=', speechSynthesis.pending, 'paused=', speechSynthesis.paused);
      const u = new SpeechSynthesisUtterance('Testing one two three.');
      // Do NOT set u.voice — let browser pick default
      u.onstart = () => { log('RAW onstart fired ✓'); console.log('[RAW] onstart'); };
      u.onend   = () => { log('RAW onend fired ✓');   console.log('[RAW] onend');   };
      u.onerror = (e) => { log('RAW onerror: ' + (e?.error || 'unknown')); console.log('[RAW] onerror', e); };
      try {
        speechSynthesis.speak(u);
        console.log('[RAW] speak() returned, speaking=', speechSynthesis.speaking, 'pending=', speechSynthesis.pending);
        log('speak() called, watching for events…');
      } catch (e) {
        log('THREW: ' + (e?.message || e));
      }
    }, 400);
  });

  $('#opt-test').addEventListener('click', () => {
    const status = $('#opt-test-status');
    const log = (s) => { status.textContent = s; console.log('[SAY HI]', s); };

    console.log('[SAY HI] === click ===');
    console.log('[SAY HI] speechSynthesis available?', typeof speechSynthesis !== 'undefined');
    if (typeof speechSynthesis !== 'undefined') {
      console.log('[SAY HI] state: speaking=', speechSynthesis.speaking, 'pending=', speechSynthesis.pending, 'paused=', speechSynthesis.paused);
      console.log('[SAY HI] voices total=', speechSynthesis.getVoices().length);
    }

    voice.unlock();
    voice.enabled = true;
    optMonkey.checked = true;
    prefs.monkeyMode = true;
    savePrefs();

    if (typeof speechSynthesis === 'undefined') { log('NO SPEECHSYNTHESIS API'); return; }
    const voices = voice.availableVoices();
    log(`VOICES=${voices.length} · calling voice.say() — watch console for trace`);
    voice.say('Hello! Ready to train.');
  });

  $$('#opt-tone button').forEach(btn => {
    btn.addEventListener('click', () => {
      prefs.tone = btn.dataset.tone;
      voice.tone = btn.dataset.tone;
      $$('#opt-tone button').forEach(b => b.dataset.selected = (b === btn) ? 'true' : 'false');
      savePrefs();
      const enc = voice.encouragement('idle') || voice.encouragement('workStart');
      if (voice.enabled && enc) voice.say(enc);
    });
  });

  scClose.addEventListener('click', () => { stageClearEl.hidden = true; scShareStatus.textContent = ''; });
  scShareBtn.addEventListener('click', async () => {
    updateShareUrl();
    try {
      await navigator.clipboard.writeText(location.href);
      scShareStatus.textContent = 'COPIED!';
    } catch {
      scShareStatus.textContent = 'COPY FAILED — URL IS IN ADDRESS BAR';
    }
    sfx.buttonTap();
    setTimeout(() => { scShareStatus.textContent = ''; }, 2500);
  });

  // Mark voice as unlocked on the first user interaction anywhere.
  // SpeechSynthesis silently no-ops before a gesture on Safari (and is flaky
  // on some Android builds). Wait until we have one.
  const unlockOnce = () => {
    voice.unlock();
    document.removeEventListener('pointerdown', unlockOnce);
    document.removeEventListener('keydown', unlockOnce);
  };
  document.addEventListener('pointerdown', unlockOnce, { once: false });
  document.addEventListener('keydown', unlockOnce, { once: false });

  // Keyboard shortcuts (desktop)
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (!run) { startWorkout(); e.preventDefault(); }
      else if (!advanceBtn.hidden) { tapAdvance(); e.preventDefault(); }
      else { togglePause(); e.preventDefault(); }
    } else if (e.key === 'Escape') {
      if (run) stopModal.showModal();
    }
  });
}

// ---------- init -----------------------------------------------------------
function init() {
  applyPrefs();
  bindUI();

  // Try to load shared config
  const hashCfg = decodeHash(location.hash);
  if (hashCfg) writeConfigToUI(hashCfg);
  else setMode('circuit', false);

  updateShareUrl();
  updateSummaries();

  // Voice list: subscribe to Voice's own change events instead of touching
  // speechSynthesis.onvoiceschanged directly (which would clobber Voice's
  // internal handler).
  populateVoices();
  voice.onVoicesChanged(() => populateVoices());

  // No greeting before user interaction — Safari requires a gesture, and a
  // failed first utterance leaves the synth in a flaky state on Chrome.
}

init();
