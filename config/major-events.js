(function attachNothingSportsMajorEvents(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_MAJOR_EVENTS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsMajorEvents(){
  "use strict";

  const SCHEMA_VERSION = "major-events.v1";
  const PAST_WINDOW_DAYS = 7;
  const FORWARD_WINDOW_MONTHS = 12;
  const MARKERS = Object.freeze([
    { id: "major-event:cincinnati-open-2026", name: "Cincinnati Open", sportKey: "tennis", sportKeys: ["tennis", "wimbledon"], startDate: "2026-08-08", endDate: "2026-08-23", stakesScore: 5 },
    { id: "major-event:us-open-2026", name: "US Open 2026", sportKey: "tennis", sportKeys: ["tennis", "wimbledon"], startDate: "2026-08-23", endDate: "2026-09-13", stakesScore: 5 },
    { id: "major-event:afl-finals-series-2026", name: "2026 Toyota AFL Finals Series", sportKey: "afl", sportKeys: ["afl"], startDate: "2026-08-28", endDate: "2026-09-26", stakesScore: 5, replacesFixtureIds: ["event-afl-cd_m20260142901"] },
    { id: "major-event:nrl-finals-series-2026", name: "2026 NRL Finals Series", sportKey: "nrl", sportKeys: ["nrl"], startDate: "2026-09-12", endDate: "2026-10-04", stakesScore: 5, replacesFixtureIds: ["evt_81", "evt_82", "evt_83", "evt_84"] },
    { id: "major-event:rlwc-2026", name: "Rugby League World Cup 2026", sportKey: "nrl", sportKeys: ["nrl"], startDate: "2026-10-15", endDate: "2026-11-15", stakesScore: 5 },
    { id: "major-event:nations-championship-finals-2026", name: "2026 Nations Championship Finals Weekend", sportKey: "rugby", sportKeys: ["rugby"], startDate: "2026-11-28", endDate: "2026-11-30", stakesScore: 5 },
    { id: "major-event:uefa-champions-league-2026-27", name: "UEFA Champions League 2026/27", sportKey: "football", sportKeys: ["football"], startDate: "2026-07-07", endDate: "2027-06-05", stakesScore: 5 },
    { id: "major-event:australian-open-2027", name: "Australian Open 2027", sportKey: "tennis", sportKeys: ["tennis", "wimbledon"], startDate: "2027-01-11", endDate: "2027-01-31", stakesScore: 5 },
  ].map(marker => Object.freeze({ ...marker, sportKeys: Object.freeze(marker.sportKeys) })));

  function dateKey(value, timeZone = "Australia/Sydney"){
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function addDays(date, count){
    const copy = new Date(`${date}T00:00:00Z`);
    copy.setUTCDate(copy.getUTCDate() + count);
    return copy.toISOString().slice(0, 10);
  }

  function addMonths(date, count){
    const source = new Date(`${date}T00:00:00Z`);
    const day = source.getUTCDate();
    source.setUTCDate(1);
    source.setUTCMonth(source.getUTCMonth() + count);
    const lastDay = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 0)).getUTCDate();
    source.setUTCDate(Math.min(day, lastDay));
    return source.toISOString().slice(0, 10);
  }

  function followed(record, followedSports){
    const selected = new Set(Array.isArray(followedSports) ? followedSports : []);
    const keys = Array.isArray(record?.sportKeys) && record.sportKeys.length ? record.sportKeys : [record?.sportKey];
    return keys.some(key => selected.has(key));
  }

  function activeTicketing(record, reference = new Date()){
    if (!["on_sale", "presale", "waitlist", "register_interest"].includes(record?.ticketing?.status)) return false;
    const referenceTime = reference instanceof Date ? reference.getTime() : new Date(reference).getTime();
    const saleEndTime = record.ticketing.saleEndAt ? new Date(record.ticketing.saleEndAt).getTime() : null;
    if (!Number.isFinite(referenceTime)) return false;
    return !(Number.isFinite(saleEndTime) && referenceTime > saleEndTime);
  }

  function inWindow(record, reference = new Date()){
    const today = dateKey(reference);
    if (!today) return false;
    const earliest = addDays(today, -PAST_WINDOW_DAYS);
    const latest = addMonths(today, FORWARD_WINDOW_MONTHS);
    const start = record?.startDate;
    const end = record?.endDate || start;
    if (start && end) return end >= earliest && start <= latest;
    const season = Number(record?.season);
    return record?.dateStatus === "tbc"
      && season >= Number(today.slice(0, 4))
      && season <= Number(latest.slice(0, 4))
      && activeTicketing(record, reference);
  }

  function visibleRecords(document, followedSports, reference = new Date()){
    const records = Array.isArray(document?.events) ? document.events : [];
    const parents = records.filter(record => record.kind !== "ticket_sale" && record.stakesScore === 5 && followed(record, followedSports) && inWindow(record, reference));
    const parentIds = new Set(parents.map(record => record.id));
    const alerts = records.filter(record => record.kind === "ticket_sale" && parentIds.has(record.parentEventId) && activeTicketing(record, reference));
    return {
      events: parents.slice().sort((left, right) => compareRecords(left, right, reference)),
      alerts: alerts.slice().sort((left, right) => compareRecords(left, right, reference)),
    };
  }

  function recordLifecycleTime(record, reference = new Date()){
    const referenceTime = reference instanceof Date ? reference.getTime() : new Date(reference).getTime();
    const concreteTimes = (record?.subEvents || [])
      .map(subEvent => new Date(subEvent?.startTimeUtc || "").getTime())
      .filter(Number.isFinite)
      .sort((first, second) => first - second);
    const nextConcreteTime = concreteTimes.find(time => time >= referenceTime);
    if (Number.isFinite(nextConcreteTime)) return nextConcreteTime;
    const ticketTime = new Date(record?.ticketing?.saleStartAt || "").getTime();
    if (Number.isFinite(ticketTime) && ticketTime >= referenceTime) return ticketTime;
    const phaseTime = new Date(`${record?.phaseStartDate || record?.startDate || ""}T00:00:00Z`).getTime();
    if (Number.isFinite(phaseTime) && phaseTime >= referenceTime) return phaseTime;
    const endTime = new Date(`${record?.phaseEndDate || record?.endDate || ""}T23:59:59Z`).getTime();
    if (Number.isFinite(endTime)) return endTime;
    if (Number.isFinite(phaseTime)) return phaseTime;
    return Number.MAX_SAFE_INTEGER;
  }

  function compareRecords(left, right, reference = new Date()){
    return recordLifecycleTime(left, reference) - recordLifecycleTime(right, reference)
      || String(left.id).localeCompare(String(right.id));
  }

  function fixtureFromSubEvent(subEvent, parent){
    if (!subEvent?.id || !subEvent?.startTimeUtc) return null;
    const instant = new Date(subEvent.startTimeUtc);
    if (Number.isNaN(instant.getTime())) return null;
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(instant).map(part => [part.type, part.value]));
    return {
      id: subEvent.id,
      eventId: subEvent.id,
      canonicalEventId: subEvent.id,
      actionKey: subEvent.id,
      cardKind: "fixture",
      key: parent.sportKey,
      sport: parent.sportLabel,
      competitionId: parent.competitionId,
      roundLabel: subEvent.roundLabel || subEvent.stage || null,
      stage: subEvent.stage || subEvent.roundLabel || null,
      majorEventId: parent.id,
      majorEventParentId: parent.id,
      manualPin: true,
      name: subEvent.name,
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
      startTimeUtc: subEvent.startTimeUtc,
      venue: subEvent.venue || parent.venue,
      status: subEvent.status || "scheduled",
      ...(subEvent.scoreDisplay ? { scoreDisplay: subEvent.scoreDisplay, score: subEvent.scoreDisplay } : {}),
      stakesScore: Number(subEvent.stakesScore || parent.stakesScore || 5),
      expected: Number(subEvent.expected || 8),
      participants: subEvent.participants || [],
      participantIds: subEvent.participantIds || [],
      broadcaster: subEvent.broadcaster || parent.broadcaster || null,
      broadcasterIds: subEvent.broadcasterIds || parent.broadcasterIds || [],
      broadcastOptions: subEvent.broadcastOptions || parent.broadcastOptions || [],
      viewingOptions: subEvent.viewingOptions || parent.viewingOptions || [],
      isInternational: subEvent.isInternational === true || parent.isInternational === true || parent.competitionScope === "international",
      competitionScope: subEvent.competitionScope || parent.competitionScope || "domestic",
      representativeCountryCodes: subEvent.representativeCountryCodes || parent.representativeCountryCodes || [],
      ticketing: subEvent.ticketing || parent.ticketing || null,
      sourceName: subEvent.sourceName || parent.sources?.[0]?.name,
      sourceUrl: subEvent.sourceUrl || parent.sources?.[0]?.url,
      selectedSentence: subEvent.summary || "Exact matchup, venue and kickoff will be refreshed when the published schedule is confirmed.",
      fullSpiel: subEvent.summary || "Exact matchup, venue and kickoff will be refreshed when the published schedule is confirmed.",
    };
  }

  function markerEvents(followedSports, reference = new Date()){
    const today = dateKey(reference);
    const earliest = addDays(today, -PAST_WINDOW_DAYS);
    const latest = addMonths(today, FORWARD_WINDOW_MONTHS);
    return MARKERS
      .filter(marker => marker.stakesScore === 5 && followed(marker, followedSports) && marker.startDate >= earliest && marker.startDate <= latest)
      .map(marker => ({
        ...marker,
        eventId: marker.id,
        key: marker.sportKey,
        sport: marker.sportKey,
        date: marker.startDate,
        time: "00:00",
        expected: 9,
        majorEventId: marker.id,
        majorEventMarker: true,
      }));
  }

  function markerReplacementFixtureIds(){
    return MARKERS.flatMap(marker => Array.isArray(marker.replacesFixtureIds) ? marker.replacesFixtureIds : []);
  }

  function validateDocument(document, { reference = new Date(), verifiedTicketUrl = null } = {}){
    const errors = [];
    const referenceTime = reference instanceof Date ? reference.getTime() : new Date(reference).getTime();
    if (document?.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
    const publishedTime = new Date(document?.publishedAt).getTime();
    if (!Number.isFinite(publishedTime) || publishedTime > referenceTime) errors.push("publishedAt must be a valid, non-future UTC timestamp");
    if (!Array.isArray(document?.events)) return [...errors, "events must be an array"];
    const eventIds = new Set();
    const allEventIds = new Set(document.events.map(record => record?.id).filter(Boolean));
    const childIds = new Set();
    const parentIds = new Set(document.events.filter(record => record?.kind !== "ticket_sale").map(record => record.id));
    document.events.forEach(record => {
      if (!record?.id || eventIds.has(record.id)) errors.push(`duplicate or missing event id: ${record?.id || "(missing)"}`);
      eventIds.add(record?.id);
      if (!["tournament", "major_event", "ticket_sale"].includes(record?.kind)) errors.push(`${record?.id}: unsupported kind`);
      if (record?.stakesScore !== 5) errors.push(`${record?.id}: stakes must be 5/5`);
      if (!Array.isArray(record?.sources) || !record.sources.length) errors.push(`${record?.id}: official evidence is required`);
      (record?.sources || []).forEach(source => {
        const checkedTime = new Date(source?.checkedAt).getTime();
        if (!source?.name || !/^https:\/\//.test(source?.url || "") || !Number.isFinite(checkedTime) || checkedTime > referenceTime) errors.push(`${record?.id}: invalid or future-dated source evidence`);
      });
      if (record?.dateStatus === "confirmed"){
        if (!record.startDate || (record.endDate && record.endDate < record.startDate)) errors.push(`${record?.id}: confirmed dates are invalid`);
        if (record.kind === "ticket_sale"){
          if (!activeTicketing(record, reference)) errors.push(`${record?.id}: ticket-sale alert is outside its active window`);
        } else if (!record.endDate || !inWindow(record, reference)) {
          errors.push(`${record?.id}: confirmed event falls outside the retention horizon`);
        }
      } else if (record?.dateStatus === "tbc"){
        if (record.startDate || record.endDate || !activeTicketing(record, reference) || !inWindow(record, reference)) errors.push(`${record?.id}: TBC records require an active verified ticket state inside the retention horizon and no invented dates`);
      } else {
        errors.push(`${record?.id}: dateStatus must be confirmed or tbc`);
      }
      if (record?.kind === "ticket_sale" && !parentIds.has(record.parentEventId)) errors.push(`${record?.id}: parent event is missing`);
      if (record?.ticketing && typeof verifiedTicketUrl === "function" && !verifiedTicketUrl(record.ticketing.url)) errors.push(`${record?.id}: ticket URL is not an exact verified seller endpoint`);
      if (record?.ticketing){
        const verifiedTime = new Date(record.ticketing.verifiedAt).getTime();
        if (!Number.isFinite(verifiedTime) || verifiedTime > referenceTime) errors.push(`${record?.id}: ticket verification must be valid and cannot be future-dated`);
        if (record.ticketing.inventoryStatus === "selling_quickly"){
          const inventoryTime = new Date(record.ticketing.inventoryVerifiedAt || "").getTime();
          if (!Number.isFinite(inventoryTime) || referenceTime - inventoryTime > 24 * 60 * 60 * 1000) errors.push(`${record?.id}: selling quickly requires official inventory evidence checked within 24 hours`);
        }
      }
      (record?.subEvents || []).forEach(subEvent => {
        if (!subEvent?.id || childIds.has(subEvent.id) || allEventIds.has(subEvent.id)) errors.push(`${record?.id}: duplicate or missing child id`);
        childIds.add(subEvent?.id);
        if (!subEvent?.name || !subEvent?.venue || !Number.isFinite(Number(subEvent?.stakesScore))) errors.push(`${subEvent?.id}: incomplete child fixture`);
        if (!Object.prototype.hasOwnProperty.call(subEvent || {}, "startTimeUtc")) errors.push(`${subEvent?.id}: child start time state is required`);
        if (subEvent?.startTimeUtc && !Number.isFinite(new Date(subEvent.startTimeUtc).getTime())) errors.push(`${subEvent?.id}: invalid UTC start time`);
      });
    });
    return errors;
  }

  return Object.freeze({ SCHEMA_VERSION, PAST_WINDOW_DAYS, FORWARD_WINDOW_MONTHS, MARKERS, dateKey, addDays, addMonths, followed, activeTicketing, inWindow, recordLifecycleTime, compareRecords, visibleRecords, fixtureFromSubEvent, markerEvents, markerReplacementFixtureIds, validateDocument });
});
