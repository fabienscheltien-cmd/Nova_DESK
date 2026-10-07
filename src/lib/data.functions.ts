import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db, requireAdmin, requireCollaborator } from "./data.server";

const THREE_MONTHS_MS = 1000 * 60 * 60 * 24 * 91;
const uuid = z.string().uuid();
const token = z.string().min(10).max(100);
const STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
  "termine",
] as const;

const cleanDomain = (d: string) => d.replace(/^@/, "").toLowerCase();

/* ---------------------------- Public ---------------------------- */

export const getActiveDomains = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await db();
  const { data, error } = await sb.from("allowed_domains").select("domain,label").eq("active", true);
  if (error) throw new Error("Lecture impossible");
  return data;
});

async function siteContext(sb: Awaited<ReturnType<typeof db>>, email: string | null | undefined) {
  const domain = (email ?? "").split("@")[1]?.toLowerCase() ?? "";
  const { data: doms } = await sb.from("allowed_domains").select("id, domain, site_id").eq("active", true);
  const dom = doms?.find((d) => cleanDomain(d.domain) === domain) ?? null;
  let site: { id: string; name: string } | null = null;
  if (dom?.site_id) {
    const { data: s } = await sb.from("sites").select("id, name, active").eq("id", dom.site_id).maybeSingle();
    if (s?.active) site = { id: s.id, name: s.name };
  }
  const siteServices = site
    ? ((await sb.from("site_services").select("service_id, active, price_cents").eq("site_id", site.id)).data ?? [])
    : [];
  return { dom, site, siteServices };
}

/** Applies a site's per-service activation and price overrides to the base catalogue. */
export function applySiteOverrides<T extends { id: string; price_cents: number }>(
  services: T[],
  overrides: { service_id: string; active: boolean; price_cents: number | null }[],
): T[] {
  const map = new Map(overrides.map((o) => [o.service_id, o]));
  return services
    .filter((s) => map.get(s.id)?.active !== false)
    .map((s) => {
      const p = map.get(s.id)?.price_cents;
      return p == null ? s : { ...s, price_cents: p };
    });
}

export const getCatalogue = createServerFn({ method: "POST" })
  .inputValidator((d: { email?: string | null }) =>
    z.object({ email: z.string().max(255).nullish() }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await db();
    const [cats, svcs, ctx] = await Promise.all([
      sb.from("service_categories").select("*").order("sort_order"),
      sb.from("services").select("*").eq("active", true).order("sort_order"),
      siteContext(sb, data.email),
    ]);
    if (cats.error || svcs.error) throw new Error("Lecture impossible");
    const [domSched, siteSched] = await Promise.all([
      ctx.dom
        ? sb.from("domain_pickup_schedules").select("category_id, pickup_info").eq("domain_id", ctx.dom.id)
        : Promise.resolve({ data: [] as { category_id: string; pickup_info: string | null }[] }),
      ctx.site
        ? sb.from("site_pickup_schedules").select("category_id, pickup_info").eq("site_id", ctx.site.id)
        : Promise.resolve({ data: [] as { category_id: string; pickup_info: string | null }[] }),
    ]);
    const categories = cats.data.map((c) => ({
      ...c,
      pickup_info:
        siteSched.data?.find((o) => o.category_id === c.id)?.pickup_info?.trim() ||
        domSched.data?.find((o) => o.category_id === c.id)?.pickup_info?.trim() ||
        c.pickup_info,
    }));
    return { categories, services: applySiteOverrides(svcs.data, ctx.siteServices), site: ctx.site };
  });

export const requestAccess = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) =>
    z.object({ email: z.string().trim().toLowerCase().email().max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await db();
    const domain = data.email.split("@")[1] ?? "";
    const { data: doms } = await sb.from("allowed_domains").select("domain").eq("active", true);
    if (!(doms ?? []).some((d) => cleanDomain(d.domain) === domain)) {
      return { status: "denied" as const };
    }
    const { data: existing } = await sb
      .from("email_verifications")
      .select("token, expires_at")
      .eq("email", data.email)
      .not("verified_at", "is", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.expires_at) {
      return {
        status: "granted" as const,
        email: data.email,
        expiresAt: existing.expires_at,
        token: existing.token,
      };
    }
    const t = crypto.randomUUID().replace(/-/g, "");
    const { error } = await sb.from("email_verifications").insert({
      email: data.email,
      token: t,
      expires_at: new Date(Date.now() + THREE_MONTHS_MS).toISOString(),
    });
    if (error) throw new Error("Lien impossible");
    return { status: "link" as const, token: t };
  });

