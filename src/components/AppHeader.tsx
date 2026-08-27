import { Concierge } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
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

        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <a href="https://novaserenityconciergerie.lovable.app/reserver">Réserver</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="https://novaserenityconciergerie.lovable.app/reservations">Réservations</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="https://novaserenityconciergerie.lovable.app/admin">Admin</a>
          </Button>
        </nav>
      </div>
    </header>
  );
}
