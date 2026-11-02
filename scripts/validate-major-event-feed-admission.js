#!/usr/bin/env node
'use strict';

// Frozen reference tests, not an audit of mutable current schedules or clocks.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {prepare:prepareAdmission}=require('./lib/major-event-feed-admission');
const {normalizeFeed}=require('./lib/feed-utils');
const ID='major-match:rlwc-2026:tonga-samoa';
const REFERENCE_TIME='2026-11-01T06:52:00.000Z';
// Historical reference fixtures use an explicit read-only admission clock;
// the actual canonical owner retains the real clock. Never replace global Date.
const prepare=input=>prepareAdmission(input,{referenceTime:new Date(REFERENCE_TIME)});
const clone=value=>JSON.parse(JSON.stringify(value));
function reference(){
  const child={id:ID,name:'Tonga v Samoa',competitionScope:'international',isInternational:true,
    participantsConfirmed:true,participantIds:['team:nrl:national:tonga','team:nrl:national:samoa'],
    participants:[{id:'team:nrl:national:tonga',name:'Tonga',role:'home'},{id:'team:nrl:national:samoa',name:'Samoa',role:'away'}],
    startTimeUtc:'2026-11-01T09:05:00.000Z',timePrecision:'exact',stage:'Pool B & C',roundLabel:'Pool B & C',
    venue:'CommBank Stadium, Sydney',sourceName:'International Rugby League',sourceUrl:'https://www.intrl.sport/match-details/2578',sourceCheckedAt:'2026-11-01T06:51:21.342326Z'};
  const parent={id:'major-event:rlwc-2026',sportKey:'nrl',sportLabel:'Rugby league',competitionId:'competition:rugby-league-world-cup:2026',competitionScope:'international',subEvents:[child]};
  const peer={id:'reference:peer',eventId:'reference:peer',cardKind:'fixture',key:'nrl',name:'Frozen unrelated fixture',date:'2026-11-02',time:'20:00',timePrecision:'exact',expected:null,liveWindow:3};
  const feed={schemaVersion:'events.v1',version:'reference-20261101',publishedAt:'2026-11-01T06:51:22.000Z',events:[peer]};
  return {canonical:{schemaVersion:'major-events.v1',events:[parent]},incoming:clone(feed),published:clone(feed),ids:[ID]};
}
function focused(){
  const input=reference(),before=JSON.stringify(input),result=prepare(input),card=result.published.events.at(-1);
  assert.equal(JSON.stringify(input),before);assert.equal(result.changed,true);
  assert.equal(card.id,'major-match-rlwc-2026-tonga-samoa');assert.equal(card.eventId,card.id);
  assert.equal(card.canonicalEventId,ID);assert.equal(card.actionKey,ID);assert.deepEqual(card.sourceEventIds,[ID]);
  assert.deepEqual(normalizeFeed({events:[card]}).events[0],card,'publisher normalization preserves storage and canonical identities');
  assert.equal(card.date,'2026-11-01');assert.equal(card.time,'20:05');assert.equal(card.stage,'Pool B & C');
  assert.equal(card.venue,'CommBank Stadium, Sydney');assert.equal(card.sourceCheckedAt,input.canonical.events[0].subEvents[0].sourceCheckedAt);
  const boundary=reference();boundary.canonical.events[0].subEvents[0].sourceCheckedAt='2026-11-01T06:52:00.000000Z';
  const boundaryBefore=JSON.stringify(boundary),boundaryResult=prepare(boundary);
  assert.equal(boundaryResult.published.events.at(-1).sourceCheckedAt,'2026-11-01T06:52:00.000000Z','equal reference retains raw precise observation');assert.equal(JSON.stringify(boundary),boundaryBefore);
  const offset=reference();offset.canonical.events[0].subEvents[0].sourceCheckedAt='2026-11-01T17:51:21.342326+11:00';
  assert.equal(prepare(offset).published.events.at(-1).sourceCheckedAt,offset.canonical.events[0].subEvents[0].sourceCheckedAt,'valid offset and microsecond precision are not restamped');
  assert.equal(card.status,'scheduled');assert.equal(card.expected,null);assert.equal(card.broadcaster,null);assert.deepEqual(card.viewingOptions,[]);
  assert.equal(card.editorialNarrative,undefined);assert.equal(card.scoreDisplay,undefined);assert.equal(card.actualStartTimeUtc,undefined);
  assert.deepEqual(result.published.events[0],input.published.events[0]);
  assert.equal(result.published.version,input.published.version);assert.equal(result.published.publishedAt,input.published.publishedAt);
  const again=prepare({...input,incoming:result.incoming,published:result.published});assert.equal(again.changed,false);assert.deepEqual(again.published,result.published);
  const collision=reference();collision.published.events.push({...card,canonicalEventId:'major-match:rlwc-2026:another-match',sourceEventIds:[]});
  const collisionBefore=JSON.stringify(collision);assert.throws(()=>prepare(collision),/canonical binding/);assert.equal(JSON.stringify(collision),collisionBefore,'storage collision cannot rename or duplicate a different canonical match');
  const unbound=reference();const unboundCard={...card};delete unboundCard.canonicalEventId;delete unboundCard.actionKey;delete unboundCard.sourceEventIds;
  unbound.published.events.push(unboundCard);const unboundBefore=JSON.stringify(unbound);assert.throws(()=>prepare(unbound),/canonical binding/);assert.equal(JSON.stringify(unbound),unboundBefore,'unlinked storage ID needs explicit identity review, not a duplicate');
  const mutations=[x=>{x.ids=['unknown'];},x=>{x.ids=[ID,ID];},x=>{x.canonical.events.push(clone(x.canonical.events[0]));},
    x=>{x.canonical.events[0].sportKey='rugby';},x=>{x.canonical.events[0].subEvents[0].participantIds[0]='team:rugby:tonga';},
    x=>{x.canonical.events[0].subEvents[0].sourceUrl='https://example.invalid/unreviewed';},
    x=>{x.canonical.events[0].subEvents[0].timePrecision='tbc';},x=>{x.canonical.events[0].subEvents[0].sourceCheckedAt='unobserved';},
    x=>{x.canonical.events[0].subEvents[0].startTimeUtc='2026-02-30T09:05:00.000Z';},
    x=>{x.canonical.events[0].subEvents[0].startTimeUtc='2026-11-01T25:05:00.000Z';},
    x=>{x.canonical.events[0].subEvents[0].sourceCheckedAt='2099-11-01T06:51:21.342326Z';},
    x=>{x.canonical.events[0].subEvents[0].sourceCheckedAt='2026-11-01T06:52:00.001Z';},
    x=>{x.canonical.events[0].subEvents[0].sourceCheckedAt='2026-11-01T06:52:00.000001Z';},
    x=>{x.canonical.events[0].subEvents[0].sourceCheckedAt='2026-02-30T06:51:21.342326Z';},
    x=>{x.canonical.events[0].subEvents[0].sourceCheckedAt='2026-11-01T25:51:21.342326Z';}];
  for(const mutate of mutations){const value=reference();mutate(value);const before=JSON.stringify(value);assert.throws(()=>prepare(value),/Major subevent admission:/);assert.equal(JSON.stringify(value),before);}
  const retained=clone(result.published),known=retained.events.at(-1);
  Object.assign(known,{id:'evt_retained_tonga_samoa',eventId:'evt_retained_tonga_samoa',sourceEventIds:[ID,'irl-match-2578'],status:'completed',resultStatus:'official',scoreDisplay:'Frozen confirmed result',selectedSentence:'Retained approved hook',fullSpiel:'Retained approved full preview',editorialHold:true});
  const filled=prepare({...input,published:retained});assert.deepEqual(filled.incoming.events.at(-1),known);assert.deepEqual(filled.published,retained);
  assert.equal(prepare({...input,incoming:filled.incoming,published:filled.published}).changed,false,'retained storage IDs and source aliases remain byte-idempotent');
  console.log('Major subevent admission frozen adapter assertions passed. No live/current-source audit performed.');
}
function digest(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function actualOwner(packetPath){
  // The coordinator supplies a separately frozen/constrained fixture repository.
  // This validator does not copy an unbounded tree, install dependencies, alter
  // global Date, substitute imports, or permit a production checkout as input.
  const packet=JSON.parse(fs.readFileSync(packetPath,'utf8'));
  if(packet.schemaVersion!=='major-event-admission-test.v1'||packet.localOnly!==true||!path.isAbsolute(packet.sourceRoot)||!path.isAbsolute(packet.workingRoot)||!path.isAbsolute(packet.tmpRoot)||!Array.isArray(packet.inputs)||!Array.isArray(packet.outputs)||packet.inputCount!==packet.inputs.length||packet.inputCount!==packet.requiredInputEntries||!Number.isSafeInteger(packet.inputCount)||packet.inputCount<1||packet.inputCount>4096||packet.outputs.length>190)throw Error('A frozen full local fixture packet is required');
  const positiveOnly=packet.caseSequence!==undefined;
  if(positiveOnly)assert.deepEqual(packet.caseSequence,['positive'],'current-main qualification is one positive operation only');
  const sourceRoot=fs.realpathSync(packet.sourceRoot),root=fs.realpathSync(packet.workingRoot),temporary=fs.realpathSync(packet.tmpRoot);
  const inside=(parent,file)=>file.startsWith(parent+path.sep);
  if(!sourceRoot.startsWith('/private/tmp/')||!temporary.startsWith('/private/tmp/')||!inside(temporary,root)||sourceRoot===root||inside(temporary,sourceRoot)||packet.root!==packet.sourceRoot)throw Error('Readonly source and owned temporary working roots must be distinct');
  for(const folder of [sourceRoot,root,temporary])assert.equal(fs.statSync(folder).uid,process.getuid(),'owned fixture UID');
  const safe=relative=>{if(typeof relative!=='string'||path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..'))throw Error('Unsafe packet path');return path.join(root,relative);};
  let inputBytes=0;
  for(const input of packet.inputs){
    safe(input.path);
    const file=path.join(sourceRoot,input.path),stat=fs.lstatSync(file);
    assert.equal(stat.isFile(),true,'declared source input must be a regular file');
    const working=fs.lstatSync(safe(input.path));
    assert.equal(working.isFile(),true,'working source input must be a regular file');
    assert.equal(working.nlink,1,'working inputs cannot have writable hardlinks');
    assert(stat.dev!==working.dev||stat.ino!==working.ino,'working inputs must not share immutable source inodes');
    assert.equal(stat.size,input.bytes,`input size ${input.path}`);inputBytes+=stat.size;
    assert.equal(digest(file),input.sha256,`source input ${input.path}`);
    assert.equal(digest(safe(input.path)),input.sha256,`working input ${input.path}`);
  }
  assert.equal(inputBytes,packet.inputBytes,'declared full source bytes');
  assert.equal(digest(path.join(sourceRoot,'scripts/update-cards.js')),digest(path.join(__dirname,'update-cards.js')),'actual owner code binding');
  const pinnedNode='/Users/jackhartican/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node';
  const guard=packet.runtime?.guard;
  if(typeof guard!=='string'||!path.isAbsolute(guard)||!guard.startsWith(path.dirname(sourceRoot)+path.sep))throw Error('Declared owned qualified guard is required');
  assert.equal(fs.realpathSync(process.execPath),fs.realpathSync(pinnedNode),'pinned Node required');
  assert.equal(digest(pinnedNode),'7d2b4ed360d609a4de6485b0cbea57370eee4dba157877799e83104db570cbdd','runtime binding');
  assert.equal(digest(guard),'2bc7d4324f2b3b2687a2079c12389d80c61d52db5bea93eb92d2fe43ba3e7e95','qualified network guard binding');
  const home=fs.realpathSync(packet.homeRoot);
  if(!inside(temporary,home))throw Error('Declared HOME must be owned temporary space');
  const environment={HOME:home,TMPDIR:temporary,PATH:`${path.dirname(pinnedNode)}:/usr/bin:/bin`,LANG:'C',
    NODE_PATH:'/Users/jackhartican/.codex/worktrees/raw-selection-qualification-20261022/Sportscal/node_modules',
    NODE_OPTIONS:`--require ${guard}`,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null',
    GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0',GIT_ALLOW_PROTOCOL:'file'};
  if(packet.environment?.REFRESH_REPORT){
    const evidence=fs.realpathSync(packet.evidenceRoot);
    if(!inside(temporary,evidence))throw Error('Declared evidence must be owned temporary space');
    environment.REFRESH_REPORT=path.join(evidence,'refresh-report.json');
  }
  assert.deepEqual(packet.environment,environment,'exact scrubbed declared environment; no ambient secrets or options');
  const sourceGit=path.join(sourceRoot,'.git'),workingGit=path.join(root,'.git');
  assert.equal(packet.git?.sourceReadOnlyGitDir,sourceGit,'declared readonly source Git');
  for(const directory of [sourceGit,workingGit]){
    const stat=fs.lstatSync(directory);assert.equal(stat.isDirectory(),true,'real private Git directory required');
    assert.equal(stat.uid,process.getuid(),'owned private Git directory');assert.equal(fs.realpathSync(directory),directory,'no Git directory symlink');
  }
  for(const relative of ['HEAD','config','index','packed-refs']){
    const source=path.join(sourceGit,relative),working=path.join(workingGit,relative);
    if(fs.existsSync(source)&&fs.existsSync(working)){const a=fs.statSync(source),b=fs.statSync(working);assert(a.dev!==b.dev||a.ino!==b.ino,'working Git metadata must not hardlink readonly source '+relative);}
  }
  const publicObjects='/Users/jackhartican/Documents/AI/Perplexity/Sportscal/.git/objects';
  assert.equal(packet.git.publicObjectsReadOnly,publicObjects,'only declared public borrowed objects');
  for(const directory of [sourceGit,workingGit])assert.equal(fs.readFileSync(path.join(directory,'objects/info/alternates'),'utf8').trim(),publicObjects,'declared readonly object alternates');
  const expectedHead=typeof packet.candidate==='string'?packet.candidate:packet.candidate?.commit;
  assert.match(expectedHead||'',/^[a-f0-9]{40}$/,'exact candidate SHA');
  const gitValue=(cwd,ref)=>{const result=spawnSync('/usr/bin/git',['rev-parse','--verify',ref],{cwd,env:environment,timeout:2000,maxBuffer:65536,encoding:'utf8'});if(result.error)throw result.error;assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
  for(const cwd of [sourceRoot,root]){
    assert.equal(gitValue(cwd,'HEAD'),expectedHead,'real fixture candidate HEAD');
    assert.equal(gitValue(cwd,'refs/remotes/origin/main'),positiveOnly?'a3a0f031e644c3b0a71d70fbe75f6f4ac081eacf':'98af9164d15cddfb198fd35cd9e226b267723216','retained exact origin/main');
    const listing=spawnSync('/usr/bin/git',['ls-tree','-r','-z','--name-only','HEAD'],{cwd,env:environment,timeout:2000,maxBuffer:1024*1024,encoding:'utf8'});
    if(listing.error)throw listing.error;assert.equal(listing.status,0,listing.stderr);
    assert.deepEqual(listing.stdout.split('\0').filter(Boolean).sort(),packet.inputs.map(input=>input.path).sort(),'complete exact Git input manifest, not a selected subset');
  }
  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const outputs=[...packet.outputs].sort(),allowed=new Set(outputs),ceiling=packet.outputBytesLimit??packet.outputCapacityDecision?.outputCeilingBytes;
  assert.equal(packet.outputPathsLimit,positiveOnly?121:190);assert.equal(outputs.length,packet.outputPathsLimit);assert.equal(allowed.size,packet.outputPathsLimit);assert.equal(ceiling,134217728);
  for(const relative of outputs)assert(/^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(relative)&&relative.split('/').every(part=>part!=='.'&&part!=='..'),'canonical output path');
  assert.equal(hash(JSON.stringify(outputs)),positiveOnly?'1ea83ba860f311e5a5434d8f1d5f4857d72932dfdd7432078bf7118100aceb6e':'e482d875afbf81b9597a1833f619eeb634cfc36b8d5a677c4a4c9bd1c25b04be','exact approved bounded output envelope');
  const timeouts=packet.limits?.caseTimeoutMs;
  assert.deepEqual(timeouts,{positive:145000,noop:15000,negative:5000},'declared bounded owner cases');
  assert(packet.limits.workSeconds<=180&&packet.limits.workSeconds*1000>=Object.values(timeouts).reduce((sum,value)=>sum+value,0),'case budgets must fit the separately admitted outer work limit');
  const evidence=fs.realpathSync(packet.evidenceRoot),preimagesRoot=fs.realpathSync(packet.preimagesRoot);
  assert(inside(temporary,evidence)&&!inside(root,evidence)&&evidence!==root,'forensics outside working tree');
  assert.equal(preimagesRoot,path.join(fs.realpathSync(packet.ownedRoot),'output/preimages'));
  assert(!inside(temporary,preimagesRoot),'trusted initial preimages must be outside Node-writable TMP');
  const preimages=new Map((packet.preimages||[]).map(entry=>[entry.path,entry]));
  assert.deepEqual([...preimages.keys()].sort(),outputs,'exact immutable preimage manifest');
  const forensicRoot=path.join(evidence,'owner-forensics');fs.mkdirSync(forensicRoot,{mode:0o700});
  const objectRoot=path.join(forensicRoot,'objects');fs.mkdirSync(objectRoot,{mode:0o700});
  const sealed=new Map(),objects=new Map(),trusted=new Map();let metadataBytes=0,objectBytes=0,active=null;
  const rootIdentity=fs.lstatSync(root,{bigint:true});
  const bytesFor=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
  function seal(name,bytes){
    const value=Buffer.isBuffer(bytes)?bytes:bytesFor(bytes),file=path.join(forensicRoot,name);
    assert(metadataBytes+value.length<=32*1024*1024,'bounded forensic manifests and child logs');
    fs.writeFileSync(file,value,{flag:'wx',mode:0o400});metadataBytes+=value.length;
    sealed.set(file,{bytes:value,sha256:hash(value)});return {path:name,bytes:value.length,sha256:hash(value)};
  }
  function verifySealed(){
    for(const [file,record]of sealed)assert.equal(digest(file),record.sha256,'retained forensic artifact changed');
    for(const [sha,record]of objects)assert.equal(digest(record.file),sha,'retained intermediate preimage changed');
  }
  function tree(){
    const identity=fs.lstatSync(root,{bigint:true});assert.equal(identity.dev,rootIdentity.dev);assert.equal(identity.ino,rootIdentity.ino);assert.equal(identity.uid,rootIdentity.uid);assert.equal(identity.gid,rootIdentity.gid);assert.equal(identity.mode,rootIdentity.mode);
    const directory=stat=>({kind:'directory',mode:Number(stat.mode&4095n),uid:String(stat.uid),gid:String(stat.gid),dev:String(stat.dev),ino:String(stat.ino),nlink:Number(stat.nlink),mtimeNs:String(stat.mtimeNs),ctimeNs:String(stat.ctimeNs)});
    // Include the root itself: transient create/delete churn can leave only
    // directory metadata changed, even when every final file hash agrees.
    const entries={'.':directory(identity)};let count=1;
    function visit(relative){
      for(const name of fs.readdirSync(relative?safe(relative):root).sort()){
        const key=relative?relative+'/'+name:name,file=safe(key),stat=fs.lstatSync(file,{bigint:true});
        assert(++count<=8192,'bounded complete working-tree inventory');
        const entry={mode:Number(stat.mode&4095n),uid:String(stat.uid),gid:String(stat.gid)};
        if(stat.isDirectory()){entries[key]=directory(stat);visit(key);}
        else if(stat.isSymbolicLink()){
          const target=fs.readlinkSync(file);entries[key]={...entry,kind:'symlink',targetSha256:hash(target),approvedBorrow:key==='node_modules'&&fs.realpathSync(file)===fs.realpathSync(environment.NODE_PATH)};
        }else if(stat.isFile()){
          const sha256=digest(file),after=fs.lstatSync(file,{bigint:true});
          assert.equal(stat.size,after.size,'file changed during inventory');assert.equal(stat.mtimeNs,after.mtimeNs);assert.equal(stat.ctimeNs,after.ctimeNs);
          entries[key]={...entry,kind:'file',bytes:Number(stat.size),sha256,nlink:Number(stat.nlink),dev:String(stat.dev),ino:String(stat.ino),mtimeNs:String(stat.mtimeNs),ctimeNs:String(stat.ctimeNs)};
        }else entries[key]={...entry,kind:'unsupported'};
      }
    }
    visit('');return entries;
  }
  function preserve(relative,entry){
    if(!entry)return {exists:false};
    if(entry.kind!=='file')return {exists:true,kind:entry.kind,bytes:null};
    const original=trusted.get(entry.sha256);
    if(original)return {exists:true,bytes:entry.bytes,sha256:entry.sha256,preimage:original};
    if(!objects.has(entry.sha256)){
      assert(objectBytes+entry.bytes<=4*ceiling,'four bounded states of unique forensic content within the existing growth envelope');
      const bytes=fs.readFileSync(safe(relative));assert.equal(bytes.length,entry.bytes);assert.equal(hash(bytes),entry.sha256,'stable output preimage');
      const file=path.join(objectRoot,entry.sha256);fs.writeFileSync(file,bytes,{flag:'wx',mode:0o400});
      objects.set(entry.sha256,{file,bytes});objectBytes+=bytes.length;
    }
    return {exists:true,bytes:entry.bytes,sha256:entry.sha256,preimage:{storage:'parent-buffered-hash-bound-evidence',path:'objects/'+entry.sha256}};
  }
  function capture(label){
    const entries=tree(),declared={};let bytes=0;
    for(const relative of outputs){const entry=entries[relative];if(entry?.kind==='file')bytes+=entry.bytes;}
    const withinCeiling=bytes<=ceiling;
    for(const relative of outputs)declared[relative]=withinCeiling?preserve(relative,entries[relative]):{exists:Boolean(entries[relative]),bytes:entries[relative]?.bytes??null,sha256:entries[relative]?.sha256??null,preimage:'working fixture retained on output-cap HOLD'};
    const snapshot={label,complete:true,workingRoot:root,entries,declaredOutputs:declared,declaredBytes:bytes,ceiling,withinCeiling,uniqueForensicBytes:objectBytes};
    seal(label+'.json',snapshot);return snapshot;
  }
  function differences(before,after){
    return [...new Set([...Object.keys(before.entries),...Object.keys(after.entries)])].sort().filter(relative=>JSON.stringify(before.entries[relative])!==JSON.stringify(after.entries[relative]));
  }
  function accountedDirectoryMutation(relative,beforeSnapshot,afterSnapshot){
    const before=beforeSnapshot.entries[relative],after=afterSnapshot.entries[relative];
    if(!beforeSnapshot.complete||!afterSnapshot.complete||!before||!after||before.kind!=='directory')return false;
    if(['kind','mode','uid','gid','dev','ino'].some(key=>before[key]!==after[key]))return false;
    if(before.nlink===after.nlink)return true;
    const prefix=relative==='.'?'':relative+'/';
    const children=snapshot=>Object.keys(snapshot.entries).filter(key=>key!=='.'&&key.startsWith(prefix)&&!key.slice(prefix.length).includes('/'));
    const beforeChildren=children(beforeSnapshot),afterChildren=children(afterSnapshot);
    if(before.nlink!==beforeChildren.length+2||after.nlink!==afterChildren.length+2)return false;
    const membership=[...new Set([...beforeChildren,...afterChildren])].filter(key=>beforeSnapshot.entries[key]?.kind!==afterSnapshot.entries[key]?.kind);
    if(!membership.length||!membership.every(key=>allowed.has(key)&&[beforeSnapshot.entries[key],afterSnapshot.entries[key]].every(entry=>!entry||(entry.kind==='file'&&entry.nlink===1))))return false;
    const delta=membership.reduce((sum,key)=>sum+Number(Boolean(afterSnapshot.entries[key]))-Number(Boolean(beforeSnapshot.entries[key])),0);
    return after.nlink-before.nlink===delta;
  }
  function assertDirectoryLinkAccounting(){
    const parent='data/feed',first=parent+'/page-001.json',second=parent+'/page-002.json';
    assert(allowed.has(first)&&allowed.has(second),'accounting controls use declared output paths');
    const directory={kind:'directory',mode:493,uid:String(rootIdentity.uid),gid:String(rootIdentity.gid),dev:'1',ino:'2',nlink:4};
    const before={complete:true,entries:{[parent]:directory,[first]:{kind:'file',nlink:1},[second]:{kind:'file',nlink:1}}};
    const after={complete:true,entries:{[parent]:{...directory,nlink:3},[first]:{kind:'file',nlink:1}}};
    assert.equal(accountedDirectoryMutation(parent,before,after),true,'declared immediate regular-file removal accounts for native directory links');
    assert.equal(accountedDirectoryMutation(parent,after,before),true,'declared immediate regular-file creation accounts for native directory links');
    assert.equal(accountedDirectoryMutation(parent,before,before),true,'unchanged directory-link behavior retained');
    const altered=(snapshot,key,value)=>({...snapshot,entries:{...snapshot.entries,[key]:value}});
    assert.equal(accountedDirectoryMutation(parent,before,{...after,complete:false}),false,'incomplete inventory cannot account for links');
    assert.equal(accountedDirectoryMutation(parent,before,altered(after,parent,{...after.entries[parent],nlink:2})),false,'wrong final link count rejected');
    assert.equal(accountedDirectoryMutation(parent,altered(before,parent,{...directory,nlink:5}),after),false,'wrong initial link count rejected');
    assert.equal(accountedDirectoryMutation(parent,before,altered(before,parent,{...directory,nlink:3})),false,'link movement without membership change rejected');
    for(const key of ['kind','mode','uid','gid','dev','ino'])assert.equal(accountedDirectoryMutation(parent,before,altered(after,parent,{...after.entries[parent],[key]:key==='mode'?448:'changed'})),false,'directory '+key+' replacement rejected');
    const undeclared={...before,entries:{...before.entries,[parent+'/undeclared.json']:before.entries[second]}};
    delete undeclared.entries[second];
    assert.equal(accountedDirectoryMutation(parent,undeclared,after),false,'undeclared immediate removal rejected');
    assert.equal(accountedDirectoryMutation(parent,altered(before,second,{kind:'file',nlink:2}),after),false,'hardlinked membership rejected');
    assert.equal(accountedDirectoryMutation(parent,before,altered(after,first,{kind:'directory',nlink:2})),false,'type-changing membership rejected');
    assert.equal(accountedDirectoryMutation(parent,before,altered(after,first,{kind:'symlink',nlink:1})),false,'symlink membership rejected');
  }
  function safety(snapshot){
    assert(snapshot.withinCeiling,'declared output bytes exceed 128MiB');
    for(const [relative,entry]of Object.entries(snapshot.entries)){
      assert(entry.kind!=='unsupported','unsupported working path '+relative);
      if(entry.kind==='symlink')assert(entry.approvedBorrow,'undeclared symlink '+relative);
      if(entry.kind==='file')assert.equal(entry.nlink,1,'working-file hardlink '+relative);
    }
    for(const relative of outputs)assert(!snapshot.entries[relative]||snapshot.entries[relative].kind==='file','declared output is not a regular file '+relative);
  }
  const completed=[];let selectedCodes=[];
  function invoke(label,ids){
    verifySealed();active={label,ids,before:capture(label+'-before'),after:null,result:null};safety(active.before);
    const result=spawnSync(pinnedNode,['--max-old-space-size=768','scripts/update-cards.js','--reviewed-fixtures','--admit-major-subevents',`--ids=${ids}`,'--local-only'],{cwd:root,env:environment,timeout:timeouts[label],maxBuffer:1024*1024});
    active.result={pid:result.pid,status:result.status,signal:result.signal,errorCode:result.error?.code||null};
    seal(label+'.stdout.log',result.stdout||'');seal(label+'.stderr.log',result.stderr||'');
    active.after=capture(label+'-after');const changed=differences(active.before,active.after);
    const undeclared=changed.filter(relative=>{
      if(allowed.has(relative))return false;
      const before=active.before.entries[relative],after=active.after.entries[relative];
      const outputParent=relative==='.'||outputs.some(output=>output.startsWith(relative+'/'));
      const declaredChildChanged=changed.some(child=>allowed.has(child)&&(relative==='.'||child.startsWith(relative+'/')));
      if(label!=='positive'||!outputParent||!declaredChildChanged)return true;
      if(!before||!after){
        const entry=before||after;
        return entry.kind!=='directory'||entry.uid!==String(rootIdentity.uid)||entry.gid!==String(rootIdentity.gid);
      }
      // Identity and permissions remain exact. Native link-count movement
      // requires complete, declared immediate regular-file membership accounting.
      return !accountedDirectoryMutation(relative,active.before,active.after);
    });
    const unselected=changed.filter(relative=>{const match=/^data\/(?:code-inspector|follow-schedule)\/([^/]+)\.json$/.exec(relative);return match&&match[1]!=='manifest'&&!selectedCodes.includes(match[1]);});
    seal(label+'-delta.json',{...active.result,changed,undeclared,unselected,selectedCodes,declaredBeforeBytes:active.before.declaredBytes,declaredAfterBytes:active.after.declaredBytes});
    safety(active.after);verifySealed();assert.deepEqual(undeclared,[],'undeclared working-tree writes, including metadata');assert.deepEqual(unselected,[],'writes outside selected Code/Schedule scopes');
    if(label!=='positive')assert.deepEqual(changed,[],label+' must preserve the complete working tree, not just listed output hashes');
    if(result.error)throw result.error;assert.equal(result.signal,null,'owner must not be terminated');return {...result,stdout:result.stdout?.toString('utf8')||'',stderr:result.stderr?.toString('utf8')||''};
  }
  function finish(){seal(active.label+'-pass.json',{stage:active.label,result:active.result,localOnly:true,productionProof:false});completed.push(active.label);active=null;}
  try{
    assertDirectoryLinkAccounting();
    for(const relative of outputs){
      const entry=preimages.get(relative),file=path.join(preimagesRoot,relative);
      assert.equal(typeof entry.exists,'boolean','preimage presence binding');
      if(entry.exists){assert.equal(fs.lstatSync(file).isFile(),true);assert.equal(fs.statSync(file).size,entry.bytes);assert.equal(digest(file),entry.sha256);trusted.set(entry.sha256,{storage:'trusted-readonly-initial-preimage',path:file});}
      else{assert.equal(entry.sha256,null);assert.equal(fs.existsSync(file),false);}
    }
    const initial=capture('initial');safety(initial);
    for(const relative of outputs){const entry=preimages.get(relative),current=initial.entries[relative];assert.equal(Boolean(current),entry.exists);if(current){assert.equal(current.bytes,entry.bytes);assert.equal(current.sha256,entry.sha256);}}
    const feedPaths=['feeds/incoming/events.json','data/events.json'];
    const beforeFeeds=feedPaths.map(file=>JSON.parse(fs.readFileSync(safe(file))));
    for(const feed of beforeFeeds)assert.equal(feed.events.some(event=>event.id===ID||event.canonicalEventId===ID),false,'target initially absent');
    const canonical=JSON.parse(fs.readFileSync(safe('data/major-events.v1.json'))),referenceChild=canonical.events.flatMap(parent=>parent.subEvents||[]).filter(child=>child.id===ID);
    assert.equal(referenceChild.length,1,'one frozen canonical fixture');
    const directoryPaths=['data/follow-directory/nrl.v1.json','data/follow-directory/manifest.v1.json','data/follow-directory/search.v1.json'];
    const directoryBefore=positiveOnly?directoryPaths.map(file=>JSON.parse(fs.readFileSync(safe(file)))):null;
    const planned=prepareAdmission({canonical,incoming:beforeFeeds[0],published:beforeFeeds[1],ids:[ID]});
    const manifest=JSON.parse(fs.readFileSync(safe('data/code-inspector/manifest.json')));
    selectedCodes=require('./lib/reviewed-fixture-projection-codes').codesForReviewedFixtures(planned.published.events,[ID],manifest,file=>JSON.parse(fs.readFileSync(safe(file)))).sort();
    const selectedBefore=new Map();
    for(const code of selectedCodes)for(const prefix of ['data/code-inspector/','data/follow-schedule/']){const relative=prefix+code+'.json';assert(allowed.has(relative),'selected projection outside envelope');selectedBefore.set(relative,JSON.parse(fs.readFileSync(safe(relative))));}
    seal('selection.json',{selectedCodes,outputPathsDigest:hash(JSON.stringify(outputs)),outputByteCeiling:ceiling,initialSnapshot:'initial.json',rollback:'Existing owner restores data/feeds/main runtime only. Optional/shell/version bytes require forensic HOLD; no restoration claimed.'});
    const positive=invoke('positive',ID);assert.equal(positive.status,0,positive.stderr);
    const targetIdentityBindings=[];
    feedPaths.forEach((file,index)=>{
      const events=JSON.parse(fs.readFileSync(safe(file))).events,selected=events.filter(event=>event.id===ID||event.canonicalEventId===ID);assert.equal(selected.length,1);
      const target=selected[0],source=referenceChild[0];
      assert.equal(target.id,'major-match-rlwc-2026-tonga-samoa');assert.equal(target.eventId,target.id);assert.equal(target.canonicalEventId,ID);assert.equal(target.actionKey,ID);
      assert.equal(Array.isArray(target.sourceEventIds),true);assert(target.sourceEventIds.every(value=>typeof value==='string'));assert.equal(target.sourceEventIds.filter(value=>value===ID).length,1,'exact canonical source alias once');
      assert(!target.sourceEventIds.some(value=>value.startsWith('major-match:')&&value!==ID),'no conflicting canonical source identity');
      targetIdentityBindings.push({file,id:target.id,eventId:target.eventId,canonicalEventId:target.canonicalEventId,actionKey:target.actionKey,sourceEventIds:target.sourceEventIds});
      assert.equal(target.sourceCheckedAt,source.sourceCheckedAt);assert.equal(target.startTimeUtc,source.startTimeUtc);assert.equal(target.venue,source.venue);assert.equal(target.stage,source.stage);assert.deepEqual(target.participantIds,source.participantIds);
      assert.equal(target.key,'nrl');assert.equal(target.scoreDisplay,undefined);assert.equal(target.actualStartTimeUtc,undefined);
      const peers=events.filter(event=>event!==target),originals=beforeFeeds[index].events;assert.equal(peers.length,originals.length,'unrelated card count');
      for(const original of originals)assert.deepEqual(peers.find(event=>event.id===original.id),original,'unrelated card body and observations');
    });
    const isTarget=fixture=>[fixture.id,fixture.eventId,fixture.canonicalEventId,...(fixture.sourceEventIds||[])].includes(ID);
    for(const [relative,before]of selectedBefore){const after=JSON.parse(fs.readFileSync(safe(relative)));assert.deepEqual(after.standings,before.standings,'unchanged selected-code standings');const originals=(before.fixtures||[]).filter(fixture=>!isTarget(fixture)),peers=(after.fixtures||[]).filter(fixture=>!isTarget(fixture));assert.equal(peers.length,originals.length);for(const original of originals)assert.deepEqual(peers.find(fixture=>fixture.id===original.id),original,'unrelated Schedule fixture and observations');}
    if(positiveOnly){
      const [nrl,manifestAfter,search]=directoryPaths.map(file=>JSON.parse(fs.readFileSync(safe(file))));
      const nationalIds=['team:nrl:national:tonga','team:nrl:national:samoa'];
      for(const id of nationalIds)assert.equal(nrl.records.filter(record=>record.id===id).length,1,'one national identity in current NRL directory');
      assert.deepEqual(nrl.records.filter(record=>!nationalIds.includes(record.id)),directoryBefore[0].records.filter(record=>!nationalIds.includes(record.id)),'unchanged NRL directory peers and observations');
      assert.deepEqual(manifestAfter.sports.filter(sport=>sport.key!=='nrl'),directoryBefore[1].sports.filter(sport=>sport.key!=='nrl'),'unchanged non-NRL manifest rows and order');
      assert.deepEqual(search.fields,directoryBefore[2].fields,'search field contract');
      const idIndex=search.fields.indexOf('id'),sportIndex=search.fields.indexOf('sportKey');assert(idIndex>=0&&sportIndex>=0);
      const unrelated=records=>records.filter(record=>!nationalIds.includes(record[idIndex]));
      assert.deepEqual(unrelated(search.records),unrelated(directoryBefore[2].records),'unchanged global search peers, including non-NRL records/order/clocks');
      for(const id of nationalIds){const rows=search.records.filter(record=>record[idIndex]===id);assert.equal(rows.length,1);assert.equal(rows[0][sportIndex],'nrl');}
      assert(Date.parse(search.generatedAt)>=Date.parse(directoryBefore[2].generatedAt),'search publication clock must not move backwards');
      seal('positive-directory-qualification.json',{nationalIds,paths:['data/follow-directory/nrl.v1.json','data/follow-directory/nrl.v1.js','data/follow-directory/manifest.v1.json','data/follow-directory/manifest.v1.js','data/follow-directory/search.v1.json'],peerRowsAndOrderPreserved:true,companionProof:'Required scoped directory build/check completed in the canonical owner.',productionProof:false});
    }
    seal('positive-identity-and-steps.json',{targetIdentityBindings,reportedCanonicalSteps:positive.stdout.split(/\r?\n/).filter(line=>line.startsWith('> node ')),ownerExitStatus:positive.status,requiredLoop:'Existing hash-bound canonical owner runStep chain; no child or gate replaced.',productionProof:false});
    finish();
    if(!positiveOnly){
      const noop=invoke('noop',ID);assert.equal(noop.status,0,noop.stderr);finish();
      const negative=invoke('negative','major-match:rlwc-2026:not-reviewed');assert.notEqual(negative.status,0);assert.match(negative.stderr,/unsupported reviewed identity major-match:rlwc-2026:not-reviewed/);finish();
    }
    verifySealed();seal('complete.json',{status:'PASS_LOCAL_OWNER_ONLY',completed,selectedCodes,outputCeiling:ceiling,uniqueForensicBytes:objectBytes,productionProof:false});
    console.log(positiveOnly?'Current-main canonical positive and NRL directory qualification passed. No no-op/negative rerun or production proof.':'Actual canonical-owner positive/no-op/negative assertions passed in isolated fixture copy. No production proof.');
  }catch(error){
    // Never restore, reset, delete or clean the failed candidate. Initial bytes
    // remain in trusted RO storage; intermediate bytes are parent-buffered and
    // hash-bound. The outer guardian retains all physical evidence on HOLD.
    try{seal('HOLD.json',{status:'HOLD',stage:active?.label||'preflight-or-finalisation',completed,ownerResult:active?.result||null,postSnapshotComplete:Boolean(active?.after),errorName:error.name,errorCode:error.code||null,reason:String(error.message).slice(0,1400),workingFixturePreserved:true,rollbackNotProved:['seven optional runtimes','app-version.json','index.html','service-worker.js'],productionProof:false});}catch{}
    console.error('Local full-owner HOLD; preserve working fixture, trusted preimages and owner-forensics. No release or complete rollback is confirmed.');throw error;
  }
}
if(require.main===module){
  const args=process.argv.slice(2),packet=args.find(arg=>arg.startsWith('--packet='));
  if(args.some(arg=>!arg.startsWith('--packet='))||args.length>(packet?1:0))throw Error('Use only optional --packet=<frozen private fixture packet>');
  focused();if(packet)actualOwner(packet.slice(9));
}
module.exports={reference,focused,actualOwner};
