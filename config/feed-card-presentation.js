(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.NOTHINGSPORTS_FEED_CARD_PRESENTATION=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ordinal=n=>`${n}${n%100>=11&&n%100<=13?'TH':({1:'ST',2:'ND',3:'RD'}[n%10]||'TH')}`;
  function dateBanner(value,now=new Date()){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return 'DATE UNCONFIRMED';
    const date=new Date(`${value}T12:00:00+10:00`),parts=Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',weekday:'long',day:'numeric',month:'long',year:'numeric'}).formatToParts(date).map(p=>[p.type,p.value]));
    const year=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric'}).format(now);
    return `${parts.weekday} ${ordinal(Number(parts.day))} ${parts.month}${parts.year!==year?' '+parts.year:''}`.toUpperCase();
  }
  function venue(event,registry){
    const raw=String(event.venueOfficialName||event.venueName||event.venue||event.venueDisplayName||'').trim();
    const record=raw&&registry?.resolve(raw,event);
    const name=record?.officialName||raw;
    const reviewedLocation=record?.aliases?.find(alias=>alias.includes(', '))?.split(', ').slice(1).join(', ');
    const city=String(event.venueCity||event.city||(typeof event.location==='string'?event.location:'')||reviewedLocation||'').trim();
    if(!name||/^(?:tbc|tbd|unknown|venue tbc|location tbc)$/i.test(name))return city||'Venue TBC';
    return city&&!name.split(',').some(part=>part.trim().toLowerCase()===city.toLowerCase())?`${name}, ${city}`:name;
  }
  function ranking(event,participantId,snapshots=[]){
    if(!participantId||!event.competitionId)return null;
    const start=Date.parse(event.startTimeUtc||`${event.date}T00:00:00+10:00`);
    if(!Number.isFinite(start))return null;
    const snapshot=snapshots.filter(s=>s.competitionId===event.competitionId&&Number.isFinite(Date.parse(s.snapshotTimeUtc))&&Date.parse(s.snapshotTimeUtc)<=start)
      .sort((a,b)=>Date.parse(b.snapshotTimeUtc)-Date.parse(a.snapshotTimeUtc))[0];
    const entry=snapshot?.entries?.find(e=>e.participantId===participantId),rank=Number(entry?.rank);
    if(!Number.isInteger(rank)||rank<1)return null;
    return {label:ordinal(rank),description:`${ordinal(rank)} in ${snapshot.seasonLabel||''} ${snapshot.roundLabel||'competition standings'}`.trim(),asOf:snapshot.snapshotTimeUtc};
  }
  // Curated presentation tints, not official brand colour specifications.
  const teams={
    'team:nrl:9538':'#dc3541','team:nrl:331':'#21558b','team:nrl:329':'#596375','team:nrl:325':'#d43e47',
    'team:afl:cd_t60':'#7751a8','team:afl:cd_t20':'#a53557'
  };
  const tournaments={'competition:masters':'#248458','competition:pga-tour':'#355c93','competition:dp-world-tour':'#66549d','competition:tennis:wimbledon':'#50865e'};
  const hosts={ES:['#b63342','#c59a24'],AU:['#397c66','#c8a733'],GB:['#345a88','#a54454'],IT:['#4e806c','#b64749'],JP:['#b94554','#8e8791'],SG:['#b94b59','#8c8897']};
  function palette(event){
    const ids=event.participantIds||[];
    const left=teams[event.homeParticipantId||ids[0]],right=teams[event.awayParticipantId||ids[1]];
    if(left||right)return [left||'#7c8797',right||'#7c8797'];
    const key=String(event.competitionId||'').replace('competition:golf:','competition:');
    const brand=Object.entries(tournaments).find(([id])=>key===id||key.startsWith(id+'-')||key.startsWith(id+':'))?.[1];if(brand)return [brand,brand];
    if(['f1','motogp','wrc','motorsport','supercars'].includes(event.key))return hosts[event.venueCountryCode]||null;
    return null;
  }
  return Object.freeze({dateBanner,venue,ranking,palette,ordinal});
});
