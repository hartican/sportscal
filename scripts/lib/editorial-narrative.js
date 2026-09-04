"use strict";

const GENERIC_COPY = /\b(?:exact matchup|date tbc|time tbc|schedule copy|main context and watch details|season narrowing|coming up, with the main context)\b/i;
const ID_PATTERN = /^[a-z0-9][a-z0-9:._-]*$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const SOURCE_TYPES = new Set(["official", "broadcaster", "reputable"]);
const SUBJECT_KINDS = new Set(["athlete", "team", "competition", "series", "event"]);
const DIMENSIONS = new Set(["format", "path", "form", "matchup", "history", "consequence", "venue", "schedule"]);
const SUBSTANTIVE_DIMENSIONS = new Set(["path", "form", "matchup", "history", "consequence"]);
const TARGET_TYPES = new Set(["feed-event", "major-event"]);
const GENERATION_MODES = new Set(["researched", "source-derived-fallback"]);
const TIER_REQUIREMENTS = Object.freeze({
  2: Object.freeze({ facts:1, sources:1, dimensions:1 }),
  3: Object.freeze({ facts:2, sources:1, dimensions:1 }),
  4: Object.freeze({ facts:3, sources:2, dimensions:2 }),
  5: Object.freeze({ facts:4, sources:3, dimensions:3 }),
});
const FORBIDDEN_MEMORY_KEYS = new Set(["userId", "user_id", "profileId", "profile_id", "persona", "personas", "weight", "weights", "rawRatings", "ratings", "contributors"]);

function nonEmpty(value){ return typeof value === "string" && value.trim().length > 0; }
function isIsoDateTime(value){ return nonEmpty(value) && ISO_DATE_TIME.test(value) && !Number.isNaN(new Date(value).getTime()); }
function idFor(record){ return String(record?.eventId || record?.id || ""); }
function unique(values){ return Array.from(new Set(values)); }

function duplicateIds(records){
  const seen = new Set();
  return records.map(record => record?.id).filter(id => seen.has(id) || !seen.add(id));
}

function validateConsequence(consequence, { subjects = new Map(), sources = new Map(), facts = new Map(), projection = null, label = "consequence" } = {}){
  const issues = [];
  if (!consequence || typeof consequence !== "object" || Array.isArray(consequence)) return [`${label} must be an object.`];
  if (consequence.schemaVersion !== "editorial-consequence.v1") issues.push(`${label}.schemaVersion must be editorial-consequence.v1.`);
  if (!isIsoDateTime(consequence.capturedAt)) issues.push(`${label}.capturedAt must be an ISO UTC date-time.`);
  if (!ID_PATTERN.test(consequence.primarySubjectId || "")) issues.push(`${label}.primarySubjectId must be a stable editorial id.`);
  if (!Array.isArray(consequence.participants) || consequence.participants.length !== 2) {
    issues.push(`${label}.participants must contain exactly two participants.`);
  }
  const participants = Array.isArray(consequence.participants) ? consequence.participants : [];
  const participantIds = participants.map(participant => participant?.subjectId).filter(Boolean);
  if (new Set(participantIds).size !== participantIds.length) issues.push(`${label}.participants must use distinct subject ids.`);
  if (!participantIds.includes(consequence.primarySubjectId)) issues.push(`${label}.primarySubjectId must identify one of the participants.`);
  participants.forEach((participant, participantIndex) => {
    const participantLabel = `${label}.participants[${participantIndex}]`;
    if (!ID_PATTERN.test(participant?.subjectId || "")) issues.push(`${participantLabel}.subjectId must be a stable editorial id.`);
    else if (subjects.size && !subjects.has(participant.subjectId)) issues.push(`${participantLabel} references unknown subject ${participant.subjectId}.`);
    if (!nonEmpty(participant?.name) || participant.name.length > 100) issues.push(`${participantLabel}.name must be 1-100 characters.`);
    if (!nonEmpty(participant?.need) || participant.need.length < 12 || participant.need.length > 240) issues.push(`${participantLabel}.need must be 12-240 characters.`);
    ["win", "draw", "loss"].forEach(outcomeKey => {
      const outcome = participant?.outcomes?.[outcomeKey];
      const outcomeLabel = `${participantLabel}.outcomes.${outcomeKey}`;
      if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) {
        issues.push(`${outcomeLabel} is required.`);
        return;
      }
      if (!nonEmpty(outcome.effect) || outcome.effect.length < 12 || outcome.effect.length > 240) issues.push(`${outcomeLabel}.effect must be 12-240 characters.`);
      if (!["certain", "conditional"].includes(outcome.certainty)) issues.push(`${outcomeLabel}.certainty is unsupported.`);
      if (outcome.certainty === "conditional" && (!nonEmpty(outcome.dependsOn) || outcome.dependsOn.length < 12 || outcome.dependsOn.length > 240)) issues.push(`${outcomeLabel}.dependsOn must explain the unresolved dependency.`);
      ["factIds", "sourceIds"].forEach(field => {
        const values = outcome[field];
        if (!Array.isArray(values) || !values.length || new Set(values).size !== values.length) issues.push(`${outcomeLabel}.${field} must contain unique provenance ids.`);
      });
      (outcome.factIds || []).forEach(id => {
        if (facts.size && !facts.has(id)) issues.push(`${outcomeLabel} references unknown fact ${id}.`);
        if (Array.isArray(consequence.factIds) && !consequence.factIds.includes(id)) issues.push(`${outcomeLabel}.factIds must be included in ${label}.factIds.`);
      });
      (outcome.sourceIds || []).forEach(id => {
        if (sources.size && !sources.has(id)) issues.push(`${outcomeLabel} references unknown source ${id}.`);
        if (Array.isArray(consequence.sourceIds) && !consequence.sourceIds.includes(id)) issues.push(`${outcomeLabel}.sourceIds must be included in ${label}.sourceIds.`);
      });
    });
  });
  if (!nonEmpty(consequence.previewSentence) || consequence.previewSentence.length < 20 || consequence.previewSentence.length > 360) issues.push(`${label}.previewSentence must be 20-360 characters.`);
  else {
    if (!/^If\b/i.test(consequence.previewSentence)) issues.push(`${label}.previewSentence must use an explicit If-then construction.`);
    const primaryName = participants.find(participant => participant?.subjectId === consequence.primarySubjectId)?.name;
    if (primaryName && !consequence.previewSentence.toLowerCase().includes(primaryName.toLowerCase())) issues.push(`${label}.previewSentence must name its primary subject.`);
  }
  ["factIds", "sourceIds"].forEach(field => {
    const values = consequence[field];
    if (!Array.isArray(values) || !values.length || new Set(values).size !== values.length) issues.push(`${label}.${field} must contain unique provenance ids.`);
  });
  (consequence.factIds || []).forEach(id => {
    if (facts.size && !facts.has(id)) issues.push(`${label} references unknown fact ${id}.`);
    if (projection && !(projection.factIds || []).includes(id)) issues.push(`${label}.factIds must be included in ${projection.id}.factIds.`);
  });
  (consequence.sourceIds || []).forEach(id => {
    if (sources.size && !sources.has(id)) issues.push(`${label} references unknown source ${id}.`);
    if (projection && !(projection.sourceIds || []).includes(id)) issues.push(`${label}.sourceIds must be included in ${projection.id}.sourceIds.`);
  });
  if (consequence.spoilerOnSentence !== undefined) {
    if (!nonEmpty(consequence.spoilerOnSentence) || consequence.spoilerOnSentence.length < 20 || consequence.spoilerOnSentence.length > 700) issues.push(`${label}.spoilerOnSentence must be 20-700 characters when supplied.`);
    if (!isIsoDateTime(consequence.resultCapturedAt)) issues.push(`${label}.resultCapturedAt is required with spoilerOnSentence.`);
    [["resultFactIds", facts, "factIds"], ["resultSourceIds", sources, "sourceIds"]].forEach(([field, index, parentField]) => {
      const values = consequence[field];
      if (!Array.isArray(values) || !values.length || new Set(values).size !== values.length) issues.push(`${label}.${field} must contain unique result provenance ids.`);
      (values || []).forEach(id => {
        if (index.size && !index.has(id)) issues.push(`${label}.${field} references unknown provenance ${id}.`);
        if (Array.isArray(consequence[parentField]) && !consequence[parentField].includes(id)) issues.push(`${label}.${field} must be included in ${label}.${parentField}.`);
        if (projection && !(projection[parentField] || []).includes(id)) issues.push(`${label}.${field} must be included in ${projection.id}.${parentField}.`);
      });
    });
    participants.forEach(participant => {
      if (nonEmpty(participant?.name) && !String(consequence.spoilerOnSentence || "").toLowerCase().includes(participant.name.toLowerCase())) issues.push(`${label}.spoilerOnSentence must explain the result for ${participant.name}.`);
    });
  } else if (consequence.resultCapturedAt !== undefined || consequence.resultFactIds !== undefined || consequence.resultSourceIds !== undefined) {
    issues.push(`${label} result provenance cannot be supplied without spoilerOnSentence.`);
  }
  return issues;
}

function validateKnowledge(document){
  const issues = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return ["Editorial knowledge must be a JSON object."];
  if (document.schemaVersion !== "editorial-knowledge.v2") issues.push("schemaVersion must be editorial-knowledge.v2.");
  if (!isIsoDateTime(document.updatedAt)) issues.push("updatedAt must be an ISO UTC date-time.");
  ["subjects", "sources", "narrativeFacts", "narrativeThreads", "audienceMemories", "eventProjections"].forEach(field => {
    if (!Array.isArray(document[field])) issues.push(`${field} must be an array.`);
  });
  if (issues.length) return issues;

  const collections = [
    ["subjects", document.subjects],
    ["sources", document.sources],
    ["narrativeFacts", document.narrativeFacts],
    ["narrativeThreads", document.narrativeThreads],
    ["audienceMemories", document.audienceMemories],
    ["eventProjections", document.eventProjections],
  ];
  collections.forEach(([label, records]) => {
    duplicateIds(records).forEach(id => issues.push(`${label} contains duplicate id ${id}.`));
    records.forEach((record, index) => {
      if (!ID_PATTERN.test(record?.id || "")) issues.push(`${label}[${index}].id must be a stable lowercase editorial id.`);
    });
  });

  const subjects = new Map(document.subjects.map(subject => [subject.id, subject]));
  const sources = new Map(document.sources.map(source => [source.id, source]));
  const facts = new Map(document.narrativeFacts.map(fact => [fact.id, fact]));
  const threads = new Map(document.narrativeThreads.map(thread => [thread.id, thread]));

  document.subjects.forEach(subject => {
    if (!SUBJECT_KINDS.has(subject.kind)) issues.push(`${subject.id}.kind is unsupported.`);
    if (!nonEmpty(subject.name)) issues.push(`${subject.id}.name is required.`);
  });
  document.sources.forEach(source => {
    if (!nonEmpty(source.name)) issues.push(`${source.id}.name is required.`);
    if (!/^https:\/\//.test(source.url || "")) issues.push(`${source.id}.url must be https.`);
    if (!SOURCE_TYPES.has(source.sourceType)) issues.push(`${source.id}.sourceType is unsupported.`);
    if (!isIsoDateTime(source.checkedAt)) issues.push(`${source.id}.checkedAt must be an ISO UTC date-time.`);
  });
  document.narrativeFacts.forEach(fact => {
    if (!Array.isArray(fact.subjectIds) || !fact.subjectIds.length) issues.push(`${fact.id}.subjectIds is required.`);
    (fact.subjectIds || []).forEach(id => { if (!subjects.has(id)) issues.push(`${fact.id} references unknown subject ${id}.`); });
    if (!nonEmpty(fact.statement) || fact.statement.length < 20 || fact.statement.length > 320) issues.push(`${fact.id}.statement must be 20-320 characters.`);
    if (!DIMENSIONS.has(fact.dimension)) issues.push(`${fact.id}.dimension is unsupported.`);
    if (!Array.isArray(fact.sourceIds) || !fact.sourceIds.length) issues.push(`${fact.id}.sourceIds is required.`);
    (fact.sourceIds || []).forEach(id => { if (!sources.has(id)) issues.push(`${fact.id} references unknown source ${id}.`); });
    if (!isIsoDateTime(fact.observedAt)) issues.push(`${fact.id}.observedAt must be an ISO UTC date-time.`);
    if (fact.expiresAt !== undefined && fact.expiresAt !== null && !isIsoDateTime(fact.expiresAt)) issues.push(`${fact.id}.expiresAt must be null or an ISO UTC date-time.`);
  });
  document.narrativeThreads.forEach(thread => {
    if (!Array.isArray(thread.subjectIds) || !thread.subjectIds.length) issues.push(`${thread.id}.subjectIds is required.`);
    (thread.subjectIds || []).forEach(id => { if (!subjects.has(id)) issues.push(`${thread.id} references unknown subject ${id}.`); });
    if (!nonEmpty(thread.title)) issues.push(`${thread.id}.title is required.`);
    if (!nonEmpty(thread.summary) || thread.summary.length < 80 || thread.summary.length > 700) issues.push(`${thread.id}.summary must be 80-700 characters.`);
    if (!Array.isArray(thread.factIds) || !thread.factIds.length) issues.push(`${thread.id}.factIds is required.`);
    (thread.factIds || []).forEach(id => { if (!facts.has(id)) issues.push(`${thread.id} references unknown fact ${id}.`); });
    if (!["active", "resolved", "dormant"].includes(thread.status)) issues.push(`${thread.id}.status is unsupported.`);
    if (!isIsoDateTime(thread.updatedAt)) issues.push(`${thread.id}.updatedAt must be an ISO UTC date-time.`);
  });

  const audienceMemories = new Map(document.audienceMemories.map(memory => [memory.id, memory]));
  document.audienceMemories.forEach(memory => {
    const visit = value => {
      if (!value || typeof value !== "object") return;
      Object.entries(value).forEach(([key, item]) => {
        if (FORBIDDEN_MEMORY_KEYS.has(key)) issues.push(`${memory.id} contains forbidden identity or raw-rating field ${key}.`);
        visit(item);
      });
    };
    visit(memory);
    if (!nonEmpty(memory.sourceEventId)) issues.push(`${memory.id}.sourceEventId is required.`);
    if (!Array.isArray(memory.linkedThreadIds) || !memory.linkedThreadIds.length) issues.push(`${memory.id}.linkedThreadIds is required.`);
    (memory.linkedThreadIds || []).forEach(id => { if (!threads.has(id)) issues.push(`${memory.id} references unknown thread ${id}.`); });
    if (!Array.isArray(memory.subjectIds) || !memory.subjectIds.length) issues.push(`${memory.id}.subjectIds is required.`);
    (memory.subjectIds || []).forEach(id => { if (!subjects.has(id)) issues.push(`${memory.id} references unknown subject ${id}.`); });
    if (!Number.isFinite(Number(memory.impactScore)) || Number(memory.impactScore) < 1 || Number(memory.impactScore) > 5) issues.push(`${memory.id}.impactScore must be 1-5.`);
    if (!Number.isInteger(memory.uniqueContributorCount) || memory.uniqueContributorCount < 3) issues.push(`${memory.id}.uniqueContributorCount must be at least 3.`);
    if (!Array.isArray(memory.leadingTags) || memory.leadingTags.length > 3 || memory.leadingTags.some(tag => !nonEmpty(tag))) issues.push(`${memory.id}.leadingTags must contain up to three labels.`);
    if (!isIsoDateTime(memory.capturedAt)) issues.push(`${memory.id}.capturedAt must be an ISO UTC date-time.`);
    if (!isIsoDateTime(memory.expiresAt)) issues.push(`${memory.id}.expiresAt must be an ISO UTC date-time.`);
    if (memory.carryProjectionId !== undefined && memory.carryProjectionId !== null && !ID_PATTERN.test(memory.carryProjectionId)) issues.push(`${memory.id}.carryProjectionId must be null or a stable projection id.`);
  });

  const projectionTargets = new Set();
  const hooks = new Map();
  document.eventProjections.forEach(projection => {
    if (!TARGET_TYPES.has(projection.targetType)) issues.push(`${projection.id}.targetType is unsupported.`);
    if (!Array.isArray(projection.targetIds) || !projection.targetIds.length) issues.push(`${projection.id}.targetIds is required.`);
    (projection.targetIds || []).forEach(targetId => {
      const targetKey = `${projection.targetType}:${targetId}`;
      if (projectionTargets.has(targetKey)) issues.push(`${targetKey} has more than one editorial projection.`);
      projectionTargets.add(targetKey);
    });
    const requirement = TIER_REQUIREMENTS[projection.stakes];
    if (!requirement) issues.push(`${projection.id}.stakes must be 2, 3, 4 or 5.`);
    if (!nonEmpty(projection.hook) || projection.hook.length < 20 || projection.hook.length > 180) issues.push(`${projection.id}.hook must be 20-180 characters.`);
    if (!nonEmpty(projection.synopsis) || projection.synopsis.length < 80 || projection.synopsis.length > 700) issues.push(`${projection.id}.synopsis must be 80-700 characters.`);
    if (GENERIC_COPY.test(`${projection.hook}\n${projection.synopsis}`)) issues.push(`${projection.id} contains generic fixture filler instead of an editorial angle.`);
    if (!Array.isArray(projection.threadIds) || !projection.threadIds.length) issues.push(`${projection.id}.threadIds is required.`);
    (projection.threadIds || []).forEach(id => { if (!threads.has(id)) issues.push(`${projection.id} references unknown thread ${id}.`); });
    (projection.factIds || []).forEach(id => { if (!facts.has(id)) issues.push(`${projection.id} references unknown fact ${id}.`); });
    (projection.sourceIds || []).forEach(id => { if (!sources.has(id)) issues.push(`${projection.id} references unknown source ${id}.`); });
    const dimensions = unique((projection.factIds || []).map(id => facts.get(id)?.dimension).filter(Boolean));
    const factSourceIds = unique((projection.factIds || []).flatMap(id => facts.get(id)?.sourceIds || []));
    if (requirement && (projection.factIds || []).length < requirement.facts) issues.push(`${projection.id} needs at least ${requirement.facts} facts for stakes ${projection.stakes}.`);
    if (requirement && (projection.sourceIds || []).length < requirement.sources) issues.push(`${projection.id} needs at least ${requirement.sources} sources for stakes ${projection.stakes}.`);
    if (requirement && dimensions.length < requirement.dimensions) issues.push(`${projection.id} needs at least ${requirement.dimensions} narrative dimensions for stakes ${projection.stakes}.`);
    if (!dimensions.some(dimension => SUBSTANTIVE_DIMENSIONS.has(dimension))) issues.push(`${projection.id} needs at least one path, form, matchup, history or consequence fact.`);
    factSourceIds.forEach(id => { if (!(projection.sourceIds || []).includes(id)) issues.push(`${projection.id}.sourceIds must include fact source ${id}.`); });
    if (!isIsoDateTime(projection.researchedAt)) issues.push(`${projection.id}.researchedAt must be an ISO UTC date-time.`);
    if (projection.refreshAfter !== undefined && projection.refreshAfter !== null && !isIsoDateTime(projection.refreshAfter)) issues.push(`${projection.id}.refreshAfter must be null or an ISO UTC date-time.`);
    if (!GENERATION_MODES.has(projection.generationMode)) issues.push(`${projection.id}.generationMode is unsupported.`);
    if (projection.hookSpoilerOn !== undefined && (!nonEmpty(projection.hookSpoilerOn) || projection.hookSpoilerOn.length > 180)) issues.push(`${projection.id}.hookSpoilerOn must be 1-180 characters when supplied.`);
    if (projection.synopsisSpoilerOn !== undefined && (!nonEmpty(projection.synopsisSpoilerOn) || projection.synopsisSpoilerOn.length > 700)) issues.push(`${projection.id}.synopsisSpoilerOn must be 1-700 characters when supplied.`);
    if (projection.audienceMemoryId !== undefined && !audienceMemories.has(projection.audienceMemoryId)) issues.push(`${projection.id} references unknown audience memory ${projection.audienceMemoryId}.`);
    if (projection.consequence !== undefined) issues.push(...validateConsequence(projection.consequence, { subjects, sources, facts, projection, label:`${projection.id}.consequence` }));
    if (projection.originalityReview?.method !== "independent-summary-no-source-prose-retained" || !isIsoDateTime(projection.originalityReview?.reviewedAt)) issues.push(`${projection.id}.originalityReview must record the independent-summary review.`);
    const normalizedHook = String(projection.hook || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (normalizedHook){
      if (hooks.has(normalizedHook)) issues.push(`${projection.id} duplicates the hook from ${hooks.get(normalizedHook)}.`);
      else hooks.set(normalizedHook, projection.id);
    }
    (projection.sourceIds || []).forEach(sourceId => {
      const sourceName = String(sources.get(sourceId)?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (sourceName && normalizedHook === sourceName) issues.push(`${projection.id}.hook duplicates a source title.`);
    });
  });
  return issues;
}

function indexesFor(document){
  return {
    sources:new Map(document.sources.map(source => [source.id, source])),
    facts:new Map(document.narrativeFacts.map(fact => [fact.id, fact])),
    threads:new Map(document.narrativeThreads.map(thread => [thread.id, thread])),
    audienceMemories:new Map((document.audienceMemories || []).map(memory => [memory.id, memory])),
  };
}

function projectionForTarget(document, targetType, record){
  const ids = unique([record?.id, record?.eventId, record?.canonicalEventId].map(value => String(value || "")).filter(Boolean));
  return document.eventProjections.find(projection => projection.targetType === targetType && projection.targetIds.some(id => ids.includes(id))) || null;
}

function editorialNarrativeFor(projection, indexes){
  const dimensions = unique(projection.factIds.map(id => indexes.facts.get(id)?.dimension).filter(Boolean));
  const memory = projection.audienceMemoryId ? indexes.audienceMemories.get(projection.audienceMemoryId) : null;
  const sentiment = memory ? {
    sourceEventId:memory.sourceEventId,
    impactScore:Number(memory.impactScore),
    uniqueContributorCount:memory.uniqueContributorCount,
    leadingTags:[...memory.leadingTags],
    capturedAt:memory.capturedAt,
    expiresAt:memory.expiresAt,
    relationship:projection.targetIds.includes(memory.sourceEventId) ? "source" : "carried",
  } : undefined;
  return {
    schemaVersion:projection.consequence ? "editorial-narrative.v3" : "editorial-narrative.v2",
    projectionId:projection.id,
    researchTier:projection.stakes === 5 ? "marquee" : projection.stakes === 4 ? "featured" : "standard",
    hook:projection.hook,
    synopsis:projection.synopsis,
    ...(projection.hookSpoilerOn ? { hookSpoilerOn:projection.hookSpoilerOn } : {}),
    ...(projection.synopsisSpoilerOn ? { synopsisSpoilerOn:projection.synopsisSpoilerOn } : {}),
    threadIds:[...projection.threadIds],
    factIds:[...projection.factIds],
    sourceIds:[...projection.sourceIds],
    dimensions,
    researchedAt:projection.researchedAt,
    refreshAfter:projection.refreshAfter ?? null,
    generationMode:projection.generationMode,
    ...(sentiment ? { sentiment } : {}),
    ...(projection.consequence ? { consequence:JSON.parse(JSON.stringify(projection.consequence)) } : {}),
  };
}

function applyToFeedEvent(event, projection, indexes){
  const primarySource = indexes.sources.get(projection.sourceIds[0]);
  const narrative = editorialNarrativeFor(projection, indexes);
  const completed = event.status === "completed";
  const completedHook = String(projection.hookSpoilerOn || event.outcomeText || event.scoreDisplay || "").trim()
    || `${event.displayTitleCompact || event.name || "This fixture"} is complete.`;
  const completedSynopsis = String(projection.synopsisSpoilerOn || event.recapText || event.fullSpiel || "").trim()
    || completedHook;
  const contextSignals = unique(["event-specific", ...narrative.dimensions.map(value => `narrative:${value}`)]);
  const threadTitle = indexes.threads.get(projection.threadIds[0])?.title || "Persistent editorial thread";
  return {
    ...event,
    selectedSentence:projection.hook,
    fullSpiel:projection.synopsis,
    sourceName:primarySource.name,
    sourceUrl:primarySource.url,
    sourceType:primarySource.sourceType,
    sourceCheckedAt:primarySource.checkedAt,
    lastReviewedAt:projection.researchedAt,
    editorialNarrative:narrative,
    editorialPreview:{
      status:"journalistic",
      angle:threadTitle,
      contextSignals,
      sourceName:primarySource.name,
      sourceUrl:primarySource.url,
      sourceCheckedAt:primarySource.checkedAt,
      needsPreviewRefresh:false,
    },
    storyline:{
      ...(event.storyline || {}),
      stakes:projection.stakes,
      arcStage:completed ? "recap" : "preview",
      hookSpoilerOff:projection.hook,
      hookSpoilerOn:completed ? completedHook : projection.hookSpoilerOn || projection.hook,
      synopsisSpoilerOff:projection.synopsis,
      synopsisSpoilerOn:completed ? completedSynopsis : projection.synopsisSpoilerOn || projection.synopsis,
      lastReviewedAt:projection.researchedAt,
    },
  };
}

function applyToMajorEvent(record, projection, indexes){
  const editorialSources = projection.sourceIds.map(id => indexes.sources.get(id)).map(source => ({
    name:source.name,
    url:source.url,
    checkedAt:source.checkedAt,
  }));
  const sourcesByUrl = new Map([...(record.sources || []), ...editorialSources].map(source => [source.url, source]));
  return {
    ...record,
    editorialNarrative:editorialNarrativeFor(projection, indexes),
    sources:Array.from(sourcesByUrl.values()),
  };
}

module.exports = {
  GENERIC_COPY,
  SUBSTANTIVE_DIMENSIONS,
  TIER_REQUIREMENTS,
  applyToFeedEvent,
  applyToMajorEvent,
  editorialNarrativeFor,
  idFor,
  indexesFor,
  projectionForTarget,
  validateConsequence,
  validateKnowledge,
};
