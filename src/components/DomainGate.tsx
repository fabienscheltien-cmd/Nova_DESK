import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MailCheck } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { requestLoginLink } from "@/lib/auth.functions";

const emailSchema = z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(255);

type AuthState = { ready: boolean; email: string | null };

/** Session Supabase du collaborateur (ouverte par le lien magique reçu par e-mail). */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ ready: false, email: null });
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ ready: true, email: data.session?.user.email ?? null });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ ready: true, email: session?.user.email ?? null });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return state;
}

export function useContactEmail(): string | null {
  return useAuth().email;
}

/** Erreur renvoyée par Supabase dans l'URL quand le lien est expiré ou déjà utilisé. */
function linkErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (!params.get("error") && !params.get("error_code")) return null;
  return "Ce lien de connexion est expiré ou a déjà été utilisé. Demandez-en un nouveau.";
}

export function DomainGate({ children }: { children: ReactNode }) {
  const { ready, email } = useAuth();
  const sendLink = useServerFn(requestLoginLink);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => setError(linkErrorFromUrl()), []);

  if (!ready) return null;
  if (email) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Adresse invalide");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await sendLink({
        data: { email: parsed.data, next: window.location.pathname },
      });
      if (res.ok) {
        setSentTo(parsed.data);
      } else if (res.reason === "domain") {
        setError("Ce domaine n'est pas autorisé. Utilisez votre e-mail professionnel.");
      } else {
        setError("L'e-mail n'a pas pu être envoyé. Réessayez dans quelques minutes.");
      }
    } catch {
      setError("L'e-mail n'a pas pu être envoyé. Réessayez dans quelques minutes.");
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <Card className="panel border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailCheck className="size-5" /> Vérifiez votre boîte mail
            </CardTitle>
            <CardDescription>
              Un lien de connexion vient d'être envoyé à <strong>{sentTo}</strong>. Cliquez dessus
              pour accéder à votre espace. Pensez à regarder dans les indésirables.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setSentTo(null);
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
            Entrez votre e-mail professionnel : vous recevrez un lien de connexion pour accéder à
            votre espace.
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
              {busy ? "Envoi du lien…" : "Recevoir mon lien de connexion"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
