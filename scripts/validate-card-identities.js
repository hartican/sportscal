#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const identities = require("../config/card-identities.js");
const html = fs.readFileSync("index.html", "utf8");

const canonical = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-2026.json", "utf8"));
const f1Context = JSON.parse(fs.readFileSync("data/canonical/f1-context-2026.json", "utf8"));
const footballDirectory = JSON.parse(fs.readFileSync("data/canonical/football-directory.v1.json", "utf8"));
const nbaContext = JSON.parse(fs.readFileSync("data/canonical/nba-context-2026.json", "utf8"));
const eventPayload = JSON.parse(fs.readFileSync("data/events.json", "utf8"));
const activeEventKeys = [...new Set((eventPayload.events || eventPayload).map(event => event.key).filter(Boolean))].sort();
const activeNrlTeams = canonical.participants.filter(participant => (
  participant.type === "team"
  && participant.sportDomainId === "sport:nrl"
  && participant.metadata?.active !== false
));
const activeAflTeams = canonical.participants.filter(participant => (
  participant.type === "team"
  && participant.sportDomainId === "sport:afl"
  && participant.teamCode !== "TBD"
));

function pngMetadata(path){
  const source = fs.readFileSync(path);
  assert.equal(source.subarray(1, 4).toString("ascii"), "PNG", `${path} must be a PNG`);
  return {
    width:source.readUInt32BE(16),
    height:source.readUInt32BE(20),
    colorType:source[25],
    hasAlpha:[4, 6].includes(source[25]) || source.includes(Buffer.from("tRNS")),
    sha256:crypto.createHash("sha256").update(source).digest("hex"),
  };
}

