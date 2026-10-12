import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { AdminGate, AdminLockButton } from "@/components/AdminGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  adminDeleteSite,
  adminSaveSite,
  adminSaveSiteSchedule,
  adminSetDomainSite,
  adminSetSiteService,
  adminSitesData,
} from "@/lib/data.functions";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin-sites")({
  head: () => ({
    meta: [
      { title: "Sites & accueils – Administration Nova DESK" },
      {
        name: "description",
        content: "Gérez les sites, leurs accueils, les entreprises rattachées, les prestations et tarifs propres à chaque site.",
      },
      { property: "og:title", content: "Sites & accueils – Administration Nova DESK" },
      { property: "og:description", content: "Paramétrage des sites, domaines, prestations et prix par site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
        <AdminGate>
          <SitesPage />
        </AdminGate>
    </div>
  ),
});

type Data = Awaited<ReturnType<typeof adminSitesData>>;

function SitesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-sites"], queryFn: () => adminSitesData() });
  const [selected, setSelected] = useState<string>("");
  const [newName, setNewName] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-sites"] });
    void qc.invalidateQueries({ queryKey: ["catalogue"] });
  };

  const create = async () => {
    const ok = await adminSaveSite({ data: { name: newName, active: true } }).catch(() => null);
    if (!ok) return void toast.error("Création impossible (nom de 2 caractères minimum)");
    setNewName("");
    toast.success("Site créé");
    refresh();
  };

  const site = q.data?.sites.find((s) => s.id === selected);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Sites & accueils</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque site regroupe un accueil, les entreprises (domaines) rattachées, ses prestations et ses prix.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">Retour à l'administration</Link>
          </Button>
          <AdminLockButton />
        </div>
      </header>

      <Card className="panel border-border/70">
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="new-site">Nouveau site</Label>
            <Input id="new-site" value={newName} placeholder="Ex. Campus La Défense" onChange={(e) => setNewName(e.target.value)} />
          </div>
          <Button onClick={() => void create()} disabled={newName.trim().length < 2}>
            <Plus className="size-4" /> Créer le site
          </Button>
        </CardContent>
      </Card>

      {q.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      <div className="flex flex-wrap gap-2">
        {q.data?.sites.map((s) => (
          <Button key={s.id} variant={s.id === selected ? "default" : "outline"} size="sm" onClick={() => setSelected(s.id)}>
            <Building2 className="size-4" /> {s.name}
            {!s.active && <Badge variant="secondary">inactif</Badge>}
          </Button>
        ))}
        {q.data?.sites.length === 0 && <p className="text-sm text-muted-foreground">Aucun site pour l'instant.</p>}
      </div>

      {site && q.data && <SiteEditor key={site.id} site={site} data={q.data} onChange={refresh} onDeleted={() => setSelected("")} />}
    </main>
  );
}

