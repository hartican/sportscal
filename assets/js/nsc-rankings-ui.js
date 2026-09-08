// Read-only public ladder. Opening this page never syncs rewards or casts votes.
(function(){
'use strict';
if(!document.querySelector('[data-nsc-ladder-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href='assets/styles/nsc-ladder.css?v=247';style.dataset.nscLadderStyle='';document.head.append(style);}
let observer=null,epoch=0;
function clear(){++epoch;observer?.disconnect();observer=null;}
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function row(entry,frozen=false){
 const el=node('div',undefined,'nsc-ladder-row'+(entry.isViewer?' is-viewer':''));el.setAttribute('role','row');if(!frozen)el.dataset.ladderProfile=entry.profileId;
 const cell=(text,cls)=>{const c=node('div',text,cls);c.setAttribute('role','cell');el.append(c);return c;};
 cell(String(entry.rank),'nsc-ladder-rank');
 const avatar=cell(undefined,'nsc-ladder-avatar');avatar.setAttribute('aria-label',entry.name+' profile picture');
 avatar.textContent=String(entry.name||'?').split(/\s+/).map(p=>p[0]).slice(0,2).join('');
 if(/^https:\/\//.test(entry.avatarUrl||'')){const img=document.createElement('img');img.src=entry.avatarUrl;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();avatar.append(img);}
 const identity=cell(undefined,'nsc-ladder-identity');identity.append(node('strong',entry.name||'Nothinger'),node('small','@'+(entry.handle||'nothinger')+(entry.isViewer?' · You':'')));
 cell(Number(entry.fixtures||0).toLocaleString('en-AU'),'nsc-ladder-number');
 cell(Number(entry.points||0).toLocaleString('en-AU'),'nsc-ladder-number');
 cell(entry.efficiency==null?'—':(Number(entry.efficiency)*100).toFixed(1)+'%','nsc-ladder-number');return el;
}
window.NOTHINGSPORTS_CROWD_RANKINGS={clear,render:async function renderLadder(){
 clear();const generation=++nscRankingGeneration,owner=serverSyncClient.sessionSubject?.()||'guest',run=epoch;clearTimeout(nscRankingTimer);
 const body=document.getElementById('nothingscoreBody');body.replaceChildren();body.scrollTop=0;
 document.getElementById('nothingscoreTitle').textContent='Nothing Score';
 document.getElementById('nothingscoreSubtitle').textContent='All-time leaderboard';document.getElementById('nscMyAccountBtn')?.remove();
 const table=node('section',undefined,'nsc-ladder');table.setAttribute('role','table');table.setAttribute('aria-label','Nothing Score leaderboard');
 const header=node('div',undefined,'nsc-ladder-row nsc-ladder-header');header.setAttribute('role','row');
 for(const label of ['Rank','Photo','Name / handle','Fixtures','Points','Efficiency']){const c=node('div',label);c.setAttribute('role','columnheader');header.append(c);}
 table.append(header);body.append(table);
 const status=node('div',undefined,'nsc-ladder-status');status.setAttribute('role','status');body.append(status);
 const frozen=node('div',undefined,'nsc-ladder-frozen');frozen.hidden=true;body.append(frozen);
 const current=()=>run===epoch&&generation===nscRankingGeneration&&table.isConnected&&(serverSyncClient.sessionSubject?.()||'guest')===owner;
 let cursor=0,loading=false,viewer=null;
 if(location.protocol==='file:'){status.textContent='Nothing Score needs the hosted app. ';const link=node('a','Open Nothing Score');link.href=canonicalAppShareUrl()+'#nsc';status.append(link);return;}
 function trackViewer(){
  observer?.disconnect();frozen.replaceChildren();frozen.hidden=true;if(!viewer)return;
  frozen.append(row(viewer,true));frozen.setAttribute('aria-label','Your Nothing Score ranking');
  const original=Array.from(table.querySelectorAll('[data-ladder-profile]')).find(e=>e.dataset.ladderProfile===viewer.profileId);
  if(!original){frozen.hidden=false;return;}
  observer=new IntersectionObserver(entries=>{if(current())frozen.hidden=entries[0].isIntersecting;},{root:body,threshold:.5});observer.observe(original);
 }
 async function load(){
  if(loading)return;loading=true;status.replaceChildren(node('span','Loading leaderboard…'));
  try{
   const payload=await serverSyncClient.nothingscoreRequest({ladder:{cursor}});if(!current())return;
   (payload.entries||[]).forEach(entry=>table.append(row(entry)));viewer=payload.viewer;trackViewer();status.replaceChildren();
   if(!table.querySelector('[data-ladder-profile]'))status.append(node('p','No public scores yet. Rate a fixture to get started.'));
   if(!payload.signedIn&&cursor===0)status.append(node('p','Sign in to see your position in the ladder.'));
   else if(!viewer&&cursor===0)status.append(node('p','Your public profile is not on the ladder. Set up or enable it in Settings.'));
   if(payload.nextCursor!=null){const more=node('button','Load more','btn ghost');more.type='button';more.onclick=()=>{cursor=payload.nextCursor;void load();};status.append(more);}
   if(!body.querySelector('.nsc-ladder-explanation'))status.before(node('p','Efficiency is earned points divided by the maximum for the same settled votes. Pending predictions and votes with unknown historical rules are excluded.','nsc-ladder-explanation'));
  }catch(error){
   if(!current())return;status.replaceChildren(node('span',error.status===401?'Your session has expired. Sign in again or retry.':'Leaderboard unavailable. Your votes and points are safe.'));
   const retry=node('button','Retry','btn ghost');retry.type='button';retry.onclick=()=>void load();status.append(retry);
  }finally{loading=false;}
 }
 await load();
}};
})();
