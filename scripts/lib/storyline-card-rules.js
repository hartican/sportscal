const RESULT_LEAK = /\b(?:won|lost\s+(?:to|against|by)|beat|defeated|winner|loser|score|margin|advanced|reached|eliminated|victory|(?:became|crowned)\s+champions?|hat[- ]trick|finished\s+(?:first|second|third)|took\s+pole|claimed\s+(?:the\s+)?(?:title|lead))\b|(?<![\d–-])\b\d{1,3}\s*[-–]\s*\d{1,3}\b(?!\s*[-–]\s*\d)/i;
const PREVIEW_LEAK = /\b(?:won|beat|defeated|completed|final score)\b|\blost\b(?!\s+time)/i;
const PREVIEW_TENSE = /\b(?:will|awaits|host|upcoming)\b/i;
const STORYLINE_OVERRIDES = require("../../config/storyline-overrides.js");
const ENRICHMENT_ENGINE = require("../../config/enrichment-engine.js");
const MANUAL_STORYLINE_OVERRIDES = STORYLINE_OVERRIDES.overrides;

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
  return ENRICHMENT_ENGINE.stakesScoreFor(event);
}

function intensityFor(event, stakes) {
  return ENRICHMENT_ENGINE.intensityFor(event, stakes);
}

function archetypeFor(event, stakes) {
  const name = String(event.name || "");
  if (/Grand Final|Super Bowl|World Cup Final|NBA Finals|Wimbledon.*Final/i.test(name)) return "championship decider";
  if (/Quarterfinal|Semifinal|Preliminary Finals|Round of 16|Round of 32/i.test(name)) return "elimination";
  if (/Wallabies|Test/i.test(name) && stakes >= 4) return "international test";
  if (/Le Mans|Masters/i.test(name) && stakes >= 4) return "major test";
  return undefined;
}

function storylineOverrideFor(event) {
  const override = MANUAL_STORYLINE_OVERRIDES[event.id];
  if (!override) return null;
  return Object.fromEntries([
    "stakes",
    "intensity",
    "archetype",
    "arcStage",
    "hookSpoilerOff",
    "hookSpoilerOn",
    "synopsisSpoilerOff",
    "synopsisSpoilerOn",
    "expectedSpectacle",
    "actualSpectacle",
  ].filter(field => override[field] !== undefined).map(field => [field, override[field]]));
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
  const manualOverride = storylineOverrideFor(event);
  const base = {
    ...(event.storyline || {}),
    stakes,
    intensity,
    arcStage: status === "completed" ? "recap" : "preview",
    expectedSpectacle: Number(event.expected || 1),
    intensitySource: manualOverride?.intensity ? "manual" : "computed",
  };
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
  return {
    ...base,
    ...(manualOverride || {}),
    ...(MANUAL_STORYLINE_OVERRIDES[event.id] ? { lastReviewedAt: MANUAL_STORYLINE_OVERRIDES[event.id].reviewedAt } : {}),
    // Lifecycle is canonical. A stale manual override must never turn a
    // completed recap back into preview copy (or vice versa).
    arcStage: status === "completed" ? "recap" : "preview",
  };
}

function spoilerSafeRootCopy(event, storyline = event.storyline, now = new Date()) {
  const status = lifecycleFor(event, now);
  if (status !== "completed") {
    return {
      hook: String(event.selectedSentence || "").trim(),
      synopsis: String(event.fullSpiel || event.selectedSentence || "").trim(),
    };
  }
  const safe = safeCompletedCopy(event);
  return {
    hook: compactCopy(storyline?.hookSpoilerOff || safe.hook, 25),
    synopsis: compactCopy(storyline?.synopsisSpoilerOff || safe.synopsis, 80),
  };
}

function spoilerContractIssues(event, now = new Date()) {
  const issues = [];
  const status = lifecycleFor(event, now);
  const completed = status === "completed";
  const storyline = event.storyline || {};
  const researchedPreview = ["editorial-narrative.v2", "editorial-narrative.v3"].includes(event.editorialNarrative?.schemaVersion);
  const rootCopy = `${event.selectedSentence || ""}\n${event.fullSpiel || ""}`;

  if (completed && RESULT_LEAK.test(rootCopy)) {
    issues.push("default selectedSentence/fullSpiel leaks a completed result");
  }
  if (!completed && !researchedPreview && PREVIEW_LEAK.test(rootCopy)) {
    issues.push("upcoming selectedSentence/fullSpiel contains completed-result language");
  }

  if (Object.keys(storyline).length) {
    const expectedArc = completed ? "recap" : "preview";
    if (storyline.arcStage && storyline.arcStage !== expectedArc) {
      issues.push(`storyline.arcStage is ${storyline.arcStage}; expected ${expectedArc}`);
    }
    const off = `${storyline.hookSpoilerOff || ""}\n${storyline.synopsisSpoilerOff || ""}`;
    const on = `${storyline.hookSpoilerOn || ""}\n${storyline.synopsisSpoilerOn || ""}`;
    if (completed) {
      if (RESULT_LEAK.test(off)) issues.push("storyline spoiler-OFF copy leaks a result");
      if (off.trim() && off === on) issues.push("completed storyline spoiler ON/OFF copy is identical");
      if (PREVIEW_TENSE.test(on)) issues.push("completed storyline spoiler-ON copy still reads as a preview");
    } else if (!researchedPreview && PREVIEW_LEAK.test(`${off}\n${on}`)) {
      issues.push("upcoming storyline copy contains completed-result language");
    }
  }

  return issues;
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
  safeCompletedCopy,
  spoilerContractIssues,
  spoilerSafeRootCopy,
  storylineFor,
  isMajorCard,
};
