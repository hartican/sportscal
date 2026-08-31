(function(root, factory){
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NOTHINGSPORT_MARQUEE = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildMarqueeCampaigns(){
  "use strict";

  const SCHEMA_VERSION = "marquee-candidates.v1";
  const CAMPAIGN_STATES = Object.freeze([
    "watching", "draft", "needs_review", "approved", "exported", "scheduled", "connector_blocked",
    "partially_published", "published", "needs_reapproval", "failed", "cancelled",
  ]);
  const ATOMIC_TYPES = new Set(["match", "fixture", "race", "session", "test", "final"]);
  const BLOCKED_STATUSES = new Set(["cancelled", "canceled", "postponed", "completed", "past"]);
  const MATERIAL_FIELDS = Object.freeze([
    "title", "participants", "startTimeUtc", "endTimeUtc", "venue", "broadcaster", "stakes", "source",
  ]);
  const ACTIONABLE_MS = 7 * 24 * 60 * 60 * 1000;
  const SEND_LEAD_MS = 48 * 60 * 60 * 1000;
  const RATING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_SOURCE_AGE_MS = 120 * 24 * 60 * 60 * 1000;
  const CURATED_COPY_IDENTITIES = Object.freeze({
    "rlwc-australia-new-zealand-2026":Object.freeze({
      recognisableTitle:"Rugby League World Cup opener",
      shortTitle:"World Cup opener",
      matchupLabel:"Kangaroos v Kiwis",
    }),
    "rugby-australia-new-zealand-2026-10-17":Object.freeze({
      recognisableTitle:"Bledisloe Cup — Sydney Test",
      shortTitle:"Bledisloe Cup",
      matchupLabel:"Wallabies v All Blacks",
    }),
  });

  function clean(value){ return String(value == null ? "" : value).trim(); }
  function instant(value){
    const parsed = Date.parse(clean(value));
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
  }
  function numberIn(value, minimum, maximum){
    const number = Number(value);
    return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
  }
  function fixtureId(event){ return clean(event?.canonicalEventId || event?.eventId || event?.id); }
  function sourceEvidence(event){
    return {
      name:clean(event?.canonicalSourceName || event?.sourceName || event?.source?.name),
      url:clean(event?.canonicalSourceUrl || event?.sourceUrl || event?.source?.url),
      checkedAt:instant(event?.canonicalSourceCheckedAt || event?.sourceCheckedAt || event?.source?.checkedAt),
    };
  }
  function participantNames(event){
    return (Array.isArray(event?.participants) ? event.participants : [])
      .map(participant => clean(participant?.name || participant?.label || participant))
      .filter(Boolean);
  }
  function copyIdentity(event){
    const provided = event?.marqueeCopy && typeof event.marqueeCopy === "object" ? event.marqueeCopy : {};
    const curated = CURATED_COPY_IDENTITIES[fixtureId(event)] || {};
    const ordinaryTitle = clean(event?.displayTitleCompact || event?.name || "Fixture");
    const recognisableTitle = clean(provided.recognisableTitle || curated.recognisableTitle || ordinaryTitle);
    const shortTitle = clean(provided.shortTitle || curated.shortTitle || recognisableTitle);
    const names = participantNames(event);
    const matchupLabel = clean(provided.matchupLabel || curated.matchupLabel || (names.length === 2 ? names.join(" v ") : ""));
    const context = clean(provided.context || event?.fullSpiel || event?.storyline?.synopsisSpoilerOff || event?.selectedSentence || event?.storyline?.hookSpoilerOff);
    return { recognisableTitle, shortTitle, matchupLabel, context };
  }
  function atomicType(event){
    const explicit = clean(event?.marqueeAtomicType || event?.narrativeType || event?.eventType || event?.type).toLowerCase();
    if (ATOMIC_TYPES.has(explicit)) return explicit;
    const override = event?.marqueeEligibilityOverride;
    if (override?.reviewed === true && ATOMIC_TYPES.has(clean(override.atomicType).toLowerCase())){
      return clean(override.atomicType).toLowerCase();
    }
    return "";
  }
  function timingFor(event){
    const startTimeUtc = instant(event?.startTimeUtc);
    const explicitEnd = instant(event?.endTimeUtc);
    const liveWindow = numberIn(event?.liveWindow, 0.25, 24);
    const endTimeUtc = explicitEnd || (startTimeUtc && liveWindow
      ? new Date(Date.parse(startTimeUtc) + liveWindow * 60 * 60 * 1000).toISOString()
      : "");
    return { startTimeUtc, endTimeUtc, liveWindowHours:liveWindow, endDerived:Boolean(!explicitEnd && endTimeUtc) };
  }
  function eligibility(event, nowValue = Date.now()){
    const now = Number(nowValue instanceof Date ? nowValue.getTime() : nowValue);
    const reasons = [];
    const stakes = Number(event?.storyline?.stakes);
    const id = fixtureId(event);
    const type = atomicType(event);
    const status = clean(event?.status).toLowerCase();
    const source = sourceEvidence(event);
    const timing = timingFor(event);
    const sourceAge = source.checkedAt ? now - Date.parse(source.checkedAt) : Infinity;
    if (!id) reasons.push("missing_canonical_event_id");
    if (stakes !== 5) reasons.push("stakes_not_five");
    if (!type) reasons.push("not_explicitly_atomic");
    if (BLOCKED_STATUSES.has(status)) reasons.push(`status_${status}`);
    if (!timing.startTimeUtc) reasons.push("unconfirmed_utc_start");
    if (!timing.endTimeUtc) reasons.push("missing_finish_or_live_window");
    if (!source.name || !/^https?:\/\//i.test(source.url) || !source.checkedAt) reasons.push("missing_source_provenance");
    if (Number.isFinite(sourceAge) && (sourceAge < -24 * 60 * 60 * 1000 || sourceAge > MAX_SOURCE_AGE_MS)) reasons.push("stale_source_provenance");
    if (timing.startTimeUtc && Date.parse(timing.startTimeUtc) <= now) reasons.push("not_future");
    return { eligible:reasons.length === 0, reasons, fixtureId:id, atomicType:type, status, stakes, source, timing };
  }
  function sydneyParts(value){
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return { date:"", time:"", day:"", timezone:"Sydney time" };
    const formatter = new Intl.DateTimeFormat("en-AU", {
      timeZone:"Australia/Sydney", weekday:"short", day:"numeric", month:"short", year:"numeric",
      hour:"numeric", minute:"2-digit", timeZoneName:"short",
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
    return {
      day:parts.weekday || "",
      weekday:new Intl.DateTimeFormat("en-AU", { timeZone:"Australia/Sydney", weekday:"long" }).format(date),
      date:[parts.weekday, parts.day, parts.month, parts.year].filter(Boolean).join(" "),
      time:[parts.hour, parts.minute].filter(Boolean).join(":") + (parts.dayPeriod ? ` ${parts.dayPeriod}` : ""),
      timezone:parts.timeZoneName || "Sydney time",
    };
  }
  function dateOnlyParts(event){
    const source = clean(event?.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) return { day:"", weekday:"", date:clean(event?.displayDateLabel) || "Date TBC", time:"Time TBC", timezone:"Sydney time" };
    const date = new Date(`${source}T00:00:00Z`);
    const short = new Intl.DateTimeFormat("en-AU", { timeZone:"UTC", weekday:"short", day:"numeric", month:"short", year:"numeric" }).formatToParts(date);
    const parts = Object.fromEntries(short.map(part => [part.type, part.value]));
    return {
      day:parts.weekday || "",
      weekday:new Intl.DateTimeFormat("en-AU", { timeZone:"UTC", weekday:"long" }).format(date),
      date:clean(event?.displayDateLabel) || [parts.weekday, parts.day, parts.month, parts.year].filter(Boolean).join(" "),
      time:"Time TBC",
      timezone:"Sydney time",
    };
  }
  function campaignState(startTimeUtc, nowValue = Date.now()){
    const until = Date.parse(startTimeUtc) - Number(nowValue instanceof Date ? nowValue.getTime() : nowValue);
    if (until <= SEND_LEAD_MS) return { state:"needs_review", actionable:true, late:true };
    if (until <= ACTIONABLE_MS) return { state:"draft", actionable:true, late:false };
    return { state:"watching", actionable:false, late:false };
  }
  function draftCopy(event, timing){
    const title = clean(event?.displayTitleCompact || event?.name || "Fixture");
    const identity = copyIdentity(event);
    const hook = clean(event?.storyline?.hookSpoilerOff || event?.selectedSentence || "A fixture worth making time for.");
    const venue = clean(event?.venueDisplayName || event?.venue);
    const broadcaster = clean(event?.broadcaster);
    const hasConfirmedStart = Boolean(timing.startTimeUtc);
    const when = hasConfirmedStart ? sydneyParts(timing.startTimeUtc) : dateOnlyParts(event);
    const finish = sydneyParts(timing.endTimeUtc);
    const matchupSuffix = identity.matchupLabel && !identity.recognisableTitle.toLowerCase().includes(identity.matchupLabel.toLowerCase()) ? `, ${identity.matchupLabel}` : "";
    const scheduleLabel = hasConfirmedStart ? `${when.day} ${when.time}` : `${when.date} · time TBC`;
    const subject = `5/5 stakes: ${identity.recognisableTitle}${matchupSuffix} — ${scheduleLabel}`.slice(0, 150);
    const preheader = `Join the ${identity.shortTitle} watch party, then rate it after the finish.`.slice(0, 150);
    const captionWhen = hasConfirmedStart ? `${when.date} at ${when.time} ${when.timezone}` : `${when.date}; exact time TBC`;
    const caption = `UNMISSABLE ${clean(event?.sport || event?.key || "SPORT").toUpperCase()}: ${identity.recognisableTitle}${matchupSuffix}. ${captionWhen}. 5/5 stakes. ${hook} Join the watch party and rate it afterwards — link in bio.`;
    const altText = `Nothing Sport UNMISSABLE card for ${identity.recognisableTitle}${matchupSuffix}, ${hasConfirmedStart ? `starting ${when.date} at ${when.time} ${when.timezone}` : `listed for ${when.date} with the exact start time to be confirmed`}.`;
    const headline = hasConfirmedStart ? `${when.weekday || when.day} watch party: ${identity.shortTitle}` : `${identity.shortTitle}: on the 5/5 watchlist`;
    const context = identity.context || hook;
    const invitationName = /^(?:the|a|an)\b/i.test(identity.recognisableTitle) ? identity.recognisableTitle : `the ${identity.recognisableTitle}`;
    const invitation = hasConfirmedStart
      ? `Join us for ${invitationName}${matchupSuffix}, on ${when.day} at ${when.time} ${when.timezone}. Open the fixture for the watch party, live context and post-match rating.`
      : `Join us for ${invitationName}${matchupSuffix}. We’ll add the exact fixture and Sydney start time as soon as the official schedule is confirmed.`;
    const bodyParagraphs = [
      context,
      invitation,
    ];
    const timingLine = hasConfirmedStart
      ? `${identity.recognisableTitle}${matchupSuffix} starts ${when.date} at ${when.time} ${when.timezone}${venue ? ` at ${venue}` : ""}. Expected finish: ${finish.time} ${finish.timezone}.`
      : `${identity.recognisableTitle}${matchupSuffix} is listed for ${when.date}; the exact fixture and Sydney start time still need confirmation.`;
    const broadcastLine = broadcaster ? `Watch in Australia on ${broadcaster}.` : "";
    return { title, identity, hook, when, finish, subject, preheader, caption, altText, headline, bodyParagraphs, timingLine, broadcastLine };
  }
  function ratingWindow(timing){
    if (!timing.endTimeUtc) return { opensAt:null, closesAt:null };
    return {
      opensAt:timing.endTimeUtc,
      closesAt:new Date(Date.parse(timing.endTimeUtc) + RATING_WINDOW_MS).toISOString(),
    };
  }

  return Object.freeze({
    ACTIONABLE_MS, ATOMIC_TYPES, CAMPAIGN_STATES, MATERIAL_FIELDS, MAX_SOURCE_AGE_MS,
    RATING_WINDOW_MS, SCHEMA_VERSION, SEND_LEAD_MS, atomicType, campaignState, clean,
    copyIdentity, draftCopy, eligibility, fixtureId, instant, participantNames, ratingWindow, sourceEvidence,
    sydneyParts, timingFor,
  });
});
