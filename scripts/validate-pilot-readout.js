#!/usr/bin/env node
const { readFinalsEvidence } = require("./lib/pilot-finals-readiness");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const READOUT = require("../config/pilot-readout");
const { buildReadinessReport, completedResultIsPresent, isUnresolvedOfficialPlaceholder } = require("./verify-pilot-readiness");
const { inputFromReadout } = require("./evaluate-pilot-readout");
const { reportFromReadout, parseOptions } = require("./evaluate-pilot-readout");

const retainedCanonical = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-2026.json", "utf8"));
const retainedFeedMeta = JSON.parse(fs.readFileSync("data/feed-meta.json", "utf8"));
// Check untouched stored inputs at their latest receipt. A newer unrelated
// publication cannot renew the canonical observation or supply missing scores.
const storedNow = new Date(Math.max(Date.parse(retainedCanonical.generatedAt), Date.parse(retainedFeedMeta.publishedAt)));
assert([retainedCanonical.generatedAt,retainedFeedMeta.publishedAt].every(value=>Number.isFinite(Date.parse(value))), 'both stored observation dates must be valid');
const retainedReadiness = buildReadinessReport({canonical:retainedCanonical,feedMeta:retainedFeedMeta,finals:readFinalsEvidence(),now:storedNow});
if((+storedNow-Date.parse(retainedCanonical.generatedAt))/3600000>15){assert.equal(retainedReadiness.ready,false);assert(retainedReadiness.issues.includes('Canonical snapshot must be no more than 15 hours old.'),'a newer unrelated Feed publication must not refresh retained source facts');}
if((+storedNow-Date.parse(retainedFeedMeta.publishedAt))/3600000>15){assert.equal(retainedReadiness.ready,false);assert(retainedReadiness.issues.includes('Published feed must be no more than 15 hours old.'));}
// The mixed container may be generated again for an unrelated EPL table.
// Bind this historical AFL/NRL content fixture to its exact component receipt,
// not that newer container date. Keep all sporting records and clocks intact.
const sourceReceipts=[
  ['AFL','https://www.afl.com.au/fixture'],
  ['AFLW','https://www.afl.com.au/aflw/fixture'],
  ['NRL Match Centre / Champion Data','https://www.nrl.com/draw'],
].map(([provider,url])=>{
  const rows=retainedCanonical.sources.filter(row=>row.provider===provider&&row.sourceUrl===url);
  assert.equal(rows.length,1,'each supported source needs its exact retained receipt');return rows[0];
});
assert(sourceReceipts.every(row=>Number.isFinite(Date.parse(row.checkedAt)))&&new Set(sourceReceipts.map(row=>row.checkedAt)).size===1,'the historical fixture needs one evidenced AFL/NRL component observation');
const observationNow = new Date(sourceReceipts[0].checkedAt);
assert(retainedCanonical.events.filter(event=>['sport:afl','sport:nrl'].includes(event.sportDomainId)).every(event=>event.source?.checkedAt===observationNow.toISOString()),'the fixture clock must bind every retained supported sporting source');
// Only these in-memory test receipt wrappers are coherent at that observation.
// This is not current operational readiness or a fresh canonical observation.
const canonical={...retainedCanonical,generatedAt:observationNow.toISOString()},feedMeta={...retainedFeedMeta,publishedAt:observationNow.toISOString()};
assert.equal(canonical.events,retainedCanonical.events);
assert.equal(canonical.sources,retainedCanonical.sources);

// Real current-clock omissions stay visible on untouched inputs, including
// when a newer unrelated publication supplies a fresh Feed receipt. A later
// legitimate result may resolve a row; it must not invalidate this regression.
const actualNow=new Date(),actualReadiness=buildReadinessReport({canonical:retainedCanonical,feedMeta:retainedFeedMeta,finals:readFinalsEvidence(),now:actualNow});
const republishedReadiness=buildReadinessReport({canonical:retainedCanonical,feedMeta:{...retainedFeedMeta,publishedAt:actualNow.toISOString()},finals:readFinalsEvidence(),now:actualNow});
const retainedOverdueIds=[...Array.from({length:9},(_,index)=>'event:aflw:cd_m2026264110'+(index+1)),'event:aflw:cd_m20262641201'];
const retainedOverdueFixtures=retainedCanonical.events.filter(event=>retainedOverdueIds.includes(event.id));
assert.equal(retainedOverdueFixtures.length,10,'all ten recorded fixture identities remain retained');
const actualPendingFixtures=retainedOverdueFixtures.filter(event=>event.status==='scheduled'&&Date.parse(event.startTimeUtc)+6*3600000<=+actualNow);
for(const report of [actualReadiness,republishedReadiness])if(actualPendingFixtures.length){
  assert.equal(report.ready,false,'current missing results must remain operationally degraded');
  assert.equal(READOUT.buildMeasurementReport(inputFromReadout([{cohort:'all'}],report)).operationalReady,false);
  for(const event of actualPendingFixtures)assert(report.overdueResults.some(row=>row.id===event.id),'current missing result must remain visible: '+event.id);
}
console.log(`Historical source-content fixture: ${observationNow.toISOString()}; actual retained readiness: ${actualReadiness.ready?'ready':'degraded'}, ${actualReadiness.overdueResultCount} overdue results.`);

