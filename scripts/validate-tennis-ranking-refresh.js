#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const {
  ATP_SOURCE_URL,
  WTA_SOURCE_URL,
  atpDisplayName,
  fetchWtaRankingUniverse,
  groupPositionedCells,
  parseAtpRankingRows,
  parseWtaRankingRows,
  rankingExport,
} = require("./refresh-tennis-ranking-exports.js");

assert.equal(atpDisplayName("de Minaur, Alex"), "Alex de Minaur");
assert.match(ATP_SOURCE_URL, /^https:\/\/www\.protennislive\.com\//);
assert.match(WTA_SOURCE_URL, /^https:\/\/api\.wtatennis\.com\/tennis\//);

const atpCells = [];
const previousAtpAthletes = [];
for (let rank = 1; rank <= 50; rank += 1) {
  const page = Math.floor((rank - 1) / 25);
  const y = 700 - ((rank - 1) % 25) * 12;
  const familyName = `Family${rank}`;
  const givenName = `Given${rank}`;
  atpCells.push(...(rank === 1 ? [
    { page, x: 83, y, text: `${rank} ${familyName}, ${givenName}` },
    { page, x: 300, y, text: String(5000 - rank) },
  ] : [
    { page, x: 74, y, text: String(rank) },
    { page, x: 107, y, text: `${familyName}, ${givenName}` },
    { page, x: 309, y, text: String(5000 - rank) },
  ]));
  if (rank !== 1) atpCells.push({ page, x: 248, y, text: "(USA)" });
  previousAtpAthletes.push({ name: `${givenName} ${familyName}`, providerId: `atp-${rank}`, nationalityCode: "USA" });
}
atpCells.push(
  { page: 2, x: 74, y: 700, text: "86T" },
  { page: 2, x: 107, y: 700, text: "Duckworth, James" },
  { page: 2, x: 248, y: 700, text: "(AUS)" },
  { page: 2, x: 318, y: 700, text: "743 0" },
);
previousAtpAthletes.push({ name: "James Duckworth", providerId: "d295", nationalityCode: "AUS" });

const grouped = groupPositionedCells(atpCells);
assert.equal(grouped.length, 51, "positioned PDF cells must stay grouped into visual ranking rows");
const atp = parseAtpRankingRows({
  text: "Rankings Date:\nRank # Player\nAug 10, 2026 Grand Slam",
  cells: atpCells,
}, { athletes: previousAtpAthletes });
assert.equal(atp.rankingSnapshotDate, "2026-08-10");
assert.equal(atp.athletes.length, 51);
assert.equal(atp.athletes[0].providerId, "atp-1", "missing represented-country cells must use the reviewed identity fallback rather than guessing");
assert.equal(atp.athletes.at(-1).name, "James Duckworth");
assert.deepEqual(atp.athletes.at(-1).selectionReasons, ["australian"]);

function wtaRow(rank, countryCode = "USA"){
  return {
    player: {
      id: 320000 + rank,
      firstName: `Given${rank}`,
      lastName: `Family${rank}`,
      fullName: `Given${rank} Family${rank}`,
      countryCode,
    },
    ranking: rank,
    points: 6000 - rank,
    rankedAt: "2026-08-17T00:00:00Z",
  };
}

const wta = parseWtaRankingRows(
  Array.from({ length: 50 }, (_, index) => wtaRow(index + 1)),
  [wtaRow(65, "AUS"), wtaRow(67, "AUS")],
);
assert.equal(wta.rankingSnapshotDate, "2026-08-17");
assert.equal(wta.athletes.length, 52);
assert.equal(wta.athletes.filter(athlete => athlete.selectionReasons.includes("top_50")).length, 50);
assert.equal(wta.athletes.filter(athlete => athlete.selectionReasons.includes("australian")).length, 2);
assert.throws(
  () => parseWtaRankingRows(Array.from({ length: 49 }, (_, index) => wtaRow(index + 1)), [wtaRow(65, "AUS")]),
  /every unique rank from 1 through 50/,
  "truncated official responses must fail before replacing the last good export"
);

const payload = rankingExport({
  provider: "WTA",
  tour: "WTA",
  sourceUrl: WTA_SOURCE_URL,
  publicationUrl: "https://www.wtatennis.com/rankings/singles",
  rankingSnapshotDate: wta.rankingSnapshotDate,
  publicationCheckedAt: "2026-08-21T00:00:00.000Z",
  athletes: wta.athletes,
});
assert.equal(payload.ingestionMode, "public_first_party");
assert.equal(payload.sourceTrust, "verified");
assert.equal(payload.publicationCheckedAt, "2026-08-21T00:00:00.000Z");

async function validateWtaPagination(){
  const rows = Array.from({ length: 102 }, (_, index) => wtaRow(index + 1, index >= 100 ? "AUS" : "USA"));
  const requestedPages = [];
  const fetchImpl = async url => {
    const page = Number(new URL(url).searchParams.get("page"));
    requestedPages.push(page);
    return {
      ok: true,
      async json(){ return rows.slice(page * 100, (page + 1) * 100); },
    };
  };
  const universe = await fetchWtaRankingUniverse(fetchImpl, "2026-08-17");
  assert.deepEqual(requestedPages, [0, 1], "the WTA refresh must page through one unfiltered official ranking publication");
  assert.equal(universe.length, rows.length);
  assert.equal(parseWtaRankingRows(universe, []).athletes.filter(athlete => athlete.nationalityCode === "AUS").length, 2, "lower-ranked Australians must come from the same publication boundary as the Top 50");
}

validateWtaPagination()
  .then(() => console.log("Official tennis ranking refresh valid: positioned ATP PDF rows, one-date paginated WTA JSON, complete Top 50/AUS scope, identity fallback, and fail-closed provenance."))
  .catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
