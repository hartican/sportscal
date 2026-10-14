(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;root.NOTHINGSPORTS_FIXTURE_HIGHLIGHTS=value;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const SCHEMA_VERSION='fixture-highlights.v1';
  const MAX_CACHE_AGE_MS=30*86400000;
  const MAX_UPLOAD_AGE_MS=7*86400000;
  const youtube={providerId:'youtube',label:'YouTube',actionLabel:'YouTube',logoPath:'assets/providers/youtube.png',highlights:true,highlightsLabel:'Watch highlights'};
  const fresh=(stamp,now=Date.now())=>{const age=+now-Date.parse(stamp);return age>=-300000&&age<MAX_CACHE_AGE_MS;};
  const recentUpload=(stamp,now=Date.now())=>{const age=+now-Date.parse(stamp);return age>=0&&age<=MAX_UPLOAD_AGE_MS;};
  const completed=event=>/^(completed|finished|final|past)$/i.test(event?.status||'');
  const epic=()=>typeof require==='function'?require('./epic-classics'):globalThis.NOTHINGSPORTS_EPIC;
  function recent(event,now=Date.now()){
    const policy=epic(),date=policy.finalDay({...event,status:'completed'},new Date(now));
    if(!date)return false;
    const elapsed=Date.parse(policy.day(now))-Date.parse(date);
    return elapsed>=0&&elapsed<=7*86400000;
  }
  function playerNames(event){
    const players=event.matchupSides?.flatMap(side=>side.players||[])||[];
    return [...new Set((players.length?players:(event.participants||[]).flatMap(p=>p.players||[p])).filter(p=>!/team|national.?side/i.test(p.entityType||p.type||'')).map(p=>String(p.displayName||p.name||p.label||'').trim()).filter(Boolean))];
  }
  function tennisEligible(event){
    if(event.tournamentParent||event.majorEventMarker||event.isEditionOverview||['tennis_parent','golf_tournament','tournament_overview'].includes(event.cardType)||!completed(event)||!['tennis','tennis-women','wimbledon'].includes(event.key||event.sportKey||String(event.codeId||'').replace('sport:','')))return false;
    const format=[event.eventType,event.matchType,event.stage,event.drawType,event.contestUnit].filter(Boolean).join(' ');
    return !/junior|boys|girls|wheelchair|\btie\b/i.test(format);
  }
  function valid(record,now=Date.now()){
    return Boolean(record&&record.schemaVersion===SCHEMA_VERSION&&record.provider==='youtube'&&/^[\w-]{11}$/.test(record.videoId||'')&&record.url==='https://www.youtube.com/watch?v='+record.videoId&&/^UC[\w-]{22}$/.test(record.channelId||'')&&record.availability==='public'&&record.regionStatus!=='blocked'&&(record.standalone===true||record.standalone===false&&record.videoScope==='tournament-day')&&recentUpload(record.publishedAt,now)&&Number.isFinite(Date.parse(record.verifiedAt))&&fresh(record.checkedAt||record.verifiedAt,now)&&fresh(record.sourceCheckedAt||record.verifiedAt,now));
  }
  function searchCandidate(event,now=Date.now()){
    if(!completed(event)||!recent(event,now))return null;
    const names=playerNames(event),format=[event.eventType,event.matchType,event.tennisDrawType,event.drawType].join(' ');
    const place=event.tournamentName||event.eventName||event.competitionName||String(event.tournamentId||'').replace(/^(?:tournament:)?tennis:/,'').replace(/[:-]/g,' ');
    const namedTennis=tennisEligible(event)&&names.length===(/double/i.test(format)?4:2)&&Boolean(place);
    const title=namedTennis?names.join(' vs '):String(event.name||'').trim();
    if(!title||/^(?:TBD|TBC|unknown)(?:\s+v(?:s)?\.?\s+(?:TBD|TBC|unknown))?$/i.test(title))return null;
    return {title,namedTennis,place,format};
  }
  function searchQuery(event,now=Date.now()){return typeof require==='function'?require('../lib/fixture-highlight-query').searchQuery(event,now):null;}
  function viewing(event,now=Date.now()){
    if(completed(event)&&valid(event.highlights,now))return {...youtube,webUrl:event.highlights.url};
    const selection=searchCandidate(event,now);if(!selection)return null;
    const id=event.canonicalEventId||event.eventId||event.id;if(!/^[-a-z0-9_:]{1,200}$/i.test(id||''))return null;
    return {...youtube,webUrl:'/api/fixtures?mode=highlight&ids='+encodeURIComponent(id),highlightsSearch:true,highlightsTopResult:true,highlightsFeedOnly:!selection.namedTennis};
  }
  return Object.freeze({SCHEMA_VERSION,MAX_CACHE_AGE_MS,MAX_UPLOAD_AGE_MS,fresh,recentUpload,completed,recent,playerNames,tennisEligible,valid,searchCandidate,searchQuery,viewing});
});
