'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),acorn=require('acorn');

// A light DOM/persistence host, not native-browser or physical-device proof.
// All card builders, disclosure handlers and shared state/action writers below
// are the actual production functions. Only the normal renderer is faulted.
class Element{
 constructor(tag){this.tagName=tag.toUpperCase();this.className='';this.dataset={};this.attributes={};this.style={};this.children=[];this.parentNode=null;this.listeners={};this._text='';this.classList={contains:n=>this.className.split(/\s+/).includes(n),add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/),...names])].filter(Boolean).join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(n=>!names.includes(n)).join(' ');},toggle:(name,on)=>{if(on)this.classList.add(name);else this.classList.remove(name);}};}
 append(...nodes){for(let node of nodes){if(typeof node==='string'){const text=new Element('text');text._text=node;node=text;}node.remove();node.parentNode=this;this.children.push(node);}}
 appendChild(node){this.append(node);return node;}
 prepend(...nodes){const old=[...this.children];this.replaceChildren(...nodes,...old);}
 replaceChildren(...nodes){for(const old of this.children)old.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
 setAttribute(key,value){this.attributes[key]=String(value);if(key==='class')this.className=String(value);}
 getAttribute(key){return this.attributes[key]??null;}
 removeAttribute(key){delete this.attributes[key];}
 matches(selector){if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));if(selector.startsWith('[')){const match=selector.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);if(!match)return false;const key=match[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return Object.hasOwn(this.dataset,key)&&(match[2]===undefined||this.dataset[key]===match[2]);}return this.tagName.toLowerCase()===selector;}
 querySelectorAll(selector){const selectors=selector.split(',').map(s=>s.trim()),result=[];for(const child of this.children){if(selectors.some(s=>child.matches(s)))result.push(child);result.push(...child.querySelectorAll(selector));}return result;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 closest(selector){for(let node=this;node;node=node.parentNode)if(node.matches(selector))return node;return null;}
 addEventListener(type,listener){(this.listeners[type]||=[]).push(listener);}
 click(){const event={target:this,currentTarget:this,detail:0,isTrusted:false,stopPropagation(){},preventDefault(){}};this.onclick?.(event);for(const listener of this.listeners.click||[])listener(event);}
 focus(){}
 get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 set textContent(value){this.replaceChildren();this._text=String(value);}
}

function sourceFunction(source,name){
 const start=source.indexOf('function '+name+'(');assert(start>=0,'Production function missing: '+name);
 const expression=acorn.parseExpressionAt(source,start,{ecmaVersion:'latest'});return source.slice(start,expression.end);
}
const event=Object.freeze({id:'fixture:nrl:local-fallback',eventId:'fixture:nrl:local-fallback',key:'nrl',name:'Local Home v Local Away',competitionName:'NRL',date:'2026-10-26',startTimeUtc:'2026-10-26T05:00:00.000Z',status:'live',statusCheckedAt:'2026-10-26T05:05:00.000Z',sourceCheckedAt:'2026-10-26T05:05:00.000Z',sourceUrl:'https://organiser.example/fixture'});