// Reproduce the eight retained Round10 omissions independently of whether a
// later source refresh has filled them. A newer publication must keep both
// overdue-result and stale-source failures visible in the operator readout.
const missingIds=Array.from({length:8},(_,index)=>'event:aflw:cd_m2026264100'+(index+2));
const missingFixtures=canonical.events.filter(event=>missingIds.includes(event.id));
assert.equal(missingFixtures.length,8,'all actual Round10 fixture identities remain retained');
const laterNow=new Date(Math.max(+observationNow+16*3600000,...missingFixtures.map(event=>Date.parse(event.startTimeUtc)+7*3600000)));
const missingCanonical={...canonical,events:canonical.events.map(event=>missingIds.includes(event.id)?{...event,status:'scheduled',resultStatus:'pending',result:null}:event)};
const laterReadiness=buildReadinessReport({canonical:missingCanonical,feedMeta:{...retainedFeedMeta,publishedAt:laterNow.toISOString()},finals:readFinalsEvidence(),now:laterNow});
assert.equal(laterReadiness.ready,false);
assert(laterReadiness.issues.includes('Canonical snapshot must be no more than 15 hours old.'));
assert(laterReadiness.overdueResultCount>=8);
for(const id of missingIds)assert(laterReadiness.overdueResults.some(event=>event.id===id),'newer publication must retain overdue result '+id);
assert.equal(READOUT.buildMeasurementReport(inputFromReadout([{cohort:'all'}],laterReadiness)).operationalReady,false);
const readiness = buildReadinessReport({ canonical, feedMeta, finals: readFinalsEvidence(), now: observationNow });
const reviewedAflwSource = canonical.events.find(event => event.competitionId === 'competition:aflw-2026' && event.resultStatus === 'official');
assert(reviewedAflwSource, 'use an actual reviewed flat AFLW result');
// A genuine primary refresh may add its independently valid nested result.
// Isolate the flat representation so the legacy path cannot mask bad fields.
const {result:primaryResult,...reviewedAflw}=reviewedAflwSource;
assert(completedResultIsPresent(reviewedAflw,new Date(feedMeta.publishedAt)));
for (const patch of [
  {status:'live'}, {resultStatus:'pending'}, {sourceTrust:'unknown'},
  {resultSourceUrl:'https://example.com/result'}, {resultSourceCheckedAt:'invalid'},
  {resultSourceCheckedAt:'2099-01-01T00:00:00Z'}, {homeScore:-1}, {awayScore:'0'},
  {score:'Invented final'}, {score:'Team 1.1 (99)–2.2 (14) Opponent'},
  {awayParticipantId:reviewedAflw.homeParticipantId}, {participantIds:[...reviewedAflw.participantIds].reverse()},
]) assert.equal(completedResultIsPresent({...reviewedAflw,...patch},new Date(feedMeta.publishedAt)),false,'unverified or contradictory flat final cannot pass');
assert(completedResultIsPresent({...reviewedAflw,homeScore:0,awayScore:1,score:'Home 0.0 (0)–0.1 (1) Away'},new Date(feedMeta.publishedAt)),'explicit zero scores remain valid');
const participantsById = new Map(canonical.participants.map(participant => [participant.id, participant]));
const unresolvedPlaceholders = canonical.events.filter(fixture => isUnresolvedOfficialPlaceholder(fixture, participantsById));
const placeholderParticipant = { id:"test:afl:tbd", teamCode:"TBD" };
assert.equal(isUnresolvedOfficialPlaceholder({sportDomainId:"sport:afl",scheduleStatus:"tbc",startTimeUtc:null,source:{sourceType:"official"},roundLabel:"Grand Final",homeParticipantId:placeholderParticipant.id,awayParticipantId:placeholderParticipant.id},new Map([[placeholderParticipant.id,placeholderParticipant]])),true,"unresolved official finals remain detectable even after the live bracket resolves");
assert(unresolvedPlaceholders.every(fixture => fixture.sportDomainId === "sport:afl" && /final/i.test(fixture.roundLabel || "")), "only official AFL finals placeholders may defer readiness");
const semiFinals=canonical.events.filter(fixture=>fixture.sportDomainId==="sport:afl" && /semi.?final/i.test(fixture.roundLabel || ""));
assert(semiFinals.length>=2 && semiFinals.every(fixture=>isUnresolvedOfficialPlaceholder(fixture,participantsById) || (fixture.startTimeUtc && participantsById.has(fixture.homeParticipantId) && participantsById.has(fixture.awayParticipantId))), "semi-finals must retain an official placeholder or a confirmed named fixture as the bracket resolves");
const namedFixture = canonical.events.find(fixture => (
  fixture.sportDomainId === "sport:afl"
  && participantsById.get(fixture.homeParticipantId)?.teamCode !== "TBD"
  && participantsById.get(fixture.awayParticipantId)?.teamCode !== "TBD"
));
assert(namedFixture, "the regression fixture needs a named-team AFL match");
assert.equal(isUnresolvedOfficialPlaceholder({
  ...namedFixture,
  scheduleStatus: "tbc",
  startTimeUtc: null,
  roundLabel: "Wildcard Finals",
}, participantsById), false, "a named-team fixture must never escape readiness merely because its time is TBC");
assert.equal(readiness.deferredPlaceholderCount, readiness.deferredPlaceholders.length, "the readiness report must expose rather than silently discard official placeholders in its current-round window");
assert(readiness.deferredPlaceholders.every(fixture => unresolvedPlaceholders.some(candidate => candidate.id === fixture.id)), "every deferred current-window slot must be an official unresolved AFL final from the canonical source");
assert(readiness.sports.afl.fixtureCount > 0 || readiness.sports.afl.deferredPlaceholderCount > 0, "AFL must retain either timed fixtures or source-backed deferred finals in its current window");
assert.equal(readiness.ready, true, `current supported fixtures should be complete after legitimate placeholders are deferred: ${readiness.issues.join("; ")}`);
const weeklyTsdr = [{ weekStart: "2026-08-10", denominator: 2, numerator: 1, tsdrPercent: 50 }];
const input = inputFromReadout([{
  cohort: "all",
  measurement_started_at: "2026-08-01T00:00:00.000Z",
  measurement_generated_at: "2026-08-12T00:00:00.000Z",
  survey_version: "weekly-pulse.v1",
  exposed_users: 2,
  pulse_users: 1,
  weekly_tsdr: weeklyTsdr,
  tsdr_percent: 50,
  full_fixture_adoption_percent: 50,
  multiple_cross_check_percent: 0,
  missed_fixture_percent: 0,
  about_right_feed_percent: 100,
  positive_trust_percent: 100,
  meaningful_action_rate_percent: 25,
  prompt_dismissal_percent: 0,
  spectacle_rating_completion_percent: 50,
}], readiness);