export const verifyAccess = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: row } = await sb
      .from("email_verifications")
      .select("id,email,verified_at,expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return { ok: false as const, reason: "invalid" as const };
    if (row.verified_at && row.expires_at && new Date(row.expires_at).getTime() > Date.now()) {
      return { ok: true as const, email: row.email, expiresAt: row.expires_at };
    }
    if (row.verified_at) return { ok: false as const, reason: "expired" as const };
    const expiresAt = new Date(Date.now() + THREE_MONTHS_MS).toISOString();
    const { error } = await sb
      .from("email_verifications")
      .update({ verified_at: new Date().toISOString(), expires_at: expiresAt })
      .eq("id", row.id);
    if (error) return { ok: false as const, reason: "error" as const };
    return { ok: true as const, email: row.email, expiresAt };
  });

/* -------------------------- Collaborator ------------------------- */

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token,
        dropoff_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dropoff_slot: z.string().min(1).max(50),
        notes: z.string().trim().max(1000).nullish(),
        items: z
          .array(z.object({ service_id: uuid, quantity: z.number().int().min(1).max(99) }))
          .min(1)
          .max(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, email } = await requireCollaborator(data.token);
    const { data: svcs } = await sb
      .from("services")
      .select("id,name,price_cents")
      .eq("active", true)
      .in(
        "id",
        data.items.map((i) => i.service_id),
      );
    const ctx = await siteContext(sb, email);
    const byId = new Map(applySiteOverrides(svcs ?? [], ctx.siteServices).map((s) => [s.id, s]));
    if (data.items.some((i) => !byId.has(i.service_id))) throw new Error("Prestation invalide");
    const total = data.items.reduce((s, i) => s + byId.get(i.service_id)!.price_cents * i.quantity, 0);
    const { data: booking, error } = await sb
      .from("bookings")
      .insert({
        dropoff_date: data.dropoff_date,
        dropoff_slot: data.dropoff_slot,
        notes: data.notes || null,
        total_cents: total,
        contact_email: email,
        site_id: ctx.site?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !booking) throw new Error("Réservation impossible");
    const { error: e2 } = await sb.from("booking_items").insert(
      data.items.map((i) => {
        const s = byId.get(i.service_id)!;
        return {
          booking_id: booking.id,
          service_id: s.id,
          service_name: s.name,
          quantity: i.quantity,
          unit_price_cents: s.price_cents,
        };
      }),
    );
    if (e2) throw new Error("Prestations non enregistrées");
    return { id: booking.id };
  });

export const listMyBookings = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token }).parse(d))
  .handler(async ({ data }) => {
    const { sb, email } = await requireCollaborator(data.token);
    const { data: rows, error } = await sb
      .from("bookings")
      .select("*, booking_items(*)")
      .eq("contact_email", email)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Lecture impossible");
    return rows;
  });

export const getMyBooking = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => z.object({ token, id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { sb, email } = await requireCollaborator(data.token);
    const { data: row } = await sb
      .from("bookings")
      .select("*, booking_items(*)")
      .eq("id", data.id)
      .eq("contact_email", email)
      .maybeSingle();
    if (!row) throw new Error("Réservation introuvable");
    return row;
  });

export const cancelMyBooking = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => z.object({ token, id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { sb, email } = await requireCollaborator(data.token);
    const { error } = await sb
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("contact_email", email)
      .eq("status", "pending");
    if (error) throw new Error("Annulation impossible");
    return { ok: true };
  });

export const payMyBooking = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => z.object({ token, id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { sb, email } = await requireCollaborator(data.token);
    const { data: b } = await sb
      .from("bookings")
      .select("status, paid_at")
      .eq("id", data.id)
      .eq("contact_email", email)
      .maybeSingle();
    if (!b) throw new Error("Réservation introuvable");
    if (b.paid_at) return { ok: true };
    const { error } = await sb
      .from("bookings")
      .update({
        status: b.status === "delivered" ? "termine" : b.status,
        paid_at: new Date().toISOString(),
        payment_method: "en_ligne",
      })
      .eq("id", data.id);
    if (error) throw new Error("Paiement impossible");
    return { ok: true };
  });

/* ----------------------------- Admin ----------------------------- */

export const adminListBookings = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await requireAdmin();
  const { data, error } = await sb
    .from("bookings")
    .select("*, booking_items(*), booking_status_history(*)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Lecture impossible");
  return data;
});

export const adminSetStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: uuid, status: z.enum(STATUSES) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { data: b } = await sb.from("bookings").select("status, paid_at").eq("id", data.id).single();
    if (!b) throw new Error("Introuvable");
    const target = data.status === "delivered" && b.paid_at ? "termine" : data.status;
    const { error } = await sb.from("bookings").update({ status: target }).eq("id", data.id);
    if (error) throw new Error("Mise à jour impossible");
    await sb
      .from("booking_status_history")
      .insert({ booking_id: data.id, from_status: b.status, to_status: target });
    return { target };
  });

