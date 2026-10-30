"""Owned metadata/export controls. No CI, key discovery or real request."""
import argparse,contextlib,datetime,hashlib,importlib.util,io,json,os,pathlib,secrets,shutil,subprocess,tempfile,unittest
from unittest.mock import patch
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ci_candidate',HERE/'ci.py');ci=importlib.util.module_from_spec(spec);spec.loader.exec_module(ci)
OUTPUT=None
def command(root,*argv):return subprocess.check_output(['/usr/bin/git','-c','user.name=Owned QA','-c','user.email=qa@example.invalid','-c','commit.gpgSign=false',*argv],cwd=root,env=ci.ENV,text=True).strip()
class Binding(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='binding-',dir=OUTPUT);self.addCleanup(self.tmp.cleanup);self.root=pathlib.Path(self.tmp.name)
        command(self.root,'init','-q');command(self.root,'commit','--allow-empty','-qm','owned source');self.base=command(self.root,'rev-parse','HEAD')
        self.file=self.root/ci.QA_PATH/'allocation.json';self.file.parent.mkdir(parents=True);ci.write(self.file,{'status':'UNALLOCATED'});command(self.root,'add','.');command(self.root,'commit','-qm','inactive QA snapshot');self.snapshot=command(self.root,'rev-parse','HEAD')
        now=ci.stamp();self.allocation={'status':'ROOT_BOUND_ONE_ATTEMPT','sourceGitSha':ci.SOURCE_SHA,'qaSnapshotSha':self.snapshot,'nonce':'a'*64,'notBefore':(now-datetime.timedelta(seconds=10)).isoformat(),'expiresAt':(now+datetime.timedelta(seconds=600)).isoformat()}
        ci.write(self.file,self.allocation);command(self.root,'add','.');command(self.root,'commit','-qm','allocation-only carrier');self.head=command(self.root,'rev-parse','HEAD')
        self.event={'before':self.base,'after':self.head,'created':False,'forced':False,'deleted':False};self.event_file=self.root/'event.json';ci.write(self.event_file,self.event)
        self.env={'GITHUB_REPOSITORY':'hartican/sportscal','GITHUB_EVENT_NAME':'push','GITHUB_REF':ci.BRANCH,'GITHUB_RUN_ATTEMPT':'1','GITHUB_EVENT_PATH':str(self.event_file),'GITHUB_SHA':self.head,'QA_WORKFLOW_SHA':self.head}
    def call(self):
        ci.write(self.event_file,self.event)
        with patch.object(ci,'CARRIER_BASE_SHA',self.base),patch.dict(os.environ,self.env,clear=True):return ci.binding(self.root)
    def rebind(self):
        ci.write(self.file,self.allocation);command(self.root,'add',ci.QA_PATH+'/allocation.json');command(self.root,'commit','--amend','--no-edit','-q')
        self.head=command(self.root,'rev-parse','HEAD');self.event['after']=self.head;self.env.update(GITHUB_SHA=self.head,QA_WORKFLOW_SHA=self.head)
    def denied(self,code):
        with self.assertRaisesRegex(RuntimeError,'^'+code+'$'):self.call()
    def test_exact_allocation_only_fast_forward(self):self.assertEqual(self.call()[1],self.head)
    def test_before_is_consumed(self):self.event['before']='0'*40;self.denied('PUSH_BOUNDARY')
    def test_created_branch_refused(self):self.event['created']=True;self.denied('PUSH_BOUNDARY')
    def test_forced_refused(self):self.event['forced']=True;self.denied('PUSH_BOUNDARY')
    def test_deleted_refused(self):self.event['deleted']=True;self.denied('PUSH_BOUNDARY')
    def test_rerun_refused(self):self.env['GITHUB_RUN_ATTEMPT']='2';self.denied('RERUN_NOT_ALLOWED')
    def test_foreign_repository_refused(self):self.env['GITHUB_REPOSITORY']='other/sportscal';self.denied('REPOSITORY')
    def test_other_branch_refused(self):self.env['GITHUB_REF']='refs/heads/main';self.denied('ONE_USE_PUSH_ONLY')
    def test_workflow_mismatch_refused(self):self.env['QA_WORKFLOW_SHA']=self.base;self.denied('HEAD_WORKFLOW_EVENT_AGREEMENT')
    def test_event_head_mismatch_refused(self):self.event['after']=self.base;self.denied('HEAD_WORKFLOW_EVENT_AGREEMENT')
    def test_unallocated_refused(self):self.allocation['status']='UNALLOCATED';self.rebind();self.denied('ROOT_ALLOCATION_REQUIRED')
    def test_other_source_refused(self):self.allocation['sourceGitSha']='0'*40;self.rebind();self.denied('ROOT_ALLOCATION_REQUIRED')
    def test_nonce_required(self):self.allocation['nonce']='';self.rebind();self.denied('ROOT_NONCE')
    def test_expired_window_refused(self):self.allocation['expiresAt']=(ci.stamp()-datetime.timedelta(seconds=1)).isoformat();self.rebind();self.denied('ROOT_WINDOW')
    def test_short_window_refused(self):self.allocation['expiresAt']=(ci.stamp()+datetime.timedelta(seconds=60)).isoformat();self.rebind();self.denied('ROOT_WINDOW')
    def test_wide_window_refused(self):self.allocation['expiresAt']=(ci.stamp()+datetime.timedelta(hours=2)).isoformat();self.rebind();self.denied('ROOT_WINDOW')
    def test_uncommitted_allocation_refused(self):self.allocation['nonce']='b'*64;ci.write(self.file,self.allocation);self.denied('ALLOCATION_NOT_COMMITTED')
    def test_nonallocation_carrier_change_refused(self):
        (self.root/'unexpected.txt').write_text('owned only');command(self.root,'add','.');command(self.root,'commit','--amend','--no-edit','-q');self.head=command(self.root,'rev-parse','HEAD');self.event['after']=self.head;self.env.update(GITHUB_SHA=self.head,QA_WORKFLOW_SHA=self.head);self.denied('ALLOCATION_ONLY_CARRIER')
