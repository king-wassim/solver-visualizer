import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Settings as SettingsIcon, Sun, Moon, Monitor, Palette, Sliders, FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAppStore, type Theme } from "@/lib/store";

export const Route = createFileRoute("/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — RO Studio" }] }),
  component: ParametresPage,
});

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "dark", label: "Sombre", icon: <Moon className="h-4 w-4" /> },
  { value: "light", label: "Clair", icon: <Sun className="h-4 w-4" /> },
  { value: "system", label: "Système", icon: <Monitor className="h-4 w-4" /> },
];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
  } else {
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
  }
}

function ParametresPage() {
  const { theme, setTheme } = useAppStore();

  useEffect(() => { applyTheme(theme); }, [theme]);

  function handleTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Préférences de l'application.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><Palette className="h-4 w-4" /> Apparence</CardTitle>
          <CardDescription className="text-xs">Choisissez votre thème d'affichage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Thème</Label>
            <div className="flex gap-2">
              {THEME_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={theme === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTheme(opt.value)}
                  className="gap-2"
                >
                  {opt.icon} {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><Sliders className="h-4 w-4" /> Solveur</CardTitle>
          <CardDescription className="text-xs">Paramètres du moteur de résolution GLPK (WebAssembly).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Moteur</span>
              <span className="font-medium">GLPK 4.65 (WASM)</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Exécution</span>
              <span className="font-medium">Client (navigateur)</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Types supportés</span>
              <span className="font-medium">PL continu, entier, mixte, binaire</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Backend requis</span>
              <span className="font-medium text-emerald-500">Aucun</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><FileDown className="h-4 w-4" /> Export</CardTitle>
          <CardDescription className="text-xs">Formats d'export disponibles depuis la page Résultats.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {["CSV", "JSON", "PDF"].map((fmt) => (
              <div key={fmt} className="rounded-md border border-border px-3 py-1.5 text-xs flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                {fmt}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><SettingsIcon className="h-4 w-4" /> À propos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="font-medium">made by chouayakh wassim</p>
        </CardContent>
      </Card>
    </div>
  );
}
