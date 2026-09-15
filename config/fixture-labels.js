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
return {gender,sport,badge};
});
