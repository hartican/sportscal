const RESULT_LEAK = /\b(?:won|lost|beat|defeated|winner|loser|score|margin|\d{1,3}\s*[-–]\s*\d{1,3})\b/i;
const PREVIEW_LEAK = /\b(?:won|lost|beat|defeated|completed|final score)\b/i;
const PREVIEW_TENSE = /\b(?:will|awaits|host|upcoming)\b/i;
const MANUAL_STORYLINE_OVERRIDES = {
  "nrl-raiders-rabbitohs-2026-07-18": {
    stakes: 4,
    intensity: 4,
    archetype: "finals push",
    arcStage: "recap",
    hookSpoilerOff: "A fast start, a late Souths surge and a desperate final stand in Canberra.",
    hookSpoilerOn: "Canberra held off Souths 34–24 to make it three wins in a row.",
    synopsisSpoilerOff: "The contest swung sharply after half-time before a tense late finish at GIO Stadium. Canberra's season-defining urgency was tested to the last set.",
    synopsisSpoilerOn: "The Raiders built the platform early, absorbed a second-half Rabbitohs surge and closed out a valuable home win. The result kept their late finals push alive, though Hudson Young left injured.",
    expectedSpectacle: 8,
    actualSpectacle: 8,
  },
  "rugby-australia-italy-2026-07-18": {
    stakes: 4,
    intensity: 4,
    archetype: "reset under pressure",
    arcStage: "preview",
    hookSpoilerOff: "A reset opportunity in Perth, with pressure and transition hanging over the Wallabies.",
    hookSpoilerOn: "A reset opportunity in Perth, with pressure and transition hanging over the Wallabies.",
    synopsisSpoilerOff: "Carlo Tizzano starts in his hometown as Australia reshapes its XV after two losses. With Joe Schmidt's final Test in charge and an injury-hit Italy arriving, the Wallabies need their accuracy to hold for 80 minutes.",
    synopsisSpoilerOn: "Carlo Tizzano starts in his hometown as Australia reshapes its XV after two losses. With Joe Schmidt's final Test in charge and an injury-hit Italy arriving, the Wallabies need their accuracy to hold for 80 minutes.",
    expectedSpectacle: 8,
  },
};

function wordCount(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function compactCopy(value, maxWords) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ").replace(/[,:;]$/, "")}…`;
}

function startTime(event) {
  return new Date(`${event.date}T${event.time}:00+10:00`);
}

function lifecycleFor(event, now = new Date()) {
  if (event.status === "completed" || event.status === "upcoming") return event.status;
  const end = startTime(event).getTime() + Number(event.liveWindow || 3) * 60 * 60 * 1000;
  return end < now.getTime() ? "completed" : "upcoming";
}

function stakesFor(event) {
  if (Number.isInteger(MANUAL_STORYLINE_OVERRIDES[event.id]?.stakes)) return MANUAL_STORYLINE_OVERRIDES[event.id].stakes;
  const name = String(event.name || "");
  const expected = Number(event.expected || 0);
  if (/Super Bowl|Grand Final|FIFA World Cup Final|NBA Finals|Wimbledon.*Final|NRL Preliminary Finals/i.test(name)) return 5;
  if (expected >= 10) return 5;
  if (/Wallabies|Le Mans|Masters|World Cup.*(?:Quarterfinal|Semifinal)|Wimbledon.*(?:Quarterfinal|Semifinal)|Rugby League World Cup/i.test(name)) return 4;
  if (expected >= 8) return 4;
  if (expected >= 6) return 3;
  if (expected >= 4) return 2;
  return 1;
}

function intensityFor(event, stakes) {
  const expected = Number(event.expected || 0);
  if (stakes === 5 || expected >= 10) return 5;
  if (stakes === 4 || expected >= 8) return 4;
  if (stakes === 3) return 3;
  return Math.max(1, stakes);
}

