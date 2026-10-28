import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Provider = { id: string; name: string; api_url: string; api_key: string };
type Order = {
  id: number;
  user_id: string;
  link: string;
  quantity: number;
  status: string;
  remains: number | null;
  start_count: number | null;
  provider_id: string | null;
  provider_service_id: string | null;
  provider_order_id: string | null;
  refill_status: string;
  cancel_requested: boolean;
};

const STATUS_MAP: Record<string, string> = {
  pending: "pending",
  processing: "processing",
  "in progress": "in_progress",
  inprogress: "in_progress",
  completed: "completed",
  complete: "completed",
  partial: "partial",
  canceled: "canceled",
  cancelled: "canceled",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callProvider(p: Provider, params: Record<string, string>) {
  if (!/^https:\/\//i.test(p.api_url)) throw new Error("Provider URL must start with https://");
  const body = new URLSearchParams({ key: p.api_key, ...params });
  const res = await fetch(p.api_url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Provider returned an unexpected response (HTTP ${res.status})`);
  }
}

async function getProviders(db: SupabaseClient, ids?: string[]) {
  let q = db.from("providers").select("id, name, api_url, api_key").eq("active", true);
  if (ids) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw error;
  return new Map((data as Provider[]).map((p) => [p.id, p]));
}

async function submitOrders(db: SupabaseClient, orders: Order[]) {
  const providers = await getProviders(db, [...new Set(orders.map((o) => o.provider_id!))]);
  let sent = 0;
  for (const o of orders) {
    const p = providers.get(o.provider_id!);
    if (!p || !o.provider_service_id) continue;
    try {
      const r = await callProvider(p, {
        action: "add",
        service: o.provider_service_id,
        link: o.link,
        quantity: String(o.quantity),
      });
      if (r?.order) {
        await db.from("orders").update({
          provider_order_id: String(r.order),
          status: "processing",
          provider_error: null,
          updated_at: new Date().toISOString(),
        }).eq("id", o.id).is("provider_order_id", null);
        sent++;
      } else {
        await db.from("orders").update({ provider_error: String(r?.error ?? "Unknown provider error") }).eq("id", o.id);
      }
    } catch (e) {
      await db.from("orders").update({ provider_error: (e as Error).message }).eq("id", o.id);
    }
  }
  return sent;
}

async function syncStatuses(db: SupabaseClient, orders: Order[]) {
  const byProvider = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.provider_id || !o.provider_order_id) continue;
    byProvider.set(o.provider_id, [...(byProvider.get(o.provider_id) ?? []), o]);
  }
  const providers = await getProviders(db, [...byProvider.keys()]);
  let updated = 0;
  for (const [pid, list] of byProvider) {
    const p = providers.get(pid);
    if (!p) continue;
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      let r: Record<string, { status?: string; start_count?: string; remains?: string; error?: string }>;
      try {
        r = await callProvider(p, { action: "status", orders: chunk.map((o) => o.provider_order_id).join(",") });
      } catch {
        continue;
      }
      for (const o of chunk) {
        const s = r?.[o.provider_order_id!];
        if (!s || s.error || !s.status) continue;
        const status = STATUS_MAP[String(s.status).toLowerCase().trim()];
        if (!status) continue;
        const start = s.start_count != null && s.start_count !== "" ? parseInt(String(s.start_count), 10) : null;
        const remains = s.remains != null && s.remains !== "" ? parseInt(String(s.remains), 10) : null;
        if (status === o.status && start === o.start_count && remains === o.remains) continue;
        const { error } = await db.rpc("settle_order", {
          p_order: o.id,
          p_status: status,
          p_start: Number.isFinite(start) ? start : null,
          p_remains: Number.isFinite(remains) ? remains : null,
        });
        if (!error) updated++;
      }
    }
  }
  return updated;
}

async function processRequests(db: SupabaseClient) {
  const { data: refills } = await db.from("orders")
    .select("id, provider_id, provider_order_id")
    .eq("refill_status", "requested").not("provider_order_id", "is", null).limit(100);
  const { data: cancels } = await db.from("orders")
    .select("id, provider_id, provider_order_id")
    .eq("cancel_requested", true).not("provider_order_id", "is", null)
    .in("status", ["pending", "processing", "in_progress"]).limit(100);
  const all = [...(refills ?? []), ...(cancels ?? [])];
  const providers = await getProviders(db, [...new Set(all.map((o) => o.provider_id as string))]);

  for (const o of refills ?? []) {
    const p = providers.get(o.provider_id as string);
    if (!p) continue;
    try {
      const r = await callProvider(p, { action: "refill", order: String(o.provider_order_id) });
      await db.from("orders").update({ refill_status: r?.refill ? "sent" : "failed" }).eq("id", o.id);
    } catch {
      await db.from("orders").update({ refill_status: "failed" }).eq("id", o.id);
    }
  }
  for (const o of cancels ?? []) {
    const p = providers.get(o.provider_id as string);
    if (!p) continue;
    try {
      await callProvider(p, { action: "cancel", orders: String(o.provider_order_id) });
    } catch {
      // provider may not support cancel; status sync reflects the outcome
    }
    await db.from("orders").update({ cancel_requested: false }).eq("id", o.id);
  }
}

const ORDER_COLS =
  "id, user_id, link, quantity, status, remains, start_count, provider_id, provider_service_id, provider_order_id, refill_status, cancel_requested";
const ACTIVE = ["pending", "processing", "in_progress"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await db.auth.getUser(token);
    const uid = auth?.user?.id;
    if (!uid) return json({ error: "Please sign in again." }, 401);

    const { data: me } = await db.from("profiles").select("role, status").eq("id", uid).maybeSingle();
    if (!me || me.status !== "active") return json({ error: "Account not active." }, 403);
    const isAdmin = me.role === "admin";

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "submit") {
      const { data: o } = await db.from("orders").select(ORDER_COLS).eq("id", Number(body.order_id)).maybeSingle();
      if (!o || (!isAdmin && o.user_id !== uid)) return json({ error: "Order not found." }, 404);
      if (o.provider_id && !o.provider_order_id && o.status === "pending") await submitOrders(db, [o as Order]);
      return json({ ok: true });
    }

    if (action === "sync_mine") {
      const { data: list } = await db.from("orders").select(ORDER_COLS)
        .eq("user_id", uid).in("status", ACTIVE).not("provider_order_id", "is", null).limit(100);
      const updated = await syncStatuses(db, (list ?? []) as Order[]);
      return json({ ok: true, updated });
    }

    if (!isAdmin) return json({ error: "Not authorized." }, 403);

    if (action === "test" || action === "services") {
      const { data: p } = await db.from("providers").select("id, name, api_url, api_key")
        .eq("id", String(body.provider_id)).maybeSingle();
      if (!p) return json({ error: "Provider not found." }, 404);
      if (action === "test") {
        const r = await callProvider(p as Provider, { action: "balance" });
        if (r?.error || r?.balance == null) return json({ error: String(r?.error ?? "Could not read balance. Check the API URL and key.") }, 400);
        await db.from("providers").update({ balance: Number(r.balance), currency: String(r.currency ?? "USD") }).eq("id", p.id);
        return json({ balance: Number(r.balance), currency: String(r.currency ?? "USD") });
      }
      const r = await callProvider(p as Provider, { action: "services" });
      if (!Array.isArray(r)) return json({ error: String(r?.error ?? "Provider did not return a service list.") }, 400);
      const services = r.map((s: Record<string, unknown>) => ({
        service: String(s.service),
        name: String(s.name ?? ""),
        category: String(s.category ?? "Other"),
        type: String(s.type ?? "Default"),
        rate: Number(s.rate ?? 0),
        min: parseInt(String(s.min ?? 1), 10) || 1,
        max: parseInt(String(s.max ?? 1), 10) || 1,
        refill: Boolean(s.refill),
        cancel: Boolean(s.cancel),
        description: String(s.description ?? s.desc ?? ""),
      }));
      return json({ services });
    }

    if (action === "sync") {
      const { data: pending } = await db.from("orders").select(ORDER_COLS)
        .eq("status", "pending").is("provider_order_id", null).not("provider_id", "is", null).limit(50);
      const sent = await submitOrders(db, (pending ?? []) as Order[]);
      await processRequests(db);
      const { data: active } = await db.from("orders").select(ORDER_COLS)
        .in("status", ACTIVE).not("provider_order_id", "is", null).limit(1000);
      const updated = await syncStatuses(db, (active ?? []) as Order[]);

      const providers = await getProviders(db);
      for (const p of providers.values()) {
        try {
          const r = await callProvider(p, { action: "balance" });
          if (r?.balance != null) await db.from("providers").update({ balance: Number(r.balance) }).eq("id", p.id);
        } catch {
          // keep last known balance
        }
      }
      return json({ ok: true, sent, updated });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error("provider function error", e);
    return json({ error: (e as Error).message?.startsWith("Provider") ? (e as Error).message : "Something went wrong. Please try again." }, 500);
  }
});
