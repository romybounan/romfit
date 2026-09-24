// RomFit — contenu du programme (séances, exercices, phases, repas).
// Références utilisées : recommandations ACSM (musculation, cardio) et ISSN (protéines).

const PROGRAM_START = '2026-09-21'; // lundi de la semaine 1
const PROGRAM_END = '2026-12-31';

// ── Exercices
// base : charge de départ prudente (reprise). inc : palier d'augmentation.
// perHand : la charge s'entend par haltère.
// video : identifiant YouTube (démonstration par une coach), rempli après vérification.
const EXERCISES = {
  'hip-thrust':          { name: 'Hip thrust', muscles: ['Fessiers', 'Ischios'], unit: 'reps', reps: [10, 12], base: 30, inc: 2.5, key: true, cue: 'Haut du dos sur le banc, menton rentré. Pousse dans les talons et serre les fessiers 1 seconde en haut.' },
  'goblet-squat':        { name: 'Goblet squat', muscles: ['Cuisses', 'Fessiers'], unit: 'reps', reps: [10, 12], base: 10, inc: 2, cue: 'Haltère contre la poitrine, pieds un peu plus larges que les hanches. Descends en gardant le buste droit.' },
  'rdl-halteres':        { name: 'Soulevé de terre roumain', muscles: ['Ischios', 'Fessiers'], unit: 'reps', reps: [10, 12], base: 8, inc: 1, perHand: true, key: true, cue: 'Genoux légèrement fléchis, pousse les hanches en arrière, dos plat. Remonte en serrant les fessiers.' },
  'fentes-bulgares':     { name: 'Fentes bulgares', muscles: ['Fessiers', 'Cuisses'], unit: 'reps', reps: [8, 10], base: 4, inc: 1, perHand: true, perSide: true, cue: 'Pied arrière sur le banc, buste légèrement penché en avant pour cibler les fessiers. Chaque jambe.' },
  'abduction-machine':   { name: 'Abduction à la machine', muscles: ['Moyen fessier'], unit: 'reps', reps: [12, 15], base: 25, inc: 5, cue: 'Dos contre le dossier, ouvre les genoux en contrôlant, marque une pause en position ouverte.' },
  'gainage':             { name: 'Gainage planche', muscles: ['Abdos'], unit: 'time', base: 30, inc: 5, cue: 'Sur les avant-bras, corps aligné des épaules aux talons. Ne creuse pas le bas du dos.' },
  'presse-cuisses':      { name: 'Presse à cuisses', muscles: ['Cuisses', 'Fessiers'], unit: 'reps', reps: [10, 12], base: 40, inc: 5, key: true, cue: 'Pieds hauts et écartés sur la plateforme pour cibler les fessiers. Ne verrouille pas les genoux.' },
  'leg-curl':            { name: 'Leg curl', muscles: ['Ischios'], unit: 'reps', reps: [10, 12], base: 20, inc: 2.5, cue: 'Hanches plaquées, ramène les talons vers les fessiers et contrôle le retour.' },
  'step-up':             { name: 'Step-up haltères', muscles: ['Fessiers', 'Cuisses'], unit: 'reps', reps: [10, 12], base: 4, inc: 1, perHand: true, perSide: true, cue: 'Monte sur le banc en poussant dans le talon de la jambe avant, sans t’aider de la jambe arrière.' },
  'kickback-poulie':     { name: 'Kickback à la poulie', muscles: ['Fessiers'], unit: 'reps', reps: [12, 15], base: 5, inc: 1.25, perSide: true, cue: 'Buste penché, pousse la jambe vers l’arrière et le haut sans cambrer le dos.' },
  'dead-bug':            { name: 'Dead bug', muscles: ['Abdos'], unit: 'reps', reps: [10, 12], base: 0, inc: 0, bodyweight: true, cue: 'Bas du dos plaqué au sol. Tends bras et jambe opposés lentement, en expirant. Quand c’est facile, ralentis encore le mouvement.' },
  'tirage-vertical':     { name: 'Tirage vertical', muscles: ['Dos', 'Biceps'], unit: 'reps', reps: [10, 12], base: 25, inc: 2.5, key: true, cue: 'Poitrine sortie, tire la barre vers le haut de la poitrine en abaissant et en serrant les omoplates.' },
  'rowing-haltere':      { name: 'Rowing haltère un bras', muscles: ['Dos'], unit: 'reps', reps: [10, 12], base: 8, inc: 1, perSide: true, cue: 'Main et genou sur le banc, dos plat. Tire le coude vers la hanche.' },
  'developpe-epaules':   { name: 'Développé épaules haltères', muscles: ['Épaules', 'Triceps'], unit: 'reps', reps: [10, 12], base: 5, inc: 1, perHand: true, cue: 'Assise dos calé, pousse les haltères au-dessus de la tête sans cambrer.' },
  'pont-unilateral':     { name: 'Pont fessier une jambe', muscles: ['Fessiers'], unit: 'reps', reps: [10, 12], base: 0, inc: 0, bodyweight: true, perSide: true, cue: 'Allongée, un pied au sol, pousse dans le talon et monte les hanches bien droites. Quand 12 répétitions sont faciles, pose un disque sur tes hanches.' },
  'triceps-poulie':      { name: 'Extension triceps poulie', muscles: ['Triceps'], unit: 'reps', reps: [12, 15], base: 10, inc: 1.25, cue: 'Coudes collés au corps, pousse la corde vers le bas et écarte-la en fin de mouvement.' },
  'pallof-press':        { name: 'Pallof press', muscles: ['Abdos', 'Obliques'], unit: 'reps', reps: [10, 12], base: 5, inc: 1.25, perSide: true, cue: 'De profil à la poulie, pousse les mains devant toi sans laisser le buste tourner.' },
  'tirage-horizontal':   { name: 'Tirage horizontal', muscles: ['Dos'], unit: 'reps', reps: [10, 12], base: 25, inc: 2.5, cue: 'Buste droit, tire la poignée vers le nombril en serrant les omoplates.' },
  'pompes-inclinees':    { name: 'Pompes inclinées', muscles: ['Pectoraux', 'Triceps'], unit: 'reps', reps: [8, 12], base: 0, inc: 0, bodyweight: true, cue: 'Mains sur un banc, corps gainé. Descends la poitrine vers le banc. Quand 12 répétitions sont faciles, prends un appui plus bas.' },
  'elevations-laterales':{ name: 'Élévations latérales', muscles: ['Épaules'], unit: 'reps', reps: [12, 15], base: 3, inc: 1, perHand: true, cue: 'Bras légèrement fléchis, monte jusqu’à la hauteur des épaules, sans élan.' },
  'curl-halteres':       { name: 'Curl biceps haltères', muscles: ['Biceps'], unit: 'reps', reps: [10, 12], base: 5, inc: 1, perHand: true, cue: 'Coudes fixes le long du corps, monte et descends lentement.' },
  'pull-through':        { name: 'Pull-through à la poulie', muscles: ['Fessiers', 'Ischios'], unit: 'reps', reps: [12, 15], base: 15, inc: 2.5, cue: 'Dos à la poulie, corde entre les jambes. Pousse les hanches vers l’avant en serrant les fessiers.' },
  'crunch-poulie':       { name: 'Crunch à la poulie', muscles: ['Abdos'], unit: 'reps', reps: [12, 15], base: 15, inc: 2.5, cue: 'À genoux face à la poulie haute, corde près des oreilles. Enroule le buste en rapprochant les coudes des genoux, sans bouger les hanches. Expire en descendant.' },
  'leg-extension':       { name: 'Leg extension', muscles: ['Cuisses'], unit: 'reps', reps: [10, 12], base: 20, inc: 2.5, cue: 'Dos calé, tends les jambes en contrôlant, marque une pause jambes tendues, puis redescends lentement.' },
  'hyperextension':      { name: 'Extension au banc à 45°', muscles: ['Fessiers', 'Ischios'], unit: 'reps', reps: [12, 15], base: 0, inc: 0, bodyweight: true, cue: 'Bras croisés sur la poitrine, dos légèrement arrondi, remonte en serrant fort les fessiers. Plus tard, tu pourras tenir un disque contre la poitrine.' },
  'releve-jambes':       { name: 'Relevés de jambes allongée', muscles: ['Abdos'], unit: 'reps', reps: [10, 15], base: 0, inc: 0, bodyweight: true, cue: 'Allongée, bras le long du corps, bas du dos plaqué au sol. Monte les jambes tendues (ou genoux pliés pour commencer), redescends lentement sans toucher le sol.' },
  'fentes-bulgares-pdc': { name: 'Fentes bulgares (poids du corps)', muscles: ['Fessiers', 'Cuisses'], unit: 'reps', reps: [10, 12], base: 0, inc: 0, bodyweight: true, perSide: true, cue: 'Pied arrière sur le banc, mains sur les hanches, buste légèrement penché en avant pour cibler les fessiers. Chaque jambe.' },
  'gainage-lateral':     { name: 'Gainage latéral', muscles: ['Obliques'], unit: 'time', base: 20, inc: 5, perSide: true, cue: 'Sur l’avant-bras, hanches hautes, corps aligné. Chaque côté.' },
};

