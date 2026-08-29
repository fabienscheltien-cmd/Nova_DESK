const STORAGE_KEY = "novazen.contact_email";

export const VALIDITY_MONTHS = 3;

type Access = { email: string; expiresAt: string };

function read(): Access | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Access;
    if (!parsed?.email || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    // ancienne valeur (simple chaîne) : on la considère comme expirée
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function getAccess(): Access | null {
  return read();
}

export function getContactEmail(): string | null {
  return read()?.email ?? null;
}

export function getAccessExpiry(): string | null {
  return read()?.expiresAt ?? null;
}

export function setContactEmail(email: string, expiresAt: string): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, expiresAt }));
  window.dispatchEvent(new Event("novazen-access"));
}

export function clearContactEmail(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("novazen-access"));
}

export function domainOf(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

export function expiryFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + VALIDITY_MONTHS);
  return d.toISOString();
}

export function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}
