(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NOTHINGSPORTS_EPIC=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const phases=['heat','pulse','impact'],completed=e=>/^(completed|finished|final)$/.test(e?.status||'');
 const day=value=>{if(value===null||value===undefined||value==='')return null;const date=new Date(value);return Number.isFinite(+date)?new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(date):null;};
 const validDay=value=>{const date=new Date(value+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;};
 function verifiedEnd(event,now=new Date()){
  if(!completed(event))return null;
  const start=event?.date||event?.startDate||day(event?.startTimeUtc),startAt=Date.parse(event?.startTimeUtc||''),reference=+new Date(now);
  for(const value of [event.actualEndTimeUtc,event.completedAt,event.firstConfirmedCompleteAt]){
   const end=new Date(value||'');
   if(validDay(String(value||'').slice(0,10))&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value||'')&&Number.isFinite(+end)&&+end<=reference&&(!validDay(start)||day(end)>=start)&&(!Number.isFinite(startAt)||+end>=startAt))return end;
  }
  return null;
 }
 function finalDay(event,now=new Date()){
  const start=event?.date||event?.startDate||day(event?.startTimeUtc),actual=verifiedEnd(event,now);
  if(actual)return day(actual);
  if(validDay(event?.endDate)&&(!validDay(start)||event.endDate>=start))return event.endDate;
  if(completed(event)){const d=day(event.endTimeUtc);if(d&&d<=day(now)&&(!validDay(start)||d>=start))return d;}
  const end=event?.endDate||day(event?.endTimeUtc)||start;return validDay(end)?end:null;
 }
 function retired(event,now=new Date()){
  if(/^(postponed|suspended)$/.test(event?.status||'')||confirmedOngoing(event,now))return false;
  const end=finalDay(event,now),today=day(now);return !!end&&!!today&&Date.parse(today+'T12:00:00Z')-Date.parse(end+'T12:00:00Z')>7*86400000;
 }
 function phaseCopy(phase){
  if(phase==='pulse')return{name:'Ongoing',detail:'Electricity',tip:'During play: rate how electric it feels right now.',glyph:'ui:zap',labels:['Flat','A spark','Buzzing','Electric','EPIC electricity']};
  if(phase==='impact')return{name:'Impact',detail:'Magnitude',tip:'Afterwards: rate its lasting sporting impact.',glyph:'ui:shockwave',labels:['A ripple','A tremor','A shock','An aftershock','EPIC magnitude']};
  return{name:'Anticipation',detail:'Stakes',submissionLabel:'Pre-fixture',tip:'Before it starts: rate the anticipation and what is at stake.',glyph:'ui:steak',labels:['Low stakes','Mid stakes','High stakes','Huge stakes','Epic stakes']};
 }
 const weight=row=>Object.hasOwn(row||{},'ratingWeight')?(row.ratingWeight===8?8:1):['admin','curator','editorial'].includes(row?.persona)?8:1;
 function average(votes){let sum=0,total=0;for(const row of votes){const w=weight(row);sum+=Number(row.rating)*w;total+=w;}return total?sum/total:null;}
 function tier({nsScore=0,realMaximum=0}={}){const score=Math.max(Number(nsScore)||0,Number(realMaximum)>=4?Number(realMaximum):0);return score>=5?5:score>=4?4:score>=3&&Number(nsScore)>=3?3:null;}
 const units=score=>({3:1,4:2,5:4})[score]||0;
 const canonicalFacts=value=>Array.isArray(value)?value.map(canonicalFacts):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>!/(CheckedAt|FetchedAt|UpdatedAt|checkedAt|fetchedAt|updatedAt|sourceUrls|sourceUrl)$/.test(k)).map(k=>[k,canonicalFacts(value[k])])):value;
 const factsSignature=event=>JSON.stringify(canonicalFacts([completed(event)?'completed':event.status||'',event.outcomeText||null,event.scoreDisplay||event.score||null,event.result||null,event.homeScore??null,event.awayScore??null]));
 function allocate(cards,budget=12){let spent=0;const selected=[],deferred=[];for(const card of [...cards].sort((a,b)=>b.tier-a.tier||Date.parse(a.qualifiedAt||0)-Date.parse(b.qualifiedAt||0)||String(a.eventId).localeCompare(String(b.eventId)))){const cost=units(card.tier);if(!card.held&&cost&&spent+cost<=budget){selected.push(card);spent+=cost;}else deferred.push(card);}return{selected,deferred,spent};}
 function reviewYear(now=new Date()){const today=day(now);if(!today)return null;const year=Number(today.slice(0,4));return today.slice(5)>='12-27'?year:year-1;}
 function reviewDue(year,now=new Date()){return day(now)>=year+'-12-27';}
 function confirmedOngoing(event,now=new Date()){
  if(!/^(live|inprogress|in_progress|in-progress|ongoing|stumps|rain-delay|break|interrupted)$/.test(event?.status||'')||event.stale||event.sourceStale)return false;
  const checked=Date.parse(event.statusCheckedAt||event.sourceCheckedAt||event.statusSource?.checkedAt),source=event.statusSourceUrl||event.statusSource?.sourceUrl||event.sourceUrl;
  return /^https:\/\//.test(source||'')&&Number.isFinite(checked)&&checked<=+now&&+now-checked<1800000;
 }
 function liveContext(event,now=new Date()){
  if(!/^(live|inprogress|in_progress|in-progress|ongoing|stumps|rain-delay|break|interrupted)$/.test(event?.status||'')||event.stale||event.sourceStale)return null;
  const checked=event.statusCheckedAt||event.sourceCheckedAt||event.statusSource?.checkedAt;
  const source=event.statusSourceUrl||event.statusSource?.sourceUrl||event.sourceUrl;
  if(!confirmedOngoing(event,now))return null;
  const body=[event.scoreDisplay||event.score,event.matchStatusText||event.statusText||event.situation?.detail].filter(x=>typeof x==='string'&&x.trim()).join(' · ');
  return body?{hook:'How it is unfolding',body,sourceUrls:[source],observedAt:checked,spoiler:true}:null;
 }
 return Object.freeze({phases,day,validDay,verifiedEnd,finalDay,retired,phaseCopy,...(typeof module==='object'&&module.exports?{weight,average,tier,units,allocate}:{}),reviewYear,reviewDue,completed,confirmedOngoing,liveContext,factsSignature});
});