// ── Séances de la semaine (A et B alternent une semaine sur deux pour varier)
const SESSIONS = {
  lower: {
    name: 'Fessiers & jambes', kind: 'salle', minutes: 50,
    A: ['hip-thrust', 'goblet-squat', 'rdl-halteres', 'fentes-bulgares', 'abduction-machine', 'tirage-horizontal'],
    B: ['hip-thrust', 'presse-cuisses', 'leg-curl', 'step-up', 'kickback-poulie', 'rowing-haltere'],
    // Pause kiné (épaules et bras au repos) : machines et poids du corps, rien à porter
    R1: ['hip-thrust', 'presse-cuisses', 'leg-curl', 'abduction-machine', 'pont-unilateral', 'releve-jambes'],
    R2: ['hip-thrust', 'leg-extension', 'hyperextension', 'fentes-bulgares-pdc', 'kickback-poulie', 'releve-jambes'],
  },
  upper: {
    name: 'Haut du corps & fessiers', kind: 'salle', minutes: 55,
    A: ['tirage-vertical', 'rowing-haltere', 'developpe-epaules', 'pont-unilateral', 'triceps-poulie', 'curl-halteres', 'crunch-poulie'],
    B: ['tirage-horizontal', 'pompes-inclinees', 'elevations-laterales', 'pull-through', 'curl-halteres', 'triceps-poulie', 'gainage-lateral'],
  },
  run: { name: 'Course', kind: 'course' },
  long: { name: 'Sortie longue', kind: 'course' },
  optional: { name: 'Activité douce', kind: 'douce', minutes: 45, optional: true },
};

