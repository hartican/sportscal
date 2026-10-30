# -*- coding: utf-8 -*-
"""Tiny owned fixtures; the admitted sporting source process is frozen3d."""
import hashlib,json,pathlib,secrets,subprocess,os,sys
HERE=pathlib.Path(__file__).resolve().parent
CONTEXT=json.loads((HERE/'runtime-context.json').read_text())
SOURCE=pathlib.Path(CONTEXT['sourceRoot'])
PROFILE=json.loads((HERE/'profile.json').read_text())
SHA='3d3ec1af93cb261598e9f22db1d67b0ae402fd08'
def digest(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def prepare(name,baseline=False,scenario=None,coverageSport=None):
    assert coverageSport in[None,'rugby-union'],'Finite controlled source scope only'
    scenario=scenario or name
    parent=HERE/'controls'/name
    assert not parent.exists(),'Exclusive control name required'
    root=parent/'fixture';root.mkdir(parents=True)
    source_receipt=json.loads((HERE/'rugby-control-fixture.json').read_text())if coverageSport else json.loads((SOURCE/'scripts/fixtures/refresh-cricket-result-20261016.json').read_text())
    route={'runtimeOutputs':PROFILE['runtimeOutputs'],'projections':[a for a in (PROFILE['childArgvs']if coverageSport else PROFILE['combinedControlChildArgvs'])if a[0]not in ['scripts/quick-results.js','scripts/build-follow-directories.js']]}
    assets=route['runtimeOutputs']
    seeds={'data/events.json':json.dumps({'events':[source_receipt['card']]}),'feeds/incoming/events.json':json.dumps({'events':[source_receipt['card']]}),'data/follow-sources/coverage.v1.json':json.dumps({'events':[],'participants':[],'competitions':[],'sources':[]}),'data/code-inspector/cricket.json':json.dumps({'fixtures':source_receipt['aliasRecords']})}
    seeds['data/editorial-knowledge.v1.json']=json.dumps({k:[]for k in ['subjects','sources','narrativeFacts','narrativeThreads','audienceMemories','eventProjections']})
    if scenario=='interrupted-rollback':seeds['data/retained-only.json']=json.dumps({'retained':True,'unchanged':'owned baseline'})+'\n'
    seeds.update({f:'old '+f+'\n'for f in assets})
    if(scenario or name)=='late-failure':seeds.pop('assets/js/calendar-sync-ui.js')
    for f,value in seeds.items():
        target=root/f;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(value)
    children=[a for a in route['projections'] if a[0]!='scripts/build-code-inspector.js']
    children.extend([['scripts/build-code-inspector.js','--codes='+x]for x in (['rugby-union']if coverageSport else['cricket','rugby-union','cricket,rugby-union','rugby-union,cricket'])])
    children.extend([['scripts/build-follow-directories.js'],['scripts/build-follow-directories.js','--check']])
    for argv in children:
        f=root/argv[0];f.parent.mkdir(parents=True,exist_ok=True);f.write_text('require('+json.dumps(str(HERE/'control-projection.cjs'))+');\n')
    assert not baseline,'Immutable original RED evidence is retained separately, not rerun here'
    old={**PROFILE,**CONTEXT};pins={**CONTEXT['sourcePins'],str(HERE/'runtime-context.json'):digest(HERE/'runtime-context.json')}
    assert all(digest(f)==d for f,d in pins.items()),'Frozen source/helper changed'
    guard=HERE/'guard.cjs'
    for f in [guard,guard.parent/'transport.cjs',HERE/'control-boundary.cjs',HERE/'control-projection.cjs',HERE/'protocol.cjs',HERE/'public-fixture-shape.json']:
        if f.exists():pins[str(f)]=digest(f)
    pins.update({str(f):digest(f)for f in(root/'scripts').glob('*.js')})
    run=parent/'run';tmp=run/'tmp';write_files=[str(root/f)for f in seeds]+[str(root/'assets/js/calendar-sync-ui.js'),str(root/'data/events.js')]
    write_files=sorted(set(write_files));caps={f:33554432 if '/data/'in f or '/feeds/'in f else 1048576 for f in write_files}
    node_options='--require='+str(HERE/'control-boundary.cjs')+' --require='+str(guard)
    policy={'mode':'owned-control','sourceRoot':str(SOURCE),'sourceGitSha':SHA,'root':str(root),'runDir':str(run),'tmpDir':str(tmp),'node':old['node'],'nodeVersion':old['nodeVersion'],'nodeSha256':old['nodeSha256'],'sourcePins':pins,'dependencyPins':old['dependencyPins'],'entryArgv':[str(SOURCE/'scripts/quick-results.js'),'--source=live-coverage'],'sourceArgv':[str(SOURCE/'scripts/quick-results.js'),'--source=live-coverage'],'childArgvs':children,'nodeOptions':node_options,'environmentKeys':old['environmentKeys']+['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'],'credentialEnvironmentNames':['SUPABASE_SERVICE_ROLE_KEY'],'writeFiles':write_files,'writeDirectories':sorted({str(pathlib.Path(f).parent)for f in write_files}|{str(root/'data'),str(root/'assets/js'),str(run),str(tmp)}),'writeCaps':caps,'rollbackHashes':{str(root/f):digest(root/f)for f in seeds},'wholeSeconds':3 if name=='hang-child'else 25 if name in['headers-timeout','body-timeout']else 15,'minimumSecondsBeforeLaunch':1,'minimumFreeBytes':int(4.5*1024**3),'maximumNewDiskBytes':268435456,'maxFileBytes':33554432,'http':{'requests':8,'bodyDeadlineMs':10000,'maxCapturedBytes':4194304,'maxCumulativeBytes':16777216,'redirect':'error','retries':0},'controlBoundary':str(HERE/'control-boundary.cjs'),'controlCase':'good'if baseline else name,'controlRuntimeOutputs':assets,'controlOutside':str(parent/'outside.txt'),'publicFixtureShape':str(HERE/'public-fixture-shape.json'),'status':'CONTROLLED_NO_SERVICE_PREPARATION_ONLY'}
    policy['controlCase']=scenario
    policy['coverageSport']=coverageSport
    if coverageSport:
        policy['entryArgv'].append('--coverage-sport=rugby-union');policy['sourceArgv'].append('--coverage-sport=rugby-union')
        policy['publicFixtureShape']=str(HERE/'public-fixture-shape.rugby.json')
        pins[str(HERE/'public-fixture-shape.rugby.json')]=digest(HERE/'public-fixture-shape.rugby.json')
    if scenario=='interrupted-rollback':
        retained=str(root/'data/retained-only.json')
        policy['writeFiles'].remove(retained);policy['writeCaps'].pop(retained)
    policy['credentialEnvironmentNames']=['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY']
    policy['environmentKeys']=sorted(set(policy['environmentKeys']+['SUPABASE_SECRET_KEY']))
    policy['wholeSeconds']=3 if scenario in ['hang-child','interrupted-rollback'] else 25 if scenario in ['headers-timeout','body-timeout'] else 15
    policy['http'].update(origin='https://mkghopnkhcxtmfrcjdbc.supabase.co',rpc='/rest/v1/rpc/nothingsports_read_current_fixtures',method='POST',body={'p_fixture_ids':None},pageSize=500)
    policy['maxRollbackBytes']=33554432
    (parent/'outside.txt').write_text('unchanged\n')
    file=parent/'policy.json';file.write_text(json.dumps(policy,indent=2)+'\n')
    return file,digest(file),policy
if __name__=='__main__':
    name=sys.argv[1];file,h,p=prepare(name,'--baseline'in sys.argv);print(json.dumps({'policy':str(file),'sha256':h}))
