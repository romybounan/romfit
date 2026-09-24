// RomFit — coach IA (Gemini). La clé API est stockée sur le téléphone et envoyée uniquement à Google.

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const FALLBACK_MODEL = 'gemini-2.5-flash';

async function pickModel() {
  if (state.settings.model) return state.settings.model;
  try {
    const r = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': state.settings.apiKey } });
    const data = await r.json();
    const names = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace('models/', ''))
      .filter((n) => /flash/.test(n) && !/lite|image|tts|audio|live|thinking|exp/.test(n));
    const best = names.find((n) => /^gemini-3.*flash$/.test(n)) || names.find((n) => /^gemini-3.*flash/.test(n)) || names.find((n) => n === FALLBACK_MODEL) || names[0];
    state.settings.model = best || FALLBACK_MODEL;
  } catch { state.settings.model = FALLBACK_MODEL; }
  save('settings');
  return state.settings.model;
}

// Appel à Gemini avec relance automatique : si un modèle est surchargé (503) ou à sa limite (429),
// on réessaie puis on passe au modèle gratuit suivant.
const BACKUP_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gemini(contents, opts = {}) {
  if (!state.settings.apiKey) throw new Error('nokey');
  const first = await pickModel();
  const models = [...new Set([first, ...BACKUP_MODELS])];
  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await geminiOnce(model, contents, opts);
      } catch (e) {
        lastErr = e;
        if (e.status === 404) break;                       // modèle indisponible : suivant
        if (e.status === 503 || e.status === 500) { await sleep(attempt ? 3000 : 1200); continue; } // surcharge : on réessaie
        if (e.status === 429) break;                       // limite de ce modèle : suivant
        throw e;                                           // autre erreur : on arrête
      }
    }
  }
  throw lastErr?.status === 429 ? new Error('quota') : lastErr?.status === 503 ? new Error('busy') : lastErr;
}

async function geminiOnce(model, contents, { system, schema, loose } = {}) {
  const body = { contents, generationConfig: { temperature: 0.6 } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (schema) { body.generationConfig.responseMimeType = 'application/json'; body.generationConfig.responseSchema = schema; }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let r;
  try {
    r = await fetch(`${GEMINI}/models/${model}:generateContent`, {
      signal: ctrl.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': state.settings.apiKey },
      body: JSON.stringify(body),
    });
  } finally { clearTimeout(timer); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `Erreur ${r.status}`;
    // Schéma refusé par ce modèle : on redemande sans schéma strict (JSON décrit dans la consigne)
    if (r.status === 400 && schema && /schema|response_schema|responseSchema/i.test(msg)) {
      return geminiOnce(model, contents, { system: `${system || ''}\nRéponds uniquement avec un objet JSON respectant ce schéma : ${JSON.stringify(schema)}`, loose: true });
    }
    const err = new Error(`${r.status} · ${msg}`);
    err.status = r.status;
    throw err;
  }
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
  if (!text) throw new Error(`réponse vide (${cand?.finishReason || data.promptFeedback?.blockReason || 'inconnu'})`);
  if (!schema && !loose) return text;
  return parseJsonLoose(text);
}

// Lit du JSON même entouré de ```json … ``` ou de texte
function parseJsonLoose(text) {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(clean); } catch {}
  const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(clean.slice(a, b + 1)); } catch {} }
  // Dernier recours : afficher le texte tel quel comme réponse
  return { reply: clean, actions: [] };
}

function errText(e) {
  if (e.message === 'nokey') return 'Ajoute ta clé Gemini dans les réglages pour parler au coach.';
  if (e.message === 'quota') return 'Limite gratuite de Gemini atteinte pour le moment. Réessaie dans quelques minutes.';
  if (e.message === 'busy') return 'Les serveurs de Gemini sont surchargés en ce moment (côté Google). Réessaie dans quelques minutes.';
  if (/API key/i.test(e.message)) return 'Ta clé Gemini semble invalide. Vérifie-la dans les réglages.';
  if (e.name === 'AbortError') return 'Le coach met trop de temps à répondre. Réessaie dans un instant.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(e.message)) return 'Pas de connexion internet. Réessaie quand tu as du réseau.';
  return `Le coach n’a pas pu répondre. Détail : ${String(e.message).slice(0, 160)}`;
}

