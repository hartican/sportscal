"""ROOT Linux only: actual c34 caller+guard+supervisor; owned HTTPS/projection IO.
Heavy builders remain disclosed stand-ins; no service/provider request occurs.
"""
import hashlib,importlib.util,json,os,pathlib,platform,secrets,subprocess,sys,time
sys.dont_write_bytecode=True
HERE=pathlib.Path(__file__).resolve().parent
CASES=('good','gzip','deflate','br','partial-collection','wrong-identity','table-failure','both-resources-fail','wire-overflow','decoded-overflow','invalid-json','invalid-utf8','partial-length','redirect','privacy','deferred-label','native-escape','fetch-escape','request-escape','projection-get','forged-selector','callback-escape','partial-runtime-failure','late-failure','hang-child','interrupted-rollback','headers-timeout','body-timeout')
FAIL=frozenset(('both-resources-fail','native-escape','fetch-escape','request-escape','projection-get','forged-selector','callback-escape','partial-runtime-failure','late-failure','hang-child','interrupted-rollback'))
def read(f):return json.loads(pathlib.Path(f).read_text())
def digest(f):return hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest()
def load(name):
 spec=importlib.util.spec_from_file_location(name,HERE/(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

# Fixed diagnostic vocabulary only. Never export exception/receipt text.
FAILURE_STAGES=frozenset(('CASE_START','PREPARATION','SCANNER_SELFTEST','SUPERVISOR_CHILD','CAPTURED_OUTPUT_PRIVACY','RECEIPT_JSON','SUPERVISOR_EXIT','GROUP_AND_ROLLBACK','FAILED_CANDIDATE_ROLLBACK','WHOLE_WINDOW_TIMEOUT','INTERRUPTED_ROLLBACK','ABSENT_RUNTIME_OUTPUT','TRANSPORT_CLOSURE','RAW_CAPTURE_ABSENCE','NATIVE_CONNECTION_COUNT','ESCAPE_REFUSAL_CODE','CALLBACK_REQUEST_COUNT','LEDGER_READ','WRITE_DESCRIPTOR_CLOSURE','SOURCE_OWNER_COUNT','FINAL_RESULT_STATUS','RESOURCE_CLOSURE','ARTIFACT_PRIVACY'))
FAILURE_KINDS=frozenset(('ASSERTION','CHILD_TIMEOUT','OS_ERROR','RECEIPT_JSON_ERROR','OTHER_CONTROL_FAILURE'))
SUPERVISOR_CODES=frozenset(('NONE','DISK_RESERVE','NODE_PIN','SOURCE_PIN','SOURCE_GIT_SHA','ROLLBACK_BUDGET','CANDIDATE_BASELINE','PREFLIGHT_WINDOW','WHOLE_WINDOW_TIMEOUT','OUTPUT_LIMIT','FINALIZATION_WINDOW_TIMEOUT','SUPERVISOR_AssertionError','SUPERVISOR_OSError','SUPERVISOR_FileNotFoundError','SUPERVISOR_PermissionError','SUPERVISOR_ValueError','SUPERVISOR_KeyError','SUPERVISOR_TypeError','SUPERVISOR_InterruptedError','OTHER_SUPERVISOR_FAILURE'))
GUARD_CODES=frozenset(read(HERE/'epl-profile.json')['exportGuardCodes'])|{'NONE','UNREVIEWED_GUARD_REFUSAL'}
DIAGNOSTIC_CODES=frozenset(('NONE','EPL_POSTCONDITIONS','OTHER_SUPERVISOR_DIAGNOSTIC'))
_failure_evidence={}
def failure_stage(stage):
 assert stage in FAILURE_STAGES,'Unreviewed EPL diagnostic stage'
 _failure_evidence['failureStage']=stage
def receipt_evidence(result,receipt):
 row={};object_value=lambda value:value if isinstance(value,dict)else{}
 for key,value,low,high in [('supervisorExit',getattr(result,'returncode',None),-128,255),('sourceProcessStarts',receipt.get('nodeStarts'),0,1),('requests',object_value(receipt.get('transport')).get('requests'),0,5)]:
  if type(value)is int and low<=value<=high:row[key]=value
 for key,value in [('groupClosed',receipt.get('processGroupClosed')),('rollbackVerified',object_value(receipt.get('rollback')).get('verified'))]:
  if type(value)is bool:row[key]=value
 value=object_value(receipt.get('firstGuardError')).get('code');row['guardCode']='NONE'if value is None else value if isinstance(value,str)and value in GUARD_CODES else'UNREVIEWED_GUARD_REFUSAL'
 value=receipt.get('supervisorError');row['supervisorCode']='NONE'if value is None else value if isinstance(value,str)and value in SUPERVISOR_CODES else'OTHER_SUPERVISOR_FAILURE'
 errors=receipt.get('diagnosticErrors');row['diagnosticCode']='NONE'if not errors else'EPL_POSTCONDITIONS'if isinstance(errors,list)and'EPL_POSTCONDITIONS'in errors else'OTHER_SUPERVISOR_DIAGNOSTIC'
 return row

def prepare(case):
 context=read(HERE/'runtime-context.json');profile=read(HERE/'epl-profile.json');fixture=read(HERE/'epl-control-fixture.json');source=pathlib.Path(context['sourceRoot']);parent=HERE/'epl-controls'/case;root=parent/'fixture';root.mkdir(parents=True,exist_ok=False)
 seeds={f:json.dumps(value)+'\n'for f,value in fixture['seeds'].items()}
 seeds['data/editorial-knowledge.v1.json']=json.dumps({k:[]for k in['subjects','sources','narrativeFacts','narrativeThreads','audienceMemories','eventProjections']})+'\n'
 for f in profile['runtimeOutputs']:seeds[f]='old owned '+f+'\n'
 # A genuinely absent runtime output must be removed on partial-build failure.
 if case=='partial-runtime-failure':del seeds['assets/js/calendar-sync-ui.js']
 if case=='interrupted-rollback':seeds['data/retained-only.json']='{"retained":true}\n'
 for f,b in seeds.items():target=root/f;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(b)
 children=[['scripts/build-canonical-context-bundle.js'],['scripts/validate-premier-league-context.js'],['scripts/publish-feed.js'],['scripts/qa-storyline-spoilers.js'],['scripts/build-paged-feed.js'],['scripts/build-code-inspector.js'],['scripts/build-app-shell-runtime.js'],['scripts/apply-current-card-evidence.js'],['scripts/validate-current-card-coverage.js'],['scripts/validate-feed-coverage-resilience.js'],['scripts/validate-feed.js'],['scripts/validate-crowd-foresight.js'],['scripts/build-follow-directories.js']]
 for args in children:target=root/args[0];target.parent.mkdir(parents=True,exist_ok=True);target.write_text('require('+json.dumps(str(HERE/'epl-control-projection.cjs'))+');\n')
 run=parent/'run';tmp=run/'tmp';writes=sorted({str(root/f)for f in seeds}|{str(root/f)for f in profile['runtimeOutputs']}|{str(root/'data/events.js')})
 if case=='interrupted-rollback':writes.remove(str(root/'data/retained-only.json'))
 pins={**context['sourcePins'],str(HERE/'runtime-context.json'):digest(HERE/'runtime-context.json')}
 pins.update({str(f):digest(f)for f in(root/'scripts').glob('*.js')})
 assert all(digest(f)==h for f,h in pins.items())
 p={**profile,'mode':'owned-control','sourceProtocol':'epl','root':str(root),'sourceRoot':str(source),'runDir':str(run),'tmpDir':str(tmp),'node':context['node'],'nodeSha256':context['nodeSha256'],'sourcePins':pins,'dependencyPins':context['dependencyPins'],'entryArgv':[str(source/'scripts/quick-results.js'),'--source=epl'],'sourceArgv':[str(source/'scripts/quick-results.js'),'--source=epl'],'childArgvs':[],'nodeOptions':'--require='+str(HERE/'epl-control-boundary.cjs')+' --require='+str(HERE/'guard.cjs'),'environmentKeys':sorted(set(profile['environmentKeys'])|{'NS_EPL_TEST_KEY'}),'credentialEnvironmentNames':[],'writeFiles':writes,'writeCaps':{f:33554432 for f in writes},'writeDirectories':sorted({str(pathlib.Path(f).parent)for f in writes}|{str(root/'data/canonical'),str(root/'data'),str(root/'assets/js'),str(run),str(tmp)}),'rollbackHashes':{str(root/f):digest(root/f)for f in seeds},'wholeSeconds':3 if case in['hang-child','interrupted-rollback']else 30 if case in['headers-timeout','body-timeout']else 15,'minimumSecondsBeforeLaunch':1,'minimumFreeBytes':4831838208,'maximumNewDiskBytes':268435456,'maxRollbackBytes':268435456,'controlBoundary':str(HERE/'epl-control-boundary.cjs'),'controlCase':case,'controlRuntimeOutputs':profile['runtimeOutputs']}
 # Only the legacy supervisor entry constraints use this finite list. The EPL
 # startup and runtime child DAG are independently checked by epl-policy.cjs.
 file=parent/'policy.json';file.write_text(json.dumps(p,indent=2)+'\n');return file,p

def run_case(case,scanner):
 failure_stage('PREPARATION');file,p=prepare(case);marker='sb_secret_'+secrets.token_urlsafe(36)
 failure_stage('SCANNER_SELFTEST');scanner.selftest(marker);start=time.monotonic()
 failure_stage('SUPERVISOR_CHILD')
 result=subprocess.run(['/usr/bin/python3',str(HERE/'supervisor.py'),'--policy',str(file),'--expected-sha256',digest(file)],env={'PATH':'/usr/bin:/bin','NS_EPL_TEST_KEY':marker},capture_output=True,timeout=p['wholeSeconds']+5)
 failure_stage('CAPTURED_OUTPUT_PRIVACY')
 assert not scanner.contains(result.stdout+result.stderr,marker),'EPL_CONTROL_EXPORT_PRIVACY'
 failure_stage('RECEIPT_JSON');receipt=json.loads(result.stdout);assert isinstance(receipt,dict),'EPL_CONTROL_RECEIPT_OBJECT'
 _failure_evidence.update(receipt_evidence(result,receipt));failure_stage('SUPERVISOR_EXIT')
 assert result.returncode==(1 if case in FAIL else 0),(case,'EXIT',receipt.get('diagnosticErrors'),receipt.get('firstGuardError'))
 failure_stage('GROUP_AND_ROLLBACK')
 assert receipt['processGroupClosed']and receipt['rollback']['verified']and not receipt['ownedTemporaryFilesRemaining'],(case,'CLOSURE')
 if case in FAIL:
  failure_stage('FAILED_CANDIDATE_ROLLBACK');assert receipt['changedPaths']==[],(case,'ROLLBACK')
 if case in ['hang-child','interrupted-rollback']:
  failure_stage('WHOLE_WINDOW_TIMEOUT');assert receipt['timedOut']and receipt['supervisorError']=='WHOLE_WINDOW_TIMEOUT'
 if case=='interrupted-rollback':
  failure_stage('INTERRUPTED_ROLLBACK');assert 'data/retained-only.json'in receipt['rollback']['restoredPaths']
 if case=='partial-runtime-failure':
  failure_stage('ABSENT_RUNTIME_OUTPUT');assert not(pathlib.Path(p['root'])/'assets/js/calendar-sync-ui.js').exists()
 failure_stage('TRANSPORT_CLOSURE')
 source=receipt.get('transport')or{};assert source.get('requests',0)<=5 and not source.get('activeCall')and not source.get('readersOpen')
 failure_stage('RAW_CAPTURE_ABSENCE')
 assert not list(pathlib.Path(p['runDir']).glob('*.raw'))
 failure_stage('NATIVE_CONNECTION_COUNT')
 for file1 in pathlib.Path(p['runDir']).glob('transport-*.json'):assert(read(file1).get('control')or{}).get('nativeConnections',0)==0
 expected_codes={'native-escape':'GUARD_NATIVE_NETWORK','callback-escape':'GUARD_NATIVE_NETWORK','fetch-escape':'GUARD_FETCH_SCOPE','request-escape':'GUARD_NATIVE_HTTP','projection-get':'GUARD_EPL_GET_SCOPE','forged-selector':'GUARD_STARTUP_COMMAND'}
 if case in expected_codes:
  failure_stage('ESCAPE_REFUSAL_CODE');assert receipt['firstGuardError']['code']==expected_codes[case]
 if case=='callback-escape':
  failure_stage('CALLBACK_REQUEST_COUNT');assert source['requests']==1
 failure_stage('LEDGER_READ')
 ledger=[json.loads(line)for line in(pathlib.Path(p['runDir'])/'guard-ledger.jsonl').read_text().splitlines()]
 failure_stage('WRITE_DESCRIPTOR_CLOSURE')
 assert all(r.get('ownedWriteDescriptorsRemaining',0)==0 for r in ledger if r.get('state')=='exit')
 failure_stage('SOURCE_OWNER_COUNT')
 assert sum(r.get('state')=='start'and r.get('argv',[None])[0]==p['sourceArgv'][0]for r in ledger)==1
 if case not in FAIL:
  if case in['good','gzip','deflate','br','table-failure','deferred-label']:
   failure_stage('FINAL_RESULT_STATUS');assert read(pathlib.Path(p['root'])/'data/events.json')['events'][1 if case!='deferred-label'else 2]['status']=='completed'
  failure_stage('RESOURCE_CLOSURE')
  assert all(r.get('readerClosed')and r.get('requestClosed')and r.get('decoderClosed')for r in receipt['pages'])
 failure_stage('ARTIFACT_PRIVACY')
 for f in file.parent.rglob('*'):
  if f.is_file():assert not scanner.contains(f.read_bytes(),marker),'EPL_CONTROL_ARTIFACT_PRIVACY'
 row={'case':case,'status':'PASS','source':p['sourceGitSha'],'groupClosed':True,'rollbackVerified':True,'actualServiceOrProviderRequests':0,'elapsedSeconds':round(time.monotonic()-start,3)};print(json.dumps(row),flush=True);return row

def case_boundary(case,run):
 assert case in CASES,'Unreviewed EPL native control'
 _failure_evidence.clear();failure_stage('CASE_START')
 try:return run(case)
 except BaseException as error:
  kind='ASSERTION'if isinstance(error,AssertionError)else'CHILD_TIMEOUT'if isinstance(error,subprocess.TimeoutExpired)else'OS_ERROR'if isinstance(error,OSError)else'RECEIPT_JSON_ERROR'if isinstance(error,json.JSONDecodeError)else'OTHER_CONTROL_FAILURE'
  print(json.dumps({'case':case,'status':'FAIL','code':'EPL_NATIVE_CONTROL_FAILED','actualServiceOrProviderRequests':0,'failureKind':kind,**_failure_evidence}),flush=True)
  raise

def main():
 assert platform.system()=='Linux','ROOT Linux qualification only';scanner=load('credential-scan');records=[]
 for case in CASES:records.append(case_boundary(case,lambda value:run_case(value,scanner)))
 (HERE/'epl-linux-results.json').write_text(json.dumps({'status':'PASS','source':'c34bc991643c7f68ba856eec143d76c66ce4fb63','records':records,'actualProviderRequests':0},indent=2)+'\n')
if __name__=='__main__':main()
