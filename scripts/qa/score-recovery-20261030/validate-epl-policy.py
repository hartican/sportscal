"""Pure actual-module policy/env/export controls; no main/inspect/child/native IO."""
import contextlib,copy,hashlib,importlib.util,io,json,pathlib,sys,tempfile,types
from unittest.mock import patch
sys.dont_write_bytecode=True
HERE=pathlib.Path(__file__).resolve().parent

def module(name):
 spec=importlib.util.spec_from_file_location(name,HERE/(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def main():
 supervisor=module('supervisor');ci=module('ci');profile=json.loads((HERE/'epl-profile.json').read_text());root=pathlib.Path('/owned/source');results=[]
 p={**profile,'mode':'epl-canonical','sourceRoot':str(root),'root':str(root),'runDir':'/owned/run','tmpDir':'/owned/run/tmp','nodeOptions':'--require='+str(HERE/'guard.cjs'),'writeFiles':[str(root/f)for f in profile['writeFiles']],'writeCaps':{str(root/f):v for f,v in profile['writeCaps'].items()},'rollbackHashes':{str(root/f):r['sha256']for f,r in profile['rollbackInventory'].items()}}
 def good(name,fn):fn();results.append({'case':name,'status':'PASS'})
 def denied(name,fn):
  try:fn()
  except(AssertionError,RuntimeError,ValueError,KeyError):results.append({'case':name,'status':'PASS'});return
  raise AssertionError(name+' failed to refuse')
 with patch.object(supervisor.subprocess,'Popen',side_effect=AssertionError('NATIVE_FORBIDDEN'))as launch:
  good('actual finite keyless supervisor route',lambda:supervisor.validate_route(p,HERE/'actual-policy.json'))
  for key,value in [('sourceGitSha','0'*40),('entryArgv',['scripts/update-cards.js','--quick']),('credentialEnvironmentNames',['SUPABASE_SECRET_KEY']),('wholeSeconds',181),('minimumSecondsBeforeLaunch',159),('minimumFreeBytes',4831838207),('maximumNewDiskBytes',728303894),('maxRollbackBytes',268435457),('maxFileBytes',33554433),('writeFiles',p['writeFiles']+['/outside'])]:
   valuep=copy.deepcopy(p);valuep[key]=value;denied('finite route rejects '+key,lambda v=valuep:supervisor.validate_route(v,HERE/'actual-policy.json'))
  env=supervisor.epl_module().environment(p,HERE/'actual-policy.json','0'*64)
  good('actual env contains no credential or Supabase discovery',lambda:ci.require(not any('SUPABASE'in k or'TOKEN'in k or'SECRET'in k for k in env),'ENV'))
  good('actual env pins local budget reports',lambda:ci.require(env['FOOTBALL_DATA_RUN_DIR']=='/owned/run/tmp/football-backup','ENV'))
  row={'resource':0,'httpStatus':None,'encoding':None,'state':'failed','wireBytes':0,'decodedBytes':0,'elapsedMs':1,'wireSha256':'0'*64,'decodedSha256':'0'*64,'bodyComplete':False,'guardParsed':False,'consumerParsed':False,'readerClosed':True,'requestClosed':True,'decoderClosed':True,'code':'EPL_SOURCE_JSON'}
  good('actual exporter retains fixed failed-resource evidence',lambda:ci.epl_resource_public(row))
  for name,change in [('raw-payload',{'raw':{'unknown':'private'}}),('unreviewed-enum',{'code':'EPL_PRIVATE_MARKER'}),('oversize-counter',{'wireBytes':884738}),('wronghash',{'wireSha256':'private'}),('badtype',{'readerClosed':'yes'})]:denied('export refuses '+name,lambda v={**row,**change}:ci.epl_resource_public(v))
  for value in ['private@example.com','2026-02-30T00:00:00Z','2026-10-31']:
   denied('clock export refuses untyped or invalid calendar value',lambda v=value:ci.epl_public_clock(v))
  good('clock exporter preserves original offset observation',lambda:ci.epl_public_clock('2026-10-13T11:26:00.714+00:00'))
  fixture=json.loads((HERE/'epl-control-fixture.json').read_text());memory={str(root/f):json.dumps(v).encode()for f,v in fixture['seeds'].items()};baseline=copy.deepcopy(memory)
  updated={file:[profile['surfaceIds'][file][0]]for file in['feeds/incoming/events.json','data/events.json']}
  for file,ids in updated.items():
   doc=json.loads(memory[str(root/file)]);event=next(e for e in doc['events']if e['id']==ids[0]);event.update(status='completed',homeScore=0,awayScore=0,scoreCheckedAt='2026-10-30T00:00:00Z',resultSourceCheckedAt='2026-10-30T00:00:00Z');memory[str(root/file)]=json.dumps(doc).encode()
  prefix=[['scripts/build-canonical-context-bundle.js'],['scripts/validate-premier-league-context.js']]
  tail=[['scripts/build-code-inspector.js','--codes=football'],['scripts/build-app-shell-runtime.js'],['scripts/apply-current-card-evidence.js','--check'],['scripts/validate-current-card-coverage.js'],['scripts/validate-feed-coverage-resilience.js'],['scripts/validate-feed.js','data/events.json'],['scripts/validate-crowd-foresight.js'],['scripts/build-follow-directories.js'],['scripts/build-follow-directories.js','--check']]
  history=prefix+[['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known','--epl-updated-ids='+json.dumps(updated)],['scripts/qa-storyline-spoilers.js','feeds/incoming/events.json'],['scripts/qa-storyline-spoilers.js','data/events.json'],['scripts/build-paged-feed.js']]+tail
  pages=[{'resource':i,'state':'complete','wireBytes':0,'decodedBytes':0,'elapsedMs':1,'bodyComplete':True,'guardParsed':True,'consumerParsed':True,'readerClosed':True,'requestClosed':True,'decoderClosed':True}for i in range(5)]
  report={'source':'epl','changed':['Premier League 2'],'backup':{'networkRequestsAllowed':0},'updatedFixtureIdsBySurface':updated,'resources':{'fixtures':{'state':'primary'},'table':{'state':'primary'}}}
  memory['/owned/run/quick-results-report.json']=json.dumps(report).encode()
  receipt={'processGroupClosed':True,'ownedTemporaryFilesRemaining':[],'transport':{'protocol':'epl','collectionComplete':True,'activeCall':False,'readersOpen':0,'requestsOpen':0,'requests':5,'receivedBytes':0,'decodedBytes':0,'capturedBytes':0,'childArgvs':history},'pages':pages,'changedPaths':['data/events.json','feeds/incoming/events.json']}
  post=supervisor.epl_module().postconditions
  good('actual supervisor postconditions accept two-surface candidate and full child closure',lambda:post(p,receipt,baseline,lambda f:memory[str(f)]))
  for name,change in [('unclosed-native-group',lambda r:r.update(processGroupClosed=False)),('open-request',lambda r:r['pages'][0].update(requestClosed=False)),('duplicate-resource',lambda r:r['pages'][1].update(resource=0)),('sixth-resource',lambda r:r['transport'].update(requests=6)),('missing-gate',lambda r:r['transport']['childArgvs'].pop()),('out-of-scope-write',lambda r:r.update(changedPaths=['config/private.json']))]:
   bad=copy.deepcopy(receipt);change(bad);denied('postconditions refuse '+name,lambda r=bad:post(p,r,baseline,lambda f:memory[str(f)]))
  for name,file,mutate in [('unrelated-clock','data/canonical/afl-nrl-2026.json',lambda v:v['ladderSnapshots'][0].update(snapshotTimeUtc='2099-01-01T00:00:00Z')),('new-overlay-result','data/canonical/football-delayed-results.v1.json',lambda v:v['results'].append({'unreviewed':True})),('unrelated-card','data/events.json',lambda v:v['events'][0].update(venue='unreviewed'))]:
   changed=copy.deepcopy(memory);value=json.loads(changed[str(root/file)]);mutate(value);changed[str(root/file)]=json.dumps(value).encode();denied('postconditions preserve '+name,lambda m=changed:post(p,receipt,baseline,lambda f:m[str(f)]))
  bad=copy.deepcopy(receipt);bad['pages'][0].update(state='failed',code='EPL_FIXTURE_COLLECTION');denied('rejected fixture branch cannot publish fixture updates',lambda:post(p,bad,baseline,lambda f:memory[str(f)]))
  doc=json.loads(memory[str(root/'data/events.json')]);doc['events'][1]['unknownRawProviderField']='PRIVATE_UNREVIEWED_LABEL';projected=ci.epl_public_facts(doc,p,'data/events.json');good('public fact projection omits unreviewed provider text',lambda:ci.require('PRIVATE_UNREVIEWED_LABEL'not in json.dumps(projected),'TYPED_EXPORT'))
  driver=ci.load('epl-linux-controls');stream=io.StringIO();private='UNREVIEWED_EXCEPTION_TEXT'
  with contextlib.redirect_stdout(stream):
   try:driver.case_boundary('callback-escape',lambda case:(_ for _ in[]).throw(AssertionError(private)))
   except AssertionError:pass
   else:raise AssertionError('Failed control was swallowed')
  failrow=json.loads(stream.getvalue());good('native per-case boundary emits finite failure identity and keeps gate failed',lambda:ci.require(failrow=={'case':'callback-escape','status':'FAIL','code':'EPL_NATIVE_CONTROL_FAILED','actualServiceOrProviderRequests':0,'failureStage':'CASE_START','failureKind':'ASSERTION'}and private not in stream.getvalue(),'EPL_CASE_WITNESS'))
  saved=[];result=types.SimpleNamespace(stdout=stream.getvalue().encode(),stderr=private.encode(),returncode=1)
  with patch.object(pathlib.Path,'mkdir'),patch.object(ci,'write',side_effect=lambda f,v:saved.append(v)):ci.control_failure_witness('epl-linux-controls',result,'CHILD_EXIT')
  good('finite EPL failure witness retains new-only case without exception text',lambda:ci.require(saved[0]['completedRecords']==[{'case':'callback-escape','status':'FAIL','actualServiceOrProviderRequests':0,'failureStage':'CASE_START','failureKind':'ASSERTION'}]and private not in json.dumps(saved),'EPL_CASE_WITNESS'))
  saved=[]
  with patch.object(pathlib.Path,'mkdir'),patch.object(ci,'write',side_effect=lambda f,v:saved.append(v)):ci.control_failure_witness('linux-controls',result,'CHILD_EXIT')
  good('legacy witness does not acquire arbitrary EPL case names',lambda:ci.require(saved[0]['completedRecords']==[],'EPL_CASE_WITNESS'))
  # Reproduce the actual failed good-case boundary with an owned refused
  # supervisor receipt. No supervisor/guard/native process is launched.
  refusal={'diagnosticErrors':['EPL_POSTCONDITIONS'],'firstGuardError':{'code':'GUARD_SOURCE_PIN','message':private},'nodeStarts':1,'processGroupClosed':True,'rollback':{'verified':True},'transport':{'requests':1}}
  result=types.SimpleNamespace(stdout=json.dumps(refusal).encode(),stderr=private.encode(),returncode=1);stream=io.StringIO()
  with patch.object(driver,'prepare',return_value=(pathlib.Path('/owned/policy.json'),{'wholeSeconds':15})),patch.object(driver,'digest',return_value='0'*64),patch.object(driver.subprocess,'run',return_value=result)as child,contextlib.redirect_stdout(stream):
   try:driver.case_boundary('good',lambda case:driver.run_case(case,types.SimpleNamespace(selftest=lambda marker:None,contains=lambda blob,marker:False)))
   except AssertionError as original:ci.require(original.args[0][1]=='EXIT','ORIGINAL_REFUSAL')
   else:raise AssertionError('Failed native supervisor receipt was swallowed')
   child.assert_called_once()
  diagnostic=json.loads(stream.getvalue());good('actual good-case driver preserves supervisor refusal stage and original gate',lambda:ci.require(diagnostic['failureStage']=='SUPERVISOR_EXIT'and diagnostic['failureKind']=='ASSERTION'and diagnostic['supervisorExit']==1 and diagnostic['sourceProcessStarts']==1 and diagnostic['requests']==1 and diagnostic['groupClosed']and diagnostic['rollbackVerified'],'EPL_REFUSAL_STAGE'))
  saved=[]
  with patch.object(pathlib.Path,'mkdir'),patch.object(ci,'write',side_effect=lambda f,v:saved.append(v)):ci.control_failure_witness('epl-linux-controls',types.SimpleNamespace(stdout=stream.getvalue().encode(),stderr=private.encode(),returncode=1),'CHILD_EXIT')
  public=saved[0]['completedRecords'][0];good('existing CI exporter retains only fixed supervisor refusal codes',lambda:ci.require(public['failureStage']=='SUPERVISOR_EXIT'and public['guardCode']=='GUARD_SOURCE_PIN'and public['diagnosticCode']=='EPL_POSTCONDITIONS'and private not in json.dumps(saved)and saved[0]['ready']is False,'EPL_REFUSAL_STAGE'))
  weird=driver.receipt_evidence(types.SimpleNamespace(returncode=True),{'nodeStarts':2,'processGroupClosed':1,'rollback':[private],'transport':[private],'firstGuardError':{'code':[private]},'supervisorError':{'private':private},'diagnosticErrors':[private]})
  good('malformed diagnostic fields cannot replace the original refusal or export text',lambda:ci.require(weird=={'guardCode':'UNREVIEWED_GUARD_REFUSAL','supervisorCode':'OTHER_SUPERVISOR_FAILURE','diagnosticCode':'OTHER_SUPERVISOR_DIAGNOSTIC'},'EPL_REFUSAL_SHAPE'))
  forged={**diagnostic,**dict.fromkeys(['failureStage','failureKind','guardCode','supervisorCode','diagnosticCode'],private)};saved=[]
  with patch.object(pathlib.Path,'mkdir'),patch.object(ci,'write',side_effect=lambda f,v:saved.append(v)):ci.control_failure_witness('epl-linux-controls',types.SimpleNamespace(stdout=json.dumps(forged).encode(),stderr=b'',returncode=1),'CHILD_EXIT')
  good('unreviewed stage kind and code strings are never exported',lambda:ci.require(private not in json.dumps(saved)and not any(k in saved[0]['completedRecords'][0]for k in ['failureStage','failureKind','guardCode','supervisorCode','diagnosticCode']),'EPL_REFUSAL_ENUMS'))
  saved=[]
  with patch.object(pathlib.Path,'mkdir'),patch.object(ci,'write',side_effect=lambda f,v:saved.append(v)):ci.control_failure_witness('linux-controls',types.SimpleNamespace(stdout=json.dumps(diagnostic).encode(),stderr=b'',returncode=1),'CHILD_EXIT')
  good('legacy good-case witness retains old field namespace',lambda:ci.require(not any(k in saved[0]['completedRecords'][0]for k in ['failureStage','failureKind','guardCode','supervisorCode','diagnosticCode']),'EPL_REFUSAL_NAMESPACE'))
  for error,kind in [(FileNotFoundError(private),'OS_ERROR'),(ValueError(private),'OTHER_CONTROL_FAILURE')]:
   stream=io.StringIO()
   with patch.object(driver,'prepare',side_effect=error),contextlib.redirect_stdout(stream):
    try:driver.case_boundary('good',lambda case:driver.run_case(case,None))
    except BaseException as actual:assert actual is error
    else:raise AssertionError('Original preparation failure was swallowed')
   row=json.loads(stream.getvalue());good('finite '+kind+' witness resets prior receipt and rethrows original',lambda r=row:ci.require(r['failureStage']=='PREPARATION'and r['failureKind']==kind and'guardCode'not in r and private not in json.dumps(r),'EPL_REFUSAL_RESET'))
  scanner=types.SimpleNamespace(selftest=lambda marker:None,contains=lambda blob,marker:False)
  for name,child_result,expected_stage,expected_kind,scan in [('child timeout',__import__('subprocess').TimeoutExpired(['owned'],20,output=private.encode()),'SUPERVISOR_CHILD','CHILD_TIMEOUT',scanner),('invalid receipt',types.SimpleNamespace(stdout=private.encode(),stderr=b'',returncode=1),'RECEIPT_JSON','RECEIPT_JSON_ERROR',scanner),('privacy refusal',result,'CAPTURED_OUTPUT_PRIVACY','ASSERTION',types.SimpleNamespace(selftest=lambda marker:None,contains=lambda blob,marker:True))]:
   stream=io.StringIO();options={'side_effect':child_result}if isinstance(child_result,BaseException)else{'return_value':child_result}
   with patch.object(driver,'prepare',return_value=(pathlib.Path('/owned/policy.json'),{'wholeSeconds':15})),patch.object(driver,'digest',return_value='0'*64),patch.object(driver.subprocess,'run',**options),contextlib.redirect_stdout(stream):
    try:driver.case_boundary('good',lambda case:driver.run_case(case,scan))
    except BaseException:pass
    else:raise AssertionError('Original child/receipt/privacy failure was swallowed')
   row=json.loads(stream.getvalue());good('actual driver keeps finite '+name+' failure boundary',lambda r=row,s=expected_stage,k=expected_kind:ci.require(r['failureStage']==s and r['failureKind']==k and'guardCode'not in r and private not in json.dumps(r),'EPL_REFUSAL_BOUNDARY'))
  denied('unreviewed diagnostic stage remains refused',lambda:driver.failure_stage(private))
  # Actual private-file reader and actual driver -> CI failure boundary, with
  # owned files and a mocked supervisor result. No process/event is executed.
  with tempfile.TemporaryDirectory(prefix='owned-epl-diagnostic-')as temporary:
   parent=pathlib.Path(temporary);run=parent/'run';run.mkdir();owned={**profile,'mode':'owned-control','sourceProtocol':'epl','root':str(parent/'fixture'),'sourceRoot':'/owned/frozen-source','runDir':str(run),'wholeSeconds':15}
   closed={'processGroupClosed':True};status_file=run/'owned-source-exit.json';report_file=run/'refresh-report.json'
   status={'schemaVersion':'owned-epl-source-exit.v1','exitCode':1,'uncaughtExceptionObserved':True,'errorClass':'REFERENCE_ERROR','errorCode':'MODULE_NOT_FOUND'}
   report={'schemaVersion':'canonical-refresh-report.v1','stage':'failed','failedStep':'scripts/build-canonical-context-bundle.js','blockingError':private,'failureChain':[{'message':private}],'unknownPrivate':private}
   status_file.write_text(json.dumps(status));report_file.write_text(json.dumps(report))
   projected=driver.source_failure_evidence(owned,closed)
   good('actual bounded private reader retains only finite source exception and known canonical step',lambda:ci.require(projected=={'sourceExitWitnessState':'VERIFIED','canonicalReportState':'FAILED','sourceExit':{k:status[k]for k in ['exitCode','uncaughtExceptionObserved','errorClass','errorCode']},'failedStep':report['failedStep']}and private not in json.dumps(projected),'INNER_SOURCE_FIELDS'))
   good('independent CI admission agrees on exact source diagnostic schema',lambda:ci.require(ci.epl_source_failure_public(projected)==projected,'INNER_SOURCE_FIELDS'))
   with patch.object(driver,'bounded_diagnostic',side_effect=AssertionError('READ_BEFORE_CLOSURE'))as reader:
    for value in [False,None,1,'true']:
     unknown=driver.source_failure_evidence(owned,{'processGroupClosed':value});assert unknown=={'sourceExitWitnessState':'NOT_CLOSED','canonicalReportState':'NOT_CLOSED'}
    reader.assert_not_called()
   good('source diagnostic never reads before strict verified group closure',lambda:None)
   with patch.object(driver,'bounded_diagnostic',side_effect=AssertionError('ACTUAL_OR_PROJECTION_READ'))as reader:
    unknown=driver.source_failure_evidence({**owned,'mode':'epl-canonical'},closed);assert unknown=={'sourceExitWitnessState':'NOT_OWNED','canonicalReportState':'NOT_OWNED'};reader.assert_not_called()
   good('actual-mode diagnostic observation remains refused',lambda:None)
   result=types.SimpleNamespace(stdout=json.dumps({**refusal,'firstGuardError':None,'diagnosticErrors':[]}).encode(),stderr=b'',returncode=1);stream=io.StringIO()
   with patch.object(driver,'prepare',return_value=(parent/'policy.json',owned)),patch.object(driver,'digest',return_value='0'*64),patch.object(driver.subprocess,'run',return_value=result),contextlib.redirect_stdout(stream):
    try:driver.case_boundary('good',lambda case:driver.run_case(case,scanner))
    except AssertionError as original:assert original.args[0][1]=='EXIT'
    else:raise AssertionError('Original nonzero source exit was swallowed')
   saved=[]
   with patch.object(pathlib.Path,'mkdir'),patch.object(ci,'write',side_effect=lambda f,v:saved.append(v)):ci.control_failure_witness('epl-linux-controls',types.SimpleNamespace(stdout=stream.getvalue().encode(),stderr=private.encode(),returncode=1),'CHILD_EXIT')
   good('actual native driver to CI witness preserves inner reason while original gate stays failed',lambda:ci.require(saved[0]['completedRecords'][0]['sourceFailure']==projected and saved[0]['ready']is False and private not in json.dumps(saved),'INNER_SOURCE_ACTUAL_SEAM'))
   saved=[]
   with patch.object(pathlib.Path,'mkdir'),patch.object(ci,'write',side_effect=lambda f,v:saved.append(v)):ci.control_failure_witness('linux-controls',types.SimpleNamespace(stdout=stream.getvalue().encode(),stderr=b'',returncode=1),'CHILD_EXIT')
   good('legacy failure witness gains no inner source diagnostic fields',lambda:ci.require('sourceFailure'not in saved[0]['completedRecords'][0],'INNER_SOURCE_NAMESPACE'))
   for key,value in [('schemaVersion',private),('exitCode',True),('exitCode',256),('uncaughtExceptionObserved','true'),('errorClass',private),('errorCode',private),('message',private),('uncaughtExceptionObserved',False)]:
    status_file.write_text(json.dumps({**status,key:value}));value1=driver.source_failure_evidence(owned,closed)
    good('source private reader rejects forged '+key+' diagnostic',lambda v=value1:ci.require(v['sourceExitWitnessState']=='UNREVIEWED'and'sourceExit'not in v and private not in json.dumps(v),'INNER_SOURCE_FORGERY'))
   status_file.write_text(json.dumps(status).replace('"exitCode": 1','"exitCode": 0,"exitCode": 1'));value1=driver.source_failure_evidence(owned,closed)
   good('duplicate private diagnostic fields remain unadmitted',lambda:ci.require(value1['sourceExitWitnessState']=='UNREADABLE','INNER_SOURCE_DUPLICATE'))
   for payload,expected in [('x'*1025,'OVERSIZE'),('{invalid','UNREADABLE')]:
    status_file.write_text(payload);value1=driver.source_failure_evidence(owned,closed)
    good('source diagnostic read bounds and JSON failure are explicit '+expected,lambda v=value1,e=expected:ci.require(v['sourceExitWitnessState']==e,'INNER_SOURCE_BOUND'))
   status_file.unlink();value1=driver.source_failure_evidence(owned,closed)
   good('missing source witness is explicit and not no-error evidence',lambda:ci.require(value1['sourceExitWitnessState']=='ABSENT'and'sourceExit'not in value1,'INNER_SOURCE_MISSING'))
   outside=parent/'outside';outside.write_text(json.dumps(status));status_file.symlink_to(outside);value1=driver.source_failure_evidence(owned,closed)
   good('source diagnostic symlink remains unreadable',lambda:ci.require(value1['sourceExitWitnessState']=='UNREADABLE','INNER_SOURCE_SYMLINK'));status_file.unlink();status_file.write_text(json.dumps(status))
   report_file.write_text(json.dumps({**report,'failedStep':private}));value1=driver.source_failure_evidence(owned,closed)
   good('unreviewed canonical step stays unknown without private label',lambda:ci.require(value1['canonicalReportState']=='FAILED_UNKNOWN_STEP'and'failedStep'not in value1 and private not in json.dumps(value1),'INNER_SOURCE_STEP'))
   report_file.write_bytes(b'x'*65537);value1=driver.source_failure_evidence(owned,closed)
   good('canonical failure report has its own64KiB hard read bound',lambda:ci.require(value1['canonicalReportState']=='OVERSIZE','INNER_SOURCE_REPORT_CAP'))
   report_file.unlink();value1=driver.source_failure_evidence(owned,closed)
   good('missing canonical report stays explicit beside verified source exception',lambda:ci.require(value1['canonicalReportState']=='ABSENT'and value1['sourceExitWitnessState']=='VERIFIED','INNER_SOURCE_MISSING'))
   for label,mutate in [('extra-field',lambda v:v.update(private=private)),('raw-source-field',lambda v:v['sourceExit'].update(message=private)),('class',lambda v:v['sourceExit'].update(errorClass=private)),('code',lambda v:v['sourceExit'].update(errorCode=private)),('step',lambda v:v.update(failedStep=private)),('missing-source',lambda v:v.pop('sourceExit')),('bool-exit',lambda v:v['sourceExit'].update(exitCode=True)),('false-uncaught',lambda v:v['sourceExit'].update(uncaughtExceptionObserved=False))]:
    forged=copy.deepcopy(projected);mutate(forged);denied('independent CI rejects forged inner '+label,lambda v=forged:ci.epl_source_failure_public(v))
   denied('independent CI rejects contradictory early observation states',lambda:ci.epl_source_failure_public({'sourceExitWitnessState':'NOT_CLOSED','canonicalReportState':'ABSENT'}))
   for label,change in [('open-group',{'groupClosed':False}),('forged-inner',{'sourceFailure':{**projected,'private':private}})]:
    row={**diagnostic,'sourceFailure':projected,**change};saved=[]
    with patch.object(pathlib.Path,'mkdir'),patch.object(ci,'write',side_effect=lambda f,v:saved.append(v)):ci.control_failure_witness('epl-linux-controls',types.SimpleNamespace(stdout=json.dumps(row).encode(),stderr=private.encode(),returncode=1),'CHILD_EXIT')
    good('actual CI exporter withholds '+label+' source diagnostic',lambda v=saved:ci.require(v[0]['completedRecords'][0]['sourceFailure']=={'sourceExitWitnessState':'UNREVIEWED','canonicalReportState':'UNREVIEWED'}and private not in json.dumps(v),'INNER_SOURCE_EXPORT_CLOSURE'))
   stream=io.StringIO()
   with patch.object(driver,'prepare',return_value=(parent/'policy.json',owned)),patch.object(driver,'digest',return_value='0'*64),patch.object(driver.subprocess,'run',return_value=result),patch.object(driver,'source_failure_evidence',side_effect=RuntimeError(private)),contextlib.redirect_stdout(stream):
    try:driver.case_boundary('good',lambda case:driver.run_case(case,scanner))
    except AssertionError as original:assert original.args[0][1]=='EXIT'
    else:raise AssertionError('Projection failure changed the original source refusal')
   value1=json.loads(stream.getvalue());good('fallible source diagnostic projection cannot replace original assertion',lambda:ci.require(value1['failureStage']=='SUPERVISOR_EXIT'and value1['sourceFailure']=={'sourceExitWitnessState':'UNREADABLE','canonicalReportState':'UNREADABLE'}and private not in stream.getvalue(),'INNER_SOURCE_FAILURE_PRESERVATION'))
  launch.assert_not_called()
 print(json.dumps({'status':'PASS','checks':len(results),'cases':results,'sourceExecutions':0,'actualProviderRequests':0,'nativeMainOrInspect':0}))
if __name__=='__main__':main()
