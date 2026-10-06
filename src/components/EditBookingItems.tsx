import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { adminReplaceBookingItems } from "@/lib/admin.functions";
import { formatPrice } from "@/lib/format";

// quantity reste une chaîne pendant la saisie pour pouvoir vider le champ.
type Item = { service_id: string; quantity: string };

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
  const replaceItems = useServerFn(adminReplaceBookingItems);

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
  const qtyOf = (r: Item) => Number.parseInt(r.quantity, 10) || 0;
  const total = rows.reduce(
    (sum, r) => sum + (byId.get(r.service_id)?.price_cents ?? 0) * qtyOf(r),
    0,
  );
  // Services proposés : actifs, plus ceux déjà présents sur la réservation.
  const current = new Set(items.map((i) => i.service_id));
  const choices = (services.data ?? []).filter((s) => s.active || current.has(s.id));

  const save = async () => {
    const valid = rows
      .map((r) => ({ service_id: r.service_id, quantity: qtyOf(r) }))
      .filter((r) => r.service_id && r.quantity > 0);
    if (!valid.length) {
      toast.error("Ajoutez au moins une prestation.");
      return;
    }
    if (valid.some((r) => r.quantity > 99)) {
      toast.error("Quantité maximale : 99.");
      return;
    }
    if (!agreed) {
      toast.error("Confirmez l'accord du client.");
      return;
    }
    setSaving(true);
    try {
      // Remplacement atomique côté base : rien n'est perdu en cas d'échec.
      await replaceItems({ data: { id: bookingId, items: valid, note: note.trim() } });
    } catch {
      toast.error("Modification impossible.");
      return;
    } finally {
      setSaving(false);
    }
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
          setRows(items.map((i) => ({ service_id: i.service_id, quantity: String(i.quantity) })));
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
            À utiliser si le collaborateur s'est trompé de service. La réservation sera marquée «
            Modifiée par l'accueil avec accord client ».
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
                  {choices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {formatPrice(s.price_cents)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                max={99}
                className="w-20"
                value={r.quantity}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === idx ? { ...x, quantity: e.target.value } : x)))
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
            onClick={() => setRows([...rows, { service_id: "", quantity: "1" }])}
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
          <Button onClick={save} disabled={saving || !agreed || !services.data}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