function host(savedState,minimised){
 const writes=[],persisted=[],telemetry=[],root=new Element('main');let queued=0,replacements=0,failures=0,warnings=0;
 const context={Date,Map,Set,console:{warn(){warnings++;}},activeTab:'match-centre',activeInspectorCodeId:'',calendarChoice:{active:false},cardViewStates:{[event.id]:savedState},eventActions:{[event.id]:{isMinimised:minimised,saved:false}},eventSpoilerState:{},sessionOpenedEventIds:new Set(['fixture:existing-open']),userPreferences:{showSpoilers:false,feedCompact:false,followedSports:[],followFirst:{subscriptions:[]},feedControls:{spoilers:'strict'}},activeEvents:[],archivedEventRefs:[],followDirectoryChunks:new Map(),canonicalPreferenceParticipants:[],footballDirectoryData:null,cardIdentityCache:null,codeInspectorManifest:null,derivedCardCache:{},ENRICHMENT_ENGINE:null,CARD_LIFECYCLE:require('../config/card-lifecycle'),
  EVENT_ACTION_IDENTITY:require('../config/event-action-identity'),CARD_IDENTITIES:require('../config/card-identities'),FOLLOW_FIRST:require('../config/follow-first'),NOTHINGSPORTS_REMINDER_POLICY:require('../config/fixture-reminder-policy'),NOTHINGSPORTS_FIXTURE_IDENTITY:require('../config/fixture-identity'),NOTHINGSPORTS_FIXTURE_LABELS:require('../config/fixture-labels'),NOTHINGSPORTS_FEED_CARD_PRESENTATION:require('../config/feed-card-presentation'),NOTHINGSPORTS_CARD_TIMING:require('../config/card-timing'),NOTHINGSPORTS_REVIEWED_FIXTURE_REPAIRS:require('../config/reviewed-fixture-repairs'),VECTOR_ASSETS:require('../config/vector-assets'),
  nowAEST:()=>new Date('2026-10-26T05:05:00.000Z'),profileFixtureEvents:new Map(),document:{createElement:tag=>new Element(tag),createTextNode:text=>{const node=new Element('text');node.textContent=text;return node;}},
  // Failure injection at the agreed normal-renderer seam. The real public
  // buildEventCard catch must construct the real fallback, not a test lookalike.
  buildDetailedEventCard(){failures++;throw Error('forced normal card render failure');},
  saveActiveProfileSection(section,value){persisted.push({section,value:JSON.stringify(value)});},queueServerStateSync(){queued++;},recordProductEvent(value){telemetry.push(value);},
  // DOM continuity/recovery are host boundaries in this light test. The real
  // replacement card is still constructed by the production fallback.
  refreshExpandableCard(card,replacement){replacements++;card.className=replacement.className;card.dataset={...replacement.dataset};card.attributes={...replacement.attributes};card.replaceChildren(...replacement.children);},syncNothingscoreReadRecovery(){},
  fetch(){throw Error('Fallback disclosure must not make a request');},loadDeferredScript(){throw Error('No deferred network work belongs to this fixture');},setTimeout(){throw Error('No timer belongs to fallback disclosure');},clearTimeout(){},showToast(){},
 };
 vm.createContext(context);
 const shell=fs.readFileSync('index.html','utf8'),cards=fs.readFileSync('config/venue-panel-ui.js','utf8');
 for(const name of ['glyphMarkup','eventActionKey','defaultEventAction','storedEventAction','getEventAction','followCollectionsById','updateEventAction','saveEventActions','rebuildDerivedCardCache','cardStateForEvent','setCardState','cardLevelForState','cardIdentityParticipants','matchupIdentityMatches','compactFixtureName','spoilerSafeDisplayTitle','codeIdForEvent','codeInspectorHash','buildEventTimingStateChip','buildCardDisclosureControl','buildFixtureDataAttribution','buildFixtureResultAvailability','buildEventCard'])vm.runInContext(sourceFunction(shell,name),context,{filename:'index.html:'+name});
 for(const name of ['compactFixtureFormat','compactFixtureStage','fixtureCompetitionLabel','buildMinimisedParticipant','buildCompactCardSummary','mountMinimisedCard','scheduleScopeForEvent','buildFeedScheduleLink','appendEventQuickActions','buildFixtureFallbackCard'])vm.runInContext(sourceFunction(cards,name),context,{filename:'config/venue-panel-ui.js:'+name});
 for(const name of ['updateEventAction','setCardState']){const actual=context[name];context[name]=(...args)=>{writes.push(name);return actual(...args);};}
 for(const name of ['recordEventFeedAction','observeNewSurfaceItem'])context[name]=(...args)=>{writes.push(name);telemetry.push({name});};
 const snapshot=()=>JSON.stringify({preferences:context.userPreferences,actions:context.eventActions,states:context.cardViewStates,spoilers:context.eventSpoilerState,opened:[...context.sessionOpenedEventIds]});
 const build=options=>{const card=context.buildEventCard(event,options);root.replaceChildren(card);assert(card.classList.contains('is-fixture-fallback'),'The public builder must take its real catch/fallback path');assert.equal(failures,warnings);return card;};
 return {context,root,writes,persisted,telemetry,snapshot,build,counts:()=>({queued,replacements,failures,warnings})};
}

