import { Link, useNavigate } from "@tanstack/react-router";
import { Concierge } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function AppHeader() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Concierge />
          <span className="text-sm font-semibold tracking-[0.18em] uppercase">Conciergerie</span>
        </Link>

        <nav className="flex items-center gap-1">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/reserver">Réserver</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/reservations">Mes réservations</Link>
              </Button>
              {isAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin">Admin</Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={signOut}>
                Déconnexion
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Accéder à mon espace</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
