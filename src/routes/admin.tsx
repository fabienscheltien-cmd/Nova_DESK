import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppHeader } from "@/components/AppHeader";
import { AdminGate, AdminLockButton } from "@/components/AdminGate";
import { DomainGate, useContactEmail } from "@/components/DomainGate";
import { isSuperAdmin } from "@/lib/super-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { formatLeadTime, formatPrice, STATUS_FLOW, STATUS_LABELS } from "@/lib/format";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration – Conciergerie" },
      {
        name: "description",
        content:
          "Gérez le catalogue de prestations, les domaines e-mail autorisés et le suivi des réservations de la conciergerie.",
      },
      { property: "og:title", content: "Administration – Conciergerie" },
      {
        property: "og:description",
        content: "Catalogue, domaines autorisés et suivi des réservations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <DomainGate>
        <AdminGate>
          <AdminPage />
        </AdminGate>
      </DomainGate>
    </div>
  ),
});

const STATUSES = [...STATUS_FLOW];

function CategoryForm({ count, onDone }: { count: number; onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pickup, setPickup] = useState("");
  const add = async () => {
    const n = name.trim();
    if (n.length < 2) {
      toast.error("Nom de catégorie trop court");
      return;
    }
    const slug =
      n
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `cat-${Date.now()}`;
    const { error } = await supabase.from("service_categories").insert({
      name: n.slice(0, 80),
      slug,
      description: description.trim() || null,
      pickup_info: pickup.trim() || null,
      sort_order: count + 1,
    });
    if (error) {
      toast.error("Catégorie non créée (nom déjà utilisé ?).");
      return;
    }
    setName("");
    setDescription("");
    setPickup("");
    toast.success("Catégorie créée.");
    onDone();
  };
  return (
    <Card className="panel border-border/70">
      <CardHeader>
        <CardTitle className="text-base">Créer une catégorie</CardTitle>
        <CardDescription>Elle apparaîtra comme nouvel onglet sur la page de réservation.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="cat-name">Nom</Label>
          <Input id="cat-name" value={name} maxLength={80} placeholder="Soins cuir" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-desc">Description</Label>
          <Input id="cat-desc" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-pickup">Planning de collecte</Label>
          <Input id="cat-pickup" value={pickup} maxLength={160} placeholder="Collecte le lundi à 10h" onChange={(e) => setPickup(e.target.value)} />
        </div>
        <div className="sm:col-span-3">
          <Button onClick={add}>Créer la catégorie</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminPage() {
  const email = useContactEmail();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin-acces">Accès collaborateurs</Link>
          </Button>
          {isSuperAdmin(email) && (
            <Button asChild size="sm">
              <Link to="/super-admin">Super Admin</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/admin-plannings">Plannings de collecte</Link>
          </Button>
          <AdminLockButton />
        </div>
      </div>
      <Tabs defaultValue="bookings" className="mt-6">
        <TabsList>
          <TabsTrigger value="bookings">Réservations</TabsTrigger>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          <TabsTrigger value="domains">Domaines autorisés</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings" className="mt-5">
          <BookingsAdmin />
        </TabsContent>
        <TabsContent value="catalogue" className="mt-5">
          <CatalogueAdmin />
        </TabsContent>
        <TabsContent value="domains" className="mt-5">
          <DomainsAdmin />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function BookingsAdmin() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const bookings = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, booking_items(*), booking_status_history(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setStatus = async (
    id: string,
    status: string,
    previousStatus: string,
    paidAt: string | null,
  ): Promise<boolean> => {
    // Une demande retirée et payée se clôture automatiquement.
    const target = status === "delivered" && paidAt ? "termine" : status;
    const { error } = await supabase
      .from("bookings")
      .update({ status: target as never })
      .eq("id", id);
    if (error) {
      toast.error("Mise à jour impossible.");
      return false;
    }
    const { error: histError } = await supabase.from("booking_status_history").insert({
      booking_id: id,
      from_status: previousStatus as never,
      to_status: target as never,
    });
    if (histError) toast.error("Historique non enregistré.");
    void queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    if (target === "termine" && status === "delivered") {
      toast.success("Dépôt retiré et payé : clôturé automatiquement.");
    }
    return true;
  };

  const togglePayment = async (b: {
    id: string;
    status: string;
    paid_at: string | null;
    reference: string;
  }) => {
    setBusyId(b.id);
    const paying = !b.paid_at;
    const { error } = await supabase
      .from("bookings")
      .update({
        paid_at: paying ? new Date().toISOString() : null,
        payment_method: paying ? "accueil" : null,
      })
      .eq("id", b.id);
    if (error) {
      setBusyId(null);
      toast.error("Paiement non enregistré.");
      return;
    }
    if (paying && b.status === "delivered") {
      await setStatus(b.id, "termine", b.status, null);
      toast.success(`Dépôt ${b.reference} payé et clôturé.`);
    } else {
      void queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      toast.success(paying ? "Paiement à l'accueil enregistré." : "Paiement annulé.");
    }
    setBusyId(null);
  };

  const NEXT_STEP: Record<string, { to: string; label: string }> = {
    pending: { to: "confirmed", label: "Réceptionner" },
    confirmed: { to: "ready", label: "Marquer prêt" },
    ready: { to: "delivered", label: "Marquer retiré" },
  };

  return (
    <div className="space-y-4">
      {bookings.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune réservation.</p>
      )}
      {bookings.data?.map((b) => (
        <Card key={b.id} className="panel border-border/70">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                Dépôt {b.reference}
                {b.paid_at ? (
                  b.payment_method === "accueil" ? (
                    <Badge variant="outline">Payé à l'accueil</Badge>
                  ) : (
                    <Badge>Payé en ligne</Badge>
                  )
                ) : (
                  <Badge variant="secondary">Non payé</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {new Date(b.dropoff_date).toLocaleDateString("fr-FR")} · {b.dropoff_slot}
                {b.location ? ` · ${b.location}` : ""}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {b.status !== "termine" && b.status !== "cancelled" && NEXT_STEP[b.status] && (
                <Button
                  size="sm"
                  disabled={busyId === b.id}
                  onClick={() =>
                    setStatus(b.id, NEXT_STEP[b.status]!.to, b.status, b.paid_at)
                  }
                >
                  <CheckCheck className="size-4" />
                  {NEXT_STEP[b.status]!.label}
                </Button>
              )}
              <Button
                size="sm"
                variant={b.paid_at ? "ghost" : "outline"}
                disabled={busyId === b.id}
                onClick={() => togglePayment(b)}
              >
                {b.paid_at ? "Annuler le paiement" : "Payé à l'accueil"}
              </Button>
              <Select
                value={b.status}
                onValueChange={(v) => setStatus(b.id, v, b.status, b.paid_at)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="space-y-2 text-sm">
            <ul className="space-y-1">
              {b.booking_items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    {i.quantity} × {i.service_name}
                  </span>
                  <span className="tabular-nums">
                    {formatPrice(i.unit_price_cents * i.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            {b.notes && <p className="text-muted-foreground">Note : {b.notes}</p>}
            <p className="font-semibold tabular-nums">{formatPrice(b.total_cents)}</p>
            {b.booking_status_history.length > 0 && (
              <div className="border-t border-border/50 pt-2">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Historique
                </p>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {[...b.booking_status_history]
                    .sort((a, b2) => b2.changed_at.localeCompare(a.changed_at))
                    .map((h) => (
                      <li key={h.id}>
                        {new Date(h.changed_at).toLocaleString("fr-FR")} —{" "}
                        {h.from_status ? STATUS_LABELS[h.from_status] : "—"} →{" "}
                        {STATUS_LABELS[h.to_status]}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const serviceSchema = z.object({
  category_id: z.string().uuid("Choisissez une catégorie"),
  name: z.string().trim().min(2, "Nom trop court").max(80),
  description: z.string().trim().max(200).optional(),
  price_cents: z.number().int().min(0).max(1_000_000),
  lead_time_hours: z.number().int().min(1).max(2000),
});

function CatalogueAdmin() {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [lead, setLead] = useState("48");

  const data = useQuery({
    queryKey: ["admin-catalogue"],
    queryFn: async () => {
      const [cats, svcs] = await Promise.all([
        supabase.from("service_categories").select("*").order("sort_order"),
        supabase.from("services").select("*").order("sort_order"),
      ]);
      if (cats.error) throw cats.error;
      if (svcs.error) throw svcs.error;
      return { categories: cats.data, services: svcs.data };
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-catalogue"] });

  const addService = async () => {
    const parsed = serviceSchema.safeParse({
      category_id: categoryId,
      name,
      description,
      price_cents: Math.round(Number(price.replace(",", ".")) * 100),
      lead_time_hours: Number(lead),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Champs invalides");
      return;
    }
    const { error } = await supabase
      .from("services")
      .insert({ ...parsed.data, description: parsed.data.description ?? null });
    if (error) {
      toast.error("Ajout impossible.");
      return;
    }
    setName("");
    setDescription("");
    setPrice("");
    toast.success("Prestation ajoutée.");
    void refresh();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("services").update({ active }).eq("id", id);
    void refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      toast.error("Suppression impossible (prestation déjà réservée). Désactivez-la plutôt.");
      return;
    }
    void refresh();
  };

  return (
    <div className="space-y-6">
      <CategoryForm
        count={data.data?.categories.length ?? 0}
        onDone={() => void refresh()}
      />
      <Card className="panel border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Ajouter une prestation</CardTitle>
          <CardDescription>Prix en euros, délai en heures.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {data.data?.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="svc-name">Nom</Label>
            <Input
              id="svc-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="svc-desc">Description</Label>
            <Input
              id="svc-desc"
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="svc-price">Prix (€)</Label>
            <Input
              id="svc-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="5,50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="svc-lead">Délai (heures)</Label>
            <Input
              id="svc-lead"
              inputMode="numeric"
              value={lead}
              onChange={(e) => setLead(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={addService}>Ajouter</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {data.data?.categories.map((c) => (
          <Card key={c.id} className="panel border-border/70">
            <CardHeader>
              <CardTitle className="text-base">{c.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.data?.services
                .filter((s) => s.category_id === c.id)
                .map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-muted-foreground">
                        {formatPrice(s.price_cents)} · délai {formatLeadTime(s.lead_time_hours)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={s.active}
                        onCheckedChange={(v) => toggle(s.id, v)}
                        aria-label={`Activer ${s.name}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Supprimer ${s.name}`}
                        onClick={() => remove(s.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Domaine invalide (ex. entreprise.com)");

function DomainsAdmin() {
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");

  const domains = useQuery({
    queryKey: ["admin-domains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allowed_domains")
        .select("*")
        .order("domain");
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-domains"] });

  const add = async () => {
    const parsed = domainSchema.safeParse(domain);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Domaine invalide");
      return;
    }
    const { error } = await supabase
      .from("allowed_domains")
      .insert({ domain: parsed.data, label: label.trim() || null });
    if (error) {
      toast.error("Ce domaine existe déjà ou n'a pas pu être ajouté.");
      return;
    }
    setDomain("");
    setLabel("");
    toast.success("Domaine autorisé.");
    void refresh();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("allowed_domains").update({ active }).eq("id", id);
    void refresh();
  };

  const remove = async (id: string) => {
    await supabase.from("allowed_domains").delete().eq("id", id);
    void refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="panel border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Autoriser un domaine e-mail</CardTitle>
          <CardDescription>
            Toute personne dont l'adresse se termine par ce domaine pourra réserver.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="dom">Domaine</Label>
            <Input
              id="dom"
              value={domain}
              placeholder="entreprise.com"
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dom-label">Libellé</Label>
            <Input
              id="dom-label"
              value={label}
              maxLength={80}
              placeholder="Siège Paris"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={add}>Ajouter</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="panel border-border/70">
        <CardContent className="space-y-3 py-5 text-sm">
          {domains.data?.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-medium">@{d.domain}</span>
                {d.label && <Badge variant="outline">{d.label}</Badge>}
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={d.active}
                  onCheckedChange={(v) => toggle(d.id, v)}
                  aria-label={`Activer ${d.domain}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Supprimer ${d.domain}`}
                  onClick={() => remove(d.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
