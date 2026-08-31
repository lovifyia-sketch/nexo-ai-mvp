import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractText(message: Record<string, unknown> | undefined): string | null {
  if (!message) return null;
  if (typeof message.conversation === "string") return message.conversation;
  const extended = message.extendedTextMessage as { text?: string } | undefined;
  if (typeof extended?.text === "string") return extended.text;
  const image = message.imageMessage as { caption?: string } | undefined;
  if (typeof image?.caption === "string") return image.caption;
  const video = message.videoMessage as { caption?: string } | undefined;
  if (typeof video?.caption === "string") return video.caption;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    return Response.json({ ok: true, service: "nexo-evolution-webhook", status: "ready" }, { headers: corsHeaders });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return Response.json({ ok: false, error: "server_not_configured" }, { status: 500, headers: corsHeaders });

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") return Response.json({ ok: false, error: "invalid_json" }, { status: 400, headers: corsHeaders });

  const instance = typeof payload.instance === "string" ? payload.instance : null;
  const event = typeof payload.event === "string" ? payload.event : null;
  if (!instance) return Response.json({ ok: false, error: "missing_instance" }, { status: 400, headers: corsHeaders });

  const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  const { data: integration, error: integrationError } = await db
    .from("integration_connections")
    .select("organization_id,status,instance_name")
    .eq("provider", "evolution")
    .eq("instance_name", instance)
    .maybeSingle();

  if (integrationError) return Response.json({ ok: false, error: "integration_lookup_failed" }, { status: 500, headers: corsHeaders });
  if (!integration) return Response.json({ ok: false, error: "unknown_instance" }, { status: 403, headers: corsHeaders });

  const { data: credentials } = await db
    .from("integration_credentials")
    .select("instance_api_key")
    .eq("organization_id", integration.organization_id)
    .eq("provider", "evolution")
    .maybeSingle();

  if (credentials?.instance_api_key) {
    const providedSecret = req.headers.get("x-nexo-webhook-secret");
    if (providedSecret !== credentials.instance_api_key) {
      return Response.json({ ok: false, error: "invalid_webhook_signature" }, { status: 401, headers: corsHeaders });
    }
  }

  const data = payload.data && typeof payload.data === "object" ? payload.data : {};

  if (event && event.toLowerCase().includes("connection")) {
    const state = typeof data.state === "string"
      ? data.state
      : (data.instance && typeof data.instance === "object" && typeof data.instance.state === "string" ? data.instance.state : "unknown");

    await db.from("integration_connections").update({
      status: state === "open" ? "connected" : "disconnected",
      last_checked_at: new Date().toISOString(),
      config_public: { state }
    }).eq("organization_id", integration.organization_id).eq("provider", "evolution");

    await db.from("audit_logs").insert({
      organization_id: integration.organization_id,
      actor_type: "integration",
      action: "whatsapp.connection.update",
      payload: { event, instance, state }
    });

    return Response.json({ ok: true, connection_updated: true, state }, { headers: corsHeaders });
  }

  if (event && !event.toLowerCase().includes("messages")) {
    return Response.json({ ok: true, ignored: true, reason: "event_not_used_yet" }, { headers: corsHeaders });
  }
  const key = data.key && typeof data.key === "object" ? data.key : {};
  const remoteJid = typeof key.remoteJid === "string" ? key.remoteJid : null;
  const externalMessageId = typeof key.id === "string" ? key.id : null;
  const fromMe = Boolean(key.fromMe);
  if (!remoteJid || !externalMessageId) return Response.json({ ok: true, ignored: true, reason: "not_a_message_payload" }, { headers: corsHeaders });

  const phone = remoteJid.split("@")[0].replace(/\D/g, "");
  const pushName = typeof data.pushName === "string" && data.pushName.trim() ? data.pushName.trim() : "Contato WhatsApp";
  const body = extractText(data.message as Record<string, unknown> | undefined);

  let customerId: string | null = null;
  const { data: existingCustomer } = await db
    .from("customers")
    .select("id")
    .eq("organization_id", integration.organization_id)
    .eq("phone_e164", phone)
    .maybeSingle();

  if (existingCustomer?.id) {
    customerId = existingCustomer.id;
  } else if (!fromMe) {
    const { data: newCustomer } = await db
      .from("customers")
      .insert({ organization_id: integration.organization_id, name: pushName, phone_e164: phone })
      .select("id")
      .single();
    customerId = newCustomer?.id ?? null;
  }

  let conversationId: string | null = null;
  const { data: existingConversation } = await db
    .from("conversations")
    .select("id")
    .eq("organization_id", integration.organization_id)
    .eq("channel", "whatsapp")
    .eq("external_contact_id", remoteJid)
    .maybeSingle();

  if (existingConversation?.id) {
    conversationId = existingConversation.id;
    await db.from("conversations").update({ customer_id: customerId, contact_phone: phone, last_message_at: new Date().toISOString(), status: "open" }).eq("id", conversationId);
  } else {
    const { data: newConversation } = await db
      .from("conversations")
      .insert({ organization_id: integration.organization_id, customer_id: customerId, channel: "whatsapp", external_contact_id: remoteJid, contact_phone: phone, last_message_at: new Date().toISOString() })
      .select("id")
      .single();
    conversationId = newConversation?.id ?? null;
  }

  if (!conversationId) return Response.json({ ok: false, error: "conversation_failed" }, { status: 500, headers: corsHeaders });

  const { error: messageError } = await db.from("messages").insert({
    organization_id: integration.organization_id,
    conversation_id: conversationId,
    customer_id: customerId,
    direction: fromMe ? "outbound" : "inbound",
    channel: "whatsapp",
    external_message_id: externalMessageId,
    sender_phone: phone,
    body,
    message_type: body ? "text" : "other",
    raw_payload: payload,
    occurred_at: new Date().toISOString(),
  });

  if (messageError && messageError.code !== "23505") {
    return Response.json({ ok: false, error: "message_insert_failed" }, { status: 500, headers: corsHeaders });
  }

  await db.from("audit_logs").insert({
    organization_id: integration.organization_id,
    actor_type: "integration",
    action: "whatsapp.message.received",
    entity_type: "conversation",
    entity_id: conversationId,
    payload: { event, instance, external_message_id: externalMessageId, direction: fromMe ? "outbound" : "inbound" },
  });

  return Response.json({ ok: true, recorded: true, conversation_id: conversationId }, { headers: corsHeaders });
});