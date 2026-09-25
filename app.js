// RomFit — app (vues, programme, progression, planning, suivi). Données stockées sur le téléphone.

const APP_VERSION = 'v29';

// ─────────────────────────── Stockage
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('romfit2:' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('romfit2:' + key, JSON.stringify(value)); } catch { toast('Mémoire du téléphone pleine : exporte une sauvegarde.'); }
  },
};

const KEYS = ['settings', 'loads', 'logs', 'plan', 'hours', 'health', 'weights', 'chat', 'reviews', 'feedback', 'active', 'runPlace', 'optChoice', 'sleepNotes'];
const state = {
  settings: store.get('settings', { name: '', week: DEFAULT_WEEK, hour: '12:30', apiKey: '', model: '', zone: null, profile: {} }),
  loads: store.get('loads', {}),        // charge de travail actuelle par exercice
  logs: store.get('logs', []),          // séances réalisées
  plan: store.get('plan', {}),          // semaines modifiées (glisser-déposer, coach)
  hours: store.get('hours', {}),        // heure prévue par jour
  health: store.get('health', {}),      // données Santé importées par jour
  weights: store.get('weights', []),    // pesées
  chat: store.get('chat', []),
  reviews: store.get('reviews', {}),    // bilans hebdo du coach
  feedback: store.get('feedback', []),  // retours sur l'app
  active: store.get('active', null),    // séance en cours
  runPlace: store.get('runPlace', {}),  // tapis ou dehors, par jour
  optChoice: store.get('optChoice', {}), // vélo / marche inclinée / reformer, par jour
  sleepNotes: store.get('sleepNotes', {}), // analyses du sommeil par le coach
  view: 'today', weekOffset: 0, sheet: null, video: null, rest: null, chartEx: 'hip-thrust', mealsOpen: false, busy: false,
};
const save = (...keys) => (keys.length ? keys : KEYS).forEach((k) => store.set(k, state[k]));

