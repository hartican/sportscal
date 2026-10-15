'use strict';
// Public inputs already used by Feed. This lookup grants no Follow or Feed
// membership and is loaded only for a missing/incomplete highlights fixture.
const contract=require('../config/fixture-highlights');
let cached;
function fixtures(){
  return cached||(cached=[...require('./calendar-catalogue').catalogue(),...require('../data/follow-fixtures.v1.json').events]);
}
const statusReceipt=event=>Date.parse(event?.statusFactObservedAt||event?.statusCheckedAt||'');
function disposition(fallback,current,liveRows,now){
  if(!fallback||!contract.completed(fallback)||!contract.recent(fallback,now))return 'ineligible';
  const publishedAt=Date.parse(fallback.statusFactObservedAt||fallback.statusCheckedAt||fallback.resultSourceCheckedAt||fallback.sourceCheckedAt||fallback.canonicalSourceCheckedAt||'');
  for(const row of liveRows){
    if(!row.status||contract.completed(row))continue;
    const observed=statusReceipt(row);
    // Collection checked_at/sourceCheckedAt alone cannot reopen a retained
    // final. A genuinely newer per-fixture status fact requires reconciliation.
    if(Number.isFinite(observed)&&(!Number.isFinite(publishedAt)||observed>publishedAt))return 'newer-status-conflict';
    if(!Number.isFinite(observed)&&/^(cancelled|canceled|abandoned|postponed|rescheduled)$/i.test(row.status))return 'unconfirmed-status-conflict';
  }
  return current?'terminal-continuity':'published-only';
}
module.exports={fixtures,disposition};