function archetypeFor(event, stakes) {
  const name = String(event.name || "");
  if (/Grand Final|Super Bowl|World Cup Final|NBA Finals|Wimbledon.*Final/i.test(name)) return "championship decider";
  if (/Quarterfinal|Semifinal|Preliminary Finals|Round of 16|Round of 32/i.test(name)) return "elimination";
  if (/Wallabies|Test/i.test(name) && stakes >= 4) return "international test";
  if (/Le Mans|Masters/i.test(name) && stakes >= 4) return "major test";
  return undefined;
}

function participantsFor(event) {
  if (Array.isArray(event.participants) && event.participants.length >= 2 && event.participants.every(participant => participant?.name && !/^s\s+/i.test(participant.name))) return event.participants;
  const title = String(event.name || "").replace(/\s+—.*$/, "");
  const parts = title.split(/\s+v(?:s\.?)?\s+/i).map(value => value.trim()).filter(Boolean);
  if (parts.length !== 2) return undefined;
  return [
    { name: parts[0], role: "home" },
    { name: parts[1], role: "away" },
  ];
}

function safeCompletedCopy(event) {
  const title = event.displayTitleCompact || event.name || "This event";
  return {
    hook: `${title} is complete; the key moments are protected until you choose to reveal them.`,
    synopsis: `${title} is complete. The defining moments and result-aware recap are ready when you are, without giving anything away here.`,
  };
}

function previewCopy(event) {
  const title = event.displayTitleCompact || event.name || "This event";
  const hook = String(event.selectedSentence || "").trim();
  const synopsis = String(event.fullSpiel || hook).trim();
  if (!hook || PREVIEW_LEAK.test(hook)) {
    return {
      hook: `${title} is coming up, with the main context and watch details in place.`,
      synopsis: `${title} is still ahead. This card will stay spoiler-safe until the event is complete and its result has been reviewed.`,
    };
  }
  return {
    hook: compactCopy(hook, 25),
    synopsis: compactCopy(PREVIEW_LEAK.test(synopsis) ? `${title} is still ahead. This card will stay spoiler-safe until the event is complete and its result has been reviewed.` : synopsis, 80),
  };
}

function storylineFor(event, now = new Date()) {
  const status = lifecycleFor(event, now);
  const stakes = stakesFor(event);
  const intensity = intensityFor(event, stakes);
  const archetype = archetypeFor(event, stakes);
  const base = { ...(event.storyline || {}), stakes, intensity, arcStage: status === "completed" ? "recap" : "preview", expectedSpectacle: Number(event.expected || 1) };
  if (archetype) base.archetype = archetype;
  else delete base.archetype;
  if (status === "completed") {
    const safe = safeCompletedCopy(event);
    base.hookSpoilerOff = compactCopy(safe.hook, 25);
    base.synopsisSpoilerOff = compactCopy(safe.synopsis, 80);
    base.hookSpoilerOn = compactCopy(event.outcomeText || `${event.displayTitleCompact || event.name} is complete.`, 25);
    base.synopsisSpoilerOn = compactCopy(event.recapText || event.fullSpiel || `${event.displayTitleCompact || event.name} is complete.`, 80);
    if (Number.isFinite(Number(event.actualSpectacle))) base.actualSpectacle = Number(event.actualSpectacle);
  } else {
    const preview = previewCopy(event);
    base.hookSpoilerOff = preview.hook;
    base.hookSpoilerOn = preview.hook;
    base.synopsisSpoilerOff = preview.synopsis;
    base.synopsisSpoilerOn = preview.synopsis;
    delete base.actualSpectacle;
  }
  return { ...base, ...(MANUAL_STORYLINE_OVERRIDES[event.id] || {}) };
}

function isMajorCard(event) {
  return stakesFor(event) >= 4 || Number(event.storyline?.stakes) >= 4;
}

module.exports = {
  RESULT_LEAK,
  PREVIEW_LEAK,
  PREVIEW_TENSE,
  MANUAL_STORYLINE_OVERRIDES,
  wordCount,
  compactCopy,
  lifecycleFor,
  stakesFor,
  intensityFor,
  participantsFor,
  storylineFor,
  isMajorCard,
};
