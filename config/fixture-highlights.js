(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;root.NOTHINGSPORTS_FIXTURE_HIGHLIGHTS=value;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const SCHEMA_VERSION='fixture-highlights.v1';
  const MAX_CACHE_AGE_MS=30*86400000;
  const fresh=(stamp,now=Date.now())=>Number.isFinite(Date.parse(stamp))&&Date.parse(stamp)<=+now+300000&&+now-Date.parse(stamp)<MAX_CACHE_AGE_MS;
  const completed=event=>/^(completed|finished|final|past)$/i.test(event?.status||'');
  function tennisEligible(event){
    if(event.tournamentParent||event.majorEventMarker||event.isEditionOverview||['tennis_parent','golf_tournament','tournament_overview'].includes(event.cardType)||event.isQualifying===true||event.qualifying===true||!completed(event)||!['tennis','wimbledon'].includes(event.key||event.sportKey||String(event.codeId||'').replace('sport:','')))return false;
    const format=[event.eventType,event.matchType,event.stage,event.drawType,event.contestUnit].filter(Boolean).join(' ');
    if(/junior|boys|girls|wheelchair|qualif|round.?robin|\btie\b/i.test(format))return false;
    const round=String(event.roundLabel||event.round||event.stage||'').trim();
    if(/^(?:(?:men.s|women.s|mixed|singles|doubles|championship)\s+)*(?:round of 16|last 16|r16|quarter[ -]?finals?|semi[ -]?finals?|final|qf|sf)$/i.test(round))return true;
    const total=event.tournamentRoundTotal||event.totalRounds;
    return Number.isInteger(total)&&Number.isInteger(event.roundNumber)&&total>=event.roundNumber&&event.roundNumber>=1&&2**(total-event.roundNumber+1)<=16;
  }
  function valid(record,now=Date.now()){
    return Boolean(record&&record.schemaVersion===SCHEMA_VERSION&&record.provider==='youtube'&&/^[\w-]{11}$/.test(record.videoId||'')&&record.url==='https://www.youtube.com/watch?v='+record.videoId&&/^UC[\w-]{22}$/.test(record.channelId||'')&&record.availability==='public'&&record.regionStatus!=='blocked'&&record.standalone===true&&Number.isFinite(Date.parse(record.publishedAt))&&Number.isFinite(Date.parse(record.verifiedAt))&&fresh(record.checkedAt||record.verifiedAt,now)&&fresh(record.sourceCheckedAt||record.verifiedAt,now));
  }
  function viewing(event){return completed(event)&&valid(event.highlights)?{providerId:'youtube',label:'YouTube',actionLabel:'YouTube',logoPath:'assets/providers/youtube.png',webUrl:event.highlights.url}:null;}
  return Object.freeze({SCHEMA_VERSION,MAX_CACHE_AGE_MS,fresh,completed,tennisEligible,valid,viewing});
});
