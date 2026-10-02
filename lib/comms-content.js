"use strict";
const crypto = require("node:crypto");
const marquee = require("../config/marquee-campaigns");
const identities = require("../config/card-identities");
const ORIGIN = "https://nothingsport.vercel.app",
  DAY = 86400000;
const hash = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const clean = (value) => String(value ?? "").trim();
function sydneyInstant(date, hour = 9) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  let guess = Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Australia/Sydney",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(guess))
        .map((p) => [p.type, p.value]),
    );
    const local = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`,
    );
    guess +=
      Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`) - local;
  }
  return new Date(guess).toISOString();
}
const sydneyDay = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
function dates(event) {
  const exact =
    event.startTimeUtc &&
    !event.timeTbc &&
    !event.startTimeTbc &&
    !event.dateOnly &&
    !["date-only", "unknown", "unconfirmed"].includes(event.timePrecision)
      ? marquee.instant(event.startTimeUtc)
      : "";
  const date = exact
    ? sydneyDay(exact)
    : clean(
        event.date || event.startDate || event.schedulingWindow?.startsOn,
      ).slice(0, 10);
  const start = exact || sydneyInstant(date);
  const end =
    marquee.instant(event.endTimeUtc) ||
    (event.endDate
      ? sydneyInstant(event.endDate, 23)
      : exact
        ? new Date(
            Date.parse(exact) + Number(event.liveWindow || 3) * 3600000,
          ).toISOString()
        : sydneyInstant(date, 23));
  return {
    startTimeUtc: exact || null,
    endTimeUtc: end || null,
    estimatedStartAt: exact ? null : start,
    fixtureDate: date,
    estimateBasis: exact ? "confirmed" : start ? "published-date" : "unknown",
    sydneyStart: exact
      ? marquee.sydneyParts(exact)
      : {
          ...(start ? marquee.sydneyParts(start) : {date: "Date TBC", day: ""}),
          time: "Time TBC",
          timezone: "Sydney time",
        },
    sydneyFinish: end ? marquee.sydneyParts(end) : {date: "Date TBC", time: "Time TBC", day: "", timezone: "Sydney time"},
  };
}
function past(event, now = Date.now()) {
  if (
    [
      "completed",
      "past",
      "finished",
      "final",
      "retired",
      "cancelled",
      "canceled",
      "abandoned",
    ].includes(clean(event.status || event.lifecycleStatus).toLowerCase())
  )
    return true;
  const end = Date.parse(dates(event).endTimeUtc || "");
  return Number.isFinite(end) && end <= +now;
}
function rating(event, community) {
  const mean = Number(community?.mean),
    count = Number(community?.count || 0),
    editorial = Number(
      event.storyline?.stakes ?? event.stakesScore ?? event.stakes,
    );
  const real = count > 0 && Number.isFinite(mean) && mean >= 1 && mean <= 5;
  const value = real
    ? Math.round(mean * 10) / 10
    : Number.isFinite(editorial) && editorial > 0
      ? editorial
      : null;
  return {
    value,
    editorialValue: Number.isFinite(editorial) ? editorial : null,
    rawMean: real ? mean : null,
    count: real ? count : 0,
    source: real ? "community" : "editorial",
    label:
      value == null
        ? "Stakes pending"
        : `${value.toFixed(1)}/5 ${real ? "community" : "editorial"} stakes`,
    animationPreset: real && mean > 4.8 ? "energy" : "subtle",
  };
}
function eligible(event, community, now = Date.now()) {
  if (/^ticket-sale:/.test(event.id || "")) return false;
  if (
    past(event, now) ||
    clean(event.status) === "postponed" ||
    event.lifecycleStatus === "retired"
  )
    return false;
  const start = Date.parse(
    dates(event).startTimeUtc || dates(event).estimatedStartAt || "",
  );
  if (Number.isFinite(start) && start > +now + 366 * DAY) return false;
  return (
    event.commsKind === "major-event" ||
    Number(event.storyline?.stakes ?? event.stakesScore) === 5 ||
    (Number(community?.count) > 0 && Number(community.mean) >= 4.8)
  );
}
function stripHeading(value) {
  return clean(value).replace(
    /^(?:why it matters(?:\s*\([^)]*\))?|form|match context|storyline|cta)\s*[:|–—-]\s*/i,
    "",
  );
}
function editorial(event) {
  const n = event.editorialNarrative || {},
    hook = stripHeading(
      n.hook ||
        event.whyItMatters ||
        event.storyline?.hookSpoilerOff ||
        event.selectedSentence ||
        event.summary ||
        event.name,
    );
  const values = [
    hook,
    n.formCopy || event.formCopy,
    n.matchContext ||
      n.matchContextCopy ||
      n.synopsis ||
      event.fullSpiel ||
      event.storyline?.synopsisSpoilerOff,
    n.closingCopy || n.storylineCopy || event.storylineCopy,
  ];
  const seen = new Set();
  const body = values
    .flatMap((v) => clean(v).split(/\n\s*\n/))
    .map(stripHeading)
    .filter((v) => {
      if (!v || seen.has(v)) return false;
      seen.add(v);
      return true;
    });
  return {
    hook,
    body,
    sourceIds: n.sourceIds || [],
    researchedAt: n.researchedAt || event.sourceCheckedAt || null,
  };
}
function asset(mark) {
  const glyphFiles = {
    "sport:motorsport": "motorsports",
    "sport:rugby": "rugby",
    "sport:tennis": "tennis",
    "sport:football": "soccer",
    "sport:cycling": "cycling",
    "sport:golf": "golf",
    "sport:skiing": "ski_and_snowboard",
    "sport:american-football": "american_football",
    "sport:australian-football": "australian_football",
    "sport:basketball": "basketball",
  };
  let url =
    mark?.logo?.dark ||
    mark?.url ||
    mark?.logo?.primary ||
    (glyphFiles[mark?.glyph]
      ? "/assets/icons/sporticon/" + glyphFiles[mark.glyph] + ".svg"
      : null);
  if (!url) return null;
  if (!/^https?:|^\//.test(url)) url = "/" + url;
  return {
    label: mark.label || mark.name || "",
    path: url,
    publicUrl: url.startsWith("/") ? ORIGIN + url : url,
    provenance: {
      registry: "card-identities.v4",
      sourceUrl: mark.sourceUrl || "",
      rightsStatus: mark.rightsStatus || "existing-app-identity",
    },
  };
}
function marks(event) {
  const teams = identities
    .participantMarksForEvent(event, undefined, event.name || "")
    .map((item) => asset(item.mark))
    .filter(Boolean);
  const reference = identities.markForEvent(event),
    sportKey = String(event.key || event.sport || "").toLowerCase(),
    open =
      identities.sportMarks[sportKey] ||
      (/nrl|rugby/.test(sportKey) ? identities.sportMarks.rugby : null) ||
      (/afl/.test(sportKey)
        ? {
            label: "AFL",
            glyph: "sport:australian-football",
            rightsStatus: "open-use",
            sourceUrl: "https://github.com/ookamiinc/sporticon",
          }
        : null);
  const code = asset(reference?.rightsStatus === "open-use" ? reference : open);
  return {
    teams,
    code: code || {
      label: event.sport || event.sportLabel || "Sport",
      path: "/assets/brand/web/nothingsport-app-icon.png",
      publicUrl: ORIGIN + "/assets/brand/web/nothingsport-app-icon.png",
      provenance: { registry: "Nothing Sport", rightsStatus: "owned" },
    },
  };
}
function postingSlots(event, now = Date.now(), existing = []) {
  const t = dates(event),
    start = Date.parse(t.startTimeUtc || t.estimatedStartAt || "");
  if (!Number.isFinite(start))
    return [{ kind: "day-of", at: null, estimated: true }];
  const preview = start - 72 * 3600000,
    day = Date.parse(sydneyInstant(t.fixtureDate)),
    dayAt = t.startTimeUtc && day >= start ? start - 2 * 3600000 : day;
  const hadPreview = existing.some(
    (c) =>
      c.candidate?.posting?.kind === "preview" ||
      (!c.candidate?.posting && c.candidate?.campaignId),
  );
  const slots = [];
  if (preview > +now || hadPreview)
    slots.push({
      kind: "preview",
      at: new Date(preview).toISOString(),
      estimated: !t.startTimeUtc,
    });
  slots.push({
    kind: "day-of",
    at: new Date(dayAt).toISOString(),
    estimated: !t.startTimeUtc,
    mergedPreview: preview <= +now && !hadPreview,
  });
  return slots;
}
function candidate(event, slot, community, revision = "published") {
  const eventId = marquee.fixtureId(event),
    campaignId = `marquee_${crypto
      .createHash("sha256")
      .update(slot.kind === "preview" ? eventId : `${eventId}:day-of`)
      .digest("hex")
      .slice(0, 16)}`,
    t = dates(event),
    r = rating(event, community),
    e = editorial(event),
    identity = marquee.copyIdentity(event);
  const title = event.publicStageLabel
    ? `${event.publicStageLabel}${identity.matchupLabel ? `: ${identity.matchupLabel}` : ""}`
    : identity.recognisableTitle;
  const name = identity.shortTitle || title,
    url =
      event.commsKind === "major-event"
        ? `${ORIGIN}/?tab=events&event=${encodeURIComponent(eventId)}`
        : `${ORIGIN}/?event=${encodeURIComponent(event.id || eventId)}`;
  const fixtureUrl = `${ORIGIN}/fixture/${encodeURIComponent(eventId)}?campaign=${campaignId}`;
  const when = t.startTimeUtc
    ? `${t.sydneyStart.date} at ${t.sydneyStart.time} ${t.sydneyStart.timezone}`
    : `${t.sydneyStart.date || event.displayDateLabel || "Date TBC"}; exact start time to be confirmed`;
  const invitation = `${name} is ${when}${event.venue ? ` at ${event.venue}` : ""}. Set a reminder, rate your expectations, or join or set up a watch party on Nothing Sport.`;
  const body = [...e.body, invitation].slice(0, 8),
    image = {
      path: "/assets/brand/web/nothingsport-logo.png",
      publicUrl: ORIGIN + "/assets/brand/web/nothingsport-logo.png",
      width: 1080,
      height: 1350,
      mimeType: "image/png",
      firstPartyAssetsOnly: true,
      altText: `Nothing Sport: ${title}. ${when}.`,
    };
  const material = {
    title,
    recognisableTitle: title,
    matchupLabel: identity.matchupLabel,
    participants: marquee.participantNames(event),
    sport: event.sport || event.sportLabel || event.key || "Sport",
    competition: event.competitionId || "",
    venue: event.venue || "",
    broadcaster: event.broadcaster || "",
    displayDate: t.fixtureDate,
    stakes: r.value,
    rating: r,
    kind: event.commsKind || "fixture",
  };
  const live = {
    headline: title,
    hook: e.hook,
    kicker: `${r.label} · ${material.sport}`,
    hero: image,
    heroAssetId: "",
    logos: { showCode: true, showTeams: true, order: "teams-first" },
    focalPosition: { x: 50, y: 50 },
    animationPreset: r.animationPreset,
  };
  const time = slot.at ? marquee.sydneyParts(slot.at) : null,
    source = { ...marquee.sourceEvidence(event), revision };
  const email = {
    subject:
      `${slot.kind === "day-of" ? "Today" : "Coming up"}: ${title}`.slice(
        0,
        150,
      ),
    preheader: e.hook.slice(0, 150),
    headline: title,
    bodyParagraphs: body,
    timingLine: `${title}: ${when}.`,
    broadcastLine: event.broadcaster
      ? `Watch in Australia on ${event.broadcaster}.`
      : "",
    primaryCta: { label: "Set a reminder / rate / watch party", url },
    secondaryCta: {
      label: "Open live countdown",
      url: `${ORIGIN}/live?campaign=${campaignId}`,
    },
    image,
    suggestedSendAt: { utc: slot.at, sydney: time },
    joinUrl: url,
    ratingUrl: url,
  };
  const draft = {
    hook: e.hook,
    email,
    instagram: {
      caption: `${e.hook}\n\n${invitation}`,
      image,
      altText: image.altText,
    },
    when: t.sydneyStart,
    finish: t.sydneyFinish,
    live,
  };
  const contentHash = hash({
    material,
    timing: t,
    editorial: e,
    slot: { kind: slot.kind, at: slot.at, estimated: slot.estimated },
    identities: marks(event),
  });
  return {
    campaignId,
    campaignRevision: 1,
    eventId,
    contentHash,
    state: "draft",
    actionable: true,
    late: false,
    proposedSendAt: slot.at,
    posting: slot,
    readyForExport: true,
    readinessIssues: !t.startTimeUtc ? ["estimated_post_time"] : [],
    machineSort: {
      proposedSendAt: slot.at,
      fixtureStartAt: t.startTimeUtc,
      fixtureDate: t.fixtureDate || null,
    },
    eligibilityEvidence: {
      stakesExactlyFive:
        Number(event.storyline?.stakes ?? event.stakesScore) === 5,
      communityEligible: r.rawMean >= 4.8 && r.count > 0,
      majorEvent: event.commsKind === "major-event",
      confirmedUtcStart: !!t.startTimeUtc,
    },
    timing: t,
    source,
    material,
    identities: marks(event),
    live,
    drafts: draft,
    editorial: e,
    assets: {
      fallbackHero: image,
      suggestedHeroes: [image],
      uploadPolicy: "approved-media-only",
    },
    channels: { email: { enabled: false }, social: { enabled: false } },
    participation: {
      enabled: !!t.startTimeUtc,
      liveUrl: `${ORIGIN}/live?campaign=${campaignId}`,
      fixtureUrl,
      eventUrl: url,
      ratingWindow: marquee.ratingWindow(t),
    },
  };
}
function protectCopy(previous, generated, current) {
  const changed = [],
    merge = (old, next, user, path = "") => {
      if (Array.isArray(next) || next === null || typeof next !== "object") {
        if (
          user !== undefined &&
          JSON.stringify(user) !== JSON.stringify(old)
        ) {
          if (
            JSON.stringify(next) !== JSON.stringify(user) &&
            JSON.stringify(next) !== JSON.stringify(old)
          )
            changed.push({ field: path, suggested: next });
          return user;
        }
        return next;
      }
      const out = {};
      for (const key of new Set([
        ...Object.keys(next),
        ...Object.keys(user || {}),
      ]))
        out[key] = merge(
          old?.[key],
          next[key],
          user?.[key],
          path ? `${path}.${key}` : key,
        );
      return out;
    };
  const result = merge(previous, generated, current);
  // Facts and computed presentation always follow source; prose and hero edits remain protected.
  result.email.suggestedSendAt = generated.email.suggestedSendAt;
  result.live.logos = { ...result.live.logos, order: "teams-first" };
  result.live.animationPreset = generated.live.animationPreset;
  result.live.kicker = generated.live.kicker;
  result.cms = {
    ...(current.cms || {}),
    suggestedChanges: changed.filter(
      (c) =>
        !/^email.suggestedSendAt|^live.(animationPreset|logos.order|kicker)/.test(
          c.field,
        ),
    ),
  };
  return result;
}
module.exports = {
  ORIGIN,
  DAY,
  hash,
  sydneyInstant,
  sydneyDay,
  dates,
  past,
  rating,
  eligible,
  editorial,
  postingSlots,
  candidate,
  marks,
  protectCopy,
};
