"use strict";

const PROVIDER_ALIASES = Object.freeze({
  kayo: ["kayo", "espn"],
  stan: ["stan sport"],
  sbs: ["sbs", "sbs on demand"],
  nine: ["nine", "9now"],
  foxtel: ["foxtel"],
  abc: ["abc"],
  seven: ["7plus", "channel 7", "seven"],
  ten: ["10 play", "network 10", "channel 10"],
  fis: ["fis broadcast", "fis tv"],
});

function uniqueStrings(values){
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(value => typeof value === "string" && value)));
}

function splitList(value){
  const values = Array.isArray(value) ? value : [value];
  return uniqueStrings(values.flatMap(item => String(item || "").split(","))
    .map(item => item.trim().toLowerCase())
    .filter(item => /^[a-z0-9:_-]+$/.test(item)));
}

function clampInteger(value, fallback, minimum, maximum){
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function normalizeCalendarSyncQuery(query = {}){
  return {
    sports: splitList(query.sports),
    providers: splitList(query.providers),
    allFixtures: splitList(query.all),
    majorFollowedSports: splitList(query.majorFollowed),
    followedParticipantIds: splitList(query.follow),
    mutedParticipantIds: splitList(query.mute),
    excludedCompetitionIds: splitList(query.excludeCompetition),
    cwgDisciplines: splitList(query.cwg),
    minStakes: clampInteger(query.min, 3, 1, 5),
    reminderMinutes: clampInteger(query.reminder, 60, 0, 10080),
  };
}

function inferProviderIds(label){
  const normal = String(label || "").toLowerCase();
  return Object.entries(PROVIDER_ALIASES)
    .filter(([, aliases]) => aliases.some(alias => normal.includes(alias)))
    .map(([id]) => id);
}

function eventProviderIds(event){
  return uniqueStrings([
    ...(Array.isArray(event?.broadcasterIds) ? event.broadcasterIds : []),
    ...inferProviderIds(event?.broadcaster),
  ].map(id => String(id).toLowerCase()));
}

function eventDateTime(event){
  if (event.startTimeUtc && !Number.isNaN(Date.parse(event.startTimeUtc))){
    return new Date(event.startTimeUtc);
  }
  const date = String(event.date || "");
  const time = String(event.time || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00+10:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calendarEventIsCurrent(event, now = new Date()){
  const start = eventDateTime(event);
  if (!start) return false;
  const durationMs = Math.max(1, Number(event.liveWindow) || 3) * 60 * 60 * 1000;
  const retentionBoundary = now.getTime() - (14 * 24 * 60 * 60 * 1000);
  return start.getTime() + durationMs >= retentionBoundary;
}

function eventMeetsProviderPreference(event, providers){
  if (!providers.length) return true;
  const selected = new Set(providers);
  return eventProviderIds(event).some(id => selected.has(id));
}

function eventParticipantIds(event){
  return uniqueStrings([
    ...(Array.isArray(event?.participantIds) ? event.participantIds : []),
    event?.homeParticipantId,
    event?.awayParticipantId,
  ].map(id => String(id || "").toLowerCase()));
}

function normalizeCommonwealthDiscipline(value){
  const label = String(value || "").trim().toLowerCase();
  if (/\bathletics?|track and field\b/.test(label)) return "athletics";
  if (/\bswimm?ing|aquatics?\b/.test(label)) return "swimming";
  if (/\brugby sevens?|rugby 7s\b/.test(label)) return "rugby-sevens";
  if (/\bnetball\b/.test(label)) return "netball";
  if (/\bcricket\b/.test(label)) return "cricket";
  if (/\bhockey\b/.test(label)) return "hockey";
  if (/\bgymnastics?\b/.test(label)) return "gymnastics";
  if (/\bcycling|bmx|mountain bike\b/.test(label)) return "cycling";
  if (/\bboxing\b/.test(label)) return "boxing";
  return "miscellaneous";
}

function eventCommonwealthDiscipline(event){
  return normalizeCommonwealthDiscipline(
    event?.commonwealthDiscipline
    || event?.discipline
    || event?.sportDiscipline
    || event?.sport
  );
}

function filterCalendarEvents(events, config, now = new Date()){
  const sports = new Set(config.sports || []);
  const allFixtures = new Set(config.allFixtures || []);
  const majorFollowedSports = new Set(config.majorFollowedSports || []);
  const followedParticipantIds = new Set(config.followedParticipantIds || []);
  const mutedParticipantIds = new Set(config.mutedParticipantIds || []);
  const excludedCompetitionIds = new Set(config.excludedCompetitionIds || []);
  const cwgDisciplines = new Set(config.cwgDisciplines || []);
  return (Array.isArray(events) ? events : [])
    .filter(event => sports.has(String(event.key || "").toLowerCase()))
    .filter(event => (
      String(event.key || "").toLowerCase() !== "cwg"
      || !cwgDisciplines.size
      || cwgDisciplines.has(eventCommonwealthDiscipline(event))
    ))
    .filter(event => event.calendarExportEligible !== false && !event.timeTbc)
    .filter(event => calendarEventIsCurrent(event, now))
    .filter(event => eventMeetsProviderPreference(event, config.providers || []))
    .filter(event => !excludedCompetitionIds.has(String(event.competitionId || "").toLowerCase()))
    .filter(event => !eventParticipantIds(event).some(id => mutedParticipantIds.has(id)))
    .filter(event => {
      const sportKey = String(event.key || "").toLowerCase();
      if (allFixtures.has(sportKey)) return true;
      if (Number(event.stakesScore || event.expected || 0) >= Number(config.minStakes || 3)) return true;
      return (
        majorFollowedSports.has(sportKey)
        && eventParticipantIds(event).some(id => followedParticipantIds.has(id))
      );
    })
    .sort((first, second) => eventDateTime(first) - eventDateTime(second));
}

function pad2(number){
  return String(number).padStart(2, "0");
}

function buildLocalDateTime(date, time){
  const [year, month, day] = String(date).split("-");
  const [hour, minute] = String(time).split(":");
  return `${year}${month}${day}T${hour}${minute}00`;
}

function escapeCalendarText(value){
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldCalendarLine(line){
  const chunks = [];
  let current = "";
  let currentBytes = 0;
  for (const character of String(line)){
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (current && currentBytes + characterBytes > 75){
      chunks.push(current);
      current = " ";
      currentBytes = 1;
    }
    current += character;
    currentBytes += characterBytes;
  }
  chunks.push(current);
  return chunks;
}

function calendarTimestamp(value = new Date()){
  const date = value instanceof Date ? value : new Date(value);
  const safe = Number.isNaN(date.getTime()) ? new Date(0) : date;
  return `${safe.getUTCFullYear()}${pad2(safe.getUTCMonth() + 1)}${pad2(safe.getUTCDate())}T${pad2(safe.getUTCHours())}${pad2(safe.getUTCMinutes())}${pad2(safe.getUTCSeconds())}Z`;
}

function calendarTimezoneLines(){
  return [
    "BEGIN:VTIMEZONE",
    "TZID:Australia/Sydney",
    "BEGIN:STANDARD",
    "DTSTART:19700405T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU",
    "TZOFFSETFROM:+1100",
    "TZOFFSETTO:+1000",
    "TZNAME:AEST",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19701004T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU",
    "TZOFFSETFROM:+1000",
    "TZOFFSETTO:+1100",
    "TZNAME:AEDT",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
  ];
}

function buildCalendarIcs(events, {
  generatedAt = new Date(),
  reminderMinutes = 60,
  calendarName = "nothingsport",
} = {}){
  const stamp = calendarTimestamp(generatedAt);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nothingsport//Calendar sync//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeCalendarText(calendarName)}`,
    "X-WR-CALDESC:Your live customised nothingsport recommendations",
    "X-WR-TIMEZONE:Australia/Sydney",
    ...calendarTimezoneLines(),
  ];

  events.forEach(event => {
    const durationHours = Math.max(1, Number(event.liveWindow) || 3);
    const stakes = Number(event.stakesScore || event.expected || 0);
    const description = [
      `Sport: ${event.sport || event.key}`,
      `Broadcaster: ${event.broadcaster || "Check local listings"}`,
      `Stakes: ${stakes}/5`,
      "Synced by nothingsport",
    ].join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeCalendarText(event.eventId || event.id)}@nothingsports`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Australia/Sydney:${buildLocalDateTime(event.date, event.time)}`,
      `DURATION:PT${durationHours}H`,
      `SUMMARY:${escapeCalendarText(event.spoilerSafeTitle || event.displayTitleCompact || event.name)}`,
      `DESCRIPTION:${escapeCalendarText(description)}`,
      `CATEGORIES:${escapeCalendarText(event.sport || event.key)}`,
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT"
    );
    if (event.venue) lines.push(`LOCATION:${escapeCalendarText(event.venue)}`);
    if (reminderMinutes > 0){
      lines.push(
        "BEGIN:VALARM",
        `TRIGGER:-PT${reminderMinutes}M`,
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeCalendarText(`nothingsport: ${event.spoilerSafeTitle || event.displayTitleCompact || event.name}`)}`,
        "END:VALARM"
      );
    }
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return `${lines.flatMap(foldCalendarLine).join("\r\n")}\r\n`;
}

function calendarSyncQuery(config){
  const params = new URLSearchParams();
  params.set("sports", uniqueStrings(config.sports || []).sort().join(","));
  if (config.providers?.length) params.set("providers", uniqueStrings(config.providers).sort().join(","));
  if (config.allFixtures?.length) params.set("all", uniqueStrings(config.allFixtures).sort().join(","));
  if (config.majorFollowedSports?.length) params.set("majorFollowed", uniqueStrings(config.majorFollowedSports).sort().join(","));
  if (config.followedParticipantIds?.length) params.set("follow", uniqueStrings(config.followedParticipantIds).sort().join(","));
  if (config.mutedParticipantIds?.length) params.set("mute", uniqueStrings(config.mutedParticipantIds).sort().join(","));
  if (config.excludedCompetitionIds?.length) params.set("excludeCompetition", uniqueStrings(config.excludedCompetitionIds).sort().join(","));
  if (config.cwgDisciplines?.length) params.set("cwg", uniqueStrings(config.cwgDisciplines).sort().join(","));
  params.set("min", String(clampInteger(config.minStakes, 3, 1, 5)));
  params.set("reminder", String(clampInteger(config.reminderMinutes, 60, 0, 10080)));
  return params.toString();
}

module.exports = {
  PROVIDER_ALIASES,
  normalizeCalendarSyncQuery,
  inferProviderIds,
  eventProviderIds,
  eventParticipantIds,
  eventCommonwealthDiscipline,
  eventDateTime,
  calendarEventIsCurrent,
  filterCalendarEvents,
  buildCalendarIcs,
  calendarSyncQuery,
};
