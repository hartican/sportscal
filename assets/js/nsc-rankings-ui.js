(function(){
'use strict';
if(!document.querySelector('[data-yurters-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href='assets/styles/yurters.css?v=614';style.dataset.yurtersStyle='';document.head.append(style);}
let epoch=0,audience=null,search='',lastOwner=null;
const sportNames={nrl:'NRL',afl:'AFL',cricket:'Cricket',tennis:'Tennis',rugby:'Rugby',football:'Football',nrlw:'NRLW',aflw:'AFLW'};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(label,action,cls='btn ghost')=>{const b=node('button',label,cls);b.type='button';b.onclick=action;return b;};
function clear(){epoch++;audience=null;search='';lastOwner=null;}
function dialog(title){const d=node('dialog',undefined,'nsc-picks-dialog');d.append(node('h2',title),button('Close',()=>d.close()));document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return d;}
async function picks(entry){
 const owner=serverSyncClient.sessionSubject(),d=dialog(`${entry.name}’s picks`),status=node('p','Loading…');d.append(status);
 try{
 const result=await serverSyncClient.nothingscoreRequest({picks:entry.profileId});if(!d.isConnected||owner!==serverSyncClient.sessionSubject())return;status.remove();
 const filter=node('select');filter.setAttribute('aria-label','Sport');filter.append(new Option('All sports',''));
 [...new Set(result.items.map(x=>x.sport))].sort().forEach(s=>filter.append(new Option(sportNames[s]||s,s)));
 const typeFilter=node('select');typeFilter.setAttribute('aria-label','Pick type');
 const typeLabels={sport:'Sports',competition:'Competitions',team:'Teams',athlete:'Players & athletes',collection:'Collections',event:'Events',fixture:'Fixtures',selector:'Competitions'};
 typeFilter.append(new Option('All picks',''));
 [...new Set(result.items.map(x=>x.entityType||x.kind))].sort((a,b)=>(typeLabels[a]||a).localeCompare(typeLabels[b]||b)).forEach(type=>typeFilter.append(new Option(typeLabels[type]||type,type)));
 const list=node('div',undefined,'nsc-picks-list'),message=node('p');const chosen=new Map();
 const visible=()=>result.items.filter(x=>(!filter.value||x.sport===filter.value)&&(!typeFilter.value||(x.entityType||x.kind)===typeFilter.value));
 const paint=()=>{list.replaceChildren();let group='';for(const item of visible()){
 const nextGroup=typeLabels[item.entityType||item.kind]||item.entityType||item.kind;if(nextGroup!==group){group=nextGroup;list.append(node('h3',group,'nsc-picks-group'));}
 const row=node('label',undefined,'nsc-pick'),input=node('input');input.type='checkbox';input.disabled=item.following;input.checked=item.following||chosen.has(item.kind+':'+item.id);input.onchange=()=>input.checked?chosen.set(item.kind+':'+item.id,item):chosen.delete(item.kind+':'+item.id);
 row.append(input,node('span',`${item.label} · ${sportNames[item.sport]||item.sport}${item.following?' · Following':item.excluded?' · Excluded — select to override':''}`));list.append(row);
 }if(!list.children.length)list.append(node('p','No shared picks match these filters.'));};filter.onchange=paint;typeFilter.onchange=paint;
 const all=button('Select visible picks',()=>{for(const x of visible())if(!x.following&&!x.excluded)chosen.set(x.kind+':'+x.id,x);paint();});
 const submit=button('Follow their picks',async()=>{
 if(!serverSyncClient.sessionSubject()){openSettings({section:'account'});d.close();return;}
 submit.disabled=true;try{
 await syncCurrentServerState();if(owner!==serverSyncClient.sessionSubject())return;
 const added=await serverSyncClient.nothingscoreRequest({},{action:'copy-picks',targetProfileId:entry.profileId,items:[...chosen.values()].map(({id,kind})=>({id,kind})),overrideIds:[...chosen.values()].filter(x=>x.excluded).map(x=>x.id)});
 if(owner!==serverSyncClient.sessionSubject())return;await reconcileCurrentServerState();message.textContent=added.added?`${added.added} picks added.`:'You already follow those picks.';chosen.clear();
 }catch(e){message.textContent=e.message||'Could not copy picks. Retry.';}finally{submit.disabled=false;}
 });d.append(filter,typeFilter,all,list,submit,message);paint();
 }catch(e){status.textContent=e.message||'Picks unavailable.';}
}
function row(entry,current){
 const r=node('article',undefined,'yurter'),identity=node('div',undefined,'yurter-identity');
 r.dataset.yurterProfile=entry.profileId;
 if(entry.avatarUrl){const img=node('img');img.src=entry.avatarUrl;img.alt='';img.className='yurter-avatar';img.loading='lazy';r.append(img);if(typeof registerExpandableAvatar==='function')registerExpandableAvatar(img,entry.avatarUrl,entry.name);}
 else r.append(node('span',String(entry.name||'?').split(/\s+/).map(x=>x[0]).slice(0,2).join(''),'yurter-avatar'));
 identity.append(node('strong',entry.name),node('small','@'+entry.handle+(entry.isViewer?' · You':'')));
 const actions=node('div',undefined,'yurter-actions');
 if(entry.canFollow){const b=button(entry.following?'Following':'Follow',async()=>{if(!serverSyncClient.sessionSubject()){openSettings({section:'account'});return;}b.disabled=true;try{const result=await serverSyncClient.nothingscoreRequest({},{action:'follow-user',targetProfileId:entry.profileId,following:!entry.following});if(!current())return;entry.following=result.following;b.textContent=result.following?'Following':'Follow';b.setAttribute('aria-pressed',String(result.following));}catch(e){if(current())showToast(e.message);}finally{if(current())b.disabled=false;}});b.setAttribute('aria-pressed',String(entry.following));actions.append(b);}
 if(!entry.isViewer)actions.append(button('See / copy follows',()=>picks(entry)));
 identity.append(actions);r.append(identity);return r;
}
async function activity(parent,current){
 const box=node('section',undefined,'nsc-friends-activity');box.append(node('h3','Friends’ 5/5 picks'));parent.append(box);let cursor=0;
 async function load(){const status=node('p','Loading recommendations…');box.append(status);try{const p=await serverSyncClient.nothingscoreRequest({activity:{cursor}});if(!current())return;status.remove();
 for(const x of p.entries){const article=node('article');const link=node('a',x.fixture);link.href=`/?event=${encodeURIComponent(x.eventId)}&liveRatings=1`;link.onclick=e=>{e.preventDefault();void openFriendFixture(x.eventId).catch(error=>showToast(error.message));};article.append(node('p',`${x.name} · @${x.handle} · ${x.phase==='pulse'?'Ongoing':x.phase==='heat'?'Anticipation':'Impact'} 5/5`),link);
 article.append(button('Add to Feed',async()=>{if(!x.event){showToast('Fixture details unavailable. Please retry later.');return;}if(FOLLOW_FEED_POLICY.explicitlyExcluded(x.event,userPreferences)){showToast('Refollow the excluded competition or tournament before adding this fixture.');return;}updateEventAction(x.event,{addedToFixtures:true,addedToFixturesAt:new Date().toISOString(),addedFixture:{...x.event,manualPin:true},manualPin:true,dismissed:false});await syncCurrentServerState();requestFeedRebuildAfterFollowChange();showToast('Fixture added to Feed.');}));box.append(article);}
 if(!p.entries.length&&cursor===0)box.append(node('p','Friends’ new 5/5 ratings will appear here, across all sports.'));
 if(p.nextCursor!=null){const more=button('More activity',()=>{more.remove();cursor=p.nextCursor;void load();});box.append(more);}
 }catch(e){status.textContent='Recommendations unavailable.';status.append(button('Retry',()=>{status.remove();void load();}));}}
 await load();
}
async function render({following=false}={}){
 const run=++epoch,owner=serverSyncClient.sessionSubject(),body=document.getElementById('nothingscoreBody');
 if(owner!==lastOwner){audience=owner?'following':'all';search='';lastOwner=owner;}
 if(following)audience=owner?'following':'all';
 audience||=owner?'following':'all';
 const current=()=>epoch===run&&owner===serverSyncClient.sessionSubject()&&body.isConnected&&document.getElementById('nothingscoreBackdrop').classList.contains('show');
 clearTimeout(nscRankingTimer);body.replaceChildren();
 document.getElementById('nothingscoreTitle').textContent='YURTERS';
 document.getElementById('nothingscoreSubtitle').textContent='Follow people. Discover their sporting follows.';
 document.getElementById('nscMyAccountBtn')?.remove();
 const controls=node('div',undefined,'yurters-controls'),tabs=node('div',undefined,'yurters-tabs');tabs.setAttribute('role','tablist');
 for(const [id,label]of [['following','Following'],['all','Find Yurters']]){const b=button(label,()=>{audience=id;void render();});b.setAttribute('role','tab');b.setAttribute('aria-selected',String(audience===id));tabs.append(b);}
 const form=node('form'),input=node('input');input.type='search';input.placeholder='Find a name or @handle';input.setAttribute('aria-label','Find Yurters');input.value=search;
 const submit=node('button','Search','btn');submit.type='submit';form.append(input,submit);form.onsubmit=e=>{e.preventDefault();search=input.value;void render();};controls.append(tabs,form);body.append(controls);
 if(audience==='following'&&!owner){body.append(node('p','Sign in to follow Yurters.'),button('Sign in',()=>openSettings({section:'account'})));return;}
 const list=node('section',undefined,'yurters-list'),status=node('p','Loading Yurters…');list.setAttribute('aria-label','Yurters');status.setAttribute('role','status');body.append(list,status);let cursor=0,loading=false;
 async function load(){if(loading)return;loading=true;status.textContent='Loading Yurters…';try{const p=await serverSyncClient.nothingscoreRequest({people:{audience,search,cursor}});if(!current())return;status.replaceChildren();p.entries.forEach(x=>list.append(row(x,current)));if(!p.entries.length&&cursor===0)status.append(node('span',audience==='following'?'Follow people in Find Yurters to see them here.':'No matching public profiles.'));if(p.nextCursor!=null)status.append(button('Load more',()=>{cursor=p.nextCursor;void load();}));}catch(e){if(current()){status.textContent='Yurters unavailable. ';status.append(button('Retry',load));}}finally{loading=false;}}
 await load();if(current()&&audience==='following')await activity(body,current);
}
window.NOTHINGSPORTS_YURTERS={clear,render,openProfile:picks};
})();
