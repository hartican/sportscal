"use strict";

const CALENDAR_URL = "https://www.wrc.com/en/calendar";
const STANDINGS_URL = "https://api.fia.com/events/world-rally-championship/season-2026/standings";
const STAN_URL = "https://www.stan.com.au/watch/sport/motorsport/wrc";
const TRANSIENT_SOURCE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const CLASSIFICATION_URLS = Object.freeze({
  1: "https://www.fia.com/events/world-rally-championship/season-2026/94e-rallye-monte-carlo/classifications",
  2: "https://www.fia.com/events/world-rally-championship/season-2026/rally-sweden/classifications",
  3: "https://www.fia.com/events/world-rally-championship/season-2026/safari-rally-kenya/classifications",
  4: "https://www.fia.com/events/world-rally-championship/season-2026/wrc-croatia-rally-2026/classifications",
  5: "https://www.fia.com/events/world-rally-championship/season-2026/50-rally-islas-canarias-rally-de-espana/classifications",
  6: "https://www.fia.com/events/world-rally-championship/season-2026/vodafone-rally-portugal/classifications",
  7: "https://www.fia.com/events/world-rally-championship/season-2026/rally-japan-2026/classifications",
  8: "https://www.fia.com/events/world-rally-championship/season-2026/eko-acropolis-rally-2026/classifications",
  9: "https://www.fia.com/events/world-rally-championship/season-2026/rally-estonia/classifications",
  10: "https://www.fia.com/events/world-rally-championship/season-2026/secto-rally-finland/classifications",
  11: "https://www.fia.com/events/world-rally-championship/season-2026/wrc-rally-del-paraguay/classifications",
  12: "https://www.fia.com/events/world-rally-championship/season-2026/rally-chile-biobio/classifications",
  13: "https://www.fia.com/events/world-rally-championship/season-2026/rally-ditalia/classifications",
  14: "https://www.fia.com/events/world-rally-championship/season-2026/rally-saudi-arabia/classifications",
});

const ROUND_PLACES = Object.freeze({
  1: { countryCode: "MC", country: "Monaco", region: "Europe" },
  2: { countryCode: "SE", country: "Sweden", region: "Europe" },
  3: { countryCode: "KE", country: "Kenya", region: "Africa" },
  4: { countryCode: "HR", country: "Croatia", region: "Europe" },
  5: { countryCode: "ES", country: "Spain", region: "Europe" },
  6: { countryCode: "PT", country: "Portugal", region: "Europe" },
  7: { countryCode: "JP", country: "Japan", region: "Asia" },
  8: { countryCode: "GR", country: "Greece", region: "Europe" },
  9: { countryCode: "EE", country: "Estonia", region: "Europe" },
  10: { countryCode: "FI", country: "Finland", region: "Europe" },
  11: { countryCode: "PY", country: "Paraguay", region: "South America" },
  12: { countryCode: "CL", country: "Chile", region: "South America" },
  13: { countryCode: "IT", country: "Italy", region: "Europe" },
  14: { countryCode: "SA", country: "Saudi Arabia", region: "Middle East" },
});

const MONTHS = Object.freeze({
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
});

const FIA_TO_ISO_COUNTRY = Object.freeze({
  ARG: "AR", AUS: "AU", BEL: "BE", BRA: "BR", BUL: "BG", ESP: "ES", EST: "EE",
  FIN: "FI", FRA: "FR", GBR: "GB", GRE: "GR", IRL: "IE", ITA: "IT", JPN: "JP",
  KGZ: "KG", LAT: "LV", LUX: "LU", NOR: "NO", NZL: "NZ", PAR: "PY", SWE: "SE",
});

const MANUFACTURER_COUNTRY = Object.freeze({
  "TOYOTA GAZOO RACING WRT": "JP",
  "TOYOTA GAZOO RACING WRT2": "JP",
  "HYUNDAI SHELL MOBIS WORLD RALLY TEAM": "KR",
  "M-SPORT FORD WORLD RALLY TEAM": "GB",
});