class PublicExport(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='export-',dir=OUTPUT);self.addCleanup(self.tmp.cleanup);self.root=pathlib.Path(self.tmp.name)
        for name in ['credential-scan.py','public-fixture-shape.json']:shutil.copyfile(HERE/name,self.root/name)
        self.run=self.root/'run';self.run.mkdir();(self.root/'public-evidence').mkdir();self.source=self.root/'source';self.source.mkdir()
        self.p={'runDir':str(self.run),'sourceRoot':str(self.source),'writeFiles':[],'rollbackHashes':{}};ci.write(self.root/'actual-policy.json',self.p)
        for label in['before','after']:ci.write(self.run/(label+'-manifest.json'),{'files':[]})
        self.receipt={'source':ci.SOURCE_SHA,'changedPaths':[],'state':'candidate-finished-pending-review','processGroupClosed':True,'rollback':{'required':False,'verified':True}}
        self.marker='sb_secret_'+secrets.token_urlsafe(40)
    def call(self):
        result=subprocess.CompletedProcess([],0,json.dumps(self.receipt),'')
        with patch.object(ci,'HERE',self.root):return ci.export_public(self.p,result,[self.marker])
    def page(self,body,complete=True):
        (self.run/'page-00.raw').write_bytes(body);ci.write(self.run/'page-00.json',{'bodyComplete':True,'guardParsed':True,'consumerParsed':complete,'readerReleased':True,'captureFileClosed':True,'captureFileOpened':True,'sha256':hashlib.sha256(body).hexdigest()})
    def test_valid_complete_capture_exported(self):self.page(b'[]');self.assertEqual(self.call(),0);self.assertEqual((self.root/'public-evidence/capture/page-00.raw').read_bytes(),b'[]')
    def test_partial_body_withheld(self):self.page(b'[]',False);self.assertRaisesRegex(RuntimeError,'PUBLIC_CAPTURE_PROOF',self.call);self.assertFalse((self.root/'public-evidence/capture').exists())
    def test_uppercase_encoded_key_withheld(self):self.page(self.marker.encode().hex().upper().encode());self.assertRaisesRegex(RuntimeError,'INDEPENDENT_SECRET_SCAN',self.call);self.assertEqual(list((self.root/'public-evidence').iterdir()),[])
    def test_nested_escaped_key_withheld(self):
        value=''.join('\\u%04x'%ord(c)for c in self.marker)
        for _ in range(4):value=json.dumps(value)
        self.page(value.encode());self.assertRaisesRegex(RuntimeError,'INDEPENDENT_SECRET_SCAN',self.call);self.assertEqual(list((self.root/'public-evidence').iterdir()),[])
    def test_raw_diagnostic_key_withheld(self):(self.run/'stderr.log').write_text(self.marker);self.assertRaisesRegex(RuntimeError,'INDEPENDENT_SECRET_SCAN',self.call)
    def shape_receipt(self):
        d={'reason':'UNKNOWN_PATH','parentIndex':0,'actualType':'object'}
        return {'error':'POST_GUARD_FIXTURE_SHAPE','consumerParsed':False,'captured':False,'sha256':None,'shapeFailure':d,'shapeFailures':{'descriptors':[{**d,'count':2}],'totalRefusals':2,'overflowCount':0,'knownScanComplete':True}}
    def test_fixed_shape_receipt_exported_without_raw_body(self):
        value=self.shape_receipt();ci.write(self.run/'page-00.json',value);self.assertEqual(self.call(),0)
        self.assertEqual(ci.read(self.root/'public-evidence/receipts/page-00.json'),value);self.assertFalse((self.root/'public-evidence/capture').exists())
    def test_malformed_shape_descriptors_withheld_before_any_copy(self):
        changes=[lambda v:v['shapeFailure'].update(reason='arbitrary'),lambda v:v['shapeFailure'].update(path='unapproved.name'),lambda v:v['shapeFailure'].update(parentIndex=True),lambda v:v['shapeFailure'].update(parentIndex=999999),lambda v:v['shapeFailure'].update(actualType='unknown'),lambda v:v['shapeFailures'].update(totalRefusals=3),lambda v:v['shapeFailures'].update(knownScanComplete=1),lambda v:v['shapeFailures']['descriptors'][0].update(count=False),lambda v:v['shapeFailures']['descriptors'].extend(v['shapeFailures']['descriptors']*16),lambda v:v.update(error='POST_GUARD_PRIVATE_PAYLOAD')]
        for change in changes:
            with self.subTest():
                value=self.shape_receipt();change(value);ci.write(self.run/'page-00.json',value)
                self.assertRaisesRegex(RuntimeError,'SHAPE_DIAGNOSTIC',self.call);self.assertEqual(list((self.root/'public-evidence').iterdir()),[])
    def test_secret_bearing_unknown_diagnostic_names_withheld(self):
        for name in ['unknown-'+self.marker,'unknown-'+self.marker.encode().hex().upper()]:
            value=self.shape_receipt();value['shapeFailure'][name]='not a public descriptor';ci.write(self.run/'first-error.json',value)
            self.assertRaisesRegex(RuntimeError,'INDEPENDENT_SECRET_SCAN',self.call);self.assertEqual(list((self.root/'public-evidence').iterdir()),[])
    def test_path_outside_generated_scope_refused_before_read(self):self.receipt['changedPaths']=['../outside.json'];self.assertRaisesRegex(RuntimeError,'GENERATED_EXPORT_SCOPE',self.call)
    def test_zero_node_resource_refusal_retains_safe_receipt(self):
        baseline=self.root/'baseline.json';ci.write(baseline,{'files':[]});self.p['baselineManifest']=str(baseline);(self.run/'before-manifest.json').unlink()
        self.receipt.update(source=None,nodeStarts=0,state='failed',rollback={'required':True,'verified':True})
        with patch.object(ci,'HERE',self.root):self.assertEqual(ci.export_public(self.p,subprocess.CompletedProcess([],1,json.dumps(self.receipt),''),[self.marker]),1)
        self.assertTrue((self.root/'public-evidence/attempt.json').exists())
    def test_local_controls_cannot_execute_actual(self):
        ci.write(self.root/'runtime-context.json',{'localControlOnly':True})
        with patch.object(ci,'HERE',self.root),patch.object(subprocess,'run')as invoke:
            self.assertRaisesRegex(RuntimeError,'LINUX_QUALIFICATION_REQUIRED',ci.actual,None);invoke.assert_not_called()