// Pause épaules et bras (kiné) : la séance « haut du corps » devient une 2e séance jambes/fessiers
const REHAB = { from: '2026-09-25', to: '2026-10-18', label: 'Pause épaules et bras (kiné)' };

// Jours par défaut (0 = lundi) — modifiables dans les réglages
const DEFAULT_WEEK = { 0: 'lower', 2: 'run', 4: 'upper', 5: 'optional' };
// Objectif 10 km fin décembre : 2 courses par semaine à partir de la semaine 5 (19 octobre)
const TWO_RUNS_FROM_WEEK = 5;
const DEFAULT_WEEK_2 = { 0: 'lower', 2: 'run', 4: 'upper', 5: 'long', 6: 'optional' };

// ── Phases jusqu'au 31 décembre
const PHASES = [
  { from: 1, to: 2, name: 'Reprise', text: 'Charges légères, 2 à 3 séries. Course en alternant marche et course lente.' },
  { from: 3, to: 6, name: 'Construction', text: '3 séries par exercice. Les charges montent dès que tu réussis toutes tes répétitions.' },
  { from: 7, to: 7, name: 'Semaine allégée', text: 'Moins de séries pour récupérer, puis on repart plus fort.', deload: true },
  { from: 8, to: 11, name: 'Progression', text: 'Plus de travail sur les fessiers : 4 séries sur les exercices clés.' },
  { from: 12, to: 12, name: 'Semaine allégée', text: 'On récupère avant le dernier bloc.', deload: true },
  { from: 13, to: 15, name: 'Consolidation', text: 'On garde tes acquis. Séances plus courtes possibles pendant les fêtes.' },
];

// Nombre de séries selon la semaine et l'exercice
function setsFor(week, ex) {
  if (week === 1) return 2;
  const phase = phaseFor(week);
  if (phase.deload) return 2;
  if (phase.name === 'Progression' && ex.key) return 4;
  return 3;
}

