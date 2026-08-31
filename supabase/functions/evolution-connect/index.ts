import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function randomToken() {
  return "nx_" + crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "").slice(0, 16);
}

async function evoFetch(url: string, apiKey: string, path: string, init?: RequestInit) {
  return fetch(url + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...(init?.headers || {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ ok: false, error: "invalid_session" }, 401);

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const { data: member, error: memberError } = await admin
    .from("organization_members")
    .select("organization_id,role")
    .eq("user_id", userData.user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (memberError || !member) return json({ ok: false, error: "organization_not_found" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "connect";

  const { data: existingCreds } = await admin
    .from("integration_credentials")
    .select("api_url,api_key,instance_api_key")
    .eq("organization_id", member.organization_id)
    .eq("provider", "evolution")
    .maybeSingle();

  let apiUrl = typeof body.apiUrl === "string" ? cleanBaseUrl(body.apiUrl) : existingCreds?.api_url;
  let globalKey = typeof body.apiKey === "string" ? body.apiKey.trim() : existingCreds?.api_key;

  if (!apiUrl || !globalKey) return json({ ok: false, error: "missing_evolution_credentials" }, 400);

  let { data: connection } = await admin
    .from("integration_connections")
    .select("id,instance_name,status")
    .eq("organization_id", member.organization_id)
    .eq("provider", "evolution")
    .maybeSingle();

  const instanceName = connection?.instance_name || ("nexo-" + member.organization_id.replaceAll("-", "").slice(0, 12));
  let instanceKey = existingCreds?.instance_api_key || null;

  if (action === "status" && instanceKey) {
    const statusRes = await evoFetch(apiUrl, instanceKey, "/instance/connectionState/" + encodeURIComponent(instanceName));
    const statusJson = await statusRes.json().catch(() => ({}));
    const state = statusJson?.instance?.state || statusJson?.state || "unknown";

    await admin.from("integration_connections").upsert({
      organization_id: member.organization_id,
      provider: "evolution",
      instance_name: instanceName,
      status: state === "open" ? "connected" : "disconnected",
      last_checked_at: new Date().toISOString(),
      config_public: { state },
    }, { onConflict: "organization_id,provider" });

    return json({ ok: true, instanceName, state, connected: state === "open" });
  }

  if (!instanceKey) {
    instanceKey = randomToken();
    const webhookUrl = supabaseUrl + "/functions/v1/evolution-webhook";
    const createRes = await evoFetch(apiUrl, globalKey, "/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName,
        token: instanceKey,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
          headers: { "x-nexo-webhook-secret": instanceKey }
        }
      })
    });
    const createJson = await createRes.json().catch(() => ({}));

    if (!createRes.ok && createRes.status !== 409 && createRes.status !== 422) {
      return json({ ok: false, error: "evolution_create_failed", detail: createJson }, 400);
    }

    const returnedKey = createJson?.hash?.apikey || createJson?.hash;
    if (typeof returnedKey === "string" && returnedKey.length > 10) instanceKey = returnedKey;

    await admin.from("integration_credentials").upsert({
      organization_id: member.organization_id,
      provider: "evolution",
      api_url: apiUrl,
      api_key: globalKey,
      instance_api_key: instanceKey,
      webhook_token: "managed",
    }, { onConflict: "organization_id,provider" });

    await admin.from("integration_connections").upsert({
      organization_id: member.organization_id,
      provider: "evolution",
      instance_name: instanceName,
      status: "disconnected",
      last_checked_at: new Date().toISOString(),
      config_public: { state: "connecting" },
    }, { onConflict: "organization_id,provider" });

    connection = { id: null, instance_name: instanceName, status: "disconnected" };
  } else if (typeof body.apiUrl === "string" || typeof body.apiKey === "string") {
    await admin.from("integration_credentials").upsert({
      organization_id: member.organization_id,
      provider: "evolution",
      api_url: apiUrl,
      api_key: globalKey,
      instance_api_key: instanceKey,
      webhook_token: "managed",
    }, { onConflict: "organization_id,provider" });
  }

  const webhookUrl = supabaseUrl + "/functions/v1/evolution-webhook";
  await evoFetch(apiUrl, globalKey, "/webhook/set/" + encodeURIComponent(instanceName), {
    method: "POST",
    body: JSON.stringify({
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
      headers: { "x-nexo-webhook-secret": instanceKey }
    })
  });

  let qr: any = null;
  const connectRes = await evoFetch(apiUrl, instanceKey!, "/instance/connect/" + encodeURIComponent(instanceName), { method: "GET" });
  if (connectRes.ok) qr = await connectRes.json().catch(() => null);

  const statusRes = await evoFetch(apiUrl, instanceKey!, "/instance/connectionState/" + encodeURIComponent(instanceName));
  const statusJson = await statusRes.json().catch(() => ({}));
  const state = statusJson?.instance?.state || statusJson?.state || (qr?.base64 ? "connecting" : "unknown");

  await admin.from("integration_connections").upsert({
    organization_id: member.organization_id,
    provider: "evolution",
    instance_name: instanceName,
    status: state === "open" ? "connected" : "disconnected",
    last_checked_at: new Date().toISOString(),
    config_public: { state },
  }, { onConflict: "organization_id,provider" });

  return json({
    ok: true,
    instanceName,
    state,
    connected: state === "open",
    qrBase64: qr?.base64 || qr?.qrcode?.base64 || null,
    pairingCode: qr?.pairingCode || qr?.qrcode?.pairingCode || null,
  });
});