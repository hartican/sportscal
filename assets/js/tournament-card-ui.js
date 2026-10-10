(() => {
'use strict';
let overviewPromise;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
function actions(parent){
 const row=node('div',null,'event-card-primary-actions'),open=node('button','Open in Events','btn ghost');open.type='button';
 open.onclick=e=>{e.stopPropagation();globalThis.pendingTournamentFocusFixture=parent;openMajorEventInEvents(String(parent.eventId||parent.id),{tournament:!parent.majorEventMarker});};
 row.append(open,buildEventEditionToggle(parent));return row;
}
async function render(container,parent){
 const owner=serverSyncClient?.sessionSubject()||'public',prefs=JSON.stringify(userPreferences);container.textContent='Loading followed appearances…';
 try{
  await Promise.all([loadDeferredScript('config/tournament-card-details.js?v=486'),loadDeferredScript('config/score-details.js?v=486')]);NOTHINGSPORTS_SCORE_DETAILS.styles();
  overviewPromise ||= fetchJson('data/event-overviews.v1.json',{cache:'no-cache'}).catch(e=>{overviewPromise=null;throw e;});
  const doc=await overviewPromise,edition=NOTHINGSPORTS_TOURNAMENT_DETAILS.edition(parent,doc.events||[])||parent;
  let fixtures;
  if(String(parent.key).startsWith('tennis'))fixtures=(await loadTennisFeedContests()).fixtures.map(f=>NOTHINGSPORTS_FIXTURE_IDENTITY.fromSchedule(f,'tennis'));
  else {await loadDeferredScript('assets/js/tournament-fixture-ui.js?v=467');const horizon=await loadTournamentHorizon();const t=horizon.tournaments?.find(t=>t.tournamentId===(edition.tournamentId||parent.tournamentId));fixtures=(t?.publishedFixtures||[]).flatMap(f=>[f,...(f.appearances||[]).map(a=>({...a,key:parent.key,cardType:'golf_appearance',tournamentId:f.tournamentId,participantsConfirmed:true,date:formatDateKey(new Date(a.startTimeUtc)),name:(a.participants||[]).map(p=>p.displayName).join(' / '),roundLabel:a.label,status:a.status||'scheduled'}))]);}
  if(!container.isConnected||owner!==(serverSyncClient?.sessionSubject()||'public')||prefs!==JSON.stringify(userPreferences))return;
  const follows=id=>FOLLOW_FIRST.effectiveParticipantFollow(id,userPreferences,followCollectionsById()).followed;
  const merged=NOTHINGSPORTS_FIXTURE_IDENTITY.mergeOverlays(fixtures,liveFixtureEvents),data=NOTHINGSPORTS_TOURNAMENT_DETAILS.project(edition,merged,follows,nowAEST());container.replaceChildren();
  const mount=(host,rows)=>{for(const f of rows){
   if(f.cardType==='golf_appearance'){const names=(f.participants||[]).filter(p=>follows(p.id)).map(p=>p.displayName||p.name).join(' / ');const row=node('p',names+' · '+(f.roundLabel||'Round')+' · '+NOTHINGSPORTS_CARD_TIMING.presentation(f,nowAEST()).fullSchedule);if(isSpoilerVisible(f)&&f.score)row.append(document.createTextNode(' · '+f.score));host.append(row);}
   else host.append(buildEventCard(f,{mode:'schedule'}));
  }};
  container.append(node('h4','Next followed appearances'));mount(container,data.upcoming);
  if(!data.upcoming.length)container.append(node('p','The next followed appearance has not been verified.'));
  if(data.latest.length){container.append(node('h4','Latest followed results'));mount(container,data.latest);}
  if(data.older.length){const more=node('details'),summary=node('summary','Older followed results');more.append(summary);mount(more,data.older);container.append(more);}
  if(parent.key==='golf'){
   const scores=merged.filter(f=>NOTHINGSPORTS_TOURNAMENT_DETAILS.related(edition,f)).flatMap(f=>f.roundScores||[]).filter(r=>follows(r.participantId));
   if(scores.length){container.append(node('h4','Followed round scores'));for(const r of scores){if(!isSpoilerVisible(parent))continue;container.append(node('p',r.name+' · '+r.position+' · '+r.total+' · '+r.rounds.map((s,i)=>'R'+(i+1)+' '+(s??'—')).join(' · ')+' · '+(r.roundStatus||r.thru||'')+(r.stale?' · Last available scores':'')));}}
   else container.append(node('p','Round scores and positions have not been supplied by the current source.'));
  }
  const link=node('a',parent.key==='golf'?'Official tee times and leaderboard':'Official tournament');link.href=parent.key==='golf'?(edition.sourceUrl||parent.sourceUrl)?.replace(/tee-times$/,'leaderboard'):edition.sourceUrl||parent.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';container.append(link);
 }catch{if(!container.isConnected)return;container.textContent='Followed appearances could not load. ';const retry=node('button','Retry','btn ghost');retry.type='button';retry.onclick=()=>void render(container,parent);container.append(retry);}
 finally{if(container.isConnected&&owner===(serverSyncClient?.sessionSubject()||'public')&&prefs===JSON.stringify(userPreferences))container.append(actions(parent));}
}
globalThis.NOTHINGSPORTS_TOURNAMENT_CARD_UI={render,actions};
})();
