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
  // Reviewed display-only nicknames and muted sporting palettes. Never change identity.
  const clubs={
    'afl:cd_t10':['Crows','#263b64'],'afl:cd_t20':['Lions','#a53557'],'afl:cd_t30':['Blues','#24446a'],'afl:cd_t40':['Magpies','#515766'],
    'afl:cd_t50':['Bombers','#c73c45'],'afl:cd_t60':['Dockers','#7751a8'],'afl:cd_t70':['Cats','#294766'],'afl:cd_t80':['Hawks','#a37b35'],
    'afl:cd_t90':['Demons','#ba3549'],'afl:cd_t100':['Kangaroos','#3261a4'],'afl:cd_t110':['Power','#28868b'],'afl:cd_t120':['Tigers','#b99230'],
    'afl:cd_t130':['Saints','#b6394e'],'afl:cd_t140':['Bulldogs','#315c9b'],'afl:cd_t150':['Eagles','#3260a2'],'afl:cd_t160':['Swans','#cc3847'],
    'afl:cd_t1000':['Suns','#c43c40'],'afl:cd_t1010':['Giants','#cb743e'],
    'nrl:322':['Broncos','#963b55'],'nrl:332':['Bulldogs','#3163a8'],'nrl:326':['Cowboys','#2b4469'],'nrl:9538':['Dolphins','#dc3541'],
    'nrl:330':['Dragons','#c83c49'],'nrl:328':['Eels','#b99b34'],'nrl:325':['Knights','#d43e47'],'nrl:329':['Panthers','#596375'],
    'nrl:335':['Rabbitohs','#388461'],'nrl:323':['Raiders','#73a44b'],'nrl:331':['Roosters','#21558b'],'nrl:336':['Sea Eagles','#943d55'],
    'nrl:333':['Sharks','#5593b7'],'nrl:324':['Storm','#7854a0'],'nrl:337':['Titans','#4486b6'],'nrl:321':['Warriors','#38577b'],'nrl:334':['Wests Tigers','#c17a38']
  };
  const aflWomen={8098:10,7887:20,8096:30,8097:40,9406:50,7886:60,8467:70,9407:80,7386:90,8466:100,9409:110,8788:120,8796:130,7387:140,8787:150,9408:160,8786:1000,7889:1010};
  const nicknames={'team:football:brazil':'Brazil · Canarinho','team:football:socceroos':'Socceroos','team:football:matildas':'Matildas','team:cricket:south-africa':'Proteas Men','team:cricket:south-africa-women':'Proteas Women','team:cricket:new-zealand':'Black Caps','team:cricket:new-zealand-women':'White Ferns','team:rugby:australia':'Wallabies','team:rugby:new-zealand':'All Blacks','team:rugby:south-africa':'Springboks'};
  const nationalColours={AU:'#c29b2f',BR:'#c4a42e',ZA:'#368566',NZ:'#525965',GB:'#345a88',ES:'#b63342',CZ:'#3863a5',FR:'#3766a2',IT:'#3a79ad',AR:'#69a3c1',JP:'#b94554',CN:'#bb3d43',US:'#385f9a',CA:'#bc4550',IN:'#367dbe',PK:'#357c59',BD:'#36815d',LK:'#4659a2',IE:'#448367',DE:'#555c65',NL:'#c67d40',PT:'#a43d4c',BE:'#b8464a',CH:'#b8464a',RS:'#b34d54',HR:'#b84b55',PL:'#b94a56',RO:'#b7a040',FI:'#4875a5',SE:'#bcaa46',NO:'#b84850',DK:'#b94750',KR:'#b64850',UA:'#4486b6',UY:'#6b9bb4'};
  const tournaments={'competition:masters':'#248458','competition:pga-tour':'#355c93','competition:pga-championship':'#355c93','competition:dp-world-tour':'#66549d','competition:us-open':'#355c93','competition:the-open':'#355c93','competition:presidents-cup':'#ab8b3e','competition:tennis:wimbledon':'#50865e','competition:tennis:us-open':'#345ea6','competition:tennis:australian-open':'#318eb6','competition:billie-jean-king-cup':'#259b98','competition:tennis:billie-jean-king-cup':'#259b98','competition:tennis:roland-garros':'#b4714c'};
  const hosts={MY:['#b99b34','#50535a'],ES:['#b63342','#c59a24'],AU:['#397c66','#c8a733'],GB:['#345a88','#a54454'],IT:['#4e806c','#b64749'],JP:['#b94554','#8e8791'],SG:['#b94b59','#8c8897'],US:['#345a88','#a54454'],BR:['#438368','#c1a53e'],MX:['#448569','#b3444e'],NL:['#c67d40','#b79345'],BE:['#555c65','#b79b3d'],CA:['#b94b59','#8c8897'],FR:['#345a88','#a54454'],CN:['#b94554','#c59a24'],AT:['#b94b59','#8c8897'],HU:['#b94554','#448569'],AZ:['#b94554','#448569','#458da1'],MC:['#b94554','#8c8897'],QA:['#86425b','#8c8897'],AE:['#448569','#b3444e'],SA:['#448569','#8c8897'],BH:['#b94b59','#8c8897']};
  // Reviewed home colours; the second is an authentic secondary, not opponent inference.
  const footballColours={1:['#b63b42','#ddd5b8'],2:['#893c56','#75a5c1'],4:['#345dab','#d6d8dc'],5:['#75a5c1','#47556d'],6:['#b63b42','#345dab'],7:['#345dab','#d6d8dc'],8:['#345dab','#d6d8dc'],9:['#c9cbd0','#b5a23c'],10:['#b63b42','#d6d8dc'],11:['#75a5c1','#394a6e'],12:['#b63b42','#454b57'],15:['#b63b42','#d6d8dc'],21:['#c9cbd0','#394a6e'],23:['#555c65','#c9cbd0'],29:['#b63b42','#555c65'],34:['#555c65','#b63b42'],41:['#b99038','#555c65'],127:['#b63b42','#555c65'],130:['#b63b42','#d6d8dc'],131:['#345dab','#c9cbd0']};
  function parentCompact(event,now=new Date()){
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    return Boolean((event.tournamentParent||event.cardType==='tennis_parent')&&event.date&&today>event.date&&(today<=(event.endDate||event.date)||['live','in_progress','interrupted','suspended'].includes(event.status))&&!['completed','cancelled','abandoned'].includes(event.status));
  }
  const identityKey=id=>String(id||'').replace(/^participant:/,'');
  function club(id){const key=identityKey(id).replace(/^team:/,'');const womens=key.match(/^aflw:cd_t(\d+)$/);return clubs[womens?'afl:cd_t'+aflWomen[womens[1]]:key];}
  function displayLabel(id,fallback){if(/^(?:winner|loser|tbc|tbd|qualifier|to be confirmed)\b/i.test(fallback||''))return fallback;return club(id)?.[0]||nicknames[identityKey(id)]||fallback;}
  function palette(event,sides=[]){
    if(sides.some(side=>/^(?:winner|loser|tbc|tbd|qualifier|to be confirmed)\b/i.test(side.label||'')))return null;
    const ids=event.participantIds||[],left=identityKey(event.homeParticipantId||ids[0]||sides[0]?.participant?.id||sides[0]?.mark?.id),right=identityKey(event.awayParticipantId||ids[1]||sides[1]?.participant?.id||sides[1]?.mark?.id);
    const country=(id,i)=>{const p=(event.participants||[]).find(p=>identityKey(p.id||p.participantId)===id)||sides[i]?.participant||sides[i]?.mark;return p?.countryCode||p?.nationalityCode||p?.metadata?.countryCode||sides[i]?.participant?.countryCode||sides[i]?.participant?.nationalityCode||sides[i]?.mark?.countryCode;};
    const countryTint=(id,i)=>nationalColours[country(id,i)];
    if(event.eventFamilyId==='presidents-cup')return ['#50535a','#ab8b3e'];
    const colour=(id,i)=>footballColours[id.match(/^team:football:epl:(\d+)$/)?.[1]]||((id==='team:football:socceroos'||id==='team:football:matildas')?['#368566','#c29b2f']:[club(id)?.[1]||countryTint(id,i)||'#7c8797']);
    if((left.startsWith('team:')&&right.startsWith('team:'))||(['tennis','wimbledon','boxing','mma','ufc'].includes(event.key)&&ids.length===2&&countryTint(left,0)&&countryTint(right,1))){const a=colour(left,0),b=colour(right,1);return [a[0],a[0]===b[0]?(b[1]||b[0]):b[0]];}
    const key=String(event.competitionId||'').replace('competition:golf:','competition:');
    const brand=Object.entries(tournaments).find(([id])=>key===id||key.startsWith(id+'-')||key.startsWith(id+':'))?.[1];
    if(brand)return [brand,brand];
    if(['f1','motogp','wrc','motorsport','supercars'].includes(event.key))return hosts[event.venueCountryCode]||null;
    return null;
  }
  function circuitAsset(event){
    if(event.key!=='f1')return null;
    const circuits=[['silverstone','gb-1948'],['spa-francorchamps','be-1925'],['albert park','au-1953'],['hungaroring','hu-1986'],['zandvoort','nl-1948'],['monza','it-1922'],['madring','es-2026'],['baku','az-2016'],['sepang','my-1999'],['marina bay','sg-2008'],['americas','us-2012'],['hermanos','mx-1962'],['jose carlos','br-1940'],['las vegas','us-2023'],['lusail','qa-2004'],['yas marina','ae-2009'],['bahrain','bh-2002'],['shanghai','cn-2004'],['suzuka','jp-1962'],['monaco','mc-1929'],['gilles','ca-1978'],['red bull ring','at-1969'],['jeddah','sa-2021'],['miami','us-2022']];
    const name=String(event.venue||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const id=circuits.find(([namePart])=>name.includes(namePart))?.[1];return id?`assets/identities/f1/circuits/${id}.svg`:null;
  }
  return Object.freeze({dateBanner,venue,ranking,palette,ordinal,displayLabel,parentCompact,circuitAsset});
});
