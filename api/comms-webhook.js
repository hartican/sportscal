"use strict";

const { Webhook } = require("svix");
const { SupabaseRequestError, publicError, supabaseServiceRequest } = require("../lib/supabase-server");

function clean(value, maximum = 4096){ return String(value == null ? "" : value).trim().slice(0, maximum); }
function header(request, name){
  if (request?.headers?.get) return request.headers.get(name) || "";
  const target = name.toLowerCase();
  return clean(Object.entries(request?.headers || {}).find(([key]) => key.toLowerCase() === target)?.[1], 4096);
}
async function rawBody(request){
  if (typeof request?.body === "string" || Buffer.isBuffer(request?.body)) return Buffer.from(request.body).toString("utf8");
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
function rowsPath(table, parameters = {}){ const query = new URLSearchParams(parameters); return `/rest/v1/${table}${query.size ? `?${query}` : ""}`; }
function deliveryStatus(type){
  return ({ "email.sent":"sent", "email.delivered":"delivered", "email.bounced":"bounced", "email.complained":"complained", "email.suppressed":"unsubscribed" })[type] || "";
}
function recipient(event){
  const value = event?.data?.to;
  const first = Array.isArray(value) ? value[0] : value;
  const email = clean(typeof first === "object" ? first.email : first, 320).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

async function handler(request, response){
  response.setHeader("Cache-Control", "no-store");
  try{
    if (request.method !== "POST"){ response.setHeader("Allow", "POST"); response.status(405).json({ error:"Webhook accepts POST only.", code:"method_not_allowed" }); return; }
    const webhookSecret = clean(process.env.RESEND_WEBHOOK_SECRET, 1000);
    if (!webhookSecret){ response.status(503).json({ error:"Email webhooks are not configured.", code:"webhook_not_configured" }); return; }
    const payload = await rawBody(request);
    const headers = { "svix-id":header(request,"svix-id"), "svix-timestamp":header(request,"svix-timestamp"), "svix-signature":header(request,"svix-signature") };
    let event;
    try{ event = new Webhook(webhookSecret).verify(payload, headers); }
    catch(_error){ response.status(400).json({ error:"Invalid webhook signature.", code:"invalid_webhook_signature" }); return; }
    const status = deliveryStatus(event.type), externalId = clean(event?.data?.email_id || event?.data?.broadcast_id, 300);
    if (status && externalId){
      await supabaseServiceRequest(rowsPath("nothingsports_marquee_deliveries", { external_id:`eq.${externalId}` }), { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:{ status, receipt:{ webhookId:headers["svix-id"], eventType:event.type, occurredAt:event.created_at || null }, updated_at:new Date().toISOString() } });
    }
    if (["email.complained", "email.suppressed"].includes(event.type)){
      const email = recipient(event);
      if (email) await supabaseServiceRequest(rowsPath("nothingsports_marquee_subscribers", { email_normalized:`eq.${email}` }), { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:{ suppressed_at:new Date().toISOString(), suppression_reason:event.type === "email.complained" ? "complaint" : "unsubscribe", updated_at:new Date().toISOString() } });
    }
    response.status(200).json({ accepted:true });
  }catch(error){
    if (error instanceof SupabaseRequestError){ const outgoing = publicError(error); response.status(outgoing.status).json(outgoing.body); return; }
    response.status(500).json({ error:"Webhook processing failed.", code:"webhook_failed" });
  }
}

handler.config = { api:{ bodyParser:false } };
handler._test = Object.freeze({ deliveryStatus, recipient });
module.exports = handler;
