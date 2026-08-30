"use strict";

const crypto = require("node:crypto");
const webpush = require("web-push");
const { supabaseServiceRequest } = require("./supabase-server");

function configured(environment = process.env){
  return Boolean(
    String(environment.VAPID_PUBLIC_KEY || "").trim()
    && String(environment.VAPID_PRIVATE_KEY || "").trim()
    && String(environment.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  );
}

function queryList(values){
  return [...new Set(values || [])]
    .filter(Boolean)
    .map(value => encodeURIComponent(value))
    .join(",");
}

function unreadCount(value){
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function notificationPayload(room, recipientUnreadCount, badgesEnabled = true){
  return {
    kind:"chat",
    roomId:room.id,
    title:`New message in ${String(room.room_name || "chat").slice(0, 80)}`,
    body:"Open Nothing Sport to read it.",
    tag:`nothingsport-chat-${room.id}`,
    url:`/?chatRoom=${encodeURIComponent(room.id)}`,
    ...(badgesEnabled === false ? {} : { unreadCount:unreadCount(recipientUnreadCount) }),
  };
}

async function dispatchChatMessageNotifications({ message, room, senderId }, environment = process.env){
  if (!configured(environment) || !message?.id || !room?.id || !senderId){
    return { attempted:0, sent:0, failed:0 };
  }

  const members = await supabaseServiceRequest(
    `/rest/v1/nothingsports_chat_members?room_id=eq.${encodeURIComponent(room.id)}&user_id=neq.${encodeURIComponent(senderId)}&select=user_id`,
    { environment }
  );
  const recipientIds = [...new Set((members || []).map(item => item.user_id).filter(id => id && id !== senderId))];
  if (!recipientIds.length) return { attempted:0, sent:0, failed:0 };

  const installations = await supabaseServiceRequest(
    `/rest/v1/nothingsports_push_installations?user_id=in.(${queryList(recipientIds)})&permission=eq.granted&chat_alerts_enabled=eq.true&select=*`,
    { environment }
  );
  if (!(installations || []).length) return { attempted:0, sent:0, failed:0 };

  const installationRecipientIds = [...new Set(installations.map(item => item.user_id).filter(Boolean))];
  const unreadRows = await supabaseServiceRequest("/rest/v1/rpc/nothingsports_chat_unread_totals", {
    method:"POST",
    environment,
    body:{ target_users:installationRecipientIds },
  });
  const unreadByRecipient = new Map((unreadRows || []).map(row => [row.user_id, unreadCount(row.unread_count)]));

  const now = new Date().toISOString();
  await supabaseServiceRequest("/rest/v1/nothingsports_chat_notification_deliveries?on_conflict=message_id,installation_id", {
    method:"POST",
    environment,
    headers:{ Prefer:"resolution=ignore-duplicates,return=minimal" },
    body:installations.map(installation => ({
      message_id:message.id,
      installation_id:installation.installation_id,
      updated_at:now,
    })),
  });

  const deliveryRows = await supabaseServiceRequest(
    `/rest/v1/nothingsports_chat_notification_deliveries?message_id=eq.${encodeURIComponent(message.id)}&installation_id=in.(${queryList(installations.map(item => item.installation_id))})&dispatched_at=is.null&select=*`,
    { environment }
  );
  const pending = new Map((deliveryRows || []).map(delivery => [delivery.installation_id, delivery]));

  webpush.setVapidDetails(
    String(environment.VAPID_SUBJECT || "https://nothingsport.vercel.app/"),
    String(environment.VAPID_PUBLIC_KEY),
    String(environment.VAPID_PRIVATE_KEY)
  );

  const outcomes = await Promise.allSettled(installations.map(async installation => {
    const delivery = pending.get(installation.installation_id);
    if (!delivery) return "skipped";
    const claimedAt = new Date().toISOString();
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const claimRows = await supabaseServiceRequest("/rest/v1/rpc/nothingsports_chat_claim_notification_delivery", {
      method:"POST",
      environment,
      body:{
        target_message:message.id,
        target_installation:installation.installation_id,
        target_claimed_at:claimedAt,
        target_stale_before:staleBefore,
      },
    });
    const claimed = Array.isArray(claimRows) ? claimRows[0] || null : null;
    if (!claimed) return "skipped";
    try{
      await webpush.sendNotification({
        endpoint:installation.endpoint,
        keys:{ p256dh:installation.p256dh, auth:installation.auth_key },
      }, JSON.stringify(notificationPayload(room, unreadByRecipient.get(installation.user_id), installation.badges_enabled)), {
        TTL:3600,
        urgency:"high",
        timeout:3000,
        topic:crypto.createHash("sha256").update(String(room.id), "utf8").digest("hex").slice(0, 32),
      });
      await supabaseServiceRequest(
        `/rest/v1/nothingsports_chat_notification_deliveries?delivery_id=eq.${encodeURIComponent(claimed.delivery_id)}&claimed_at=eq.${encodeURIComponent(claimedAt)}`,
        {
          method:"PATCH",
          environment,
          headers:{ Prefer:"return=minimal" },
          body:{
            attempts:Number(claimed.attempts || 0) + 1,
            dispatched_at:new Date().toISOString(),
            claimed_at:null,
            last_error:null,
            updated_at:new Date().toISOString(),
          },
        }
      );
      return "sent";
    }catch(error){
      try{ await supabaseServiceRequest(
        `/rest/v1/nothingsports_chat_notification_deliveries?delivery_id=eq.${encodeURIComponent(claimed.delivery_id)}&claimed_at=eq.${encodeURIComponent(claimedAt)}`,
        {
          method:"PATCH",
          environment,
          headers:{ Prefer:"return=minimal" },
          body:{
            attempts:Number(claimed.attempts || 0) + 1,
            claimed_at:null,
            last_error:String(error?.message || "Push delivery failed.").slice(0, 500),
            updated_at:new Date().toISOString(),
          },
        }
      ); }catch(_patchError){ /* The stale claim permits a later safe retry. */ }
      const status = Number(error?.statusCode || 0);
      if (status === 404 || status === 410){
        try{ await supabaseServiceRequest(
          `/rest/v1/nothingsports_push_installations?installation_id=eq.${encodeURIComponent(installation.installation_id)}`,
          { method:"DELETE", environment }
        ); }catch(_deleteError){ /* A later registration or cleanup may remove it. */ }
      }
      return "failed";
    }
  }));
  const statuses = outcomes.map(outcome => outcome.status === "fulfilled" ? outcome.value : "failed");
  const sent = statuses.filter(status => status === "sent").length;
  const failed = statuses.filter(status => status === "failed").length;
  return { attempted:sent + failed, sent, failed };
}

module.exports = Object.freeze({ configured, dispatchChatMessageNotifications, _test:Object.freeze({ notificationPayload, unreadCount }) });
