'use strict';
const fs=require('node:fs');
const SEASON=2026;
const SOURCE_URL=`https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=${SEASON}`;
const CONF={AFC:'American Football Conference',NFC:'National Football Conference'};
function parse(payload,{teamIds,checkedAt,now=new Date()}={}){
 if(Number(payload?.season?.year)!==SEASON)throw Error('NFL standings: wrong or missing season');
 if(!/^\d{4}-\d\d-\d\dT.*Z$/.test(checkedAt||'')||!Number.isFinite(Date.parse(checkedAt))||new Date(checkedAt).toISOString()!==checkedAt||Date.parse(checkedAt)>+now)throw Error('NFL standings: invalid observation date');
 const expected=new Set(teamIds),seen=new Set(),conferences=new Set(),rows=[];
 if(expected.size!==32)throw Error('NFL standings: expected 32 known clubs');
 for(const conference of payload.children||[]){
  const code=conference.abbreviation;
  if(!CONF[code]||String(conference.id)!==({AFC:'8',NFC:'7'})[code]||conferences.has(code)||conference.name!==CONF[code])throw Error('NFL standings: invalid or duplicate conference');
  conferences.add(code);const table=conference.standings;
  if(Number(table?.season)!==SEASON||Number(table?.seasonType)!==2||table.entries?.length!==16)throw Error('NFL standings: incomplete regular-season conference');
  const seeds=new Set();
  for(const entry of table.entries){
   const id=`team:nfl:${String(entry.team?.abbreviation||'').toLowerCase()}`;
   if(!expected.has(id)||seen.has(id)||!entry.team?.displayName)throw Error('NFL standings: unknown or duplicate club');
   seen.add(id);const stats=new Map();
   for(const stat of entry.stats||[]){if(stats.has(stat.name))throw Error('NFL standings: duplicate statistic');stats.set(stat.name,stat.value??stat.displayValue);}
   const number=(name,{integer=true,min=0,max=Infinity}={})=>{const value=stats.get(name);if(!['number','string'].includes(typeof value)||(typeof value==='string'&&!/^-?\d+(?:\.\d+)?$/.test(value))||!Number.isFinite(Number(value))||(integer&&!Number.isInteger(Number(value)))||Number(value)<min||Number(value)>max)throw Error(`NFL standings: invalid ${name}`);return Number(value);};
   const wins=number('wins',{max:17}),losses=number('losses',{max:17}),ties=number('ties',{max:17}),gamesPlayed=wins+losses+ties;
   const pointsFor=number('pointsFor'),pointsAgainst=number('pointsAgainst'),pointDifferential=number('pointDifferential',{min:-Infinity});
   const winPercentage=number('winPercent',{integer:false,max:1}),conferenceSeed=number('playoffSeed',{min:1,max:16});
   if(gamesPlayed>17||pointDifferential!==pointsFor-pointsAgainst||Math.abs(winPercentage-(gamesPlayed?(wins+ties/2)/gamesPlayed:0))>.001||seeds.has(conferenceSeed))throw Error('NFL standings: inconsistent record or conference seed');
   seeds.add(conferenceSeed);
   rows.push({participantId:id,displayName:entry.team.displayName,competitionId:'competition:nfl',competitionName:'National Football League',season:SEASON,conferenceId:code,conference:CONF[code],conferenceSeed,rank:conferenceSeed,rankScope:'conference',gamesPlayed,wins,losses,ties,winPercentage,pointsFor,pointsAgainst,pointDifferential,asOf:checkedAt,sourceName:'ESPN',sourceType:'publisher-standings',sourceUrl:`https://www.espn.com/nfl/standings/_/group/${conference.id}/season/${SEASON}`,sourceDataUrl:SOURCE_URL,tableNote:'Source-supplied conference seeds; season in progress. These are not final playoff qualifications.'});
  }
 }
 if(conferences.size!==2||seen.size!==32)throw Error('NFL standings: incomplete league response');
 return rows.sort((a,b)=>a.conferenceId.localeCompare(b.conferenceId)||a.conferenceSeed-b.conferenceSeed);
}
const semantic=rows=>JSON.stringify(rows,(key,value)=>['asOf','sourceCheckedAt','stale','staleNote'].includes(key)?undefined:value);
function withResultCoverage(rows,fixtures){
 const regular=(fixtures||[]).filter(f=>f.season===SEASON&&f.seasonType===2);
 if(regular.length!==272||rows.length!==32)return rows; // Legacy calendar data cannot certify season totals.
 const totals=new Map(rows.map(r=>[r.participantId,{gamesPlayed:0,wins:0,losses:0,ties:0,pointsFor:0,pointsAgainst:0}]));
 for(const f of regular.filter(f=>f.status==='completed'))for(const s of f.participantSlots){const other=f.participantSlots.find(o=>o.participantId!==s.participantId),t=totals.get(s.participantId);if(!t||!Number.isSafeInteger(Number(s.score))||!Number.isSafeInteger(Number(other?.score)))throw Error('NFL standings: invalid retained final');const own=Number(s.score),opponent=Number(other.score);t.gamesPlayed++;t.wins+=own>opponent;t.losses+=own<opponent;t.ties+=own===opponent;t.pointsFor+=own;t.pointsAgainst+=opponent;}
 return rows.map(row=>{const {stale,staleNote,...facts}=row;return {...facts,...(Object.keys(totals.get(row.participantId)).some(k=>row[k]!==totals.get(row.participantId)[k])?{stale:true,staleNote:'Table and retained regular-season results cover different match totals.'}:{})};});
}
function retainDates(previous,next){
 if(semantic(previous)===semantic(next)){
  const retained=next.map((row,i)=>({...row,asOf:previous[i].asOf}));
  return JSON.stringify(retained)===JSON.stringify(previous)?previous:retained;
 }
 const priorAt=Math.max(...previous.map(row=>Date.parse(row.asOf)).filter(Number.isFinite));
 if(Number.isFinite(priorAt)&&Date.parse(next[0]?.asOf)<=priorAt)throw Error('NFL standings: stale or conflicting observation');
 return next;
}
async function refreshFile({filePath,fetchJson,clock=()=>new Date()}={}){
 const previous=JSON.parse(fs.readFileSync(filePath,'utf8'));
 const payload=await fetchJson(SOURCE_URL),now=clock(),checkedAt=now.toISOString();
 const next=withResultCoverage(parse(payload,{teamIds:previous.teams.map(t=>t.id),checkedAt,now}),previous.fixtures);
 const standings=retainDates(previous.standings||[],next),changed=standings!==previous.standings;
 if(changed)fs.writeFileSync(filePath,JSON.stringify({...previous,standings},null,2)+'\n');
 return {checkedAt,sourceUrl:SOURCE_URL,rows:standings.length,changed,retainedFactAt:standings[0]?.asOf||null};
}
module.exports={parse,retainDates,withResultCoverage,refreshFile,SOURCE_URL,SEASON};