const report = READOUT.buildMeasurementReport(input);
assert.deepEqual(reportFromReadout(input,readiness),report,"legacy normalised reports keep their existing output and unknown cohort status");
assert.throws(()=>reportFromReadout(input,readiness,{requireCohort:true}),/unqualified/,"ordinary all-account/normalised input cannot claim the invited population");
assert.equal(parseOptions(['aggregate.json','--require-invited-cohort']).requireCohort,true);
assert.equal(READOUT.SCHEMA_VERSION, "measurement-readout.v3");
assert.equal(report.status, "report_ready");
assert.equal(report.recommendation, null, "measurement must not automatically recommend social or another investment");
assert.equal(report.sample.distinctUsers, 2, "sample sizes must remain descriptive even when small");
assert.match(report.sample.description, /2 exposed users/);
assert.deepEqual(report.metrics.weeklyTsdr, weeklyTsdr);
assert(!("daysObserved" in report.sample), "elapsed-day requirements must not remain in the readout schema");
assert.equal(READOUT.buildMeasurementReport({ sample: {}, readiness: {}, metrics: {} }).status, "report_ready", "zero or small samples must not block MVP completion");

const sql = fs.readFileSync("supabase/nothingsports-pilot-readout.sql", "utf8");
assert.match(sql, /product_events has no authenticated SELECT grant/i);
assert.doesNotMatch(sql, /interval '14 days'|pilot_complete|days_observed/i);
assert.match(sql, /properties ->> 'surveyVersion'/i);
assert.match(sql, /date_trunc\('week', event\.occurred_at at time zone 'Australia\/Sydney'\)/i);
assert.match(sql, /negative_feedback_by_sport/i, "the aggregate operator readout must segment discovery negatives by sport");
assert.match(sql, /negative_feedback_by_competition/i, "the aggregate operator readout must segment discovery negatives by competition");
assert.match(sql, /'active'::text as instrumentation_status/i, "approved categorical discovery instrumentation must be active");
assert.doesNotMatch(sql, /create\s+(?:or replace\s+)?view/i, "the administrator readout must not create an exposed view");
const runbook = fs.readFileSync("docs/pilot/phase6-runbook.md", "utf8");
assert.match(runbook, /ongoing measurement and operational readiness/i);
assert.doesNotMatch(runbook, /Fourteen full elapsed days|fourteen-day evidence gate/i);
assert.match(runbook, /sample size is descriptive/i);

