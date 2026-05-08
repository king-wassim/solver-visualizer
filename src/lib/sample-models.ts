import type { LPModel } from "./lp-schema";

// ─── TP1 — PL_TP1 ────────────────────────────────────────────────────────────

const tp1_p1: LPModel = {
  id: "tp1-p1-simple-pl",
  name: "TP1 — P1 : Programme Linéaire Simple",
  description:
    "Maximiser Z = 2x₁ + 3x₂ sous trois contraintes de ressources (R1, R2, R3). Problème classique à deux variables de décision.",
  tags: ["tp1", "2 variables", "max", "graphique"],
  sense: "max",
  variables: [
    { name: "x1", type: "continuous", lb: 0, description: "Variable de décision x₁" },
    { name: "x2", type: "continuous", lb: 0, description: "Variable de décision x₂" },
  ],
  objective: { coefficients: { x1: 2, x2: 3 } },
  constraints: [
    { name: "R1", coefficients: { x1: 1, x2: 6 }, operator: "<=", rhs: 30 },
    { name: "R2", coefficients: { x1: 2, x2: 2 }, operator: "<=", rhs: 15 },
    { name: "R3", coefficients: { x1: 4, x2: 1 }, operator: "<=", rhs: 24 },
  ],
};

const tp1_p2: LPModel = {
  id: "tp1-p2-ks-confection",
  name: "TP1 — P2 : KS Confection (Textile)",
  description:
    "Maximiser le profit de KS Confection produisant tissu en laine, coton et soie sous contraintes des machines de filature, tissage et ennoblissement.",
  tags: ["tp1", "3 variables", "max", "production", "textile"],
  sense: "max",
  variables: [
    { name: "x1", type: "continuous", lb: 0, description: "Tissu en laine (m)" },
    { name: "x2", type: "continuous", lb: 0, description: "Tissu en coton (m)" },
    { name: "x3", type: "continuous", lb: 0, description: "Tissu en soie (m)" },
  ],
  objective: { coefficients: { x1: 7, x2: 10, x3: 12 } },
  constraints: [
    { name: "Machine de filature (≤ 120 h)", coefficients: { x1: 3, x2: 2, x3: 4 }, operator: "<=", rhs: 120 },
    { name: "Machine de tissage (≤ 150 h)", coefficients: { x1: 8, x2: 7, x3: 4 }, operator: "<=", rhs: 150 },
    { name: "Machine ennoblissement (≤ 100 h)", coefficients: { x1: 0.7, x2: 0.6, x3: 0.3 }, operator: "<=", rhs: 100 },
    { name: "Filature laine (max 80 m)", coefficients: { x1: 1 }, operator: "<=", rhs: 80 },
    { name: "Filature coton (max 40 m)", coefficients: { x2: 1 }, operator: "<=", rhs: 40 },
  ],
};

// ─── TP2 — TP2 RO INSAT ──────────────────────────────────────────────────────

const tp2_p1: LPModel = {
  id: "tp2-p1-poterie-emaux",
  name: "TP2 — P1 : Poterie & Émaux sur Cuivre",
  description:
    "Maximiser le bénéfice journalier de production de poteries (20 D) et d'émaux sur cuivre (60 D) sous contraintes de charge de travail et de capacité.",
  tags: ["tp2", "2 variables", "max", "artisanat", "production"],
  sense: "max",
  variables: [
    { name: "x", type: "continuous", lb: 0, description: "Nombre de poteries fabriquées" },
    { name: "y", type: "continuous", lb: 0, description: "Nombre d'émaux sur cuivre" },
  ],
  objective: { coefficients: { x: 20, y: 60 } },
  constraints: [
    {
      name: "Charge travail émaux ≤ poterie + 160 h",
      coefficients: { x: -1, y: 4 },
      operator: "<=",
      rhs: 160,
    },
    {
      name: "Poterie ne dépasse émaux que de 30 unités",
      coefficients: { x: 1, y: -1 },
      operator: "<=",
      rhs: 30,
    },
    {
      name: "Total articles ≤ 80 unités/jour",
      coefficients: { x: 1, y: 1 },
      operator: "<=",
      rhs: 80,
    },
  ],
};

