"use strict";
// Private content reconciliation. Uses published Feed/Events, never scrapes or sends.
const fs = require("node:fs"),
  path = require("node:path");
const content = require("./comms-content");
const { supabaseServiceRequest: defaultRequest } = require("./supabase-server");
const TABLE = "nothingsports_marquee_campaigns",
  ASSETS = "nothingsports_comms_assets",
  SOURCE_POLICY = "owner-content.v4-adaptive";
const query = (table, params) =>
  "/rest/v1/" + table + "?" + new URLSearchParams(params);
const read = (table, params = { select: "*" }) => defaultRequest(query(table, params));
const rpc = (name, body) =>
  defaultRequest("/rest/v1/rpc/" + name, { method: "POST", body });
const sources = () =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../data/comms-sources.v1.json"),
      "utf8",
    ),
  );
const scoped=request=>({read:(table,params={select:"*"})=>request(query(table,params)),rpc:(name,body)=>request("/rest/v1/rpc/"+name,{method:"POST",body})});
async function prepare({ now = Date.now(),request=defaultRequest } = {}) {
  const {read,rpc}=scoped(request);
  const source = sources();
  const [stored, heat, editorial] = await Promise.all([
    read(TABLE),
    rpc("nothingsports_comms_heat", {}),
    require('./editorial-maintenance').inventory({now:new Date(now),requestImpl:request}),
  ]);
  const ratings = new Map(heat.map((r) => [r.event_id, r]));
  const images = new Map(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../data/marquee-candidates.v1.json"),
        "utf8",
      ),
    ).candidates.map((c) => [c.campaignId, { hash: c.contentHash, hero: c.assets.fallbackHero }]),
  );
  const candidates = [];
  const policy=require('../config/editorial-maintenance');
  for (const original of source.events) {
    const signal=editorial.cards.find(c=>policy.ids(c.event).some(id=>policy.ids(original).includes(id)));
    const event=signal?{...original,editorialNarrative:signal.event.editorialNarrative}:original;
    // The approved men's Grand Final is excluded from this maintenance path.
    if(policy.protectedFixture(event)||signal?.state.held===true)continue;
    const id = require("../config/marquee-campaigns").fixtureId(event);
    const community =
      (signal?.eligibility.count?{mean:signal.eligibility.mean,count:signal.eligibility.count}:null)||ratings.get(id) ||
      ratings.get(event.id) ||
      (event.sourceEventIds || []).map((id) => ratings.get(id)).find(Boolean);
    if (!content.eligible(event, community, now)&&!(signal?.selected&&!signal.schedule.stopped)) continue;
    for (const slot of content.postingSlots(
      event,
      now,
      stored.filter((c) => c.event_id === id),
    )) {
      const candidate = content.candidate(
          event,
          slot,
          community,
          source.sourceRevision,
        ),
        generated = images.get(candidate.campaignId),
        hero = generated?.hash === candidate.contentHash ? generated.hero : null;
      // Never reuse a composition bearing outdated dates or editorial stakes
      // after real ratings/source facts change. The current NS mark is safe.
      if (hero) {
        candidate.assets.fallbackHero = hero;
        candidate.assets.suggestedHeroes = [hero];
        candidate.drafts.email.image = hero;
        candidate.drafts.instagram.image = hero;
        candidate.drafts.live.hero = hero;
        candidate.live.hero = hero;
      }
      candidates.push(candidate);
    }
  }
  candidates.sort(
    (a, b) =>
      (Date.parse(a.proposedSendAt) || Infinity) -
        (Date.parse(b.proposedSendAt) || Infinity) ||
      a.eventId.localeCompare(b.eventId),
  );
  return { source, candidates, stored, now };
}
async function syncOne(candidate, current, actorId = null,request=defaultRequest) {
  const {rpc}=scoped(request);
  // Pre-CMS rows without generated defaults retain their edited copy on first migration.
  const copy = current
    ? content.protectCopy(
        current.candidate?.drafts || {},
        candidate.drafts,
        current.draft_copy || {},
      )
    : candidate.drafts;
  const result = await rpc("nothingsports_comms_sync", {
    target_id: candidate.campaignId,
    expected_revision: Number(current?.campaign_revision || 0),
    target_candidate: candidate,
    target_copy: copy,
    target_hash: candidate.contentHash,
    target_send: candidate.proposedSendAt,
    actor_id: actorId,
  });
  if (result.conflict)
    throw Object.assign(
      new Error(
        "Candidate changed during refresh; retry to preserve the newer edit.",
      ),
      { code: "campaign_revision_conflict" },
    );
  return result;
}
async function purgePast(stored, now,request=defaultRequest) {
  const {read}=scoped(request);
  const canonical = new Map();
  for (const event of require("./competition-fixtures").fixtures()) {
    for (const id of [event.id, event.eventId, event.canonicalEventId, ...(event.sourceEventIds || [])].filter(Boolean)) canonical.set(id, event);
  }
  let expired = stored.filter((c) => {
    const published = canonical.get(c.event_id);
    if (published) return content.past(published, now);
    const end = Date.parse(c.candidate?.timing?.endTimeUtc || "");
    if (Number.isFinite(end)) return end <= now;
    // Legacy Watching stubs sometimes have a date but no UTC end. Use only
    // published ISO dates, never titles or speculative bracket/round dates.
    const date = c.candidate?.material?.displayDate;
    return /^\d{4}-\d{2}-\d{2}$/.test(date || "") && content.past({date}, now);
  });
  if (!expired.length) return 0;
  // A legacy delivery FK cascades: its campaign and all its media must survive.
  const deliveries = await read("nothingsports_marquee_deliveries", {
    campaign_id: "in.(" + expired.map((c) => c.campaign_id).join(",") + ")",
    select: "campaign_id",
  });
  const delivered = new Set(deliveries.map((row) => row.campaign_id));
  expired = expired.filter((c) => !delivered.has(c.campaign_id));
  if (!expired.length) return 0;
  const dead = new Set(expired.map((c) => c.campaign_id)),
    retained = stored.filter((c) => !dead.has(c.campaign_id));
  const allAssets = await read(ASSETS);
  const retainedVersions = [];
  if (retained.length && allAssets.some((asset) => dead.has(asset.campaign_id))) {
    // History is retained indefinitely; do not stop at PostgREST's first page.
    for (let offset = 0;; offset += 1000) {
      const page = await read("nothingsports_marquee_campaign_versions", {
        campaign_id: "in.(" + retained.map((c) => c.campaign_id).join(",") + ")",
        select: "snapshot", order: "campaign_id.asc,campaign_revision.asc",
        limit: "1000", offset: String(offset),
      });
      retainedVersions.push(...page);
      if (page.length < 1000) break;
    }
  }
  const retainedContent = [...retained, ...retainedVersions].map((record) => JSON.stringify(record));
  for (const asset of allAssets.filter((a) => dead.has(a.campaign_id))) {
    // Check every active draft, default and published/export snapshot before deleting an exclusive asset.
    if (
      retainedContent.some(
        (snapshot) =>
          snapshot.includes(asset.asset_id) ||
          Object.values(asset.public_urls || {}).some((url) =>
            snapshot.includes(url),
          ),
      )
    )
      continue;
    const prefixes = [
      asset.original_path,
      asset.portrait_path,
      asset.email_path,
      asset.live_path,
    ].filter(Boolean);
    if (prefixes.length)
      await request("/storage/v1/object/nothingsports-comms-assets", {
        method: "DELETE",
        body: { prefixes },
      });
    await request(query(ASSETS, { asset_id: "eq." + asset.asset_id }), {
      method: "DELETE",
    });
  }
  let removed = 0;
  for (const c of expired) {
    const deleted = await request(
      query(TABLE, {
        campaign_id: "eq." + c.campaign_id,
        campaign_revision: "eq." + c.campaign_revision,
      }),
      { method: "DELETE", headers: { Prefer: "return=representation" } },
    );
    removed += deleted?.length || 0;
  }
  return removed;
}
async function reconcile({ now = Date.now(), force = false,request=defaultRequest } = {}) {
  const {rpc}=scoped(request);
  const source = sources(),
    gateRevision = source.sourceRevision + ":" + SOURCE_POLICY,
    token = await rpc("nothingsports_comms_claim_refresh", {
      target_revision: gateRevision,
      force_refresh: force,
    });
  if (!token) return { skipped: true };
  let updated = 0,
    removed = 0;
  try {
    const batch = await prepare({ now,request });
    const items = batch.candidates.flatMap((candidate) => {
      const current = batch.stored.find(
        (c) => c.campaign_id === candidate.campaignId,
      );
      // Match the RPC's unchanged-content branch without transferring large
      // candidate/copy JSON again. Owner edits remain untouched in both cases.
      if (current?.content_hash === candidate.contentHash) return [];
      return [{
        id: candidate.campaignId,
        revision: Number(current?.campaign_revision || 0),
        candidate,
        copy: current
          ? content.protectCopy(
              current.candidate?.drafts || {},
              candidate.drafts,
              current.draft_copy || {},
            )
          : candidate.drafts,
        hash: candidate.contentHash,
        send: candidate.proposedSendAt,
      }];
    });
    // The RPC rejects more than 100 items. Smaller batches also fit the
    // dispatcher's per-request deadline; CAS keeps partial retries safe.
    for (let offset = 0; offset < items.length; offset += 50) {
      const result = await rpc("nothingsports_comms_sync_batch", { items:items.slice(offset, offset + 50) });
      updated += result.updated;
      if (result.conflicts)
        throw new Error(
          "Source refresh deferred concurrent edits; next refresh will retry.",
        );
    }
    removed = await purgePast(batch.stored, now,request);
    await request(
      query("nothingsports_comms_refresh_state", {
        singleton: "eq.true",
        lease_token: "eq." + token,
      }),
      {
        method: "PATCH",
        body: {
          source_revision: gateRevision,
          refreshed_at: new Date(now).toISOString(),
          lease_until: null,
          lease_token: null,
          last_error: null,
        },
      },
    );
    return { updated, removed };
  } catch (error) {
    await request(
      query("nothingsports_comms_refresh_state", {
        singleton: "eq.true",
        lease_token: "eq." + token,
      }),
      {
        method: "PATCH",
        body: {
          lease_until: null,
          lease_token: null,
          last_error: "content_refresh_failed",
        },
      },
    ).catch(() => {});
    throw error;
  }
}
module.exports = { prepare, syncOne, purgePast, reconcile, sources };
