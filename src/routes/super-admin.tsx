import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { AdminGate } from "@/components/AdminGate";
import { DomainGate, useContactEmail } from "@/components/DomainGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { superAdminStats } from "@/lib/admin.functions";
import { formatPrice, STATUS_LABELS } from "@/lib/format";
import { isSuperAdmin } from "@/lib/super-admin";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Super Admin – Statistiques NOVA DESK" },
      {
        name: "description",
        content: "Tableau de bord des commandes, montants et clients de la conciergerie.",
      },
      { property: "og:title", content: "Super Admin – Statistiques NOVA DESK" },
      {
        property: "og:description",
        content: "Commandes, chiffre d'affaires et répartition par client et prestation.",
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
          <SuperGuard />
        </AdminGate>
      </DomainGate>
    </div>
  ),
});

function SuperGuard() {
  const email = useContactEmail();
  if (!isSuperAdmin(email)) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Accès réservé</h1>
        <p className="mt-2 text-muted-foreground">Cet espace est réservé à la direction.</p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/admin">Retour à l'administration</Link>
        </Button>
      </main>
    );
  }
  return <Stats />;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function Stats() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(iso(start));
  const [to, setTo] = useState(iso(today));

  const loadStats = useServerFn(superAdminStats);
  const q = useQuery({
    queryKey: ["super-admin", from, to],
    queryFn: () => loadStats({ data: { from, to } }),
  });

  const s = useMemo(() => {
    const rows = q.data ?? [];
    const byClient = new Map<string, { n: number; total: number }>();
    const byCompany = new Map<string, { n: number; total: number }>();
    const byCat = new Map<string, { n: number; total: number }>();
    const byService = new Map<string, { n: number; total: number }>();
    let total = 0,
      online = 0,
      desk = 0,
      unpaid = 0;
    const add = (m: Map<string, { n: number; total: number }>, k: string, n: number, t: number) => {
      const v = m.get(k) ?? { n: 0, total: 0 };
      v.n += n;
      v.total += t;
      m.set(k, v);
    };
    for (const b of rows) {
      total += b.total_cents;
      if (!b.paid_at) unpaid += b.total_cents;
      else if (b.payment_method === "accueil") desk += b.total_cents;
      else online += b.total_cents;
      const mail = b.contact_email ?? "inconnu";
      add(byClient, mail, 1, b.total_cents);
      add(byCompany, mail.split("@")[1] ?? "inconnu", 1, b.total_cents);
      for (const i of b.booking_items) {
        const t = i.unit_price_cents * i.quantity;
        const cat =
          (i as { services?: { service_categories?: { name?: string } | null } | null }).services
            ?.service_categories?.name ?? "Autre";
        add(byCat, cat, i.quantity, t);
        add(byService, i.service_name, i.quantity, t);
      }
    }
    return { rows, total, online, desk, unpaid, byClient, byCompany, byCat, byService };
  }, [q.data]);

  const exportCsv = () => {
    const lines = [
      [
        "Référence",
        "Date",
        "Collaborateur",
        "Statut",
        "Prestations",
        "Montant (€)",
        "Paiement",
      ].join(";"),
    ];
    for (const b of s.rows) {
      lines.push(
        [
          b.reference,
          new Date(b.created_at).toLocaleDateString("fr-FR"),
          b.contact_email ?? "",
          STATUS_LABELS[b.status] ?? b.status,
          b.booking_items.map((i) => `${i.quantity}x ${i.service_name}`).join(", "),
          (b.total_cents / 100).toFixed(2).replace(".", ","),
          b.paid_at ? (b.payment_method === "accueil" ? "Accueil" : "En ligne") : "Non payé",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";"),
      );
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `commandes_${from}_${to}.csv`;
    a.click();
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">
            Commandes hors annulations sur la période.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="from">Du</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">Au</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!s.rows.length}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button asChild variant="ghost">
            <Link to="/admin">Administration</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Commandes" value={String(s.rows.length)} />
        <Kpi label="Montant total" value={formatPrice(s.total)} />
        <Kpi label="Payé en ligne" value={formatPrice(s.online)} />
        <Kpi label="Payé à l'accueil" value={formatPrice(s.desk)} />
        <Kpi label="Non payé" value={formatPrice(s.unpaid)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Breakdown title="Par entreprise" unit="cmd" map={s.byCompany} />
        <Breakdown title="Par collaborateur" unit="cmd" map={s.byClient} />
        <Breakdown title="Par catégorie" unit="art." map={s.byCat} />
        <Breakdown title="Par prestation" unit="art." map={s.byService} />
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="panel border-border/70">
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Breakdown({
  title,
  unit,
  map,
}: {
  title: string;
  unit: string;
  map: Map<string, { n: number; total: number }>;
}) {
  const rows = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  return (
    <Card className="panel border-border/70">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {rows.length === 0 && <p className="text-muted-foreground">Aucune donnée.</p>}
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <span className="truncate">{k}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {v.n} {unit} · <span className="text-foreground">{formatPrice(v.total)}</span>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
