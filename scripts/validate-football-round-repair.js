'use strict';
const assert=require('node:assert/strict'),{footballRoundPlan}=require('../assets/js/follow-schedule-panel');
const fixtures=require('../data/code-inspector/football.json').fixtures;
const plan=footballRoundPlan(fixtures,'2026-10-06');
assert(plan.currentKey);const selected=plan.groups.find(g=>g.key===plan.currentKey);
assert(selected.fixtures.some(f=>f.date>='2026-10-06'&&!['completed','cancelled'].includes(f.status)));
assert(plan.groups.every(g=>new Set(g.fixtures.map(f=>[f.competitionId,f.season,f.stage,f.roundLabel].join('|'))).size===1),'competitions, editions and stages cannot merge under the same round name');
const [f]=fixtures;const sample=[{...f,competitionId:'a',competitionName:'A',roundLabel:'Matchday 1',date:'2026-10-06',status:'completed'},{...f,competitionId:'b',competitionName:'B',roundLabel:'Matchday 1',date:'2026-10-07',status:'upcoming'},{...f,competitionId:'a',competitionName:'A',roundLabel:'Matchday 10',date:'2026-10-05',status:'completed'}];
const controlled=footballRoundPlan(sample,'2026-10-06');assert.equal(controlled.groups.length,3);assert.equal(controlled.groups[0].fixtures[0].roundLabel,'Matchday 10','source chronology precedes numeric round order across seasons/competitions');assert.equal(controlled.groups.find(g=>g.key===controlled.currentKey).fixtures[0].competitionId,'b','today completed fixture is not current');
assert.equal(footballRoundPlan(sample.map(f=>({...f,status:'completed'})),'2026-10-10').currentKey,null,'no invented current round after completed calendar');

// Exercise the actual Schedule renderer. Separate groups must also be visibly
// distinguishable in a native picker, where a heading's hover title is no help.
const pilotIds=['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league'];
const firstRounds=pilotIds.map(id=>fixtures.find(f=>f.competitionId===id&&f.roundNumber===1));
assert(firstRounds.every(Boolean));
const selectedRounds=[...firstRounds,{...firstRounds[0],season:'2027/28',date:'2027-08-21'},{...firstRounds[1],stage:'Knockout phase',date:'2027-02-17'}];
function element(tag){return {tag,children:[],attributes:{},dataset:{},append(...nodes){this.children.push(...nodes);},appendChild(node){this.append(node);},add(option){this.append(option);},setAttribute(name,value){this.attributes[name]=value;}};}
const testGlobals={
  document:{createElement:element,createTextNode:text=>({textContent:text})},
  Option:function(text,value){return {...element('option'),textContent:text,value};},
  codeInspectorManifest:{codes:[{id:'sport:football',slug:'football',groupingMode:'round'}]},activeInspectorCodeId:'sport:football',codeInspectorTab:'schedule',
  codeInspectorChunkLoading:false,codeInspectorChunk:{code:{id:'sport:football'},fixtures:selectedRounds},codeInspectorFocusedOwner:null,codeInspectorFocusedFixture:null,serverSyncClient:null,
  inspectorFixtureMatchesTab:()=>true,followBrowseState:()=>({sportId:'sport:football',scheduleScope:null}),userPreferences:{showSpoilers:false},
  NOTHINGSPORTS_SURFACE_CATEGORY:{genderMatches:()=>true},FOLLOW_FEED_POLICY:{scheduleVisible:()=>true},followCollectionsById:()=>new Map(),
  NOTHINGSPORTS_FOLLOW_NAV:{selected:()=>({}),matches:()=>true,windows:new Map()},formatDateKey:()=> '2026-10-06',nowAEST:()=>new Date('2026-10-06T00:00Z'),
  buildCodeInspectorFixture:fixture=>({...element('card'),fixtureId:fixture.id})
};
const previousGlobals=new Map(Object.keys(testGlobals).concat('renderCodeInspector').map(key=>[key,{exists:Object.hasOwn(globalThis,key),value:globalThis[key]}]));
const walk=node=>[node,...(node.children||[]).flatMap(walk)];
try{
  Object.assign(globalThis,testGlobals);let rendered;
  globalThis.renderCodeInspector=()=>{rendered=element('container');globalThis.renderFollowSchedulePanel(rendered);};
  renderCodeInspector();
  const picker=walk(rendered).find(node=>node.className==='football-round-picker').children.find(node=>node.tag==='select');
  const options=picker.children,labels=options.map(option=>option.textContent.replace(/^Current /,''));
  assert.equal(new Set(labels).size,selectedRounds.length,'native round choices distinguish competition, season and stage');
  const expected=footballRoundPlan(selectedRounds,'2026-10-06');
  for(const group of expected.groups){assert(labels.includes(group.context),'native picker exposes published competition/season/stage/round context');}
  const initialWindow=NOTHINGSPORTS_FOLLOW_NAV.windows.get('sport:football');
  picker.value='0';picker.onchange();
  const chosenWindow=NOTHINGSPORTS_FOLLOW_NAV.windows.get('sport:football');assert.equal(chosenWindow,initialWindow,'changing a label adds no replacement view-state owner');assert.equal(chosenWindow.start,0);assert.equal(chosenWindow.end,1);
  const heading=walk(rendered).find(node=>node.tag==='h3');
  const firstKey=selectedRounds.map(expected.key).sort((a,b)=>String(selectedRounds.find(f=>expected.key(f)===a).date).localeCompare(String(selectedRounds.find(f=>expected.key(f)===b).date)))[0];
  assert.equal(heading.textContent.replace(/^Current /,''),expected.groups.find(group=>group.key===firstKey).context,'chosen group visibly names the same published context');
  assert.equal(walk(rendered).filter(node=>node.tag==='card').length,1,'the chosen round retains its own fixture');
}finally{
  for(const [key,previous]of previousGlobals){if(previous.exists)globalThis[key]=previous.value;else delete globalThis[key];}
}
console.log('Football rounds: exact competition/season/stage grouping, source chronology, ongoing/next default and completed exclusion passed.');

const follow=require('../config/follow-first'),{buildServerFeed}=require('../lib/server-feed-pipeline'),policy=require('../config/follow-feed-policy');
for(const competitionId of ['competition:uefa-champions-league','competition:uefa-europa-league']){const fixture=fixtures.find(f=>f.competitionId===competitionId&&f.status==='upcoming'&&f.date>='2026-10-06');assert(fixture);const preferences={version:26,preferenceGraph:{entityFollows:[{participantId:fixture.participantIds[0],followLevel:'follow'}]}};assert(follow.reasonForEvent(fixture,preferences),'followed UEFA club admitted on client');assert(buildServerFeed({events:[fixture],userId:'qa',userState:{preferences},now:new Date('2026-10-06T07:00Z')}).events.some(f=>f.id===fixture.id),'same club admitted by shared server Feed');assert.equal(policy.eligibleForFollow(fixture,{competitionFollow:true}),false,'competition follow does not admit all league phase fixtures');assert.equal(policy.eligibleForFollow({...fixture,stage:'Final',roundLabel:'Final'},{competitionFollow:true}),true,'competition follow keeps championship highlights');}
console.log('UEFA actual source fixtures: followed clubs surface on both Feed owners; ordinary league-phase competition-only follows remain excluded.');
