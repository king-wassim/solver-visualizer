import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PencilRuler, Play, Code2, FormInput, Plus, Trash2, AlertCircle, CheckCircle2, BookOpen } from "lucide-react";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/lib/store";
import { solveLP } from "@/lib/solver";
import { LPModelSchema } from "@/lib/lp-schema";
import type { LPModel, Variable, Constraint } from "@/lib/lp-schema";
import { SAMPLE_MODELS } from "@/lib/sample-models";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/editeur")({
  head: () => ({ meta: [{ title: "Éditeur — RO Studio" }] }),
  component: EditeurPage,
});

const DEFAULT_MODEL: LPModel = {
  id: "custom-" + Date.now(),
  name: "Nouveau modèle",
  description: "",
  sense: "max",
  variables: [
    { name: "x1", type: "continuous", lb: 0 },
    { name: "x2", type: "continuous", lb: 0 },
  ],
  objective: { coefficients: { x1: 1, x2: 1 } },
  constraints: [
    { name: "C1", coefficients: { x1: 1, x2: 1 }, operator: "<=", rhs: 10 },
  ],
};

function varToLatex(name: string): string {
  return name.replace(/^([a-zA-Z]+)(\d+)$/, "$1_{$2}");
}

function buildLatex(model: LPModel): string {
  const terms = model.variables
    .map((v) => {
      const c = model.objective.coefficients[v.name] ?? 0;
      if (c === 0) return null;
      const vname = varToLatex(v.name);
      if (c === 1) return `+${vname}`;
      if (c === -1) return `-${vname}`;
      return `${c > 0 ? "+" : ""}${c}\\,${vname}`;
    })
    .filter(Boolean)
    .join(" ")
    .replace(/^\+/, "");

  const sense = model.sense === "max" ? "\\max" : "\\min";
  return `${sense}\\; Z = ${terms || "0"}`;
}

