'use strict';

// Server-side comparison only. Not a live source, refresh command or publisher.
const {setTimeout: pause} = require('node:timers/promises');
const registry = require('../../config/football-data-identities.json');
const SCOPE = {
  PL: {id: 2021, competitionId: 'competition:premier-league-2026-27', fixtures: 380, clubs: 20, rounds: 38, stage: 'REGULAR_SEASON'},
  CL: {id: 2001, competitionId: 'competition:uefa-champions-league', fixtures: 144, clubs: 36, rounds: 8, stage: 'LEAGUE_STAGE'},
};
const ATTRIBUTION = 'Football data provided by the Football-Data.org API';
const STATUSES = new Set(['SCHEDULED','TIMED','IN_PLAY','PAUSED','EXTRA_TIME','PENALTY_SHOOTOUT','FINISHED','SUSPENDED','POSTPONED','CANCELLED','AWARDED']);
function reject(message) { throw new Error(`Football-data trial rejected: ${message}`); }
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || !Number.isFinite(Date.parse(value))) reject('invalid explicit UTC timestamp');
  const result = new Date(value).toISOString();
  if (result.slice(0,19) !== value.slice(0,19)) reject('invalid calendar date');
  return result;
}
function team(value) {
  const record = registry.teams[String(value?.id)];
  if (!Number.isSafeInteger(value?.id) || !record || record.sourceName !== value.name) reject('unreviewed club identity');
  return record.participantId;
}
function fixtureKey(f) { return `${f.homeParticipantId}|${f.awayParticipantId}|${f.roundNumber}`; }
function normalizeMatches(payload, {code, checkedAt}) {
  const scope = SCOPE[code];
  if (!scope || payload?.competition?.code !== code || payload.competition.id !== scope.id || payload.filters?.season !== 2026) reject('competition or season changed');
  checkedAt = utc(checkedAt);
  if (!Array.isArray(payload.matches) || payload.matches.length !== scope.fixtures || payload.resultSet?.count !== scope.fixtures) reject('incomplete fixture collection');
  const ids = new Set(), keys = new Set(), clubs = new Map(), rounds = new Map(), opponents = new Map();
  const fixtures = payload.matches.map(m => {
    if (!Number.isSafeInteger(m.id) || m.id <= 0 || ids.has(m.id)) reject('invalid or duplicated fixture identity');
    ids.add(m.id);
    if (m.competition?.id !== scope.id || !m.season?.startDate?.startsWith('2026-') || m.stage !== scope.stage) reject('unreviewed stage or season');
    if (!Number.isSafeInteger(m.matchday) || m.matchday < 1 || m.matchday > scope.rounds || !STATUSES.has(m.status)) reject('invalid round or status');
    const startTimeUtc = utc(m.utcDate), sourceUpdatedAt = utc(m.lastUpdated);
    if(Date.parse(sourceUpdatedAt)>Date.parse(checkedAt)+120000)reject('future provider observation');
    if (startTimeUtc < (code === 'PL' ? '2026-08-01' : '2026-09-01') || startTimeUtc >= (code === 'PL' ? '2027-07-01' : '2027-02-01')) reject('kickoff outside reviewed season');
    const homeParticipantId = team(m.homeTeam), awayParticipantId = team(m.awayTeam);
    if (homeParticipantId === awayParticipantId) reject('club plays itself');
    let result = null;
    if (m.status === 'FINISHED') {
      const score = m.score?.fullTime;
      if (!Number.isSafeInteger(score?.home) || !Number.isSafeInteger(score?.away) || score.home < 0 || score.away < 0 || Date.parse(startTimeUtc) > Date.parse(checkedAt)) reject('invalid final result');
      result = {homeScore: score.home, awayScore: score.away};
    }
    const fixture = {providerFixtureId: String(m.id), homeParticipantId, awayParticipantId, roundNumber: m.matchday, startTimeUtc,
      timePrecision: m.status === 'SCHEDULED' ? 'date-only' : 'exact', status: m.status === 'FINISHED' ? 'completed' : m.status === 'TIMED' && Date.parse(startTimeUtc) > Date.parse(checkedAt) ? 'upcoming' : 'unknown',
      providerStatus: m.status, sourceUpdatedAt, result};
    const key = fixtureKey(fixture);
    if (keys.has(key)) reject('duplicate participant pairing in one round');
    keys.add(key); rounds.set(m.matchday, (rounds.get(m.matchday) || 0) + 1);
    for (const [id, home, opponent] of [[homeParticipantId,true,awayParticipantId],[awayParticipantId,false,homeParticipantId]]) {
      const c = clubs.get(id) || {total: 0, home: 0, rounds: new Set()};
      if (c.rounds.has(m.matchday)) reject('club appears twice in one round');
      c.total++; c.home += Number(home); c.rounds.add(m.matchday); clubs.set(id,c);
      const o = opponents.get(id) || new Map(); o.set(opponent,(o.get(opponent)||0)+1); opponents.set(id,o);
    }
    return fixture;
  });
  const games = code === 'PL' ? 38 : 8, homeGames = games/2;
  if (clubs.size !== scope.clubs || rounds.size !== scope.rounds || [...rounds.values()].some(n=>n!==scope.clubs/2) || [...clubs.values()].some(c=>c.total!==games || c.home!==homeGames)) reject('incomplete club/round structure');
  if ([...opponents.values()].some(o=>o.size!==(code==='PL'?19:8)||[...o.values()].some(n=>n!==(code==='PL'?2:1)))) reject('incorrect opponents');
  return {competitionId: scope.competitionId, season: '2026/27', scope: code==='PL'?'full-league-season':'league-phase', checkedAt, sourceType:'third-party-delayed', attribution: ATTRIBUTION, fixtures};
}
function normalizeStandings(payload, {code}) {
  const scope = SCOPE[code];
  if (!scope || payload?.competition?.id !== scope.id || !payload.season?.startDate?.startsWith('2026-')) reject('standings competition/season changed');
  const tables = payload.standings?.filter(t=>t.type==='TOTAL' && t.stage===scope.stage);
  if (tables?.length!==1 || tables[0].table.length!==scope.clubs) reject('incomplete standings');
  const fields = ['position','playedGames','won','draw','lost','points','goalsFor','goalsAgainst','goalDifference'];
  const rows = tables[0].table.map(row=>{
    if(fields.some(f=>!Number.isSafeInteger(row[f])) || ['playedGames','won','draw','lost','goalsFor','goalsAgainst'].some(f=>row[f]<0) || row.position<1 || row.position>scope.clubs || row.won+row.draw+row.lost!==row.playedGames || row.goalsFor-row.goalsAgainst!==row.goalDifference) reject('invalid standing statistics');
    return {participantId:team(row.team), rank:row.position, played:row.playedGames, won:row.won, drawn:row.draw, lost:row.lost,
      ladderPoints:row.points, pointsFor:row.goalsFor, pointsAgainst:row.goalsAgainst, pointsDifference:row.goalDifference};
  });
  if (new Set(rows.map(r=>r.participantId)).size!==scope.clubs || new Set(rows.map(r=>r.rank)).size!==scope.clubs) reject('duplicated standing identity or rank');
  return rows;
}
function compareFixtures(reference, candidate) {
  const byKey = new Map(candidate.map(f=>[fixtureKey(f),f]));
  if (byKey.size!==candidate.length || new Set(reference.map(f=>fixtureKey(f))).size!==reference.length) reject('ambiguous fixture reconciliation');
  const missing=[], differences=[], candidateOnly=[], results={bothCompleted:0, matching:0, referenceOnly:0, candidateOnly:0};
  let matched=0, exactKickoffs=0;
  const knownKeys = new Set();
  for (const known of reference) {
    const key=fixtureKey(known);knownKeys.add(key);const next=byKey.get(key);
    if(!next){missing.push({key,referenceId:known.providerFixtureId});continue;}
    matched++;
    if(Date.parse(known.startTimeUtc)===Date.parse(next.startTimeUtc)) exactKickoffs++;
    else differences.push({key,kind:'kickoff',reference:known.startTimeUtc,candidate:next.startTimeUtc});
    if(known.result&&next.result){
      results.bothCompleted++;
      if(known.result.homeScore===next.result.homeScore&&known.result.awayScore===next.result.awayScore)results.matching++;
      else differences.push({key,kind:'result',reference:known.result,candidate:next.result});
    }else if(known.result)results.referenceOnly++;
    else if(next.result)results.candidateOnly++;
  }
  for(const f of candidate)if(!knownKeys.has(fixtureKey(f)))candidateOnly.push({key:fixtureKey(f),candidateId:f.providerFixtureId});
  return {referenceCount:reference.length,candidateCount:candidate.length,matched,exactKickoffs,results,missing,candidateOnly,differences};
}
function createClient({token, fetchImpl=fetch, intervalMs=6500, timeoutMs=15000, wait=pause, now=Date.now}={}) {
  if(typeof token!=='string'||!/^[a-f0-9]{32}$/.test(token))reject('server credential missing');
  let lastStarted=null, queue=Promise.resolve();
  return function request(code,resource) {
    if(!SCOPE[code]||!['matches','standings'].includes(resource))return Promise.reject(new Error('Unreviewed API resource'));
    const work=queue.then(async()=>{
      if(lastStarted!==null)await wait(Math.max(0,intervalMs-(now()-lastStarted)));
      lastStarted=now();
      const url=`https://api.football-data.org/v4/competitions/${code}/${resource}?season=2026`;
      try {
        const response=await fetchImpl(url,{headers:{Accept:'application/json','X-Auth-Token':token},redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
        // No automatic retry: a 429 stops this observation instead of amplifying load.
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const raw=await response.text();
        if(Buffer.byteLength(raw)>2_000_000)throw new Error('Response exceeds trial budget');
        return {url,httpStatus:response.status,checkedAt:new Date(now()).toISOString(),payload:JSON.parse(raw)};
      }catch(error){throw new Error(/^HTTP \d{3}$/.test(error.message)?`Football-data request failed (${error.message})`:'Football-data request failed; response and credential withheld');}
    });
    queue=work.catch(()=>{});return work;
  };
}
async function trialRecovery({loadPrimary,loadBackup,lastGood,now=Date.now()}) {
  try { return {mode:'primary',snapshot:await loadPrimary()}; } catch {}
  try {
    const backup=await loadBackup();
    const age=now-Date.parse(backup.checkedAt);
    if(!Number.isFinite(age)||age< -120_000||age>30*60*60*1000 || backup.competitionId!==lastGood.competitionId || backup.season!==lastGood.season)reject('stale or different-scope backup');
    const comparison=compareFixtures(lastGood.fixtures,backup.fixtures);
    // This initial trial recovers availability only. A changed fact requires
    // the ordinary primary refresh/reconciliation rather than silent promotion.
    if(comparison.matched!==lastGood.fixtures.length||comparison.matched!==backup.fixtures.length||comparison.exactKickoffs!==comparison.matched||comparison.differences.length||comparison.results.referenceOnly||comparison.results.candidateOnly)reject('backup disagrees with last-good facts');
    const known=new Map(lastGood.fixtures.map(f=>[fixtureKey(f),f]));
    return {mode:'backup',snapshot:{...backup,fixtures:backup.fixtures.map(f=>({...f,backupProviderFixtureId:f.providerFixtureId,providerFixtureId:known.get(fixtureKey(f)).providerFixtureId}))}};
  } catch { return {mode:'last-good',snapshot:lastGood}; }
}
module.exports={SCOPE,ATTRIBUTION,normalizeMatches,normalizeStandings,compareFixtures,createClient,fixtureKey,trialRecovery};
