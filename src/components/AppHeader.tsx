import { Link } from "@tanstack/react-router";
import { Concierge } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Concierge />
          <span className="text-sm font-semibold tracking-[0.18em] uppercase">Conciergerie</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link to="/reserver">Réserver</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/reservations">Réservations</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">Admin</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
