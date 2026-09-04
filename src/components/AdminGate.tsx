import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAdminUnlocked, lockAdmin, unlockAdmin } from "@/lib/admin-gate.functions";

export function AdminLockButton() {
  const queryClient = useQueryClient();
  const lock = useServerFn(lockAdmin);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await lock();
        void queryClient.invalidateQueries({ queryKey: ["admin-unlocked"] });
      }}
    >
      Verrouiller
    </Button>
  );
}

export function AdminGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const unlock = useServerFn(unlockAdmin);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const status = useQuery({
    queryKey: ["admin-unlocked"],
    queryFn: () => isAdminUnlocked(),
  });

  if (status.isLoading) {
    return <main className="mx-auto max-w-md px-4 py-16 text-sm text-muted-foreground">Chargement…</main>;
  }

  if (status.data?.unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await unlock({ data: { password } });
    setBusy(false);
    if (!res.ok) {
      setError("Veuillez saisir une adresse e-mail.");
      return;
    }
    setPassword("");
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ["admin-unlocked"] });
  };

  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <Card className="panel border-border/70">
        <CardHeader>
          <CardTitle>Accès administrateur</CardTitle>
          <CardDescription>
            Mode test : la sécurité est désactivée, n'importe quelle adresse e-mail donne accès à l'espace
            administrateur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Adresse e-mail</Label>
              <Input
                id="admin-password"
                type="email"
                autoComplete="email"
                placeholder="prenom.nom@entreprise.fr"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || password.length === 0}>
              Accéder
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
