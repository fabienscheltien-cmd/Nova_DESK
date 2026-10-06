export const SUPER_ADMINS = ["aurelie.godin@nova-serenity.fr", "fabien.scheltien@nova-serenity.fr"];

export function isSuperAdmin(email: string | null | undefined): boolean {
  return !!email && SUPER_ADMINS.includes(email.trim().toLowerCase());
}
