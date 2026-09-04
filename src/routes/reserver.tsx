import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Clock, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppHeader } from "@/components/AppHeader";
import { DomainGate, useContactEmail } from "@/components/DomainGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatLeadTime, formatPrice, SLOTS } from "@/lib/format";

export const Route = createFileRoute("/reserver")({
  head: () => ({
    meta: [
      { title: "Réserver une prestation – Conciergerie" },
      {
        name: "description",
        content:
          "Sélectionnez vos prestations de conciergerie, consultez prix et délais, puis choisissez votre créneau de dépôt.",
      },
      { property: "og:title", content: "Réserver une prestation – Conciergerie" },
      {
        property: "og:description",
        content: "Catalogue de prestations, tarifs et délais, réservation de créneau.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <DomainGate>
        <BookingPage />
      </DomainGate>
    </div>
  ),
});

const detailsSchema = z.object({
  dropoff_date: z.string().min(1, "Choisissez une date de dépôt"),
  dropoff_slot: z.string().min(1, "Choisissez un créneau"),
  notes: z.string().trim().max(1000).optional(),
});

function BookingPage() {
  const navigate = useNavigate();
  const contactEmail = useContactEmail();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(SLOTS[0]!);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const catalogue = useQuery({
    queryKey: ["catalogue"],
    queryFn: async () => {
      const [cats, svcs] = await Promise.all([
        supabase.from("service_categories").select("*").order("sort_order"),
        supabase.from("services").select("*").eq("active", true).order("sort_order"),
      ]);
      if (cats.error) throw cats.error;
      if (svcs.error) throw svcs.error;
      return { categories: cats.data, services: svcs.data };
    },
  });

  const services = catalogue.data?.services ?? [];

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ service: services.find((s) => s.id === id)!, qty }))
        .filter((l) => l.service),
    [cart, services],
  );

  const total = lines.reduce((sum, l) => sum + l.service.price_cents * l.qty, 0);
  const maxLead = lines.reduce((max, l) => Math.max(max, l.service.lead_time_hours), 0);

  const setQty = (id: string, delta: number) =>
    setCart((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));

  const submit = async () => {
    if (lines.length === 0) {
      toast.error("Ajoutez au moins une prestation.");
      return;
    }
    const parsed = detailsSchema.safeParse({
      dropoff_date: date,
      dropoff_slot: slot,
      notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Informations incomplètes");
      return;
    }

    setBusy(true);
    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        dropoff_date: parsed.data.dropoff_date,
        dropoff_slot: parsed.data.dropoff_slot,
        notes: parsed.data.notes || null,
        total_cents: total,
        contact_email: contactEmail,
      })
      .select("id")
      .single();

    if (error || !booking) {
      setBusy(false);
      toast.error("La réservation n'a pas pu être enregistrée.");
      return;
    }

    const { error: itemsError } = await supabase.from("booking_items").insert(
      lines.map((l) => ({
        booking_id: booking.id,
        service_id: l.service.id,
        service_name: l.service.name,
        quantity: l.qty,
        unit_price_cents: l.service.price_cents,
      })),
    );
    setBusy(false);

    if (itemsError) {
      toast.error("Les prestations n'ont pas pu être enregistrées.");
      return;
    }

    toast.success("Réservation enregistrée. Nous attendons vos affaires à l'accueil.");
    void navigate({ to: "/paiement/$id", params: { id: booking.id } });
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <section>
        <h1 className="text-2xl font-semibold">Réserver une prestation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prix et délais indiqués par prestation. Le délai global correspond à la prestation la plus
          longue.
        </p>

        {catalogue.isLoading && (
          <p className="mt-8 text-sm text-muted-foreground">Chargement du catalogue…</p>
        )}

        {catalogue.data && (
          <Tabs defaultValue={catalogue.data.categories[0]?.slug ?? ""} className="mt-6">
            <TabsList className="flex h-auto flex-wrap justify-start gap-1">
              {catalogue.data.categories.map((c) => (
                <TabsTrigger key={c.id} value={c.slug}>
                  {c.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {catalogue.data.categories.map((c) => (
              <TabsContent key={c.id} value={c.slug} className="mt-5 space-y-3">
                <p className="text-sm text-muted-foreground">{c.description}</p>
                {c.pickup_info && (
                  <p className="flex items-center gap-2 text-sm font-medium text-accent">
                    <Clock className="size-4" />
                    {c.pickup_info}
                  </p>
                )}
                {services
                  .filter((s) => s.category_id === c.id)
                  .map((s) => (
                    <Card key={s.id} className="panel border-border/70">
                      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                        <div className="min-w-48 flex-1">
                          <p className="font-medium">{s.name}</p>
                          <p className="text-sm text-muted-foreground">{s.description}</p>
                          <div className="mt-2 flex gap-2">
                            <Badge variant="secondary">{formatPrice(s.price_cents)}</Badge>
                            <Badge variant="outline">
                              Délai {formatLeadTime(s.lead_time_hours)}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Retirer un ${s.name}`}
                            onClick={() => setQty(s.id, -1)}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <span className="w-6 text-center tabular-nums">{cart[s.id] ?? 0}</span>
                          <Button
                            size="icon"
                            aria-label={`Ajouter un ${s.name}`}
                            onClick={() => setQty(s.id, 1)}
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </section>

      <aside>
        <Card className="panel sticky top-20 border-border/70">
          <CardHeader>
            <CardTitle>Votre dépôt</CardTitle>
            <CardDescription>
              {lines.length === 0
                ? "Aucune prestation sélectionnée."
                : `Délai estimé : ${formatLeadTime(maxLead)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {lines.map((l) => (
                <li key={l.service.id} className="flex justify-between gap-3">
                  <span>
                    {l.qty} × {l.service.name}
                  </span>
                  <span className="tabular-nums">
                    {formatPrice(l.service.price_cents * l.qty)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex justify-between border-t border-border pt-3 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(total)}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date de dépôt</Label>
              <Input
                id="date"
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Créneau</Label>
              <Select value={slot} onValueChange={setSlot}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLOTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Précisions</Label>
              <Textarea
                id="notes"
                value={notes}
                maxLength={1000}
                placeholder="Tache sur le col, urgence, etc."
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button className="w-full" disabled={busy} onClick={submit}>
              Confirmer la réservation
            </Button>
          </CardContent>
        </Card>
      </aside>
    </main>
  );
}