// ─────────────────────────── Utilitaires
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const dayIdx = (d = new Date()) => (d.getDay() + 6) % 7; // 0 = lundi
const weekStart = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - dayIdx(x)); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAYS3 = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const fmtDay = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const fmtNum = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
const parseNum = (s) => { const v = parseFloat(String(s).replace(',', '.')); return isNaN(v) ? null : v; };
const fmtClock = (s) => `${Math.floor(s / 60)}:${pad(Math.max(0, s) % 60)}`;
const hToStr = (h) => { const hh = Math.floor(h); const mm = Math.round((h - hh) * 60 / 15) * 15; return mm === 60 ? `${hh + 1} h` : mm ? `${hh} h ${pad(mm)}` : `${hh} h`; };
const strToH = (s) => { const [h, m] = (s || '12:30').split(':').map(Number); return h + (m || 0) / 60; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const roundTo = (v, step) => (step ? Math.round(v / step) * step : v);

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

const IC = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  coach: '<path d="M20 11.5c0 4-3.6 7-8 7-1.2 0-2.3-.2-3.3-.6L4 19l1.2-3.6C4.4 14.3 4 13 4 11.5c0-4 3.6-7 8-7s8 3 8 7z"/>',
  chart: '<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>',
  dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  run: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2.5V22M5.5 11l3-3h4.5l2 3 3 1M11 15l2-7"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.6-8.3.5 1.7 1.4 2.8 2.6 3.4.2-2.6 1.4-5 3.3-6.4-.2 3.3 3.5 5.8 3.5 10.8 0 3.8-2.6 6.7-6.5 6.7z"/>',
  food: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M16.5 21V3c-2.2 1.2-3.5 3.8-3.5 7v3h3.5"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevR: '<path d="m9.5 6 6 6-6 6"/>',
  chevL: '<path d="m14.5 6-6 6 6 6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  swap: '<path d="M7 4 3.5 7.5 7 11M3.5 7.5H17M17 20l3.5-3.5L17 13M20.5 16.5H7"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 15-5-4.5L6 19"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16 9.5 9h5L18 16M9.5 9 8 6H6M12 16l2.5-7"/>',
  sparkle: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9-5.7-1.8L10.2 9z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10.5 5-3v9l-5-3z"/>',
  arrowUp: '<path d="M7 17 17 7M9 7h8v8"/>',
  move: '<path d="M4 12h13M13 7l5 5-5 5"/>',
  watch: '<rect x="6.5" y="6" width="11" height="12" rx="3"/><path d="M9 6V3h6v3M9 18v3h6v-3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1.5A2.5 2.5 0 0 0 7.5 10H8M16 6h3v1.5A2.5 2.5 0 0 1 16.5 10H16M12 13v4M8.5 20h7M10 17h4"/>',
  grip: '<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 10a5 5 0 0 1 7 0M12 10l1.2-1.6"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6zM9 4v14M15 6v14"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
};
const ic = (n, size = 20, color = 'currentColor', sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

// ─────────────────────────── Programme
const START = parseKey(PROGRAM_START);
const weekNo = (d = new Date()) => Math.max(1, Math.min(15, Math.floor((weekStart(d) - START) / (7 * 864e5)) + 1));
const phaseFor = (w) => PHASES.find((p) => w >= p.from && w <= p.to) || PHASES[PHASES.length - 1];
const variantFor = (w) => (w % 2 ? 'A' : 'B');
const wkKey = (d) => dateKey(weekStart(d));

// Semaine type : jusqu'à la semaine 4, puis 2 courses par semaine à partir de la semaine 5
function defaultWeek(d = new Date()) {
  const arr = Array(7).fill(null);
  const tpl = weekNo(d) >= TWO_RUNS_FROM_WEEK ? (state.settings.week2 || DEFAULT_WEEK_2) : state.settings.week;
  Object.entries(tpl).forEach(([i, key]) => { if (key) arr[+i] = { key }; });
  return arr;
}
const weekPlan = (d) => state.plan[wkKey(d)] || defaultWeek(d);
const slotFor = (d) => weekPlan(d)[dayIdx(d)];
function setWeekPlan(d, arr) { state.plan[wkKey(d)] = arr; save('plan'); }

function plannedLoad(id, week) {
  const ex = EXERCISES[id];
  if (ex.bodyweight) return null;
  const v = state.loads[id] ?? ex.base;
  return phaseFor(week).deload && ex.unit !== 'time' ? Math.floor(v * 0.9 / (ex.inc || 1)) * (ex.inc || 1) : v;
}

// Construit la séance d'un jour à partir de son créneau
function sessionFor(d, slot = slotFor(d)) {
  if (!slot) return null;
  const week = weekNo(d);
  if (slot.custom) {
    // Pause kiné : une séance du coach qui contenait des exercices épaules/bras est remplacée par la séance jambes complète
    const ids = slot.custom.exercise_ids || [];
    if (inRehab(d) && ids.some((id) => ARMS_LOAD.includes(id))) return { ...sessionFor(d, { key: 'upper' }), replacedCustom: true };
    return normalizeCustom(slot.custom, week, d);
  }
  const def = SESSIONS[slot.key];
  if (!def) return null;
  const dk = dateKey(d);
  const base = { key: slot.key, name: def.name, kind: def.kind, week, optional: !!def.optional, date: dk };
  if (def.kind === 'salle') {
    // Pause kiné : « haut du corps » devient une 2e séance jambes/fessiers, sans charge sur épaules et bras
    if (inRehab(d)) {
      const v = slot.key === 'upper' ? 'R2' : 'R1';
      const lower = SESSIONS.lower;
      return { ...base, key: slot.key, name: `${lower.name} ${v === 'R1' ? '1' : '2'}`, rehab: true, variant: v, minutes: 50, exercises: lower[v].map((id) => ({ id, sets: setsFor(week, EXERCISES[id]), load: plannedLoad(id, week) })) };
    }
    const variant = variantFor(week);
    return { ...base, variant, minutes: def.minutes, exercises: def[variant].map((id) => ({ id, sets: setsFor(week, EXERCISES[id]), load: plannedLoad(id, week) })) };
  }
  if (def.kind === 'course') {
    const r = slot.key === 'long' ? RUN_TYPES.longue(LONG_PLAN[week] || 5) : RUN_PLAN[week];
    const place = state.runPlace[dk] || r.place;
    const steps = r.steps.map(([label, min]) => ({ label, min }));
    return { ...base, name: r.name, km: r.km, place, minutes: steps.reduce((n, x) => n + x.min, 0), steps, tip: RUN_TIP[place] };
  }
  // Séance optionnelle : l'activité choisie (vélo, marche inclinée, reformer)
  const choice = state.optChoice[dk];
  const c = OPTIONAL_CHOICES[choice];
  return { ...base, name: c ? c.label : def.name, choice: choice || null, minutes: c ? c.min : def.minutes, steps: c ? [{ label: c.label, min: c.min, text: c.text }] : [] };
}

const inRehab = (d) => { const k = dateKey(d); return typeof REHAB !== 'undefined' && k >= REHAB.from && k <= REHAB.to; };
// Exercices qui sollicitent épaules ou bras (retirés des séances du coach pendant la pause kiné)
const ARMS_LOAD = ['tirage-vertical', 'tirage-horizontal', 'rowing-haltere', 'developpe-epaules', 'triceps-poulie', 'pallof-press', 'pompes-inclinees', 'elevations-laterales', 'curl-halteres', 'gainage', 'gainage-lateral', 'crunch-poulie', 'goblet-squat', 'rdl-halteres', 'fentes-bulgares', 'step-up', 'pull-through'];

function normalizeCustom(c, week, d) {
  const ids = (c.exercise_ids || []).filter((id) => EXERCISES[id] && !(d && inRehab(d) && ARMS_LOAD.includes(id)));
  if (ids.length) {
    return { key: 'custom', name: c.name, kind: 'salle', week, custom: true, minutes: c.minutes || 45, exercises: ids.map((id) => ({ id, sets: setsFor(week, EXERCISES[id]), load: plannedLoad(id, week) })) };
  }
  const steps = (c.steps || []).map((s) => ({ label: s.label, min: s.minutes || s.min || 0 }));
  return { key: 'custom', name: c.name, kind: c.kind === 'salle' ? 'douce' : (c.kind || 'course'), week, custom: true, minutes: c.minutes || steps.reduce((n, s) => n + s.min, 0), steps, tip: c.tip || '' };
}

const logsOn = (d) => state.logs.filter((l) => l.dateKey === dateKey(d));
const doneOn = (d) => logsOn(d).length > 0;

function weekStats(d = new Date()) {
  const ws = weekStart(d);
  const logs = state.logs.filter((l) => { const t = parseKey(l.dateKey); return t >= ws && t < addDays(ws, 7); });
  const main = Math.min(3, logs.filter((l) => !l.optional).length);
  return { main, optional: logs.some((l) => l.optional), logs };
}

// Progression : +1 palier quand toutes les répétitions sont réussies (sauf si la charge a été changée pendant la séance)
function applyProgression(log) {
  const week = weekNo(parseKey(log.dateKey));
  if (phaseFor(week).deload) return [];
  const ups = [];
  (log.exercises || []).forEach((e) => {
    const ex = EXERCISES[e.id];
    if (!ex || ex.bodyweight || e.changed) return;
    const done = e.sets.filter((s) => s.done);
    if (!done.length || done.length < e.sets.length) return;
    const top = ex.unit === 'time' ? (plannedLoad(e.id, week) || ex.base) : ex.reps[1];
    if (done.every((s) => (parseNum(s.reps) || 0) >= top)) {
      const cur = state.loads[e.id] ?? ex.base;
      const next = ex.unit === 'time' ? Math.min(60, cur + ex.inc) : roundTo(cur + ex.inc, ex.inc);
      if (next !== cur) { state.loads[e.id] = next; ups.push(`${ex.name} : ${fmtNum(next)}${ex.unit === 'time' ? ' s' : ' kg'}`); }
    }
  });
  save('loads');
  return ups;
}

function lastPerf(id) {
  for (let i = state.logs.length - 1; i >= 0; i--) {
    const e = (state.logs[i].exercises || []).find((x) => x.id === id);
    if (e && e.sets.some((s) => s.done)) return e.sets.filter((s) => s.done);
  }
  return null;
}

// ─────────────────────────── Repas selon l'heure de la séance
function mealPlan(d, session) {
  const F = FOODS;
  const m = (h, f, hl) => ({ h, title: f[0], text: f[1], prot: f[2] });
  if (!session || session.optional) {
    return { head: session ? 'Jour d’activité douce' : 'Jour de repos', meals: [m(8, F.breakfast), m(12.5, F.lunch), m(16.5, F.snack), m(20, F.dinner)] };
  }
  const h = strToH(state.hours[dateKey(d)] || state.settings.hour);
  let meals;
  if (h < 10) {
    meals = [m(h - 0.75, F.pre), m(h + 1.25, ['Petit-déjeuner de récupération', '150 g de skyr, 40 g de flocons d’avoine, fruits rouges et 2 œufs', 30]), m(13, F.lunch), m(16.5, F.snack), m(20, F.dinner)];
  } else if (h < 14.5) {
    meals = [m(8, F.breakfast), m(Math.max(9.5, h - 1.5), F.pre), m(h + 1.25, F.post), m(16.5, F.snack), m(20, F.dinner)];
  } else if (h < 17) {
    meals = [m(8, F.breakfast), m(12.5, F.lunch), ...(h - 1.5 >= 14 ? [m(h - 1.5, F.pre)] : []), m(h + 1.25, F.postSnack), m(20, F.dinner)];
  } else {
    meals = [m(8, F.breakfast), m(12.5, F.lunch), m(h - 1.5, F.pre), m(h + 1.5, F.dinnerPost)];
  }
  return { head: `Séance à ${hToStr(h)}`, meals };
}

// ─────────────────────────── Composants
// Anneau : 3 quarts pour les séances prioritaires + 1 quart (pointillé) pour l'optionnelle
function ringSvg(done, optDone, size = 96) {
  const arc = (i) => {
    const a0 = (i * 90 + 11) * Math.PI / 180, a1 = ((i + 1) * 90 - 11) * Math.PI / 180;
    const p = (a) => `${(50 + 40 * Math.cos(a)).toFixed(2)} ${(50 + 40 * Math.sin(a)).toFixed(2)}`;
    return `M ${p(a0)} A 40 40 0 0 1 ${p(a1)}`;
  };
  let out = '';
  for (let i = 0; i < 3; i++) out += `<path d="${arc(i)}" fill="none" style="stroke: ${i < done ? 'var(--violet)' : '#E4DCFD'}" stroke-width="12" stroke-linecap="round"/>`;
  out += optDone
    ? `<path d="${arc(3)}" fill="none" style="stroke: var(--violet-mid)" stroke-width="12" stroke-linecap="round"/>`
    : `<path d="${arc(3)}" fill="none" style="stroke: var(--violet-mid)" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 7"/>`;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">${out}</svg>`;
}

const thumb = (id) => (VIDEOS[id] ? `https://i.ytimg.com/vi/${VIDEOS[id].videoId}/hqdefault.jpg` : null);
const kindIcon = { salle: ['dumbbell', 'var(--violet-soft)', 'var(--violet-text)'], course: ['run', 'var(--run-soft)', 'var(--run)'], douce: ['bike', '#F1EEF7', 'var(--sec)'] };

function tabbar() {
  const tabs = [['today', 'today', "Aujourd'hui"], ['planning', 'calendar', 'Planning'], ['sleep', 'moon', 'Sommeil'], ['coach', 'coach', 'Coach'], ['progress', 'chart', 'Progrès']];
  const cur = ['programme'].includes(state.view) ? 'planning' : state.view;
  return `<nav class="tabbar">${tabs.map(([v, i, l]) => `<button class="tab ${cur === v ? 'on' : ''}" data-act="tab" data-v="${v}">${ic(i, 26, 'currentColor', 1.9)}<span>${l}</span></button>`).join('')}</nav>`;
}

// ─────────────────────────── Vue : Aujourd'hui
function viewToday() {
  const now = new Date();
  const s = sessionFor(now);
  const stats = weekStats();
  const done = doneOn(now);
  let main = '';

  if (state.active) {
    main = `<section class="card stack" style="margin-top: 18px">
      <div class="hdr" style="color: var(--violet-text)">${ic('play', 14, 'var(--violet-text)')}Séance en cours</div>
      <div style="font-size: 22px; font-weight: 700">${esc(state.active.name)}</div>
      <div class="grid2" style="gap: 10px"><button class="btn p" data-act="resume">Reprendre</button>
      <button class="btn w" data-act="abandon" style="color: #C62F3C; box-shadow: inset 0 0 0 1px var(--sep)">${state.confirmAbandon ? 'Confirmer' : 'Abandonner'}</button></div>
      ${state.confirmAbandon ? '<div class="foot">La séance en cours sera supprimée sans rien enregistrer.</div>' : ''}
    </section>`;
  } else if (done) {
    const log = logsOn(now).slice(-1)[0];
    main = kudosCard(log, stats);
  } else if (s) {
    main = `
    <section class="card" style="margin-top: 18px; display: flex; align-items: center; gap: 18px; padding: 16px">
      ${ringSvg(stats.main, stats.optional)}
      <div class="stack grow" style="gap: 6px">
        <div class="hdr" style="color: var(--violet-text)">${ic('flame', 16, 'var(--violet-text)')}Cette semaine</div>
        <div><span class="big">${stats.main}</span><span class="unit"> sur 3 séances</span></div>
        <div class="foot">${stats.main >= 3 ? 'Semaine parfaite ! La 4e est un bonus.' : "+ 1 séance optionnelle si tu as l'énergie"}</div>
      </div>
    </section>
    <h2 class="sec">Séance du jour</h2>
    ${sessionCard(s, now)}`;
  } else {
    const next = nextSession(now);
    main = `
    <section class="card" style="margin-top: 18px; display: flex; align-items: center; gap: 18px; padding: 16px">
      ${ringSvg(stats.main, stats.optional)}
      <div class="stack grow" style="gap: 6px">
        <div class="hdr" style="color: var(--violet-text)">${ic('flame', 16, 'var(--violet-text)')}Cette semaine</div>
        <div><span class="big">${stats.main}</span><span class="unit"> sur 3 séances</span></div>
      </div>
    </section>
    <h2 class="sec">Jour de repos</h2>
    <section class="card stack">
      <div class="row"><div class="ico" style="background: #F1EEF7">${ic('moon', 17, 'var(--sec)')}</div>
      <div class="grow sub" style="color: var(--label)">Récupère bien : c'est pendant le repos que tes muscles se renforcent.</div></div>
      ${next ? `<div class="foot">Prochaine séance : <b style="color: var(--label)">${DAYS[dayIdx(next.d)]}</b> · ${esc(next.s.name)}</div>` : ''}
    </section>`;
  }

  return `
  ${state.healthPending && Date.now() - state.healthPending < 10 * 60000 ? `<section class="note" style="margin-bottom: 12px; align-items: center">${ic('watch', 18, 'var(--violet-text)')}<span class="grow">Le raccourci a copié tes données Santé.</span><button class="btn p sm" data-act="health-paste" style="height: 34px">Importer</button></section>` : ''}
  <div class="row" style="justify-content: space-between; align-items: flex-end">
    <div><div class="cap">${fmtDay(now)}</div><h1 class="lt">Aujourd'hui</h1></div>
    <div class="row" style="gap: 8px; margin-bottom: 4px">
      <button class="x" style="width: 36px; height: 36px; border-radius: 18px; background: #fff" data-act="reload" aria-label="Recharger l'app">${ic('refresh', 17, 'var(--violet-text)')}</button>
      <button class="x" style="width: 36px; height: 36px; border-radius: 18px; background: #fff" data-act="feedback" aria-label="Noter un retour sur l'app">${ic('pencil', 17, 'var(--violet-text)')}</button>
      <button data-act="tab" data-v="settings" aria-label="Réglages" style="width: 36px; height: 36px; border-radius: 18px; background: var(--violet); color: #fff; font-size: 15px; font-weight: 700">${esc((state.settings.name || '?')[0].toUpperCase())}</button>
    </div>
  </div>
  ${main}
  ${healthTiles(now)}
  ${mealsCard(now, s, done)}`;
}

function nextSession(from) {
  for (let k = 1; k <= 7; k++) {
    const d = addDays(from, k);
    const s = sessionFor(d);
    if (s) return { d, s };
  }
  return null;
}

// Tapis ou dehors (course)
function placePicker(s) {
  if (s.kind !== 'course' || s.custom) return '';
  return `<div class="seg" role="group" aria-label="Où cours-tu ?">
    ${[['tapis', 'Sur tapis'], ['dehors', 'Dehors']].map(([v, l]) => `<button class="${s.place === v ? 'on' : ''}" data-act="run-place" data-date="${s.date}" data-v="${v}">${l}</button>`).join('')}
  </div>`;
}

// Vélo, marche inclinée ou reformer (séance optionnelle)
function optPicker(s) {
  if (!s.optional || s.custom) return '';
  return `<div class="stack" style="gap: 6px">${s.choice ? '' : '<div class="foot" style="font-weight: 600">Choisis ton activité</div>'}
    <div class="row" style="gap: 8px; flex-wrap: wrap">${Object.entries(OPTIONAL_CHOICES).map(([v, c]) => `<button class="chip ${s.choice === v ? 'solid' : 'soft'}" data-act="opt-choice" data-date="${s.date}" data-v="${v}">${esc(c.label)}</button>`).join('')}</div>
  </div>`;
}

// Ce que la séance apporte à tes objectifs, d'après ses exercices
function whySession(s) {
  const out = [];
  if (s.exercises) {
    const m = {};
    s.exercises.forEach((e) => EXERCISES[e.id].muscles.forEach((x) => { m[x] = (m[x] || 0) + e.sets; }));
    const has = (k) => m[k] || 0;
    if (has('Fessiers')) out.push(`Fessiers : ${has('Fessiers')} séries dédiées, dont le hip thrust, l’exercice le plus efficace pour des fessiers plus fermes et plus ronds.`);
    if (has('Moyen fessier')) out.push('Haut et côté des fesses (moyen fessier) : donne du galbe et stabilise ton bassin et tes genoux à chaque foulée.');
    if (has('Cuisses') || has('Ischios')) out.push('Cuisses et ischios : des jambes plus solides, qui encaissent mieux l’impact de la course et protègent tes genoux.');
    if (has('Mollets')) out.push('Mollets : ils amortissent chaque foulée, les renforcer protège tes tibias et ton tendon d’Achille quand tu augmentes les kilomètres.');
    if (has('Abdos') || has('Obliques')) out.push('Abdos : un tronc gainé pour une meilleure posture en courant et moins de fatigue dans le dos.');
    if (has('Dos') || has('Épaules') || has('Biceps') || has('Triceps')) out.push('Haut du corps : dos et bras toniques, une posture plus droite, et l’équilibre avec le travail des jambes.');
    if (s.rehab) out.push('Rien pour les épaules et les bras : ils récupèrent pendant ta kiné.');
  } else if (s.kind === 'course') {
    const t = { 'Sortie longue': 'C’est elle qui te mène aux 10 km : semaine après semaine, ton endurance et la résistance de tes jambes augmentent.', 'Course lente': 'Endurance de base : ton cœur apprend à travailler sans s’emballer, et tes jambes s’habituent à l’impact en douceur.', 'Course progressive': 'Apprendre à accélérer en fin de sortie : plus de cardio et d’aisance, sans te mettre dans le rouge dès le début.', 'Fractionné': 'Des pointes de vitesse courtes : ton cardio progresse vite et tes jambes deviennent plus toniques.' };
    out.push(t[s.name] || 'Cardio et endurance : ta forme générale progresse séance après séance.');
    out.push('La course fait aussi travailler fessiers, mollets et cuisses à chaque foulée, en complément de la muscu.');
    if (s.km) out.push(`Objectif du jour : ${fmtNum(s.km)} km, pour progresser un peu chaque semaine.`);
  } else if (s.optional) {
    const t = {
      velo: ['Cardio sans impact : tu entretiens ton endurance tout en laissant tes articulations récupérer.', 'Travaille aussi les cuisses et les fessiers en douceur.'],
      marche: ['La marche inclinée sollicite fortement les fessiers et les mollets, sans l’impact de la course.', 'Cardio doux qui active la circulation dans les jambes.'],
      reformer: ['Travaille les muscles profonds et secondaires (gainage, stabilisateurs des hanches), souvent oubliés en salle.', 'Améliore ta posture et ta mobilité, utiles pour la course.'],
    };
    out.push(...(t[s.choice] || ['Une séance bonus pour bouger en douceur : vélo, marche inclinée ou reformer, au choix.']));
  }
  if (!out.length) return '';
  return `<div class="stack" style="gap: 6px; background: var(--violet-soft); border-radius: 12px; padding: 12px">
    <div class="hdr" style="color: var(--violet-text); font-size: 14px">${ic('sparkle', 15, 'var(--violet-text)')}Pourquoi cette séance</div>
    ${out.slice(0, 3).map((t) => `<div class="row" style="gap: 8px; align-items: flex-start; font-size: 14px; line-height: 19px">${ic('check', 16, 'var(--violet-text)', 2.6)}<span>${esc(t)}</span></div>`).join('')}
  </div>`;
}

function sessionCard(s, d) {
  const icon = kindIcon[s.kind] || kindIcon.douce;
  const phase = phaseFor(s.week);
  const thumbs = s.exercises ? s.exercises.slice(0, 3).map((e) => thumb(e.id)).filter(Boolean) : [];
  const hour = state.hours[dateKey(d)] || state.settings.hour;
  const meta = s.exercises
    ? `${s.exercises.length} exercices · environ ${s.minutes} min · Semaine ${s.week} · ${s.rehab ? 'Pause kiné' : phase.name}`
    : s.km ? `${fmtNum(s.km)} km · environ ${s.minutes} min · Semaine ${s.week}` : `${s.minutes} min · Semaine ${s.week}`;
  return `<section class="card" style="padding: 0; overflow: hidden">
    ${thumbs.length === 3 ? `<div class="grid3" style="gap: 2px">${thumbs.map((t) => `<img src="${t}" alt="" style="width: 100%; height: 104px; object-fit: cover" loading="lazy">`).join('')}</div>` : ''}
    <div class="stack" style="padding: 14px 16px 16px">
      <div class="row" style="gap: 8px">
        <span class="chip" style="background: ${icon[1]}; color: ${icon[2]}">${ic(icon[0], 15, icon[2])}${s.kind === 'salle' ? 'Salle' : s.kind === 'course' ? 'Course' : 'Activité douce'}</span>
        <span class="chip grey">${s.optional ? 'Optionnelle' : s.custom ? 'Adaptée par le coach' : s.rehab ? 'Pause kiné' : 'Prioritaire'}</span>
      </div>
      <div style="font-size: 22px; line-height: 27px; font-weight: 700">${esc(s.name)}</div>
      <div class="sub">${meta}</div>
      ${placePicker(s)}${optPicker(s)}
      ${whySession(s)}
      <button class="link" data-act="preview" data-date="${dateKey(d)}" style="font-size: 15px; font-weight: 600; align-self: flex-start">${s.exercises ? 'Voir les exercices' : 'Voir le déroulé'} ${ic('chevR', 14, 'var(--violet-text)', 2.4)}</button>
      <label class="row" style="background: var(--fill); border-radius: 12px; padding: 10px 12px; gap: 10px; font-size: 15px">
        ${ic('clock', 18, 'var(--violet-text)')}<span class="grow">Prévue à</span>
        <input type="time" value="${esc(hour)}" data-act="hour" data-date="${dateKey(d)}" aria-label="Heure prévue" style="border: 0; background: transparent; font-weight: 600; color: var(--violet-text); font-size: 15px; text-align: right">
      </label>
      <div class="grid2" style="gap: 10px; margin-top: 4px">
        <button class="btn p" data-act="start" data-date="${dateKey(d)}">${ic('play', 16, '#fff')}Commencer</button>
        <button class="btn t" data-act="other-sport">${ic('swap', 18, 'var(--violet-text)')}Autre sport</button>
      </div>
    </div>
  </section>`;
}

function kudosCard(log, stats) {
  const bits = [[18, 14, 8, 14, 20, '#B9A6FB'], [64, 38, 6, 6, 0, '#fff'], [120, 10, 7, 12, -25, '#F4B6D8'], [82, 72, 7, 12, 40, '#fff'], [250, 44, 7, 12, -15, '#F4B6D8'], [200, 8, 6, 6, 0, '#fff'], [160, 52, 8, 13, 50, '#B9A6FB'], [290, 20, 8, 14, 35, '#fff']];
  const conf = bits.map(([x, y, w, h, r, c], i) => `<div class="cf" style="left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px; border-radius: ${w === h ? '50%' : '2px'}; background: ${c}; transform: rotate(${r}deg); animation-delay: ${i * 0.2}s"></div>`).join('');
  const perfect = stats.main >= 3;
  const msgs = perfect
    ? ['3 séances sur 3 : ta semaine est parfaite.', 'Tes fessiers et tes jambes se renforcent séance après séance.']
    : [`${stats.main} séance${stats.main > 1 ? 's' : ''} sur 3 cette semaine.`, log.kind === 'course' ? 'Chaque sortie lente construit ton endurance.' : 'Chaque séance compte, continue comme ça.'];
  const sets = (log.exercises || []).reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const badges = [perfect ? `<span class="chip" style="background: #fff; color: var(--violet-text)">${ic('flame', 14, 'var(--violet-text)')}Semaine parfaite</span>` : '']
    .concat((log.ups || []).slice(0, 2).map((u) => `<span class="chip" style="background: #fff; color: var(--violet-text)">${ic('arrowUp', 14, 'var(--violet-text)', 2.4)}${esc(u)}</span>`)).join('');
  const tiles = [[log.durationMin, 'minutes'], sets ? [sets, 'séries'] : log.km ? [fmtNum(log.km), 'km'] : null, log.watch?.kcal ? [log.watch.kcal, 'kcal'] : null].filter(Boolean);
  return `<section class="kudos" style="margin-top: 18px" data-act="log-detail" data-id="${log.id}">
    ${conf}
    <div style="position: relative; width: 64px; height: 64px; border-radius: 32px; background: rgba(255,255,255,.18); display: flex; align-items: center; justify-content: center; margin-top: 12px">${ic('trophy', 32, '#fff')}</div>
    <div style="position: relative; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #E4DBFF; margin-top: 6px">Séance validée</div>
    <div style="position: relative; font-size: 28px; line-height: 33px; font-weight: 800">Bravo ${esc(state.settings.name || 'à toi')} !</div>
    <div style="position: relative; font-size: 16px; line-height: 22px; color: #F1ECFF; max-width: 300px">${msgs.join(' ')}</div>
    ${badges ? `<div style="position: relative; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 8px">${badges}</div>` : ''}
    <div style="position: relative; display: grid; grid-template-columns: repeat(${tiles.length}, minmax(0, 1fr)); gap: 8px; width: 100%; margin-top: 12px">
      ${tiles.map(([v, l]) => `<div style="background: rgba(255,255,255,.14); border-radius: 12px; padding: 10px 4px"><div style="font-size: 22px; font-weight: 800">${v}</div><div style="font-size: 12px; color: #E4DBFF">${l}</div></div>`).join('')}
    </div>
    <div style="position: relative; display: flex; align-items: center; gap: 4px; font-size: 15px; font-weight: 600; margin-top: 6px">Voir le détail ${ic('chevR', 16, '#fff', 2.4)}</div>
  </section>`;
}

function healthTiles(d) {
  const today = state.health[dateKey(d)] || {};
  const y = state.health[dateKey(addDays(d, -1))] || {};
  const sleep = today.sleepMin ?? null;
  const hr = today.restHR ?? y.restHR ?? null;
  const last = Object.keys(state.health).sort().pop();
  return `<h2 class="sec">Santé</h2>
  <div class="grid2">
    <section class="card stack" style="gap: 8px">
      <div class="hdr" style="color: var(--sleep)">${ic('moon', 16, 'var(--sleep)')}Sommeil</div>
      ${sleep != null ? `<div><span class="big">${Math.floor(sleep / 60)}</span><span class="unit"> h </span><span class="big">${pad(sleep % 60)}</span><span class="unit"> min</span></div>` : '<div class="big" style="color: var(--ter)">—</div>'}
      <div class="foot">Nuit dernière</div>
    </section>
    <section class="card stack" style="gap: 8px">
      <div class="hdr" style="color: var(--heart)">${ic('heart', 16, 'var(--heart)')}FC au repos</div>
      ${hr != null ? `<div><span class="big">${Math.round(hr)}</span><span class="unit"> BPM</span></div>` : '<div class="big" style="color: var(--ter)">—</div>'}
      <div class="foot">Apple Watch</div>
    </section>
  </div>
  <button class="btn t block sm" data-act="health-paste" style="margin-top: 12px">${ic('watch', 16, 'var(--violet-text)')}Importer ma séance Apple Watch</button>
  <button class="foot row" data-act="health-sync" style="gap: 6px; margin: 8px 4px 0">${ic('watch', 14, 'var(--sec)')}${last ? `Données du ${fmtShort(parseKey(last))} · ` : ''}<span style="color: var(--violet-text); font-weight: 600">Synchroniser Santé</span></button>`;
}

function mealsCard(d, s, done) {
  const plan = mealPlan(d, s);
  const nowH = new Date().getHours() + new Date().getMinutes() / 60;
  const next = plan.meals.find((m) => m.h >= nowH - 0.25);
  const total = plan.meals.reduce((n, m) => n + m.prot, 0);
  return `<section class="card" style="margin-top: 26px; padding: 0; overflow: hidden">
    <button data-act="meals" style="width: 100%; padding: 14px 16px; display: flex; align-items: center; gap: 12px; text-align: left" aria-expanded="${state.mealsOpen}">
      <div class="ico" style="background: var(--food-soft)">${ic('food', 17, 'var(--food)')}</div>
      <div class="grow"><div style="font-size: 16px; font-weight: 600">Tes repas du jour</div>
      <div class="foot">${next ? `Prochain : ${esc(next.title.toLowerCase())} · ${hToStr(next.h)}` : plan.head} · ≈ ${total} g de protéines</div></div>
      <span style="transform: rotate(${state.mealsOpen ? -90 : 90}deg); transition: transform .2s">${ic('chevR', 18, 'var(--ter)', 2.4)}</span>
    </button>
    ${state.mealsOpen ? `<div class="stack" style="padding: 0 16px 16px">
      <div class="hdr" style="color: var(--food)">${plan.head}</div>
      ${plan.meals.map((m) => {
        const hl = next === m || (done && /après|récupération/i.test(m.title));
        return `<div style="background: ${hl ? 'var(--food-soft)' : '#F7F6FA'}; border-radius: 12px; padding: 12px" class="stack">
          <div class="row" style="justify-content: space-between; gap: 8px"><div style="font-size: 13px; font-weight: 700; color: var(--food)">${hToStr(m.h)} · ${esc(m.title)}</div>
          ${m.prot ? `<span class="chip" style="height: 24px; background: #fff; color: var(--food); font-size: 12px">≈ ${m.prot} g prot.</span>` : ''}</div>
          <div style="font-size: 15px; line-height: 20px; margin-top: -4px">${esc(m.text)}</div>
        </div>`;
      }).join('')}
      <div class="foot">Eau : environ 2 L sur la journée, plus une gourde pendant la séance. Les repas se décalent si tu changes l'heure de ta séance.</div>
      <div class="foot">Si ton poids baisse deux semaines de suite, ajoute une collation (fruit + oléagineux, ou tartine + fromage).</div>
    </div>` : ''}
  </section>`;
}

// ─────────────────────────── Vue : Planning
function viewPlanning() {
  const base = addDays(weekStart(), state.weekOffset * 7);
  const week = weekNo(base);
  const plan = weekPlan(base);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rows = DAYS3.map((dn, i) => {
    const d = addDays(base, i);
    const slot = plan[i];
    const s = slot ? sessionFor(d, slot) : null;
    const done = doneOn(d);
    const past = d < today;
    const isToday = dateKey(d) === dateKey(today);
    let right = '';
    if (s && done) right = `<span class="chip soft">${ic('check', 14, 'var(--violet-text)', 2.6)}Fait</span>`;
    else if (s && past && !s.optional && dateKey(d) >= state.settings.since) right = `<button class="chip warn" data-act="move-sheet" data-date="${dateKey(d)}">${ic('move', 14, 'var(--warn)')}Déplacer</button>`;
    else if (s && isToday) right = `<span class="chip solid">Aujourd'hui</span>`;
    else if (s && s.optional) right = `<span class="chip dashed">Optionnelle</span>`;
    else if (!s && done) right = `<span class="chip soft">${ic('check', 14, 'var(--violet-text)', 2.6)}Fait</span>`;
    const extra = !s && done ? logsOn(d).slice(-1)[0] : null;
    const icon = s ? (kindIcon[s.kind] || kindIcon.douce) : extra ? (kindIcon[extra.kind] || kindIcon.douce) : ['moon', '#F1EEF7', '#8E8A9C'];
    const canDrag = s && !done && !past;
    return `<div class="dayrow" data-day="${i}" ${s && !done ? 'data-drop="1"' : 'data-drop="1"'}>
      <div class="d"><div class="foot" style="font-weight: 600">${dn}</div><div style="font-size: 20px; font-weight: 700">${d.getDate()}</div></div>
      <div class="ico" style="background: ${icon[1]}">${ic(icon[0], 17, icon[2])}</div>
      <button class="grow" style="text-align: left; min-width: 0" ${done ? `data-act="log-detail" data-id="${logsOn(d).slice(-1)[0].id}"` : s ? `data-act="preview" data-date="${dateKey(d)}"` : ''}>
        <div style="font-size: 16px; font-weight: 600; color: ${s || extra ? 'var(--label)' : '#8E8A9C'}">${s ? esc(s.name) : extra ? esc(extra.name) : 'Repos'}</div>
        ${extra ? `<div class="foot">${extra.durationMin} min${extra.km ? ` · ${fmtNum(extra.km)} km` : ''}</div>` : ''}
        ${s ? `<div class="foot">${s.kind === 'salle' ? `Salle · ${s.minutes} min` : s.kind === 'course' ? `${s.km ? fmtNum(s.km) + ' km · ' : ''}${s.place === 'tapis' ? 'Tapis' : 'Dehors'}` : s.choice ? `${s.minutes} min` : 'Vélo, marche inclinée ou reformer'}</div>` : ''}
      </button>
      ${right}
      ${canDrag ? `<span class="grip" data-grip="${i}" aria-label="Glisser pour changer de jour">${ic('grip', 18, '#B7B2C6')}</span>` : ''}
    </div>`;
  }).join('');
  const phase = phaseFor(week);
  return `
  <div class="cap">Semaine ${week} · ${esc(phase.name)}</div>
  <h1 class="lt">Planning</h1>
  <div class="seg" style="margin-top: 16px">
    <button class="${state.weekOffset === 0 ? 'on' : ''}" data-act="week" data-v="0">Cette semaine</button>
    <button class="${state.weekOffset === 1 ? 'on' : ''}" data-act="week" data-v="1">Semaine prochaine</button>
  </div>
  <section class="card row" style="margin-top: 16px; padding: 12px 16px">
    <div class="ico" style="background: var(--violet-soft)">${ic('sparkle', 17, 'var(--violet-text)')}</div>
    <div class="foot" style="color: var(--label); font-size: 14px">${inRehab(base) || inRehab(addDays(base, 6)) ? `<b>Pause épaules et bras jusqu'au ${fmtShort(parseKey(REHAB.to))}</b> (kiné) : 2 séances jambes et fessiers, 1 course, 1 séance optionnelle.` : '3 séances prioritaires + 1 optionnelle.'} Pour changer de jour, maintiens la poignée et fais glisser la séance.</div>
  </section>
  <div class="list" id="daylist" data-week="${dateKey(base)}" style="margin-top: 16px">${rows}</div>
  ${state.plan[wkKey(base)] ? `<button class="link" data-act="reset-week" style="margin: 10px 4px 0; font-size: 15px">Rétablir la semaine type</button>` : ''}
  <button class="card row" data-act="tab" data-v="programme" style="margin-top: 16px; width: 100%; text-align: left">
    <div class="ico" style="background: var(--violet-soft)">${ic('map', 17, 'var(--violet-text)')}</div>
    <div class="grow"><div style="font-size: 16px; font-weight: 600">Mon programme jusqu'au 31 décembre</div><div class="foot">Phase ${PHASES.indexOf(phase) + 1} · ${esc(phase.name)} · semaine ${week} sur 15</div></div>
    ${ic('chevR', 18, 'var(--ter)')}
  </button>`;
}

function moveSheet(fromKey) {
  const from = parseKey(fromKey);
  const s = sessionFor(from);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ws = weekStart(from);
  const opts = DAYS3.map((dn, i) => {
    const d = addDays(ws, i);
    const busy = !!weekPlan(from)[i];
    const ok = d >= today && dateKey(d) !== fromKey;
    return `<button data-act="move-to" data-from="${fromKey}" data-to="${i}" ${ok ? '' : 'disabled'} style="height: 64px; border-radius: 12px; background: ${ok ? '#F4F2F8' : '#FAF9FC'}; color: ${ok ? 'var(--label)' : '#C9C5D6'}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px">
      <span style="font-size: 12px; font-weight: 600">${dn}</span><span style="font-size: 20px; font-weight: 700">${d.getDate()}</span>
      ${ok && busy ? '<span style="font-size: 10px; color: var(--sec)">échange</span>' : ''}</button>`;
  }).join('');
  return `<div class="row" style="justify-content: space-between; align-items: flex-start">
      <div><div style="font-size: 22px; font-weight: 700">Déplacer la séance</div>
      <div class="sub" style="margin-top: 4px">${esc(s?.name || '')} · prévue ${DAYS[dayIdx(from)].toLowerCase()}</div></div>
      <button class="x" data-act="close-sheet" aria-label="Fermer">${ic('close', 14, 'var(--sec)', 2.4)}</button>
    </div>
    <div class="foot" style="font-weight: 600">Choisis un nouveau jour</div>
    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px">${opts}</div>
    <div class="note">${ic('sparkle', 18, 'var(--violet-text)')}<span>Évite deux séances de jambes le même jour ou deux jours d'affilée. Si le jour choisi a déjà une séance, les deux s'échangent.</span></div>`;
}

// Enregistre une séance faite sans passer par l'écran de séance (coach ou menu du planning)
function logManual(dk, o = {}) {
  const planned = sessionFor(parseKey(dk));
  const kind = o.kind || planned?.kind || 'course';
  const log = {
    id: uid(), dateKey: dk, savedAt: new Date().toISOString(), key: planned?.key || 'manual',
    name: o.name || planned?.name || 'Séance', kind, week: weekNo(parseKey(dk)), optional: !!planned?.optional && !o.name,
    durationMin: Math.round(parseNum(o.minutes) || planned?.minutes || 30), feeling: o.feeling || null,
    watch: { kcal: parseNum(o.kcal), hr: parseNum(o.hr) }, km: parseNum(o.km), manual: true,
  };
  state.logs.push(log);
  state.logs.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  save('logs');
  return log;
}

function removeDay(dk) {
  const d = parseKey(dk);
  const plan = weekPlan(d).slice();
  plan[dayIdx(d)] = null;
  setWeekPlan(d, plan);
}

// Liste détaillée des exercices (ou des étapes) d'une séance, pour la voir à l'avance
function sessionPreview(s) {
  if (s.exercises) {
    return `<div class="stack" style="gap: 8px">
      <div class="foot" style="font-weight: 600">${s.exercises.length} exercices · échauffement 5 min avant de commencer</div>
      ${s.exercises.map((e, i) => {
        const ex = EXERCISES[e.id];
        const t = thumb(e.id);
        const target = ex.unit === 'time' ? `${e.load} s` : `${ex.reps[0]}-${ex.reps[1]} reps${ex.perSide ? ' / côté' : ''}`;
        const load = e.load != null && ex.unit !== 'time' ? ` · ${fmtNum(e.load)} kg${ex.perHand ? ' par haltère' : ''}` : ex.bodyweight ? ' · poids du corps' : '';
        return `<div class="row" style="gap: 12px; align-items: flex-start; background: var(--fill); border-radius: 12px; padding: 10px">
          ${t ? `<button data-act="video" data-id="${VIDEOS[e.id].videoId}" aria-label="Voir la démo de ${esc(ex.name)}" style="position: relative; flex: none"><img src="${t}" alt="" style="width: 72px; height: 54px; border-radius: 8px; object-fit: cover"><span style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center">${ic('play', 18, '#fff')}</span></button>` : ''}
          <div class="grow stack" style="gap: 3px">
            <div style="font-size: 15px; font-weight: 700">${i + 1}. ${esc(ex.name)}</div>
            <div class="foot" style="color: var(--violet-text); font-weight: 600">${e.sets} × ${target}${load}</div>
            ${ex.benefit ? `<div class="row" style="gap: 6px; align-items: flex-start; font-size: 13px; line-height: 18px; color: var(--label)">${ic('sparkle', 14, 'var(--violet-text)')}<span>${esc(ex.benefit)}</span></div>` : ''}
            <div class="foot">${esc(ex.cue)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
  if (s.steps) {
    return `<div class="list" style="padding: 0 12px; background: var(--fill)">${s.steps.map((st) => `<div class="li" style="align-items: flex-start">
      ${st.min ? `<b style="color: var(--run); width: 52px; flex: none">${st.min} min</b>` : ''}
      <div class="grow"><div style="font-size: 15px">${esc(st.label)}</div>${st.text ? `<div class="foot">${esc(st.text)}</div>` : ''}</div></div>`).join('')}</div>
      ${s.tip ? `<div class="foot">${esc(s.tip)}</div>` : ''}`;
  }
  return '';
}

function daySheet(dk) {
  const d = parseKey(dk);
  const s = sessionFor(d);
  const done = doneOn(d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const icon = kindIcon[s.kind] || kindIcon.douce;
  return `<div class="row" style="justify-content: space-between; align-items: flex-start">
      <div class="row" style="gap: 10px"><div class="ico" style="background: ${icon[1]}">${ic(icon[0], 17, icon[2])}</div>
      <div><div style="font-size: 20px; font-weight: 700">${esc(s.name)}</div><div class="sub">${DAYS[dayIdx(d)]} ${d.getDate()} · ${s.minutes} min</div></div></div>
      <button class="x" data-act="close-sheet" aria-label="Fermer">${ic('close', 14, 'var(--sec)', 2.4)}</button>
    </div>
    ${placePicker(s)}${optPicker(s)}
    ${whySession(s)}
    ${sessionPreview(s)}
    ${dk === dateKey() ? `<button class="btn p block" data-act="start" data-date="${dk}">${ic('play', 16, '#fff')}Commencer la séance</button>` : ''}
    ${!done && d <= today ? `<div class="stack" style="gap: 8px"><div class="foot" style="font-weight: 600">Tu l'as faite sans l'app ?</div>
      <div class="grid2"><label class="stack" style="gap: 4px"><span class="foot">Durée (min)</span><input class="field" id="md-min" inputmode="numeric" placeholder="${s.minutes}"></label>
      <label class="stack" style="gap: 4px"><span class="foot">${s.kind === 'course' ? 'Distance (km)' : 'FC moyenne'}</span><input class="field" id="md-x" inputmode="decimal" placeholder="—"></label></div>
      <button class="btn t block" data-act="mark-done" data-date="${dk}">${ic('check', 16, 'var(--violet-text)', 2.6)}Marquer comme faite</button></div>` : ''}
    ${!done && d >= today ? `<button class="btn t block" data-act="move-sheet" data-date="${dk}">${ic('move', 16, 'var(--violet-text)')}Déplacer</button>` : ''}
    ${!done && (slotFor(d)?.custom) ? `<button class="btn t block" data-act="reset-day" data-date="${dk}">${ic('refresh', 16, 'var(--violet-text)')}Revenir à la séance prévue</button>` : ''}
    ${!done ? `<button class="btn w block" data-act="remove-day" data-date="${dk}" style="color: #C62F3C; box-shadow: inset 0 0 0 1px var(--sep)">Retirer de la semaine</button>` : '<div class="chip soft" style="align-self: flex-start">Séance déjà enregistrée</div>'}`;
}

function moveSession(dayFrom, dayTo, ref) {
  const plan = weekPlan(ref).slice();
  [plan[dayFrom], plan[dayTo]] = [plan[dayTo], plan[dayFrom]];
  setWeekPlan(ref, plan);
}

// Glisser-déposer (souris et tactile)
let drag = null;
document.addEventListener('pointerdown', (e) => {
  const g = e.target.closest('[data-grip]');
  if (!g) return;
  e.preventDefault();
  const row = g.closest('.dayrow');
  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.innerHTML = row.querySelector('.ico').outerHTML + `<div class="grow">${row.querySelector('.grow').innerHTML}</div>` + ic('grip', 18, 'var(--violet-text)');
  document.body.appendChild(ghost);
  row.classList.add('dragging');
  drag = { from: +g.dataset.grip, row, ghost, target: null, dy: 30 };
  moveGhost(e);
});
function moveGhost(e) {
  if (!drag) return;
  drag.ghost.style.left = '24px';
  drag.ghost.style.top = `${e.clientY - drag.dy}px`;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const row = el && el.closest('[data-drop]');
  document.querySelectorAll('.dayrow.drop').forEach((r) => r.classList.remove('drop'));
  if (row && row !== drag.row) { row.classList.add('drop'); drag.target = +row.dataset.day; } else drag.target = null;
}
document.addEventListener('pointermove', (e) => { if (drag) { e.preventDefault(); moveGhost(e); } }, { passive: false });
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const { from, target, ghost } = drag;
  ghost.remove();
  drag = null;
  if (target != null && target !== from) {
    const ref = parseKey($('#daylist').dataset.week);
    moveSession(from, target, ref);
    toast(`Séance déplacée à ${DAYS[target].toLowerCase()}`);
  }
  render();
});

// ─────────────────────────── Vue : Programme
function viewProgramme() {
  const week = weekNo();
  const endDate = (p) => (p.to === 15 ? parseKey(PROGRAM_END) : addDays(START, p.to * 7 - 1));
  const phases = PHASES.map((p) => {
    const now = week >= p.from && week <= p.to;
    const from = addDays(START, (p.from - 1) * 7);
    return `<div class="row card" style="gap: 12px; align-items: stretch; ${now ? 'box-shadow: inset 0 0 0 2px var(--violet);' : ''}">
      <div style="width: 6px; border-radius: 3px; flex: none; background: ${p.deload ? 'repeating-linear-gradient(45deg, var(--violet), var(--violet) 4px, #fff 4px, #fff 8px)' : 'var(--violet)'}; opacity: ${week > p.to ? 0.35 : 1}"></div>
      <div class="grow stack" style="gap: 3px">
        <div class="row" style="justify-content: space-between"><div class="foot" style="font-weight: 600">Sem. ${p.from}${p.to !== p.from ? '-' + p.to : ''} · ${fmtShort(from)} → ${fmtShort(endDate(p))}</div>${now ? '<span class="chip solid" style="height: 22px; font-size: 11px">En cours</span>' : ''}</div>
        <div style="font-size: 17px; font-weight: 700">${esc(p.name)}</div>
        <div class="foot" style="color: var(--label); font-size: 14px; line-height: 19px">${esc(p.text)}</div>
      </div>
    </div>`;
  }).join('');
  const keys = ['hip-thrust', 'rdl-halteres', 'tirage-vertical'].map((id) => {
    const ex = EXERCISES[id];
    const cur = state.loads[id] ?? ex.base;
    // Estimation : un palier environ toutes les 2 séances, hors semaines allégées
    let sessions = 0;
    for (let w = week; w <= 15; w++) if (!phaseFor(w).deload) sessions += id === 'hip-thrust' ? 1 : 0.5;
    const proj = roundTo(cur + ex.inc * Math.floor(sessions / 2), ex.inc);
    return `<div class="li"><div class="grow"><div style="font-size: 16px; font-weight: 600">${esc(ex.name)}</div><div class="foot">${ex.perHand ? 'par haltère' : 'charge totale'}</div></div>
      <div style="text-align: right"><span style="font-weight: 700">${fmtNum(cur)} kg</span><span class="unit"> → </span><span style="font-weight: 700; color: var(--violet-text)">${fmtNum(proj)} kg</span></div></div>`;
  }).join('');
  return `
  <button class="link" data-act="tab" data-v="planning" style="margin: -6px -6px 0">${ic('chevL', 22, 'var(--violet-text)', 2.4)}Planning</button>
  <div class="cap" style="margin-top: 10px">21 sept. → 31 déc. · 15 semaines</div>
  <h1 class="lt">Mon programme</h1>
  <div class="stack" style="gap: 8px; margin-top: 16px">${phases}</div>
  <h2 class="sec">Objectifs indicatifs fin décembre</h2>
  <div class="list">${keys}</div>
  <p class="foot" style="margin: 8px 4px 0">Estimation : les charges s'ajustent à chaque séance selon ce que tu réussis.</p>
  <section class="card stack" style="margin-top: 12px; gap: 6px">
    <div class="hdr" style="color: var(--run)">${ic('run', 16, 'var(--run)')}Course lente</div>
    <div><span class="big">3</span><span class="unit"> km → </span><span class="big" style="color: var(--run)">10</span><span class="unit"> km fin décembre</span></div>
    <div class="foot">1 course par semaine jusqu'au 18 octobre, puis 2 : une course rythmée le mercredi (progressive ou fractionné) et une sortie longue et lente le samedi, qui augmente d'environ 0,5 km par semaine. Tapis ou dehors, au choix.</div>
  </section>
  <section class="card stack" style="margin-top: 12px">
    <div class="hdr" style="color: var(--violet-text)">${ic('sparkle', 16, 'var(--violet-text)')}Comment tes charges progressent</div>
    ${['Toutes tes répétitions réussies : la charge monte à la séance suivante (+2,5 kg jambes, +1 kg haltères).', 'Tu changes un poids à la salle : les séries suivantes et tes prochaines séances s\'ajustent.', 'Séance trop dure ou semaine allégée : la charge reste la même.'].map((t) => `<div class="row" style="gap: 10px; font-size: 15px; line-height: 20px; align-items: flex-start">${ic('check', 18, 'var(--violet-text)', 2.6)}<span>${t}</span></div>`).join('')}
  </section>`;
}

// ─────────────────────────── Séance en cours
function startSession(dk) {
  const d = parseKey(dk);
  const s = sessionFor(d);
  if (!s) return;
  state.active = {
    date: dk, key: s.key, name: s.name, kind: s.kind, week: s.week, optional: s.optional, custom: s.custom ? slotFor(d).custom : null,
    startedAt: Date.now(), idx: 0,
    exercises: (s.exercises || []).map((e) => {
      const ex = EXERCISES[e.id];
      return { id: e.id, changed: false, sets: Array.from({ length: e.sets }, () => ({ kg: e.load != null && ex.unit !== 'time' ? fmtNum(e.load) : '', reps: '', done: false })) };
    }),
    steps: (s.steps || []).map(() => false),
    cardio: { min: '', km: '' },
  };
  save('active');
  state.view = 'workout';
  render(); scrollTo(0, 0);
}

// Séance en cours : on garde la liste d'exercices du moment où elle a été démarrée
function activeSession() {
  const a = state.active;
  const d = parseKey(a.date);
  const s = a.custom ? normalizeCustom(a.custom, a.week) : sessionFor(d, { key: a.key });
  if (s && a.kind === 'salle' && a.exercises.length) {
    s.exercises = a.exercises.filter((e) => EXERCISES[e.id]).map((e) => ({ id: e.id, sets: e.sets.length, load: plannedLoad(e.id, a.week) }));
    state.active.exercises = a.exercises.filter((e) => EXERCISES[e.id]);
  }
  return s;
}

function viewWorkout() {
  const a = state.active;
  const s = activeSession();
  const elapsed = Math.floor((Date.now() - a.startedAt) / 1000);
  const head = `<div class="row" style="justify-content: space-between; margin: -6px -4px 0">
    <button class="link" data-act="tab" data-v="today">${ic('chevL', 22, 'var(--violet-text)', 2.4)}Retour</button>
    <div class="center"><div style="font-size: 17px; font-weight: 600">${esc(a.name)}</div><div class="foot" id="elapsed" style="font-variant-numeric: tabular-nums">${fmtClock(elapsed)}</div></div>
    <button class="link b" data-act="finish">Terminer</button>
  </div>`;

  if (a.kind !== 'salle') {
    return head + `
    <div class="stack" style="margin: 16px 0 12px">${placePicker(s)}${optPicker(s)}</div>
    ${s.tip ? `<p class="sub" style="margin: 0 4px 12px">${esc(s.tip)}</p>` : ''}
    <div class="list">${s.steps.map((st, j) => `<button class="li" data-act="step" data-j="${j}" style="width: 100%; text-align: left">
      ${st.min ? `<b style="color: var(--run); width: 52px; flex: none">${st.min} min</b>` : ''}
      <div class="grow"><div style="font-size: 16px; ${a.steps[j] ? 'color: var(--ter); text-decoration: line-through' : ''}">${esc(st.label)}</div>${st.text ? `<div class="foot">${esc(st.text)}</div>` : ''}</div>
      <span class="ico" style="background: ${a.steps[j] ? 'var(--violet)' : '#F1EEF7'}">${ic('check', 18, a.steps[j] ? '#fff' : 'var(--ter)', 2.8)}</span>
    </button>`).join('')}</div>
    <section class="card stack" style="margin-top: 12px">
      <label class="stack" style="gap: 6px"><span class="foot">Durée totale (min)</span><input class="field" inputmode="numeric" data-cardio="min" value="${esc(a.cardio.min)}" placeholder="${s.minutes}"></label>
      <label class="stack" style="gap: 6px"><span class="foot">Distance (km, facultatif)</span><input class="field" inputmode="decimal" data-cardio="km" value="${esc(a.cardio.km)}" placeholder="—"></label>
    </section>`;
  }

  const k = Math.min(a.idx, s.exercises.length - 1);
  const e = s.exercises[k];
  const ex = EXERCISES[e.id];
  const cur = a.exercises[k];
  const last = lastPerf(e.id);
  const video = VIDEOS[e.id];
  const unitLbl = ex.unit === 'time' ? 'Sec' : 'Reps';
  const target = ex.unit === 'time' ? `${e.load} s` : `${ex.reps[0]}-${ex.reps[1]}${ex.perSide ? ' / côté' : ''}`;
  const planned = e.load != null && ex.unit !== 'time' ? `${fmtNum(e.load)} kg${ex.perHand ? ' par haltère' : ''}` : ex.bodyweight ? 'poids du corps' : '';
  const rest = ex.key ? 90 : 75;
  const media = video
    ? `<button class="media" data-act="video" data-id="${video.videoId}" style="width: 100%" aria-label="Voir la vidéo de démonstration">
        <img src="https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg" alt="">
        <span class="play">${ic('play', 26, '#fff')}</span>
        <span class="chip tag" style="background: rgba(255,255,255,.92); color: var(--label)">${ic('video', 14, 'var(--violet-text)')}Démo vidéo</span>
      </button>`
    : `<a class="media empty" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' technique femme')}" target="_blank" rel="noopener">${ic('video', 28, 'var(--violet-text)')}Voir des démos sur YouTube</a>`;
  const bars = s.exercises.map((_, i) => `<div class="${i < k || a.exercises[i].sets.every((x) => x.done) ? 'on' : i === k ? 'cur' : ''}"></div>`).join('');
  const nextEx = s.exercises[k + 1];

  return head + `
  <div class="bar6" style="grid-template-columns: repeat(${s.exercises.length}, minmax(0, 1fr)); margin-top: 14px">${bars}</div>
  <section class="card" style="margin-top: 16px; padding: 0; overflow: hidden">
    ${media}
    <div class="stack" style="padding: 14px 16px 16px">
      <div class="row" style="justify-content: space-between"><div class="cap">Exercice ${k + 1} sur ${s.exercises.length}</div>
        <div class="row" style="gap: 4px">
          <button class="x" data-act="ex-prev" aria-label="Exercice précédent" ${k === 0 ? 'disabled style="opacity: .3"' : ''}>${ic('chevL', 16, 'var(--violet-text)', 2.4)}</button>
          <button class="x" data-act="ex-next" aria-label="Exercice suivant" ${!nextEx ? 'disabled style="opacity: .3"' : ''}>${ic('chevR', 16, 'var(--violet-text)', 2.4)}</button>
        </div></div>
      <div style="font-size: 24px; line-height: 29px; font-weight: 700">${esc(ex.name)}</div>
      <div class="row" style="gap: 6px; flex-wrap: wrap">
        ${ex.muscles.map((m, i) => `<span class="chip ${i ? 'grey' : 'soft'}">${esc(m)}</span>`).join('')}
        <span class="chip grey">${e.sets} × ${target} · repos ${rest} s</span>
      </div>
      ${ex.benefit ? `<div class="note">${ic('sparkle', 16, 'var(--violet-text)')}<span><b>Pourquoi cet exo :</b> ${esc(ex.benefit)}</span></div>` : ''}
      <div class="sub" style="color: var(--label)">${esc(ex.cue)}</div>
      ${s.rehab && e.id === 'hip-thrust' ? `<div class="note">${ic('sparkle', 16, 'var(--violet-text)')}<span>Pause kiné : si tenir la barre gêne ton épaule, utilise la machine à hip thrust ou fais un pont fessier au sol avec un disque posé sur les hanches.</span></div>` : ''}
      ${s.week <= 2 && !ex.bodyweight ? `<div class="note">${ic('sparkle', 16, 'var(--violet-text)')}<span>Reprise : choisis une charge qui te laisse 2 à 3 répétitions en réserve. Ajuste le poids prévu si besoin, l'app s'adapte.</span></div>` : ''}
      ${last ? `<div class="row" style="gap: 8px; background: var(--fill); border-radius: 10px; padding: 10px 12px">${ic('clock', 16, 'var(--sec)')}<span class="foot" style="color: var(--label)">Dernière fois : ${last.map((x) => ex.unit === 'time' ? `${x.reps} s` : x.kg ? `${x.kg} kg × ${x.reps}` : `${x.reps}`).join(' · ')}</span></div>` : ''}
      ${planned ? `<div class="row" style="gap: 8px; color: var(--violet-text); font-size: 14px; font-weight: 600">${ic('arrowUp', 16, 'var(--violet-text)', 2.4)}Prévu aujourd'hui : ${planned}</div>` : ''}
    </div>
  </section>

  <section class="card sets" style="margin-top: 12px">
    <div class="set ${ex.weightless || ex.bodyweight || ex.unit === 'time' ? 'one' : ''} cap"><span class="center">Série</span>${!ex.bodyweight && ex.unit !== 'time' ? '<span class="center">Kg prévus</span>' : ''}<span class="center">${unitLbl}</span><span></span></div>
    ${cur.sets.map((x, j) => `<div class="set ${ex.bodyweight || ex.unit === 'time' ? 'one' : ''} ${x.done ? 'done' : ''}">
      <span class="n">${j + 1}</span>
      ${!ex.bodyweight && ex.unit !== 'time' ? `<input inputmode="decimal" data-set="kg" data-k="${k}" data-j="${j}" value="${esc(x.kg)}" aria-label="Kilos série ${j + 1}">` : ''}
      <input inputmode="numeric" data-set="reps" data-k="${k}" data-j="${j}" value="${esc(x.reps)}" placeholder="${ex.unit === 'time' ? e.load : `${ex.reps[0]}-${ex.reps[1]}`}" aria-label="${unitLbl} série ${j + 1}">
      <button class="ok" data-act="set" data-k="${k}" data-j="${j}" data-rest="${rest}" aria-label="Valider la série ${j + 1}">${ic('check', 20, x.done ? '#fff' : 'var(--ter)', 2.8)}</button>
    </div>`).join('')}
    ${cur.changed ? `<div class="note" style="margin-top: 4px">${ic('sparkle', 16, 'var(--violet-text)')}<span>Tu es passée à <b>${esc(cur.newKg || '')} kg</b>. J'ai mis à jour les séries suivantes et tes prochaines séances.</span></div>` : ''}
  </section>

  ${nextEx ? `<button class="card row" data-act="ex-next" style="margin-top: 12px; width: 100%; text-align: left; padding: 10px 12px">
    ${thumb(nextEx.id) ? `<img src="${thumb(nextEx.id)}" alt="" style="width: 56px; height: 42px; border-radius: 8px; object-fit: cover">` : `<div class="ico" style="width: 56px; height: 42px; background: var(--violet-soft)">${ic('dumbbell', 18, 'var(--violet-text)')}</div>`}
    <div class="grow"><div class="foot">Ensuite</div><div style="font-size: 16px; font-weight: 600">${esc(EXERCISES[nextEx.id].name)}</div></div>
    ${ic('chevR', 18, 'var(--ter)')}
  </button>` : `<button class="btn p block" data-act="finish" style="margin-top: 12px">Terminer la séance</button>`}
  <button class="link danger" data-act="abandon" style="margin: 18px auto 0; display: flex; font-size: 15px">${state.confirmAbandon ? 'Confirmer : supprimer cette séance sans l’enregistrer' : 'Abandonner la séance'}</button>`;
}

// Minuteur de repos
let audioCtx = null;
function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch {} }
function beep() {
  try {
    [0, 0.25].forEach((t) => {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(0.25, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.2);
      o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch {}
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch {}
}
function restBar() {
  if (!state.rest) return '';
  const left = Math.max(0, Math.ceil((state.rest.end - Date.now()) / 1000));
  const c = 100.5;
  return `<div class="restbar" id="restbar">
    <svg width="40" height="40" viewBox="0 0 40 40" style="transform: rotate(-90deg)"><circle cx="20" cy="20" r="16" fill="none" stroke="#3A3257" stroke-width="5"/><circle id="restring" cx="20" cy="20" r="16" fill="none" stroke="var(--violet-mid)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - left / state.rest.total)}"/></svg>
    <div class="grow"><div style="font-size: 12px; font-weight: 600; color: #B8B1D3">Repos</div><div id="resttime" style="font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums">${fmtClock(left)}</div></div>
    <button data-act="rest-add" style="background: #332B4F; color: #fff">+15 s</button>
    <button data-act="rest-skip" style="background: var(--violet-mid); color: var(--dark)">Passer</button>
  </div>`;
}
setInterval(() => {
  if (state.rest) {
    const left = Math.ceil((state.rest.end - Date.now()) / 1000);
    if (left <= 0) { beep(); state.rest = null; $('#restbar')?.remove(); }
    else {
      const t = $('#resttime'); if (t) t.textContent = fmtClock(left);
      const r = $('#restring'); if (r) r.setAttribute('stroke-dashoffset', 100.5 * (1 - left / state.rest.total));
    }
  }
  const el = $('#elapsed');
  if (el && state.active) el.textContent = fmtClock(Math.floor((Date.now() - state.active.startedAt) / 1000));
}, 500);

// ─────────────────────────── Fin de séance
function viewFinish() {
  const a = state.active;
  const sets = a.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
  const exDone = a.exercises.filter((e) => e.sets.some((x) => x.done)).length;
  const min = Math.max(1, Math.round((Date.now() - a.startedAt) / 60000));
  const w = a.watch || {};
  const f = a.feeling || '';
  const tiles = a.kind === 'salle'
    ? [[min, 'minutes'], [sets, 'séries'], [`${exDone}/${a.exercises.length}`, 'exercices']]
    : [[a.cardio.min || min, 'minutes'], [a.cardio.km ? fmtNum(parseNum(a.cardio.km)) : '—', 'km'], [a.steps.filter(Boolean).length + '/' + a.steps.length, 'étapes']];
  return `
  <button class="link" data-act="tab" data-v="workout" style="margin: -6px -6px 0">${ic('chevL', 22, 'var(--violet-text)', 2.4)}Séance</button>
  <div class="stack center" style="align-items: center; gap: 6px; margin-top: 10px">
    <div style="width: 72px; height: 72px; border-radius: 36px; background: var(--violet); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 10px var(--violet-soft)">${ic('check', 36, '#fff', 3)}</div>
    <h1 class="lt" style="margin-top: 14px">Bien joué !</h1>
    <div class="sub">${esc(a.name)}</div>
  </div>
  <div class="grid3" style="margin-top: 20px">${tiles.map(([v, l]) => `<div class="card center" style="padding: 12px 8px"><div class="big" style="color: var(--violet-text)">${v}</div><div class="foot">${l}</div></div>`).join('')}</div>

  <h2 class="sec">Données Apple Watch</h2>
  <section class="card stack">
    <div class="foot">Ajoute des captures de ta séance (app Forme ou Exercice) : le coach lit les chiffres.</div>
    <div class="row" style="gap: 10px; flex-wrap: wrap">
      ${(a.shots || []).map((src) => `<img src="${src}" alt="Capture" style="width: 64px; height: 88px; border-radius: 10px; object-fit: cover">`).join('')}
      <label style="width: 64px; height: 88px; border-radius: 10px; border: 1.5px dashed var(--violet-mid); background: var(--violet-soft); color: var(--violet-text); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11px; font-weight: 600; cursor: pointer">
        ${ic('plus', 20, 'var(--violet-text)', 2.4)}Ajouter<input type="file" accept="image/*" multiple data-act="shots" hidden></label>
    </div>
    ${state.busy ? `<div class="foot row" style="gap: 8px; color: var(--violet-text)"><span class="typing"><span></span><span></span><span></span></span>Le coach lit tes captures…</div>` : ''}
    ${a.watchRead ? `<div class="foot row" style="gap: 6px; color: var(--violet-text); font-weight: 600">${ic('sparkle', 14, 'var(--violet-text)')}Lu par le coach : vérifie les chiffres</div>` : ''}
    <div class="list" style="padding: 0">
      ${[['flame', 'var(--heart)', 'Calories actives', 'kcal', 'kcal'], ['heart', 'var(--heart)', 'FC moyenne', 'hr', 'BPM'], ['clock', 'var(--violet-text)', 'Durée (min)', 'duration', 'min']].map(([i, c, l, key, u]) => `
      <label class="li"><div class="ico" style="background: var(--fill)">${ic(i, 17, c)}</div><span class="grow" style="font-size: 16px">${l}</span>
      <input inputmode="decimal" data-watch="${key}" value="${esc(w[key] ?? '')}" placeholder="—" style="width: 80px; border: 0; text-align: right; font-size: 17px; font-weight: 700; outline: none"><span class="unit" style="width: 34px">${u}</span></label>`).join('')}
    </div>
  </section>

  <h2 class="sec">Comment tu te sens ?</h2>
  <div class="grid3">${['Facile', 'Bien', 'Dur'].map((v) => `<button class="btn sm" data-act="feeling" data-v="${v}" style="background: ${f === v ? 'var(--violet-soft)' : '#fff'}; color: ${f === v ? 'var(--violet-text)' : 'var(--label)'}; ${f === v ? 'box-shadow: inset 0 0 0 2px var(--violet)' : ''}">${v}</button>`).join('')}</div>
  <div style="height: 80px"></div>
  <div class="bottom-cta"><button class="btn p block" data-act="save-session">Enregistrer la séance</button></div>`;
}

function saveSession() {
  const a = state.active;
  const w = a.watch || {};
  const log = {
    id: uid(), dateKey: a.date, savedAt: new Date().toISOString(), key: a.key, name: a.name, kind: a.kind, week: a.week, optional: !!a.optional,
    durationMin: parseNum(w.duration) || parseNum(a.cardio.min) || Math.max(1, Math.round((Date.now() - a.startedAt) / 60000)),
    feeling: a.feeling || null,
    watch: { kcal: parseNum(w.kcal), hr: parseNum(w.hr) },
  };
  if (a.kind === 'salle') log.exercises = a.exercises.map((e) => ({ id: e.id, changed: e.changed, sets: e.sets.map((x) => ({ kg: x.kg, reps: x.reps, done: x.done })) }));
  else log.km = parseNum(a.cardio.km);
  log.ups = applyProgression(log);
  state.logs.push(log);
  state.active = null; state.rest = null;
  save('logs', 'active');
  state.view = 'today';
  render(); scrollTo(0, 0);
}

// ─────────────────────────── Vue : Progrès
function bars(values, labels, color, goal, maxV) {
  const n = values.length, w = 310, h = 110, bw = 22, step = w / n;
  const max = maxV || Math.max(goal || 0, ...values, 1);
  let out = `<svg width="100%" viewBox="0 0 ${w} ${h + 22}" aria-hidden="true">`;
  if (goal) { const gy = h - goal / max * (h - 8); out += `<line x1="0" x2="${w}" y1="${gy}" y2="${gy}" stroke="${color}" stroke-dasharray="4 4" opacity=".55"/>`; }
  values.forEach((v, i) => {
    const bh = v ? Math.max(4, v / max * (h - 8)) : 3;
    const x = i * step + (step - bw) / 2;
    out += `<rect x="${x}" y="${h - bh}" width="${bw}" height="${bh}" rx="6" fill="${v ? color : '#E3DEEF'}" opacity="${i === n - 1 ? 1 : 0.5}"/>`;
    out += `<text x="${x + bw / 2}" y="${h + 16}" text-anchor="middle" font-size="11" fill="var(--sec)">${labels[i]}</text>`;
  });
  return out + '</svg>';
}

function lineChart(points, color, band) {
  if (!points.length) return '';
  const vals = points.map((p) => p.v);
  let lo = Math.min(...vals, ...(band || [])), hi = Math.max(...vals, ...(band || []));
  if (hi - lo < 1) { lo -= 1; hi += 1; }
  const X = (i) => (points.length === 1 ? 155 : 12 + i * 286 / (points.length - 1));
  const Y = (v) => 78 - (v - lo) / (hi - lo) * 64;
  let out = '<svg width="100%" viewBox="0 0 310 96" aria-hidden="true">';
  if (band) out += `<rect x="0" y="${Y(band[1])}" width="310" height="${Y(band[0]) - Y(band[1])}" rx="8" fill="var(--violet-soft)"/><text x="304" y="${Y(band[1]) + 12}" font-size="10" fill="var(--violet-text)" text-anchor="end">zone visée ${band[0]} – ${band[1]} kg</text>`;
  out += `<polyline points="${points.map((p, i) => `${X(i)},${Y(p.v)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  points.forEach((p, i) => { out += i === points.length - 1 ? `<circle cx="${X(i)}" cy="${Y(p.v)}" r="5" fill="${color}"/>` : `<circle cx="${X(i)}" cy="${Y(p.v)}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2"/>`; });
  out += `<text x="12" y="92" font-size="10" fill="var(--sec)">${points[0].l}</text><text x="298" y="92" font-size="10" fill="var(--sec)" text-anchor="end">${points[points.length - 1].l}</text>`;
  return out + '</svg>';
}

function viewProgress() {
  const ws = weekStart();
  const weeks = Array.from({ length: 6 }, (_, i) => addDays(ws, -7 * (5 - i)));
  const perWeek = weeks.map((w) => state.logs.filter((l) => { const t = parseKey(l.dateKey); return t >= w && t < addDays(w, 7) && !l.optional; }).length);
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));
  const sleep = days.map((d) => (state.health[dateKey(d)]?.sleepMin || 0) / 60);
  const sleepKnown = sleep.filter(Boolean);
  const avg = sleepKnown.length ? sleepKnown.reduce((a, b) => a + b, 0) / sleepKnown.length : 0;
  const ws2 = state.weights.slice(-10).map((w) => ({ v: w.kg, l: fmtShort(parseKey(w.date)) }));
  const lastW = state.weights[state.weights.length - 1];
  const zone = state.settings.zone;
  const exIds = [...new Set(state.logs.flatMap((l) => (l.exercises || []).filter((e) => !EXERCISES[e.id]?.bodyweight && EXERCISES[e.id]?.unit !== 'time' && e.sets.some((s) => s.done && parseNum(s.kg))).map((e) => e.id)))];
  if (!exIds.includes(state.chartEx)) state.chartEx = exIds[0] || null;
  const loadPts = state.chartEx ? state.logs.map((l) => {
    const e = (l.exercises || []).find((x) => x.id === state.chartEx);
    const best = e ? Math.max(0, ...e.sets.filter((s) => s.done).map((s) => parseNum(s.kg) || 0)) : 0;
    return best ? { v: best, l: fmtShort(parseKey(l.dateKey)) } : null;
  }).filter(Boolean).slice(-10) : [];
  const lastWeekKey = dateKey(addDays(ws, -7));
  const review = state.reviews[lastWeekKey] || state.reviews[dateKey(ws)];

  return `
  <h1 class="lt">Progrès</h1>
  <section class="card stack" style="margin-top: 16px">
    <div class="row" style="justify-content: space-between">
      <div class="hdr" style="color: var(--violet-text)">${ic('sparkle', 16, 'var(--violet-text)')}Bilan de la semaine</div>
      ${review ? `<span class="foot">${esc(review.label)}</span>` : ''}
    </div>
    ${review ? `
      <div style="font-size: 17px; font-weight: 700">Ce que tu as bien fait</div>
      ${review.bien.map((t) => `<div class="row" style="gap: 10px; align-items: flex-start; font-size: 15px; line-height: 20px">${ic('check', 18, 'var(--violet-text)', 2.6)}<span>${esc(t)}</span></div>`).join('')}
      <div style="font-size: 17px; font-weight: 700; margin-top: 4px">À améliorer</div>
      ${review.ameliorer.map((t) => `<div class="row" style="gap: 10px; align-items: flex-start; font-size: 15px; line-height: 20px">${ic('arrowUp', 18, 'var(--warn)', 2.4)}<span>${esc(t)}</span></div>`).join('')}
      ${review.suite ? `<div class="note">${ic('sparkle', 16, 'var(--violet-text)')}<span>${esc(review.suite)}</span></div>` : ''}
      <button class="link" data-act="review" data-week="${esc(review.week)}" style="font-size: 15px">Refaire le bilan</button>`
    : `<div class="sub">Le coach analyse tes séances, ton sommeil et ton poids, puis te dit ce qui va bien et ce que tu peux améliorer.</div>
      <div class="grid2"><button class="btn t sm" data-act="review" data-week="${lastWeekKey}">Sem. passée</button><button class="btn t sm" data-act="review" data-week="${dateKey(ws)}">Cette semaine</button></div>`}
    ${state.busy === 'review' ? `<div class="foot row" style="gap: 8px; color: var(--violet-text)"><span class="typing"><span></span><span></span><span></span></span>Le coach prépare ton bilan…</div>` : ''}
  </section>

  <h2 class="sec">Tendances</h2>
  <section class="card stack" style="gap: 6px">
    <div class="hdr" style="color: var(--violet-text)">${ic('flame', 16, 'var(--violet-text)')}Séances par semaine</div>
    <div><span class="big">${perWeek[5]}</span><span class="unit"> cette semaine · objectif 3</span></div>
    ${bars(perWeek, weeks.map((w) => `${w.getDate()}/${w.getMonth() + 1}`), 'var(--violet)', 3, 4)}
  </section>

  <section class="card stack" style="margin-top: 12px; gap: 6px">
    <div class="hdr" style="color: var(--sleep)">${ic('moon', 16, 'var(--sleep)')}Sommeil</div>
    ${avg ? `<div><span class="big">${Math.floor(avg)}</span><span class="unit"> h </span><span class="big">${pad(Math.round((avg % 1) * 60))}</span><span class="unit"> min en moyenne</span></div>` : '<div class="sub">Synchronise l’app Santé pour voir ton sommeil ici.</div>'}
    ${bars(sleep, days.map((d) => 'LMMJVSD'[dayIdx(d)]), 'var(--sleep)', 0, 9)}
  </section>

  <section class="card stack" style="margin-top: 12px; gap: 8px">
    <div class="row" style="justify-content: space-between">
      <div class="hdr" style="color: var(--violet-text)">${ic('scale', 16, 'var(--violet-text)')}Poids · pesée du dimanche</div>
      <button class="chip soft" data-act="weight-sheet">${ic('plus', 14, 'var(--violet-text)', 2.4)}Ajouter</button>
    </div>
    ${lastW ? `<div><span class="big">${fmtNum(lastW.kg)}</span><span class="unit"> kg${zone ? ` · ${lastW.kg < zone[0] ? 'sous ta zone' : lastW.kg > zone[1] ? 'au-dessus de ta zone' : 'dans ta zone'}` : ''}</span></div>${lineChart(ws2, 'var(--violet)', zone)}` : '<div class="sub">Pèse-toi le dimanche matin, au réveil, pour suivre ton évolution.</div>'}
    <div class="foot">Ton objectif n'est pas de perdre du poids : si tu passes sous ta zone, le coach te le signale.</div>
  </section>

  <section class="card stack" style="margin-top: 12px; gap: 8px">
    <div class="hdr" style="color: var(--violet-text)">${ic('dumbbell', 16, 'var(--violet-text)')}Charges</div>
    ${exIds.length ? `<select class="field" data-act="chart-ex">${exIds.map((id) => `<option value="${id}" ${id === state.chartEx ? 'selected' : ''}>${esc(EXERCISES[id].name)}</option>`).join('')}</select>
      <div><span class="big">${fmtNum(Math.max(...loadPts.map((p) => p.v)))}</span><span class="unit"> kg · meilleure charge</span></div>
      ${lineChart(loadPts, 'var(--violet)')}` : '<div class="sub">Tes charges apparaîtront ici après ta première séance de salle.</div>'}
  </section>

  <section class="card stack" style="margin-top: 12px">
    <div class="hdr">Historique</div>
    ${state.logs.length ? `<div class="list" style="padding: 0">${[...state.logs].reverse().slice(0, 20).map((l) => `<div class="li">
      <div class="grow" data-act="log-detail" data-id="${l.id}" style="cursor: pointer"><div style="font-size: 16px; font-weight: 600">${esc(l.name)}</div><div class="foot">${fmtShort(parseKey(l.dateKey))} · ${l.durationMin} min${l.km ? ` · ${fmtNum(l.km)} km` : ''}${l.feeling ? ` · ${esc(l.feeling)}` : ''}</div></div>
      <button class="link" data-act="log-detail" data-id="${l.id}" style="font-size: 14px">Détails ${ic('chevR', 14, 'var(--violet-text)', 2.4)}</button></div>`).join('')}</div>` : '<div class="sub">Aucune séance pour l’instant.</div>'}
  </section>`;
}

function weightSheet() {
  const last = state.weights[state.weights.length - 1];
  return `<div class="row" style="justify-content: space-between"><div style="font-size: 22px; font-weight: 700">Ma pesée</div><button class="x" data-act="close-sheet" aria-label="Fermer">${ic('close', 14, 'var(--sec)', 2.4)}</button></div>
    <label class="stack" style="gap: 6px"><span class="foot">Poids (kg)</span><input class="field" id="wkg" inputmode="decimal" placeholder="${last ? fmtNum(last.kg) : 'ex. 60'}" autofocus></label>
    <button class="btn p block" data-act="save-weight">Enregistrer</button>`;
}

// ─────────────────────────── Vue : Sommeil
// Repères généraux chez l'adulte (varient selon les personnes ; les phases d'une montre sont des estimations)
const STAGES = {
  deep: { label: 'Profond', color: '#3A3F9E', ref: [13, 23], role: 'La récupération physique : c’est surtout là que tes muscles se réparent après une séance.' },
  core: { label: 'Essentiel', color: '#5B7CF0', ref: [45, 60], role: 'Le sommeil de base (léger) : il occupe la plus grande partie de la nuit.' },
  rem: { label: 'Paradoxal (REM)', color: '#5FC3E8', ref: [20, 25], role: 'La récupération mentale : mémoire, humeur et gestion du stress.' },
  awake: { label: 'Éveillée', color: '#F2876B', ref: null, role: 'Quelques réveils courts sont normaux, on ne s’en souvient souvent pas.' },
};

function lastNight() {
  const keys = Object.keys(state.health).filter((k) => state.health[k].sleepMin || state.health[k].stages).sort();
  const k = keys[keys.length - 1];
  return k ? { key: k, ...state.health[k] } : null;
}

function hypnogram(segs) {
  if (!segs || segs.length < 2) return '';
  const rows = { awake: 0, rem: 1, core: 2, asleep: 2, deep: 3 };
  const t0 = segs[0].t, t1 = Math.max(...segs.map((x) => x.t + x.m / 60));
  const W = 310, H = 118, L = 70, span = Math.max(0.5, t1 - t0);
  const X = (t) => L + (t - t0) / span * (W - L - 4);
  let out = `<svg width="100%" viewBox="0 0 ${W} ${H + 18}" aria-label="Déroulé de la nuit">`;
  ['Éveil', 'REM', 'Essentiel', 'Profond'].forEach((lab, i) => { out += `<text x="0" y="${i * 28 + 18}" font-size="11" fill="var(--sec)">${lab}</text><line x1="${L}" x2="${W}" y1="${i * 28 + 14}" y2="${i * 28 + 14}" stroke="var(--sep)"/>`; });
  segs.forEach((x) => {
    const r = rows[x.st];
    const st = STAGES[x.st === 'asleep' ? 'core' : x.st];
    out += `<rect x="${X(x.t).toFixed(1)}" y="${r * 28 + 5}" width="${Math.max(2, X(x.t + x.m / 60) - X(x.t)).toFixed(1)}" height="18" rx="4" fill="${st.color}"/>`;
  });
  const hh = (t) => `${Math.floor(t % 24)} h${pad(Math.round((t % 1) * 60))}`;
  out += `<text x="${L}" y="${H + 14}" font-size="10" fill="var(--sec)">${hh(t0)}</text><text x="${W}" y="${H + 14}" font-size="10" fill="var(--sec)" text-anchor="end">${hh(t1)}</text>`;
  return out + '</svg>';
}

function viewSleep() {
  const n = lastNight();
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));
  const week = days.map((d) => state.health[dateKey(d)] || {});
  const setup = `<section class="card stack">
    <div class="hdr" style="color: var(--sleep)">${ic('moon', 16, 'var(--sleep)')}Ajoute tes phases de sommeil</div>
    <div class="sub" style="color: var(--label)">Pour voir le détail (REM, profond, essentiel), ajoute 3 lignes à ton raccourci « RomFit Santé ». Demande à Claude les étapes.</div>
  </section>`;
  if (!n) return `<h1 class="lt">Sommeil</h1><p class="sub" style="margin: 12px 4px">Synchronise l'app Santé depuis l'écran Aujourd'hui pour voir ta nuit ici.</p>${setup}`;
  const st = n.stages;
  const asleep = st ? st.rem + st.deep + st.core + st.asleep : n.sleepMin;
  const total = asleep + (st ? st.awake : 0);
  const pct = (m) => (asleep ? Math.round(m / asleep * 100) : 0);
  const fmtH = (m) => `${Math.floor(m / 60)} h ${pad(Math.round(m % 60))}`;
  const d = parseKey(n.key);
  let body = '';
  if (st) {
    const order = ['deep', 'core', 'rem'];
    const bar = [...order, 'awake'].map((k) => { const m = k === 'core' ? st.core + st.asleep : st[k]; return m ? `<div style="flex: ${m}; background: ${STAGES[k].color}"></div>` : ''; }).join('');
    const rows = [...order, 'awake'].map((k) => {
      const m = k === 'core' ? st.core + st.asleep : st[k];
      const p = pct(m);
      const ref = STAGES[k].ref;
      const status = !ref ? '' : p < ref[0] ? '<span class="chip warn" style="height: 24px; font-size: 12px">Un peu bas</span>' : p > ref[1] + 5 ? '<span class="chip grey" style="height: 24px; font-size: 12px">Élevé</span>' : '<span class="chip soft" style="height: 24px; font-size: 12px">Dans la norme</span>';
      return `<div class="li" style="align-items: flex-start">
        <span style="width: 12px; height: 12px; border-radius: 4px; background: ${STAGES[k].color}; margin-top: 4px; flex: none"></span>
        <div class="grow"><div class="row" style="justify-content: space-between; gap: 8px"><b style="font-size: 15px">${STAGES[k].label}</b>${status}</div>
          <div class="foot" style="color: var(--label)">${fmtH(m)}${k !== 'awake' ? ` · ${p} %${ref ? ` (repère : ${ref[0]}-${ref[1]} %)` : ''}` : ''}</div>
          <div class="foot">${STAGES[k].role}</div></div></div>`;
    }).join('');
    body = `
    <section class="card stack" style="margin-top: 12px">
      <div style="display: flex; height: 16px; border-radius: 8px; overflow: hidden; gap: 2px">${bar}</div>
      ${hypnogram(st.segs)}
      <div class="list" style="padding: 0">${rows}</div>
    </section>
    <section class="card stack" style="margin-top: 12px">
      <div class="hdr" style="color: var(--sleep)">${ic('sparkle', 16, 'var(--sleep)')}Ce que ça veut dire pour toi</div>
      ${sleepTakeaways(n, st, asleep, pct).map((t) => `<div class="row" style="gap: 8px; align-items: flex-start; font-size: 15px; line-height: 20px">${ic('check', 16, 'var(--sleep)', 2.6)}<span>${esc(t)}</span></div>`).join('')}
      ${state.sleepNotes?.[n.key] ? `<div class="note" style="background: #E7E9FB">${ic('coach', 16, 'var(--sleep)')}<span>${esc(state.sleepNotes[n.key])}</span></div>` : ''}
      ${state.busy === 'sleep' ? `<div class="foot row" style="gap: 8px; color: var(--sleep)"><span class="typing"><span></span><span></span><span></span></span>Le coach analyse ta nuit…</div>` : `<button class="btn t sm" data-act="sleep-coach" data-key="${n.key}" style="background: #E7E9FB; color: var(--sleep)">${ic('coach', 16, 'var(--sleep)')}${state.sleepNotes?.[n.key] ? 'Refaire l’analyse' : 'Analyser ma nuit avec le coach'}</button>`}
    </section>`;
  }
  const weekBars = (() => {
    const W = 310, H = 100, bw = 26, step = W / 7;
    let o = `<svg width="100%" viewBox="0 0 ${W} ${H + 20}" aria-hidden="true">`;
    const Y = (m) => (m / 600) * (H - 6);
    o += `<line x1="0" x2="${W}" y1="${H - Y(420)}" y2="${H - Y(420)}" stroke="var(--sleep)" stroke-dasharray="4 4" opacity=".5"/><text x="${W}" y="${H - Y(420) - 4}" font-size="10" fill="var(--sleep)" text-anchor="end">7 h</text>`;
    week.forEach((h, i) => {
      const x = i * step + (step - bw) / 2;
      let y = H;
      if (h.stages) {
        [['deep', h.stages.deep], ['core', h.stages.core + h.stages.asleep], ['rem', h.stages.rem]].forEach(([k, m]) => { const hh = Y(m); y -= hh; o += `<rect x="${x}" y="${y}" width="${bw}" height="${hh}" fill="${STAGES[k].color}"/>`; });
      } else if (h.sleepMin) { const hh = Y(h.sleepMin); o += `<rect x="${x}" y="${H - hh}" width="${bw}" height="${hh}" rx="6" fill="var(--sleep)" opacity=".6"/>`; }
      else o += `<rect x="${x}" y="${H - 3}" width="${bw}" height="3" rx="1.5" fill="#E3DEEF"/>`;
      o += `<text x="${x + bw / 2}" y="${H + 15}" text-anchor="middle" font-size="11" fill="var(--sec)">${'LMMJVSD'[dayIdx(days[i])]}</text>`;
    });
    return o + '</svg>';
  })();
  return `
  <div class="cap">Nuit du ${fmtShort(addDays(d, -1))} au ${fmtShort(d)}</div>
  <h1 class="lt">Sommeil</h1>
  <section class="card row" style="margin-top: 16px; gap: 16px">
    <div class="grow"><div class="foot">Temps de sommeil</div><div><span class="big" style="color: var(--sleep)">${Math.floor(asleep / 60)}</span><span class="unit"> h </span><span class="big" style="color: var(--sleep)">${pad(Math.round(asleep % 60))}</span><span class="unit"> min</span></div></div>
    ${st ? `<div style="text-align: right"><div class="foot">Au total</div><div style="font-size: 17px; font-weight: 700">${fmtH(total)}</div></div>` : ''}
  </section>
  ${body || setup}
  <h2 class="sec">7 dernières nuits</h2>
  <section class="card">${weekBars}</section>
  <p class="foot" style="margin: 10px 4px 0">Repères généraux pour un adulte : 7 h de sommeil ou plus. Les phases mesurées par une montre sont des estimations, utiles pour suivre des tendances.</p>`;
}

