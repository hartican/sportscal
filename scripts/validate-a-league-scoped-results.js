'use strict';
// Owned real entrypoint/transport/child doubles only. Every sporting response
// below is constructed from retained identities; none is a current observation.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module');
const contract=require('./lib/a-league-score-contract'),adapter=require('./lib/a-league-schedule');
const ROOT=path.resolve(__dirname,'..'),AT='2026-10-31T04:00:00.000Z';
const historical=require('./fixtures/a-league-official-structure-20261016.json');
// Fixed pre-adoption156-row facts/projections and the separately captured11
// accepted result patches. Never seed an old-clock test from mutable live data.
const frozenBytes=fs.readFileSync(path.join(__dirname,'fixtures/a-league-owned-fixed-20261031.json.gz'));
assert.equal(contract.sha(frozenBytes),'95444439eca1e935d1777dbebaa0ba277f995ffc35dbab625e805bbb5eed6912');
const frozenJson=require('node:zlib').gunzipSync(frozenBytes,{maxOutputLength:2*1024*1024});
assert.equal(contract.sha(frozenJson),'86fe05bcd9532048f7ea8994a5afb9f097fc1ab2f89e73fdf3e652f393d26ddf');
const frozen=JSON.parse(frozenJson);assert.equal(frozen.preClock,AT);assert.equal(Object.keys(frozen.postResultPatches).length,11);
function fixedDocument(file,post=false){
 const document=structuredClone(frozen.documents[file]),key=file===contract.FILE?'events':'fixtures';
 if(post)document[key]=document[key].map(row=>frozen.postResultPatches[row.canonicalEventId]?{...row,...structuredClone(frozen.postResultPatches[row.canonicalEventId])}:row);
 return document;
}
const previous=fixedDocument(contract.FILE),adopted=fixedDocument(contract.FILE,true);
function seedOwnedFixtures(root,post){
 const document=fixedDocument(contract.FILE,post);
 fs.writeFileSync(path.join(root,contract.FILE),JSON.stringify(document,null,2)+'\n');
 fs.writeFileSync(path.join(root,contract.FILE.replace('.json','.js')),'globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES = globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES || {}; globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES["a-league-men"] = '+JSON.stringify(document)+';\n');
 for(const file of ['data/code-inspector/football.json','data/follow-schedule/football.json']){
  const current=JSON.parse(fs.readFileSync(path.join(root,file),'utf8')),fixed=fixedDocument(file,post),rows=new Map(fixed.fixtures.map(row=>[row.canonicalEventId,row]));let count=0;
  assert.equal(rows.size,156);
  const fixtures=current.fixtures.map(row=>{if(row.competitionId!=='competition:a-leagues')return row;assert(rows.has(row.canonicalEventId));count++;return rows.get(row.canonicalEventId);});
  assert.equal(count,156);assert.equal(fixtures.length,current.fixtures.length);
  fs.writeFileSync(path.join(root,file),JSON.stringify({...fixed,fixtures})+'\n');
 }
 return document;
}
const matches=(document=previous,observedAt=AT)=>historical.map(raw=>{const m=structuredClone(raw),old=document.events.find(row=>row.officialMatchId===m.id);m.startDate=Date.parse(old.startTimeUtc);m.matchStatus=old.status==='completed'?'Played':'Fixture';m.lastUpdated=Date.parse(old.result?.source?.providerUpdatedAt||observedAt);m.homeScore=old.homeScore??0;m.awayScore=old.awayScore??0;m.liveData={matchDetails:{scores:{total:{home:m.homeScore,away:m.awayScore}}}};return m;});
const target=contract.scope.records.find(row=>row.target),sha=contract.sha,cases=[];let seenSourceError;
function final(payload,id=target.officialMatchId,home=0,away=0){const row=payload.find(m=>m.id===id);row.matchStatus='Played';row.homeScore=home;row.awayScore=away;row.liveData.matchDetails.scores.total={home,away};return payload;}
function evaluate(payload,document=previous){return contract.evaluate(payload,document,{observedAt:AT,bodySha256:'a'.repeat(64),now:new Date(AT)});}
async function check(name,fn){await fn();cases.push(name);}
const real={load:Module._load,read:fs.readFileSync,write:fs.writeFileSync,mkdir:fs.mkdirSync};
async function canonical({failChild=false,failConsole=false,failDiagnostic=false,unrelated=false,extra=[],existingOutput=false,missingClub=false,sourceRefusal=false,denyCapture=false,nonJson=false,postAdoption=false,invalidPostClock=false,preflightOnly=false}={}){
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ns-a-league-score-owned-'))),root=path.join(temporary,'fixture'),output=path.join(temporary,'evidence');
 const files=[contract.FILE,contract.FILE.replace('.json','.js'),'data/canonical/football-directory.v1.json','data/canonical/football-directory.v1.js','data/canonical/football-follow-index.v1.json','data/canonical/football-follow-index.v1.js','config/card-identities.js','data/code-inspector/football.json','data/follow-schedule/football.json','feeds/incoming/events.json','data/events.json','index.html','config/venue-panel-ui.js','assets/js/tournament-card-ui.js'];
 for(const folder of ['data/code-inspector','data/follow-schedule'])for(const name of fs.readdirSync(path.join(ROOT,folder)))if(name.endsWith('.json')&&!files.includes(folder+'/'+name))files.push(folder+'/'+name);
 for(const file of files){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.copyFileSync(path.join(ROOT,file),path.join(root,file));}
 const initial=seedOwnedFixtures(root,postAdoption);let observationAt=postAdoption&&!invalidPostClock?frozen.postClock:AT;
 for(const file of require('./build-app-shell-runtime').generatedFiles()){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),'owned old '+file);files.push(file);}
 if(existingOutput){fs.mkdirSync(output);fs.writeFileSync(path.join(output,'owned-retained'),'unchanged');}
 if(missingClub){const file=path.join(root,'data/canonical/football-directory.v1.json'),d=JSON.parse(fs.readFileSync(file));d.teams=d.teams.filter(row=>row.id!==contract.scope.clubs[0].id);fs.writeFileSync(file,JSON.stringify(d));}
 fs.writeFileSync(path.join(root,'data/owned-existing.html'),'owned original html');files.push('data/owned-existing.html');
 const originalBytes=new Map(files.map(file=>[file,fs.readFileSync(path.join(root,file))]));
 const payload=postAdoption?matches(initial,observationAt):final(matches()),calls=[],children=[];seenSourceError=null;let actualFixtureGateExecuted=false;
 const https=require('node:https'),{EventEmitter}=require('node:events'),get=https.get,OriginalDate=global.Date;global.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[observationAt]));}static now(){return OriginalDate.parse(observationAt);}};
 https.get=(url,options,callback)=>{calls.push(url);assert.equal(url,adapter.SOURCE);assert(!Object.keys(options.headers).some(k=>/token|cookie|authorization/i.test(k)));const req=new EventEmitter();req.destroy=()=>{};queueMicrotask(()=>{const response=new EventEmitter();response.statusCode=sourceRefusal?503:200;const bytes=Buffer.from(JSON.stringify(payload));response.headers={'content-type':'application/json','content-length':String(bytes.length)};response.complete=true;response.destroy=()=>{};callback(response);response.emit('data',bytes);response.emit('end');});return req;};
 const argv=process.argv,env={...process.env},cwd=process.cwd(),exit=process.exitCode,log=console.log,warn=console.warn,error=console.error;
 fs.writeFileSync=(p,...args)=>{if(denyCapture&&path.basename(String(p))==='encoded-body.bin')throw Error('OWNED_CAPTURE_DENIED');if(failDiagnostic&&String(p)===path.join(temporary,'refresh.json'))throw Error('OWNED_DIAGNOSTIC_FAILURE');assert(path.resolve(String(p)).startsWith(temporary+'/'),'write escaped owned fixture');return real.write(p,...args);};fs.mkdirSync=(p,...args)=>{assert(path.resolve(String(p))===temporary||path.resolve(String(p)).startsWith(temporary+'/'),'mkdir escaped owned fixture');return real.mkdir(p,...args);};
 Module._load=function(request,parent,...args){
  if(parent?.filename===path.join(ROOT,'scripts/lib/a-league-score-owner.js')&&request==='./a-league-source-json'){const library=real.load.call(this,request,parent,...args);return {...library,createReader:options=>{const reader=library.createReader(options);return {...reader,read:(...a)=>reader.read(...a).catch(error=>{seenSourceError=error;throw error;})};}};}
  if(parent?.filename===path.join(ROOT,'scripts/update-cards.js')&&request==='./lib/a-league-schedule')return {...adapter,refresh:()=>adapter.refresh({root,force:true,now:new Date(observationAt),fetchImpl:async url=>{calls.push(url);assert.equal(url,adapter.SOURCE);return {ok:true,text:async()=>JSON.stringify(payload)};}})};
  if(request==='./lib/refresh-child'||request==='../lib/refresh-child')return {run:(_runner,args)=>{children.push(args);return {status:0,stdout:'',stderr:''};}};
  if(parent?.filename===path.join(ROOT,'scripts/update-cards.js')&&request==='./lib/a-league-score-owner')return {...real.load.call(this,request,parent,...args),run:options=>real.load.call(this,request,parent,...args).run({...options,root,now:new Date(observationAt),runStep:(_deadline,...step)=>{children.push(step);if(step[0]==='scripts/build-code-inspector.js'){const file=path.join(ROOT,'scripts/build-code-inspector.js'),builder=new Module(file,module);builder.filename=file;builder.paths=Module._nodeModulePaths(path.dirname(file));builder._compile(real.read(file,'utf8').replace('const ROOT = path.resolve(__dirname, "..");','const ROOT = '+JSON.stringify(root)+';'),file);builder.exports.build({codeSlugs:['football'],outputDir:path.join(root,'data/code-inspector'),aLeagueResultIds:[target.canonicalEventId]});}if(step[0]==='scripts/validate-fixtures-contract.js'){const file=path.join(ROOT,step[0]),gate=new Module(file,module),oldLog=console.log;gate.filename=file;gate.paths=Module._nodeModulePaths(path.dirname(file));try{console.log=()=>{};gate._compile(real.read(file,'utf8'),file);actualFixtureGateExecuted=true;}finally{console.log=oldLog;}}if(nonJson){fs.writeFileSync(path.join(root,'data/owned-existing.html'),'owned changed html');fs.writeFileSync(path.join(root,'data/owned-new.txt'),'owned new text');}if(unrelated)fs.writeFileSync(path.join(root,'data/canonical/football-directory.v1.json'),'{}');if(failChild){fs.writeFileSync(path.join(root,'data/owned-new.json'),'{}');fs.writeFileSync(path.join(root,require('./build-app-shell-runtime').generatedFiles()[0]),'owned changed');throw Error('OWNED_CHILD_FAILURE');}}})};
  return real.load.call(this,request,parent,...args);
 };
 try{
  process.chdir(root);process.argv=[process.execPath,path.join(ROOT,'scripts/update-cards.js'),'--a-league','--a-league-results-only','--local-only','--a-league-results-evidence='+output,...extra];process.env.FOOTBALL_DATA_RUN_DIR=path.join(temporary,'football-diagnostics');process.env.GOLF_SOURCE_REPORT=path.join(temporary,'golf.json');process.env.REFRESH_REPORT=path.join(temporary,'refresh.json');console.log=()=>{if(failConsole)throw Error('OWNED_CONSOLE_FAILURE');};console.warn=()=>{};console.error=()=>{};
  if(preflightOnly){contract.preflight(root,new Date(observationAt));assert.equal(calls.length,0);return;}
  const file=path.join(ROOT,'scripts/update-cards.js'),m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(real.read(file,'utf8')+'\nmodule.exports.ownedMain=main;',file);
  let failure;
  for(let confirmation=0;confirmation<(postAdoption?2:1);confirmation++){
   if(confirmation){observationAt=frozen.postRepeatClock;process.argv=process.argv.map(arg=>arg.startsWith('--a-league-results-evidence=')?'--a-league-results-evidence='+output+'-repeat':arg);}
   try{await m.exports.ownedMain();}catch(e){failure=e;break;}
  }
  const updated=JSON.parse(fs.readFileSync(path.join(root,contract.FILE)));
  if(extra.length||existingOutput||missingClub||invalidPostClock){assert(failure);if(invalidPostClock)assert.equal(failure.aLeagueCode,'retained-clock');assert.equal(calls.length,0);assert.equal(children.length,0);for(const [f,b]of originalBytes)assert(fs.readFileSync(path.join(root,f)).equals(b));if(existingOutput){assert.deepEqual(fs.readdirSync(output),['owned-retained']);assert.equal(fs.readFileSync(path.join(output,'owned-retained'),'utf8'),'unchanged');}else assert(!fs.existsSync(output));}
  else if(failChild||failConsole||unrelated||sourceRefusal||nonJson){assert(failure);if(sourceRefusal){assert.equal(failure.message,'A-League HTTP 503');assert.equal(failure,seenSourceError,'First native source exception identity changed');}if(nonJson)assert(!fs.existsSync(path.join(root,'data/owned-new.txt')),'new non-JSON artifact survived rollback');if(failChild)assert.equal(failure.message,'OWNED_CHILD_FAILURE');if(failConsole)assert.equal(failure.message,'OWNED_CONSOLE_FAILURE');for(const [f,b]of originalBytes)assert(fs.readFileSync(path.join(root,f)).equals(b),f+' failed full restoration');assert(!fs.existsSync(path.join(root,'data/owned-new.json')));assert(!fs.existsSync(path.join(root,contract.FILE+'.candidate')));}
  else{if(failure)throw failure;assert(actualFixtureGateExecuted,'Actual canonical route did not execute the required fixture gate');assert.equal(calls.length,postAdoption?2:1);if(postAdoption){assert.deepEqual(updated,initial,'Post-adoption confirmation renewed facts or clocks');for(const [f,b]of originalBytes)assert(fs.readFileSync(path.join(root,f)).equals(b),'Post-adoption idempotence changed '+f);assert(!children.some(step=>step[0]==='scripts/build-code-inspector.js'),'Unchanged confirmations must not rebuild results');}assert.equal(updated.events.find(e=>e.id===target.id).status,'completed');for(const row of updated.events){const old=initial.events.find(e=>e.id===row.id);if(row.id!==target.id)assert.deepEqual(row,old,'Unrelated source record changed');else for(const key of Object.keys(old))if(!contract.RESULT_FIELDS.includes(key))assert.deepEqual(row[key],old[key],'Unchanged non-result fact/clock changed: '+key);}assert.equal(updated.checkedAt,initial.checkedAt);for(const f of ['config/card-identities.js','data/canonical/football-directory.v1.json','feeds/incoming/events.json','data/events.json'])assert(fs.readFileSync(path.join(root,f)).equals(originalBytes.get(f)));}
  return {calls,children};
 }finally{global.Date=OriginalDate;https.get=get;process.chdir(cwd);Module._load=real.load;fs.writeFileSync=real.write;fs.mkdirSync=real.mkdir;process.argv=argv;process.exitCode=exit;console.log=log;console.warn=warn;console.error=error;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];for(const [k,v]of Object.entries(env))process.env[k]=v;fs.rmSync(temporary,{recursive:true,force:true});}
}
async function run(){
 await check('actual canonical and existing projection builder preserve unrelated facts and clocks',()=>canonical());
 await check('actual late child failure restores every source/generated/runtime byte and removes new files',()=>canonical({failChild:true}));
 await check('throwing success diagnostics rolls back before failure reporting',()=>canonical({failConsole:true}));
 await check('throwing failure diagnostics cannot skip rollback or replace first failure',()=>canonical({failChild:true,failDiagnostic:true}));
 await check('unrelated source artifact changes fail the candidate and restore originals',()=>canonical({unrelated:true}));
 for(const extra of [['--quick'],['--local-only'],['--source=football']])await check('actual CLI mixed flags reject before acquisition '+extra[0],()=>canonical({extra}));
 await check('existing evidence namespace is never overwritten or used for failure diagnostics',()=>canonical({existingOutput:true}));
 await check('missing retained club refuses before GET instead of bootstrapping ESPN',()=>canonical({missingClub:true}));
 await check('refusal evidence write failure preserves first native source exception',()=>canonical({sourceRefusal:true,denyCapture:true}));
 await check('protected non-JSON mutation and new artifact are both rolled back',()=>canonical({nonJson:true}));
 await check('top-level accepted final conflict cannot hide behind missing nested totals',()=>{const p=final(matches());p[0].homeScore=99;p[0].liveData.matchDetails.scores.total={};assert.throws(()=>evaluate(p),/accepted-final-conflict/);});
 await check('frozen retained preflight is internally consistent with all three surfaces',()=>canonical({preflightOnly:true}));
 await check('post-adoption actual canonical confirmations preserve all11 accepted finals and original clocks twice',()=>canonical({postAdoption:true}));
 await check('post-adoption old observation clock still rejects before any source work',()=>canonical({postAdoption:true,invalidPostClock:true}));
 await check('post-adoption settled target score conflict still rejects',()=>{const payload=matches(adopted,frozen.postClock),row=payload.find(match=>match.id===target.officialMatchId);row.homeScore++;row.liveData.matchDetails.scores.total.home=row.homeScore;assert.throws(()=>contract.evaluate(payload,adopted,{observedAt:frozen.postClock,bodySha256:'c'.repeat(64),now:new Date(frozen.postClock)}),/accepted-final-conflict/);});
 await check('zero draw accepted only for the selected retained result',()=>{const r=evaluate(final(matches()));assert.equal(r.changed.length,1);assert.equal(r.document.events.find(e=>e.id===target.id).homeScore,0);assert.deepEqual(r.document.events.filter(e=>e.id!==target.id),previous.events.filter(e=>e.id!==target.id));});
 for(const [label,edit]of [ ['negative',m=>m.liveData.matchDetails.scores.total.home=-1],['missing',m=>delete m.liveData.matchDetails.scores.total.away],['string',m=>m.liveData.matchDetails.scores.total.home='0'],['nonfinal',m=>m.matchStatus='Fixture'] ])await check(label+' score remains a local deferral alongside an independent valid target',()=>{const p=final(matches());edit(p.find(m=>m.id===target.officialMatchId));const other=contract.scope.records.filter(r=>r.target)[1];final(p,other.officialMatchId,2,1);const r=evaluate(p);assert.equal(r.changed.length,1);assert(r.deferrals.some(d=>d.id===target.id));});
 for(const [label,edit]of [['duplicate',p=>p.push(p[0])],['missing collection',p=>p.pop()],['new ID',p=>p[0].id='unknown'],['wrong ordered clubs',p=>p[0].homeTeam.id='wrong'],['round',p=>p[0].week='99'],['season',p=>p[0].tournament.id='wrong'],['calendar',p=>p[0].startDate+=86400000],['future result',p=>final(p,contract.scope.records.at(-1).officialMatchId)],['provider future clock',p=>p[0].lastUpdated=Date.parse(AT)+1000],['accepted final reopening',p=>p[0].matchStatus='Fixture'],['masked accepted final score conflict',p=>{p[0].liveData.matchDetails.scores.total.home=99;delete p[0].liveData.matchDetails.scores.total.away;}],['contradictory totals',p=>p.find(m=>m.id===target.officialMatchId).homeScore=9]])await check(label+' rejects whole candidate',()=>{const p=final(matches());edit(p);assert.throws(()=>evaluate(p));});
 await check('no supported result is failure, not fresh unchanged success',()=>assert.throws(()=>evaluate(matches()),/no-supported/));
 await check('repeated identical final preserves prior result clocks and all facts',()=>{const p=final(matches()),first=evaluate(p).document,next=contract.evaluate(p,first,{observedAt:'2026-10-31T04:01:00.000Z',bodySha256:'b'.repeat(64),now:new Date('2026-10-31T04:01:00Z')});assert.deepEqual(next.document,first);assert.deepEqual(next.changed,[]);});
 await check('missing/duplicate/mixed/nonlocal scopes refuse before source',()=>{const correct=['--a-league','--a-league-results-only','--local-only','--a-league-results-evidence=/tmp/owned'];assert(contract.route(correct));for(const argv of [correct.slice(1),correct.filter(a=>a!=='--local-only'),[...correct,'--quick'],[...correct,'--local-only'],[...correct,'-p'],['--a-league-results-extra']])assert.throws(()=>contract.route(argv));});
 console.log(JSON.stringify({status:'PASS',controls:cases.length,externalRequests:0,currentOfficialFinalsObserved:0,constructedSportingResponses:true,cases},null,2));
}
run().catch(error=>{console.error(error);process.exitCode=1;});
