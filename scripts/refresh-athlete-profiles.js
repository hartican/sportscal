#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "data/athlete-profiles");
const CHECK_ONLY = process.argv.includes("--check");
const AFL_TOP_TEN = [
  ["Nick Daicos", 147], ["Marcus Bontempelli", 109], ["Max Gawn", 99], ["Will Ashcroft", 91], ["Bailey Smith", 85],
  ["Isaac Heeney", 84], ["Patrick Cripps", 81], ["Jordan Dawson", 80], ["Brodie Grundy", 79], ["Luke Jackson", 77],
];
const AFLW_TOP_TEN = [
  "Jasmine Garner", "Kate Hore", "Ash Riddell", "Ella Roberts", "Matilda Scholz",
  "Monique Conti", "Ebony Marinoff", "Georgie Prespakis", "Chloe Molloy", "Tyla Hanks",
];
const F1_GRID = [
  ["Pierre Gasly", "Alpine", 10, "FR"], ["Franco Colapinto", "Alpine", 43, "AR"],
  ["Fernando Alonso", "Aston Martin", 14, "ES"], ["Lance Stroll", "Aston Martin", 18, "CA"],
  ["Gabriel Bortoleto", "Audi", 5, "BR"], ["Nico Hulkenberg", "Audi", 27, "DE"],
  ["Sergio Perez", "Cadillac", 11, "MX"], ["Valtteri Bottas", "Cadillac", 77, "FI"],
  ["Charles Leclerc", "Ferrari", 16, "MC"], ["Lewis Hamilton", "Ferrari", 44, "GB"],
  ["Esteban Ocon", "Haas", 31, "FR"], ["Oliver Bearman", "Haas", 87, "GB"],
  ["Lando Norris", "McLaren", 1, "GB"], ["Oscar Piastri", "McLaren", 81, "AU"],
  ["Kimi Antonelli", "Mercedes", 12, "IT"], ["George Russell", "Mercedes", 63, "GB"],
  ["Liam Lawson", "Racing Bulls", 30, "NZ"], ["Arvid Lindblad", "Racing Bulls", 41, "GB"],
  ["Max Verstappen", "Red Bull Racing", 3, "NL"], ["Isack Hadjar", "Red Bull Racing", 6, "FR"],
  ["Alexander Albon", "Williams", 23, "TH"], ["Carlos Sainz", "Williams", 55, "ES"],
];
const F1_TOP_TEN = [
  ["Kimi Antonelli", 242], ["George Russell", 183], ["Lewis Hamilton", 183], ["Lando Norris", 159], ["Charles Leclerc", 155],
  ["Max Verstappen", 112], ["Oscar Piastri", 104], ["Isack Hadjar", 68], ["Liam Lawson", 49], ["Pierre Gasly", 44],
];
const AFLCA_URL = "https://www.afl.com.au/news/1594994/record-breaker-collingwood-magpies-star-nick-daicos-caps-incredible-season-with-second-coaches-award/";
const AFLW_TOP_URL = "https://www.afl.com.au/news/1583246/the-25-the-aflws-best-players-ranked-ahead-of-the-2026-season";
const F1_STANDINGS_URL = "https://www.formula1.com/en/results/2026/drivers";
const F1_DRIVERS_URL = "https://www.formula1.com/en/drivers";

