#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const EXPORT_DIR = path.join(ROOT, "feeds/provider-exports/tennis");
const ATP_SOURCE_URL = "https://www.protennislive.com/posting/ramr/singles_entry_numerical.pdf";
const ATP_PUBLICATION_URL = "https://www.atptour.com/en/media/rankings-and-stats";
const WTA_SOURCE_URL = "https://api.wtatennis.com/tennis/players/ranked";
const WTA_PUBLICATION_URL = "https://www.wtatennis.com/rankings/singles";

function compactWhitespace(value){
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slug(value){
  return compactWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalisedName(value){
  return slug(value).replace(/-/g, "");
}

function isoTimestamp(value = new Date()){
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid retrieval time: ${value}`);
  return parsed.toISOString();
}

function isoDate(value){
  const parsed = Date.parse(`${String(value || "").slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ranking date: ${value}`);
  return new Date(parsed).toISOString().slice(0, 10);
}

function dateFromLongLabel(value){
  const parsed = Date.parse(`${compactWhitespace(value)} 00:00:00 UTC`);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid published ranking date: ${value}`);
  return new Date(parsed).toISOString().slice(0, 10);
}

function currentRankingExport(tour){
  const prefix = `${tour.toLowerCase()}-singles-`;
  const candidates = fs.readdirSync(EXPORT_DIR)
    .filter(name => name.startsWith(prefix) && name.endsWith(".json"))
    .map(name => ({ filePath: path.join(EXPORT_DIR, name), payload: JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, name), "utf8")) }))
    .filter(item => item.payload?.tour === tour)
    .sort((first, second) => String(second.payload.rankingSnapshotDate).localeCompare(String(first.payload.rankingSnapshotDate)));
  if (!candidates.length) throw new Error(`${tour} refresh needs a prior reviewed export for stable player identity fallback`);
  return candidates[0];
}

function identityMap(previousPayload){
  return new Map((previousPayload?.athletes || []).map(athlete => [normalisedName(athlete.name), athlete]));
}

function atpDisplayName(value){
  const [familyName, ...givenParts] = compactWhitespace(value).split(",");
  if (!familyName || !givenParts.length) throw new Error(`ATP ranking row has an unsupported player name: ${value}`);
  return compactWhitespace(`${givenParts.join(" ")} ${familyName}`);
}

