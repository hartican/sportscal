// Tournament structures load only when an applicable card opens.
let tournamentHorizon=null,tournamentHorizonLoading=null;
function loadTournamentHorizon(){
 if(tournamentHorizon)return Promise.resolve(tournamentHorizon);
 return tournamentHorizonLoading ||= fetchJson('data/tournament-horizon.v1.json',{cache:'no-cache'}).then(d=>{tournamentHorizon=d;return d;}).finally(()=>{tournamentHorizonLoading=null;});
}
function renderTournamentSlots(container,event){
 const id=event.tournamentId||event.tennisTournamentId||event.id;
 if(!id)return;
 const paint=()=>{if(!container.isConnected)return;const tournament=tournamentHorizon?.tournaments?.find(t=>t.tournamentId===id);if(!tournament)return;
  const details=document.createElement('details');details.className='tournament-fixture-slots';const summary=document.createElement('summary');summary.textContent='Tournament schedule';details.append(summary);let mounted=false;
  details.addEventListener('toggle',()=>{if(!details.open||mounted)return;mounted=true;const note=document.createElement('p');note.textContent=tournament.formatConfirmed?'Players and start times update as they’re confirmed.':'Published stages appear here. The remaining format is still to be confirmed.';details.append(note);
   const rounds=new Map();for(const slot of tournament.slots){if(!rounds.has(slot.round))rounds.set(slot.round,[]);rounds.get(slot.round).push(slot);}
   for(const [round,slots]of rounds){const group=document.createElement('details'),heading=document.createElement('summary');heading.textContent=`${round} · ${slots.length} ${slots[0].kind==='round'?'round':slots[0].kind==='stage'?'stage':'slots'}`;group.append(heading);
    let ready=false;group.addEventListener('toggle',()=>{if(!group.open||ready)return;ready=true;for(const slot of slots){const row=document.createElement('p');row.dataset.tournamentSlotId=slot.slotId;const names=slot.participantSlots?.map(p=>p.label||p.name||'To be confirmed').join(' v ');row.textContent=`${slot.index}. ${names||round} · ${slot.date||'Date to be confirmed'} · ${slot.time||'Time to be confirmed'}`;group.append(row);}});details.append(group);}
  });container.append(details);
 };
 if(tournamentHorizon)queueMicrotask(paint);else void loadTournamentHorizon().then(paint).catch(()=>{});
}

globalThis.NOTHINGSPORTS_TOURNAMENT_UI={append:renderTournamentSlots};
