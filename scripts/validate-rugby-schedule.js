'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
require('../assets/js/follow-schedule-panel');
const source=fs.readFileSync(require.resolve('../index.html'),'utf8');
const groupFunction=source.match(/function codeInspectorGroupLabel\(fixture, groupingMode\)\{[\s\S]*?\n\}/)?.[0];
assert(groupFunction,'exercise the existing round label owner');
const fixtures=[
 {id:'a-early',competitionId:'a',competitionName:'Competition A 2027',date:'2026-10-13',roundLabel:'League'},
 {id:'a-later',competitionId:'a',competitionName:'Competition A 2027',date:'2026-10-20',roundLabel:'League'},
 {id:'b-early',competitionId:'b',competitionName:'Competition B 2026',date:'2026-10-13',roundLabel:'League'},
 {id:'b-round',competitionId:'b',competitionName:'Competition B 2026',date:'2026-10-21',roundLabel:'Round 1'},
 {id:'a-round',competitionId:'a',competitionName:'Competition A 2027',date:'2026-10-21',roundLabel:'Round 1'}
];
function element(tag){return {tag,children:[],attributes:{},dataset:{},append(...nodes){this.children.push(...nodes);},appendChild(node){this.append(node);},setAttribute(name,value){this.attributes[name]=value;}};}
const globals={
 document:{createElement:element,createTextNode:text=>({textContent:text})},
 codeInspectorManifest:{codes:[{id:'sport:rugby-union',slug:'rugby-union',label:'Rugby Union',groupingMode:'round'}]},activeInspectorCodeId:'sport:rugby-union',codeInspectorTab:'schedule',
 codeInspectorChunkLoading:false,codeInspectorChunk:{code:{id:'sport:rugby-union'},fixtures},codeInspectorFocusedOwner:null,codeInspectorFocusedFixture:null,serverSyncClient:null,
 inspectorFixtureMatchesTab:()=>true,followBrowseState:()=>({sportId:'sport:rugby',scheduleScope:null}),userPreferences:{showSpoilers:false},
 NOTHINGSPORTS_SURFACE_CATEGORY:{genderMatches:()=>true},FOLLOW_FEED_POLICY:{scheduleVisible:()=>true},followCollectionsById:()=>new Map(),
 NOTHINGSPORTS_FOLLOW_NAV:{selected:()=>({}),matches:()=>true,windows:new Map()},formatDateKey:()=> '2026-10-12',nowAEST:()=>new Date('2026-10-12T00:00Z'),
 FOLLOW_FIRST:require('../config/follow-first'),NOTHINGSPORTS_AUSTRALIAN_DATES:require('../config/australian-dates'),CANONICAL_TAXONOMY:require('../config/canonical-sports-taxonomy'),
 codeInspectorGroupLabel:new Function(groupFunction+';return codeInspectorGroupLabel;')(),
 buildCodeInspectorFixture:fixture=>({...element('card'),fixture}),requestAnimationFrame:()=>{}
};
const keys=Object.keys(globals).concat('renderCodeInspector');
const previous=new Map(keys.map(key=>[key,{exists:Object.hasOwn(globalThis,key),value:globalThis[key]}]));
const walk=node=>[node,...(node.children||[]).flatMap(walk)];
try{
 Object.assign(globalThis,globals);let rendered;
 globalThis.renderCodeInspector=()=>{rendered=element('container');globalThis.renderFollowSchedulePanel(rendered);};
 const before=JSON.stringify(fixtures);renderCodeInspector();
 const initial=walk(rendered).filter(x=>x.tag==='card');
 assert(initial.length<fixtures.length,'Rugby opens a bounded calendar window, not every League fixture');
 const later=()=>walk(rendered).find(x=>x.tag==='button'&&x.textContent==='Later rounds / events');
 while(later())later().onclick();
 const groups=walk(rendered).filter(x=>x.className==='code-inspector-group');
 assert.equal(groups.length,5,'League and shared round labels cannot merge competitions or source dates');
 assert.deepEqual(groups.flatMap(g=>walk(g).filter(x=>x.tag==='card').map(x=>x.fixture.date)),['2026-10-13','2026-10-13','2026-10-20','2026-10-21','2026-10-21'],'calendar values precede label/numeric sorting');
 for(const g of groups){const rows=walk(g).filter(x=>x.tag==='card').map(x=>x.fixture);const heading=g.children.find(x=>x.tag==='h3').textContent;assert(heading.includes(rows[0].competitionName),'competition is visible');assert.equal(new Set(rows.map(x=>x.date)).size,1,'generic stages remain date-bounded');}
 assert.equal(JSON.stringify(fixtures),before,'presentation cannot mutate sporting facts');
 const render=(rows)=>{codeInspectorChunk.fixtures=rows;NOTHINGSPORTS_FOLLOW_NAV.windows.clear();renderCodeInspector();};
 const controls=[
  {...fixtures[0],id:'old-final',competitionId:'0-old',status:'completed',date:'2026-10-12'},
  {...fixtures[0],id:'ongoing',status:'ongoing',date:'2026-10-12'},
  {...fixtures[0],id:'new-edition',season:'2027/28',date:'2026-10-13'},
  {...fixtures[0],id:'old-edition',season:'2026/27',date:'2026-10-13'},
  {id:'unknown-a',roundLabel:'all'}, {id:'unknown-b',roundLabel:'all'}
 ];
 render(controls);
 assert(walk(rendered).some(x=>x.tag==='card'&&x.fixture.id==='ongoing'),'current view keeps sourced ongoing fixtures');
 assert(!walk(rendered).some(x=>x.tag==='card'&&x.fixture.id==='old-final'),'completed same-day group is not chosen as current');
 while(later())later().onclick();
 assert.equal(walk(rendered).filter(x=>x.className==='code-inspector-group').length,5,'edition and unknown identities remain separate');
 const unknown=walk(rendered).filter(x=>x.tag==='h3'&&x.textContent.includes('DATE TBC'));
 assert.equal(unknown.length,2);assert(unknown.every(x=>x.textContent.includes('Competition TBC')),'missing facts stay unknown');
 const retained=JSON.parse(fs.readFileSync(require.resolve('../data/code-inspector/rugby-union.json'),'utf8')).fixtures;
 const original=JSON.stringify(retained);render(retained);
 assert(walk(rendered).filter(x=>x.tag==='card').length<40,'retained calendar opens with a small useful window');
 const earlier=()=>walk(rendered).find(x=>x.tag==='button'&&x.textContent==='Earlier rounds / events');
 while(earlier())earlier().onclick();while(later())later().onclick();
 const all=walk(rendered).filter(x=>x.tag==='card').map(x=>x.fixture);
 assert.deepEqual(all.map(x=>x.id).sort(),retained.map(x=>x.id).sort(),'every original fixture remains accessible exactly once');
 for(const slot of ['sixth-place','third-place','fifth-place','second-place','fourth-place','championship'])assert(all.some(x=>x.id==='major-match:nations-championship-2026:'+slot),'all reviewed placement slots remain reachable');
 const allGroups=walk(rendered).filter(x=>x.className==='code-inspector-group');
 const dates=allGroups.map(g=>walk(g).find(x=>x.tag==='card').fixture.date||walk(g).find(x=>x.tag==='card').fixture.schedulingWindow?.startsOn||'9999-12-31');
 assert.deepEqual(dates,[...dates].sort(),'published calendar is chronological, including dates across years');
 for(const g of allGroups){const rows=walk(g).filter(x=>x.tag==='card').map(x=>x.fixture);assert.equal(new Set(rows.map(x=>x.competitionId||x.competitionName||x.id)).size,1,'retained competitions stay separate');assert.equal(new Set(rows.map(x=>x.date||x.schedulingWindow?.startsOn||null)).size,1,'retained League groups are day-bounded');}
 for(const g of allGroups)if(walk(g).some(x=>x.tag==='card'&&x.fixture.id.startsWith('major-match:nations-championship-2026:')))assert(g.children.find(x=>x.tag==='h3').textContent.includes('Nations Championship'),'existing event catalogue names the reviewed finals without guessing from participant slots');
 assert.equal(JSON.stringify(retained),original,'full published facts and source dates are unchanged');
 const fullWindow=NOTHINGSPORTS_FOLLOW_NAV.windows.get(activeInspectorCodeId);
 const jump=walk(rendered).find(x=>x.tag==='button'&&x.textContent==='Jump to current');jump.onclick();
 assert.equal(NOTHINGSPORTS_FOLLOW_NAV.windows.get(activeInspectorCodeId),fullWindow,'existing view-state owner remains authoritative');
 assert.equal(fullWindow.end-fullWindow.start,3,'Jump to current resets the bounded window');
 assert.equal(userPreferences.showSpoilers,false,'navigation never reveals results');
 console.log('Rugby actual Schedule renderer: separate competition/date groups, chronology and a bounded opening window pass.');
}finally{for(const [key,p]of previous){if(p.exists)globalThis[key]=p.value;else delete globalThis[key];}}
