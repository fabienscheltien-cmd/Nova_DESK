const STORAGE_KEY = "novazen.contact_email";

export function getContactEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setContactEmail(email: string): void {
  window.localStorage.setItem(STORAGE_KEY, email);
  window.dispatchEvent(new Event("novazen-access"));
}

export function clearContactEmail(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("novazen-access"));
}

export function domainOf(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}
