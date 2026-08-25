export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
}

export function formatLeadTime(hours: number): string {
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "24 h" : `${days} jours`;
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  in_progress: "En cours",
  ready: "Prête",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export const SLOTS = ["08:00 – 10:00", "10:00 – 12:00", "14:00 – 16:00", "16:00 – 18:00"];
