import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Constants } from "@/integrations/supabase/types";
import { isSuperAdmin } from "@/lib/super-admin";

// Toutes les opérations d'administration passent par ici : la base n'accepte plus
// d'écriture depuis le navigateur. Chaque appel exige un collaborateur connecté
// ET la session administrateur déverrouillée (mot de passe).

async function adminDb() {
  const [{ assertAdminUnlocked }, { supabaseAdmin }] = await Promise.all([
    import("./admin-session.server"),
    import("@/integrations/supabase/client.server"),
  ]);
  await assertAdminUnlocked();
  return supabaseAdmin;
}

function fail(message: string, error: { message: string } | null): never {
  if (error) console.error(`[admin] ${message}:`, error.message);
  throw new Error(message);
}

const idSchema = z.object({ id: z.string().uuid() });
const toggleSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

// ---------- Réservations ----------

export const adminListBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const db = await adminDb();
    const { data, error } = await db
      .from("bookings")
      .select("*, booking_items(*), booking_status_history(*)")
      .order("created_at", { ascending: false });
    if (error) fail("Chargement des réservations impossible.", error);
    return data;
  });

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(Constants.public.Enums.booking_status),
});

export const adminSetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof statusSchema>) => statusSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { data: b, error } = await db
      .from("bookings")
      .select("status, paid_at")
      .eq("id", data.id)
      .single();
    if (error || !b) fail("Réservation introuvable.", error);
    // Une demande retirée et payée se clôture automatiquement.
    const target = data.status === "delivered" && b.paid_at ? "termine" : data.status;
    const { error: upErr } = await db.from("bookings").update({ status: target }).eq("id", data.id);
    if (upErr) fail("Mise à jour impossible.", upErr);
    await db
      .from("booking_status_history")
      .insert({ booking_id: data.id, from_status: b.status, to_status: target });
    return { status: target, autoClosed: target === "termine" && data.status === "delivered" };
  });

export const adminTogglePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof idSchema>) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { data: b, error } = await db
      .from("bookings")
      .select("status, paid_at")
      .eq("id", data.id)
      .single();
    if (error || !b) fail("Réservation introuvable.", error);
    const paying = !b.paid_at;
    const closing = paying && b.status === "delivered";
    const { error: upErr } = await db
      .from("bookings")
      .update({
        paid_at: paying ? new Date().toISOString() : null,
        payment_method: paying ? "accueil" : null,
        ...(closing ? { status: "termine" as const } : {}),
      })
      .eq("id", data.id);
    if (upErr) fail("Paiement non enregistré.", upErr);
    if (closing) {
      await db
        .from("booking_status_history")
        .insert({ booking_id: data.id, from_status: b.status, to_status: "termine" });
    }
    return { paying, closed: closing };
  });

const replaceItemsSchema = z.object({
  id: z.string().uuid(),
  items: z
    .array(z.object({ service_id: z.string().uuid(), quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(50),
  note: z.string().trim().max(300).optional(),
});

export const adminReplaceBookingItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof replaceItemsSchema>) => replaceItemsSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    // Fonction SQL atomique : en cas d'erreur, les prestations d'origine sont conservées.
    const { error } = await db.rpc("admin_replace_booking_items", {
      _booking_id: data.id,
      _items: data.items,
      _note: data.note ?? "",
    });
    if (error) fail("Modification impossible.", error);
    return { ok: true as const };
  });

// ---------- Catalogue ----------

export const adminListCatalogue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const db = await adminDb();
    const [cats, svcs] = await Promise.all([
      db.from("service_categories").select("*").order("sort_order"),
      db.from("services").select("*").order("sort_order"),
    ]);
    if (cats.error) fail("Chargement du catalogue impossible.", cats.error);
    if (svcs.error) fail("Chargement du catalogue impossible.", svcs.error);
    return { categories: cats.data, services: svcs.data };
  });

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional(),
  pickup_info: z.string().trim().max(160).optional(),
});

export const adminCreateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof categorySchema>) => categorySchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const slug =
      data.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `cat-${Date.now()}`;
    const { count } = await db
      .from("service_categories")
      .select("id", { count: "exact", head: true });
    const { error } = await db.from("service_categories").insert({
      name: data.name,
      slug,
      description: data.description || null,
      pickup_info: data.pickup_info || null,
      sort_order: (count ?? 0) + 1,
    });
    return { ok: !error };
  });

const serviceSchema = z.object({
  category_id: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional(),
  price_cents: z.number().int().min(0).max(1_000_000),
  lead_time_hours: z.number().int().min(1).max(2000),
});

export const adminCreateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof serviceSchema>) => serviceSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { error } = await db
      .from("services")
      .insert({ ...data, description: data.description || null });
    return { ok: !error };
  });

export const adminSetServiceActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof toggleSchema>) => toggleSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { error } = await db.from("services").update({ active: data.active }).eq("id", data.id);
    return { ok: !error };
  });

export const adminDeleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof idSchema>) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { error } = await db.from("services").delete().eq("id", data.id);
    return { ok: !error };
  });

const pickupSchema = z.object({
  id: z.string().uuid(),
  pickup_info: z.string().trim().max(160),
});

export const adminUpdatePickup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof pickupSchema>) => pickupSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { error } = await db
      .from("service_categories")
      .update({ pickup_info: data.pickup_info || null })
      .eq("id", data.id);
    return { ok: !error };
  });

// ---------- Domaines autorisés ----------

export const adminListDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const db = await adminDb();
    const { data, error } = await db.from("allowed_domains").select("*").order("domain");
    if (error) fail("Chargement des domaines impossible.", error);
    return data;
  });

const domainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
  label: z.string().trim().max(80).optional(),
});

export const adminAddDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof domainSchema>) => domainSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { error } = await db
      .from("allowed_domains")
      .insert({ domain: data.domain, label: data.label || null });
    return { ok: !error };
  });

export const adminSetDomainActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof toggleSchema>) => toggleSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { error } = await db
      .from("allowed_domains")
      .update({ active: data.active })
      .eq("id", data.id);
    return { ok: !error };
  });

export const adminDeleteDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof idSchema>) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { error } = await db.from("allowed_domains").delete().eq("id", data.id);
    return { ok: !error };
  });

// ---------- Collaborateurs (comptes créés par lien magique) ----------

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const db = await adminDb();
    const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (error) fail("Chargement des collaborateurs impossible.", error);
    return data.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        banned: Boolean(u.banned_until && new Date(u.banned_until).getTime() > Date.now()),
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  });

const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email().max(255) });

export const adminInviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof inviteSchema>) => inviteSchema.parse(data))
  .handler(async ({ data }) => {
    await adminDb();
    const { sendLoginLink } = await import("./login-link.server");
    return sendLoginLink(data.email, "/reservations");
  });

const banSchema = z.object({ id: z.string().uuid(), banned: z.boolean() });

export const adminSetUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof banSchema>) => banSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { error } = await db.auth.admin.updateUserById(data.id, {
      ban_duration: data.banned ? "876000h" : "none",
    });
    return { ok: !error };
  });

// ---------- Super admin ----------

const statsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const superAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof statsSchema>) => statsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    if (!isSuperAdmin(context.claims.email as string | undefined)) {
      throw new Error("Accès réservé à la direction.");
    }
    const { data: rows, error } = await db
      .from("bookings")
      .select("*, booking_items(*, services(category_id, service_categories(name)))")
      .gte("created_at", `${data.from}T00:00:00`)
      .lte("created_at", `${data.to}T23:59:59`)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    if (error) fail("Chargement des statistiques impossible.", error);
    return rows;
  });
