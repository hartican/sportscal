'use strict';

// One withdrawal identity contract for canonical result and reminder consumers.
// No generic racing/name match: motorsport and pommel horse remain unrelated.
const taxonomy = new Set([
  'horse-racing', 'sport:horse-racing',
  'discipline:horse-racing:thoroughbred', 'discipline:horse-racing:harness',
  'competition:australian-thoroughbred', 'event-series:melbourne-cup-carnival',
  'event-series:the-everest',
]);
const taxonomyFields = [
  'key', 'sportKey', 'sportId', 'taxonomySportId', 'sportDomainId',
  'discoverySportId', 'codeId', 'taxonomyNodeId', 'disciplineId',
  'competitionId', 'eventSeriesId',
];
const parentFields = ['parentEventId', 'parentId', 'majorEventId', 'tournamentId'];
const recordObject = record => record !== null && typeof record === 'object' && !Array.isArray(record);
const identityString = value => typeof value === 'string' && value.length > 0;

function identities(record) {
  return [...new Set([
    record.id, record.eventId, record.canonicalId, record.canonicalEventId,
    record.sourceIds?.legacy,
    ...(Array.isArray(record.sourceEventIds) ? record.sourceEventIds : []),
    ...(Array.isArray(record.legacyEventIds) ? record.legacyEventIds : []),
  ].filter(identityString))];
}
function parents(record) {
  return parentFields.map(field => record[field]).filter(identityString);
}
function horseNamespace(value) {
  // Recognition only. Never normalise arbitrary IDs used for graph equality.
  return identityString(value) && /^(?:event|evt|overview)-horse-racing(?:-|$)/
    .test(value.toLowerCase().replace(/[:_]+/g, '-'));
}
function horseMetadata(record) {
  if (record.horseFeature === true || record.score?.racing?.kind === 'horse') return true;
  if (typeof record.sport === 'string') {
    const sport = record.sport.trim().toLowerCase().replace(/[\s_]+/g, '-');
    if (sport === 'horse-racing' || sport === 'sport:horse-racing') return true;
  }
  return taxonomyFields.some(field => taxonomy.has(record[field]));
}

function createRetirementIndex(records) {
  if (!Array.isArray(records)) throw new TypeError('Retirement index requires an array of records');
  const retired = new Set();
  const edges = new Map();
  const link = (from, to) => {
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from).add(to);
  };
  for (const record of records) {
    if (!recordObject(record)) continue;
    const ids = identities(record);
    const parentIds = parents(record);
    const namespaces = [...ids, ...parentIds].filter(horseNamespace);
    for (const id of namespaces) retired.add(id);
    if (horseMetadata(record) || namespaces.length) {
      for (const id of ids) retired.add(id);
    }
    // Aliases denote this same record, whereas a parent is not its child.
    for (const id of ids.slice(1)) {
      link(ids[0], id);
      link(id, ids[0]);
    }
    for (const parent of parentIds) {
      for (const id of ids) link(parent, id);
    }
  }
  // Compute closure before consumers filter their catalogues. The retained
  // closed set still rejects opaque aliases in missing-fixture fallbacks.
  const pending = [...retired];
  for (let index = 0; index < pending.length; index++) {
    for (const id of edges.get(pending[index]) || []) {
      if (!retired.has(id)) {
        retired.add(id);
        pending.push(id);
      }
    }
  }
  function isRetired(record) {
    if (!recordObject(record)) return false;
    if (horseMetadata(record)) return true;
    return [...identities(record), ...parents(record)]
      .some(id => horseNamespace(id) || retired.has(id));
  }
  // No source mutation, IO, clock, account data, or mutable registry escapes.
  // Consumers adapt saved event_id/fixtureId to {id} without another matcher.
  return Object.freeze({isRetired});
}

module.exports = {createRetirementIndex};
