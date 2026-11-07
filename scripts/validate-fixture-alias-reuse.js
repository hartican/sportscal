'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function run(){
 const identity=require('../config/fixture-identity');
 const ca='fixture:cricket:CA:39484',espn='fixture:cricket:espn:1513451';
 for(const id of [ca,espn,'fixture-cricket-CA-39484'])assert.equal(identity.canonicalFixtureId(id),ca);
 assert.deepEqual(identity.fixtureAliases(espn),[ca,'fixture-cricket-CA-39484',espn]);
 assert.deepEqual(identity.fixtureAliases('event:lemans:2026:start'),['evt_79','evt_79','event:lemans:2026:start'],'Existing duplicate compatibility tokens and their order remain exact');
 const target='rugby-australia-south-africa-2026-09-27',wr='fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945',ra='fixture:rugby:ra:949625';
 assert.deepEqual(identity.fixtureAliases(target),[target,target,wr,wr.replace(/:/g,'-'),ra,ra.replace(/:/g,'-')]);
 for(const id of ['fixture:cricket:espn:1513452','FIXTURE:CRICKET:CA:39484','fixture-rugby-unreviewed','new:unknown']){
  assert.equal(identity.canonicalFixtureId(id),id);assert.deepEqual(identity.fixtureAliases(id),[id]);
 }
 for(const id of [null,undefined,0,false,''])assert.equal(identity.canonicalFixtureId(id),'');
 const aliases=identity.fixtureAliases(espn);aliases[0]='changed';aliases.push('unreviewed');assert.deepEqual(identity.fixtureAliases(espn),[ca,'fixture-cricket-CA-39484',espn],'Returned aliases cannot change later fixture identities');
 const dateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'});
 for(const instant of ['2026-04-04T15:30:00Z','2026-04-04T16:30:00Z','2026-10-03T15:30:00Z','2026-10-03T16:30:00Z','2028-02-29T13:30:00Z']){
  const input={id:'diagnostic-date-only',key:'nrl',startTimeUtc:instant,timePrecision:'date-only',date:'',sourceCheckedAt:'2026-10-16T16:12:00Z'};
  const before=JSON.stringify(input);for(let repeat=0;repeat<3;repeat++){const normalized=identity.normalizeCore(input);assert.equal(normalized.date,dateFormatter.format(new Date(instant)));assert.equal(normalized.startTimeUtc,instant);assert.equal(normalized.sourceCheckedAt,input.sourceCheckedAt);assert.equal(normalized.time,null);}
  assert.equal(JSON.stringify(input),before,'Formatter reuse never edits sporting input or check dates');
 }
 const source=fs.readFileSync(path.join(__dirname,'../config/fixture-identity.js'),'utf8');
 const declaration=source.indexOf('const FIXTURE_ALIASES='),end=source.indexOf(';',declaration)+1;assert(declaration>=0&&end>declaration);
 // Controlled identity tables exercise compatibility collisions and one-hop
 // resolution; they never enter published sporting data or add public hooks.
 const table={first:'a:b-c',second:'a-b:c',old:'middle',middle:'final'};
 const load=values=>{const context={module:{exports:{}}};vm.runInNewContext(source.slice(0,declaration)+'const FIXTURE_ALIASES='+JSON.stringify(values)+';'+source.slice(end),context);return context.module.exports;};
 const custom=load(table),plain=value=>JSON.parse(JSON.stringify(value));
 assert.equal(custom.canonicalFixtureId('a-b-c'),'a:b-c','A collapsed collision preserves the first declared target');
 assert.equal(custom.canonicalFixtureId('old'),'middle','Declared aliases resolve once, without inventing transitive identity');
 assert.deepEqual(plain(custom.fixtureAliases('old')),['middle','middle','old']);
 assert.equal(load({...table,'a-b-c':'explicit'}).canonicalFixtureId('a-b-c'),'explicit','Explicit reviewed identity wins over collapsed compatibility');
 const chained=plain(custom.mergeOverlays([{id:'old',key:'nrl'}],[]));assert.equal(chained.length,1);assert.equal(chained[0].id,'final');assert.deepEqual(chained[0].sourceEventIds,['old','middle','final'],'Reconciliation retains identities introduced by an earlier reviewed target');
 console.log('Fixture aliases: explicit/collapsed/unknown IDs, reverse order, duplicate tokens, detached results, collision precedence and one-hop compatibility passed.');
}
if(require.main===module)run();
module.exports=run;
