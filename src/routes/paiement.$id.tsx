import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Mail } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { DomainGate } from "@/components/DomainGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/paiement/$id")({
  head: () => ({
    meta: [
      { title: "Paiement de votre dépôt – Nova Zen" },
      {
        name: "description",
        content:
          "Réglez votre dépôt de conciergerie Nova Zen en ligne et recevez votre facture par e-mail.",
      },
      { property: "og:title", content: "Paiement de votre dépôt – Nova Zen" },
      {
        property: "og:description",
        content: "Paiement sécurisé simulé et facture envoyée par e-mail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <DomainGate>
        <PaymentPage />
      </DomainGate>
    </div>
  ),
});

function PaymentPage() {
  const { id } = Route.useParams();
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);

  const booking = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, booking_items(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const b = booking.data;

  const pay = async () => {
    if (!b) return;
    setBusy(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "confirmed", paid_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    if (error) {
      toast.error("Le paiement n'a pas pu être enregistré.");
      return;
    }
    setPaid(true);
    toast.success("Paiement accepté. Facture envoyée par e-mail.");
    void booking.refetch();
  };

  if (booking.isLoading) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Chargement…</main>;
  }

  if (!b) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm">Réservation introuvable.</main>;
  }

  const alreadyPaid = paid || Boolean(b.paid_at);
  const invoiceLines = b.booking_items
    .map((i) => `${i.quantity} x ${i.service_name} — ${formatPrice(i.unit_price_cents * i.quantity)}`)
    .join("\n");
  const mailBody = `Facture Nova Zen — dépôt ${b.reference}\n\n${invoiceLines}\n\nTotal payé : ${formatPrice(b.total_cents)}\nDépôt : ${b.dropoff_date} (${b.dropoff_slot})\n\nMerci de votre confiance.\nNova Zen Conciergerie`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">
        {alreadyPaid ? "Paiement confirmé" : "Paiement du dépôt"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Dépôt {b.reference} · {formatPrice(b.total_cents)}
      </p>

      <Card className="panel mt-6 border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {alreadyPaid ? <CheckCircle2 className="size-4" /> : <CreditCard className="size-4" />}
            {alreadyPaid ? "Facture" : "Carte bancaire (simulation)"}
          </CardTitle>
          <CardDescription>
            {alreadyPaid
              ? `Facture envoyée à ${b.contact_email ?? "votre adresse professionnelle"}.`
              : "Paiement de démonstration : aucune somme n'est réellement débitée."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
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
          <div className="flex justify-between border-t border-border pt-3 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(b.total_cents)}</span>
          </div>

          {!alreadyPaid && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="card">Numéro de carte</Label>
                  <Input id="card" inputMode="numeric" defaultValue="4242 4242 4242 4242" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp">Expiration</Label>
                  <Input id="exp" defaultValue="12/29" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input id="cvc" defaultValue="123" />
                </div>
              </div>
              <Button className="w-full" onClick={pay} disabled={busy}>
                {busy ? "Paiement en cours…" : `Payer ${formatPrice(b.total_cents)}`}
              </Button>
            </>
          )}

          {alreadyPaid && (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Mail className="size-4" /> E-mail de facturation
              </p>
              <p className="text-muted-foreground">
                À : {b.contact_email ?? "—"} · Objet : Facture Nova Zen — dépôt {b.reference}
              </p>
              <pre className="whitespace-pre-wrap font-sans text-muted-foreground">{mailBody}</pre>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`mailto:${b.contact_email ?? ""}?subject=${encodeURIComponent(
                      `Facture Nova Zen — dépôt ${b.reference}`,
                    )}&body=${encodeURIComponent(mailBody)}`}
                  >
                    Ouvrir dans ma messagerie
                  </a>
                </Button>
                <Button asChild size="sm">
                  <Link to="/reservations">Voir mes réservations</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
