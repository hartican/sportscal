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
  // Match the substantive research queue: unverified imports stay queued,
  // rather than acquiring invented editorial merely to pass publication QA.
  const queuedUnverified=event.editorialPreview?.status==='research-required' && event.sourceTrust!=='verified';
  return !require('../../config/coverage-pauses').womensT20(event) && !queuedUnverified && !EXCLUDED_NARRATIVE_TYPES.has(event.narrativeType);
}

function editorialPreviewDue(event, stakes, now = new Date()) {
  const days = daysUntil(event, now);
  return Number(stakes) >= 4 && event.status !== "completed" && !confirmedCancellation(event,now) && isEditoriallyEligible(event) && days >= 0 && days <= EDITORIAL_WINDOW_DAYS;
}

let retainedWithdrawals;
function independentWithdrawals(){
  if(retainedWithdrawals)return retainedWithdrawals;
  const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../..');
  // Only the existing canonical source registry is authority. Never take a
  // context path, notice, approval flag or evidence ledger from the Feed card.
  let sources;try{sources=require('../build-canonical-context-bundle').SOURCES;}catch{return [];}
  retainedWithdrawals=[];
  for(const [,file] of sources){
    let context;try{context=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));}catch{continue;}
    const coverage=context.calendarCoverage;
    if(coverage?.complete!==true||!Array.isArray(coverage.retainedWithdrawals))continue;
    for(const record of context.events||[]){
      if(record.status!=='cancelled'||!coverage.retainedWithdrawals.includes(record.id)
        ||!record.scheduleNote||coverage.revisionSourceUrl!==record.statusSourceUrl
        ||coverage.checkedAt!==record.statusCheckedAt)continue;
      const source=(context.sources||[]).find(item=>item.sourceType==='official'
        &&item.provider&&item.sourceUrl===record.statusSourceUrl&&item.checkedAt===record.statusCheckedAt);
      if(source)retainedWithdrawals.push({record,source,season:coverage.season});
    }
  }
  return retainedWithdrawals;
}
function confirmedCancellation(event, now = new Date()) {
  if(event.status!=='cancelled'||event.sourceTrust!=='verified'||event.sourceType!=='official')return false;
  const checked=event.statusCheckedAt;
  if(typeof checked!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(checked))return false;
  const time=Date.parse(checked);
  if(!Number.isFinite(time)||time>now.getTime()||new Date(time).toISOString().slice(0,19)!==checked.slice(0,19))return false;
  try{if(new URL(event.statusSourceUrl).protocol!=='https:')return false;}catch{return false;}
  return independentWithdrawals().some(({record,season})=>{
    const aliases=new Set(require('./editorial-narrative').projectionTargetIds({id:record.id}));
    const ids=[event.id,event.eventId,event.canonicalEventId].filter(Boolean);
    return ids.length>0&&ids.every(id=>aliases.has(id))
      &&event.competitionId===record.competitionId&&Number(event.season)===Number(season)
      &&event.date===record.date&&event.endDate===record.endDate
      &&event.statusSourceUrl===record.statusSourceUrl&&checked===record.statusCheckedAt
      &&event.scheduleNote===record.scheduleNote;
  });
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
  if(confirmedCancellation(event,now))return "not-required";
  if (editorialPreviewDue(event, stakes, now)) return "due";
  if (Number(stakes) >= 4 && event.status !== "completed" && isEditoriallyEligible(event)) return "queued";
  return "not-required";
}

module.exports = {
  confirmedCancellation,
  EDITORIAL_WINDOW_DAYS,
  GENERIC_PREVIEW_PATTERNS,
  daysUntil,
  editorialPreviewDue,
  editorialPreviewIssues,
  genericPreviewIssues,
  previewState,
};
