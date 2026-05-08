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

function exportJSON(model: LPModel, result: SolveResult) {
  const payload = { model, result, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${model.name.replace(/\s+/g, "_")}_solution.json`;
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

  const { summary, source } = await generateSummary({ data: { model, result } });

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 45;
  const CW = W - M * 2;
  let y = M;
  let page = 1;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const topBar = () => {
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, W, 5, "F");
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 5, W, 3, "F");
  };

  const footer = () => {
    doc.setFillColor(248, 249, 250);
    doc.rect(0, H - 26, W, 26, "F");
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(0, H - 26, W, H - 26);
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text("RO Studio · Rapport de résolution", M, H - 10);
    doc.text(`Page ${page}`, W - M, H - 10, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };

  const newPage = () => {
    footer();
    doc.addPage();
    page++;
    topBar();
    y = M + 10;
  };

  const ensureSpace = (h: number) => {
    if (y + h > H - 36) newPage();
  };

  const sectionHeader = (num: string, title: string) => {
    ensureSpace(32);
    doc.setFillColor(239, 246, 255);
    doc.rect(M - 10, y - 13, CW + 20, 22, "F");
    doc.setFillColor(37, 99, 235);
    doc.rect(M - 10, y - 13, 4, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(`${num}  ${title}`, M + 2, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 18;
  };

  const tableHead = (cols: string[], widths: number[]) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(M, y - 12, CW, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    let x = M + 5;
    cols.forEach((col, i) => {
      doc.text(col, x, y);
      x += widths[i];
    });
    doc.setTextColor(0, 0, 0);
    y += 9;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(M, y, M + CW, y);
    y += 7;
  };

  // ── PAGE 1 ─────────────────────────────────────────────────────────────────
  topBar();
  y = 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(15, 23, 42);
  doc.text("Rapport de résolution", M, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(37, 99, 235);
  doc.text(model.name, M, y);
  y += 13;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Généré le ${new Date().toLocaleString("fr-FR")}  ·  RO Studio`, M, y);
  y += 6;

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1);
  doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);
  y += 20;

  // ── SECTION 1 : Synthèse ──────────────────────────────────────────────────
  sectionHeader("1.", "Synthèse");
  y += 4;

  type KpiEntry = { label: string; value: string; highlight: boolean };
  const kpiData: KpiEntry[] = [
    { label: "Statut de résolution", value: result.status.toUpperCase(), highlight: result.status === "optimal" },
    { label: "Valeur optimale Z*", value: isNaN(result.objective) ? "—" : result.objective.toLocaleString("fr-FR", { maximumFractionDigits: 4 }), highlight: true },
    { label: "Variables de décision", value: String(result.variables.length), highlight: false },
    { label: "Contraintes", value: String(result.constraints.length), highlight: false },
    { label: "Contraintes saturées", value: String(result.constraints.filter((c) => c.saturated).length), highlight: false },
    { label: "Durée de résolution", value: `${result.durationMs.toFixed(0)} ms`, highlight: false },
  ];

  const KCOLS = 3;
  const kW = CW / KCOLS;
  const kH = 38;
  const kGap = 4;

  kpiData.forEach(({ label, value, highlight }, i) => {
    const col = i % KCOLS;
    const row = Math.floor(i / KCOLS);
    const kx = M + col * kW;
    const ky = y + row * (kH + kGap);

    if (highlight && i === 0 && result.status === "optimal") {
      doc.setFillColor(209, 250, 229);
    } else if (highlight && i === 1) {
      doc.setFillColor(219, 234, 254);
    } else {
      doc.setFillColor(244, 246, 248);
    }
    doc.rect(kx + 2, ky - 14, kW - 6, kH, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, kx + 8, ky - 1);

    doc.setFont("helvetica", "bold");
    if (highlight && i === 0 && result.status === "optimal") {
      doc.setFontSize(13);
      doc.setTextColor(6, 95, 70);
    } else if (highlight && i === 1) {
      doc.setFontSize(14);
      doc.setTextColor(37, 99, 235);
    } else {
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
    }
    doc.text(value, kx + 8, ky + 15);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  });

  y += Math.ceil(kpiData.length / KCOLS) * (kH + kGap) + 16;

  // ── SECTION 2 : Solution optimale ────────────────────────────────────────
  sectionHeader("2.", "Solution optimale");

  const vCols = ["Variable", "Description", "Valeur optimale", "Coef. obj.", "Contribution"];
  const vWidths = [65, 155, 90, 75, 0];
  tableHead(vCols, vWidths);
  doc.setFontSize(9.5);

  for (const [idx, v] of result.variables.entries()) {
    ensureSpace(16);
    const coef = model.objective.coefficients[v.name] ?? 0;
    const contrib = coef * v.value;
    const desc = model.variables.find((mv) => mv.name === v.name)?.description ?? "—";
    const isActive = Math.abs(v.value) > 1e-9;

    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(M, y - 10, CW, 15, "F");
    }
    doc.setTextColor(isActive ? 0 : 160, isActive ? 0 : 160, isActive ? 0 : 160);
    doc.setFont("helvetica", isActive ? "bold" : "normal");
    doc.text(v.name, M + 5, y);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(desc, vWidths[1] - 6)[0] as string, M + 5 + vWidths[0], y);
    doc.text(v.value.toLocaleString("fr-FR", { maximumFractionDigits: 4 }), M + 5 + vWidths[0] + vWidths[1], y);
    doc.text(String(coef), M + 5 + vWidths[0] + vWidths[1] + vWidths[2], y);
    doc.text(contrib.toLocaleString("fr-FR", { maximumFractionDigits: 4 }), M + 5 + vWidths[0] + vWidths[1] + vWidths[2] + vWidths[3], y);
    doc.setTextColor(0, 0, 0);
    y += 14;
  }

  ensureSpace(20);
  doc.setFillColor(219, 234, 254);
  doc.rect(M, y - 10, CW, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 64, 175);
  doc.text("Valeur objective totale  Z*", M + 5, y);
  const zStr = isNaN(result.objective) ? "—" : result.objective.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
  doc.text(zStr, M + CW - 5, y, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 22;

  // ── SECTION 3 : Analyse des contraintes ─────────────────────────────────
  sectionHeader("3.", "Analyse des contraintes");

  const hasDual = result.constraints.some((c) => c.dual != null);
  const cCols = hasDual
    ? ["Contrainte", "LHS", "Op.", "RHS", "Slack", "Utilisation", "Statut", "Prix dual"]
    : ["Contrainte", "LHS", "Op.", "RHS", "Slack", "Utilisation", "Statut"];
  const cWidths = hasDual
    ? [120, 52, 22, 52, 52, 62, 60, 0]
    : [145, 58, 22, 58, 58, 68, 0];
  tableHead(cCols, cWidths);
  doc.setFontSize(9);

  for (const [idx, c] of result.constraints.entries()) {
    ensureSpace(16);
    const util = c.rhs !== 0 ? `${((c.lhs / c.rhs) * 100).toFixed(1)}%` : "N/A";

    if (c.saturated) {
      doc.setFillColor(254, 243, 199);
      doc.rect(M, y - 10, CW, 15, "F");
    } else if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(M, y - 10, CW, 15, "F");
    }

    let x = M + 5;
    doc.setFont("helvetica", c.saturated ? "bold" : "normal");
    doc.text(String(c.name ?? `C${idx + 1}`).slice(0, 20), x, y);
    x += cWidths[0];
    doc.setFont("helvetica", "normal");
    doc.text(c.lhs.toFixed(2), x, y); x += cWidths[1];
    doc.text(c.operator, x, y); x += cWidths[2];
    doc.text(String(c.rhs), x, y); x += cWidths[3];
    doc.text(c.slack.toFixed(2), x, y); x += cWidths[4];

    if (util !== "N/A") {
      const pct = parseFloat(util);
      if (pct >= 99) doc.setTextColor(146, 64, 14);
      else if (pct >= 80) doc.setTextColor(161, 98, 7);
      else doc.setTextColor(21, 128, 61);
      doc.text(util, x, y);
      doc.setTextColor(0, 0, 0);
    } else {
      doc.text(util, x, y);
    }
    x += cWidths[5];

    if (c.saturated) {
      doc.setTextColor(146, 64, 14);
      doc.setFont("helvetica", "bold");
      doc.text("Saturée", x, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setTextColor(107, 114, 128);
      doc.text("Relâchée", x, y);
      doc.setTextColor(0, 0, 0);
    }
    x += cWidths[6];

    if (hasDual) {
      doc.text(c.dual?.toFixed(4) ?? "—", x, y);
    }
    y += 14;
  }
  y += 8;

  // ── VISUALISATIONS ────────────────────────────────────────────────────────
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

      newPage();
      sectionHeader("4.", "Visualisations");

      const imgW = CW;
      const imgH = (probe.naturalHeight * imgW) / probe.naturalWidth;
      const usableH = H - 36 - y;
      if (imgH <= usableH) {
        doc.addImage(imgData, "PNG", M, y, imgW, imgH);
        y += imgH + 10;
      } else {
        const scale = usableH / imgH;
        doc.addImage(imgData, "PNG", M, y, imgW * scale, usableH);
        y += usableH + 10;
      }
    } catch (e) {
      console.warn("Capture des graphiques échouée :", e);
    }
  }

  // ── COMPTE-RENDU ANALYTIQUE ───────────────────────────────────────────────
  newPage();

  const crNum = chartsEl ? "5." : "4.";
  sectionHeader(crNum, "Compte-rendu analytique");

  const sourceLabels: Record<string, string> = {
    groq: "Groq — LLaMA-3.3-70B Versatile",
    anthropic: "Anthropic — Claude Haiku 4.5",
    openai: "OpenAI — GPT-4o Mini",
    fallback: "Généré localement (aucune clé API)",
  };
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Analyse IA : ${sourceLabels[source] ?? source}`, M, y);
  y += 14;
  doc.setTextColor(0, 0, 0);

  // Parse and render structured summary
  type Part = { type: "h3" | "bullet" | "body"; text: string };
  const cleanLine = (l: string) => l.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*/g, "").trim();

  const parts: Part[] = summary.split("\n").map((line): Part => {
    const t = line.trim();
    if (/^###\s/.test(t)) return { type: "h3", text: cleanLine(t.replace(/^###\s+/, "")) };
    if (/^[-•]\s/.test(t)) return { type: "bullet", text: cleanLine(t.replace(/^[-•]\s+/, "")) };
    return { type: "body", text: cleanLine(t) };
  });

  let prevType: string | null = null;
  for (const part of parts) {
    if (!part.text) {
      if (prevType === "body") y += 5;
      prevType = "empty";
      continue;
    }

    if (part.type === "h3") {
      ensureSpace(30);
      y += prevType && prevType !== "empty" ? 8 : 0;
      doc.setFillColor(239, 246, 255);
      doc.rect(M, y - 12, CW, 18, "F");
      doc.setFillColor(37, 99, 235);
      doc.rect(M, y - 12, 3, 18, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 64, 175);
      doc.text(part.text, M + 8, y);
      doc.setTextColor(0, 0, 0);
      y += 12;
    } else if (part.type === "bullet") {
      const wrapped = doc.splitTextToSize(part.text, CW - 18) as string[];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      for (let li = 0; li < wrapped.length; li++) {
        ensureSpace(14);
        if (li === 0) {
          doc.setFillColor(37, 99, 235);
          doc.ellipse(M + 6, y - 3, 2, 2, "F");
        }
        doc.text(wrapped[li], M + 16, y);
        y += 13;
      }
    } else {
      const wrapped = doc.splitTextToSize(part.text, CW) as string[];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      for (const line of wrapped) {
        ensureSpace(14);
        doc.text(line, M, y);
        y += 13;
      }
    }
    prevType = part.type;
  }

  footer();
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
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportJSON(selectedModel, solveResult)} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> JSON
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
