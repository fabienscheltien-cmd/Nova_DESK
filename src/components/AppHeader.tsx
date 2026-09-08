import { Link } from "@tanstack/react-router";
import { Concierge, NovaZenSymbol } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useContactEmail } from "@/components/DomainGate";
import { clearContactEmail } from "@/lib/access";

export function AppHeader() {
  const email = useContactEmail();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:grid-cols-3 sm:gap-4">
        <a
          href="https://www.nova-serenity.fr"
          className="flex min-w-0 items-center gap-2 sm:gap-3"
          aria-label="Nova CARE – retour au site"
        >
          <Concierge className="h-7 w-auto sm:h-9" />
          <span className="whitespace-nowrap text-lg font-bold tracking-tight sm:text-2xl">
            <span style={{ color: "#4A90D9" }}>Nova</span>{" "}
            <span style={{ color: "#7EB8A2" }}>CARE</span>
          </span>
        </a>

        <a
          href="https://www.nova-serenity.fr"
          className="flex items-center justify-self-end sm:justify-self-center"
          aria-label="NOVA ZEN SPACE – retour au site"
        >
          <NovaZenSymbol className="h-7 w-auto sm:h-10" />
          <span
            className="ml-1.5 text-xl font-bold tracking-tight sm:text-3xl"
            style={{ color: "#7EB8A2" }}
          >
            ZEN SPACE
          </span>
        </a>

        <nav className="col-span-2 flex flex-wrap items-center justify-center gap-1 sm:col-span-1 sm:justify-end">
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
              className="max-w-40 truncate sm:max-w-52"
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
