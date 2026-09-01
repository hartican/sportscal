(function(root, factory){
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NOTHINGSPORTS_NOTHINGSCORE = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingscore(){
  "use strict";

  const SCHEMA_VERSION = "nothingscore.v1";
  const PHASES = Object.freeze(["heat", "pulse", "impact"]);
  const PERSONA_WEIGHTS = Object.freeze({ general:1, pundit:1, rising:2, influencer:4, curator:8, editorial:8, admin:8 });
  const HEAT_LABELS = Object.freeze(["Routine", "Interesting", "Notable", "Major", "Essential"]);
  const PULSE_LABELS = Object.freeze(["Flat", "Solid", "Strong", "Exceptional", "Unforgettable"]);
  const IMPACT_LABELS = PULSE_LABELS;
  const HEAT_TAGS = Object.freeze(["Box office", "Big stakes", "Rivalry", "Star power", "National interest", "Great storyline"]);
  const IMPACT_TAGS = Object.freeze(["Thrilling", "Eye-popping", "Mind-blowing", "Emotional", "Electric atmosphere", "Pure chaos"]);
  const HEAT_LOW_TAGS = Object.freeze(["Rising storyline", "Emerging talent", "Low expectations", "Bog standard", "Too one-sided", "Hard to care"]);
  const IMPACT_LOW_TAGS = Object.freeze(["Boring", "Standard", "Mediocre", "Underwhelming", "One-sided", "Disappointing"]);
  const POINT_RULES = Object.freeze({ heat:2, first_like:1, watching:1, pulse:1, pulse_15m:1, impact:3, valid_tags:1 });
  const PULSE_BUCKET_MS = 5 * 60 * 1000;
  const PULSE_FRESH_MS = 10 * 60 * 1000;
  const PRESENCE_TTL_MS = 150 * 1000;

  function clamp(value, minimum, maximum){ return Math.max(minimum, Math.min(maximum, Number(value) || 0)); }
  function instant(value){
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : Number(value);
  }
  function round1(value){ return Math.round(Number(value) * 10) / 10; }
  function personaWeight(persona){ return PERSONA_WEIGHTS[String(persona || "general").toLowerCase()] || 1; }
  function likeLift(activeLikes){ return Math.min(0.35, 0.05 * Math.sqrt(Math.max(0, Number(activeLikes) || 0))); }
  function ratingContribution(row){
    const rating = Number(row?.rating);
    return Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : null;
  }
  function weightedMean(rows){
    let weighted = 0, weight = 0;
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const rating = ratingContribution(row);
      if (rating === null) return;
      const rowWeight = personaWeight(row.persona);
      weighted += rating * rowWeight;
      weight += rowWeight;
    });
    return weight ? weighted / weight : null;
  }
  function effectiveSupport(rows, activeLikes){
    const ratingWeight = (Array.isArray(rows) ? rows : []).reduce((total, row) => total + (ratingContribution(row) === null ? 0 : personaWeight(row.persona)), 0);
    return round1(ratingWeight + Math.min(7, Math.max(0, Number(activeLikes) || 0) * 0.25));
  }
  function leadingTags(rows, limit = 3){
    const counts = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => (Array.isArray(row.tags) ? row.tags : []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + personaWeight(row.persona))));
    return [...counts.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([tag,count])=>({ tag, support:count }));
  }
  function aggregateRatings(rows, activeLikes = 0, { seed = null } = {}){
    const valid = (Array.isArray(rows) ? rows : []).filter(row => ratingContribution(row) !== null);
    let rating = weightedMean(valid), weight = valid.reduce((total,row)=>total+personaWeight(row.persona),0), seedWeight = 0;
    if (seed && Number.isFinite(Number(seed.rating)) && Number(seed.weight) > 0){
      seedWeight = Number(seed.weight);
      rating = rating === null ? Number(seed.rating) : ((rating * weight) + Number(seed.rating) * seedWeight) / (weight + seedWeight);
      weight += seedWeight;
    }
    const lift = likeLift(activeLikes);
    const displayScore = rating === null ? null : round1(clamp(rating + lift, 1, 5));
    return {
      score:displayScore,
      building:rating === null,
      internalScore:round1(clamp((rating === null ? 3 : rating) + lift, 1, 5)),
      ratingCount:valid.length,
      contributorCount:new Set(valid.map(row=>String(row.userId||row.user_id||"anonymous"))).size,
      likeCount:Math.max(0, Number(activeLikes) || 0),
      support:round1(effectiveSupport(valid, activeLikes)+seedWeight),
      personaWeight:round1(weight),
      leadingTags:leadingTags(valid),
    };
  }
  function pulseBucket(value){
    const instant = Number(value instanceof Date ? value.getTime() : new Date(value).getTime());
    return Number.isFinite(instant) ? new Date(Math.floor(instant / PULSE_BUCKET_MS) * PULSE_BUCKET_MS).toISOString() : "";
  }
  function pulseAggregate(rows, nowValue = Date.now()){
    const now = instant(nowValue);
    const byUser = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const updated = Date.parse(row.updatedAt || row.updated_at || row.bucketStart || row.bucket_start || "");
      const rating = ratingContribution(row);
      const userId = String(row.userId || row.user_id || "");
      if (!userId || rating === null || !Number.isFinite(updated) || updated > now + 60000) return;
      const record = byUser.get(userId) || { userId, persona:row.persona, ratings:[], lastUpdated:0 };
      record.ratings.push(rating); record.persona=row.persona || record.persona; record.lastUpdated=Math.max(record.lastUpdated,updated); byUser.set(userId,record);
    });
    const users = [...byUser.values()].filter(record=>now-record.lastUpdated<=PULSE_FRESH_MS).map(record => ({ userId:record.userId, persona:record.persona, rating:record.ratings.reduce((sum,value)=>sum+value,0)/record.ratings.length }));
    return { ...aggregateRatings(users, 0), uniqueContributors:users.length, bucketContributions:(Array.isArray(rows)?rows:[]).length };
  }
  function activePresence(rows, nowValue = Date.now()){
    const now = instant(nowValue);
    return (Array.isArray(rows) ? rows : []).filter(row => { const seen=Date.parse(row.lastHeartbeatAt||row.last_heartbeat_at||""); return Number.isFinite(seen)&&now-seen<=PRESENCE_TTL_MS&&seen<=now+60000; });
  }
  function impactSeed(eventPulseMean, uniquePulseContributors){
    const pulse = clamp(eventPulseMean || 3, 1, 5);
    return { rating:round1(clamp(3 + 0.7 * (pulse - 3), 1, 5)), weight:round1(Math.min(10, 2 * Math.sqrt(Math.max(0, Number(uniquePulseContributors) || 0)))) };
  }
  function phaseFor({ startTimeUtc, endTimeUtc, liveWindowHours = 3, session } = {}, nowValue = Date.now()){
    const now = instant(nowValue);
    const start = Date.parse(startTimeUtc || "");
    const derivedEnd = Number.isFinite(start) ? start + clamp(liveWindowHours, .25, 24) * 3600000 : NaN;
    const end = Date.parse(session?.effectiveEndAt || endTimeUtc || "") || derivedEnd;
    if (session?.status === "active" && now >= Date.parse(session.effectiveStartAt || startTimeUtc || "") && now < end) return "pulse";
    if (Number.isFinite(end) && now >= end) return "impact";
    return "heat";
  }
  function blendBand(support){
    const value = Number(support) || 0;
    if (value < 3) return 0;
    if (value < 10) return .25;
    if (value < 25) return .5;
    return .75;
  }
  function blendHeatWithStakes(stakes, heatScore, support){
    const weight = blendBand(support);
    const canonical = clamp(stakes, 1, 5);
    const heat = Number.isFinite(Number(heatScore)) ? clamp(heatScore, 1, 5) : canonical;
    return { score:round1(canonical * (1-weight) + heat * weight), heatWeight:weight, stakesWeight:1-weight };
  }
  function tagsFor(phase, rating){
    const score = Number(rating);
    if (!Number.isFinite(score) || score < 1 || score > 5) return [];
    if (phase === "heat") return score <= 3 ? [...HEAT_LOW_TAGS] : [...HEAT_TAGS];
    if (phase === "impact") return score <= 3 ? [...IMPACT_LOW_TAGS] : [...IMPACT_TAGS];
    return [];
  }
  function validTags(phase, rating, tags){
    const allowed = tagsFor(phase, rating);
    return [...new Set((Array.isArray(tags)?tags:[]).map(String).filter(tag=>allowed.includes(tag)))].slice(0,3);
  }
  function labelFor(phase, score){
    const index = Math.max(0, Math.min(4, Math.round(clamp(score,1,5))-1));
    return (phase === "heat" ? HEAT_LABELS : phase === "impact" ? IMPACT_LABELS : PULSE_LABELS)[index];
  }
  function pointValue(kind){ return POINT_RULES[kind] || 0; }
  function capPointAwards(existingFixturePoints, existingDayPoints, requested){
    return Math.max(0, Math.min(Number(requested)||0, 10-Math.max(0,Number(existingFixturePoints)||0), 25-Math.max(0,Number(existingDayPoints)||0)));
  }
  function leaderboardSort(entries){
    return (Array.isArray(entries)?entries:[]).slice().sort((a,b)=>(Number(b.points)||0)-(Number(a.points)||0)||(Number(b.uniqueFixtures)||0)-(Number(a.uniqueFixtures)||0)||Date.parse(a.attainedAt||"")-Date.parse(b.attainedAt||"")||String(a.handle||"").localeCompare(String(b.handle||"")));
  }
  function normaliseHandle(value){ const handle=String(value||"").trim().toLowerCase().replace(/^@/,""); return /^[a-z0-9_]{3,24}$/.test(handle)?handle:""; }

  return Object.freeze({
    HEAT_LABELS, HEAT_LOW_TAGS, HEAT_TAGS, IMPACT_LABELS, IMPACT_LOW_TAGS, IMPACT_TAGS, PERSONA_WEIGHTS, PHASES, POINT_RULES,
    PRESENCE_TTL_MS, PULSE_BUCKET_MS, PULSE_FRESH_MS, PULSE_LABELS, SCHEMA_VERSION,
    activePresence, aggregateRatings, blendBand, blendHeatWithStakes, capPointAwards, effectiveSupport,
    impactSeed, labelFor, leaderboardSort, likeLift, normaliseHandle, personaWeight, phaseFor,
    pointValue, pulseAggregate, pulseBucket, tagsFor, validTags, weightedMean,
  });
});
