(function attachNothingSportsProductEvents(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_PRODUCT_EVENTS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildProductEvents(){
  "use strict";

  const SCHEMA_VERSION = "product-events.v1";
  const MAX_BATCH_SIZE = 20;
  const MAX_PROPERTIES_BYTES = 512;
  const PILOT_DURATION_DAYS = 14;
  const PILOT_MEASUREMENT_OPT_IN_VERSION = "pilot-opt-in.v1";
  const WEEKLY_PULSE_DATA_GATHERING_ACTIVE = true;
  const WEEKLY_PULSE_OPEN_THRESHOLD = 3;
  const WEEKLY_PULSE_SURVEY_VERSION = "weekly-pulse.v1";
  const WEEKLY_PULSE_PROMPT_STATE_VERSION = "weekly-pulse-prompt.v1";
  const EVENT_NAMES = Object.freeze([
    "opportunity_exposed",
    "fixture_check",
    "watch_decision",
    "swipe",
    "rating",
    "tune_prompt",
    "tune_session",
    "weekly_pulse",
  ]);
  const SURFACES = Object.freeze([
    "curated_feed",
    "round_summary",
    "sport_hub",
    "fixture_list",
    "event_card",
    "settings",
    "weekly_pulse",
    "onboarding",
    "calibration",
    "tune",
    "archive",
  ]);
  const EVENT_KEYS = Object.freeze([
    "clientEventId",
    "eventName",
    "occurredAt",
    "sessionId",
    "surface",
    "sport",
    "competitionId",
    "canonicalEventId",
    "properties",
  ]);
  const BODY_KEYS = Object.freeze(["schemaVersion", "events"]);
  const PROPERTY_RULES = Object.freeze({
    opportunity_exposed: Object.freeze({
      pilotVersion: enumRule(["trust-pilot.v1"]),
      presentation: enumRule(["card", "round_summary"]),
      position: integerRule(0, 999),
      feedBucket: enumRule(["new", "pinned", "seen", "upcoming", "past"]),
    }),
    fixture_check: Object.freeze({
      entry: enumRule(["round_summary", "sport_filter", "hub_tab", "round_picker", "fixture_row"]),
      roundNumber: integerRule(0, 100),
    }),
    watch_decision: Object.freeze({
      decision: enumRule(["watch", "skip", "remind", "calendar"]),
    }),
    swipe: Object.freeze({
      direction: enumRule(["positive", "negative", "skip"]),
      targetType: enumRule(["sport", "competition", "team", "player", "event", "event_family"]),
    }),
    rating: Object.freeze({
      action: enumRule(["shown", "dismissed", "rated"]),
      score: integerRule(1, 5),
    }),
    tune_prompt: Object.freeze({
      action: enumRule(["shown", "accepted", "dismissed"]),
      dislikeCount: integerRule(0, 1_000_000),
    }),
    tune_session: Object.freeze({
      action: enumRule(["started", "completed", "exited"]),
      interactionCount: integerRule(0, 1_000_000),
    }),
    weekly_pulse: Object.freeze({
      pilotCohort: enumRule(["curator", "hybrid", "completist"]),
      crossCheck: enumRule(["never", "once", "multiple"]),
      missedFixtures: enumRule(["none", "one", "multiple"]),
      feedClutter: enumRule(["too_sparse", "about_right", "too_busy"]),
      trustConfidence: enumRule(["low", "medium", "high"]),
    }),
  });

  class ProductEventValidationError extends Error {
    constructor(message, code = "invalid_product_events"){
      super(message);
      this.name = "ProductEventValidationError";
      this.code = code;
      this.status = 400;
    }
  }

  function plainObject(value){
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function enumRule(values){
    const allowed = new Set(values);
    return value => typeof value === "string" && allowed.has(value);
  }

  function integerRule(minimum, maximum){
    return value => Number.isInteger(value) && value >= minimum && value <= maximum;
  }

  function exactKeys(value, allowed, label){
    const allowedSet = new Set(allowed);
    const unknown = Object.keys(value).find(key => !allowedSet.has(key));
    if (unknown){
      throw new ProductEventValidationError(`${label} contains an unsupported field: ${unknown}.`, "unsupported_field");
    }
  }

  function requiredString(value, label, { max = 160, pattern } = {}){
    if (typeof value !== "string" || !value || value.length > max || (pattern && !pattern.test(value))){
      throw new ProductEventValidationError(`${label} is invalid.`, "invalid_field");
    }
    return value;
  }

  function optionalIdentifier(value, label){
    if (value === undefined) return undefined;
    return requiredString(value, label, {
      max: 160,
      pattern: /^[A-Za-z0-9][A-Za-z0-9:._/-]*$/,
    });
  }

  function normalizeProperties(eventName, input){
    const value = input === undefined ? {} : input;
    if (!plainObject(value)){
      throw new ProductEventValidationError("properties must be an object.", "invalid_properties");
    }
    const rules = PROPERTY_RULES[eventName] || {};
    exactKeys(value, Object.keys(rules), "properties");
    Object.entries(value).forEach(([key, propertyValue]) => {
      if (!rules[key](propertyValue)){
        throw new ProductEventValidationError(`properties.${key} is invalid.`, "invalid_property_value");
      }
    });
    if (JSON.stringify(value).length > MAX_PROPERTIES_BYTES){
      throw new ProductEventValidationError("properties is too large.", "properties_too_large");
    }
    return { ...value };
  }

  function normalizeEvent(input){
    if (!plainObject(input)){
      throw new ProductEventValidationError("Each product event must be an object.", "invalid_event");
    }
    exactKeys(input, EVENT_KEYS, "Product event");
    const clientEventId = requiredString(input.clientEventId, "clientEventId", {
      max: 128,
      pattern: /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/,
    });
    const eventName = requiredString(input.eventName, "eventName", { max: 64 });
    if (!EVENT_NAMES.includes(eventName)){
      throw new ProductEventValidationError("eventName is not allowed.", "unsupported_event_name");
    }
    const occurredAtInput = requiredString(input.occurredAt, "occurredAt", { max: 40 });
    const occurredAtDate = new Date(occurredAtInput);
    if (Number.isNaN(occurredAtDate.getTime())){
      throw new ProductEventValidationError("occurredAt must be an ISO timestamp.", "invalid_occurred_at");
    }
    const sessionId = requiredString(input.sessionId, "sessionId", {
      max: 128,
      pattern: /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/,
    });
    const surface = requiredString(input.surface, "surface", { max: 48 });
    if (!SURFACES.includes(surface)){
      throw new ProductEventValidationError("surface is not allowed.", "unsupported_surface");
    }
    let sport;
    if (input.sport !== undefined){
      sport = requiredString(input.sport, "sport", {
        max: 32,
        pattern: /^[a-z0-9][a-z0-9-]*$/,
      });
    }
    return {
      clientEventId,
      eventName,
      occurredAt: occurredAtDate.toISOString(),
      sessionId,
      surface,
      ...(sport ? { sport } : {}),
      ...(input.competitionId === undefined ? {} : { competitionId: optionalIdentifier(input.competitionId, "competitionId") }),
      ...(input.canonicalEventId === undefined ? {} : { canonicalEventId: optionalIdentifier(input.canonicalEventId, "canonicalEventId") }),
      properties: normalizeProperties(eventName, input.properties),
    };
  }

  function normalizeBatch(input){
    if (!plainObject(input)){
      throw new ProductEventValidationError("Request body must be an object.", "invalid_body");
    }
    exactKeys(input, BODY_KEYS, "Request body");
    if (input.schemaVersion !== SCHEMA_VERSION){
      throw new ProductEventValidationError(`schemaVersion must be ${SCHEMA_VERSION}.`, "unsupported_schema_version");
    }
    if (!Array.isArray(input.events) || !input.events.length){
      throw new ProductEventValidationError("events must contain at least one product event.", "empty_batch");
    }
    if (input.events.length > MAX_BATCH_SIZE){
      throw new ProductEventValidationError(`A batch may contain at most ${MAX_BATCH_SIZE} events.`, "batch_too_large");
    }
    return input.events.map(normalizeEvent);
  }

  function rowsForUser(events, userId){
    const owner = requiredString(userId, "userId", {
      max: 64,
      pattern: /^[0-9a-f]{8}-[0-9a-f-]{27,35}$/i,
    });
    return events.map(event => ({
      user_id: owner,
      client_event_id: event.clientEventId,
      event_name: event.eventName,
      occurred_at: event.occurredAt,
      session_id: event.sessionId,
      surface: event.surface,
      sport: event.sport || null,
      competition_id: event.competitionId || null,
      canonical_event_id: event.canonicalEventId || null,
      properties: event.properties,
    }));
  }

  function randomIdentifier(prefix = "evt"){
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return uuid;
    const random = Math.random().toString(36).slice(2);
    return `${prefix}_${Date.now().toString(36)}_${random.padEnd(12, "0")}`;
  }

  function createEvent(input, { now = () => new Date(), sessionId } = {}){
    return normalizeEvent({
      ...input,
      clientEventId: input?.clientEventId || randomIdentifier("event"),
      occurredAt: input?.occurredAt || now().toISOString(),
      sessionId: input?.sessionId || sessionId || randomIdentifier("session"),
      properties: input?.properties || {},
    });
  }

  function createQueue({ sendBatch, delayMs = 250 } = {}){
    if (typeof sendBatch !== "function") throw new TypeError("sendBatch is required.");
    let pending = [];
    let timer = null;
    let inFlight = null;

    function schedule(){
      if (timer || inFlight) return;
      timer = setTimeout(() => {
        timer = null;
        flush().catch(() => {});
      }, Math.max(0, delayMs));
    }

    async function flush(){
      if (timer) clearTimeout(timer);
      timer = null;
      if (inFlight){
        const activeResult = await inFlight;
        if (!pending.length) return activeResult;
        const pendingResult = await flush();
        return { sent: (activeResult?.sent || 0) + (pendingResult?.sent || 0) };
      }
      if (!pending.length) return { sent: 0 };
      inFlight = (async () => {
        let sent = 0;
        while (pending.length){
          const batch = pending.splice(0, MAX_BATCH_SIZE);
          try{
            const result = await sendBatch(batch);
            sent += Number(result?.accepted ?? result?.sent ?? batch.length) || 0;
          }catch(error){
            pending = batch.concat(pending).slice(0, MAX_BATCH_SIZE * 5);
            throw error;
          }
        }
        return { sent };
      })().finally(() => {
        inFlight = null;
        if (pending.length) schedule();
      });
      return inFlight;
    }

    return Object.freeze({
      enqueue(event){
        pending.push(normalizeEvent(event));
        if (pending.length >= MAX_BATCH_SIZE) flush().catch(() => {});
        else schedule();
        return pending.length;
      },
      flush,
      clear(){
        if (timer) clearTimeout(timer);
        timer = null;
        pending = [];
      },
      size(){ return pending.length; },
    });
  }

  function sydneyDateKey(reference = new Date()){
    const date = reference instanceof Date ? reference : new Date(reference);
    if (Number.isNaN(date.getTime())) return null;
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = Object.fromEntries(formatter.formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function weeklyPulseSurveyId(weekStart){
    const week = /^\d{4}-\d{2}-\d{2}$/.test(String(weekStart || ""))
      ? String(weekStart)
      : null;
    if (!week) throw new TypeError("A valid weekly pulse week start is required.");
    return `${WEEKLY_PULSE_SURVEY_VERSION}:${week}`;
  }

  function nextWeeklyPulsePromptState(current, { surveyId, dayKey } = {}){
    const nextSurveyId = requiredString(surveyId, "surveyId", { max: 96 });
    const nextDayKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dayKey || ""))
      ? String(dayKey)
      : null;
    if (!nextDayKey) throw new TypeError("A valid Sydney day key is required.");
    const sameCounter = plainObject(current)
      && current.schemaVersion === WEEKLY_PULSE_PROMPT_STATE_VERSION
      && current.surveyId === nextSurveyId
      && current.dayKey === nextDayKey;
    return {
      schemaVersion: WEEKLY_PULSE_PROMPT_STATE_VERSION,
      surveyId: nextSurveyId,
      dayKey: nextDayKey,
      openCount: sameCounter
        ? Math.min(1_000, Math.max(0, Number(current.openCount) || 0) + 1)
        : 1,
    };
  }

  function pilotSurveyActive(pilot, reference = new Date(), {
    dataGatheringActive = WEEKLY_PULSE_DATA_GATHERING_ACTIVE,
  } = {}){
    if (!dataGatheringActive || !plainObject(pilot) || !pilot.enabled) return false;
    const startedAt = new Date(pilot.acknowledgedAt || "");
    const now = reference instanceof Date ? reference : new Date(reference);
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(now.getTime())) return false;
    const elapsed = now.getTime() - startedAt.getTime();
    return elapsed >= 0 && elapsed < PILOT_DURATION_DAYS * 24 * 60 * 60 * 1_000;
  }

  function weeklyPulseComplete(pilot, { surveyId, weekStart } = {}){
    if (!plainObject(pilot)) return false;
    if (typeof pilot.lastPulseSurveyId === "string" && pilot.lastPulseSurveyId){
      return pilot.lastPulseSurveyId === surveyId;
    }
    return pilot.lastPulseWeek === weekStart;
  }

  function shouldPromptWeeklyPulse({ pilot, promptState, surveyId, weekStart, reference = new Date() } = {}){
    return Boolean(
      pilotSurveyActive(pilot, reference)
      && plainObject(promptState)
      && promptState.surveyId === surveyId
      && Number(promptState.openCount) >= WEEKLY_PULSE_OPEN_THRESHOLD
      && !weeklyPulseComplete(pilot, { surveyId, weekStart })
    );
  }

  function calculateWeeklyTsdr(events, timeZone = "Australia/Sydney"){
    const weeks = new Map();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    function weekStart(occurredAt){
      const parts = Object.fromEntries(formatter.formatToParts(new Date(occurredAt))
        .filter(part => part.type !== "literal")
        .map(part => [part.type, Number(part.value)]));
      const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
      const day = utc.getUTCDay() || 7;
      utc.setUTCDate(utc.getUTCDate() - day + 1);
      return utc.toISOString().slice(0, 10);
    }
    events.forEach(event => {
      if (!["opportunity_exposed", "fixture_check", "watch_decision"].includes(event.eventName)) return;
      const key = `${weekStart(event.occurredAt)}|${event.userId}`;
      const state = weeks.get(key) || { exposed: false, decision: false, weekStart: weekStart(event.occurredAt) };
      if (event.eventName === "opportunity_exposed") state.exposed = true;
      if (["fixture_check", "watch_decision"].includes(event.eventName)) state.decision = true;
      weeks.set(key, state);
    });
    const totals = new Map();
    weeks.forEach(state => {
      if (!state.exposed) return;
      const total = totals.get(state.weekStart) || { weekStart: state.weekStart, denominator: 0, numerator: 0 };
      total.denominator += 1;
      if (state.decision) total.numerator += 1;
      totals.set(state.weekStart, total);
    });
    return Array.from(totals.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart)).map(value => ({
      ...value,
      tsdrPercent: value.denominator ? Math.round(value.numerator * 10_000 / value.denominator) / 100 : 0,
    }));
  }

  return Object.freeze({
    BODY_KEYS,
    EVENT_KEYS,
    EVENT_NAMES,
    MAX_BATCH_SIZE,
    MAX_PROPERTIES_BYTES,
    PILOT_DURATION_DAYS,
    PILOT_MEASUREMENT_OPT_IN_VERSION,
    PROPERTY_RULES,
    ProductEventValidationError,
    SCHEMA_VERSION,
    SURFACES,
    WEEKLY_PULSE_DATA_GATHERING_ACTIVE,
    WEEKLY_PULSE_OPEN_THRESHOLD,
    WEEKLY_PULSE_PROMPT_STATE_VERSION,
    WEEKLY_PULSE_SURVEY_VERSION,
    calculateWeeklyTsdr,
    createEvent,
    createQueue,
    nextWeeklyPulsePromptState,
    normalizeBatch,
    normalizeEvent,
    pilotSurveyActive,
    rowsForUser,
    shouldPromptWeeklyPulse,
    sydneyDateKey,
    weeklyPulseComplete,
    weeklyPulseSurveyId,
  });
});
