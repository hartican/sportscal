"""Temporary one-use CI carrier. No provider, publisher or credential export."""
import argparse,datetime,hashlib,importlib.util,json,math,os,pathlib,platform,re,secrets,shutil,subprocess,sys
sys.dont_write_bytecode=True
HERE=pathlib.Path(__file__).resolve().parent
SOURCE_SHA='c34bc991643c7f68ba856eec143d76c66ce4fb63'
CARRIER_BASE_SHA='f12d4a39d17bfb16deee281724a32d0a79dff16c'
BRANCH='refs/heads/codex/score-recovery-live-coverage-20261030'
QA_PATH='scripts/qa/score-recovery-20261030'
WORKFLOW='.github/workflows/score-recovery-oneoff.yml'
KEYS=['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY']
CONTROL_CASES=frozenset('auth401 auth403 bad-body bad-filter bad-header bad-limit bad-method bad-offset bad-order bad-origin bad-rpc body-timeout cumulative-exact cumulative-overflow duplicate-key eight-full fd-exports fd-file-secret fetch-error-secret good hang-child header-secret headers-timeout interrupted-rollback invalid-json invalid-utf8 late-array-transport late-capture-corruption late-failure late-invalid-transport late-missing-transport late-output-time late-string-page later-failure legacy-credential native-network outside-write overlap page-exact page-overflow parse-deadline partial-length partial-runtime-failure private-fixture private-nested private-row readback-denied-failure readback-denied-success redirect report-denied-failure report-denied-success row-overflow secret-base64 secret-double-unicode secret-hex-uppercase secret-key-credential secret-percent secret-plain secret-unicode short-pages stdio-secret stream-error-secret unknown-field wrong-type'.split())
ENV={'PATH':'/usr/bin:/bin','LANG':'C','GIT_OPTIONAL_LOCKS':'0','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null'}
def require(ok,code):
    if not ok:raise RuntimeError(code)
