(function(){
'use strict';
if(!document.querySelector('[data-nsc-ladder-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href='assets/styles/nsc-ladder.css?v=262';style.dataset.nscLadderStyle='';document.head.append(style);}
let epoch=0,audience='global',sort='points',search='',sportPage=0;const pageCache=new Map();let viewerObserver=null;
const sports=['nrl','afl','cricket','tennis','rugby'],sportNames={nrl:'NRL',afl:'AFL',cricket:'Cricket',tennis:'Tennis',rugby:'Rugby',nrlw:'NRLW',aflw:'AFLW','cricket-women':"Women's Cricket",'rugby-women':"Women's Rugby",'cricket-open':'Other Cricket','rugby-open':'Other Rugby'};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(label,action,cls='btn ghost')=>{const b=node('button',label,cls);b.type='button';b.onclick=action;return b;};
const efficiency=x=>x?.efficiency==null?'—':`${(100*x.efficiency).toFixed(1)}% (${x.eligible})`;
function clear(){epoch++;pageCache.clear();viewerObserver?.disconnect();}
function dialog(title){const d=node('dialog',undefined,'nsc-picks-dialog');d.append(node('h2',title),button('Close',()=>d.close()));document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return d;}
async function picks(entry){
 const d=dialog(`${entry.name}’s picks`),status=node('p','Loading…');d.append(status);
 try{
 const result=await serverSyncClient.nothingscoreRequest({picks:entry.profileId});if(!d.isConnected)return;status.remove();
 const filter=node('select');filter.setAttribute('aria-label','Sport');filter.append(new Option('All sports',''));
 [...new Set(result.items.map(x=>x.sport))].sort().forEach(s=>filter.append(new Option(sportNames[s]||s,s)));
 const list=node('div',undefined,'nsc-picks-list'),message=node('p');const chosen=new Map();
 const paint=()=>{list.replaceChildren();for(const item of result.items.filter(x=>!filter.value||x.sport===filter.value)){
 const row=node('label',undefined,'nsc-pick'),input=node('input');input.type='checkbox';input.disabled=item.following;input.checked=item.following||chosen.has(item.kind+':'+item.id);input.onchange=()=>input.checked?chosen.set(item.kind+':'+item.id,item):chosen.delete(item.kind+':'+item.id);
 row.append(input,node('span',`${item.label} · ${sportNames[item.sport]||item.sport}${item.following?' · Following':item.excluded?' · Excluded — select to override':''}`));list.append(row);
 }if(!list.children.length)list.append(node('p','No shared picks in this sport.'));};filter.onchange=paint;
 const all=button('Select this sport',()=>{for(const x of result.items)if(filter.value===x.sport&&!x.following&&!x.excluded)chosen.set(x.kind+':'+x.id,x);paint();});
 const submit=button('Follow their picks',async()=>{
 if(!serverSyncClient.sessionSubject()){openSettings({section:'account'});d.close();return;}
 submit.disabled=true;try{
 await syncCurrentServerState();
 const added=await serverSyncClient.nothingscoreRequest({},{action:'copy-picks',targetProfileId:entry.profileId,items:[...chosen.values()].map(({id,kind})=>({id,kind})),overrideIds:[...chosen.values()].filter(x=>x.excluded).map(x=>x.id)});
 await reconcileCurrentServerState();pageCache.clear();message.textContent=added.added?`${added.added} picks added. ${added.bonusAwarded?`${entry.name} earned ${added.bonusAwarded} points.`:''}`:'You already follow those picks.';chosen.clear();
 }catch(e){message.textContent=e.message||'Could not copy picks. Retry.';}finally{submit.disabled=false;}
 });d.append(filter,all,list,submit,message);paint();
 }catch(e){status.textContent=e.message||'Picks unavailable.';}
}
function row(entry){
 const r=node('div',undefined,'nsc-ladder-row'+(entry.isViewer?' is-viewer':''));r.setAttribute('role','row');r.dataset.ladderProfile=entry.profileId;
 const cell=(text,cls)=>{const c=node('div',text,cls);c.setAttribute('role','cell');r.append(c);return c;};
 cell(String(entry.rank));const identity=cell(undefined,'nsc-ladder-identity');
 if(entry.avatarUrl){const img=node('img');img.src=entry.avatarUrl;img.alt='';img.className='nsc-ladder-avatar';img.loading='lazy';identity.append(img);}
 identity.append(node('strong',entry.name),node('small','@'+entry.handle+(entry.isViewer?' · You':'')));
 if(entry.canFollow){const b=button(entry.following?'Following':'Follow',async()=>{b.disabled=true;try{const p=await serverSyncClient.nothingscoreRequest({},{action:'follow-user',targetProfileId:entry.profileId,following:!entry.following});entry.following=p.following;pageCache.clear();b.textContent=p.following?'Following':'Follow';b.setAttribute('aria-pressed',String(p.following));}catch(e){showToast(e.message);}finally{b.disabled=false;}});b.setAttribute('aria-pressed',String(entry.following));identity.append(b);}
 if(audience==='global')cell(String(entry.fixtures||0),'nsc-ladder-number');cell(Number(entry.points||0).toLocaleString(),'nsc-ladder-number');
 const e=cell(efficiency(entry),'nsc-ladder-number');e.append(button('See / copy follows',()=>picks(entry),'nsc-text-button'));
 if(audience==='global'){
 const stat=entry.sports?.[sports[sportPage]],c=cell(undefined,'nsc-sport-cell');c.append(node('strong',`${Number(stat?.points||0)} pts`),node('span',efficiency(stat)),node('small',stat?.rank?`Sport rank ${stat.rank}`:'No sport rank yet'));
 }else{
 const top=Object.entries(entry.sports||{}).filter(([,v])=>v.efficiency!=null).sort((a,b)=>b[1].efficiency-a[1].efficiency||b[1].eligible-a[1].eligible||a[0].localeCompare(b[0])).slice(0,3),c=cell(undefined,'nsc-top-sports');for(const [sport,value]of top)c.append(node('div',`${sportNames[sport]||sport}: ${efficiency(value)}`));if(!top.length)c.append(node('span','No resolved predictions yet'));
 }return r;
}
async function activity(parent,current){
 const box=node('section',undefined,'nsc-friends-activity');box.append(node('h3','Friends’ 5/5 picks'));parent.append(box);let cursor=0;
 async function load(){const status=node('p','Loading recommendations…');box.append(status);try{const p=await serverSyncClient.nothingscoreRequest({activity:{cursor}});if(!current())return;status.remove();
 for(const x of p.entries){const article=node('article');const link=node('a',x.fixture);link.href=`/?event=${encodeURIComponent(x.eventId)}&liveRatings=1`;link.onclick=e=>{e.preventDefault();void openFriendFixture(x.eventId).catch(error=>showToast(error.message));};article.append(node('p',`${x.name} · @${x.handle} · ${x.phase==='pulse'?'Live':x.phase==='heat'?'Heat':'Impact'} 5/5`),link);
 article.append(button('Add to Feed',async()=>{if(!x.event){showToast('Fixture details unavailable. Please retry later.');return;}if(FOLLOW_FEED_POLICY.explicitlyExcluded(x.event,userPreferences)){showToast('Refollow the excluded competition or tournament before adding this fixture.');return;}updateEventAction(x.event,{addedToFixtures:true,addedToFixturesAt:new Date().toISOString(),addedFixture:{...x.event,manualPin:true},manualPin:true,dismissed:false});await syncCurrentServerState();requestFeedRebuildAfterFollowChange();showToast('Fixture added to Feed.');}));box.append(article);}
 if(!p.entries.length&&cursor===0)box.append(node('p','Friends’ new 5/5 ratings will appear here, across all sports.'));
 if(p.nextCursor!=null){const more=button('More activity',()=>{more.remove();cursor=p.nextCursor;void load();});box.append(more);}
 }catch(e){status.textContent='Recommendations unavailable.';status.append(button('Retry',()=>{status.remove();void load();}));}}
 await load();
}
async function render(){
 epoch++;viewerObserver?.disconnect();const run=epoch,owner=serverSyncClient.sessionSubject(),body=document.getElementById('nothingscoreBody');clearTimeout(nscRankingTimer);body.replaceChildren();
 document.getElementById('nothingscoreTitle').textContent='Nothinger Leaderboard';document.getElementById('nothingscoreSubtitle').textContent='Points earned. Picks proven.';document.getElementById('nscMyAccountBtn')?.remove();
 const current=()=>epoch===run&&owner===serverSyncClient.sessionSubject();
 const controls=node('div',undefined,'nsc-ladder-controls'),tabs=node('div',undefined,'nsc-ladder-tabs');tabs.setAttribute('role','tablist');
 for(const [id,label]of [['friends','Nothing Friends'],['global','Global Leaderboard']]){const b=button(label,()=>{audience=id;void render();});b.setAttribute('role','tab');b.setAttribute('aria-selected',String(audience===id));tabs.append(b);}
 const sortButton=button(`Sort: ${sort==='points'?'Points':'Efficiency'}`,()=>{sort=sort==='points'?'efficiency':'points';void render();});controls.append(tabs,sortButton);
 if(audience==='global'){const form=node('form'),input=node('input');input.type='search';input.placeholder='Find a name or @handle';input.setAttribute('aria-label','Find people');input.value=search;form.append(input,button('Search',()=>{search=input.value;void render();}));form.onsubmit=e=>{e.preventDefault();search=input.value;void render();};controls.append(form);}
 body.append(controls);
 if(audience==='friends'&&!owner){body.append(node('p','Sign in to see and follow your friends.'));return;}
 const viewport=node('div',undefined,'nsc-ladder-viewport'),table=node('section',undefined,'nsc-ladder');table.dataset.audience=audience;table.setAttribute('role','table');table.setAttribute('aria-label','Nothinger Leaderboard');viewport.append(table);body.append(viewport);
 const head=node('div',undefined,'nsc-ladder-row nsc-ladder-header');head.setAttribute('role','row');
 const headings=audience==='global'?['Rank','Name / Handle','Fixtures','Points','Efficiency',sportNames[sports[sportPage]]]:['Rank','Name / Handle','Points','Efficiency','Top 3 Sports Efficiency'];
 headings.forEach((text,i)=>{const c=node('div',text);c.setAttribute('role','columnheader');if(audience==='global'&&i===5){c.append(button('‹',()=>{sportPage=(sportPage+4)%5;void render();}),button('›',()=>{sportPage=(sportPage+1)%5;void render();}));c.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-label',j?'Next sport':'Previous sport'));}head.append(c);});table.append(head);
 const status=node('p','Loading leaderboard…');status.setAttribute('role','status');body.append(status);let cursor=0;
 const frozen=node('div',undefined,'nsc-ladder-frozen');frozen.hidden=true;body.append(frozen);
 viewport.addEventListener('scroll',()=>{frozen.scrollLeft=viewport.scrollLeft;},{passive:true});
 function trackViewer(viewer){
 viewerObserver?.disconnect();frozen.replaceChildren();frozen.hidden=true;if(!viewer)return;
 const content=node('section',undefined,'nsc-ladder');content.dataset.audience=audience;content.setAttribute('aria-label','Your Global leaderboard position');content.append(row(viewer));frozen.append(content);
 if(audience==='friends'){frozen.hidden=false;return;}
 const own=[...table.querySelectorAll('[data-ladder-profile]')].find(e=>e.dataset.ladderProfile===viewer.profileId);
 if(!own){frozen.hidden=false;return;}
 viewerObserver=new IntersectionObserver(entries=>{if(current())frozen.hidden=entries[0].isIntersecting;},{root:body,threshold:.5});viewerObserver.observe(own);
 }
 async function load(){try{const query={cursor,audience,sort,search:audience==='global'?search:''},key=JSON.stringify([owner,query]),cached=pageCache.get(key);const p=cached&&Date.now()-cached.at<30000?cached.payload:await serverSyncClient.nothingscoreRequest({ladder:query});if(pageCache.size>=20)pageCache.delete(pageCache.keys().next().value);pageCache.set(key,{payload:p,at:cached&&Date.now()-cached.at<30000?cached.at:Date.now()});if(!current())return;status.replaceChildren();p.entries.forEach(x=>table.append(row(x)));
 if(!p.entries.length&&cursor===0)status.append(node('span',audience==='friends'?'Follow people from Global Leaderboard to see them here.':'No matching public profiles.'));
 if(p.nextCursor!=null)status.append(button('Load more',()=>{cursor=p.nextCursor;void load();}));
 trackViewer(p.viewer);
 }catch(e){if(!current())return;status.textContent='Leaderboard unavailable. Your ratings are safe.';status.append(button('Retry',load));}}
 await load();if(!current())return;body.append(node('p','Efficiency = successful Heat predictions ÷ resolved predictions with another real rater. The number in brackets is the sample size. Pending and unrated fixtures are excluded.','nsc-ladder-explanation'));
 if(audience==='friends')await activity(body,current);
}
window.NOTHINGSPORTS_CROWD_RANKINGS={clear,render};
})();
