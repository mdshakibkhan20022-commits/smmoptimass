import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  in_progress: "In progress",
  completed: "Completed",
  partial: "Partial",
  canceled: "Canceled",
};

const KNOWN_ERRORS = [
  "Service unavailable",
  "Invalid link",
  "Quantity out of range",
  "Insufficient balance",
  "Account not active",
  "Refill not available",
];

async function readParams(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (req.method === "GET") return Object.fromEntries(new URL(req.url).searchParams);
  if (type.includes("application/json")) {
    const b = await req.json().catch(() => ({}));
    return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, String(v)]));
  }
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}

function formatOrder(o: { charge: number; start_count: number | null; status: string; remains: number | null }) {
  return {
    charge: Number(o.charge).toFixed(4),
    start_count: o.start_count != null ? String(o.start_count) : "0",
    status: STATUS_LABEL[o.status] ?? o.status,
    remains: o.remains != null ? String(o.remains) : "0",
    currency: "USD",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const params = await readParams(req);
    const key = (params.key ?? "").trim();
    if (!/^[a-f0-9]{32}$/.test(key)) return json({ error: "Invalid API key" });

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: user } = await db.from("profiles").select("id, balance, status, total_spent").eq("api_key", key).maybeSingle();
    if (!user || user.status !== "active") return json({ error: "Invalid API key" });

    switch (params.action) {
      case "balance":
        return json({ balance: Number(user.balance).toFixed(4), currency: "USD" });

      case "services": {
        const { data } = await db.from("services")
          .select("id, name, type, rate, min_qty, max_qty, refill, cancel, description, categories!inner(name, active)")
          .eq("active", true).eq("categories.active", true).order("sort_order").order("id");
        return json((data ?? []).map((s) => ({
          service: s.id,
          name: s.name,
          type: s.type,
          category: (s.categories as unknown as { name: string }).name,
          rate: Number(s.rate).toFixed(4),
          min: String(s.min_qty),
          max: String(s.max_qty),
          refill: s.refill,
          cancel: s.cancel,
          description: s.description,
        })));
      }

      case "add": {
        const { data: orderId, error } = await db.rpc("place_order_for", {
          p_user: user.id,
          p_service: Number(params.service),
          p_link: params.link ?? "",
          p_quantity: Number(params.quantity),
        });
        if (error) {
          const known = KNOWN_ERRORS.find((m) => error.message?.includes(m));
          return json({ error: known ?? "Could not create order" });
        }
        const { data: o } = await db.from("orders")
          .select("id, link, quantity, provider_id, provider_service_id").eq("id", orderId).maybeSingle();
        if (o?.provider_id && o.provider_service_id) {
          const { data: p } = await db.from("providers").select("api_url, api_key, active").eq("id", o.provider_id).maybeSingle();
          if (p?.active && /^https:\/\//i.test(p.api_url)) {
            try {
              const res = await fetch(p.api_url, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  key: p.api_key, action: "add", service: o.provider_service_id, link: o.link, quantity: String(o.quantity),
                }),
                signal: AbortSignal.timeout(25000),
              });
              const r = await res.json().catch(() => null);
              if (r?.order) {
                await db.from("orders").update({ provider_order_id: String(r.order), status: "processing" }).eq("id", o.id);
              } else {
                await db.from("orders").update({ provider_error: String(r?.error ?? "Unknown provider error") }).eq("id", o.id);
              }
            } catch (e) {
              await db.from("orders").update({ provider_error: (e as Error).message }).eq("id", o.id);
            }
          }
        }
        return json({ order: orderId });
      }

      case "status": {
        if (params.orders) {
          const ids = params.orders.split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite).slice(0, 100);
          const { data } = await db.from("orders").select("id, charge, start_count, status, remains")
            .eq("user_id", user.id).in("id", ids);
          const found = new Map((data ?? []).map((o) => [o.id, o]));
          return json(Object.fromEntries(ids.map((id) => {
            const o = found.get(id);
            return [String(id), o ? formatOrder(o) : { error: "Incorrect order ID" }];
          })));
        }
        const { data: o } = await db.from("orders").select("id, charge, start_count, status, remains")
          .eq("user_id", user.id).eq("id", Number(params.order)).maybeSingle();
        return json(o ? formatOrder(o) : { error: "Incorrect order ID" });
      }

      case "refill": {
        const { data: o } = await db.from("orders")
          .select("id, status, refill_status, services(refill)")
          .eq("user_id", user.id).eq("id", Number(params.order)).maybeSingle();
        const refillable = (o?.services as unknown as { refill: boolean } | null)?.refill;
        if (!o || !refillable || !["completed", "partial"].includes(o.status) || !["none", "failed"].includes(o.refill_status)) {
          return json({ error: "Refill not available" });
        }
        await db.from("orders").update({ refill_status: "requested" }).eq("id", o.id);
        return json({ refill: String(o.id) });
      }

      default:
        return json({ error: "Incorrect request" });
    }
  } catch (e) {
    console.error("api error", e);
    return json({ error: "Server error" }, 500);
  }
});
