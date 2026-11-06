'use strict';
// Pure workflow contract. Never import an engine, execute a command or use a service.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const fixtureBytes=fs.readFileSync(__dirname+'/fixtures/production-safety-537ae85b.json');
assert.equal(hash(fixtureBytes),'54f7b6b35bc074a0836f9afdd8eea5fa334cb524c200df5cc7e03bd0afb0244f','Frozen original 258 command occurrences');
const original=JSON.parse(fixtureBytes);
const batches=[
 ['canonical-context','canonical-context-pg18','node scripts/validate-canonical-context-batch.js'],
 ['canonical-context','canonical-context-pg17','PGLITE_MODULE=pglite-pg17 node scripts/validate-canonical-context-batch.js'],
 ['near-selection','near-selection-pg18','NEAR_EVIDENCE_DIR="$RUNNER_TEMP/near-selection-pg18" node scripts/validate-match-centre-near-selection.js'],
 ['near-selection','near-selection-pg17','NEAR_EVIDENCE_DIR="$RUNNER_TEMP/near-selection-pg17" PGLITE_MODULE=pglite-pg17 node scripts/validate-match-centre-near-selection.js'],
 ['grouped-view','grouped-view-pg18','node scripts/validate-grouped-fixture-view.js'],
 ['grouped-view','grouped-view-pg17','PGLITE_MODULE=pglite-pg17 node scripts/validate-grouped-fixture-view.js'],
 ['grouped-diagnostic','grouped-diagnostic-pg17','PGLITE_MODULE=pglite-pg17 node scripts/validate-grouped-fixture-diagnostic.js']
];
const recoveryCommands=Object.freeze([
 'node scripts/validate-local-preference-recovery.js',
 'node scripts/validate-local-recovery-ui-lifecycle.js'
]);
const journeyCommand='timeout --signal=TERM --kill-after=5s 120s node scripts/validate-new-user-journey.js';
const receiptBatches=[
 ['near-selection','near-receipt-join-pg18','NEAR_EVIDENCE_DIR="$RUNNER_TEMP/near-selection-pg18/receipt-join" node scripts/validate-near-receipt-join.js'],
 ['near-selection','near-receipt-join-pg17','NEAR_EVIDENCE_DIR="$RUNNER_TEMP/near-selection-pg17/receipt-join" PGLITE_MODULE=pglite-pg17 node scripts/validate-near-receipt-join.js']
];
const allBatches=[...batches.slice(0,4),...receiptBatches,...batches.slice(4)];
const safety='      - name: Verify feed and deployment safety contracts\n        run: |\n';
const shared='      - name: Verify shared fixture publication input\n';
// The only reviewed scaffold delta is the explicit dictionary format flag.
const legacyGlobalGate='          node scripts/verify-global-app-adapter.js --live-read\n';
const dictionaryGlobalGate='          node scripts/verify-global-app-adapter.js --live-read --dictionary-v2\n';
const preflight='      - name: Verify production SQL batch contract\n        run: node scripts/validate-production-sql-batches.js\n';
const workerPrefix=`  sql-safety:
    name: SQL safety / \${{ matrix.batch }}
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    strategy:
      fail-fast: false
      max-parallel: 4
      matrix:
        batch: [canonical-context, near-selection, grouped-view, grouped-diagnostic]
    steps:
      - uses: actions/checkout@v5
        with:
          ref: main
          fetch-depth: 0
      - uses: actions/setup-node@v5
        with:
          node-version: 24
      - name: Verify requested mainline SQL checks
        env:
          RELEASE_SHA: \${{ inputs.sha }}
        shell: bash
        run: |
          [[ "$RELEASE_SHA" =~ ^[a-f0-9]{40}$ ]]
          test "$RELEASE_SHA" = "$(git rev-parse origin/main)"
          git checkout --detach "$RELEASE_SHA"
      - run: npm ci
`;
const timing='          started=$SECONDS\n          trap \'rc=$?; echo "SQL_CHECK elapsed_seconds=$((SECONDS - started)) exit=$rc"; exit "$rc"\' EXIT\n';
function workerStep([batch,name,command]){
 return '      - name: '+name+'\n        if: matrix.batch == \''+batch+'\'\n        shell: bash\n        run: |\n'+timing+'          '+command+'\n';
}
const workerSuffix=`      - uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2, Node 24
        if: \${{ always() && matrix.batch == 'near-selection' }}
        with:
          name: sql-near-selection-\${{ inputs.sha }}
          path: \${{ runner.temp }}/near-selection-pg*
          if-no-files-found: ignore
          retention-days: 14
`;
function validate(text){
 const jobs=[...text.matchAll(/^  ([a-z][a-z0-9-]*):\n/gm)];
 assert.deepEqual(jobs.map(m=>m[1]),['sql-safety','deploy'],'Only four prerequisite matrix batches and the one publisher');
 assert.equal(hash(text.slice(0,jobs[0].index)),original.headerSha256,'Triggers, permissions and serialized workflow concurrency unchanged');
 const worker=text.slice(jobs[0].index,jobs[1].index),publisher=text.slice(jobs[1].index);
 assert.equal(worker,workerPrefix+allBatches.map(workerStep).join('')+workerSuffix,'Literal engine commands, SHA binding, four batches, timing and no worker secrets');
 assert.equal((publisher.match(/^    needs: \[sql-safety\]$/gm)||[]).length,1,'Every matrix instance must succeed before publisher starts');
 assert.equal((publisher.match(new RegExp(preflight.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length,1,'Pure arrangement check is itself required');
 const normalized=publisher.replace('    needs: [sql-safety]\n','').replace(preflight,'');
 const at=normalized.indexOf(safety);assert(at>=0);const end=normalized.indexOf(shared,at+safety.length);assert(end>at);
 const body=normalized.slice(at+safety.length,end),lines=body.trimEnd().split('\n');
 assert(lines.every(line=>/^          \S/.test(line)),'Publisher command block contains only literal command lines');
 const commands=lines.map(line=>line.slice(10)),moved=batches.map(row=>row[2]);
 assert.equal(original.commands.length,258);assert.equal(moved.length,7);assert.equal(new Set(moved).size,7);
 const originalPublisher=original.commands.filter(command=>!moved.includes(command));
 assert.equal(originalPublisher.length,251);
 const recoveryAt=originalPublisher.indexOf('node scripts/validate-preference-bookkeeping.js');assert(recoveryAt>=0);
 const withRecovery=[...originalPublisher.slice(0,recoveryAt+1),...recoveryCommands,...originalPublisher.slice(recoveryAt+1)];
 const journeyAt=withRecovery.indexOf('node scripts/validate-account-awareness.js');assert(journeyAt>=0);
 const expectedPublisher=[...withRecovery.slice(0,journeyAt+1),journeyCommand,...withRecovery.slice(journeyAt+1)];
 assert.equal(commands.length,254,'Exactly 254 required publisher command occurrences');
 assert.deepEqual(commands,expectedPublisher,'All original 251 publisher commands retain exact order and environment, both recovery checks follow preference bookkeeping, and one bounded journey check follows account awareness');
 const receiptCommands=receiptBatches.map(row=>row[2]);
 assert.deepEqual([...commands,...moved,...receiptCommands].sort(),[...original.commands,...recoveryCommands,journeyCommand,...receiptCommands].sort(),'All original occurrences, both recovery additions, both receipt-join engines and exactly one bounded journey check are preserved');
 assert.equal(commands.length+moved.length+receiptCommands.length,263,'Exactly 263 required command occurrences across publisher and prerequisite engines');
 assert.equal(publisher.split(dictionaryGlobalGate).length-1,1,'Exactly one required dictionary global live qualifier');
 assert.equal(publisher.split(legacyGlobalGate).length-1,0,'Legacy-only global live qualifier cannot replace dictionary qualification');
 const scaffold=normalized.slice(0,at+safety.length)+'\0'+normalized.slice(end);
 assert.equal(hash(scaffold.replace(dictionaryGlobalGate,legacyGlobalGate)),original.publisherScaffoldSha256,'Publisher scaffold is unchanged except the exact reviewed dictionary qualifier flag; original SHA, credentials, deadlines, live gate, deploy and public checks remain pinned');
 assert(!/continue-on-error|\beval\b/.test(text),'No soft failure or dynamic command evaluation');
 return {originalOccurrences:258,addedRecoveryOccurrences:recoveryCommands.length,addedReceiptOccurrences:receiptCommands.length,addedJourneyOccurrences:1,publisherOccurrences:commands.length,movedOccurrences:moved.length,requiredOccurrences:commands.length+moved.length+receiptCommands.length,batches:4};
}
function regressions(text){
 const controls=[
  ['lost PG17 occurrence',s=>s.replace('          '+batches[1][2]+'\n','')],
  ['duplicate original occurrence',s=>s.replace('          node scripts/validate-laver-cup.js\n','          node scripts/validate-laver-cup.js\n          node scripts/validate-laver-cup.js\n')],
  ['publisher reordering',s=>s.replace('          node scripts/validate-fantasy-deadlines.js\n          node scripts/validate-fantasy-deadline-api.js\n','          node scripts/validate-fantasy-deadline-api.js\n          node scripts/validate-fantasy-deadlines.js\n')],
  ['wrong engine',s=>s.replace(batches[1][2],batches[1][2].replace('pglite-pg17','@electric-sql/pglite'))],
  ['missing near evidence',s=>s.replace(batches[2][2],batches[2][2].replace('NEAR_EVIDENCE_DIR="$RUNNER_TEMP/near-selection-pg18" ',''))],
  ['missing prerequisite batch',s=>s.replace('near-selection, grouped-view','grouped-view')],
  ['publisher dependency removed',s=>s.replace('    needs: [sql-safety]\n','')],
  ['weakened failure',s=>s.replace('    needs: [sql-safety]\n','    needs: [sql-safety]\n    continue-on-error: true\n')],
  ['worker always override',s=>s.replace("if: matrix.batch == 'canonical-context'","if: always()")],
  ['worker SHA not checked',s=>s.replace('test "$RELEASE_SHA" = "$(git rev-parse origin/main)"','true')],
  ['publisher SHA not checked',s=>{const at=s.indexOf('  deploy:\n');return s.slice(0,at)+s.slice(at).replace('test "$RELEASE_SHA" = "$(git rev-parse origin/main)"','true');}],
  ['worker credential exposure',s=>s.replace('    name: SQL safety /','    env:\n      SUPABASE_SECRET_KEY: \${{ secrets.SUPABASE_SECRET_KEY }}\n    name: SQL safety /')],
  ['raised job cap',s=>s.replace('    timeout-minutes: 30','    timeout-minutes: 31')],
  ['overlapping publication',s=>s.replace('  cancel-in-progress: false','  cancel-in-progress: true')],
  ['live gate removed',s=>s.replace(dictionaryGlobalGate,'')],
  ['dictionary flag removed',s=>s.replace(dictionaryGlobalGate,legacyGlobalGate)],
  ['dictionary qualifier duplicated',s=>s.replace(dictionaryGlobalGate,dictionaryGlobalGate+dictionaryGlobalGate)],
  ['dictionary arguments reordered',s=>s.replace(dictionaryGlobalGate,'          node scripts/verify-global-app-adapter.js --dictionary-v2 --live-read\n')],
  ['dictionary unreviewed argument',s=>s.replace(dictionaryGlobalGate,'          node scripts/verify-global-app-adapter.js --live-read --dictionary-v2 --skip\n')],
  ['arrangement check bypassed',s=>s.replace(preflight,'')],
  ['missing new-user journey check',s=>s.replace('          '+journeyCommand+'\n','')],
  ['duplicate new-user journey check',s=>s.replace('          '+journeyCommand+'\n','          '+journeyCommand+'\n          '+journeyCommand+'\n')],
  ['altered new-user journey check',s=>s.replace('          '+journeyCommand+'\n','          '+journeyCommand+' --skip\n')],
  ['moved new-user journey check',s=>s.replace('          node scripts/validate-account-awareness.js\n          '+journeyCommand+'\n','          '+journeyCommand+'\n          node scripts/validate-account-awareness.js\n')],
  ['missing recovery check',s=>s.replace('          '+recoveryCommands[0]+'\n','')],
  ['missing recovery UI check',s=>s.replace('          '+recoveryCommands[1]+'\n','')],
  ['duplicate recovery check',s=>s.replace('          '+recoveryCommands[0]+'\n','          '+recoveryCommands[0]+'\n          '+recoveryCommands[0]+'\n')],
  ['recovery checks reordered',s=>s.replace(recoveryCommands.map(command=>'          '+command+'\n').join(''),[...recoveryCommands].reverse().map(command=>'          '+command+'\n').join(''))],
  ['recovery command altered',s=>s.replace('          '+recoveryCommands[0]+'\n','          '+recoveryCommands[0]+' --skip\n')],
  ['original publisher check lost',s=>s.replace('          node scripts/validate-preference-bookkeeping.js\n','')],
  ['unreviewed extra command',s=>s.replace('          '+recoveryCommands[1]+'\n','          '+recoveryCommands[1]+'\n          node scripts/validate-unreviewed-recovery.js\n')],
  ['missing receipt PG18',s=>s.replace('          '+receiptBatches[0][2]+'\n','')],
  ['missing receipt PG17',s=>s.replace('          '+receiptBatches[1][2]+'\n','')],
  ['receipt wrong engine',s=>s.replace(receiptBatches[1][2],receiptBatches[1][2].replace('pglite-pg17','@electric-sql/pglite'))],
  ['receipt evidence removed',s=>s.replace(receiptBatches[0][2],receiptBatches[0][2].replace('NEAR_EVIDENCE_DIR="$RUNNER_TEMP/near-selection-pg18/receipt-join" ',''))]
 ];
 for(const[name,mutate]of controls){const broken=mutate(text);assert.notEqual(broken,text,name+' mutation must apply');assert.throws(()=>validate(broken),undefined,name+' must refuse');}
 return controls.length;
}
// B-only installed workflow contract; production command inventory is unchanged.
const signupCompatibilityStep="      - name: Verify signup/setup compatibility\n        run: timeout --signal=TERM --kill-after=5s 120s node scripts/validate-server-persistence.js\n";
const signupCompatibilityPaths="      - scripts/validate-server-persistence.js\n      - scripts/lib/signup-setup-tests.js\n      - scripts/lib/user-state-account-scope-tests.js\n      - scripts/lib/user-state-optional-view-tests.js\n      - scripts/validate-cross-device-sync.js\n      - scripts/validate-empty-startup-meta.js\n";
const signupCompatibilityNpm="      - name: Install existing locked dependencies\n        run: npm ci\n";
const signupCompatibilityOldDescription="Three existing source/mock activation checks plus one bounded new-user journey unit.";
const signupCompatibilityDescription="Three existing source/mock activation checks, one bounded new-user journey unit and one bounded signup/setup compatibility check.";
function validateSignupCompatibilityWorkflow(text){
 assert.equal(typeof text,'string','Installed workflow source required');
 assert.equal(text.split(signupCompatibilityStep).length-1,1,'Exactly one bounded signup/setup compatibility step');
 assert.equal(text.split(signupCompatibilityPaths).length-1,1,'Exactly one narrow compatibility trigger block');
 assert(text.includes('      - scripts/validate-new-user-journey.js\n'+signupCompatibilityPaths),'Compatibility paths follow the existing journey trigger');
 assert(text.includes(signupCompatibilityNpm+signupCompatibilityStep+'      - name: Verify actual exported Feed activation\n'),'Compatibility follows locked npm and precedes original activation checks');
 assert.equal(text.split(signupCompatibilityDescription).length-1,1,'Identity log includes the additional compatibility check');
 const original=text.replace(signupCompatibilityStep,'').replace(signupCompatibilityPaths,'').replace(signupCompatibilityDescription,signupCompatibilityOldDescription);
 assert.equal(hash(original),'2ca4c7b2c05f7e16d119a16100311bbc8b08fb5616d09b7551ec85b8a6fe8586','All frozen v6 installed workflow bytes, early unit, jobs, guards, dependencies and engines remain unchanged');
}
function signupCompatibilityRegressions(text){
 validateSignupCompatibilityWorkflow(text);
 const controls=[
  ['missing signup compatibility step',value=>value.replace(signupCompatibilityStep,'')],
  ['duplicate signup compatibility step',value=>value.replace(signupCompatibilityStep,signupCompatibilityStep+signupCompatibilityStep)],
  ['altered signup compatibility step',value=>value.replace(signupCompatibilityStep,signupCompatibilityStep.replace('validate-server-persistence.js','validate-server-persistence.js --skip'))],
  ['moved signup compatibility step',value=>value.replace(signupCompatibilityNpm+signupCompatibilityStep,signupCompatibilityStep+signupCompatibilityNpm)]
 ];
 for(const[name,mutate]of controls){const broken=mutate(text);assert.notEqual(broken,text,name+' mutation must apply');assert.throws(()=>validateSignupCompatibilityWorkflow(broken),undefined,name+' must refuse');}
 return controls.length;
}
function resolveLockedTerserPackage({checkoutRoot,entryFile,lockedPackages,readManifest}){
 const assert=require('node:assert/strict'),path=require('node:path');
 assert.equal(typeof checkoutRoot,'string');assert(path.isAbsolute(checkoutRoot),'Absolute candidate root required');
 assert.equal(typeof entryFile,'string');assert(path.isAbsolute(entryFile),'Absolute resolved Terser entry required');
 assert(lockedPackages&&typeof lockedPackages==='object'&&!Array.isArray(lockedPackages),'Committed package lock map required');
 assert.equal(typeof readManifest,'function','Owning package manifest reader required');
 const root=path.resolve(checkoutRoot),location='node_modules/terser',packageRoot=path.join(root,'node_modules','terser'),entry=path.resolve(entryFile);
 const declared=lockedPackages[location];
 assert(declared&&typeof declared==='object'&&typeof declared.version==='string'&&declared.version.length>0,'Exact candidate-local Terser lock entry required');
 assert(entry.startsWith(packageRoot+path.sep),'Resolved Terser entry must remain inside exact locked candidate package');
 const manifestPath=path.join(packageRoot,'package.json'),manifest=readManifest(manifestPath);
 assert(manifest&&typeof manifest==='object'&&!Array.isArray(manifest),'Owning Terser manifest required');
 assert.equal(manifest.name,'terser','Owning package must be Terser, not nested dist metadata');
 assert.equal(manifest.version,declared.version,'Owning Terser version must match committed lock');
 return {root:packageRoot,location,manifestPath,manifest,entryRelativePath:path.relative(packageRoot,entry).split(path.sep).join('/')};
}
function lockedTerserPackageRegressions(){
 const assert=require('node:assert/strict'),path=require('node:path');
 const root=path.resolve('/candidate'),owner=path.join(root,'node_modules','terser'),manifestPath=path.join(owner,'package.json');
 const version='5.44.0',lockedPackages={'node_modules/terser':{version}},nestedEntry=path.join(owner,'dist','bundle.min.js');
 const ownerManifest={name:'terser',version};
 function setup({entryFile=nestedEntry,packages=lockedPackages,manifest=ownerManifest,nested={name:'dist',version:'0.0.0'}}={}){
  const reads=[],documents=new Map([[manifestPath,manifest],[path.join(owner,'dist','package.json'),nested]]);
  return {reads,call:()=>resolveLockedTerserPackage({checkoutRoot:root,entryFile,lockedPackages:packages,readManifest:file=>{reads.push(file);assert(documents.has(file),'Unexpected manifest read');return documents.get(file);}})};
 }
 const cases=[
  ['nested dist/package.json is not the owner',()=>{const fixture=setup(),actual=fixture.call();assert.equal(actual.root,owner);assert.equal(actual.location,'node_modules/terser');assert.equal(actual.manifest.name,'terser');assert.equal(actual.manifest.version,version);assert.equal(actual.entryRelativePath,'dist/bundle.min.js');assert.deepEqual(fixture.reads,[manifestPath]);}],
  ['direct package entry retains exact locked owner',()=>{const fixture=setup({entryFile:path.join(owner,'main.js')});assert.equal(fixture.call().root,owner);assert.deepEqual(fixture.reads,[manifestPath]);}],
  ['nested type-only metadata is not the owner',()=>{const fixture=setup({nested:{type:'commonjs'}});assert.equal(fixture.call().manifest.name,'terser');assert.deepEqual(fixture.reads,[manifestPath]);}],
  ['wrong owner name remains a failure',()=>{const fixture=setup({manifest:{name:'dist',version}});assert.throws(fixture.call,/Owning package must be Terser/);}],
  ['wrong owning version remains a failure',()=>{const fixture=setup({manifest:{name:'terser',version:'0.0.0'}});assert.throws(fixture.call,/Owning Terser version must match committed lock/);}],
  ['missing exact lock entry fails before manifest IO',()=>{const fixture=setup({packages:{}});assert.throws(fixture.call,/Exact candidate-local Terser lock entry required/);assert.deepEqual(fixture.reads,[]);}],
  ['global or cached entry cannot replace candidate package',()=>{const fixture=setup({entryFile:path.resolve('/cache/node_modules/terser/dist/bundle.min.js')});assert.throws(fixture.call,/inside exact locked candidate package/);assert.deepEqual(fixture.reads,[]);}],
  ['sibling and traversal entries cannot escape ownership',()=>{for(const entryFile of [path.join(root,'node_modules','terser-other','dist','bundle.min.js'),path.join(owner,'..','..','other','entry.js')]){const fixture=setup({entryFile});assert.throws(fixture.call,/inside exact locked candidate package/);assert.deepEqual(fixture.reads,[]);}}],
  ['missing or malformed owning manifest is not bypassed',()=>{const absent=setup({manifest:null});assert.throws(absent.call,/Owning Terser manifest required/);assert.throws(()=>resolveLockedTerserPackage({checkoutRoot:root,entryFile:nestedEntry,lockedPackages,readManifest:()=>{throw Error('missing owning manifest');}}),/missing owning manifest/);}]
 ];
 for(const[,run]of cases)run();
 return {groups:cases.length,names:cases.map(([name])=>name),syntheticMetadataOnly:true,installedPackageIo:false,serviceRequests:0};
}

// E610 owned source admission: exact existing-job overlay, not a release waiver.
const e610AdmissionStart='      - name: Bind reviewed E610 source qualification receipt\n';
const e610AdmissionEnd='  installed-upgrade:\n';
const e610AdmissionBlockSha256="bea93630c06fd72ab44eb73c352f7adc246f8abe4870232da09ecaaab4e99cc1";
const e610ReadyWorkflowSha256='1f9e4e220bb6b15834797fed54be53d0b51ef4aa51deb3710d52238f1ce96089';
const e610OriginalRegistryStep="      - name: Verify guarded production workflow contract\n        timeout-minutes: 2\n        run: node scripts/validate-production-sql-batches.js\n";
function normaliseE610AdmissionWorkflow(text){
 assert.equal(typeof text,'string','Workflow source required');
 assert.equal(text.split(e610AdmissionStart).length-1,1,'Exactly one E610 metadata producer');
 const start=text.indexOf(e610AdmissionStart),end=text.indexOf(e610AdmissionEnd,start);assert(end>start,'E610 admission must precede original installed-browser job');
 const block=text.slice(start,end);assert.equal(hash(block),e610AdmissionBlockSha256,'Exact bounded metadata/receipt producer and strict full qualifier invocation');
 assert(text.includes(e610OriginalRegistryStep+block+e610AdmissionEnd),'Metadata and full qualification must follow locked install and original strict registry');
 const restored=text.slice(0,start)+text.slice(end);
 assert.equal(hash(restored),e610ReadyWorkflowSha256,'Whole normal READY workflow, security, timeouts, install, old checks and browser guards unchanged');
 return {restored,block};
}
function e610AdmissionRegressions(text){
 const {restored,block}=normaliseE610AdmissionWorkflow(text);
 const controls=[
  ['missing receipt producer',value=>value.replace(block,'')],
  ['duplicate admission',value=>value.replace(block,block+block)],
  ['moved before locked dependencies',value=>value.replace(block,'').replace('      - name: Install existing locked dependencies\n',block+'      - name: Install existing locked dependencies\n')],
  ['metadata timeout changed',value=>value.replace('30s node <<\'NS_E610_ADMISSION\'','31s node <<\'NS_E610_ADMISSION\'')],
  ['full qualifier timeout changed',value=>value.replace('120s node scripts/validate-sync608-reported-hold.js','121s node scripts/validate-sync608-reported-hold.js')],
  ['full CLI scope removed',value=>value.replace('scripts/validate-sync608-reported-hold.js --full','scripts/validate-sync608-reported-hold.js')],
  ['independent receipt SHA argument removed',value=>value.replace(' --execution-receipt-sha256 "$NS_SYNC_EXECUTION_RECEIPT_SHA256"','')],
  ['receipt output handoff altered',value=>value.replace('steps.e610_source_admission.outputs.executionReceiptSha256','steps.e610_source_admission.outputs.other')],
  ['body evaluation introduced',value=>value.replace('JSON.parse(text)','eval(text)')],
  ['canonical body check removed',value=>value.replace("assert.equal(JSON.stringify(body),text,'PR body must be exact compact JSON with NO LF or whitespace');",'')],
  ['manifest digest check removed',value=>value.replace("assert.equal(hash(assembled),binding.expectedAssembledManifestSha256,'Publisher expected complete raw source manifest');",'')],
  ['projection completeness check removed',value=>value.replace("validateInventory(deployment,expectedInventory);",'')],
  ['undeclared metadata trailer',value=>value.replace("          NS_E610_ADMISSION\n","          NS_E610_ADMISSION\n          true || true\n")],
  ['full failure ignored',value=>value.replace('"$NS_SYNC_EXECUTION_RECEIPT_SHA256"\n','"$NS_SYNC_EXECUTION_RECEIPT_SHA256" || true\n')],
  ['normal READY job guard loosened',value=>value.replace('    if: github.event.pull_request.draft == false\n','    if: true\n')],
  ['browser dependency removed',value=>value.replace('    needs: fixture-activation\n','')],
  ['job time budget changed',value=>value.replace('    timeout-minutes: 15\n','    timeout-minutes: 30\n')],
  ['unreviewed locked install changed',value=>value.replace('        run: npm ci\n','        run: npm ci --ignore-scripts\n')]
 ];
 for(const[name,mutate]of controls){const broken=mutate(text);assert.notEqual(broken,text,name+' mutation must apply');assert.throws(()=>normaliseE610AdmissionWorkflow(broken),undefined,name+' must refuse');}
 const begin='// NS_E610_PURE_BEGIN',finish='// NS_E610_PURE_END';
 assert.equal(block.split(begin).length-1,1);assert.equal(block.split(finish).length-1,1);
 const code=block.slice(block.indexOf(begin),block.indexOf(finish)).split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
 const harness="\nconst names=[];\nfunction pass(name,run){run();names.push(name);}\nfunction reject(name,run){assert.throws(run,undefined,name+' must refuse');names.push(name);}\nconst H='1'.repeat(40),B='2'.repeat(40),T='3'.repeat(40),tree='4'.repeat(40),sha='a'.repeat(64),mapSha='b'.repeat(64);\nfunction goodBody(){\n const binding={schemaVersion:'sync-source-binding.v1',repository:'hartican/sportscal',publisherHeadSha:H,expectedPublisherTreeSha:tree,reviewedFinalMapSha256:mapSha,expectedAssembledManifestSha256:sha,expectedAssembledEntryCount:2,expectedM4RelativePathCount:1,qualifierSha256:sha,fixtureSha256:sha,namedAllocationId:'owned-source-test-only',reservationReceiptSha256:sha,freshMainAndReservationBindingSha256:sha,reservationReceiptBase64:'e30=',freshMainAndReservationBindingBase64:'e30='};\n return {schemaVersion:'ns-release-handover.v1',commit:H,scope:'Scope',testsAndResults:'Unrun',databaseAndConfigChanges:'None',dependencies:'None',knownRisks:'Unverified',rollback:'Do not adopt',sourceQualificationBinding:binding};\n}\nfunction bodyBytes(change){const body=goodBody();if(change)change(body);return Buffer.from(JSON.stringify(body));}\npass('exact typed compact body',()=>assert.equal(parseHandover(bodyBytes()).binding.publisherHeadSha,H));\npass('valid Unicode is retained without normalization',()=>{const b=parseHandover(bodyBytes(x=>{x.scope='e\\u0301 / \\u00e9 / \\ud83c\\udfc9';})).body;assert.equal(b.scope,'e\\u0301 / \\u00e9 / \\ud83c\\udfc9');});\nfor(const[name,change]of [\n ['missing top field',x=>delete x.scope],['extra top field',x=>x.extra=true],['array handover field',x=>x.scope=[]],['object handover field',x=>x.dependencies={}],['null handover field',x=>x.rollback=null],['coerced handover field',x=>x.testsAndResults=42],['blank handover field',x=>x.scope=' \\t\\n'],['oversize handover text',x=>x.scope='x'.repeat(4097)],['oversize test text',x=>x.testsAndResults='x'.repeat(8193)],['unpaired surrogate',x=>x.scope='\\ud800'],['wrong commit',x=>x.commit=B],['extra binding field',x=>x.sourceQualificationBinding.expectedBaseSha=B],['missing binding field',x=>delete x.sourceQualificationBinding.fixtureSha256],['wrong schema',x=>x.sourceQualificationBinding.schemaVersion='other'],['wrong repository',x=>x.sourceQualificationBinding.repository='fork/repo'],['string count',x=>x.sourceQualificationBinding.expectedAssembledEntryCount='2'],['unsafe integer count',x=>x.sourceQualificationBinding.expectedAssembledEntryCount=Number.MAX_SAFE_INTEGER+1],['zero count',x=>x.sourceQualificationBinding.expectedAssembledEntryCount=0],['uppercase digest',x=>x.sourceQualificationBinding.qualifierSha256='A'.repeat(64)],['blank allocation',x=>x.sourceQualificationBinding.namedAllocationId=' '],['oversize allocation',x=>x.sourceQualificationBinding.namedAllocationId='x'.repeat(257)]\n])reject(name,()=>parseHandover(bodyBytes(change)));\nreject('body trailing LF',()=>parseHandover(Buffer.concat([bodyBytes(),Buffer.from('\\n')])));\nreject('body leading whitespace',()=>parseHandover(Buffer.concat([Buffer.from(' '),bodyBytes()])));\nreject('body duplicate keys',()=>parseHandover(Buffer.from(JSON.stringify(goodBody()).replace('\"scope\":\"Scope\"','\"scope\":\"Other\",\"scope\":\"Scope\"'))));\nreject('body UTF8 corruption',()=>parseHandover(Buffer.from([0xff])));\nreject('body byte bound',()=>parseHandover(Buffer.alloc(65537,32)));\nconst raw=Buffer.from('{\\n \"schemaVersion\": \"synthetic-only\"\\n}\\n'),encoded=raw.toString('base64');\npass('raw receipt bytes not rewritten',()=>assert(decodeBoundBase64(encoded,hash(raw)).equals(raw)));\nreject('base64 digest drift',()=>decodeBoundBase64(encoded,sha));\nreject('base64 whitespace',()=>decodeBoundBase64(encoded+'\\n',hash(raw)));\nreject('base64 noncanonical alphabet/padding',()=>decodeBoundBase64('e30',hash(Buffer.from('{}'))));\nreject('base64 decoded bound',()=>decodeBoundBase64(Buffer.alloc(16385).toString('base64'),sha));\nfunction eventFixture(){\n return {event:{action:'ready_for_review',number:1,repository:{full_name:'hartican/sportscal'},pull_request:{number:1,draft:false,head:{sha:H,repo:{full_name:'hartican/sportscal'}},base:{sha:B}}},env:{GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_JOB:'fixture-activation',GITHUB_WORKFLOW_REF:'hartican/sportscal/.github/workflows/installed-upgrade-tests.yml@refs/pull/1/merge',GITHUB_SHA:T,GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/pull/1/merge'},observed:{headSha:H,baseSha:B,testedMergeSha:T,checkoutSha:T,parents:[B,H],headTree:tree,testedTree:tree},binding:goodBody().sourceQualificationBinding};\n}\npass('real-role tuple with distinct H and T',()=>{const x=eventFixture();assert.equal(validateEventJoin(x.event,x.env,x.observed,x.binding).T,T);});\nfor(const[name,change]of [\n ['wrong H',x=>x.event.pull_request.head.sha=B],['wrong base',x=>x.observed.baseSha=H],['wrong checkout T',x=>x.observed.checkoutSha=H],['wrong tested tree',x=>x.observed.testedTree=H],['wrong head tree',x=>x.observed.headTree=H],['wrong merge parent order',x=>x.observed.parents=[H,B]],['fork event',x=>x.event.pull_request.head.repo.full_name='fork/repo'],['draft event',x=>x.event.pull_request.draft=true],['wrong event action',x=>x.event.action='opened'],['wrong job namespace',x=>x.env.GITHUB_JOB='other'],['wrong workflow',x=>x.env.GITHUB_WORKFLOW_REF='hartican/sportscal/other.yml@refs/pull/1/merge'],['nondecimal run',x=>x.env.GITHUB_RUN_ID='01'],['wrong run attempt',x=>x.env.GITHUB_RUN_ATTEMPT='0'],['wrong merge ref',x=>x.env.GITHUB_REF='refs/heads/main']\n])reject(name,()=>{const x=eventFixture();change(x);validateEventJoin(x.event,x.env,x.observed,x.binding);});\nconst now=Date.parse('2026-11-06T00:00:00.000Z'),reservation={id:'synthetic-reservation',version:'610'};\nfunction freshFixture(){const b=goodBody().sourceQualificationBinding;return {schemaVersion:'publisher-fresh-main-reservation-binding.v1',candidateHeadSha:H,candidateTreeSha:tree,currentActionAuthority:'synthetic-external-authority-only',expectedAssembledManifestSha256:sha,globalReservationAvailability:'UNKNOWN; no global availability claim',knownConflictingReservation:false,mainObservedAt:'2026-11-06T00:00:00.000Z',mainRefEvidenceSha256:sha,namedAllocationId:b.namedAllocationId,observedMainSha:B,publisherThreadId:'01a0d5ba-943d-74e0-af7f-dab4fb2bdda4',repository:'hartican/sportscal',reservationConflictCheckedAt:'2026-11-06T00:00:00.000Z',reservationId:reservation.id,reservationReceiptSha256:sha,reservationVersion:'610',reviewedFinalMapSha256:mapSha,validUntil:'2026-11-06T00:01:00.000Z'};}\npass('fresh source binding tuple',()=>validateFresh(freshFixture(),goodBody().sourceQualificationBinding,B,reservation,now));\nfor(const[name,change]of [\n ['future main observation',x=>x.mainObservedAt='2026-11-06T00:00:01.000Z'],['future conflict observation',x=>x.reservationConflictCheckedAt='2026-11-06T00:00:01.000Z'],['expired binding',x=>x.validUntil='2026-11-05T23:59:59.000Z'],['invalid timestamp',x=>x.mainObservedAt='2026-11-06'],['wrong reservation',x=>x.reservationVersion='611'],['conflicting reservation',x=>x.knownConflictingReservation=true],['template authority',x=>x.currentActionAuthority='SOURCE_TEMPLATE_ONLY_NOT_ALLOCATION'],['fresh candidate drift',x=>x.candidateHeadSha=B],['fresh map drift',x=>x.reviewedFinalMapSha256=sha],['fresh base drift',x=>x.observedMainSha=H],['fresh extra key',x=>x.extra=true],['fresh missing key',x=>delete x.validUntil]\n])reject(name,()=>{const x=freshFixture();change(x);validateFresh(x,goodBody().sourceQualificationBinding,B,reservation,now);});\npass('owned absolute path',()=>assert.equal(ownedPath('/owned','/owned/receipt.json'),'/owned/receipt.json'));\nreject('owned path escape',()=>ownedPath('/owned','/owned/../outside'));\nreject('relative owned path',()=>ownedPath('/owned','receipt.json'));\nreject('source traversal path',()=>relativePath('a/../b'));\nreject('source duplicate paths',()=>parseGitEntries(Buffer.from('100644 blob '+H+'\\ta\\0'+'100644 blob '+H+'\\ta\\0')));\nreject('unsupported gitlink',()=>parseGitEntries(Buffer.from('160000 commit '+H+'\\ta\\0')));\nreject('missing Git NUL',()=>parseGitEntries(Buffer.from('100644 blob '+H+'\\ta')));\npass('raw source Unicode path retained',()=>assert.equal(parseGitEntries(Buffer.from('100644 blob '+H+'\\te\\u0301.js\\0'))[0].path,'e\\u0301.js'));\npass('canonical manifest key order, UTF8 row order, one LF',()=>{const b=assembledBytes(H,tree,mapSha,[{path:'\\u00e9',mode:'100644',gitBlob:H,bytes:0,sha256:sha},{path:'a',mode:'100644',gitBlob:H,bytes:0,sha256:sha}]);const s=b.toString();assert.equal(s.endsWith('}\\n'),true);const v=JSON.parse(s);assert.equal(v.files[0].path,'a');assert.deepEqual(Object.keys(v),['schemaVersion','revision','tree','entryCount','reviewedMapSha256','files']);assert.deepEqual(Object.keys(v.files[0]),['path','mode','type','gitBlob','bytes','sha256']);});\npass('regular no-follow stat',()=>regularInputStat({isFile:()=>true,isSymbolicLink:()=>false,size:0}));\nreject('symlink stat rejected for regular input',()=>regularInputStat({isFile:()=>false,isSymbolicLink:()=>true,size:1}));\nconst st={dev:1,ino:2,size:3,mode:4,mtimeMs:5,ctimeMs:6};\npass('stable file identity tuple',()=>stableStats(st,{...st},'Synthetic'));\nreject('unstable inode',()=>stableStats(st,{...st,ino:99},'Synthetic'));\nreject('unstable size',()=>stableStats(st,{...st,size:99},'Synthetic'));\npass('legitimate parent-component link target',()=>linkWithin('/root/node_modules','/root/node_modules/.bin/acorn','../acorn/bin/acorn'));\nreject('escaping link target',()=>linkWithin('/root/node_modules','/root/node_modules/.bin/acorn','../../../secret'));\nreject('absolute link target',()=>linkWithin('/root','/root/link','/secret'));\npass('current platform tuple',()=>validateRuntimePlatform('v24.21.0','linux','x64'));\nreject('wrong Node',()=>validateRuntimePlatform('v25.0.0','linux','x64'));\nreject('wrong platform',()=>validateRuntimePlatform('v24.21.0','darwin','x64'));\nreject('wrong architecture',()=>validateRuntimePlatform('v24.21.0','linux','arm64'));\nconst policy={schemaVersion:'deployment-manifest.v1',includeDirectories:['lib/','data/'],includeFiles:[],rootExtensions:['.html'],excludeDirectories:[],excludeFiles:[],preserveBytes:['data/preserve.json'],compactJson:true,acceptedBytes:1000};\nconst source=new Map([['lib/root.js',Buffer.from(\"require('../scripts/helper')\")],['scripts/helper.js',Buffer.from(\"require('./nested')\")],['scripts/nested.js',Buffer.from('module.exports=1;')],['data/a.json',Buffer.from('{ \"x\": 1 }\\n')],['data/preserve.json',Buffer.from('{ \"x\": 2 }\\n')],['.env.secret',Buffer.from('not-public')],['other.txt',Buffer.from('not-selected')]]);\nconst synthetic=[...source.keys()].map(name=>({path:name,mode:'100644',gitBlob:H}));\npass('full projection closure, exclusions, compact and preserve',()=>{const rows=projection(synthetic,e=>source.get(e.path),policy);assert.deepEqual(rows.map(e=>e.row.path),['lib/root.js','scripts/helper.js','scripts/nested.js','data/a.json','data/preserve.json']);assert.equal(rows[3].bytes.toString(),'{\"x\":1}\\n');assert.equal(rows[4].bytes.toString(),'{ \"x\": 2 }\\n');});\nreject('secret runtime dependency closure',()=>{const s=new Map(source);s.set('lib/root.js',Buffer.from(\"require('../.env.secret')\"));projection(synthetic,e=>s.get(e.path),policy);});\nconst inventory={revision:H,bytes:1,files:[{path:'x',gitBlob:H,sourceBytes:1,bytes:1,transform:'identity',sha256:sha}]};\npass('exact projected inventory',()=>validateInventory(JSON.parse(JSON.stringify(inventory)),inventory));\nreject('incomplete projection',()=>validateInventory({...inventory,files:[]},inventory));\nreject('wrong projection hash',()=>{const x=JSON.parse(JSON.stringify(inventory));x.files[0].sha256=mapSha;validateInventory(x,inventory);});\nreject('wrong source transformation',()=>{const x=JSON.parse(JSON.stringify(inventory));x.files[0].transform='json-compact';validateInventory(x,inventory);});\nreject('wrong projection revision',()=>validateInventory({...inventory,revision:B},inventory));\nreject('invented deployment manifest fields',()=>validateInventory({...inventory,tree},inventory));\n({groups:names.length,names,syntheticOnly:true,engineRuns:0,serviceRequests:0,releaseAcceptance:false});\n";
 const pure=require('node:vm').runInNewContext(code+'\n'+harness,{assert,Buffer,TextDecoder:require('node:util').TextDecoder,path:require('node:path'),crypto,hash},{timeout:5000});
 return {restored,report:{workflowNegativeGroups:controls.length,workflowNames:controls.map(([name])=>name),producerContractControls:pure,typedClosedVmOnly:true,realFilesystemOrAppControls:false,engineRuns:0,serviceRequests:0,releaseAcceptance:false}};
}

function e610ConsumerAdmissionRegressions(qualifierSource,fixtureBytes,policyBytes,reservationBytes){
 const nodePath=require('node:path'),sandboxVm=require('node:vm');
 assert.equal(hash(reservationBytes),'4b164a34459bdce86f754fee7affc7b69e3d32da7091cfc39a715d4229853feb','Real immutable historical reservation witness, never a mocked digest');
 const boundary="const inputRow=sourceLeaves.get('scripts/fixtures/sync608-reported-hold-20261103.json');";
 assert.equal(qualifierSource.split(boundary).length-1,1,'Exact post-admit/pre-fixture boundary');
 const prefix=qualifierSource.slice(0,qualifierSource.indexOf(boundary));
 assert(prefix.includes('try{fullAdmission=admit();}catch(error){'),'Actual admission dispatcher retained');
 const sentinel='NS_E610_ACTUAL_ADMISSION_SENTINEL';
 const program=new sandboxVm.Script(prefix+'\nthrow new Error('+JSON.stringify(sentinel)+');',{filename:'actual-selected-qualifier-admission.cjs'});
 const ROOT='/virtual/repo',TEMP='/virtual/runner',ADMISSION=TEMP+'/ns-e610-admission',NODE='/virtual/node',H='1'.repeat(40),T='2'.repeat(40),BASE='3'.repeat(40),TREE='4'.repeat(40),MAP='b'.repeat(64),NOW=Date.parse('2026-11-06T00:00:00.000Z');
 const oid=bytes=>crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 const json=object=>Buffer.from(JSON.stringify(object,null,2)+'\n');
 function fixture(){
  const files=new Map();let inode=1;
  const state={files,readCounts:new Map(),openCounts:new Map(),gitCalls:[],appImports:0,matrixArms:0,logs:[],budgetPrime:false,primed:false,context:null,drift:null,resolveTerser:ROOT+'/node_modules/terser/dist/bundle.min.js'};
  function directory(dir){if(files.has(dir))return;const parent=nodePath.dirname(dir);if(parent!==dir)directory(parent);files.set(dir,{kind:'dir',mode:0o40700,uid:1000,gid:1000,ino:inode++,bytes:Buffer.alloc(0)});}
  function file(name,bytes,mode=0o100644){directory(nodePath.dirname(name));const old=files.get(name);files.set(name,{kind:'file',mode,uid:1000,gid:1000,ino:old?.ino||inode++,bytes:Buffer.from(bytes)});}
  function link(name,target){directory(nodePath.dirname(name));files.set(name,{kind:'link',mode:0o120777,uid:1000,gid:1000,ino:inode++,bytes:Buffer.from(target)});}
  const source=new Map([
   ['scripts/validate-sync608-reported-hold.js',Buffer.from(qualifierSource)],
   ['scripts/fixtures/sync608-reported-hold-20261103.json',Buffer.from(fixtureBytes)],
   ['config/deployment-manifest.json',Buffer.from(policyBytes)],
   ['package-lock.json',json({lockfileVersion:3,packages:{'node_modules/terser':{version:'5.44.0'}}})],
   ['lib/synthetic-admission-control.js',Buffer.from('module.exports=1;\n')]
  ]);
  for(const [name,bytes]of source)file(ROOT+'/'+name,bytes);
  file(ROOT+'/node_modules/.package-lock.json',json({lockfileVersion:3,packages:{'node_modules/terser':{version:'5.44.0'}}}));
  file(ROOT+'/node_modules/terser/package.json',json({name:'terser',version:'5.44.0'}));
  file(ROOT+'/node_modules/terser/dist/package.json',json({type:'commonjs'}));
  file(ROOT+'/node_modules/terser/dist/bundle.min.js',Buffer.from('module.exports={};\n'));
  file(ROOT+'/node_modules/acorn/bin/acorn',Buffer.from('#!/usr/bin/env node\n'),0o100755);
  link(ROOT+'/node_modules/.bin/acorn','../acorn/bin/acorn');
  file(NODE,Buffer.from('SYNTHETIC_NODE_IDENTITY_NOT_EXECUTABLE_EVIDENCE\n'),0o100755);
  const sourceRows=[...source.keys()].sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b))).map(name=>{const bytes=source.get(name);return {path:name,mode:'100644',type:'blob',gitBlob:oid(bytes),bytes:bytes.length,sha256:hash(bytes)};});
  const assembled={schemaVersion:'assembled-git-source-manifest.v1',revision:H,tree:TREE,entryCount:sourceRows.length,reviewedMapSha256:MAP,files:sourceRows};
  function children(dir){return [...files.keys()].filter(p=>p!==dir&&nodePath.dirname(p)===dir).map(p=>nodePath.basename(p)).sort();}
  function identity(name,relative){const f=files.get(name);assert(f&&f.kind!=='dir');return {path:relative,bytes:f.bytes.length,permissions:(f.mode&0o7777).toString(8).padStart(4,'0'),mode:f.kind==='link'?'120000':f.mode&0o111?'100755':'100644',sha256:hash(f.bytes),gitBlob:oid(f.bytes),...(f.kind==='link'?{link:f.bytes.toString('utf8')}:{})};}
  const depRows=[];function walk(dir){for(const name of children(dir)){const full=dir+'/'+name;if(files.get(full).kind==='dir')walk(full);else depRows.push(identity(full,nodePath.relative(ROOT,full)));}}walk(ROOT+'/node_modules');
  const proof={schemaVersion:'canonical-ci-dependencies.v1',installCommand:'npm ci',lockSha256:hash(source.get('package-lock.json')),installedLockSha256:hash(files.get(ROOT+'/node_modules/.package-lock.json').bytes),terser:{main:'node_modules/terser/dist/bundle.min.js',package:'node_modules/terser',version:'5.44.0',entryIdentity:depRows.find(x=>x.path==='node_modules/terser/dist/bundle.min.js'),manifestIdentity:depRows.find(x=>x.path==='node_modules/terser/package.json')},fileMapSha256:hash(Buffer.from(JSON.stringify(depRows))),files:depRows,auditRemediation:false};
  const policy=JSON.parse(policyBytes.toString('utf8')),selected=new Set(sourceRows.filter(row=>!row.path.includes('supabase_keys.txt')&&!row.path.split('/').some(x=>x.startsWith('.env'))&&!policy.excludeDirectories.some(x=>row.path.startsWith(x))&&!policy.excludeFiles.includes(row.path)&&(policy.includeDirectories.some(x=>row.path.startsWith(x))||policy.includeFiles.includes(row.path)||(!row.path.includes('/')&&policy.rootExtensions.includes(nodePath.extname(row.path))))).map(x=>x.path));
  for(const name of selected)if(name.endsWith('.js'))for(const match of source.get(name).toString('utf8').matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)){const base=nodePath.posix.normalize(nodePath.posix.join(nodePath.posix.dirname(name),match[1])),dependency=[base,base+'.js',base+'.json',base+'/index.js'].find(x=>source.has(x));if(dependency)selected.add(dependency);}
  const deployment={revision:H,bytes:0,files:[]};
  for(const row of sourceRows.filter(x=>selected.has(x.path))){const raw=source.get(row.path),compact=policy.compactJson&&row.path.endsWith('.json')&&!policy.preserveBytes.includes(row.path),bytes=compact?Buffer.from(JSON.stringify(JSON.parse(raw))+'\n'):raw;deployment.files.push({path:row.path,gitBlob:row.gitBlob,sourceBytes:raw.length,bytes:bytes.length,transform:compact?'json-compact':'identity',sha256:hash(bytes)});deployment.bytes+=bytes.length;file(ADMISSION+'/deployment-snapshot/'+row.path,bytes);}
  const reservation=JSON.parse(reservationBytes.toString('utf8'));
  const binding={schemaVersion:'sync-source-binding.v1',repository:'hartican/sportscal',publisherHeadSha:H,expectedPublisherTreeSha:TREE,reviewedFinalMapSha256:MAP,expectedAssembledManifestSha256:null,expectedAssembledEntryCount:sourceRows.length,expectedM4RelativePathCount:1,qualifierSha256:hash(Buffer.from(qualifierSource)),fixtureSha256:hash(fixtureBytes),namedAllocationId:'SYNTHETIC_CONTROL_ONLY_NOT_ACTUAL_AUTHORITY',reservationReceiptSha256:hash(reservationBytes),freshMainAndReservationBindingSha256:null,reservationReceiptBase64:reservationBytes.toString('base64'),freshMainAndReservationBindingBase64:null};
  const fresh={schemaVersion:'publisher-fresh-main-reservation-binding.v1',publisherThreadId:'01a0d5ba-943d-74e0-af7f-dab4fb2bdda4',repository:'hartican/sportscal',candidateHeadSha:H,candidateTreeSha:TREE,reviewedFinalMapSha256:MAP,expectedAssembledManifestSha256:null,observedMainSha:BASE,mainObservedAt:new Date(NOW).toISOString(),mainRefEvidenceSha256:'c'.repeat(64),reservationId:reservation.id,reservationVersion:'610',reservationReceiptSha256:hash(reservationBytes),reservationConflictCheckedAt:new Date(NOW).toISOString(),knownConflictingReservation:false,globalReservationAvailability:'UNKNOWN; no global availability claim',namedAllocationId:binding.namedAllocationId,validUntil:new Date(NOW+60000).toISOString(),currentActionAuthority:'SYNTHETIC_CONTROL_ONLY_NO_REAL_ALLOCATION'};
  const body={schemaVersion:'ns-release-handover.v1',scope:'Synthetic source-admission controls only',commit:H,testsAndResults:'No real application or release proof',dependencies:'None',databaseAndConfigChanges:'None',knownRisks:'Synthetic only',rollback:'Do not publish controls',sourceQualificationBinding:binding};
  const event={action:'ready_for_review',number:1,repository:{full_name:'hartican/sportscal'},pull_request:{number:1,draft:false,head:{sha:H,repo:{full_name:'hartican/sportscal'}},base:{sha:BASE},body:null}};
  const runtime={node:'v24.21.0',platform:'linux',arch:'x64',npm:'11.19.0',nodeBinary:identity(NODE,NODE),dependencyProof:null};
  function descriptor(name,bytes){file(name,bytes,0o100600);return {path:name,bytes:bytes.length,sha256:hash(bytes)};}
  const reservationFile=descriptor(ADMISSION+'/reservation-receipt.json',reservationBytes);
  const receipt={schemaVersion:'sync-qualification-execution-receipt.v1',publisherHeadSha:H,publisherTreeSha:TREE,releaseGitSha:H,actualTestedMergeSha:T,actualAssembledSourceManifestPath:ADMISSION+'/assembled-source-manifest.json',actualAssembledSourceManifestSha256:null,actualDeploymentSourceManifestPath:ADMISSION+'/deployment-snapshot/deployment-files.json',actualDeploymentSourceManifestSha256:null,actualNodeBinarySha256:runtime.nodeBinary.sha256,actualDependencyProofSha256:null,freshMainAndReservationBindingSha256:null,namedAllocationId:binding.namedAllocationId,actualCloudRunId:'1',actualCloudRunAttempt:1,actualCloudJobId:'github-job-key:fixture-activation',actualCloudJobKey:'fixture-activation',actualCloudNumericJobId:null,actualWorkflowPath:'.github/workflows/installed-upgrade-tests.yml',admissionGranted:true,headRole:'pull_request.head.sha',testedCommitRole:'pull_request-merge-checkout',releaseRole:'source-qualification-candidate',jobIdKind:'github-job-key',observedAt:new Date(NOW).toISOString(),eventBodySha256:null,approvedFinalMap:{reviewedMapSha256:MAP,expectedTree:TREE,entryCount:sourceRows.length,m4RelativePathCount:1,assembledManifestSha256:null},cloudContext:{repository:'hartican/sportscal',eventName:'pull_request',pullRequestNumber:'1',ref:'refs/pull/1/merge',runId:'1',runAttempt:1,jobKey:'fixture-activation'},qualifier:{path:sourceRows.find(x=>x.path==='scripts/validate-sync608-reported-hold.js').path,bytes:Buffer.byteLength(qualifierSource),sha256:binding.qualifierSha256,gitBlob:oid(Buffer.from(qualifierSource)),mode:'100644'},fixture:{path:'scripts/fixtures/sync608-reported-hold-20261103.json',bytes:fixtureBytes.length,sha256:binding.fixtureSha256,gitBlob:oid(fixtureBytes),mode:'100644'},git:{headSha:H,headTree:TREE,testedMergeSha:T,testedTree:TREE,baseSha:BASE,testedMergeParents:[BASE,H],trackedSourceUnchanged:true},runtime,reservation:{id:reservation.id,version:'610',receipt:reservationFile},freshMainAndReservationBinding:{receipt:null}};
  const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_JOB:'fixture-activation',RUNNER_TEMP:TEMP,GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/pull/1/merge',GITHUB_SHA:T,GITHUB_EVENT_PATH:TEMP+'/event.json'};
  const execution=ADMISSION+'/execution-receipt.json';
  let argv=['node',ROOT+'/scripts/validate-sync608-reported-hold.js','--full','--execution-receipt',execution,'--execution-receipt-sha256',null];
  const x={state,files,sourceRows,source,proof,deployment,assembled,binding,fresh,body,event,receipt,env,runtime,file,link,identity,execution,argv,gitParents:[BASE,H],gitTree:TREE,gitHead:T};
  x.writeReceipt=()=>{const bytes=json(receipt);file(execution,bytes,0o100600);argv[6]=hash(bytes);};
  x.writeBody=()=>{event.pull_request.body=x.bodyOverride===undefined?JSON.stringify(body):x.bodyOverride;receipt.eventBodySha256=hash(Buffer.from(event.pull_request.body));file(env.GITHUB_EVENT_PATH,json(event),0o100600);x.writeReceipt();};
  x.writeFresh=()=>{const bytes=json(fresh),d=descriptor(ADMISSION+'/fresh-main-reservation-binding.json',bytes);receipt.freshMainAndReservationBinding={receipt:d};receipt.freshMainAndReservationBindingSha256=d.sha256;binding.freshMainAndReservationBindingSha256=d.sha256;binding.freshMainAndReservationBindingBase64=bytes.toString('base64');x.writeBody();};
  x.writeAssembled=()=>{const bytes=Buffer.from(JSON.stringify(assembled)+'\n');descriptor(receipt.actualAssembledSourceManifestPath,bytes);const digest=hash(bytes);receipt.actualAssembledSourceManifestSha256=digest;receipt.approvedFinalMap.assembledManifestSha256=digest;binding.expectedAssembledManifestSha256=digest;fresh.expectedAssembledManifestSha256=digest;x.writeFresh();};
  x.writeProof=()=>{proof.fileMapSha256=hash(Buffer.from(JSON.stringify(proof.files)));const d=descriptor(ADMISSION+'/dependencies.json',json(proof));runtime.dependencyProof={...d,schemaVersion:'canonical-ci-dependencies.v1'};receipt.actualDependencyProofSha256=d.sha256;x.writeReceipt();};
  x.writeDeployment=()=>{const bytes=json(deployment);descriptor(receipt.actualDeploymentSourceManifestPath,bytes);receipt.actualDeploymentSourceManifestSha256=hash(bytes);x.writeReceipt();};
  x.rebindDependency=name=>{const row=identity(ROOT+'/'+name,name),index=proof.files.findIndex(y=>y.path===name);assert(index>=0);proof.files[index]=row;if(name===proof.terser.main)proof.terser.entryIdentity=row;if(name===proof.terser.package+'/package.json')proof.terser.manifestIdentity=row;x.writeProof();};
  x.writeProof();x.writeDeployment();x.writeAssembled();return x;
 }
 function run(test){
  const x=fixture();test.change?.(x);
  const fds=new Map();let fd=10;
  const stat=full=>{
   const item=x.files.get(full);assert(item,'Unexpected mocked stat '+full);
   if(x.state.budgetPrime&&!x.state.primed&&full===ROOT+'/node_modules/.package-lock.json'){
    x.state.primed=true;sandboxVm.runInContext('readBytes=limits.totalBytes;',x.state.context,{timeout:100});
   }
   let ino=item.ino;if(x.state.drift===full&&(x.state.readCounts.get(full)||0)>0)ino++;
   return {dev:1,ino,uid:item.uid,gid:item.gid,mode:item.mode,size:item.reportedSize===undefined?item.bytes.length:item.reportedSize,mtimeMs:NOW,ctimeMs:NOW,isFile:()=>item.kind==='file',isDirectory:()=>item.kind==='dir',isSymbolicLink:()=>item.kind==='link'};
  };
  function real(full,depth=0){assert(depth<32,'Mock link recursion');const item=x.files.get(full);assert(item,'Unexpected mocked realpath '+full);if(item.kind==='link')return real(nodePath.resolve(nodePath.dirname(full),item.bytes.toString('utf8')),depth+1);return full;}
  const fakeFs={constants:{O_RDONLY:0,O_NOFOLLOW:131072},realpathSync:full=>real(String(full)),lstatSync:full=>stat(String(full)),existsSync:full=>x.files.has(String(full)),
   openSync:(full,flags)=>{full=String(full);const st=stat(full);assert(st.isFile(),'Mock no-follow open');x.state.openCounts.set(full,(x.state.openCounts.get(full)||0)+1);const n=fd++;fds.set(n,full);return n;},
   fstatSync:n=>stat(fds.get(n)),closeSync:n=>{assert(fds.delete(n),'Unknown mock fd');},
   readFileSync:(arg,encoding)=>{const full=typeof arg==='number'?fds.get(arg):String(arg),item=x.files.get(full);assert(item&&item.kind==='file','Unexpected mock read '+full);x.state.readCounts.set(full,(x.state.readCounts.get(full)||0)+1);return encoding==='utf8'?item.bytes.toString('utf8'):Buffer.from(item.bytes);},
   readlinkSync:(full,options)=>{const item=x.files.get(String(full));assert(item&&item.kind==='link');return options?.encoding==='buffer'?Buffer.from(item.bytes):item.bytes.toString('utf8');},
   readdirSync:(dir,options)=>{dir=String(dir);const children=[...x.files.keys()].filter(p=>p!==dir&&nodePath.dirname(p)===dir).map(p=>nodePath.basename(p)).sort();return options?.withFileTypes?children.map(name=>{const st=stat(dir+'/'+name);return {name,isDirectory:st.isDirectory,isFile:st.isFile,isSymbolicLink:st.isSymbolicLink};}):children;}
  };
  const fakeCp={execFileSync:(command,args,options)=>{
   assert.equal(command,'git','No real process');assert.equal(options.cwd,ROOT);assert.equal(options.timeout,5000);assert.equal(options.maxBuffer,4194304);x.state.gitCalls.push(args.slice());
   if(args.join(' ')==='rev-parse HEAD HEAD^{tree} '+H+'^{tree}')return Buffer.from([x.gitHead,x.gitTree,x.gitTree].join('\n')+'\n');
   if(args.join(' ')==='show -s --format=%P '+T)return Buffer.from(x.gitParents.join(' ')+'\n');
   if(args.join(' ')==='ls-tree -r -z --full-tree HEAD')return Buffer.from(x.sourceRows.map(r=>r.mode+' '+r.type+' '+r.gitBlob+'\t'+r.path+'\0').join(''));
   throw Error('Unexpected mock Git command '+JSON.stringify(args));
  }};
  function requireMock(name){
   if(name==='node:fs')return fakeFs;if(name==='node:path')return nodePath;if(name==='node:assert/strict')return assert;if(name==='node:crypto')return crypto;if(name==='node:child_process')return fakeCp;
   if(name==='node:vm')return {runInNewContext:()=>{x.state.matrixArms++;throw Error('APP_MATRIX_FORBIDDEN');},runInContext:()=>{x.state.matrixArms++;throw Error('APP_MATRIX_FORBIDDEN');},Script:function(){x.state.matrixArms++;throw Error('APP_MATRIX_FORBIDDEN');}};
   x.state.appImports++;throw Error('APP_IMPORT_FORBIDDEN '+name);
  }
  requireMock.resolve=name=>{assert.equal(name,'terser');return x.state.resolveTerser;};
  class MockDate extends Date{constructor(...args){super(...(args.length?args:[NOW]));}static now(){return NOW;}}
  const consoleMock={log:(...args)=>x.state.logs.push(args.join(' ')),error:(...args)=>x.state.logs.push(args.join(' '))};
  const context=sandboxVm.createContext({require:requireMock,__dirname:ROOT+'/scripts',Buffer,console:consoleMock,Date:MockDate,process:{argv:x.argv,env:x.env,version:'v24.21.0',platform:'linux',arch:'x64',execPath:NODE,geteuid:()=>1000,getuid:()=>1000}});x.state.context=context;
  let error=null;try{program.runInContext(context,{timeout:1000});}catch(caught){error=caught;}
  const failed=x.state.logs.some(line=>{try{return JSON.parse(line).status==='ADMISSION_FAILED';}catch{return false;}});
  assert.equal(x.state.appImports,0,test.name+' no app imports');assert.equal(x.state.matrixArms,0,test.name+' no matrix arms');
  if(test.positive){assert(error&&error.message===sentinel,test.name+' must reach controlled post-admit sentinel: '+(error?.message||'no throw'));assert.equal(failed,false,test.name+' no admission failure');}
  else{assert(error&&error.message!==sentinel,test.name+' cannot reach positive sentinel');assert.equal(failed,true,test.name+' must report ADMISSION_FAILED');if(test.message)assert(test.message.test(error.message),test.name+' expected guard: '+error.message);}
  if(test.lockNotRead){assert.equal(x.state.readCounts.get(ROOT+'/node_modules/.package-lock.json')||0,0,test.name+' installed-lock bytes refused before read');assert.equal(x.state.openCounts.get(ROOT+'/node_modules/.package-lock.json')||0,0,test.name+' installed-lock refused before open');}
  return {name:test.name,status:'PASS_CONTROL',positive:!!test.positive,appImports:0,matrixArms:0,installedLockReads:x.state.readCounts.get(ROOT+'/node_modules/.package-lock.json')||0};
 }
 const tests=[
  {name:'Valid actual admission with nested dist metadata and legitimate ../acorn link',positive:true},
  {name:'Missing receipt field',change:x=>{delete x.receipt.actualWorkflowPath;x.writeReceipt();}},
  {name:'Wrong workflow field',change:x=>{x.receipt.actualWorkflowPath='other.yml';x.writeReceipt();}},
  {name:'Wrong repository',change:x=>{x.env.GITHUB_REPOSITORY='fork/repo';}},
  {name:'Draft event',change:x=>{x.event.pull_request.draft=true;x.writeBody();}},
  {name:'Wrong event action',change:x=>{x.event.action='opened';x.writeBody();}},
  {name:'Unpaired body surrogate',change:x=>{x.body.scope='\ud800';x.writeBody();}},
  {name:'Oversized handover text',change:x=>{x.body.scope='x'.repeat(4097);x.writeBody();}},
  {name:'Coerced source count',change:x=>{x.binding.expectedAssembledEntryCount=String(x.binding.expectedAssembledEntryCount);x.writeBody();}},
  {name:'Assembled manifest byte drift',change:x=>{const f=x.files.get(x.receipt.actualAssembledSourceManifestPath);f.bytes=Buffer.concat([f.bytes,Buffer.from(' ')]);}},
  {name:'Duplicate assembled source row',change:x=>{x.assembled.files.push({...x.assembled.files.at(-1)});x.assembled.entryCount++;x.binding.expectedAssembledEntryCount++;x.receipt.approvedFinalMap.entryCount++;x.writeAssembled();}},
  {name:'Unsafe assembled source path',change:x=>{x.assembled.files[0].path='../escape';x.writeAssembled();}},
  {name:'Invalid fresh timestamp',change:x=>{x.fresh.mainObservedAt='2026-11-06';x.writeFresh();}},
  {name:'Future main observation',change:x=>{x.fresh.mainObservedAt=new Date(NOW+1).toISOString();x.writeFresh();}},
  {name:'Receipt digest drift',change:x=>{x.argv[6]='e'.repeat(64);}},
  {name:'Missing CLI arguments',change:x=>x.argv.splice(2)},
  {name:'Unknown CLI argument',change:x=>x.argv[2]='--priority-source-only'},
  {name:'Duplicate CLI argument',change:x=>x.argv.push('--full')},
  {name:'NULL admission field',change:x=>{x.receipt.actualNodeBinarySha256=null;x.writeReceipt();}},
  {name:'Extra receipt field',change:x=>{x.receipt.extra=true;x.writeReceipt();}},
  {name:'Wrong numeric job namespace',change:x=>{x.receipt.actualCloudJobId='123';x.writeReceipt();}},
  {name:'Wrong job key',change:x=>x.env.GITHUB_JOB='other'},
  {name:'Wrong run attempt',change:x=>x.env.GITHUB_RUN_ATTEMPT='2'},
  {name:'Wrong event head',change:x=>{x.event.pull_request.head.sha=BASE;x.writeBody();}},
  {name:'Wrong event base',change:x=>{x.event.pull_request.base.sha=H;x.writeBody();}},
  {name:'Wrong merge parent order',change:x=>x.gitParents=[H,BASE]},
  {name:'Unequal complete tree',change:x=>x.gitTree=H},
  {name:'Body trailing LF',change:x=>{x.bodyOverride=JSON.stringify(x.body)+'\n';x.writeBody();}},
  {name:'Body duplicated key',change:x=>{x.bodyOverride=JSON.stringify(x.body).replace('"scope":"Synthetic source-admission controls only"','"scope":"Other","scope":"Synthetic source-admission controls only"');x.writeBody();}},
  {name:'Wrong scalar handover type',change:x=>{x.body.scope=[];x.writeBody();}},
  {name:'Extra source binding key',change:x=>{x.binding.extra=true;x.writeBody();}},
  {name:'Noncanonical base64 receipt',change:x=>{x.binding.reservationReceiptBase64+='\n';x.writeBody();}},
  {name:'Wrong complete manifest digest',change:x=>{x.receipt.actualAssembledSourceManifestSha256='d'.repeat(64);x.writeReceipt();}},
  {name:'Missing complete source entry',change:x=>{x.assembled.files.pop();x.writeAssembled();}},
  {name:'Raw source byte drift',change:x=>x.file(ROOT+'/lib/synthetic-admission-control.js',Buffer.from('changed'))},
  {name:'Wrong qualifier digest',change:x=>{x.binding.qualifierSha256='d'.repeat(64);x.writeBody();}},
  {name:'External path escape',change:x=>{x.argv[4]='/outside/receipt.json';}},
  {name:'Foreign receipt owner',change:x=>{x.files.get(x.execution).uid=99;}},
  {name:'Receipt symlink rejected',change:x=>x.link(x.execution,'other.json')},
  {name:'Unstable receipt read',change:x=>x.state.drift=x.execution},
  {name:'Wrong projected revision',change:x=>{x.deployment.revision=BASE;x.writeDeployment();}},
  {name:'Omitted deployment projection',change:x=>{x.deployment.files.pop();x.writeDeployment();}},
  {name:'Wrong deployment transform',change:x=>{x.deployment.files[0].transform='wrong';x.writeDeployment();}},
  {name:'Wrong runtime Node',change:x=>{x.receipt.runtime.node='v25.0.0';x.writeReceipt();}},
  {name:'Node binary byte drift',change:x=>x.file(NODE,Buffer.from('changed-node'),0o100755)},
  {name:'Wrong current committed lock hash',change:x=>{x.proof.lockSha256='d'.repeat(64);x.writeProof();}},
  {name:'Incomplete installed dependency map',change:x=>{x.proof.files.pop();x.writeProof();}},
  {name:'Reordered dependency map',change:x=>{x.proof.files.reverse();x.writeProof();}},
  {name:'Wrong explicit Terser owner name',change:x=>{x.file(ROOT+'/node_modules/terser/package.json',json({name:'dist',version:'5.44.0'}));x.rebindDependency('node_modules/terser/package.json');}},
  {name:'Resolved Terser entry outside owner',change:x=>{x.state.resolveTerser=ROOT+'/node_modules/acorn/bin/acorn';}},
  {name:'Escaping dependency link target',change:x=>{x.file('/virtual/outside',Buffer.from('outside'));x.link(ROOT+'/node_modules/.bin/acorn','../../../outside');x.rebindDependency('node_modules/.bin/acorn');}},
  {name:'Wrong immutable reservation digest',change:x=>{x.files.get(x.receipt.reservation.receipt.path).bytes=Buffer.from('{}');}},
  {name:'Known reservation conflict',change:x=>{x.fresh.knownConflictingReservation=true;x.writeFresh();}},
  {name:'Expired fresh binding',change:x=>{x.fresh.validUntil=new Date(NOW-1).toISOString();x.writeFresh();}},
  {name:'Future observation',change:x=>{x.receipt.observedAt=new Date(NOW+1).toISOString();x.writeReceipt();}},
  {name:'Template action authority',change:x=>{x.fresh.currentActionAuthority='SOURCE_TEMPLATE_ONLY_NOT_ALLOCATION';x.writeFresh();}},
  {name:'Oversized installed lock refused before buffer read',change:x=>{x.files.get(ROOT+'/node_modules/.package-lock.json').reportedSize=256*1024*1024+1;},lockNotRead:true,message:/file exceeds finite bound/},
  {name:'Cumulative budget refused before installed lock buffer read',change:x=>{x.state.budgetPrime=true;},lockNotRead:true,message:/metadata-phase cumulative read bound/}
 ];
 const results=[],failures=[];for(const test of tests){try{results.push(run(test));}catch(error){failures.push({name:test.name,message:error.message});results.push({name:test.name,status:'FAIL_CONTROL',message:error.message});}}
 if(failures.length){const error=Error('Actual consumer admission controls failed: '+JSON.stringify(failures));error.e610Report={groups:tests.length,results,failures,sourceSha256:hash(Buffer.from(qualifierSource)),releaseAcceptance:false};throw error;}
 return {groups:tests.length,positive:1,negative:tests.length-1,results,consumerSourceSha256:hash(Buffer.from(qualifierSource)),actualConsumerReader:true,closedMockFsGitEnvironmentClock:true,budgetPriming:'One negative primes only the mocked prior-read ledger at installed-lock lstat; no2GiB allocation or IO is claimed.',historicalReservationWitnessSha256:hash(reservationBytes),realFilesystemScansPerNegative:0,appImports:0,matrixArms:0,realApplicationAcceptance:false,releaseAcceptance:false};
}