function SiteEditor({
  site,
  data,
  onChange,
  onDeleted,
}: {
  site: Data["sites"][number];
  data: Data;
  onChange: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState({
    name: site.name,
    address: site.address ?? "",
    reception_email: site.reception_email ?? "",
    active: site.active,
  });

  const save = async () => {
    const ok = await adminSaveSite({ data: { id: site.id, ...form } }).catch(() => null);
    if (!ok) return void toast.error("Enregistrement impossible (vérifiez l'e-mail)");
    toast.success("Site enregistré");
    onChange();
  };
  const remove = async () => {
    if (!confirm(`Supprimer le site « ${site.name} » ?`)) return;
    await adminDeleteSite({ data: { id: site.id } });
    toast.success("Site supprimé");
    onDeleted();
    onChange();
  };

  return (
    <div className="space-y-6">
      <Card className="panel border-border/70">
        <CardHeader>
          <CardTitle>Informations & accueil</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nom du site</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>E-mail de l'accueil</Label>
            <Input
              type="email"
              value={form.reception_email}
              placeholder="accueil.site@nova-serenity.fr"
              onChange={(e) => setForm({ ...form, reception_email: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Adresse</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            <span className="text-sm">Site actif</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => void remove()}>
              <Trash2 className="size-4" /> Supprimer
            </Button>
            <Button onClick={() => void save()}>
              <Save className="size-4" /> Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      <DomainsCard site={site} data={data} onChange={onChange} />
      <ServicesCard site={site} data={data} onChange={onChange} />
      <SchedulesCard site={site} data={data} onChange={onChange} />
    </div>
  );
}

function DomainsCard({ site, data, onChange }: { site: { id: string }; data: Data; onChange: () => void }) {
  const set = async (domainId: string, siteId: string | null) => {
    await adminSetDomainSite({ data: { domainId, siteId } });
    onChange();
  };
  const mine = data.domains.filter((d) => d.site_id === site.id);
  const others = data.domains.filter((d) => d.site_id !== site.id);
  return (
    <Card className="panel border-border/70">
      <CardHeader>
        <CardTitle>Entreprises rattachées (domaines)</CardTitle>
        <CardDescription>Les collaborateurs de ces domaines voient le catalogue et les prix de ce site.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {mine.map((d) => (
            <Badge key={d.id} variant="outline" className="gap-2 py-1">
              @{d.domain.replace(/^@/, "")}
              <button aria-label="Retirer" onClick={() => void set(d.id, null)}>×</button>
            </Badge>
          ))}
          {mine.length === 0 && <p className="text-sm text-muted-foreground">Aucun domaine rattaché.</p>}
        </div>
        <Select value="" onValueChange={(v) => void set(v, site.id)}>
          <SelectTrigger className="sm:w-80">
            <SelectValue placeholder="Rattacher un domaine…" />
          </SelectTrigger>
          <SelectContent>
            {others.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                @{d.domain.replace(/^@/, "")}
                {d.site_id ? ` (déplacer depuis ${data.sites.find((s) => s.id === d.site_id)?.name ?? "un autre site"})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Pour ajouter un nouveau domaine, utilisez l'onglet « Domaines autorisés » de l'administration.
        </p>
      </CardContent>
    </Card>
  );
}

function ServicesCard({ site, data, onChange }: { site: { id: string }; data: Data; onChange: () => void }) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const override = (id: string) => data.siteServices.find((o) => o.site_id === site.id && o.service_id === id);

  const save = async (serviceId: string, active: boolean, priceText: string | undefined) => {
    const current = override(serviceId);
    let price_cents = current?.price_cents ?? null;
    if (priceText !== undefined) {
      const t = priceText.trim().replace(",", ".");
      price_cents = t === "" ? null : Math.round(Number(t) * 100);
      if (price_cents !== null && (Number.isNaN(price_cents) || price_cents < 0)) return void toast.error("Prix invalide");
    }
    const ok = await adminSetSiteService({ data: { siteId: site.id, serviceId, active, price_cents } }).catch(() => null);
    if (!ok) return void toast.error("Enregistrement impossible");
    toast.success("Prestation mise à jour");
    onChange();
  };

  return (
    <Card className="panel border-border/70">
      <CardHeader>
        <CardTitle>Prestations & prix du site</CardTitle>
        <CardDescription>Désactivez une prestation pour ce site ou fixez un prix spécifique (vide = prix catalogue).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.categories.map((c) => {
          const svcs = data.services.filter((s) => s.category_id === c.id && s.active);
          if (svcs.length === 0) return null;
          return (
            <div key={c.id} className="space-y-2">
              <h3 className="text-sm font-semibold text-accent">{c.name}</h3>
              {svcs.map((s) => {
                const o = override(s.id);
                const active = o?.active !== false;
                const draft = prices[s.id] ?? (o?.price_cents != null ? (o.price_cents / 100).toString() : "");
                return (
                  <div key={s.id} className="flex flex-col gap-2 rounded-md border border-border/60 p-3 sm:flex-row sm:items-center">
                    <Switch checked={active} onCheckedChange={(v) => void save(s.id, v, undefined)} />
                    <span className={`flex-1 text-sm ${active ? "" : "text-muted-foreground line-through"}`}>
                      {s.name} <span className="text-muted-foreground">— catalogue {formatPrice(s.price_cents)}</span>
                    </span>
                    <Input
                      className="sm:w-28"
                      inputMode="decimal"
                      placeholder="Prix €"
                      value={draft}
                      onChange={(e) => setPrices((p) => ({ ...p, [s.id]: e.target.value }))}
                    />
                    <Button size="sm" variant="outline" onClick={() => void save(s.id, active, draft)}>
                      Enregistrer
                    </Button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SchedulesCard({ site, data, onChange }: { site: { id: string }; data: Data; onChange: () => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const current = (catId: string) =>
    data.schedules.find((r) => r.site_id === site.id && r.category_id === catId)?.pickup_info ?? "";
  const save = async (catId: string) => {
    const ok = await adminSaveSiteSchedule({ data: { siteId: site.id, categoryId: catId, value: drafts[catId] ?? current(catId) } }).catch(() => null);
    if (!ok) return void toast.error("Enregistrement impossible");
    toast.success("Planning mis à jour");
    onChange();
  };
  return (
    <Card className="panel border-border/70">
      <CardHeader>
        <CardTitle>Planning de collecte de l'accueil</CardTitle>
        <CardDescription>Affiché aux collaborateurs du site au moment de réserver (vide = planning par défaut).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.categories.map((c) => (
          <div key={c.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm sm:w-48">{c.name}</span>
            <Input
              maxLength={160}
              value={drafts[c.id] ?? current(c.id)}
              placeholder={c.pickup_info ?? "Ex. Collecte tous les jours à 10h"}
              onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
            />
            <Button size="sm" variant="outline" onClick={() => void save(c.id)}>
              Enregistrer
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
