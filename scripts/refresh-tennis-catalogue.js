#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const tennisCoverage = require("../config/tennis-coverage.js");

const ROOT = path.resolve(__dirname, "..");
const EXPORT_DIR = path.join(ROOT, "feeds/provider-exports/tennis");
const OUTPUT_PATH = path.join(ROOT, "data/canonical/tennis-catalogue-2026.json");
const MAXIMUM_RANKING_AGE_DAYS = 9;
const MAXIMUM_CONFIRMED_PUBLICATION_LAG_DAYS = 16;
const MAXIMUM_PUBLICATION_CHECK_AGE_DAYS = 2;
const RANKING_INGESTION_MODES = Object.freeze(["manual_reviewed_export", "licensed_api", "public_first_party"]);

function readJson(filePath){
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function slug(value){
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isoDate(value){
  const parsed = Date.parse(`${String(value || "").slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid snapshot date: ${value}`);
  return new Date(parsed).toISOString().slice(0, 10);
}

function rankingExportFiles(){
  return fs.readdirSync(EXPORT_DIR)
    .filter(name => /^(atp|wta)-singles-\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map(name => path.join(EXPORT_DIR, name));
}

function validateRankingExport(payload, filePath){
  const label = path.relative(ROOT, filePath);
  if (payload?.schemaVersion !== "tennis-ranking-export.v1") throw new Error(`${label} has an unsupported schema version`);
  if (!["ATP", "WTA"].includes(payload.tour)) throw new Error(`${label} must declare ATP or WTA`);
  if (!RANKING_INGESTION_MODES.includes(payload.ingestionMode)) throw new Error(`${label} has an unsupported ingestion mode`);
  if (payload.ingestionMode === "public_first_party") {
    if (payload.sourceTrust !== "verified") throw new Error(`${label} must mark first-party public ranking data as verified`);
    if (!Number.isFinite(Date.parse(payload.publicationCheckedAt || ""))) throw new Error(`${label} must record when the official publication was checked`);
    if (!/^https:\/\//.test(payload.publicationUrl || "")) throw new Error(`${label} must retain its official human-readable publication URL`);
  }
  if (payload.scope?.complete !== true || Number(payload.scope?.topN) < 50 || !payload.scope?.nationalityCodes?.includes("AUS")) {
    throw new Error(`${label} must be a complete Top 50 plus AUS export`);
  }
  if (!Array.isArray(payload.athletes) || payload.athletes.length < 50) throw new Error(`${label} is truncated below 50 athletes`);
  const aliases = new Set();
  payload.athletes.forEach(athlete => {
    if (!athlete.providerId || aliases.has(athlete.providerId)) throw new Error(`${label} has a duplicate or empty player alias`);
    aliases.add(athlete.providerId);
    if (!Number.isInteger(athlete.rank) || athlete.rank < 1) throw new Error(`${label} has an invalid ranking`);
    if (!/^[A-Z]{3}$/.test(athlete.nationalityCode || "")) throw new Error(`${label} has an invalid represented country`);
    const reasons = new Set(athlete.selectionReasons || []);
    if (athlete.rank <= 50 && !reasons.has("top_50")) throw new Error(`${label} omitted a Top 50 selection reason`);
    if (athlete.nationalityCode === "AUS" && !reasons.has("australian")) throw new Error(`${label} omitted an Australian selection reason`);
    if (athlete.rank > 50 && athlete.nationalityCode !== "AUS") throw new Error(`${label} contains an out-of-scope non-Australian outside the Top 50`);
  });
  const top50 = payload.athletes.filter(athlete => athlete.rank <= 50);
  if (top50.length !== 50 || new Set(top50.map(athlete => athlete.rank)).size !== 50) throw new Error(`${label} must contain every unique rank from 1 through 50`);
  if (!payload.athletes.some(athlete => athlete.nationalityCode === "AUS" && athlete.rank > 50)) throw new Error(`${label} must prove Australian coverage outside the Top 50`);
  isoDate(payload.rankingSnapshotDate);
  return payload;
}

function latestRankingExports(){
  const grouped = new Map();
  rankingExportFiles().forEach(filePath => {
    const payload = validateRankingExport(readJson(filePath), filePath);
    const previous = grouped.get(payload.tour);
    if (!previous || previous.payload.rankingSnapshotDate < payload.rankingSnapshotDate) grouped.set(payload.tour, { filePath, payload });
  });
  if (!grouped.has("ATP") || !grouped.has("WTA")) throw new Error("Tennis ranking refresh fails closed unless both ATP and WTA exports are present");
  return [grouped.get("ATP"), grouped.get("WTA")];
}

function validateTournamentExport(payload){
  if (payload?.schemaVersion !== "tennis-tournament-export.v1") throw new Error("Tournament export has an unsupported schema version");
  if (!["manual_reviewed_export", "licensed_api"].includes(payload.ingestionMode)) throw new Error("Tournament export has an unsupported ingestion mode");
  if (!Array.isArray(payload.tournaments) || payload.tournaments.length < 20) throw new Error("Tournament export is incomplete");
  const aliases = new Set();
  payload.tournaments.forEach(tournament => {
    if (!tournament.providerId || aliases.has(tournament.providerId)) throw new Error("Tournament aliases must be unique and non-empty");
    aliases.add(tournament.providerId);
    if (isoDate(tournament.endDate) < isoDate(tournament.startDate)) throw new Error(`${tournament.name} ends before it starts`);
    tennisCoverage.normalizeTournament({ ...tournament, season: payload.season });
  });
  const levels = new Set(payload.tournaments.map(tournament => tournament.level));
  ["grand_slam", "atp_masters_1000", "wta_1000", "atp_finals", "wta_finals", "team_competition"].forEach(level => {
    if (!levels.has(level)) throw new Error(`Tournament export is missing ${level}`);
  });
  return payload;
}

function athleteRecord(exportPayload, athlete){
  const tourSlug = exportPayload.tour.toLowerCase();
  return {
    athleteId: `competitor:tennis:${tourSlug}:${slug(athlete.name)}`,
    providerAlias: `${tourSlug}:player:${athlete.providerId}`,
    displayName: athlete.name,
    tour: exportPayload.tour,
    rankingSingles: athlete.rank,
    rankingPoints: Number.isFinite(Number(athlete.points)) ? Number(athlete.points) : null,
    rankingSnapshotDate: exportPayload.rankingSnapshotDate,
    rankingSourceTrust: exportPayload.sourceTrust || (exportPayload.ingestionMode === "licensed_api" ? "verified" : "unverified"),
    rankingPublicationCheckedAt: exportPayload.publicationCheckedAt || exportPayload.extractedAt,
    nationalityCode: athlete.nationalityCode,
    isAustralian: athlete.nationalityCode === "AUS",
    active: true,
    selectionReasons: Array.from(new Set(athlete.selectionReasons)).sort(),
  };
}

function generateCatalogue(){
  const rankings = latestRankingExports();
  const tournamentExport = validateTournamentExport(readJson(path.join(EXPORT_DIR, "tournaments-2026-reviewed.json")));
  const athletes = rankings.flatMap(({ payload }) => payload.athletes.map(athlete => athleteRecord(payload, athlete)));
  if (new Set(athletes.map(athlete => athlete.athleteId)).size !== athletes.length) throw new Error("Canonical tennis athlete IDs must be unique");
  const tournaments = tournamentExport.tournaments.map(tournament => tennisCoverage.normalizeTournament({ ...tournament, season: tournamentExport.season }));
  const generatedAt = [
    ...rankings.map(({ payload }) => payload.extractedAt),
    tournamentExport.reviewedAt,
  ].sort().at(-1);
  const ingestionModes = new Set([...rankings.map(({ payload }) => payload.ingestionMode), tournamentExport.ingestionMode]);
  const sources = [
    ...rankings.map(({ filePath, payload }) => ({
      provider: payload.provider,
      tour: payload.tour,
      sourceUrl: payload.sourceUrl,
      effectiveDate: payload.rankingSnapshotDate,
      observedAt: payload.extractedAt,
      publicationCheckedAt: payload.publicationCheckedAt || payload.extractedAt,
      publicationUrl: payload.publicationUrl || payload.sourceUrl,
      sourceTrust: payload.sourceTrust || (payload.ingestionMode === "licensed_api" ? "verified" : "unverified"),
      ingestionMode: payload.ingestionMode,
      fixturePath: path.relative(ROOT, filePath),
    })),
    ...tournamentExport.sources.map(source => ({
      ...source,
      observedAt: tournamentExport.reviewedAt,
      ingestionMode: tournamentExport.ingestionMode,
      fixturePath: path.relative(ROOT, path.join(EXPORT_DIR, "tournaments-2026-reviewed.json")),
    })),
  ];
  return {
    schemaVersion: "tennis-catalogue.v1",
    season: tournamentExport.season,
    generatedAt,
    ingestionMode: ingestionModes.size === 1 ? Array.from(ingestionModes)[0] : "mixed",
    refreshPolicy: {
      rankingsCadence: "weekly",
      maximumRankingAgeDays: MAXIMUM_RANKING_AGE_DAYS,
      maximumConfirmedPublicationLagDays: MAXIMUM_CONFIRMED_PUBLICATION_LAG_DAYS,
      maximumPublicationCheckAgeDays: MAXIMUM_PUBLICATION_CHECK_AGE_DAYS,
      parityRequired: false,
      independentPublicationFreshnessRequired: true,
      failureMode: "retain_last_good_and_fail_closed",
    },
    sources,
    athletes,
    tournaments,
  };
}

function assertFresh(catalogue, referenceDate = new Date()){
  const referenceDay = Date.parse(`${String(referenceDate instanceof Date ? referenceDate.toISOString() : referenceDate).slice(0, 10)}T00:00:00Z`);
  const rankingSources = catalogue.sources.filter(source => source.tour && source.effectiveDate);
  if (!Number.isFinite(referenceDay) || rankingSources.length !== 2) throw new Error("Tennis ranking freshness needs one ATP and one WTA source");
  const ages = rankingSources.map(source => {
    const snapshotDay = Date.parse(`${source.effectiveDate}T00:00:00Z`);
    const ageDays = Math.floor((referenceDay - snapshotDay) / 86400000);
    const publicationCheckDay = Date.parse(`${String(source.publicationCheckedAt || "").slice(0, 10)}T00:00:00Z`);
    const publicationCheckAgeDays = Math.max(0, Math.floor((referenceDay - publicationCheckDay) / 86400000));
    const verifiedNextDayPublication = ageDays === -1
      && source.ingestionMode === "public_first_party"
      && source.sourceTrust === "verified"
      && publicationCheckDay === referenceDay;
    if (!Number.isFinite(ageDays) || (ageDays < 0 && !verifiedNextDayPublication)) throw new Error(`${source.tour} ranking snapshot has an impossible future date`);
    if (verifiedNextDayPublication) return 0;
    if (ageDays <= catalogue.refreshPolicy.maximumRankingAgeDays) return ageDays;
    const confirmedLatest = source.ingestionMode === "public_first_party"
      && source.sourceTrust === "verified"
      && Number.isFinite(publicationCheckDay)
      && publicationCheckAgeDays <= catalogue.refreshPolicy.maximumPublicationCheckAgeDays
      && ageDays <= catalogue.refreshPolicy.maximumConfirmedPublicationLagDays;
    if (!confirmedLatest) {
      throw new Error(`${source.tour} ranking snapshot is ${ageDays} days old and is not a recently confirmed latest official publication; refresh before publishing`);
    }
    return ageDays;
  });
  const oldestAgeDays = Math.max(...ages);
  return oldestAgeDays;
}

function render(catalogue){
  return `${JSON.stringify(catalogue, null, 2)}\n`;
}

function main(argv = process.argv.slice(2)){
  const catalogue = generateCatalogue();
  if (argv.includes("--enforce-freshness")) assertFresh(catalogue);
  if (argv.includes("--validate")) {
    console.log(`Tennis provider exports valid: ${catalogue.athletes.length} athletes and ${catalogue.tournaments.length} tournaments across ATP and WTA.`);
    return;
  }
  const output = render(catalogue);
  if (argv.includes("--check")) {
    const current = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, "utf8") : "";
    if (current !== output) {
      console.error("Canonical tennis catalogue is stale. Run node scripts/refresh-tennis-catalogue.js.");
      process.exit(1);
    }
    console.log(`Tennis catalogue current: ${catalogue.athletes.length} athletes and ${catalogue.tournaments.length} tournaments across ATP and WTA.`);
    return;
  }
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, output);
  console.log(`Canonical tennis catalogue written: ${path.relative(ROOT, OUTPUT_PATH)} (${catalogue.athletes.length} athletes, ${catalogue.tournaments.length} tournaments).`);
}

if (require.main === module) main();

module.exports = {
  EXPORT_DIR,
  OUTPUT_PATH,
  MAXIMUM_RANKING_AGE_DAYS,
  MAXIMUM_CONFIRMED_PUBLICATION_LAG_DAYS,
  MAXIMUM_PUBLICATION_CHECK_AGE_DAYS,
  assertFresh,
  generateCatalogue,
  latestRankingExports,
  render,
  validateRankingExport,
  validateTournamentExport,
};
