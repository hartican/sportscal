"use strict";
const { supabaseServiceRequest: request } = require("./supabase-server");
const { guardedSend, suppressed } = require("./notification-send");
async function dispatch({ now = new Date() } = {}) {
  const claims = await request("/rest/v1/rpc/nothingsports_comms_claim_posts", {
    method: "POST",
    body: { claim_at: now.toISOString() },
  });
  let sent = 0,
    failed = 0;
  for (const row of claims) {
    let outcome = "suppressed";
    try {
      const [user, campaigns, prefs] = await Promise.all([
        request("/auth/v1/admin/users/" + encodeURIComponent(row.user_id)),
        request(
          "/rest/v1/nothingsports_marquee_campaigns?campaign_id=eq." +
            encodeURIComponent(row.campaign_id) +
            "&select=posted_at,snoozed_until,proposed_send_at,state",
        ),
        request(
          "/rest/v1/nothingsports_comms_preferences?user_id=eq." +
            encodeURIComponent(row.user_id) +
            "&select=alerts_enabled,installation_id",
        ),
      ]);
      const c = campaigns[0],
        p = prefs[0];
      if (
        user?.app_metadata?.role === "admin" &&
        c &&
        !c.posted_at &&
        c.state !== "cancelled" &&
        p?.alerts_enabled &&
        p.installation_id === row.installation_id &&
        Date.parse(c.snoozed_until || c.proposed_send_at) ===
          Date.parse(row.scheduled_at)
      ) {
        await guardedSend({
          installationId: row.installation_id,
          expectedUserId: row.user_id,
          relatedUserIds: [row.user_id],
          payload: JSON.stringify({
            title: row.kind === "before" ? "Post in 30 minutes" : "Post due",
            body: row.title,
            url: "/admin/comms?campaign=" + encodeURIComponent(row.campaign_id),
            tag: "ns-owner-post-" + row.campaign_id + "-" + row.kind,
          }),
          options: { timeout: 3000, TTL: 1800, urgency: "normal" },
        });
        outcome = "sent";
        sent++;
      }
    } catch (error) {
      outcome = suppressed(error)
        ? "suppressed"
        : Number(error.statusCode)
          ? "failed"
          : "uncertain";
      if (outcome !== "suppressed") failed++;
    }
    await request(
      "/rest/v1/nothingsports_comms_post_receipts?receipt_id=eq." +
        encodeURIComponent(row.receipt_id),
      {
        method: "PATCH",
        body: { outcome, finished_at: new Date().toISOString() },
      },
    );
  }
  return { claimed: claims.length, sent, failed };
}
module.exports = { dispatch };
