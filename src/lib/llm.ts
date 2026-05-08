import { createServerFn } from "@tanstack/react-start";
import type { SolveResult, LPModel } from "./lp-schema";

type SummaryInput = {
  model: LPModel;
  result: SolveResult;
};

export type SummarySource = "groq" | "anthropic" | "openai" | "fallback";

function buildPrompt({ model, result }: SummaryInput): string {
  const totalZ = isNaN(result.objective) ? "N/A" : result.objective.toFixed(4);

  const vars = result.variables
    .map((v) => {
      const coef = model.objective.coefficients[v.name] ?? 0;
      const contrib = coef * v.value;
      const pct = isNaN(result.objective) || result.objective === 0
        ? "N/A"
        : `${((Math.abs(contrib) / Math.abs(result.objective)) * 100).toFixed(1)}%`;
      return `  - ${v.name} = ${v.value.toFixed(4)} | contribution = ${contrib.toFixed(4)} (${pct} de Z*)`;
    })
    .join("\n");

  const cstrs = result.constraints
    .map((c) => {
      const util = c.rhs !== 0 ? `${((c.lhs / c.rhs) * 100).toFixed(1)}%` : "N/A";
      const dualStr = c.dual != null ? ` | prix dual = ${c.dual.toFixed(4)}` : "";
      const status = c.saturated ? "SATURÉE (ressource critique)" : "relâchée (marge disponible)";
      return `  - ${c.name ?? "?"}: LHS=${c.lhs.toFixed(4)} ${c.operator} RHS=${c.rhs} | slack=${c.slack.toFixed(4)} | taux d'utilisation=${util} | ${status}${dualStr}`;
    })
    .join("\n");

  const objCoefs = model.objective.coefficients;
  const objStr = Object.keys(objCoefs)
    .map((k) => `${objCoefs[k]}·${k}`)
    .join(" + ");

  const saturatedNames = result.constraints
    .filter((c) => c.saturated)
    .map((c) => c.name ?? "?")
    .join(", ");

  const activeVars = result.variables
    .filter((v) => Math.abs(v.value) > 1e-9)
    .map((v) => `${v.name}=${v.value.toFixed(4)}`)
    .join(", ");

  return `Tu es un expert en recherche opérationnelle et en optimisation mathématique (niveau universitaire master). Rédige un compte-rendu analytique complet, rigoureux et professionnel en français (600 à 800 mots) destiné à un rapport académique de TP.

INSTRUCTIONS DE FORMATAGE OBLIGATOIRES :
- Marque chaque titre de section exactement ainsi : ### 1. Titre de la section
- Utilise des tirets (-) pour les listes à puces
- Sois précis et quantitatif : cite toujours les valeurs numériques exactes du problème
- Style académique, phrases complètes, vocabulaire technique de la RO
- Ne commence pas par "Bien sûr" ou formules de politesse — attaque directement la section 1

STRUCTURE OBLIGATOIRE (4 sections) :
### 1. Présentation et formulation du problème
### 2. Solution optimale — Analyse quantitative
### 3. Analyse des ressources et contraintes critiques
### 4. Recommandations et pistes d'amélioration

--- DONNÉES DU MODÈLE ---
Modèle : ${model.name}
Description : ${model.description ?? "(aucune)"}
Type d'optimisation : ${model.sense === "max" ? "Maximisation" : "Minimisation"}
Fonction objectif : ${model.sense === "max" ? "max" : "min"} Z = ${objStr}
Nombre de variables : ${model.variables.length}
Nombre de contraintes : ${model.constraints.length}

--- RÉSULTATS DE RÉSOLUTION ---
Statut : ${result.status}
Valeur optimale Z* = ${totalZ}
Variables actives à l'optimum : ${activeVars || "aucune"}
Contraintes saturées : ${saturatedNames || "aucune"}

Détail des variables (valeur | contribution | % de Z*) :
${vars}

Détail des contraintes (LHS | RHS | slack | taux d'utilisation | statut | prix dual si disponible) :
${cstrs}
--- FIN DES DONNÉES ---`;
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en recherche opérationnelle (RO) spécialisé dans la programmation linéaire. Tes rapports sont rigoureux, quantitatifs et adaptés à un contexte académique universitaire.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 2200,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Groq API ${res.status}: ${txt}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content?.trim() ?? "";
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2200,
      system:
        "Tu es un expert en recherche opérationnelle (RO) spécialisé dans la programmation linéaire. Tes rapports sont rigoureux, quantitatifs et adaptés à un contexte académique universitaire.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${txt}`);
  }
  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en recherche opérationnelle (RO) spécialisé dans la programmation linéaire. Tes rapports sont rigoureux, quantitatifs et adaptés à un contexte académique universitaire.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 2200,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${txt}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content?.trim() ?? "";
}

