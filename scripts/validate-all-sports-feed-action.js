'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),acorn=require('acorn');
const actionIdentity=require('../config/event-action-identity');
function sourceFunction(source,name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);return source.slice(start,acorn.parseExpressionAt(source,start,{ecmaVersion:'latest'}).end);}
class Element{
 constructor(tag,cls=''){this.tagName=tag;this.className=cls;this.dataset={};this.children=[];this.disabled=false;this.classList={toggle:()=>{}};}
 append(...items){this.children.push(...items);}
 appendChild(item){this.append(item);return item;}
 setAttribute(){}
 querySelector(selector){return this.children.find(e=>selector==='button'?e.tagName==='button':e.className?.split(' ').includes(selector.slice(1)))||this.children.map(e=>e.querySelector?.(selector)).find(Boolean)||null;}
 click(){if(!this.disabled)this.onclick?.({stopPropagation(){}});}
}
const base={id:'fixture:nrl:as-feed-action',eventId:'fixture:nrl:as-feed-action',canonicalEventId:'fixture:nrl:as-feed-action',key:'nrl',name:'Home v Away',date:'2026-10-27',time:'19:30',startTimeUtc:'2026-10-27T08:30:00Z',status:'upcoming',participantIds:['team:nrl:home','team:nrl:away']};
const shell=fs.readFileSync('index.html','utf8'),centre=fs.readFileSync('assets/js/match-centre-ui.source.js','utf8'),sports=fs.readFileSync('assets/js/all-sports-ui.source.js','utf8');
function host({event=base,automatic=false,excluded=false,expanded=true,fallback=false}={}){
 const persisted=[],queued=[],writes=[],prefs={showSpoilers:false,feedControls:{spoilers:'strict'},followedSports:[],selectedSelectorEntityIds:[],followFirst:{subscriptions:[]},preferenceGraph:{entityFollows:[]}};
 const original=JSON.stringify(event),prior={saved:true,reminderState:'disabled',nothingscoreSubmittedPhases:['heat'],unknownAction:'keep'},key=actionIdentity.stableKey(event);
 const context={console,Date,Map,Set,crypto:{randomUUID:()=> 'bounded-ui-pin'},EVENT_ACTION_IDENTITY:actionIdentity,NOTHINGSPORTS_REMINDER_POLICY:require('../config/fixture-reminder-policy'),
  userPreferences:prefs,eventActions:{[key]:prior},archivedEventRefs:[],cardViewStates:{[key]:'compact'},eventSpoilerState:{[key]:false},fixturePinQueue:{},activeEvents:[],STORAGE_KEYS:{fixturePinQueue:'pin-queue'},
  followCollectionsById:()=>new Map(),saveActiveProfileSection:(section,value)=>persisted.push({section,value:JSON.parse(JSON.stringify(value))}),queueServerStateSync:()=>queued.push('sync'),writeStorage:(storageKey,value)=>writes.push({storageKey,value:JSON.parse(JSON.stringify(value))}),rebuildDerivedCardCache(){},
  FOLLOW_FEED_POLICY:{...require('../config/follow-feed-policy'),explicitlyExcluded:()=>excluded},eventFollowReason:e=>automatic||context.getEventAction(e).addedToFixtures?'existing-follow-or-pin':null,
  mergeCanonicalEventPages:(old,added)=>[...old,...added],document:{createElement:tag=>new Element(tag)},node:(tag,text,cls)=>Object.assign(new Element(tag,cls),{textContent:text}),el:(tag,text,cls)=>Object.assign(new Element(tag,cls),{textContent:text}),
  match:()=>require('../config/match-centre'),expanded:expanded?event.id:null,buildEventCard:()=>{const card=new Element('article','event-card');if(!fallback)card.append(new Element('div','event-card-primary-actions'));return card;},qualifyCard(){},
 };
 vm.createContext(context);
 for(const name of ['eventActionKey','defaultEventAction','storedEventAction','getEventAction','updateEventAction','saveEventActions','saveFixturePinQueue','queueFixturePinCommand'])vm.runInContext(sourceFunction(shell,name),context);
 vm.runInContext(sourceFunction(centre,'feedButton')+sourceFunction(sports,'makeCard'),context);
 return {context,persisted,queued,writes,original,key,build:()=>context.makeCard({event}),before:()=>JSON.stringify({prefs,states:context.cardViewStates,spoilers:context.eventSpoilerState})};
}
function run(){
 for(const fallback of [false,true]){
  const app=host({fallback}),before=app.before(),actions=JSON.stringify(app.context.eventActions),slot=app.build(),button=slot.querySelector('button');
  assert(button,'Expanded All Sports cards expose the existing Add to Feed action, including fallback');assert.equal(button.textContent,'Add to Feed');assert.equal(button.disabled,false);
  assert.equal(JSON.stringify(app.context.eventActions),actions,'Rendering cannot pin a fixture');assert.equal(app.persisted.length,0);assert.equal(app.writes.length,0);
  button.click();const action=app.context.getEventAction(base);assert.equal(action.addedToFixtures,true);assert.equal(action.pinState,'added');assert.equal(action.pinRevision,1);assert.equal(action.pinMutationId,'bounded-ui-pin');assert.equal(action.addedFixture.id,base.id);assert.equal(action.addedFixture.manualPin,true);
  assert.equal(action.reminderState,'disabled');assert.equal(action.saved,true);assert.equal(action.unknownAction,'keep');assert.equal(JSON.stringify(action.nothingscoreSubmittedPhases),'["heat"]');
  assert.equal(app.persisted.length,1);assert.equal(app.persisted[0].section,'eventUserState');assert.equal(app.queued.length,1);assert.equal(app.writes.length,1);assert.equal(app.writes[0].storageKey,'pin-queue');assert.equal(app.context.fixturePinQueue[app.key].enabled,true);assert.equal(app.context.fixturePinQueue[app.key].mutationId,action.pinMutationId);
  assert.equal(app.before(),before,'An explicit fixture pin preserves all Follow, Results, reminder and shared card choices');assert.equal(JSON.stringify(base),app.original);assert.equal(button.textContent,'In Feed');assert.equal(button.disabled,true);button.click();assert.equal(app.persisted.length,1);
  app.context.eventActions=app.persisted[0].value;assert.equal(app.build().querySelector('button').textContent,'In Feed','Rebuilt cards read the saved canonical pin');
 }
 for(const options of [{automatic:true},{excluded:true},{event:{...base,key:'f1',sessionType:'practice',name:'Practice 1'} }]){
  const app=host(options),before=JSON.stringify(app.context.eventActions),button=app.build().querySelector('button');assert(button);assert.equal(button.disabled,true);button.click();assert.equal(JSON.stringify(app.context.eventActions),before);assert.equal(app.persisted.length,0);assert.equal(app.writes.length,0);
 }
 const compact=host({expanded:false});assert.equal(compact.build().querySelector('button'),null,'Compact browsing does not add a mutation control or save');assert.equal(compact.persisted.length,0);
 console.log('All Sports Feed action: real card/action delegation, canonical save/queue, rebuilt In Feed, existing exclusions/Schedule-only and private-state guards passed (light DOM; no server/network).');
}
if(require.main===module)try{run();}catch(error){console.error(error);process.exitCode=1;}
module.exports=run;
