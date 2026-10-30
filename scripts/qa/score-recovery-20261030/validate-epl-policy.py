"""Pure actual-module policy/env/export controls; no main/inspect/child/native IO."""
import contextlib,copy,hashlib,importlib.util,io,json,pathlib,sys,types
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
  failrow=json.loads(stream.getvalue());good('native per-case boundary emits finite failure identity and keeps gate failed',lambda:ci.require(failrow=={'case':'callback-escape','status':'FAIL','code':'EPL_NATIVE_CONTROL_FAILED','actualServiceOrProviderRequests':0}and private not in stream.getvalue(),'EPL_CASE_WITNESS'))
  saved=[];result=types.SimpleNamespace(stdout=stream.getvalue().encode(),stderr=private.encode(),returncode=1)
  with patch.object(pathlib.Path,'mkdir'),patch.object(ci,'write',side_effect=lambda f,v:saved.append(v)):ci.control_failure_witness('epl-linux-controls',result,'CHILD_EXIT')
  good('finite EPL failure witness retains new-only case without exception text',lambda:ci.require(saved[0]['completedRecords']==[{'case':'callback-escape','status':'FAIL','actualServiceOrProviderRequests':0}]and private not in json.dumps(saved),'EPL_CASE_WITNESS'))
  saved=[]
  with patch.object(pathlib.Path,'mkdir'),patch.object(ci,'write',side_effect=lambda f,v:saved.append(v)):ci.control_failure_witness('linux-controls',result,'CHILD_EXIT')
  good('legacy witness does not acquire arbitrary EPL case names',lambda:ci.require(saved[0]['completedRecords']==[],'EPL_CASE_WITNESS'))
  launch.assert_not_called()
 print(json.dumps({'status':'PASS','checks':len(results),'cases':results,'sourceExecutions':0,'actualProviderRequests':0,'nativeMainOrInspect':0}))
if __name__=='__main__':main()
