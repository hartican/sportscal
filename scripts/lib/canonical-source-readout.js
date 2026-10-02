'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const exec = promisify(execFile);
const REPO = 'hartican/sportscal';
const WORKFLOW = 'canonical-card-refresh.yml';
const ARTIFACT = 'tournament-hydration-report';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_AGE_HOURS = 36;

function safe(value) {
  return String(value).replace(/[\r\n|]/g, ' ')
    .replace(/https?:\/\/[^\s]+/g, url => url.split(/[?#]/)[0])
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b(?:token|password|api[-_]?key|secret)\s*[:=]\s*\S+/gi, '[redacted]')
    .slice(0, 300);
}
function observation(doc, now) {
  const stamp = Date.parse(doc?.checkedAt);
  if (!Number.isFinite(stamp) || stamp > now.getTime()) throw Error('invalid_report_observation');
  const ageHours = (now.getTime() - stamp) / 3600000;
  return {checkedAt: new Date(stamp).toISOString(), ageHours, stale: ageHours > MAX_AGE_HOURS};
}
function summary({quick = null, hydration = null, football = null, golf = null, now = new Date()} = {}) {
  const result = {maxAgeHours: MAX_AGE_HOURS, quick: {state: 'unavailable'}, hydration: {state: 'unavailable'}, football: {state: 'unavailable'}, golf: {state:'unavailable'}};
  if (quick) {
    try {
      const observed = observation(quick, now);
      if (quick.mode !== 'quick' || !Array.isArray(quick.failures) || quick.failures.length > 500 || quick.failures.some(f => typeof f !== 'string')) throw Error('invalid_quick_report');
      result.quick = {...observed, state: 'observed', failureCount: quick.failures.length, failures: quick.failures.map(safe), aiCalls: Number.isSafeInteger(quick.aiCalls) && quick.aiCalls >= 0 ? quick.aiCalls : null};
    } catch (e) { result.quick.error = safe(e.message); }
  }
  if (hydration) {
    try {
      const observed = observation(hydration, now);
      if (hydration.schemaVersion !== 'tournament-hydration-report.v1' || hydration.offline !== false || !Array.isArray(hydration.tournaments) || hydration.tournaments.length > 500) throw Error('invalid_hydration_report');
      const seen = new Set();
      const tournaments = hydration.tournaments.map(t => {
        if (typeof t.tournamentId !== 'string' || !t.tournamentId || seen.has(t.tournamentId) || !['complete', 'partial'].includes(t.status) || !Array.isArray(t.issues) || t.issues.length > 100 || t.issues.some(i => typeof i !== 'string') || !Number.isSafeInteger(t.fixtureCount) || t.fixtureCount < 0 || (t.status === 'complete' && t.issues.length)) throw Error('invalid_tournament_evidence');
        seen.add(t.tournamentId);
        const format=t.format||'child-fixtures';
        if(!['child-fixtures','tournament-card'].includes(format))throw Error('invalid_tournament_format');
        let detailEvidence;
        if(format==='tournament-card'){
          const d=t.detailEvidence;
          if(!d||!['listedEntries','confirmedEntries','pairingGroups','pairingRounds'].every(k=>Number.isSafeInteger(d[k])&&d[k]>=0)||d.listedEntries>250||d.confirmedEntries>d.listedEntries||d.pairingGroups>1000||d.pairingRounds>5||typeof d.participantsConfirmed!=='boolean'||(d.participationCheckedAt!==null&&(typeof d.participationCheckedAt!=='string'||!Number.isFinite(Date.parse(d.participationCheckedAt))||Date.parse(d.participationCheckedAt)>now.getTime())))throw Error('invalid_golf_detail_evidence');
          detailEvidence={listedEntries:d.listedEntries,confirmedEntries:d.confirmedEntries,pairingGroups:d.pairingGroups,pairingRounds:d.pairingRounds,participantsConfirmed:d.participantsConfirmed,participationCheckedAt:d.participationCheckedAt};
        }
        return {tournamentId: safe(t.tournamentId), name: safe(t.name || t.tournamentId), code: safe(t.code || 'unknown'), format, ...(detailEvidence?{detailEvidence}:{}), fixtureCount: t.fixtureCount, status: t.status, issues: t.issues.map(safe)};
      });
      result.hydration = {...observed, state: 'observed', tournamentCount: tournaments.length, completeCount: tournaments.filter(t => t.status === 'complete').length, partialCount: tournaments.filter(t => t.status === 'partial').length, gaps: tournaments.filter(t => t.status === 'partial')};
    } catch (e) { result.hydration.error = safe(e.message); }
  }
  if(football){try{
    const observed=observation(football,now);
    if(football.schemaVersion!=='football-data-backup-report.v1'||!Array.isArray(football.checks)||football.checks.length>20)throw Error('invalid_football_report');
    result.football={...observed,state:'observed',checks:football.checks.map(row=>({code:safe(row.code||row.mode||'invocation'),state:safe(row.state),newFinals:row.newFinals||0,calls:Number.isSafeInteger(row.calls)?row.calls:null,primaryFailure:row.primaryFailure?safe(row.primaryFailure):null,backupFailure:row.backupFailure?safe(row.backupFailure):null,table:row.table}))};
  }catch(error){result.football.error=safe(error.message);}}
  if(golf){try{
    require('../../lib/golf-source-observations').validate(golf,now);
    const observed=observation(golf,now);
    const exceptions=golf.checks.filter(row=>['failed','unpublished','not-attested'].includes(row.state)||['retained-calendar','not-attested'].includes(row.statusEvidence));
    result.golf={...observed,state:golf.checks.length?'observed':'not-checked',mode:golf.mode,observationCount:golf.checks.length,acceptedCount:golf.checks.filter(row=>row.state==='accepted').length,failureCount:golf.checks.filter(row=>row.state==='failed').length,exceptionCount:exceptions.length,exceptions:exceptions.map(row=>({...row,name:row.name?safe(row.name):null,tournamentId:row.tournamentId?safe(row.tournamentId):null})),resultsPassCount:golf.resultsPasses.length,resultsChecked:golf.resultsPasses.reduce((n,pass)=>n+pass.checked,0)};
  }catch(error){result.golf.error=safe(error.message);}}
  return result;
}
async function gh(args) {
  const {stdout} = await exec('gh', args, {maxBuffer: MAX_BYTES, timeout: 30000});
  return stdout;
}
function readReport(directory, name) {
  const file = path.join(directory, name);
  if (!fs.existsSync(file)) return null;
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.size > MAX_BYTES) throw Error('invalid_report_file');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
async function collect({now = new Date(), read = gh} = {}) {
  const result = {repository: REPO, workflow: WORKFLOW, state: 'unavailable', limitations: ['A successful workflow can retain failed sources. Reports are dated observations, not current fixture accuracy or certification.', 'A missing quick report can be expected for a full refresh; it is not a zero-failure observation.', 'No source refresh, production mutation or scheduler change is performed.']};
  let directory;
  try {
    const runs = JSON.parse(await read(['run', 'list', '--repo', REPO, '--workflow', WORKFLOW, '--limit', '10', '--json', 'databaseId,status,conclusion,createdAt,headSha,url']));
    if (!Array.isArray(runs) || new Set(runs.map(r => r.databaseId)).size !== runs.length || runs.some(r => !Number.isSafeInteger(r.databaseId) || !Number.isFinite(Date.parse(r.createdAt)))) throw Error('invalid_canonical_run_inventory');
    const candidates = runs.filter(r => Date.parse(r.createdAt) <= now.getTime()).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    result.latestRun = candidates[0] || null;
    const run = candidates.find(r => r.status === 'completed');
    if (!run) throw Error('no_completed_canonical_run_in_latest_ten');
    result.run = run;
    const listing = JSON.parse(await read(['api', `repos/${REPO}/actions/runs/${run.databaseId}/artifacts?per_page=100`]));
    if (!Array.isArray(listing?.artifacts) || !Number.isSafeInteger(listing.total_count) || listing.total_count > 100) throw Error('artifact_inventory_unavailable_or_truncated');
    const artifacts = listing.artifacts.filter(a => a.name === ARTIFACT);
    if (artifacts.length !== 1 || artifacts[0].expired || !Number.isSafeInteger(artifacts[0].size_in_bytes) || artifacts[0].size_in_bytes > MAX_BYTES) throw Error('report_artifact_missing_expired_or_oversized');
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-canonical-readout-'));
    await read(['run', 'download', String(run.databaseId), '--repo', REPO, '--name', ARTIFACT, '--dir', directory]);
    result.reports = summary({quick: readReport(directory, 'quick-results-report.json'), hydration: readReport(directory, 'tournament-hydration-report.json'), football: readReport(directory,'football-data-backup-report.json'), golf:readReport(directory,'golf-source-report.json'), now});
    result.state = 'observed';
  } catch (e) { result.error = safe(e.message); }
  finally { if (directory) fs.rmSync(directory, {recursive: true, force: true}); }
  return result;
}
function markdown(result) {
  const heading = '## Canonical source and coverage exceptions\n\n';
  if (!result || result.state !== 'observed') return heading + `Evidence unavailable: ${safe(result?.error || 'not collected')}. Source failures and coverage are unknown.\n`;
  const {quick, hydration} = result.reports;
  const lines = [`Latest completed canonical run: [${result.run.databaseId}](${result.run.url}), workflow ${safe(result.run.conclusion || 'unknown')}.`];
  if (result.latestRun && result.latestRun.databaseId !== result.run.databaseId) lines.push(`A newer run ${result.latestRun.databaseId} is ${safe(result.latestRun.status)}; no completed source report is assumed.`);
  for (const [label, row] of [['Quick source check', quick], ['Tournament hydration', hydration]]) {
    if (row.state !== 'observed') { lines.push(`${label}: unavailable${row.error ? ' (' + row.error + ')' : ''}; not a zero-failure observation.`); continue; }
    lines.push(`${label}: ${row.checkedAt}${row.stale ? ' — STALE, over 36 hours old' : ''}.`);
    if (label === 'Quick source check') {
      lines.push(`Reported source failures: ${row.failureCount}. AI calls in this report: ${row.aiCalls === null ? 'unknown' : row.aiCalls}.`, ...row.failures.slice(0, 10).map(f => '- ' + f));
      if (row.failureCount > 10) lines.push(`${row.failureCount - 10} further failures retained in the JSON readout.`);
    } else {
      lines.push(`Hydration gaps: ${row.partialCount}/${row.tournamentCount}; ${row.completeCount} reported complete. This is adapter coverage, not sport certification.`, ...row.gaps.slice(0, 8).map(t => {
        const d=t.detailEvidence;
        const detail=t.format==='tournament-card'?`one tournament card; retained detail: ${d.confirmedEntries} confirmed / ${d.listedEntries} listed entries, ${d.pairingGroups} tee-time groups across ${d.pairingRounds} rounds; entries ${d.participantsConfirmed?'source-confirmed':'not confirmed'}; participation checked ${d.participationCheckedAt||'unknown'}`:`${t.fixtureCount} child fixtures`;
        return `- ${t.name} (${t.code}), ${detail}: ${t.issues.slice(0, 3).join('; ') || 'partial coverage without an explanation'}${t.issues.length > 3 ? '; further issues in JSON' : ''}.`;
      }));
      if (row.partialCount > 8) lines.push(`${row.partialCount - 8} further tournament gaps retained in the JSON readout.`);
    }
  }
  const football=result.reports.football;
  if(football?.state==='observed'){lines.push(`Delayed Football backup: ${football.checkedAt}${football.stale?' — STALE':''}.`,...football.checks.map(row=>`${row.code}: ${row.state}, ${row.newFinals} new finals${row.calls!==null?'; '+row.calls+' provider requests':''}${row.primaryFailure?'; primary failed: '+row.primaryFailure:''}${row.backupFailure?'; backup: '+row.backupFailure:''}${row.table?.state==='unavailable'?'; table comparison unavailable':''}.`));}
  else lines.push('Delayed Football backup evidence unavailable; not a zero-failure observation.');
  const golf=result.reports.golf;
  if(golf?.state==='observed'){
    lines.push(`Golf source observations: ${golf.checkedAt}${golf.stale?' — STALE, over 36 hours old':''}; ${golf.acceptedCount} accepted resource observations, ${golf.failureCount} failures, ${golf.exceptionCount} exceptions. These counts do not attest whole tournament completeness.`);
    lines.push(`LPGA finals: ${golf.resultsPassCount} bounded pass(es), ${golf.resultsChecked} candidates checked. The quick route reuses an existing pass and its failures in the same invocation.`);
    lines.push(...golf.exceptions.slice(0,8).map(row=>`- ${row.name||row.tournamentId||'Golf calendar'} / ${row.resource}: ${row.state} (${row.code}); source check ${row.checkedAt}; retained facts ${row.retainedFactAt||'not established'}${row.status?'; status '+row.status+' ('+(row.statusEvidence||'not attested')+')':''}${row.sourceUrl?'; [organiser source]('+row.sourceUrl+')':''}.`));
    if(golf.exceptionCount>8)lines.push(`${golf.exceptionCount-8} further Golf exceptions retained in the JSON readout.`);
  }else lines.push(`Golf source evidence ${golf?.state==='not-checked'?'has no attempted resource checks in this invocation':'unavailable'}${golf?.error?' ('+golf.error+')':''}; source health is unknown.`);
  return heading + lines.join('\n\n') + '\n\n' + result.limitations.join(' ') + '\n';
}
module.exports = {summary, collect, markdown, safe};
