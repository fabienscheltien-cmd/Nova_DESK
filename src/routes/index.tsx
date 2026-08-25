import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ShieldCheck, Sparkles } from "lucide-react";

import heroImage from "@/assets/hero-conciergerie.jpg";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Conciergerie d'entreprise – réservation en ligne" },
      {
        name: "description",
        content:
          "Réservez pressing, cordonnerie, retouches et gestion de colis sur votre lieu de travail. Tarifs et délais affichés, accès réservé aux collaborateurs.",
      },
      { property: "og:title", content: "Conciergerie d'entreprise – réservation en ligne" },
      {
        property: "og:description",
        content:
          "Pressing, cordonnerie, retouches et colis : tarifs, délais et réservation en quelques clics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "Quatre univers de services",
    text: "Pressing, cordonnerie, retouches, colis et courses de proximité.",
  },
  {
    icon: Clock,
    title: "Tarifs et délais transparents",
    text: "Chaque prestation affiche son prix et son délai avant validation.",
  },
  {
    icon: ShieldCheck,
    title: "Accès collaborateurs",
    text: "Réservé aux adresses e-mail des domaines autorisés par votre entreprise.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <main>
        <section className="relative overflow-hidden">
          <img
            src={heroImage}
            alt="Comptoir de conciergerie d'entreprise avec chemises repassées"
            width={1600}
            height={1008}
            className="absolute inset-0 size-full object-cover opacity-45"
          />
          <div className="surface-veil absolute inset-0" />
          <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
            <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
              Services aux collaborateurs
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl leading-tight font-semibold sm:text-5xl">
              Déposez une chemise en 30 secondes, sans quitter le bureau.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Choisissez vos prestations, visualisez le prix et le délai, puis réservez un créneau
              de dépôt. Votre conciergerie s'occupe du reste.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Réserver une prestation</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/reservations">Suivre mes dépôts</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <Card key={title} className="panel border-border/70 bg-card">
                <CardHeader className="pb-2">
                  <Icon className="size-5 text-primary" />
                  <CardTitle className="mt-3 text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{text}</CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 py-8">
        <p className="mx-auto max-w-6xl px-4 text-xs text-muted-foreground">
          Accès réservé aux collaborateurs disposant d'une adresse e-mail autorisée.
        </p>
      </footer>
    </div>
  );
}
