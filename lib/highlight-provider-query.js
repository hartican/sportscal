'use strict';
// Provider spelling only: canonical query, eligibility, cache hash and selection stay unchanged.
const competitions=new Map([['competition:premier-league','Premier League']]);
const id=value=>String(value||'').replace(/-20\d{2}(?:-\d{2,4})?$/,'');
function validDay(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function humanDay(day){if(!validDay(day))return null;const [year,month,date]=day.split('-');return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(month)-1]+' '+Number(date)+' '+year;}
function nhlSourceDay(event){const fixture=String(event.canonicalEventId||event.id||event.eventId||'').match(/^fixture:nhl:(\d+)$/)?.[1];if(!fixture)return null;for(const value of [event.sourceUrl,event.statusSourceUrl]){try{const u=new URL(value);if(u.protocol!=='https:'||!['nhl.com','www.nhl.com'].includes(u.hostname)||u.port)continue;const m=u.pathname.match(/^\/gamecenter\/[^/]+\/(\d{4})\/(\d{2})\/(\d{2})\/(\d+)\/?$/);if(m&&m[4]===fixture&&validDay(m.slice(1,4).join('-')))return m.slice(1,4).join('-');}catch{}}return null;}
function providerQuery(event,canonical){if(!canonical)return canonical;const competition=id(event.competitionId),title=event.name||event.title;if(!title)return canonical;const stage=event.stage||event.roundLabel,gender=event.gender,joined=parts=>parts.filter(Boolean).join(' ');
  if(competition==='competition:nhl'){const day=nhlSourceDay(event);return day?joined([title,'NHL',humanDay(day),stage,gender,'highlights']):canonical;}
  if(competition==='competition:nfl'){const week=String(event.roundLabel||event.stage||'').match(/\bWeek\s+(\d+)\b/i),season=String(event.season||'').match(/^20\d{2}$/)?.[0];if(week&&season)return joined([title,'NFL',season+' Season','Week '+week[1],gender,'highlights']);return canonical;}
  if(competitions.has(competition)){const stamp=Date.parse(event.actualStartTimeUtc||event.startTimeUtc||'');if(!Number.isFinite(stamp))return canonical;return joined([title,event.competitionName||competitions.get(competition),event.season||event.seasonLabel,humanDay(new Date(stamp).toISOString().slice(0,10)),stage,gender,'highlights']);}
  if(competition==='competition:rugby:wr:16e09e86-cf77-4acd-80a0-7b9aa9030e57'&&/^Bunnings Warehouse NPC\s+20\d{2}$/i.test(event.competitionName||''))return canonical.replace(/Bunnings Warehouse NPC/i,'NPC');
  return canonical;
}
module.exports={providerQuery,nhlSourceDay,humanDay};
