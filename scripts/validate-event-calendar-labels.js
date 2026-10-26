'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),source=html.match(/function majorEventDateLabel\(record\)\{[\s\S]*?\n\}/)?.[0];assert(source);
const c={NOTHINGSPORTS_AUSTRALIAN_DATES:require('../config/australian-dates')};vm.createContext(c);vm.runInContext(source,c);
const parent=require('../data/major-events.v1.json').events.find(e=>e.id==='major-event:nations-championship-finals-2026');
const before=JSON.stringify(parent),label=c.majorEventDateLabel(parent);
assert(label.includes('London'),'published London calendar dates are visibly qualified');
assert(label.includes('27')&&label.includes('29')&&label.includes('Nov')&&label.includes('2026'),'keep the original programme days/year');
assert.equal(JSON.stringify(parent),before,'a date label cannot alter programme facts or fixture clocks');
assert.equal(c.majorEventDateLabel({}), 'Dates unavailable');
assert.equal(c.majorEventDateLabel({...parent,dateStatus:'tbc'}), 'Dates unavailable');
for(const dates of [{startDate:'2026-02-30',endDate:'2026-03-02'},{startDate:'2026-11-29',endDate:'2026-11-27'},{startDate:'bad',endDate:'2026-11-29'}])assert.equal(c.majorEventDateLabel({...parent,...dates}),'Dates unavailable','invalid/impossible/reversed days cannot become dates');
assert(c.majorEventDateLabel({...parent,timezone:'unconfirmed'}).includes('Time zone unconfirmed'));
assert(c.majorEventDateLabel({...parent,startDate:'2027-01-01',endDate:'2027-01-01',timezone:'Australia/Sydney'}).includes('Sydney dates'));
const crossing=c.majorEventDateLabel({...parent,startDate:'2026-12-31',endDate:'2027-01-02',timezone:'America/New_York'});assert(crossing.includes('2026')&&crossing.includes('2027')&&crossing.includes('New York dates'));
async function followFinalDay(){
  const overviewSource=fs.readFileSync('config/event-overviews-ui.js','utf8');
  let reference=new Date('2026-11-29T12:00:00Z'),records=[parent],overview=[];
  const node=()=>({children:[],dataset:{},isConnected:true,append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=[...nodes];},setAttribute(){}});
  const environment={NOTHINGSPORTS_HORSE_COVERAGE:require('../config/horse-coverage'),document:{querySelector:()=>true,createElement:node},fetch:async()=>({ok:true,json:async()=>({events:overview})}),
    nowAEST:()=>reference,formatDateKey:require('../config/major-events').dateKey,MAJOR_EVENTS:require('../config/major-events'),
    loadMajorEventsData:async()=>{},majorEventsDocument:{get events(){return records;}},majorEventActionEvent:()=>({}),
    COMPETITION_CLASSIFICATION:require('../config/competition-classification'),FOLLOW_FEED_POLICY:{activeEligible:()=>true,editionKey:e=>e.id},
    majorEventDateLabel:c.majorEventDateLabel,buildEventEditionToggle:node,installFollowEventBulk:()=>{},userPreferences:{}};
  vm.createContext(environment);vm.runInContext(overviewSource,environment);
  const editions=async()=>{const container=node();await environment.NOTHINGSPORTS_EVENT_OVERVIEWS_UI.followRows(container,'rugby');return container.children.map(e=>e.dataset.edition).filter(Boolean);};
  assert((await editions()).includes(parent.id),'published final day is visible before Sydney midnight');
  reference=new Date('2026-11-29T17:00:00Z');
  assert((await editions()).includes(parent.id),'the final is not hidden while its published London day continues in Sydney next day');
  reference=new Date('2026-11-30T00:00:00Z');
  assert(!(await editions()).includes(parent.id),'the parent leaves current editions after its published London calendar day');
  records=[{...parent,timezone:'Australia/Sydney'}];reference=new Date('2026-11-29T12:59:00Z');
  assert((await editions()).includes(parent.id));reference=new Date('2026-11-29T13:00:00Z');assert(!(await editions()).includes(parent.id),'Sydney programme retains its Sydney day boundary');
  for(const timezone of [undefined,'unconfirmed']){records=[{...parent,timezone}];assert(!(await editions()).includes(parent.id),'unknown timezone retains the existing Sydney fallback');}
  records=[];overview.push({...parent,startDate:undefined,date:'2026-11-27',timezone:'Europe/London'});
  assert(!(await editions()).includes(parent.id),'ordinary projected overviews retain their existing Australian date boundary');
  assert.equal(JSON.stringify(parent),before,'Follow filtering changes no published calendar or fixture facts');
}
followFinalDay().then(()=>console.log('Event calendars retain sourced dates and current venue-day visibility.')).catch(error=>{console.error(error);process.exitCode=1;});
