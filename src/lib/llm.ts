import { createServerFn } from "@tanstack/react-start";
import type { SolveResult, LPModel } from "./lp-schema";

type SummaryInput = {
  model: LPModel;
  result: SolveResult;
};

function buildPrompt({ model, result }: SummaryInput): string {
  const vars = result.variables
    .map((v) => `  - ${v.name} = ${v.value.toFixed(4)}`)
    .join("\n");
  const cstrs = result.constraints
    .map(
      (c) =>
        `  - ${c.name}: LHS=${c.lhs.toFixed(2)} ${c.operator} ${c.rhs} (slack=${c.slack.toFixed(2)}${c.saturated ? ", saturée" : ""})`,
    )
    .join("\n");
  const obj = model.objective.coefficients;
  const objStr = Object.keys(obj)
    .map((k) => `${obj[k]}·${k}`)
    .join(" + ");

  return `Tu es un expert en recherche opérationnelle. Rédige un compte-rendu clair, structuré et professionnel en français à partir des résultats suivants. Le rapport doit comporter :
1. Présentation du problème (1 paragraphe)
2. Solution optimale et interprétation des valeurs des variables (1-2 paragraphes)
3. Analyse des contraintes saturées et de leur signification managériale (1 paragraphe)
4. Recommandations / pistes d'amélioration (quelques puces)

Reste concis (250-400 mots), pas de markdown lourd, des phrases naturelles.

--- DONNÉES ---
Modèle : ${model.name}
Description : ${model.description ?? "(aucune)"}
Sens : ${model.sense === "max" ? "Maximiser" : "Minimiser"}
Objectif : ${objStr}
Statut : ${result.status}
Valeur optimale Z* : ${result.objective.toFixed(4)}

Variables :
${vars}

Contraintes :
${cstrs}
--- FIN DONNÉES ---`;
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
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${txt}`);
  }
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
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
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
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

  return `Compte-rendu — ${model.name}

Le problème consiste à ${sense} la fonction objectif sous ${model.constraints.length} contrainte(s). Le modèle comporte ${model.variables.length} variable(s) de décision.

Solution optimale (statut : ${result.status}). La valeur optimale de l'objectif est Z* = ${result.objective.toFixed(4)}. Les variables actives à l'optimum sont : ${
    active.map((v) => `${v.name} = ${v.value.toFixed(2)}`).join(", ") || "aucune"
  }.

Analyse des contraintes : ${saturated.length} contrainte(s) sur ${result.constraints.length} sont saturées (${saturated.map((c) => c.name).join(", ") || "—"}). Ces contraintes représentent les ressources critiques limitant l'amélioration de l'objectif ; toute relaxation de leur RHS améliorerait Z*.

Recommandations :
- Cibler en priorité l'augmentation de capacité des contraintes saturées.
- Vérifier les variables nulles : peuvent indiquer des activités non rentables au coût actuel.
- Réaliser une analyse de sensibilité sur les coefficients de l'objectif.

(Compte-rendu généré localement — pour un compte-rendu enrichi par IA, configurez ANTHROPIC_API_KEY ou OPENAI_API_KEY côté serveur.)`;
}

export const generateSummary = createServerFn({ method: "POST" })
  .inputValidator((data: SummaryInput) => data)
  .handler(async ({ data }) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    const prompt = buildPrompt(data);

    try {
      if (anthropicKey) {
        const text = await callAnthropic(prompt, anthropicKey);
        return { summary: text, source: "anthropic" as const };
      }
      if (openaiKey) {
        const text = await callOpenAI(prompt, openaiKey);
        return { summary: text, source: "openai" as const };
      }
    } catch (e) {
      console.error("LLM call failed:", e);
      return {
        summary: fallbackSummary(data),
        source: "fallback" as const,
        error: e instanceof Error ? e.message : String(e),
      };
    }
    return { summary: fallbackSummary(data), source: "fallback" as const };
  });
