import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPassword, isAdminUnlocked, lockAdmin, unlockAdmin } from "@/lib/admin-gate.functions";

export function useAdminStatus() {
  return useQuery({ queryKey: ["admin-unlocked"], queryFn: () => isAdminUnlocked() });
}

export function AdminLockButton() {
  const queryClient = useQueryClient();
  const lock = useServerFn(lockAdmin);
  const status = useAdminStatus();
  return (
    <>
      {status.data?.unlocked && status.data.role === "reception" && <ChangePasswordButton />}
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await lock();
          queryClient.clear();
        }}
      >
        Se déconnecter
      </Button>
    </>
  );
}

function ChangePasswordButton() {
  const change = useServerFn(changeOwnPassword);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await change({ data: { current, next } });
    if (!res.ok) return setError(res.error);
    toast.success("Mot de passe modifié");
    setOpen(false);
    setCurrent("");
    setNext("");
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Mon mot de passe</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changer mon mot de passe</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="cur-pw">Mot de passe actuel</Label>
            <Input id="cur-pw" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pw">Nouveau mot de passe</Label>
            <Input id="new-pw" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
            <p className="text-xs text-muted-foreground">8 caractères minimum, avec majuscule, minuscule et chiffre.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">Enregistrer</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const unlock = useServerFn(unlockAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const status = useAdminStatus();

  if (status.isLoading) {
    return <main className="mx-auto max-w-md px-4 py-16 text-sm text-muted-foreground">Chargement…</main>;
  }
  if (status.data?.unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await unlock({ data: { email, password } });
    setBusy(false);
    if (!res.ok) return setError("E-mail ou mot de passe incorrect.");
    setPassword("");
    setError(null);
    void queryClient.invalidateQueries();
  };

  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <Card className="panel border-border/70">
        <CardHeader>
          <CardTitle>Accès administrateur</CardTitle>
          <CardDescription>
            Réservé aux accueils et à la direction. Saisissez l'e-mail de votre accueil et votre mot de passe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="admin-email">E-mail</Label>
              <Input id="admin-email" type="email" autoComplete="username" value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Mot de passe</Label>
              <Input id="admin-password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || !email || !password}>
              Se connecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
