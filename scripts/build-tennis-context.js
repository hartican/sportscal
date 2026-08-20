#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { generateCatalogue } = require("./refresh-tennis-catalogue.js");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "data/canonical/tennis-context-2026.json");
const SUPPLEMENT_PATH = path.join(ROOT, "data/canonical/tennis-published-participants-2026.json");
const ALPHA3_TO_ALPHA2 = Object.freeze({
  ARG: "AR", AUS: "AU", AUT: "AT", BEL: "BE", BLR: "BY", BRA: "BR", CAN: "CA", CHI: "CL", CHN: "CN", CRO: "HR", CZE: "CZ", DEN: "DK", EGY: "EG", ESP: "ES", FRA: "FR", GBR: "GB", GER: "DE", GRE: "GR", INA: "ID", ITA: "IT", JPN: "JP", KAZ: "KZ", LAT: "LV", MON: "MC", NOR: "NO", PER: "PE", PHI: "PH", POL: "PL", POR: "PT", ROU: "RO", RUS: "RU", SRB: "RS", SUI: "CH", TUR: "TR", UKR: "UA", USA: "US",
});

function surname(value){
  return String(value || "").trim().split(/\s+/).at(-1);
}

function participant(athlete){
  const countryCode = ALPHA3_TO_ALPHA2[athlete.nationalityCode];
  if (!countryCode) throw new Error(`No ISO alpha-2 mapping for ${athlete.nationalityCode}`);
  return {
    id: athlete.athleteId,
    type: "competitor",
    sportDomainId: `sport:tennis:${athlete.tour.toLowerCase()}`,
    displayName: athlete.displayName,
    shortName: surname(athlete.displayName),
    canonicalName: athlete.displayName,
    countryCode,
    metadata: {
      active: athlete.active,
      titleAliases: [surname(athlete.displayName)],
      rankingSingles: athlete.rankingSingles,
      rankingPoints: athlete.rankingPoints,
      rankingSnapshotDate: athlete.rankingSnapshotDate,
      rankingSourceTrust: athlete.rankingSourceTrust,
      rankingPublicationCheckedAt: athlete.rankingPublicationCheckedAt,
      representedCountryCode: athlete.nationalityCode,
      isAustralian: athlete.isAustralian,
      providerAlias: athlete.providerAlias,
      selectionReasons: athlete.selectionReasons,
    },
  };
}

function competition(tour){
  const slug = tour.toLowerCase();
  return {
    id: `competition:${slug}-singles-2026`,
    sportDomainId: "sport:tennis",
    preferenceDomainId: "sport:tennis",
    competitionFamilyId: `family:${slug}-tour`,
    slug: `${slug}-singles-2026`,
    name: `PIF ${tour} Singles Rankings`,
    competitionType: "ranking",
    seasonLabel: "2026",
    region: "global",
    gender: tour === "ATP" ? "mens" : "womens",
    supportsLadder: true,
    supportsTeams: false,
    supportsCompetitors: true,
    isSpecialEvent: false,
    standingsOnly: true,
    standingsType: "singlesRanking",
    defaultStandingsVisibility: "summary",
  };
}

function rankingSnapshot(catalogue, tour){
  const athletes = catalogue.athletes.filter(athlete => athlete.tour === tour);
  const source = catalogue.sources.find(item => item.tour === tour);
  return {
    id: `ranking:${tour.toLowerCase()}-singles-2026:${athletes[0].rankingSnapshotDate}`,
    competitionId: `competition:${tour.toLowerCase()}-singles-2026`,
    seasonLabel: "2026",
    roundLabel: `${tour} singles ranking`,
    snapshotTimeUtc: `${athletes[0].rankingSnapshotDate}T00:00:00.000Z`,
    entries: athletes.map(athlete => ({ participantId: athlete.athleteId, rank: athlete.rankingSingles, points: athlete.rankingPoints })),
    source: {
      provider: source.provider,
      sourceUrl: source.sourceUrl,
      sourceType: source.sourceTrust === "verified" ? "official" : "scraped",
      sourceTrust: source.sourceTrust,
      checkedAt: source.publicationCheckedAt || source.observedAt,
    },
    metadata: {
      scope: "Top 50 plus every ranked Australian from the latest independently checked ATP or WTA publication",
      refreshCadence: "weekly",
      ingestionMode: catalogue.ingestionMode,
      withholdingPolicy: "Retain the last good snapshot and fail closed if either tour is unconfirmed, truncated, missing, or beyond the bounded official-publication lag.",
    },
  };
}

