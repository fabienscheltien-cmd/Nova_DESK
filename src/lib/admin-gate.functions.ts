import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db, getAdminSession, requireAdminCtx } from "./data.server";
import { isSuperAdmin } from "./super-admin";
import { passwordProblem } from "./password";
import { hashPassword, verifyPassword } from "./password-hash";

function matches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const isAdminUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAdminSession();
  const s = session.data;
  if (s.unlocked !== true || !s.role) return { unlocked: false as const };
  let siteName: string | null = null;
  if (s.role === "reception") {
    const sb = await db();
    const { data } = await sb
      .from("reception_accounts")
      .select("active, sites(name)")
      .eq("email", s.email ?? "")
      .maybeSingle();
    if (!data?.active) {
      await session.clear();
      return { unlocked: false as const };
    }
    siteName = (data.sites as { name: string } | null)?.name ?? null;
  }
  return { unlocked: true as const, role: s.role, email: s.email ?? "", siteName };
});

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => ({
    email: String(data?.email ?? "").trim().toLowerCase().slice(0, 255),
    password: String(data?.password ?? "").slice(0, 200),
  }))
  .handler(async ({ data }) => {
    const session = await getAdminSession();
    if (isSuperAdmin(data.email)) {
      const expected = process.env["SUPER_ADMIN_PASSWORD"];
      if (!expected || !matches(data.password, expected)) return { ok: false as const };
      await session.update({ unlocked: true, role: "super", email: data.email, siteId: undefined });
      return { ok: true as const };
    }
    const sb = await db();
    const { data: acc } = await sb
      .from("reception_accounts")
      .select("email, password, active, site_id")
      .eq("email", data.email)
      .maybeSingle();
    // Always compare to avoid revealing which e-mails exist.
    const ok = matches(data.password, acc?.password ?? "\u0000invalid") && !!acc?.active;
    if (!ok || !acc) return { ok: false as const };
    await session.update({ unlocked: true, role: "reception", email: acc.email, siteId: acc.site_id });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});

/** A signed-in reception changes its own password. */
export const changeOwnPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ current: z.string().max(200), next: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const ctx = await requireAdminCtx();
    if (ctx.role !== "reception") return { ok: false as const, error: "Le mot de passe Direction se change dans les secrets." };
    const problem = passwordProblem(data.next);
    if (problem) return { ok: false as const, error: problem };
    const { data: acc } = await ctx.sb.from("reception_accounts").select("password_hash").eq("email", ctx.email).single();
    if (!acc || !(await verifyPassword(data.current, acc.password_hash))) {
      return { ok: false as const, error: "Mot de passe actuel incorrect." };
    }
    await ctx.sb
      .from("reception_accounts")
      .update({ password_hash: await hashPassword(data.next), updated_at: new Date().toISOString() })
      .eq("email", ctx.email);
    return { ok: true as const };
  });

/** Public: checks a reset link. */
export const checkResetToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: acc } = await sb
      .from("reception_accounts")
      .select("email, reset_expires_at, active")
      .eq("reset_token", data.token)
      .maybeSingle();
    const valid = !!acc?.active && !!acc.reset_expires_at && new Date(acc.reset_expires_at).getTime() > Date.now();
    return valid ? { valid: true as const, email: acc!.email } : { valid: false as const };
  });

/** Public: sets a new password from a reset link (single use). */
export const resetWithToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(100), next: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const problem = passwordProblem(data.next);
    if (problem) return { ok: false as const, error: problem };
    const sb = await db();
    const { data: acc } = await sb
      .from("reception_accounts")
      .select("id, reset_expires_at, active")
      .eq("reset_token", data.token)
      .maybeSingle();
    if (!acc?.active || !acc.reset_expires_at || new Date(acc.reset_expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: "Lien expiré ou invalide." };
    }
    await sb
      .from("reception_accounts")
      .update({
        password_hash: await hashPassword(data.next),
        reset_token: null,
        reset_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", acc.id);
    return { ok: true as const };
  });
