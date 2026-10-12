import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Save } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { AdminGate, AdminLockButton } from "@/components/AdminGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminPlanningData, adminSavePlanning } from "@/lib/data.functions";

export const Route = createFileRoute("/admin-plannings")({
  head: () => ({
    meta: [
      { title: "Plannings de collecte – Administration" },
      {
        name: "description",
        content:
          "Modifiez les horaires de collecte et de retrait affichés dans le catalogue pour chaque prestation.",
      },
      { property: "og:title", content: "Plannings de collecte – Administration" },
      {
        property: "og:description",
        content: "Édition des horaires de collecte par catégorie de prestation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
        <AdminGate>
          <PlanningsPage />
        </AdminGate>
    </div>
  ),
});

const SUGGESTIONS = [
  "Collecte tous les jours à 10h",
  "Collecte le mercredi à 10h",
  "Collecte le mardi et le vendredi à 10h",
  "Dépôt et retrait à l'accueil aux horaires d'ouverture",
];

function PlanningsPage() {
  const queryClient = useQueryClient();
  const [domainId, setDomainId] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const planning = useQuery({
    queryKey: ["admin-plannings", domainId],
    queryFn: () => adminPlanningData({ data: { domainId: domainId || null } }),
  });
  const domains = { data: planning.data?.domains };
  const categories = { data: planning.data?.categories, isLoading: planning.isLoading };
  const schedules = { data: planning.data?.schedules };

  const current = (catId: string, fallback: string | null) => {
    if (!domainId) return fallback ?? "";
    const row = schedules.data?.find((r) => r.category_id === catId);
    return row?.pickup_info ?? "";
  };

  useEffect(() => {
    if (!categories.data) return;
    setDrafts(Object.fromEntries(categories.data.map((c) => [c.id, current(c.id, c.pickup_info)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planning.data]);

  const save = async (id: string) => {
    setSaving(id);
    const value = (drafts[id] ?? "").trim() || null;
    const ok = await adminSavePlanning({
      data: { domainId: domainId || null, categoryId: id, value },
    }).catch(() => null);
    const error = !ok;
    setSaving(null);
    if (error) {
      toast.error("Enregistrement impossible");
      return;
    }
    toast.success("Planning mis à jour");
    void queryClient.invalidateQueries({ queryKey: ["admin-plannings"] });
    void queryClient.invalidateQueries({ queryKey: ["domain-schedules"] });
    void queryClient.invalidateQueries({ queryKey: ["catalogue"] });
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Plannings de collecte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque accueil renseigne ses horaires. Les collaborateurs rattachés voient ces
            horaires au moment de réserver.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">Retour à l'administration</Link>
          </Button>
          <AdminLockButton />
        </div>
      </header>

      <div className="space-y-2">
        <Label>Accueil / site</Label>
        <Select value={domainId || "default"} onValueChange={(v) => setDomainId(v === "default" ? "" : v)}>
          <SelectTrigger className="sm:w-96">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Planning par défaut (tous les accueils)</SelectItem>
            {domains.data?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label ? `${d.label} — ` : ""}@{d.domain.replace(/^@/, "")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {domainId && (
          <p className="text-xs text-muted-foreground">
            Laissez vide pour utiliser le planning par défaut.
          </p>
        )}
      </div>

      {categories.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      <div className="space-y-4">
        {categories.data?.map((c) => (
          <Card key={c.id} className="panel border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{c.name}</CardTitle>
              <CardDescription>{c.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor={`planning-${c.id}`}>Horaire affiché</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id={`planning-${c.id}`}
                    value={drafts[c.id] ?? ""}
                    maxLength={160}
                    placeholder={domainId ? c.pickup_info ?? "Ex. Collecte tous les jours à 10h" : "Ex. Collecte tous les jours à 10h"}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                  />
                  <Button
                    onClick={() => void save(c.id)}
                    disabled={saving === c.id || (drafts[c.id] ?? "") === current(c.id, c.pickup_info)}
                    className="sm:w-40"
                  >
                    <Save className="size-4" />
                    Enregistrer
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDrafts((d) => ({ ...d, [c.id]: s }))}
                  >
                    {s}
                  </Button>
                ))}
              </div>

              <p className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-accent">
                <Clock className="size-4" />
                {(drafts[c.id] ?? "").trim() ||
                  (domainId && c.pickup_info) ||
                  "Aucun horaire affiché pour cette prestation"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