const tp2_p2: LPModel = {
  id: "tp2-p2-coussinets-paliers",
  name: "TP2 — P2 : Coussinets (A) & Paliers (B)",
  description:
    "Minimiser le coût total de transport (matières premières + produits finis) pour la fabrication de coussinets A et de paliers B sous contraintes de production et main d'œuvre.",
  tags: ["tp2", "2 variables", "min", "industrie", "transport"],
  sense: "min",
  variables: [
    { name: "x", type: "continuous", lb: 0, description: "Nombre de coussinets A fabriqués" },
    { name: "y", type: "continuous", lb: 0, description: "Nombre de paliers B fabriqués" },
  ],
  objective: { coefficients: { x: 7, y: 10 } },
  constraints: [
    {
      name: "Min production coussinets A (≥ 4 000)",
      coefficients: { x: 1 },
      operator: ">=",
      rhs: 4000,
    },
    {
      name: "Min production paliers B (≥ 5 000)",
      coefficients: { y: 1 },
      operator: ">=",
      rhs: 5000,
    },
    {
      name: "Matière première traitée (≥ 36 000 kg)",
      coefficients: { x: 2, y: 3 },
      operator: ">=",
      rhs: 36000,
    },
    {
      name: "Main d'œuvre (≤ 10 000 h)",
      coefficients: { x: 1, y: 0.5 },
      operator: "<=",
      rhs: 10000,
    },
  ],
};

// ─── TP3 — TP3 LINDO/LINGO ───────────────────────────────────────────────────

const tp3_p1: LPModel = {
  id: "tp3-p1-carco",
  name: "TP3 — P1 : CARCO (Voitures & Camions)",
  description:
    "Maximiser le profit journalier de CARCO en déterminant le nombre optimal de voitures (300 D), camions (400 D) et machines type 1 à louer (50 D/machine). Résolution via LINDO/LINGO.",
  tags: ["tp3", "3 variables", "max", "LINDO", "industrie"],
  sense: "max",
  variables: [
    { name: "v", type: "continuous", lb: 0, description: "Voitures fabriquées/jour" },
    { name: "c", type: "continuous", lb: 0, description: "Camions fabriqués/jour" },
    { name: "m", type: "continuous", lb: 0, description: "Machines type 1 louées/jour" },
  ],
  objective: { coefficients: { v: 300, c: 400, m: -50 } },
  constraints: [
    {
      name: "Utilisation machines type 1 ≤ louées",
      coefficients: { v: 0.8, c: 1, m: -1 },
      operator: "<=",
      rhs: 0,
    },
    {
      name: "Max machines type 1 louables (≤ 98)",
      coefficients: { m: 1 },
      operator: "<=",
      rhs: 98,
    },
    {
      name: "Machines type 2 disponibles (≤ 73)",
      coefficients: { v: 0.6, c: 0.7 },
      operator: "<=",
      rhs: 73,
    },
    {
      name: "Acier disponible (≤ 260 tonnes)",
      coefficients: { v: 2, c: 3 },
      operator: "<=",
      rhs: 260,
    },
    {
      name: "Min voitures/jour (≥ 88)",
      coefficients: { v: 1 },
      operator: ">=",
      rhs: 88,
    },
    {
      name: "Min camions/jour (≥ 26)",
      coefficients: { c: 1 },
      operator: ">=",
      rhs: 26,
    },
  ],
};