function fallbackSummary({ model, result }: SummaryInput): string {
  const saturated = result.constraints.filter((c) => c.saturated);
  const active = result.variables.filter((v) => Math.abs(v.value) > 1e-9);
  const sense = model.sense === "max" ? "maximiser" : "minimiser";
  const objCoefs = model.objective.coefficients;
  const objStr = Object.keys(objCoefs)
    .map((k) => `${objCoefs[k]}·${k}`)
    .join(" + ");

  const utilLines = result.constraints
    .map((c) => {
      const util = c.rhs !== 0 ? `${((c.lhs / c.rhs) * 100).toFixed(1)}%` : "N/A";
      return `- ${c.name ?? "?"} : utilisation ${util} ${c.saturated ? "(saturée — ressource critique)" : "(relâchée — marge disponible)"}`;
    })
    .join("\n");

  return `### 1. Présentation et formulation du problème
Le problème de programmation linéaire consiste à ${sense} la fonction objectif Z = ${objStr} sous ${model.constraints.length} contrainte(s). Le modèle comporte ${model.variables.length} variable(s) de décision représentant les quantités à optimiser.

### 2. Solution optimale — Analyse quantitative
Statut de résolution : ${result.status}. La valeur optimale de la fonction objectif est Z* = ${result.objective.toFixed(4)}.
Variables actives à l'optimum : ${active.map((v) => `${v.name} = ${v.value.toFixed(4)}`).join(", ") || "aucune variable active"}.
Les variables nulles n'entrent pas dans la solution optimale au coût actuel.

### 3. Analyse des ressources et contraintes critiques
${saturated.length} contrainte(s) sur ${result.constraints.length} sont saturées (${saturated.map((c) => c.name).join(", ") || "—"}).
Taux d'utilisation des ressources :
${utilLines}
Les contraintes saturées constituent les goulots d'étranglement du système. Toute relaxation de leur RHS entraînerait une amélioration de Z*. Les contraintes relâchées disposent encore d'une marge exploitable.

### 4. Recommandations et pistes d'amélioration
- Prioriser l'augmentation de capacité des contraintes saturées pour améliorer Z*.
- Analyser la sensibilité des coefficients de la fonction objectif (plage de stabilité de la base optimale).
- Étudier les prix duaux (valeur marginale d'une unité de ressource supplémentaire).
- Vérifier les variables nulles : elles peuvent devenir rentables si les coûts varient.
- Envisager une analyse paramétrique pour évaluer la robustesse de la solution.`;
}

export const generateSummary = createServerFn({ method: "POST" })
  .inputValidator((data: SummaryInput) => data)
  .handler(async ({ data }) => {
    const groqKey = process.env.GROQ_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    const prompt = buildPrompt(data);

    try {
      if (groqKey) {
        const text = await callGroq(prompt, groqKey);
        return { summary: text, source: "groq" as SummarySource };
      }
      if (anthropicKey) {
        const text = await callAnthropic(prompt, anthropicKey);
        return { summary: text, source: "anthropic" as SummarySource };
      }
      if (openaiKey) {
        const text = await callOpenAI(prompt, openaiKey);
        return { summary: text, source: "openai" as SummarySource };
      }
    } catch (e) {
      console.error("LLM call failed:", e);
      return {
        summary: fallbackSummary(data),
        source: "fallback" as SummarySource,
        error: e instanceof Error ? e.message : String(e),
      };
    }
    return { summary: fallbackSummary(data), source: "fallback" as SummarySource };
  });
