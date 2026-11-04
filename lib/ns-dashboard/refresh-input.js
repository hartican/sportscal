"use strict";
const { validateEnvelope, serialize } = require('../../scripts/ns-dashboard/hosted-contract');
const { validPrevious } = require('./queue-source');

// Offline preparation, not a writer or scheduler. The caller must still perform lease-fenced atomic publication.
function prepareQueueRefresh(current, queue, preparedAt) {
  validateEnvelope(current);
  if (!validPrevious(queue) || Date.parse(queue.checkedAt) > Date.parse(preparedAt) || Date.parse(queue.observedAt) > Date.parse(queue.checkedAt) || !Number.isFinite(Date.parse(preparedAt))) throw new Error('dashboard_queue_invalid');
  const p=structuredClone(current.projection);
  if (Date.parse(preparedAt)<Date.parse(p.generatedAt)) throw new Error('dashboard_refresh_clock_invalid');
  p.generatedAt=preparedAt;
  // A new queue check must never renew production proof, lifecycle history or owner decisions.
  for (const scope of p.release.verificationScopes) if (scope.state==='fresh' && Date.parse(scope.latestObservation.expiresAt)<=Date.parse(preparedAt)) scope.state='stale';
  if (p.release.verifiedLive && Date.parse(p.release.verifiedLive.expiresAt)<=Date.parse(preparedAt)) p.release.verifiedLive=null;
  if (!p.briefing) p.briefing={source:'Public repository queue check',observedAt:preparedAt,complete:false,published:[],work:[],decisions:[],decisionHistory:[]};
  p.briefing.source='Public repository queue check and retained briefing: '+p.briefing.source;
  p.briefing.observedAt=preparedAt; p.briefing.complete=false;
  p.briefing.work=p.briefing.work.filter(x=>x.id!=='public-code-requests');
  const checked = new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(Date.parse(queue.observedAt));
  p.briefing.work.push({id:'public-code-requests',title:'Work waiting for review',state:'waiting',reason:`The saved queue check found ${queue.open} open requests to change app code, including ${queue.drafts} still marked as drafts. These can include older or overlapping work. Checked ${checked}. Other information keeps its earlier dates.`,owner:'release team',nextAction:'Review and check changes before putting them into the app. This count does not establish that a change is ready or that it has reached users.',prNumbers:[]});
  return serialize(p,preparedAt);
}
module.exports={prepareQueueRefresh};