function extractAtpPdfLayout(buffer){
  if (process.platform !== "darwin" || !fs.existsSync("/usr/bin/osascript")) {
    throw new Error("ATP numerical PDF refresh requires macOS PDFKit; retain the last good export on unsupported runners");
  }
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nothingsport-atp-rankings-"));
  const pdfPath = path.join(temporaryDirectory, "singles-entry-numerical.pdf");
  try {
    fs.writeFileSync(pdfPath, buffer);
    const script = [
      "ObjC.import('PDFKit');",
      "ObjC.import('Foundation');",
      "function run(argv){",
      "  const url = $.NSURL.fileURLWithPath(argv[0]);",
      "  const document = $.PDFDocument.alloc.initWithURL(url);",
      "  if (!document) throw new Error('PDFKit could not open ATP numerical rankings');",
      "  const output = { text: ObjC.unwrap(document.string || ''), cells: [] };",
      "  for (let pageIndex = 0; pageIndex < Number(document.pageCount); pageIndex += 1){",
      "    const page = document.pageAtIndex(pageIndex);",
      "    const selection = page.selectionForRect(page.boundsForBox(0));",
      "    const lines = selection ? selection.selectionsByLine : null;",
      "    if (!lines) continue;",
      "    for (let lineIndex = 0; lineIndex < Number(lines.count); lineIndex += 1){",
      "      const line = lines.objectAtIndex(lineIndex);",
      "      const bounds = line.boundsForPage(page);",
      "      output.cells.push({",
      "        page: pageIndex,",
      "        x: Number(bounds.origin.x),",
      "        y: Number(bounds.origin.y),",
      "        text: ObjC.unwrap(line.string || ''),",
      "      });",
      "    }",
      "  }",
      "  return JSON.stringify(output);",
      "}",
    ].join("\n");
    const result = spawnSync("/usr/bin/osascript", ["-l", "JavaScript", "-e", script, pdfPath], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 30000,
    });
    if (result.status !== 0) throw new Error(`ATP PDFKit extraction failed: ${compactWhitespace(result.stderr || result.stdout)}`);
    const extracted = JSON.parse(result.stdout);
    if (!Array.isArray(extracted.cells) || extracted.cells.length < 300) throw new Error("ATP numerical PDF contained too little positioned ranking data");
    return extracted;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function groupPositionedCells(cells){
  const pages = new Map();
  cells.forEach(cell => {
    const page = Number(cell.page);
    if (!pages.has(page)) pages.set(page, []);
    const rows = pages.get(page);
    let row = rows.find(candidate => Math.abs(candidate.y - Number(cell.y)) <= 0.35);
    if (!row) {
      row = { y: Number(cell.y), cells: [] };
      rows.push(row);
    }
    row.cells.push({ x: Number(cell.x), text: compactWhitespace(cell.text) });
  });
  return Array.from(pages.entries()).flatMap(([page, rows]) => rows.map(row => ({
    page,
    y: row.y,
    cells: row.cells.sort((first, second) => first.x - second.x),
  })));
}

function parseAtpRankingRows(extracted, previousPayload){
  const rankingDateMatch = String(extracted?.text || "").match(/Rankings Date:[\s\S]{0,180}?([A-Z][a-z]{2}\s+\d{1,2},\s+20\d{2})/);
  if (!rankingDateMatch) throw new Error("ATP numerical PDF did not expose a ranking date");
  const rankingSnapshotDate = dateFromLongLabel(rankingDateMatch[1]);
  const previousByName = identityMap(previousPayload);
  const parsedRows = [];
  groupPositionedCells(extracted.cells || []).forEach(row => {
    const combinedCell = row.cells.find(cell => cell.x >= 60 && cell.x < 240 && /^\d{1,4}T?\s+.+,.+$/.test(cell.text));
    const combinedMatch = combinedCell?.text.match(/^(\d{1,4})T?\s+(.+,.+)$/);
    const rankCell = row.cells.find(cell => cell.x >= 60 && cell.x < 100 && /^\d{1,4}T?$/.test(cell.text));
    const nameCell = row.cells.find(cell => cell.x >= 100 && cell.x < 240 && cell.text.includes(","));
    const pointsCell = row.cells.find(cell => cell.x >= 290 && cell.x < 340 && /^\d{1,6}(?:\s+\d{1,6})*$/.test(cell.text));
    if ((!combinedMatch && (!rankCell || !nameCell)) || !pointsCell) return;
    const rank = Number(combinedMatch?.[1] || rankCell.text.replace(/T$/, ""));
    const publishedName = atpDisplayName(combinedMatch?.[2] || nameCell.text);
    const previous = previousByName.get(normalisedName(publishedName));
    const name = previous?.name || publishedName;
    const countryCell = row.cells.find(cell => cell.x >= 235 && cell.x < 290 && /^\([A-Z]{3}\)$/.test(cell.text));
    const nationalityCode = countryCell ? countryCell.text.slice(1, -1) : previous?.nationalityCode;
    parsedRows.push({
      name,
      nationalityCode,
      points: Number(pointsCell.text.split(/\s+/)[0]),
      providerId: previous?.providerId || `public-${slug(name)}`,
      rank,
    });
  });
  const byPlayer = new Map();
  parsedRows.forEach(row => {
    const key = normalisedName(row.name);
    if (byPlayer.has(key)) throw new Error(`ATP numerical PDF produced duplicate player ${row.name}`);
    byPlayer.set(key, row);
  });
  const athletes = Array.from(byPlayer.values())
    .filter(athlete => athlete.rank <= 50 || athlete.nationalityCode === "AUS")
    .map(athlete => ({
      ...athlete,
      selectionReasons: [
        ...(athlete.rank <= 50 ? ["top_50"] : []),
        ...(athlete.nationalityCode === "AUS" ? ["australian"] : []),
      ],
    }))
    .sort((first, second) => first.rank - second.rank || first.name.localeCompare(second.name));
  assertCompleteRankingUniverse(athletes, "ATP");
  return { rankingSnapshotDate, athletes };
}

function parseWtaRankingRows(topRows, australianRows){
  const combined = [...(topRows || []), ...(australianRows || [])];
  if (!combined.length) throw new Error("WTA public rankings API returned no rows");
  const rankingDates = new Set(combined.map(row => isoDate(row.rankedAt)));
  if (rankingDates.size !== 1) throw new Error(`WTA public rankings API returned asymmetric snapshot dates: ${Array.from(rankingDates).join(", ")}`);
  const byId = new Map();
  combined.forEach(row => {
    const player = row?.player || {};
    const athlete = {
      name: compactWhitespace(player.fullName || `${player.firstName || ""} ${player.lastName || ""}`),
      nationalityCode: String(player.countryCode || "").toUpperCase(),
      points: Number(row.points),
      providerId: String(player.id || ""),
      rank: Number(row.ranking),
    };
    if (!athlete.providerId || !athlete.name || !Number.isInteger(athlete.rank)) throw new Error("WTA public rankings API returned an incomplete player row");
    byId.set(athlete.providerId, athlete);
  });
  const athletes = Array.from(byId.values())
    .filter(athlete => athlete.rank <= 50 || athlete.nationalityCode === "AUS")
    .map(athlete => ({
      ...athlete,
      selectionReasons: [
        ...(athlete.rank <= 50 ? ["top_50"] : []),
        ...(athlete.nationalityCode === "AUS" ? ["australian"] : []),
      ],
    }))
    .sort((first, second) => first.rank - second.rank || first.name.localeCompare(second.name));
  assertCompleteRankingUniverse(athletes, "WTA");
  return { rankingSnapshotDate: Array.from(rankingDates)[0], athletes };
}

function assertCompleteRankingUniverse(athletes, tour){
  const top50 = athletes.filter(athlete => athlete.rank <= 50);
  if (top50.length !== 50 || new Set(top50.map(athlete => athlete.rank)).size !== 50) {
    throw new Error(`${tour} official refresh must contain every unique rank from 1 through 50`);
  }
  if (!top50.every(athlete => /^[A-Z]{3}$/.test(athlete.nationalityCode || "") && Number.isFinite(athlete.points))) {
    throw new Error(`${tour} official refresh must resolve represented country and points for every Top 50 player`);
  }
  if (!athletes.some(athlete => athlete.nationalityCode === "AUS" && athlete.rank > 50)) {
    throw new Error(`${tour} official refresh must include ranked Australians outside the Top 50`);
  }
  if (new Set(athletes.map(athlete => athlete.providerId)).size !== athletes.length) {
    throw new Error(`${tour} official refresh produced duplicate player aliases`);
  }
}

async function checkedFetch(fetchImpl, url, responseType = "json"){
  const response = await fetchImpl(url, {
    headers: {
      accept: responseType === "buffer" ? "application/pdf" : "application/json",
      "user-agent": "nothingSport-static-refresh/1.0",
    },
    ...(typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? { signal: AbortSignal.timeout(25000) } : {}),
  });
  if (!response?.ok) throw new Error(`Official tennis ranking fetch failed for ${url}: HTTP ${response?.status || "unknown"}`);
  if (responseType === "buffer") return Buffer.from(await response.arrayBuffer());
  return response.json();
}

async function fetchWtaRankingUniverse(fetchImpl, referenceDate){
  const rows = [];
  const pageSize = 100;
  const maximumPages = 25;
  for (let page = 0; page < maximumPages; page += 1){
    const pageRows = await checkedFetch(fetchImpl, `${WTA_SOURCE_URL}?page=${page}&pageSize=${pageSize}&type=rankSingles&sort=asc&metric=SINGLES&at=${referenceDate}`);
    if (!Array.isArray(pageRows)) throw new Error(`WTA public rankings API returned a non-array page at ${page}`);
    rows.push(...pageRows);
    if (pageRows.length < pageSize) return rows;
  }
  throw new Error(`WTA public rankings API exceeded the fail-closed ${maximumPages * pageSize}-row pagination boundary`);
}

function rankingExport({ provider, tour, sourceUrl, publicationUrl, rankingSnapshotDate, publicationCheckedAt, athletes }){
  return {
    schemaVersion: "tennis-ranking-export.v1",
    provider,
    tour,
    rankingSnapshotDate,
    extractedAt: publicationCheckedAt,
    publicationCheckedAt,
    sourceTrust: "verified",
    ingestionMode: "public_first_party",
    sourceUrl,
    publicationUrl,
    scope: {
      topN: 50,
      nationalityCodes: ["AUS"],
      complete: true,
    },
    athletes,
  };
}

async function refreshRankingExports({ fetchImpl = fetch, now = new Date() } = {}){
  const publicationCheckedAt = isoTimestamp(now);
  const referenceDate = publicationCheckedAt.slice(0, 10);
  const previousAtp = currentRankingExport("ATP").payload;
  const [atpBuffer, wtaRows] = await Promise.all([
    checkedFetch(fetchImpl, ATP_SOURCE_URL, "buffer"),
    fetchWtaRankingUniverse(fetchImpl, referenceDate),
  ]);
  const atp = parseAtpRankingRows(extractAtpPdfLayout(atpBuffer), previousAtp);
  const wta = parseWtaRankingRows(wtaRows, []);
  return [
    rankingExport({
      provider: "ATP Tour",
      tour: "ATP",
      sourceUrl: ATP_SOURCE_URL,
      publicationUrl: ATP_PUBLICATION_URL,
      rankingSnapshotDate: atp.rankingSnapshotDate,
      publicationCheckedAt,
      athletes: atp.athletes,
    }),
    rankingExport({
      provider: "WTA",
      tour: "WTA",
      sourceUrl: WTA_SOURCE_URL,
      publicationUrl: WTA_PUBLICATION_URL,
      rankingSnapshotDate: wta.rankingSnapshotDate,
      publicationCheckedAt,
      athletes: wta.athletes,
    }),
  ];
}

function outputPath(payload){
  return path.join(EXPORT_DIR, `${payload.tour.toLowerCase()}-singles-${payload.rankingSnapshotDate}.json`);
}

function writeExports(exports){
  const rendered = exports.map(payload => ({ filePath: outputPath(payload), content: `${JSON.stringify(payload, null, 2)}\n` }));
  rendered.forEach(({ filePath, content }) => fs.writeFileSync(filePath, content));
  return rendered.map(item => path.relative(ROOT, item.filePath));
}

async function main(){
  const exports = await refreshRankingExports();
  const paths = writeExports(exports);
  console.log(`Official tennis ranking exports refreshed: ${paths.join(", ")}.`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  ATP_PUBLICATION_URL,
  ATP_SOURCE_URL,
  WTA_PUBLICATION_URL,
  WTA_SOURCE_URL,
  assertCompleteRankingUniverse,
  atpDisplayName,
  extractAtpPdfLayout,
  fetchWtaRankingUniverse,
  groupPositionedCells,
  parseAtpRankingRows,
  parseWtaRankingRows,
  rankingExport,
  refreshRankingExports,
  writeExports,
};
