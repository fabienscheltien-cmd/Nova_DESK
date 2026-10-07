import { useSession } from "@tanstack/react-start/server";

type AdminSession = { unlocked?: boolean };

export function adminSessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "novazen-admin",
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

/** Throws unless the request carries an unlocked admin session cookie. */
export async function requireAdmin() {
  const session = await getAdminSession();
  if (session.data.unlocked !== true) throw new Error("Accès administrateur requis");
  return db();
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