function slugify(value){
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function readJson(relativePath){ return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")); }

function decodeHtml(value){
  return String(value || "").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function stripHtml(value){ return decodeHtml(String(value || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim(); }

async function fetchText(url, options = {}){
  const response = await fetch(url, { ...options, signal:AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function fetchJson(url, options = {}){ return JSON.parse(await fetchText(url, options)); }

async function parallel(items, worker, width = 6){
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length:Math.min(width, items.length) }, async () => {
    while (cursor < items.length){ const index = cursor++; output[index] = await worker(items[index], index); }
  }));
  return output;
}

function scalar(value){ return value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value") ? value.value : value; }

function metricRows(stats, fields){
  return fields.map(([key, label]) => ({ label, value:scalar(stats?.[key]) })).filter(row => row.value !== null && row.value !== undefined && row.value !== "");
}

function playerBiography(player, details, teamName){
  const number = Number(details?.jumperNumber || player.competitionNumber || 0);
  const facts = [
    `${player.displayName} is a ${String(details?.position || player.position || "player").toLowerCase()} for ${teamName} in the 2026 season${number > 0 ? `, wearing guernsey No. ${number}` : ""}.`,
    details?.recruitedFrom || player.recruitedFrom ? `Recruited from ${details?.recruitedFrom || player.recruitedFrom}, ${player.displayName.split(" ")[0]} made ${details?.debutYear || player.debutYear ? `a senior debut in ${details?.debutYear || player.debutYear}` : "the senior list"}${Number(details?.heightCm || player.heightInCm) ? ` and is listed at ${details?.heightCm || player.heightInCm} cm` : ""}.` : null,
    "The profile below combines the official current-season record, career totals and the latest available match-by-match form.",
  ].filter(Boolean);
  return facts.join(" ");
}

function parseGwsProfileUrls(){
  const source = fs.readFileSync(path.join(ROOT, "docs/research/afl-aflw-f1-athlete-sources-2026.md"), "utf8");
  const result = new Map();
  for (const match of source.matchAll(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*`(CD_I\d+)`\s*\|\s*\[profile\]\((https:\/\/www\.gwsgiants\.com\.au\/players\/aflw\/[^)]+)\)/gm)){
    result.set(match[2], { displayName:match[1].trim(), url:match[3] });
  }
  return result;
}

async function mintAflToken(){
  const body = await fetchJson("https://api.afl.com.au/cfs/afl/WMCTok", {
    method:"POST", headers:{ "content-type":"application/json", Origin:"https://www.afl.com.au", Referer:"https://www.afl.com.au/" }, body:"{}",
  });
  if (!body.token) throw new Error("AFL StatsPro token was unavailable");
  return body.token;
}

async function buildAflProfiles(code, directory, selectedPlayers, checkedAt, token, gwsUrls){
  const isAflw = code === "aflw";
  const byName = new Map(directory.players.map(player => [player.displayName.toLowerCase(), player]));
  const teamNames = new Map(directory.teams.map(team => [team.id, team.displayName]));
  const unique = new Map();
  selectedPlayers.forEach(item => {
    const name = Array.isArray(item) ? item[0] : item;
    const player = byName.get(name.toLowerCase());
    if (!player) throw new Error(`${code.toUpperCase()} profile selection did not resolve: ${name}`);
    unique.set(player.id, player);
  });
  if (isAflw) directory.players.filter(player => player.currentTeamId === "team:aflw:cd_t7889").forEach(player => unique.set(player.id, player));
  const headers = { "x-media-mis-token":token, Origin:"https://www.afl.com.au", Referer:"https://www.afl.com.au/" };
  const competitionCode = isAflw ? "CD_C264" : "CD_C014";
  const competitionType = isAflw ? "AFLW" : "AFL";
  const seasonId = isAflw ? "CD_S2026264" : "CD_S2026014";
  return parallel([...unique.values()], async player => {
    const profileUrl = `https://api.afl.com.au/statspro/playerProfile/${player.providerId}?competitionCode=${competitionCode}`;
    const recentUrl = `https://api.afl.com.au/statspro/playerSeasonRoundStats/${player.providerId}?seasonId=${seasonId}`;
    const careerUrl = `https://api.afl.com.au/statspro/playerCareerSeasonStats/${player.providerId}?competitionType=${competitionType}`;
    const [official, recent, career] = await Promise.all([
      fetchJson(profileUrl, { headers }),
      fetchJson(recentUrl, { headers }).catch(() => ({ roundStats:[] })),
      fetchJson(careerUrl, { headers }).catch(() => ({ careerTotals:{} })),
    ]);
    const details = official.playerDetails || {};
    const rank = selectedPlayers.findIndex(item => (Array.isArray(item) ? item[0] : item).toLowerCase() === player.displayName.toLowerCase()) + 1;
    const gws = gwsUrls.get(player.providerId);
    const sourceUrl = gws?.url || player.sourceUrl;
    return {
      schemaVersion:"athlete-profile.v1", id:player.profileRef, participantId:player.id, sportKey:code,
      displayName:player.displayName, currentTeamId:player.currentTeamId, teamName:teamNames.get(player.currentTeamId) || null,
      headshotUrl:details.photoURL ? encodeURI(details.photoURL) : player.headshotUrl,
      competitionNumber:Number(details.jumperNumber || player.competitionNumber) > 0 ? Number(details.jumperNumber || player.competitionNumber) : null,
      competitionNumberKind:"guernsey", competitionNumberSeason:"2026",
      biography:playerBiography(player, details, teamNames.get(player.currentTeamId) || (isAflw ? "an AFLW club" : "an AFL club")),
      keyFacts:[
        { label:"Position", value:details.position || player.position }, { label:"Height", value:Number(details.heightCm || player.heightInCm) ? `${details.heightCm || player.heightInCm} cm` : null },
        { label:"Debut", value:details.debutYear || player.debutYear || null }, { label:"Recruited from", value:details.recruitedFrom || player.recruitedFrom || null },
      ].filter(item => item.value),
      seasonStats:metricRows(official.seasonAverages, [["matchesPlayed","Matches"],["disposals","Disposals avg"],["goals","Goals avg"],["tackles","Tackles avg"],["totalClearances","Clearances avg"],["marks","Marks avg"]]),
      careerStats:metricRows(official.careerTotals || career.careerTotals, [["matchesPlayed","Matches"],["disposals","Disposals"],["goals","Goals"],["tackles","Tackles"],["totalClearances","Clearances"],["marks","Marks"]]),
      recentFive:(recent.roundStats || []).slice(0, 5).map(row => ({
        label:row.roundName || row.roundAbbreviation, opponent:row.opponent?.teamName || null, result:row.result || null,
        stats:metricRows(row.stats, [["disposals","D"],["goals","G"],["tackles","T"],["totalClearances","C"]]),
      })),
      selection:rank ? { topTen:true, rank, basis:isAflw ? "The 25 · 2026 preseason" : "2026 AFLCA final leaderboard", sourceUrl:isAflw ? AFLW_TOP_URL : AFLCA_URL, value:isAflw ? null : selectedPlayers[rank - 1][1] } : { topTen:false },
      sourceLinks:Array.from(new Map([
        [sourceUrl, { label:gws ? "Official GWS biography" : "Official AFL profile", url:sourceUrl }],
        [rank ? (isAflw ? AFLW_TOP_URL : AFLCA_URL) : "", rank ? { label:"Top 10 selection source", url:isAflw ? AFLW_TOP_URL : AFLCA_URL } : null],
      ].filter(([url, value]) => url && value)).values()),
      sourceCheckedAt:checkedAt,
    };
  });
}

function parseF1DataGrid(html){
  const rows = [];
  const expression = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g;
  for (const match of html.matchAll(expression)) rows.push({ label:stripHtml(match[1]), value:stripHtml(match[2]) });
  return rows.filter(row => row.label && row.value);
}

function firstPortrait(html){
  const match = html.match(/https:\/\/media\.formula1\.com\/image\/upload\/[^"'\\< ]+\/common\/f1\/2026\/[^"'\\< ]+\.webp/i)
    || html.match(/https:\/\/media\.formula1\.com\/image\/upload\/[^"'\\< ]+\.webp/i);
  return match ? decodeHtml(match[0]) : null;
}

function f1Biography(name, team, facts){
  const values = new Map(facts.map(item => [item.label.toLowerCase(), item.value]));
  const birth = [values.get("date of birth"), values.get("place of birth")].filter(Boolean).join(" in ");
  const career = [values.get("grand prix races") ? `${values.get("grand prix races")} Grand Prix starts` : null, values.get("career points") ? `${values.get("career points")} career points` : null, values.get("highest race finish") ? `a best finish of ${values.get("highest race finish")}` : null].filter(Boolean).join(", ");
  return `${name} races for ${team} in the 2026 Formula 1 World Championship.${birth ? ` Born ${birth},` : ""}${career ? ` the official record lists ${career}.` : ""} The profile below separates the current-season championship record from career achievements and recent results.`;
}

function parseF1Recent(html){
  const rows = [];
  for (const match of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){
    const cells = [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(cell => stripHtml(cell[1]));
    if (cells.length < 5 || /^grand prix$/i.test(cells[0])) continue;
    rows.push({ label:`${cells[0].replace(/^Flag of [^ ]+(?: [^ ]+){0,4} (?=[^ ]+$)/, "")} · ${cells[1]}`, opponent:null, result:`Position ${cells[3]}`, stats:[{ label:"Pts", value:cells[4] }] });
  }
  return rows.slice(-5).reverse();
}

async function buildF1Profiles(context, checkedAt){
  const teams = new Map(context.participants.filter(item => item.type === "team").map(team => [team.displayName.toLowerCase(), team]));
  const existing = new Map(context.participants.filter(item => item.type === "competitor").map(driver => [driver.displayName.toLowerCase(), driver]));
  const topByName = new Map(F1_TOP_TEN.map(([name, points], index) => [name.toLowerCase(), { rank:index + 1, points }]));
  const drivers = await parallel(F1_GRID, async ([name, teamName, number, countryCode]) => {
    const slug = slugify(name);
    const url = `https://www.formula1.com/en/drivers/${slug}`;
    const html = await fetchText(url);
    const facts = parseF1DataGrid(html);
    const participant = existing.get(name.toLowerCase()) || { id:`competitor:f1:${slug}`, type:"competitor", sportDomainId:"sport:motorsport", displayName:name, shortName:name.split(" ").at(-1), canonicalName:name, metadata:{} };
    const team = teams.get(teamName.toLowerCase()) || [...teams.values()].find(item => item.displayName.toLowerCase().startsWith(teamName.toLowerCase()));
    if (!team) throw new Error(`F1 team did not resolve: ${teamName}`);
    const top = topByName.get(name.toLowerCase());
    const resultsHref = html.match(new RegExp(`href="([^"]*/results/2026/drivers/[A-Z0-9]+/${slug})"`, "i"))?.[1] || null;
    const recentFive = top && resultsHref ? parseF1Recent(await fetchText(new URL(resultsHref, "https://www.formula1.com").href)) : [];
    return {
      participant:{ ...participant, countryCode, headshotUrl:firstPortrait(html), competitionNumber:number, competitionNumberKind:"racing", competitionNumberSeason:"2026", profileRef:`profile:f1:${slug}`, currentTeamId:team.id, metadata:{ ...(participant.metadata || {}), active:true, teamParticipantId:team.id } },
      profile:top ? {
        schemaVersion:"athlete-profile.v1", id:`profile:f1:${slug}`, participantId:participant.id, sportKey:"f1", displayName:name,
        currentTeamId:team.id, teamName, headshotUrl:firstPortrait(html), competitionNumber:number, competitionNumberKind:"racing", competitionNumberSeason:"2026",
        biography:f1Biography(name, teamName, facts), keyFacts:facts.filter(row => ["date of birth","place of birth","team","country"].includes(row.label.toLowerCase())).slice(0, 6),
        seasonStats:facts.filter(row => /^season |^race /i.test(row.label)).slice(0, 8), careerStats:facts.filter(row => /career|grand prix|highest|podium|championship/i.test(row.label)).slice(0, 8),
        recentFive, selection:{ topTen:true, rank:top.rank, basis:"Official 2026 Drivers' Standings", sourceUrl:F1_STANDINGS_URL, value:top.points },
        sourceLinks:[{ label:"Official F1 driver profile", url }, { label:"Official F1 standings", url:F1_STANDINGS_URL }], sourceCheckedAt:checkedAt,
      } : null,
    };
  }, 5);
  const byId = new Map(context.participants.filter(item => item.type === "team").map(item => [item.id, item]));
  drivers.forEach(({ participant }) => byId.set(participant.id, participant));
  context.participants = [...byId.values()];
  const snapshot = context.ladderSnapshots.find(item => item.id === "ladder:f1:drivers:2026") || context.ladderSnapshots[0];
  if (snapshot){
    const old = new Map((snapshot.entries || []).map(entry => [entry.participantId, entry]));
    snapshot.entries = F1_TOP_TEN.map(([name, points], index) => {
      const driver = drivers.find(row => row.participant.displayName === name).participant;
      return { ...(old.get(driver.id) || {}), participantId:driver.id, teamParticipantId:driver.currentTeamId, rank:index + 1, points };
    }).concat((snapshot.entries || []).filter(entry => !F1_TOP_TEN.some(([name]) => drivers.find(row => row.participant.id === entry.participantId)?.participant.displayName === name)));
    snapshot.snapshotTimeUtc = checkedAt;
    snapshot.sourceUrl = F1_STANDINGS_URL;
  }
  context.generatedAt = checkedAt;
  return { context, profiles:drivers.map(row => row.profile).filter(Boolean) };
}

function writeIfChanged(filePath, content){
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (previous === content) return false;
  if (CHECK_ONLY) throw new Error(`${path.relative(ROOT, filePath)} is stale; run node scripts/refresh-athlete-profiles.js`);
  fs.mkdirSync(path.dirname(filePath), { recursive:true }); fs.writeFileSync(filePath, content); return true;
}

function writeChunk(sportKey, profiles, checkedAt){
  const payload = { schemaVersion:"athlete-profile-chunk.v1", sportKey, generatedAt:checkedAt, profiles };
  let changed = writeIfChanged(path.join(OUTPUT_DIR, `${sportKey}.v1.json`), `${JSON.stringify(payload, null, 2)}\n`);
  changed = writeIfChanged(path.join(OUTPUT_DIR, `${sportKey}.v1.js`), `globalThis.NOTHINGSPORTS_ATHLETE_PROFILE_CHUNKS = globalThis.NOTHINGSPORTS_ATHLETE_PROFILE_CHUNKS || {};\nglobalThis.NOTHINGSPORTS_ATHLETE_PROFILE_CHUNKS[${JSON.stringify(sportKey)}] = ${JSON.stringify(payload)};\n`) || changed;
  return changed;
}

function validateExistingSnapshot(){
  const manifest = readJson("data/athlete-profiles/manifest.v1.json");
  if (manifest.schemaVersion !== "athlete-profile-manifest.v1" || manifest.profileCount !== 61) throw new Error("Existing athlete profile manifest is invalid");
  const expected = new Map([["afl", 10], ["aflw", 41], ["f1", 10]]);
  for (const sport of manifest.sports || []){
    const chunk = readJson(sport.jsonUrl);
    if (chunk.schemaVersion !== "athlete-profile-chunk.v1" || chunk.profiles.length !== expected.get(sport.key)) throw new Error(`Existing ${sport.key} athlete profiles are incomplete`);
  }
  return manifest;
}

async function main(){
  if (CHECK_ONLY){
    const manifest = readJson("data/athlete-profiles/manifest.v1.json");
    for (const sport of manifest.sports){
      const chunk = readJson(sport.jsonUrl);
      if (chunk.profiles.length !== sport.profileCount) throw new Error(`${sport.key} profile count is stale`);
    }
    console.log(`Checked ${manifest.profileCount} athlete profiles.`); return;
  }
  const checkedAt = new Date().toISOString();
  const afl = readJson("data/canonical/afl-directory.v1.json");
  const aflw = readJson("data/canonical/aflw-directory.v1.json");
  const f1Context = readJson("data/canonical/f1-context-2026.json");
  const gwsUrls = parseGwsProfileUrls();
  if (gwsUrls.size !== 31) throw new Error(`Expected 31 active GWS biography URLs, found ${gwsUrls.size}`);
  let aflProfiles, aflwProfiles, f1;
  try{
    const token = await mintAflToken();
    [aflProfiles, aflwProfiles, f1] = await Promise.all([
      buildAflProfiles("afl", afl, AFL_TOP_TEN, checkedAt, token, gwsUrls),
      buildAflProfiles("aflw", aflw, AFLW_TOP_TEN, checkedAt, token, gwsUrls),
      buildF1Profiles(f1Context, checkedAt),
    ]);
  }catch(error){
    const manifest = validateExistingSnapshot();
    console.warn(`Athlete profile sources unavailable; preserving ${manifest.profileCount} validated profiles: ${error.message}`);
    return;
  }
  if (aflProfiles.length !== 10 || aflwProfiles.length < 31 || f1.profiles.length !== 10) throw new Error("Athlete profile completeness invariant failed");
  let changed = writeChunk("afl", aflProfiles, checkedAt);
  changed = writeChunk("aflw", aflwProfiles, checkedAt) || changed;
  changed = writeChunk("f1", f1.profiles, checkedAt) || changed;
  const sports = [["afl", aflProfiles], ["aflw", aflwProfiles], ["f1", f1.profiles]].map(([key, profiles]) => ({
    key, profileCount:profiles.length, jsonUrl:`data/athlete-profiles/${key}.v1.json`, scriptUrl:`data/athlete-profiles/${key}.v1.js`, profileIds:profiles.map(profile => profile.id),
  }));
  const manifest = { schemaVersion:"athlete-profile-manifest.v1", generatedAt:checkedAt, profileCount:sports.reduce((sum, sport) => sum + sport.profileCount, 0), sports };
  changed = writeIfChanged(path.join(OUTPUT_DIR, "manifest.v1.json"), `${JSON.stringify(manifest, null, 2)}\n`) || changed;
  changed = writeIfChanged(path.join(OUTPUT_DIR, "manifest.v1.js"), `globalThis.NOTHINGSPORTS_ATHLETE_PROFILE_MANIFEST = ${JSON.stringify(manifest)};\n`) || changed;
  changed = writeIfChanged(path.join(ROOT, "data/canonical/f1-context-2026.json"), `${JSON.stringify(f1.context, null, 2)}\n`) || changed;
  console.log(`${changed ? "Refreshed" : "Unchanged"} ${manifest.profileCount} athlete profiles: AFL ${aflProfiles.length}, AFLW ${aflwProfiles.length}, F1 ${f1.profiles.length}.`);
}

main().catch(error => { console.error(error.stack || error.message); process.exit(1); });
