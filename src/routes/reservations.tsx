import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, STATUS_LABELS } from "@/lib/format";

export const Route = createFileRoute("/reservations")({
  head: () => ({
    meta: [
      { title: "Réservations – Conciergerie" },
      {
        name: "description",
        content:
          "Suivez l'avancement de vos dépôts de conciergerie : statut, prestations, montant et créneau.",
      },
      { property: "og:title", content: "Mes réservations – Conciergerie" },
      {
        property: "og:description",
        content: "Historique et suivi de vos réservations de conciergerie.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
              <MyBookings />
    </div>
  ),
});

function MyBookings() {
  const queryClient = useQueryClient();

  const bookings = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, booking_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancel = async (id: string) => {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) {
      toast.error("Annulation impossible.");
      return;
    }
    toast.success("Réservation annulée.");
    void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Réservations</h1>

      {bookings.isLoading && <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>}

      {bookings.data?.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Aucune réservation pour le moment. Rendez-vous dans l'onglet « Réserver ».
        </p>
      )}

      <div className="mt-6 space-y-4">
        {bookings.data?.map((b) => (
          <Card key={b.id} className="panel border-border/70">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Dépôt {b.reference}</CardTitle>
                <CardDescription>
                  {new Date(b.dropoff_date).toLocaleDateString("fr-FR")} · {b.dropoff_slot}
                  {b.location ? ` · ${b.location}` : ""}
                </CardDescription>
              </div>
              <Badge variant={b.status === "cancelled" ? "outline" : "secondary"}>
                {STATUS_LABELS[b.status] ?? b.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
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
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-semibold tabular-nums">{formatPrice(b.total_cents)}</span>
                {b.status === "pending" && (
                  <Button variant="outline" size="sm" onClick={() => cancel(b.id)}>
                    Annuler
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
