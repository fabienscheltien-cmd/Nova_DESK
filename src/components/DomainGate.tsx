import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { domainOf, getContactEmail, setContactEmail } from "@/lib/access";

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Adresse invalide");
      return;
    }
    const list = (domains.data ?? []).map((d) => d.domain.toLowerCase());
    if (!list.includes(domainOf(parsed.data))) {
      setError("Ce domaine n'est pas autorisé. Utilisez votre e-mail professionnel.");
      return;
    }
    setContactEmail(parsed.data.toLowerCase());
  };

  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <Card className="panel border-border/70">
        <CardHeader>
          <CardTitle>Identification</CardTitle>
          <CardDescription>
            Entrez votre e-mail professionnel pour accéder au service de conciergerie.
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
            <Button type="submit" className="w-full">
              Accéder
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
