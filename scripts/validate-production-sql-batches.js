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
const editorialPreparationBaseSha256="75049d7684c4c0dfd21f9eb452b07fccaba91b82f32a2786530f2880808bab6f";
const editorialPreparationHelperSha256="85a499d174c2f798843375639e777dceeefe865f3608114c8fd4a1db26d211b2";
const editorialPreparationInputs="      editorial_prepare:\n        description: Prepare reviewed editorial only; never publish or deploy\n        type: boolean\n        default: false\n      editorial_research_sha256:\n        description: SHA256 of the decoded reviewed public research JSON\n        type: string\n        required: false\n      editorial_research_b64:\n        description: Base64 of reviewed PUBLIC research only; never private controls\n        type: string\n        required: false\n      editorial_recipient_public_key:\n        description: Root approved ephemeral RSA public PEM only; never a private key\n        type: string\n        required: false\n";
const editorialPreparationJob="\n  editorial-preparation:\n    if: github.event_name == 'workflow_dispatch' && inputs.editorial_prepare == true\n    runs-on: ubuntu-24.04\n    timeout-minutes: 60\n    permissions:\n      contents: read\n    env:\n      INPUT_SOURCE_SHA: ${{ inputs.sha }}\n      INPUT_RESEARCH_SHA256: ${{ inputs.editorial_research_sha256 }}\n      INPUT_RESEARCH_B64: ${{ inputs.editorial_research_b64 }}\n      INPUT_RECIPIENT_PUBLIC_KEY: ${{ inputs.editorial_recipient_public_key }}\n      INPUT_QUICK: 'false'\n      PREP_RELEASE_REBUILD: ${{ inputs.rebuild && 'true' || 'false' }}\n      PREP_SELECTED_FEED_PROOF_SHA: ${{ inputs.selected_feed_proof_sha }}\n      EXPECTED_WORKFLOW_SHA: ${{ github.workflow_sha }}\n      PREP_RUN_ID: ${{ github.run_id }}\n      PREP_RUN_ATTEMPT: ${{ github.run_attempt }}\n    steps:\n      - name: Require immutable manual preparation selection\n        shell: bash\n        run: |\n          [[ \"$INPUT_SOURCE_SHA\" =~ ^[a-f0-9]{40}$ ]]\n          [[ \"$INPUT_RESEARCH_SHA256\" =~ ^[a-f0-9]{64}$ ]]\n          [[ \"$INPUT_SOURCE_SHA\" == \"$EXPECTED_WORKFLOW_SHA\" ]]\n          [[ \"$INPUT_QUICK\" == \"false\" ]]\n          [[ \"$PREP_RELEASE_REBUILD\" == \"false\" ]]\n          [[ -z \"$PREP_SELECTED_FEED_PROOF_SHA\" ]]\n\n      - name: Check out the reviewed immutable source\n        uses: actions/checkout@v5\n        with:\n          ref: ${{ inputs.sha }}\n          fetch-depth: 0\n          persist-credentials: false\n\n      - name: Set up existing Node runtime\n        uses: actions/setup-node@v5\n        with:\n          node-version: 24\n          cache: npm\n\n      - name: Install existing project dependencies only\n        run: npm ci --ignore-scripts --no-audit --no-fund\n\n      - name: Verify preparation and ordinary production source contracts\n        env:\n          GIT_NO_LAZY_FETCH: '1'\n          GIT_TERMINAL_PROMPT: '0'\n        run: timeout --signal=TERM --kill-after=5s 120s node scripts/validate-production-sql-batches.js\n\n      - name: Test transport then prepare canonical editorial without service writes\n        env:\n          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}\n          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}\n          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}\n        run: node scripts/prepare-adaptive-editorial.js\n\n      - name: Return only authenticated ciphertext and safe metadata\n        if: always()\n        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2, Node 24\n        with:\n          name: editorial-preparation-${{ github.run_id }}-${{ github.run_attempt }}\n          path: |\n            ${{ runner.temp }}/editorial-preparation-return/private-return.encrypted.json\n            ${{ runner.temp }}/editorial-preparation-return/public-manifest.json\n          if-no-files-found: ignore\n          retention-days: 1\n\n      - name: Remove exact job-owned private and encrypted staging\n        if: always()\n        shell: bash\n        run: |\n          node scripts/prepare-adaptive-editorial.js --cleanup\n          rm -f -- \"$RUNNER_TEMP/editorial-preparation-return/private-return.encrypted.json\" \"$RUNNER_TEMP/editorial-preparation-return/public-manifest.json\"\n";
const editorialPreparationRunName="run-name: ${{ inputs.editorial_prepare && 'Prepare editorial' || 'Deploy' }} ${{ inputs.sha }} ${{ inputs.request_id }}";
const editorialPreparationOriginalRunName="run-name: Deploy ${{ inputs.sha }} ${{ inputs.request_id }}";

// Manual editorial preparation is a separate, non-publishing route. Strip only
// this reviewed additive seam, then run every frozen ordinary-production check.
function validateEditorialPreparationHelper(source){
 assert.equal(typeof source,'string');
 assert.equal(hash(source),editorialPreparationHelperSha256,'Exact reviewed snapshot-only preparation/transport/cleanup helper');
}
function normaliseEditorialPreparationWorkflow(text){
 assert.equal(typeof text,'string');
 const jobs=[...text.matchAll(/^  ([a-z][a-z0-9-]*):\n/gm)];
 const names=jobs.map(m=>m[1]);
 if(names.length===2){
  assert.deepEqual(names,['sql-safety','deploy']);
  assert.equal(hash(text),editorialPreparationBaseSha256,'Only the exact prior ordinary production workflow may omit preparation');
  return {restored:text,preparation:false};
 }
 assert.deepEqual(names,['sql-safety','deploy','editorial-preparation'],'No unknown or ambiguous mode/job');
 assert(text.startsWith('name: Sportscal production\n'+editorialPreparationRunName+'\n'),'Exact mode-specific run name');
 assert(text.includes("        default: ''\n"+editorialPreparationInputs+'permissions:\n'),'Optional preparation inputs follow the existing ordinary inputs');
 assert(text.includes('permissions:\n  contents: read\nconcurrency:\n  group: sportscal-production-and-cleanup\n  cancel-in-progress: false\njobs:\n'),'Original read permission and global serialization');
 const worker=text.slice(jobs[0].index,jobs[1].index),publisher=text.slice(jobs[1].index,jobs[2].index);
 assert(worker.startsWith("  sql-safety:\n    if: inputs.editorial_prepare != true\n    name:"),'Whole four-batch job excluded from preparation');
 assert(publisher.startsWith("  deploy:\n    if: inputs.editorial_prepare != true\n    needs: [sql-safety]\n"),'Publisher mutually excluded and all SQL dependencies retained');
 const prep=text.slice(jobs[2].index);
 assert.equal(prep,editorialPreparationJob.slice(1),'Exact separately guarded preparation steps, credential boundary and ciphertext-only artifacts');
 assert(prep.startsWith("  editorial-preparation:\n    if: github.event_name == 'workflow_dispatch' && inputs.editorial_prepare == true\n"),'Manual true mode only');
 assert(prep.includes('    permissions:\n      contents: read\n'),'Preparation is contents-read only');
 assert(prep.includes("      INPUT_QUICK: 'false'\n"),'No undefined quick input on the production workflow');
 assert(prep.includes('          [[ "$INPUT_SOURCE_SHA" == "$EXPECTED_WORKFLOW_SHA" ]]\n'),'Immutable workflow and source implementation binding');
 assert(prep.includes('          [[ "$PREP_RELEASE_REBUILD" == "false" ]]\n          [[ -z "$PREP_SELECTED_FEED_PROOF_SHA" ]]\n'),'Ordinary release options cannot mix with preparation');
 assert(!/VERCEL_|GH_TOKEN|npm install --global|git push|git commit|update-sportscal-cards-and-release|redeploy-and-release|deploy-current-commit|maintain-profile-avatars/.test(prep),'No publisher, SQL-deploy credential or cleanup side route');
 assert(prep.includes('          node scripts/prepare-adaptive-editorial.js --cleanup\n'),'Always cleanup exact owned private directory');
 let restored=permanentOnce(text,editorialPreparationJob,'','reviewed manual preparation job');
 restored=permanentOnce(restored,editorialPreparationInputs,'','reviewed optional default-false preparation inputs');
 restored=permanentOnce(restored,editorialPreparationRunName,editorialPreparationOriginalRunName,'mode-specific run name');
 restored=permanentOnce(restored,"  sql-safety:\n    if: inputs.editorial_prepare != true\n","  sql-safety:\n",'whole SQL matrix guard');
 restored=permanentOnce(restored,"  deploy:\n    if: inputs.editorial_prepare != true\n","  deploy:\n",'whole publisher guard');
 assert.equal(hash(restored),editorialPreparationBaseSha256,'Entire prior ordinary workflow restored: all four SQL batches, deadlines, source SHA, credentials, gates, deploy dependencies and serialization');
 return {restored,preparation:true};
}
function editorialPreparationRegressions(text,helperSource){
 const base=normaliseEditorialPreparationWorkflow(text);
 assert.equal(base.preparation,true,'Current production workflow includes the reviewed manual route');
 assert.equal(normaliseEditorialPreparationWorkflow(base.restored).preparation,false,'Exact ordinary predecessor remains supported');
 validateEditorialPreparationHelper(helperSource);
 assert.throws(()=>validateEditorialPreparationHelper(helperSource+'\n'),undefined,'Unreviewed helper bytes reject');
 // Existing normalizer, frozen original hashes and all original validation
 // assertions are still exercised, rather than replacing them with a new hash.
 const ordinary=normalisePermanentProductionSelection(base.restored).restored;
 const report=validate(ordinary);
 assert.equal(report.batches,4);assert.equal(report.requiredOccurrences,263);
 const mutatePrep=(value,change)=>permanentOnce(value,editorialPreparationJob,change(editorialPreparationJob),'negative prep target');
 const mutateInputs=(value,change)=>permanentOnce(value,editorialPreparationInputs,change(editorialPreparationInputs),'negative input target');
 const controls=[
  ['unknown extra job',v=>v+'  unreviewed:\n    runs-on: ubuntu-24.04\n    steps: []\n'],
  ['preparation default true',v=>mutateInputs(v,s=>s.replace('        default: false','        default: true'))],
  ['ambiguous preparation type',v=>mutateInputs(v,s=>s.replace('        type: boolean','        type: string'))],
  ['duplicate preparation inputs',v=>v.replace(editorialPreparationInputs,()=>editorialPreparationInputs+editorialPreparationInputs)],
  ['missing whole SQL guard',v=>v.replace("  sql-safety:\n    if: inputs.editorial_prepare != true\n","  sql-safety:\n")],
  ['ordinary SQL bypass',v=>v.replace("  sql-safety:\n    if: inputs.editorial_prepare != true\n","  sql-safety:\n    if: inputs.editorial_prepare == true\n")],
  ['step-only SQL guard',v=>v.replace("  sql-safety:\n    if: inputs.editorial_prepare != true\n","  sql-safety:\n").replace('      - name: canonical-context-pg18\n','      - name: canonical-context-pg18\n        if: inputs.editorial_prepare != true\n')],
  ['missing whole deploy guard',v=>v.replace("  deploy:\n    if: inputs.editorial_prepare != true\n","  deploy:\n")],
  ['ordinary deploy bypass',v=>v.replace("  deploy:\n    if: inputs.editorial_prepare != true\n","  deploy:\n    if: inputs.editorial_prepare == true\n")],
  ['preparation always override',v=>mutatePrep(v,s=>s.replace("    if: github.event_name == 'workflow_dispatch' && inputs.editorial_prepare == true","    if: always()"))],
  ['preparation contents write',v=>mutatePrep(v,s=>s.replace('      contents: read','      contents: write'))],
  ['preparation executes SQL',v=>mutatePrep(v,s=>s.replace('run: node scripts/prepare-adaptive-editorial.js','run: node scripts/validate-canonical-context-batch.js'))],
  ['preparation deploy wrapper',v=>mutatePrep(v,s=>s.replace('run: node scripts/prepare-adaptive-editorial.js','run: bash scripts/update-sportscal-cards-and-release.sh'))],
  ['preparation Vercel credential',v=>mutatePrep(v,s=>s.replace('          SUPABASE_URL:',"          VERCEL_TOKEN: "+'$'+"{{ secrets.VERCEL_TOKEN }}\n          SUPABASE_URL:"))],
  ['preparation push step',v=>mutatePrep(v,s=>s.replace('          [[ "$INPUT_QUICK" == "false" ]]','          git push origin HEAD:main'))],
  ['mutable preparation source',v=>mutatePrep(v,s=>s.replace('          ref: '+'$'+'{{ inputs.sha }}','          ref: main'))],
  ['missing immutable workflow guard',v=>mutatePrep(v,s=>s.replace('          [[ "$INPUT_SOURCE_SHA" == "$EXPECTED_WORKFLOW_SHA" ]]\n',''))],
  ['mixed rebuild preparation',v=>mutatePrep(v,s=>s.replace('          [[ "$PREP_RELEASE_REBUILD" == "false" ]]\n',''))],
  ['mixed selected proof preparation',v=>mutatePrep(v,s=>s.replace('          [[ -z "$PREP_SELECTED_FEED_PROOF_SHA" ]]\n',''))],
  ['undefined quick selector',v=>mutatePrep(v,s=>s.replace("      INPUT_QUICK: 'false'","      INPUT_QUICK: "+'$'+"{{ inputs.quick }}"))],
  ['persisted preparation checkout token',v=>mutatePrep(v,s=>s.replace('          persist-credentials: false','          persist-credentials: true'))],
  ['public artifact wildcard',v=>mutatePrep(v,s=>s.replace('/private-return.encrypted.json','/*.json'))],
  ['public plaintext report',v=>mutatePrep(v,s=>s.replace('/private-return.encrypted.json','/research-check-report.json'))],
  ['missing always private cleanup',v=>mutatePrep(v,s=>s.replace('          node scripts/prepare-adaptive-editorial.js --cleanup\n',''))],
  ['unsafe broad temp cleanup',v=>mutatePrep(v,s=>s.replace('          node scripts/prepare-adaptive-editorial.js --cleanup','          rm -rf -- "$RUNNER_TEMP"'))],
  ['lost ordinary SQL batch',v=>v.replace('near-selection, grouped-view','grouped-view')],
  ['lost ordinary deploy dependency',v=>v.replace('    needs: [sql-safety]\n','')],
  ['changed ordinary deadline',v=>v.replace('    timeout-minutes: 30','    timeout-minutes: 31')],
  ['lost ordinary publisher gate',v=>v.replace('          node scripts/validate-preference-bookkeeping.js\n','')],
  ['changed global serialization',v=>v.replace('  group: sportscal-production-and-cleanup','  group: unreviewed-preparation')],
  ['cancellation of concurrent publisher',v=>v.replace('  cancel-in-progress: false','  cancel-in-progress: true')],
  ['global write permissions',v=>v.replace('permissions:\n  contents: read','permissions:\n  contents: write')],
 ];
 for(const[name,mutate]of controls){const broken=mutate(text);assert.notEqual(broken,text,name+' mutation must apply');assert.throws(()=>normaliseEditorialPreparationWorkflow(broken),undefined,name+' must refuse');}
 return {groups:controls.length,routingNegativeControls:controls.length,helperByteRejections:1,names:controls.map(([name])=>name),helperSourcePinned:true,ordinaryPredecessorRestored:true,
 originalRequiredOccurrences:report.requiredOccurrences,engineRuns:0,serviceRequests:0,releaseAcceptance:false};
}

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