function e610ConsumerControlsForContext(){
 const skipped=reason=>({status:'SKIPPED_NOT_ELIGIBLE_CONTEXT',groups:null,positive:null,negative:null,reason,requiredSourceAdmissionGateClosed:false,releaseAcceptance:false});
 if(process.env.GITHUB_EVENT_NAME!=='pull_request'||process.env.GITHUB_JOB!=='fixture-activation')return skipped('Actual-reader controls require existing fixture-activation PR Ready context; original context-independent contracts still run.');
 assert.equal(process.env.GITHUB_ACTIONS,'true','Actual required source context');
 const eventPath=process.env.GITHUB_EVENT_PATH;assert(typeof eventPath==='string'&&require('node:path').isAbsolute(eventPath),'Existing event input required');
 const before=fs.lstatSync(eventPath);assert(before.isFile()&&!before.isSymbolicLink()&&before.size<=4*1024*1024,'Bounded regular event input');
 const fd=fs.openSync(eventPath,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let raw;
 const stamp=s=>[s.dev,s.ino,s.size,s.mode,s.mtimeMs,s.ctimeMs];
 try{assert.deepEqual(stamp(fs.fstatSync(fd)),stamp(before));raw=fs.readFileSync(fd);assert.deepEqual(stamp(fs.fstatSync(fd)),stamp(before));}finally{fs.closeSync(fd);}
 assert.deepEqual(stamp(fs.lstatSync(eventPath)),stamp(before));assert.equal(raw.length,before.size);
 const eventText=raw.toString('utf8');assert(Buffer.from(eventText).equals(raw),'Event UTF8');const event=JSON.parse(eventText);
 if(event.action!=='ready_for_review'||event.pull_request?.draft!==false)return skipped('Not the selected non-draft Ready source-qualification event; no consumer-control PASS or admission credit.');
 assert.equal(event.repository?.full_name,'hartican/sportscal');assert.equal(typeof event.pull_request.body,'string','Missing required reservation witness body');
 const bodyBytes=Buffer.from(event.pull_request.body);assert(bodyBytes.length<=65536,'Body byte bound');const body=JSON.parse(event.pull_request.body);assert.equal(JSON.stringify(body),event.pull_request.body,'Canonical witness body, NO LF');
 const b=body.sourceQualificationBinding;assert(b&&typeof b==='object'&&!Array.isArray(b),'Reservation binding required');
 assert.equal(b.reservationReceiptSha256,'4b164a34459bdce86f754fee7affc7b69e3d32da7091cfc39a715d4229853feb');
 assert(typeof b.reservationReceiptBase64==='string'&&b.reservationReceiptBase64.length<=21848,'Bounded reservation witness');
 const reservation=Buffer.from(b.reservationReceiptBase64,'base64');assert(reservation.length>0&&reservation.length<=16384);assert.equal(reservation.toString('base64'),b.reservationReceiptBase64);assert.equal(hash(reservation),b.reservationReceiptSha256,'Exact historical witness, no mocked crypto/private literal');
 const nodePath=require('node:path'),root=nodePath.resolve(__dirname,'..');
 function source(relative,maximum){
  const file=nodePath.join(root,relative),st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.size<=maximum,'Finite selected control source');
  const f=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let bytes;
  try{assert.deepEqual(stamp(fs.fstatSync(f)),stamp(st));bytes=fs.readFileSync(f);assert.deepEqual(stamp(fs.fstatSync(f)),stamp(st));}finally{fs.closeSync(f);}
  assert.deepEqual(stamp(fs.lstatSync(file)),stamp(st));assert.equal(bytes.length,st.size);return bytes;
 }
 const qualifier=source('scripts/validate-sync608-reported-hold.js',1024*1024),fixture=source('scripts/fixtures/sync608-reported-hold-20261103.json',1024*1024),policy=source('config/deployment-manifest.json',16384);
 const qualifierText=qualifier.toString('utf8');assert(Buffer.from(qualifierText).equals(qualifier),'Selected qualifier UTF8');
 assert.equal(hash(qualifier),b.qualifierSha256,'Selected qualifier matches actual source body binding');assert.equal(hash(fixture),b.fixtureSha256,'Selected fixture matches actual source body binding');
 return {status:'PASS_ACTUAL_CONSUMER_ADMISSION_CONTROLS',...e610ConsumerAdmissionRegressions(qualifierText,fixture,policy,reservation),requiredSourceAdmissionGateClosed:false};
}


