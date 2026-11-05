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
// Temporary canonical producer and deliberately opted-in draft source phase.
// Removing only these reviewed additions must recover the entire frozen B2 workflow.
const canonicalProducerStart="      # Temporary packaging overlay: source qualification and artifacts are not release acceptance.\n";
const canonicalProducerEnd="  installed-upgrade:\n";
const canonicalProducerSha256='abc88e3fec5c0952ad2127418b4ea1da6a76668fc7b4299f2f31317ad6d04866';
const canonicalB2WorkflowSha256='1f9e4e220bb6b15834797fed54be53d0b51ef4aa51deb3710d52238f1ce96089';
const sourcePhaseGuard="    if: github.event.pull_request.draft == false || (github.event.pull_request.draft == true && github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.event.pull_request.head.ref, 'codex/source-qualification-') && (github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=source-qualification-v1' || github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=canonical-producer-v1'))\n";
const ordinaryDraftGuard="    if: github.event.pull_request.draft == false\n";
const canonicalOldDescription="Three existing source/mock activation checks, one bounded new-user journey unit and one bounded signup/setup compatibility check.";
const canonicalDescription="Three existing source/mock activation checks, one bounded new-user journey unit and one bounded signup/setup compatibility check. Temporary bounded canonical artifact production requires a separate explicit same-repository draft producer phase after those checks; source-only and ready-for-review paths do not build.";
const sourcePhaseBody='NS_CI_SOURCE_PHASE=source-qualification-v1';
const producerPhaseBody='NS_CI_SOURCE_PHASE=canonical-producer-v1';
const producerStepGuard="        if: github.event.pull_request.draft == true && github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.event.pull_request.head.ref, 'codex/source-qualification-') && github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=canonical-producer-v1'\n";
const sourcePhaseBranchPrefix='codex/source-qualification-';
// Model only typed GitHub PR payload fields; not an implementation of Actions coercion.
const sourcePhaseStringKey=value=>typeof value==='string'?value.toLowerCase():null;
function sourceQualificationDecision(pr,repository){
 const ready=pr?.draft===false,repositoryKey=sourcePhaseStringKey(repository),refKey=sourcePhaseStringKey(pr?.head?.ref),bodyKey=sourcePhaseStringKey(pr?.body);
 const eligibleDraft=pr?.draft===true&&repositoryKey!==null&&repositoryKey.length>0&&sourcePhaseStringKey(pr?.head?.repo?.full_name)===repositoryKey&&refKey!==null&&refKey.startsWith(sourcePhaseBranchPrefix);
 const sourceOnly=eligibleDraft&&bodyKey===sourcePhaseStringKey(sourcePhaseBody),producer=eligibleDraft&&bodyKey===sourcePhaseStringKey(producerPhaseBody);
 return {runSource:ready||sourceOnly||producer,runProducer:producer,runFullInstalledPath:ready,sourcePhaseOnly:sourceOnly,releaseAcceptance:false};
}
function normaliseSourcePhaseWorkflow(text){
 assert.equal(text.split(sourcePhaseGuard).length-1,1,'Exactly one explicit same-repository draft source opt-in');
 assert(text.includes('    needs: fixture-activation\n'+ordinaryDraftGuard),'Ready-for-review always restores both original engines; source-only cannot override their draft guard');
 assert.equal(text.split(ordinaryDraftGuard).length-1,1,'No additional ordinary guard replacement');
 return text.replace(sourcePhaseGuard,ordinaryDraftGuard);
}
function validateCanonicalProducerWorkflow(text){
 assert.equal(typeof text,'string','Installed workflow source required');
 assert.equal(text.split(canonicalProducerStart).length-1,1,'Exactly one temporary canonical producer block');
 const start=text.indexOf(canonicalProducerStart),end=text.indexOf(canonicalProducerEnd,start);assert(end>start,'Producer must precede the existing installed-upgrade job');
 assert.equal(text.split(producerStepGuard).length-1,1,'Exactly one separate explicit same-repository DRAFT producer guard');
 assert(text.includes('        id: canonical_producer\n'+producerStepGuard+'        timeout-minutes: 6\n'),'Producer guard must bind only the producer step');
 const block=text.slice(start,end);assert.equal(hash(block),canonicalProducerSha256,'Exact reviewed producer commands, bounds, nine outputs, immutable upload and restoration proof required');
 const anchor="      - name: Verify guarded production workflow contract\n        timeout-minutes: 2\n        run: node scripts/validate-production-sql-batches.js\n";
 assert(text.includes(anchor+block+canonicalProducerEnd),'Producer follows all unchanged early unit, locked install, signup and original three checks');
 assert.equal(text.split(canonicalDescription).length-1,1,'Source log must distinguish artifact preparation from release acceptance');
 const original=normaliseSourcePhaseWorkflow(text.slice(0,start)+text.slice(end)).replace(canonicalDescription,canonicalOldDescription);
 assert.equal(hash(original),canonicalB2WorkflowSha256,'Whole frozen B2 workflow, jobs, events, permissions, old checks, guards, baseline, security and both engines remain unchanged except declared additions');
 validateSignupCompatibilityWorkflow(original);
 return original;
}
function canonicalProducerRegressions(text){
 validateCanonicalProducerWorkflow(text);
 const start=text.indexOf(canonicalProducerStart),end=text.indexOf(canonicalProducerEnd,start),block=text.slice(start,end);
 const controls=[
  ['missing canonical producer',value=>value.replace(block,'')],
  ['duplicate canonical producer',value=>value.replace(block,block+block)],
  ['altered canonical producer command',value=>value.replace('45s node scripts/build-app-shell-runtime.js --check','45s node scripts/build-app-shell-runtime.js --check --skip')],
  ['moved canonical producer before original source checks',value=>value.replace(block,'').replace('      - name: Verify actual exported Feed activation\n',block+'      - name: Verify actual exported Feed activation\n')],
  ['missing producer phase guard',value=>value.replace(producerStepGuard,'')],
  ['duplicate producer phase guard',value=>value.replace(producerStepGuard,producerStepGuard+producerStepGuard)],
  ['ready PR cannot allocate producer',value=>value.replace(producerStepGuard,producerStepGuard.replace('draft == true','draft == false'))],
  ['source-only marker cannot allocate producer',value=>value.replace(producerStepGuard,producerStepGuard.replace(producerPhaseBody,sourcePhaseBody))],
  ['fork cannot allocate producer',value=>value.replace(producerStepGuard,producerStepGuard.replace(' && github.event.pull_request.head.repo.full_name == github.repository',''))],
  ['unknown producer mode',value=>value.replace(producerStepGuard,producerStepGuard.replace('canonical-producer-v1','canonical-producer-v2'))],
  ['producer preflight escapes YAML run block',value=>value.replace("          assert.equal(process.version,'v24.21.0'","assert.equal(process.version,'v24.21.0'")],
  ['producer preflight diverges from case-insensitive phase guard',value=>value.replace('phaseStringKey(process.env.PR_PHASE_BODY)','process.env.PR_PHASE_BODY')]
 ];
 for(const[name,mutate]of controls){const broken=mutate(text);assert.notEqual(broken,text,name+' mutation must apply');assert.throws(()=>validateCanonicalProducerWorkflow(broken),undefined,name+' must refuse');}
 return controls.length;
}
function sourceQualificationRegressions(text){
 validateCanonicalProducerWorkflow(text);
 const controls=[
  ['draft mode removed',value=>value.replace(sourcePhaseGuard,ordinaryDraftGuard)],
  ['draft same-repository condition removed',value=>value.replace(" && github.event.pull_request.head.repo.full_name == github.repository",'')],
  ['unknown draft mode',value=>value.replace('NS_CI_SOURCE_PHASE=source-qualification-v1','NS_CI_SOURCE_PHASE=source-qualification-v2')],
  ['ready engine guard bypassed by marker',value=>value.replace('    needs: fixture-activation\n'+ordinaryDraftGuard,'    needs: fixture-activation\n'+sourcePhaseGuard)]
 ];
 for(const[name,mutate]of controls){const broken=mutate(text);assert.notEqual(broken,text,name+' mutation must apply');assert.throws(()=>validateCanonicalProducerWorkflow(broken),undefined,name+' must refuse');}
 const repository='example/sportscal',optedIn={draft:true,body:sourcePhaseBody,head:{ref:sourcePhaseBranchPrefix+'bounded-candidate',repo:{full_name:repository}}},producer={...optedIn,body:producerPhaseBody};
 const cases=[
  ['ordinary draft',{...optedIn,body:''},false,false,false,false],
  ['explicit same-repository source draft',optedIn,true,false,true,false],
  ['ready transition cannot retain source-only mode',{...optedIn,draft:false},true,true,false,false],
  ['ready ignores arbitrary branch/body',{...optedIn,draft:false,body:'unknown',head:{ref:'unrelated',repo:{full_name:'fork/repo'}}},true,true,false,false],
  ['fork cannot opt into draft source phase',{...optedIn,head:{...optedIn.head,repo:{full_name:'fork/repo'}}},false,false,false,false],
  ['unknown mode cannot opt in',{...optedIn,body:'NS_CI_SOURCE_PHASE=source-qualification-v2'},false,false,false,false],
  ['unrelated branch cannot opt in',{...optedIn,head:{...optedIn.head,ref:'codex/unrelated'}},false,false,false,false],
  ['string draft flag cannot grant authority',{...optedIn,draft:'false'},false,false,false,false],
  ['appended body cannot smuggle another mode',{...optedIn,body:sourcePhaseBody+'\nNS_CI_SOURCE_PHASE=release'},false,false,false,false],
  ['missing draft flag cannot grant authority',{...optedIn,draft:null},false,false,false,false],
  ['separate exact draft producer phase',producer,true,false,false,true],
  ['ready with leftover producer marker runs full path without builds',{...producer,draft:false},true,true,false,false],
  ['fork producer marker cannot allocate builds',{...producer,head:{...producer.head,repo:{full_name:'fork/repo'}}},false,false,false,false],
  ['unknown producer marker cannot allocate builds',{...producer,body:'NS_CI_SOURCE_PHASE=canonical-producer-v2'},false,false,false,false],
  ['producer on unrelated branch cannot allocate builds',{...producer,head:{...producer.head,ref:'codex/unrelated'}},false,false,false,false],
  ['two markers cannot smuggle producer scope',{...producer,body:sourcePhaseBody+'\n'+producerPhaseBody},false,false,false,false],
  ['string draft flag cannot allocate producer',{...producer,draft:'true'},false,false,false,false],
  ['missing repository cannot allocate producer',{...producer,head:{...producer.head,repo:null}},false,false,false,false],
  ['ordinary ready PR requires full path without producer',{...optedIn,draft:false,body:''},true,true,false,false],
  ['source repository case variant',{...optedIn,head:{...optedIn.head,repo:{full_name:repository.toUpperCase()}}},true,false,true,false],
  ['source branch case variant',{...optedIn,head:{...optedIn.head,ref:optedIn.head.ref.toUpperCase()}},true,false,true,false],
  ['source body case variant',{...optedIn,body:sourcePhaseBody.toLowerCase()},true,false,true,false],
  ['producer repository case variant',{...producer,head:{...producer.head,repo:{full_name:repository.toUpperCase()}}},true,false,false,true],
  ['producer branch case variant',{...producer,head:{...producer.head,ref:producer.head.ref.toUpperCase()}},true,false,false,true],
  ['producer body case variant',{...producer,body:producerPhaseBody.toLowerCase()},true,false,false,true],
  ['combined producer case variants',{...producer,body:producerPhaseBody.toUpperCase(),head:{ref:producer.head.ref.toUpperCase(),repo:{full_name:repository.toUpperCase()}}},true,false,false,true],
  ['uppercase unknown producer mode stays excluded',{...producer,body:'NS_CI_SOURCE_PHASE=CANONICAL-PRODUCER-V2'},false,false,false,false],
  ['ready case-variant producer marker cannot allocate builds',{...producer,draft:false,body:producerPhaseBody.toUpperCase()},true,true,false,false]
 ];
 for(const[name,pr,source,full,sourceOnly,build]of cases)assert.deepEqual(sourceQualificationDecision(pr,repository),{runSource:source,runProducer:build,runFullInstalledPath:full,sourcePhaseOnly:sourceOnly,releaseAcceptance:false},name);
 return {negativeControls:controls.length,decisionCases:cases.length,comparisonModel:'typed PR string fields, case-insensitive; not an Actions expression interpreter',platformExecutionProved:false};
}
// C12 setup correction: identify the exact locked owner, never the nearest nested manifest.
// This same pure resolver is exercised below and used by the existing producer preflight.
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

