/* One public identity index; browsing filters and account state never enter it. */
(()=>{
 'use strict';
 let worker=null,loading=null,fallback=null,sequence=0,query='',limit=40,searchRoot=null,browsePanel=null,rerunSearch=null,inputFocused=false;const jobs=new Map(),found=new Map();
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
 function request(message){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{jobs.delete(id);reject(Error('Participant search timed out'));},10000);jobs.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});worker.postMessage({id,...message});});}
 async function ready(){
  if(worker||fallback)return;
  loading||=(async()=>{
   const response=await fetch('data/follow-directory/search.v1.json');if(!response.ok)throw Error('Search index unavailable');const text=await response.text();
   if(typeof Worker==='function'){
    try{worker=new Worker('config/follow-directory-worker.js?v=463');worker.onmessage=({data})=>{const job=jobs.get(data.id);if(!job)return;jobs.delete(data.id);data.error?job.reject(Error(data.error)):job.resolve(data);};worker.onerror=()=>{for(const job of jobs.values())job.reject(Error('Search worker unavailable'));jobs.clear();worker?.terminate();worker=null;};await request({kind:'search-init',text});return;}
    catch{worker?.terminate();worker=null;}
   }
   fallback=NOTHINGSPORTS_PARTICIPANT_DIRECTORY.unpack(JSON.parse(text));await loadFootballDirectoryModule();
  })().finally(()=>{loading=null;});return loading;
 }
 async function find(value){await ready();if(worker)return request({kind:'search',query:value,limit});const scored=[];for(let offset=0;offset<fallback.length;offset+=200){for(const record of fallback.slice(offset,offset+200)){const score=footballDirectoryApi.searchMatchScore(record,value);if(Number.isFinite(score))scored.push({record,score});}await new Promise(resolve=>setTimeout(resolve,0));}scored.sort((a,b)=>a.score-b.score||a.record.displayName.localeCompare(b.record.displayName));return {records:scored.slice(0,limit).map(row=>row.record),total:scored.length};}
 function mount(host,browse){
  browsePanel=browse;if(searchRoot){host.replaceChildren(searchRoot);browse.hidden=Boolean(query.trim());for(const row of searchRoot.querySelectorAll('.global-search-result')){const button=row.querySelector('.btn'),followed=FOLLOW_FIRST.effectiveParticipantFollow(row.dataset.participantId,userPreferences,followCollectionsById()).followed;button.textContent=followed?'Following':'Follow';button.setAttribute('aria-pressed',String(followed));}if(inputFocused)searchRoot.querySelector('input').focus({preventScroll:true});if(searchRoot.querySelector('.global-search-status').textContent==='Searching…')void rerunSearch();return;}searchRoot=node('div',null,'participant-search');const root=searchRoot;host.replaceChildren(root);const label=node('label','Search players & teams'),input=node('input'),status=node('p','','global-search-status'),results=node('div',null,'global-search-results');input.type='search';input.className='follow-global-search-input';input.placeholder='Name, nickname or team · all sports';input.maxLength=80;input.value=query;input.setAttribute('aria-label','Search all athletes and teams');status.setAttribute('role','status');label.append(input);root.append(label,status,results);let timer,generation=0;
  const run=async()=>{
   const value=input.value.trim(),ticket=++generation;query=input.value;clearTimeout(timer);browsePanel.hidden=Boolean(value);results.replaceChildren();status.textContent=value?'Searching…':'';if(!value)return;
   try{const data=await find(value);if(!root.isConnected||ticket!==generation||input.value.trim()!==value)return;status.textContent=data.total?`${data.total} result${data.total===1?'':'s'}`:'No players or teams found. Try a surname, nickname or team name.';
    for(const record of data.records){found.set(record.id,record);const row=node('article',null,'global-search-result');row.dataset.participantId=record.id;const open=node('button',record.displayName,'global-search-open');open.type='button';open.dataset.profileTrigger='search:'+record.id;open.onclick=()=>void openAthleteProfile(record.id,record.displayName,record.sportKey,open);const directory=NOTHINGSPORTS_PARTICIPANT_DIRECTORY;open.append(node('small',[directory.sportLabel(record),directory.competition(record),{male:'Men',female:'Women',mixed:'Mixed'}[record.genderCategory]].filter(Boolean).join(' · ')));const follow=node('button','','btn ghost');follow.type='button';const patch=()=>{const state=FOLLOW_FIRST.effectiveParticipantFollow(record.id,userPreferences,followCollectionsById()).followed;follow.textContent=state?'Following':'Follow';follow.setAttribute('aria-pressed',String(state));};patch();follow.onclick=()=>{const followed=FOLLOW_FIRST.effectiveParticipantFollow(record.id,userPreferences,followCollectionsById()).followed;setDirectoryEntityFollow(record.id,followed?"unfollow":"follow",{sportKey:record.sportKey,leagueId:record.leagueId,label:record.displayName});patch();};row.append(open,follow);results.append(row);}
    if(data.total>data.records.length){const more=node('button','Show more results','btn ghost');more.type='button';more.onclick=()=>{limit+=40;void run();};results.append(more);}
   }catch{if(root.isConnected&&ticket===generation){status.textContent='Search is temporarily unavailable. ';const retry=node('button','Retry','btn ghost');retry.type='button';retry.onclick=()=>void run();results.append(retry);}}
  };
  rerunSearch=run;input.onfocus=()=>{inputFocused=true;void ready().catch(()=>{});};input.onblur=()=>{if(root.isConnected)inputFocused=false;};input.oninput=()=>{query=input.value;limit=40;generation++;clearTimeout(timer);timer=setTimeout(run,120);};if(query)void run();
 }
 globalThis.NOTHINGSPORTS_PARTICIPANT_SEARCH={mount,ready,find,getRecord:id=>found.get(id),get query(){return query;}};
})();
