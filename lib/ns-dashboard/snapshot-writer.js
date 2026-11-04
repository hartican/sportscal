"use strict";
const { validateEnvelope, MAX_SNAPSHOT } = require('../../scripts/ns-dashboard/hosted-contract');
const { bytesHash } = require('./access');
const { latest } = require('./handler');

// Offline-testable publication ordering. No production adapter is installed by this module.
// Adapter contract: an expiring, fenced single-writer lease; immutable put; exact readback;
// and one durable transaction that checks BOTH lease fence and expected pointer revision.
// commit() must supply the database's publication timestamp and retain the previous pointer.
async function publishSnapshot(snapshot, store, { expectedCurrentSHA } = {}) {
  if (expectedCurrentSHA !== null && !/^[a-f0-9]{64}$/.test(expectedCurrentSHA || "")) throw new Error("dashboard_expected_generation_required");
  if (store?.protocol !== 'ns-dashboard-fenced-publication.v1') throw new Error('dashboard_writer_unavailable');
  if (!Buffer.isBuffer(snapshot.bytes) || snapshot.bytes.length>MAX_SNAPSHOT || bytesHash(snapshot.bytes)!==snapshot.sha256) throw new Error('dashboard_snapshot_invalid');
  const envelope=validateEnvelope(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(snapshot.bytes)));
  const lease=await store.acquire();
  if (!lease) throw new Error('dashboard_refresh_busy');
  try {
    const prior=await store.readPointer(lease);
    if (!prior || typeof prior.revision !== 'string') throw new Error('dashboard_pointer_invalid');
    const pointer=prior.pointer == null ? null : latest(prior.pointer);
    if ((pointer?.sha256 || null) !== expectedCurrentSHA) throw new Error('dashboard_source_generation_conflict');
    if (pointer?.sha256===snapshot.sha256) return {published:false,unchanged:true,pointer};
    const key='snapshots/'+snapshot.sha256+'.json';
    await store.putImmutable(lease,key,snapshot.bytes);
    const stored=await store.readImmutable(lease,key);
    if (!Buffer.isBuffer(stored) || !stored.equals(snapshot.bytes)) throw new Error('dashboard_snapshot_readback_failed');
    // No pointer is advanced by the orchestrator before a verified complete object exists.
    const committed=await store.commit(lease,{expectedRevision:prior.revision,sha256:snapshot.sha256,preparedAt:envelope.preparedAt,previous:pointer ? {sha256:pointer.sha256,publishedAt:pointer.publishedAt} : null});
    if (!committed) throw new Error('dashboard_publication_conflict');
    const accepted=latest(committed);
    if (accepted.sha256!==snapshot.sha256 || Date.parse(accepted.publishedAt)<Date.parse(envelope.preparedAt)) throw new Error('dashboard_publication_invalid');
    return {published:true,unchanged:false,pointer:accepted};
  } finally {
    // An expired lease must be released conditionally by its fence, never by a global unlock.
    await store.release(lease);
  }
}
module.exports={publishSnapshot};