function buildContext(catalogue = generateCatalogue()){
  const canonicalParticipants = catalogue.athletes.map(participant);
  const canonicalIds = new Set(canonicalParticipants.map(item => item.id));
  const legacyWimbledonParticipants = (JSON.parse(fs.readFileSync(SUPPLEMENT_PATH, "utf8")).participants || [])
    .filter(item => !canonicalIds.has(item.id))
    .map(item => ({ ...item, metadata: { ...item.metadata, catalogueRole: "published_event_participant" } }));
  return {
    schemaVersion: "sport-context.v1",
    taxonomyVersion: "sports-taxonomy.v1",
    season: 2026,
    generatedAt: catalogue.generatedAt,
    sources: catalogue.sources.slice(0, 3).map(source => ({
      provider: source.provider,
      sourceUrl: source.sourceUrl,
      sourceType: source.sourceTrust === "verified" ? "official" : "scraped",
      sourceTrust: source.sourceTrust,
      checkedAt: source.publicationCheckedAt || source.observedAt,
    })),
    sportDomains: [{
      id: "sport:tennis",
      slug: "tennis",
      name: "Tennis",
      kind: "sport",
      sortOrder: 50,
      isActive: true,
      supportsLadders: true,
      supportsAllFixtures: false,
      supportsNarrative: true,
      supportsTeams: false,
      supportsCompetitors: true,
      defaultTemplateId: "template:like",
      metadata: { region: "global", neutralGlyph: "sport:tennis" },
    }],
    competitionFamilies: [
      { id: "family:atp-tour", sportDomainId: "sport:tennis", slug: "atp-tour", name: "ATP Tour", familyType: "tour", sortOrder: 40, isActive: true },
      { id: "family:wta-tour", sportDomainId: "sport:tennis", slug: "wta-tour", name: "WTA Tour", familyType: "tour", sortOrder: 41, isActive: true },
    ],
    competitions: [competition("ATP"), competition("WTA")],
    participants: [...canonicalParticipants, ...legacyWimbledonParticipants],
    ladderSnapshots: [rankingSnapshot(catalogue, "ATP"), rankingSnapshot(catalogue, "WTA")],
    eventParticipantScopes: [
      { sportKey: "tennis", preferenceDomainId: "sport:tennis", participantSportDomainId: "sport:tennis:atp", titlePattern: "\\bATP\\b", resolutionMode: "title-match" },
      { sportKey: "tennis", preferenceDomainId: "sport:tennis", participantSportDomainId: "sport:tennis:wta", titlePattern: "\\bWTA\\b", resolutionMode: "title-match" },
      { sportKey: "wimbledon", preferenceDomainId: "special:wimbledon", participantSportDomainId: "sport:tennis:atp", titlePattern: "\\bMen(?:'|’)s\\b", resolutionMode: "title-match" },
      { sportKey: "wimbledon", preferenceDomainId: "special:wimbledon", participantSportDomainId: "sport:tennis:wta", titlePattern: "\\bWomen(?:'|’)s\\b", resolutionMode: "title-match" },
    ],
  };
}

function render(context = buildContext()){
  return `${JSON.stringify(context, null, 2)}\n`;
}

function main(argv = process.argv.slice(2)){
  const output = render();
  if (argv.includes("--check")) {
    const current = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, "utf8") : "";
    if (current !== output) {
      console.error("Canonical tennis context is stale. Run node scripts/build-tennis-context.js.");
      process.exit(1);
    }
    console.log("Canonical tennis context matches the provider-neutral ATP/WTA catalogue.");
    return;
  }
  fs.writeFileSync(OUTPUT_PATH, output);
  console.log("Canonical ATP/WTA tennis context written.");
}

if (require.main === module) main();

module.exports = { ALPHA3_TO_ALPHA2, OUTPUT_PATH, buildContext, render };
