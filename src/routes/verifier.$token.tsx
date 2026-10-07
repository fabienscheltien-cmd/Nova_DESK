import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyAccess } from "@/lib/data.functions";
import { formatExpiry, setContactEmail, VALIDITY_MONTHS } from "@/lib/access";

export const Route = createFileRoute("/verifier/$token")({
  head: () => ({
    meta: [
      { title: "Validation de l'adresse e-mail – Nova Zen" },
      {
        name: "description",
        content:
          "Confirmez votre adresse e-mail professionnelle pour accéder au service de conciergerie Nova Zen.",
      },
      { property: "og:title", content: "Validation de l'adresse e-mail – Nova Zen" },
      {
        property: "og:description",
        content: "Confirmation de l'adresse e-mail professionnelle du collaborateur.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [email, setEmail] = useState("");
  const [expiry, setExpiry] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const res = await verifyAccess({ data: { token } }).catch(() => null);
      if (cancelled) return;
      if (!res || !res.ok) {
        setState("error");
        return;
      }
      const data = { email: res.email };
      const expiresAt = res.expiresAt;
      setEmail(data.email);
      setExpiry(expiresAt);
      setContactEmail(data.email, expiresAt, token);
      setState("ok");
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <Card className="panel border-border/70">
          <CardHeader>
            <CardTitle>
              {state === "loading" && "Validation en cours…"}
              {state === "ok" && "Adresse validée"}
              {state === "error" && "Lien invalide"}
            </CardTitle>
            <CardDescription>
              {state === "loading" && "Nous vérifions votre lien de confirmation."}
              {state === "ok" &&
                `${email} est confirmée pour ${VALIDITY_MONTHS} mois, jusqu'au ${formatExpiry(expiry)}.`}
              {state === "error" &&
                "Ce lien de validation est inconnu ou expiré. Recommencez l'identification."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to={state === "ok" ? "/reserver" : "/"}>
                {state === "ok" ? "Accéder à la réservation" : "Retour à l'accueil"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
