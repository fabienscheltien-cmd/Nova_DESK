import { Link } from "@tanstack/react-router";
import { Concierge } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-3 items-center gap-4 px-4 py-3">
        <a
          href="https://novaserenityconciergerie.lovable.app"
          className="flex items-center gap-3"
          aria-label="Nova Serenity – retour au site"
        >
          <Concierge className="h-8 w-auto" />
          <span className="hidden text-[0.7rem] font-semibold tracking-[0.24em] text-muted-foreground uppercase sm:inline">
            Conciergerie
          </span>
        </a>

        <div className="flex items-center justify-center">
          <span
            className="text-xl font-bold tracking-tight sm:text-2xl"
            style={{ color: "#4A90D9" }}
          >
            NOVA
          </span>
          <span
            className="ml-1 text-xl font-light tracking-tight sm:text-2xl"
            style={{ color: "#7EB8A2" }}
          >
            Zen
          </span>
        </div>

        <nav className="flex items-center justify-end gap-1">
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
