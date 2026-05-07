import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Library, Search, Filter, Play, Copy, GitCompareArrows, Tag } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SAMPLE_MODELS } from "@/lib/sample-models";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/bibliotheque")({
  head: () => ({ meta: [{ title: "Bibliothèque — RO Studio" }] }),
  component: BibliothequePage,
});

const SENSE_LABELS: Record<string, string> = { max: "Maximisation", min: "Minimisation" };
const ALL_TAGS = Array.from(new Set(SAMPLE_MODELS.flatMap((m) => m.tags ?? [])));

function BibliothequePage() {
  const navigate = useNavigate();
  const { setSelectedModel, setCompareModel1 } = useAppStore();
  const [search, setSearch] = useState("");
  const [senseFilter, setSenseFilter] = useState<"all" | "max" | "min">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const filtered = SAMPLE_MODELS.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      m.name.toLowerCase().includes(q) ||
      (m.description ?? "").toLowerCase().includes(q) ||
      (m.tags ?? []).some((t) => t.includes(q));
    const matchSense = senseFilter === "all" || m.sense === senseFilter;
    const matchTag = !tagFilter || (m.tags ?? []).includes(tagFilter);
    return matchSearch && matchSense && matchTag;
  });

  function handleLoad(id: string) {
    const m = SAMPLE_MODELS.find((x) => x.id === id);
    if (m) { setSelectedModel(m); navigate({ to: "/editeur" }); }
  }
  function handleSolve(id: string) {
    const m = SAMPLE_MODELS.find((x) => x.id === id);
    if (m) { setSelectedModel(m); navigate({ to: "/resultats" }); }
  }
  function handleCompare(id: string) {
    const m = SAMPLE_MODELS.find((x) => x.id === id);
    if (m) { setCompareModel1(m); navigate({ to: "/comparateur" }); }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bibliothèque de modèles</h1>
          <p className="text-sm text-muted-foreground">
            {SAMPLE_MODELS.length} TPs pré-chargés — cliquez pour charger ou résoudre.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Library className="h-3 w-3" />
          {filtered.length} modèle{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un modèle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "max", "min"] as const).map((s) => (
            <Button key={s} size="sm" variant={senseFilter === s ? "default" : "outline"} onClick={() => setSenseFilter(s)}>
              {s === "all" ? "Tous" : s === "max" ? "Max" : "Min"}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={tagFilter === null ? "secondary" : "ghost"} onClick={() => setTagFilter(null)} className="gap-1.5">
          <Filter className="h-3 w-3" /> Tous les tags
        </Button>
        {ALL_TAGS.map((tag) => (
          <Button key={tag} size="sm" variant={tagFilter === tag ? "secondary" : "ghost"} onClick={() => setTagFilter(tagFilter === tag ? null : tag)} className="gap-1.5">
            <Tag className="h-3 w-3" /> {tag}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Aucun modèle ne correspond à votre recherche.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <Card key={m.id} className="flex flex-col transition-colors hover:border-primary/40">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm leading-snug">{m.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      m.sense === "max"
                        ? "bg-primary/10 text-primary border-primary/30 shrink-0"
                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shrink-0"
                    }
                  >
                    {SENSE_LABELS[m.sense]}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2 text-xs">{m.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0">
                <div className="space-y-2">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{m.variables.length} var.</span>
                    <span>{m.constraints.length} contrainte{m.constraints.length !== 1 ? "s" : ""}</span>
                    <span className="capitalize">{m.variables[0]?.type ?? "continu"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(m.tags ?? []).map((t) => (
                      <span key={t} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 gap-1.5" onClick={() => handleSolve(m.id)}>
                    <Play className="h-3.5 w-3.5" /> Résoudre
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleLoad(m.id)} className="gap-1.5">
                    <Copy className="h-3.5 w-3.5" /> Charger
                  </Button>
                  <Button size="sm" variant="ghost" title="Comparer" onClick={() => handleCompare(m.id)}>
                    <GitCompareArrows className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
