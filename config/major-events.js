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
    { id: "major-event:us-open-2026", name: "US Open 2026", sportKey: "tennis", sportKeys: ["tennis", "wimbledon"], startDate: "2026-08-23", endDate: "2026-09-13", stakesScore: 5 },
    { id: "major-event:afl-finals-series-2026", name: "2026 Toyota AFL Finals Series", sportKey: "afl", sportKeys: ["afl"], startDate: "2026-08-28", endDate: "2026-09-26", stakesScore: 5, replacesFixtureIds: ["event-afl-cd_m20260142901"] },
    { id: "major-event:nrl-finals-series-2026", name: "2026 NRL Finals Series", sportKey: "nrl", sportKeys: ["nrl"], startDate: "2026-09-12", endDate: "2026-10-04", stakesScore: 5, replacesFixtureIds: ["evt_81", "evt_82", "evt_83", "evt_84"] },
    { id: "major-event:rlwc-2026", name: "Rugby League World Cup 2026", sportKey: "nrl", sportKeys: ["nrl"], startDate: "2026-10-15", endDate: "2026-11-15", stakesScore: 5 },
    { id: "major-event:nations-championship-finals-2026", name: "2026 Nations Championship Finals Weekend", sportKey: "rugby", sportKeys: ["rugby"], startDate: "2026-11-27", endDate: "2026-11-29", stakesScore: 5 },
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

  function eventFamilyId(record){
    return String(record?.eventFamilyId || record?.familyId || record?.id || "")
      .replace(/^major-event:/, "")
      .replace(/:\d{4}(?:-\d{2})?.*$/, "")
      .replace(/-\d{4}(?:-\d{2})?.*$/, "");
  }

  function activeTicketing(record, reference = new Date()){
    if (!["on_sale", "presale", "waitlist", "register_interest"].includes(record?.ticketing?.status)) return false;
    const referenceTime = reference instanceof Date ? reference.getTime() : new Date(reference).getTime();
    const saleEndTime = record.ticketing.saleEndAt ? new Date(record.ticketing.saleEndAt).getTime() : null;
    if (!Number.isFinite(referenceTime)) return false;
    return !(Number.isFinite(saleEndTime) && referenceTime > saleEndTime);
  }

  function inWindow(record, reference = new Date()){
    if (record?.lifecycleStatus === "retired") return false;
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

  function visibleRecords(document, followedInput, reference = new Date()){
    const followedSports = Array.isArray(followedInput) ? followedInput : followedInput?.followedSports || [];
    const followedEventFamilyIds = new Set(Array.isArray(followedInput?.followedEventFamilyIds) ? followedInput.followedEventFamilyIds : []);
    const records = Array.isArray(document?.events) ? document.events : [];
    const parents = records.filter(record => record.kind !== "ticket_sale"
      && record.lifecycleStatus !== "retired"
      && record.stakesScore === 5
      && (followed(record, followedSports) || followedEventFamilyIds.has(eventFamilyId(record)))
      && inWindow(record, reference));
    const parentIds = new Set(parents.map(record => record.id));
    const alerts = records.filter(record => record.kind === "ticket_sale" && parentIds.has(record.parentEventId) && activeTicketing(record, reference));
    return {
      events: parents.slice().sort((left, right) => compareRecords(left, right, reference)),
      alerts: alerts.slice().sort((left, right) => compareRecords(left, right, reference)),
    };
  }

  function subEventTimelineTime(subEvent){
    const direct = new Date(subEvent?.startTimeUtc || "").getTime();
    if (Number.isFinite(direct)) return direct;
    const session = new Date(subEvent?.sessionStartTimeUtc || "").getTime();
    if (Number.isFinite(session)) return session + Math.max(0, Number(subEvent?.sequenceInSession) || 0) * 1000;
    const result = new Date(subEvent?.resultPublishedAt || subEvent?.statusUpdatedAt || "").getTime();
    if (Number.isFinite(result)) return result;
    const date = new Date(`${subEvent?.date || ""}T12:00:00Z`).getTime();
    return Number.isFinite(date) ? date : Number.MAX_SAFE_INTEGER;
  }

  function effectiveSubEventStatus(subEvent, reference = new Date()){
    const status = String(subEvent?.status || "scheduled").toLowerCase();
    if (status === "completed") return "completed";
    if (status === "live") return "live";
    if (["cancelled", "postponed"].includes(status)) return status;
    const time = subEventTimelineTime(subEvent);
    return Number.isFinite(time) && time < new Date(reference).getTime() ? "awaiting-result" : "upcoming";
  }

  function timelineDisplayDate(time, timeZone){
    const date = new Date(time);
    if (!Number.isFinite(time) || Number.isNaN(date.getTime())) return "Date TBC";
    return new Intl.DateTimeFormat("en-AU", { timeZone, weekday:"short", day:"numeric", month:"short" }).format(date);
  }

  function timelineDisplayTime(subEvent, timeZone){
    if (subEvent?.timePrecision === "follows"){
      const session = new Date(subEvent?.sessionStartTimeUtc || "").getTime();
      if (!Number.isFinite(session)) return "Follows";
      const label = new Intl.DateTimeFormat("en-AU", { timeZone, hour:"numeric", minute:"2-digit", hour12:true })
        .format(new Date(session)).replace(/\s/g, "").toLowerCase();
      return `Follows · session starts ${label}`;
    }
    if (["unpublished", "date-only"].includes(subEvent?.timePrecision)) return "Time unpublished";
    const direct = new Date(subEvent?.startTimeUtc || "").getTime();
    if (!Number.isFinite(direct)) return "Time TBC";
    return new Intl.DateTimeFormat("en-AU", { timeZone, hour:"numeric", minute:"2-digit", hour12:true })
      .format(new Date(direct)).replace(/\s/g, "").toLowerCase();
  }

  function phaseTimeline(record, reference = new Date(), { level = "L2", timeZone = "Australia/Sydney", includeOlder = false } = {}){
    const referenceTime = new Date(reference).getTime();
    const earliestDate = addDays(dateKey(reference, timeZone), -2);
    const items = (record?.subEvents || []).map((subEvent, sourceOrder) => {
      const sortTime = subEventTimelineTime(subEvent);
      return {
        subEvent,
        sourceOrder,
        sortTime,
        localDate:dateKey(sortTime, timeZone),
        effectiveStatus:effectiveSubEventStatus(subEvent, reference),
        displayDate:timelineDisplayDate(sortTime, timeZone),
        displayTime:timelineDisplayTime(subEvent, timeZone),
      };
    }).sort((first, second) => first.sortTime - second.sortTime || first.sourceOrder - second.sourceOrder);
    const retained = includeOlder ? items : items.filter(item => item.localDate >= earliestDate || item.sortTime >= referenceTime);
    const recentAll = retained.filter(item => item.sortTime < referenceTime || ["completed", "awaiting-result"].includes(item.effectiveStatus));
    const upcomingAll = retained.filter(item => item.sortTime >= referenceTime && !["completed", "awaiting-result"].includes(item.effectiveStatus));
    const recent = level === "L1"
      ? recentAll.slice()
        .sort((first, second) => Number(second.subEvent?.previewPriority || 0) - Number(first.subEvent?.previewPriority || 0)
          || second.sortTime - first.sortTime
          || second.sourceOrder - first.sourceOrder)
        .slice(0, 2)
        .sort((first, second) => first.sortTime - second.sortTime || first.sourceOrder - second.sourceOrder)
      : recentAll;
    const upcoming = level === "L0" ? upcomingAll.slice(0, 1) : level === "L1" ? upcomingAll.slice(0, 3) : upcomingAll;
    if (level === "L0" && !upcoming.length && recentAll.length) recent.push(recentAll.at(-1));
    return { recent, upcoming, items:[...recent, { marker:"now" }, ...upcoming], hasOlder:items.some(item => item.localDate < earliestDate) };
  }

  function compactPhaseTimelineItems(timeline){
    const items = Array.isArray(timeline?.items) ? timeline.items : [];
    const markerIndex = items.findIndex(item => item?.marker === "now");
    if (markerIndex < 0) return items.find(item => item?.subEvent) ? [items.find(item => item?.subEvent)] : [];
    const marker = items[markerIndex];
    const upcoming = items.slice(markerIndex + 1).find(item => item?.subEvent) || null;
    if (upcoming) return [marker, upcoming];
    const recent = items.slice(0, markerIndex).reverse().find(item => item?.subEvent) || null;
    return recent ? [recent, marker] : [marker];
  }

  function normalizedParticipantName(value){
    return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function subEventParticipantIdentity(subEvent){
    const players = [
      ...(Array.isArray(subEvent?.matchupSides) ? subEvent.matchupSides.flatMap(side => side?.players || []) : []),
      ...(Array.isArray(subEvent?.participants) ? subEvent.participants : []),
    ];
    return {
      ids:Array.from(new Set([
        ...(Array.isArray(subEvent?.participantIds) ? subEvent.participantIds : []),
        ...players.flatMap(player => [player?.id, player?.playerId, player?.participantId]),
      ].map(value => String(value || "").trim()).filter(Boolean))),
      names:Array.from(new Set(players.map(player => normalizedParticipantName(player?.name || player?.displayName || player?.label)).filter(Boolean))),
    };
  }

  function subEventIsMarquee(subEvent){
    return subEvent?.marquee === true || subEvent?.isMarquee === true || subEvent?.cardVariant === "marquee";
  }

  function subEventMeetsDisplayPolicy(subEvent, { followedParticipantIds = [], followedParticipantNames = [] } = {}){
    const identity = subEventParticipantIdentity(subEvent);
    const followedIds = new Set(followedParticipantIds.map(value => String(value || "").trim()).filter(Boolean));
    const followedNames = new Set(followedParticipantNames.map(normalizedParticipantName).filter(Boolean));
    const followed = identity.ids.some(id => followedIds.has(id)) || identity.names.some(name => followedNames.has(name));
    return followed || Number(subEvent?.stakesScore || 0) >= 4 || subEventIsMarquee(subEvent);
  }

  function activeEditionForFamily(document, familyId, reference = new Date()){
    const matches = (document?.events || []).filter(record => record.kind !== "ticket_sale" && eventFamilyId(record) === familyId && record.lifecycleStatus !== "retired");
    return matches.sort((first, second) => compareRecords(first, second, reference))[0] || null;
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

  function matchupSideLabels(event){
    if (Array.isArray(event?.matchupSides) && event.matchupSides.length === 2){
      return event.matchupSides.map(side => {
        const playerNames = (side?.players || []).map(player => player?.displayName || player?.name).filter(Boolean);
        return playerNames.length ? playerNames.join(" / ") : String(side?.displayName || side?.name || "").trim();
      }).filter(Boolean);
    }
    if (Array.isArray(event?.participantSlots) && event.participantSlots.length === 2){
      return event.participantSlots.map(slot => String(slot?.displayName || slot?.label || slot?.name || "").trim()).filter(Boolean);
    }
    if (Array.isArray(event?.participants) && event.participants.length === 2){
      return event.participants.map(participant => String(participant?.displayName || participant?.name || participant?.label || "").trim()).filter(Boolean);
    }
    return [];
  }

  function fixtureSemanticKey(event){
    const participantIds = Array.from(new Set([
      ...(Array.isArray(event?.participantIds) ? event.participantIds : []),
      ...(Array.isArray(event?.participantSlots) ? event.participantSlots.map(slot => slot?.participantId) : []),
      event?.homeParticipantId,
      event?.awayParticipantId,
    ].map(value => String(value || "").trim()).filter(Boolean))).sort();
    const rawStart = String(event?.startTimeUtc || event?.timelineSortTimeUtc || "");
    const parsedStart = Date.parse(rawStart);
    if (participantIds.length < 2 || !Number.isFinite(parsedStart)) return "";
    return `${new Date(parsedStart).toISOString()}|${participantIds.join("|")}`;
  }

  function fixtureAliasIds(subEvent){
    return Array.from(new Set([
      subEvent?.id,
      subEvent?.stableMatchId,
      ...(Array.isArray(subEvent?.legacyEventIds) ? subEvent.legacyEventIds : []),
    ].map(value => String(value || "").trim()).filter(Boolean)));
  }

  function childEditorialHook(subEvent, parent){
    const sides = matchupSideLabels(subEvent);
    const displayName = String(subEvent?.name || "This fixture").trim();
    const embeddedMatchup = displayName.includes(" - ") ? displayName.split(" - ").at(-1) : displayName;
    const embeddedSides = embeddedMatchup.split(/\s+v\s+/i).map(value => value.trim()).filter(Boolean);
    const subjectSides = sides.length === 2 ? sides : embeddedSides.length === 2 ? embeddedSides : [];
    const subject = subjectSides.length === 2 ? `${subjectSides[0]} and ${subjectSides[1]}` : displayName;
    const parentId = String(parent?.id || "");
    const stage = String(subEvent?.stage || "").trim();
    const round = String(subEvent?.roundLabel || stage).trim();
    const pathLabel = stage || round || "event";

    if (parentId === "major-event:us-open-2026"){
      if (/legends exhibition/i.test(stage)) return `${subject} turn the legends exhibition into a live reprise rather than a ceremonial appearance.`;
      if (/stars of the open/i.test(stage)) return `${subject} carry the Stars of the Open programme into its standalone closing match.`;
      if (/semifinals?/i.test(round)) return `${subject} are one win from the ${pathLabel} final.`;
      if (/quarterfinals?/i.test(round)) return `${subject} are two wins from the ${pathLabel} title, with a semifinal place decided here.`;
      if (/^finals?$/i.test(round)) return `${subject} decide the ${pathLabel} title after surviving the tournament's short knockout path.`;
      if (/opening|round\s*1/i.test(round)) return `${subject} meet at the first elimination point of the ${pathLabel} path.`;
      if (/round\s*2/i.test(round)) return `${subject} have already survived once; this match decides who reaches the next mixed-doubles cut.`;
    }

    if (parentId === "major-event:rlwc-2026") return `${subject} open the month-long, 53-match programme by pairing the men's defending champions with the Pacific Cup holders.`;

    if (parentId.includes("afl-finals-series") || parentId.includes("nrl-finals-series")){
      if (/qualifying/i.test(round) && !/elimination/i.test(round)) return `${subject} play for the finals system's biggest first-week advantage: a week off and the shorter route onward.`;
      if (/elimination|wildcard/i.test(round)) return `${subject} are in sudden death; one side keeps its season alive and the other is finished.`;
      if (/semi/i.test(round)) return `${subject} are in sudden death for a preliminary-final place.`;
      if (/preliminary/i.test(round)) return `${subject} play for a place in the Grand Final.`;
      if (/grand final/i.test(round)) return `${subject} are the final two sides left in the premiership race.`;
      if (/qualifying/i.test(round)) return `${subject} decide which side earns the week off and which must take the longer finals route.`;
    }

    if (parentId === "major-event:nations-championship-finals-2026"){
      if (/first placed/i.test(subject)) return `${subject} decide the first Nations Championship title, with the result also counting toward the Hemisphere Crown.`;
      return `${subject} still carry a second consequence: this placement match also counts toward the north-versus-south Hemisphere Crown.`;
    }

    if (parentId.endsWith(":qualification")) return `${subject} have reached the decisive second leg, with one of the remaining league-phase places attached to the tie.`;
    if (parentId.endsWith(":league-phase")) return `Eight matchdays determine which clubs skip February and which must take the knockout play-off route.`;
    if (parentId.endsWith(":knockout")){
      if (/play-off/i.test(subject)) return `Sixteen clubs enter the knockout play-offs and only eight can join the directly qualified sides in the last 16.`;
      if (/round of 16/i.test(subject)) return `The Round of 16 turns sixteen surviving clubs into the eight-team quarter-final field.`;
      if (/quarter/i.test(subject)) return `The quarter-finals cut the title race to four clubs and settle the pairings for the final step before Madrid.`;
      if (/semi/i.test(subject)) return `The semi-finals decide the two clubs that reach Madrid with the European title still available.`;
      if (/final/i.test(subject)) return `One match in Madrid decides the European champion after every qualifying and knockout route converges.`;
    }

    return "";
  }

  function inheritedEditorialNarrative(subEvent, parent){
    const narrative = parent?.editorialNarrative;
    if (!narrative) return null;
    const hook = childEditorialHook(subEvent, parent);
    if (!hook) return null;
    return {
      ...narrative,
      projectionId:`${narrative.projectionId}:child:${subEvent.id}`,
      hook,
      synopsis:[hook, narrative.synopsis].filter(Boolean).join(" "),
      dimensions:Array.from(new Set([...(narrative.dimensions || []), "path"])),
      generationMode:"verified-parent-child-projection",
    };
  }

  function editorialRecordForSubEvent(subEvent, parent, feedEvents = []){
    const fixture = fixtureFromSubEvent(subEvent, parent);
    const baseRecord = fixture || {
      ...subEvent,
      key:parent?.sportKey,
      sport:parent?.sportLabel,
      competitionId:parent?.competitionId,
      majorEventId:parent?.id,
      majorEventParentId:parent?.id,
      status:subEvent?.status || "scheduled",
    };
    const aliases = new Set(fixtureAliasIds(subEvent));
    const candidates = Array.isArray(feedEvents) ? feedEvents : [];
    const exactMatch = candidates.find(event => {
      if (!event?.editorialNarrative) return false;
      return [event.id, event.eventId, event.canonicalEventId, event.stableMatchId, ...(event.legacyEventIds || [])]
        .map(value => String(value || "").trim())
        .some(value => value && aliases.has(value));
    });
    const semanticKey = fixtureSemanticKey(baseRecord);
    const semanticMatch = exactMatch || (semanticKey
      ? candidates.find(event => event?.editorialNarrative && fixtureSemanticKey(event) === semanticKey)
      : null);
    const editorialNarrative = semanticMatch?.editorialNarrative || inheritedEditorialNarrative(subEvent, parent);
    return editorialNarrative ? { ...baseRecord, editorialNarrative } : baseRecord;
  }

  function editorialFixtureFromSubEvent(subEvent, parent, feedEvents = []){
    const fixture = fixtureFromSubEvent(subEvent, parent);
    if (!fixture) return null;
    return editorialRecordForSubEvent(subEvent, parent, feedEvents);
  }

  function fixturePinReconciliationPlan(document, actions){
    const records = Array.isArray(document?.events) ? document.events : [];
    const actionEntries = Object.entries(actions && typeof actions === "object" ? actions : {});
    const claimedSourceKeys = new Set();
    const plan = [];
    records.filter(record => record?.kind !== "ticket_sale").forEach(parent => {
      (parent.subEvents || []).forEach(subEvent => {
        const fixture = fixtureFromSubEvent(subEvent, parent);
        if (!fixture) return;
        const aliases = new Set(fixtureAliasIds(subEvent).filter(alias => alias !== fixture.actionKey));
        if (!aliases.size) return;
        actionEntries.forEach(([sourceKey, action]) => {
          if (claimedSourceKeys.has(sourceKey) || !action?.addedToFixtures) return;
          const actionIds = [
            sourceKey,
            action.eventId,
            action.addedFixture?.id,
            action.addedFixture?.eventId,
            action.addedFixture?.canonicalEventId,
            action.addedFixture?.actionKey,
          ].map(value => String(value || "").trim()).filter(Boolean);
          if (!actionIds.some(id => aliases.has(id))) return;
          claimedSourceKeys.add(sourceKey);
          plan.push({ sourceKey, targetKey:fixture.actionKey, fixture, parentEventId:parent.id });
        });
      });
    });
    return plan;
  }

  function fixtureFromSubEvent(subEvent, parent){
    const directTime = new Date(subEvent?.startTimeUtc || "").getTime();
    const sessionTime = new Date(subEvent?.sessionStartTimeUtc || "").getTime();
    const follows = subEvent?.timePrecision === "follows" && Number.isFinite(sessionTime);
    const timelineTime = Number.isFinite(directTime)
      ? directTime
      : follows ? sessionTime + Math.max(0, Number(subEvent?.sequenceInSession) || 0) * 1000 : NaN;
    if (!subEvent?.id || !Number.isFinite(timelineTime)) return null;
    const instant = new Date(timelineTime);
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(instant).map(part => [part.type, part.value]));
    const matchupSides = Array.isArray(subEvent.matchupSides) ? subEvent.matchupSides : [];
    const matchupPlayers = matchupSides.flatMap(side => Array.isArray(side.players) ? side.players : []);
    const sideLabels = matchupSideLabels(subEvent);
    const displayName = matchupSides.length === 2 && sideLabels.length === 2
      ? sideLabels.join(" v ")
      : subEvent.name;
    return {
      id: subEvent.id,
      eventId: subEvent.id,
      canonicalEventId: subEvent.id,
      actionKey: subEvent.id,
      cardKind: "fixture",
      key: parent.sportKey,
      sport: parent.sportLabel,
      competitionId: parent.competitionId,
      stableMatchId: subEvent.stableMatchId || null,
      legacyEventIds: Array.isArray(subEvent.legacyEventIds) ? [...subEvent.legacyEventIds] : [],
      roundLabel: subEvent.roundLabel || subEvent.stage || null,
      stage: subEvent.stage || subEvent.roundLabel || null,
      matchType:subEvent.matchType || null,
      court:subEvent.court || null,
      majorEventId: parent.id,
      majorEventParentId: parent.id,
      manualPin: true,
      name: displayName,
      displayTitleCompact: displayName,
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
      startTimeUtc: Number.isFinite(directTime) ? new Date(directTime).toISOString() : null,
      timelineSortTimeUtc:instant.toISOString(),
      sessionStartTimeUtc:subEvent.sessionStartTimeUtc || null,
      sequenceInSession:Number(subEvent.sequenceInSession) || 0,
      timePrecision:subEvent.timePrecision || (Number.isFinite(directTime) ? "exact" : "follows"),
      ...(follows ? { displayTimeLabel:timelineDisplayTime(subEvent, "Australia/Sydney") } : {}),
      venue: subEvent.venue || parent.venue,
      status: subEvent.status || "scheduled",
      scheduleStatus:subEvent.scheduleStatus || "confirmed",
      result:subEvent.result || null,
      ...(subEvent.scoreDisplay ? { scoreDisplay: subEvent.scoreDisplay, score: subEvent.scoreDisplay } : {}),
      stakesScore: Number(subEvent.stakesScore || parent.stakesScore || 5),
      expected: Number(subEvent.expected || 8),
      matchupSides,
      participants: subEvent.participants || matchupPlayers.map(player => ({ id:player.id, name:player.name, displayName:player.name, nationalityCode:player.nationalityCode, rank:player.rank, seed:player.seed })),
      participantIds: subEvent.participantIds || matchupPlayers.map(player => player.id).filter(Boolean),
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
      if (record?.kind !== "ticket_sale" && (!record.eventFamilyId || !record.editionId || !record.phaseId)) errors.push(`${record?.id}: event family, edition and phase identities are required`);
      if (record?.stakesScore !== 5) errors.push(`${record?.id}: stakes must be 5/5`);
      if (!Array.isArray(record?.sources) || !record.sources.length) errors.push(`${record?.id}: official evidence is required`);
      if (record?.lifecycleStatus === "retired"){
        if (!record.retiredReason || !Number.isFinite(new Date(record.retiredAt || "").getTime()) || record.retiredDeepLinkBehaviour !== "safe-tombstone"){
          errors.push(`${record?.id}: retired events require a dated safe tombstone reason`);
        }
      }
      (record?.sources || []).forEach(source => {
        const checkedTime = new Date(source?.checkedAt).getTime();
        if (!source?.name || !/^https:\/\//.test(source?.url || "") || !Number.isFinite(checkedTime) || checkedTime > referenceTime) errors.push(`${record?.id}: invalid or future-dated source evidence`);
      });
      if (record?.dateStatus === "confirmed"){
        if (!record.startDate || (record.endDate && record.endDate < record.startDate)) errors.push(`${record?.id}: confirmed dates are invalid`);
        if (record.kind === "ticket_sale"){
          if (!activeTicketing(record, reference)) errors.push(`${record?.id}: ticket-sale alert is outside its active window`);
        } else if (!record.endDate || (record.lifecycleStatus !== "retired" && !inWindow(record, reference))) {
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
        if (!Number.isInteger(subEvent?.stakesScore) || subEvent.stakesScore < 1 || subEvent.stakesScore > 5) errors.push(`${subEvent?.id}: child stakes must be an integer from 1 to 5`);
        if (Object.prototype.hasOwnProperty.call(subEvent || {}, "marquee") && typeof subEvent.marquee !== "boolean") errors.push(`${subEvent?.id}: marquee must be boolean when published`);
        if (!Object.prototype.hasOwnProperty.call(subEvent || {}, "startTimeUtc")) errors.push(`${subEvent?.id}: child start time state is required`);
        if (subEvent?.startTimeUtc && !Number.isFinite(new Date(subEvent.startTimeUtc).getTime())) errors.push(`${subEvent?.id}: invalid UTC start time`);
        if (subEvent?.timePrecision === "follows" && subEvent?.startTimeUtc) errors.push(`${subEvent?.id}: follows records cannot invent an exact start`);
        if (Array.isArray(subEvent?.matchupSides) && subEvent.matchupSides.length){
          if (subEvent.matchupSides.length !== 2) errors.push(`${subEvent?.id}: announced matchups require exactly two grouped sides`);
          subEvent.matchupSides.forEach(side => (side.players || []).forEach(player => {
            if (!player?.id || !player?.name || !player?.nationalityCode) errors.push(`${subEvent?.id}: announced individual players require canonical IDs, names and nationality codes`);
          }));
        }
      });
    });
    return errors;
  }

  return Object.freeze({ SCHEMA_VERSION, PAST_WINDOW_DAYS, FORWARD_WINDOW_MONTHS, MARKERS, dateKey, addDays, addMonths, followed, eventFamilyId, activeTicketing, inWindow, recordLifecycleTime, compareRecords, visibleRecords, subEventTimelineTime, effectiveSubEventStatus, phaseTimeline, compactPhaseTimelineItems, normalizedParticipantName, subEventParticipantIdentity, subEventIsMarquee, subEventMeetsDisplayPolicy, activeEditionForFamily, matchupSideLabels, fixtureSemanticKey, fixtureAliasIds, editorialRecordForSubEvent, editorialFixtureFromSubEvent, fixturePinReconciliationPlan, fixtureFromSubEvent, markerEvents, markerReplacementFixtureIds, validateDocument });
});