// Réduit une photo avant envoi (plus rapide, moins de données)
function shrink(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
const inlineImg = (dataUrl) => ({ inline_data: { mime_type: 'image/jpeg', data: dataUrl.split(',')[1] } });

// ─────────────────────────── Contexte envoyé au coach
function coachContext() {
  const now = new Date();
  const ws = weekStart(now);
  const week = weekNo(now);
  const days = Array.from({ length: 14 }, (_, i) => addDays(ws, i)).map((d) => {
    const s = sessionFor(d);
    return { date: dateKey(d), jour: DAYS[dayIdx(d)], seance: s ? { nom: s.name, type: s.kind, optionnelle: !!s.optional, minutes: s.minutes } : null, faite: doneOn(d), heure: state.hours[dateKey(d)] || null };
  });
  const recent = state.logs.slice(-12).map((l) => ({
    date: l.dateKey, seance: l.name, type: l.kind, minutes: l.durationMin, ressenti: l.feeling, km: l.km || undefined, fc_moy: l.watch?.hr || undefined,
    exercices: (l.exercises || []).map((e) => `${EXERCISES[e.id]?.name}: ${e.sets.filter((s) => s.done).map((s) => (s.kg ? `${s.kg}kg×${s.reps}` : s.reps)).join(', ')}`),
  }));
  const health = Object.entries(state.health).slice(-10).map(([d, h]) => ({ date: d, sommeil_min: h.sleepMin, fc_repos: h.restHR, pas: h.steps }));
  return {
    aujourdhui: dateKey(now),
    profil: {
      prenom: state.settings.name || null, age: state.settings.profile?.age || null, taille_cm: state.settings.profile?.height || null,
      poids_kg: state.weights.slice(-1)[0]?.kg || null,
      objectifs: state.settings.profile?.goals || 'Non renseignés',
      contexte: state.settings.profile?.context || 'Non renseigné',
      engagement: '3 séances prioritaires par semaine + 1 optionnelle.',
      heure_habituelle: state.settings.hour,
      zone_poids_kg: state.settings.zone,
      pause_kine: typeof REHAB !== 'undefined' ? `${REHAB.label} du ${REHAB.from} au ${REHAB.to} : aucun exercice pour les épaules et les bras, rien à porter à bout de bras, pas de gainage sur les bras. 2 séances jambes/fessiers par semaine, 1 course (3 km minimum, sur tapis ou dehors), 1 séance optionnelle (vélo, marche inclinée ou reformer).` : null,
    },
    programme: { semaine: week, sur: 15, phase: phaseFor(week).name, fin: PROGRAM_END, seances_types: Object.fromEntries(Object.entries(SESSIONS).map(([k, s]) => [k, s.name])) },
    exercices_disponibles: Object.fromEntries(Object.entries(EXERCISES).map(([id, e]) => [id, e.name])),
    charges_actuelles_kg: Object.fromEntries(Object.keys(EXERCISES).filter((id) => !EXERCISES[id].bodyweight).map((id) => [id, state.loads[id] ?? EXERCISES[id].base])),
    planning_2_semaines: days,
    dernieres_seances: recent,
    sante: health,
    poids: state.weights.slice(-6),
  };
}

const SYSTEM = `Tu es le coach sportif et nutrition de l'utilisatrice de l'app RomFit (son prénom et son profil sont dans le contexte). Tu t'appuies sur les recommandations reconnues (ACSM pour l'entraînement et le cardio, ISSN pour les protéines) et tu adaptes tout à son profil et à ses objectifs.
Règles :
- Réponds dans la langue de son message (français ou espagnol), tutoiement, ton chaleureux, direct et motivant, réponses courtes (4 à 6 phrases max) adaptées à un écran de téléphone. Pas de markdown, pas de titres, pas d'astérisques.
- Respecte ses objectifs de poids : si elle ne veut pas maigrir (ou si son poids passe sous sa zone), ne propose jamais de régime hypocalorique ni de perte de poids.
- Course : allure lente (zone 2, elle doit pouvoir parler), alternance marche/course si besoin.
- Tu modifies l'app UNIQUEMENT via la liste "actions" (plusieurs actions possibles dans une réponse). Elle doit ensuite appuyer sur « Appliquer ». N'écris jamais que c'est fait ou enregistré : dis plutôt « appuie sur Appliquer ». Si ce qu'elle demande n'est pas faisable avec les actions, dis-le honnêtement.
- Actions disponibles (dates au format AAAA-MM-JJ, voir planning_2_semaines) :
  • "log_session" : enregistrer une séance qu'elle a faite (date, et log : name, kind, minutes, km, fc_moyenne, kcal, ressenti Facile/Bien/Dur). N'invente aucun chiffre : mets seulement ceux qu'elle donne.
  • "remove_session" : retirer une séance prévue du planning (date). Une action par jour.
  • "replace_session" : remplacer la séance d'un jour (date + session). Si elle veut changer le sport du jour, donne d'abord ton avis honnête (récupération, équilibre de la semaine, sommeil). Pour la salle, uniquement des exercise_ids de la liste fournie ; pour le cardio ou une activité douce, des steps avec des minutes.
  • "move_session" : déplacer une séance (date d'origine, to_date dans la même semaine).
- Si aucune modification n'est nécessaire, "actions" est une liste vide.
- Pause kiné (voir profil.pause_kine) : pendant ces dates, ne propose JAMAIS d'exercice qui sollicite les épaules ou les bras (tirages, développés, curls, triceps, pompes, gainage sur les bras, haltères tenus en main). Utilise les exercices sans charge sur le haut du corps : hip-thrust, presse-cuisses, leg-curl, leg-extension, abduction-machine, kickback-poulie, hyperextension, pont-unilateral, fentes-bulgares-pdc, releve-jambes, dead-bug.
- Signes d'alerte (douleur dans la poitrine, malaise ou vertige, palpitations inhabituelles, essoufflement disproportionné) : arrêt immédiat de l'effort et consultation médicale. Tu n'es pas médecin.
- Malade ou fièvre : pas de séance. Courbatures : reprise légère possible. Douleur articulaire ou vive : arrêt de l'exercice et avis d'un professionnel de santé.
- Signes de manque d'énergie (poids qui baisse, règles irrégulières ou absentes, fatigue persistante) : lui conseiller de manger davantage et d'en parler à un médecin.
- Ne jamais augmenter une charge de plus d'un palier par séance. Pas plus de 5 séances par semaine. Garder environ 48 h entre deux séances qui sollicitent les mêmes muscles.
- Cellulite : dire que le sport peut améliorer l'aspect de la peau, jamais promettre de la faire disparaître.
- Aucun conseil sur les compléments alimentaires ou les médicaments.
- N'invente pas de données : utilise uniquement le contexte fourni.`;

const CHAT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    actions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['replace_session', 'move_session', 'remove_session', 'log_session'] },
          date: { type: 'STRING' },
          to_date: { type: 'STRING' },
          session: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              kind: { type: 'STRING', enum: ['salle', 'course', 'douce'] },
              minutes: { type: 'INTEGER' },
              tip: { type: 'STRING' },
              exercise_ids: { type: 'ARRAY', items: { type: 'STRING' } },
              steps: { type: 'ARRAY', items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, minutes: { type: 'INTEGER' } }, required: ['label'] } },
            },
            required: ['name', 'kind'],
          },
          log: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              kind: { type: 'STRING', enum: ['salle', 'course', 'douce'] },
              minutes: { type: 'NUMBER' },
              km: { type: 'NUMBER' },
              fc_moyenne: { type: 'NUMBER' },
              kcal: { type: 'NUMBER' },
              ressenti: { type: 'STRING', enum: ['Facile', 'Bien', 'Dur'] },
            },
          },
        },
        required: ['type', 'date'],
      },
    },
  },
  required: ['reply', 'actions'],
};

