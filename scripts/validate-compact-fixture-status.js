'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
class Element{
 constructor(){this.children=[];this.attributes={};this.dataset={};this.textContent='';const names=new Set();this.classList={add:(...values)=>values.forEach(value=>names.add(value)),contains:value=>names.has(value)};}
 append(...children){this.children.push(...children);}
 appendChild(child){this.append(child);}
 setAttribute(key,value){this.attributes[key]=value;}
 getAttribute(key){return this.attributes[key];}
}
function validate({source=fs.readFileSync(path.join(root,'index.html'),'utf8')}={}){
 const start=source.indexOf('function buildCompactCardSummary('),end=source.indexOf('function feedClockKey(',start);assert(start>=0&&end>start,'Actual compact card boundary exists');
 const context=vm.createContext({document:{createElement:()=>new Element()},activeTab:'feed',compactFixtureName:e=>e.name,matchupIdentityMatches:()=>[],renderEventTitleIdentity:(node,e)=>{node.textContent=e.name;},compactFixtureFormat:()=>null,compactFallbackTiming:()=>'',sportMetaForEvent:()=>({label:'Football'}),spoilerSafeDisplayTitle:e=>e.name,FOLLOW_FIRST:{stageLabel:()=>null},FEED_CONTROLS:require('../config/feed-controls'),NOTHINGSPORTS_CARD_TIMING:require('../config/card-timing'),Intl,Date});
 vm.runInContext(source.slice(start,end),context);
 let cases=0;
 function check(event,now,expected){
  context.nowAEST=()=>new Date(now);const before=JSON.stringify(event),summary=context.buildCompactCardSummary(event,{minimal:true}),time=summary.children.at(-1).textContent;
  assert(time.includes(expected),event.name+': compact card must visibly show '+expected+'; received '+time);
  assert(time.includes('Sydney time'),'Original scheduled time keeps its zone');
  assert(summary.getAttribute('aria-label').includes(expected),'Accessible status remains available');
  if(event.scoreDisplay)assert(!time.includes(event.scoreDisplay),'A status label does not expose scores');
  assert.equal(JSON.stringify(event),before,'Display preserves source facts and clocks');cases++;return {time,aria:summary.getAttribute('aria-label')};
 }
 const adapter=require('./refresh-premier-league-cards');
 for(const file of ['epl-live-20261010','epl-first-half-20261010','epl-half-time-20261010']){
  const capture=require('./fixtures/'+file+'.json'),event=adapter.cardForFixture(capture.fixture,capture.checkedAt);
  check(event,capture.checkedAt,event.status==='break'?'HALF-TIME':'LIVE');
  check(event,new Date(Date.parse(capture.checkedAt)+31*60000).toISOString(),'Awaiting match update');
 }
 const capture=require('./fixtures/epl-half-time-20261010.json'),base=adapter.cardForFixture(capture.fixture,capture.checkedAt);
 const restart='2026-10-12T07:30:00Z',pauseNow='2026-10-12T00:00:00Z';
 const cricket=require('./fixtures/match-centre-mobile-layout-20261012.json').events[0];
 const light=check({...cricket,status:'rain-delay',scheduleStatus:'rain-delay',statusText:'Bad light',statusCheckedAt:pauseNow},pauseNow,'BAD LIGHT');assert(!/rain delay/i.test(light.time+light.aria),'Actual source interruption replaces the generic status in visible and accessible timing');
 const narrative='Australia lead by 139 runs',safe=check({...cricket,status:'break',scheduleStatus:'break',statusText:narrative,statusCheckedAt:pauseNow},pauseNow,'BREAK');assert(![safe.time,safe.aria].some(text=>text.includes(narrative)),'Unreviewed pause narrative cannot become a public status label');
 const stale=check(base,new Date(Date.parse(capture.checkedAt)+240001).toISOString(),'Awaiting match update');assert(/half-time/i.test(stale.time+stale.aria),'Awaiting status retains the safe pause context');
 for(const [scheduleStatus,label] of [['cancelled','CANCELLED'],['completed','FINISHED']])check({...cricket,status:'break',scheduleStatus,statusText:narrative,statusCheckedAt:pauseNow},pauseNow,label);
 for(const [restartTimeUtc,label] of [[restart,'Live again at 6:30 pm'],[null,'Resume time unconfirmed'],['invalid','Resume time unconfirmed'],['2026-10-11T23:00:00Z','Awaiting resumption update']])check({...base,status:'stumps',scheduleStatus:'stumps',statusText:null,restartTimeUtc},pauseNow,label);
 // These canonical states are controlled safety cases, not provider-code evidence.
 for(const status of ['cancelled','canceled','postponed','suspended','abandoned'])check({...base,status,scheduleStatus:status,statusText:null},capture.checkedAt,status==='canceled'?'CANCELLED':status.toUpperCase());
 for(const key of ['nrl','afl']){
  const final=require('../data/code-inspector/'+key+'.json').fixtures.filter(e=>['completed','finished','final'].includes(e.status)).sort((a,b)=>String(a.startTimeUtc||a.date).localeCompare(String(b.startTimeUtc||b.date))).at(-1);assert(final,key+' published reference final');
  check({...final,key},'2026-10-11T17:00:00Z','FINISHED');
 }
 console.log('Compact fixture status: '+cases+' actual-renderer source, stale, reference-final and controlled non-playing cases passed.');
}
if(require.main===module)validate();
module.exports=validate;
