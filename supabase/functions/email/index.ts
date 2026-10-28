import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH = 40;

type Recipient = { id: string; email: string; username: string; full_name: string; balance: number };
type Settings = {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  from_name: string;
  from_email: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function htmlBody(text: string, siteName: string) {
  const content = escapeHtml(text).replace(/\n/g, "<br>");
  return `<div style="background:#f3f7f5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3ebe7">
<div style="background:#05965a;color:#ffffff;padding:20px 28px;font-size:20px;font-weight:bold">${escapeHtml(siteName)}</div>
<div style="padding:28px;color:#1b2a23;font-size:15px;line-height:1.6">${content}</div>
<div style="padding:16px 28px;background:#f8fbf9;color:#6b7c74;font-size:12px">You received this email because you have an account at ${escapeHtml(siteName)}.</div>
</div></div>`;
}

function varsFor(r: Recipient, extra: Record<string, string> = {}) {
  return {
    name: r.full_name || r.username,
    username: r.username,
    email: r.email,
    balance: `$${Number(r.balance).toFixed(2)}`,
    ...extra,
  };
}

async function loadSettings(db: SupabaseClient) {
  const { data } = await db.from("email_settings").select("*").eq("id", 1).maybeSingle();
  const s = data as Settings | null;
  if (!s || !s.smtp_host || !s.from_email) throw new Error("Email is not set up yet. Fill in the SMTP settings first.");
  return s;
}

function transporter(s: Settings) {
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: s.smtp_port,
    secure: s.smtp_secure,
    auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
}

async function sendOne(
  db: SupabaseClient,
  t: ReturnType<typeof transporter>,
  s: Settings,
  to: string,
  subject: string,
  text: string,
  kind: string,
  userId: string | null,
) {
  try {
    await t.sendMail({
      from: `"${s.from_name.replace(/"/g, "")}" <${s.from_email}>`,
      to,
      subject,
      text,
      html: htmlBody(text, s.from_name),
    });
    await db.from("email_log").insert({ to_email: to, subject, kind, user_id: userId, status: "sent" });
    return true;
  } catch (e) {
    console.error("send failed", to, e);
    const msg = e instanceof Error ? e.message.slice(0, 300) : "Unknown error";
    await db.from("email_log").insert({ to_email: to, subject, kind, user_id: userId, status: "failed", error: msg });
    return false;
  }
}

async function sendTemplate(db: SupabaseClient, key: string, userId: string, extra: Record<string, string>) {
  const { data: raw } = await db.from("email_settings").select("*").eq("id", 1).maybeSingle();
  const s = raw as Settings | null;
  if (!s || !s.enabled || !s.smtp_host || !s.from_email) return { skipped: true };
  const { data: tpl } = await db.from("email_templates").select("subject, body, enabled").eq("key", key).maybeSingle();
  if (!tpl || !tpl.enabled) return { skipped: true };
  const { data: r } = await db.from("profiles").select("id, email, username, full_name, balance").eq("id", userId).maybeSingle();
  if (!r) return { skipped: true };
  const vars = varsFor(r as Recipient, extra);
  const ok = await sendOne(db, transporter(s), s, r.email, fill(tpl.subject, vars), fill(tpl.body, vars), key, r.id);
  return { sent: ok ? 1 : 0 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await db.auth.getUser(token);
    const uid = auth?.user?.id;
    if (!uid) return json({ error: "Please sign in again." }, 401);

    const { data: me } = await db.from("profiles").select("role, status").eq("id", uid).maybeSingle();
    if (!me || me.status !== "active") return json({ error: "Account not active." }, 403);
    const isAdmin = me.role === "admin";

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "welcome") {
      const { count } = await db.from("email_log").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("kind", "welcome");
      if (count) return json({ skipped: true });
      return json(await sendTemplate(db, "welcome", uid, {}));
    }

    if (!isAdmin) return json({ error: "Not allowed." }, 403);

    if (action === "test") {
      const to = String(body.to ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ error: "Enter a valid email address." }, 400);
      const s = await loadSettings(db);
      const t = transporter(s);
      try {
        await t.verify();
      } catch (e) {
        console.error("verify failed", e);
        return json({ error: "Could not connect to your mail server. Check the host, port, security and login details." }, 400);
      }
      const ok = await sendOne(db, t, s, to, `Test email from ${s.from_name}`, "Your business email is connected and working.\n\nThis is a test message.", "test", null);
      return ok ? json({ sent: 1 }) : json({ error: "The mail server refused the message. Check the sender address matches your login." }, 400);
    }

    if (action === "notify") {
      const key = String(body.template ?? "");
      const userId = String(body.user_id ?? "");
      const extra: Record<string, string> = {};
      for (const [k, v] of Object.entries(body.vars ?? {})) extra[k] = String(v).slice(0, 2000);
      return json(await sendTemplate(db, key, userId, extra));
    }

    if (action === "bulk") {
      const subject = String(body.subject ?? "").trim();
      const text = String(body.body ?? "").trim();
      if (!subject || !text) return json({ error: "Subject and message are required." }, 400);
      const offset = Math.max(0, Number(body.offset) || 0);
      const audience = String(body.audience ?? "all");

      let q = db.from("profiles").select("id, email, username, full_name, balance").eq("status", "active").order("created_at");
      if (audience === "selected") {
        const ids = Array.isArray(body.user_ids) ? body.user_ids.map(String).slice(0, 1000) : [];
        if (!ids.length) return json({ error: "Select at least one user." }, 400);
        q = q.in("id", ids);
      } else if (audience === "with_balance") {
        q = q.gt("balance", 0);
      } else if (audience === "customers") {
        q = q.gt("total_spent", 0);
      }
      const { data: list, error } = await q.range(offset, offset + BATCH - 1);
      if (error) throw error;

      const s = await loadSettings(db);
      const t = transporter(s);
      let sent = 0;
      let failed = 0;
      for (const r of (list ?? []) as Recipient[]) {
        const vars = varsFor(r);
        const ok = await sendOne(db, t, s, r.email, fill(subject, vars), fill(text, vars), "bulk", r.id);
        if (ok) sent++;
        else failed++;
      }
      const next = (list?.length ?? 0) === BATCH ? offset + BATCH : null;
      return json({ sent, failed, next_offset: next });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error && e.message.startsWith("Email is not set up") ? e.message : "Something went wrong. Please try again.";
    return json({ error: msg }, 500);
  }
});
