import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/format";

type Item = { id?: string; service_id: string; quantity: number };

export function EditBookingItems({
  bookingId,
  items,
  onSaved,
}: {
  bookingId: string;
  items: { service_id: string; quantity: number }[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Item[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const services = useQuery({
    queryKey: ["all-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price_cents, active")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const byId = new Map((services.data ?? []).map((s) => [s.id, s]));
  const total = rows.reduce(
    (sum, r) => sum + (byId.get(r.service_id)?.price_cents ?? 0) * r.quantity,
    0,
  );

  const save = async () => {
    const valid = rows.filter((r) => r.service_id && r.quantity > 0);
    if (!valid.length) { toast.error("Ajoutez au moins une prestation."); return; }
    if (!agreed) { toast.error("Confirmez l'accord du client."); return; }
    setSaving(true);
    const { error: delErr } = await supabase
      .from("booking_items")
      .delete()
      .eq("booking_id", bookingId);
    const { error: insErr } = delErr
      ? { error: delErr }
      : await supabase.from("booking_items").insert(
          valid.map((r) => {
            const s = byId.get(r.service_id)!;
            return {
              booking_id: bookingId,
              service_id: s.id,
              service_name: s.name,
              quantity: r.quantity,
              unit_price_cents: s.price_cents,
            };
          }),
        );
    const { error: bErr } = insErr
      ? { error: insErr }
      : await supabase
          .from("bookings")
          .update({
            total_cents: total,
            modified_by_reception_at: new Date().toISOString(),
            modification_note: note.trim() || null,
          })
          .eq("id", bookingId);
    setSaving(false);
    if (bErr) { toast.error("Modification impossible."); return; }
    toast.success("Prestations modifiées (accord client).");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setRows(items.map((i) => ({ service_id: i.service_id, quantity: i.quantity })));
          setAgreed(false);
          setNote("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="size-4" /> Modifier les prestations
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier les prestations</DialogTitle>
          <DialogDescription>
            À utiliser si le collaborateur s'est trompé de service. La réservation sera
            marquée « Modifiée par l'accueil avec accord client ».
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select
                value={r.service_id}
                onValueChange={(v) =>
                  setRows(rows.map((x, j) => (j === idx ? { ...x, service_id: v } : x)))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Prestation" />
                </SelectTrigger>
                <SelectContent>
                  {services.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {formatPrice(s.price_cents)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                className="w-20"
                value={r.quantity}
                onChange={(e) =>
                  setRows(
                    rows.map((x, j) =>
                      j === idx ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x,
                    ),
                  )
                }
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setRows(rows.filter((_, j) => j !== idx))}
                aria-label="Retirer"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRows([...rows, { service_id: "", quantity: 1 }])}
          >
            <Plus className="size-4" /> Ajouter une prestation
          </Button>
          <p className="text-right font-semibold tabular-nums">
            Nouveau total : {formatPrice(total)}
          </p>
          <div className="space-y-1">
            <Label htmlFor="mod-note">Motif (facultatif)</Label>
            <Input
              id="mod-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex. chemise et non pantalon"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
            Le client a donné son accord pour cette modification
          </label>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || !agreed}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
