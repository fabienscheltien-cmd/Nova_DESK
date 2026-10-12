import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkResetToken, resetWithToken } from "@/lib/admin-gate.functions";

export const Route = createFileRoute("/reinitialiser/$token")({
  head: () => ({
    meta: [
      { title: "Définir mon mot de passe – NOVA DESK" },
      { name: "description", content: "Définissez le mot de passe de votre compte accueil NOVA DESK." },
      { property: "og:title", content: "Définir mon mot de passe – NOVA DESK" },
      { property: "og:description", content: "Réinitialisation du mot de passe d'un accueil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const { token } = Route.useParams();
  const check = useQuery({ queryKey: ["reset", token], queryFn: () => checkResetToken({ data: { token } }) });
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await resetWithToken({ data: { token, next: pw } });
    if (!res.ok) return setError(res.error);
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <Card className="panel border-border/70">
          <CardHeader>
            <CardTitle>Définir mon mot de passe</CardTitle>
            {check.data?.valid && <CardDescription>Compte : {check.data.email}</CardDescription>}
          </CardHeader>
          <CardContent>
            {check.isLoading ? (
              <p className="text-sm text-muted-foreground">Vérification…</p>
            ) : done ? (
              <div className="space-y-4">
                <p className="text-sm">Mot de passe enregistré. Vous pouvez vous connecter.</p>
                <Button asChild className="w-full"><Link to="/admin">Aller à l'administration</Link></Button>
              </div>
            ) : !check.data?.valid ? (
              <p className="text-sm text-destructive">Ce lien est expiré ou invalide. Demandez-en un nouveau à la direction.</p>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="pw">Nouveau mot de passe</Label>
                  <Input id="pw" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setError(null); }} />
                  <p className="text-xs text-muted-foreground">8 caractères minimum, avec majuscule, minuscule et chiffre.</p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={!pw}>Enregistrer</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