// Permanent isolated capture and same-candidate premerge13 contracts.
const permanentCaptureStart="      - name: Verify permanent baseline capture source controls\n";
const permanentCaptureEnd="      - name: Verify new-user journey source controls\n";
const permanentPremergeStart="      - name: Verify exact thirteen premerge affected gates\n";
const permanentPremergeEnd="  installed-upgrade:\n";
const permanentCaptureSha256="1f09e03b04dd2d57795b0ce595c37f0d92c4d859a218d0755be1869ec4275a17";
const permanentPremergeSha256="d3218a4f73e2cc9cb44e9e0ed43a9372c5dfa18fc7f4d2ee222687d024f695a7";
const permanentOriginalJob="    name: Fixture activation / remaining three checks\n    if: github.event.pull_request.draft == false\n";
const permanentNewJob="    name: Fixture activation / remaining three checks\n    if: github.event.pull_request.draft == false || (github.event.pull_request.draft == true && github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.event.pull_request.head.ref, 'codex/baseline-capture-'))\n";
const permanentNormalIf="        if: github.event.pull_request.draft == false\n";
const permanentNormalTitles=["Verify new-user journey source controls","Install existing locked dependencies","Verify signup/setup compatibility","Verify actual exported Feed activation","Verify subscription calendar activation","Verify guarded production workflow contract","Bind reviewed E610 source qualification receipt","Verify full SYNC source and generated qualification"];
const permanentOldDescription="Three existing source/mock activation checks, one bounded new-user journey unit and one bounded signup/setup compatibility check. Not production SQL, hosted wire or physical iPhone acceptance.";
const permanentNewDescription="Three existing source/mock activation checks, one bounded new-user journey unit and one bounded signup/setup compatibility check. Not production SQL, hosted wire or physical iPhone acceptance. Permanent dedicated DRAFT baseline capture runs only source/input checks and three primary bodies: ordinary application/full qualification/browser checks are skipped, never passed. Normal Ready retains full qualification, thirteen premerge affected gates and both installed-browser engines.";
const permanentFullGuardedGate="      - name: Verify full SYNC source and generated qualification\n        if: github.event.pull_request.draft == false\n        timeout-minutes: 3\n        env:\n          NS_SYNC_EXECUTION_RECEIPT: ${{ steps.e610_source_admission.outputs.executionReceiptPath }}\n          NS_SYNC_EXECUTION_RECEIPT_SHA256: ${{ steps.e610_source_admission.outputs.executionReceiptSha256 }}\n        run: timeout --signal=TERM --kill-after=5s 120s node scripts/validate-sync608-reported-hold.js --full --execution-receipt \"$NS_SYNC_EXECUTION_RECEIPT\" --execution-receipt-sha256 \"$NS_SYNC_EXECUTION_RECEIPT_SHA256\"\n";
const permanentProductionAnchor="          node scripts/validate-account-awareness.js\n";
const permanentProductionTwo="          timeout --signal=TERM --kill-after=5s 120s node scripts/lib/user-state-selection-generated-tests.cjs\n          timeout --signal=TERM --kill-after=5s 120s node scripts/lib/user-state-selection-sdk-tests.cjs\n";
const permanentProductionBeforeSha256="dfe4e4288fab61b78b2c1b66da7432baf4727a6d54f2a93938ff662d58352730";
const permanentInstalledBeforeSha256="5738a90900e31556f8d193016b3fbec855d08bd1c2a3f44c9c838705652a1d72";

