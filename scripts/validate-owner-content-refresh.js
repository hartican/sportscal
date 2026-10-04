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
  rows.push({campaign_id:'legacy-date-only',campaign_revision:1,event_id:'old-date-only',candidate:{material:{displayDate:'2026-09-26'},timing:{endTimeUtc:null}}});
  rows.push({campaign_id:'legacy-source-confirmed',campaign_revision:1,event_id:'event:afl:cd_m20260142801',candidate:{material:{displayDate:''},timing:{endTimeUtc:null}}});
  rows.push({campaign_id:'genuinely-pending',campaign_revision:1,event_id:'unknown-2027',candidate:{material:{displayDate:''},timing:{endTimeUtc:null}}});
  rows.push({campaign_id:'source-moved-later',campaign_revision:1,event_id:'evt_84',candidate:{timing:{endTimeUtc:'2026-09-25T00:00:00Z'}}});
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
  // Freeze the catalogue for this historical as-of. A later real final must
  // not turn the October 2 future-schedule case into a completed fixture.
  const fixturesPath=require.resolve('../lib/competition-fixtures');require(fixturesPath);const originalFixtures=require.cache[fixturesPath];
  require.cache[fixturesPath]={...originalFixtures,exports:{...originalFixtures.exports,fixtures:()=>[
    {id:'event:afl:cd_m20260142801',status:'completed',date:'2026-09-19',sourceCheckedAt:'2026-09-21T00:00:00Z'},
    {id:'retained-future-schedule',sourceEventIds:['evt_84'],status:'upcoming',date:'2026-10-04',startTimeUtc:'2026-10-04T08:30:00Z',sourceCheckedAt:'2026-10-01T00:00:00Z'},
  ]}};
  try{assert.equal(await refresh.purgePast(rows,Date.parse('2026-10-02T00:00:00Z')),3,'Legacy watching entries need current source/date expiry, not a persisted end timestamp');}
  finally{require.cache[fixturesPath]=originalFixtures;}
  const removed = calls.filter(c=>c.options.method==='DELETE');
  assert(!removed.some(c=>c.path.includes('keep-history')||c.path.includes('keep-delivery')));
  assert.deepEqual(removed.find(c=>c.path.includes('/storage/')).options.body.prefixes,['expired.jpg']);
  assert(removed.some(c=>c.path.includes('remove-exclusive')));
  assert(!removed.some(c=>c.path.includes('campaign_id=eq.delivered')));
  assert(!removed.some(c=>c.path.includes('campaign_id=eq.genuinely-pending')));
  assert(!removed.some(c=>c.path.includes('campaign_id=eq.source-moved-later')),'A newer future schedule outranks stale stored expiry');
  console.log('Owner refresh passed: current Heat, safe image fallback, protected delivery/shared history and exclusive media purge.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
