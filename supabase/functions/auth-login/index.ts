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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { identifier, password } = await req.json().catch(() => ({}));
    const id = String(identifier ?? "").trim();
    const pw = String(password ?? "");
    const invalid = json({ error: "Incorrect username or password." }, 400);
    if (!id || !pw || id.length > 120 || pw.length > 200) return invalid;

    const url = Deno.env.get("SUPABASE_URL")!;
    let email = id;
    if (!id.includes("@")) {
      const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data } = await admin.from("profiles").select("email").ilike("username", id.replace(/[%_\\]/g, "\\$&")).maybeSingle();
      if (!data?.email) return invalid;
      email = data.email;
    }

    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email, password: pw });
    if (error || !data.session) return invalid;

    return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch (e) {
    console.error("auth-login error", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