function EditeurPage() {
  const navigate = useNavigate();
  const { selectedModel, setSelectedModel, setSolveResult } = useAppStore();
  const [model, setModel] = useState<LPModel>(selectedModel ?? DEFAULT_MODEL);
  const [jsonText, setJsonText] = useState(JSON.stringify(selectedModel ?? DEFAULT_MODEL, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [solving, setSolving] = useState(false);
  const [mode, setMode] = useState<"form" | "json">("form");

  useEffect(() => {
    if (selectedModel) {
      setModel(selectedModel);
      setJsonText(JSON.stringify(selectedModel, null, 2));
    }
  }, [selectedModel]);

  function syncFromForm(updated: LPModel) {
    setModel(updated);
    setJsonText(JSON.stringify(updated, null, 2));
  }

  function handleJsonChange(text: string) {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      const result = LPModelSchema.safeParse(parsed);
      if (result.success) {
        setModel(result.data);
        setJsonError(null);
      } else {
        setJsonError(result.error.issues[0]?.message ?? "JSON invalide");
      }
    } catch {
      setJsonError("Syntaxe JSON invalide");
    }
  }

  function setVarField(i: number, field: keyof Variable, value: unknown) {
    const vars = [...model.variables];
    vars[i] = { ...vars[i], [field]: value } as Variable;
    const newObj: Record<string, number> = {};
    vars.forEach((v) => { newObj[v.name] = model.objective.coefficients[v.name] ?? 0; });
    const newCstrs = model.constraints.map((c) => {
      const coefs: Record<string, number> = {};
      vars.forEach((v) => { coefs[v.name] = c.coefficients[v.name] ?? 0; });
      return { ...c, coefficients: coefs };
    });
    syncFromForm({ ...model, variables: vars, objective: { ...model.objective, coefficients: newObj }, constraints: newCstrs });
  }

  function addVar() {
    const name = `x${model.variables.length + 1}`;
    const vars = [...model.variables, { name, type: "continuous" as const, lb: 0 }];
    const newObj = { ...model.objective.coefficients, [name]: 0 };
    const newCstrs = model.constraints.map((c) => ({ ...c, coefficients: { ...c.coefficients, [name]: 0 } }));
    syncFromForm({ ...model, variables: vars, objective: { ...model.objective, coefficients: newObj }, constraints: newCstrs });
  }

  function removeVar(i: number) {
    if (model.variables.length <= 1) return;
    const varName = model.variables[i].name;
    const vars = model.variables.filter((_, idx) => idx !== i);
    const newObj = { ...model.objective.coefficients };
    delete newObj[varName];
    const newCstrs = model.constraints.map((c) => {
      const coefs = { ...c.coefficients };
      delete coefs[varName];
      return { ...c, coefficients: coefs };
    });
    syncFromForm({ ...model, variables: vars, objective: { ...model.objective, coefficients: newObj }, constraints: newCstrs });
  }

  function addConstraint() {
    const coefs: Record<string, number> = {};
    model.variables.forEach((v) => { coefs[v.name] = 0; });
    const newC: Constraint = { name: `C${model.constraints.length + 1}`, coefficients: coefs, operator: "<=", rhs: 0 };
    syncFromForm({ ...model, constraints: [...model.constraints, newC] });
  }

  function removeConstraint(i: number) {
    syncFromForm({ ...model, constraints: model.constraints.filter((_, idx) => idx !== i) });
  }

  function setCstrField(i: number, field: keyof Constraint, value: unknown) {
    const cstrs = [...model.constraints];
    cstrs[i] = { ...cstrs[i], [field]: value } as Constraint;
    syncFromForm({ ...model, constraints: cstrs });
  }

  function setCstrCoef(ci: number, varName: string, val: number) {
    const cstrs = [...model.constraints];
    cstrs[ci] = { ...cstrs[ci], coefficients: { ...cstrs[ci].coefficients, [varName]: val } };
    syncFromForm({ ...model, constraints: cstrs });
  }

  async function handleSolve() {
    setSolving(true);
    const result = await solveLP(model);
    setSelectedModel(model);
    setSolveResult(result);
    setSolving(false);
    navigate({ to: "/resultats" });
  }

  function loadSample(id: string) {
    const m = SAMPLE_MODELS.find((x) => x.id === id);
    if (m) { setSelectedModel(m); setModel(m); setJsonText(JSON.stringify(m, null, 2)); setJsonError(null); }
  }

  const latex = buildLatex(model);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Éditeur de modèle</h1>
          <p className="text-sm text-muted-foreground">Définissez variables, objectif et contraintes, puis lancez la résolution.</p>
        </div>
        <div className="flex gap-2">
          <Select onValueChange={loadSample}>
            <SelectTrigger className="w-48 h-9 text-sm">
              <BookOpen className="h-3.5 w-3.5 mr-2 shrink-0" />
              <SelectValue placeholder="Charger un TP…" />
            </SelectTrigger>
            <SelectContent>
              {SAMPLE_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleSolve} disabled={solving} className="gap-2">
            <Play className="h-4 w-4" />
            {solving ? "Résolution…" : "Résoudre"}
          </Button>
        </div>
      </div>

      {/* Aperçu LaTeX avec KaTeX */}
      <Card className="bg-muted/30">
        <CardContent className="py-3 px-4">
          <div className="text-base text-primary overflow-x-auto">
            <InlineMath math={latex} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Aperçu de la fonction objectif</p>
        </CardContent>
      </Card>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "form" | "json")}>
        <TabsList>
          <TabsTrigger value="form" className="gap-1.5"><FormInput className="h-3.5 w-3.5" /> Formulaire</TabsTrigger>
          <TabsTrigger value="json" className="gap-1.5"><Code2 className="h-3.5 w-3.5" /> JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><PencilRuler className="h-4 w-4" /> Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom du modèle</Label>
                <Input value={model.name} onChange={(e) => syncFromForm({ ...model, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sens</Label>
                <Select value={model.sense} onValueChange={(v) => syncFromForm({ ...model, sense: v as "max" | "min" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="max">Maximisation</SelectItem>
                    <SelectItem value="min">Minimisation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Description (optionnel)</Label>
                <Input value={model.description ?? ""} onChange={(e) => syncFromForm({ ...model, description: e.target.value })} placeholder="Description courte du problème" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Variables de décision</CardTitle>
              <Button size="sm" variant="outline" onClick={addVar} className="gap-1.5 h-7 text-xs">
                <Plus className="h-3 w-3" /> Ajouter
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium text-muted-foreground text-xs">Nom</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground text-xs px-2">Type</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground text-xs px-2">Borne inf.</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground text-xs px-2">Borne sup.</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground text-xs px-2">Coef. obj.</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground text-xs px-2">Description</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {model.variables.map((v, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-2">
                        <Input className="h-7 w-20 text-xs font-mono" value={v.name} onChange={(e) => setVarField(i, "name", e.target.value)} />
                      </td>
                      <td className="py-1.5 px-2">
                        <Select value={v.type} onValueChange={(val) => setVarField(i, "type", val)}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="continuous">Continu</SelectItem>
                            <SelectItem value="integer">Entier</SelectItem>
                            <SelectItem value="binary">Binaire</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          className="h-7 w-16 text-xs"
                          type="number"
                          placeholder="0"
                          value={v.lb ?? ""}
                          onChange={(e) => setVarField(i, "lb", e.target.value === "" ? null : parseFloat(e.target.value))}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          className="h-7 w-16 text-xs"
                          type="number"
                          placeholder="∞"
                          value={v.ub ?? ""}
                          onChange={(e) => setVarField(i, "ub", e.target.value === "" ? null : parseFloat(e.target.value))}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input className="h-7 w-16 text-xs font-mono" type="number" value={model.objective.coefficients[v.name] ?? 0}
                          onChange={(e) => syncFromForm({ ...model, objective: { ...model.objective, coefficients: { ...model.objective.coefficients, [v.name]: parseFloat(e.target.value) || 0 } } })} />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input className="h-7 text-xs" value={v.description ?? ""} onChange={(e) => setVarField(i, "description", e.target.value)} placeholder="(optionnel)" />
                      </td>
                      <td className="py-1.5">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeVar(i)} disabled={model.variables.length <= 1}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Contraintes</CardTitle>
              <Button size="sm" variant="outline" onClick={addConstraint} className="gap-1.5 h-7 text-xs">
                <Plus className="h-3 w-3" /> Ajouter
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium text-muted-foreground text-xs">Nom</th>
                    {model.variables.map((v) => (
                      <th key={v.name} className="pb-2 text-center font-medium text-muted-foreground text-xs px-2 font-mono">{v.name}</th>
                    ))}
                    <th className="pb-2 text-center font-medium text-muted-foreground text-xs px-2">Op.</th>
                    <th className="pb-2 text-center font-medium text-muted-foreground text-xs px-2">RHS</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {model.constraints.map((c, ci) => (
                    <tr key={ci}>
                      <td className="py-1.5 pr-2">
                        <Input className="h-7 w-20 text-xs" value={c.name ?? ""} onChange={(e) => setCstrField(ci, "name", e.target.value)} />
                      </td>
                      {model.variables.map((v) => (
                        <td key={v.name} className="py-1.5 px-2 text-center">
                          <Input className="h-7 w-16 text-xs font-mono text-center" type="number" value={c.coefficients[v.name] ?? 0}
                            onChange={(e) => setCstrCoef(ci, v.name, parseFloat(e.target.value) || 0)} />
                        </td>
                      ))}
                      <td className="py-1.5 px-2">
                        <Select value={c.operator} onValueChange={(v) => setCstrField(ci, "operator", v)}>
                          <SelectTrigger className="h-7 w-16 text-xs font-mono"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="<=">≤</SelectItem>
                            <SelectItem value=">=">≥</SelectItem>
                            <SelectItem value="=">=</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1.5 px-2">
                        <Input className="h-7 w-20 text-xs font-mono" type="number" value={c.rhs} onChange={(e) => setCstrField(ci, "rhs", parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="py-1.5">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeConstraint(ci)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json" className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {jsonError
              ? <><AlertCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive">{jsonError}</span></>
              : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span>JSON valide</span></>}
          </div>
          <Textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="font-mono text-xs min-h-[400px] resize-y"
            spellCheck={false}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild><Link to="/bibliotheque">Annuler</Link></Button>
        <Button onClick={handleSolve} disabled={solving || !!jsonError} className="gap-2">
          <Play className="h-4 w-4" />
          {solving ? "Résolution en cours…" : "Résoudre le modèle"}
        </Button>
      </div>
    </div>
  );
}
