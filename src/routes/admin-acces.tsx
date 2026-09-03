import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppHeader } from "@/components/AppHeader";
import { AdminGate, AdminLockButton } from "@/components/AdminGate";
import { DomainGate } from "@/components/DomainGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-acces")({
  head: () => ({
    meta: [
      { title: "Accès collaborateurs – Administration" },
      {
        name: "description",
        content:
          "Gérez les domaines e-mail autorisés et la validation des adresses des collaborateurs de la conciergerie.",
      },
      { property: "og:title", content: "Accès collaborateurs – Administration" },
      {
        property: "og:description",
        content: "Domaines autorisés et validation des adresses e-mail collaborateurs.",
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
          <AccessAdminPage />
        </AdminGate>
      </DomainGate>
    </div>
  ),
});

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Domaine invalide (ex. entreprise.com)");

const emailSchema = z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(255);

const THREE_MONTHS_MS = 1000 * 60 * 60 * 24 * 90;

function AccessAdminPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Accès collaborateurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Domaines e-mail autorisés et validation des adresses (valables 3 mois).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">Retour à l'administration</Link>
          </Button>
          <AdminLockButton />
        </div>
      </header>

      <DomainsSection />
      <VerificationsSection />
    </main>
  );
}

function DomainsSection() {
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");

  const domains = useQuery({
    queryKey: ["admin-domains"],
    queryFn: async () => {
      const { data, error } = await supabase.from("allowed_domains").select("*").order("domain");
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
    <section className="space-y-4">
      <Card className="panel border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Autoriser un domaine e-mail</CardTitle>
          <CardDescription>
            Toute personne dont l'adresse se termine par ce domaine pourra demander un lien de
            validation.
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
          {domains.data?.length === 0 && (
            <p className="text-muted-foreground">Aucun domaine autorisé pour le moment.</p>
          )}
          {domains.data?.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-medium">@{d.domain}</span>
                {d.label && <Badge variant="outline">{d.label}</Badge>}
                {!d.active && <Badge variant="secondary">Désactivé</Badge>}
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
    </section>
  );
}

type VerificationState = "valide" | "attente" | "expire";

function stateOf(row: { verified_at: string | null; expires_at: string | null }): VerificationState {
  const expired = row.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false;
  if (row.verified_at && !expired) return "valide";
  if (!row.verified_at && !expired) return "attente";
  return "expire";
}

const STATE_LABEL: Record<VerificationState, string> = {
  valide: "Validée",
  attente: "En attente",
  expire: "Expirée",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function VerificationsSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const verifications = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_verifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const domains = useQuery({
    queryKey: ["admin-domains"],
    queryFn: async () => {
      const { data, error } = await supabase.from("allowed_domains").select("*").order("domain");
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-verifications"] });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (verifications.data ?? []).filter((r) => !q || r.email.toLowerCase().includes(q));
  }, [verifications.data, search]);

  const invite = async () => {
    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Adresse invalide");
      return;
    }
    const email = parsed.data;
    const domain = email.split("@")[1] ?? "";
    const allowed = (domains.data ?? []).some((d) => d.active && d.domain === domain);
    if (!allowed) {
      toast.error(`Le domaine @${domain} n'est pas autorisé.`);
      return;
    }
    const token = crypto.randomUUID();
    const { error } = await supabase.from("email_verifications").insert({
      email,
      token,
      expires_at: new Date(Date.now() + THREE_MONTHS_MS).toISOString(),
    });
    if (error) {
      toast.error("Impossible de créer l'invitation.");
      return;
    }
    setNewEmail("");
    await copyLink(token);
    toast.success("Lien de validation créé et copié.");
    void refresh();
  };

  const copyLink = async (token: string) => {
    const link = `${window.location.origin}/verifier/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Lien de validation copié.");
    } catch {
      toast.info(link);
    }
  };

  const validateNow = async (id: string) => {
    const { error } = await supabase
      .from("email_verifications")
      .update({
        verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + THREE_MONTHS_MS).toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error("Validation impossible.");
      return;
    }
    toast.success("Adresse validée pour 3 mois.");
    void refresh();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase
      .from("email_verifications")
      .update({ verified_at: null, expires_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Révocation impossible.");
      return;
    }
    toast.success("Accès révoqué.");
    void refresh();
  };

  return (
    <section className="space-y-4">
      <Card className="panel border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Inviter un collaborateur</CardTitle>
          <CardDescription>
            Génère un lien de validation à transmettre au collaborateur (adresse valable 3 mois une
            fois validée).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="invite-email">Adresse e-mail professionnelle</Label>
            <Input
              id="invite-email"
              type="email"
              value={newEmail}
              placeholder="prenom.nom@entreprise.com"
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={invite}>Générer le lien</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="panel border-border/70">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Adresses collaborateurs</CardTitle>
            <CardDescription>Suivi des validations et des accès en cours.</CardDescription>
          </div>
          <Input
            className="sm:max-w-64"
            value={search}
            placeholder="Rechercher une adresse…"
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher une adresse"
          />
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {rows.length === 0 && (
            <p className="text-muted-foreground">Aucune adresse enregistrée.</p>
          )}
          {rows.map((r) => {
            const state = stateOf(r);
            return (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-all">{r.email}</span>
                    <Badge
                      variant={
                        state === "valide"
                          ? "default"
                          : state === "attente"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {STATE_LABEL[state]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Demandée le {formatDate(r.created_at)} · Validée le {formatDate(r.verified_at)} ·
                    Expire le {formatDate(r.expires_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyLink(r.token)}>
                    <Copy className="size-4" /> Lien
                  </Button>
                  {state !== "valide" && (
                    <Button size="sm" onClick={() => validateNow(r.id)}>
                      Valider
                    </Button>
                  )}
                  {state === "valide" && (
                    <Button variant="outline" size="sm" onClick={() => revoke(r.id)}>
                      Révoquer
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
