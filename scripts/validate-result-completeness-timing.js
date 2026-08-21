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

  const oneDayEvent = { ...testMatch, id: "timing-one-day", narrativeType: "t20" };
  const afterEightHours = runCheck(oneDayEvent, "2026-08-13T09:00:00.000Z");
  assert.equal(afterEightHours.status, 1, "ordinary liveWindow timing must remain unchanged");

  const tournamentOverview = {
    ...oneDayEvent,
    id: "timing-tournament-overview",
    cardType: "tournament_overview",
    narrativeType: "tennis-tournament-overview",
  };
  const duringTournament = runCheck(tournamentOverview, "2026-08-13T09:00:00.000Z");
  assert.equal(duringTournament.status, 0, "an active tournament overview must not require a single-match score");

  console.log("Result completeness timing valid: Tests and active tournament overview cards stay open while ordinary event windows still close normally.");
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
