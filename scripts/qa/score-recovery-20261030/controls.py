# -*- coding: utf-8 -*-
"""No service or real credentials. Same admitted source; owned step models."""
import base64,hashlib,importlib.util,json,os,pathlib,secrets,subprocess,sys,time
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('prepare_control',HERE/'prepare-control.py');prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)
spec=importlib.util.spec_from_file_location('credential_scan',HERE/'credential-scan.py');scanner=importlib.util.module_from_spec(spec);spec.loader.exec_module(scanner)
POSITIVE={'good','short-pages','page-exact','cumulative-exact','stdio-secret','legacy-credential','secret-key-credential','fd-exports'}
CASES=['good','bad-origin','bad-rpc','bad-filter','bad-order','bad-offset','bad-limit','bad-method','bad-body','bad-header','auth401','auth403','redirect','partial-length','invalid-json','invalid-utf8','duplicate-key','private-row','private-fixture','private-nested','secret-plain','secret-unicode','secret-double-unicode','secret-percent','secret-base64','header-secret','fetch-error-secret','stream-error-secret','overlap','later-failure','eight-full','short-pages','page-exact','page-overflow','cumulative-exact','cumulative-overflow','parse-deadline','partial-runtime-failure','late-failure','outside-write','native-network','stdio-secret','legacy-credential','headers-timeout','body-timeout','hang-child']
def run(case,label=None):
    file,h,policy=prepare.prepare(label or case,scenario=case)
    marker=('controlled_'if case=='legacy-credential'else'sb_secret_')+secrets.token_urlsafe(36)
    scanner.selftest(marker)
    began=time.monotonic()
    key='SUPABASE_SECRET_KEY'if case=='secret-key-credential'else'SUPABASE_SERVICE_ROLE_KEY'
    executable='supervisor-control.py'if case.startswith(('readback-denied-','report-denied-','late-missing-','late-invalid-','late-array-','late-string-','late-output-'))else'supervisor.py'
    result=subprocess.run(['/usr/bin/python3',str(HERE/executable),'--policy',str(file),'--expected-sha256',h],env={'PATH':'/usr/bin:/bin',key:marker},text=True,capture_output=True,timeout=policy['wholeSeconds']+5)
    # Never write a diagnostic containing the synthetic credential itself.
    assert not scanner.contains((result.stdout+result.stderr).encode(),marker),'CREDENTIAL_IN_SUPERVISOR_OUTPUT'
    (file.parent/'supervisor.stdout.json').write_text(result.stdout);(file.parent/'supervisor.stderr.log').write_text(result.stderr)
    for p in file.parent.rglob('*'):
        if p.is_file():assert not scanner.contains(p.read_bytes(),marker),'CREDENTIAL_IN_CONTROL_ARTIFACT'
    receipt=json.loads(result.stdout);expected=0 if case in POSITIVE else 1
    assert result.returncode==expected,(case,'UNEXPECTED_EXIT',receipt.get('firstGuardError'),receipt.get('supervisorError'))
    assert receipt['processGroupClosed']and not receipt['ownedTemporaryFilesRemaining']and receipt['rollback']['verified'],(case,'CLOSURE_OR_ROLLBACK')
    if case=='late-capture-corruption':assert receipt['diagnosticErrors']==['BODY_READBACK_HASH']and receipt['exitCode']==0,(case,'LATE_VALIDATION_NOT_REACHED')
    elif case.startswith(('readback-denied-','report-denied-')):
        expected_error='BODY_READBACK:PermissionError'if case.startswith('readback-')else'FINAL_REPORT:PermissionError'
        assert expected_error in receipt['diagnosticErrors'],(case,'FAULT_NOT_REACHED')
        if case.endswith('-failure'):assert receipt['firstGuardError']and receipt['exitCode']==1,(case,'ORIGINAL_FAILURE_REPLACED')
        else:assert receipt['exitCode']==0,(case,'LATE_DIAGNOSTIC_NOT_REACHED')
    elif case in['late-invalid-transport','late-array-transport','late-string-page']:assert receipt['diagnosticErrors']and receipt['exitCode']==0,(case,'RECEIPT_FAILURE_NOT_REACHED')
    elif case=='late-output-time':assert receipt['supervisorError']=='FINALIZATION_WINDOW_TIMEOUT'and receipt['exitCode']==0,(case,'FINAL_TIME_FAULT_NOT_REACHED')
    else:assert not receipt['diagnosticErrors'],(case,'DIAGNOSTIC_FAILURE',receipt['diagnosticErrors'])
    if case=='fd-file-secret':assert receipt['firstGuardError']['code']=='GUARD_DIRECT_WRITE_FD',(case,'DESCRIPTOR_GUARD_NOT_REACHED')
    if case not in POSITIVE:assert receipt['changedPaths']==[],(case,'FAILED_CANDIDATE_NOT_RESTORED')
    source=receipt.get('transport')or{}
    assert not source.get('activeCall')and not source.get('readersOpen'),(case,'OPEN_SOURCE_READER')
    assert(source.get('control')or{}).get('nativeConnections',0)==0,(case,'NATIVE_NETWORK')
    assert(source.get('control')or{}).get('streamsLocked',0)==0,(case,'LOCKED_RESPONSE_STREAM')
    assert source.get('requests',0)<=8 and source.get('capturedBytes',0)<=16777216,(case,'ADMISSION_LIMIT')
    ledger=[json.loads(line)for line in(file.parent/'run/guard-ledger.jsonl').read_text().splitlines()]
    assert all(r.get('ownedWriteDescriptorsRemaining',0)==0 for r in ledger if r.get('state')=='exit'),(case,'OPEN_DESCRIPTOR')
    if case.startswith('secret-')and case!='secret-key-credential'or case.startswith('private-')or case in['row-overflow','unknown-field','wrong-type','header-secret','invalid-json','invalid-utf8','duplicate-key','page-overflow','partial-length','auth401','auth403','redirect','fetch-error-secret','stream-error-secret','parse-deadline']:
        assert not list((file.parent/'run').glob('page-*.raw')),(case,'UNVALIDATED_BODY_CAPTURED')
    if case=='eight-full':assert source['requests']==8 and not source['collectionComplete']
    if case=='short-pages':assert source['requests']==2 and source['collectionComplete']
    if case=='page-exact':assert source['capturedBytes']==4194304
    if case=='cumulative-exact':assert source['capturedBytes']==16777216 and source['collectionComplete']
    if case=='cumulative-overflow':assert source['requests']==5 and source['capturedBytes']==16777216
    if case=='hang-child':
        assert receipt['timedOut']and receipt['supervisorError']=='WHOLE_WINDOW_TIMEOUT'and len(receipt['pages'])==1,(case,'NATIVE_KILL_NOT_REACHED')
        assert sum(r.get('state')=='start'for r in ledger)>=2 and receipt['ownedTemporaryFilesRemovedAfterGroupClose'],(case,'NATIVE_CHILD_CLEANUP_NOT_EXERCISED')
    if case=='interrupted-rollback':
        assert receipt['timedOut']and 'data/retained-only.json'in receipt['rollback']['restoredPaths'],(case,'INTERRUPTED_ROLLBACK_NOT_EXERCISED')
    if case in['good','stdio-secret','legacy-credential','secret-key-credential']:
        for f in['data/events.json','feeds/incoming/events.json']:
            card=json.loads((file.parent/'fixture'/f).read_text())['events'][0]
            assert card['status']=='completed'and card['scoreCheckedAt']=='2026-10-13T11:26:00.714+00:00',(case,'REAL_SOURCE_HANDOFF')
    evidence=file.parent/'run/result.json';evidence=evidence if evidence.exists()else file.parent/'supervisor.stdout.json'
    row={'case':case,'status':'PASS','supervisorExit':result.returncode,'sourceProcessStarts':receipt['nodeStarts'],'requests':source.get('requests',len(receipt.get('pages',[]))),'capturedBytes':source.get('capturedBytes',sum(r.get('bytesReceived',0)for r in receipt.get('pages',[])if r.get('captured'))),'groupClosed':True,'rollbackVerified':True,'credentialScan':'CLEAR_RAW_UTF16_BASE64_HEX_UNICODE_PERCENT','actualServiceOrProviderRequests':0,'elapsedSeconds':round(time.monotonic()-began,3),'result':str(evidence),'policySha256':h}
    print(json.dumps(row),flush=True);return row
if __name__=='__main__':
    CASES+=['row-overflow','unknown-field','wrong-type','secret-key-credential','fd-exports','fd-file-secret','secret-hex-uppercase','late-capture-corruption','interrupted-rollback','readback-denied-success','readback-denied-failure','report-denied-success','report-denied-failure','late-missing-transport','late-invalid-transport','late-array-transport','late-string-page','late-output-time']
    prefix=next((s.split('=',1)[1]for s in sys.argv[1:]if s.startswith('--suite=')),'')
    cases=CASES if '--all'in sys.argv else[s for s in sys.argv[1:]if not s.startswith('--suite=')];records=[]
    for case in cases:records.append(run(case,(prefix+'-'+case)if prefix else None))
    (HERE/('control-results-'+str(int(time.time()))+'.json')).write_text(json.dumps({'records':records,'realServiceOrProviderRequests':0,'sourceCommit':prepare.SHA},indent=2)+'\n')
