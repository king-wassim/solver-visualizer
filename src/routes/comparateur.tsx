import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GitCompareArrows, Play, RefreshCcw, ChevronUp, ChevronDown, Minus } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { solveLP } from "@/lib/solver";
import { SAMPLE_MODELS } from "@/lib/sample-models";
import type { SolveResult } from "@/lib/lp-schema";

export const Route = createFileRoute("/comparateur")({
  head: () => ({ meta: [{ title: "Comparateur — RO Studio" }] }),
  component: ComparateurPage,
});

const STATUS_LABELS: Record<string, string> = {
  optimal: "Optimal", feasible: "Faisable", infeasible: "Infaisable",
  unbounded: "Non borné", undefined: "Indéfini", error: "Erreur",
};
const STATUS_CLS: Record<string, string> = {
  optimal: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  feasible: "bg-primary/15 text-primary border-primary/30",
  infeasible: "bg-destructive/15 text-destructive border-destructive/30",
  unbounded: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  undefined: "bg-muted text-muted-foreground",
  error: "bg-destructive/15 text-destructive border-destructive/30",
};

function DeltaBadge({ a, b, sense }: { a: number; b: number; sense?: "max" | "min" }) {
  if (isNaN(a) || isNaN(b)) return <span className="text-muted-foreground text-xs">—</span>;
  const diff = b - a;
  const pct = a !== 0 ? ((diff / Math.abs(a)) * 100).toFixed(1) : "∞";
  const better = sense === "max" ? diff > 0 : diff < 0;
  const worse = sense === "max" ? diff < 0 : diff > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-mono ${better ? "text-emerald-500" : worse ? "text-destructive" : "text-muted-foreground"}`}>
      {diff > 0 ? <ChevronUp className="h-3 w-3" /> : diff < 0 ? <ChevronDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {diff > 0 ? "+" : ""}{diff.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ({pct}%)
    </span>
  );
}

function ComparateurPage() {
  const { compareModel1, compareModel2, compareResult1, compareResult2, setCompareModel1, setCompareModel2, setCompareResult1, setCompareResult2 } = useAppStore();
  const [solving, setSolving] = useState(false);

  async function handleSolve() {
    if (!compareModel1 || !compareModel2) return;
    setSolving(true);
    const [r1, r2] = await Promise.all([solveLP(compareModel1), solveLP(compareModel2)]);
    setCompareResult1(r1);
    setCompareResult2(r2);
    setSolving(false);
  }

  function selectModel1(id: string) {
    const m = SAMPLE_MODELS.find((x) => x.id === id);
    if (m) { setCompareModel1(m); setCompareResult1(null); }
  }
  function selectModel2(id: string) {
    const m = SAMPLE_MODELS.find((x) => x.id === id);
    if (m) { setCompareModel2(m); setCompareResult2(null); }
  }

  const allVarNames = Array.from(new Set([
    ...(compareResult1?.variables.map((v) => v.name) ?? []),
    ...(compareResult2?.variables.map((v) => v.name) ?? []),
  ]));

  const varChartData = allVarNames.map((name) => ({
    name,
    [compareModel1?.name ?? "Modèle 1"]: compareResult1?.variables.find((v) => v.name === name)?.value ?? 0,
    [compareModel2?.name ?? "Modèle 2"]: compareResult2?.variables.find((v) => v.name === name)?.value ?? 0,
  }));

  const hasBothResults = compareResult1 && compareResult2;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comparateur de scénarios</h1>
          <p className="text-sm text-muted-foreground">Sélectionnez deux modèles et comparez leurs solutions côte à côte.</p>
        </div>
        <Button onClick={handleSolve} disabled={!compareModel1 || !compareModel2 || solving} className="gap-2">
          {solving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {solving ? "Résolution…" : "Lancer les deux"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {([
          { label: "Modèle A", value: compareModel1?.id, onChange: selectModel1, result: compareResult1, model: compareModel1, color: "var(--color-chart-1)" },
          { label: "Modèle B", value: compareModel2?.id, onChange: selectModel2, result: compareResult2, model: compareModel2, color: "var(--color-chart-2)" },
        ] as const).map((slot) => (
          <Card key={slot.label} className="border-2" style={{ borderColor: !slot.value ? undefined : slot.color + "40" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitCompareArrows className="h-4 w-4" style={{ color: slot.color }} />
                  {slot.label}
                </CardTitle>
                {slot.result && (
                  <Badge variant="outline" className={STATUS_CLS[slot.result.status]}>
                    {STATUS_LABELS[slot.result.status]}
                  </Badge>
                )}
              </div>
              <Select value={slot.value ?? ""} onValueChange={slot.onChange}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choisir un modèle…" />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLE_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            {slot.model && slot.result && (
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Valeur objective Z*</p>
                  <p className="text-2xl font-semibold font-mono">
                    {isNaN(slot.result.objective) ? "—" : slot.result.objective.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}
                  </p>
                  <p className="text-xs text-muted-foreground">{slot.result.durationMs.toFixed(0)} ms · GLPK WebAssembly</p>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-1 text-left text-muted-foreground font-medium">Variable</th>
                      <th className="pb-1 text-right text-muted-foreground font-medium font-mono">Valeur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {slot.result.variables.map((v) => (
                      <tr key={v.name} className={Math.abs(v.value) < 1e-9 ? "text-muted-foreground" : ""}>
                        <td className="py-1 font-mono">{v.name}</td>
                        <td className="py-1 text-right font-mono">{v.value.toLocaleString("fr-FR", { maximumFractionDigits: 6 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            )}
            {slot.model && !slot.result && !solving && (
              <CardContent>
                <p className="text-xs text-muted-foreground">Cliquez sur « Lancer les deux » pour résoudre.</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {hasBothResults && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tableau comparatif</CardTitle>
              <CardDescription className="text-xs">Δ = Modèle B − Modèle A</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium text-muted-foreground text-xs">Indicateur</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground text-xs font-mono">{compareModel1!.name}</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground text-xs font-mono">{compareModel2!.name}</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground text-xs">Δ (B − A)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-2 text-xs">Statut</td>
                    <td className="py-2 text-right"><Badge variant="outline" className={`text-[10px] ${STATUS_CLS[compareResult1!.status]}`}>{STATUS_LABELS[compareResult1!.status]}</Badge></td>
                    <td className="py-2 text-right"><Badge variant="outline" className={`text-[10px] ${STATUS_CLS[compareResult2!.status]}`}>{STATUS_LABELS[compareResult2!.status]}</Badge></td>
                    <td className="py-2 text-right text-muted-foreground text-xs">—</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-xs font-medium">Valeur Z*</td>
                    <td className="py-2 text-right font-mono">{compareResult1!.objective.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}</td>
                    <td className="py-2 text-right font-mono">{compareResult2!.objective.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}</td>
                    <td className="py-2 text-right"><DeltaBadge a={compareResult1!.objective} b={compareResult2!.objective} /></td>
                  </tr>
                  <tr>
                    <td className="py-2 text-xs">Temps (ms)</td>
                    <td className="py-2 text-right font-mono">{compareResult1!.durationMs.toFixed(0)}</td>
                    <td className="py-2 text-right font-mono">{compareResult2!.durationMs.toFixed(0)}</td>
                    <td className="py-2 text-right"><DeltaBadge a={compareResult1!.durationMs} b={compareResult2!.durationMs} /></td>
                  </tr>
                  <tr>
                    <td className="py-2 text-xs">Contraintes saturées</td>
                    <td className="py-2 text-right font-mono">{compareResult1!.constraints.filter((c) => c.saturated).length}</td>
                    <td className="py-2 text-right font-mono">{compareResult2!.constraints.filter((c) => c.saturated).length}</td>
                    <td className="py-2 text-right text-muted-foreground text-xs">—</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-xs">Variables actives</td>
                    <td className="py-2 text-right font-mono">{compareResult1!.variables.filter((v) => Math.abs(v.value) > 1e-9).length}</td>
                    <td className="py-2 text-right font-mono">{compareResult2!.variables.filter((v) => Math.abs(v.value) > 1e-9).length}</td>
                    <td className="py-2 text-right text-muted-foreground text-xs">—</td>
                  </tr>
                  {allVarNames.map((name) => {
                    const v1 = compareResult1!.variables.find((v) => v.name === name)?.value ?? 0;
                    const v2 = compareResult2!.variables.find((v) => v.name === name)?.value ?? 0;
                    return (
                      <tr key={name} className="text-muted-foreground">
                        <td className="py-2 text-xs font-mono">{name}</td>
                        <td className="py-2 text-right font-mono">{v1.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}</td>
                        <td className="py-2 text-right font-mono">{v2.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}</td>
                        <td className="py-2 text-right"><DeltaBadge a={v1} b={v2} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {allVarNames.length > 0 && allVarNames.length <= 10 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Comparaison des variables</CardTitle>
                <CardDescription className="text-xs">Valeurs optimales côte à côte</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={varChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} fontFamily="JetBrains Mono, monospace" />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                      <Legend />
                      <Bar dataKey={compareModel1!.name} fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey={compareModel2!.name} fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!compareModel1 && !compareModel2 && (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Sélectionnez deux modèles ci-dessus pour commencer la comparaison.
        </div>
      )}
    </div>
  );
}
