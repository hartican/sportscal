// Published contests take precedence over provisional tournament structure.
let tournamentHorizon=null,tournamentHorizonLoading=null;
function loadTournamentHorizon(){
 if(tournamentHorizon)return Promise.resolve(tournamentHorizon);
 return tournamentHorizonLoading ||= fetchJson('data/tournament-horizon.v1.json',{cache:'no-cache'}).then(d=>{tournamentHorizon=d;return d;}).finally(()=>{tournamentHorizonLoading=null;});
}
function renderTournamentSlots(container,event){
 const id=event.tournamentId||event.tennisTournamentId||event.id;if(!id)return;
 const paint=()=>{if(!container.isConnected||container.querySelector(':scope > .tournament-fixture-slots'))return;
  const tournament=tournamentHorizon?.tournaments?.find(t=>t.tournamentId===id);
  const fixtures=tournament?.publishedFixtures||[];
  const appearances=event.appearances||fixtures.find(f=>f.appearances?.length)?.appearances||[];
  if(!tournament&&!appearances.length&&!event.entries?.length)return;
  const details=document.createElement('details');details.className='tournament-fixture-slots';const summary=document.createElement('summary');summary.textContent='Tournament schedule';details.append(summary);let mounted=false;
  const stamp=f=>f.startTimeUtc?new Date(f.startTimeUtc).toLocaleString('en-AU',{timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):f.date?[f.date,f.time].filter(Boolean).join(' · '):'Time not yet published';
  const participant=p=>p.displayName||p.name||p.label;
  const row=(host,title,info)=>{const p=document.createElement('p');const strong=document.createElement('strong');strong.textContent=title;p.append(strong,document.createTextNode(info?' · '+info:''));host.append(p);};
  details.addEventListener('toggle',()=>{if(!details.open||mounted)return;mounted=true;
   if(appearances.length){
    const followed=p=>['follow','priority'].includes(FOLLOW_FIRST.effectiveParticipantFollow(p.id,userPreferences,followCollectionsById()).followLevel);
    const aus=(userPreferences.followFirst?.australiansOnlySportIds||[]).includes('sport:golf');
    const relevant=appearances.filter(a=>(a.participants||a.sides?.flatMap(s=>s.participants)||[]).some(p=>followed(p)||aus&&p.countryCode==='AU'));
    const initial=relevant.length?relevant:appearances.slice(0,6);
    const extra=document.createElement('details'),more=document.createElement('summary');more.textContent='All published pairings';extra.append(more);
    for(const a of [...initial,...appearances.filter(a=>!initial.includes(a))]){const host=initial.includes(a)?details:extra;const names=a.sides?.length?a.sides.map(s=>s.participants.map(participant).join(' / ')).join(' v '):(a.participants||[]).map(participant).join(' / ');row(host,names||a.matchTitle||a.label,[a.label,stamp(a),a.tee?'Tee '+a.tee:null,userPreferences.showSpoilers?a.score:null].filter(Boolean).join(' · '));}
    if(extra.children.length>1)details.append(extra);
   }else if(event.entries?.length){
    const entries=event.entries.filter(p=>p.entryStatus==='confirmed');
    const relevant=entries.filter(p=>['follow','priority'].includes(FOLLOW_FIRST.effectiveParticipantFollow(p.id,userPreferences,followCollectionsById()).followLevel)||(userPreferences.followFirst?.australiansOnlySportIds||[]).includes('sport:golf')&&p.countryCode==='AU');
    const initial=relevant.length?relevant:entries.slice(0,6);
    row(details,'Confirmed entrants',initial.map(participant).join(', '));
    const rest=entries.filter(p=>!initial.includes(p));if(rest.length){const extra=document.createElement('details'),more=document.createElement('summary');more.textContent=`All ${entries.length} confirmed entrants`;extra.append(more);row(extra,'Also entered',rest.map(participant).join(', '));details.append(extra);}
   }
   let published=0,pending=false;
   for(const f of fixtures.filter(f=>f.id!==event.id&&f.cardType!=='golf_session'&&f.contestUnit!=='rubber')){
    if(f.appearances?.length)continue;if(f.contestUnit==='tie'&&!f.participantIds?.length){pending=true;continue;}published++;
    row(details,!userPreferences.showSpoilers&&f.spoilerSafeTitle?f.spoilerSafeTitle:f.name,stamp(f));
    for(const r of f.rubbers||[]){if(!(r.participantIds?.length||r.sides?.some(s=>s.names?.length))){pending ||= r.status!=='not-required';continue;}
     row(details,r.name,[r.matchType,userPreferences.showSpoilers?r.score:null,r.status==='not-required'?'Not required':null].filter(Boolean).join(' · '));}
   }
   if(!published&&!appearances.length){for(const f of fixtures.filter(f=>f.cardType==='golf_session')){row(details,f.name,stamp(f));published++;}}
   if(pending||!appearances.length&&!published){const note=document.createElement('p');note.textContent='Further pairings and playing times will appear when published.';details.append(note);}
  });container.append(details);if(container.closest('.parent-ongoing'))details.open=true;
 };
 if(tournamentHorizon)queueMicrotask(paint);else void loadTournamentHorizon().then(paint).catch(()=>{if(event.entries?.length||event.appearances?.length)paint();});
}
globalThis.NOTHINGSPORTS_TOURNAMENT_UI={append:renderTournamentSlots};
