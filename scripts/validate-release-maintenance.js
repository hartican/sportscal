#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const maintenance=require('./lib/football-directory-maintenance'),editorial=require('./update-sport-editorial-depth');
const project=path.resolve(__dirname,'..');
async function main(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-maintenance-'));
  const names=['data/canonical/football-directory.v1.json','data/canonical/football-directory.v1.js','data/canonical/football-follow-index.v1.json','data/canonical/football-follow-index.v1.js','data/canonical/afl-nrl-2026.json','data/editorial-knowledge.v1.json','data/events.json','feeds/incoming/events.json'];
  try{
    for(const name of names){fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.copyFileSync(path.join(project,name),path.join(root,name));}
    const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8')),write=(n,v)=>fs.writeFileSync(path.join(root,n),JSON.stringify(v,null,2)+'\n');
    const file='data/canonical/football-directory.v1.json',original=read(file);
    const reset=()=>write(file,{...original,generatedAt:new Date(Date.now()-31*86400000).toISOString()});
    let requests=0,fail=false,missing=false,rosterFailure=false;
    const fetchImpl=async(url,options)=>{
      requests++;assert(options.signal instanceof AbortSignal);assert.equal(options.redirect,'error');
      if(fail || (rosterFailure&&url.endsWith('/roster')))return {ok:false,status:503};
      const code=url.split('/soccer/')[1].split('/')[0],key=Object.keys({'premier-league':'eng.1',bundesliga:'ger.1','la-liga':'esp.1','serie-a':'ita.1','ligue-1':'fra.1'}).find(k=>({'premier-league':'eng.1',bundesliga:'ger.1','la-liga':'esp.1','serie-a':'ita.1','ligue-1':'fra.1'})[k]===code);
      const league=original.leagues.find(l=>l.key===key),teams=original.teams.filter(t=>t.leagueId===league.id);
      const team=teams.find(t=>url.includes('/teams/'+t.externalIds.espn+'/roster'));
      const payload=team?{athletes:original.players.filter(p=>p.currentTeamId===team.id).map(p=>({id:p.externalIds.espn})).slice(missing?1:0)}:{sports:[{leagues:[{teams:teams.map(t=>({team:{id:t.externalIds.espn}}))}]}]};
      return {ok:true,text:async()=>JSON.stringify(payload)};
    };
    assert.equal((await maintenance.refreshDue({root,fetchImpl,now:new Date(original.generatedAt)})).requests,0,'fresh directory performs no request');
    reset();const before=fs.readFileSync(path.join(root,file));
    assert.equal((await maintenance.refreshDue({root,fetchImpl,offline:true})).state,'offline-retained');assert.equal(requests,0);
    fail=true;await assert.rejects(maintenance.refreshDue({root,fetchImpl}),/503/);assert.deepEqual(fs.readFileSync(path.join(root,file)),before,'failed source retains last-good bytes');
    fail=false;missing=true;const absent=await maintenance.refreshDue({root,fetchImpl});assert(absent.absent>0);assert(read(file).players.some(p=>p.rosterStatus==='unconfirmed'&&p.currentTeamStatus==='last-known'),'absence retains identity without inventing membership');reset();
    missing=false;rosterFailure=true;reset();const partial=await maintenance.refreshDue({root,fetchImpl});assert.equal(partial.deferred.length,96);assert.deepEqual(read(file).players,original.players,'failed rosters retain original player facts and dates');rosterFailure=false;reset();requests=0;const result=await maintenance.refreshDue({root,fetchImpl});assert.equal(result.requests,101);assert.equal(requests,101);
    const verified=read(file);assert.deepEqual(verified.teams.map(t=>t.id),original.teams.map(t=>t.id));assert.deepEqual(verified.players.map(p=>p.id),original.players.map(p=>p.id));assert.deepEqual(verified.sources.filter(s=>original.sources.some(o=>o.id===s.id)&&!s.id.includes(':clubs-current')&&!s.id.startsWith('source:football:roster:')),original.sources.filter(s=>!s.id.includes(':clubs-current')&&!s.id.startsWith('source:football:roster:')),'unread official pages retain dates');
    requests=0;assert.equal((await maintenance.refreshDue({root,fetchImpl})).changed,false);assert.equal(requests,0,'repeat is source-free');
    const fixture=read('data/events.json').events.find(e=>e.id==='epl-2026-27-129016');assert(fixture);
    for(const name of ['data/events.json','feeds/incoming/events.json']){const d=read(name);d.events=d.events.map(e=>e.id===fixture.id?{...e,editorialNarrative:null}:e);write(name,d);}
    const baseline=read('data/events.json').events,clock=fixture.canonicalSourceCheckedAt;
    const repaired=editorial.repairMissing({root});assert(repaired.repaired.includes(fixture.id));
    const after=read('data/events.json').events;assert(after.find(e=>e.id===fixture.id).editorialNarrative.hook);assert.equal(after.find(e=>e.id===fixture.id).canonicalSourceCheckedAt,clock);
    assert.deepEqual(after.filter(e=>!repaired.repaired.includes(e.id)),baseline.filter(e=>!repaired.repaired.includes(e.id)),'missing preview repair preserves other cards');
    const bytes=names.map(name=>fs.readFileSync(path.join(root,name)));
    assert.equal(editorial.repairMissing({root}).changed,false);
    names.forEach((name,i)=>assert.deepEqual(fs.readFileSync(path.join(root,name)),bytes[i],'unchanged repair retains bytes'));
    const full=require('./update-cards').buildSteps({localOnly:true});assert(full.some(s=>s[0]==='scripts/refresh-football-directory.js'&&s.includes('--refresh-due')));
    const quick=fs.readFileSync(path.join(project,'scripts/quick-results.js'),'utf8');assert(quick.includes('football-directory-maintenance'));assert(quick.includes('repairMissing({reference:now})'));
    console.log('Release maintenance passed: genuine bounded monthly directory checks, failed/offline/repeated retention, original IDs/source dates and missing-only researched previews.');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
