#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const marquee = require("../config/marquee-campaigns");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "data/marquee-candidates.v1.json");
const IMAGE_DIRECTORY = path.join(ROOT, "assets/marquee");
const BRAND_LOGO = path.join(ROOT, "assets/brand/web/nothingsport-logo.png");
const PUBLIC_ORIGIN = "https://nothingsport.vercel.app";

function readJson(file){ return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256(value){ return crypto.createHash("sha256").update(value).digest("hex"); }
function canonicalJson(value){
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function xml(value){
  return String(value || "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" })[character]);
}
function wrapWords(value, maxCharacters = 25, maxLines = 4){
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  for (const word of words){
    const candidate = lines.length ? `${lines[lines.length - 1]} ${word}` : word;
    if (!lines.length || candidate.length > maxCharacters){
      if (lines.length >= maxLines) break;
      lines.push(word);
    } else lines[lines.length - 1] = candidate;
  }
  if (words.join(" ").length > lines.join(" ").length && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.…]+$/, "")}…`;
  return lines;
}
function canonicalEvents(){
  const manifest = readJson(path.join(ROOT, "data/feed/manifest.json"));
  const byId = new Map();
  (manifest.pages || []).forEach(page => {
    const document = readJson(path.join(ROOT, page.path));
    (document.events || []).forEach(event => {
      [event.canonicalEventId, event.eventId, event.id].filter(Boolean).forEach(id => byId.set(String(id), event));
    });
  });
  return byId;
}
function mergedEvent(event, canonical){
  if (!canonical) return event;
  return {
    ...event,
    ...canonical,
    storyline:event.storyline || canonical.storyline,
    selectedSentence:event.selectedSentence || canonical.selectedSentence,
    fullSpiel:event.fullSpiel || canonical.fullSpiel,
    sourceName:canonical.canonicalSourceName || canonical.sourceName || event.sourceName,
    sourceUrl:canonical.canonicalSourceUrl || canonical.sourceUrl || event.sourceUrl,
    sourceCheckedAt:canonical.canonicalSourceCheckedAt || canonical.sourceCheckedAt || event.sourceCheckedAt,
  };
}
function imageSvg(candidate, logoData){
  const titleLines = wrapWords(candidate.material.recognisableTitle || candidate.material.title, 24, 4);
  const hookLines = wrapWords(candidate.drafts.hook, 52, 3);
  const title = titleLines.map((line, index) => `<tspan x="72" dy="${index ? 86 : 0}">${xml(line)}</tspan>`).join("");
  const hook = hookLines.map((line, index) => `<tspan x="72" dy="${index ? 42 : 0}">${xml(line)}</tspan>`).join("");
  const sport = xml(candidate.material.sport || "SPORT").toUpperCase();
  const dateTime = xml(`${candidate.drafts.when.date} · ${candidate.drafts.when.time} ${candidate.drafts.when.timezone}`);
  return Buffer.from(`<svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="#09090b"/><rect width="18" height="1350" fill="#ff2d8d"/>
    <circle cx="976" cy="120" r="220" fill="#ff2d8d" opacity="0.12"/>
    <image href="data:image/png;base64,${logoData}" x="72" y="64" width="340" height="120" preserveAspectRatio="xMinYMid meet"/>
    <text x="72" y="265" fill="#ff2d8d" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="800" letter-spacing="5">UNMISSABLE · ${sport}</text>
    <text x="72" y="390" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="800">${title}</text>
    <text x="72" y="760" fill="#f1f1f1" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="650">${dateTime}</text>
    <rect x="72" y="812" width="300" height="78" rx="39" fill="#ff2d8d"/><text x="222" y="864" text-anchor="middle" fill="#09090b" font-family="Arial,Helvetica,sans-serif" font-size="35" font-weight="900">5/5 STAKES</text>
    <text x="72" y="980" fill="#d7d7db" font-family="Arial,Helvetica,sans-serif" font-size="31">${hook}</text>
    <line x1="72" y1="1195" x2="1008" y2="1195" stroke="#35353b" stroke-width="2"/><text x="72" y="1260" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="31" font-weight="700">nothingsport.vercel.app/live</text>
  </svg>`);
}
async function generateImage(candidate, logoData){
  const fileName = `${candidate.campaignId}-${candidate.contentHash.slice(0, 12)}.jpg`;
  const absolutePath = path.join(IMAGE_DIRECTORY, fileName);
  fs.mkdirSync(IMAGE_DIRECTORY, { recursive:true });
  await sharp(imageSvg(candidate, logoData)).jpeg({ quality:90, chromaSubsampling:"4:4:4", progressive:true }).toFile(absolutePath);
  return { path:`/assets/marquee/${fileName}`, publicUrl:`${PUBLIC_ORIGIN}/assets/marquee/${fileName}`, width:1080, height:1350, mimeType:"image/jpeg", firstPartyAssetsOnly:true };
}
function identityAsset(label, assetPath, registry, rightsStatus = "existing-app-identity"){
  return { label, path:assetPath, publicUrl:`${PUBLIC_ORIGIN}${assetPath}`, provenance:{ registry, rightsStatus } };
}
function identitiesFor(eventId, material){
  const codeBySport = {
    NRL:["NRL", "/assets/icons/sporticon/rugby.svg"],
    "Rugby League":["Rugby League", "/assets/icons/sporticon/rugby.svg"],
    "Rugby Union":["Rugby Union", "/assets/icons/sporticon/rugby.svg"],
    Ski:["Ski", "/assets/icons/sporticon/ski_and_snowboard.svg"],
  };
  const codeValue=codeBySport[material.sport]||[material.sport||"Sport","/assets/brand/web/nothingsport-app-icon.png"];
  const teams = eventId === "rugby-australia-new-zealand-2026-10-17" ? [
    identityAsset("Wallabies", "/assets/identities/national/rugby/wallabies.png", "national-team-identities.v1"),
    identityAsset("All Blacks", "/assets/identities/national/rugby/all-blacks.png", "national-team-identities.v1"),
  ] : eventId === "rlwc-australia-new-zealand-2026" ? [
    identityAsset("Kangaroos", "/assets/identities/national/rugby-league/kangaroos.svg", "national-team-identities.v1"),
    identityAsset("Kiwis", "/assets/identities/national/rugby-league/kiwis.svg", "national-team-identities.v1"),
  ] : [];
  return { code:identityAsset(codeValue[0], codeValue[1], "Sporticon Apache-2.0", "open_use"), teams };
}
function candidateFor(event, evidence, feedMeta, nowMs){
  const timing = evidence.timing;
  const copyIdentity = marquee.copyIdentity(event);
  const readyForExport = evidence.eligible;
  const hashMaterial = {
    title:marquee.clean(event.displayTitleCompact || event.name), participants:marquee.participantNames(event),
    sport:marquee.clean(event.sport || event.key), competition:marquee.clean(event.competition || event.competitionName || event.round),
    startTimeUtc:timing.startTimeUtc, endTimeUtc:timing.endTimeUtc, venue:marquee.clean(event.venueDisplayName || event.venue),
    broadcaster:marquee.clean(event.broadcaster), stakes:evidence.stakes, source:evidence.source,
  };
  const material = {
    ...hashMaterial,
    recognisableTitle:copyIdentity.recognisableTitle, matchupLabel:copyIdentity.matchupLabel,
    displayDate:marquee.clean(event.displayDateLabel || event.date),
  };
  // Copy labels and date-only display hints can improve without making an
  // otherwise unchanged canonical fixture look like changed source material.
  const contentHash = sha256(canonicalJson(hashMaterial));
  const campaignId = `marquee_${sha256(evidence.fixtureId).slice(0, 16)}`;
  const state = readyForExport ? marquee.campaignState(timing.startTimeUtc, nowMs) : { state:"watching", actionable:false, late:false };
  const drafts = marquee.draftCopy(event, timing);
  const proposedSendAt = readyForExport ? new Date(Date.parse(timing.startTimeUtc) - marquee.SEND_LEAD_MS).toISOString() : null;
  const fixtureUrl = `${PUBLIC_ORIGIN}/fixture/${encodeURIComponent(evidence.fixtureId)}?source=marquee&campaign=${campaignId}`;
  const ratingUrl = `${fixtureUrl}&intent=rate`;
  const identities=identitiesFor(evidence.fixtureId,material);
  const live={ headline:drafts.headline, hook:drafts.hook, kicker:`5/5 stakes · ${material.sport||"Sport"}`, heroAssetId:"", logos:{ showCode:true, showTeams:true, order:"code-first" }, focalPosition:{ x:50, y:50 }, animationPreset:"subtle" };
  return {
    campaignId, campaignRevision:1, contentHash, state:state.state, actionable:state.actionable, late:state.late,
    eventId:evidence.fixtureId, proposedSendAt, readyForExport, readinessIssues:[...evidence.reasons],
    machineSort:{ proposedSendAt, fixtureStartAt:timing.startTimeUtc||null, fixtureDate:material.displayDate||null },
    eligibilityEvidence:{ stakesExactlyFive:true, readyForExport, atomicType:evidence.atomicType || null, confirmedUtcStart:Boolean(timing.startTimeUtc), finish:timing.endTimeUtc ? (timing.endDerived ? "derived_from_live_window" : "confirmed_end") : "unconfirmed", status:evidence.status, sourceCheckedAt:evidence.source.checkedAt },
    timing:{ ...timing, sydneyStart:drafts.when, sydneyFinish:drafts.finish },
    source:{ ...evidence.source, revision:`${feedMeta.version || "feed"}@${feedMeta.publishedAt || "unknown"}` }, material, identities, live,
    drafts:{
      hook:drafts.hook, instagram:{ account:"@_nothingsports", caption:drafts.caption, altText:drafts.altText },
      email:{
        subject:drafts.subject,
        preheader:drafts.preheader,
        headline:drafts.headline,
        bodyParagraphs:drafts.bodyParagraphs,
        timingLine:drafts.timingLine,
        broadcastLine:drafts.broadcastLine,
        topic:"Marquee fixture alerts",
        primaryCta:{ label:"Open the fixture", url:fixtureUrl },
        secondaryCta:{ label:"Rate it after the finish", url:ratingUrl },
        suggestedSendAt:{ utc:proposedSendAt, sydney:proposedSendAt ? marquee.sydneyParts(proposedSendAt) : null },
        joinUrl:fixtureUrl,
        ratingUrl,
      },
      when:drafts.when, finish:drafts.finish,
      live,
    },
    channels:{
      instagram:{ status:"connector_blocked", adapter:"instagram-mcp", reason:"requested_connector_not_installed", enabled:false },
      email:{ status:"connector_blocked", adapter:"resend-broadcasts", reason:"operator_sender_configuration_required", enabled:false },
      x:{ enabled:false }, linkedin:{ enabled:false }, facebook:{ enabled:false },
    },
    participation:{ enabled:readyForExport, liveUrl:`${PUBLIC_ORIGIN}/live?source=marquee&campaign=${campaignId}`, fixtureUrl, ratingWindow:marquee.ratingWindow(timing) },
  };
}
async function build({ now = process.env.MARQUEE_NOW || new Date().toISOString() } = {}){
  const feed = readJson(path.join(ROOT, "data/events.json"));
  const feedMeta = readJson(path.join(ROOT, "data/feed-meta.json"));
  const canonical = canonicalEvents();
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error(`Invalid campaign reference time: ${now}`);
  const excluded = [], candidates = [];
  const futureFive = (feed.events || []).filter(event => Number(event?.storyline?.stakes) === 5 && !["completed", "past"].includes(String(event?.status || "").toLowerCase()));
  for (const sourceEvent of futureFive){
    const id = marquee.fixtureId(sourceEvent);
    const event = mergedEvent(sourceEvent, canonical.get(id));
    const evidence = marquee.eligibility(event, nowMs);
    if (!evidence.fixtureId){ excluded.push({ eventId:id, title:event.name || "", reasons:evidence.reasons }); continue; }
    candidates.push(candidateFor(event, evidence, feedMeta, nowMs));
  }
  candidates.sort((a,b)=>{
    const aSend=Date.parse(a.proposedSendAt||""),bSend=Date.parse(b.proposedSendAt||"");
    if(Number.isFinite(aSend)!==Number.isFinite(bSend))return Number.isFinite(aSend)?-1:1;
    if(Number.isFinite(aSend)&&aSend!==bSend)return aSend-bSend;
    return (a.timing.startTimeUtc||a.material.displayDate||"9999").localeCompare(b.timing.startTimeUtc||b.material.displayDate||"9999")||a.eventId.localeCompare(b.eventId);
  });
  const logoData = fs.readFileSync(BRAND_LOGO).toString("base64");
  for (const candidate of candidates){
    const image = await generateImage(candidate, logoData);
    image.altText=candidate.drafts.instagram.altText;
    candidate.drafts.instagram.image = image;
    candidate.drafts.email.image = { ...image, altText:candidate.drafts.instagram.altText };
    candidate.assets={ fallbackHero:image, suggestedHeroes:[image], uploadPolicy:"approved-media-only" };
    candidate.drafts.live.hero={...image};
    candidate.live.hero={...image};
  }
  const artifact = {
    schemaVersion:marquee.SCHEMA_VERSION, sourceRevision:`${feedMeta.version || "feed"}@${feedMeta.publishedAt || "unknown"}`,
    generatedAt:new Date(nowMs).toISOString(), shadowMode:true,
    summary:{ stakesFiveFuture:futureFive.length, shown:candidates.length, eligible:candidates.filter(c => c.readyForExport).length, watching:candidates.filter(c => !c.readyForExport).length, actionable:candidates.filter(c => c.actionable).length, late:candidates.filter(c => c.late).length },
    candidates, excluded:excluded.sort((a, b) => a.eventId.localeCompare(b.eventId)),
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Marquee candidates: ${artifact.summary.shown} shown, ${artifact.summary.eligible} export-ready, ${artifact.summary.watching} watching, ${artifact.summary.actionable} actionable, ${artifact.summary.late} late; ${excluded.length} excluded. Shadow mode wrote ${path.relative(ROOT, OUTPUT)}.`);
  return artifact;
}

if (require.main === module){
  const nowIndex = process.argv.indexOf("--now");
  build({ now:nowIndex >= 0 ? process.argv[nowIndex + 1] : undefined }).catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}
module.exports = { build, candidateFor, canonicalJson, canonicalEvents, sha256, wrapWords };
