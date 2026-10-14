'use strict';
const assert=require('node:assert/strict'),contract=require('../config/fixture-highlights');
function clickAuthority(now,events){
  const fs=require('node:fs'),vm=require('node:vm');
  const source=fs.readFileSync(require.resolve('../config/venue-panel-ui.js'),'utf8');
  const owner=source.slice(source.indexOf('function configureProviderLaunch('),source.indexOf('function renderEventIdentityMark('));
  const element=()=>({children:[],dataset:{},listeners:{},append(...nodes){this.children.push(...nodes);},appendChild(node){this.children.push(node);},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;}});
  const calls=[],context={document:{createElement:element},activeTab:'feed',userPreferences:{followFirst:{}},FOLLOW_FIRST:{viewingOptions:()=>[],VIEWING_PROVIDERS:{youtube:{label:'YouTube'}}},NOTHINGSPORTS_FIXTURE_HIGHLIGHTS:{...contract,viewing:e=>contract.viewing(e,now)},buildViewingProviderMark:element,recordCodeAffinity:(...args)=>calls.push(args),codeIdForEvent:e=>e.codeId||e.key};
  vm.createContext(context);vm.runInContext(owner,context);
  const search={...events.find(e=>e.key==='f1'),highlights:null};
  const direct={...search,highlights:{schemaVersion:contract.SCHEMA_VERSION,provider:'youtube',videoId:'RPmOiRHHgX8',url:'https://www.youtube.com/watch?v=RPmOiRHHgX8',channelId:'UCaaaaaaaaaaaaaaaaaaaaaa',availability:'public',regionStatus:'unknown',standalone:true,publishedAt:now.toISOString(),verifiedAt:now.toISOString()}};
  for(const event of [search,direct]){
    const host=element();context.appendEventQuickActions(host,event,{reminder:false,chat:false});
    const link=host.children[0].children[0].children.find(n=>n.listeners.click);assert(link,'actual quick-action owner mounted highlights');
    let stopped=false;link.listeners.click({stopPropagation(){stopped=true;}});assert(stopped);assert.equal(calls.length,0,'both direct and search clicks leave saved preferences alone');assert.match(link.href,event===direct?/^https:\/\/www\.youtube\.com\/watch/:/^\/api\/fixtures\?mode=highlight&ids=/);
  }
  context.activeTab='events';
  const eventsHost=element();context.appendEventQuickActions(eventsHost,search,{reminder:false,chat:false,highlightsOnly:true});assert.equal(eventsHost.children.length,0,'new cross-sport searches stay within the approved Feed');
  const directHost=element();context.appendEventQuickActions(directHost,direct,{reminder:false,chat:false,highlightsOnly:true});assert.equal(directHost.children.length,1,'existing verified direct actions retain their Events presentation');
  context.activeTab='feed';
  context.FOLLOW_FIRST.viewingOptions=()=>[{label:'Existing provider',webUrl:'https://example.com/watch',accessType:'free'}];
  const host=element();context.appendEventQuickActions(host,{...search,status:'upcoming'},{reminder:false,chat:false});host.children[0].children[0].children[0].listeners.click({stopPropagation(){}});assert.equal(calls.length,1,'ordinary provider clicks retain existing affinity behaviour');
}
function main(){
  const now=new Date('2026-10-14T08:00:00Z'),events=require('../data/events.json').events.map(e=>require('../config/fixture-identity').normalizeCore(e));
  const recent=events.filter(e=>contract.completed(e)&&contract.recent(e,now)&&e.name);
  const before=JSON.stringify(recent),sports=new Set();
  for(const event of recent){
    const action=contract.viewing(event,now);assert(action,'existing recent named fixture: '+event.id);
    assert.equal(action.highlightsLabel,'Watch highlights');sports.add(event.key);
    const url=new URL(action.webUrl,'https://nothingsport.local');
    if(action.highlightsSearch){
      assert.equal(url.pathname,'/api/fixtures');assert.equal(url.searchParams.get('mode'),'highlight');assert.equal(url.searchParams.get('ids'),event.canonicalEventId||event.eventId||event.id);assert.equal(action.highlightsTopResult,true);const query=contract.searchQuery(event,now);assert(query.endsWith('highlights'));
      if(!contract.tennisEligible(event)){assert(query.includes(event.name));assert(query.includes(event.date));}
      if(event.key==='f1'){assert(query.includes(event.stage));assert(!query.includes('George Russell vs'),'race session uses its identity rather than the entire field');}
      if(event.codeId==='sport:nbl')assert(query.includes('nbl'),'a shared legacy key cannot mislabel the competition as NBA');
    }else{assert.equal(url.origin,'https://www.youtube.com');assert.equal(url.pathname,'/watch');assert.equal(action.webUrl,event.highlights.url);}
  }
  assert(sports.size>=8,'real published completed fixtures exercise multiple sport families');assert.equal(JSON.stringify(recent),before,'URL generation cannot change sporting facts');
  for(const key of ['cricket','golf']){
    const source=events.find(e=>e.key===key);assert(source);
    const replay={...source,status:'completed',date:'2026-10-05',endDate:'2026-10-13',startTimeUtc:null,endTimeUtc:null,actualEndTimeUtc:null,completedAt:null,firstConfirmedCompleteAt:null,highlights:null};
    assert(contract.viewing(replay,now)?.highlightsSearch,'controlled multi-day completion replay uses the published final day: '+key);
    assert.equal(contract.viewing({...replay,status:'stumps'},now),null);assert.equal(contract.viewing({...replay,status:'live'},now),null);
    assert.equal(contract.viewing({...replay,endDate:'2026-10-06'},now),null,'retired card has no search');
    assert.equal(contract.viewing({...replay,endDate:'2026-10-15'},now),null,'future completion calendar is not a passed card');
  }
  const source=recent.find(e=>e.key==='f1');assert.equal(contract.viewing({...source,name:'TBD',highlights:null},now),null);
  assert.equal(contract.viewing({...source,name:null,eventName:'Overview',highlights:null},now),null,'unnamed fixtures cannot borrow an overview title');
  clickAuthority(now,recent);
  console.log('All-sport highlights: '+recent.length+' actual published cards across '+sports.size+' sports; fixture/session top-result redirects, direct precedence, immutable facts and controlled multi-day lifecycle passed.');
}
if(require.main===module)main();module.exports={main};
