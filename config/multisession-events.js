(function(root,factory){
  const api=factory();root.NOTHINGSPORTS_MULTISESSION=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis,function(){
  'use strict';
  const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'});
  const id=e=>String(e.canonicalEventId||e.eventId||e.id||'');
  function kind(e){
    const label=String(e.sessionType||e.roundLabel||e.stage||e.name||'').toLowerCase();
    if(/practice|\bfp\s*\d?\b|warm.?up/.test(label))return 'practice';
    if(/sprint.*qualif|shootout|qualif/.test(label))return 'qualifying';
    if(/sprint/.test(label))return 'sprint';
    if(e.cardType==='golf_session'||/round\s*[1-4]/.test(label))return 'round';
    return 'race';
  }
  const practice=e=>['f1','motogp','supercars'].includes(e.key)&&kind(e)==='practice';
  function group(e){
    if(e.eventGroupId&&['f1','motogp','supercars','golf','masters'].includes(e.key))return {id:e.eventGroupId,title:e.eventGroupTitle||e.tournamentName||e.name};
    const match=[id(e),...(e.sourceEventIds||[])].map(v=>String(v).match(/^(event:(?:f1|motogp):\d{4}:[^:]+):[^:]+$/)).find(Boolean);
    if(match)return {id:match[1],title:String(e.name).split(/\s*[·—]\s*/)[0]};
    const golf=id(e).match(/^(event:golf:[^:]+):round-[1-4]$/);
    if(golf)return {id:golf[1],title:e.tournamentName||String(e.name).replace(/\s*[—·]\s*Round \d.*$/i,'')};
    return null;
  }
  function start(e){
    if(e.timeTbc||e.dateOnly||['tbc','date-only','unknown'].includes(e.timePrecision))return Infinity;
    const time=Date.parse(e.startTimeUtc||'');return Number.isFinite(time)?time:Infinity;
  }
  const day=e=>Number.isFinite(start(e))?dayFormat.format(new Date(start(e))):e.date;
  const compare=(a,b)=>String(day(a)||'9999').localeCompare(String(day(b)||'9999'))||start(a)-start(b)||id(a).localeCompare(id(b));
  function project(events,{eligible=()=>true}={}){
    const groups=new Map(),plain=[];
    const complete=new Map(events.map(e=>[id(e),e]));
    for(const e of events)for(const child of e.eventGroupSchedule||[])if(group(child)?.id===group(e)?.id&&!complete.has(id(child))&&eligible(child))complete.set(id(child),child);
    for(const e of complete.values()){
      const g=group(e);if(!g){plain.push(e);continue;}
      const entry=groups.get(g.id)||{...g,sessions:new Map()};entry.sessions.set(id(e),e);groups.set(g.id,entry);
    }
    const output=plain.filter(e=>!groups.has(id(e))&&!groups.has((e.sourceEventIds||[]).find(alias=>groups.has(alias))));
    for(const g of groups.values()){
      const real=[...g.sessions.values()].filter(e=>!e.calendarOnly),sessions=(real.length?real:[...g.sessions.values()]).sort(compare),dates=sessions.map(day).filter(Boolean);
      for(const e of sessions.filter(e=>e.calendarOnly))for(let date=e.date,count=0;date&&date<e.endDate&&count<31;count++){date=new Date(Date.parse(date)+86400000).toISOString().slice(0,10);dates.push(date);}
      const days=[...new Set(dates)];
      for(const date of days){
        const today=sessions.filter(e=>day(e)===date||e.calendarOnly&&e.date<=date&&e.endDate>=date),first=today[0],clock=start(first),occurrenceId=`${g.id}:day:${date}`;
        output.push({...first,id:occurrenceId,eventId:occurrenceId,canonicalEventId:occurrenceId,
          name:g.title,displayTitleCompact:g.title,date,endDate:undefined,
          startTimeUtc:Number.isFinite(clock)?new Date(clock).toISOString():null,timeTbc:!Number.isFinite(clock),dateOnly:!Number.isFinite(clock),
          timePrecision:Number.isFinite(clock)?'exact':'date-only',multisessionOccurrence:true,
          eventGroupId:g.id,eventGroupTitle:g.title,sessions,daySessions:today,
          tournamentParent:false,majorEventMarker:false,cardKind:undefined,cardType:'session_group'});
      }
    }
    return output.sort(compare);
  }
  function withSchedules(events){
    const groups=new Map();
    const fields=['id','eventId','canonicalEventId','key','codeId','competitionId','competitionName','eventFamilyId','eventGroupId','eventGroupTitle','name','date','endDate','calendarOnly','time','startTimeUtc','endTimeUtc','timePrecision','timeTbc','dateOnly','status','scheduleStatus','gender','genderCategory','format','homeScore','awayScore','score','scoreDisplay','resultStatus','resultScore','result','outcomeText','highlights','actualEndTimeUtc','completedAt','resultPublishedAt','sourceUrl','sourceType','sourceName','sourceCheckedAt','statusCheckedAt','stale','sourceStale','participantIds','participants','sourceEventIds','circuitId','venueConfigurationId','venueConfigurationVerified','venueArtworkId','courseGeometryVerified','courseArtworkId','sessionType','roundNumber','roundLabel','cardKind','cardType','golfMajorCalendar','majorSlug','season','venue','venueCountryCode'];
    for(const e of events){const g=group(e);if(g){const list=groups.get(g.id)||[];list.push(Object.fromEntries(fields.filter(k=>e[k]!==undefined).map(k=>[k,e[k]])));groups.set(g.id,list);}}
    return events.map(e=>{const g=group(e);return g?{...e,eventGroupSchedule:groups.get(g.id)}:e;});
  }
  function presetKey(e){
    if(['golf','masters'].includes(e.key))return `golf:${e.eventFamilyId||e.tournamentId||e.competitionId}`;
    return e.key==='f1'?'competition:formula-one':e.key==='motogp'?'competition:motogp':e.key==='supercars'?'competition:supercars':null;
  }
  function presetMatches(e,prefs,now=Date.now()){
    const preset=prefs?.followFirst?.notifications?.sessionPresets?.[presetKey(e)];
    const clock=start(e),type=kind(e),finalRound=Number(e.roundNumber||String(e.roundLabel||e.round||e.name||'').match(/(?:round\s*)?([1-4])\b/i)?.[1])===4;
    return preset?.enabled===true&&clock>+now&&clock<=+now+7*86400000&&
      (preset.sessionTypes||(['golf','masters'].includes(e.key)?['final-round']:['race','sprint'])).includes(type==='round'&&finalRound?'final-round':type);
  }
  return {id,kind,practice,group,start,day,compare,project,presetKey,presetMatches,...(typeof module==='object'&&module.exports?{withSchedules}:{})};
});
