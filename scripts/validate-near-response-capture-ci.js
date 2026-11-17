'use strict';
// Decisive offline controls for the new capture binding. No fetch or service access.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const api=require('./near-response-capture-ci');
async function main(){
 const root=path.resolve(__dirname,'..'),file=path.join(root,'.github/workflows/sportscal-production.yml'),wf=await fs.readFile(file,'utf8');
 const old=cp.execFileSync('git',['show',api.APP.sha+':.github/workflows/sportscal-production.yml'],{cwd:root,encoding:'utf8'});
 const canonical=await fs.readFile(path.join(root,'.github/workflows/canonical-card-refresh.yml'),'utf8');assert.equal(canonical,cp.execFileSync('git',['show',api.APP.sha+':.github/workflows/canonical-card-refresh.yml'],{cwd:root,encoding:'utf8'}),'Disabled canonical workflow source remains exact');
 assert(!/^  schedule:/m.test(wf),'Manual capture workflow must have no scheduler');
 const captureStart=wf.indexOf('\n      - name: Check out exact capture control'),captureEnd=wf.indexOf('  editorial-preparation:\n');assert(captureStart>0&&captureEnd>captureStart);
 const cap=wf.slice(captureStart,captureEnd);let normal=wf.slice(0,captureStart)+wf.slice(captureEnd);
 normal=normal.replace(/^run-name:.*$/m,old.match(/^run-name:.*$/m)[0]).replace(/      near_capture:\n[\s\S]*?(?=permissions:\n)/,'');
 normal=normal.replace("  group: ${{ inputs.near_capture && 'ns-near-current-capture' || 'sportscal-production-and-cleanup' }}",'  group: sportscal-production-and-cleanup');
 normal=normal.replace('    if: inputs.editorial_prepare != true && inputs.near_capture != true','    if: inputs.editorial_prepare != true');
 normal=normal.replace("    if: always() && !cancelled() && inputs.editorial_prepare != true && (inputs.near_capture == true || needs.sql-safety.result == 'success')",'    if: inputs.editorial_prepare != true');
 normal=normal.replace("    if: github.event_name == 'workflow_dispatch' && inputs.editorial_prepare == true && inputs.near_capture != true","    if: github.event_name == 'workflow_dispatch' && inputs.editorial_prepare == true");
 normal=normal.replaceAll('        if: inputs.near_capture != true\n','').replace('        if: always() && inputs.near_capture != true','        if: always()');
 for(const key of ['VERCEL_TOKEN','VERCEL_ORG_ID','VERCEL_PROJECT_ID'])normal=normal.replace('${{ inputs.near_capture != true && secrets.'+key+" || '' }}",'${{ secrets.'+key+' }}');
 assert.equal(normal,old,'All normal production/editorial paths remain exact after removing capture-only guards');
 assert(wf.includes('  sql-safety:\n    if: inputs.editorial_prepare != true && inputs.near_capture != true'));assert(wf.includes("inputs.editorial_prepare == true && inputs.near_capture != true"));
 const ordinaryDeploy=wf.slice(wf.indexOf('  deploy:\n'),captureStart).split(/(?=^      - )/m).slice(1);
 for(const step of ordinaryDeploy)assert(/^        if: (?:always\(\) && )?inputs.near_capture != true$/m.test(step),'Every ordinary production step is excluded');
 const dispatchInputs=wf.slice(wf.indexOf('    inputs:\n'),wf.indexOf('permissions:\n'));
 assert.equal((dispatchInputs.match(/^      [a-z_][a-z0-9_]*:\n/gm)||[]).length,10,'Keep dispatch input count within the existing supported ten-input limit');
 assert.equal((cap.match(/run: node scripts\/near-response-capture-ci.js --capture/g)||[]).length,1);
 assert(!/update-cards|update-sportscal|deploy-current|git push|maintain-profile/.test(cap));assert(cap.includes('ref: '+api.APP.sha));
 assert.equal((cap.match(/secrets\.SUPABASE_/g)||[]).length,3);const secretStep=cap.split('      - name: Capture one bounded private near response')[1].split('      - name:')[0];assert.equal((secretStep.match(/secrets\.SUPABASE_/g)||[]).length,3);
 const returned=cap.split('          path: |')[1].split('          if-no-files-found')[0];assert(returned.includes('steps.near_capture.outputs.return_dir }}/encrypted.json')&&returned.includes('steps.near_capture.outputs.return_dir }}/manifest.json'));assert(!/response\.body|private\.json|\*\*/.test(returned));assert(cap.includes("steps.near_capture.outputs.return_ready == 'true'"),'No artifact upload before validated encrypted return exists');
 assert(wf.includes("inputs.near_capture == true")&&wf.includes('cancel-in-progress: false'));assert(!cap.includes('npm '));
 const driver=await fs.readFile(path.join(root,'scripts/near-response-capture-ci.js'));const driverHash=api.hash(driver),control='a'.repeat(40),id='38e33d38-324a-4dfb-a33e-8034a5ef21e7';
 const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const publicInput={sourceSha:api.APP.sha,captureId:id,recipientPublicKey:keys.publicKey,driverSha256:driverHash,controlSha:control};
 const env=api.routeInput({GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_WORKFLOW:'Sportscal production',GITHUB_JOB:'deploy',RUNNER_OS:'Linux',RUNNER_ARCH:'X64',GITHUB_REF:api.BRANCH,GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'123',GITHUB_SHA:control,GITHUB_WORKFLOW_REF:'hartican/sportscal/.github/workflows/sportscal-production.yml@'+api.BRANCH,NS_NEAR_BINDING_BASE64:Buffer.from(JSON.stringify(publicInput)).toString('base64'),NS_NEAR_CAPTURE_REQUEST_ID:id,NS_NEAR_WORKFLOW_SHA:control});
 const binding=api.context(env,driverHash);
 for(const [field,value]of [['NS_NEAR_APP_SHA','b'.repeat(40)],['NS_NEAR_CONTROL_SHA','b'.repeat(40)],['GITHUB_RUN_ATTEMPT','2'],['GITHUB_REF','refs/heads/main'],['NS_NEAR_DRIVER_SHA','0'.repeat(64)],['NS_NEAR_CAPTURE_ID','../bad'],['GITHUB_WORKFLOW','Canonical card refresh'],['GITHUB_JOB','refresh'],['RUNNER_OS','macOS']])assert.throws(()=>api.context({...env,[field]:value},driverHash),'Invalid source/attempt/ref/route binding must stop');
 assert.throws(()=>api.routeInput({...env,NS_NEAR_CAPTURE_REQUEST_ID:'wrong'}));assert.throws(()=>api.routeInput({...env,NS_NEAR_BINDING_BASE64:'!bad!'}));assert.throws(()=>api.routeInput({...env,NS_NEAR_BINDING_BASE64:Buffer.from(JSON.stringify({...publicInput,SUPABASE_SECRET_KEY:'forged'})).toString('base64')}));
 if(process.argv.includes('--route-only')){
  const prior=cp.execFileSync('git',['show','98bea0dbf5613f685d6bddd7088a6a9c751ecb26:scripts/near-response-capture-ci.js'],{cwd:root,encoding:'utf8'}),current=driver.toString('utf8');
  const span=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b));
  assert.equal(span(current,'function validateBinding','async function live'),span(prior,'function validateBinding','async function live'),'Existing encryption/private-sink/deadline/closure code remains byte-identical');
  assert.equal(span(current,'async function recover','if(require.main===module)'),span(prior,'async function recover','if(require.main===module)'),'Existing private return/decryption/cleanup remains byte-identical');
  console.log(JSON.stringify({state:'PASS_OFFLINE_MANUAL_ROUTE_DELTA',manualOnly:true,canonicalSourceUnchanged:true,normalReleaseBehaviorUnchanged:true,allNoncapturePathsExcluded:true,exactSourceRouteRunnerAttemptGuards:true,publicInputCannotInjectSecrets:true,encryptedReturnCodeUnchanged:true,rawBodyArtifactExcluded:true,liveCalls:0,transportAndFullCryptoSuitesRepeated:false}));return;
 }
 const raw=Buffer.concat([Buffer.from([239,187,191]),Buffer.from(JSON.stringify({schemaVersion:'current-fixture-bundle.v1',scope:'match-centre',complete:true,rows:[{source_id:'PRIVATE_SOURCE',fixture:{id:'PRIVATE_ID',label:'café 🏉',zero:0,missing:null}}]}))]);
 const receipt={binding,state:'CAPTURE_COMPLETE',rowCount:1,membershipIds:['PRIVATE_MEMBERSHIP'],membershipCount:1};
 const sealed=api.encrypt(raw,receipt,keys.publicKey),expected={captureId:id,controlSha:control,driverSha256:driverHash,sourceSha:api.APP.sha,runId:'123',recipientFingerprint:binding.recipientFingerprint};
 assert(api.decrypt(sealed.encoded,keys.privateKey,expected).body.equals(raw));assert(!sealed.encoded.includes(Buffer.from('PRIVATE_')),'Encrypted ordinary artifact must contain no raw sentinel');
 for(const field of ['captureId','sourceSha','controlSha','driverSha256','recipientFingerprint'])assert.throws(()=>api.decrypt(sealed.encoded,keys.privateKey,{...expected,[field]:'wrong'}));
 const tampered=JSON.parse(sealed.encoded);const ciphertext=Buffer.from(tampered.ciphertext,'base64');ciphertext[0]^=1;tampered.ciphertext=ciphertext.toString('base64');assert.throws(()=>api.decrypt(Buffer.from(JSON.stringify(tampered)),keys.privateKey,expected));
 const altered=JSON.parse(sealed.encoded);altered.binding.bodySha256='0'.repeat(64);assert.throws(()=>api.decrypt(Buffer.from(JSON.stringify(altered)),keys.privateKey,expected));
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'ns-near-offline-'));await fs.chmod(base,0o700);
 async function directory(name){const p=path.join(base,name);await fs.mkdir(p,{mode:0o700});return p;}
 function mock({afterCompleteFailure=false,oversize=false}={}){let callbacks,calls=0;return {get calls(){return calls;},createResponseCapture(c){assert.equal(c.maxBytes,8388608);callbacks=c;return Object.freeze({});},async supabaseServiceRequest(rpc,options){calls++;assert.equal(calls,1);assert.equal(rpc,api.RPC);assert.equal(options.timeoutMs,5000);assert.deepEqual(options.body,{p_membership_ids:['PRIVATE_MEMBERSHIP']});assert(options.signal&&!options.signal.aborted);
  options.onTiming({phase:'headers',elapsedMs:1,status:200});
  if(oversize){await callbacks.onChunk({bytes:Buffer.alloc(api.LIMIT+1),offset:0,signal:options.signal});throw Error('Unreachable oversize');}
  const middle=19;await callbacks.onChunk({bytes:raw.subarray(0,middle),offset:0,signal:options.signal});await callbacks.onChunk({bytes:raw.subarray(middle),offset:middle,signal:options.signal});
  await callbacks.onComplete({text:new TextDecoder().decode(raw),bytes:raw.length,textBytes:Buffer.byteLength(new TextDecoder().decode(raw)),sha256:api.hash(raw),gitBlobSha1:api.blob(raw),evidence:'fetch-decoded-body-bytes-not-compressed-wire',signal:options.signal});
  if(afterCompleteFailure)throw Error('PRIVATE_LATE_REQUEST_FAILURE');return JSON.parse(new TextDecoder().decode(raw));
 }};}
 try{
  const d=await directory('complete'),transport=mock();const captured=await api.capture({directory:d,binding,ids:['PRIVATE_MEMBERSHIP'],transport,environment:{}});assert.equal(transport.calls,1);assert.equal(captured.receipt.state,'CAPTURE_COMPLETE');assert.equal(captured.receipt.closure,'CLOSED_AND_VERIFIED');assert(captured.body.equals(raw));assert.equal((await fs.stat(path.join(d,'response.body'))).mode&0o777,0o600);assert.equal(captured.receipt.request.healthCalls,0);assert.equal(captured.receipt.request.retries,0);await fs.access(path.join(d,'CAPTURE_COMPLETE.private.json'));
  const replay=mock();await assert.rejects(api.capture({directory:d,binding,ids:['PRIVATE_MEMBERSHIP'],transport:replay,environment:{}}));assert.equal(replay.calls,0,'Exclusive claim prevents a second request in the same intake');
  const late=mock({afterCompleteFailure:true}),l=await directory('late');const failed=await api.capture({directory:l,binding,ids:['PRIVATE_MEMBERSHIP'],transport:late,environment:{}});assert.equal(late.calls,1);assert.equal(failed.receipt.state,'CAPTURE_INCOMPLETE');assert.equal(failed.receipt.sink,'BODY_VALIDATED_REQUEST_PENDING');await assert.rejects(fs.access(path.join(l,'CAPTURE_COMPLETE.private.json')));assert(!JSON.stringify(failed.receipt).includes('PRIVATE_LATE_REQUEST_FAILURE'));
  const over=mock({oversize:true}),o=await directory('over');const refused=await api.capture({directory:o,binding,ids:['PRIVATE_MEMBERSHIP'],transport:over,environment:{}});assert.equal(over.calls,1);assert.equal(refused.receipt.state,'CAPTURE_INCOMPLETE');assert.equal(refused.body.length,0);await assert.rejects(fs.access(path.join(o,'CAPTURE_COMPLETE.private.json')));
  const deadlineTransport=mock();let ticks=0;const deadline=await api.capture({directory:await directory('deadline'),binding,ids:['PRIVATE_MEMBERSHIP'],transport:deadlineTransport,environment:{},clock:()=>ticks++===0?0:10001});assert.equal(deadline.receipt.state,'CAPTURE_INCOMPLETE');assert.equal(deadlineTransport.calls,0);
  const metadataTransport=mock();await assert.rejects(api.capture({directory:await directory('metadata'),binding,ids:Array.from({length:1000},(_,i)=>'x'.repeat(70)+i),transport:metadataTransport,environment:{}}));assert.equal(metadataTransport.calls,0);
  const ef=path.join(base,'encrypted.json'),mf=path.join(base,'manifest.json'),kf=path.join(base,'recipient.private.pem');await api.exclusive(ef,sealed.encoded);await api.exclusive(kf,keys.privateKey);await api.exclusive(mf,Buffer.from(JSON.stringify({schema:'ns.near-capture.public.v1',binding:sealed.binding,ciphertextBytes:sealed.encoded.length,ciphertextSha256:api.hash(sealed.encoded),rawPublished:false})));
  const destination=path.join(base,'recovered');const recovered=await api.recover({encryptedPath:ef,manifestPath:mf,keyPath:kf,expected,destination});assert.equal(recovered.state,'CAPTURE_COMPLETE');assert((await fs.readFile(path.join(destination,'response.body'))).equals(raw));await assert.rejects(api.recover({encryptedPath:ef,manifestPath:mf,keyPath:kf,expected,destination}),'No overwrite/recovery replay');
 }finally{await fs.rm(base,{recursive:true,force:true});}
 console.log(JSON.stringify({state:'PASS_OFFLINE_CAPTURE_BINDING',workflowNormalUnchanged:true,captureOnlyIsolation:true,sourceAndAttemptGuards:true,bodyAndClosure:true,encryptionRoundtrip:true,tamperAndBindingRejection:true,exclusivePrivateReturn:true,noRawArtifact:true,liveCalls:0,transportSuiteRepeated:false}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports=main;
