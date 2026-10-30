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
const receiptBatches=[
 ['near-selection','near-receipt-join-pg18','NEAR_EVIDENCE_DIR="$RUNNER_TEMP/near-selection-pg18/receipt-join" node scripts/validate-near-receipt-join.js'],
 ['near-selection','near-receipt-join-pg17','NEAR_EVIDENCE_DIR="$RUNNER_TEMP/near-selection-pg17/receipt-join" PGLITE_MODULE=pglite-pg17 node scripts/validate-near-receipt-join.js']
];
const allBatches=[...batches.slice(0,4),...receiptBatches,...batches.slice(4)];
const safety='      - name: Verify feed and deployment safety contracts\n        run: |\n';
const shared='      - name: Verify shared fixture publication input\n';
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
 const expectedPublisher=[...originalPublisher.slice(0,recoveryAt+1),...recoveryCommands,...originalPublisher.slice(recoveryAt+1)];
 assert.deepEqual(commands,expectedPublisher,'All original 251 publisher commands retain their exact order and environment, with both required recovery checks immediately after preference bookkeeping');
 const receiptCommands=receiptBatches.map(row=>row[2]);
 assert.deepEqual([...commands,...moved,...receiptCommands].sort(),[...original.commands,...recoveryCommands,...receiptCommands].sort(),'All original occurrences, both required recovery additions and both receipt-join engines are preserved');
 assert.equal(hash(normalized.slice(0,at+safety.length)+'\0'+normalized.slice(end)),original.publisherScaffoldSha256,'Publisher SHA, credentials, deadlines, live gates, deploy and public checks unchanged');
 assert(!/continue-on-error|\beval\b/.test(text),'No soft failure or dynamic command evaluation');
 return {originalOccurrences:258,addedRecoveryOccurrences:recoveryCommands.length,addedReceiptOccurrences:receiptCommands.length,publisherOccurrences:commands.length,movedOccurrences:moved.length,requiredOccurrences:commands.length+moved.length+receiptCommands.length,batches:4};
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
  ['live gate removed',s=>s.replace('          node scripts/verify-global-app-adapter.js --live-read\n','')],
  ['arrangement check bypassed',s=>s.replace(preflight,'')],
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
if(require.main===module){
 const text=fs.readFileSync('.github/workflows/sportscal-production.yml','utf8'),report=validate(text);
 console.log(JSON.stringify({schemaVersion:'production-sql-batches.v1',...report,negativeControls:regressions(text),engineRuns:0,serviceRequests:0,releaseAcceptance:false}));
}
module.exports={validate,regressions};