// Typed consumer selection is not admission or qualification evidence.
function actualConsumerContextRoute(body){
 assert(body&&typeof body==='object'&&!Array.isArray(body),'Typed consumer handover required');
 const b=body.sourceQualificationBinding;assert(b&&typeof b==='object'&&!Array.isArray(b),'Typed source binding required');
 if(body.schemaVersion==='ns-release-handover.normal613.v1'){
  assert.equal(b.schemaVersion,'normal-ready-613-binding.v1','Exact normal613 binding schema');
  return 'NORMAL613';
 }
 if(body.schemaVersion==='ns-release-handover.forward.v1')return 'FORWARD';
 if(body.schemaVersion==='ns-release-handover.v1')return 'E610';
 assert.fail('Unknown actual consumer handover schema');
}
function actualConsumerContextRoutingRegressions(){
 const results=[],pass=(name,run)=>{run();results.push({name,status:'PASS_TYPED_SELECTION_CONTROL_ONLY'});};
 const reject=(name,body)=>pass(name,()=>assert.throws(()=>actualConsumerContextRoute(body)));
 const body=(schema,binding='synthetic-legacy-binding-selection-only')=>({schemaVersion:schema,sourceQualificationBinding:{schemaVersion:binding}});
 pass('legacy handover remains E610-selected',()=>assert.equal(actualConsumerContextRoute(body('ns-release-handover.v1')),'E610'));
 pass('forward handover remains forward-selected',()=>assert.equal(actualConsumerContextRoute(body('ns-release-handover.forward.v1')),'FORWARD'));
 pass('normal613 exact schema pair is selected separately, not legacy',()=>assert.equal(actualConsumerContextRoute(body('ns-release-handover.normal613.v1','normal-ready-613-binding.v1')),'NORMAL613'));
 reject('unknown handover schema fails closed',body('unknown'));
 reject('schema prefix is not an accepted profile',body('ns-release-handover.normal613.v1-extra','normal-ready-613-binding.v1'));
 reject('normal613 wrong nested schema fails closed',body('ns-release-handover.normal613.v1','sync-source-binding.v1'));
 reject('normal613 missing nested schema fails closed',{schemaVersion:'ns-release-handover.normal613.v1',sourceQualificationBinding:{}});
 reject('missing handover schema fails closed',{sourceQualificationBinding:{}});
 reject('missing source binding fails closed',{schemaVersion:'ns-release-handover.normal613.v1'});
 reject('array source binding fails closed',{schemaVersion:'ns-release-handover.normal613.v1',sourceQualificationBinding:[]});
 reject('null source binding fails closed',{schemaVersion:'ns-release-handover.normal613.v1',sourceQualificationBinding:null});
 reject('array handover fails closed',[]);
 reject('null handover fails closed',null);
 reject('string handover fails closed','ns-release-handover.normal613.v1');
 return {groups:results.length,positive:3,negative:results.length-3,results,scope:'TYPED_SELECTION_ONLY_NOT_BODY_ADMISSION',normal613ActualBodyParserExecuted:false,actualLegacyConsumersExecuted:false,requiredSourceAdmissionGateClosed:false,releaseAcceptance:false};
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
 const route=actualConsumerContextRoute(body);
 if(route==='NORMAL613'){require('./validate-forward-onboarding-ci').normal613Body(bodyBytes);return skipped('Typed normal613 context: legacy E610 consumer controls NOT_APPLICABLE; no consumer/admission/release credit. Existing normal613 intake/source admission/focused/full qualification/premerge/both-engine gates remain required.');}
 if(route!=='E610')return skipped('Typed forward context: E610 consumer controls NOT_APPLICABLE; forward consumer and all source admission gates remain required.');
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
 text=normaliseEditorialPreparationWorkflow(text).restored;
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
 assert(before.isFile()&&!before.isSymbolicLink()&&before.size===21975,'Exact reviewed collector source');
 const stamp=s=>[s.dev,s.ino,s.size,s.mode,s.mtimeMs,s.ctimeMs],fd=fs.openSync(collectorFile,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let source;
 try{assert.deepEqual(stamp(fs.fstatSync(fd)),stamp(before));source=fs.readFileSync(fd);assert.deepEqual(stamp(fs.fstatSync(fd)),stamp(before));}finally{fs.closeSync(fd);}
 assert.deepEqual(stamp(fs.lstatSync(collectorFile)),stamp(before));assert.equal(source.length,21975);
 assert.equal(hash(source),'0c50daf81a2b7bed72ba24a33fc453040480e91cc41923a92e8e1570426cbcde');
 const collector=require(collectorFile),validateBinding=(binding,wall)=>collector.validateCaptureBinding(JSON.parse(JSON.stringify(binding)),wall);
 const harness="\nconst cases=[];function pass(name,run){run();cases.push(name);}function fail(name,run){assert.throws(run,undefined,name);cases.push(name);}\nconst H='1'.repeat(40),B='2'.repeat(40),T='3'.repeat(40),TREE='4'.repeat(40),NOW=Date.parse('2026-11-06T00:00:00.000Z');\nfunction fixture(){const facts={baselineSha:baseline,baselineVersion:baselineVersion,deployment:{id:deployment,state:'READY',releaseGitSha:baseline,origin:'https://nothingsport.app',checkedAt:new Date(NOW).toISOString()},alias:{domain:'nothingsport.app',deploymentId:deployment,projectId:project,teamId:team,redirect:null,checkedAt:new Date(NOW).toISOString()},publisherWindow:{owner:'nsPUBLISH',held:true}};return {body:{schemaVersion:'primary-baseline-capture-request.v1',publisherHeadSha:H,publisherTreeSha:TREE,preparedForBaseSha:B,namedAllocationId:'synthetic-source-control-only',publisherBindingRecordSha256:'a'.repeat(64),captureFacts:facts},event:{action:'opened',number:1,repository:{full_name:'hartican/sportscal'},pull_request:{number:1,draft:true,head:{sha:H,ref:'codex/baseline-capture-owned-control',repo:{full_name:'hartican/sportscal'}},base:{sha:B}}},env:{GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_JOB:'fixture-activation',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'1',GITHUB_REF:'refs/pull/1/merge',GITHUB_SHA:T},observed:{checkoutSha:T,parents:[B,H],headTree:TREE,testedTree:TREE}};}\nfunction run(x,raw){return primaryCaptureRequest(raw||Buffer.from(JSON.stringify(x.body)),x.event,x.env,x.observed,NOW,validateBinding);}\npass('exact capture binding uses actual T not H',()=>{const x=fixture(),r=run(x);assert.equal(r.binding.collectorSha,T);assert.equal(r.H,H);assert.equal(r.binding.preparedForBaseSha,B);});\npass('fixed611 collector target not old609, with unchanged primary command scope',()=>{assert.equal(baseline,'4bff7ada7d03c3bff52a262f58e630fe47848a74');assert.equal(baselineVersion,'611');assert.equal(deployment,'dpl_CRai77riopJQrZNyGbJZBKkVmPVA');});\npass('actual external INTENT/body byte join is pure and not ACK authentication',()=>{\n const intentBytes=Buffer.from('SYNTHETIC_CONTROL_INTENT_NOT_ACTION_AUTHORITY'),bodyBytes=Buffer.from(JSON.stringify(fixture().body));\n const args={intentBytes,bodyBytes,acknowledgedIntentSha256:hash(intentBytes),acknowledgedBodySha256:hash(bodyBytes)};\n assert.equal(validateAck(args).scope,'BYTE_JOIN_ONLY_NOT_ACK_AUTHENTICATION_OR_ACTION_AUTHORITY');\n});\nfor(const[name,change]of[\n ['wrong independent INTENT byte identity',x=>{x.intentBytes=Buffer.from('OTHER_SYNTHETIC_INTENT');}],\n ['wrong final body byte identity',x=>{x.bodyBytes=Buffer.concat([x.bodyBytes,Buffer.from(' ')]);}],\n ['wrong INTENT ACK digest',x=>{x.acknowledgedIntentSha256='0'.repeat(64);}],\n ['wrong body ACK digest',x=>{x.acknowledgedBodySha256='0'.repeat(64);}],\n ['ACK of noncompact trailingLF body still refuses',x=>{x.bodyBytes=Buffer.concat([x.bodyBytes,Buffer.from('\\n')]);x.acknowledgedBodySha256=hash(x.bodyBytes);}]\n])fail(name,()=>{\n const intentBytes=Buffer.from('SYNTHETIC_CONTROL_INTENT_NOT_ACTION_AUTHORITY'),bodyBytes=Buffer.from(JSON.stringify(fixture().body));\n const args={intentBytes,bodyBytes,acknowledgedIntentSha256:hash(intentBytes),acknowledgedBodySha256:hash(bodyBytes)};change(args);validateAck(args);\n});\n\npass('Ready never captures and keeps normal/browser',()=>{const x=fixture();x.event.pull_request.draft=false;const r=captureRouteDecision(x.event.pull_request,'hartican/sportscal');assert.equal(r.runNormal,true);assert.equal(r.runInstalledBrowser,true);assert.equal(r.runCapture,false);});\npass('case-insensitive branch/repository model',()=>{const x=fixture();x.event.pull_request.head.ref=x.event.pull_request.head.ref.toUpperCase();x.event.pull_request.head.repo.full_name='HARTICAN/SPORTSCAL';assert.equal(captureRouteDecision(x.event.pull_request,'hartican/sportscal').runCapture,true);});\nfor(const[name,change]of[\n ['missing request field',x=>delete x.body.publisherTreeSha],['extra request field',x=>x.body.extra=true],['unknown mode',x=>x.body.schemaVersion='other'],['combined scope',x=>x.body.sourceQualificationBinding={}],['coerced head',x=>x.body.publisherHeadSha=42],['blank allocation',x=>x.body.namedAllocationId=' '],['template allocation',x=>x.body.namedAllocationId='SOURCE_TEMPLATE'],['wrong head',x=>x.body.publisherHeadSha=B],['wrong base',x=>x.body.preparedForBaseSha=H],['wrong tree',x=>x.body.publisherTreeSha=H],['fork',x=>x.event.pull_request.head.repo.full_name='fork/repo'],['wrong branch',x=>x.event.pull_request.head.ref='codex/unrelated'],['ordinary draft',x=>x.event.pull_request.head.ref='main'],['Ready cannot capture',x=>x.event.pull_request.draft=false],['unknown event',x=>x.event.action='edited'],['attempt2',x=>x.env.GITHUB_RUN_ATTEMPT='2'],['bad run',x=>x.env.GITHUB_RUN_ID='01'],['event base mismatch',x=>x.event.pull_request.base.sha=H],['checkout mismatch',x=>x.observed.checkoutSha=H],['parent order',x=>x.observed.parents=[H,B]],['unequal trees',x=>x.observed.testedTree=H],['wrong baseline',x=>x.body.captureFacts.baselineVersion='608'],['old609 version',x=>x.body.captureFacts.baselineVersion='609'],['old609 baseline',x=>x.body.captureFacts.baselineSha='037a6214c1a573b57298d3ea504de0b89e31d473'],['old609 deployment',x=>x.body.captureFacts.deployment.id='dpl_iMQryy8NccQZSzJnUc9i1HLdLYhB'],['extra facts',x=>x.body.captureFacts.extra=true],['legacy alias',x=>x.body.captureFacts.alias.domain='legacy.vercel.app'],['not READY',x=>x.body.captureFacts.deployment.state='ERROR'],['unheld window',x=>x.body.captureFacts.publisherWindow.held=false],['future alias',x=>x.body.captureFacts.alias.checkedAt=new Date(NOW+1).toISOString()],['stale deployment',x=>x.body.captureFacts.deployment.checkedAt=new Date(NOW-86400001).toISOString()],['unpaired Unicode',x=>x.body.namedAllocationId='\\ud800']\n])fail(name,()=>{const x=fixture();change(x);run(x);});\nfail('trailingLF',()=>{const x=fixture();run(x,Buffer.from(JSON.stringify(x.body)+'\\n'));});\nfail('duplicate request keys',()=>{const x=fixture();run(x,Buffer.from(JSON.stringify(x.body).replace('\"schemaVersion\":\"primary-baseline-capture-request.v1\"','\"schemaVersion\":\"other\",\"schemaVersion\":\"primary-baseline-capture-request.v1\"')));});\nfail('invalidUTF8',()=>run(fixture(),Buffer.from([255])));\nfail('body limit',()=>run(fixture(),Buffer.alloc(65537)));\n({groups:cases.length,names:cases,typedPrModelNotActionsInterpreter:true,networkRequests:0,releaseAcceptance:false});\n";
 const requestControls=require('node:vm').runInNewContext(pure+'\n'+harness,{assert,Buffer,TextDecoder:require('node:util').TextDecoder,path:require('node:path'),crypto,hash,validateBinding,baseline:collector.BASELINE,baselineVersion:collector.BASELINE_VERSION,validateAck:collector.validateCaptureIntentBodyAck,deployment:collector.DEPLOYMENT,project:collector.PROJECT,team:collector.TEAM},{timeout:5000});
 return {restored,report:{workflowNegativeGroups:controls.length,workflowNames:controls.map(([name])=>name),requestControls,captureOriginGetsExecuted:0,realTransportOrFilesystemProof:false,normalReadyGuardRestored:true,premergeGateCount:13,wholePremergeSeconds:300,releaseAcceptance:false}};
}


// Normal producer projection read reuse: strict prior-source restoration plus closed boundary controls.
const projectionReadReusePriorWorkflowSha256='f552126a058d6d96ed01c72d65d1c1d0d52c8e6d1d2dc1a6042abcf4cb622be9';
const projectionReadReuseSha256="51ea43c1067e40e30cbca0a93e9ee19aa7a90fbccd26769bea9b82698a7bdfdc";
const projectionReadReusePrevious="function projection(entries,readSource,policy){\n exactKeys(policy,['schemaVersion','includeDirectories','includeFiles','rootExtensions','excludeDirectories','excludeFiles','preserveBytes','compactJson','acceptedBytes'],'Deployment policy');\n assert.equal(policy.schemaVersion,'deployment-manifest.v1');assert.equal(policy.compactJson,true);\n for(const key of ['includeDirectories','includeFiles','rootExtensions','excludeDirectories','excludeFiles','preserveBytes'])assert(Array.isArray(policy[key])&&policy[key].every(x=>typeof x==='string'),'Policy array '+key);\n const secret=name=>name.includes('supabase_keys.txt')||name.split('/').some(part=>part.startsWith('.env'));\n const retained=name=>!secret(name)&&!policy.excludeDirectories.some(prefix=>name.startsWith(prefix))&&!policy.excludeFiles.includes(name)&&(policy.includeDirectories.some(prefix=>name.startsWith(prefix))||policy.includeFiles.includes(name)||(!name.includes('/')&&policy.rootExtensions.includes(path.extname(name))));\n const byName=new Map(entries.map(e=>[e.path,e])),selected=new Set(entries.filter(e=>retained(e.path)).map(e=>e.path));\n for(const name of selected){\n  if(!name.endsWith('.js'))continue;const source=utf8Text(readSource(byName.get(name)));\n  for(const match of source.matchAll(/require\\(\\s*['\"](\\.[^'\"]+)['\"]\\s*\\)/g)){\n   const base=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1])),dependency=[base,base+'.js',base+'.json',base+'/index.js'].find(p=>byName.has(p));\n   if(dependency){assert(!secret(dependency),'Runtime dependency refers to excluded secret');selected.add(dependency);}\n  }\n }\n return entries.filter(e=>selected.has(e.path)).map(e=>{\n  const source=readSource(e),compact=policy.compactJson&&e.path.endsWith('.json')&&!policy.preserveBytes.includes(e.path);\n  const bytes=compact?Buffer.from(JSON.stringify(JSON.parse(utf8Text(source)))+'\\n'):source;\n  return {row:{path:e.path,gitBlob:e.gitBlob,sourceBytes:source.length,bytes:bytes.length,transform:compact?'json-compact':'identity',sha256:hash(bytes)},bytes,mode:e.mode};\n });\n}\n";
function projectionReadReuseOnce(text,before,after){
 assert.equal(text.split(before).length-1,1,'Unique producer source amendment');return text.replace(before,()=>after);
}
function projectionReadReuseAdapter(text){
 const header="          timeout --signal=TERM --kill-after=5s 30s node <<'NS_E610_ADMISSION'\n",footer="          NS_E610_ADMISSION\n";
 assert.equal(text.split(header).length-1,1,'One normal producer heredoc');const start=text.indexOf(header)+header.length,end=text.indexOf(footer,start);assert(end>start,'Closed normal producer heredoc');
 const raw=text.slice(start,end);assert(raw.endsWith('\n'),'Producer final LF');
 const lines=raw.slice(0,-1).split('\n');assert(lines.every(line=>line===''||line.startsWith('          ')),'Producer indentation');
 return {raw,source:lines.map(line=>line.startsWith('          ')?line.slice(10):line).join('\n')+'\n'};
}
function normaliseProjectionReadReuseWorkflow(text){
 const adapter=projectionReadReuseAdapter(text),start=adapter.source.indexOf('function projection(entries,readSource,policy){'),end=adapter.source.indexOf('// NS_E610_PURE_END',start);
 assert(start>=0&&end>start,'Actual projection source');const selected=adapter.source.slice(start,end);assert.equal(hash(selected),projectionReadReuseSha256,'Exact reviewed projection read reuse');
 const indent=value=>value.slice(0,-1).split('\n').map(line=>'          '+line).join('\n')+'\n';
 const restored=projectionReadReuseOnce(text,indent(selected),indent(projectionReadReusePrevious));
 assert.equal(hash(restored),projectionReadReusePriorWorkflowSha256,'Only declared projection edit may restore prior whole workflow');
 return {restored,source:adapter.source,priorSource:projectionReadReuseAdapter(restored).source};
}
function projectionReadBudgetRegressions(text){
 const selected=normaliseProjectionReadReuseWorkflow(text),controls=[];
 const mutate=(value,before,after)=>{
  const adapter=projectionReadReuseAdapter(value),changed=projectionReadReuseOnce(adapter.source,before,after),raw=changed.slice(0,-1).split('\n').map(line=>'          '+line).join('\n')+'\n';
  return projectionReadReuseOnce(value,adapter.raw,raw);
 };
 const mutations=[
  ['cache bypass', 'source=verifiedJavaScript.get(e.path);','source=readSource(e);'],
  ['unverified cache entry',"verifiedJavaScript.set(name,verified);","verifiedJavaScript.set(name,Buffer.alloc(0));"],
  ['source final proof bypass','assert.deepEqual(sourceInventory(entries),rows,','assert.deepEqual(rows,rows,'],
  ['dependency final proof bypass','JSON.stringify(dependencies())','JSON.stringify(installed)'],
  ['Node final proof bypass','rawIdentity(nodePath,nodePath,path.dirname(nodePath)),nodeBinary','nodeBinary,nodeBinary'],
  ['cumulative cap raised','read:2*1024*1024*1024','read:3*1024*1024*1024'],
  ['per-file cap raised','file:256*1024*1024','file:512*1024*1024'],
  ['installed count cap raised','installed:40000','installed:80000'],
  ['source count cap raised','source:10000','source:20000'],
  ['child reservation discounted','2*expectedProjection.reduce','expectedProjection.reduce'],
  ['charged read discounted','charge(before.size);','charge(0);']
 ];
 for(const[name,before,after]of mutations){const broken=mutate(text,before,after);assert.notEqual(broken,text,name);assert.throws(()=>normaliseProjectionReadReuseWorkflow(broken),undefined,name);controls.push(name);}
 const vm=require('node:vm'),nodePath=require('node:path'),context={assert,Buffer,path:nodePath,crypto,hash,TextDecoder:require('node:util').TextDecoder};
 const pure=source=>source.slice(source.indexOf('// NS_E610_PURE_BEGIN'),source.indexOf('// NS_E610_PURE_END'));
 const current=vm.runInNewContext(pure(selected.source)+'\n({projection,E610_LIMITS});',{...context},{timeout:1000});
 const prior=vm.runInNewContext(pure(selected.priorSource)+'\n({projection,E610_LIMITS});',{...context},{timeout:1000});
 for(const api of [current,prior]){assert.equal(api.E610_LIMITS.read,2*1024*1024*1024);assert.equal(api.E610_LIMITS.file,256*1024*1024);assert.equal(api.E610_LIMITS.installed,40000);}
 const names=[],pass=(name,operation)=>{operation();names.push(name);};
 const policy={schemaVersion:'deployment-manifest.v1',includeDirectories:[],includeFiles:['api/main.js','static/kept.txt','app-version.json'],rootExtensions:[],excludeDirectories:[],excludeFiles:[],preserveBytes:['app-version.json'],compactJson:true,acceptedBytes:0};
 const files=new Map([
  ['api/main.js',Buffer.from("require('../lib/dep');\nrequire('../lib/data.json');\n")],
  ['lib/dep.js',Buffer.from("require('../api/main');\n")],
  ['lib/data.json',Buffer.from(' { "answer": 1 } \n')],
  ['static/kept.txt',Buffer.from('untouched\n')],
  ['app-version.json',Buffer.from('{\n  "version": "610"\n}\n')],
  ['lib/unrelated.js',Buffer.from('unselected fixture only\n')]
 ]);
 const entries=Array.from(files,([path,bytes])=>({path,mode:'100644',gitBlob:crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')}));
 function project(api,sourceFiles=files,sourceEntries=entries,sourcePolicy=policy){
  const counts=new Map();let logicalBytes=0;
  const result=api.projection(sourceEntries,entry=>{assert(sourceFiles.has(entry.path),'Closed projection fixture');const bytes=sourceFiles.get(entry.path);counts.set(entry.path,(counts.get(entry.path)||0)+1);logicalBytes+=bytes.length;return bytes;},sourcePolicy);
  return {result,counts,logicalBytes};
 }
 const old=project(prior),now=project(current),comparable=value=>JSON.stringify(value.map(item=>({row:item.row,mode:item.mode,bytes:item.bytes.toString('base64')})));
 pass('actual cached projection retains exact prior closure, modes, transform and bytes',()=>assert.equal(comparable(now.result),comparable(old.result)));
 pass('each selected JavaScript is read once; non-JavaScript once; unrelated source never read',()=>{
  for(const item of now.result){assert.equal(now.counts.get(item.row.path),1);assert.equal(old.counts.get(item.row.path),item.row.path.endsWith('.js')?2:1);}
  assert.equal(now.counts.get('lib/unrelated.js'),undefined);
 });
 pass('actual reduction is exactly selected JavaScript source bytes, with unchanged child reservation',()=>{
  const js=now.result.filter(item=>item.row.path.endsWith('.js')).reduce((n,item)=>n+item.row.sourceBytes,0);
  assert.equal(old.logicalBytes-now.logicalBytes,js);
  const reservation=value=>2*value.reduce((n,item)=>n+item.row.sourceBytes*(item.row.path.endsWith('.js')?2:1),0);
  assert.equal(reservation(old.result),reservation(now.result));
 });
 pass('relative secret dependency remains rejected without reading its body',()=>{
  const privateFiles=new Map(files);privateFiles.set('api/main.js',Buffer.from("require('../.env/token.json');\n"));privateFiles.set('.env/token.json',Buffer.from('NEVER_READ'));
  const privateEntries=Array.from(privateFiles,([path,bytes])=>({path,mode:'100644',gitBlob:'0'.repeat(40)}));let privateReads=0;
  assert.throws(()=>current.projection(privateEntries,entry=>{if(entry.path.startsWith('.env/'))privateReads++;return privateFiles.get(entry.path);},policy),/Runtime dependency refers to excluded secret/);assert.equal(privateReads,0);
 });
 pass('invalid UTF8 JavaScript remains fail closed',()=>{
  const bad=new Map(files);bad.set('api/main.js',Buffer.from([255]));assert.throws(()=>project(current,bad));
 });
 const prefix=selected.source.slice(0,selected.source.indexOf('const eventFile='));
 assert(prefix.length>0&&prefix.includes('function stableBytes('),'Actual producer pre-main prefix');
 function runPrefix(script,{size=32}={}){
  const disk={data:Buffer.from('/* closed fixture */'.padEnd(32,' ')),size,opens:0,reads:0,closes:0,last:null,mutations:0},root='/closed/repo';
  const directory={isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>false,dev:1,ino:1,size:0,mode:0o40755,mtimeMs:1,ctimeMs:1};
  const stat=file=>({isDirectory:()=>false,isFile:()=>true,isSymbolicLink:()=>false,dev:1,ino:2,size:disk.size,mode:file.startsWith('/closed/runtime/')?0o100755:0o100644,mtimeMs:1,ctimeMs:1});
  const closedFs={
   constants:{O_RDONLY:0,O_NOFOLLOW:1},realpathSync:file=>file,
   lstatSync:file=>['/closed/repo','/closed/repo/config','/closed/repo/node_modules','/closed/runtime'].includes(file)?directory:stat(file),
   readdirSync:folder=>{assert.equal(folder,'/closed/repo/node_modules');return ['probe.js'];},
   openSync:file=>{disk.opens++;disk.last=file;return 7;},fstatSync:fd=>{assert.equal(fd,7);return stat(disk.last);},
   readFileSync:fd=>{assert.equal(fd,7);disk.reads++;return Buffer.from(disk.data);},closeSync:fd=>{assert.equal(fd,7);disk.closes++;},
   readlinkSync:()=>{throw Error('No link reads allocated in this closed fixture');}
  };
  let childCalls=0,appImports=0;
  const requireClosed=name=>{
   if(name==='node:fs')return closedFs;
   if(name==='node:child_process')return {execFileSync(){childCalls++;throw Error('No child execution in boundary controls');}};
   if(['node:assert/strict','node:path','node:crypto','node:util'].includes(name))return require(name);
   appImports++;throw Error('No application imports in boundary controls');
  };
  const boundaryContext={require:requireClosed,Buffer,process:{cwd:()=>root},expectedProjection:now.result,__mutateFixture(){disk.data=Buffer.from(disk.data);disk.data[0]^=1;disk.mutations++;}};
  const result=vm.runInNewContext(prefix+'\n'+script+'\n({readBytes});',boundaryContext,{timeout:1000});
  assert.equal(childCalls,0);assert.equal(appImports,0);return {disk,result};
 }
 pass('actual stableBytes accepts exact cumulative boundary with only32 physical fixture bytes',()=>{
  const r=runPrefix("readBytes=E610_LIMITS.read-32;assert.equal(stableBytes(path.join(root,'config/probe.js')).length,32);assert.equal(readBytes,E610_LIMITS.read);");
  assert.equal(r.disk.opens,1);assert.equal(r.disk.reads,1);assert.equal(r.disk.closes,1);
 });
 pass('actual cumulative +1 refuses before opening or allocating a file buffer',()=>{
  const r=runPrefix("readBytes=E610_LIMITS.read-31;assert.throws(()=>stableBytes(path.join(root,'config/probe.js')),/Metadata read bound/);");
  assert.equal(r.disk.opens,0);assert.equal(r.disk.reads,0);assert.equal(r.disk.closes,0);
 });
 pass('actual per-file +1 refuses before opening; no256MiB fixture allocation',()=>{
  const r=runPrefix("assert.throws(()=>stableBytes(path.join(root,'config/probe.js')),/Regular input size bound/);",{size:256*1024*1024+1});
  assert.equal(r.disk.opens,0);assert.equal(r.disk.reads,0);
 });
 const reservationStart=selected.source.indexOf('const childReadReservation='),reservationEnd=selected.source.indexOf('processOutput(process.execPath',reservationStart),reservationSource=selected.source.slice(reservationStart,reservationEnd);
 assert(reservationStart>0&&reservationEnd>reservationStart&&reservationSource.includes("Conservative child source-read reservation"),'Actual unchanged reservation code');
 const reserved=2*now.result.reduce((n,item)=>n+item.row.sourceBytes*(item.row.path.endsWith('.js')?2:1),0);
 pass('actual conservative child reservation exact boundary remains charged',()=>{
  const r=runPrefix('readBytes=E610_LIMITS.read-'+reserved+';\n'+reservationSource+'\nassert.equal(readBytes,E610_LIMITS.read);');
  assert.equal(r.disk.opens,0);
 });
 pass('actual conservative child reservation +1 remains fail closed',()=>{
  const r=runPrefix('readBytes=E610_LIMITS.read-'+reserved+'+1;assert.throws(()=>{\n'+reservationSource+'\n},/Conservative child source-read reservation/);');
  assert.equal(r.disk.opens,0);
 });
 pass('projection cache cannot hide a changed final source inventory',()=>{
  const r=runPrefix("const file=path.join(root,'config/probe.js'),original=stableBytes(file),entry={path:'config/probe.js',mode:'100644',gitBlob:crypto.createHash('sha1').update('blob '+original.length+'\\0').update(original).digest('hex')};projection([entry],sourceBytes,{schemaVersion:'deployment-manifest.v1',includeDirectories:[],includeFiles:['config/probe.js'],rootExtensions:[],excludeDirectories:[],excludeFiles:[],preserveBytes:[],compactJson:true,acceptedBytes:0});__mutateFixture();assert.throws(()=>sourceInventory([entry]),/Working bytes versus actual raw Git blob/);");
  assert.equal(r.disk.opens,3);assert.equal(r.disk.mutations,1);
 });
 pass('dependency final inventory remains an independent byte read',()=>{
  const r=runPrefix("const initial=hash(Buffer.from(JSON.stringify(dependencies())));__mutateFixture();assert.notEqual(hash(Buffer.from(JSON.stringify(dependencies()))),initial);");
  assert.equal(r.disk.opens,2);assert.equal(r.disk.reads,2);
 });
 pass('Node final identity remains an independent byte read',()=>{
  const r=runPrefix("const file='/closed/runtime/node',initial=rawIdentity(file,file,'/closed/runtime');__mutateFixture();assert.notEqual(rawIdentity(file,file,'/closed/runtime').sha256,initial.sha256);");
  assert.equal(r.disk.opens,2);assert.equal(r.disk.reads,2);
 });
 return {restored:selected.restored,report:{scope:'Actual producer projection and pre-main IO prefix with closed mocked FS/child/imports; no real2GiB fixture, no app/full qualification or real dependency measurement.',workflowMutationGroups:controls.length,workflowMutationNames:controls,boundaryGroups:names.length,boundaryNames:names,actualDependencyPathOrSizeEstablished:false,realDependencyReads:0,realApplicationImports:0,materializerRuns:0,readCap:2*1024*1024*1024,perFileCap:256*1024*1024,finalProofs:'Independent source/dependency/Node reads retained; no cache shared with them.',releaseAcceptance:false}};
}


// Normal producer first-failure read ledger, without changing original read/output authority.
const producerLedgerPriorWorkflowSha256='68561fdc76f8b9846320f535ff762049e98856a7cc66084849e621784e02a17e';
const producerLedgerSourceSha256="0d8cac312146848b0e11617769b08d1d43f7f1da3984bf323681b7a2188f11f5";
const producerLedgerReversions=[{"current":"setReadPhase('receipt-writeback');\nconst receiptFile=save('execution-receipt.json',jsonBytes(receipt),E610_LIMITS.receipt);","previous":"const receiptFile=save('execution-receipt.json',jsonBytes(receipt),E610_LIMITS.receipt);"},{"current":"setReadPhase('node-final');\nassert.deepEqual(rawIdentity(nodePath,nodePath,path.dirname(nodePath)),nodeBinary,'Node binary changed');","previous":"assert.deepEqual(rawIdentity(nodePath,nodePath,path.dirname(nodePath)),nodeBinary,'Node binary changed');"},{"current":"setReadPhase('dependencies-final');\nassert.equal(hash(Buffer.from(JSON.stringify(dependencies()))),proof.fileMapSha256,'Installed dependencies changed during metadata preparation');","previous":"assert.equal(hash(Buffer.from(JSON.stringify(dependencies()))),proof.fileMapSha256,'Installed dependencies changed during metadata preparation');"},{"current":"setReadPhase('source-final');\nassert.deepEqual(sourceInventory(entries),rows,'Tracked source changed during metadata preparation');","previous":"assert.deepEqual(sourceInventory(entries),rows,'Tracked source changed during metadata preparation');"},{"current":"setReadPhase('projection-output');\nconst deploymentPath=ownedPath(admission,path.join(snapshot,'deployment-files.json')),deploymentBytes=stableBytes(deploymentPath,E610_LIMITS.manifest,admission),deployment=JSON.parse(utf8Text(deploymentBytes));","previous":"const deploymentPath=ownedPath(admission,path.join(snapshot,'deployment-files.json')),deploymentBytes=stableBytes(deploymentPath,E610_LIMITS.manifest,admission),deployment=JSON.parse(utf8Text(deploymentBytes));"},{"current":"setReadPhase('child-reservation');\nconst childReadReservation=2*expectedProjection.reduce((n,e)=>n+e.row.sourceBytes*(e.row.path.endsWith('.js')?2:1),0);\ncharge(childReadReservation,null,true);","previous":"const childReadReservation=2*expectedProjection.reduce((n,e)=>n+e.row.sourceBytes*(e.row.path.endsWith('.js')?2:1),0);\nreadBytes+=childReadReservation;assert(readBytes<=E610_LIMITS.read,'Conservative child source-read reservation');"},{"current":"setReadPhase('projection-policy');\nconst policy=JSON.parse(utf8Text(sourceBytes(byPath.get('config/deployment-manifest.json'))));\nsetReadPhase('projection-source');\nconst expectedProjection=projection(entries,sourceBytes,policy);","previous":"const policy=JSON.parse(utf8Text(sourceBytes(byPath.get('config/deployment-manifest.json')))),expectedProjection=projection(entries,sourceBytes,policy);"},{"current":"setReadPhase('metadata-writeback');\nconst assembledFile=save('assembled-source-manifest.json',assembled),proofFile=save('dependencies.json',jsonBytes(proof));","previous":"const assembledFile=save('assembled-source-manifest.json',assembled),proofFile=save('dependencies.json',jsonBytes(proof));"},{"current":"setReadPhase('terser-provenance');\nconst entryIdentity=rawIdentity(terserMain,path.relative(root,terserMain).split(path.sep).join('/'));","previous":"const entryIdentity=rawIdentity(terserMain,path.relative(root,terserMain).split(path.sep).join('/'));"},{"current":"setReadPhase('dependencies-initial');\nconst installed=dependencies(),nodePath=fs.realpathSync(process.execPath);\nsetReadPhase('node-initial');\nconst nodeBinary=rawIdentity(nodePath,nodePath,path.dirname(nodePath));","previous":"const installed=dependencies(),nodePath=fs.realpathSync(process.execPath),nodeBinary=rawIdentity(nodePath,nodePath,path.dirname(nodePath));"},{"current":"setReadPhase('locked-inputs');\nconst lock=JSON.parse(utf8Text(sourceBytes(byPath.get('package-lock.json'))));","previous":"const lock=JSON.parse(utf8Text(sourceBytes(byPath.get('package-lock.json'))));"},{"current":"setReadPhase('source-initial');\nconst rows=sourceInventory(entries),byPath=new Map(rows.map(r=>[r.path,r]));","previous":"const rows=sourceInventory(entries),byPath=new Map(rows.map(r=>[r.path,r]));"},{"current":"assert(st.isSymbolicLink(),'Projected link mode');charge(st.size,file);bytes=fs.readlinkSync(file,{encoding:'buffer'});assert.equal(bytes.length,st.size,'Projected link byte length');","previous":"assert(st.isSymbolicLink(),'Projected link mode');bytes=fs.readlinkSync(file,{encoding:'buffer'});charge(bytes.length);"},{"current":"const st=fs.lstatSync(file);assert(st.isSymbolicLink(),'Source link mode');charge(st.size,file);bytes=fs.readlinkSync(file,{encoding:'buffer'});assert.equal(bytes.length,st.size,'Source link byte length');","previous":"const st=fs.lstatSync(file);assert(st.isSymbolicLink(),'Source link mode');bytes=fs.readlinkSync(file,{encoding:'buffer'});charge(bytes.length);"},{"current":"charge(st.size,file);bytes=fs.readlinkSync(file,{encoding:'buffer'});assert.equal(bytes.length,st.size,'Link input byte length');link=utf8Text(bytes);","previous":"bytes=fs.readlinkSync(file,{encoding:'buffer'});charge(bytes.length);link=utf8Text(bytes);"},{"current":"charge(before.size,file);","previous":"charge(before.size);"},{"current":"const E610_READ_PHASES=Object.freeze(['event-input','source-initial','locked-inputs','dependencies-initial','node-initial','terser-provenance','metadata-writeback','projection-policy','projection-source','child-reservation','projection-output','source-final','dependencies-final','node-final','receipt-writeback']);\nconst root=fs.realpathSync(process.cwd());let readBytes=0,readPhase='event-input',readLimitReported=false;\nconst readPhaseBytes=Object.fromEntries(E610_READ_PHASES.map(name=>[name,0]));\nfunction setReadPhase(name){assert(E610_READ_PHASES.includes(name),'Closed metadata read phase');readPhase=name;}\nfunction safeReadBudgetPath(file){\n const hidden={role:'redacted-input',path:null,pathSha256:typeof file==='string'?hash(file):null};\n if(typeof file!=='string'||!path.isAbsolute(file)||path.resolve(file)!==file||!inside(root,file)||file===root)return hidden;\n const relative=path.relative(root,file).split(path.sep).join('/');\n if(!relative||relative.split('/').some(part=>!part||part==='.'||part==='..'))return hidden;\n const digest=hash(relative),secret=/(?:^|\\/)(?:\\.env[^/]*|supabase_keys\\.txt|(?:credentials?|secrets?|tokens?)(?:[._-][^/]*)?)(?:\\/|$)/i.test(relative);\n const visible=relative.length<=256&&/^[A-Za-z0-9@._/-]+$/.test(relative)&&!secret;\n return {role:'repository-input',path:visible?relative:null,pathSha256:digest};\n}\nfunction reportReadLimit(before,size,next,file,reservation){\n if(readLimitReported)return;readLimitReported=true;\n const kind=reservation?'conservative-child-reservation':'direct-input',limit=E610_LIMITS.read;\n const fallback='E610_METADATA_READ_BOUND {\"schemaVersion\":\"E610-metadata-read-limit.v1\",\"phase\":\"'+readPhase+'\",\"kind\":\"'+kind+'\",\"attemptedBytes\":'+size+',\"cumulativeBefore\":'+before+',\"wouldBeTotal\":'+next+',\"limit\":'+limit+',\"diagnosticFallback\":true}';\n let line=fallback;\n try{\n  const location=reservation?{role:'conservative-child-reservation',path:null,pathSha256:null}:safeReadBudgetPath(file);\n  const phaseBytes=Object.fromEntries(E610_READ_PHASES.map(name=>[name,readPhaseBytes[name]]));\n  const candidate='E610_METADATA_READ_BOUND '+JSON.stringify({schemaVersion:'E610-metadata-read-limit.v1',phase:readPhase,kind,...location,attemptedBytes:size,cumulativeBefore:before,wouldBeTotal:next,limit,perFileLimit:E610_LIMITS.file,phaseBytes});\n  if(Buffer.byteLength(candidate,'utf8')<=4096)line=candidate;\n }catch{}\n try{console.error(line);}catch{}\n}\nfunction charge(size,file=null,reservation=false){\n assert(!readLimitReported,'Metadata read bound');\n assert.equal(typeof reservation,'boolean','Read charge kind');\n assert(Number.isSafeInteger(size)&&size>=0&&(reservation||size<=E610_LIMITS.file),reservation?'Conservative child source-read reservation':'Per-file read bound');\n assert(Number.isSafeInteger(readBytes)&&readBytes>=0&&readBytes<=E610_LIMITS.read,'Metadata read bound');\n const before=readBytes,next=before+size;assert(Number.isSafeInteger(next),'Metadata read bound');\n if(next>E610_LIMITS.read){reportReadLimit(before,size,next,file,reservation);assert(false,reservation?'Conservative child source-read reservation':'Metadata read bound');}\n readBytes=next;readPhaseBytes[readPhase]+=size;\n}\n","previous":"const root=fs.realpathSync(process.cwd());let readBytes=0;\nfunction charge(size){assert(Number.isSafeInteger(size)&&size>=0&&size<=E610_LIMITS.file,'Per-file read bound');readBytes+=size;assert(readBytes<=E610_LIMITS.read,'Metadata read bound');}\n"}];
function normaliseProducerReadLedgerWorkflow(text){
 const adapter=projectionReadReuseAdapter(text);assert.equal(hash(adapter.source),producerLedgerSourceSha256,'Exact reviewed producer ledger source');
 let previous=adapter.source;for(const edit of producerLedgerReversions)previous=projectionReadReuseOnce(previous,edit.current,edit.previous);
 const raw=previous.slice(0,-1).split('\n').map(line=>'          '+line).join('\n')+'\n';
 const restored=projectionReadReuseOnce(text,adapter.raw,raw);assert.equal(hash(restored),producerLedgerPriorWorkflowSha256,'Only declared ledger amendments restore prior whole workflow');
 return {restored,source:adapter.source};
}
function producerReadLedgerRegressions(text){
 const selected=normaliseProducerReadLedgerWorkflow(text),mutations=[
  ['cumulative cap raised','read:2*1024*1024*1024','read:3*1024*1024*1024'],
  ['per-file cap raised','file:256*1024*1024','file:512*1024*1024'],
  ['installed cap raised','installed:40000','installed:80000'],
  ['ledger discounted','readBytes=next;readPhaseBytes[readPhase]+=size;','readBytes=size;readPhaseBytes[readPhase]+=size;'],
  ['child reservation discounted','charge(childReadReservation,null,true);','charge(0,null,true);'],
  ['regular read uncharged','charge(before.size,file);','charge(0,file);'],
  ['final dependency phase removed',"setReadPhase('dependencies-final');\n",''],
  ['final dependencies cached','JSON.stringify(dependencies())','JSON.stringify(installed)'],
  ['final source cached','assert.deepEqual(sourceInventory(entries),rows,','assert.deepEqual(rows,rows,'],
  ['final Node cached','rawIdentity(nodePath,nodePath,path.dirname(nodePath)),nodeBinary','nodeBinary,nodeBinary'],
  ['private absolute path emitted','path:visible?relative:null','path:file'],
  ['diagnostic byte cap widened', "Buffer.byteLength(candidate,'utf8')<=4096","Buffer.byteLength(candidate,'utf8')<=8192"],
  ['terminal rejection latch removed'," assert(!readLimitReported,'Metadata read bound');\n",''],
  ['original rejection removed',"assert(false,reservation?'Conservative child source-read reservation':'Metadata read bound');",''],
  ['link target allocated before charge',"charge(st.size,file);bytes=fs.readlinkSync(file,{encoding:'buffer'});assert.equal(bytes.length,st.size,'Link input byte length');","bytes=fs.readlinkSync(file,{encoding:'buffer'});charge(bytes.length,file);"]
 ];
 for(const[name,before,after]of mutations){
  const changed=projectionReadReuseOnce(selected.source,before,after),raw=changed.slice(0,-1).split('\n').map(line=>'          '+line).join('\n')+'\n';
  const broken=projectionReadReuseOnce(text,projectionReadReuseAdapter(text).raw,raw);assert.notEqual(broken,text,name);assert.throws(()=>normaliseProducerReadLedgerWorkflow(broken),undefined,name);
 }
 const vm=require('node:vm'),prefix=selected.source.slice(0,selected.source.indexOf('const eventFile='));
 assert(prefix.includes('function reportReadLimit(')&&prefix.includes('function stableBytes('),'Actual producer pre-main ledger/IO prefix');
 const names=[],pass=(name,operation)=>{operation();names.push(name);},messagePrefix='E610_METADATA_READ_BOUND ';
 function run(script,{size=32,symlink=false,formatThrows=false,loggerThrows=false,identifier=null}={}){
  const disk={data:Buffer.from('/* closed fixture */'.padEnd(32,' ')),size,link:Buffer.from('target.js'),opens:0,reads:0,links:0,closes:0,last:null,mutations:0},logs=[];
  let loggerCalls=0,childCalls=0,appImports=0;const root='/closed/repo';
  const directory={isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>false,dev:1,ino:1,size:0,mode:0o40755,mtimeMs:1,ctimeMs:1};
  const stat=file=>({isDirectory:()=>false,isFile:()=>!symlink,isSymbolicLink:()=>symlink,dev:1,ino:2,size:symlink?disk.link.length:disk.size,mode:symlink?0o120777:file.startsWith('/closed/runtime/')?0o100755:0o100644,mtimeMs:1,ctimeMs:1});
  const closedFs={
   constants:{O_RDONLY:0,O_NOFOLLOW:1},
   realpathSync:file=>file===root?root:symlink?require('node:path').resolve(require('node:path').dirname(file),'target.js'):file,
   lstatSync:file=>['/closed/repo','/closed/repo/config','/closed/repo/node_modules','/closed/runtime'].includes(file)?directory:stat(file),
   readdirSync:folder=>{assert.equal(folder,'/closed/repo/node_modules');return ['probe.js'];},
   openSync:file=>{disk.opens++;disk.last=file;return 7;},
   fstatSync:fd=>{assert.equal(fd,7);return stat(disk.last);},
   readFileSync:fd=>{assert.equal(fd,7);disk.reads++;return Buffer.from(disk.data);},
   readlinkSync:()=>{disk.links++;return Buffer.from(disk.link);},
   closeSync:fd=>{assert.equal(fd,7);disk.closes++;}
  };
  const requireClosed=name=>{
   if(name==='node:fs')return closedFs;
   if(name==='node:child_process')return {execFileSync(){childCalls++;throw Error('No child execution in closed ledger controls');}};
   if(['node:assert/strict','node:path','node:crypto','node:util'].includes(name))return require(name);
   appImports++;throw Error('No application imports in closed ledger controls');
  };
  const sandbox={require:requireClosed,Buffer,process:{cwd:()=>root},console:{error:line=>{loggerCalls++;logs.push(line);if(loggerThrows)throw Error('LOGGER_FAILURE_NOT_EMITTED');}},expectedProjection:[{row:{path:'config/a.js',sourceBytes:16}},{row:{path:'config/a.json',sourceBytes:8}}],__identifier:identifier,__mutateFixture(){disk.data=Buffer.from(disk.data);disk.data[0]^=1;disk.mutations++;}};
  if(formatThrows)sandbox.JSON={parse:JSON.parse,stringify(){throw Error('FORMAT_FAILURE_NOT_EMITTED');}};
  const result=vm.runInNewContext(prefix+'\n'+script+'\n({readBytes,readPhase,readPhaseBytes,readLimitReported});',sandbox,{timeout:1000});
  assert.equal(childCalls,0);assert.equal(appImports,0);return {disk,logs,loggerCalls,result};
 }
 function diagnostic(runResult){
  assert.equal(runResult.logs.length,1,'One diagnostic');const line=runResult.logs[0];assert.equal(typeof line,'string');assert(Buffer.byteLength(line,'utf8')<=4096,'Whole UTF8 line bound');assert(line.startsWith(messagePrefix));
  assert(!line.includes('/closed/')&&!line.includes('/private/')&&!line.includes('PRIVATE_TOKEN')&&!line.includes('LOGGER_FAILURE_NOT_EMITTED')&&!line.includes('FORMAT_FAILURE_NOT_EMITTED'),'No raw private input or diagnostic errors');
  return JSON.parse(line.slice(messagePrefix.length));
 }
 const prime="setReadPhase('dependencies-final');readBytes=E610_LIMITS.read-31;readPhaseBytes['dependencies-final']=readBytes;";
 pass('actual cumulative equality accepts only32 closed IO bytes without a diagnostic',()=>{
  const r=run("setReadPhase('source-initial');readBytes=E610_LIMITS.read-32;readPhaseBytes['source-initial']=readBytes;assert.equal(stableBytes(path.join(root,'config/probe.js')).length,32);assert.equal(readBytes,E610_LIMITS.read);");
  assert.equal(r.disk.opens,1);assert.equal(r.disk.reads,1);assert.equal(r.logs.length,0);assert.equal(r.result.readPhaseBytes['source-initial'],2*1024*1024*1024);
 });
 pass('actual cumulative +1 reports attempt/before/limit/phase components before opening',()=>{
  const r=run(prime+"assert.throws(()=>stableBytes(path.join(root,'config/probe.js')),/Metadata read bound/);assert.equal(readBytes,E610_LIMITS.read-31);");
  const d=diagnostic(r);assert.equal(r.disk.opens,0);assert.equal(r.disk.reads,0);assert.equal(d.phase,'dependencies-final');assert.equal(d.kind,'direct-input');assert.equal(d.path,'config/probe.js');assert.equal(d.attemptedBytes,32);assert.equal(d.cumulativeBefore,2*1024*1024*1024-31);assert.equal(d.wouldBeTotal,2*1024*1024*1024+1);assert.equal(d.limit,2*1024*1024*1024);assert.equal(d.phaseBytes['dependencies-final'],d.cumulativeBefore);
 });
 pass('only first exhausted-budget diagnostic; rejection remains terminal even for a later small charge',()=>{
  const r=run(prime+"assert.throws(()=>stableBytes(path.join(root,'config/probe.js')),/Metadata read bound/);assert.throws(()=>charge(1,path.join(root,'config/probe.js')),/Metadata read bound/);assert.equal(readBytes,E610_LIMITS.read-31);");
  diagnostic(r);assert.equal(r.loggerCalls,1);assert.equal(r.disk.opens,0);
 });
 pass('per-file exact numeric boundary and +1 retain original limit without a256MiB buffer',()=>{
  const r=run("setReadPhase('locked-inputs');charge(E610_LIMITS.file,path.join(root,'config/probe.js'));assert.equal(readBytes,E610_LIMITS.file);assert.throws(()=>charge(E610_LIMITS.file+1,path.join(root,'config/probe.js')),/Per-file read bound/);");
  assert.equal(r.disk.opens,0);assert.equal(r.disk.reads,0);assert.equal(r.logs.length,0);
 });
 pass('regular oversized stat refuses before file opening or buffering',()=>{
  const r=run("assert.throws(()=>stableBytes(path.join(root,'config/probe.js')),/Regular input size bound/);",{size:256*1024*1024+1});assert.equal(r.disk.opens,0);assert.equal(r.disk.reads,0);assert.equal(r.logs.length,0);
 });
 pass('aggregate child reservation may exceed per-file cap but stays under cumulative cap',()=>{
  const r=run("setReadPhase('child-reservation');charge(E610_LIMITS.file+1,null,true);assert.equal(readBytes,E610_LIMITS.file+1);assert.equal(readPhaseBytes['child-reservation'],E610_LIMITS.file+1);");
  assert.equal(r.disk.opens,0);assert.equal(r.logs.length,0);
 });
 const reserveStart=selected.source.indexOf("setReadPhase('child-reservation');"),reserveEnd=selected.source.indexOf('processOutput(process.execPath',reserveStart),reserveSource=selected.source.slice(reserveStart,reserveEnd);
 assert(reserveStart>0&&reserveEnd>reserveStart&&reserveSource.includes("2*expectedProjection.reduce")&&reserveSource.includes('charge(childReadReservation,null,true);'),'Actual conservative reservation code');
 pass('actual unchanged child-reservation formula accepts exact cumulative equality',()=>{
  const r=run("readBytes=E610_LIMITS.read-80;readPhaseBytes['projection-source']=readBytes;\n"+reserveSource+"\nassert.equal(readBytes,E610_LIMITS.read);assert.equal(childReadReservation,80);");
  assert.equal(r.disk.opens,0);assert.equal(r.logs.length,0);
 });
 pass('actual child reservation +1 emits separate conservative kind before materializer or IO',()=>{
  const r=run("readBytes=E610_LIMITS.read-79;readPhaseBytes['projection-source']=readBytes;assert.throws(()=>{\n"+reserveSource+"\n},/Conservative child source-read reservation/);");
  const d=diagnostic(r);assert.equal(d.kind,'conservative-child-reservation');assert.equal(d.phase,'child-reservation');assert.equal(d.attemptedBytes,80);assert.equal(d.path,null);assert.equal(d.cumulativeBefore,2*1024*1024*1024-79);assert.equal(r.disk.opens,0);
 });
 pass('closed phase changes never reset or discount accepted direct and reserved totals',()=>{
  const r=run("setReadPhase('source-initial');charge(8,path.join(root,'config/probe.js'));setReadPhase('locked-inputs');charge(4,path.join(root,'config/probe.js'));setReadPhase('dependencies-initial');charge(16,path.join(root,'node_modules/probe.js'));setReadPhase('child-reservation');charge(32,null,true);setReadPhase('source-final');charge(8,path.join(root,'config/probe.js'));assert.equal(readBytes,68);assert.equal(Object.values(readPhaseBytes).reduce((a,b)=>a+b,0),68);assert.throws(()=>setReadPhase('PRIVATE_TOKEN_NOT_A_PHASE'),/Closed metadata read phase/);");
  assert.equal(r.disk.opens,0);assert.equal(r.logs.length,0);
 });
 pass('adversarial private/long/control/escape/Unicode identifiers never escape bounded diagnostics',()=>{
  const identifiers=['/private/users/PRIVATE_TOKEN/file','/closed/repo/../PRIVATE_TOKEN/file','/closed/repo/.env.PRIVATE_TOKEN','/closed/repo/config/name\nPRIVATE_TOKEN','/closed/repo/config/'+ 'X'.repeat(5000),'/closed/repo/config/'+ '😀'.repeat(2000),null,{toString(){throw Error('PRIVATE_TOKEN');}}];
  for(const identifier of identifiers){
   const r=run("setReadPhase('dependencies-final');readBytes=E610_LIMITS.read;readPhaseBytes['dependencies-final']=readBytes;assert.throws(()=>charge(1,__identifier),/Metadata read bound/);",{identifier});
   const d=diagnostic(r);assert.equal(d.path,null);assert(d.pathSha256===null||/^[0-9a-f]{64}$/.test(d.pathSha256));assert.equal(r.disk.opens,0);assert.equal(r.disk.reads,0);assert.equal(r.disk.links,0);
  }
 });
 pass('JSON diagnostic formatting failure falls back safely without skipping rejection',()=>{
  const r=run(prime+"assert.throws(()=>stableBytes(path.join(root,'config/probe.js')),/Metadata read bound/);",{formatThrows:true});
  const d=diagnostic(r);assert.equal(d.diagnosticFallback,true);assert.equal(d.attemptedBytes,32);assert.equal(r.disk.opens,0);
 });
 pass('logger failure cannot replace or suppress the original terminal guard',()=>{
  const r=run(prime+"assert.throws(()=>stableBytes(path.join(root,'config/probe.js')),/Metadata read bound/);assert.throws(()=>charge(1,null),/Metadata read bound/);",{loggerThrows:true});
  diagnostic(r);assert.equal(r.loggerCalls,1);assert.equal(r.disk.opens,0);
 });
 pass('dependency symlink budget rejection occurs before target-buffer allocation',()=>{
  const r=run("setReadPhase('dependencies-final');readBytes=E610_LIMITS.read-8;readPhaseBytes['dependencies-final']=readBytes;assert.throws(()=>rawIdentity(path.join(root,'node_modules/probe.js'),'node_modules/probe.js',path.join(root,'node_modules')),/Metadata read bound/);",{symlink:true});
  diagnostic(r);assert.equal(r.disk.links,0);assert.equal(r.disk.opens,0);
 });
 pass('source symlink budget rejection occurs before target-buffer allocation',()=>{
  const r=run("setReadPhase('source-final');readBytes=E610_LIMITS.read-8;readPhaseBytes['source-final']=readBytes;assert.throws(()=>sourceBytes({path:'config/probe.js',mode:'120000',gitBlob:'0'.repeat(40)}),/Metadata read bound/);",{symlink:true});
  diagnostic(r);assert.equal(r.disk.links,0);assert.equal(r.disk.opens,0);
 });
 pass('actual source inventory still independently rejects changed bytes after projection reuse',()=>{
  const r=run("setReadPhase('source-initial');const file=path.join(root,'config/probe.js'),original=stableBytes(file),entry={path:'config/probe.js',mode:'100644',gitBlob:crypto.createHash('sha1').update('blob '+original.length+'\\0').update(original).digest('hex')};setReadPhase('projection-source');projection([entry],sourceBytes,{schemaVersion:'deployment-manifest.v1',includeDirectories:[],includeFiles:['config/probe.js'],rootExtensions:[],excludeDirectories:[],excludeFiles:[],preserveBytes:[],compactJson:true,acceptedBytes:0});__mutateFixture();setReadPhase('source-final');assert.throws(()=>sourceInventory([entry]),/Working bytes versus actual raw Git blob/);");
  assert.equal(r.disk.opens,3);assert.equal(r.logs.length,0);
 });
 pass('final dependency identity is still freshly read after initial inventory',()=>{
  const r=run("setReadPhase('dependencies-initial');const initial=hash(Buffer.from(JSON.stringify(dependencies())));__mutateFixture();setReadPhase('dependencies-final');assert.notEqual(hash(Buffer.from(JSON.stringify(dependencies()))),initial);");
  assert.equal(r.disk.opens,2);assert.equal(r.disk.reads,2);assert.equal(r.logs.length,0);
 });
 pass('final Node identity is still freshly read after initial identity',()=>{
  const r=run("setReadPhase('node-initial');const file='/closed/runtime/node',initial=rawIdentity(file,file,'/closed/runtime');__mutateFixture();setReadPhase('node-final');assert.notEqual(rawIdentity(file,file,'/closed/runtime').sha256,initial.sha256);");
  assert.equal(r.disk.opens,2);assert.equal(r.disk.reads,2);assert.equal(r.logs.length,0);
 });
 return {restored:selected.restored,report:{scope:'Actual V2 producer pre-main IO and ledger with closed fs/child/imports; synthetic counters/small buffers, no real2GiB probe or real dependency inventory.',workflowMutationGroups:mutations.length,workflowMutationNames:mutations.map(([name])=>name),boundaryGroups:names.length,boundaryNames:names,diagnosticUtf8Limit:4096,cumulativeLimit:2*1024*1024*1024,perFileLimit:256*1024*1024,closedIoFixtureBytes:32,actualSourceDependencyByteTotalsEstablished:false,appImports:0,childRuns:0,releaseAcceptance:false}};
}


 // Full initial inventory and deployment projection share one actual source read, never a final proof cache.
const singlePassPriorWorkflowSha256='f299a2b717bf9e1dda9ed1c0dbb060b161584b077e9aa4f71aec38211d766383';
const singlePassProducerSha256="cfa071d2bdfff584fdc620607a632d0d6ef0c9af49391352f3949e25a27f17ce";
const singlePassReversions=[{"current":"setReadPhase('projection-source');\n// Expected bytes were prepared during the complete initial source proof; no second parent source pass.","previous":"setReadPhase('projection-policy');\nconst policy=JSON.parse(utf8Text(sourceBytes(byPath.get('config/deployment-manifest.json'))));\nsetReadPhase('projection-source');\nconst expectedProjection=projection(entries,sourceBytes,policy);"},{"current":"setReadPhase('projection-policy');\nconst policyEntry=entries.find(entry=>entry.path==='config/deployment-manifest.json');\nassert(policyEntry&&policyEntry.mode==='100644','Reviewed regular deployment policy');\nconst policyBytes=sourceBytes(policyEntry);\nassert.equal(hash(policyBytes),'78f7a1c46accaf56fb83ec1f4d8f5ecf98621a620807658c805870191297b103','Reviewed deployment policy before initial projection');\nconst policy=JSON.parse(utf8Text(policyBytes));\nsetReadPhase('source-initial');\nconst initialSource=sourceInventoryWithProjection(entries,sourceBytes,policy);\nconst rows=initialSource.rows,expectedProjection=initialSource.projected,byPath=new Map(rows.map(r=>[r.path,r]));","previous":"setReadPhase('source-initial');\nconst rows=sourceInventory(entries),byPath=new Map(rows.map(r=>[r.path,r]));"},{"current":"function sourceInventoryWithProjection(entries,readSource,policy){\n assert(Array.isArray(entries)&&entries.length>0&&entries.length<=E610_LIMITS.source,'Initial full source count bound');\n const byName=new Map(entries.map(entry=>[entry.path,entry])),observed=new Map();\n assert.equal(byName.size,entries.length,'Initial full source paths must be unique');\n const readInitial=entry=>{\n  assert(entry&&byName.get(entry.path)===entry,'Initial read must use exact tracked entry');\n  assert(!observed.has(entry.path),'Initial source file must be physically read once');\n  const bytes=readSource(entry);\n  assert(Buffer.isBuffer(bytes)&&bytes.length<=E610_LIMITS.file,'Verified initial raw bytes required');\n  observed.set(entry.path,{...entry,bytes:bytes.length,sha256:hash(bytes)});\n  return bytes;\n };\n // Projection consumes actual Git-verified initial bytes; keep row metadata, not a second raw-source cache.\n const projected=projection(entries,readInitial,policy);\n // Unselected files remain mandatory members of the complete initial source proof.\n for(const entry of entries)if(!observed.has(entry.path))readInitial(entry);\n assert.equal(observed.size,entries.length,'Complete initial source coverage');\n return {rows:entries.map(entry=>observed.get(entry.path)),projected};\n}\nfunction projection(entries,readSource,policy){","previous":"function projection(entries,readSource,policy){"}];

function normaliseSinglePassSourceWorkflow(text){
 const selected=projectionReadReuseAdapter(text);
 assert.equal(hash(selected.source),singlePassProducerSha256,'Exact reviewed single-pass producer');
 let restoredSource=selected.source;
 for(const edit of singlePassReversions)restoredSource=projectionReadReuseOnce(restoredSource,edit.current,edit.previous);
 const raw=restoredSource.slice(0,-1).split('\n').map(line=>'          '+line).join('\n')+'\n';
 const restored=projectionReadReuseOnce(text,selected.raw,raw);
 assert.equal(hash(restored),singlePassPriorWorkflowSha256,'Only declared single-pass edits restore entire V2 workflow');
 return {source:selected.source,priorSource:restoredSource,restored};
}
function singlePassSourceRegressions(text){
 const selected=normaliseSinglePassSourceWorkflow(text),mutations=[
  ['unselected source omitted',"for(const entry of entries)if(!observed.has(entry.path))readInitial(entry);","for(const entry of [])readInitial(entry);"],
  ['initial physical read skipped',"const bytes=readSource(entry);","const bytes=Buffer.alloc(0);"],
  ['initial row hash fabricated',"observed.set(entry.path,{...entry,bytes:bytes.length,sha256:hash(bytes)});","observed.set(entry.path,{...entry,bytes:bytes.length,sha256:'0'.repeat(64)});"],
  ['initial duplicate-read guard removed',"assert(!observed.has(entry.path),'Initial source file must be physically read once');",""],
  ['initial count cap raised',"entries.length<=E610_LIMITS.source,'Initial full source count bound'","entries.length<=E610_LIMITS.source*2,'Initial full source count bound'"],
  ['early policy digest unchecked',"assert.equal(hash(policyBytes),'78f7a1c46accaf56fb83ec1f4d8f5ecf98621a620807658c805870191297b103','Reviewed deployment policy before initial projection');",""],
  ['independent final source replaced by initial rows',"assert.deepEqual(sourceInventory(entries),rows,","assert.deepEqual(rows,rows,"],
  ['independent final dependencies cached',"JSON.stringify(dependencies())","JSON.stringify(installed)"],
  ['independent final Node cached',"rawIdentity(nodePath,nodePath,path.dirname(nodePath)),nodeBinary","nodeBinary,nodeBinary"],
  ['complete child reservation discounted',"2*expectedProjection.reduce","expectedProjection.reduce"],
  ['child reservation not charged',"charge(childReadReservation,null,true);","charge(0,null,true);"],
  ['direct regular read not charged',"charge(before.size,file);","charge(0,file);"],
  ['exact projected bytes comparison bypassed',"assert(bytes.equals(item.bytes),'Exact projected output bytes');","assert(true,'Exact projected output bytes');"],
  ['cumulative limit raised',"read:2*1024*1024*1024","read:3*1024*1024*1024"],
  ['per-file limit raised',"file:256*1024*1024","file:512*1024*1024"],
  ['installed file count raised',"installed:40000","installed:80000"],
  ['materializer time raised',"materializerMs:20000","materializerMs:40000"]
 ];
 for(const[name,before,after]of mutations){
  const changed=projectionReadReuseOnce(selected.source,before,after),raw=changed.slice(0,-1).split('\n').map(line=>'          '+line).join('\n')+'\n';
  const broken=projectionReadReuseOnce(text,projectionReadReuseAdapter(text).raw,raw);
  assert.notEqual(broken,text,name);assert.throws(()=>normaliseSinglePassSourceWorkflow(broken),undefined,name);
 }
 const vm=require('node:vm'),nodePath=require('node:path'),names=[],pass=(name,fn)=>{fn();names.push(name);};
 const policy={schemaVersion:'deployment-manifest.v1',includeDirectories:[],includeFiles:['api/main.js','static/kept.txt','static/link.txt','app-version.json'],rootExtensions:[],excludeDirectories:[],excludeFiles:[],preserveBytes:['app-version.json'],compactJson:true,acceptedBytes:0};
 const fixture=()=>new Map([
  ['api/main.js',{bytes:Buffer.from("require('../lib/dep');\nrequire('../lib/data.json');\n"),mode:'100644'}],
  ['lib/dep.js',{bytes:Buffer.from("require('../api/main');\n"),mode:'100644'}],
  ['lib/data.json',{bytes:Buffer.from(' { "answer": 1 } \n'),mode:'100644'}],
  ['static/kept.txt',{bytes:Buffer.from('untouched\n'),mode:'100644'}],
  ['static/link.txt',{bytes:Buffer.from('kept.txt'),mode:'120000'}],
  ['app-version.json',{bytes:Buffer.from('{\n  "version": "610"\n}\n'),mode:'100644'}],
  ['lib/unrelated.js',{bytes:Buffer.from('unselected fixture only\n'),mode:'100644'}],
  ['private/opaque.bin',{bytes:Buffer.from([255,0,254]),mode:'100644'}],
  ['private/not-deployed.json',{bytes:Buffer.from('{'),mode:'100644'}]
 ]);
 function closed(source,{files=fixture(),oversized=null}={}){
  const root='/closed/repo',directories=new Set([root]),handles=new Map(),counts=new Map(),logs=[];
  let opens=0,reads=0,links=0,children=0,appImports=0,nextHandle=10;
  for(const name of files.keys())for(let folder=nodePath.dirname(nodePath.join(root,name));folder!==root;folder=nodePath.dirname(folder))directories.add(folder);
  const relative=file=>nodePath.relative(root,file).split(nodePath.sep).join('/');
  const find=file=>{assert(file.startsWith(root+'/'),'Closed fixture path');const record=files.get(relative(file));assert(record,'Only declared fixture inputs');return record;};
  const stat=file=>{
   if(directories.has(file))return {isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>false,dev:1,ino:1,size:0,mode:0o40755,mtimeMs:1,ctimeMs:1};
   const record=find(file),link=record.mode==='120000';
   return {isDirectory:()=>false,isFile:()=>!link,isSymbolicLink:()=>link,dev:1,ino:2,size:relative(file)===oversized?256*1024*1024+1:record.bytes.length,mode:link?0o120777:record.mode==='100755'?0o100755:0o100644,mtimeMs:1,ctimeMs:1};
  };
  const hit=file=>counts.set(relative(file),(counts.get(relative(file))||0)+1);
  const fsClosed={
   constants:{O_RDONLY:0,O_NOFOLLOW:1},
   realpathSync:file=>file===root?root:find(file).mode==='120000'?nodePath.resolve(nodePath.dirname(file),find(file).bytes.toString('utf8')):file,
   lstatSync:stat,
   openSync:file=>{find(file);const handle=nextHandle++;handles.set(handle,file);opens++;return handle;},
   fstatSync:handle=>{assert(handles.has(handle));return stat(handles.get(handle));},
   readFileSync:handle=>{assert(handles.has(handle));const file=handles.get(handle);hit(file);reads++;return Buffer.from(find(file).bytes);},
   readlinkSync:file=>{hit(file);links++;return Buffer.from(find(file).bytes);},
   closeSync:handle=>{assert(handles.delete(handle));}
  };
  const requireClosed=name=>{
   if(name==='node:fs')return fsClosed;
   if(name==='node:child_process')return {execFileSync(){children++;throw Error('No child execution in single-pass source controls');}};
   if(['node:assert/strict','node:path','node:crypto','node:util'].includes(name))return require(name);
   appImports++;throw Error('No application imports in single-pass source controls');
  };
  const beforeMain=source.slice(0,source.indexOf('const eventFile='));
  const reservationStart=source.indexOf("setReadPhase('child-reservation');"),reservationEnd=source.indexOf('processOutput(process.execPath',reservationStart),reservationSource=source.slice(reservationStart,reservationEnd);
  assert(reservationStart>0&&reservationEnd>reservationStart);
  const api=vm.runInNewContext(beforeMain+'\n({sourceInventoryWithProjection:typeof sourceInventoryWithProjection==="function"?sourceInventoryWithProjection:null,projection,sourceInventory,sourceBytes,setReadPhase,charge,E610_LIMITS,reserveProjection(expectedProjection){'+reservationSource+'return childReadReservation;},primeRemaining(value){readBytes=E610_LIMITS.read-value;readPhaseBytes[readPhase]=readBytes;},ledger(){return {bytes:readBytes,phases:{...readPhaseBytes},rejected:readLimitReported};}});',{require:requireClosed,Buffer,process:{cwd:()=>root},console:{error:line=>logs.push(line)}},{timeout:1000});
  const entries=Array.from(files,([path,record])=>({path,mode:record.mode,type:'blob',gitBlob:crypto.createHash('sha1').update('blob '+record.bytes.length+'\0').update(record.bytes).digest('hex')}));
  const result={api,entries,files,counts,logs,io:()=>({opens,reads,links,children,appImports,openHandles:handles.size}),mutate(name){const record=files.get(name);record.bytes=Buffer.from(record.bytes);record.bytes[0]^=1;}};
  return result;
 }
 const canonical=value=>JSON.stringify(value),projected=value=>JSON.stringify(value.map(item=>({row:item.row,mode:item.mode,bytes:item.bytes.toString('base64')})));
 function initial(run,entries=run.entries,sourcePolicy=policy){run.api.setReadPhase('source-initial');return run.api.sourceInventoryWithProjection(entries,run.api.sourceBytes,sourcePolicy);}
 function quiet(run){assert.equal(run.io().children,0);assert.equal(run.io().appImports,0);assert.equal(run.io().openHandles,0);}
 pass('actual new IO reads every tracked source exactly once for complete initial inventory and projection',()=>{
  const run=closed(selected.source),result=initial(run);
  assert.equal(result.rows.length,run.entries.length);for(const entry of run.entries)assert.equal(run.counts.get(entry.path),1,entry.path);
  assert.equal(run.api.ledger().bytes,Array.from(run.files.values()).reduce((n,file)=>n+file.bytes.length,0));
  assert.equal(result.rows.map(row=>row.path).join('\n'),run.entries.map(entry=>entry.path).join('\n'));quiet(run);
 });
 pass('initial rows and projection match actual prior producer including closure, modes, raw hashes and exact bytes',()=>{
  const old=closed(selected.priorSource),run=closed(selected.source);
  old.api.setReadPhase('source-initial');const rows=old.api.sourceInventory(old.entries);
  old.api.setReadPhase('projection-source');const projection=old.api.projection(old.entries,old.api.sourceBytes,policy),result=initial(run);
  assert.equal(canonical(result.rows),canonical(rows));assert.equal(projected(result.projected),projected(projection));
  const selectedRaw=result.projected.reduce((n,item)=>n+item.row.sourceBytes,0);
  assert.equal(old.api.ledger().bytes-run.api.ledger().bytes,selectedRaw);quiet(old);quiet(run);
 });
 pass('private binary and unselected malformed JSON are fully hashed but never parsed or projected',()=>{
  const run=closed(selected.source),result=initial(run),names=new Set(result.projected.map(item=>item.row.path));
  for(const name of ['private/opaque.bin','private/not-deployed.json']){
   const row=result.rows.find(item=>item.path===name);assert(row);assert.equal(row.sha256,hash(run.files.get(name).bytes));assert(!names.has(name));assert.equal(run.counts.get(name),1);
  }quiet(run);
 });
 pass('compact JSON binds original raw length and digest while preserveBytes and link targets stay exact',()=>{
  const run=closed(selected.source),result=initial(run),json=result.projected.find(item=>item.row.path==='lib/data.json');
  assert.equal(json.bytes.toString(),'{"answer":1}\n');assert.equal(json.row.sourceBytes,run.files.get('lib/data.json').bytes.length);
  assert.equal(result.rows.find(row=>row.path==='lib/data.json').sha256,hash(run.files.get('lib/data.json').bytes));
  for(const name of ['app-version.json','static/kept.txt','static/link.txt'])assert(result.projected.find(item=>item.row.path===name).bytes.equals(run.files.get(name).bytes));
  quiet(run);
 });
 pass('independent final source pass rereads every regular source and symlink after initial reuse',()=>{
  const run=closed(selected.source),result=initial(run);run.api.setReadPhase('source-final');
  assert.equal(canonical(run.api.sourceInventory(run.entries)),canonical(result.rows));
  for(const entry of run.entries)assert.equal(run.counts.get(entry.path),2,entry.path);
  assert.equal(run.api.ledger().phases['source-final'],run.api.ledger().phases['source-initial']);quiet(run);
 });
 pass('changed selected source cannot pass final proof using initial projection bytes',()=>{
  const run=closed(selected.source);initial(run);run.mutate('api/main.js');run.api.setReadPhase('source-final');
  assert.throws(()=>run.api.sourceInventory(run.entries),/Working bytes versus actual raw Git blob/);quiet(run);
 });
 pass('changed unselected source cannot pass independent final proof',()=>{
  const run=closed(selected.source);initial(run);run.mutate('private/opaque.bin');run.api.setReadPhase('source-final');
  assert.throws(()=>run.api.sourceInventory(run.entries),/Working bytes versus actual raw Git blob/);quiet(run);
 });
 pass('invalid unselected raw source aborts the initial whole inventory rather than admitting a good projection',()=>{
  const run=closed(selected.source);run.mutate('private/opaque.bin');
  assert.throws(()=>initial(run),/Working bytes versus actual raw Git blob/);assert.equal(run.counts.get('api/main.js'),1);quiet(run);
 });
 pass('malformed selected JSON stops only with a real source assertion, not fabricated projection output',()=>{
  const files=fixture();files.set('lib/data.json',{bytes:Buffer.from('{'),mode:'100644'});const run=closed(selected.source,{files});
  assert.throws(()=>initial(run),error=>error&&error.name==='SyntaxError');quiet(run);
 });
 pass('source executable-mode drift remains rejected by actual no-follow source reader',()=>{
  const run=closed(selected.source);run.files.get('api/main.js').mode='100755';
  assert.throws(()=>initial(run),/Source executable mode/);assert.equal(run.io().opens,0);quiet(run);
 });
 pass('source symlink confinement remains enforced before projection acceptance',()=>{
  const files=fixture();files.set('static/link.txt',{bytes:Buffer.from('../../../outside'),mode:'120000'});const run=closed(selected.source,{files});
  assert.throws(()=>initial(run),/Escaping link target/);quiet(run);
 });
 pass('duplicate paths and source count overflow are rejected before content IO',()=>{
  const run=closed(selected.source);
  assert.throws(()=>initial(run,[...run.entries,run.entries[0]]),/Initial full source paths must be unique/);
  assert.throws(()=>initial(run,Array(10001).fill(run.entries[0])),/Initial full source count bound/);
  assert.equal(run.io().opens,0);assert.equal(run.io().links,0);quiet(run);
 });
 pass('oversized source stat fails before opening or buffering without allocating a256MiB test file',()=>{
  const run=closed(selected.source,{oversized:'api/main.js'});
  assert.throws(()=>initial(run),/Regular input size bound/);assert.equal(run.io().opens,0);quiet(run);
 });
 pass('exhausted cumulative budget still rejects first source before opening or buffering',()=>{
  const run=closed(selected.source);run.api.setReadPhase('source-initial');run.api.primeRemaining(0);
  assert.throws(()=>initial(run),/Metadata read bound/);assert.equal(run.io().opens,0);assert.equal(run.logs.length,1);assert(Buffer.byteLength(run.logs[0])<=4096);quiet(run);
 });
 pass('unchanged actual child reservation remains twice all selected bytes plus JavaScript bytes',()=>{
  const run=closed(selected.source),result=initial(run),before=run.api.ledger().bytes;
  const P=result.projected.reduce((n,item)=>n+item.row.sourceBytes,0),J=result.projected.filter(item=>item.row.path.endsWith('.js')).reduce((n,item)=>n+item.row.sourceBytes,0);
  assert.equal(run.api.reserveProjection(result.projected),2*(P+J));assert.equal(run.api.ledger().bytes,before+2*(P+J));quiet(run);
 });
 pass('same guard code and fresh-final call sites survive source-only reordering unchanged',()=>{
  for(const marker of ['function sourceInventory(entries){','function dependencies(){','function rawIdentity(','function sourceBytes(','function stableBytes(','function charge(']){
   const slice=source=>{const start=source.indexOf(marker),end=source.indexOf('\nfunction ',start+1);assert(start>=0&&end>start);return source.slice(start,end);};
   assert.equal(slice(selected.source),slice(selected.priorSource),marker);
  }
  for(const call of ["assert.deepEqual(sourceInventory(entries),rows,'Tracked source changed during metadata preparation');","assert.equal(hash(Buffer.from(JSON.stringify(dependencies()))),proof.fileMapSha256,'Installed dependencies changed during metadata preparation');","assert.deepEqual(rawIdentity(nodePath,nodePath,path.dirname(nodePath)),nodeBinary,'Node binary changed');","assert(bytes.equals(item.bytes),'Exact projected output bytes');"]){
   assert(selected.source.includes(call));assert(selected.priorSource.includes(call));
  }
  assert(selected.source.indexOf('const initialSource=sourceInventoryWithProjection(')<selected.source.indexOf("setReadPhase('locked-inputs');"));
  assert(selected.source.indexOf("assert.equal(hash(assembled),binding.expectedAssembledManifestSha256")<selected.source.indexOf('processOutput(process.execPath'));
  assert(selected.source.indexOf("assert.equal(hash(policyBytes),'78f7")<selected.source.indexOf('const initialSource=sourceInventoryWithProjection('));
 });
 pass('complete conditional byte model includes final dependencies, final Node, unchanged child reservation and bounded receipt',()=>{
  const S=296621402,D=226928231,N=126595440,P=248663318,J=31694530,R=560715696,Q=233991887,X=3500608,limit=2*1024*1024*1024,receipt=16384;
  assert.equal(R,2*(P+J));assert.equal(2*S+2*D+2*N+P+R+Q+X,2347161655);
  const singlePass=2*S+2*D+2*N+R+Q+X;
  assert.equal(singlePass,2098498337);assert.equal(limit-singlePass-receipt,48968927);
  // Conservative delta scenario only: not proof of actual process RSS/time, installation or a future run.
  assert(singlePass+receipt+8*1024*1024+4*1024*1024+128*1024<limit);
 });
 return {restored:selected.restored,report:{scope:'Actual single-pass producer source in a closed filesystem VM; tiny fixture buffers and numeric budget model only.',workflowMutationGroups:mutations.length,workflowMutationNames:mutations.map(([name])=>name),boundaryGroups:names.length,boundaryNames:names,cumulativeLimit:2*1024*1024*1024,perFileLimit:256*1024*1024,sourceCountLimit:10000,installedCountLimit:40000,rawSourceCacheAdded:false,finalProofCache:false,childReservationUnchanged:true,actualRssOrTimeEstablished:false,appImports:0,childRuns:0,releaseAcceptance:false}};
}

function forwardConsumerAdmissionRegressions(qualifierSource,fixtureBytes,policyBytes,reservationBytes){
 const nodePath=require('node:path'),sandboxVm=require('node:vm');
 assert.equal(hash(reservationBytes),'40f49544cb207c3c1bf7c1da3cfd1c6c1e527ddb36003ee6067b0fb837a378ed','Real immutable historical reservation witness, never a mocked digest');
 const boundary="const inputRow=sourceLeaves.get('scripts/fixtures/sync-current-forward-20261107.json');";
 assert.equal(qualifierSource.split(boundary).length-1,1,'Exact post-admit/pre-fixture boundary');
 const prefix=qualifierSource.slice(0,qualifierSource.indexOf(boundary));
 assert(prefix.includes('try{fullAdmission=admit();}catch(error){'),'Actual admission dispatcher retained');
 const sentinel='NS_FORWARD_ACTUAL_ADMISSION_SENTINEL';
 const program=new sandboxVm.Script(prefix+'\nthrow new Error('+JSON.stringify(sentinel)+');',{filename:'actual-selected-qualifier-admission.cjs'});
 const ROOT='/virtual/repo',TEMP='/virtual/runner',ADMISSION=TEMP+'/ns-forward-612-admission',NODE='/virtual/node',H='1'.repeat(40),T='2'.repeat(40),BASE='4bff7ada7d03c3bff52a262f58e630fe47848a74',TREE='4'.repeat(40),MAP='b'.repeat(64),NOW=Date.parse('2026-11-07T00:00:00.000Z');
 const oid=bytes=>crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 const json=object=>Buffer.from(JSON.stringify(object,null,2)+'\n');
 function fixture(){
  const files=new Map();let inode=1;
  const state={files,readCounts:new Map(),openCounts:new Map(),gitCalls:[],appImports:0,matrixArms:0,logs:[],budgetPrime:false,primed:false,context:null,drift:null,resolveTerser:ROOT+'/node_modules/terser/dist/bundle.min.js'};
  function directory(dir){if(files.has(dir))return;const parent=nodePath.dirname(dir);if(parent!==dir)directory(parent);files.set(dir,{kind:'dir',mode:0o40700,uid:1000,gid:1000,ino:inode++,bytes:Buffer.alloc(0)});}
  function file(name,bytes,mode=0o100644){directory(nodePath.dirname(name));const old=files.get(name);files.set(name,{kind:'file',mode,uid:1000,gid:1000,ino:old?.ino||inode++,bytes:Buffer.from(bytes)});}
  function link(name,target){directory(nodePath.dirname(name));files.set(name,{kind:'link',mode:0o120777,uid:1000,gid:1000,ino:inode++,bytes:Buffer.from(target)});}
  const source=new Map([
   ['scripts/validate-sync-current-forward.js',Buffer.from(qualifierSource)],
   ['scripts/fixtures/sync-current-forward-20261107.json',Buffer.from(fixtureBytes)],
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
  const binding={schemaVersion:'sync-current-forward-binding.v1',phase:'qualification',repository:'hartican/sportscal',publisherHeadSha:H,expectedPublisherTreeSha:TREE,reviewedFinalMapSha256:MAP,expectedAssembledManifestSha256:null,expectedAssembledEntryCount:sourceRows.length,expectedBaseRelativePathCount:1,qualifierSha256:hash(Buffer.from(qualifierSource)),fixtureSha256:hash(fixtureBytes),namedAllocationId:'SYNTHETIC_CONTROL_ONLY_NOT_ACTUAL_AUTHORITY',reservationReceiptSha256:hash(reservationBytes),freshMainAndReservationBindingSha256:null,reservationReceiptBase64:reservationBytes.toString('base64'),freshMainAndReservationBindingBase64:null};
  const fresh={schemaVersion:'publisher-fresh-main-reservation-binding.v1',publisherThreadId:'01a0d5ba-943d-74e0-af7f-dab4fb2bdda4',repository:'hartican/sportscal',candidateHeadSha:H,candidateTreeSha:TREE,reviewedFinalMapSha256:MAP,expectedAssembledManifestSha256:null,observedMainSha:BASE,mainObservedAt:new Date(NOW).toISOString(),mainRefEvidenceSha256:'c'.repeat(64),reservationId:reservation.id,reservationVersion:'612',reservationReceiptSha256:hash(reservationBytes),reservationConflictCheckedAt:new Date(NOW).toISOString(),knownConflictingReservation:false,globalReservationAvailability:'UNKNOWN; no global availability claim',namedAllocationId:binding.namedAllocationId,validUntil:new Date(NOW+60000).toISOString(),currentActionAuthority:'SYNTHETIC_CONTROL_ONLY_NO_REAL_ALLOCATION'};
  const body={schemaVersion:'ns-release-handover.forward.v1',scope:'Synthetic source-admission controls only',commit:H,testsAndResults:'No real application or release proof',dependencies:'None',databaseAndConfigChanges:'None',knownRisks:'Synthetic only',rollback:'Do not publish controls',sourceQualificationBinding:binding};
  const event={action:'ready_for_review',number:1,repository:{full_name:'hartican/sportscal'},pull_request:{number:1,draft:false,head:{sha:H,repo:{full_name:'hartican/sportscal'}},base:{sha:BASE},body:null}};
  const runtime={node:'v24.21.0',platform:'linux',arch:'x64',npm:'11.19.0',nodeBinary:identity(NODE,NODE),dependencyProof:null};
  function descriptor(name,bytes){file(name,bytes,0o100600);return {path:name,bytes:bytes.length,sha256:hash(bytes)};}
  const reservationFile=descriptor(ADMISSION+'/reservation-receipt.json',reservationBytes);
  const receipt={schemaVersion:'sync-current-forward-execution-receipt.v1',publisherHeadSha:H,publisherTreeSha:TREE,releaseGitSha:H,actualTestedMergeSha:T,actualAssembledSourceManifestPath:ADMISSION+'/assembled-source-manifest.json',actualAssembledSourceManifestSha256:null,actualDeploymentSourceManifestPath:ADMISSION+'/deployment-snapshot/deployment-files.json',actualDeploymentSourceManifestSha256:null,actualNodeBinarySha256:runtime.nodeBinary.sha256,actualDependencyProofSha256:null,freshMainAndReservationBindingSha256:null,namedAllocationId:binding.namedAllocationId,actualCloudRunId:'1',actualCloudRunAttempt:1,actualCloudJobId:'github-job-key:fixture-activation',actualCloudJobKey:'fixture-activation',actualCloudNumericJobId:null,actualWorkflowPath:'.github/workflows/installed-upgrade-tests.yml',admissionGranted:true,headRole:'pull_request.head.sha',testedCommitRole:'pull_request-merge-checkout',releaseRole:'source-qualification-candidate',jobIdKind:'github-job-key',observedAt:new Date(NOW).toISOString(),eventBodySha256:null,approvedFinalMap:{reviewedMapSha256:MAP,expectedTree:TREE,entryCount:sourceRows.length,baseRelativePathCount:1,assembledManifestSha256:null},cloudContext:{repository:'hartican/sportscal',eventName:'pull_request',pullRequestNumber:'1',ref:'refs/pull/1/merge',runId:'1',runAttempt:1,jobKey:'fixture-activation'},qualifier:{path:sourceRows.find(x=>x.path==='scripts/validate-sync-current-forward.js').path,bytes:Buffer.byteLength(qualifierSource),sha256:binding.qualifierSha256,gitBlob:oid(Buffer.from(qualifierSource)),mode:'100644'},fixture:{path:'scripts/fixtures/sync-current-forward-20261107.json',bytes:fixtureBytes.length,sha256:binding.fixtureSha256,gitBlob:oid(fixtureBytes),mode:'100644'},git:{headSha:H,headTree:TREE,testedMergeSha:T,testedTree:TREE,baseSha:BASE,testedMergeParents:[BASE,H],trackedSourceUnchanged:true},runtime,reservation:{id:reservation.id,version:'612',receipt:reservationFile},freshMainAndReservationBinding:{receipt:null}};
  const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_JOB:'fixture-activation',RUNNER_TEMP:TEMP,GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/pull/1/merge',GITHUB_SHA:T,GITHUB_EVENT_PATH:TEMP+'/event.json'};
  const execution=ADMISSION+'/execution-receipt.json';
  let argv=['node',ROOT+'/scripts/validate-sync-current-forward.js','--full','--execution-receipt',execution,'--execution-receipt-sha256',null];
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


function forwardConsumerControlsForContext(){
 const {boundedRegularRead}=require('./lib/forward-onboarding-ci'),readLedger={used:0,limit:2*1024*1024*1024};
 const skipped=reason=>({status:'SKIPPED_NOT_ELIGIBLE_CONTEXT',groups:null,positive:null,negative:null,reason,requiredSourceAdmissionGateClosed:false,releaseAcceptance:false});
 if(process.env.GITHUB_EVENT_NAME!=='pull_request'||process.env.GITHUB_JOB!=='fixture-activation')return skipped('Actual-reader controls require existing fixture-activation PR Ready context; original context-independent contracts still run.');
 assert.equal(process.env.GITHUB_ACTIONS,'true','Actual required source context');
 const eventPath=process.env.GITHUB_EVENT_PATH;assert(typeof eventPath==='string'&&require('node:path').isAbsolute(eventPath),'Existing event input required');
 const before=fs.lstatSync(eventPath);assert(before.isFile()&&!before.isSymbolicLink()&&before.size<=4*1024*1024,'Bounded regular event input');
 const stamp=s=>[s.dev,s.ino,s.size,s.mode,s.mtimeMs,s.ctimeMs];
 const raw=boundedRegularRead(eventPath,4*1024*1024,readLedger);
 assert.deepEqual(stamp(fs.lstatSync(eventPath)),stamp(before));assert.equal(raw.length,before.size);
 const eventText=raw.toString('utf8');assert(Buffer.from(eventText).equals(raw),'Event UTF8');const event=JSON.parse(eventText);
 if(event.action!=='ready_for_review'||event.pull_request?.draft!==false)return skipped('Not the selected non-draft Ready source-qualification event; no consumer-control PASS or admission credit.');
 assert.equal(event.repository?.full_name,'hartican/sportscal');assert.equal(typeof event.pull_request.body,'string','Missing required reservation witness body');
 const bodyBytes=Buffer.from(event.pull_request.body);assert(bodyBytes.length<=65536,'Body byte bound');const body=JSON.parse(event.pull_request.body);assert.equal(JSON.stringify(body),event.pull_request.body,'Canonical witness body, NO LF');
 const route=actualConsumerContextRoute(body);
 if(route==='NORMAL613'){require('./validate-forward-onboarding-ci').normal613Body(bodyBytes);return skipped('Typed normal613 context: historical forward/E610 consumer controls NOT_APPLICABLE; no consumer/admission/release credit. Existing normal613 intake/source admission/eight focused/full51/four paired/premerge/both-engine gates remain required.');}
 if(route!=='FORWARD')return {status:'NOT_FORWARD_CONTEXT',groups:null,positive:null,negative:null,requiredSourceAdmissionGateClosed:false,releaseAcceptance:false};
 const b=body.sourceQualificationBinding;assert(b&&typeof b==='object'&&!Array.isArray(b),'Reservation binding required');
 assert.equal(b.reservationReceiptSha256,'40f49544cb207c3c1bf7c1da3cfd1c6c1e527ddb36003ee6067b0fb837a378ed');
 assert(typeof b.reservationReceiptBase64==='string'&&b.reservationReceiptBase64.length<=21848,'Bounded reservation witness');
 const reservation=Buffer.from(b.reservationReceiptBase64,'base64');assert(reservation.length>0&&reservation.length<=16384);assert.equal(reservation.toString('base64'),b.reservationReceiptBase64);assert.equal(hash(reservation),b.reservationReceiptSha256,'Exact forward witness, no mocked crypto/private literal');
 const nodePath=require('node:path'),root=nodePath.resolve(__dirname,'..');
 function source(relative,maximum){
  const file=nodePath.join(root,relative),st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.size<=maximum,'Finite selected control source');
  const bytes=boundedRegularRead(file,maximum,readLedger);
  assert.deepEqual(stamp(fs.lstatSync(file)),stamp(st));assert.equal(bytes.length,st.size);return bytes;
 }
 const qualifier=source('scripts/validate-sync-current-forward.js',1024*1024),fixture=source('scripts/fixtures/sync-current-forward-20261107.json',1024*1024),policy=source('config/deployment-manifest.json',16384);
 const qualifierText=qualifier.toString('utf8');assert(Buffer.from(qualifierText).equals(qualifier),'Selected qualifier UTF8');
 assert.equal(hash(qualifier),b.qualifierSha256,'Selected qualifier matches actual source body binding');assert.equal(hash(fixture),b.fixtureSha256,'Selected fixture matches actual source body binding');
 return {status:'PASS_ACTUAL_CONSUMER_ADMISSION_CONTROLS',...forwardConsumerAdmissionRegressions(qualifierText,fixture,policy,reservation),requiredSourceAdmissionGateClosed:false};
}



if(require.main===module){
 const augmentedProduction=fs.readFileSync('.github/workflows/sportscal-production.yml','utf8');
 const editorialPreparationControls=editorialPreparationRegressions(augmentedProduction,fs.readFileSync('scripts/prepare-adaptive-editorial.js','utf8'));
 const text=normalisePermanentProductionSelection(augmentedProduction).restored,report=validate(text);
 const rawForwardInstalled=fs.readFileSync('.github/workflows/installed-upgrade-tests.yml','utf8');
 const {normaliseForwardWorkflow,sourceControls}=require('./validate-forward-onboarding-ci');
 const forwardSourceControls=sourceControls(rawForwardInstalled);
 const augmentedInstalled=normaliseForwardWorkflow(rawForwardInstalled).restored;
 const singlePassSource=singlePassSourceRegressions(augmentedInstalled);
 const producerReadLedger=producerReadLedgerRegressions(singlePassSource.restored);
 const projectionReadBudget=projectionReadBudgetRegressions(producerReadLedger.restored),reviewedInstalled=projectionReadBudget.restored;
 const existingInstalled=normalisePermanentCaptureWorkflow(reviewedInstalled).restored;
 const installed=normaliseE610AdmissionWorkflow(existingInstalled).restored;
 const lockedTerserPackageControls=lockedTerserPackageRegressions();
 const signupCompatibilityNegativeControls=signupCompatibilityRegressions(installed);
 const originalNegativeControls=regressions(text);
 const admission=e610AdmissionRegressions(existingInstalled);
 const permanentCaptureControls=permanentCaptureRegressions(reviewedInstalled);
 const permanentProductionSelectionControls=permanentProductionSelectionRegressions(augmentedProduction);
 const actualConsumerContextRoutingControls=actualConsumerContextRoutingRegressions();
 let e610ActualConsumerAdmissionControls,consumerControlFailure=null;
 try{e610ActualConsumerAdmissionControls=forwardConsumerControlsForContext();if(e610ActualConsumerAdmissionControls.status==='NOT_FORWARD_CONTEXT')e610ActualConsumerAdmissionControls=e610ConsumerControlsForContext();}
 catch(error){consumerControlFailure=error;e610ActualConsumerAdmissionControls={status:'FAIL_ACTUAL_CONSUMER_ADMISSION_CONTROLS',message:error.message,report:error.e610Report||null,groups:error.e610Report?.groups??null,requiredSourceAdmissionGateClosed:false,releaseAcceptance:false};}
 console.log(JSON.stringify({schemaVersion:'production-sql-batches.v1',...report,forwardSourceControls,actualConsumerContextRoutingControls,editorialPreparationControls,negativeControls:originalNegativeControls,signupCompatibilityNegativeControls,lockedTerserPackageControls,e610AdmissionControls:admission.report,e610ActualConsumerAdmissionControls,singlePassSourceControls:singlePassSource.report,producerReadLedgerControls:producerReadLedger.report,projectionReadBudgetControls:projectionReadBudget.report,permanentCaptureControls:permanentCaptureControls.report,permanentProductionSelectionControls,engineRuns:0,serviceRequests:0,releaseAcceptance:false}));
 if(consumerControlFailure)throw consumerControlFailure;
}
module.exports={normaliseEditorialPreparationWorkflow,editorialPreparationRegressions,validateEditorialPreparationHelper,actualConsumerContextRoute,actualConsumerContextRoutingRegressions,forwardConsumerAdmissionRegressions,forwardConsumerControlsForContext,normaliseSinglePassSourceWorkflow,singlePassSourceRegressions,normaliseProducerReadLedgerWorkflow,producerReadLedgerRegressions,normaliseProjectionReadReuseWorkflow,projectionReadBudgetRegressions,normalisePermanentCaptureWorkflow,normalisePermanentProductionSelection,permanentCaptureRegressions,permanentProductionSelectionRegressions,e610ConsumerAdmissionRegressions,e610ConsumerControlsForContext,normaliseE610AdmissionWorkflow,e610AdmissionRegressions,resolveLockedTerserPackage,lockedTerserPackageRegressions,validate,regressions,validateSignupCompatibilityWorkflow,signupCompatibilityRegressions};
