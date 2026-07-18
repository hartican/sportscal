const EDITORIAL_WINDOW_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const GENERIC_PREVIEW_PATTERNS = [
  /championship race with points, strategy/i,
  /tour stage worth tracking for its terrain/i,
  /finals appointment with the season narrowing/i,
  /australian test appointment with series context/i,
  /world cup race where speed, conditions/i,
  /sets the grid and the strategic shape/i,
  /remains on the calendar with its sydney-local time/i,
  /confirmed sydney time and broadcast path/i,
  /bracket-safe until the semifinals are revealed/i,
  /pairing remains protected/i,
  /watch via [^.]+\.?$/i,
];

const EXCLUDED_NARRATIVE_TYPES = new Set([
  "calendar-exception",
  "ticket-sale-watch",
]);

function localDateMs(value) {
  return Date.parse(`${value}T00:00:00+10:00`);
}

function daysUntil(event, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return Math.floor((localDateMs(event.date) - localDateMs(today)) / DAY_MS);
}

function isEditoriallyEligible(event) {
  return !EXCLUDED_NARRATIVE_TYPES.has(event.narrativeType);
}

function editorialPreviewDue(event, stakes, now = new Date()) {
  const days = daysUntil(event, now);
  return Number(stakes) >= 4 && event.status !== "completed" && isEditoriallyEligible(event) && days >= 0 && days <= EDITORIAL_WINDOW_DAYS;
}

function genericPreviewIssues(event) {
  const copy = `${event.selectedSentence || ""}\n${event.fullSpiel || ""}`;
  return GENERIC_PREVIEW_PATTERNS.filter(pattern => pattern.test(copy)).map(pattern => `generic-copy:${pattern.source}`);
}

function editorialPreviewIssues(event, stakes, now = new Date()) {
  if (!editorialPreviewDue(event, stakes, now)) return [];
  const preview = event.editorialPreview || {};
  const signals = Array.isArray(preview.contextSignals) ? [...new Set(preview.contextSignals.filter(Boolean))] : [];
  return [
    preview.status !== "journalistic" && "missing-journalistic-status",
    !String(preview.angle || "").trim() && "missing-editorial-angle",
    signals.length < 2 && "fewer-than-two-context-signals",
    !String(preview.sourceName || event.sourceName || "").trim() && "missing-editorial-source-name",
    !/^https:\/\//.test(preview.sourceUrl || event.sourceUrl || "") && "missing-editorial-source-url",
    !String(preview.sourceCheckedAt || event.sourceCheckedAt || "").trim() && "missing-editorial-source-checked-at",
    ...genericPreviewIssues(event),
  ].filter(Boolean);
}

function previewState(event, stakes, now = new Date()) {
  if (editorialPreviewDue(event, stakes, now)) return "due";
  if (Number(stakes) >= 4 && event.status !== "completed" && isEditoriallyEligible(event)) return "queued";
  return "not-required";
}

module.exports = {
  EDITORIAL_WINDOW_DAYS,
  GENERIC_PREVIEW_PATTERNS,
  daysUntil,
  editorialPreviewDue,
  editorialPreviewIssues,
  genericPreviewIssues,
  previewState,
};
