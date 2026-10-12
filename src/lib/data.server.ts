import { useSession } from "@tanstack/react-start/server";

export type AdminSession = {
  unlocked?: boolean;
  role?: "super" | "reception";
  email?: string;
  siteId?: string;
};

export function adminSessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "novazen-admin-v2",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export async function getAdminSession() {
  return useSession<AdminSession>(adminSessionConfig());
}

export async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Returns the admin context; reception accounts are re-checked (still active) on every call. */
export async function requireAdminCtx() {
  const session = await getAdminSession();
  const s = session.data;
  if (s.unlocked !== true || !s.role || !s.email) throw new Error("Accès administrateur requis");
  const sb = await db();
  if (s.role === "reception") {
    const { data } = await sb
      .from("reception_accounts")
      .select("site_id, active")
      .eq("email", s.email)
      .maybeSingle();
    if (!data?.active) {
      await session.clear();
      throw new Error("Compte accueil désactivé");
    }
    return { sb, role: "reception" as const, email: s.email, siteId: data.site_id as string | null };
  }
  return { sb, role: "super" as const, email: s.email, siteId: null as string | null };
}

/** Any admin (super or reception). */
export async function requireAdmin() {
  return (await requireAdminCtx()).sb;
}

/** Super admin only. */
export async function requireSuper() {
  const ctx = await requireAdminCtx();
  if (ctx.role !== "super") throw new Error("Réservé au Super Admin");
  return ctx.sb;
}

/** Throws if a reception account tries to touch a booking outside its site. */
export async function requireBookingAccess(bookingId: string) {
  const ctx = await requireAdminCtx();
  if (ctx.role === "reception") {
    const { data } = await ctx.sb.from("bookings").select("site_id").eq("id", bookingId).maybeSingle();
    if (!data || data.site_id !== ctx.siteId) throw new Error("Réservation hors de votre site");
  }
  return ctx.sb;
}

/** Resolves a collaborator e-mail from a validated, unexpired verification token. */
export async function requireCollaborator(token: string) {
  const sb = await db();
  const { data } = await sb
    .from("email_verifications")
    .select("email, expires_at, verified_at")
    .eq("token", token)
    .maybeSingle();
  if (!data?.verified_at || !data.expires_at || new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("Accès collaborateur expiré");
  }
  return { sb, email: data.email.toLowerCase() };
}
