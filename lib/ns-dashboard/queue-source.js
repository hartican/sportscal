"use strict";

// Public repository metadata only. Importing this module never collects or schedules work.
const { boundedBody } = require('./transport');
const URL_BASE = 'https://api.github.com/repos/hartican/sportscal/pulls?state=open&per_page=100&page=';
const invalid = () => new Error('dashboard_queue_incomplete');
function validPrevious(p) {
  return p && Object.keys(p).every(k=>['schemaVersion','complete','observedAt','checkedAt','open','drafts','nonMainBases','etag','unchanged'].includes(k)) && Number.isFinite(Date.parse(p.checkedAt)) && Date.parse(p.checkedAt)>=Date.parse(p.observedAt) && p?.schemaVersion === 'ns-dashboard-public-queue.v1' && p.complete === true &&
    Number.isFinite(Date.parse(p.observedAt)) &&
    ['open','drafts','nonMainBases'].every(k => Number.isSafeInteger(p[k]) && p[k] >= 0) &&
    p.drafts <= p.open && p.nonMainBases <= p.open && p.open <= 100;
}
async function collectQueue({ fetchImpl = globalThis.fetch, now = () => new Date().toISOString(), previous = null, timeoutMs = 5000 } = {}) {
  const controller = new AbortController(); let reject;
  const deadline = new Promise((_, fail) => { reject = fail; }); deadline.catch(() => {});
  const timer = setTimeout(() => { controller.abort(); reject(new Error('dashboard_queue_timeout')); }, Math.max(1, Math.min(timeoutMs,5000)));
  const rows = new Map(); let etag = null;
  // One response is the observation boundary. Refuse larger queues rather than join mutable pages.
  // A page-one ETag does not validate later pages. Conditional reuse is safe only for a single-page result.
  const conditional = validPrevious(previous) && previous.open < 100 && typeof previous.etag === 'string' && /^"[A-Za-z0-9_-]{1,100}"$/.test(previous.etag);
  try {
    for (let page = 1; page <= 1; page++) {
      const response = await Promise.race([fetchImpl(URL_BASE + page, { headers: { Accept:'application/vnd.github+json', 'User-Agent':'NothingSport-Private-Dashboard', 'X-GitHub-Api-Version':'2022-11-28', ...(page === 1 && conditional ? {'If-None-Match':previous.etag} : {}) }, cache:'no-store', redirect:'error', signal:controller.signal }), deadline]);
      if (response.status === 304) {
        if (page !== 1 || !conditional) throw invalid();
        return { ...previous, checkedAt:now(), unchanged:true };
      }
      if (!response.ok) { await response.body?.cancel(); throw invalid(); }
      const bytes = await Promise.race([boundedBody(response,512*1024,controller.signal),deadline]);
      const values = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      if (!Array.isArray(values) || values.length > 100) throw invalid();
      for (const v of values) {
        if (!Number.isSafeInteger(v.id) || v.id < 1 || rows.has(v.id) || v.state !== 'open' || typeof v.draft !== 'boolean' || typeof v.base?.ref !== 'string' || !v.base.ref) throw invalid();
        rows.set(v.id,{draft:v.draft,nonMain:v.base.ref !== 'main'});
      }
      if (page === 1) etag = response.headers.get('etag');
      const hasNext = /rel="next"/.test(response.headers.get('link') || '');
      if (!hasNext) {
        const observedAt = now();
        return {schemaVersion:'ns-dashboard-public-queue.v1',complete:true,observedAt,checkedAt:observedAt,open:rows.size,drafts:[...rows.values()].filter(v=>v.draft).length,nonMainBases:[...rows.values()].filter(v=>v.nonMain).length,etag:page === 1 && /^"[A-Za-z0-9_-]{1,100}"$/.test(etag || '') ? etag : null,unchanged:false};
      }
      if (values.length !== 100 || page === 1) throw invalid();
    }
    throw invalid();
  } finally { clearTimeout(timer); controller.abort(); }
}
module.exports={collectQueue,validPrevious};