async function sendChat(text, image) {
  if (!text && !image) return;
  state.chat.push({ role: 'user', text, image: image || null, at: Date.now() });
  state.busy = 'chat'; state.draft = '';
  save('chat'); render(); scrollToBottom();
  try {
    const history = state.chat.slice(-12).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [...(m.image ? [inlineImg(m.image)] : []), { text: m.role === 'user' ? (m.text || 'Regarde cette image.') : m.text }],
    }));
    const ctx = `Contexte (données de l'app, JSON) :\n${JSON.stringify(coachContext())}`;
    history[history.length - 1].parts.unshift({ text: ctx });
    const res = await gemini(history, { system: SYSTEM, schema: CHAT_SCHEMA });
    if (typeof res.reply !== 'string' || !res.reply) throw new Error('réponse sans texte');
    const actions = (res.actions || []).filter((a) => a && a.type && a.date);
    state.chat.push({ role: 'model', text: res.reply, actions: actions.length ? actions : null, at: Date.now() });
  } catch (e) {
    state.chat.push({ role: 'model', text: errText(e), error: true, at: Date.now() });
  }
  state.busy = false;
  // On ne garde pas les photos dans l'historique au-delà des 5 derniers messages (mémoire du téléphone)
  state.chat.forEach((m, i) => { if (i < state.chat.length - 5) m.image = null; });
  state.chat = state.chat.slice(-60);
  save('chat'); render(); scrollToBottom();
}

