import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export function AccessGate({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { loading, user, isAllowed, isAdmin } = useAuth();

  if (loading) {
    return <p className="px-4 py-16 text-center text-sm text-muted-foreground">Chargement…</p>;
  }

  const denied = !user || (adminOnly ? !isAdmin : !isAllowed);
  if (denied) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card className="panel border-border/70">
          <CardHeader>
            <CardTitle>Accès non autorisé</CardTitle>
            <CardDescription>
              {adminOnly
                ? "Cet espace est réservé aux administrateurs de la conciergerie."
                : `L'adresse ${user?.email ?? ""} n'appartient pas à un domaine autorisé. Contactez votre administrateur pour être ajouté.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