def sha(data):return hashlib.sha256(data).hexdigest()
def digest(file):return sha(pathlib.Path(file).read_bytes())
def read(file):return json.loads(pathlib.Path(file).read_text())
def write(file,value):pathlib.Path(file).write_text(json.dumps(value,indent=2,sort_keys=True)+'\n')
def git(root,*args):return subprocess.check_output(['/usr/bin/git',*args],cwd=root,env=ENV,text=True,timeout=10).strip()
def load(name):
    spec=importlib.util.spec_from_file_location(name,HERE/(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def no_keys():require(not any(os.environ.get(k)for k in KEYS+['FOOTBALL_DATA_API_TOKEN']),'REAL_KEYS_NOT_ALLOWED_IN_QUALIFICATION')
def stamp():return datetime.datetime.now(datetime.timezone.utc)
def verify_pins(pins):
    require(all(pathlib.Path(f).is_file()and digest(f)==d for f,d in pins.items()),'PIN_CHANGED')
def captured_bytes(value):return value.encode('utf-8')if isinstance(value,str)else value if isinstance(value,bytes)else b''
def control_failure_witness(phase,result,reason):
    """Export enums, bounded scalars and hashes; never child diagnostic text."""
    require(phase in ['carrier-export-controls','source-shape-controls','linux-controls','selected-model-controls','selected-policy-controls','selected-linux-controls','epl-model-controls','epl-policy-controls','epl-linux-controls']and reason in ['CHILD_EXIT','CHILD_TIMEOUT','CONTROL_RECEIPTS'],'WITNESS_PHASE')
    stdout=captured_bytes(result.stdout);stderr=captured_bytes(result.stderr);rows=[]
    allowed_cases=frozenset(load('epl-linux-controls').CASES)if phase=='epl-linux-controls'else CONTROL_CASES|{'cricket-source','cricket-fixture'}
    bounds={'supervisorExit':(-128,255),'sourceProcessStarts':(0,1),'requests':(0,8),'capturedBytes':(0,16777216),'actualServiceOrProviderRequests':(0,8)}
    for line in stdout.splitlines():
        if len(rows)>=64:break
        if len(line)>8192:continue
        try:value=json.loads(line)
        except(ValueError,UnicodeError,RecursionError):continue
        if not isinstance(value,dict)or not isinstance(value.get('case'),str)or value['case']not in allowed_cases or value.get('status')not in ['PASS','FAIL']:continue
        row={'case':value['case'],'status':value['status']}
        for key,(low,high)in bounds.items():
            if type(value.get(key))is int and low<=value[key]<=high:row[key]=value[key]
        for key in ['groupClosed','rollbackVerified']:
            if type(value.get(key))is bool:row[key]=value[key]
        elapsed=value.get('elapsedSeconds')
        if type(elapsed)in [int,float]and 0<=elapsed<=300 and math.isfinite(elapsed):row['elapsedSeconds']=elapsed
        if value.get('credentialScan')=='CLEAR_RAW_UTF16_BASE64_HEX_UNICODE_PERCENT':row['credentialScan']=value['credentialScan']
        rows.append(row)
    code=getattr(result,'returncode',None)
    witness={'state':'failed','phase':phase,'reason':reason,'returnCode':code if type(code)is int else None,'outputSha256':{'stdout':sha(stdout),'stderr':sha(stderr)},'outputBytes':{'stdout':len(stdout),'stderr':len(stderr)},'completedRecords':rows,'ready':False}
    try:
        public=HERE/'public-evidence';public.mkdir(mode=0o700,exist_ok=True);write(public/(phase+'-failure.json'),witness)
    except OSError:print('Control failure witness could not be saved; qualification remains failed.',file=sys.stderr)
def control_child(phase,argv,timeout):
    code='CARRIER_EXPORT_CONTROLS_FAILED'if phase=='carrier-export-controls'else'LINUX_CONTROLS_FAILED'
    try:result=subprocess.run(argv,env=ENV,capture_output=True,timeout=timeout)
    except subprocess.TimeoutExpired as error:
        control_failure_witness(phase,error,'CHILD_TIMEOUT');raise RuntimeError(code)from None
    if result.returncode!=0:control_failure_witness(phase,result,'CHILD_EXIT');raise RuntimeError(code)
    return result
def binding(qa_root,context=None):
    """ROOT's allocation-only carrier must follow the reviewed QA snapshot."""
    require(os.environ.get('GITHUB_REPOSITORY')=='hartican/sportscal','REPOSITORY')
    require(os.environ.get('GITHUB_EVENT_NAME')=='push'and os.environ.get('GITHUB_REF')==BRANCH,'ONE_USE_PUSH_ONLY')
    require(os.environ.get('GITHUB_RUN_ATTEMPT')=='1','RERUN_NOT_ALLOWED')
    event=read(os.environ['GITHUB_EVENT_PATH']);head=git(qa_root,'rev-parse','HEAD')
    require(event.get('before')==CARRIER_BASE_SHA and event.get('created')is False and event.get('forced')is False and event.get('deleted')is False,'PUSH_BOUNDARY')
    require(event.get('after')==head==os.environ.get('GITHUB_SHA')==os.environ.get('QA_WORKFLOW_SHA'),'HEAD_WORKFLOW_EVENT_AGREEMENT')
    require(re.fullmatch('[a-f0-9]{40}',head)is not None,'HEAD_FORMAT')
    allocation=read(pathlib.Path(qa_root)/QA_PATH/'allocation.json');snapshot=allocation.get('qaSnapshotSha','')
    require(allocation==json.loads(git(qa_root,'show',head+':'+QA_PATH+'/allocation.json')),'ALLOCATION_NOT_COMMITTED')
    require(allocation.get('status')=='ROOT_BOUND_ONE_ATTEMPT'and allocation.get('sourceGitSha')==SOURCE_SHA,'ROOT_ALLOCATION_REQUIRED')
    require(isinstance(snapshot,str)and re.fullmatch('[a-f0-9]{40}',snapshot)is not None,'QA_SNAPSHOT_FORMAT')
    require(git(qa_root,'rev-parse',snapshot+'^')==CARRIER_BASE_SHA and git(qa_root,'rev-parse',head+'^')==snapshot,'EXACT_FAST_FORWARD_LINEAGE')
    require(git(qa_root,'diff','--name-only',snapshot,head)==QA_PATH+'/allocation.json','ALLOCATION_ONLY_CARRIER')
    prior=json.loads(git(qa_root,'show',snapshot+':'+QA_PATH+'/allocation.json'))
    require(prior.get('status')=='UNALLOCATED','SNAPSHOT_NOT_INACTIVE')
    require(isinstance(allocation.get('nonce'),str)and re.fullmatch('[a-f0-9]{64}',allocation['nonce'])is not None,'ROOT_NONCE')
    start=datetime.datetime.fromisoformat(allocation['notBefore']);end=datetime.datetime.fromisoformat(allocation['expiresAt']);now=stamp()
    require(start<=now<end and (end-start).total_seconds()<=900 and (end-now).total_seconds()>=180,'ROOT_WINDOW')
    if context:require(context['carrierSha']==head and context['allocationSha256']==digest(pathlib.Path(qa_root)/QA_PATH/'allocation.json'),'BINDING_CHANGED')
    return allocation,head
def prepare(args):
    no_keys();qa_root=HERE.parents[2];source=pathlib.Path(args.source).resolve();runtime=pathlib.Path(args.runtime).resolve()
    require(not runtime.exists()and source!=runtime,'EXCLUSIVE_RUNTIME')
    allocation,carrier=(None,None)if args.local_controls else binding(qa_root)
    manifest=read(HERE/'assets-manifest.json');profile=read(HERE/'profile.json')
    verify_pins({str(HERE/f):d for f,d in manifest['files'].items()})
    require(digest(qa_root/WORKFLOW)==manifest['workflowSha256'],'WORKFLOW_PIN')
    require(all(digest(HERE/f)==d for f,d in profile['reviewedHelperSha256'].items()),'REVIEWED_HELPER_CHANGED')
    require(git(source,'rev-parse','HEAD')==SOURCE_SHA and not git(source,'status','--porcelain','--untracked-files=no'),'SOURCE_NOT_FROZEN')
    node=pathlib.Path(args.node).resolve()
    probe=json.loads(subprocess.check_output([str(node),'-p','JSON.stringify({version:process.version,platform:process.platform,arch:process.arch})'],env=ENV,text=True,timeout=5))
    require(probe['version']==profile['nodeVersion'],'PINNED_NODE_VERSION')
    if not args.local_controls:require(platform.system()=='Linux'and probe['platform']=='linux'and probe['arch']=='x64','NATIVE_LINUX_X64_REQUIRED')
    pins={str(source/f):d for f,d in profile['sourcePins'].items()};deps={str(source/f):d for f,d in profile['dependencyPins'].items()}
    verify_pins(pins);verify_pins(deps);verify_pins({str(source/f):d for f,d in profile['rollbackHashes'].items()})
    runtime.mkdir(mode=0o700)
    for f in manifest['files']:shutil.copyfile(HERE/f,runtime/f)
    shutil.copyfile(HERE/'assets-manifest.json',runtime/'assets-manifest.json')
    if allocation:shutil.copyfile(HERE/'allocation.json',runtime/'root-allocation.json')
    helpers={str(runtime/f):d for f,d in manifest['files'].items()}
    helpers[str(runtime/'assets-manifest.json')]=digest(runtime/'assets-manifest.json')
    pins.update(helpers)
    context={'sourceRoot':str(source),'qaRoot':str(qa_root),'sourceGitSha':SOURCE_SHA,'carrierSha':carrier,'allocationSha256':digest(HERE/'allocation.json')if allocation else None,'localControlOnly':args.local_controls,'platform':probe,'node':str(node),'nodeVersion':probe['version'],'nodeSha256':digest(node),'sourcePins':pins,'dependencyPins':deps,'helperPins':helpers}
    write(runtime/'runtime-context.json',context)
    print('Prepared frozen source and runtime metadata; no real credential or service request.')
def qualify(args):
    no_keys();require(platform.system()=='Linux','NATIVE_LINUX_REQUIRED');context=read(HERE/'runtime-context.json');verify_pins(context['sourcePins']);verify_pins(context['dependencyPins'])
    control_child('carrier-export-controls',['/usr/bin/python3',str(HERE/'validate-ci-preparation.py'),'--output',str(HERE/'metadata-controls')],60)
    source_shapes=source_shape_controls(context)
    result=control_child('linux-controls',['/usr/bin/python3',str(HERE/'controls.py'),'--suite=linux-port','--all'],240)
    # Never stream diagnostic output. Each actual-source control independently
    # scans its synthetic marker before writing the bounded per-case records.
    try:
        rows=[json.loads(line)for line in result.stdout.splitlines()if line.startswith(b'{')]
        complete=len(rows)==64 and{r.get('case')for r in rows}==CONTROL_CASES and all(r['status']=='PASS'and r['actualServiceOrProviderRequests']==0 for r in rows)
    except(ValueError,UnicodeError,TypeError,KeyError,RecursionError):complete=False
    if not complete:control_failure_witness('linux-controls',result,'CONTROL_RECEIPTS');raise RuntimeError('CONTROL_RECEIPTS')
    selected_models=selected_model_controls(context)
    selected_policy=control_child('selected-policy-controls',['/usr/bin/python3',str(HERE/'validate-selected-policy.py'),'--report',str(HERE/'selected-policy-report.json')],20)
    policy_controls=read(HERE/'selected-policy-report.json')
    require(policy_controls.get('status')=='PASS'and policy_controls.get('checks')==12 and policy_controls.get('sourceExecutions')==0,'SELECTED_POLICY_RECEIPTS')
    selected_linux=control_child('selected-linux-controls',['/usr/bin/python3',str(HERE/'selected-linux-controls.py')],180)
    selected_controls=read(HERE/'selected-linux-results.json');selected_cases=load('selected-linux-controls').CASES
    selected_rows=[json.loads(line)for line in selected_linux.stdout.splitlines()if line.startswith(b'{')]
    require(selected_controls.get('status')=='PASS'and selected_controls.get('coverageSport')=='rugby-union'and len(selected_rows)==len(selected_cases)==25 and {r.get('case')for r in selected_rows}==set(selected_cases)and all(r.get('status')=='PASS'and r.get('actualServiceOrProviderRequests')==0 for r in selected_rows),'SELECTED_LINUX_RECEIPTS')
    epl_controls=qualify_epl(context)
    verify_pins(context['sourcePins']);verify_pins(context['dependencyPins'])
    require(not git(context['sourceRoot'],'status','--porcelain','--untracked-files=no'),'CONTROL_SOURCE_CHANGED')
    qualification={'status':'PASS_LOCAL_CONTROLS_ONLY'if context['localControlOnly']else'PASS_DEFAULT64_SELECTED25_NATIVE_LINUX_NO_SERVICE_CONTROLS','source':SOURCE_SHA,'coverageSport':'rugby-union','nodeSha256':context['nodeSha256'],'platform':context['platform'],'sourcePins':context['sourcePins'],'cases':rows,'carrierExportControls':read(HERE/'metadata-controls/metadata-controls.json'),'sourceShapeControls':source_shapes,'selectedModelControls':selected_models,'selectedPolicyControls':policy_controls,'selectedLinuxControls':selected_controls,'eplControls':epl_controls,'actualServiceRequests':0}
    write(HERE/'qualification.json',qualification)
    public=HERE/'public-evidence';public.mkdir(mode=0o700,exist_ok=True)
    write(public/'controls.json',qualification)
    if not context['localControlOnly']:
        binding(context['qaRoot'],context);build_epl_policy(context)
        if args.github_output:
            with open(args.github_output,'a')as out:out.write('ready=true\n')
    print('Default64 and selected25 native controls passed with selected model and policy checks; no real service request. Actual acceptance remains separate.')
def selected_model_controls(context):
    no_keys();marker='sb_secret_'+secrets.token_urlsafe(36);report=HERE/'selected-model-report.json'
    try:result=subprocess.run([context['node'],str(HERE/'validate-selected-rugby.cjs'),'--source-root',context['sourceRoot'],'--report',str(report)],env={**ENV,'NS_SELECTED_TEST_KEY':marker},capture_output=True,timeout=60)
    except subprocess.TimeoutExpired as error:
        control_failure_witness('selected-model-controls',error,'CHILD_TIMEOUT');raise RuntimeError('SELECTED_MODEL_CONTROLS_FAILED')from None
    scanner=load('credential-scan');scanner.selftest(marker)
    require(not any(scanner.contains(b,marker)for b in[captured_bytes(result.stdout),captured_bytes(result.stderr),report.read_bytes()if report.exists()else b'']),'SELECTED_MODEL_EXPORT_REFUSED')
    if result.returncode!=0:control_failure_witness('selected-model-controls',result,'CHILD_EXIT');raise RuntimeError('SELECTED_MODEL_CONTROLS_FAILED')
    value=read(report);require(value.get('status')=='PASS'and value.get('checks')==33 and value.get('realKeys')==value.get('realServiceRequests')==value.get('nativeAttempts')==0,'SELECTED_MODEL_RECEIPTS')
    for row in value.get('rejections',[]):validate_shape_diagnostics(row,'rugby-union')
    public=HERE/'public-evidence';public.mkdir(mode=0o700,exist_ok=True);write(public/'selected-model-controls.json',value)
    return value
def source_shape_controls(context):
    no_keys();marker='sb_secret_'+secrets.token_urlsafe(36);report=HERE/'source-shape-report.json'
    argv=[context['node'],str(HERE/'validate-source-shapes.cjs'),'--source-root',context['sourceRoot'],'--report',str(report)]
    try:result=subprocess.run(argv,env={**ENV,'NS_SOURCE_SHAPE_TEST_KEY':marker},capture_output=True,timeout=60)
    except subprocess.TimeoutExpired as error:
        control_failure_witness('source-shape-controls',error,'CHILD_TIMEOUT');raise RuntimeError('SOURCE_SHAPE_CONTROLS_FAILED')from None
    scanner=load('credential-scan');scanner.selftest(marker)
    require(not any(scanner.contains(b,marker)for b in [captured_bytes(result.stdout),captured_bytes(result.stderr),report.read_bytes()if report.exists()else b'']),'SOURCE_SHAPE_CONTROL_EXPORT_REFUSED')
    if report.exists():
        value=read(report)
        for row in value.get('rejections',[]):validate_shape_diagnostics(row)
        public=HERE/'public-evidence';public.mkdir(mode=0o700,exist_ok=True);write(public/'source-shape-controls.json',value)
    if result.returncode!=0:control_failure_witness('source-shape-controls',result,'CHILD_EXIT');raise RuntimeError('SOURCE_SHAPE_CONTROLS_FAILED')
    value=read(report);require(value.get('status')=='PASS'and value.get('checks')==26 and value.get('realServiceRequests')==0 and value.get('realKeys')==0,'SOURCE_SHAPE_CONTROL_RECEIPTS')
    return value
def validate_shape_diagnostics(record,coverageSport=None):
    """A new diagnostic is fixed enums, schema indices and bounded counts only."""
    if not isinstance(record,dict):return
    if 'shapeFailure'in record or 'shapeFailures'in record:
        require(coverageSport in[None,'rugby-union'],'SHAPE_DIAGNOSTIC_SCOPE')
        schema=read(HERE/('public-fixture-shape.rugby.json'if coverageSport else'public-fixture-shape.json'));paths=sorted(schema['paths']);limit=schema['maxNodes']
        def descriptor(value,count=False):
            require(isinstance(value,dict),'SHAPE_DIAGNOSTIC')
            reason=value.get('reason');field='parentIndex'if reason=='UNKNOWN_PATH'else'pathIndex'
            require(reason in ['UNKNOWN_PATH','TYPE_NOT_ALLOWED','NON_FINITE_NUMBER']and set(value)=={'reason',field,'actualType'}|({'count'}if count else set()),'SHAPE_DIAGNOSTIC')
            index=value[field];kind=value['actualType']
            require(type(index)is int and 0<=index<len(paths)and kind in ['null','array','object','number','string','boolean'],'SHAPE_DIAGNOSTIC')
            if reason=='UNKNOWN_PATH':require(any(k in schema['paths'][paths[index]]for k in ['object','array']),'SHAPE_DIAGNOSTIC')
            if reason=='NON_FINITE_NUMBER':require(kind=='number'and kind in schema['paths'][paths[index]],'SHAPE_DIAGNOSTIC')
            if reason=='TYPE_NOT_ALLOWED':require(kind not in schema['paths'][paths[index]],'SHAPE_DIAGNOSTIC')
            if count:require(type(value['count'])is int and 1<=value['count']<=limit,'SHAPE_DIAGNOSTIC')
        require(record.get('error',record.get('code'))=='POST_GUARD_FIXTURE_SHAPE','SHAPE_DIAGNOSTIC')
        descriptor(record.get('shapeFailure'));summary=record.get('shapeFailures')
        require(isinstance(summary,dict)and set(summary)=={'descriptors','totalRefusals','overflowCount','knownScanComplete'},'SHAPE_DIAGNOSTIC')
        rows=summary['descriptors'];total=summary['totalRefusals'];overflow=summary['overflowCount']
        require(isinstance(rows,list)and 1<=len(rows)<=16 and type(total)is int and 1<=total<=limit and type(overflow)is int and 0<=overflow<total and type(summary['knownScanComplete'])is bool,'SHAPE_DIAGNOSTIC')
        for row in rows:descriptor(row,True)
        signatures=[{k:v for k,v in row.items()if k!='count'}for row in rows]
        require(signatures[0]==record['shapeFailure']and len({json.dumps(v,sort_keys=True)for v in signatures})==len(rows)and sum(v['count']for v in rows)+overflow==total,'SHAPE_DIAGNOSTIC')
    if isinstance(record.get('pages'),list):
        for page in record['pages']:validate_shape_diagnostics(page,coverageSport)
def build_policy(context):
    profile=read(HERE/'profile.json');source=pathlib.Path(context['sourceRoot']);supervisor=load('supervisor');run=HERE/'actual-run-one'
    require(not run.exists(),'ACTUAL_ATTEMPT_ALREADY_STARTED')
    before=supervisor.manifest(source);write(HERE/'actual-baseline-manifest.json',{'files':before})
    p={k:profile[k]for k in ['sourceGitSha','baseGitSha','coverageSport','entryArgv','sourceArgv','childArgvs','environmentKeys','credentialEnvironmentNames','wholeSeconds','minimumSecondsBeforeLaunch','minimumFreeBytes','maximumNewDiskBytes','maxRollbackBytes','maxFileBytes','http']}
    p.update(mode='live-coverage-canonical',root=str(source),sourceRoot=str(source),runDir=str(run),tmpDir=str(run/'tmp'),node=context['node'],nodeVersion=context['nodeVersion'],nodeSha256=context['nodeSha256'],nodeOptions='--require='+str(HERE/'guard.cjs'),sourcePins={**context['sourcePins'],str(HERE/'runtime-context.json'):digest(HERE/'runtime-context.json'),str(HERE/'qualification.json'):digest(HERE/'qualification.json'),str(HERE/'root-allocation.json'):digest(HERE/'root-allocation.json')},dependencyPins=context['dependencyPins'],baselineManifest=str(HERE/'actual-baseline-manifest.json'),baselineManifestSha256=digest(HERE/'actual-baseline-manifest.json'),writeFiles=[str(source/f)for f in profile['writeFiles']],writeCaps={str(source/f):cap for f,cap in profile['writeCaps'].items()},rollbackHashes={str(source/f):d for f,d in profile['rollbackHashes'].items()},publicFixtureShape=str(HERE/'public-fixture-shape.json'))
    p['publicFixtureShape']=str(HERE/'public-fixture-shape.rugby.json')
    supervisor.validate_route(p,HERE/'actual-policy.json')
    p['writeDirectories']=sorted({str(pathlib.Path(f).parent)for f in p['writeFiles']}|{str(run),str(run/'tmp')})
    write(HERE/'actual-policy.json',p)
    grant=read(HERE/'root-allocation.json')
    write(HERE/'actual-grant.json',{'policySha256':digest(HERE/'actual-policy.json'),'sourceGitSha':SOURCE_SHA,'scope':'one-live-coverage-canonical-local-only','requestId':grant['nonce']+':'+os.environ['GITHUB_RUN_ID'],'minimumFreeBytes':p['minimumFreeBytes'],'notBefore':grant['notBefore'],'expiresAt':grant['expiresAt']})
    check=subprocess.run(['/usr/bin/python3',str(HERE/'supervisor.py'),'--policy',str(HERE/'actual-policy.json'),'--expected-sha256',digest(HERE/'actual-policy.json'),'--inspect'],env=ENV,text=True,capture_output=True,timeout=25)
    require(check.returncode==0,'SECRETLESS_PREFLIGHT_FAILED');receipt=json.loads(check.stdout)
    require(receipt['nodeStarts']==0 and not run.exists(),'INSPECT_EXECUTED')
    write(HERE/'public-evidence/preflight.json',receipt)
def export_public(p,result,keys):
    scanner=load('credential-scan');run=pathlib.Path(p['runDir']);public=HERE/'public-evidence';source=pathlib.Path(p['sourceRoot'])
    for key in keys:scanner.selftest(key)
    def safe(data):return not any(scanner.contains(data,key)for key in keys)
    receipt=json.loads(result.stdout)
    require(isinstance(receipt,dict)and(receipt.get('source')==SOURCE_SHA or receipt.get('source')is None and receipt.get('nodeStarts')==0 and receipt.get('state')=='failed'),'ACTUAL_RECEIPT')
    changed=receipt.get('changedPaths')or[]
    generated=set(p['writeFiles'])
    require(isinstance(changed,list)and all(isinstance(f,str)and str(source/f)in generated for f in changed),'GENERATED_EXPORT_SCOPE')
    candidates=list(run.rglob('*'))+[source/f for f in changed]
    for f in candidates:
        if f.is_file():
            require(not f.is_symlink()and f.stat().st_size<=33554432 and safe(f.read_bytes()),'INDEPENDENT_SECRET_SCAN')
            if f.name=='first-error.json'or re.fullmatch(r'(?:page-\d+|transport-\d+)\.json',f.name):validate_shape_diagnostics(read(f),p.get('coverageSport'))
    require(safe(result.stdout.encode())and safe(result.stderr.encode()),'INDEPENDENT_DIAGNOSTIC_SCAN')
    inventory={}
    def copy(file,name):
        body=file.read_bytes();require(safe(body),'INDEPENDENT_SECRET_SCAN');target=public/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body);inventory[name]={'sha256':sha(body),'bytes':len(body)}
    for file in run.glob('page-*.json'):
        page=read(file);copy(file,'receipts/'+file.name)
        raw=file.with_suffix('.raw')
        if raw.exists():
            require(all(page.get(k)is True for k in ['bodyComplete','guardParsed','consumerParsed','readerReleased','captureFileClosed','captureFileOpened'])and digest(raw)==page['sha256'],'PUBLIC_CAPTURE_PROOF')
            copy(raw,'capture/'+raw.name)
    for name in ['result.json','first-error.json','refresh-report.json','quick-results-report.json']:
        if(run/name).exists():copy(run/name,'receipts/'+name)
    for file in run.glob('transport-*.json'):copy(file,'receipts/'+file.name)
    for rel in receipt.get('changedPaths')or[]:
        file=source/rel;require(str(file)in generated and not file.is_symlink(),'GENERATED_EXPORT_SCOPE')
        if file.exists():copy(file,'generated/'+rel)
    allowed=set(p['writeFiles'])|set(p['rollbackHashes'])
    for label in ['before','after']:
        file=run/(label+'-manifest.json')
        if label=='before'and not file.exists():file=pathlib.Path(p['baselineManifest'])
        rows=read(file)['files'];write(public/(label+'-generated-hashes.json'),{'files':[r for r in rows if str(source/r['path'])in allowed]})
    write(public/'attempt.json',{'source':SOURCE_SHA,'policySha256':digest(HERE/'actual-policy.json'),'state':receipt['state'],'exitCode':result.returncode,'processGroupClosed':receipt['processGroupClosed'],'rollback':receipt['rollback'],'changedPaths':receipt['changedPaths'],'independentSecretScan':'CLEAR','inventory':inventory,'publication':'NONE; local candidate only'})
    return result.returncode
def qualify_epl(context):
    no_keys();require(context['sourceGitSha']==SOURCE_SHA,'EPL_CURRENT_SOURCE_REQUIRED')
    model=control_child('epl-model-controls',[context['node'],str(HERE/'validate-epl-contract.cjs'),context['sourceRoot']],30)
    adapter=control_child('epl-model-controls',[context['node'],str(HERE/'validate-epl-transport.cjs'),context['sourceRoot']],30)
    integration=control_child('epl-model-controls',[context['node'],str(HERE/'validate-epl-integration.cjs')],30)
    policy=control_child('epl-policy-controls',['/usr/bin/python3',str(HERE/'validate-epl-policy.py')],30)
    values=[json.loads(value.stdout)for value in[model,adapter,integration,policy]]
    require(all(value.get('status')=='PASS'and value.get('actualProviderRequests',0)==0 for value in values),'EPL_MODEL_RECEIPTS')
    native=control_child('epl-linux-controls',['/usr/bin/python3',str(HERE/'epl-linux-controls.py')],180)
    value=read(HERE/'epl-linux-results.json');cases=load('epl-linux-controls').CASES
    require(value.get('status')=='PASS'and value.get('source')==SOURCE_SHA and len(value['records'])==len(cases)and {r['case']for r in value['records']}==set(cases)and all(r['status']=='PASS'and r['actualServiceOrProviderRequests']==0 for r in value['records']),'EPL_NATIVE_RECEIPTS')
    result={'status':'PASS','source':SOURCE_SHA,'models':values,'native':value,'actualProviderRequests':0}
    public=HERE/'public-evidence';public.mkdir(mode=0o700,exist_ok=True);write(public/'epl-controls.json',result);return result

def build_epl_policy(context):
    profile=read(HERE/'epl-profile.json');source=pathlib.Path(context['sourceRoot']);supervisor=load('supervisor');run=HERE/'actual-run-one'
    require(not run.exists(),'ACTUAL_ATTEMPT_ALREADY_STARTED')
    before=supervisor.manifest(source);write(HERE/'actual-baseline-manifest.json',{'files':before})
    keys=['sourceGitSha','sourceProtocol','entryArgv','sourceArgv','environmentKeys','credentialEnvironmentNames','wholeSeconds','minimumSecondsBeforeLaunch','minimumFreeBytes','maximumNewDiskBytes','maxRollbackBytes','maxFileBytes','http','surfaceIds','surfaceBindings','runtimeOutputs']
    p={k:profile[k]for k in keys}
    p.update(mode='epl-canonical',baseGitSha=profile['acceptedMain'],root=str(source),sourceRoot=str(source),runDir=str(run),tmpDir=str(run/'tmp'),node=context['node'],nodeVersion=context['nodeVersion'],nodeSha256=context['nodeSha256'],nodeOptions='--require='+str(HERE/'guard.cjs'),childArgvs=[profile['sourceArgv']],sourcePins={**context['sourcePins'],str(HERE/'runtime-context.json'):digest(HERE/'runtime-context.json'),str(HERE/'qualification.json'):digest(HERE/'qualification.json'),str(HERE/'root-allocation.json'):digest(HERE/'root-allocation.json')},dependencyPins=context['dependencyPins'],baselineManifest=str(HERE/'actual-baseline-manifest.json'),baselineManifestSha256=digest(HERE/'actual-baseline-manifest.json'),writeFiles=[str(source/f)for f in profile['writeFiles']],writeCaps={str(source/f):v for f,v in profile['writeCaps'].items()},rollbackHashes={str(source/f):v['sha256']for f,v in profile['rollbackInventory'].items()})
    p['writeDirectories']=sorted({str(pathlib.Path(f).parent)for f in p['writeFiles']}|{str(run),str(run/'tmp')})
    supervisor.validate_route(p,HERE/'actual-policy.json');write(HERE/'actual-policy.json',p)
    grant=read(HERE/'root-allocation.json');write(HERE/'actual-grant.json',{'policySha256':digest(HERE/'actual-policy.json'),'sourceGitSha':SOURCE_SHA,'scope':'one-epl-canonical-local-only','requestId':grant['nonce']+':'+os.environ['GITHUB_RUN_ID'],'minimumFreeBytes':p['minimumFreeBytes'],'notBefore':grant['notBefore'],'expiresAt':grant['expiresAt']})
    result=subprocess.run(['/usr/bin/python3',str(HERE/'supervisor.py'),'--policy',str(HERE/'actual-policy.json'),'--expected-sha256',digest(HERE/'actual-policy.json'),'--inspect'],env=ENV,text=True,capture_output=True,timeout=25)
    try:receipt=json.loads(result.stdout)
    except(ValueError,TypeError):receipt={}
    metrics=receipt.get('preflight')if isinstance(receipt,dict)else{}
    metrics=metrics if isinstance(metrics,dict)else{}
    safe_metrics={k:v for k,v in metrics.items()if k in['availableBytes','requiredBytes','remainingSecondsBeforeLaunch','availableBytesBeforeLaunch']and type(v)in[int,float]and math.isfinite(v)and 0<=v<=9007199254740991}
    write(HERE/'public-evidence/preflight.json',{'source':SOURCE_SHA,'state':'PREPARED_NOT_EXECUTED'if result.returncode==0 else'PREPARED_BUT_BLOCKED','nodeStarts':0,'providerGETs':0,'failureCategory':None if result.returncode==0 else'EPL_PREFLIGHT_FAILED','preflight':safe_metrics,'outputSha256':sha(result.stdout.encode())})
    require(result.returncode==0,'EPL_KEYLESS_PREFLIGHT_FAILED')
    require(receipt['nodeStarts']==0 and not run.exists(),'EPL_INSPECT_EXECUTED')

def epl_resource_public(row):
    base={'resource','httpStatus','encoding','state','wireBytes','decodedBytes','elapsedMs','wireSha256','decodedSha256','bodyComplete','guardParsed','consumerParsed','readerClosed','requestClosed','decoderClosed'}
    require(isinstance(row,dict)and set(row)==base|({'code'}if row.get('state')=='failed'else set()),'EPL_PUBLIC_RESOURCE')
    require(type(row['resource'])is int and 0<=row['resource']<=4 and row['state']in['failed','complete'],'EPL_PUBLIC_RESOURCE')
    require(row['httpStatus']is None or type(row['httpStatus'])is int and 100<=row['httpStatus']<=599,'EPL_PUBLIC_RESOURCE')
    require(row['encoding']in[None,'identity','gzip','deflate','br','unapproved'],'EPL_PUBLIC_RESOURCE')
    cap=147456 if row['resource']==4 else 884736
    require(all(type(row[k])is int and 0<=row[k]<=cap+(row['state']=='failed')for k in['wireBytes','decodedBytes']),'EPL_PUBLIC_RESOURCE')
    require(type(row['elapsedMs'])in[int,float]and math.isfinite(row['elapsedMs'])and 0<=row['elapsedMs']<=20000,'EPL_PUBLIC_RESOURCE')
    require(all(isinstance(row[k],str)and re.fullmatch('[a-f0-9]{64}',row[k])for k in['wireSha256','decodedSha256']),'EPL_PUBLIC_RESOURCE')
    require(all(type(row[k])is bool for k in['bodyComplete','guardParsed','consumerParsed','readerClosed','requestClosed','decoderClosed']),'EPL_PUBLIC_RESOURCE')
    if row['state']=='failed':require(row['code']in load('epl-supervisor').CODES,'EPL_PUBLIC_RESOURCE')
    else:require(all(row[k]for k in['bodyComplete','guardParsed','consumerParsed','readerClosed','requestClosed','decoderClosed']),'EPL_PUBLIC_RESOURCE')
    return row

def epl_public_clock(value):
    require(isinstance(value,str)and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})',value)is not None,'EPL_PUBLIC_CLOCK')
    datetime.datetime.fromisoformat(value.replace('Z','+00:00'));return value

