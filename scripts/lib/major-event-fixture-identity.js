"use strict";

function normalizeIdentity(value){
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sideIdentity(side){
  const players = Array.isArray(side?.players) ? side.players : [];
  const playerKeys = players
    .map(player => normalizeIdentity(player?.name || player?.id))
    .filter(Boolean)
    .sort();
  if (playerKeys.length) return playerKeys.join("+");
  return normalizeIdentity(side?.name || side?.id);
}

function fixtureIdentityKey(fixture){
  const sides = (Array.isArray(fixture?.matchupSides) ? fixture.matchupSides : [])
    .map(sideIdentity)
    .filter(Boolean)
    .sort();
  if (sides.length !== 2) return null;
  const date = String(
    fixture?.date
      || fixture?.startTimeUtc
      || fixture?.sessionStartTimeUtc
      || ""
  ).slice(0, 10);
  if (!date) return null;
  return `${date}::${sides.join("|")}`;
}

function mergedViewingOptions(existing, incoming){
  const options = [...(existing || []), ...(incoming || [])];
  const seen = new Set();
  return options.filter(option => {
    const key = `${option?.providerId || ""}::${option?.eventUrl || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeDuplicateFixture(existing, incoming){
  const merged = { ...incoming, ...existing };
  for (const field of ["startTimeUtc", "sessionStartTimeUtc", "scoreDisplay", "result", "summary"]){
    if ((merged[field] === null || merged[field] === undefined || merged[field] === "") && incoming[field]){
      merged[field] = incoming[field];
    }
  }
  merged.stakesScore = Math.max(Number(existing?.stakesScore) || 0, Number(incoming?.stakesScore) || 0) || undefined;
  merged.previewPriority = Math.max(Number(existing?.previewPriority) || 0, Number(incoming?.previewPriority) || 0) || undefined;
  if (existing?.marquee === true || incoming?.marquee === true) merged.marquee = true;
  const viewingOptions = mergedViewingOptions(existing?.viewingOptions, incoming?.viewingOptions);
  if (viewingOptions.length) merged.viewingOptions = viewingOptions;
  return merged;
}

function deduplicateFixtures(fixtures){
  const output = [];
  const indexByKey = new Map();
  for (const fixture of fixtures || []){
    const identity = fixtureIdentityKey(fixture);
    const key = identity ? `match:${identity}` : `id:${fixture?.id || output.length}`;
    if (!indexByKey.has(key)){
      indexByKey.set(key, output.length);
      output.push(fixture);
      continue;
    }
    const index = indexByKey.get(key);
    output[index] = mergeDuplicateFixture(output[index], fixture);
  }
  return output;
}

module.exports = {
  deduplicateFixtures,
  fixtureIdentityKey,
  mergeDuplicateFixture,
  normalizeIdentity,
  sideIdentity,
};
