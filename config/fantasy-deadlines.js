(function(root,factory){const api=factory(root.NOTHINGSPORTS_FANTASY_PREFERENCES||(typeof require==='function'?require('./fantasy-preferences'):null));root.NOTHINGSPORTS_FANTASY_DEADLINES=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:window,function(preferences){
  'use strict';
  const SCHEMA_VERSION='fantasy-deadlines.v1';
  const GAMES=Object.freeze([{providerId:'premier-league',gameId:'fpl-classic',label:'Fantasy Premier League',shortLabel:'FPL',competitionId:'competition:premier-league',sourceId:'live-fantasy-fpl',rulesUrl:'https://fantasy.premierleague.com/help/rules',rulesVerifiedAt:'2026-10-02',help:'The initial team submission deadline applies to the whole gameweek. No fantasy account connection is needed.'}]);
  const COMPETITIONS=Object.freeze([['premier-league','Premier League'],['bundesliga','Bundesliga'],['la-liga','La Liga'],['serie-a','Serie A'],['ligue-1','Ligue 1'],['champions-league','Champions League'],['fifa-world-cup','FIFA World Cup']].map(([id,label])=>({id:'competition:'+id,label})));
  function competitionKey(value){const id=String(value||'');return COMPETITIONS.find(c=>id===c.id||new RegExp('^'+c.id+'-\\d{4}(?:-\\d{2,4})?$').test(id))?.id||null;}
  const {normalizePreferences,migratePreferences,onboardingChoice,hydratePreferences}=preferences;
  function soccer(event){return event?.sportDomainId==='sport:football'||event?.codeId==='sport:football'||['football','premier-league','fifa','champions-league'].includes(event?.key);}
  function format(ms){if(!Number.isFinite(ms)||ms<=0)return null;if(ms<60000)return '<1m';const total=Math.floor(ms/60000),d=Math.floor(total/1440),h=Math.floor(total%1440/60),m=total%60;return d?`${d}d ${h}h ${m}m`:h?`${h}h ${m}m`:`${m}m`;}
  function ageLimit(deadline,now){return deadline-now<=6*3600000?10*60000:60*60000;}
  function select(event,prefs,sources,now=Date.now()){
    const settings=normalizePreferences(prefs),key=competitionKey(event?.competitionId),game=settings.gameByCompetition[key];
    if(!settings.enabled||!soccer(event)||!key||!game||['cancelled','canceled','abandoned','postponed','unpublished','completed','finished','past'].includes(String(event?.scheduleStatus||'').toLowerCase())||['completed','finished','past','cancelled','abandoned','postponed'].includes(String(event?.status||'').toLowerCase()))return null;
    const entries=(event.fantasyDeadlines||[]).filter(r=>r.gameId===game&&competitionKey(r.competitionId)===key);
    if(entries.length!==1)return null;const record=entries[0],definition=GAMES.find(g=>g.gameId===game&&g.providerId===record.providerId),source=sources?.[record.sourceId];
    const deadline=Date.parse(record.deadlineAt),verified=Date.parse(source?.checkedAt);
    if(!definition||record.schemaVersion!==SCHEMA_VERSION||record.sourceId!==definition.sourceId||source?.enabled!==true||record.mappingStatus!=='verified'||!record.fantasyRoundId||!record.seasonId||record.action!=='initial-team-submission'||!['whole-team','initial-with-between-day-changes'].includes(record.lockoutType)||!Number.isFinite(deadline)||deadline<=now||!Number.isFinite(verified)||verified>now+60000||now-verified>=ageLimit(deadline,now))return null;
    // Schedule divergence invalidates the mapping, even after an identity was pinned.
    if(record.fixtureStartAt!==event.startTimeUtc&&Date.parse(record.fixtureStartAt)!==Date.parse(event.startTimeUtc))return null;
    if(record.homeParticipantId!==event.homeParticipantId||record.awayParticipantId!==event.awayParticipantId)return null;
    return {...record,definition,deadline,verified};
  }
  function interval(records,now=Date.now()){const next=Math.min(...records.flatMap(e=>(e.fantasyDeadlines||[]).map(r=>Date.parse(r.deadlineAt))).filter(t=>t>now));return next-now<=6*3600000?120000:1800000;}
  return {SCHEMA_VERSION,GAMES,COMPETITIONS,competitionKey,normalizePreferences,migratePreferences,onboardingChoice,hydratePreferences,soccer,format,select,ageLimit,interval};
});