def epl_public_facts(document,p,file):
    require(isinstance(document,dict)and isinstance(document.get('events'),list),'EPL_PUBLIC_FACTS')
    events={e.get('id'):e for e in document['events']if isinstance(e,dict)};rows=[]
    for id in p['surfaceIds'][file]:
        event=events[id];binding=p['surfaceBindings'][file][id]
        require(all(event.get(k)==v for k,v in binding.items()),'EPL_PUBLIC_FACT_BINDING')
        require(event.get('status')in['upcoming','completed','live','break'],'EPL_PUBLIC_FACT_STATUS')
        row={'id':id,**binding,'status':event['status'],'startTimeUtc':epl_public_clock(event['startTimeUtc']),'recordSha256':sha(json.dumps(event,sort_keys=True,separators=(',',':')).encode())}
        for k in['sourceCheckedAt','canonicalSourceCheckedAt','scoreCheckedAt','resultSourceCheckedAt','statusCheckedAt']:
            if event.get(k)is not None:row[k]=epl_public_clock(event[k])
        if 'homeScore'in event or'awayScore'in event:
            require(all(type(event.get(k))is int and 0<=event[k]<=9007199254740991 for k in['homeScore','awayScore']),'EPL_PUBLIC_NUMERIC_RESULT')
            row.update(homeScore=event['homeScore'],awayScore=event['awayScore'])
        rows.append(row)
    require(len(rows)==380,'EPL_PUBLIC_FACTS');return rows