function defaultFallbackStillUsesSavedChoices(){
 const compact=host('opened',true),card=compact.build({mode:'schedule',cardState:'opened'});
 assert(card.querySelector('.minimised-card-summary'),'Without a callback, saved minimisation still wins');card.querySelector('.minimised-card-summary').click();
 assert.equal(compact.context.getEventAction(event).isMinimised,false);assert.equal(compact.context.cardViewStates[event.id],'selected');assert.deepEqual(compact.writes,['updateEventAction','setCardState']);assert.equal(compact.persisted.length,1);assert.equal(compact.counts().queued,1);assert.equal(compact.counts().replacements,1);
 const expanded=host('opened',false),details=expanded.build({mode:'schedule',cardState:'compact'});
 assert.equal(details.querySelector('.minimised-card-summary'),null,'A bare cardState option does not opt in');assert.equal(details.dataset.cardState,'compact','Legacy fallback metadata stays unchanged');details.querySelector('.event-card-disclosure').click();
 assert.equal(expanded.context.cardViewStates[event.id],'compact');assert.deepEqual(expanded.writes,['setCardState']);assert.equal(expanded.persisted.length,0);assert.equal(expanded.counts().replacements,1);
}

function localFallbackKeepsSavedChoices(){
 for(const [local,saved,minimised,next] of [['compact','opened',true,'selected'],['compact','opened',false,'selected'],['selected','compact',true,'compact'],['opened','compact',true,'compact']]){
  const app=host(saved,minimised),before=app.snapshot(),choices=[],source=JSON.stringify(event);let card;
  const draw=state=>{card=app.build({mode:'schedule',cardState:state,onCardStateChange:choice=>{choices.push(choice);draw(choice);}});};draw(local);
  const initial={state:card.dataset.cardState,level:card.dataset.cardLevel,expanded:card.getAttribute('aria-expanded'),opened:card.classList.contains('is-opened')};
  assert.equal(app.snapshot(),before,'Merely rendering the failed local card cannot alter saved choices');
  const disclosure=card.querySelector(local==='compact'?'.minimised-card-summary':'.event-card-disclosure');assert(disclosure,'Requested '+local+' state must win over opposite saved expansion/minimisation');
  if(local!=='compact')assert.match(disclosure.innerHTML,/<img\b[^>]*src="data:image\/svg\+xml/,'Expanded fallback uses the actual image-backed icon family');
  disclosure.click();
  assert.deepEqual(app.writes,[],'Fallback local disclosure must not call any shared card/action/open/seen writer');assert.equal(app.snapshot(),before,'Fallback local disclosure must preserve every saved choice');assert.deepEqual(choices,[next]);assert.deepEqual(initial,{state:local,level:local==='opened'?'L2':local==='selected'?'L1':'L0',expanded:String(local!=='compact'),opened:local==='opened'});assert.equal(card.dataset.cardState,next);assert.equal(card.dataset.cardLevel,next==='selected'?'L1':'L0');assert.equal(card.querySelector('.minimised-card-summary')!==null,next==='compact');assert.equal(app.persisted.length,0);assert.equal(app.counts().queued,0);assert.equal(app.counts().replacements,0);assert.deepEqual(app.telemetry,[]);assert.equal(JSON.stringify(event),source);
 }
}

function run(){require('./validate-transient-card-exposure').run();console.log('PASS transient renderer preserves private exposure/participation state');defaultFallbackStillUsesSavedChoices();console.log('PASS default fallback retains saved-state behaviour without a callback');localFallbackKeepsSavedChoices();console.log('PASS actual render-error fallback keeps all four local choices isolated from saved state');}
if(require.main===module){try{run();}catch(error){console.error(error.stack);process.exitCode=1;}}
module.exports=run;
