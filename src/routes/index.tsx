import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Hash,
  AlignLeft,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SAMPLE_MODELS, TP_GROUPS } from "@/lib/sample-models";
import { useAppStore } from "@/lib/store";
import type { LPModel } from "@/lib/lp-schema";
import { InlineMath } from "react-katex";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — RO Studio" },
      { name: "description", content: "Vue d'ensemble de vos modèles de programmation linéaire." },
    ],
  }),
  component: DashboardPage,
});

const maxCount = SAMPLE_MODELS.filter((m) => m.sense === "max").length;
const minCount = SAMPLE_MODELS.filter((m) => m.sense === "min").length;

function toLatex(model: LPModel): string {
  const entries = Object.entries(model.objective.coefficients);
  const maxTerms = 4;
  const displayed = entries.slice(0, maxTerms);
  const hasMore = entries.length > maxTerms;

  const terms = displayed.map(([name, coeff], i) => {
    const absC = Math.abs(coeff);
    const sign = i === 0 ? (coeff < 0 ? "-" : "") : coeff < 0 ? " - " : " + ";
    const cStr = absC === 1 ? "" : `${absC}\\,`;
    const varLatex = name.replace(/([a-zA-Z]+)(\d+)/g, "$1_{$2}");
    return `${sign}${cStr}${varLatex}`;
  });

  const sense = model.sense === "max" ? "\\max" : "\\min";
  const ellipsis = hasMore ? " + \\cdots" : "";
  return `${sense}\\; Z = ${terms.join("")}${ellipsis}`;
}

function DashboardPage() {
  const navigate = useNavigate();
  const { setSelectedModel, setSolveResult } = useAppStore();

  function openModel(id: string) {
    const m = SAMPLE_MODELS.find((x) => x.id === id);
    if (!m) return;
    setSelectedModel(m);
    setSolveResult(null);
    navigate({ to: "/editeur" });
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            Aperçu de vos modèles et de leur résolution.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/bibliotheque">Parcourir la bibliothèque</Link>
          </Button>
          <Button asChild>
            <Link to="/editeur">
              Nouveau modèle <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={<Layers className="h-4 w-4" />}
          label="Modèles disponibles"
          value={String(SAMPLE_MODELS.length)}
          hint="3 TPs — 2 problèmes chacun"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Maximisation"
          value={String(maxCount)}
          hint="Problèmes de type max"
        />
        <KpiCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Minimisation"
          value={String(minCount)}
          hint="Problèmes de type min"
        />
      </div>

      {/* TP Sections */}
      {TP_GROUPS.map((group) => (
        <section key={group.id} className="space-y-4">
          {/* Section header */}
          <div className="flex items-center gap-3">
            <div className={`h-8 w-1.5 rounded-full ${group.dotColor}`} />
            <div className="flex-1">
              <h2 className={`text-base font-semibold ${group.headerColor}`}>{group.title}</h2>
              <p className="text-xs text-muted-foreground">{group.subtitle}</p>
            </div>
            <Badge variant="outline" className={`text-[10px] ${group.badgeClass}`}>
              {group.models.length} problèmes
            </Badge>
          </div>

          {/* Model cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {group.models.map((m, pi) => (
              <button
                key={m.id}
                onClick={() => openModel(m.id)}
                className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:bg-accent hover:border-primary/40 hover:shadow-md"
              >
                {/* Top row */}
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] font-bold ${group.badgeClass}`}>
                    P{pi + 1}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      m.sense === "max"
                        ? "text-[10px] uppercase bg-primary/10 text-primary border-primary/30"
                        : "text-[10px] uppercase bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                    }
                  >
                    {m.sense}
                  </Badge>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    <PlayCircle className="h-3.5 w-3.5" /> Ouvrir
                  </span>
                </div>

                {/* Name */}
                <p className="mb-3 text-sm font-semibold leading-snug">{m.name}</p>

                {/* LaTeX formula */}
                <div className="mb-3 overflow-x-auto rounded-md bg-muted/60 px-3 py-2 text-sm">
                  <InlineMath math={toLatex(m)} />
                </div>

                {/* Stats */}
                <div className="mb-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {m.variables.length} variable{m.variables.length > 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <AlignLeft className="h-3 w-3" />
                    {m.constraints.length} contrainte{m.constraints.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Description */}
                <p className="line-clamp-2 text-xs text-muted-foreground">{m.description}</p>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.tags
                    ?.filter((t) => t !== group.id)
                    .slice(0, 4)
                    .map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* Footer link */}
      <div className="flex justify-center pt-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/bibliotheque">
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Voir tous les modèles dans la bibliothèque
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