def export_epl_public(p,result):
    # Typed projection only. Never copy stdout/stderr/raw bodies, free-form app
    # failure text, new club labels, whole generated files or account records.
    receipt=json.loads(result.stdout);run=pathlib.Path(p['runDir']);source=pathlib.Path(p['sourceRoot']);public=HERE/'public-evidence';public.mkdir(mode=0o700,exist_ok=True)
    require(receipt.get('source')in[None,SOURCE_SHA]and receipt.get('state')in['failed','candidate-finished-pending-review'],'EPL_PUBLIC_ATTEMPT')
    allowed={str(pathlib.Path(f).relative_to(source))for f in p['writeFiles']};changed=receipt.get('changedPaths')or[]
    require(isinstance(changed,list)and all(isinstance(f,str)and f in allowed for f in changed),'EPL_PUBLIC_CHANGED_PATH')
    resources=[epl_resource_public(read(f))for f in sorted(run.glob('page-*.json'))]
    require(len(resources)<=5 and len({r['resource']for r in resources})==len(resources)and not list(run.glob('*.raw')),'EPL_PUBLIC_RAW_FORBIDDEN')
    write(public/'epl-resources.json',{'source':SOURCE_SHA,'resources':resources,'bodyExported':False})
    for file in ['feeds/incoming/events.json','data/events.json']:
        write(public/('epl-'+('incoming'if file.startswith('feeds/')else'published')+'-facts.json'),{'source':SOURCE_SHA,'state':receipt['state'],'factsFrom':'candidate'if receipt['state']=='candidate-finished-pending-review'else'restored-or-failed-candidate','fixtures':epl_public_facts(read(source/file),p,file)})
    bundle=read(source/'data/canonical/afl-nrl-2026.json');snap=next(row for row in bundle['ladderSnapshots']if row['competitionId']=='competition:premier-league-2026-27');entries=[]
    ids={side for value in p['surfaceBindings']['data/events.json'].values()for side in value['participantIds']}
    for row in snap['entries']:
        require(row['participantId']in ids,'EPL_PUBLIC_TABLE');entry={'participantId':row['participantId']}
        for k in['rank','sortOrder','played','won','drawn','lost','pointsFor','pointsAgainst','pointsDifference','ladderPoints']:
            if k in row:require(type(row[k])is int and abs(row[k])<=9007199254740991,'EPL_PUBLIC_TABLE');entry[k]=row[k]
        for k in['sharedRank','rankPending']:
            if k in row:require(type(row[k])is bool,'EPL_PUBLIC_TABLE');entry[k]=row[k]
        entries.append(entry)
    require(len(entries)==20 and len({e['participantId']for e in entries})==20,'EPL_PUBLIC_TABLE')
    write(public/'epl-table-facts.json',{'source':SOURCE_SHA,'competitionId':snap['competitionId'],'snapshotTimeUtc':epl_public_clock(snap['snapshotTimeUtc']),'entries':entries})
    generated={}
    for rel in changed:
        f=source/rel;require(f.is_file()and not f.is_symlink()and f.stat().st_size<=33554432,'EPL_PUBLIC_GENERATED_HASH');generated[rel]={'sha256':digest(f),'bytes':f.stat().st_size}
    write(public/'generated-hashes.json',{'source':SOURCE_SHA,'files':generated,'bytesExported':False})
    # Stage/resource-state enums and numeric counts preserve partial evidence
    # without copying raw provider codes, missing labels or app error messages.
    report=read(run/'quick-results-report.json')if(run/'quick-results-report.json').exists()else{}
    deferred=[];codes={'UNREVIEWED_STATUS','UNREVIEWED_PHASE','INCOMPLETE_LIVE_SCORE','MISSING_KICKOFF','INVALID_KICKOFF','MISSING_CLUB_LABEL','INCOMPLETE_FINAL_SCORE'}
    known=set(p['surfaceIds']['data/events.json'])|set(p['surfaceIds']['feeds/incoming/events.json'])
    for row in report.get('deferredFixtures',[]):
        require(row.get('fixtureId')in known and row.get('reasonCode')in codes,'EPL_PUBLIC_DEFERRED');deferred.append({'fixtureId':row['fixtureId'],'reasonCode':row['reasonCode']})
    require(len(deferred)<=380,'EPL_PUBLIC_DEFERRED')
    states={}
    for key in['fixtures','table']:
        value=report.get('resources',{}).get(key,{}).get('state')
        if value is not None:require(value in['primary','partial-primary','retained-last-good','primary-with-retained-delayed-overlay'],'EPL_PUBLIC_SOURCE_STATE');states[key]=value
    guard_codes=read(HERE/'epl-profile.json')['exportGuardCodes']
    guard_code=(receipt.get('firstGuardError')or{}).get('code')
    guard_code=guard_code if guard_code in guard_codes else 'GUARD_PROCESS_FAILURE'if guard_code else None
    gate_steps=set(read(HERE/'epl-profile.json')['exportGateSteps'])
    failed_step='scripts/quick-results.js'
    if (run/'guard-ledger.jsonl').exists():
        for line in (run/'guard-ledger.jsonl').read_text().splitlines():
            record=json.loads(line)
            if record.get('state')=='child'and isinstance(record.get('argv'),list)and record['argv']and record['argv'][0]in gate_steps:failed_step=record['argv'][0]
    write(public/'attempt.json',{'source':SOURCE_SHA,'firstGuardCode':guard_code,'failedStep':failed_step if receipt['state']=='failed'else None,'policySha256':digest(HERE/'actual-policy.json'),'state':receipt['state'],'exitCode':result.returncode,'processGroupClosed':receipt.get('processGroupClosed')is True,'rollbackVerified':receipt.get('rollback',{}).get('verified')is True,'changedPaths':changed,'resources':states,'deferredFixtures':deferred,'failureCategory':None if receipt['state']=='candidate-finished-pending-review'else'EPL_RUNTIME_FAILED','keyless':True,'typedPublicProjectionOnly':True,'publication':'NONE; local candidate only'})
    return result.returncode