// Temporary primary-collector draft overlay; no CLI flag, live capture or release authority.
const primaryCollectorBody="NS_CI_SOURCE_PHASE=primary-collector-pure-v1";
const primaryCollectorOldJobGuard="    if: github.event.pull_request.draft == false || (github.event.pull_request.draft == true && github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.event.pull_request.head.ref, 'codex/source-qualification-') && (github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=source-qualification-v1' || github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=canonical-producer-v1'))\n";
const primaryCollectorJobGuard="    if: github.event.pull_request.draft == false || (github.event.pull_request.draft == true && github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.event.pull_request.head.ref, 'codex/source-qualification-') && (github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=source-qualification-v1' || github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=canonical-producer-v1' || github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=primary-collector-pure-v1'))\n";
const primaryCollectorStepGuard="        if: github.event.pull_request.draft == true && github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.event.pull_request.head.ref, 'codex/source-qualification-') && github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=primary-collector-pure-v1'\n";
const primaryCollectorNormalGuard="        if: github.event.pull_request.draft == false || github.event.pull_request.body != 'NS_CI_SOURCE_PHASE=primary-collector-pure-v1'\n";
const primaryCollectorNormalSteps=["Verify new-user journey source controls","Install existing locked dependencies","Verify signup/setup compatibility","Verify actual exported Feed activation","Verify subscription calendar activation","Verify guarded production workflow contract"];
const primaryCollectorTriggerBefore="      - scripts/validate-installed-production-baseline.js\n";
const primaryCollectorTriggerAfter="      - scripts/validate-installed-production-baseline.js\n      - scripts/verify-production-release.js\n";
const primaryCollectorRegistryStep="      - name: Verify pure collector workflow isolation\n        if: github.event.pull_request.draft == true && github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.event.pull_request.head.ref, 'codex/source-qualification-') && github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=primary-collector-pure-v1'\n        timeout-minutes: 2\n        run: node scripts/validate-production-sql-batches.js\n";
const primaryCollectorCommandStep="      - name: Verify pure primary collector controls\n        if: github.event.pull_request.draft == true && github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.event.pull_request.head.ref, 'codex/source-qualification-') && github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=primary-collector-pure-v1'\n        timeout-minutes: 3\n        run: timeout --signal=TERM --kill-after=5s 120s node scripts/validate-installed-production-baseline.js\n";
const primaryCollectorSteps="      - name: Verify pure collector workflow isolation\n        if: github.event.pull_request.draft == true && github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.event.pull_request.head.ref, 'codex/source-qualification-') && github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=primary-collector-pure-v1'\n        timeout-minutes: 2\n        run: node scripts/validate-production-sql-batches.js\n      - name: Verify pure primary collector controls\n        if: github.event.pull_request.draft == true && github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.event.pull_request.head.ref, 'codex/source-qualification-') && github.event.pull_request.body == 'NS_CI_SOURCE_PHASE=primary-collector-pure-v1'\n        timeout-minutes: 3\n        run: timeout --signal=TERM --kill-after=5s 120s node scripts/validate-installed-production-baseline.js\n";
const primaryCollectorOldDescription="source-only and ready-for-review paths do not build.";
const primaryCollectorDescription="source-only and ready-for-review paths do not build. Separate explicit same-repository draft primary-collector-pure mode runs only the strict registry and bounded pure collector controls, without locked install, source units, producer, upload or browsers.";
const primaryCollectorC13WorkflowSha256='bce3642be85371e69342ea10f4462c8a7057f38ca72185e265a7810b4ccb8af2';
function primaryCollectorReplaceOnce(text,before,after,label){
 assert.equal(text.split(before).length-1,1,'Exactly one '+label);
 return text.replace(before,after);
}
function normalisePrimaryCollectorWorkflow(text){
 assert.equal(typeof text,'string','Installed workflow source required');
 const first='      - name: '+primaryCollectorNormalSteps[0]+'\n';
 assert(text.includes('          JS\n'+primaryCollectorSteps+first),'Pure registry and collector must immediately follow context and precede old source units');
 let restored=primaryCollectorReplaceOnce(text,primaryCollectorSteps,'','ordered pure registry/collector block');
 restored=primaryCollectorReplaceOnce(restored,primaryCollectorTriggerAfter,primaryCollectorTriggerBefore,'narrow verifier trigger beside validator');
 restored=primaryCollectorReplaceOnce(restored,primaryCollectorJobGuard,primaryCollectorOldJobGuard,'whole same-repository DRAFT selector');
 restored=primaryCollectorReplaceOnce(restored,primaryCollectorDescription,primaryCollectorOldDescription,'pure scope description');
 for(const name of primaryCollectorNormalSteps){
  const title='      - name: '+name+'\n';
  restored=primaryCollectorReplaceOnce(restored,title+primaryCollectorNormalGuard,title,'READY-safe pure-only skip for '+name);
 }
 assert.equal(hash(restored),primaryCollectorC13WorkflowSha256,'Whole C13 workflow must remain byte-identical after removing only declared pure additions');
 return restored;
}
function primaryCollectorDecision(pr,repository){
 const original=sourceQualificationDecision(pr,repository),repo=sourcePhaseStringKey(repository),ref=sourcePhaseStringKey(pr?.head?.ref);
 const pure=pr?.draft===true&&repo!==null&&repo.length>0&&sourcePhaseStringKey(pr?.head?.repo?.full_name)===repo&&ref!==null&&ref.startsWith(sourcePhaseBranchPrefix)&&sourcePhaseStringKey(pr?.body)===sourcePhaseStringKey(primaryCollectorBody);
 return {runJob:original.runSource||pure,runExistingSourceSteps:original.runSource,runProducer:original.runProducer,runPureRegistry:pure,runPureCollector:pure,runFullInstalledPath:original.runFullInstalledPath,releaseAcceptance:false};
}
function primaryCollectorRegressions(text){
 normalisePrimaryCollectorWorkflow(text);
 const first='      - name: '+primaryCollectorNormalSteps[0]+'\n';
 const controls=[
  ['missing pure command',value=>value.replace(primaryCollectorCommandStep,'')],
  ['duplicate pure command',value=>value.replace(primaryCollectorCommandStep,primaryCollectorCommandStep+primaryCollectorCommandStep)],
  ['altered pure command or added CLI flag',value=>value.replace('120s node scripts/validate-installed-production-baseline.js\n','120s node scripts/validate-installed-production-baseline.js --capture-installed-primary-baseline\n')],
  ['moved pure command',value=>value.replace(primaryCollectorCommandStep,'').replace(first,first+primaryCollectorCommandStep)],
  ['missing strict registry',value=>value.replace(primaryCollectorRegistryStep,'')],
  ['duplicate strict registry',value=>value.replace(primaryCollectorRegistryStep,primaryCollectorRegistryStep+primaryCollectorRegistryStep)],
  ['altered strict registry',value=>value.replace(primaryCollectorRegistryStep,primaryCollectorRegistryStep.replace('node scripts/validate-production-sql-batches.js','node scripts/validate-production-sql-batches.js --skip'))],
  ['registry after pure command',value=>value.replace(primaryCollectorSteps,primaryCollectorCommandStep+primaryCollectorRegistryStep)],
  ['moved complete pure block',value=>value.replace(primaryCollectorSteps,'').replace(first,first+primaryCollectorSteps)],
  ['missing narrow trigger',value=>value.replace(primaryCollectorTriggerAfter,primaryCollectorTriggerBefore)],
  ['duplicate narrow trigger',value=>value.replace(primaryCollectorTriggerAfter,primaryCollectorTriggerAfter+'      - scripts/verify-production-release.js\n')],
  ['altered trigger',value=>value.replace(primaryCollectorTriggerAfter,primaryCollectorTriggerBefore+'      - scripts/verify-production-release-other.js\n')],
  ['missing whole pure selector',value=>value.replace(primaryCollectorJobGuard,primaryCollectorOldJobGuard)],
  ['broadened draft selector',value=>value.replace(primaryCollectorJobGuard,'    if: github.event.pull_request.draft == true\n')],
  ['fork selector',value=>value.replace(primaryCollectorJobGuard,primaryCollectorJobGuard.replace(' && github.event.pull_request.head.repo.full_name == github.repository',''))],
  ['unknown pure mode',value=>value.replaceAll(primaryCollectorBody,'NS_CI_SOURCE_PHASE=primary-collector-pure-v2')],
  ['combined marker',value=>value.replace(primaryCollectorJobGuard,primaryCollectorJobGuard.replace(primaryCollectorBody,primaryCollectorBody+' NS_CI_SOURCE_PHASE=source-qualification-v1'))],
  ['whitespace marker',value=>value.replace(primaryCollectorJobGuard,primaryCollectorJobGuard.replace(primaryCollectorBody,primaryCollectorBody+' '))],
  ['unguarded pure registry',value=>value.replace(primaryCollectorRegistryStep,primaryCollectorRegistryStep.replace(primaryCollectorStepGuard,''))],
  ['unguarded pure command',value=>value.replace(primaryCollectorCommandStep,primaryCollectorCommandStep.replace(primaryCollectorStepGuard,''))],
  ['READY incorrectly runs collector',value=>value.replace(primaryCollectorCommandStep,primaryCollectorCommandStep.replace('draft == true','draft == false'))],
  ['producer leakage',value=>value.replace(producerStepGuard,producerStepGuard.replace(producerPhaseBody,primaryCollectorBody))],
  ['upload leakage',value=>value.replace("if: always() && (steps.canonical_producer.outcome", "if: always() || (steps.canonical_producer.outcome")],
  ['browser leakage',value=>value.replace('    needs: fixture-activation\n'+ordinaryDraftGuard,'    needs: fixture-activation\n    if: true\n')],
  ['unreviewed ordinary-path command',value=>value.replace('        run: npm ci\n','        run: npm ci --ignore-scripts\n')],
  ...primaryCollectorNormalSteps.map(name=>['missing pure-only skip: '+name,value=>value.replace('      - name: '+name+'\n'+primaryCollectorNormalGuard,'      - name: '+name+'\n')]),
  ['READY normal-path skip',value=>value.replace(primaryCollectorNormalGuard,primaryCollectorNormalGuard.replace('github.event.pull_request.draft == false || ',''))]
 ];
 for(const[name,mutate]of controls){
  const broken=mutate(text);assert.notEqual(broken,text,name+' mutation must apply');
  assert.throws(()=>normalisePrimaryCollectorWorkflow(broken),undefined,name+' must refuse');
 }
 const repository='example/sportscal',pure={draft:true,body:primaryCollectorBody,head:{ref:sourcePhaseBranchPrefix+'pure-candidate',repo:{full_name:repository}}};
 const denied={runJob:false,runExistingSourceSteps:false,runProducer:false,runPureRegistry:false,runPureCollector:false,runFullInstalledPath:false,releaseAcceptance:false};
 const pureOnly={...denied,runJob:true,runPureRegistry:true,runPureCollector:true};
 const ready={...denied,runJob:true,runExistingSourceSteps:true,runFullInstalledPath:true};
 const source={...denied,runJob:true,runExistingSourceSteps:true};
 const producer={...source,runProducer:true};
 const cases=[
  ['explicit pure draft',pure,pureOnly],
  ['ordinary draft',{...pure,body:''},denied],
  ['source draft unchanged',{...pure,body:sourcePhaseBody},source],
  ['producer draft unchanged',{...pure,body:producerPhaseBody},producer],
  ['READY with leftover pure marker',{...pure,draft:false},ready],
  ['ordinary READY',{...pure,draft:false,body:''},ready],
  ['READY fork still full path',{...pure,draft:false,head:{ref:'unrelated',repo:{full_name:'fork/repo'}}},ready],
  ['fork draft',{...pure,head:{...pure.head,repo:{full_name:'fork/repo'}}},denied],
  ['unknown marker',{...pure,body:'NS_CI_SOURCE_PHASE=primary-collector-pure-v2'},denied],
  ['combined markers',{...pure,body:primaryCollectorBody+'\n'+producerPhaseBody},denied],
  ['leading whitespace',{...pure,body:' '+primaryCollectorBody},denied],
  ['trailing whitespace',{...pure,body:primaryCollectorBody+' '},denied],
  ['trailing newline',{...pure,body:primaryCollectorBody+'\n'},denied],
  ['wrong branch',{...pure,head:{...pure.head,ref:'codex/unrelated'}},denied],
  ['typed string draft',{...pure,draft:'true'},denied],
  ['missing draft',{...pure,draft:null},denied],
  ['missing repo',{...pure,head:{...pure.head,repo:null}},denied],
  ['non-string body',{...pure,body:{marker:primaryCollectorBody}},denied],
  ['non-string ref',{...pure,head:{...pure.head,ref:42}},denied],
  ['body case variant',{...pure,body:primaryCollectorBody.toLowerCase()},pureOnly],
  ['repository case variant',{...pure,head:{...pure.head,repo:{full_name:repository.toUpperCase()}}},pureOnly],
  ['branch case variant',{...pure,head:{...pure.head,ref:pure.head.ref.toUpperCase()}},pureOnly],
  ['combined case variants',{...pure,body:primaryCollectorBody.toLowerCase(),head:{ref:pure.head.ref.toUpperCase(),repo:{full_name:repository.toUpperCase()}}},pureOnly]
 ];
 for(const[name,pr,expected]of cases)assert.deepEqual(primaryCollectorDecision(pr,repository),expected,name);
 assert.deepEqual(primaryCollectorDecision(pure,null),denied,'Missing repository authority');
 return {workflowNegativeGroups:controls.length,typedDecisionGroups:cases.length+1,workflowNames:controls.map(([name])=>name),typedNames:[...cases.map(([name])=>name),'Missing repository authority'],normalisedC13Sha256:primaryCollectorC13WorkflowSha256,typedModelNotActionsInterpreter:true,engineRuns:0,serviceRequests:0,releaseAcceptance:false};
}
if(require.main===module){
 const text=fs.readFileSync('.github/workflows/sportscal-production.yml','utf8'),report=validate(text);
 const installedWithCollector=fs.readFileSync('.github/workflows/installed-upgrade-tests.yml','utf8');
 const primaryCollector=primaryCollectorRegressions(installedWithCollector);
 const installed=normalisePrimaryCollectorWorkflow(installedWithCollector);
 const lockedTerserPackageControls=lockedTerserPackageRegressions();
 const canonicalProducerNegativeControls=canonicalProducerRegressions(installed);
 const sourceQualification=sourceQualificationRegressions(installed);
 const signupCompatibilityNegativeControls=signupCompatibilityRegressions(validateCanonicalProducerWorkflow(installed));
 console.log(JSON.stringify({schemaVersion:'production-sql-batches.v1',...report,negativeControls:regressions(text),signupCompatibilityNegativeControls,canonicalProducerNegativeControls,sourceQualification,lockedTerserPackageControls,primaryCollector,engineRuns:0,serviceRequests:0,releaseAcceptance:false}));
}
module.exports={normalisePrimaryCollectorWorkflow,primaryCollectorDecision,primaryCollectorRegressions,resolveLockedTerserPackage,lockedTerserPackageRegressions,validate,regressions,validateSignupCompatibilityWorkflow,signupCompatibilityRegressions,sourceQualificationDecision,normaliseSourcePhaseWorkflow,validateCanonicalProducerWorkflow,canonicalProducerRegressions,sourceQualificationRegressions};
