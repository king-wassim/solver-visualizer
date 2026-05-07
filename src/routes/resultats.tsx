import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Target, Sigma, Zap,
  BarChart2, Table2, Activity, Download, RefreshCcw, FileText, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, ReferenceDot, Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import { solveLP } from "@/lib/solver";
import { generateSummary } from "@/lib/llm";
import type { SolveResult, LPModel } from "@/lib/lp-schema";

export const Route = createFileRoute("/resultats")({
  head: () => ({ meta: [{ title: "Résultats — RO Studio" }] }),
  component: ResultatsPage,
});

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  optimal: { label: "Optimal", icon: <CheckCircle2 className="h-4 w-4" />, cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  feasible: { label: "Faisable", icon: <CheckCircle2 className="h-4 w-4" />, cls: "bg-primary/15 text-primary border-primary/30" },
  infeasible: { label: "Infaisable", icon: <XCircle className="h-4 w-4" />, cls: "bg-destructive/15 text-destructive border-destructive/30" },
  unbounded: { label: "Non borné", icon: <AlertTriangle className="h-4 w-4" />, cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  undefined: { label: "Indéfini", icon: <AlertTriangle className="h-4 w-4" />, cls: "bg-muted text-muted-foreground border-border" },
  error: { label: "Erreur", icon: <XCircle className="h-4 w-4" />, cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

function buildFeasibilityData(model: LPModel, result: SolveResult) {
  const vars = model.variables;
  if (vars.length !== 2) return null;
  const v1 = vars[0].name;
  const v2 = vars[1].name;
  const N = 60;
  const maxX = Math.max(
    ...model.constraints.map((c) => {
      const a = c.coefficients[v1] ?? 0;
      return a !== 0 ? Math.abs(c.rhs / a) * 1.5 : 0;
    }),
    result.variables.find((v) => v.name === v1)?.value ?? 0,
    10,
  );
  const maxY = Math.max(
    ...model.constraints.map((c) => {
      const b = c.coefficients[v2] ?? 0;
      return b !== 0 ? Math.abs(c.rhs / b) * 1.5 : 0;
    }),
    result.variables.find((v) => v.name === v2)?.value ?? 0,
    10,
  );

  const lines = model.constraints.map((c, idx) => {
    const a = c.coefficients[v1] ?? 0;
    const b = c.coefficients[v2] ?? 0;
    const points: { x: number; [key: string]: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const x = (maxX * i) / N;
      if (Math.abs(b) > 1e-10) {
        const y = (c.rhs - a * x) / b;
        if (y >= -1 && y <= maxY * 1.2) points.push({ x: parseFloat(x.toFixed(4)), [c.name ?? `C${idx + 1}`]: parseFloat(y.toFixed(4)) });
      }
    }
    return { name: c.name ?? `C${idx + 1}`, points };
  });

  const optX = result.variables.find((v) => v.name === v1)?.value ?? 0;
  const optY = result.variables.find((v) => v.name === v2)?.value ?? 0;

  return { lines, optX, optY, maxX, maxY, v1, v2 };
}

function exportCSV(result: SolveResult, modelName: string) {
  const rows = ["Variable,Valeur", ...result.variables.map((v) => `${v.name},${v.value}`)];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${modelName.replace(/\s+/g, "_")}_solution.csv`;
  a.click();
}

async function exportPDF(
  model: LPModel,
  result: SolveResult,
  chartsEl: HTMLElement | null,
) {
  const [{ default: jsPDF }, htmlToImage] = await Promise.all([
    import("jspdf"),
    import("html-to-image"),
  ]);

  const { summary, source } = await generateSummary({
    data: { model, result },
  });

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Rapport de résolution", margin, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(model.name, margin, y);
  y += 14;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Généré le ${new Date().toLocaleString("fr-FR")}`, margin, y);
  y += 18;
  doc.setTextColor(0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Synthèse", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const kpis: [string, string][] = [
    ["Statut", result.status],
    ["Z*", isNaN(result.objective) ? "—" : result.objective.toLocaleString("fr-FR", { maximumFractionDigits: 4 })],
    ["Variables", String(result.variables.length)],
    ["Contraintes", String(result.constraints.length)],
    ["Saturées", String(result.constraints.filter((c) => c.saturated).length)],
  ];
  kpis.forEach(([k, v]) => {
    doc.setTextColor(120);
    doc.text(`${k} :`, margin, y);
    doc.setTextColor(0);
    doc.text(v, margin + 90, y);
    y += 13;
  });
  y += 10;

  // Solution table
  ensureSpace(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Solution optimale", margin, y);
  y += 16;
  doc.setFontSize(10);
  doc.text("Variable", margin, y);
  doc.text("Valeur", margin + 200, y);
  doc.text("Coef. obj.", margin + 300, y);
  doc.text("Contribution", margin + 400, y);
  y += 4;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  for (const v of result.variables) {
    ensureSpace(14);
    const coef = model.objective.coefficients[v.name] ?? 0;
    const contrib = coef * v.value;
    doc.text(v.name, margin, y);
    doc.text(v.value.toLocaleString("fr-FR", { maximumFractionDigits: 4 }), margin + 200, y);
    doc.text(String(coef), margin + 300, y);
    doc.text(contrib.toLocaleString("fr-FR", { maximumFractionDigits: 4 }), margin + 400, y);
    y += 13;
  }
  y += 10;

  // Constraints table
  ensureSpace(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Analyse des contraintes", margin, y);
  y += 16;
  doc.setFontSize(9);
  doc.text("Contrainte", margin, y);
  doc.text("LHS", margin + 180, y);
  doc.text("Op.", margin + 240, y);
  doc.text("RHS", margin + 280, y);
  doc.text("Slack", margin + 340, y);
  doc.text("Statut", margin + 410, y);
  y += 4;
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  for (const c of result.constraints) {
    ensureSpace(14);
    doc.text(String(c.name).slice(0, 28), margin, y);
    doc.text(c.lhs.toFixed(2), margin + 180, y);
    doc.text(c.operator, margin + 240, y);
    doc.text(String(c.rhs), margin + 280, y);
    doc.text(c.slack.toFixed(2), margin + 340, y);
    doc.text(c.saturated ? "Saturée" : "Relâchée", margin + 410, y);
    y += 13;
  }
  y += 10;

  // Charts
  if (chartsEl) {
    try {
      const imgData = await htmlToImage.toPng(chartsEl, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      const probe = new Image();
      probe.src = imgData;
      await new Promise<void>((resolve) => {
        if (probe.complete && probe.naturalWidth) resolve();
        else probe.onload = () => resolve();
      });
      const imgW = pageWidth - margin * 2;
      const imgH = (probe.naturalHeight * imgW) / probe.naturalWidth;

      doc.addPage();
      y = margin;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Visualisations", margin, y);
      y += 16;

      const usableH = pageHeight - margin - y;
      if (imgH <= usableH) {
        doc.addImage(imgData, "PNG", margin, y, imgW, imgH);
      } else {
        const scale = usableH / imgH;
        doc.addImage(imgData, "PNG", margin, y, imgW * scale, usableH);
      }
    } catch (e) {
      console.warn("Capture des graphiques échouée :", e);
    }
  }

  // LLM summary
  doc.addPage();
  y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Compte-rendu", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (source === "fallback") {
    doc.setTextColor(150);
    doc.setFontSize(8);
    doc.text("(compte-rendu généré localement)", margin, y);
    y += 12;
    doc.setFontSize(10);
    doc.setTextColor(0);
  }

  const lines = doc.splitTextToSize(summary, pageWidth - margin * 2);
  for (const line of lines) {
    ensureSpace(14);
    doc.text(line, margin, y);
    y += 13;
  }

  doc.save(`${model.name.replace(/\s+/g, "_")}_rapport.pdf`);
}

function ResultatsPage() {
  const navigate = useNavigate();
  const { selectedModel, solveResult, setSolveResult } = useAppStore();
  const [solving, setSolving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState("solution");
  const chartsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedModel && !solveResult) {
      setSolving(true);
      solveLP(selectedModel).then((r) => {
        setSolveResult(r);
        setSolving(false);
      });
    }
  }, [selectedModel, solveResult, setSolveResult]);

  if (!selectedModel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <BarChart2 className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Aucun modèle sélectionné.</p>
        <Button asChild><Link to="/bibliotheque">Choisir un modèle</Link></Button>
      </div>
    );
  }

  if (solving || !solveResult) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-6">
        <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Résolution en cours avec GLPK (WebAssembly)…</p>
      </div>
    );
  }

  const st = STATUS_MAP[solveResult.status] ?? STATUS_MAP.undefined;
  const saturated = solveResult.constraints.filter((c) => c.saturated).length;
  const activeVars = solveResult.variables.filter((v) => Math.abs(v.value) > 1e-9).length;
  const feasibility = buildFeasibilityData(selectedModel, solveResult);

  const varChartData = solveResult.variables.map((v) => ({ name: v.name, value: parseFloat(v.value.toFixed(6)) }));
  const slackData = solveResult.constraints.map((c) => ({ name: c.name, slack: parseFloat(c.slack.toFixed(4)), saturé: c.saturated ? 1 : 0 }));

  async function handleResolve() {
    setSolving(true);
    const r = await solveLP(selectedModel!);
    setSolveResult(r);
    setSolving(false);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Résultats & analyse</h1>
          <p className="text-sm text-muted-foreground">{selectedModel.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV(solveResult, selectedModel.name)} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={exportingPdf}
            onClick={async () => {
              setExportingPdf(true);
              const previousTab = activeTab;
              setActiveTab("visualisations");
              try {
                // wait for tab content (and charts) to mount + render
                await new Promise((r) => setTimeout(r, 600));
                await exportPDF(selectedModel, solveResult, chartsRef.current);
              } catch (e) {
                console.error(e);
                alert("Échec de l'export PDF : " + (e instanceof Error ? e.message : String(e)));
              } finally {
                setActiveTab(previousTab);
                setExportingPdf(false);
              }
            }}
            className="gap-1.5"
          >
            {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {exportingPdf ? "Génération…" : "Export PDF"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleResolve} className="gap-1.5">
            <RefreshCcw className="h-3.5 w-3.5" /> Recalculer
          </Button>
          <Button size="sm" onClick={() => navigate({ to: "/editeur" })} className="gap-1.5">
            Modifier le modèle
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Statut">
          <Badge variant="outline" className={`${st.cls} gap-1 font-medium`}>{st.icon}{st.label}</Badge>
        </KpiCard>
        <KpiCard icon={<Target className="h-4 w-4" />} label="Z*" mono>
          {isNaN(solveResult.objective) ? "—" : solveResult.objective.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}
        </KpiCard>
        <KpiCard icon={<Clock className="h-4 w-4" />} label="Temps" mono>
          {solveResult.durationMs.toFixed(0)} ms
        </KpiCard>
        <KpiCard icon={<Zap className="h-4 w-4" />} label="Saturées" mono>
          {saturated} / {solveResult.constraints.length}
        </KpiCard>
        <KpiCard icon={<Sigma className="h-4 w-4" />} label="Var. actives" mono>
          {activeVars}
        </KpiCard>
      </div>

      {solveResult.message && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 px-4 text-sm text-destructive">{solveResult.message}</CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="solution" className="gap-1.5"><Table2 className="h-3.5 w-3.5" /> Solution</TabsTrigger>
          <TabsTrigger value="contraintes" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Contraintes</TabsTrigger>
          <TabsTrigger value="visualisations" className="gap-1.5"><BarChart2 className="h-3.5 w-3.5" /> Visualisations</TabsTrigger>
        </TabsList>

        <TabsContent value="solution" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Valeurs optimales des variables</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium text-muted-foreground text-xs">Variable</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground text-xs">Description</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground text-xs font-mono">Valeur</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground text-xs font-mono">Coef. obj.</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground text-xs font-mono">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {solveResult.variables.map((v) => {
                    const coef = selectedModel.objective.coefficients[v.name] ?? 0;
                    const contrib = coef * v.value;
                    const desc = selectedModel.variables.find((sv) => sv.name === v.name)?.description;
                    return (
                      <tr key={v.name} className={Math.abs(v.value) < 1e-9 ? "text-muted-foreground" : ""}>
                        <td className="py-2 font-mono font-semibold">{v.name}</td>
                        <td className="py-2 text-xs text-muted-foreground">{desc ?? "—"}</td>
                        <td className="py-2 text-right font-mono">{v.value.toLocaleString("fr-FR", { maximumFractionDigits: 6 })}</td>
                        <td className="py-2 text-right font-mono text-muted-foreground">{coef}</td>
                        <td className="py-2 text-right font-mono">{contrib.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-border font-semibold">
                    <td colSpan={4} className="py-2 text-right text-xs text-muted-foreground">Valeur objective totale Z*</td>
                    <td className="py-2 text-right font-mono text-primary">
                      {isNaN(solveResult.objective) ? "—" : solveResult.objective.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contraintes" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Analyse des contraintes</CardTitle>
              <CardDescription className="text-xs">Slack = écart au RHS. Slack ≈ 0 → contrainte saturée (active à l'optimum).</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium text-muted-foreground text-xs">Contrainte</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground text-xs font-mono">LHS</th>
                    <th className="pb-2 text-center font-medium text-muted-foreground text-xs">Op.</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground text-xs font-mono">RHS</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground text-xs font-mono">Slack</th>
                    <th className="pb-2 text-center font-medium text-muted-foreground text-xs">Statut</th>
                    {solveResult.constraints.some((c) => c.dual != null) && (
                      <th className="pb-2 text-right font-medium text-muted-foreground text-xs font-mono">Prix dual</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {solveResult.constraints.map((c) => (
                    <tr key={c.name}>
                      <td className="py-2 font-medium text-xs">{c.name}</td>
                      <td className="py-2 text-right font-mono">{c.lhs.toFixed(4)}</td>
                      <td className="py-2 text-center font-mono text-muted-foreground">{c.operator}</td>
                      <td className="py-2 text-right font-mono">{c.rhs}</td>
                      <td className="py-2 text-right font-mono">{c.slack.toFixed(4)}</td>
                      <td className="py-2 text-center">
                        {c.saturated
                          ? <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">Saturée</Badge>
                          : <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px]">Relâchée</Badge>}
                      </td>
                      {solveResult.constraints.some((c) => c.dual != null) && (
                        <td className="py-2 text-right font-mono text-xs">{c.dual?.toFixed(4) ?? "—"}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visualisations" className="mt-4 space-y-4">
          <div ref={chartsRef} className="space-y-4 bg-background p-2">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Valeurs des variables</CardTitle>
                <CardDescription className="text-xs">Valeur optimale de chaque variable de décision</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={varChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} fontFamily="JetBrains Mono, monospace" />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                      <Bar dataKey="value" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} name="Valeur" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Utilisation des contraintes</CardTitle>
                <CardDescription className="text-xs">Slack normalisé de chaque contrainte</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={slackData} layout="vertical" margin={{ top: 5, right: 10, left: 30, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
                      <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={10} width={60} />
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                      <Bar dataKey="slack" fill="var(--color-chart-2)" radius={[0, 3, 3, 0]} name="Slack" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {feasibility && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Région réalisable</CardTitle>
                <CardDescription className="text-xs">
                  Lignes de contraintes dans le plan ({feasibility.v1}, {feasibility.v2}). Le point rouge est la solution optimale.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" dataKey="x" name={feasibility.v1} domain={[0, feasibility.maxX]} stroke="var(--color-muted-foreground)" fontSize={11} label={{ value: feasibility.v1, position: "insideRight", offset: -5, fontSize: 11 }} />
                      <YAxis domain={[0, feasibility.maxY]} stroke="var(--color-muted-foreground)" fontSize={11} label={{ value: feasibility.v2, angle: -90, position: "insideTopLeft", offset: 10, fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                      <Legend />
                      {feasibility.lines.map((l, i) => (
                        <Line key={l.name} data={l.points} type="linear" dataKey={l.name} dot={false} strokeWidth={1.5}
                          stroke={`hsl(${(i * 60) % 360}, 70%, 55%)`} />
                      ))}
                      <ReferenceDot x={feasibility.optX} y={feasibility.optY} r={6} fill="var(--color-destructive)" stroke="white" strokeWidth={2} label={{ value: "Z*", position: "top", fontSize: 11 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon, label, children, mono }: { icon: React.ReactNode; label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-primary">{icon}</span>{label}
        </div>
        <div className={`mt-2 text-xl font-semibold leading-tight ${mono ? "font-mono" : ""}`}>{children}</div>
      </CardContent>
    </Card>
  );
}
