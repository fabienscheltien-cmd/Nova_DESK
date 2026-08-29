import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  domainOf,
  expiryFromNow,
  formatExpiry,
  getContactEmail,
  setContactEmail,
  VALIDITY_MONTHS,
} from "@/lib/access";

const emailSchema = z.string().trim().email("Adresse e-mail invalide");

export function useContactEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setEmail(getContactEmail());
    sync();
    window.addEventListener("novazen-access", sync);
    return () => window.removeEventListener("novazen-access", sync);
  }, []);
  return email;
}

export function DomainGate({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const email = useContactEmail();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  const domains = useQuery({
    queryKey: ["allowed-domains"],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("allowed_domains")
        .select("domain,label")
        .eq("active", true);
      if (err) throw err;
      return data;
    },
  });

  if (!hydrated) return null;
  if (email) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Adresse invalide");
      return;
    }
    const address = parsed.data.toLowerCase();
    const list = (domains.data ?? []).map((d) => d.domain.toLowerCase());
    if (!list.includes(domainOf(address))) {
      setError("Ce domaine n'est pas autorisé. Utilisez votre e-mail professionnel.");
      return;
    }

    setBusy(true);
    setError(null);

    // Adresse déjà validée et encore dans sa période de validité ?
    const { data: existing } = await supabase
      .from("email_verifications")
      .select("email,expires_at")
      .eq("email", address)
      .not("verified_at", "is", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.expires_at) {
      setBusy(false);
      setContactEmail(address, existing.expires_at);
      return;
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const { error: insErr } = await supabase.from("email_verifications").insert({
      email: address,
      token,
      expires_at: expiryFromNow(),
    });
    setBusy(false);

    if (insErr) {
      setError("Impossible de générer le lien de validation. Réessayez.");
      return;
    }
    setLink(`${window.location.origin}/verifier/${token}`);
  };

  if (link) {
    return (
      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <Card className="panel border-border/70">
          <CardHeader>
            <CardTitle>Validez votre adresse</CardTitle>
            <CardDescription>
              Un e-mail de validation a été généré pour {value.trim().toLowerCase()}. Cliquez sur le
              lien ci-dessous pour confirmer que cette adresse est bien la vôtre.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border/70 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Lien de validation (simulation d'e-mail)</p>
              <a
                href={link}
                className="mt-1 block break-all text-sm font-medium text-primary underline"
              >
                {link}
              </a>
            </div>
            <Button asChild className="w-full">
              <a href={link}>Valider mon adresse</a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Une fois validée, votre adresse reste enregistrée {VALIDITY_MONTHS} mois (jusqu'au{" "}
              {formatExpiry(expiryFromNow())}).
            </p>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setLink(null);
                setValue("");
              }}
            >
              Utiliser une autre adresse
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <Card className="panel border-border/70">
        <CardHeader>
          <CardTitle>Identification</CardTitle>
          <CardDescription>
            Entrez votre e-mail professionnel : un lien de validation vous sera généré pour
            confirmer votre adresse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail professionnel</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="prenom.nom@entreprise.fr"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Génération du lien…" : "Recevoir le lien de validation"}
            </Button>
            {domains.data && domains.data.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Domaines autorisés : {domains.data.map((d) => d.domain).join(", ")}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