class QualificationFailureWitness(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='witness-',dir=OUTPUT);self.addCleanup(self.tmp.cleanup);self.root=pathlib.Path(self.tmp.name)
        shutil.copyfile(HERE/'controls.py',self.root/'controls.py');ci.write(self.root/'runtime-context.json',{'sourcePins':{},'dependencyPins':{}})
        self.marker='sb_secret_'+secrets.token_urlsafe(40);self.output=self.root/'github-output';self.completed=[];self.scenario='nonzero';self.real_run=subprocess.run
        self.helper=self.root/'child.py';self.helper.write_text('''import json,os,sys,time
phase=sys.argv[1];scenario=os.environ['WITNESS_SCENARIO'];marker=os.environ['WITNESS_MARKER']
if phase=='metadata':
 if scenario=='metadata':sys.stdout.write(marker);sys.stderr.write(marker.encode().hex().upper());sys.exit(5)
 sys.exit(0)
print(json.dumps({'case':'good','status':'PASS','supervisorExit':0,'sourceProcessStarts':1,'requests':1,'capturedBytes':1261,'groupClosed':True,'rollbackVerified':True,'actualServiceOrProviderRequests':0,'elapsedSeconds':0.5,'credentialScan':'CLEAR_RAW_UTF16_BASE64_HEX_UNICODE_PERCENT','result':marker,'detail':marker}),flush=True)
if scenario=='timeout':time.sleep(2)
sys.stdout.write(json.dumps({'case':marker,'status':'PASS'})+'\\n')
sys.stdout.write(json.dumps({'case':'bad-origin','status':'FAIL','groupClosed':False,'rollbackVerified':False,'requests':999,'elapsedSeconds':10**400,'detail':marker})+'\\n')
sys.stdout.write(json.dumps({'case':'bad-limit','status':'PASS','elapsedSeconds':float('nan')})+'\\n')
sys.stdout.write(json.dumps({'case':'bad-rpc','status':marker})+'\\n')
sys.stdout.write('unstructured '+marker+'\\n');sys.stdout.flush();sys.stderr.write('arbitrary '+marker);sys.stderr.flush()
sys.exit(0 if scenario=='partial'else 7)
''')
    def invoke(self):
        def child(argv,**kwargs):
            phase='metadata'if pathlib.Path(argv[1]).name=='validate-ci-preparation.py'else'linux'
            kwargs['env']={**ci.ENV,'WITNESS_SCENARIO':self.scenario,'WITNESS_MARKER':self.marker}
            if self.scenario=='timeout'and phase=='linux':kwargs['timeout']=0.05
            try:r=self.real_run(['/usr/bin/python3',str(self.helper),phase],**kwargs)
            except subprocess.TimeoutExpired as error:self.completed.append(error);raise
            self.completed.append(r);return r
        with patch.object(ci,'HERE',self.root),patch.dict(os.environ,ci.ENV,clear=True),patch.object(ci,'source_shape_controls',return_value={'status':'PASS'}),patch.object(subprocess,'run',side_effect=child),patch.object(ci,'git')as git_call:
            with self.assertRaises((RuntimeError,subprocess.TimeoutExpired)):ci.qualify(argparse.Namespace(github_output=str(self.output)))
            git_call.assert_not_called()
        files=list((self.root/'public-evidence').glob('*failure.json'))
        self.assertEqual(len(files),1)
        body=files[0].read_bytes();scan_spec=importlib.util.spec_from_file_location('independent_witness_scan',HERE/'credential-scan.py');scanner=importlib.util.module_from_spec(scan_spec);scan_spec.loader.exec_module(scanner)
        self.assertFalse(scanner.contains(body,self.marker));self.assertFalse(self.output.exists());self.assertFalse((self.root/'qualification.json').exists());self.assertFalse((self.root/'actual-policy.json').exists())
        record=json.loads(body);last=self.completed[-1]
        def asbytes(v):return v.encode()if isinstance(v,str)else v or b''
        self.assertEqual(record['outputSha256'],{'stdout':hashlib.sha256(asbytes(last.stdout)).hexdigest(),'stderr':hashlib.sha256(asbytes(last.stderr)).hexdigest()})
        ci.write(OUTPUT/('witness-'+self.scenario+'.json'),record)
        return record
    def test_real_nonzero_child_preserves_only_allowlisted_completed_fields(self):
        r=self.invoke();self.assertEqual(r['phase'],'linux-controls');self.assertEqual(r['returnCode'],7)
        self.assertEqual([x['case']for x in r['completedRecords']],['good','bad-origin','bad-limit']);self.assertNotIn('detail',r['completedRecords'][0]);self.assertNotIn('result',r['completedRecords'][0]);self.assertNotIn('requests',r['completedRecords'][1]);self.assertNotIn('elapsedSeconds',r['completedRecords'][1]);self.assertNotIn('elapsedSeconds',r['completedRecords'][2]);self.assertIs(r['completedRecords'][1]['groupClosed'],False)
    def test_real_metadata_failure_stops_before_linux_child(self):
        self.scenario='metadata';r=self.invoke();self.assertEqual(r['phase'],'carrier-export-controls');self.assertEqual(r['returnCode'],5);self.assertEqual(len(self.completed),1);self.assertEqual(r['completedRecords'],[])
    def test_zero_exit_partial_controls_stay_blocked_with_witness(self):
        self.scenario='partial';r=self.invoke();self.assertEqual(r['returnCode'],0);self.assertEqual(r['reason'],'CONTROL_RECEIPTS')
    def test_real_child_timeout_retains_hashes_and_never_ready(self):
        self.scenario='timeout';r=self.invoke();self.assertIsNone(r['returnCode']);self.assertEqual(r['reason'],'CHILD_TIMEOUT');self.assertEqual(r['phase'],'linux-controls')
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--output',required=True);ap.add_argument('--failure-witness-only',action='store_true');args=ap.parse_args();OUTPUT=pathlib.Path(args.output);OUTPUT.mkdir(parents=True,exist_ok=True)
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(QualificationFailureWitness)if args.failure_witness_only else unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__));result=unittest.TextTestRunner(verbosity=1).run(suite)
    ci.write(OUTPUT/'metadata-controls.json',{'testsRun':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'actualServiceRequests':0,'sourceMutation':False,'scope':'owned Git metadata, public export and real qualification-child failure boundaries only'})
    raise SystemExit(0 if result.wasSuccessful()else 1)