function decodeEntities(value){
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value){
  return decodeEntities(String(value || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function slugify(value){
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseOfficialName(value){
  return String(value || "").toLocaleLowerCase("en-AU").replace(/(^|[\s'-])([\p{L}])/gu, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("en-AU")}`);
}

function isoDate(year, month, day){
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateRange(value){
  const normalized = String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
  let match = normalized.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Z]+)\s+(\d{4})$/);
  if (match){
    const [, startDay, endDay, monthName, year] = match;
    const month = MONTHS[monthName];
    if (!month) throw new Error(`Unknown WRC calendar month: ${monthName}`);
    return { startDate: isoDate(year, month, startDay), endDate: isoDate(year, month, endDay) };
  }
  match = normalized.match(/^(\d{1,2})\s+([A-Z]+)\s*-\s*(\d{1,2})\s+([A-Z]+)\s+(\d{4})$/);
  if (!match) throw new Error(`Unsupported WRC calendar date range: ${value}`);
  const [, startDay, startMonthName, endDay, endMonthName, year] = match;
  const startMonth = MONTHS[startMonthName];
  const endMonth = MONTHS[endMonthName];
  if (!startMonth || !endMonth) throw new Error(`Unknown WRC calendar month in: ${value}`);
  return { startDate: isoDate(year, startMonth, startDay), endDate: isoDate(year, endMonth, endDay) };
}

function findCalendarTable(value){
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)){
    for (const item of value){
      const found = findCalendarTable(item);
      if (found) return found;
    }
    return null;
  }
  if (value.type === "table" && Array.isArray(value.fields) && Array.isArray(value.rows)){
    const headings = value.fields.map(field => String(field?.title || "").toUpperCase());
    if (headings.join("|") === "ROUND|RALLY|DATE") return value;
  }
  for (const nested of Object.values(value)){
    const found = findCalendarTable(nested);
    if (found) return found;
  }
  return null;
}

function tableCellText(cell){
  return (Array.isArray(cell) ? cell : []).map(item => item?.text || "").join("").replace(/^.*?(?=WRC\b)/u, "").trim();
}

function parseWrcCalendar(html){
  const match = String(html || "").match(/<script[^>]+id="rb3-prerender-data-cache"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error("WRC calendar prerender data was not found");
  let payload;
  try {
    payload = JSON.parse(decodeEntities(match[1]));
  } catch (error){
    throw new Error(`WRC calendar prerender data is not valid JSON: ${error.message}`);
  }
  const table = findCalendarTable(payload);
  if (!table) throw new Error("WRC calendar ROUND/RALLY/DATE table was not found");
  const rounds = table.rows.map(row => {
    const roundNumber = Number(tableCellText(row[0]));
    const name = tableCellText(row[1]);
    const dates = parseDateRange(tableCellText(row[2]));
    const place = ROUND_PLACES[roundNumber];
    return { roundNumber, name, ...dates, ...place };
  });
  if (rounds.length !== 14) throw new Error(`WRC calendar returned ${rounds.length} rounds; expected exactly 14`);
  rounds.forEach((round, index) => {
    if (round.roundNumber !== index + 1) throw new Error(`WRC calendar round sequence drifted at position ${index + 1}`);
    if (!round.name.startsWith("WRC ")) throw new Error(`WRC calendar round ${round.roundNumber} has an unexpected name: ${round.name}`);
    if (!round.countryCode || round.startDate.slice(0, 4) !== "2026" || round.endDate < round.startDate){
      throw new Error(`WRC calendar round ${round.roundNumber} has invalid dates or location metadata`);
    }
  });
  return rounds;
}

function tableForHeading(html, heading){
  return Array.from(String(html || "").matchAll(/<table\b[\s\S]*?<\/table>/gi))
    .map(match => match[0])
    .find(table => stripTags(table).includes(heading));
}

function parseStandingsTable(html, heading, kind){
  const table = tableForHeading(html, heading);
  if (!table) throw new Error(`FIA standings table missing: ${heading}`);
  const entries = Array.from(table.matchAll(/<tr\s+class="competitor[^\"]*">([\s\S]*?)<\/tr>/gi)).map(match => {
    const row = match[1];
    const rank = Number(row.match(/<td\s+class="position">\s*(\d+)\s*<\/td>/i)?.[1]);
    const name = stripTags(row.match(/<div\s+class="name">([\s\S]*?)<\/div>/i)?.[1]);
    const countryCode = stripTags(row.match(/<div\s+class="country">([\s\S]*?)<\/div>/i)?.[1]).match(/\b([A-Z]{3})\b/)?.[1] || null;
    const points = Number(row.match(/<td\s+class="points">\s*([\d.]+)/i)?.[1]);
    return { rank, name: kind === "manufacturer" ? name : titleCaseOfficialName(name), countryCode, points };
  });
  if (!entries.length) throw new Error(`FIA standings table has no rows: ${heading}`);
  entries.forEach((entry, index) => {
    if (!Number.isInteger(entry.rank) || entry.rank < 1 || !entry.name || !Number.isFinite(entry.points)){
      throw new Error(`FIA ${kind} standings row ${index + 1} is structurally incomplete`);
    }
  });
  return entries;
}

function parseFiaStandings(html){
  const drivers = parseStandingsTable(html, "2026 FIA World Rally Championship for Drivers", "driver");
  const coDrivers = parseStandingsTable(html, "2026 FIA World Rally Championship for Co-Drivers", "co-driver");
  const manufacturers = parseStandingsTable(html, "2026 FIA World Rally Championship for Manufacturers", "manufacturer");
  return { drivers, coDrivers, manufacturers };
}

function parseFiaClassification(html){
  const source = String(html || "");
  const marker = source.lastIndexOf("FINAL OFFICIAL CLASSIFICATION");
  if (marker < 0) return null;
  const tableEnd = source.indexOf("</table>", marker);
  const table = source.slice(marker, tableEnd >= 0 ? tableEnd + 8 : source.length);
  const first = table.match(/<tr\s+class="competitor[^\"]*">([\s\S]*?)<\/tr>/i)?.[1];
  if (!first) return null;
  const crewCell = first.match(/<td\s+class="driver">([\s\S]*?)<\/td>/i)?.[1];
  const crewParts = String(crewCell || "").split(/<br\s*\/?>/i).map(stripTags).filter(Boolean);
  const totalTime = stripTags(first.match(/<td\s+class="time-col">([\s\S]*?)<\/td>/i)?.[1]);
  if (crewParts.length < 3 || !/^\d+:\d{2}:\d{2}\.\d$/.test(totalTime)) return null;
  const parseCrew = value => {
    const match = value.match(/^(.*?)\s+\(([A-Z]{3})\)$/);
    return match ? { name: titleCaseOfficialName(match[1]), countryCode: match[2] } : null;
  };
  const driver = parseCrew(crewParts[0]);
  const coDriver = parseCrew(crewParts[1]);
  if (!driver || !coDriver) return null;
  return { status: "official", driver, coDriver, vehicle: crewParts[2], totalTime };
}

function classificationPageMatchesUrl(html, expectedUrl){
  const source = String(html || "");
  const canonical = source.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1]
    || source.match(/<meta\b[^>]*\bproperty=["']og:url["'][^>]*\bcontent=["']([^"']+)["'][^>]*>/i)?.[1]
    || null;
  if (!canonical) return false;
  try {
    const actual = new URL(decodeEntities(canonical), "https://www.fia.com");
    const expected = new URL(expectedUrl);
    return actual.hostname === expected.hostname && actual.pathname.replace(/\/+$/, "") === expected.pathname.replace(/\/+$/, "");
  } catch {
    return false;
  }
}

function participantId(kind, name){
  if (kind === "manufacturer") return `team:wrc:${slugify(name)}`;
  return `competitor:wrc:${kind}:${slugify(name)}`;
}

function participantFromStanding(kind, entry){
  const manufacturer = kind === "manufacturer";
  return {
    id: participantId(kind, entry.name),
    type: manufacturer ? "team" : "competitor",
    sportDomainId: "sport:motorsport",
    displayName: entry.name,
    shortName: entry.name,
    canonicalName: entry.name,
    countryCode: manufacturer ? MANUFACTURER_COUNTRY[entry.name] : FIA_TO_ISO_COUNTRY[entry.countryCode],
    metadata: { active: true, championshipRole: kind, preferenceDomainId: "sport:wrc" },
  };
}

function competition(id, name, standingsType, { supportsTeams = false, supportsCompetitors = true, standingsOnly = true } = {}){
  return {
    id,
    sportDomainId: "sport:motorsport",
    preferenceDomainId: "sport:wrc",
    competitionFamilyId: "family:world-rally-championship",
    slug: id.replace(/^competition:/, ""),
    name,
    competitionType: "seasonChampionship",
    seasonLabel: "2026",
    region: "global",
    gender: "open",
    supportsLadder: standingsType !== "none",
    supportsTeams,
    supportsCompetitors,
    isSpecialEvent: false,
    standingsOnly,
    standingsType,
    defaultStandingsVisibility: "summary",
  };
}

function buildWrcContext({ rounds, standings, classifications = {}, checkedAt = new Date().toISOString() }){
  if (!Array.isArray(rounds) || rounds.length !== 14) throw new Error("WRC context requires all 14 official rounds");
  const driverParticipants = standings.drivers.map(entry => participantFromStanding("driver", entry));
  const coDriverParticipants = standings.coDrivers.map(entry => participantFromStanding("co-driver", entry));
  const manufacturerParticipants = standings.manufacturers.map(entry => participantFromStanding("manufacturer", entry));
  const participants = [...driverParticipants, ...coDriverParticipants, ...manufacturerParticipants];
  const ids = new Set(participants.map(participant => participant.id));
  if (ids.size !== participants.length) throw new Error("WRC participant identifiers are not unique");
  const allParticipantIds = participants.map(participant => participant.id);
  const checkedDate = checkedAt.slice(0, 10);
  const latestCompletedRound = rounds
    .filter(round => round.endDate < checkedDate)
    .reduce((latest, round) => Math.max(latest, round.roundNumber), 0);

  const events = rounds.map(round => {
    const isCompleted = round.endDate < checkedDate;
    const classification = classifications[round.roundNumber] || null;
    const result = !isCompleted ? undefined : classification ? {
      status: "official",
      driverParticipantId: participantId("driver", classification.driver.name),
      coDriverParticipantId: participantId("co-driver", classification.coDriver.name),
      winningCrew: `${classification.driver.name} / ${classification.coDriver.name}`,
      vehicle: classification.vehicle,
      totalTime: classification.totalTime,
      sourceUrl: CLASSIFICATION_URLS[round.roundNumber],
      checkedAt,
    } : {
      status: "pending",
      sourceUrl: CLASSIFICATION_URLS[round.roundNumber],
      checkedAt,
    };
    return {
      id: `event:wrc:2026:round-${String(round.roundNumber).padStart(2, "0")}`,
      sportDomainId: "sport:motorsport",
      preferenceDomainId: "sport:wrc",
      competitionId: "competition:wrc-2026",
      displayName: round.name,
      roundNumber: round.roundNumber,
      roundLabel: `Round ${round.roundNumber}`,
      date: round.startDate,
      endDate: round.endDate,
      dateOnly: true,
      timePrecision: "date-only",
      scheduleStatus: "date-only",
      status: isCompleted ? "completed" : "scheduled",
      countryCode: round.countryCode,
      country: round.country,
      region: round.region,
      venueName: round.country,
      broadcasters: [{
        broadcasterId: "broadcaster:stan-sport",
        broadcasterName: "Stan Sport",
        live: true,
        replay: true,
        sourceUrl: STAN_URL,
      }],
      source: { provider: "WRC", sourceUrl: CALENDAR_URL, checkedAt },
      ...(result ? { result } : {}),
    };
  });

  const snapshot = (id, competitionId, kind, entries) => ({
    id,
    competitionId,
    seasonLabel: "2026",
    roundLabel: latestCompletedRound ? `After Round ${latestCompletedRound}` : "Before Round 1",
    snapshotTimeUtc: checkedAt,
    source: { provider: "FIA", sourceUrl: STANDINGS_URL, sourceType: "official", checkedAt },
    entries: entries.map(entry => ({
      rank: entry.rank,
      participantId: participantId(kind, entry.name),
      points: entry.points,
    })),
  });

  return {
    schemaVersion: "sport-context.v1",
    taxonomyVersion: "sports-taxonomy.v1",
    season: 2026,
    generatedAt: checkedAt,
    sources: [
      { provider: "WRC", sourceUrl: CALENDAR_URL, sourceType: "official", checkedAt },
      { provider: "FIA", sourceUrl: STANDINGS_URL, sourceType: "official", checkedAt },
      { provider: "Stan Sport", sourceUrl: STAN_URL, sourceType: "broadcaster", checkedAt },
    ],
    sportDomains: [{
      id: "sport:motorsport", slug: "motorsport", name: "Motorsport", kind: "sport", sortOrder: 30,
      isActive: true, supportsLadders: true, supportsAllFixtures: false, supportsNarrative: true,
      supportsTeams: true, supportsCompetitors: true, defaultTemplateId: "template:like",
      metadata: { region: "global", neutralGlyph: "sport:motorsport" },
    }],
    competitionFamilies: [{
      id: "family:world-rally-championship", sportDomainId: "sport:motorsport",
      slug: "world-rally-championship", name: "FIA World Rally Championship",
      familyType: "championship", sortOrder: 31, isActive: true,
    }],
    competitions: [
      competition("competition:wrc-2026", "2026 FIA World Rally Championship", "none", { supportsTeams: true, standingsOnly: false }),
      competition("competition:wrc-drivers-2026", "2026 WRC Drivers' Championship", "drivers"),
      competition("competition:wrc-co-drivers-2026", "2026 WRC Co-Drivers' Championship", "coDrivers"),
      competition("competition:wrc-manufacturers-2026", "2026 WRC Manufacturers' Championship", "manufacturers", { supportsTeams: true, supportsCompetitors: false }),
    ],
    participants,
    events,
    ladderSnapshots: [
      snapshot("ladder:wrc-drivers-2026", "competition:wrc-drivers-2026", "driver", standings.drivers),
      snapshot("ladder:wrc-co-drivers-2026", "competition:wrc-co-drivers-2026", "co-driver", standings.coDrivers),
      snapshot("ladder:wrc-manufacturers-2026", "competition:wrc-manufacturers-2026", "manufacturer", standings.manufacturers),
    ],
    eventParticipantScopes: [{
      sportKey: "wrc",
      preferenceDomainId: "sport:wrc",
      participantSportDomainId: "sport:motorsport",
      titlePattern: "^WRC ",
      resolutionMode: "explicit",
      participantIds: allParticipantIds,
    }],
  };
}

function validateWrcContext(context){
  const errors = [];
  const fail = message => errors.push(message);
  if (context?.schemaVersion !== "sport-context.v1") fail("schemaVersion must be sport-context.v1");
  if (context?.season !== 2026) fail("season must be 2026");
  const events = Array.isArray(context?.events) ? context.events : [];
  if (events.length !== 14) fail(`expected exactly 14 WRC rounds, found ${events.length}`);
  const roundNumbers = new Set();
  events.forEach(event => {
    const prefix = event?.id || "unknown WRC event";
    if (event?.preferenceDomainId !== "sport:wrc") fail(`${prefix} must use preferenceDomainId sport:wrc`);
    if (event?.competitionId !== "competition:wrc-2026") fail(`${prefix} must use the WRC event competition`);
    if (!Number.isInteger(event?.roundNumber) || event.roundNumber < 1 || event.roundNumber > 14) fail(`${prefix} has an invalid roundNumber`);
    if (roundNumbers.has(event?.roundNumber)) fail(`${prefix} duplicates round ${event.roundNumber}`);
    roundNumbers.add(event?.roundNumber);
    if (!/^2026-\d{2}-\d{2}$/.test(event?.date || "")) fail(`${prefix} needs a 2026 start date`);
    if (!/^2026-\d{2}-\d{2}$/.test(event?.endDate || "") || event.endDate < event.date) fail(`${prefix} needs an inclusive endDate on or after date`);
    if (event?.dateOnly !== true || event?.timePrecision !== "date-only") fail(`${prefix} must remain a date-only multi-day rally`);
    if (event?.status === "completed"){
      if (!event.result || !["official", "pending"].includes(event.result.status)) fail(`${prefix} needs an official or pending completed result`);
      if (event.result?.status === "official" && (!event.result.winningCrew || !event.result.totalTime || !event.result.vehicle)) fail(`${prefix} has an incomplete official winning result`);
    } else if (event?.result){
      fail(`${prefix} must not publish a result before completion`);
    }
    const stan = (event?.broadcasters || []).find(item => item?.broadcasterId === "broadcaster:stan-sport");
    if (!stan || stan.live !== true || stan.replay !== true || stan.sourceUrl !== STAN_URL) fail(`${prefix} needs Stan Sport live and replay metadata`);
  });
  if (roundNumbers.size === 14 && Array.from(roundNumbers).some((round, index) => !roundNumbers.has(index + 1))) fail("WRC round numbers must cover 1 through 14");

  const participants = Array.isArray(context?.participants) ? context.participants : [];
  const participantsById = new Map(participants.map(participant => [participant?.id, participant]));
  if (participantsById.size !== participants.length) fail("participant ids must be unique");
  participants.forEach(participant => {
    if (participant?.metadata?.preferenceDomainId !== "sport:wrc") fail(`${participant?.id || "unknown participant"} must be scoped to sport:wrc`);
  });
  events.forEach(event => {
    if (event?.result?.status !== "official") return;
    [event.result.driverParticipantId, event.result.coDriverParticipantId].forEach(participantIdValue => {
      if (!participantsById.has(participantIdValue)) fail(`${event.id} result references missing participant ${participantIdValue}`);
    });
  });
  const expectedStandings = new Map([
    ["competition:wrc-drivers-2026", "driver"],
    ["competition:wrc-co-drivers-2026", "co-driver"],
    ["competition:wrc-manufacturers-2026", "manufacturer"],
  ]);
  const snapshots = Array.isArray(context?.ladderSnapshots) ? context.ladderSnapshots : [];
  if (snapshots.length !== 3) fail(`expected exactly three senior WRC standings tables, found ${snapshots.length}`);
  snapshots.forEach(snapshot => {
    const expectedRole = expectedStandings.get(snapshot?.competitionId);
    if (!expectedRole) fail(`unexpected WRC standings table ${snapshot?.competitionId}`);
    if (!Array.isArray(snapshot?.entries) || !snapshot.entries.length) fail(`${snapshot?.competitionId} standings are empty`);
    (snapshot?.entries || []).forEach(entry => {
      const participant = participantsById.get(entry?.participantId);
      if (!participant) fail(`${snapshot?.competitionId} references missing participant ${entry?.participantId}`);
      if (participant?.metadata?.championshipRole !== expectedRole) fail(`${entry?.participantId} has the wrong WRC championship role`);
      if (!Number.isInteger(entry?.rank) || !Number.isFinite(entry?.points)) fail(`${snapshot?.competitionId} has an invalid standings row`);
    });
  });
  if ((context?.competitions || []).some(item => /junior|wrc2|wrc3|support/i.test(`${item?.id} ${item?.name}`))) fail("junior and support categories must stay outside the WRC senior context");
  const urls = new Set((context?.sources || []).map(source => source?.sourceUrl));
  [CALENDAR_URL, STANDINGS_URL, STAN_URL].forEach(url => { if (!urls.has(url)) fail(`missing required source ${url}`); });
  return errors;
}

function isTransientSourceStatus(status){
  return TRANSIENT_SOURCE_STATUS.has(Number(status));
}

module.exports = {
  CALENDAR_URL,
  CLASSIFICATION_URLS,
  STANDINGS_URL,
  STAN_URL,
  buildWrcContext,
  classificationPageMatchesUrl,
  parseDateRange,
  parseFiaClassification,
  parseFiaStandings,
  parseWrcCalendar,
  participantId,
  slugify,
  isTransientSourceStatus,
  validateWrcContext,
};
