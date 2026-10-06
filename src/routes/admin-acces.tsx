import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Trash2 } from "lucide-react";
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
import {
  adminAddDomain,
  adminDeleteDomain,
  adminInviteUser,
  adminListDomains,
  adminListUsers,
  adminSetDomainActive,
  adminSetUserBanned,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin-acces")({
  head: () => ({
    meta: [
      { title: "Accès collaborateurs – Administration" },
      {
        name: "description",
        content:
          "Gérez les domaines e-mail autorisés et les comptes des collaborateurs de la conciergerie.",
      },
      { property: "og:title", content: "Accès collaborateurs – Administration" },
      {
        property: "og:description",
        content: "Domaines autorisés et comptes collaborateurs.",
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

function AccessAdminPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Accès collaborateurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Domaines e-mail autorisés et comptes ouverts par lien de connexion.
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
      <UsersSection />
    </main>
  );
}

function DomainsSection() {
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");

  const listDomains = useServerFn(adminListDomains);
  const addDomain = useServerFn(adminAddDomain);
  const setDomainActive = useServerFn(adminSetDomainActive);
  const deleteDomain = useServerFn(adminDeleteDomain);
  const domains = useQuery({
    queryKey: ["admin-domains"],
    queryFn: () => listDomains(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-domains"] });

  const add = async () => {
    const parsed = domainSchema.safeParse(domain);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Domaine invalide");
      return;
    }
    const { ok } = await addDomain({ data: { domain: parsed.data, label: label.trim() } }).catch(
      () => ({ ok: false }),
    );
    if (!ok) {
      toast.error("Ce domaine existe déjà ou n'a pas pu être ajouté.");
      return;
    }
    setDomain("");
    setLabel("");
    toast.success("Domaine autorisé.");
    void refresh();
  };

  const toggle = async (id: string, active: boolean) => {
    const { ok } = await setDomainActive({ data: { id, active } }).catch(() => ({ ok: false }));
    if (!ok) toast.error("Mise à jour impossible.");
    void refresh();
  };

  const remove = async (id: string) => {
    const { ok } = await deleteDomain({ data: { id } }).catch(() => ({ ok: false }));
    if (!ok) toast.error("Suppression impossible.");
    void refresh();
  };

  return (
    <section className="space-y-4">
      <Card className="panel border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Autoriser un domaine e-mail</CardTitle>
          <CardDescription>
            Toute personne dont l'adresse se termine par ce domaine pourra recevoir un lien de
            connexion.
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

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function UsersSection() {
  const queryClient = useQueryClient();
  const listUsers = useServerFn(adminListUsers);
  const inviteUser = useServerFn(adminInviteUser);
  const setBanned = useServerFn(adminSetUserBanned);
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users.data ?? []).filter((r) => !q || r.email.toLowerCase().includes(q));
  }, [users.data, search]);

  const invite = async () => {
    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Adresse invalide");
      return;
    }
    setBusy(true);
    const res = await inviteUser({ data: { email: parsed.data } }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      toast.error(
        res?.reason === "domain"
          ? `Le domaine @${parsed.data.split("@")[1]} n'est pas autorisé.`
          : "L'e-mail n'a pas pu être envoyé.",
      );
      return;
    }
    setNewEmail("");
    toast.success(`Lien de connexion envoyé à ${parsed.data}.`);
    void refresh();
  };

  const toggleBan = async (id: string, banned: boolean) => {
    const { ok } = await setBanned({ data: { id, banned } }).catch(() => ({ ok: false }));
    if (!ok) {
      toast.error("Mise à jour impossible.");
      return;
    }
    toast.success(banned ? "Accès révoqué." : "Accès rétabli.");
    void refresh();
  };

  return (
    <section className="space-y-4">
      <Card className="panel border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Inviter un collaborateur</CardTitle>
          <CardDescription>
            Envoie par e-mail un lien de connexion au collaborateur. Il accède à son espace en
            cliquant dessus.
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
            <Button onClick={invite} disabled={busy}>
              <Send className="size-4" /> Envoyer le lien
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="panel border-border/70">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Comptes collaborateurs</CardTitle>
            <CardDescription>Comptes ouverts par lien de connexion.</CardDescription>
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
          {rows.length === 0 && <p className="text-muted-foreground">Aucun compte.</p>}
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium break-all">{r.email}</span>
                  <Badge variant={r.banned ? "secondary" : "default"}>
                    {r.banned ? "Révoqué" : "Actif"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Créé le {formatDate(r.created_at)} · Dernière connexion{" "}
                  {formatDate(r.last_sign_in_at)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void toggleBan(r.id, !r.banned)}>
                {r.banned ? "Rétablir" : "Révoquer"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
