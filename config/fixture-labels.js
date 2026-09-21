(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.NOTHINGSPORTS_FIXTURE_LABELS=api;})(globalThis,function(){
'use strict';
function gender(event){
 const value=String(event.gender||event.genderCategory||event.competitionGender||event.metadata?.gender||event.competition?.gender||'').toLowerCase();
 if(/^(women|womens|women's|female|w)$/.test(value))return 'women';
 if(/^(men|mens|men's|male|m)$/.test(value))return 'men';
 if(value==='mixed')return 'mixed';
 const id=String(event.competitionId||'');
 if(event.key==='aflw'||event.key==='nrlw'||/(?:^|:)wta(?:-|:|$)|(?:^|:)aflw(?:-|:|$)|(?:^|:)nrlw(?:-|:|$)/.test(id))return 'women';
 if(event.key==='afl'||event.key==='nrl'||/(?:^|:)atp(?:-|:|$)|afl-premiership/.test(id))return 'men';
 return null;
}
function sport(event){
 const key=String(event.key||event.sportKey||event.sportDomainId||'').replace(/^sport:/,'');
 const family=({wimbledon:'tennis','rugby-union':'rugby','rugby-league':'nrl','aussie-rules':'afl','premier-league':'football',fifa:'football'})[key]||key||'other';
 if(family==='tennis')return family;
 if(['aflw','nrlw'].includes(family))return family;
 if(gender(event)==='women')return ({afl:'aflw',nrl:'nrlw'})[family]||family+'-women';
 // Unknown gender never enters a men's-only leaderboard column.
 if(['cricket','rugby'].includes(family)&&gender(event)!=='men')return family+'-open';
 return family;
}
function badge(event){
 const key=event.key,sex=gender(event),suffix=sex?({men:' Men',women:' Women',mixed:' Mixed'})[sex]:'';
 if(['afl','aflw','nrl','nrlw'].includes(key))return (sex==='women'?({afl:'aflw',nrl:'nrlw'})[key]||key:key).toUpperCase();
 const values=[event.format,event.matchFormat,event.playingFormat,event.competitionName,event.name].filter(Boolean).join(' ');
 if(key==='cricket'){
  const format=/\btest\b/i.test(values)?'Test Match':/\bt20i?\b/i.test(values)?'T20':/\bodi\b|one.day international/i.test(values)?'ODI':String(event.format||event.matchFormat||'');
  return format?format+suffix:String(event.competitionName||'Cricket')+suffix;
 }
 const league=event.competitionName||event.leagueName||event.competition?.displayName||'';
 return league?String(league).replace(/\s+(Men|Women|Mixed)$/i,'')+suffix:'';
}

// Display order only. Never reorder source IDs, roles, scores or classifications.
function participantRecord(value,event={},records=[]){
 const id=value?.id||value?.participantId||value?.playerId;
 const national=globalThis.NOTHINGSPORTS_NATIONAL_TEAM_IDENTITIES || (typeof require==='function'?require('./national-team-identities'):null);
 const base={...(national?.participantsById?.[id]||{}),...(records.find(p=>p.id===id)||{})};
 const local=(event.participants||[]).find(p=>(p.id||p.participantId)===id)||{};
 return {...base,...local,...value, countryCode:value?.countryCode||value?.nationalityCode||local.countryCode||local.nationalityCode||base.countryCode||base.nationalityCode||base.metadata?.countryCode};
}
function isAustralian(value,event={},records=[]){
 const members=value?.players||[value?.participant||value];
 return members.some(p=>{const r=participantRecord(p,event,records);return ['AU','AUS'].includes(String(r.countryCode||'').toUpperCase())||r.isAustralian===true;});
}
function australianFirst(values,event={},records=[]){
 return [...values].sort((a,b)=>Number(isAustralian(b,event,records))-Number(isAustralian(a,event,records)));
}
function matchupTitle(event,title,records=[]){
 const source=String(title||event.displayTitleCompact||event.name||'');
 if(/hidden|winner of|loser of|\bTBC\b/i.test(source))return source;
 const split=source.match(/^(.*?)\s+v(?:s\.?|\.)?\s+(.*?)(\s+[—–]\s+.*)?$/i);
 if(!split)return source;
 const norm=s=>String(s||'').toLowerCase().replace(/\b(?:men|women|cricket)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 const candidates=[...(event.participants||[]),...(event.participantSlots||[]),...(event.matchupSides||[]).flatMap(s=>s.players||[]),...(event.participantIds||[]).map(id=>({id}))].map(p=>participantRecord(p,event,records));
 const side=label=>({label,players:candidates.filter(p=>[p.name,p.displayName,p.canonicalName,p.shortName,p.label,...(p.aliases||[])].some(n=>n && norm(n)===norm(label)))});
 const sides=[side(split[1]),side(split[2])];
 const ordered=australianFirst(sides,event,records);
 return ordered[0]===sides[0]?source:`${split[2]} v ${split[1]}${split[3]||''}`;
}
return {gender,sport,badge,participantRecord,isAustralian,australianFirst,matchupTitle};
});
