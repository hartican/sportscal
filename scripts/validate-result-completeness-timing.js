#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "nothingsport-result-timing-"));
const fixturePath = path.join(fixtureDir, "events.json");

function runCheck(event, now) {
  fs.writeFileSync(fixturePath, JSON.stringify({ events: [event] }));
  return spawnSync(process.execPath, ["scripts/verify-result-completeness.js", fixturePath], {
    cwd: projectRoot,
    env: { ...process.env, RESULT_CHECK_NOW: now },
    encoding: "utf8",
  });
}

try {
  // Frozen timing fields from the actual 9 October 2026 NBL card, before play.
  const nblMatch = {
    id: 'evt_nbl_2026_27_36fe21e3_58ad_11f1_ba69_dd12ee8972e9',
    name: 'Illawarra Hawks v Tasmania JackJumpers', key: 'nbl',
    date: '2026-10-09', time: '19:30', startTimeUtc: '2026-10-09T08:30:00.000Z',
    timePrecision: 'exact', liveWindow: 3, status: 'upcoming',
  };
  assert.equal(runCheck(nblMatch, '2026-10-09T11:29:59Z').status, 0, 'No result is demanded before the existing three-hour window');
  const nblDue = runCheck(nblMatch, '2026-10-09T11:30:00Z');
  assert.equal(nblDue.status, 1, 'Real NBL result deadline must use its source UTC instant during daylight saving');
  assert.match(nblDue.stdout, /2026-10-09T11:30:00\.000Z/);
  assert.equal(runCheck({...nblMatch, time:'21:30'}, '2026-10-09T11:31:00Z').status, 1, 'Source UTC takes precedence over a stale display clock');
  assert.equal(runCheck({...nblMatch, date:null, time:null}, '2026-10-09T11:31:00Z').status, 1, 'A genuine UTC start does not require redundant local fields');
  assert.equal(runCheck({...nblMatch, startTimeUtc:null}, '2026-10-09T11:30:00Z').status, 1, 'Legacy Sydney-only clock must also honour daylight saving');
  assert.equal(runCheck({...nblMatch, startTimeUtc:'invalid'}, '2026-10-09T11:30:00Z').status, 1, 'Invalid UTC retains the validated local-clock fallback');
  assert.equal(runCheck({...nblMatch, endTimeUtc:'2026-10-09T12:00:00Z'}, '2026-10-09T11:31:00Z').status, 0, 'An explicit end remains authoritative over the duration estimate');

  const winterMatch = {...nblMatch, date:'2026-08-13', time:'19:30', startTimeUtc:null};
  assert.equal(runCheck(winterMatch, '2026-08-13T12:29:59Z').status, 0, 'Winter Sydney clock remains UTC plus ten hours');
  assert.equal(runCheck(winterMatch, '2026-08-13T12:30:00Z').status, 1);
  const dateOnly = {id:'timing-date-only', key:'wrc', name:'Rally dates', dateOnly:true, date:'2026-10-01', endDate:'2026-10-04', status:'upcoming'};
  assert.equal(runCheck(dateOnly, '2026-10-04T12:59:58Z').status, 0);
  assert.equal(runCheck(dateOnly, '2026-10-04T12:59:59Z').status, 1, 'Final-day deadline observes the actual Sydney daylight-saving change');
  for (const local of [{date:'2026-02-30',time:'19:30'},{date:'2026-10-04',time:'02:30'},{date:'2026-04-05',time:'02:30'},{date:'2026-10-09',time:'25:00'}]) {
    assert.equal(runCheck({...nblMatch,...local,startTimeUtc:null}, '2026-10-18T00:00:00Z').status, 0, 'Malformed/nonexistent wall clocks do not establish a result deadline');
  }

  const testMatch = {
    id: "timing-test-match",
    key: "cricket",
    narrativeType: "test",
    date: "2026-08-13",
    time: "10:30",
    liveWindow: 8,
    status: "upcoming",
  };
  const dayTwo = runCheck(testMatch, "2026-08-14T02:00:00.000Z");
  assert.equal(dayTwo.status, 0, "a five-day Test must not require a result on day two");

  const afterDayFive = runCheck(testMatch, "2026-08-18T01:00:00.000Z");
  assert.equal(afterDayFive.status, 1, "a five-day Test must require a result after its expected close");
  assert.match(afterDayFive.stdout, /timing-test-match/, "the overdue Test must be reported by id");

  const actualTest=require('../data/events.json').events.find(e=>e.id==='fixture:cricket:espn:1525659');
  assert(actualTest&&actualTest.format==='Test'&&actualTest.endDate==='2026-10-13','Use the actual Australia-South Africa five-day schedule');
  assert.equal(runCheck(actualTest,'2026-10-10T12:00:00Z').status,0,'Its generic narrative type cannot shorten a sourced Test to one day');
  assert.equal(runCheck(actualTest,'2026-10-15T12:00:00Z').status,1,'The format exception cannot hide an overdue Test forever');
  const oneDayEvent = { ...testMatch, id: "timing-one-day", narrativeType: "t20" };
  const afterEightHours = runCheck(oneDayEvent, "2026-08-13T09:00:00.000Z");
  assert.equal(afterEightHours.status, 1, "ordinary liveWindow timing must remain unchanged");

  const rules = require('./lib/storyline-card-rules');
  const scheduled = {...oneDayEvent, status:'scheduled', name:'Home v Away', selectedSentence:'Home hosts Away.', fullSpiel:'The next meeting awaits.'};
  const afterKickoff = new Date('2026-08-20T09:00:00Z');
  for (const status of ['scheduled','live','postponed','cancelled','abandoned']) {
    assert.equal(rules.lifecycleFor({...scheduled,status},afterKickoff),'upcoming','the clock cannot establish a completed result');
  }
  scheduled.storyline = rules.storylineFor(scheduled,afterKickoff);
  assert.equal(scheduled.storyline.arcStage,'preview');
  assert.deepEqual(rules.spoilerContractIssues(scheduled,afterKickoff),[],'unresolved scheduled cards must survive intermediate projection');
  assert.equal(runCheck(scheduled,afterKickoff.toISOString()).status,1,'overdue results still block final publication');
  const completed = {...scheduled,status:'completed',outcomeText:'Home defeated Away.',recapText:'Home finished ahead.'};
  assert.equal(rules.storylineFor(completed,afterKickoff).arcStage,'recap','confirmed completion still selects result copy');
  assert(rules.spoilerContractIssues(completed,afterKickoff).length,'stale previews on genuinely completed cards remain invalid');

  assert.equal(runCheck({...oneDayEvent,gender:'women',format:'T20'},'2026-08-20T09:00:00.000Z').status,0,'Paused women T20 results create no publication demand');
  assert.equal(runCheck({...oneDayEvent,gender:'women',format:'ODI'},'2026-08-20T09:00:00.000Z').status,1,'Women ODI results remain required');
  assert.equal(runCheck({...oneDayEvent,key:'f1',name:'Spanish GP Practice 1',sessionType:'practice'},'2026-08-20T09:00:00.000Z').status,0,'Practice stays outside the Feed result contract');

  const tournamentOverview = {
    ...oneDayEvent,
    id: "timing-tournament-overview",
    cardType: "tournament_overview",
    narrativeType: "tennis-tournament-overview",
  };
  const duringTournament = runCheck(tournamentOverview, "2026-08-13T09:00:00.000Z");
  assert.equal(duringTournament.status, 0, "an active tournament overview must not require a single-match score");

  const ticketWatch = {
    ...oneDayEvent,
    id: "timing-ticket-watch",
    narrativeType: "ticket-sale-watch",
  };
  const afterAlertWindow = runCheck(ticketWatch, "2026-08-20T09:00:00.000Z");
  assert.equal(afterAlertWindow.status, 0, "a ticket-release watch must never require a sporting result");

  console.log("Result completeness timing valid: actual source UTC, Sydney daylight saving and final-day boundaries; Tests, overviews, exclusions and ticket watches retain their existing rules.");
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
