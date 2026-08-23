#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const identities = require("../config/card-identities.js");

const canonical = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-2026.json", "utf8"));
const f1Context = JSON.parse(fs.readFileSync("data/canonical/f1-context-2026.json", "utf8"));
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

assert.equal(identities.schemaVersion, "card-identities.v2");
assert.equal(activeNrlTeams.length, 17, "the current NRL competition must expose 17 active teams");
activeNrlTeams.forEach(team => {
  const mark = identities.participantMarks[team.id];
  assert(mark, `missing NRL team identity for ${team.id}`);
  assert.match(mark.url, /^https:\/\/www\.nrl\.com\/\.theme\/.+\/badge(?:-light)?\.svg$/);
  assert.equal(mark.provenance, "official-site");
  ["primary", "light", "dark", "icon", "iconLight", "iconDark"].forEach(asset => assert.match(mark.logo?.[asset] || "", /^https:\/\//, `${team.id} must expose the ${asset} logo asset`));
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
assert.equal(identities.markForEvent({ key: "cricket", name: "Australia v Bangladesh — First Test", sourceUrl: "https://www.cricket.com.au/" })?.label, "Cricket Australia", "Australian bilateral cricket cards must use Cricket Australia's organisation mark");
assert.equal(identities.markForEvent({ key: "cricket", name: "ICC Men's T20 World Cup — Australia v Bangladesh" })?.label, "International Cricket Council", "ICC-branded cricket cards must use the ICC organisation mark");
assert.equal(identities.markForEvent({ key: "rugby", name: "Australia v Ireland" })?.label, "Rugby Australia", "rugby cards must use the Rugby Australia competition logo");
assert.match(identities.markForEvent({ key: "rugby", name: "Australia v Ireland" })?.url || "", /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//, "rugby cards must use a visible Rugby Australia vector mark");
const formulaOneMark = identities.markForEvent({ key: "f1", name: "British Grand Prix" });
assert.equal(formulaOneMark?.label, "Formula One", "Formula One cards must carry the official competition mark");
assert.match(formulaOneMark?.url || "", /^https:\/\/media\.formula1\.com\/image\/upload\/.*\/f1_logo\.svg$/, "Formula One cards must use Formula One's official SVG wordmark");
assert.equal(formulaOneMark?.logo?.backgroundLight, "dark", "the white Formula One wordmark needs a contrast-safe light-theme surface");
assert.equal(formulaOneMark?.logo?.backgroundDark, "dark", "the white Formula One wordmark needs a contrast-safe dark-theme surface");
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
activeEventKeys.forEach(key => {
  const mark = identities.markForEvent({ key, name: "Coverage check" });
  assert(mark, `missing a card identity for active ${key} coverage`);
  assert(["official-reference", "open-use"].includes(mark.assetClass), `${key} must use a vetted official or open-use competition mark`);
  assert(mark.url || mark.glyph, `${key} must provide a high-quality image or vector mark`);
});

const exampleEvent = { key: "nrl", participantIds: ["team:nrl:322", "team:nrl:324"] };
const resolved = identities.participantMarksForEvent(exampleEvent, activeNrlTeams, "Broncos v Storm");
assert.deepEqual(resolved.map(item => item.participant.shortName), ["BB", "MS"]);
assert.deepEqual(resolved.map(item => identities.aliasRange("Broncos v Storm", item.participant)?.text), ["Broncos", "Storm"]);

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

console.log(`Card identities valid: ${activeNrlTeams.length} NRL and ${activeAflTeams.length} AFL team marks, ${activeEventKeys.length} active sport/event identities, and named Grand Slam/Cincinnati event branding.`);