console.log("Measurement readout valid: weekly TSDR, versioned pulses, cohort metrics and descriptive samples have no fixed-duration decision gate.");

for (const value of [undefined, null, "", " ", false, [], {}, "invalid"]) {
  const unknown = READOUT.buildMeasurementReport(inputFromReadout([{cohort:"all", tsdr_percent:value}], {supportedFixtureCoveragePercent:100}));
  assert.equal(unknown.metrics.tsdrPercent, null);
  assert.equal(unknown.operationalReady, false, "missing overdue evidence must never pass readiness");
  assert.equal(unknown.sample.distinctUsers, null);
}
const zero = READOUT.buildMeasurementReport(inputFromReadout([{cohort:"all", exposed_users:0, tsdr_percent:0}], {ready:true, supportedFixtureCoveragePercent:100, overdueResultCount:0}));
assert.equal(zero.metrics.tsdrPercent, 0);
assert.equal(zero.sample.distinctUsers, 0);
assert.equal(zero.operationalReady, true);
assert.throws(() => inputFromReadout([{cohort:"curator"}], {}), /overall row/);
assert.equal(READOUT.buildMeasurementReport({}).metrics.usefulReturnPercent, null);

for (const verdict of [undefined, false, null, "true"]){
  const unverified = READOUT.buildMeasurementReport(inputFromReadout([{cohort:"all",exposed_users:0}], {ready:verdict,supportedFixtureCoveragePercent:100,overdueResultCount:0}));
  assert.equal(unverified.operationalReady, false, "coverage counts cannot override a failed or missing readiness verdict");
}
const staleCanonical = {...canonical,generatedAt:"2026-01-01T00:00:00Z"};
const staleSnapshot = buildReadinessReport({canonical:staleCanonical,feedMeta,finals:readFinalsEvidence(),now:observationNow});
assert.equal(staleSnapshot.supportedFixtureCoveragePercent,100);
assert.equal(staleSnapshot.overdueResultCount,0);
assert.equal(staleSnapshot.ready,false);
assert.equal(READOUT.buildMeasurementReport(inputFromReadout([{cohort:"all"}],staleSnapshot)).operationalReady,false,"stale snapshots remain attention required in the operator readout");
for (const patch of [
  {canonical:{...canonical,generatedAt:new Date(+observationNow+60000).toISOString()}},
  {feedMeta:{...feedMeta,publishedAt:new Date(+observationNow+60000).toISOString()}},
  {feedMeta:{...feedMeta,publishedAt:new Date(+observationNow-16*3600000).toISOString()}},
]) {
  const failed = buildReadinessReport({canonical,feedMeta,finals:readFinalsEvidence(),now:observationNow,...patch});
  assert.equal(failed.ready,false,'future observations and a truly stale Feed still reject');
  assert.equal(READOUT.buildMeasurementReport(inputFromReadout([{cohort:'all'}],failed)).operationalReady,false);
}
console.log("Operator readiness preserves failed, absent and stale-snapshot verdicts.");
