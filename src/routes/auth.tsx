import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion – Conciergerie d'entreprise" },
      {
        name: "description",
        content:
          "Connectez-vous avec votre adresse e-mail professionnelle pour réserver vos prestations de conciergerie.",
      },
      { property: "og:title", content: "Connexion – Conciergerie d'entreprise" },
      {
        property: "og:description",
        content: "Espace collaborateurs de la conciergerie d'entreprise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide").max(255),
  password: z.string().min(8, "8 caractères minimum").max(72),
  fullName: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/reserver" });
  }, [loading, user, navigate]);

  const validate = (withName: boolean) => {
    const parsed = credentialsSchema.safeParse({
      email,
      password,
      fullName: withName ? fullName : undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Champs invalides");
      return null;
    }
    return parsed.data;
  };

  const signIn = async () => {
    const data = validate(false);
    if (!data) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    setBusy(false);
    if (error) {
      toast.error("Connexion impossible : identifiants incorrects.");
      return;
    }
    void navigate({ to: "/reserver" });
  };

  const signUp = async () => {
    const data = validate(true);
    if (!data) return;
    setBusy(true);
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: data.fullName ?? "" },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!result.session) {
      setPendingConfirm(true);
      toast.success("Compte créé. Confirmez votre e-mail pour continuer.");
      return;
    }
    void navigate({ to: "/reserver" });
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Connexion Google indisponible pour le moment.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/reserver" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-14">
        <Card className="panel border-border/70">
          <CardHeader>
            <CardTitle>Espace collaborateurs</CardTitle>
            <CardDescription>
              Utilisez votre adresse e-mail professionnelle. Seuls les domaines autorisés par votre
              entreprise donnent accès aux réservations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingConfirm ? (
              <p className="text-sm text-muted-foreground">
                Un e-mail de confirmation vient de vous être envoyé à <strong>{email}</strong>.
                Cliquez sur le lien pour activer votre accès.
              </p>
            ) : (
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Connexion</TabsTrigger>
                  <TabsTrigger value="signup">Créer un compte</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail professionnel</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="prenom.nom@entreprise.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" disabled={busy} onClick={signIn}>
                    Se connecter
                  </Button>
                </TabsContent>

                <TabsContent value="signup" className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom complet</Label>
                    <Input
                      id="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Camille Durand"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-up">E-mail professionnel</Label>
                    <Input
                      id="email-up"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="prenom.nom@entreprise.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-up">Mot de passe</Label>
                    <Input
                      id="password-up"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" disabled={busy} onClick={signUp}>
                    Créer mon compte
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" disabled={busy} onClick={signInWithGoogle}>
              Continuer avec Google
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