function sleepTakeaways(n, st, asleep, pct) {
  const out = [];
  const day = parseKey(n.key);
  const s = sessionFor(day);
  const yest = logsOn(addDays(day, -1)).slice(-1)[0];
  if (asleep >= 420) out.push(`${Math.floor(asleep / 60)} h ${pad(Math.round(asleep % 60))} de sommeil : c'est dans la recommandation de 7 h ou plus, une bonne base pour récupérer et progresser.`);
  else out.push(`Moins de 7 h cette nuit : ta récupération sera un peu moins bonne. Si tu te sens fatiguée, garde des charges stables aujourd'hui plutôt que de chercher un record.`);
  const deepP = pct(st.deep);
  if (deepP < 13) out.push(`Peu de sommeil profond (${deepP} %). C'est lui qui répare tes muscles : un coucher régulier, pas d'écran ni de repas lourd juste avant et une chambre fraîche l'aident.`);
  else out.push(`Sommeil profond à ${deepP} % : bon pour la réparation de tes muscles${yest ? ` après ta séance d'hier (${yest.name.toLowerCase()})` : ''}.`);
  const remP = pct(st.rem);
  if (remP < 20) out.push(`REM un peu bas (${remP} %). Il augmente surtout en fin de nuit : dormir un peu plus longtemps ou te réveiller à heure fixe aide.`);
  else out.push(`REM à ${remP} % : bonne récupération mentale (mémoire, humeur, stress).`);
  if (s && !s.optional) out.push(asleep >= 420 && deepP >= 13 ? `Tu es bien reposée pour ta séance d'aujourd'hui (${s.name}).` : `Pour ta séance d'aujourd'hui (${s.name}) : échauffe-toi bien et écoute tes sensations.`);
  return out;
}

// ─────────────────────────── Réglages
function viewSettings() {
  const st = state.settings;
  const opts = [['', 'Repos'], ['lower', SESSIONS.lower.name], ['upper', SESSIONS.upper.name], ['run', 'Course'], ['long', 'Sortie longue'], ['optional', 'Activité douce (optionnelle)']];
  const weekList = (field, tpl) => `<div class="list">${DAYS.map((dn, i) => `<label class="li"><span class="grow" style="font-size: 16px">${dn}</span>
    <select data-act="weekday" data-field="${field}" data-d="${i}" style="border: 0; background: transparent; color: var(--violet-text); font-weight: 600; text-align: right; max-width: 60%">
      ${opts.map(([v, l]) => `<option value="${v}" ${(tpl[i] || '') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
    </select></label>`).join('')}</div>`;
  return `
  <button class="link" data-act="tab" data-v="today" style="margin: -6px -6px 0">${ic('chevL', 22, 'var(--violet-text)', 2.4)}Aujourd'hui</button>
  <h1 class="lt" style="margin-top: 8px">Réglages</h1>

  <h2 class="sec">Mon profil</h2>
  <section class="card stack">
    <div class="sub" style="color: var(--label)">Enregistré uniquement sur ce téléphone. Le coach s'en sert pour adapter ses conseils.</div>
    <label class="stack" style="gap: 6px"><span class="foot">Tu as un lien de profil ? Colle-le ici</span>
      <div class="row" style="gap: 8px"><input class="field" id="pf-link" placeholder="https://…#profil=…" autocomplete="off"><button class="btn t sm" data-act="import-profile">Importer</button></div></label>
    <label class="stack" style="gap: 6px"><span class="foot">Prénom</span><input class="field" id="pf-name" value="${esc(st.name)}"></label>
    <div class="grid2">
      <label class="stack" style="gap: 6px"><span class="foot">Âge</span><input class="field" id="pf-age" inputmode="numeric" value="${esc(st.profile?.age ?? '')}"></label>
      <label class="stack" style="gap: 6px"><span class="foot">Taille (cm)</span><input class="field" id="pf-height" inputmode="numeric" value="${esc(st.profile?.height ?? '')}"></label>
    </div>
    <div class="grid2">
      <label class="stack" style="gap: 6px"><span class="foot">Poids mini visé (kg)</span><input class="field" id="pf-zmin" inputmode="decimal" value="${st.zone ? fmtNum(st.zone[0]) : ''}"></label>
      <label class="stack" style="gap: 6px"><span class="foot">Poids maxi visé (kg)</span><input class="field" id="pf-zmax" inputmode="decimal" value="${st.zone ? fmtNum(st.zone[1]) : ''}"></label>
    </div>
    <label class="stack" style="gap: 6px"><span class="foot">Mes objectifs</span><textarea class="field" id="pf-goals">${esc(st.profile?.goals ?? '')}</textarea></label>
    <label class="stack" style="gap: 6px"><span class="foot">Mon contexte (reprise, santé, sports aimés…)</span><textarea class="field" id="pf-context">${esc(st.profile?.context ?? '')}</textarea></label>
    <button class="btn t sm" data-act="save-profile">Enregistrer mon profil</button>
  </section>

  <h2 class="sec">Coach IA (Gemini)</h2>
  <section class="card stack">
    <div class="sub" style="color: var(--label)">Ta clé reste sur ce téléphone. Crée-la gratuitement sur Google AI Studio, puis colle-la ici.</div>
    <a class="foot" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color: var(--violet-text); font-weight: 600">Ouvrir Google AI Studio →</a>
    <input class="field" type="password" id="apikey" value="${esc(st.apiKey)}" placeholder="Colle ta clé API ici" autocomplete="off">
    <button class="btn t sm" data-act="save-key">Enregistrer la clé</button>
    ${st.model ? `<div class="foot">Modèle utilisé : ${esc(st.model)}</div>` : ''}
  </section>

  <h2 class="sec">Santé (Apple Watch)</h2>
  <section class="card stack">
    <div class="sub" style="color: var(--label)">Le raccourci « RomFit Santé » copie tes données (sommeil, FC au repos…). Reviens ensuite ici et appuie sur « Coller ».</div>
    <div class="grid2"><button class="btn t sm" data-act="health-run">Lancer le raccourci</button><button class="btn t sm" data-act="health-paste">Coller les données</button></div>
    <textarea class="field" id="health-text" placeholder="Ou colle ici le texte copié par le raccourci" style="min-height: 70px"></textarea>
    <button class="btn w sm" data-act="health-manual" style="box-shadow: inset 0 0 0 1px var(--sep)">Importer ce texte</button>
  </section>

  <h2 class="sec">Ma semaine type</h2>
  <div class="foot" style="margin: -4px 4px 8px">Jusqu'au ${fmtShort(addDays(START, (TWO_RUNS_FROM_WEEK - 1) * 7 - 1))}</div>
  ${weekList('week', st.week)}
  <div class="foot" style="margin: 16px 4px 8px">À partir du ${fmtShort(addDays(START, (TWO_RUNS_FROM_WEEK - 1) * 7))} (2 courses par semaine, objectif 10 km)</div>
  ${weekList('week2', st.week2 || DEFAULT_WEEK_2)}
  <label class="list" style="display: block; margin-top: 12px"><div class="li"><span class="grow" style="font-size: 16px">Heure habituelle</span>
    <input type="time" data-act="default-hour" value="${esc(st.hour)}" style="border: 0; background: transparent; color: var(--violet-text); font-weight: 600"></div></label>

  <h2 class="sec">Mes retours sur l'app</h2>
  <section class="card stack">
    <div class="sub" style="color: var(--label)">Note tes idées au fil de l'eau, puis copie-les pour les envoyer à Claude.</div>
    ${state.feedback.length ? `<div class="list" style="padding: 0">${state.feedback.map((f, i) => `<div class="li"><div class="grow"><div style="font-size: 15px">${esc(f.text)}</div><div class="foot">${fmtShort(new Date(f.at))}</div></div><button class="link danger" data-act="del-feedback" data-i="${i}" style="font-size: 14px">Retirer</button></div>`).join('')}</div>` : ''}
    <div class="grid2"><button class="btn t sm" data-act="feedback">${ic('pencil', 16, 'var(--violet-text)')}Noter</button><button class="btn t sm" data-act="copy-feedback" ${state.feedback.length ? '' : 'disabled'}>${ic('copy', 16, 'var(--violet-text)')}Copier tout</button></div>
  </section>

  <h2 class="sec">Mes données</h2>
  <section class="card stack">
    <div class="sub" style="color: var(--label)">Tout est enregistré sur ce téléphone. Fais une sauvegarde de temps en temps.</div>
    <div class="grid2"><button class="btn t sm" data-act="export">Exporter</button><label class="btn t sm">Importer<input type="file" accept="application/json" data-act="import" hidden></label></div>
    <button class="link danger" data-act="reset" style="font-size: 15px">Tout effacer</button>
  </section>
  <button class="btn t block" data-act="reload" style="margin-top: 20px">Recharger l'app</button>
  <p class="foot center" style="margin-top: 20px">RomFit ${APP_VERSION}</p>
  <p class="foot center" style="margin-top: 4px">Programme construit à partir des recommandations ACSM et ISSN. Il ne remplace pas l'avis d'un coach diplômé ou d'une diététicienne. En cas de douleur, arrête l'exercice.</p>`;
}

function feedbackSheet() {
  return `<div class="row" style="justify-content: space-between"><div style="font-size: 22px; font-weight: 700">Noter un retour</div><button class="x" data-act="close-sheet" aria-label="Fermer">${ic('close', 14, 'var(--sec)', 2.4)}</button></div>
    <textarea class="field" id="fbtext" placeholder="Ex. : le minuteur est trop petit, ajoute du gainage le mardi…" autofocus></textarea>
    <button class="btn p block" data-act="save-feedback">Enregistrer</button>`;
}

// ─────────────────────────── Santé (raccourci Apple)
// Accepte du JSON ou un texte « clé : valeur » par ligne (format du raccourci RomFit Santé)
function parseHealthText(text) {
  const out = {};
  const num = (v) => { const m = String(v).replace(/\s/g, '').replace(/(\d)\.(?=\d{3}(\D|$))/g, '$1').match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; };
  // Regroupe les lignes par clé : une liste (une valeur par ligne) s'ajoute à la clé précédente
  const KEY = /^\s*(sommeil|sueno|sueño|sleep|fc_?\w*|pas\w*|pasos|steps|phases?|fases?|durees?|duraciones|debuts?|inicios?|seance\w*|kcal\w*|poids|weight|date)\s*:\s*(.*)$/i;
  const entries = [];
  const lists = {};
  String(text).split(/\n|;/).forEach((line) => {
    const m = line.match(KEY);
    if (m) entries.push([m[1], [m[2].trim()].filter(Boolean)]);
    else if (entries.length && line.trim()) entries[entries.length - 1][1].push(line.trim());
  });
  entries.forEach(([k, vals]) => {
    const key = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (!vals.length) return;
    // Phases du sommeil : listes parallèles (phase, durée, début)
    if (/^(phase|fase)/.test(key)) { lists.phases = vals; return; }
    if (/^(duree|duracion)/.test(key)) { lists.durees = vals; return; }
    if (/^(debut|inicio)/.test(key)) { lists.debuts = vals; return; }
    const raw = vals.length > 1 && !/fc|repos|poids|date/.test(key) ? String(vals.reduce((n, v) => n + (num(v) || 0), 0)) : vals[0];
    if (/sommeil|sleep|sueno|dormi/.test(key)) {
      const h = raw.match(/(\d+(?:[.,]\d+)?)\s*h/i), mn = raw.match(/(\d+)\s*min/i);
      let v;
      if (h || mn) v = (h ? parseFloat(h[1].replace(',', '.')) * 60 : 0) + (mn ? +mn[1] : 0);
      else {
        v = num(raw);
        if (v == null) return;
        if (/_h\b|heure/.test(key) || v <= 24) v *= 60; else if (/_s\b|seconde/.test(key) || v > 1440) v /= 60;
      }
      out.sommeil_min = Math.round(v);
    } else if (/^seance/.test(key)) {
      const v = num(raw);
      if (v == null) return;
      if (/km|dist/.test(key)) out.seance_km = v > 100 ? v / 1000 : v;      // mètres → km si besoin
      else if (/kcal|cal/.test(key)) out.seance_kcal = v;
      else if (/fc|cardi|bpm/.test(key)) out.seance_fc = v;
      else if (/min|dur/.test(key)) out.seance_min = v > 300 ? v / 60 : v;   // secondes → minutes si besoin
    } else if (/repos|resting/.test(key)) out.fc_repos = num(raw);
    // Pas : si plusieurs sources (montre, iPhone), on garde la plus élevée, comme Salud qui évite de compter deux fois
    else if (/^pas|pasos|steps/.test(key)) { const v = num(raw); if (v != null) out.pas = Math.max(out.pas || 0, v); }
    else if (/kcal|energie|calorie/.test(key)) out.kcal_actives = num(raw);
    else if (/poids|weight/.test(key)) out.poids = num(raw);
    else if (/date/.test(key)) out.date = raw.slice(0, 10);
  });
  if (lists.phases && lists.durees) out.phases = sleepStages(lists.phases, lists.durees, lists.debuts || [], num);
  return out;
}

// Phases du sommeil (noms Apple en espagnol, anglais ou français) → minutes par phase + déroulé de la nuit
const STAGE_OF = (v) => {
  const t = String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/rem|paradox/.test(t)) return 'rem';
  if (/profund|deep|profond/.test(t)) return 'deep';
  if (/esencial|core|principal|ligero|light|leger|essentiel/.test(t)) return 'core';
  if (/despiert|awake|eveil|reveil/.test(t)) return 'awake';
  if (/cama|in bed|au lit/.test(t)) return null;
  if (/dormid|asleep|endormi|unspec/.test(t)) return 'asleep';
  return null;
};
function sleepStages(phases, durees, debuts, num) {
  // Durées au format h:mm:ss, mm:ss ou en secondes (Atajos mélange les formats selon la longueur)
  const clockFormat = durees.some((v) => /\d:\d{2}/.test(v));
  const toMin = (v) => {
    const hms = String(v).match(/(\d+):(\d{2}):(\d{2})/);
    if (hms) return +hms[1] * 60 + +hms[2] + +hms[3] / 60;
    const ms = String(v).match(/(\d+):(\d{2})/);
    if (ms) return +ms[1] + +ms[2] / 60;
    const n = num(v);
    if (n == null) return 0;
    return clockFormat || n > 90 ? n / 60 : n;   // nombre seul = secondes
  };
  const toTime = (v) => { const all = [...String(v).matchAll(/(\d{1,2})[:h](\d{2})(?::\d{2})?/g)]; const m = all[all.length - 1]; return m ? +m[1] + +m[2] / 60 : null; };
  const totals = { rem: 0, deep: 0, core: 0, awake: 0, asleep: 0 };
  const segs = [];
  phases.forEach((p, i) => {
    const st = STAGE_OF(p);
    if (!st) return;
    const m = toMin(durees[i]);
    totals[st] += m;
    const t = toTime(debuts[i]);
    if (t != null) segs.push({ st, t, m });
  });
  Object.keys(totals).forEach((k) => { totals[k] = Math.round(totals[k]); });
  // Remet les débuts dans l'ordre de la nuit (après minuit = +24 h)
  segs.forEach((x) => { if (x.t < 15) x.t += 24; });
  segs.sort((a, b) => a.t - b.t);
  return { ...totals, segs: segs.map((x) => ({ st: x.st, t: Math.round(x.t * 100) / 100, m: Math.round(x.m * 10) / 10 })) };
}

function importHealth(text) {
  let data;
  try { data = JSON.parse(String(text).trim()); } catch { data = parseHealthText(text); }
  if (!data || (!Array.isArray(data) && !Object.keys(data).length)) { toast('Aucune donnée Santé reconnue. Relance le raccourci.'); return false; }
  const list = Array.isArray(data) ? data : [data];
  let n = 0;
  list.forEach((d) => {
    const key = d.date ? String(d.date).slice(0, 10) : dateKey();
    const cur = state.health[key] || {};
    const sleepMin = d.sommeil_min ?? (d.sommeil_h != null ? d.sommeil_h * 60 : null)
      ?? (Array.isArray(d.sommeil_segments) ? d.sommeil_segments.reduce((a, b) => a + (+b || 0), 0) : null);
    if (sleepMin != null && !isNaN(sleepMin)) cur.sleepMin = Math.round(sleepMin);
    if (d.phases) {
      cur.stages = d.phases;
      const asleep = d.phases.rem + d.phases.deep + d.phases.core + d.phases.asleep;
      if (asleep && cur.sleepMin == null) cur.sleepMin = asleep;
    }
    if (d.fc_repos != null) cur.restHR = +d.fc_repos;
    if (d.pas != null) cur.steps = +d.pas;
    if (d.kcal_actives != null) cur.kcal = +d.kcal_actives;
    state.health[key] = cur;
    if (d.seance_km != null || d.seance_min != null || d.seance_kcal != null || d.seance_fc != null) {
      const round = (v, k = 1) => (v == null || isNaN(v) ? null : Math.round(v * k) / k);
      const perf = { minutes: round(d.seance_min), km: round(d.seance_km, 100), hr: round(d.seance_fc), kcal: round(d.seance_kcal) };
      const existing = state.logs.filter((l) => l.dateKey === key).slice(-1)[0];
      if (existing) {
        if (perf.minutes) existing.durationMin = perf.minutes;
        if (perf.km) existing.km = perf.km;
        existing.watch = { ...(existing.watch || {}), ...(perf.hr ? { hr: perf.hr } : {}), ...(perf.kcal ? { kcal: perf.kcal } : {}) };
        save('logs');
      } else logManual(key, perf);
      state.lastWorkoutImport = key;
    }
    if (d.poids != null && +d.poids > 30) { state.weights = state.weights.filter((w) => w.date !== key); state.weights.push({ date: key, kg: +d.poids }); state.weights.sort((a, b) => a.date.localeCompare(b.date)); }
    n++;
  });
  save('health', 'weights');
  toast(n ? 'Données Santé importées ✓' : 'Rien à importer');
  return true;
}

// ─────────────────────────── Rendu
const VIEWS = { sleep: viewSleep, today: viewToday, planning: viewPlanning, programme: viewProgramme, workout: viewWorkout, finish: viewFinish, progress: viewProgress, settings: viewSettings };
function logDetail(id) {
  const l = state.logs.find((x) => x.id === id);
  if (!l) return '';
  const icon = kindIcon[l.kind] || kindIcon.douce;
  const pace = l.km && l.durationMin ? l.durationMin / l.km : null;
  const tiles = [
    [l.durationMin, 'min', 'Durée'],
    l.km ? [fmtNum(l.km), 'km', 'Distance'] : null,
    pace ? [`${Math.floor(pace)}:${pad(Math.round((pace % 1) * 60))}`, '/km', 'Allure'] : null,
    l.watch?.hr ? [Math.round(l.watch.hr), 'BPM', 'FC moyenne'] : null,
    l.watch?.kcal ? [Math.round(l.watch.kcal), 'kcal', 'Calories actives'] : null,
  ].filter(Boolean);
  const ex = (l.exercises || []).filter((e) => e.sets.some((x) => x.done));
  return `<div class="row" style="justify-content: space-between; align-items: flex-start">
      <div class="row" style="gap: 10px"><div class="ico" style="background: ${icon[1]}">${ic(icon[0], 17, icon[2])}</div>
      <div><div style="font-size: 20px; font-weight: 700">${esc(l.name)}</div><div class="sub">${fmtDay(parseKey(l.dateKey))}</div></div></div>
      <button class="x" data-act="close-sheet" aria-label="Fermer">${ic('close', 14, 'var(--sec)', 2.4)}</button>
    </div>
    <div class="grid2" style="gap: 10px">${tiles.map(([v, u, lab]) => `<div style="background: var(--fill); border-radius: 12px; padding: 12px">
      <div class="foot">${lab}</div><div><span class="big" style="font-size: 24px">${v}</span><span class="unit"> ${u}</span></div></div>`).join('')}</div>
    ${l.feeling ? `<div class="row" style="gap: 8px"><span class="foot">Ressenti</span><span class="chip soft">${esc(l.feeling)}</span></div>` : ''}
    ${ex.length ? `<div class="list" style="padding: 0 4px">${ex.map((e) => {
      const d = EXERCISES[e.id];
      return `<div class="li" style="align-items: flex-start"><div class="grow"><div style="font-size: 15px; font-weight: 600">${esc(d?.name || e.id)}</div>
        <div class="foot">${e.sets.filter((x) => x.done).map((x) => d?.unit === 'time' ? `${x.reps} s` : x.kg ? `${x.kg} kg × ${x.reps}` : `${x.reps} reps`).join(' · ')}</div></div></div>`;
    }).join('')}</div>` : ''}
    ${(l.ups || []).length ? `<div class="note">${ic('arrowUp', 16, 'var(--violet-text)', 2.4)}<span>Prochaine fois : ${esc(l.ups.join(', '))}</span></div>` : ''}
    ${state.busy === 'logshot' ? `<div class="foot row" style="gap: 8px; color: var(--violet-text)"><span class="typing"><span></span><span></span><span></span></span>Le coach lit ta capture…</div>` : ''}
    <label class="btn t block" style="cursor: pointer">${ic('watch', 16, 'var(--violet-text)')}Importer une capture Apple Watch<input type="file" accept="image/*" multiple data-act="log-shot" data-id="${l.id}" hidden></label>
    <button class="btn w block" data-act="edit-log" data-id="${l.id}" style="box-shadow: inset 0 0 0 1px var(--sep)">${ic('pencil', 16, 'var(--violet-text)')}Modifier à la main</button>`;
}

function logSheet(id) {
  const l = state.logs.find((x) => x.id === id);
  if (!l) return '';
  const f = (k, label, v, mode = 'decimal') => `<label class="stack" style="gap: 4px"><span class="foot">${label}</span><input class="field" id="lg-${k}" inputmode="${mode}" value="${v != null ? esc(fmtNum(v)) : ''}" placeholder="—"></label>`;
  return `<div class="row" style="justify-content: space-between"><div><div style="font-size: 20px; font-weight: 700">${esc(l.name)}</div><div class="sub">${fmtDay(parseKey(l.dateKey))}</div></div>
      <button class="x" data-act="close-sheet" aria-label="Fermer">${ic('close', 14, 'var(--sec)', 2.4)}</button></div>
    <div class="grid2">${f('min', 'Durée (min)', l.durationMin, 'numeric')}${f('km', 'Distance (km)', l.km)}${f('hr', 'FC moyenne', l.watch?.hr, 'numeric')}${f('kcal', 'Calories actives', l.watch?.kcal, 'numeric')}</div>
    <button class="btn p block" data-act="save-log" data-id="${l.id}">Enregistrer</button>
    <button class="link danger" data-act="del-log" data-id="${l.id}" style="font-size: 15px; align-self: center">${state.confirmDel === l.id ? 'Confirmer la suppression' : 'Supprimer cette séance'}</button>`;
}

const SHEETS = { detail: (a) => logDetail(a), log: (a) => logSheet(a), move: (a) => moveSheet(a), day: (a) => daySheet(a), weight: weightSheet, feedback: feedbackSheet };

function render() {
  if (['workout', 'finish'].includes(state.view) && !state.active) state.view = 'today';
  const fn = VIEWS[state.view] || viewToday;
  const withTabs = !['workout', 'finish'].includes(state.view);
  const sheet = state.sheet ? `<div class="scrim" data-act="close-sheet"></div><div class="sheet" role="dialog"><div class="handle"></div>${SHEETS[state.sheet.type](state.sheet.arg)}</div>` : '';
  const video = state.video ? `<div class="video" role="dialog"><button class="x" data-act="close-video" aria-label="Fermer la vidéo">${ic('close', 16, '#fff', 2.4)}</button>
    <iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(state.video)}?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="Démonstration"></iframe></div>` : '';
  const upd = state.updateReady ? `<button class="note" data-act="reload" style="width: 100%; margin-bottom: 12px; align-items: center; text-align: left">${ic('refresh', 18, 'var(--violet-text)')}<span class="grow">Une nouvelle version de RomFit est prête.</span><b style="color: var(--violet-text)">Mettre à jour</b></button>` : '';
  $('#app').innerHTML = `<main>${upd}${fn()}</main>${withTabs ? tabbar() : ''}${state.view === 'workout' ? restBar() : ''}${sheet}${video}`;
}

// ─────────────────────────── Actions
const ACTIONS = {
  tab: (t) => {
    state.confirmAbandon = false; state.view = t.dataset.v; state.weekOffset = state.view === 'planning' ? state.weekOffset : 0; render();
    // Le coach s'ouvre sur les derniers messages, les autres écrans en haut
    if (state.view === 'coach') requestAnimationFrame(() => scrollTo(0, document.body.scrollHeight)); else scrollTo(0, 0);
  },
  week: (t) => { state.weekOffset = +t.dataset.v; render(); },
  meals: () => { state.mealsOpen = !state.mealsOpen; render(); },
  start: (t) => {
    state.sheet = null;
    startSession(t.dataset.date);
  },
  resume: () => { state.view = 'workout'; render(); scrollTo(0, 0); },
  preview: (t) => { state.sheet = { type: 'day', arg: t.dataset.date }; render(); },
  'run-place': (t) => { state.runPlace[t.dataset.date] = t.dataset.v; save('runPlace'); render(); },
  'opt-choice': (t) => { state.optChoice[t.dataset.date] = t.dataset.v; save('optChoice'); render(); },
  'sleep-coach': (t) => sleepCoach(t.dataset.key),
  'mark-done': (t) => {
    const dk = t.dataset.date;
    const s = sessionFor(parseKey(dk));
    const x = $('#md-x').value;
    logManual(dk, { minutes: $('#md-min').value, ...(s.kind === 'course' ? { km: x } : { hr: x }) });
    state.sheet = null; render(); toast('Séance enregistrée ✓');
  },
  'reset-day': (t) => {
    const d = parseKey(t.dataset.date);
    const plan = weekPlan(d).slice();
    const i = dayIdx(d);
    plan[i] = defaultWeek(d)[i] || { key: 'lower' };
    setWeekPlan(d, plan); state.sheet = null; render(); toast('Séance prévue rétablie ✓');
  },
  'remove-day': (t) => { removeDay(t.dataset.date); state.sheet = null; render(); toast('Séance retirée de la semaine'); },
  'move-sheet': (t) => { state.sheet = { type: 'move', arg: t.dataset.date }; render(); },
  'move-to': (t) => { moveSession(dayIdx(parseKey(t.dataset.from)), +t.dataset.to, parseKey(t.dataset.from)); state.sheet = null; toast(`Séance déplacée à ${DAYS[+t.dataset.to].toLowerCase()}`); render(); },
  'reset-week': () => { delete state.plan[wkKey(addDays(weekStart(), state.weekOffset * 7))]; save('plan'); render(); },
  'close-sheet': () => { state.sheet = null; render(); },
  'ex-next': () => { state.active.idx++; save('active'); render(); scrollTo(0, 0); },
  'ex-prev': () => { state.active.idx = Math.max(0, state.active.idx - 1); save('active'); render(); scrollTo(0, 0); },
  set: (t) => {
    unlockAudio();
    const k = +t.dataset.k, j = +t.dataset.j;
    const s = activeSession();
    const ex = EXERCISES[s.exercises[k].id];
    const set = state.active.exercises[k].sets[j];
    set.done = !set.done;
    if (set.done && !set.reps) set.reps = String(ex.unit === 'time' ? s.exercises[k].load : ex.reps[1]);
    const lastOne = k === s.exercises.length - 1 && j === state.active.exercises[k].sets.length - 1;
    state.rest = set.done && !lastOne ? { end: Date.now() + +t.dataset.rest * 1000, total: +t.dataset.rest } : null;
    save('active'); render();
  },
  'rest-add': () => { if (state.rest) { state.rest.end += 15000; state.rest.total += 15; } },
  'rest-skip': () => { state.rest = null; $('#restbar')?.remove(); },
  step: (t) => { state.active.steps[+t.dataset.j] = !state.active.steps[+t.dataset.j]; save('active'); render(); },
  finish: () => { state.rest = null; state.view = 'finish'; render(); scrollTo(0, 0); },
  feeling: (t) => { state.active.feeling = t.dataset.v; save('active'); render(); },
  'save-session': saveSession,
  video: (t) => { state.video = t.dataset.id; render(); },
  'close-video': () => { state.video = null; render(); },
  'weight-sheet': () => { state.sheet = { type: 'weight' }; render(); },
  'save-weight': () => {
    const v = parseNum($('#wkg').value);
    if (!v || v < 30 || v > 150) { toast('Poids invalide'); return; }
    const k = dateKey();
    state.weights = state.weights.filter((w) => w.date !== k).concat({ date: k, kg: v }).sort((a, b) => a.date.localeCompare(b.date));
    save('weights'); state.sheet = null; render();
    const w = state.weights; const n = w.length;
    if (state.settings.zone && v < state.settings.zone[0]) toast('Tu es sous ta zone : ajoute une collation par jour et parles-en au coach.');
    else if (n >= 3 && w[n - 1].kg < w[n - 2].kg && w[n - 2].kg < w[n - 3].kg) toast('Ton poids baisse 2 semaines de suite : ajoute une collation par jour.');
  },
  'log-detail': (t) => { state.sheet = { type: 'detail', arg: t.dataset.id }; render(); },
  'edit-log': (t) => { state.confirmDel = null; state.sheet = { type: 'log', arg: t.dataset.id }; render(); },
  'save-log': (t) => {
    const l = state.logs.find((x) => x.id === t.dataset.id);
    const v = (k) => parseNum($('#lg-' + k).value);
    l.durationMin = v('min') || l.durationMin; l.km = v('km');
    l.watch = { ...(l.watch || {}), hr: v('hr'), kcal: v('kcal') };
    save('logs'); state.sheet = null; render(); toast('Séance modifiée ✓');
  },
  'del-log': (t) => {
    if (state.confirmDel !== t.dataset.id) { state.confirmDel = t.dataset.id; render(); return; }
    state.logs = state.logs.filter((l) => l.id !== t.dataset.id); state.confirmDel = null; state.sheet = null;
    save('logs'); render(); toast('Séance supprimée');
  },
  abandon: () => {
    if (!state.confirmAbandon) { state.confirmAbandon = true; render(); return; }
    state.active = null; state.rest = null; state.confirmAbandon = false; state.view = 'today';
    save('active'); render(); scrollTo(0, 0); toast('Séance abandonnée');
  },
  reload: () => hardReload(),
  feedback: () => { state.sheet = { type: 'feedback' }; render(); },
  'save-feedback': () => { const v = $('#fbtext').value.trim(); if (v) { state.feedback.push({ text: v, at: new Date().toISOString() }); save('feedback'); toast('Retour noté ✓'); } state.sheet = null; render(); },
  'del-feedback': (t) => { state.feedback.splice(+t.dataset.i, 1); save('feedback'); render(); },
  'copy-feedback': async () => {
    const txt = 'Mes retours sur RomFit :\n' + state.feedback.map((f) => `- ${f.text}`).join('\n');
    try { await navigator.clipboard.writeText(txt); toast('Copié ✓ Colle-le dans Claude.'); } catch { prompt('Copie ce texte :', txt); }
  },
  'import-profile': () => {
    const v = $('#pf-link').value.trim();
    if (!/profil=/.test(v)) { toast('Colle le lien complet (il contient « #profil= »).'); return; }
    location.hash = v.slice(v.indexOf('profil='));
    checkHash(); render();
  },
  'save-profile': () => {
    const st = state.settings;
    const v = (id) => $(id).value.trim();
    st.name = v('#pf-name');
    st.profile = { age: v('#pf-age'), height: v('#pf-height'), goals: v('#pf-goals'), context: v('#pf-context') };
    const zmin = parseNum(v('#pf-zmin')), zmax = parseNum(v('#pf-zmax'));
    st.zone = zmin && zmax && zmax > zmin ? [zmin, zmax] : null;
    save('settings'); toast('Profil enregistré ✓'); render();
  },
  'save-key': () => { state.settings.apiKey = $('#apikey').value.trim(); state.settings.model = ''; save('settings'); toast('Clé enregistrée ✓'); render(); },
  'health-sync': () => { state.healthPending = Date.now(); location.href = 'shortcuts://run-shortcut?name=' + encodeURIComponent('RomFit Santé'); },
  'health-run': () => { state.healthPending = Date.now(); location.href = 'shortcuts://run-shortcut?name=' + encodeURIComponent('RomFit Santé'); },
  'health-manual': () => { const v = $('#health-text').value; if (v.trim() && importHealth(v)) { state.view = 'today'; render(); scrollTo(0, 0); } },
  'health-paste': async () => {
    state.healthPending = null;
    try { const txt = await navigator.clipboard.readText(); if (importHealth(txt)) { state.view = 'today'; render(); } } catch { toast('Collage refusé : colle le texte dans le champ des réglages.'); }
  },
  export: () => {
    const data = {}; KEYS.forEach((k) => { data[k] = state[k]; }); data.settings = { ...state.settings, apiKey: '' };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = `romfit-sauvegarde-${dateKey()}.json`; a.click();
  },
  reset: () => {
    if (!confirm('Effacer toutes tes données (séances, charges, poids, discussions) ?')) return;
    KEYS.forEach((k) => { try { localStorage.removeItem('romfit2:' + k); } catch {} });
    location.reload();
  },
  'other-sport': () => { state.view = 'coach'; state.draft = "Aujourd'hui j'ai plutôt envie de faire autre chose : "; render(); scrollTo(0, document.body.scrollHeight); setTimeout(() => { const i = $('#chatinput'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 50); },
};

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'button')) return;
  const fn = ACTIONS[t.dataset.act];
  if (fn) fn(t, e);
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.set && state.active) {
    const set = state.active.exercises[+t.dataset.k].sets[+t.dataset.j];
    set[t.dataset.set] = t.value; save('active');
  } else if (t.dataset.cardio && state.active) { state.active.cardio[t.dataset.cardio] = t.value; save('active'); }
  else if (t.dataset.watch && state.active) { state.active.watch = { ...(state.active.watch || {}), [t.dataset.watch]: t.value }; save('active'); }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  // Charge modifiée à la salle : on ajuste les séries suivantes et les prochaines séances
  if (t.dataset.set === 'kg' && state.active) {
    const k = +t.dataset.k, j = +t.dataset.j;
    const v = parseNum(t.value);
    const cur = state.active.exercises[k];
    if (v != null) {
      cur.sets[j].kg = fmtNum(v);
      cur.sets.forEach((s, i) => { if (i > j && !s.done) s.kg = fmtNum(v); });
      const id = cur.id;
      const planned = plannedLoad(id, state.active.week);
      if (v !== planned) { cur.changed = true; cur.newKg = fmtNum(v); state.loads[id] = v; save('loads'); }
      save('active'); render();
    }
  }
  if (t.dataset.act === 'hour') { state.hours[t.dataset.date] = t.value; save('hours'); render(); }
  if (t.dataset.act === 'default-hour') { state.settings.hour = t.value; save('settings'); }
  if (t.dataset.act === 'weekday') {
    const f = t.dataset.field || 'week';
    const w = { ...(state.settings[f] || (f === 'week2' ? DEFAULT_WEEK_2 : DEFAULT_WEEK)) };
    if (t.value) w[t.dataset.d] = t.value; else delete w[t.dataset.d];
    state.settings[f] = w; save('settings'); toast('Semaine type mise à jour');
  }
  if (t.dataset.act === 'chart-ex') { state.chartEx = t.value; render(); }
  if (t.dataset.act === 'import' && t.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.settings || !Array.isArray(data.logs)) throw new Error();
        const key = state.settings.apiKey;
        KEYS.forEach((k) => { if (data[k] !== undefined) state[k] = data[k]; });
        state.settings.apiKey = state.settings.apiKey || key;
        save(); render(); toast('Sauvegarde importée ✓');
      } catch { toast('Ce fichier n’est pas une sauvegarde RomFit.'); }
    };
    r.readAsText(t.files[0]);
  }
});

// Import Santé via le lien (#sante=…)
function checkHash() {
  const p = location.hash.match(/profil=([^&]+)/);
  if (p) {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(p[1])))));
      const st = state.settings;
      if (d.name) st.name = d.name;
      if (d.zone) st.zone = d.zone;
      st.profile = { ...(st.profile || {}), ...(d.profile || {}) };
      save('settings'); toast('Profil enregistré ✓');
    } catch { toast('Lien de profil invalide.'); }
    history.replaceState(null, '', location.pathname);
  }
  const m = location.hash.match(/sante=([^&]+)/);
  if (m) { importHealth(decodeURIComponent(m[1])); history.replaceState(null, '', location.pathname); }
}

// Tirer vers le bas pour recharger (l'app installée n'a pas de bouton de rechargement)
let pull = null;
document.addEventListener('touchstart', (e) => {
  if (scrollY <= 0 && !state.sheet && !state.video && !drag && !e.target.closest('input, textarea, select, [data-grip]')) pull = { y: e.touches[0].clientY, d: 0 };
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!pull) return;
  pull.d = e.touches[0].clientY - pull.y;
  let ind = $('#pull');
  if (pull.d > 10 && !ind) { ind = document.createElement('div'); ind.id = 'pull'; ind.className = 'pull'; document.body.appendChild(ind); }
  if (ind) {
    const k = Math.min(1, pull.d / 90);
    ind.style.transform = `translate(-50%, ${Math.min(70, pull.d * 0.5)}px) rotate(${k * 270}deg)`;
    ind.style.opacity = k;
    ind.classList.toggle('ready', pull.d > 90);
  }
}, { passive: true });
document.addEventListener('touchend', () => {
  if (!pull) return;
  const go = pull.d > 90;
  pull = null;
  const ind = $('#pull');
  if (go) { if (ind) ind.classList.add('spin'); setTimeout(() => location.reload(), 250); } else if (ind) ind.remove();
});

// ─────────────────────────── Mises à jour
async function hardReload() {
  try { const r = await navigator.serviceWorker?.getRegistration(); await r?.update(); } catch {}
  location.reload();
}
async function checkUpdate() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const { v } = await r.json();
    if (v && v !== APP_VERSION && !state.updateReady) { state.updateReady = true; render(); }
  } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });

// ─────────────────────────── Démarrage
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.healthPending) render(); });
if (!state.settings.since) { state.settings.since = dateKey(); store.set('settings', state.settings); }
checkHash();
if (state.active) state.view = 'workout';
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
checkUpdate();
