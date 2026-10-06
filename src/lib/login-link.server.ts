import { getRequest } from "@tanstack/react-start/server";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LoginLinkResult = { ok: true } | { ok: false; reason: "domain" | "send" };

/** Chemin interne uniquement, pour éviter toute redirection vers un site tiers. */
function safePath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/reservations";
  return next;
}

export async function isAllowedDomain(email: string): Promise<boolean> {
  const domain = email.split("@")[1] ?? "";
  const { data } = await supabaseAdmin
    .from("allowed_domains")
    .select("id")
    .eq("domain", domain)
    .eq("active", true)
    .maybeSingle();
  return Boolean(data);
}

/** Envoie le lien de connexion par e-mail (Supabase Auth, lien magique). */
export async function sendLoginLink(email: string, next?: string): Promise<LoginLinkResult> {
  if (!(await isAllowedDomain(email))) return { ok: false, reason: "domain" };
  const origin = new URL(getRequest().url).origin;
  const { error } = await supabaseAdmin.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}${safePath(next)}`, shouldCreateUser: true },
  });
  if (error) {
    console.error("[login-link]", error.message);
    return { ok: false, reason: "send" };
  }
  return { ok: true };
}