const msgActions = (m) => m.actions || (m.action && m.action.type !== 'none' ? [m.action] : []);

function applyAction(i) {
  const m = state.chat[i];
  const done = [];
  msgActions(m).forEach((a) => {
    const d = parseKey(a.date || dateKey());
    if (a.type === 'replace_session' && a.session) {
      const plan = weekPlan(d).slice();
      plan[dayIdx(d)] = { custom: a.session };
      setWeekPlan(d, plan);
      done.push('séance remplacée');
    } else if (a.type === 'move_session' && a.to_date) {
      const to = parseKey(a.to_date);
      if (wkKey(to) === wkKey(d)) { moveSession(dayIdx(d), dayIdx(to), d); done.push('séance déplacée'); }
    } else if (a.type === 'remove_session') {
      removeDay(a.date); done.push('séance retirée');
    } else if (a.type === 'log_session') {
      const l = a.log || {};
      logManual(a.date, { name: l.name, kind: l.kind, minutes: l.minutes, km: l.km, hr: l.fc_moyenne, kcal: l.kcal, feeling: l.ressenti });
      done.push('séance enregistrée');
    }
  });
  m.applied = true;
  save('chat'); render();
  toast(done.length ? `C'est fait : ${[...new Set(done)].join(', ')} ✓` : 'Rien à appliquer');
}

