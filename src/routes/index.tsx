import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SAMPLE_MODELS } from "@/lib/sample-models";
import { useAppStore } from "@/lib/store";

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
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
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
          hint="TPs pré-chargés"
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

      {/* Modèles disponibles */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-primary" />
              Modèles disponibles
            </CardTitle>
            <CardDescription>TPs pré-chargés — cliquez pour ouvrir dans l'éditeur</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/bibliotheque">
              Tout voir <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => openModel(m.id)}
                className="group rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent hover:border-primary/40"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{m.name}</span>
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
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{m.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.tags?.slice(0, 3).map((t) => (
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
        </CardContent>
      </Card>
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