def actual(args):
    no_keys();context=read(HERE/'runtime-context.json');require(not context['localControlOnly']and platform.system()=='Linux'and context['platform']['platform']=='linux','LINUX_QUALIFICATION_REQUIRED')
    binding(context['qaRoot'],context);qualification=read(HERE/'qualification.json')
    require(qualification['status']=='PASS_DEFAULT64_SELECTED25_NATIVE_LINUX_NO_SERVICE_CONTROLS'and qualification.get('source')==SOURCE_SHA and all(qualification.get(k,{}).get('status')=='PASS'for k in['sourceShapeControls','selectedModelControls','selectedPolicyControls','selectedLinuxControls','eplControls']),'QUALIFICATION_REQUIRED')
    verify_pins(context['sourcePins']);verify_pins(context['dependencyPins']);p=read(HERE/'actual-policy.json');require(p['mode']=='epl-canonical'and not pathlib.Path(p['runDir']).exists(),'ACTUAL_ATTEMPT_ALREADY_STARTED')
    with(HERE/'actual-step-claimed').open('x')as out:out.write('one keyless ROOT-bound EPL attempt\n')
    result=subprocess.run(['/usr/bin/python3',str(HERE/'supervisor.py'),'--policy',str(HERE/'actual-policy.json'),'--expected-sha256',digest(HERE/'actual-policy.json'),'--allocation',str(HERE/'actual-grant.json')],env=ENV,text=True,capture_output=True)
    try:return export_epl_public(p,result)
    except Exception:
        public=HERE/'public-evidence'
        if public.exists():shutil.rmtree(public)
        public.mkdir(mode=0o700);write(public/'attempt.json',{'source':SOURCE_SHA,'state':'PUBLIC_EXPORT_WITHHELD','reason':'EPL_TYPED_EXPORT_FAILED','publication':'NONE','exitCode':result.returncode})
        return 1
def main():
    os.umask(0o077);ap=argparse.ArgumentParser();ap.add_argument('command',choices=['prepare','qualify','actual']);ap.add_argument('--source');ap.add_argument('--node');ap.add_argument('--runtime');ap.add_argument('--local-controls',action='store_true');ap.add_argument('--github-output');args=ap.parse_args()
    try:
        if args.command=='prepare':prepare(args)
        elif args.command=='qualify':qualify(args)
        else:return actual(args)
        return 0
    except Exception as error:
        code=str(error)if isinstance(error,RuntimeError)and re.fullmatch('[A-Z0-9_]{1,80}',str(error))else'QA_BOUNDARY_FAILURE'
        print('One-use QA stopped: '+code+'. No credential or raw diagnostic exported.',file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