function actionLine(a) {
  const d = parseKey(a.date || dateKey());
  const day = `${DAYS[dayIdx(d)].toLowerCase()} ${d.getDate()}`;
  if (a.type === 'replace_session' && a.session) {
    const s = a.session;
    const icon = kindIcon[s.kind] || kindIcon.douce;
    const lines = (s.exercise_ids || []).filter((id) => EXERCISES[id]).map((id) => `<div style="font-size: 14px; line-height: 19px">• ${esc(EXERCISES[id].name)}</div>`).join('')
      || (s.steps || []).map((st) => `<div class="row" style="gap: 10px; font-size: 14px; line-height: 19px; align-items: flex-start">${st.minutes ? `<b style="color: ${icon[2]}; width: 48px; flex: none">${st.minutes} min</b>` : ''}<span>${esc(st.label)}</span></div>`).join('');
    return `<div class="row" style="gap: 8px"><div class="ico" style="background: ${icon[1]}">${ic(icon[0], 17, icon[2])}</div>
      <div><div style="font-size: 16px; font-weight: 700">${esc(s.name)}${s.minutes ? ` · ${s.minutes} min` : ''}</div><div class="foot">Remplace la séance de ${day}</div></div></div>
      <div class="stack" style="gap: 6px">${lines}</div>`;
  }
  if (a.type === 'move_session' && a.to_date) {
    const to = parseKey(a.to_date);
    return `<div class="row" style="gap: 8px"><div class="ico" style="background: var(--violet-soft)">${ic('move', 17, 'var(--violet-text)')}</div>
      <div style="font-size: 15px; font-weight: 600">Déplacer ${day} → ${DAYS[dayIdx(to)].toLowerCase()} ${to.getDate()}</div></div>`;
  }
  if (a.type === 'remove_session') {
    return `<div class="row" style="gap: 8px"><div class="ico" style="background: #F1EEF7">${ic('close', 15, 'var(--sec)', 2.4)}</div>
      <div style="font-size: 15px; font-weight: 600">Retirer la séance de ${day}</div></div>`;
  }
  if (a.type === 'log_session') {
    const l = a.log || {};
    const icon = kindIcon[l.kind] || kindIcon.douce;
    const perf = [l.minutes && `${fmtNum(l.minutes)} min`, l.km && `${fmtNum(l.km)} km`, l.fc_moyenne && `FC ${Math.round(l.fc_moyenne)}`, l.kcal && `${Math.round(l.kcal)} kcal`, l.ressenti].filter(Boolean).join(' · ');
    return `<div class="row" style="gap: 8px"><div class="ico" style="background: ${icon[1]}">${ic('check', 17, icon[2], 2.6)}</div>
      <div><div style="font-size: 15px; font-weight: 600">Enregistrer : ${esc(l.name || 'séance')} (${day})</div>${perf ? `<div class="foot">${esc(perf)}</div>` : ''}</div></div>`;
  }
  return '';
}

function actionCard(m, i) {
  const list = msgActions(m);
  return `<section class="card stack" style="align-self: flex-start; width: 92%; border: 1.5px solid var(--violet-soft)">
    ${list.map(actionLine).join('<div style="height: 1px; background: var(--sep)"></div>')}
    ${m.applied ? `<div class="chip soft" style="align-self: flex-start">${ic('check', 14, 'var(--violet-text)', 2.6)}Appliqué</div>` : `<div class="grid2" style="gap: 8px">
      <button class="btn p sm" data-act="apply" data-i="${i}">Appliquer</button>
      <button class="btn t sm" data-act="quick" data-text="Tu as une autre idée ?">Autre idée</button></div>`}
  </section>`;
}