// Course : 1 sortie par semaine, 3 km minimum. place = tapis ou dehors par défaut (modifiable à chaque fois)
const km = (v) => String(v).replace('.', ',');
const RUN_TYPES = {
  lente: (d) => ({ name: 'Course lente', place: 'tapis', km: d, steps: [['Marche rapide pour t’échauffer', 5], [`${km(d)} km de course lente : tu dois pouvoir parler`, Math.round(d * 10)], ['Marche + étirements', 5]] }),
  progressive: (d) => ({ name: 'Course progressive', place: 'dehors', km: d, steps: [['Échauffement : marche rapide puis trot', 6], [`${km(Math.round(d * 0.4 * 2) / 2)} km facile`, Math.round(d * 0.4 * 10)], [`${km(Math.round(d * 0.35 * 2) / 2)} km un peu plus vite (tu peux encore dire quelques mots)`, Math.round(d * 0.35 * 9)], [`${km(Math.round(d * 0.25 * 2) / 2)} km soutenu (respiration forte mais contrôlée)`, Math.round(d * 0.25 * 8)], ['Marche + étirements', 5]] }),
  longue: (d) => ({ name: 'Sortie longue', place: 'dehors', km: d, steps: [['Marche rapide pour t’échauffer', 5], [`${km(d)} km très lents : tu dois pouvoir parler du début à la fin`, Math.round(d * 10.2)], ['Marche + étirements', 5]] }),
  fractionne: (n) => ({ name: 'Fractionné', place: 'dehors', km: 3.5, steps: [['Échauffement : 1 km très facile', 10], [`${n} × (1 min rapide + 1 min 30 en trottinant)`, Math.round(n * 2.5)], ['1 km facile', 10], ['Marche + étirements', 5]] }),
};
const RUN_PLAN = {
  1: RUN_TYPES.lente(3), 2: RUN_TYPES.lente(3.5), 3: RUN_TYPES.progressive(4), 4: RUN_TYPES.fractionne(6),
  // À partir de la semaine 5 : course rythmée du mercredi (la sortie longue est dans LONG_PLAN)
  5: RUN_TYPES.progressive(4), 6: RUN_TYPES.fractionne(6), 7: RUN_TYPES.lente(3.5), 8: RUN_TYPES.progressive(4.5),
  9: RUN_TYPES.fractionne(8), 10: RUN_TYPES.progressive(5), 11: RUN_TYPES.fractionne(8), 12: RUN_TYPES.lente(4),
  13: RUN_TYPES.progressive(5), 14: RUN_TYPES.fractionne(8), 15: RUN_TYPES.lente(4),
};
// Sortie longue du samedi : +0,5 à 1 km par semaine, semaines 7 et 12 plus légères → 10 km le samedi 26 décembre (semaine 14)
const LONG_PLAN = { 5: 5, 6: 5.5, 7: 4.5, 8: 6, 9: 7, 10: 7.5, 11: 8.5, 12: 6.5, 13: 9, 14: 10, 15: 6 };
const RUN_TIP = {
  tapis: 'Sur tapis : mets 1 % d’inclinaison, ça reproduit l’effort dehors. Si ton cœur s’emballe, baisse la vitesse.',
  dehors: 'Dehors : choisis un parcours plutôt plat. Si ton cœur s’emballe, ralentis ou marche un peu, c’est normal.',
};

// Séance optionnelle : tu choisis l'activité
const OPTIONAL_CHOICES = {
  velo: { label: 'Vélo', min: 45, text: 'Vélo ou vélo d’appartement à allure facile : tu dois pouvoir parler.' },
  marche: { label: 'Marche inclinée', min: 40, text: 'Tapis incliné à 8-12 %, 5 à 5,5 km/h, sans te tenir aux barres.' },
  reformer: { label: 'Reformer', min: 50, text: 'Un cours de reformer ou de pilates. Pendant la kiné, préviens la prof pour éviter les appuis sur les bras.' },
};


// ── Repas : protéines ≈ 1,6 g/kg/jour (ISSN 1,4–2,0 g/kg)
const PROTEIN_TARGET = 90;
const FOODS = {
  breakfast: ['Petit-déjeuner', '150 g de skyr ou yaourt grec, 60 g de flocons d’avoine, fruits rouges et 1 c. à s. de beurre de cacahuète', 25],
  pre: ['Avant la séance', '1 banane et une poignée d’amandes (ou 1 tartine de pain complet au miel)', 0],
  lunch: ['Déjeuner', '120 g de poulet ou 200 g de tofu ferme, 200 g de riz ou de quinoa cuit, légumes, 1 c. à s. d’huile d’olive', 35],
  post: ['Après la séance', '120 g de poulet, de dinde ou 200 g de tofu, 200 g de riz ou de patate douce, légumes, 1 c. à s. d’huile d’olive', 35],
  snack: ['Goûter', '1 yaourt grec, un fruit et une poignée d’amandes', 12],
  postSnack: ['Après la séance', '150 g de skyr, un fruit et une poignée d’amandes', 18],
  dinner: ['Dîner', '120 g de saumon, ou 3 œufs et 100 g de skyr, 200 g de patate douce, légumes verts, 1 tranche de pain complet', 25],
  dinnerPost: ['Dîner de récupération', '120 g de saumon, ou 3 œufs et 100 g de skyr, 200 g de riz ou de patate douce, légumes verts, 1 c. à s. d’huile d’olive', 30],
};