const tp3_p2: LPModel = {
  id: "tp3-p2-transport",
  name: "TP3 — P2 : Transport (3 Origines × 4 Destinations)",
  description:
    "Minimiser le coût total de transport depuis 3 origines (offres : 9, 17, 9) vers 4 destinations (demandes : 10, 14, 7, 4). Problème de transport équilibré résolu avec LINDO.",
  tags: ["tp3", "12 variables", "min", "LINDO", "transport", "réseau"],
  sense: "min",
  variables: [
    { name: "x11", type: "continuous", lb: 0, description: "Origine 1 → Destination 1" },
    { name: "x12", type: "continuous", lb: 0, description: "Origine 1 → Destination 2" },
    { name: "x13", type: "continuous", lb: 0, description: "Origine 1 → Destination 3" },
    { name: "x14", type: "continuous", lb: 0, description: "Origine 1 → Destination 4" },
    { name: "x21", type: "continuous", lb: 0, description: "Origine 2 → Destination 1" },
    { name: "x22", type: "continuous", lb: 0, description: "Origine 2 → Destination 2" },
    { name: "x23", type: "continuous", lb: 0, description: "Origine 2 → Destination 3" },
    { name: "x24", type: "continuous", lb: 0, description: "Origine 2 → Destination 4" },
    { name: "x31", type: "continuous", lb: 0, description: "Origine 3 → Destination 1" },
    { name: "x32", type: "continuous", lb: 0, description: "Origine 3 → Destination 2" },
    { name: "x33", type: "continuous", lb: 0, description: "Origine 3 → Destination 3" },
    { name: "x34", type: "continuous", lb: 0, description: "Origine 3 → Destination 4" },
  ],
  objective: {
    coefficients: {
      x11: 264, x12: 130, x13: 139, x14: 160,
      x21: 279, x22: 244, x23: 146, x24: 307,
      x31: 200, x32: 166, x33: 66,  x34: 278,
    },
  },
  constraints: [
    {
      name: "Offre Origine 1 (= 9)",
      coefficients: { x11: 1, x12: 1, x13: 1, x14: 1 },
      operator: "=",
      rhs: 9,
    },
    {
      name: "Offre Origine 2 (= 17)",
      coefficients: { x21: 1, x22: 1, x23: 1, x24: 1 },
      operator: "=",
      rhs: 17,
    },
    {
      name: "Offre Origine 3 (= 9)",
      coefficients: { x31: 1, x32: 1, x33: 1, x34: 1 },
      operator: "=",
      rhs: 9,
    },
    {
      name: "Demande Destination 1 (= 10)",
      coefficients: { x11: 1, x21: 1, x31: 1 },
      operator: "=",
      rhs: 10,
    },
    {
      name: "Demande Destination 2 (= 14)",
      coefficients: { x12: 1, x22: 1, x32: 1 },
      operator: "=",
      rhs: 14,
    },
    {
      name: "Demande Destination 3 (= 7)",
      coefficients: { x13: 1, x23: 1, x33: 1 },
      operator: "=",
      rhs: 7,
    },
    {
      name: "Demande Destination 4 (= 4)",
      coefficients: { x14: 1, x24: 1, x34: 1 },
      operator: "=",
      rhs: 4,
    },
  ],
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const SAMPLE_MODELS: LPModel[] = [
  tp1_p1, tp1_p2,
  tp2_p1, tp2_p2,
  tp3_p1, tp3_p2,
];

export const TP_GROUPS: Array<{
  id: string;
  title: string;
  subtitle: string;
  dotColor: string;
  headerColor: string;
  badgeClass: string;
  models: LPModel[];
}> = [
  {
    id: "tp1",
    title: "TP1 — Programmation Linéaire",
    subtitle: "Résolution par Solveur Excel",
    dotColor: "bg-blue-500",
    headerColor: "text-blue-500",
    badgeClass: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    models: [tp1_p1, tp1_p2],
  },
  {
    id: "tp2",
    title: "TP2 — Modélisation sous forme de PL",
    subtitle: "INSAT — Poterie & Industrie",
    dotColor: "bg-violet-500",
    headerColor: "text-violet-500",
    badgeClass: "bg-violet-500/10 text-violet-500 border-violet-500/30",
    models: [tp2_p1, tp2_p2],
  },
  {
    id: "tp3",
    title: "TP3 — Logiciel LINDO / LINGO",
    subtitle: "Optimisation avancée",
    dotColor: "bg-emerald-500",
    headerColor: "text-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    models: [tp3_p1, tp3_p2],
  },
];

export const getModelById = (id: string) => SAMPLE_MODELS.find((m) => m.id === id);