function viewCoach() {
  const hasKey = !!state.settings.apiKey;
  const msgs = state.chat.length ? state.chat : [{ role: 'model', text: `Salut${state.settings.name ? ' ' + state.settings.name : ''} ! Je connais ton programme, tes séances et ton sommeil. Dis-moi si tu veux changer le sport du jour, déplacer une séance, ou me demander quoi manger.` }];
  return `
  <div class="row" style="gap: 12px">
    <div style="width: 44px; height: 44px; border-radius: 22px; background: var(--violet-soft); display: flex; align-items: center; justify-content: center">${ic('sparkle', 22, 'var(--violet-text)')}</div>
    <div class="grow"><h1 class="lt" style="font-size: 28px; line-height: 34px">Coach</h1><div class="foot">Connaît ton programme, tes séances et ton sommeil</div></div>
    ${state.chat.length ? `<button class="link" data-act="clear-chat" style="font-size: 15px">Effacer</button>` : ''}
  </div>
  ${!hasKey ? `<section class="card stack" style="margin-top: 16px">
    <div class="hdr" style="color: var(--violet-text)">${ic('sparkle', 16, 'var(--violet-text)')}Active ton coach</div>
    <div class="sub" style="color: var(--label)">Il faut une clé Gemini gratuite (2 minutes). Elle reste sur ton téléphone.</div>
    <button class="btn p sm" data-act="tab" data-v="settings">Ajouter ma clé</button>
  </section>` : ''}
  <div class="msgs" style="margin-top: 18px; padding-bottom: 120px">
    ${msgs.map((m, i) => `
      <div class="bub ${m.role === 'user' ? 'me' : 'ai'}" ${m.error ? 'style="color: var(--warn)"' : ''}>${m.image ? `<img src="${m.image}" alt="">` : ''}${esc(m.text || '')}</div>
      ${msgActions(m).length ? actionCard(m, i) : ''}`).join('')}
    ${state.busy === 'chat' ? '<div class="bub ai typing"><span></span><span></span><span></span></div>' : ''}
  </div>
  <div class="composer"><div class="stack" style="gap: 10px">
    <div class="row" style="gap: 8px; overflow-x: auto; scrollbar-width: none">
      ${["Qu'est-ce que je mange ce soir ?", 'Je préfère courir aujourd’hui', 'J’ai mal dormi, on adapte ?', 'Fais-moi mon bilan'].map((q) => `<button class="chip" data-act="quick" data-text="${esc(q)}" style="border: 1px solid #DDD6EE; background: #fff; color: var(--violet-text)">${esc(q)}</button>`).join('')}
    </div>
    <div class="row" style="gap: 8px">
      <label class="x" style="width: 40px; height: 40px; border-radius: 20px; background: #fff; cursor: pointer" aria-label="Envoyer une photo">${ic('photo', 20, 'var(--violet-text)')}<input type="file" accept="image/*" data-act="chat-photo" hidden></label>
      <input class="field" id="chatinput" value="${esc(state.draft || '')}" placeholder="Écris à ton coach…" style="border-radius: 20px; min-height: 40px; height: 40px; padding: 0 16px; font-size: 16px" enterkeyhint="send" aria-label="Message au coach">
      <button class="x" data-act="send" style="width: 40px; height: 40px; border-radius: 20px; background: var(--violet)" aria-label="Envoyer">${ic('send', 20, '#fff', 2.4)}</button>
    </div>
  </div></div>`;
}

function scrollToBottom() { requestAnimationFrame(() => { if (state.view === 'coach') scrollTo(0, document.body.scrollHeight); }); }

// ─────────────────────────── Lecture des captures Apple Watch
const WATCH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    calories_actives: { type: 'NUMBER', nullable: true },
    fc_moyenne: { type: 'NUMBER', nullable: true },
    duree_min: { type: 'NUMBER', nullable: true },
    distance_km: { type: 'NUMBER', nullable: true },
  },
};
async function readWatchShots(files) {
  const imgs = await Promise.all([...files].slice(0, 4).map((f) => shrink(f, 1400)));
  state.active.shots = [...(state.active.shots || []), ...imgs.map((src) => src)].slice(-4);
  state.busy = true; render();
  try {
    const res = await gemini([{ role: 'user', parts: [...imgs.map(inlineImg), { text: 'Ce sont des captures d’écran d’une séance Apple Watch (app Forme ou Exercice). Extrais les calories actives (kcal), la fréquence cardiaque moyenne (BPM), la durée totale en minutes et la distance en km si elle apparaît. Mets null si une valeur n’apparaît pas. N’invente rien.' }] }], { schema: WATCH_SCHEMA });
    const w = state.active.watch || {};
    if (res.calories_actives != null) w.kcal = Math.round(res.calories_actives);
    if (res.fc_moyenne != null) w.hr = Math.round(res.fc_moyenne);
    if (res.duree_min != null) w.duration = Math.round(res.duree_min);
    if (res.distance_km != null && !state.active.cardio.km) state.active.cardio.km = fmtNum(res.distance_km);
    state.active.watch = w; state.active.watchRead = true;
  } catch (e) { toast(errText(e)); }
  // Les captures ne sont gardées que le temps de la séance
  state.busy = false; save('active'); render();
}

