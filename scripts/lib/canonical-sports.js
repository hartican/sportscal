const fs = require("node:fs");

function loadCanonicalBundle(filePath){
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createCanonicalSportsIndex(bundle){
  if (!bundle || bundle.schemaVersion !== "canonical-sports.v1"){
    throw new Error("Expected a canonical-sports.v1 bundle");
  }
  const domainsById = new Map(bundle.sportDomains.map(item => [item.id, item]));
  const competitionsById = new Map(bundle.competitions.map(item => [item.id, item]));
  const participantsById = new Map(bundle.participants.map(item => [item.id, item]));
  const eventsById = new Map(bundle.events.map(item => [item.id, item]));
  const laddersByCompetitionId = new Map();
  bundle.ladderSnapshots.forEach(snapshot => {
    const list = laddersByCompetitionId.get(snapshot.competitionId) || [];
    list.push(snapshot);
    laddersByCompetitionId.set(snapshot.competitionId, list);
  });
  laddersByCompetitionId.forEach(list => list.sort((a, b) => Date.parse(b.snapshotTimeUtc) - Date.parse(a.snapshotTimeUtc)));

  function getFixtures({ competitionId, sportDomainId, participantId, status } = {}){
    return bundle.events.filter(event => {
      if (competitionId && event.competitionId !== competitionId) return false;
      if (sportDomainId && event.sportDomainId !== sportDomainId) return false;
      if (participantId && !event.participantIds.includes(participantId)) return false;
      if (status && event.status !== status) return false;
      return true;
    });
  }

  function getLatestLadder(competitionId){
    return laddersByCompetitionId.get(competitionId)?.[0] || null;
  }

  return Object.freeze({
    bundle,
    domainsById,
    competitionsById,
    participantsById,
    eventsById,
    getFixtures,
    getLatestLadder,
  });
}

module.exports = { loadCanonicalBundle, createCanonicalSportsIndex };