function permanentOnce(text,before,after,label){assert.equal(text.split(before).length-1,1,'Exactly one '+label);return text.replace(before,()=>after);}
function normalisePermanentCaptureWorkflow(text){
 assert.equal(typeof text,'string');assert.equal(text.split(permanentCaptureStart).length-1,1);assert.equal(text.split(permanentPremergeStart).length-1,1);
 const start=text.indexOf(permanentCaptureStart),end=text.indexOf(permanentCaptureEnd,start);assert(end>start);
 const capture=text.slice(start,end);assert.equal(hash(capture),permanentCaptureSha256,'Exact capture guard/input/CLI/caps/evidence');
 assert(text.includes('          JS\n'+capture+permanentCaptureEnd+permanentNormalIf),'Capture immediately after source context');
 const preStart=text.indexOf(permanentPremergeStart),preEnd=text.indexOf(permanentPremergeEnd,preStart);assert(preEnd>preStart);
 const premerge=text.slice(preStart,preEnd);assert.equal(hash(premerge),permanentPremergeSha256,'All13 exact ordered bounded premerge gates');
 assert(text.includes(permanentFullGuardedGate+premerge+permanentPremergeEnd),'13 follow full51 on same nonproduction candidate');
 let restored=permanentOnce(text,capture,'','capture block');restored=permanentOnce(restored,premerge,'','premerge block');
 for(const name of permanentNormalTitles){const title='      - name: '+name+'\n';restored=permanentOnce(restored,title+permanentNormalIf,title,'normal Ready guard '+name);}
 restored=permanentOnce(restored,permanentNewJob,permanentOriginalJob,'job route guard');restored=permanentOnce(restored,permanentNewDescription,permanentOldDescription,'route description');
 assert.equal(hash(restored),permanentInstalledBeforeSha256,'Whole original E610 normal workflow/browser/security restored');
 return {restored,capture,premerge};
}
function normalisePermanentProductionSelection(text){
 assert.equal(typeof text,'string');assert.equal(text.split(permanentProductionTwo).length-1,1,'Exactly two bounded selection calls');
 assert(text.includes(permanentProductionAnchor+permanentProductionTwo),'Selection suites after account-awareness predeploy');
 const restored=text.replace(permanentProductionTwo,()=>'');assert.equal(hash(restored),permanentProductionBeforeSha256,'Whole prior production source restored');return {restored};
}
function permanentProductionSelectionRegressions(text){
 normalisePermanentProductionSelection(text);
 const controls=[
  ['missing suites',v=>v.replace(permanentProductionTwo,'')],
  ['duplicate suites',v=>v.replace(permanentProductionTwo,()=>permanentProductionTwo+permanentProductionTwo)],
  ['reordered suites',v=>v.replace(permanentProductionTwo,()=>permanentProductionTwo.trimEnd().split('\n').reverse().join('\n')+'\n')],
  ['altered SDK argv',v=>v.replace('120s node scripts/lib/user-state-selection-sdk-tests.cjs','120s node scripts/lib/user-state-selection-sdk-tests.cjs --skip')],
  ['missing generated entry',v=>v.replace(permanentProductionTwo,()=>permanentProductionTwo.split('\n').filter(x=>!x.includes('selection-generated-tests.cjs')).join('\n'))],
  ['moved past release prepare',v=>v.replace(permanentProductionTwo,'').replace('      - name: Bind project and preserve current production\n',()=>permanentProductionTwo+'      - name: Bind project and preserve current production\n')],
  ['main guard relaxed',v=>v.replace('test "$RELEASE_SHA" = "$(git rev-parse origin/main)"','true')],
  ['SDK failure ignored',v=>v.replace('120s node scripts/lib/user-state-selection-sdk-tests.cjs\n','120s node scripts/lib/user-state-selection-sdk-tests.cjs || true\n')]
 ];
 for(const[name,mutate]of controls){const broken=mutate(text);assert.notEqual(broken,text,name);assert.throws(()=>normalisePermanentProductionSelection(broken),undefined,name);}
 return {groups:controls.length,names:controls.map(([name])=>name),addedRequiredUnits:2,originalContractUnchanged:true,releaseAcceptance:false};
}
function permanentCaptureRegressions(text){
 const {restored,capture,premerge}=normalisePermanentCaptureWorkflow(text);
 const controls=[
  ['missing capture',v=>v.replace(capture,'')],['duplicate capture',v=>v.replace(capture,()=>capture+capture)],
  ['moved capture',v=>v.replace(capture,'').replace('      - name: Verify signup/setup compatibility\n',()=>capture+'      - name: Verify signup/setup compatibility\n')],
  ['wrong capture flag',v=>v.replace('--capture-installed-primary-baseline >','--other >')],
  ['default verifier forbidden',v=>v.replace(' --capture-installed-primary-baseline >',' >')],
  ['capture deadline widened',v=>v.replace('65s node scripts/verify-production-release.js','90s node scripts/verify-production-release.js')],
  ['input deadline widened',v=>v.replace("30s node <<'NS_PRIMARY_CAPTURE_INPUT'","60s node <<'NS_PRIMARY_CAPTURE_INPUT'")],
  ['capture guard broadened',v=>v.replace(permanentNewJob,'    name: Fixture activation / remaining three checks\n    if: true\n')],
  ['Ready admission guard lost',v=>v.replace('      - name: Bind reviewed E610 source qualification receipt\n'+permanentNormalIf,'      - name: Bind reviewed E610 source qualification receipt\n')],
  ['Ready full51 guard lost',v=>v.replace('      - name: Verify full SYNC source and generated qualification\n'+permanentNormalIf,'      - name: Verify full SYNC source and generated qualification\n')],
  ['body evaluated',v=>v.replace('body=JSON.parse(text)','body=eval(text)')],
  ['rerun admitted',v=>v.replace("assert.equal(env.GITHUB_RUN_ATTEMPT,'1','No capture rerun');",'')],
  ['source check omitted',v=>v.replace('const rows=sourceInventory(entries);','')],
  ['collector changed',v=>v.replace('6123d29c05e0c34d74bedac7a1e6af7d9b44c7708d779f7ae16107b85cf95fc3','0'.repeat(64))],
  ["oversized raw report uploaded",v=>v.replace("            ${{ runner.temp }}/ns-primary-baseline-capture/capture-report.json\n",()=>"            ${{ runner.temp }}/ns-primary-baseline-capture/capture-report.raw.json\n")],
  ["capture raw output published before bound",v=>v.replace("--capture-installed-primary-baseline > \"$NS_PRIMARY_CAPTURE_WORK/capture-report.raw.json\"",()=>"--capture-installed-primary-baseline > \"$NS_PRIMARY_CAPTURE_WORK/capture-report.json\"")],
  ["oversized report limit widened",v=>v.replace("if test \"$(wc -c < \"$NS_PRIMARY_CAPTURE_WORK/capture-report.raw.json\")\" -gt 16384; then",()=>"if test \"$(wc -c < \"$NS_PRIMARY_CAPTURE_WORK/capture-report.raw.json\")\" -gt 32768; then")],
  ["failure prefix widened",v=>v.replace("head -c 16384 \"$NS_PRIMARY_CAPTURE_WORK/capture-report.raw.json\"",()=>"head -c 32768 \"$NS_PRIMARY_CAPTURE_WORK/capture-report.raw.json\"")],
  ["failure prefix mislabeled as capture proof",v=>v.replace("> \"$NS_PRIMARY_CAPTURE_WORK/capture-report.failed.prefix.txt\"",()=>"> \"$NS_PRIMARY_CAPTURE_WORK/capture-report.json\"")],
  ["failure evidence excluded",v=>v.replace("            ${{ runner.temp }}/ns-primary-baseline-capture/capture-failure.json\n            ${{ runner.temp }}/ns-primary-baseline-capture/capture-report.failed.prefix.txt\n",()=>"")],
  ["oversize silently accepted",v=>v.replace("retained prefix is failure-only diagnostic, not capture proof.' >&2\n            exit 1",()=>"retained prefix is failure-only diagnostic, not capture proof.' >&2\n            exit 0")],
  ['private binding uploaded',v=>v.replace('            '+'$'+'{{ runner.temp }}/ns-primary-baseline-capture/capture-report.json','            '+'$'+'{{ runner.temp }}/ns-primary-baseline-capture/binding.json')],
  ['browser guard relaxed',v=>v.replace('    needs: fixture-activation\n    if: github.event.pull_request.draft == false\n','    needs: fixture-activation\n    if: true\n')],
  ['premerge13 missing',v=>v.replace(premerge,'')],
  ['Ready13 skipped',v=>v.replace(premerge,()=>premerge.replace('draft == false','draft == true'))],
  ['whole13 cap widened',v=>v.replace('300s bash','600s bash')],
  ['premerge errors ignored',v=>v.replace('45s node scripts/validate-preference-bookkeeping.js\n','45s node scripts/validate-preference-bookkeeping.js || true\n')],
  ['premerge SDK omitted',v=>v.replace('120s node scripts/lib/user-state-selection-sdk-tests.cjs\n','true\n')],
  ...permanentNormalTitles.map(name=>['Ready guard altered: '+name,v=>v.replace('      - name: '+name+'\n'+permanentNormalIf,'      - name: '+name+'\n        if: false\n')])
 ];
 for(const[name,mutate]of controls){const broken=mutate(text);assert.notEqual(broken,text,name);assert.throws(()=>normalisePermanentCaptureWorkflow(broken),undefined,name);}
 const begin='// NS_PRIMARY_CAPTURE_PURE_BEGIN',finish='// NS_PRIMARY_CAPTURE_PURE_END';assert.equal(capture.split(begin).length-1,1);assert.equal(capture.split(finish).length-1,1);
 const pure=capture.slice(capture.indexOf(begin),capture.indexOf(finish)).split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
 const collectorFile=require('node:path').join(__dirname,'verify-production-release.js'),before=fs.lstatSync(collectorFile);
 assert(before.isFile()&&!before.isSymbolicLink()&&before.size===17499,'Exact reviewed collector source');
 const stamp=s=>[s.dev,s.ino,s.size,s.mode,s.mtimeMs,s.ctimeMs],fd=fs.openSync(collectorFile,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let source;
 try{assert.deepEqual(stamp(fs.fstatSync(fd)),stamp(before));source=fs.readFileSync(fd);assert.deepEqual(stamp(fs.fstatSync(fd)),stamp(before));}finally{fs.closeSync(fd);}
 assert.deepEqual(stamp(fs.lstatSync(collectorFile)),stamp(before));assert.equal(source.length,17499);
 assert.equal(hash(source),'6123d29c05e0c34d74bedac7a1e6af7d9b44c7708d779f7ae16107b85cf95fc3');
 const collector=require(collectorFile),validateBinding=(binding,wall)=>collector.validateCaptureBinding(JSON.parse(JSON.stringify(binding)),wall);
 const harness="\nconst cases=[];function pass(name,run){run();cases.push(name);}function fail(name,run){assert.throws(run,undefined,name);cases.push(name);}\nconst H='1'.repeat(40),B='2'.repeat(40),T='3'.repeat(40),TREE='4'.repeat(40),NOW=Date.parse('2026-11-06T00:00:00.000Z');\nfunction fixture(){const facts={baselineSha:baseline,baselineVersion:'609',deployment:{id:deployment,state:'READY',releaseGitSha:baseline,origin:'https://nothingsport.app',checkedAt:new Date(NOW).toISOString()},alias:{domain:'nothingsport.app',deploymentId:deployment,projectId:project,teamId:team,redirect:null,checkedAt:new Date(NOW).toISOString()},publisherWindow:{owner:'nsPUBLISH',held:true}};return {body:{schemaVersion:'primary-baseline-capture-request.v1',publisherHeadSha:H,publisherTreeSha:TREE,preparedForBaseSha:B,namedAllocationId:'synthetic-source-control-only',publisherBindingRecordSha256:'a'.repeat(64),captureFacts:facts},event:{action:'opened',number:1,repository:{full_name:'hartican/sportscal'},pull_request:{number:1,draft:true,head:{sha:H,ref:'codex/baseline-capture-owned-control',repo:{full_name:'hartican/sportscal'}},base:{sha:B}}},env:{GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_JOB:'fixture-activation',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'1',GITHUB_REF:'refs/pull/1/merge',GITHUB_SHA:T},observed:{checkoutSha:T,parents:[B,H],headTree:TREE,testedTree:TREE}};}\nfunction run(x,raw){return primaryCaptureRequest(raw||Buffer.from(JSON.stringify(x.body)),x.event,x.env,x.observed,NOW,validateBinding);}\npass('exact capture binding uses actual T not H',()=>{const x=fixture(),r=run(x);assert.equal(r.binding.collectorSha,T);assert.equal(r.H,H);assert.equal(r.binding.preparedForBaseSha,B);});\npass('Ready never captures and keeps normal/browser',()=>{const x=fixture();x.event.pull_request.draft=false;const r=captureRouteDecision(x.event.pull_request,'hartican/sportscal');assert.equal(r.runNormal,true);assert.equal(r.runInstalledBrowser,true);assert.equal(r.runCapture,false);});\npass('case-insensitive branch/repository model',()=>{const x=fixture();x.event.pull_request.head.ref=x.event.pull_request.head.ref.toUpperCase();x.event.pull_request.head.repo.full_name='HARTICAN/SPORTSCAL';assert.equal(captureRouteDecision(x.event.pull_request,'hartican/sportscal').runCapture,true);});\nfor(const[name,change]of[\n ['missing request field',x=>delete x.body.publisherTreeSha],['extra request field',x=>x.body.extra=true],['unknown mode',x=>x.body.schemaVersion='other'],['combined scope',x=>x.body.sourceQualificationBinding={}],['coerced head',x=>x.body.publisherHeadSha=42],['blank allocation',x=>x.body.namedAllocationId=' '],['template allocation',x=>x.body.namedAllocationId='SOURCE_TEMPLATE'],['wrong head',x=>x.body.publisherHeadSha=B],['wrong base',x=>x.body.preparedForBaseSha=H],['wrong tree',x=>x.body.publisherTreeSha=H],['fork',x=>x.event.pull_request.head.repo.full_name='fork/repo'],['wrong branch',x=>x.event.pull_request.head.ref='codex/unrelated'],['ordinary draft',x=>x.event.pull_request.head.ref='main'],['Ready cannot capture',x=>x.event.pull_request.draft=false],['unknown event',x=>x.event.action='edited'],['attempt2',x=>x.env.GITHUB_RUN_ATTEMPT='2'],['bad run',x=>x.env.GITHUB_RUN_ID='01'],['event base mismatch',x=>x.event.pull_request.base.sha=H],['checkout mismatch',x=>x.observed.checkoutSha=H],['parent order',x=>x.observed.parents=[H,B]],['unequal trees',x=>x.observed.testedTree=H],['wrong baseline',x=>x.body.captureFacts.baselineVersion='608'],['extra facts',x=>x.body.captureFacts.extra=true],['legacy alias',x=>x.body.captureFacts.alias.domain='legacy.vercel.app'],['not READY',x=>x.body.captureFacts.deployment.state='ERROR'],['unheld window',x=>x.body.captureFacts.publisherWindow.held=false],['future alias',x=>x.body.captureFacts.alias.checkedAt=new Date(NOW+1).toISOString()],['stale deployment',x=>x.body.captureFacts.deployment.checkedAt=new Date(NOW-86400001).toISOString()],['unpaired Unicode',x=>x.body.namedAllocationId='\\ud800']\n])fail(name,()=>{const x=fixture();change(x);run(x);});\nfail('trailingLF',()=>{const x=fixture();run(x,Buffer.from(JSON.stringify(x.body)+'\\n'));});\nfail('duplicate request keys',()=>{const x=fixture();run(x,Buffer.from(JSON.stringify(x.body).replace('\"schemaVersion\":\"primary-baseline-capture-request.v1\"','\"schemaVersion\":\"other\",\"schemaVersion\":\"primary-baseline-capture-request.v1\"')));});\nfail('invalidUTF8',()=>run(fixture(),Buffer.from([255])));\nfail('body limit',()=>run(fixture(),Buffer.alloc(65537)));\n({groups:cases.length,names:cases,typedPrModelNotActionsInterpreter:true,networkRequests:0,releaseAcceptance:false});\n";
 const requestControls=require('node:vm').runInNewContext(pure+'\n'+harness,{assert,Buffer,TextDecoder:require('node:util').TextDecoder,path:require('node:path'),crypto,hash,validateBinding,baseline:collector.BASELINE,deployment:collector.DEPLOYMENT,project:collector.PROJECT,team:collector.TEAM},{timeout:5000});
 return {restored,report:{workflowNegativeGroups:controls.length,workflowNames:controls.map(([name])=>name),requestControls,captureOriginGetsExecuted:0,realTransportOrFilesystemProof:false,normalReadyGuardRestored:true,premergeGateCount:13,wholePremergeSeconds:300,releaseAcceptance:false}};
}

if(require.main===module){
 const augmentedProduction=fs.readFileSync('.github/workflows/sportscal-production.yml','utf8');
 const text=normalisePermanentProductionSelection(augmentedProduction).restored,report=validate(text);
 const augmentedInstalled=fs.readFileSync('.github/workflows/installed-upgrade-tests.yml','utf8');
 const existingInstalled=normalisePermanentCaptureWorkflow(augmentedInstalled).restored;
 const installed=normaliseE610AdmissionWorkflow(existingInstalled).restored;
 const lockedTerserPackageControls=lockedTerserPackageRegressions();
 const signupCompatibilityNegativeControls=signupCompatibilityRegressions(installed);
 const originalNegativeControls=regressions(text);
 const admission=e610AdmissionRegressions(existingInstalled);
 const permanentCaptureControls=permanentCaptureRegressions(augmentedInstalled);
 const permanentProductionSelectionControls=permanentProductionSelectionRegressions(augmentedProduction);
 let e610ActualConsumerAdmissionControls,consumerControlFailure=null;
 try{e610ActualConsumerAdmissionControls=e610ConsumerControlsForContext();}
 catch(error){consumerControlFailure=error;e610ActualConsumerAdmissionControls={status:'FAIL_ACTUAL_CONSUMER_ADMISSION_CONTROLS',message:error.message,report:error.e610Report||null,groups:error.e610Report?.groups??null,requiredSourceAdmissionGateClosed:false,releaseAcceptance:false};}
 console.log(JSON.stringify({schemaVersion:'production-sql-batches.v1',...report,negativeControls:originalNegativeControls,signupCompatibilityNegativeControls,lockedTerserPackageControls,e610AdmissionControls:admission.report,e610ActualConsumerAdmissionControls,permanentCaptureControls:permanentCaptureControls.report,permanentProductionSelectionControls,engineRuns:0,serviceRequests:0,releaseAcceptance:false}));
 if(consumerControlFailure)throw consumerControlFailure;
}
module.exports={normalisePermanentCaptureWorkflow,normalisePermanentProductionSelection,permanentCaptureRegressions,permanentProductionSelectionRegressions,e610ConsumerAdmissionRegressions,e610ConsumerControlsForContext,normaliseE610AdmissionWorkflow,e610AdmissionRegressions,resolveLockedTerserPackage,lockedTerserPackageRegressions,validate,regressions,validateSignupCompatibilityWorkflow,signupCompatibilityRegressions};
