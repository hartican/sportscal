#!/usr/bin/env node
'use strict';
// Isolated service mock: no production authentication, storage or database writes.
const assert = require('node:assert/strict');
const artifact = require('../data/marquee-candidates.v1.json');
const servicePath = require.resolve('../lib/supabase-server');
let handle;
require.cache[servicePath] = {id: servicePath, filename: servicePath, loaded: true,
  exports: {supabaseServiceRequest: (...args) => handle(...args)}};
const refresh = require('../lib/comms-refresh');
async function main() {
  const reference = artifact.candidates.find(c => c.proposedSendAt && c.material.rating.source === 'editorial');
  handle = async path => path.includes('/rpc/nothingsports_comms_heat')
    ? [{event_id: reference.eventId, mean: 4.91, count: 7}]
    : [];
  const prepared = await refresh.prepare({now: Date.parse(artifact.generatedAt)});
  const rated = prepared.candidates.find(c => c.campaignId === reference.campaignId);
  assert(rated);
  assert.equal(rated.material.rating.source, 'community');
  assert.equal(rated.material.rating.animationPreset, 'energy');
  assert.notEqual(rated.assets.fallbackHero.publicUrl, reference.assets.fallbackHero.publicUrl,
    'Changed community stakes must not export an image bearing stale editorial stakes');
  const rows = ['expired', 'delivered', 'active'].map((id, i) => ({campaign_id:id,
    campaign_revision:1,candidate:{timing:{endTimeUtc:i===2?'2027-01-01T00:00:00Z':'2026-01-01T00:00:00Z'}}}));
  const assets = [
    {asset_id:'keep-history',campaign_id:'expired',public_urls:{portrait:'https://example.test/shared'}},
    {asset_id:'keep-delivery',campaign_id:'delivered',original_path:'delivery.jpg'},
    {asset_id:'remove-exclusive',campaign_id:'expired',original_path:'expired.jpg'},
  ];
  const calls = [];
  handle = async (path, options={}) => {
    calls.push({path, options});
    if(options.method==='DELETE') return [{campaign_id:'expired'}];
    if(path.includes('marquee_deliveries')) return [{campaign_id:'delivered'}];
    if(path.includes('comms_assets')) return assets;
    if(path.includes('campaign_versions')) return [{snapshot:{image:'keep-history'}}];
    throw Error('Unexpected request: '+path);
  };
  assert.equal(await refresh.purgePast(rows,Date.parse('2026-10-02T00:00:00Z')),1);
  const removed = calls.filter(c=>c.options.method==='DELETE');
  assert(!removed.some(c=>c.path.includes('keep-history')||c.path.includes('keep-delivery')));
  assert.deepEqual(removed.find(c=>c.path.includes('/storage/')).options.body.prefixes,['expired.jpg']);
  assert(removed.some(c=>c.path.includes('remove-exclusive')));
  assert(!removed.some(c=>c.path.includes('campaign_id=eq.delivered')));
  console.log('Owner refresh passed: current Heat, safe image fallback, protected delivery/shared history and exclusive media purge.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