assert.equal(identities.schemaVersion, "card-identities.v3");
assert.equal(activeNrlTeams.length, 17, "the current NRL competition must expose 17 active teams");
activeNrlTeams.forEach(team => {
  const mark = identities.participantMarks[team.id];
  assert(mark, `missing NRL team identity for ${team.id}`);
  assert.match(mark.url, /^https:\/\/www\.nrl\.com\/\.theme\/.+\/badge(?:-light)?\.svg$/);
  assert.equal(mark.provenance, "official-site");
  ["primary", "light", "dark", "icon", "iconLight", "iconDark"].forEach(asset => assert.match(mark.logo?.[asset] || "", /^https:\/\//, `${team.id} must expose the ${asset} logo asset`));
  assert.equal(mark.logo?.backgroundLight, "light", `${team.id} must keep its official badge transparent in day mode`);
  assert.equal(mark.logo?.backgroundDark, "light", `${team.id} must keep its official badge transparent in night mode`);
});
for (const participantId of ["team:nrl:328", "team:nrl:331", "team:nrl:337"]){
  assert.match(identities.participantMarks[participantId].logo.dark, /\/badge\.svg$/, `${participantId} must avoid the unavailable NRL badge-light variant`);
  assert.match(identities.participantMarks[participantId].logo.iconDark, /\/badge\.svg$/, `${participantId} icon must avoid the unavailable NRL badge-light variant`);
}
assert.equal(activeAflTeams.length, 18, "the current AFL competition must expose 18 active clubs");
activeAflTeams.forEach(team => {
  const mark = identities.participantMarks[team.id];
  assert(mark, `missing AFL team identity for ${team.id}`);
  assert.match(mark.url, /^\/assets\/teams\/afl\/[a-z]+\.svg$/, `${team.id} must use a transparent local AFL crest`);
  assert.equal(mark.provenance, "official-site");
  assert.equal(mark.sourceUrl, "https://www.afl.com.au/resources/v5.52.26/i/svg-output/icons.svg");
  ["primary", "light", "dark", "icon", "iconLight", "iconDark"].forEach(asset => {
    const path = mark.logo?.[asset] || "";
    assert.match(path, /^\/assets\/teams\/afl\/[a-z]+(?:-light)?\.svg$/, `${team.id} must expose the ${asset} crest asset`);
    assert(fs.existsSync(`.${path}`), `${team.id} must provide ${asset} as a committed local asset`);
    const source = fs.readFileSync(`.${path}`, "utf8");
    assert.match(source, /<svg\b[^>]*\bviewBox=/, `${team.id} ${asset} must retain the AFL vector viewBox`);
    assert.doesNotMatch(source, /<rect\b/i, `${team.id} ${asset} must not contain a rectangular logo background`);
  });
});

assert.equal(identities.markForEvent({ key: "nrl", name: "Broncos v Storm" })?.label, "NRL", "NRL cards must use the competition logo");
assert.equal(identities.markForEvent({ key: "wimbledon", name: "Roland Garros — Men's Final" })?.label, "Roland Garros", "named marquee branding must override the generic tennis identity");
assert.equal(identities.markForEvent({ key: "wimbledon", name: "Wimbledon — Men's Final" })?.label, "Wimbledon", "Wimbledon cards must retain their own event brand");
assert.equal(identities.markForEvent({ key: "tennis", name: "Cincinnati Open" })?.label, "Cincinnati Open", "Cincinnati cards must use the named tournament brand");
assert.equal(identities.markForEvent({ key: "tennis", name: "US Open 2026" })?.label, "US Open", "US Open cards must use the named tournament brand");
assert.equal(identities.markForEvent({ key: "tennis", name: "Australian Open 2027" })?.label, "Australian Open", "Australian Open cards must use the named tournament brand");
assert.equal(identities.markForEvent({ key: "tennis", competitionId: "competition:tennis:us-open:2026", name: "Roger Federer v Andy Roddick" })?.label, "US Open", "US Open child fixtures must inherit their tournament logo without repeating the tournament name");
assert.equal(identities.markForEvent({ key: "tennis", competitionId: "competition:tennis:australian-open:2027", name: "Player A v Player B" })?.label, "Australian Open", "Australian Open child fixtures must inherit their tournament logo");
assert.equal(identities.markForEvent({ key: "afl", competitionId: "competition:afl:premiership:2026", name: "Final" })?.label, "AFL", "AFL finals children must retain the competition logo");
assert.equal(identities.markForEvent({ key: "nrl", brandId: "nrl-finals-series", name: "2026 NRL Finals Series" })?.url, identities.markForEvent({ key: "nrl", name: "NRL" })?.url, "the NRL Finals card must render a real NRL image logo rather than a trophy placeholder");
assert.equal(identities.markForEvent({ key: "cricket", name: "Australia v Bangladesh — First Test", sourceUrl: "https://www.cricket.com.au/" })?.label, "Cricket Australia", "Australian bilateral cricket cards must use Cricket Australia's organisation mark");
assert.equal(identities.markForEvent({ key: "cricket", name: "ICC Men's T20 World Cup — Australia v Bangladesh" })?.label, "International Cricket Council", "ICC-branded cricket cards must use the ICC organisation mark");
assert.equal(identities.markForEvent({ key: "rugby", name: "Australia v Ireland" })?.label, "Rugby Australia", "rugby cards must use the Rugby Australia competition logo");
assert.match(identities.markForEvent({ key: "rugby", name: "Australia v Ireland" })?.url || "", /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//, "rugby cards must use a visible Rugby Australia vector mark");
const formulaOneMark = identities.markForEvent({ key: "f1", name: "British Grand Prix" });
assert.equal(formulaOneMark?.label, "Formula One", "Formula One cards must retain an editorial competition identity");
assert.equal(formulaOneMark?.url, "assets/identities/f1/formula-one-red-512.png", "Formula One cards must use the supplied local red mark");
assert.equal(formulaOneMark?.provenance, "user-supplied-reference");
assert.equal(formulaOneMark?.assetSource, "project-owner-supplied");
assert.match(formulaOneMark?.sourceUrl || "", /^https:\/\/www\.formula1\.com\/en\/information\/guidelines\./);
assert.equal(formulaOneMark?.logo.light, formulaOneMark?.logo.primary, "day mode must use the red primary Formula One mark");
assert.equal(formulaOneMark?.logo.dark, formulaOneMark?.logo.primary, "night mode must use the same red Formula One mark");
assert.equal(formulaOneMark?.logo.iconLight, "assets/identities/f1/formula-one-red-256.png");
assert.equal(formulaOneMark?.logo.iconDark, "assets/identities/f1/formula-one-red-256.png");
assert.equal(formulaOneMark?.logo.backgroundLight, "light");
assert.equal(formulaOneMark?.logo.backgroundDark, "light");
const f1Master = pngMetadata("assets/identities/f1/formula-one-red-master.png");
const f1Primary = pngMetadata(formulaOneMark.logo.primary);
const f1Compact = pngMetadata(formulaOneMark.logo.icon);
assert.deepEqual([f1Master.width, f1Master.height, f1Master.hasAlpha], [2000, 500, true]);
assert.equal(f1Master.sha256, "a036826b72e31ed81a3c8040e6f457a05a1532c66c4096e141e6d9836bde797e", "the committed master must remain byte-identical to the supplied file");
assert.deepEqual([f1Primary.width, f1Primary.height, f1Primary.hasAlpha], [512, 128, true]);
assert.deepEqual([f1Compact.width, f1Compact.height, f1Compact.hasAlpha], [256, 64, true]);
assert.match(html, /const logoContext = container\.matches\("\.event-hero-mark,\.major-event-logo"\) \? "primary" : "icon";/, "hero and compact contexts must request the correct local F1 size");
assert.doesNotMatch(html, /\[data-card-identity="competition:formula-one"\][^{]*\{[^}]*background:#092e4f/, "the red Formula One mark must not retain the old dark backing tile");
const activeF1Teams = f1Context.participants.filter(participant => participant.type === "team" && participant.sportDomainId === "sport:motorsport" && participant.metadata?.active !== false);
assert.equal(activeF1Teams.length, 11, "the 2026 Formula One grid must include all 11 constructor teams");
activeF1Teams.forEach(team => {
  const mark = identities.participantMarks[team.id];
  assert(mark, `missing Formula One team identity for ${team.id}`);
  assert.match(mark.url, /^https:\/\/media\.formula1\.com\/image\/upload\/.*\/common\/f1\/202(?:5|6)\/.*\.webp$/, `${team.id} must use Formula One's transparent official team mark`);
  assert.equal(mark.provenance, "official-site");
  ["primary", "light", "dark", "icon", "iconLight", "iconDark"].forEach(asset => assert.match(mark.logo?.[asset] || "", /^https:\/\/media\.formula1\.com\//, `${team.id} must expose the ${asset} Formula One logo asset`));
  assert.equal(mark.logo?.backgroundLight, "dark", `${team.id} must use a contrast-safe day surface for Formula One's white logo`);
});
assert.match(identities.markForEvent({ key: "cricket", name: "ICC Men's T20 World Cup — Australia v Bangladesh" })?.url || "", /^https:\/\/images\.icc-cricket\.com\/image\/private\/t_q-best\/.*\/icc-white-logo\.svg$/, "ICC cards must use ICC's official high-quality SVG mark");
assert.match(identities.markForEvent({ key: "cricket", name: "Australia v Bangladesh — First Test", sourceUrl: "https://www.cricket.com.au/" })?.url || "", /^https:\/\/resources\.cricket-australia\.pulselive\.com\/.*\/CricketAustraliaLogoWhiteWide\.svg$/, "Australian bilateral cards must use Cricket Australia's official SVG mark");
const premierLeagueMarks = Object.values(identities.participantMarks).filter(mark => mark.id.startsWith("team:football:epl:"));
assert.equal(premierLeagueMarks.length, 20, "the Premier League registry must cover all current clubs");
premierLeagueMarks.forEach(mark => {
  assert.match(mark.url, /^assets\/identities\/epl\/\d+\.svg$/, `${mark.label} must use a local production copy of its Premier League SVG badge`);
  assert.match(mark.assetSourceUrl, /^https:\/\/resources\.premierleague\.com\/premierleague25\/badges\/\d+\.svg$/, `${mark.label} must retain the current Premier League first-party SVG provenance`);
  const svg = fs.readFileSync(mark.url, "utf8");
  assert.match(svg, /<svg\b/, `${mark.label} must retain a valid SVG asset`);
  assert.doesNotMatch(svg, /<script\b/i, `${mark.label} SVG must not contain scripts`);
  assert.equal(mark.provenance, "official-site");
});
const footballParticipants = footballDirectory.teams.map(team => ({
  ...team,
  canonicalName:team.displayName,
  shortName:team.shortName || team.displayName,
  metadata:{ titleAliases:team.aliases || [team.displayName] },
}));
assert.equal(footballParticipants.length, 96, "all five active football leagues must remain available to the identity resolver");
footballParticipants.forEach(team => {
  const resolved = identities.participantMarksForEvent({ key:footballDirectory.leagues.find(league => league.id === team.leagueId)?.key, participantIds:[team.id] }, footballParticipants, team.displayName);
  assert.equal(resolved.length, 1, `missing directory crest for ${team.displayName}`);
  const expectedCrest = identities.participantMarks[team.id]?.url || team.crestUrl;
  assert.equal(resolved[0].mark.url, expectedCrest, `${team.displayName} must prefer its first-party local crest, then preserve its directory crest URL`);
});
const footballFixtureEvents = ["bundesliga", "la-liga", "serie-a", "ligue-1"]
  .flatMap(leagueKey => JSON.parse(fs.readFileSync(`data/football/fixtures/${leagueKey}.json`, "utf8")).events || []);
footballFixtureEvents.forEach(event => {
  const sides = identities.matchupSidesForEvent(event, footballParticipants, event.name);
  assert.equal(sides.length, 2, `${event.id} must expose two ordered football sides`);
  assert(sides.every(side => side.mark?.url), `${event.id} must resolve both directory crests`);
});
const nbaTeams = nbaContext.participants.filter(participant => participant.type === "team");
assert.equal(nbaTeams.length, 30, "the NBA identity registry must cover all current clubs");
nbaTeams.forEach(team => {
  const mark = identities.participantMarks[team.id];
  assert(mark, `missing NBA club identity for ${team.displayName}`);
  assert.match(mark.url || "", /^https:\/\/cdn\.nba\.com\/logos\/nba\/\d+\/global\/L\/logo\.svg$/, `${team.displayName} must use the NBA's first-party SVG mark`);
  assert.equal(mark.provenance, "official-site");
});
for (const [competitionId, label] of [
  ["competition:bundesliga", "Bundesliga"], ["competition:la-liga", "LALIGA"], ["competition:serie-a", "Serie A"],
  ["competition:ligue-1", "Ligue 1"], ["competition:uefa-champions-league", "UEFA Champions League"],
]){
  assert.equal(identities.markForCompetitionId(competitionId)?.label, label, `${competitionId} must resolve its competition identity`);
}
assert.equal(identities.markForEvent({ key:"football", competitionId:"competition:uefa-champions-league", name:"UEFA Champions League Final" })?.label, "UEFA Champions League", "Champions League fixtures must not fall back to the generic football icon");
activeEventKeys.forEach(key => {
  const mark = identities.markForEvent({ key, name: "Coverage check" });
  assert(mark, `missing a card identity for active ${key} coverage`);
  assert(["official-reference", "open-use"].includes(mark.assetClass), `${key} must use a vetted official or open-use competition mark`);
  assert(mark.url || mark.glyph || mark.wordmark, `${key} must provide a high-quality image, vector or editorial wordmark`);
});

const exampleEvent = { key: "nrl", participantIds: ["team:nrl:322", "team:nrl:324"] };
const resolved = identities.participantMarksForEvent(exampleEvent, activeNrlTeams, "Broncos v Storm");
assert.deepEqual(resolved.map(item => item.participant.shortName), ["BB", "MS"]);
assert.deepEqual(resolved.map(item => identities.aliasRange("Broncos v Storm", item.participant)?.text), ["Broncos", "Storm"]);
assert.deepEqual(identities.matchupSidesForEvent(exampleEvent, activeNrlTeams, "Broncos v Storm").map(side => side.label), ["Broncos", "Storm"]);
const savedAflFixtureTitle = "Wildcard Final - Western Bulldogs v Collingwood";
const savedAflFixtureSides = identities.matchupSidesForEvent({ key:"afl", name:savedAflFixtureTitle }, [], savedAflFixtureTitle);
assert.deepEqual(
  savedAflFixtureSides.map(side => side.mark?.id || null),
  ["participant:team:afl:cd_t140", "participant:team:afl:cd_t40"],
  "saved AFL fixtures without participant IDs must resolve both club crests on their first render",
);
assert.equal(identities.matchupSidesForEvent({ key:"football" }, [], "Team A v Team B").length, 2, "a team matchup with no marks must still expose two ordered placeholder slots");
assert.equal(identities.matchupSidesForEvent({ key:"football" }, [footballParticipants[0]], `${footballParticipants[0].displayName} v Unknown XI`).length, 2, "a one-crest matchup must retain the opposing placeholder slot");
assert.equal(identities.matchupSidesForEvent({ key:"tennis" }, [], "Player A v Player B").length, 0, "individual tennis fixtures must not be converted into team-logo cards");
(eventPayload.events || eventPayload).filter(event => identities.isTeamSportMatchup(event, event.name)).forEach(event => {
  assert.equal(identities.matchupSidesForEvent(event, [...activeNrlTeams, ...activeAflTeams, ...footballParticipants], event.name).length, 2, `${event.id || event.name} must render exactly two ordered matchup slots`);
});

const cricketResolved = identities.participantMarksForEvent({ key: "cricket" }, [], "Australia v Bangladesh — First Test");
assert.deepEqual(cricketResolved.map(item => identities.aliasRange("Australia v Bangladesh — First Test", item.participant)?.text), ["Australia", "Bangladesh"]);
assert.equal(cricketResolved[0].mark.label, "Cricket Australia");
assert.equal(cricketResolved[1].mark.label, "Bangladesh Cricket Board");
assert.match(cricketResolved[0].mark.url, /^https:\/\/vignette\.wikia\.nocookie\.net\/logopedia\/images\/a\/af\/1280px-Australia_cricket_logo\.svg\.png\//, "Australia must use the national team coat-of-arms crest rather than a Cricket Australia wordmark");
assert.match(cricketResolved[1].mark.url, /^https:\/\/www\.tigercricket\.com\.bd\/public\/images\/2016\/12\/cropped-Bangladesh-Cricket-Team-LogoW-1-192x192\.png$/, "Bangladesh must use the official men's tiger crest rather than the board animation");
assert.notEqual(cricketResolved[0].mark.url, cricketResolved[1].mark.url, "Australia and Bangladesh must retain clearly distinct team identities");

const rugbyCases = [
  ["Australia v Ireland", ["Wallabies", "Ireland"]],
  ["Australia v France", ["Wallabies", "France"]],
  ["Australia v Italy", ["Wallabies", "Italy"]],
  ["Japan v Australia", ["Japan", "Wallabies"]],
  ["South Africa v All Blacks", ["Springboks", "All Blacks"]],
  ["Argentina v Australia", ["Argentina", "Wallabies"]],
  ["England v Australia", ["England", "Wallabies"]],
  ["Scotland v Australia", ["Scotland", "Wallabies"]],
  ["Wales v Australia", ["Wales", "Wallabies"]],
  ["ACT Brumbies v NSW Waratahs", ["ACT Brumbies", "NSW Waratahs"]],
  ["Queensland Reds v Western Force", ["Queensland Reds", "Western Force"]],
  ["Fijian Drua v Moana Pasifika", ["Fijian Drua", "Moana Pasifika"]],
  ["Blues v Chiefs", ["Blues", "Chiefs"]],
  ["Crusaders v Highlanders", ["Crusaders", "Highlanders"]],
  ["Hurricanes v ACT Brumbies", ["Hurricanes", "ACT Brumbies"]],
];
rugbyCases.forEach(([title, labels]) => {
  const resolved = identities.participantMarksForEvent({ key: "rugby" }, [], title);
  const labelsInTitleOrder = resolved
    .map(item => ({ label: item.mark.label, start: identities.aliasRange(title, item.participant)?.start ?? Infinity }))
    .sort((left, right) => left.start - right.start)
    .map(item => item.label);
  assert.deepEqual(labelsInTitleOrder, labels, `rugby identities must resolve ${title}`);
});
for (const [key, title, labels] of [
  ["fifa", "Australia v Türkiye - Group D", ["Australia", "Türkiye"]],
  ["fifa", "Morocco v Belgium - Quarterfinal", ["Morocco", "Belgium"]],
  ["nrl", "Australia v Cook Islands — Rugby League World Cup", ["Australia", "Cook Islands"]],
  ["cwg", "Netball — Australia v Malawi 🇦🇺", ["Australia", "Malawi"]],
]){
  const sides = identities.matchupSidesForEvent({ key }, [], title);
  assert.deepEqual(sides.map(side => side.mark?.label), labels, `${title} must resolve two national flag identities`);
  assert(sides.every(side => side.mark?.countryCode), `${title} must retain a country-backed fallback`);
}
const rugbyMarks = Object.values(identities.participantMarks).filter(mark => mark.id.startsWith("team:rugby:"));
assert.equal(rugbyMarks.length, 22, "the rugby registry must cover current internationals and all Super Rugby Pacific clubs");
rugbyMarks.forEach(mark => {
  assert.match(mark.url, /^https:\/\/(?:d26phqdbpt0w91\.cloudfront\.net|images\.allblacks\.com|super\.rugby)\//, `rugby mark must have a vetted official asset: ${mark.label}`);
  assert.equal(mark.provenance, "official-site");
  ["primary", "light", "dark", "icon", "iconLight", "iconDark"].forEach(asset => assert.match(mark.logo?.[asset] || "", /^https:\/\//, `${mark.label} must expose the ${asset} logo asset`));
});
const nrlBroncos = identities.participantMarks["team:nrl:322"];
assert.notEqual(identities.logoForTheme(nrlBroncos, { context: "primary", useDark: false }), identities.logoForTheme(nrlBroncos, { context: "primary", useDark: true }), "NRL primary logos must use the league's official light and dark assets");
assert.equal(identities.logoForTheme(identities.participantMarks["team:football:epl:1"], { context: "icon", useDark: false }), identities.participantMarks["team:football:epl:1"].logo.iconLight, "small-format contexts must select an explicit icon asset rather than resize the primary reference");
assert(html.includes('appendTeamIdentityFallback(slot, mark, label') && html.includes('logo.hidden = true'), "each matchup side must paint a placeholder before its crest downloads");
assert(html.includes('logo.addEventListener("load"') && html.includes('logo.hidden = false'), "a successful crest must replace only its own placeholder");
assert(/logo\.addEventListener\("error", \(\) => \{\s*logo\.remove\(\);/.test(html), "a failed crest must leave the other side and its own placeholder intact");
assert(!html.includes('mark?.label || "?"'), "recognised teams must never display a generic question-mark placeholder");
assert(html.includes('mark?.label || "TBC"'), "unresolved finals participants need a semantic seed/monogram fallback");

console.log(`Card identities valid: ${activeNrlTeams.length} NRL, ${activeAflTeams.length} AFL, ${nbaTeams.length} NBA and ${footballParticipants.length} football team marks across ${footballFixtureEvents.length} fixtures, national flags, ${activeEventKeys.length} active sport/event identities, and two-slot matchup fallbacks.`);