export const adminTogglePayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { data: b } = await sb.from("bookings").select("status, paid_at").eq("id", data.id).single();
    if (!b) throw new Error("Introuvable");
    const paying = !b.paid_at;
    const closing = paying && b.status === "delivered";
    const { error } = await sb
      .from("bookings")
      .update({
        paid_at: paying ? new Date().toISOString() : null,
        payment_method: paying ? "accueil" : null,
        ...(closing ? { status: "termine" as const } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error("Paiement non enregistré");
    if (closing) {
      await sb
        .from("booking_status_history")
        .insert({ booking_id: data.id, from_status: b.status, to_status: "termine" });
    }
    return { paying, closed: closing };
  });

export const adminEditItems = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: uuid,
        note: z.string().trim().max(300).nullish(),
        items: z
          .array(z.object({ service_id: uuid, quantity: z.number().int().min(1).max(99) }))
          .min(1)
          .max(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { data: svcs } = await sb
      .from("services")
      .select("id,name,price_cents")
      .in(
        "id",
        data.items.map((i) => i.service_id),
      );
    const ctx = await siteContext(sb, email);
    const byId = new Map(applySiteOverrides(svcs ?? [], ctx.siteServices).map((s) => [s.id, s]));
    if (data.items.some((i) => !byId.has(i.service_id))) throw new Error("Prestation invalide");
    const total = data.items.reduce((s, i) => s + byId.get(i.service_id)!.price_cents * i.quantity, 0);
    const { error: e1 } = await sb.from("booking_items").delete().eq("booking_id", data.id);
    if (e1) throw new Error("Modification impossible");
    const { error: e2 } = await sb.from("booking_items").insert(
      data.items.map((i) => {
        const s = byId.get(i.service_id)!;
        return {
          booking_id: data.id,
          service_id: s.id,
          service_name: s.name,
          quantity: i.quantity,
          unit_price_cents: s.price_cents,
        };
      }),
    );
    if (e2) throw new Error("Modification impossible");
    const { error: e3 } = await sb
      .from("bookings")
      .update({
        total_cents: total,
        modified_by_reception_at: new Date().toISOString(),
        modification_note: data.note || null,
      })
      .eq("id", data.id);
    if (e3) throw new Error("Modification impossible");
    return { total };
  });

export const adminCatalogue = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await requireAdmin();
  const [cats, svcs] = await Promise.all([
    sb.from("service_categories").select("*").order("sort_order"),
    sb.from("services").select("*").order("sort_order"),
  ]);
  if (cats.error || svcs.error) throw new Error("Lecture impossible");
  return { categories: cats.data, services: svcs.data };
});

export const adminCreateCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(80),
        slug: z.string().trim().min(1).max(80),
        description: z.string().trim().max(500).nullish(),
        pickup_info: z.string().trim().max(160).nullish(),
        sort_order: z.number().int().min(0).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { error } = await sb.from("service_categories").insert({
      ...data,
      description: data.description || null,
      pickup_info: data.pickup_info || null,
    });
    if (error) throw new Error("Création impossible");
    return { ok: true };
  });

export const adminCreateService = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        category_id: uuid,
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(500).nullish(),
        price_cents: z.number().int().min(0).max(1_000_000),
        lead_time_hours: z.number().int().min(0).max(24 * 60),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { error } = await sb
      .from("services")
      .insert({ ...data, description: data.description || null });
    if (error) throw new Error("Ajout impossible");
    return { ok: true };
  });

export const adminSetServiceActive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, active: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    await sb.from("services").update({ active: data.active }).eq("id", data.id);
    return { ok: true };
  });

export const adminDeleteService = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { error } = await sb.from("services").delete().eq("id", data.id);
    return { ok: !error };
  });

export const adminListDomains = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await requireAdmin();
  const { data, error } = await sb.from("allowed_domains").select("*").order("domain");
  if (error) throw new Error("Lecture impossible");
  return data;
});

export const adminAddDomain = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        domain: z.string().trim().toLowerCase().min(3).max(120),
        label: z.string().trim().max(120).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { error } = await sb
      .from("allowed_domains")
      .insert({ domain: data.domain, label: data.label || null });
    return { ok: !error };
  });

export const adminSetDomainActive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, active: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    await sb.from("allowed_domains").update({ active: data.active }).eq("id", data.id);
    return { ok: true };
  });

export const adminDeleteDomain = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    await sb.from("allowed_domains").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminListVerifications = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await requireAdmin();
  const { data, error } = await sb
    .from("email_verifications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Lecture impossible");
  return data;
});

