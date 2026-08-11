const fs = require("node:fs");
const path = require("node:path");

const CURRENT_LADDER_SIGNAL = "current-ladder-position";
const RANK_TOKEN = /\{\{(?:home|away)Rank(?:Ordinal)?\}\}/;
const TOKEN = /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g;

function ordinal(value) {
  const number = Number(value);
  const remainder100 = number % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${number}th`;
  if (number % 10 === 1) return `${number}st`;
  if (number % 10 === 2) return `${number}nd`;
  if (number % 10 === 3) return `${number}rd`;
  return `${number}th`;
}

function snapshotTimestamp(snapshot) {
  const value = snapshot?.source?.checkedAt || snapshot?.updatedAt || snapshot?.generatedAt || "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildStandingsIndex(canonicalDir = path.resolve("data/canonical")) {
  const standings = new Map();
  const files = fs.readdirSync(canonicalDir).filter(name => name.endsWith(".json"));

  files.forEach(name => {
    let bundle;
    try {
      bundle = JSON.parse(fs.readFileSync(path.join(canonicalDir, name), "utf8"));
    } catch {
      return;
    }
    if (!Array.isArray(bundle?.ladderSnapshots)) return;

    bundle.ladderSnapshots.forEach(snapshot => {
      if (!snapshot?.competitionId || !Array.isArray(snapshot.entries)) return;
      const existing = standings.get(snapshot.competitionId);
      if (existing && snapshotTimestamp(existing.snapshot) > snapshotTimestamp(snapshot)) return;
      standings.set(snapshot.competitionId, {
        snapshot,
        ranks: new Map(snapshot.entries.map(entry => [entry.participantId, entry.rank])),
      });
    });
  });

  return standings;
}

function hasCurrentLadderSignal(override) {
  return override?.editorialPreview?.contextSignals?.includes(CURRENT_LADDER_SIGNAL) || false;
}

function interpolate(value, tokens) {
  if (Array.isArray(value)) return value.map(item => interpolate(item, tokens));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, tokens)]));
  }
  if (typeof value !== "string") return value;
  return value.replace(TOKEN, (match, token) => {
    if (!Object.hasOwn(tokens, token)) throw new Error(`Unknown editorial preview placeholder ${match}.`);
    return String(tokens[token]);
  });
}

function resolveStandingsAwareOverride(event, override, standingsIndex) {
  if (!hasCurrentLadderSignal(override)) return override;
  if (!RANK_TOKEN.test(JSON.stringify(override))) {
    throw new Error(`${event.id} claims current ladder position but has no dynamic rank placeholder.`);
  }

  const standings = standingsIndex.get(event.competitionId);
  if (!standings) throw new Error(`${event.id} has no ladder snapshot for ${event.competitionId}.`);
  const homeRank = standings.ranks.get(event.homeParticipantId);
  const awayRank = standings.ranks.get(event.awayParticipantId);
  if (!Number.isInteger(homeRank) || !Number.isInteger(awayRank)) {
    throw new Error(`${event.id} cannot resolve both participants in ${standings.snapshot.id}.`);
  }

  return interpolate(override, {
    homeRank,
    awayRank,
    homeRankOrdinal: ordinal(homeRank),
    awayRankOrdinal: ordinal(awayRank),
    ladderSourceCheckedAt: standings.snapshot.source?.checkedAt || standings.snapshot.updatedAt,
  });
}

module.exports = {
  buildStandingsIndex,
  hasCurrentLadderSignal,
  ordinal,
  resolveStandingsAwareOverride,
};
