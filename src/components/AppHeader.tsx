import { Link } from "@tanstack/react-router";
import { Concierge, NovaZenSymbol } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useContactEmail } from "@/components/DomainGate";
import { clearContactEmail } from "@/lib/access";

export function AppHeader() {
  const email = useContactEmail();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-3 items-center gap-4 px-4 py-3">
        <a
          href="https://www.nova-serenity.fr"
          className="flex items-center gap-3"
          aria-label="Nova Serenity – retour au site"
        >
          <Concierge className="h-8 w-auto sm:h-9" />
        </a>

        <a
          href="https://www.nova-serenity.fr"
          className="flex items-center justify-center"
          aria-label="NOVA ZEN – retour au site"
        >
          <NovaZenSymbol className="h-9 w-auto sm:h-10" />
          <span
            className="ml-1.5 text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: "#7EB8A2" }}
          >
            ZEN
          </span>
        </a>

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
          {email && (
            <Button
              variant="outline"
              size="sm"
              className="hidden max-w-52 truncate md:inline-flex"
              onClick={clearContactEmail}
              title="Changer d'adresse"
            >
              {email}
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