export const adminInvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().trim().toLowerCase().email().max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const t = crypto.randomUUID().replace(/-/g, "");
    const { error } = await sb.from("email_verifications").insert({
      email: data.email,
      token: t,
      expires_at: new Date(Date.now() + THREE_MONTHS_MS).toISOString(),
    });
    if (error) throw new Error("Invitation impossible");
    return { token: t };
  });

export const adminValidateEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { error } = await sb
      .from("email_verifications")
      .update({
        verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + THREE_MONTHS_MS).toISOString(),
      })
      .eq("id", data.id);
    return { ok: !error };
  });

export const adminRevokeEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { error } = await sb
      .from("email_verifications")
      .update({ verified_at: null, expires_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: !error };
  });

export const adminPlanningData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ domainId: uuid.nullish() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const [cats, doms] = await Promise.all([
      sb.from("service_categories").select("id, name, slug, description, pickup_info").order("sort_order"),
      sb.from("allowed_domains").select("id, domain, label").eq("active", true).order("domain"),
    ]);
    let schedules: { category_id: string; pickup_info: string | null }[] = [];
    if (data.domainId) {
      const { data: s } = await sb
        .from("domain_pickup_schedules")
        .select("category_id, pickup_info")
        .eq("domain_id", data.domainId);
      schedules = s ?? [];
    }
    return { categories: cats.data ?? [], domains: doms.data ?? [], schedules };
  });

export const adminSavePlanning = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        domainId: uuid.nullish(),
        categoryId: uuid,
        value: z.string().trim().max(160).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const value = data.value || null;
    const { error } = data.domainId
      ? await sb.from("domain_pickup_schedules").upsert(
          {
            domain_id: data.domainId,
            category_id: data.categoryId,
            pickup_info: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "domain_id,category_id" },
        )
      : await sb.from("service_categories").update({ pickup_info: value }).eq("id", data.categoryId);
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });

export const adminStats = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { data: rows, error } = await sb
      .from("bookings")
      .select("*, booking_items(*, services(category_id, service_categories(name)))")
      .gte("created_at", `${data.from}T00:00:00`)
      .lte("created_at", `${data.to}T23:59:59`)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Lecture impossible");
    return rows;
  });

/* ----------------------------- Sites ----------------------------- */

export const adminSitesData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await requireAdmin();
  const [sites, doms, cats, svcs, ss, sched] = await Promise.all([
    sb.from("sites").select("*").order("name"),
    sb.from("allowed_domains").select("id, domain, label, active, site_id").order("domain"),
    sb.from("service_categories").select("id, name, pickup_info").order("sort_order"),
    sb.from("services").select("id, name, category_id, price_cents, active").order("sort_order"),
    sb.from("site_services").select("*"),
    sb.from("site_pickup_schedules").select("*"),
  ]);
  if (sites.error) throw new Error("Lecture impossible");
  return {
    sites: sites.data,
    domains: doms.data ?? [],
    categories: cats.data ?? [],
    services: svcs.data ?? [],
    siteServices: ss.data ?? [],
    schedules: sched.data ?? [],
  };
});

export const adminSaveSite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: uuid.nullish(),
        name: z.string().trim().min(2).max(120),
        address: z.string().trim().max(300).nullish(),
        reception_email: z.string().trim().toLowerCase().email().max(255).nullish().or(z.literal("")),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const row = {
      name: data.name,
      address: data.address || null,
      reception_email: data.reception_email || null,
      active: data.active,
    };
    const { error } = data.id
      ? await sb.from("sites").update(row).eq("id", data.id)
      : await sb.from("sites").insert(row);
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });

export const adminDeleteSite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { error } = await sb.from("sites").delete().eq("id", data.id);
    return { ok: !error };
  });

export const adminSetDomainSite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ domainId: uuid, siteId: uuid.nullable() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { error } = await sb.from("allowed_domains").update({ site_id: data.siteId }).eq("id", data.domainId);
    return { ok: !error };
  });

export const adminSetSiteService = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        siteId: uuid,
        serviceId: uuid,
        active: z.boolean(),
        price_cents: z.number().int().min(0).max(1_000_000).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { error } = await sb.from("site_services").upsert(
      { site_id: data.siteId, service_id: data.serviceId, active: data.active, price_cents: data.price_cents },
      { onConflict: "site_id,service_id" },
    );
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });

export const adminSaveSiteSchedule = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ siteId: uuid, categoryId: uuid, value: z.string().trim().max(160).nullish() }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await requireAdmin();
    const { error } = await sb.from("site_pickup_schedules").upsert(
      {
        site_id: data.siteId,
        category_id: data.categoryId,
        pickup_info: data.value || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id,category_id" },
    );
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });
