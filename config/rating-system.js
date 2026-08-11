(function attachNothingSportsRatingSystem(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_RATING_SYSTEM = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildRatingSystem(){
  "use strict";

  const SCHEMA_VERSION = "rating-prompts.v1";
  const MAX_PROMPT_RECORDS = 80;
  const LATER_SESSION_LIMIT = 3;

  function clone(value){
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function boundedInteger(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER){
    const number = Math.floor(Number(value));
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : minimum;
  }

  function safeId(value){
    return typeof value === "string" ? value.trim().slice(0, 160) : "";
  }

  function starToStoredScore(stars){
    const value = boundedInteger(stars, 1, 5);
    return value * 2;
  }

  function storedScoreToStars(score){
    if (score === null || score === undefined || score === "") return null;
    const value = Number(score);
    if (!Number.isFinite(value)) return null;
    return Math.max(0.5, Math.min(5, value / 2));
  }

  function normalizePromptRecord(record){
    const eventId = safeId(record?.eventId);
    if (!eventId) return null;
    const firstPromptSession = boundedInteger(record.firstPromptSession, 1);
    return {
      eventId,
      firstPromptSession,
      lastPromptSession: Math.max(firstPromptSession, boundedInteger(record.lastPromptSession, firstPromptSession)),
      promptCount: boundedInteger(record.promptCount, 1),
    };
  }

  function emptyPromptState(){
    return {
      schemaVersion: SCHEMA_VERSION,
      sessionCount: 0,
      lastSessionId: null,
      lastPromptSessionId: null,
      prompts: [],
    };
  }

  function normalizePromptState(input){
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const byEvent = new Map();
    (Array.isArray(source.prompts) ? source.prompts : []).forEach(candidate => {
      const record = normalizePromptRecord(candidate);
      if (!record) return;
      const previous = byEvent.get(record.eventId);
      if (!previous || record.lastPromptSession >= previous.lastPromptSession) byEvent.set(record.eventId, record);
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      sessionCount: boundedInteger(source.sessionCount),
      lastSessionId: safeId(source.lastSessionId) || null,
      lastPromptSessionId: safeId(source.lastPromptSessionId) || null,
      prompts: Array.from(byEvent.values())
        .sort((first, second) => first.lastPromptSession - second.lastPromptSession)
        .slice(-MAX_PROMPT_RECORDS),
    };
  }

  function startSession(input, sessionId){
    const state = normalizePromptState(input);
    const id = safeId(sessionId);
    if (!id || state.lastSessionId === id) return state;
    state.sessionCount += 1;
    state.lastSessionId = id;
    return state;
  }

  function canPrompt(input, eventId, { sessionId, rated = false } = {}){
    const state = normalizePromptState(input);
    const id = safeId(eventId);
    const activeSessionId = safeId(sessionId);
    if (!id || !activeSessionId || rated || state.lastSessionId !== activeSessionId) return false;
    if (state.lastPromptSessionId === activeSessionId) return false;
    const record = state.prompts.find(candidate => candidate.eventId === id);
    return !record || state.sessionCount - record.firstPromptSession <= LATER_SESSION_LIMIT;
  }

  function recordPrompt(input, eventId, { sessionId } = {}){
    const state = normalizePromptState(input);
    const id = safeId(eventId);
    const activeSessionId = safeId(sessionId);
    if (!canPrompt(state, id, { sessionId: activeSessionId })) return state;
    const previous = state.prompts.find(candidate => candidate.eventId === id);
    state.prompts = state.prompts.filter(candidate => candidate.eventId !== id);
    state.prompts.push({
      eventId: id,
      firstPromptSession: previous?.firstPromptSession || state.sessionCount,
      lastPromptSession: state.sessionCount,
      promptCount: (previous?.promptCount || 0) + 1,
    });
    state.prompts = state.prompts.slice(-MAX_PROMPT_RECORDS);
    state.lastPromptSessionId = activeSessionId;
    return state;
  }

  function mergePromptState(base, incoming){
    const previous = normalizePromptState(base);
    const patch = normalizePromptState(incoming);
    return normalizePromptState({
      sessionCount: Math.max(previous.sessionCount, patch.sessionCount),
      lastSessionId: previous.sessionCount >= patch.sessionCount ? previous.lastSessionId : patch.lastSessionId,
      lastPromptSessionId: previous.sessionCount >= patch.sessionCount ? previous.lastPromptSessionId : patch.lastPromptSessionId,
      prompts: [...previous.prompts, ...patch.prompts].reduce((records, record) => {
        const index = records.findIndex(candidate => candidate.eventId === record.eventId);
        if (index < 0) records.push(clone(record));
        else records[index] = {
          eventId: record.eventId,
          firstPromptSession: Math.min(records[index].firstPromptSession, record.firstPromptSession),
          lastPromptSession: Math.max(records[index].lastPromptSession, record.lastPromptSession),
          promptCount: Math.max(records[index].promptCount, record.promptCount),
        };
        return records;
      }, []),
    });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    MAX_PROMPT_RECORDS,
    LATER_SESSION_LIMIT,
    starToStoredScore,
    storedScoreToStars,
    emptyPromptState,
    normalizePromptState,
    startSession,
    canPrompt,
    recordPrompt,
    mergePromptState,
  });
});