// ─────────────────────────── Bilan de la semaine
const REVIEW_SCHEMA = {
  type: 'OBJECT',
  properties: {
    bien: { type: 'ARRAY', items: { type: 'STRING' } },
    ameliorer: { type: 'ARRAY', items: { type: 'STRING' } },
    suite: { type: 'STRING' },
  },
  required: ['bien', 'ameliorer', 'suite'],
};
async function weeklyReview(wk) {
  const ws = parseKey(wk);
  const we = addDays(ws, 7);
  const inWeek = (k) => { const t = parseKey(k); return t >= ws && t < we; };
  const data = {
    semaine: `${fmtShort(ws)} – ${fmtShort(addDays(ws, 6))}`,
    semaine_programme: weekNo(ws), phase: phaseFor(weekNo(ws)).name,
    prevu: Array.from({ length: 7 }, (_, i) => { const d = addDays(ws, i); const s = sessionFor(d); return s ? `${DAYS[i]} : ${s.name}${s.optional ? ' (optionnelle)' : ''}` : null; }).filter(Boolean),
    realise: state.logs.filter((l) => inWeek(l.dateKey)).map((l) => ({ date: l.dateKey, seance: l.name, minutes: l.durationMin, ressenti: l.feeling, km: l.km, fc_moy: l.watch?.hr, progressions: l.ups, exercices: (l.exercises || []).map((e) => `${EXERCISES[e.id]?.name}: ${e.sets.filter((s) => s.done).map((s) => (s.kg ? `${s.kg}kg×${s.reps}` : s.reps)).join(', ')}`) })),
    sommeil: Object.entries(state.health).filter(([k]) => inWeek(k)).map(([k, h]) => ({ date: k, sommeil_min: h.sleepMin, fc_repos: h.restHR })),
    poids: state.weights.filter((w) => inWeek(w.date)),
    zone_poids: state.settings.zone,
  };
  state.busy = 'review'; render();
  try {
    const res = await gemini([{ role: 'user', parts: [{ text: `Fais le bilan de ma semaine à partir de ces données (JSON). 2 à 3 points "bien", 2 points "ameliorer" (sport, sommeil, récupération, alimentation), et "suite" = un conseil concret pour la semaine prochaine. Phrases courtes, tutoiement, en français. Base-toi uniquement sur les données ; si une donnée manque (ex. sommeil), dis-le simplement.\n${JSON.stringify(data)}` }] }], { system: SYSTEM, schema: REVIEW_SCHEMA });
    state.reviews[wk] = { ...res, week: wk, label: data.semaine };
    save('reviews');
  } catch (e) { toast(errText(e)); }
  state.busy = false; render();
}

// ─────────────────────────── Branchement dans l'app
VIEWS.coach = viewCoach;
Object.assign(ACTIONS, {
  send: () => { const i = $('#chatinput'); sendChat(i.value.trim()); },
  quick: (t) => {
    if (t.dataset.text === 'Fais-moi mon bilan') { state.view = 'progress'; render(); scrollTo(0, 0); weeklyReview(dateKey(weekStart())); return; }
    sendChat(t.dataset.text);
  },
  apply: (t) => applyAction(+t.dataset.i),
  'clear-chat': () => { if (confirm('Effacer la discussion ?')) { state.chat = []; save('chat'); render(); } },
  review: (t) => weeklyReview(t.dataset.week),
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'chatinput') { e.preventDefault(); sendChat(e.target.value.trim()); }
});
document.addEventListener('input', (e) => { if (e.target.id === 'chatinput') state.draft = e.target.value; });
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.act === 'chat-photo' && t.files[0]) {
    const img = await shrink(t.files[0]);
    sendChat($('#chatinput')?.value.trim() || '', img);
  }
  if (t.dataset.act === 'shots' && t.files.length) readWatchShots(t.files);
});
if (state.view === 'coach') render();
