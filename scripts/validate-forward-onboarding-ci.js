'use strict';
// Metadata-only regression source. Not run locally or a substitute for app/browser proof.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {POLICY,hash,validateEnvelope,replaceExact,boundedRegularRead}=require('./lib/forward-onboarding-ci');
const sourceReadLedger={used:0,limit:2*1024*1024*1024};
// Exact reversible P2 installed-tooling partial; not a new release admission profile.
const INSTALLED_TOOLING_AMENDMENT=Object.freeze({"schemaVersion":"installed-tooling-workflow-amendment.p2.v1","beforeSha256":"86a3b9d86ee2b188552fba6cc48db1fc1131aa296e42c772007a76aceabc862d","afterSha256":"922a7c33dbd5adf61260330292bc11eea0aa2c7587b872d27a044e0551f785b0","before":"      - name: Install isolated test dependencies\n        run: |\n          set -o pipefail\n          {\n            npm ci\n            npm install --prefix \"$RUNNER_TEMP/ns-playwright\" --no-save --package-lock=false playwright@1.64.1\n            node \"$RUNNER_TEMP/ns-playwright/node_modules/playwright/cli.js\" install --with-deps \"${{ matrix.browser }}\"\n          } 2>&1 | tee \"$RUNNER_TEMP/ns-upgrade-proof/install.log\"\n","after":"      - name: Install isolated test dependencies\n        run: |\n          set -o pipefail\n          {\n            npm ci\n            npm install --prefix \"$RUNNER_TEMP/ns-playwright\" --no-save --package-lock=false playwright@1.64.1\n            node \"$RUNNER_TEMP/ns-playwright/node_modules/playwright/cli.js\" install --with-deps \"${{ matrix.browser }}\"\n          } 2>&1 | tee \"$RUNNER_TEMP/ns-upgrade-proof/install.log\"\n      - name: Observe actual installed per-engine tooling before product checks\n        timeout-minutes: 2\n        env:\n          NS_OBSERVED_ENGINE: ${{ matrix.browser }}\n          PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}\n          PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}\n        run: |\n          set -Eeuo pipefail\n          timeout --signal=TERM --kill-after=5s 60s node <<'NS_INSTALLED_TOOLING'\n          'use strict';\n          const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');\n          const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',timeout:5000}).trim();\n          function identity(file){\n           const resolved=fs.realpathSync(file),fd=fs.openSync(resolved,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);\n           try{\n            const before=fs.fstatSync(fd);assert(before.isFile()&&Number.isSafeInteger(before.size));\n            const digest=crypto.createHash('sha256'),buffer=Buffer.alloc(65536);let bytes=0,n;\n            while((n=fs.readSync(fd,buffer,0,buffer.length,null))!==0){bytes+=n;assert(bytes<=before.size,'File grew during observation');digest.update(buffer.subarray(0,n));}\n            const after=fs.fstatSync(fd);assert.equal(bytes,before.size);\n            for(const key of ['dev','ino','size','mtimeMs','ctimeMs'])assert.equal(after[key],before[key],'Installed file changed during observation');\n            return {path:resolved,bytes,sha256:digest.digest('hex')};\n           }finally{fs.closeSync(fd);}\n          }\n          assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');\n          const osRelease=fs.readFileSync('/etc/os-release','utf8');assert(/^ID=ubuntu$/m.test(osRelease)&&/^VERSION_ID=\"24[.]04\"$/m.test(osRelease),'Actual Ubuntu24.04 required');\n          const temp=fs.realpathSync(process.env.RUNNER_TEMP),proof=path.join(temp,'ns-upgrade-proof'),st=fs.lstatSync(proof);\n          assert(st.isDirectory()&&!st.isSymbolicLink()&&st.uid===process.getuid());\n          const engine=process.env.NS_OBSERVED_ENGINE;assert(['chromium','webkit'].includes(engine));\n          const moduleRoot=path.join(temp,'ns-playwright/node_modules/playwright'),packageFile=path.join(moduleRoot,'package.json');\n          const pkg=JSON.parse(fs.readFileSync(packageFile,'utf8'));assert.equal(pkg.version,'1.64.1');\n          const playwright=require(moduleRoot),testedSha=git('rev-parse','HEAD'),parents=git('show','-s','--format=%P','HEAD').split(' ');\n          assert.equal(testedSha,process.env.GITHUB_SHA);assert.deepEqual(parents,[process.env.PR_BASE_SHA,process.env.PR_HEAD_SHA]);\n          const report={schemaVersion:'installed-tooling-observation.v1',scope:'Actual installed files and candidate-local observations; not independent executor authentication or browser execution',repository:process.env.GITHUB_REPOSITORY,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,jobKey:process.env.GITHUB_JOB,ref:process.env.GITHUB_REF,headSha:process.env.PR_HEAD_SHA,baseSha:process.env.PR_BASE_SHA,testedSha,testedTree:git('rev-parse','HEAD^{tree}'),parents,engine,node:process.version,nodeBinary:identity(process.execPath),npm:cp.execFileSync('npm',['--version'],{encoding:'utf8',timeout:10000}).trim(),osRelease:identity('/etc/os-release'),packageLock:identity('package-lock.json'),installedLock:identity('node_modules/.package-lock.json'),playwrightVersion:pkg.version,playwrightPackage:identity(packageFile),playwrightEntry:identity(path.join(moduleRoot,'index.js')),browserManifest:identity(path.join(temp,'ns-playwright/node_modules/playwright-core/browsers.json')),installedExecutable:identity(playwright[engine].executablePath()),browserExecutionObserved:false,globalSetupBarrier:false,releaseAcceptance:false};\n          fs.writeFileSync(path.join(proof,'installed-tooling.json'),JSON.stringify(report,null,2)+'\\n',{mode:0o600,flag:'wx'});\n          console.log(JSON.stringify({schemaVersion:report.schemaVersion,engine,observedAfterInstall:true,browserExecutionObserved:false,releaseAcceptance:false}));\n          NS_INSTALLED_TOOLING\n"});
function restoreInstalledToolingAmendment(text){
 const digest=hash(Buffer.from(text));
 if(digest===INSTALLED_TOOLING_AMENDMENT.beforeSha256)return {text,edits:0};
 assert.equal(digest,INSTALLED_TOOLING_AMENDMENT.afterSha256,"exact reviewed P2 tooling amendment; no unreviewed workflow hunks");
 assert.equal(text.split(INSTALLED_TOOLING_AMENDMENT.after).length-1,1,"one exact post-install tooling block");
 const restored=text.replace(INSTALLED_TOOLING_AMENDMENT.after,()=>INSTALLED_TOOLING_AMENDMENT.before);
 assert.equal(hash(Buffer.from(restored)),INSTALLED_TOOLING_AMENDMENT.beforeSha256,"all old workflow bytes restored before existing overlay checks");
 return {text:restored,edits:1};
}

// Exact additive normal613 caller layer. Existing P2 and historical overlay checks follow unchanged.
const NORMAL613_CALLER_AMENDMENT=Object.freeze({"schemaVersion":"normal613-caller-workflow-amendment.r2.v1","beforeSha256":"922a7c33dbd5adf61260330292bc11eea0aa2c7587b872d27a044e0551f785b0","afterSha256":"f79d93c6f6811191e8f6dd3fb3cad52ff0637641a2d448b6ad611a1e6980e7d2","editCount":12,"restoration":{"encoding":"deflate-raw-base64","packedBytes":4504,"packedSha256":"2b13d00c68871e44cb640ba76a59255a2618fccbf3ba12bfeba2bce9e49fc7c8","rawBytes":43067,"rawSha256":"c8801e7b4fae4eb5d08e27b1b5f7e9ec06b77b03028fc64694390cf842c65584","base64":"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"}});

// Exact additive deployed612 binder only; accepted R3/P2/legacy restoration remains mandatory.
const BASELINE612_BINDER_AMENDMENT=Object.freeze({"schemaVersion":"normal613-additive-612-baseline-binder.v1","beforeSha256":"f79d93c6f6811191e8f6dd3fb3cad52ff0637641a2d448b6ad611a1e6980e7d2","afterSha256":"ab11e8024aa3dd599c81e9e962926fd2f7c3e02997852ac6815f3b6333be7c30","edits":[{"before":"          function primaryCaptureRequest(raw,event,env,observed,wall,validate){","after":"          function primaryCaptureProfile(raw,implementationSha256){\n           const request=JSON.parse(utf8Text(raw));unicodeSafe(request);\n           const version=request?.captureFacts?.baselineVersion;\n           if(version==='612'){\n            assert.equal(implementationSha256,'0c50daf81a2b7bed72ba24a33fc453040480e91cc41923a92e8e1570426cbcde','Exact reviewed deployed612 collector');\n            return {baselineVersion:'612',bindingSchema:'primary-baseline-capture-binding.612.v1',validator:'validateCaptureBindingForProfile'};\n           }\n           assert.equal(version,'611','Only explicit reviewed611/612 capture profiles');\n           assert(['cd9f08b8fafad5ada96460043520b9293c65b91fb3f0cfc6db617c8db343b824','0c50daf81a2b7bed72ba24a33fc453040480e91cc41923a92e8e1570426cbcde'].includes(implementationSha256),'Exact reviewed legacy611-compatible collector');\n           return {baselineVersion:'611',bindingSchema:'primary-baseline-capture-binding.v1',validator:'validateCaptureBinding'};\n          }\n          function primaryCaptureRequest(raw,event,env,observed,wall,validate,bindingSchema='primary-baseline-capture-binding.v1'){"},{"before":"           exactKeys(body.captureFacts,['baselineSha','baselineVersion','deployment','alias','publisherWindow'],'Capture facts');","after":"           exactKeys(body.captureFacts,['baselineSha','baselineVersion','deployment','alias','publisherWindow'],'Capture facts');\n           assert.equal(bindingSchema,body.captureFacts.baselineVersion==='612'?'primary-baseline-capture-binding.612.v1':'primary-baseline-capture-binding.v1','Exact selected binding schema');"},{"before":"const binding={schemaVersion:'primary-baseline-capture-binding.v1',baselineSha:body.captureFacts.baselineSha","after":"const binding={schemaVersion:bindingSchema,baselineSha:body.captureFacts.baselineSha"},{"before":"          assert.equal(hash(collectorBytes),'cd9f08b8fafad5ada96460043520b9293c65b91fb3f0cfc6db617c8db343b824','Exact reviewed fixed611 collector only');","after":"          const profile=primaryCaptureProfile(requestBytes,hash(collectorBytes));"},{"before":"          const selected=primaryCaptureRequest(requestBytes,event,process.env,observed,Date.now(),collector.validateCaptureBinding);","after":"          const selected=primaryCaptureRequest(requestBytes,event,process.env,observed,Date.now(),collector[profile.validator],profile.bindingSchema);"}]});
function restoreBaseline612Binder(text){
 const a=BASELINE612_BINDER_AMENDMENT;
 if(hash(Buffer.from(text))!==a.afterSha256)return {text,edits:0};
 let restored=text;for(const edit of [...a.edits].reverse()){assert.equal(restored.split(edit.after).length-1,1,"one exact deployed612 binder edit");restored=restored.replace(edit.after,()=>edit.before);}
 assert.equal(hash(Buffer.from(restored)),a.beforeSha256,"entire accepted R3 workflow restored");return {text:restored,edits:a.edits.length};
}

// Exact focused gate addition; does not add an R1 command identity.
const FOCUSED_GATE_AMENDMENT=Object.freeze({"beforeSha256":"ab11e8024aa3dd599c81e9e962926fd2f7c3e02997852ac6815f3b6333be7c30","afterSha256":"248b862818046e994c717a0002862e5832ec4693c2a0e31c76dbe67def129e24","packedBytes":4655,"packedSha256":"714cc0d2368fafec11352ae8589aee97feff253c1c67af07a60f378fa7de6393","rawBytes":14470,"rawSha256":"4e1e540378979526779cdee289388e1a20a6b0277f5d61b2af964e43fefbc891","base64":"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"});

// Exact two-finding correction above the retained focused/binder/R3/P2 layers.
const FOCUSED_CORRECTION_AMENDMENT=Object.freeze({"beforeSha256":"248b862818046e994c717a0002862e5832ec4693c2a0e31c76dbe67def129e24","afterSha256":"3cf1ddd91e1ad8c783be68ea8e011585bdbf03c8cd988e1e5f8c7fdd70b4b360","packedBytes":7403,"packedSha256":"614050c08a292997f75836dff27ec63998dc069c08f45996f2293b05395f8e79","rawBytes":32231,"rawSha256":"37e289f90851b177bc56113e17211e699a691dcabcd5a88d9193be8f1972b1ba","base64":"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"});
function restoreFocusedCorrection(text){
 const a=FOCUSED_CORRECTION_AMENDMENT;if(hash(Buffer.from(text))!==a.afterSha256)return {text,edits:0};
 const p=Buffer.from(a.base64,'base64');assert.equal(p.length,a.packedBytes);assert.equal(p.toString('base64'),a.base64);assert.equal(hash(p),a.packedSha256);
 const raw=require('node:zlib').inflateRawSync(p,{maxOutputLength:a.rawBytes+1});assert.equal(raw.length,a.rawBytes);assert.equal(hash(raw),a.rawSha256);
 const edits=JSON.parse(raw.toString('utf8'));assert.equal(edits.length,1);let restored=text;
 for(const e of edits){assert.equal(restored.split(e.after).length-1,1);restored=restored.replace(e.after,()=>e.before);}
 assert.equal(hash(Buffer.from(restored)),a.beforeSha256);return {text:restored,edits:1};
}
function restoreFocusedGate(text){
 const correction=restoreFocusedCorrection(text),prior=restoreFocusedGateV2(correction.text);
 return {text:prior.text,edits:correction.edits+prior.edits};
}
function restoreFocusedGateV2(text){
 const a=FOCUSED_GATE_AMENDMENT;if(hash(Buffer.from(text))!==a.afterSha256)return {text,edits:0};
 const p=Buffer.from(a.base64,"base64");assert.equal(p.length,a.packedBytes);assert.equal(p.toString("base64"),a.base64);assert.equal(hash(p),a.packedSha256);
 const raw=require("node:zlib").inflateRawSync(p,{maxOutputLength:a.rawBytes+1});assert.equal(raw.length,a.rawBytes);assert.equal(hash(raw),a.rawSha256);
 const edits=JSON.parse(raw.toString("utf8"));assert.equal(edits.length,1);let restored=text;for(const e of edits){assert.equal(restored.split(e.after).length-1,1);restored=restored.replace(e.after,()=>e.before);}
 assert.equal(hash(Buffer.from(restored)),a.beforeSha256);return {text:restored,edits:1};
}
function restoreNormal613Caller(text){
 const focused=restoreFocusedGate(text),baseline612=restoreBaseline612Binder(focused.text);text=baseline612.text;
 const digest=hash(Buffer.from(text)),amendment=NORMAL613_CALLER_AMENDMENT;
 if(digest!==amendment.afterSha256){assert([amendment.beforeSha256,INSTALLED_TOOLING_AMENDMENT.beforeSha256].includes(digest),'exact reviewed normal613/P2 workflow only');return {text,edits:baseline612.edits+focused.edits};}
 const d=amendment.restoration,packed=Buffer.from(d.base64,'base64');
 assert.equal(packed.toString('base64'),d.base64);assert.equal(packed.length,d.packedBytes);assert.equal(hash(packed),d.packedSha256);
 const raw=require('node:zlib').inflateRawSync(packed,{maxOutputLength:d.rawBytes+1});
 assert.equal(raw.length,d.rawBytes);assert.equal(hash(raw),d.rawSha256,'exact bounded restoration data');
 const edits=JSON.parse(raw.toString('utf8'));assert(Array.isArray(edits)&&edits.length===amendment.editCount);
 assert(Buffer.from(JSON.stringify(edits)).equals(raw),'canonical restoration edit encoding');
 let restored=text;
 for(const edit of [...edits].reverse()){normal613Keys(edit,'before after','Restoration edit');assert(typeof edit.before==='string'&&typeof edit.after==='string'&&edit.after.length>0);assert.equal(restored.split(edit.after).length-1,1,'one exact normal613 amendment');restored=restored.replace(edit.after,()=>edit.before);}
 assert.equal(hash(Buffer.from(restored)),amendment.beforeSha256,'all accepted P2 workflow bytes restored');return {text:restored,edits:edits.length+baseline612.edits+focused.edits};
}
function normaliseForwardWorkflow(text){
 const normal613=restoreNormal613Caller(text),amendment=restoreInstalledToolingAmendment(normal613.text);
 const overlay=JSON.parse(boundedRegularRead(path.join(__dirname,'lib/forward-onboarding-workflow-overlay.json'),16*1024*1024,sourceReadLedger).toString('utf8'));
 assert.equal(overlay.schemaVersion,'forward-onboarding-workflow-overlay.v1');assert.equal(overlay.beforeSha256,'cf0d5a623de10834c530d10de83e825642c249b5b804a36d72582c5fd80f2dbf');
 assert.equal(hash(Buffer.from(amendment.text)),overlay.afterSha256,'exact current forward workflow, no normalisation of unreviewed hunks');
 let restored=amendment.text;
 for(const edit of [...overlay.edits].reverse()){assert.equal(restored.split(edit.after).length-1,1,'one exact bounded forward overlay');restored=restored.replace(edit.after,()=>edit.before);}
 assert.equal(hash(Buffer.from(restored)),overlay.beforeSha256,'entire accepted workflow including all old negatives/gates/browsers');
 return {restored,edits:overlay.edits.length+amendment.edits+normal613.edits};
}
const RESERVATION_BYTES=Buffer.from('ewogICJzY2hlbWFWZXJzaW9uIjogInB1Ymxpc2hlci1mb3J3YXJkLXZlcnNpb24tcmVzZXJ2YXRpb24udjEiLAogICJpZCI6ICJOUy1PTkJPQVJESU5HLUZPUldBUkQtNjEyLTIwMjYxMTA3IiwKICAiYWxsb2NhdGlvbiI6ICJPTkJPQVJESU5HLVBPU1Q2MTEtRk9SV0FSRC1SRVBBSVItMjAyNjExMDctMDEiLAogICJzdGF0ZSI6ICJSRVNFUlZFRF9TT1VSQ0VfUEFDS0FHSU5HX09OTFlfTk9UX1JFTEVBU0VfUkVBRFkiLAogICJ2ZXJzaW9uIjogIjYxMiIsCiAgInByZXZpb3VzQWNjZXB0ZWRWZXJzaW9uIjogIjYxMSIsCiAgIm93bmVyIjogIm5zUFVCTElTSCIsCiAgInNvbGVQdWJsaXNoZXIiOiAiMDFhMGQ1YmEtOTQzZC03NGUwLWFmN2YtZGFiNGZiMmJkZGE0IiwKICAiYXV0aG9yaXRhdGl2ZVJlY29yZCI6ICIvVXNlcnMvamFja2hhcnRpY2FuL0RvY3VtZW50cy9BSS9Db2RleC9PTkJPQVJESU5HLVBPU1Q2MTEtRk9SV0FSRC1SRVBBSVItMjAyNjExMDctMDEvRk9SV0FSRC1WRVJTSU9OLVJFU0VSVkFUSU9OLmpzb24iLAogICJhY2NlcHRlZE1haW4iOiAiNGJmZjdhZGE3ZDAzYzNiZmY1MmEyNjJmNThlNjMwZmU0Nzg0OGE3NCIsCiAgImFjY2VwdGVkTWFpblRyZWUiOiAiNWU2ZWZmN2Q0MzA3ZmI5N2U3MjVmNTc0NjlkOWVjYWJjYjc4YzdhMiIsCiAgInNvdXJjZUhlYWQiOiAiN2ExOTQzOTBjNzBkOWFlNTIwMWFjNjRmMjAyY2U4NTQ3MTU1YTJjNiIsCiAgInNvdXJjZVRyZWUiOiAiOTlhN2YwMjQzMDJjODY2MDU2NGU1MzhiZWM1OTFhNGFlNDExM2UxMCIsCiAgInNvdXJjZVBhcmVudCI6ICI0YmZmN2FkYTdkMDNjM2JmZjUyYTI2MmY1OGU2MzBmZTQ3ODQ4YTc0IiwKICAic291cmNlUGF0Y2giOiB7CiAgICAicGF0aCI6ICIvVXNlcnMvamFja2hhcnRpY2FuL0RvY3VtZW50cy9BSS9QZXJwbGV4aXR5L1Nwb3J0c2NhbC90bXAvc2VsZWN0aW9uLW9uYm9hcmRpbmctMjAyNjExMDcucGF0Y2giLAogICAgImJ5dGVzIjogMTQ5MTk4LAogICAgInNoYTI1NiI6ICI4ZGJlMzY0ZDJlZWYyZjdjZTU3MWU3MzMzMDY0NWZiNzliMzQwN2I2ZDZjNjEyN2VmMTZlNjllMmI0NjkzMjQyIgogIH0sCiAgInNvdXJjZVJldmlldyI6IHsKICAgICJwYXRoIjogIi9Vc2Vycy9qYWNraGFydGljYW4vRG9jdW1lbnRzL0FJL0NvZGV4L25zLXJlbGVhc2UtaW50YWtlLTIwMjYxMTA0L09OQk9BUkRJTkctUE9TVDYxMS1maW5pdGUtc291cmNlLXJldmlldy1hbmQtZm9yd2FyZC1oYW5kb2ZmLTIwMjYxMTA3Lmpzb24iLAogICAgImJ5dGVzIjogMTUzOTAsCiAgICAic2hhMjU2IjogIjIzZWU5ZGFmZTgzZGEwMWZiN2Y1NTI1YWIwZGYxMTI2Njc1ZjU1MzUyNTJjYTkxNzAzNTg5MWEzZTFjM2EyZDMiCiAgfSwKICAicHJlZGVjZXNzb3JSZWNlaXB0IjogewogICAgInBhdGgiOiAiL3RtcC9ucy1vbmJvYXJkaW5nLXJlbGVhc2UtZXZpZGVuY2UtMjAyNjExMDcvdjYxMS1maW5hbC1ldmlkZW5jZS5qc29uIiwKICAgICJieXRlcyI6IDcwNywKICAgICJzaGEyNTYiOiAiYmE0ZDA5ODA5MTllMTk5MmU3NTMxZGZjYzMzMGQzYTQzNDQzNDFjZmQ2ODM3OTAwZGU2Mzg4YjM5Y2RiMzdkYyIsCiAgICAid29ya2Zsb3dSdW4iOiA0MjMyMjI3NzA2NSwKICAgICJkZXBsb3ltZW50SWQiOiAiZHBsX0NSYWk3N3Jpb3BKUXJaTnlHYkpaQktrVm1QVkEiLAogICAgInBoeXNpY2FsSVBob25lVmVyaWZpZWQiOiBmYWxzZSwKICAgICJtZWFuaW5nIjogIlJldGFpbmVkIGNvbXBsZXRpb24gZXZpZGVuY2Ugb25seTsgbm90IGEgc3Vic3RpdHV0ZSBmb3IgY3VycmVudCBub3JtYWwgYmFzZWxpbmUgY2FwdHVyZS9hZG1pc3Npb24uIgogIH0sCiAgImtub3duQ2xhaW1zIjogewogICAgImNvb3JkaW5hdG9yUmVwb3J0ZWQiOiAiT25ib2FyZGluZyBpcyB0aGUgb25seSBjdXJyZW50IG51bWVyaWMgZm9yd2FyZCBhbGxvY2F0aW9uIGluIGl0cyBvd25lZCBvdXRjb21lIHJlY29yZDsgU1lOQy9STFdDIGhhdmUgbm8gbnVtZXJpYyByZXNlcnZhdGlvbi4iLAogICAgInB1Ymxpc2hlck93bmVkUmVjb3JkIjogIlByZXZpb3VzIDYxMCByZXNlcnZhdGlvbi9oaXN0b3J5IHJldGFpbmVkIHVuY2hhbmdlZDsgbm8gY29uY3JldGUgY29uZmxpY3RpbmcgNjEyIGNsYWltIGZvdW5kIGluIGJvdW5kZWQgZmlsZW5hbWUgYW5kIG93bmVkLWxlZGdlciByZWNvbmNpbGlhdGlvbi4iLAogICAgImdsb2JhbEFic2VuY2VQcm92ZW4iOiBmYWxzZSwKICAgICJzZWxlY3Rpb24iOiAiNjEyID0gYWN0dWFsIGFjY2VwdGVkIDYxMSArIDEsIGFzc2lnbmVkIHByb3NwZWN0aXZlbHkgYnkgc29sZSBwdWJsaXNoZXIgdW5kZXIgZXhpc3Rpbmcgb25ib2FyZGluZyBhbGxvY2F0aW9uLiIKICB9LAogICJoaXN0b3JpY2FsTGVkZ2VyIjogewogICAgInBhdGgiOiAiL1VzZXJzL2phY2toYXJ0aWNhbi9Eb2N1bWVudHMvQ29kZXgvMjAyNi0xMC0yMy90YXNrL25zLXN5bmMtdXBncmFkZS1taWdyYXRpb24tY29vcmRpbmF0aW9uLTIwMjYxMTA1Lmpzb24iLAogICAgImJ5dGVzIjogMTIyOTk5LAogICAgInNoYTI1NiI6ICJiNWIxM2U3MGY5MDAxZTg0NWZkZmIyMTNmZmU0ZDk3NDhlZGE1NjcwM2I0N2MzMTc5MDNkNjcwZDU4N2U5ZjY4IiwKICAgICJtb2RpZmllZCI6IGZhbHNlCiAgfSwKICAiZnV0dXJlQmluZGluZ3MiOiB7CiAgICAicGFja2FnZWRIZWFkIjogbnVsbCwKICAgICJwYWNrYWdlZFRyZWUiOiBudWxsLAogICAgInRlc3RlZE1lcmdlIjogbnVsbCwKICAgICJjbG91ZEFydGlmYWN0SWQiOiBudWxsLAogICAgImNsb3VkQXJ0aWZhY3RTaGEyNTYiOiBudWxsLAogICAgImJhc2VsaW5lQ2FwdHVyZVJlY2VpcHQiOiBudWxsCiAgfSwKICAicGVybWl0dGVkTmV4dCI6ICJPcmlnaW5hbCBVUERBVEUgcHJlcGFyZXMgc3RyaWN0bHkgYm91bmQgNjEyIGNhbm9uaWNhbCBjbG91ZCBwcm9kdWNlci9hZG1pc3Npb24gc291cmNlIHBhY2tldDsgZXhpc3RpbmcgUkVMRUFTRSByZXZpZXdzOyBuc1BVQkxJU0ggYWxvbmUgbGF0ZXIgaW50ZWdyYXRlcyBleGFjdCByZXZpZXdlZCBjYW5kaWRhdGUgdW5kZXIgb3JkaW5hcnkgcmVsZWFzZSBhdXRob3JpdHkgYW5kIGFsbCBnYXRlcy4iLAogICJub3RHcmFudGVkQnlSZXNlcnZhdGlvbiI6IFsKICAgICJDSSBldmVudCBvciB0ZXN0LXNsb3QgYWxsb2NhdGlvbiIsCiAgICAiUmVhZHkgdHJhbnNpdGlvbiBvciBkaXNwYXRjaCIsCiAgICAiTWVyZ2UsIG1haW4gcHVzaCBvciBkZXBsb3ltZW50IiwKICAgICJMb2NhbCBwcm9kdWN0IGV4ZWN1dGlvbiIsCiAgICAiUHVibGljIHJlcXVlc3QgcmV0cnkgb3IgYmxvY2tlZC1yb3V0ZSBieXBhc3MiLAogICAgIkNoYW5nZXMgdG8gc2lnbnVwLCBkYXRhYmFzZSwgYWNjb3VudHMsIHNjaGVkdWxlcyBvciBzZXR0aW5ncyIsCiAgICAiT2xkNjEwIHdhaXZlciwgbW9kaWZpZWQgYnVkZ2V0cyBvciB3ZWFrZW5lZCBjb250cm9scyIKICBdLAogICJzdG9wQ29uZGl0aW9ucyI6IFsKICAgICJDb25jcmV0ZSBjb21wZXRpbmcgcmVzZXJ2YXRpb24gb3IgYWNjZXB0ZWQgdmVyc2lvbiA+PTYxMjogc3RvcCBhbmQgcmVjb25jaWxlLCBubyBzaWxlbnQgcmVudW1iZXJpbmcuIiwKICAgICJGcmVzaCBtYWluL3NvdXJjZS9yZXZpZXcvcGF0Y2ggZHJpZnQgYmVmb3JlIGFkb3B0aW9uL3N1Ym1pc3Npb246IHN0b3AgYW5kIGJpbmQgZXhhY3QgY2hhbmdlZCBpbnB1dHMuIiwKICAgICJObyBjbG91ZCBnZW5lcmF0aW9uL3F1YWxpZmljYXRpb24gdW50aWwgZXhhY3QgQ0kvYnVpbGRlciBwYWNrZXQgcmV2aWV3ZWQgYW5kIG5vcm1hbCByZWxldmFudCBhZG1pc3Npb24gcmVxdWlyZW1lbnRzIG1ldC4iCiAgXSwKICAiY2xvdWRPbmx5IjogdHJ1ZSwKICAic3BlZWRPdmVycmlkZUFsbG93ZWQiOiBmYWxzZSwKICAicGh5c2ljYWxQaG9uZSI6ICJVTlRFU1RFRDsgZGlzY2xvc3VyZSBvbmx5LCBub3QgbmV3bHkgaW50cm9kdWNlZCBtYW51YWwgYXBwcm92YWwgZ2F0ZS4iLAogICJzb3VyY2VUYXNrU2VwYXJhdGlvbiI6ICJIaXN0b3JpY2FsIHY5IG5vLWRlcGxveW1lbnQgdGFzayByZW1haW5zIGNvbXBsZXRlIGFuZCBzZXBhcmF0ZS4gTm8gbmV3IFNZTkMgcGF0Y2ggaW5jbHVkZWQuIiwKICAiYXRVVEMiOiAiMjAyNi0xMS0wN1QwMTo1NjoyNS4yMDI5NjcrMDA6MDAiLAogICJtYWluT2JzZXJ2ZWRBdFVUQyI6ICIyMDI2LTExLTA3VDAxOjU1OjE3WiIKfQo=','base64');
function sourceControls(text){
 const normal=normaliseForwardWorkflow(text),results=[],boundVersionPlan=boundVersionPlanControls(),boundedReaders=boundedReaderControls(),maintenanceDelta=maintenancePathSourceControls();
 assert.equal(RESERVATION_BYTES.length,4142);assert.equal(hash(RESERVATION_BYTES),POLICY.reservationSha256);
 const copy=v=>JSON.parse(JSON.stringify(v)),now=Date.parse('2026-11-07T02:00:00.000Z');
 function sample(phase){
  const H='1'.repeat(40),T='2'.repeat(40),TREE='3'.repeat(40),MAP='4'.repeat(64),S='5'.repeat(64);
  const b={schemaVersion:'sync-current-forward-binding.v1',phase,repository:POLICY.repository,publisherHeadSha:H,expectedPublisherTreeSha:TREE,reviewedFinalMapSha256:MAP,expectedAssembledManifestSha256:S,expectedAssembledEntryCount:10,expectedBaseRelativePathCount:1,qualifierSha256:'6'.repeat(64),fixtureSha256:'7'.repeat(64),namedAllocationId:'SYNTHETIC_CONTRACT_CONTROL_NO_EXECUTION',reservationReceiptSha256:POLICY.reservationSha256,reservationReceiptBase64:RESERVATION_BYTES.toString('base64'),freshMainAndReservationBindingSha256:null,freshMainAndReservationBindingBase64:null};
  const fresh={schemaVersion:'publisher-fresh-main-reservation-binding.v1',publisherThreadId:POLICY.publisher,repository:POLICY.repository,candidateHeadSha:H,candidateTreeSha:TREE,reviewedFinalMapSha256:MAP,expectedAssembledManifestSha256:S,observedMainSha:POLICY.acceptedMain,mainObservedAt:new Date(now-1000).toISOString(),mainRefEvidenceSha256:'8'.repeat(64),reservationId:POLICY.reservationId,reservationVersion:POLICY.version,reservationReceiptSha256:POLICY.reservationSha256,reservationConflictCheckedAt:new Date(now-1000).toISOString(),knownConflictingReservation:false,globalReservationAvailability:'UNKNOWN; no global availability claim',namedAllocationId:b.namedAllocationId,validUntil:new Date(now+60000).toISOString(),currentActionAuthority:'SYNTHETIC_CONTRACT_CONTROL_NO_EXECUTION'};
  const body={schemaVersion:'ns-release-handover.forward.v1',scope:'Synthetic metadata contract only',commit:H,testsAndResults:'No runtime acceptance',dependencies:'Existing locked lane only',databaseAndConfigChanges:'None',knownRisks:'Unrun source',rollback:'Do not adopt',sourceQualificationBinding:b};
  const event={action:phase==='canonical-producer'?'opened':'ready_for_review',number:1,repository:{full_name:POLICY.repository},pull_request:{number:1,draft:phase==='canonical-producer',head:{sha:H,ref:'codex/source-qualification-forward-contract',repo:{full_name:POLICY.repository}},base:{sha:POLICY.acceptedMain,repo:{full_name:POLICY.repository}},body:null}};
  const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:POLICY.repository,GITHUB_JOB:'fixture-activation',GITHUB_WORKFLOW_REF:POLICY.repository+'/.github/workflows/installed-upgrade-tests.yml@refs/pull/1/merge',GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/pull/1/merge',GITHUB_SHA:T};
  const x={phase,now,event,env,observed:{parents:[POLICY.acceptedMain,H],checkout:T,headTree:TREE,testedTree:TREE,clean:true},body,b,fresh};
  x.write=()=>{const bytes=Buffer.from(JSON.stringify(fresh));b.freshMainAndReservationBindingBase64=bytes.toString('base64');b.freshMainAndReservationBindingSha256=hash(bytes);event.pull_request.body=JSON.stringify(body);};
  x.write();return x;
 }
 for(const phase of ['canonical-producer','qualification']){const x=sample(phase);assert.equal(validateEnvelope(x).releaseAcceptance,false);results.push({name:phase+' exact metadata witness',positive:true});}
 const tests=[
 ['unknown schema',x=>{x.body.schemaVersion='other';}],
 ['old610 schema cannot reuse612',x=>{x.body.schemaVersion='ns-release-handover.v1';}],
 ['wrong version receipt',x=>{x.b.reservationReceiptSha256='a'.repeat(64);}],
 ['fresh main advanced',x=>{x.event.pull_request.base.sha='a'.repeat(40);}],
 ['forward conflict',x=>{x.fresh.knownConflictingReservation=true;}],
 ['false global absence',x=>{x.fresh.globalReservationAvailability='available';}],
 ['wrong publisher',x=>{x.fresh.publisherThreadId='other';}],
 ['wrong allocation join',x=>{x.fresh.namedAllocationId='OTHER';}],
 ['template authority',x=>{x.fresh.currentActionAuthority='SOURCE_TEMPLATE_ONLY_NOT_ALLOCATION';}],
 ['expired action',x=>{x.fresh.validUntil=new Date(now-1).toISOString();}],
 ['future main',x=>{x.fresh.mainObservedAt=new Date(now+1).toISOString();}],
 ['invalid UTC',x=>{x.fresh.validUntil='tomorrow';}],
 ['wrong reservation version',x=>{x.fresh.reservationVersion='611';}],
 ['wrong role',x=>{x.env.GITHUB_JOB='installed-upgrade';}],
 ['wrong Node job context',x=>{x.env.GITHUB_ACTIONS='false';}],
 ['fork head',x=>{x.event.pull_request.head.repo.full_name='fork/repo';}],
 ['fork base',x=>{x.event.pull_request.base.repo.full_name='fork/repo';}],
 ['wrong workflow',x=>{x.env.GITHUB_WORKFLOW_REF=POLICY.repository+'/.github/workflows/other.yml@x';}],
 ['wrong ref',x=>{x.env.GITHUB_REF='refs/heads/main';}],
 ['zero run',x=>{x.env.GITHUB_RUN_ID='0';}],
 ['wrong event',x=>{x.event.action='synchronize';}],
 ['phase mismatch',x=>{x.b.phase='canonical-producer';}],
 ['dirty source',x=>{x.observed.clean=false;}],
 ['wrong head',x=>{x.event.pull_request.head.sha='a'.repeat(40);}],
 ['wrong tree',x=>{x.observed.testedTree='a'.repeat(40);}],
 ['wrong merge parent order',x=>{x.observed.parents.reverse();}],
 ['wrong checkout',x=>{x.observed.checkout='a'.repeat(40);}],
 ['string source count',x=>{x.b.expectedAssembledEntryCount='10';}],
 ['unknown binding field',x=>{x.b.extra=true;}],
 ['unpaired surrogate',x=>{x.body.scope='\ud800';}]
 ];
 for(const [name,change]of tests){const x=sample('qualification');change(x);x.write();assert.throws(()=>validateEnvelope(x),undefined,name);results.push({name,positive:false});}
 for(const [name,change]of [
  ['trailing LF',s=>s+'\n'],['concatenated marker',s=>s+'NS_CI_SOURCE_PHASE=canonical-producer-v1'],['duplicate key',s=>s.replace('"scope":','"scope":"x","scope":')]
 ]){const x=sample('qualification');x.event.pull_request.body=change(x.event.pull_request.body);assert.throws(()=>validateEnvelope(x),undefined,name);results.push({name,positive:false});}
 for(const [name,mutation]of [
 ['Node pin changed',v=>v.replace('node-version: 24.21.0','node-version: 24.22.2')],
 ['full51 command removed',v=>v.replace('node "$script" --full','node "$script"')],
 ['producer timeout raised',v=>v.replace('45s node scripts/build-fantasy-ui.js','46s node scripts/build-fantasy-ui.js')],
 ['restoration removed',v=>v.replace('trap restore_on_exit EXIT','true')],
 ['browser omitted',v=>v.replace('browser: [chromium, webkit]','browser: [chromium]')],
 ['copy browser gate removed',v=>v.replace('node scripts/validate-onboarding-directories-browser.js','true')],
 ['artifact lifetime widened',v=>v.replace('retention-days: 1','retention-days: 2')]
 ]){const changed=mutation(text);assert.notEqual(changed,text,name+' mutation applies');assert.throws(()=>normaliseForwardWorkflow(changed),undefined,name);results.push({name,positive:false});}
 assert.throws(()=>replaceExact('611 611','611','612',1),'no blanket substitutions');
 return {scope:'raw source contract and synthetic metadata only',normal613Caller:normal613CallerSourceControls(text),groups:results.length,results,boundVersionPlan,boundedReaders,maintenanceDelta,restoredOriginalWorkflow:true,appImports:0,sourceBuilderRuns:0,liveRequests:0,releaseAcceptance:false};
}

// CI browser companion: exact source-delta witness only, not a cloud route run.
function maintenancePathSourceControls(){
 const bytes=boundedRegularRead(path.join(__dirname,'lib/forward-onboarding-ci.js'),65536,sourceReadLedger),text=bytes.toString('utf8');
 assert(Buffer.from(text).equals(bytes),'exact current CI helper UTF8');
 assert.equal(bytes.length,21252);assert.equal(hash(bytes),'063548e46219c26d26b9d4f7ecfa0f1e00c4be65a77d14e1f22b87706ed7754e','exact selected companion CI source');
 const addition=" if(phase==='qualification')allowed.add('scripts/validate-account-sync-recovery-browser.js');\n";
 assert.equal(text.split(addition).length-1,1,'one exact qualification-only browser path addition');
 const original=Buffer.from(text.replace(addition,''));
 assert.equal(original.length,21158);assert.equal(hash(original),'63712cc0675a4e133deb35b8cbf6fe2331811aaf2ee79970f19018aa33f23f1a','all other actual H6e20 helper bytes unchanged');
 return {scope:'exact helper byte-delta witness only; verifyCloudRoute not executed',groups:1,addedPath:'scripts/validate-account-sync-recovery-browser.js',phase:'qualification',producerAllowanceUnchanged:true,allOtherHelperBytesPreserved:true,cloudRouteExecuted:false,appImports:0,providerRequests:0,releaseAcceptance:false};
}

// FWD-R1: real bound Git objects, not a fabricated worker or cache assumption.
function boundVersionPlanControls(){
 const cp=require('node:child_process'),{planVersioning}=require('./lib/forward-onboarding-ci');
 const fixture=JSON.parse(boundedRegularRead(path.join(__dirname,'fixtures/onboarding-forward-version-plan-20261107.json'),16384,sourceReadLedger).toString('utf8'));
 assert.equal(fixture.schemaVersion,'onboarding-forward-version-plan.v1');assert.equal(fixture.productHead,POLICY.productHead);
 const inputs={};
 for(const [name,d]of Object.entries(fixture.inputs)){
  assert(typeof d.path==='string'&&!d.path.includes(':')&&!d.path.includes('..'));assert(Number.isSafeInteger(d.bytes)&&d.bytes>=0&&d.bytes+1<=4*1024*1024);
  assert(d.bytes+1<=sourceReadLedger.limit-sourceReadLedger.used,'bound expected child stdout and overrun inside existing metadata cap');
  const bytes=cp.execFileSync('git',['show',POLICY.productHead+':'+d.path],{cwd:path.resolve(__dirname,'..'),timeout:5000,maxBuffer:d.bytes+1,stdio:['ignore','pipe','pipe']});
  sourceReadLedger.used+=bytes.length;assert.equal(bytes.length,d.bytes);assert.equal(hash(bytes),d.sha256,'exact reviewed source object '+d.path);inputs[name]=bytes;
 }
 const planned=planVersioning(inputs);assert.deepEqual([...planned.keys()],['index.html','service-worker.js','app-version.json']);
 for(const [p,d]of Object.entries(fixture.expected)){const bytes=planned.get(p);assert(bytes);assert.equal(bytes.length,d.bytes);assert.equal(hash(bytes),d.sha256,'entire expected output '+p);}
 for(const [name,d]of Object.entries(fixture.inputs))assert.equal(hash(inputs[name]),d.sha256,'pure plan preserves input '+name);
 const worker=inputs.worker.toString('utf8'),next=planned.get('service-worker.js').toString('utf8');
 assert.equal(worker.split('/config/local-preference-recovery.js').length-1,0,'actual611 has no cached local recovery module');
 assert.equal(next.split('"/config/local-preference-recovery.js?v=612"').length-1,1,'one explicit612 addition');
 assert.equal(next.split('"/config/preference-reset-ui.js?v=612"').length-1,1,'existing reset module advances once');
 const originalPredicate=worker.match(/^const REQUIRED_SHELL = .*;$/m)?.[0];assert(originalPredicate);assert(next.includes(originalPredicate),'required install/cache policy unchanged');
 assert(next.includes('"/assets/js/app-update.js?v=533"'),'unrelated module query preserved');
 const cases=[
 ['worker byte drift',v=>{v.worker=Buffer.concat([v.worker,Buffer.from('\n')]);}],
 ['pre-existing recovery cache member is not accepted611',v=>{v.worker=Buffer.from(v.worker.toString().replace('const APP_SHELL = [','const APP_SHELL = [\n  "/config/local-preference-recovery.js?v=611",'));}],
 ['index drift',v=>{v.index=Buffer.concat([v.index,Buffer.from(' ')]);}],
 ['app-version format/version drift',v=>{v.appVersion=Buffer.from('{"version":"610"}\n');}],
 ['missing recovery asset',v=>{delete v.recoveryAsset;}],
 ['recovery asset byte drift',v=>{v.recoveryAsset=Buffer.concat([v.recoveryAsset,Buffer.from(' ')]);}]
 ];
 for(const [name,change]of cases){const sample={...inputs};change(sample);assert.throws(()=>planVersioning(sample),undefined,name);}
 return {scope:'bound product611 raw inputs through real pure version plan',groups:cases.length+1,negativeNames:cases.map(x=>x[0]),sourceObjectReads:Object.keys(inputs).length,expectedOutputs:Object.keys(fixture.expected),cacheAssetBytes:4120,appRuntimeImports:0,providerRequests:0,releaseAcceptance:false};
}
// FWD-R2: closed descriptor simulation, fixed small buffers, no actual race or2GiB claim.
function boundedReaderControls(){
 const results=[];
 function setup({reported=3,data='abc',maximum=64,limit=128,used=0,short=Infinity,throwRead=false,finalDrift=false,beforeDrift=false,parentLink=false,symlink=false}={}){
  const state={data:Buffer.isBuffer(data)?data:Buffer.from(data),opened:0,closed:0,requested:[],actual:0,fstats:0};
  const stat=()=>({dev:1,ino:2,mode:0o100644,uid:1000,gid:1000,size:reported,mtimeMs:1,ctimeMs:1,isFile:()=>!symlink,isSymbolicLink:()=>symlink});
  const io={constants:{O_RDONLY:0,O_NOFOLLOW:1},realpathSync:p=>parentLink?'/different-parent':p,lstatSync:()=>stat(),openSync:()=>{state.opened++;return 7;},fstatSync:()=>{state.fstats++;const st=stat();if((beforeDrift&&state.fstats===1)||(finalDrift&&state.fstats===2))st.ino++;return st;},closeSync:fd=>{assert.equal(fd,7);state.closed++;},readFileSync:()=>{throw Error('unbounded read is forbidden');},readSync:(fd,dest,offset,length,position)=>{
   assert.equal(fd,7);assert(length>0&&length<=65536);state.requested.push(length);if(throwRead)throw Error('injected read failure');
   const count=Math.min(length,short,Math.max(0,state.data.length-position));if(count)state.data.copy(dest,offset,position,position+count);state.actual+=count;return count;
  }};
  const ledger={used,limit},run=()=>boundedRegularRead('/virtual/input',maximum,ledger,io);return {state,ledger,run,used};
 }
 function positive(name,options,expected){const x=setup(options),bytes=x.run();assert.equal(bytes.toString(),expected);assert.equal(x.ledger.used-x.used,x.state.actual);assert.equal(x.state.opened,1);assert.equal(x.state.closed,1);results.push({name,positive:true,actualBytes:x.state.actual});}
 function negative(name,options,guard,{opened=1,actual}={}){const x=setup(options);assert.throws(x.run,guard,name);assert.equal(x.state.opened,opened);assert.equal(x.state.closed,opened,'all opened descriptors close even on rejection');assert.equal(x.ledger.used-x.used,x.state.actual,'actual consumed bytes stay charged');if(actual!==undefined)assert.equal(x.state.actual,actual);assert(x.ledger.used<=x.ledger.limit);results.push({name,positive:false,actualBytes:x.state.actual});}
 positive('stable ordinary input',{reported:3,data:'abc'},'abc');
 positive('empty input with reserved EOF probe',{reported:0,data:''},'');
 positive('short reads do not retry from the start',{reported:6,data:'abcdef',short:2},'abcdef');
 positive('exact reservation fits without raising cumulative cap',{reported:2,data:'ab',maximum:3,limit:3},'ab');
 const chunks=setup({reported:65540,data:Buffer.alloc(65540,97),maximum:65542,limit:65542});assert.equal(chunks.run().length,65540);assert.deepEqual(chunks.state.requested,[65536,4,1]);assert.equal(chunks.ledger.used,65540);assert.equal(chunks.state.closed,1);results.push({name:'fixed64KiB chunks plus one-byte EOF probe',positive:true,actualBytes:65540});
 negative('concurrent growth consumes only reserved probe',{reported:2,data:Buffer.alloc(65540,97),maximum:3,limit:3},/file grew/,{actual:3});
 negative('concurrent shrink fails without another full read',{reported:3,data:'a'},/file shrank/,{actual:1});
 negative('probe cannot exceed remaining cumulative allowance',{reported:2,data:'ab',limit:2},/reserve content and overrun probe/,{opened:0,actual:0});
 negative('exact per-file cap has no probe headroom',{reported:3,data:'abc',maximum:3},/one-byte overrun probe/,{opened:0,actual:0});
 negative('oversize refused before open/allocation',{reported:65,data:'',maximum:64},/one-byte overrun probe/,{opened:0,actual:0});
 negative('input symlink refused before open',{symlink:true},/regular no-follow/,{opened:0,actual:0});
 negative('linked parent refused before open',{parentLink:true},/no symlinked parent/,{opened:0,actual:0});
 negative('descriptor identity mismatch closes before read',{beforeDrift:true},/stable descriptor before/,{actual:0});
 negative('late descriptor drift still closes',{finalDrift:true},/stable descriptor after/,{actual:3});
 negative('read exception always closes',{throwRead:true},/injected read failure/,{actual:0});
 negative('no raised cumulative cap',{limit:2*1024*1024*1024+1},/unchanged cumulative maximum/,{opened:0,actual:0});
 negative('no raised per-file cap',{maximum:256*1024*1024+1},/unchanged per-file maximum/,{opened:0,actual:0});
 return {scope:'shared new-forward bounded reader in closed IO mocks only',groups:results.length,results,unchangedFileMaximum:256*1024*1024,unchangedReadMaximum:2*1024*1024*1024,probeInsideExistingLimits:true,actualFilesystemRaceProven:false,appImports:0,providerRequests:0,releaseAcceptance:false};
}


// NORMAL613_CALLER_SOURCE_BEGIN
// Relay source mapping adopted by RELEASE 01a1d290-b20d-7c21-bc53-f49ff455b9b6; no current action ACK.
// Provider identity authenticates PUBLISH's attestation, not the underlying native chats.
const NORMAL613_CALLER_POLICY=Object.freeze({
 schemaVersion:'normal613-caller-policy.v1',repository:'hartican/sportscal',api:'https://api.github.com',
 relayUserId:269614001,relayLoginInformational:'hartican',
 owners:{RELEASE:'01a16141-8d23-7a02-bb05-51e2197a1119',PUBLISH:'01a0d5ba-943d-74e0-af7f-dab4fb2bdda4'},
 provenance:{nativePublishTurn:'01a1d264-6d9c-7962-8472-f30a93faadbd',historicalActorSha256:'4d853a24a60d2a2ec230aab522d8f36a82bb6804b061acba7bec0cafd90649d7',historicalActorIssuedAt:'2026-11-07T22:43:16.000Z',currentTokenValidity:'NOT_OBSERVED'},
 base:'9f20813c9855e30d4ca32e721862f739b6d696ba',product:'491d0ebcb2210b29a1ae6164c0c4deef1b04f2ec',productTree:'b69736ee739e7b31eebe58108c14889a333a756c',
 qualifier:{path:'scripts/validate-sync-current-forward.js',bytes:101617,sha256:'a54983351de787e957658f92efedf1e10b470cbb06af252070eb1661228a970f',gitBlob:'dece0f0ecffeb0435f7970bab922a0a37b2f10b9',mode:'100644'},
 fixture:{path:'scripts/fixtures/sync-normal-613-20261112.json',bytes:53227,sha256:'744ddb4c83e97810bdd9f6778de0f50a5033695f24739d642c9179822c58a5d2',gitBlob:'4901efd92c8b1d8ef255a06629b8c8bcc5038780',mode:'100644'},
 reservationId:'ns-app-version-613-sportsyurt-20261112',reservationSha256:'daa00a480a28b0cca1d2f9922c82fc9394a5460b0d45f87c3566e42b58a473d7',
 limits:{record:65536,event:4194304,pages:10,comments:1000,requests:32,response:2097152,network:16777216,intakeMs:30000,requestMs:5000,jobMs:900000,metadata:16777216,members:256,artifact:67108864,commandOutput:4194304},
 transportLimit:'Application-consumed bytes/deadlines; not a claim about transport internals or atomic replay prevention.'
});
const NORMAL613_SENTINELS=new Set(['UNBOUND','UNKNOWN','SOURCE_TEMPLATE_ONLY_NOT_ALLOCATION','SOURCE_TEMPLATE_NOT_ADMISSION','RESERVED_WORKING_NOT_READY','FORWARD612_SOURCE_TEMPLATE_UNPARSED_UNRUN_NOT_ADMISSION','FORWARD612_SELECTED_SOURCE_ONLY_UNPARSED_UNRUN','FUTURE_FULL_QUALIFIER_SOURCE_PREPARATION_UNPARSED_UNRUN_UNREGISTERED','PROPOSED_UNBOUND_NOT_EXECUTION_AUTHORITY']);
function normal613Keys(value,names,label){
 assert(value&&typeof value==='object'&&!Array.isArray(value),label+' object');
 assert.deepEqual(Object.keys(value).sort(),names.split(' ').sort(),label+' closed keys');
}
function normal613Text(value,label,max=256){
 assert(typeof value==='string'&&value.length>0&&value.length<=max&&value.trim().length>0&&!/[\u0000\r\n]/.test(value),label+' bounded text');
 assert(!NORMAL613_SENTINELS.has(value.trim().toUpperCase()),label+' actual authority, not sentinel');return value;
}
function normal613Hex(value,length,label){assert(typeof value==='string'&&new RegExp('^[0-9a-f]{'+length+'}$').test(value),label+' hex');return value;}
function normal613Time(value,label){assert(typeof value==='string',label);const n=Date.parse(value);assert(Number.isFinite(n)&&new Date(n).toISOString()===value,label+' canonical UTC');return n;}
function normal613ApiTime(value,label){assert(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value),label+' UTC');const n=Date.parse(value);assert(Number.isFinite(n),label);return n;}
function normal613Utf8(bytes){
 const {TextDecoder}=require('node:util');const s=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
 assert(Buffer.from(s).equals(bytes),'Exact UTF8');return s;
}
function normal613UnicodeSafe(value){
 if(typeof value==='string'){for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){assert(i+1<value.length&&value.charCodeAt(i+1)>=0xdc00&&value.charCodeAt(i+1)<=0xdfff,'Unpaired high surrogate');i++;}else assert(c<0xdc00||c>0xdfff,'Unpaired low surrogate');}}
 else if(Array.isArray(value))value.forEach(normal613UnicodeSafe);
 else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){normal613UnicodeSafe(key);normal613UnicodeSafe(item);}
}
function normal613Canonical(bytes,label){
 const value=JSON.parse(normal613Utf8(bytes));normal613UnicodeSafe(value);assert(Buffer.from(JSON.stringify(value)+'\n').equals(bytes),label+' canonical JSON+LF');return value;
}
function normal613Decode(value,wanted,label){
 assert(typeof value==='string'&&value.length>0&&value.length<=Math.ceil(NORMAL613_CALLER_POLICY.limits.record/3)*4,label+' base64 bound');
 const bytes=Buffer.from(value,'base64');assert(bytes.length>0&&bytes.length<=NORMAL613_CALLER_POLICY.limits.record&&bytes.toString('base64')===value,label+' canonical base64');
 if(wanted)assert.equal(hash(bytes),wanted,label+' digest');return bytes;
}
function normal613Body(bytes){
 assert(bytes.length>0&&bytes.length<=65536,'Body bound');const s=normal613Utf8(bytes),body=JSON.parse(s);
 assert.equal(JSON.stringify(body),s,'Exact compact body, no duplicate keys or LF');normal613UnicodeSafe(body);
 normal613Keys(body,'schemaVersion scope commit testsAndResults dependencies databaseAndConfigChanges knownRisks rollback sourceQualificationBinding','Body');
 assert.equal(body.schemaVersion,'ns-release-handover.normal613.v1');
 for(const k of ['scope','testsAndResults','dependencies','databaseAndConfigChanges','knownRisks','rollback'])assert(typeof body[k]==='string'&&body[k].trim()&&body[k].length<=(k==='testsAndResults'?8192:4096),'Bounded handover '+k);
 const b=body.sourceQualificationBinding,p=NORMAL613_CALLER_POLICY;
 normal613Keys(b,'schemaVersion phase repository preparedForBaseSha productSourceSha productSourceTree publisherHeadSha expectedPublisherTreeSha reviewedFinalMapSha256 expectedAssembledManifestSha256 expectedSourceEntryCount expectedBaseRelativePathCount qualifier fixture reservation actionIntent reservationReceiptBase64','Binding');
 assert.equal(b.schemaVersion,'normal-ready-613-binding.v1');assert.equal(b.phase,'qualification');assert.equal(b.repository,p.repository);
 assert.equal(b.preparedForBaseSha,p.base);assert.equal(b.productSourceSha,p.product);assert.equal(b.productSourceTree,p.productTree);
 assert.equal(normal613Hex(body.commit,40,'Body H'),b.publisherHeadSha);normal613Hex(b.expectedPublisherTreeSha,40,'Tree');
 for(const k of ['reviewedFinalMapSha256','expectedAssembledManifestSha256'])normal613Hex(b[k],64,k);
 assert(Number.isSafeInteger(b.expectedSourceEntryCount)&&b.expectedSourceEntryCount>0&&b.expectedSourceEntryCount<=10000);
 assert(Number.isSafeInteger(b.expectedBaseRelativePathCount)&&b.expectedBaseRelativePathCount>0&&b.expectedBaseRelativePathCount<=b.expectedSourceEntryCount);
 assert.deepEqual(b.qualifier,p.qualifier);assert.deepEqual(b.fixture,p.fixture);
 normal613Keys(b.actionIntent,'allocationId laneId ownedOperationId purpose intentSha256 sourceReviewId sourceReviewSha256 priorOwnedClosureReference validUntil maxWallMs resultContentDispositionSha256','Action intent');
 const a=b.actionIntent;assert.equal(a.purpose,'normal613-qualification');
 for(const k of ['allocationId','laneId','ownedOperationId','sourceReviewId','priorOwnedClosureReference'])normal613Text(a[k],k);
 for(const k of ['intentSha256','sourceReviewSha256','resultContentDispositionSha256'])normal613Hex(a[k],64,k);
 normal613Time(a.validUntil,'Action expiry');assert(Number.isSafeInteger(a.maxWallMs)&&a.maxWallMs>0&&a.maxWallMs<=p.limits.jobMs);
 assert.deepEqual(b.reservation,{schemaVersion:'ns-app-version-reservation.v1',reservationId:p.reservationId,version:'613',rawBytes:1362,rawSha256:p.reservationSha256,queue:'https://github.com/hartican/sportscal/issues/28',commentId:6813306721});
 normal613Reservation(normal613Decode(b.reservationReceiptBase64,p.reservationSha256,'Reservation'));
 return {body,binding:b,bodySha256:hash(bytes)};
}
function normal613Reservation(bytes){
 assert.equal(bytes.length,1362);assert.equal(hash(bytes),NORMAL613_CALLER_POLICY.reservationSha256);
 const r=JSON.parse(normal613Utf8(bytes));assert.equal(r.schemaVersion,'ns-app-version-reservation.v1');assert.equal(r.reservationId,NORMAL613_CALLER_POLICY.reservationId);
 assert.equal(r.version,'613');assert.equal(r.status,'RESERVED_WORKING_NOT_READY');assert.equal(r.testSlotAllocated,false);assert.equal(r.testsDispatched,false);assert.equal(r.published,false);assert.equal(r.deployed,false);
 return r;
}
function normal613ValidateFresh(fresh,b,now){
 normal613Keys(fresh,'schemaVersion phase purpose publisherThreadId repository candidateHeadSha candidateTreeSha reviewedFinalMapSha256 expectedAssembledManifestSha256 observedMainSha mainObservedAt mainRefEvidenceSha256 reservationId reservationVersion reservationReceiptSha256 reservationConflictCheckedAt knownConflictingReservation globalReservationAvailability namedAllocationId validUntil currentActionAuthority','Fresh binding');
 const p=NORMAL613_CALLER_POLICY;
 for(const [k,v]of Object.entries({schemaVersion:'normal613-fresh-main-reservation-binding.v1',phase:'qualification',purpose:'normal613-qualification',publisherThreadId:p.owners.PUBLISH,repository:p.repository,candidateHeadSha:b.publisherHeadSha,candidateTreeSha:b.expectedPublisherTreeSha,reviewedFinalMapSha256:b.reviewedFinalMapSha256,expectedAssembledManifestSha256:b.expectedAssembledManifestSha256,observedMainSha:p.base,reservationId:p.reservationId,reservationVersion:'613',reservationReceiptSha256:p.reservationSha256,namedAllocationId:b.actionIntent.allocationId,validUntil:b.actionIntent.validUntil,knownConflictingReservation:false,globalReservationAvailability:'UNKNOWN; no global availability claim'}))assert.equal(fresh[k],v,'Fresh '+k);
 normal613Hex(fresh.mainRefEvidenceSha256,64,'Main evidence');normal613Text(fresh.currentActionAuthority,'Fresh authority',65536);
 const until=normal613Time(fresh.validUntil,'Fresh expiry');assert(now<until);
 for(const k of ['mainObservedAt','reservationConflictCheckedAt']){const n=normal613Time(fresh[k],k);assert(n<=now&&now-n<=86400000&&n<until,'Fresh nonfuture '+k);}
}
function normal613ExpectedIntent(b,freshSha){
 const p=NORMAL613_CALLER_POLICY,a=b.actionIntent;
 return {schemaVersion:'normal613-action-intent.v1',phase:'qualification',purpose:'normal613-qualification',repository:p.repository,candidateHeadSha:b.publisherHeadSha,candidateTreeSha:b.expectedPublisherTreeSha,baseSha:p.base,reviewedFinalMapSha256:b.reviewedFinalMapSha256,expectedAssembledManifestSha256:b.expectedAssembledManifestSha256,qualifierSha256:p.qualifier.sha256,fixtureSha256:p.fixture.sha256,reservationReceiptSha256:p.reservationSha256,allocationId:a.allocationId,laneId:a.laneId,ownedOperationId:a.ownedOperationId,sourceReviewId:a.sourceReviewId,sourceReviewSha256:a.sourceReviewSha256,priorOwnedClosureReference:a.priorOwnedClosureReference,validUntil:a.validUntil,maxWallMs:a.maxWallMs,resultContentDispositionSha256:a.resultContentDispositionSha256,freshMainAndReservationBindingSha256:freshSha};
}
function normal613OwnedRoot(name,create=false,checkpoint=null){
 const base=fs.realpathSync(process.env.RUNNER_TEMP),root=path.join(base,name),checkout=fs.realpathSync(process.cwd());
 assert(path.isAbsolute(base)&&!(root===checkout||root.startsWith(checkout+path.sep)),'Evidence outside checkout');
 assert.equal(fs.realpathSync(base),base);if(create){if(checkpoint)checkpoint();fs.mkdirSync(root,{mode:0o700});}
 const s=fs.lstatSync(root);assert(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&(s.mode&0o077)===0,'Private owned root');return root;
}
function normal613Save(root,name,value,checkpoint=null){
 assert(/^[A-Za-z0-9_.-]+$/.test(name),'Owned basename');
 const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value,null,2)+'\n');assert(bytes.length<=NORMAL613_CALLER_POLICY.limits.metadata,'Metadata output bound');
 const file=path.join(root,name);if(checkpoint)checkpoint();
 const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
 try{let off=0;while(off<bytes.length){if(checkpoint)checkpoint();const n=fs.writeSync(fd,bytes,off,bytes.length-off);assert(n>0);off+=n;}if(checkpoint)checkpoint();fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 return {path:file,bytes:bytes.length,sha256:hash(bytes)};
}
function normal613Read(root,name,max=65536){
 assert(/^[A-Za-z0-9_.-]+$/.test(name));const file=path.join(root,name),s=fs.lstatSync(file);
 assert(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&(s.mode&0o077)===0&&Number.isSafeInteger(s.size)&&s.size>=0&&s.size<=max,'Owned bounded record');
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW),chunks=[];let count=0;
 try{const opened=fs.fstatSync(fd);for(const k of ['dev','ino','size','mtimeMs','ctimeMs'])assert.equal(opened[k],s[k]);const buf=Buffer.alloc(65536);
  for(;;){const n=fs.readSync(fd,buf,0,Math.min(buf.length,s.size-count+1),null);if(!n)break;count+=n;assert(count<=s.size,'Owned record grew');chunks.push(Buffer.from(buf.subarray(0,n)));}
  const end=fs.fstatSync(fd);for(const k of ['dev','ino','size','mtimeMs','ctimeMs'])assert.equal(end[k],s[k]);assert.equal(count,s.size);
 }finally{fs.closeSync(fd);}
 return Buffer.concat(chunks);
}
function normal613Context(){
 const root=normal613OwnedRoot(process.env.GITHUB_JOB==='fixture-activation'?'ns-normal-613-admission':'ns-normal-613-engine');
 const bytes=normal613Read(root,'normal613-context.json');return {root,bytes,value:JSON.parse(normal613Utf8(bytes))};
}
function normal613Remaining(context,cap){
 const wall=Date.now(),origin=normal613Time(context.clockObservedAt||context.startedAt,'Local clock observation');
 const elapsed=Number(process.hrtime.bigint()-BigInt(context.startMonotonicNs))/1e6,started=normal613Time(context.startedAt,'Original action start'),until=normal613Time(context.validUntil,'Authorised expiry');
 assert(Number.isSafeInteger(context.maxWallMs)&&context.maxWallMs>0&&context.maxWallMs<=NORMAL613_CALLER_POLICY.limits.jobMs,'Original allocated wall allowance');
 assert(started<=origin&&origin<=wall&&elapsed>=0&&Math.abs(wall-origin-elapsed)<=1000,'Fresh local monotonic/wall join');
 const deadline=normal613Time(context.actionDeadlineAt,'Unchanged action deadline');
 assert.equal(deadline,Math.min(until,started+context.maxWallMs),'No action-budget reset');
 const remaining=Math.floor(Math.min(cap,deadline-wall,deadline-origin-elapsed));
 assert(remaining>0,'Expired allocated action');return remaining;
}

// Private focused-lane seams; no new action authority or command IDs.
function normal613FocusedClock(context,entryNs,inheritedEndNs=null){
 const realNow=Date.now.bind(Date),realMono=process.hrtime.bigint.bind(process.hrtime);
 normal613Remaining(context,120000);
 const now=realMono(),entry=BigInt(entryNs),origin=normal613Time(context.clockObservedAt||context.startedAt,'Original observation');
 assert(entry>0n&&entry<=now&&now-entry<120000000000n,'Actual pre-setup focused entry');
 const actionWall=normal613Time(context.actionDeadlineAt,'Original deadline'),actionMono=BigInt(context.startMonotonicNs)+BigInt(actionWall-origin)*1000000n;
 let end=entry+120000000000n;if(actionMono<end)end=actionMono;
 if(inheritedEndNs!==null){const inherited=BigInt(inheritedEndNs);assert(inherited>entry&&inherited<=end,'Inherited deadline cannot expand');end=inherited;}
 function remaining(until=end,reserve=0){
  assert(typeof until==='bigint'&&until<=end&&Number.isSafeInteger(reserve)&&reserve>=0,'Subordinate deadline');
  const mono=realMono(),wall=realNow(),elapsed=Number(mono-BigInt(context.startMonotonicNs))/1e6;
  assert(elapsed>=0&&Math.abs(wall-origin-elapsed)<=1000,'Real focused clock join');
  const n=Math.floor(Math.min(Number(until-mono)/1e6,actionWall-wall)-reserve);
  assert(n>0,'Focused original deadline/reserve exhausted');return n;
 }
 remaining();return Object.freeze({entryNs:entry,endNs:end,nowNs:realMono,nowMs:realNow,remaining});
}
function normal613FocusedOwnedProcesses(token,clock,until){
 assert(/^[a-f0-9]{64}$/.test(token),'Private per-child ownership marker');
 const selfPid=process.pid,known=new Map(),groups=new Set(),holds=[];let root=null,rootObserved=false;
 const note=s=>{if(!holds.includes(s))holds.push(s);};
 const check=()=>clock.remaining(until);
 function bounded(file,max){
  check();const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{const chunks=[],b=Buffer.alloc(4096);let total=0;for(;;){check();const n=fs.readSync(fd,b,0,Math.min(b.length,max-total+1),null);if(!n)break;total+=n;assert(total<=max,'Bounded proc observation');chunks.push(Buffer.from(b.subarray(0,n)));}return Buffer.concat(chunks);}
  finally{fs.closeSync(fd);}
 }
 function identity(pid){
  check();const dir='/proc/'+pid,st=fs.lstatSync(dir);assert(st.isDirectory()&&!st.isSymbolicLink(),'Actual proc directory');
  if(st.uid!==process.getuid())return null;
  const raw=bounded(dir+'/stat',16384).toString('utf8'),end=raw.lastIndexOf(')'),fields=raw.slice(end+2).trim().split(/\s+/);
  assert(raw.startsWith(String(pid)+' (')&&end>0&&fields.length>=20&&/^\d+$/.test(fields[19]),'Actual process identity');
  return {pid,uid:st.uid,startTicks:fields[19],parentPid:Number(fields[1]),pgid:Number(fields[2]),sessionId:Number(fields[3]),state:fields[0]};
 }
 const same=(a,b)=>!!a&&!!b&&['pid','uid','startTicks','pgid','sessionId'].every(k=>a[k]===b[k]);
 function marked(p){
  const bytes=bounded('/proc/'+p.pid+'/environ',65536),again=identity(p.pid);
  assert(same(p,again),'Process changed during ownership observation');
  return bytes.toString('utf8').split('\0').includes('NS_FOCUSED_OWNER_TOKEN='+token);
 }
 function observe(){
  check();const names=fs.readdirSync('/proc').filter(n=>/^[1-9]\d*$/.test(n));assert(names.length<=4096,'Proc inventory bound');
  const active=[],groupMembers=[],seen=new Map();
  for(const name of names){
   check();const pid=Number(name);if(pid===selfPid)continue;let p,owned=false;
   try{p=identity(pid);if(!p)continue;seen.set(pid,p);if(p.state!=='Z')owned=marked(p);}
   catch(e){if(e.code==='ENOENT'||e.code==='ESRCH')continue;note('UNOBSERVABLE_PROCESS '+pid+': '+e.message);continue;}
   const old=known.get(pid);
   if(old&&!same(old,p)){note('PID_IDENTITY_CHANGED '+pid);continue;}
   if(owned){known.set(pid,p);groups.add(p.pgid);active.push(p);if(pid===root)rootObserved=true;}
   else if(old){active.push(p);if(p.state!=='Z')note('OWNERSHIP_MARKER_LOST '+pid);}
  }
  for(const p of seen.values())if(groups.has(p.pgid))groupMembers.push(p);
  for(const p of groupMembers)if(!known.has(p.pid))note('UNOWNED_MEMBER_OF_OBSERVED_GROUP '+p.pid);
  return {active,groupMembers,closed:rootObserved&&active.length===0&&groupMembers.length===0&&holds.length===0};
 }
 function signalOwned(signal){
  const observation=observe();
  for(const p of observation.active){
   check();try{const current=identity(p.pid);if(!same(p,current)){note('SIGNAL_IDENTITY_UNCONFIRMED '+p.pid);continue;}
    if(p.state==='Z')continue;
    if(!marked(current)){note('SIGNAL_OWNERSHIP_UNCONFIRMED '+p.pid);continue;}
    check();process.kill(p.pid,signal);
   }catch(e){if(e.code!=='ESRCH'&&e.code!=='ENOENT')note('SIGNAL_UNCONFIRMED '+p.pid+': '+e.message);}
  }
  return observation;
 }
 return {setRoot(pid){assert(root===null&&Number.isSafeInteger(pid)&&pid>1&&pid!==selfPid,'Calling reporter is not its own owned root');root=pid;observe();if(!rootObserved)note('ROOT_IDENTITY_NOT_OBSERVED '+pid);},
  observe,signalOwned,note,holds,records:()=>[...known.values()],get rootObserved(){return rootObserved;}};
}

async function normal613Intake(revalidateStage=null){
 const entryWall=Date.now(),entryMonotonic=process.hrtime.bigint();
 const p=NORMAL613_CALLER_POLICY,L=p.limits,cp=require('node:child_process'),{TextDecoder}=require('node:util');
 assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');assert.equal(process.env.GITHUB_REPOSITORY,p.repository);assert.equal(process.env.GITHUB_JOB,'fixture-activation');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
 assert(typeof process.env.GITHUB_WORKFLOW_REF==='string'&&process.env.GITHUB_WORKFLOW_REF.startsWith(p.repository+'/.github/workflows/installed-upgrade-tests.yml@'));
 const eventPath=fs.realpathSync(process.env.GITHUB_EVENT_PATH),eventStat=fs.lstatSync(eventPath);assert(eventStat.isFile()&&eventStat.size<=L.event);
 const event=JSON.parse(normal613Utf8(fs.readFileSync(eventPath)));assert.equal(event.action,'ready_for_review');assert.equal(event.repository.full_name,p.repository);assert.equal(event.repository.private,false);
 const pr=event.pull_request;assert(Number.isSafeInteger(event.number)&&event.number>0&&pr.number===event.number);assert.equal(pr.draft,false);assert.equal(pr.head.repo.full_name,p.repository);assert.equal(pr.base.repo.full_name,p.repository);assert.equal(pr.head.repo.private,false);assert.equal(pr.base.repo.private,false);
 assert.equal(process.env.GITHUB_REF,'refs/pull/'+event.number+'/merge');assert(/^[1-9][0-9]*$/.test(process.env.GITHUB_RUN_ID));
 const parsed=normal613Body(Buffer.from(pr.body)),b=parsed.binding,H=pr.head.sha,B=pr.base.sha,T=normal613Hex(process.env.GITHUB_SHA,40,'Tested merge');
 assert.equal(H,b.publisherHeadSha);assert.equal(B,p.base);
 const firstClock={startedAt:new Date(entryWall).toISOString(),clockObservedAt:new Date(entryWall).toISOString(),startMonotonicNs:entryMonotonic.toString(),validUntil:b.actionIntent.validUntil,maxWallMs:b.actionIntent.maxWallMs,actionDeadlineAt:new Date(Math.min(normal613Time(b.actionIntent.validUntil,'Expiry'),entryWall+b.actionIntent.maxWallMs)).toISOString()};
 normal613Remaining(firstClock,L.intakeMs);
 const prior=revalidateStage?normal613Context():null,actionClock=prior?prior.value:firstClock;
 if(prior){assert.equal(prior.value.bodySha256,parsed.bodySha256);assert.equal(prior.value.headSha,H);assert.equal(prior.value.validUntil,b.actionIntent.validUntil);assert.equal(prior.value.maxWallMs,b.actionIntent.maxWallMs);}
 function remaining(){
  const elapsed=Number(process.hrtime.bigint()-entryMonotonic)/1e6;assert(Math.abs(Date.now()-entryWall-elapsed)<=1000,'Intake clock');
  const n=Math.floor(Math.min(L.intakeMs-elapsed,normal613Remaining(actionClock,L.intakeMs)));
  assert(n>0,'Intake deadline');return n;
 }
 remaining();
 const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',timeout:Math.min(5000,remaining()),killSignal:'SIGKILL',maxBuffer:4194304}).trim();
 assert.equal(git('rev-parse','HEAD'),T);assert.deepEqual(git('show','-s','--format=%P',T).split(' '),[B,H]);assert.equal(git('rev-parse',H+'^{tree}'),b.expectedPublisherTreeSha);assert.equal(git('rev-parse',T+'^{tree}'),b.expectedPublisherTreeSha);
 const readyAt=normal613ApiTime(pr.updated_at,'Frozen Ready event update');assert(readyAt<=entryWall&&entryWall-readyAt<=86400000);
 const priorWitness=prior?JSON.parse(normal613Utf8(normal613Read(prior.root,revalidateStage==='qualification'?'normal613-readback-before-admission.json':'normal613-approval-witness.json',L.metadata))):null;
 const namespace=hash(Buffer.from(JSON.stringify({schemaVersion:'normal613-action-namespace.v1',repository:p.repository,pullRequest:event.number,phase:'qualification',purpose:b.actionIntent.purpose,headSha:H,baseSha:B,intentSha256:b.actionIntent.intentSha256,bodySha256:parsed.bodySha256,allocationId:b.actionIntent.allocationId,laneId:b.actionIntent.laneId,ownedOperationId:b.actionIntent.ownedOperationId})));
 const marker='NS_NORMAL613_V1 '+namespace,policySha256=hash(Buffer.from(JSON.stringify(p))),trace=[],passes=[];let consumed=priorWitness?priorWitness.consumedBytes:0,requests=priorWitness?priorWitness.requests:0;
 async function get(url){
  remaining();
  assert(++requests<=L.requests,'Request bound');const u=new URL(url);assert.equal(u.origin,p.api);assert.equal(u.username,'');assert.equal(u.password,'');assert.equal(u.hash,'');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(L.requestMs,remaining()));let reader,bytes=0;
  try{
   remaining();const response=await fetch(u,{method:'GET',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal});
   assert.equal(response.status,200,'Public GitHub response; no alternate route');assert.equal(new URL(response.url).origin,p.api);
   const length=response.headers.get('content-length');if(length!==null)assert(/^(0|[1-9][0-9]*)$/.test(length)&&Number(length)<=L.response,'Response length');
   assert(/^application\/json\b/.test(response.headers.get('content-type')||''),'JSON provider representation');assert(response.body,'Response stream');
   reader=response.body.getReader();const chunks=[];
   for(;;){remaining();const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;consumed+=item.value.byteLength;assert(bytes<=L.response&&consumed<=L.network,'Consumed body limit');chunks.push(Buffer.from(item.value));}
   const raw=Buffer.concat(chunks),value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));trace.push({url:u.href,status:response.status,bytes,sha256:hash(raw),observedAt:new Date().toISOString(),etag:response.headers.get('etag')});
   return {value,link:response.headers.get('link')};
  }finally{clearTimeout(timer);controller.abort();if(reader)reader.releaseLock();}
 }
 const pulls=p.api+'/repos/'+p.repository+'/pulls/'+event.number;
 async function observePR(){
  const {value:v}=await get(pulls);assert.equal(v.number,event.number);assert.equal(v.state,'open');assert.equal(v.draft,false);
  assert.equal(v.head.repo.full_name,p.repository);assert.equal(v.base.repo.full_name,p.repository);assert.equal(v.head.repo.private,false);assert.equal(v.base.repo.private,false);
  assert.equal(v.head.sha,H);assert.equal(v.base.sha,B);assert.equal(v.body,pr.body,'Final body unchanged');return {headSha:v.head.sha,baseSha:v.base.sha,bodySha256:hash(Buffer.from(v.body)),observedAt:new Date().toISOString()};
 }
 function comment(c){
  assert(Number.isSafeInteger(c.id)&&c.id>0&&typeof c.body==='string'&&Buffer.byteLength(c.body)<=L.record,'Provider comment fields');
  assert.equal(c.issue_url,p.api+'/repos/'+p.repository+'/issues/'+event.number);
  assert.equal(c.url,p.api+'/repos/'+p.repository+'/issues/comments/'+c.id);
  assert(c.user&&Number.isSafeInteger(c.user.id),'Provider author');assert.equal(c.user.id,p.relayUserId,'Externally reviewed relay numeric identity');
  const created=normal613ApiTime(c.created_at,'Comment creation'),updated=normal613ApiTime(c.updated_at,'Comment update');
  assert.equal(created,updated,'Edited approval evidence refused');assert(created<=readyAt&&created<=Date.now()&&Date.now()-created<=86400000,'Pre-Ready fresh comment');
  return {id:c.id,authorId:c.user.id,createdAt:c.created_at,updatedAt:c.updated_at,body:c.body,bodySha256:hash(Buffer.from(c.body)),url:c.url,issueUrl:c.issue_url};
 }
 async function scan(){
  const selected=[],seen=new Set(),pages=[];let url=p.api+'/repos/'+p.repository+'/issues/'+event.number+'/comments?per_page=100',total=0,page=1;
  while(url){
   assert(page<=L.pages,'Incomplete pagination: page limit');const response=await get(url);assert(Array.isArray(response.value)&&response.value.length<=100);
   total+=response.value.length;assert(total<=L.comments,'Comment count bound');
   for(const c of response.value){assert(Number.isSafeInteger(c.id)&&!seen.has(c.id),'Duplicate pagination record');seen.add(c.id);
    if(typeof c.body==='string'&&c.body.startsWith(marker)){
     assert(c.body.startsWith(marker+'\n'),'Malformed matching namespace marker');const raw=Buffer.from(c.body.slice(marker.length+1));const envelope=normal613Canonical(raw,'External envelope');
     selected.push({comment:comment(c),envelope});
    }
   }
   pages.push({url,count:response.value.length});const next=[];
   if(response.link)for(const entry of response.link.split(',')){const m=entry.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/);assert(m,'Unsupported pagination Link');if(m[2]==='next')next.push(m[1]);}
   assert(next.length<=1,'Ambiguous next page');url=null;
   if(next.length){const u=new URL(next[0]);assert.equal(u.origin,p.api);assert.equal(u.pathname,'/repos/'+p.repository+'/issues/'+event.number+'/comments');assert.equal(u.username,'');assert.equal(u.password,'');assert.equal(u.hash,'');
    assert.deepEqual([...u.searchParams.keys()].sort(),['page','per_page']);assert.equal(u.searchParams.get('per_page'),'100');assert.equal(u.searchParams.get('page'),String(page+1));url=u.href;}
   page++;
  }
  passes.push({pages,total,complete:true,observedAt:new Date().toISOString()});return selected.sort((a,z)=>a.comment.id-z.comment.id);
 }
 const firstPR=await observePR(),first=await scan();
 assert.equal(first.length,3,'Exactly two role approvals and one separate pre-Ready readback attestation');
 const approvals=first.filter(x=>x.envelope.schemaVersion==='normal613-role-envelope.v1'),witnesses=first.filter(x=>x.envelope.schemaVersion==='normal613-pre-ready-readback.v1');
 assert.equal(approvals.length,2);assert.equal(witnesses.length,1);
 const roles=new Set();let payload=null;
 for(const x of approvals){
  const e=x.envelope;
  normal613Keys(e,'schemaVersion role repository pullRequest headSha baseSha intentSha256 bodySha256 ackBase64 ackSha256 intentBase64 freshMainAndReservationBindingBase64 ownerDecision allocation policySha256','Approval envelope');
  assert(['RELEASE','PUBLISH'].includes(e.role)&&!roles.has(e.role),'One genuine decision per role');roles.add(e.role);
  for(const [k,v]of Object.entries({repository:p.repository,pullRequest:event.number,headSha:H,baseSha:B,intentSha256:b.actionIntent.intentSha256,bodySha256:parsed.bodySha256,policySha256}))assert.equal(e[k],v,'Envelope '+k);
  normal613Keys(e.ownerDecision,'threadId turnId decisionSha256 decidedAt','Native decision reference');
  assert.equal(e.ownerDecision.threadId,p.owners[e.role]);assert(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(e.ownerDecision.turnId));
  normal613Hex(e.ownerDecision.decisionSha256,64,'Native decision digest');
  const intentBytes=normal613Decode(e.intentBase64,b.actionIntent.intentSha256,'Intent'),intent=normal613Canonical(intentBytes,'Intent');
  const freshBytes=normal613Decode(e.freshMainAndReservationBindingBase64,null,'Fresh'),fresh=normal613Canonical(freshBytes,'Fresh');normal613ValidateFresh(fresh,b,Date.now());
  const expected=normal613ExpectedIntent(b,hash(freshBytes));assert.deepEqual(intent,expected);
  normal613Hex(e.ackSha256,64,'ACK SHA');const ackBytes=normal613Decode(e.ackBase64,e.ackSha256,'ACK'),ack=normal613Canonical(ackBytes,'ACK');
  assert.deepEqual(ack,{...expected,schemaVersion:'normal613-action-ack.v1',intentSha256:b.actionIntent.intentSha256,bodySha256:parsed.bodySha256,acknowledgedBy:'nsRELEASE+nsPUBLISH',acknowledgedAt:ack.acknowledgedAt});
  const ackAt=normal613Time(ack.acknowledgedAt,'ACK time'),decisionAt=normal613Time(e.ownerDecision.decidedAt,'Decision time');
  assert(decisionAt<=ackAt&&ackAt<=normal613ApiTime(x.comment.createdAt,'Comment time')&&Date.now()-ackAt<=86400000,'Decision/ACK/comment order');
  const a=e.allocation;normal613Keys(a,'schemaVersion allocationId laneId ownedOperationId allocatedAt validUntil maxWallMs resultContentDispositionSha256 permissionScope','Allocation attestation');
  assert.equal(a.schemaVersion,'normal613-owned-allocation-attestation.v1');assert.equal(a.permissionScope,'normal613-qualification-and-existing-installed-matrix');
  for(const k of ['allocationId','laneId','ownedOperationId','validUntil','maxWallMs','resultContentDispositionSha256'])assert.equal(a[k],b.actionIntent[k],'Actual allocation '+k);
  const allocated=normal613Time(a.allocatedAt,'Actual allocation');assert(allocated<=decisionAt&&Date.now()-allocated<=86400000);
  const comparable={intentBase64:e.intentBase64,freshBase64:e.freshMainAndReservationBindingBase64,ackBase64:e.ackBase64,ackSha256:e.ackSha256,allocation:a};
  if(payload)assert.deepEqual(comparable,payload,'Two approvals bind byte-identical records and allocation');else payload=comparable;
 }
 assert.equal(roles.size,2);
 const w=witnesses[0].envelope;
 normal613Keys(w,'schemaVersion repository pullRequest headSha baseSha intentSha256 bodySha256 ackSha256 policySha256 observedAt ownerRecord comments','Pre-Ready witness');
 for(const [k,v]of Object.entries({repository:p.repository,pullRequest:event.number,headSha:H,baseSha:B,intentSha256:b.actionIntent.intentSha256,bodySha256:parsed.bodySha256,ackSha256:payload.ackSha256,policySha256}))assert.equal(w[k],v,'Readback witness '+k);
 normal613Keys(w.ownerRecord,'threadId turnId recordSha256','Native readback record');assert.equal(w.ownerRecord.threadId,p.owners.PUBLISH);assert(/^[0-9a-f-]{36}$/.test(w.ownerRecord.turnId));normal613Hex(w.ownerRecord.recordSha256,64,'Native readback digest');
 const witnessed=normal613Time(w.observedAt,'Pre-Ready readback time');assert(witnessed<=normal613ApiTime(witnesses[0].comment.createdAt,'Witness publication')&&normal613ApiTime(witnesses[0].comment.createdAt,'Witness publication')<=readyAt);
 assert.deepEqual(w.comments,approvals.map(x=>({id:x.comment.id,bodySha256:x.comment.bodySha256,authorId:x.comment.authorId,createdAt:x.comment.createdAt,updatedAt:x.comment.updatedAt})).sort((a,z)=>a.id-z.id));
 for(const x of approvals)assert(normal613ApiTime(x.comment.createdAt,'Role publication')<=witnessed);
 const second=await scan();assert.deepEqual(second,first,'Complete action namespace unchanged');
 for(const x of second){const r=await get(p.api+'/repos/'+p.repository+'/issues/comments/'+x.comment.id);assert.deepEqual(comment(r.value),x.comment,'Selected comment final readback unchanged');}
 const finalPR=await observePR();remaining();
 const ackBytes=normal613Decode(payload.ackBase64,payload.ackSha256,'ACK'),ack=normal613Canonical(ackBytes,'ACK');
 const startedAt=prior?prior.value.startedAt:new Date(entryWall).toISOString(),startMonotonicNs=prior?prior.value.startMonotonicNs:entryMonotonic.toString();
 const actionDeadlineAt=prior?prior.value.actionDeadlineAt:new Date(Math.min(normal613Time(b.actionIntent.validUntil,'Expiry'),entryWall+b.actionIntent.maxWallMs)).toISOString();
 assert(normal613Time(ack.acknowledgedAt,'ACK')<=normal613Time(startedAt,'Actual preflight start'));
 if(prior){
  assert(['admission','qualification'].includes(revalidateStage));assert.deepEqual(first,priorWitness.selected,'Previously admitted external approvals unchanged');
  assert.equal(prior.value.headSha,H);assert.equal(prior.value.bodySha256,parsed.bodySha256);assert.equal(prior.value.namespace,namespace);normal613Remaining(prior.value,120000);
  normal613Save(prior.root,'normal613-readback-before-'+revalidateStage+'.json',{schemaVersion:'normal613-revalidation.v1',stage:revalidateStage,selected:first,passes,trace,consumedBytes:consumed,requests,observedAt:new Date().toISOString(),priorEvidenceSha256:hash(Buffer.from(JSON.stringify(priorWitness))),limitations:['Non-atomic current readback; no immutable history claim.']},remaining);
  return prior.value;
 }
 const root=normal613OwnedRoot('ns-normal-613-admission',true,remaining);
 const context={schemaVersion:'normal613-caller-context.v1',repository:p.repository,pullRequest:event.number,headSha:H,baseSha:B,testedMergeSha:T,tree:b.expectedPublisherTreeSha,bodySha256:parsed.bodySha256,intentSha256:b.actionIntent.intentSha256,ackSha256:payload.ackSha256,policySha256,namespace,readyEventUpdatedAt:pr.updated_at,startedAt,startMonotonicNs,clockObservedAt:startedAt,actionDeadlineAt,validUntil:b.actionIntent.validUntil,maxWallMs:b.actionIntent.maxWallMs,allocation:payload.allocation,actionIntent:b.actionIntent};
 normal613Remaining(context,120000);
 normal613Save(root,'normal613-intent.json',normal613Decode(payload.intentBase64,b.actionIntent.intentSha256,'Intent'),remaining);
 normal613Save(root,'normal613-ack.json',ackBytes,remaining);normal613Save(root,'normal613-fresh.json',normal613Decode(payload.freshBase64,null,'Fresh'),remaining);
 normal613Save(root,'normal613-reservation.json',normal613Decode(b.reservationReceiptBase64,p.reservationSha256,'Reservation'),remaining);
 normal613Save(root,'normal613-context.json',context,remaining);
 normal613Save(root,'normal613-approval-witness.json',{schemaVersion:'normal613-public-readback-witness.v1',policySha256,namespace,firstPR,finalPR,selected:first,passes,trace,consumedBytes:consumed,requests,limitations:['Relay attests native decisions; job does not authenticate native chat content.','Readback is not immutable history or atomic anti-replay.','Ready time bound uses frozen ready_for_review event updated_at.']},remaining);
 console.log(JSON.stringify({schemaVersion:context.schemaVersion,head:H,testedMerge:T,policySha256,namespace,roles:[...roles],publicReadbackVerified:true,nativeDecisionAuthentication:'PROCEDURAL_RELAY_ATTESTATION',releaseAcceptance:false}));
 return context;
}
// NORMAL613_INTAKE_END

async function normal613Admission(){
 'use strict';
 const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),{TextDecoder}=require('node:util');
 const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 await normal613Intake('admission');
 const nsContext=normal613Context(),nsIntentBytes=normal613Read(nsContext.root,'normal613-intent.json'),nsAckBytes=normal613Read(nsContext.root,'normal613-ack.json'),nsFreshBytes=normal613Read(nsContext.root,'normal613-fresh.json');
 normal613Remaining(nsContext.value,120000);
 // NS_E610_PURE_BEGIN
 const E610_LIMITS=Object.freeze({source:10000,installed:40000,file:256*1024*1024,read:2*1024*1024*1024,manifest:16*1024*1024,receipt:16384,body:65536,event:4*1024*1024,gitOutput:4*1024*1024,processMs:10000,materializerMs:20000});
 function exactKeys(value,keys,label){
  assert(value&&typeof value==='object'&&!Array.isArray(value),label+' object required');
  assert.deepEqual(Object.keys(value).sort(),keys.slice().sort(),label+' closed keys');
 }
 function textValue(value,label){assert.equal(typeof value,'string',label+' string');assert(value.length>0&&!/[\u0000\r\n]/.test(value),label+' nonempty single line');return value;}
 function digestHex(value,length,label){assert.equal(typeof value,'string',label);assert(new RegExp('^[0-9a-f]{'+length+'}$').test(value),label+' lowercase hex');return value;}
 function positiveInteger(value,label){assert(Number.isSafeInteger(value)&&value>0,label+' positive integer');return value;}
 function canonicalDecimal(value,label){assert.equal(typeof value,'string',label);assert(/^[1-9][0-9]*$/.test(value),label+' canonical decimal');return value;}
 const unicodeSafe=normal613UnicodeSafe;
 function utf8Text(bytes){assert(Buffer.isBuffer(bytes),'Raw bytes required');const value=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);assert(Buffer.from(value,'utf8').equals(bytes),'Exact UTF8 bytes required');unicodeSafe(value);return value;}
 function relativePath(value){
  textValue(value,'Relative path');assert(!value.includes('\\')&&!value.includes('\t')&&!path.posix.isAbsolute(value),'Unsafe relative path');
  assert(!value.split('/').some(part=>!part||part==='.'||part==='..'),'Unsafe relative component');
  unicodeSafe(value);return value;
 }
 function inside(base,file){return file===base||file.startsWith(base+path.sep);}
 function ownedPath(base,file){
  assert(path.isAbsolute(base)&&path.isAbsolute(file),'Absolute owned paths required');textValue(base,'Owned root');textValue(file,'Owned file');
  assert.equal(path.resolve(base),base,'Normalized root');assert.equal(path.resolve(file),file,'Normalized file');assert(file!==base&&inside(base,file),'Owned path escape');return file;
 }
 function regularInputStat(st){assert(st&&typeof st.isFile==='function'&&typeof st.isSymbolicLink==='function','File stat');assert(st.isFile()&&!st.isSymbolicLink(),'Regular no-follow input required');assert(Number.isSafeInteger(st.size)&&st.size>=0&&st.size<=E610_LIMITS.file,'Regular input size bound');}
 function linkWithin(base,file,target){textValue(target,'Link target');assert(!path.isAbsolute(target)&&inside(base,path.resolve(path.dirname(file),target)),'Escaping link target');}
 function validateRuntimePlatform(node,platform,arch){assert.equal(node,'v24.21.0');assert.equal(platform,'linux');assert.equal(arch,'x64');}
 function validateInventory(actual,expected){exactKeys(actual,['revision','bytes','files'],'Deployment inventory');assert.deepEqual(actual,expected,'Complete reviewed deployment policy/closure/transform inventory');}
 function stableStats(before,after,label){
  for(const key of ['dev','ino','size','mode','mtimeMs','ctimeMs'])assert.equal(after[key],before[key],label+' stable '+key);
 }
 function parseHandover(bytes){
  const result=normal613Body(bytes),b=result.binding;
  return {...result,rawBinding:b,binding:{...b,expectedAssembledEntryCount:b.expectedSourceEntryCount,namedAllocationId:b.actionIntent.allocationId,qualifierSha256:b.qualifier.sha256,fixtureSha256:b.fixture.sha256,reservationReceiptSha256:b.reservation.rawSha256,freshMainAndReservationBindingBase64:nsFreshBytes.toString('base64'),freshMainAndReservationBindingSha256:hash(nsFreshBytes)}};
 }
 function decodeBoundBase64(value,expectedSha){
  textValue(value,'Base64 receipt');assert(value.length<=Math.ceil(E610_LIMITS.receipt/3)*4,'Base64 bound');
  const bytes=Buffer.from(value,'base64');assert(bytes.length>0&&bytes.length<=E610_LIMITS.receipt,'Decoded receipt bound');
  assert.equal(bytes.toString('base64'),value,'Canonical base64 required');assert.equal(hash(bytes),expectedSha,'Transported receipt SHA');
  return bytes;
 }
 function utcTime(value,label){assert.equal(typeof value,'string',label);const time=Date.parse(value);assert(Number.isFinite(time)&&new Date(time).toISOString()===value,label+' strict UTC');return time;}
 function validateFresh(fresh,binding,baseSha,reservation,now){assert.equal(baseSha,NORMAL613_CALLER_POLICY.base);normal613ValidateFresh(fresh,rawBinding,now);normal613Remaining(nsContext.value,120000);}
 function validateEventJoin(event,env,observed,binding){
  assert.equal(env.GITHUB_ACTIONS,'true');assert.equal(env.GITHUB_EVENT_NAME,'pull_request');assert.equal(env.GITHUB_REPOSITORY,'hartican/sportscal');assert.equal(env.GITHUB_JOB,'fixture-activation');assert.equal(typeof env.GITHUB_WORKFLOW_REF,'string');assert(env.GITHUB_WORKFLOW_REF.startsWith('hartican/sportscal/.github/workflows/installed-upgrade-tests.yml@'),'Observed workflow path');
  assert.equal(event.repository.full_name,'hartican/sportscal');assert.equal(event.action,'ready_for_review','Selected source admission requires the existing Ready event');
  const pr=event.pull_request;assert.equal(pr.number,event.number,'PR number event join');assert.equal(pr.draft,false);assert.equal(pr.head.repo.full_name,'hartican/sportscal','Same repository required');
  const H=digestHex(pr.head.sha,40,'Event head'),B=digestHex(pr.base.sha,40,'Event base'),T=digestHex(env.GITHUB_SHA,40,'Tested merge');
  assert.equal(H,binding.publisherHeadSha,'Reviewed event head');assert.equal(observed.headSha,H);assert.equal(observed.baseSha,B);assert.equal(observed.testedMergeSha,T);
  assert.equal(observed.checkoutSha,T,'Actual checkout');assert.deepEqual(observed.parents,[B,H],'Exact PR merge parent order');
  assert.equal(observed.headTree,binding.expectedPublisherTreeSha);assert.equal(observed.testedTree,binding.expectedPublisherTreeSha,'H/T complete trees must agree');
  canonicalDecimal(env.GITHUB_RUN_ID,'Run ID');assert(/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT),'Run attempt');positiveInteger(Number(env.GITHUB_RUN_ATTEMPT),'Run attempt');
  positiveInteger(event.number,'PR number');canonicalDecimal(String(event.number),'PR number');assert.equal(env.GITHUB_REF,'refs/pull/'+event.number+'/merge');
  return {H,B,T};
 }
 function parseGitEntries(bytes){
  const raw=utf8Text(bytes);assert(raw.endsWith('\0'),'NUL-terminated tree required');const records=raw.slice(0,-1).split('\0');assert(records.length>0&&records.length<=E610_LIMITS.source,'Tracked source count');
  const seen=new Set();return records.map(record=>{const m=/^(100644|100755|120000) blob ([0-9a-f]{40})\t([\s\S]+)$/.exec(record);assert(m,'Unsupported Git entry/type');relativePath(m[3]);assert(!seen.has(m[3]),'Duplicate Git path');seen.add(m[3]);return {path:m[3],mode:m[1],type:'blob',gitBlob:m[2]};});
 }
 function assembledBytes(H,tree,reviewedMapSha256,rows){
  const files=rows.slice().sort((a,b)=>Buffer.compare(Buffer.from(a.path,'utf8'),Buffer.from(b.path,'utf8'))).map(r=>({path:r.path,mode:r.mode,type:'blob',gitBlob:r.gitBlob,bytes:r.bytes,sha256:r.sha256}));
  return Buffer.from(JSON.stringify({schemaVersion:'assembled-git-source-manifest.v1',revision:H,tree,entryCount:files.length,reviewedMapSha256,files})+'\n','utf8');
 }
 function sourceInventoryWithProjection(entries,readSource,policy){
  assert(Array.isArray(entries)&&entries.length>0&&entries.length<=E610_LIMITS.source,'Initial full source count bound');
  const byName=new Map(entries.map(entry=>[entry.path,entry])),observed=new Map();
  assert.equal(byName.size,entries.length,'Initial full source paths must be unique');
  const readInitial=entry=>{
   assert(entry&&byName.get(entry.path)===entry,'Initial read must use exact tracked entry');
   assert(!observed.has(entry.path),'Initial source file must be physically read once');
   const bytes=readSource(entry);
   assert(Buffer.isBuffer(bytes)&&bytes.length<=E610_LIMITS.file,'Verified initial raw bytes required');
   observed.set(entry.path,{...entry,bytes:bytes.length,sha256:hash(bytes)});
   return bytes;
  };
  // Projection consumes actual Git-verified initial bytes; keep row metadata, not a second raw-source cache.
  const projected=projection(entries,readInitial,policy);
  // Unselected files remain mandatory members of the complete initial source proof.
  for(const entry of entries)if(!observed.has(entry.path))readInitial(entry);
  assert.equal(observed.size,entries.length,'Complete initial source coverage');
  return {rows:entries.map(entry=>observed.get(entry.path)),projected};
 }
 function projection(entries,readSource,policy){
  exactKeys(policy,['schemaVersion','includeDirectories','includeFiles','rootExtensions','excludeDirectories','excludeFiles','preserveBytes','compactJson','acceptedBytes'],'Deployment policy');
  assert.equal(policy.schemaVersion,'deployment-manifest.v1');assert.equal(policy.compactJson,true);
  for(const key of ['includeDirectories','includeFiles','rootExtensions','excludeDirectories','excludeFiles','preserveBytes'])assert(Array.isArray(policy[key])&&policy[key].every(x=>typeof x==='string'),'Policy array '+key);
  const secret=name=>name.includes('supabase_keys.txt')||name.split('/').some(part=>part.startsWith('.env'));
  const retained=name=>!secret(name)&&!policy.excludeDirectories.some(prefix=>name.startsWith(prefix))&&!policy.excludeFiles.includes(name)&&(policy.includeDirectories.some(prefix=>name.startsWith(prefix))||policy.includeFiles.includes(name)||(!name.includes('/')&&policy.rootExtensions.includes(path.extname(name))));
  const byName=new Map(entries.map(e=>[e.path,e])),selected=new Set(entries.filter(e=>retained(e.path)).map(e=>e.path)),verifiedJavaScript=new Map();
  // Reuse only this projection's already Git-verified JavaScript bytes, not a source/dependency stability inventory.
  for(const name of selected){
   if(!name.endsWith('.js'))continue;const verified=readSource(byName.get(name));verifiedJavaScript.set(name,verified);const source=utf8Text(verified);
   for(const match of source.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)){
    const base=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1])),dependency=[base,base+'.js',base+'.json',base+'/index.js'].find(p=>byName.has(p));
    if(dependency){assert(!secret(dependency),'Runtime dependency refers to excluded secret');selected.add(dependency);}
   }
  }
  const projected=entries.filter(e=>selected.has(e.path)).map(e=>{
   let source;if(e.path.endsWith('.js')){assert(verifiedJavaScript.has(e.path),'Missing verified projection JavaScript');source=verifiedJavaScript.get(e.path);verifiedJavaScript.delete(e.path);}else source=readSource(e);
   const compact=policy.compactJson&&e.path.endsWith('.json')&&!policy.preserveBytes.includes(e.path);
   const bytes=compact?Buffer.from(JSON.stringify(JSON.parse(utf8Text(source)))+'\n'):source;
   return {row:{path:e.path,gitBlob:e.gitBlob,sourceBytes:source.length,bytes:bytes.length,transform:compact?'json-compact':'identity',sha256:hash(bytes)},bytes,mode:e.mode};
  });
  assert.equal(verifiedJavaScript.size,0,'Unconsumed verified projection JavaScript');return projected;
 }
 // NS_E610_PURE_END
 
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
 
 const E610_READ_PHASES=Object.freeze(['event-input','source-initial','locked-inputs','dependencies-initial','node-initial','terser-provenance','metadata-writeback','projection-policy','projection-source','child-reservation','projection-output','source-final','dependencies-final','node-final','receipt-writeback']);
 const root=fs.realpathSync(process.cwd());let readBytes=0,readPhase='event-input',readLimitReported=false;
 const readPhaseBytes=Object.fromEntries(E610_READ_PHASES.map(name=>[name,0]));
 function setReadPhase(name){assert(E610_READ_PHASES.includes(name),'Closed metadata read phase');readPhase=name;}
 function safeReadBudgetPath(file){
  const hidden={role:'redacted-input',path:null,pathSha256:typeof file==='string'?hash(file):null};
  if(typeof file!=='string'||!path.isAbsolute(file)||path.resolve(file)!==file||!inside(root,file)||file===root)return hidden;
  const relative=path.relative(root,file).split(path.sep).join('/');
  if(!relative||relative.split('/').some(part=>!part||part==='.'||part==='..'))return hidden;
  const digest=hash(relative),secret=/(?:^|\/)(?:\.env[^/]*|supabase_keys\.txt|(?:credentials?|secrets?|tokens?)(?:[._-][^/]*)?)(?:\/|$)/i.test(relative);
  const visible=relative.length<=256&&/^[A-Za-z0-9@._/-]+$/.test(relative)&&!secret;
  return {role:'repository-input',path:visible?relative:null,pathSha256:digest};
 }
 function reportReadLimit(before,size,next,file,reservation){
  if(readLimitReported)return;readLimitReported=true;
  const kind=reservation?'conservative-child-reservation':'direct-input',limit=E610_LIMITS.read;
  const fallback='E610_METADATA_READ_BOUND {"schemaVersion":"E610-metadata-read-limit.v1","phase":"'+readPhase+'","kind":"'+kind+'","attemptedBytes":'+size+',"cumulativeBefore":'+before+',"wouldBeTotal":'+next+',"limit":'+limit+',"diagnosticFallback":true}';
  let line=fallback;
  try{
   const location=reservation?{role:'conservative-child-reservation',path:null,pathSha256:null}:safeReadBudgetPath(file);
   const phaseBytes=Object.fromEntries(E610_READ_PHASES.map(name=>[name,readPhaseBytes[name]]));
   const candidate='E610_METADATA_READ_BOUND '+JSON.stringify({schemaVersion:'E610-metadata-read-limit.v1',phase:readPhase,kind,...location,attemptedBytes:size,cumulativeBefore:before,wouldBeTotal:next,limit,perFileLimit:E610_LIMITS.file,phaseBytes});
   if(Buffer.byteLength(candidate,'utf8')<=4096)line=candidate;
  }catch{}
  try{console.error(line);}catch{}
 }
 function charge(size,file=null,reservation=false){
  assert(!readLimitReported,'Metadata read bound');
  assert.equal(typeof reservation,'boolean','Read charge kind');
  assert(Number.isSafeInteger(size)&&size>=0&&(reservation||size<=E610_LIMITS.file),reservation?'Conservative child source-read reservation':'Per-file read bound');
  assert(Number.isSafeInteger(readBytes)&&readBytes>=0&&readBytes<=E610_LIMITS.read,'Metadata read bound');
  const before=readBytes,next=before+size;assert(Number.isSafeInteger(next),'Metadata read bound');
  if(next>E610_LIMITS.read){reportReadLimit(before,size,next,file,reservation);assert(false,reservation?'Conservative child source-read reservation':'Metadata read bound');}
  readBytes=next;readPhaseBytes[readPhase]+=size;
 }
 function parentDirectories(file,stop){
  for(let d=path.dirname(file);;d=path.dirname(d)){
   const st=fs.lstatSync(d);assert(st.isDirectory()&&!st.isSymbolicLink(),'Symlink/non-directory parent');
   if(d===stop)break;assert(d!==path.dirname(d)&&inside(stop,d),'Parent escaped selected root');
  }
 }
 function stableBytes(file,maximum=E610_LIMITS.file,base=root){
  assert(path.isAbsolute(file)&&inside(base,file),'Read outside selected root');parentDirectories(file,base);
  const before=fs.lstatSync(file);regularInputStat(before);assert(before.size<=maximum,'Input byte bound');charge(before.size,file);
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  let value;
  try{const opened=fs.fstatSync(fd);stableStats(before,opened,'Opened input');value=fs.readFileSync(fd);stableStats(opened,fs.fstatSync(fd),'Read input');}
  finally{fs.closeSync(fd);}
  stableStats(before,fs.lstatSync(file),'Path input');assert.equal(value.length,before.size,'Stable read length');return value;
 }
 function rawIdentity(file,relative,base=root){
  parentDirectories(file,base);const st=fs.lstatSync(file),permissions=(st.mode&0o7777).toString(8).padStart(4,'0');
  assert(st.isFile()||st.isSymbolicLink(),'Unsupported identity kind');let bytes,link;
  if(st.isSymbolicLink()){
   charge(st.size,file);bytes=fs.readlinkSync(file,{encoding:'buffer'});assert.equal(bytes.length,st.size,'Link input byte length');link=utf8Text(bytes);
   linkWithin(base,file,link);
   assert(inside(base,fs.realpathSync(file)),'Resolved link outside selected root');stableStats(st,fs.lstatSync(file),'Link identity');
  }else bytes=stableBytes(file,E610_LIMITS.file,base);
  const gitBlob=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  return {path:relative,bytes:bytes.length,permissions,mode:st.isSymbolicLink()?'120000':st.mode&0o111?'100755':'100644',sha256:hash(bytes),gitBlob,...(st.isSymbolicLink()?{link}:{})};
 }
 function processOutput(command,args,maximum=E610_LIMITS.gitOutput,timeout=E610_LIMITS.processMs){
  return cp.execFileSync(command,args,{cwd:root,encoding:null,maxBuffer:maximum,timeout:Math.max(1,Math.floor(normal613Remaining(nsContext.value,timeout))),killSignal:'SIGKILL',stdio:['ignore','pipe','pipe']});
 }
 const git=(...args)=>utf8Text(processOutput('git',args)).trim();
 function sourceBytes(entry){
  const file=path.join(root,...entry.path.split('/'));parentDirectories(file,root);
  let bytes;if(entry.mode==='120000'){
   const st=fs.lstatSync(file);assert(st.isSymbolicLink(),'Source link mode');charge(st.size,file);bytes=fs.readlinkSync(file,{encoding:'buffer'});assert.equal(bytes.length,st.size,'Source link byte length');
   const target=utf8Text(bytes);linkWithin(root,file,target);assert(inside(root,fs.realpathSync(file)),'Source link confinement');stableStats(st,fs.lstatSync(file),'Source link');
  }else{
   const st=fs.lstatSync(file);assert.equal(st.mode&0o111?'100755':'100644',entry.mode,'Source executable mode');bytes=stableBytes(file);
  }
  assert.equal(crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),entry.gitBlob,'Working bytes versus actual raw Git blob');return bytes;
 }
 function sourceInventory(entries){return entries.map(e=>{const bytes=sourceBytes(e);return {...e,bytes:bytes.length,sha256:hash(bytes)};});}
 function dependencies(){
  const folder=path.join(root,'node_modules'),st=fs.lstatSync(folder);assert(st.isDirectory()&&!st.isSymbolicLink(),'Local locked dependency folder');
  const entries=[];function visit(dir,depth=0){assert(depth<64,'Dependency directory depth bound');for(const name of fs.readdirSync(dir).sort()){
   const file=path.join(dir,name),stat=fs.lstatSync(file),relative=path.relative(root,file).split(path.sep).join('/');
   if(stat.isDirectory()){assert(!stat.isSymbolicLink(),'Dependency directory link');visit(file,depth+1);}else{
    assert(entries.length<E610_LIMITS.installed,'Installed file count bound');const row=rawIdentity(file,relative,folder);
    if(stat.isSymbolicLink())assert(inside(folder,fs.realpathSync(file)),'Dependency link outside local install');entries.push(row);
   }
  }}visit(folder);return entries;
 }
 function cleanCheckout(){
  assert.equal(git('status','--porcelain=v1','--untracked-files=all'),'','Clean tracked/untracked checkout required');
  assert.equal(git('ls-files','--others','--exclude-standard','-z'),'','Unexpected untracked source');
 }
 function jsonBytes(value){const bytes=Buffer.from(JSON.stringify(value)+'\n');assert(bytes.length<=E610_LIMITS.manifest,'Metadata JSON bound');return bytes;}
 assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
 const eventFile=fs.realpathSync(process.env.GITHUB_EVENT_PATH),event=JSON.parse(utf8Text(stableBytes(eventFile,E610_LIMITS.event,path.dirname(eventFile))));
 assert.equal(typeof event.pull_request.body,'string','Event PR body required');unicodeSafe(event.pull_request.body);
 charge(nsContext.bytes.length+nsIntentBytes.length+nsAckBytes.length+nsFreshBytes.length);
 const {binding,rawBinding,bodySha256}=parseHandover(Buffer.from(event.pull_request.body,'utf8'));
 const H=digestHex(event.pull_request.head.sha,40,'Event H'),B=digestHex(event.pull_request.base.sha,40,'Event B'),T=digestHex(process.env.GITHUB_SHA,40,'Event T');
 const observed={headSha:H,baseSha:B,testedMergeSha:T,checkoutSha:git('rev-parse','HEAD'),parents:git('show','-s','--format=%P',T).split(' '),headTree:git('rev-parse',H+'^{tree}'),testedTree:git('rev-parse',T+'^{tree}')};
 validateEventJoin(event,process.env,observed,binding);assert.equal(B,'9f20813c9855e30d4ca32e721862f739b6d696ba','Reviewed normal613 predecessor');cleanCheckout();
 const entryBytes=processOutput('git',['ls-tree','-rz','--full-tree',H]),entries=parseGitEntries(entryBytes);
 assert.equal(entries.length,binding.expectedAssembledEntryCount,'Reviewed full source count');
 setReadPhase('projection-policy');
 const policyEntry=entries.find(entry=>entry.path==='config/deployment-manifest.json');
 assert(policyEntry&&policyEntry.mode==='100644','Reviewed regular deployment policy');
 const policyBytes=sourceBytes(policyEntry);
 assert.equal(hash(policyBytes),'78f7a1c46accaf56fb83ec1f4d8f5ecf98621a620807658c805870191297b103','Reviewed deployment policy before initial projection');
 const policy=JSON.parse(utf8Text(policyBytes));
 setReadPhase('source-initial');
 const initialSource=sourceInventoryWithProjection(entries,sourceBytes,policy);
 const rows=initialSource.rows,expectedProjection=initialSource.projected,byPath=new Map(rows.map(r=>[r.path,r]));
 const assembled=assembledBytes(H,observed.headTree,binding.reviewedFinalMapSha256,rows);assert(assembled.length<=E610_LIMITS.manifest,'Assembled byte bound');
 assert.equal(hash(assembled),binding.expectedAssembledManifestSha256,'Publisher expected complete raw source manifest');
 const changed=utf8Text(processOutput('git',['diff','--no-renames','--name-only','-z','9f20813c9855e30d4ca32e721862f739b6d696ba',H])).split('\0').filter(Boolean);
 assert.equal(changed.length,binding.expectedBaseRelativePathCount,'Reviewed normal613-base-relative path count');
 const qualifier=byPath.get('scripts/validate-sync-current-forward.js'),fixture=byPath.get('scripts/fixtures/sync-normal-613-20261112.json');
 assert(qualifier&&fixture&&qualifier.mode==='100644'&&fixture.mode==='100644','Reviewed regular qualifier and fixture');
 assert.equal(qualifier.sha256,binding.qualifierSha256);assert.equal(fixture.sha256,binding.fixtureSha256);
 for(const [row,wanted]of [[qualifier,rawBinding.qualifier],[fixture,rawBinding.fixture]])assert.deepEqual({path:row.path,bytes:row.bytes,sha256:row.sha256,gitBlob:row.gitBlob,mode:row.mode},wanted,'Frozen normal613 source descriptor');
 const reservationBytes=decodeBoundBase64(binding.reservationReceiptBase64,binding.reservationReceiptSha256);
 assert.equal(binding.reservationReceiptSha256,NORMAL613_CALLER_POLICY.reservationSha256,'Selected immutable normal613 reservation');
 const rawReservation=normal613Reservation(reservationBytes),reservation={...rawReservation,id:rawReservation.reservationId};
 const freshBytes=decodeBoundBase64(binding.freshMainAndReservationBindingBase64,binding.freshMainAndReservationBindingSha256);
 const fresh=JSON.parse(utf8Text(freshBytes));unicodeSafe(fresh);validateFresh(fresh,binding,B,reservation,Date.now());
 validateRuntimePlatform(process.version,process.platform,process.arch);
 setReadPhase('locked-inputs');
 const lock=JSON.parse(utf8Text(sourceBytes(byPath.get('package-lock.json'))));
 const installedLockBytes=stableBytes(path.join(root,'node_modules/.package-lock.json')),installedLock=JSON.parse(utf8Text(installedLockBytes));
 assert(lock.packages&&installedLock.packages,'Declared and installed lock packages');
 for(const [name,metadata]of Object.entries(installedLock.packages)){
  const wanted=lock.packages[name];assert(wanted,'Undeclared installed package');
  for(const key of ['version','resolved','integrity'])if(wanted[key]!==undefined)assert.equal(metadata[key],wanted[key],'Installed lock '+name+' '+key);
 }
 const terserMain=require.resolve('terser'),terserOwner=resolveLockedTerserPackage({checkoutRoot:root,entryFile:terserMain,lockedPackages:lock.packages,readManifest:file=>JSON.parse(utf8Text(stableBytes(file)))});
 assert.equal(terserOwner.manifest.version,'5.44.0');
 const npmVersion=utf8Text(processOutput('npm',['--version'],65536)).trim();assert(/^\d+\.\d+\.\d+$/.test(npmVersion),'Observed npm version string');
 setReadPhase('dependencies-initial');
 const installed=dependencies(),nodePath=fs.realpathSync(process.execPath);
 setReadPhase('node-initial');
 const nodeBinary=rawIdentity(nodePath,nodePath,path.dirname(nodePath));
 assert.equal(nodeBinary.mode,'100755','Executable actual Node binary');
 setReadPhase('terser-provenance');
 const entryIdentity=rawIdentity(terserMain,path.relative(root,terserMain).split(path.sep).join('/'));
 const manifestIdentity=rawIdentity(terserOwner.manifestPath,path.relative(root,terserOwner.manifestPath).split(path.sep).join('/'));
 const proof={schemaVersion:'canonical-ci-dependencies.v1',installCommand:'npm ci',lockSha256:byPath.get('package-lock.json').sha256,installedLockSha256:hash(installedLockBytes),terser:{main:path.relative(root,terserMain).split(path.sep).join('/'),package:terserOwner.location,version:terserOwner.manifest.version,entryIdentity,manifestIdentity},fileMapSha256:hash(Buffer.from(JSON.stringify(installed))),files:installed,auditRemediation:false};
 const temporary=fs.realpathSync(process.env.RUNNER_TEMP),admission=path.join(temporary,'ns-normal-613-admission');assert(path.isAbsolute(temporary)&&!inside(root,admission),'Admission must be outside checkout');parentDirectories(path.join(temporary,'unused'),temporary);
 assert.equal(admission,nsContext.root);const admissionStat=fs.lstatSync(admission);assert(admissionStat.isDirectory()&&!admissionStat.isSymbolicLink()&&admissionStat.uid===process.getuid()&&(admissionStat.mode&0o077)===0,'Private owned admission root');
 function save(name,bytes,maximum=E610_LIMITS.manifest){
  const file=ownedPath(admission,path.join(admission,name));assert(bytes.length<=maximum,'Owned output bound');parentDirectories(file,admission);
  fs.writeFileSync(file,bytes,{mode:0o600,flag:'wx'});const owned=fs.lstatSync(file);assert(owned.uid===process.getuid()&&(owned.mode&0o077)===0,'Private owned metadata file');const actual=stableBytes(file,maximum,admission);assert(actual.equals(bytes),'Written metadata bytes');
  return {path:file,bytes:actual.length,sha256:hash(actual)};
 }
 setReadPhase('metadata-writeback');
 const assembledFile=save('assembled-source-manifest.json',assembled),proofFile=save('dependencies.json',jsonBytes(proof));
 const reservationFile=save('reservation-receipt.json',reservationBytes,E610_LIMITS.receipt),freshFile=save('fresh-main-reservation-binding.json',freshBytes,E610_LIMITS.receipt);
 assert.equal(byPath.get('scripts/materialize-git-tree.js').sha256,'f7b3a8d7867dc9af5df217a02d80b3135b542ef498937c67044cc7f7d0001373');
 assert.equal(byPath.get('config/deployment-manifest.json').sha256,'78f7a1c46accaf56fb83ec1f4d8f5ecf98621a620807658c805870191297b103');
 setReadPhase('projection-source');
 // Expected bytes were prepared during the complete initial source proof; no second parent source pass.
 const snapshot=path.join(admission,'deployment-snapshot');
 setReadPhase('child-reservation');
 const childReadReservation=2*expectedProjection.reduce((n,e)=>n+e.row.sourceBytes*(e.row.path.endsWith('.js')?2:1),0);
 charge(childReadReservation,null,true);
 processOutput(process.execPath,['scripts/materialize-git-tree.js',H,snapshot,'--deployment'],65536,E610_LIMITS.materializerMs);
 setReadPhase('projection-output');
 const deploymentPath=ownedPath(admission,path.join(snapshot,'deployment-files.json')),deploymentBytes=stableBytes(deploymentPath,E610_LIMITS.manifest,admission),deployment=JSON.parse(utf8Text(deploymentBytes));
 assert.equal(fs.lstatSync(deploymentPath).uid,process.getuid(),'Owned deployment inventory');
 const expectedInventory={revision:H,bytes:expectedProjection.reduce((n,e)=>n+e.row.bytes,0),files:expectedProjection.map(e=>e.row)};
 validateInventory(deployment,expectedInventory);
 const deploymentProofFile=save("deployment-source-manifest.json",deploymentBytes);
 const expectedPaths=new Set(['deployment-files.json','.vercelignore',...expectedProjection.map(e=>e.row.path)]);
 function deploymentFiles(dir){
  for(const name of fs.readdirSync(dir)){const file=path.join(dir,name),st=fs.lstatSync(file);
   if(st.isDirectory()){assert(!st.isSymbolicLink(),'Deployment directory link');deploymentFiles(file);}
   else{const relative=path.relative(snapshot,file).split(path.sep).join('/');assert(expectedPaths.delete(relative),'Unlisted/duplicate deployment output');}
  }
 }
 for(const item of expectedProjection){
  const file=ownedPath(snapshot,path.join(snapshot,...item.row.path.split('/')));parentDirectories(file,snapshot);
  let bytes;const st=fs.lstatSync(file);
  if(item.mode==='120000'){
   assert(st.isSymbolicLink(),'Projected link mode');charge(st.size,file);bytes=fs.readlinkSync(file,{encoding:'buffer'});assert.equal(bytes.length,st.size,'Projected link byte length');
   const target=utf8Text(bytes);linkWithin(snapshot,file,target);stableStats(st,fs.lstatSync(file),'Projected link');
  }else{assert.equal(st.mode&0o111?'100755':'100644',item.mode,'Projected mode');bytes=stableBytes(file,E610_LIMITS.file,snapshot);}
  assert(bytes.equals(item.bytes),'Exact projected output bytes');
 }
 assert.equal(utf8Text(stableBytes(path.join(snapshot,'.vercelignore'),1024,snapshot)),'deployment-files.json\n');
 deploymentFiles(snapshot);assert.equal(expectedPaths.size,0,'Incomplete projected file set');
 setReadPhase('source-final');
 assert.deepEqual(sourceInventory(entries),rows,'Tracked source changed during metadata preparation');
 setReadPhase('dependencies-final');
 assert.equal(hash(Buffer.from(JSON.stringify(dependencies()))),proof.fileMapSha256,'Installed dependencies changed during metadata preparation');
 setReadPhase('node-final');
 assert.deepEqual(rawIdentity(nodePath,nodePath,path.dirname(nodePath)),nodeBinary,'Node binary changed');
 cleanCheckout();assert.equal(git('rev-parse','HEAD'),T);assert.equal(git('rev-parse',H+'^{tree}'),observed.headTree);validateFresh(fresh,binding,B,reservation,Date.now());
 const sourceDescriptor=row=>({path:row.path,bytes:row.bytes,sha256:row.sha256,gitBlob:row.gitBlob,mode:row.mode});
 const admittedAt=new Date().toISOString(),qualifierHardTimeoutMs=normal613Remaining(nsContext.value,120000)-5000;
 assert(qualifierHardTimeoutMs>0,'Reserve writeback/closure within remaining authority');
 const nsIntentFile={path:path.join(admission,'normal613-intent.json'),bytes:nsIntentBytes.length,sha256:hash(nsIntentBytes)},nsAckFile={path:path.join(admission,'normal613-ack.json'),bytes:nsAckBytes.length,sha256:hash(nsAckBytes)};
 const normalAction={schemaVersion:'normal613-owned-action-observation.v1',phase:'qualification',purpose:'normal613-qualification',allocationId:rawBinding.actionIntent.allocationId,laneId:rawBinding.actionIntent.laneId,ownedOperationId:rawBinding.actionIntent.ownedOperationId,allocatedAt:nsContext.value.allocation.allocatedAt,admittedAt,startedAt:nsContext.value.startedAt,observationAt:admittedAt,validUntil:rawBinding.actionIntent.validUntil,maxWallMs:rawBinding.actionIntent.maxWallMs,monotonicElapsedMs:Math.floor(Number(process.hrtime.bigint()-BigInt(nsContext.value.startMonotonicNs))/1e6),hardTimeoutMs:qualifierHardTimeoutMs};
 assert(normal613Time(JSON.parse(utf8Text(nsAckBytes)).acknowledgedAt,'Actual ACK')<=normal613Time(normalAction.startedAt,'Actual action start'));
 const receipt={schemaVersion:'normal613-qualification-execution-receipt.v1',publisherHeadSha:H,publisherTreeSha:observed.headTree,releaseGitSha:H,actualTestedMergeSha:T,actualAssembledSourceManifestPath:assembledFile.path,actualAssembledSourceManifestSha256:assembledFile.sha256,actualDeploymentSourceManifestPath:deploymentPath,actualDeploymentSourceManifestSha256:hash(deploymentBytes),actualNodeBinarySha256:nodeBinary.sha256,actualDependencyProofSha256:proofFile.sha256,freshMainAndReservationBindingSha256:freshFile.sha256,namedAllocationId:binding.namedAllocationId,actualCloudRunId:process.env.GITHUB_RUN_ID,actualCloudRunAttempt:Number(process.env.GITHUB_RUN_ATTEMPT),actualCloudJobId:'github-job-key:fixture-activation',actualCloudJobKey:'fixture-activation',actualCloudNumericJobId:null,actualWorkflowPath:process.env.GITHUB_WORKFLOW_REF.slice('hartican/sportscal/'.length).split('@')[0],headRole:'pull_request.head.sha',testedCommitRole:'pull_request-merge-checkout',releaseRole:'source-qualification-candidate',jobIdKind:'github-job-key',observedAt:admittedAt,eventBodySha256:bodySha256,approvedFinalMap:{reviewedMapSha256:binding.reviewedFinalMapSha256,expectedTree:binding.expectedPublisherTreeSha,entryCount:rows.length,baseRelativePathCount:changed.length,assembledManifestSha256:assembledFile.sha256},cloudContext:{repository:process.env.GITHUB_REPOSITORY,eventName:process.env.GITHUB_EVENT_NAME,runId:process.env.GITHUB_RUN_ID,runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT),jobKey:process.env.GITHUB_JOB,ref:process.env.GITHUB_REF,pullRequestNumber:String(event.number)},qualifier:sourceDescriptor(qualifier),fixture:sourceDescriptor(fixture),git:{headSha:H,headTree:observed.headTree,baseSha:B,testedMergeSha:T,testedTree:observed.testedTree,testedMergeParents:observed.parents,trackedSourceUnchanged:true},runtime:{node:process.version,platform:process.platform,arch:process.arch,npm:npmVersion,nodeBinary,dependencyProof:{...proofFile,schemaVersion:'canonical-ci-dependencies.v1'}},reservation:{id:reservation.id,version:reservation.version,receipt:reservationFile},freshMainAndReservationBinding:{receipt:freshFile},admissionGranted:true,normal613Action:normalAction,normal613Intent:nsIntentFile,normal613Ack:nsAckFile};
 setReadPhase('receipt-writeback');
 const receiptFile=save('execution-receipt.json',jsonBytes(receipt),E610_LIMITS.receipt);

  const receiptMembers=new Map([
   ['assembled-source-manifest.json',assembledFile],['deployment-source-manifest.json',deploymentProofFile],['dependencies.json',proofFile],
   ['reservation-receipt.json',reservationFile],['fresh-main-reservation-binding.json',freshFile],['normal613-intent.json',nsIntentFile],['normal613-ack.json',nsAckFile]
  ]);
  normal613Save(admission,'normal613-receipt-member-map.json',{schemaVersion:'normal613-receipt-member-map.v1',receipt:{member:'execution-receipt.json',bytes:receiptFile.bytes,sha256:receiptFile.sha256},references:normal613ReceiptMemberReferences(receipt,receiptMembers)});

 const output=fs.realpathSync(process.env.GITHUB_OUTPUT);assert(!inside(root,output),'Outputs file outside checkout');textValue(receiptFile.path,'Receipt output path');
 fs.appendFileSync(output,'executionReceiptPath='+receiptFile.path+'\nexecutionReceiptSha256='+receiptFile.sha256+'\n',{encoding:'utf8'});
 const engineContext={schemaVersion:'normal613-admitted-engine-context.v1',repository:process.env.GITHUB_REPOSITORY,pullRequest:event.number,headSha:H,baseSha:B,testedMergeSha:T,tree:observed.headTree,bodySha256,intentSha256:nsIntentFile.sha256,ackSha256:nsAckFile.sha256,policySha256:nsContext.value.policySha256,sourceManifestSha256:assembledFile.sha256,executionReceiptSha256:receiptFile.sha256,allocationId:binding.namedAllocationId,laneId:rawBinding.actionIntent.laneId,ownedOperationId:rawBinding.actionIntent.ownedOperationId,validUntil:rawBinding.actionIntent.validUntil,actionStartedAt:nsContext.value.startedAt,actionDeadlineAt:nsContext.value.actionDeadlineAt,maxWallMs:nsContext.value.maxWallMs,allocatedAt:nsContext.value.allocation.allocatedAt,runId:process.env.GITHUB_RUN_ID,runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT),engines:['chromium','webkit']};
 const engineBytes=Buffer.from(JSON.stringify(engineContext)+'\n');normal613Save(admission,'normal613-admitted-engine-context.json',engineBytes);fs.appendFileSync(output,'engineContextBase64='+engineBytes.toString('base64')+'\nengineContextSha256='+hash(engineBytes)+'\n');
 console.log(JSON.stringify({schemaVersion:'normal613-source-admission-readout.v1',head:H,testedMerge:T,tree:observed.headTree,sourceCount:rows.length,dependencyCount:installed.length,assembledSha256:assembledFile.sha256,deploymentSha256:hash(deploymentBytes),executionReceiptSha256:receiptFile.sha256,releaseAcceptance:false,numericJobJoin:'PENDING_OUTER_PUBLISHER'}));
 
}

function normal613FixtureCommandIds(){return ['journey','install','signup','feed','calendar','production','admission','qualifier','premerge'];}
function normal613EngineCommandIds(engine){return ['baseline','context','apt','install','tooling','offline','pwa','all-sports','account',...(engine==='webkit'?['original-manifest']:[]),'directories','feed-controls'];}
async function normal613EngineContext(){
 const localWall=Date.now(),localMonotonic=process.hrtime.bigint();
 const p=NORMAL613_CALLER_POLICY;assert.equal(process.env.GITHUB_JOB,'installed-upgrade');assert(['chromium','webkit'].includes(process.env.NS_OBSERVED_ENGINE));
 const bytes=normal613Decode(process.env.NS_NORMAL613_ENGINE_CONTEXT,process.env.NS_NORMAL613_ENGINE_CONTEXT_SHA256,'Admitted engine context'),v=normal613Canonical(bytes,'Engine context');
 normal613Keys(v,'schemaVersion repository pullRequest headSha baseSha testedMergeSha tree bodySha256 intentSha256 ackSha256 policySha256 sourceManifestSha256 executionReceiptSha256 allocationId laneId ownedOperationId validUntil actionStartedAt actionDeadlineAt maxWallMs allocatedAt runId runAttempt engines','Engine identity');
 assert.equal(v.schemaVersion,'normal613-admitted-engine-context.v1');assert.equal(v.repository,p.repository);assert.equal(v.runId,process.env.GITHUB_RUN_ID);assert.equal(String(v.runAttempt),process.env.GITHUB_RUN_ATTEMPT);assert.equal(v.runAttempt,1);
 assert.equal(v.policySha256,hash(Buffer.from(JSON.stringify(p))));assert.equal(v.testedMergeSha,process.env.GITHUB_SHA);assert.equal(v.baseSha,p.base);assert.deepEqual(v.engines,['chromium','webkit']);
 const context={...v,engine:process.env.NS_OBSERVED_ENGINE,startedAt:v.actionStartedAt,clockObservedAt:new Date(localWall).toISOString(),startMonotonicNs:localMonotonic.toString()};
 assert(normal613Time(v.allocatedAt,'Original allocation')<=normal613Time(v.actionStartedAt,'Original action start'));
 const remaining=()=>normal613Remaining(context,p.limits.jobMs);remaining();
 const cp=require('node:child_process'),git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',timeout:Math.min(5000,remaining()),killSignal:'SIGKILL',maxBuffer:4194304}).trim();
 assert.equal(git('rev-parse','HEAD'),v.testedMergeSha);assert.deepEqual(git('show','-s','--format=%P','HEAD').split(' '),[v.baseSha,v.headSha]);assert.equal(git('rev-parse','HEAD^{tree}'),v.tree);
 const root=normal613OwnedRoot('ns-normal-613-engine',true,remaining),proof=path.join(fs.realpathSync(process.env.RUNNER_TEMP),'ns-upgrade-proof');remaining();fs.mkdirSync(proof,{mode:0o700});
 normal613Save(root,'normal613-context.json',context,remaining);
 normal613Save(proof,'normal613-admission-context.json',bytes,remaining);
}
async function normal613OwnedRun(id,command,args){
 const c=normal613Context(),v=c.value,engine=process.env.GITHUB_JOB==='installed-upgrade',allowed=engine?normal613EngineCommandIds(v.engine):normal613FixtureCommandIds();
 assert(allowed.includes(id),'Closed normal command identity');assert.equal(command,'bash');assert.deepEqual(args,['-Eeuo','pipefail']);
 const caps={admission:120000,qualifier:120000,premerge:300000,install:engine?600000:300000,apt:300000,pwa:240000,account:300000,'original-manifest':300000,'feed-controls':195000};
 let cap=caps[id]||125000;
 if(id==='qualifier'){
  const receipt=normal613Canonical(normal613Read(c.root,'execution-receipt.json',16384),'Execution receipt');
  assert.equal(receipt.schemaVersion,'normal613-qualification-execution-receipt.v1');
  assert(Number.isSafeInteger(receipt.normal613Action.hardTimeoutMs)&&receipt.normal613Action.hardTimeoutMs>0);
  cap=Math.min(cap,receipt.normal613Action.hardTimeoutMs);
 }
 const startWall=Date.now(),startMono=process.hrtime.bigint(),budget=normal613Remaining(v,cap);
 assert(budget>6000,'Reserve termination, final observation and record writeback inside authority');
 const root=c.root,cp=require('node:child_process'),outputs={stdout:[],stderr:[]},DEADLINE=Symbol('final closure deadline');
 let child=null,input=Buffer.alloc(0),used=0,failure=null,interrupted=null,status=null,signalName=null,closedAt=null,exitAt=null;
 let softTimer=null,killTimer=null,finalTimer=null,finalReached=false,finalAt=startMono+BigInt(budget-500)*1000000n,resolveFinal;
 const finalGate=new Promise(resolve=>{resolveFinal=resolve;});
 const delayTo=at=>Math.max(0,Math.ceil(Number(at-process.hrtime.bigint())/1e6));
 const kill=signal=>{if(Number.isSafeInteger(child?.pid))try{process.kill(-child.pid,signal);}catch(e){if(e.code!=='ESRCH')failure=failure||'Owned group signal unconfirmed: '+e.code;}};
 const detachLocalHandles=()=>{if(child){for(const stream of [child.stdin,child.stdout,child.stderr])stream?.destroy();child.unref();}process.stdin.destroy();};
 const finalStop=()=>{finalReached=true;failure=failure||'Absolute closure deadline reached';kill('SIGKILL');detachLocalHandles();resolveFinal(DEADLINE);};
 const armFinal=()=>{clearTimeout(finalTimer);finalTimer=setTimeout(finalStop,delayTo(finalAt));};
 const terminate=reason=>{
  failure=failure||reason;kill('SIGTERM');const now=process.hrtime.bigint(),earlier=now+4500000000n;
  if(earlier<finalAt){finalAt=earlier;armFinal();}
  clearTimeout(killTimer);const forceAt=now+4000000000n<finalAt?now+4000000000n:finalAt;
  killTimer=setTimeout(()=>kill('SIGKILL'),delayTo(forceAt));
 };
 const onTerm=()=>{interrupted='SIGTERM';terminate('Parent interrupted by SIGTERM');},onInt=()=>{interrupted='SIGINT';terminate('Parent interrupted by SIGINT');};
 process.once('SIGTERM',onTerm);process.once('SIGINT',onInt);armFinal();
 softTimer=setTimeout(()=>terminate('Owned command deadline'),Math.max(0,budget-5000));
 let groupGone=false,groupObservedAt=null;
 try{
  const collect=async()=>{const chunks=[];let n=0;for await(const chunk of process.stdin){n+=chunk.length;assert(n<=65536,'Bounded immutable command script');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);};
  const received=await Promise.race([collect().catch(e=>{failure=failure||e.message;return DEADLINE;}),finalGate]);
  if(received!==DEADLINE&&!finalReached&&process.hrtime.bigint()<finalAt){
   input=received;child=cp.spawn(command,args,{cwd:process.cwd(),env:process.env,detached:true,stdio:['pipe','pipe','pipe']});
   const closeGate=new Promise(resolve=>{
    child.once('error',e=>{failure=failure||String(e.message);});
    child.once('exit',()=>{exitAt=process.hrtime.bigint();});
    child.once('close',(code,sig)=>{status=code;signalName=sig;closedAt=process.hrtime.bigint();resolve();});
   });
   for(const stream of ['stdout','stderr'])child[stream].on('data',chunk=>{
    used+=chunk.length;if(used>NORMAL613_CALLER_POLICY.limits.commandOutput){terminate('Owned command output overflow');return;}
    outputs[stream].push(Buffer.from(chunk));process[stream].write(chunk);
   });
   child.stdin.on('error',e=>{if(e.code!=='EPIPE')terminate('Owned stdin error');});child.stdin.end(input);
   await Promise.race([closeGate,finalGate]);
   const observeGroup=()=>{
    if(!Number.isSafeInteger(child.pid))return false;
    try{process.kill(-child.pid,0);return false;}catch(e){if(e.code==='ESRCH'){groupObservedAt=process.hrtime.bigint();return true;}failure=failure||'Group closure observation unconfirmed: '+e.code;return false;}
   };
   groupGone=observeGroup();
   if(!groupGone&&process.hrtime.bigint()<finalAt){terminate('Owned descendants remain after parent closure');kill('SIGKILL');
    while(!groupGone&&!finalReached&&process.hrtime.bigint()<finalAt){await new Promise(r=>setTimeout(r,Math.min(25,delayTo(finalAt))));groupGone=observeGroup();}
   }
  }else failure=failure||'Input/dispatch deadline reached';
  const childClosed=closedAt!==null&&closedAt<=finalAt&&!finalReached,ownedGroupClosed=groupGone&&groupObservedAt!==null&&groupObservedAt<=finalAt&&!finalReached;
  if(!childClosed||!ownedGroupClosed){failure=failure||'Final child/stdio/group closure unresolved';kill('SIGKILL');detachLocalHandles();}
  clearTimeout(softTimer);clearTimeout(killTimer);clearTimeout(finalTimer);
  const record={schemaVersion:'normal613-owned-command.v1',id,repository:v.repository,headSha:v.headSha,baseSha:v.baseSha,testedMergeSha:v.testedMergeSha,bodySha256:v.bodySha256,intentSha256:v.intentSha256,allocationId:v.allocation?.allocationId||v.allocationId,laneId:v.allocation?.laneId||v.laneId,ownedOperationId:v.allocation?.ownedOperationId||v.ownedOperationId,runId:process.env.GITHUB_RUN_ID,runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT),job:process.env.GITHUB_JOB,engine:v.engine||null,command,args,scriptBytes:input.length,scriptSha256:hash(input),startedAt:new Date(startWall).toISOString(),finishedAt:new Date().toISOString(),monotonicElapsedMs:Number(process.hrtime.bigint()-startMono)/1e6,hardBudgetMs:budget,finalClosureDeadlineAt:new Date(startWall+Number(finalAt-startMono)/1e6).toISOString(),finalClosureDeadlineReached:finalReached,status,signal:signalName,interrupted,failure,childPid:child?.pid||null,parentExitObserved:exitAt!==null,childClosed,ownedGroupClosed,outputObservedBytes:used,outputOverflow:used>NORMAL613_CALLER_POLICY.limits.commandOutput,cleanupStatus:childClosed&&ownedGroupClosed?'OBSERVED_CLOSED':'FAILED_OR_UNKNOWN'};
  for(const stream of ['stdout','stderr'])normal613Save(root,'command-'+id+'.'+stream+'.log',Buffer.concat(outputs[stream]));
  normal613Save(root,'command-'+id+'.json',record);
  assert(childClosed&&ownedGroupClosed&&!failure&&status===0&&process.hrtime.bigint()<startMono+BigInt(budget)*1000000n,'Normal command failed, expired or cleanup unconfirmed: '+id);
 }finally{
  clearTimeout(softTimer);clearTimeout(killTimer);clearTimeout(finalTimer);process.removeListener('SIGTERM',onTerm);process.removeListener('SIGINT',onInt);
  if(child&&(closedAt===null||!groupGone)){kill('SIGKILL');detachLocalHandles();}
 }
}
function normal613ReceiptMemberReferences(receipt,members){
 const rows=[
  ['actualAssembledSourceManifestPath','assembled-source-manifest.json',receipt.actualAssembledSourceManifestPath,receipt.actualAssembledSourceManifestSha256],
  ['actualDeploymentSourceManifestPath','deployment-source-manifest.json',receipt.actualDeploymentSourceManifestPath,receipt.actualDeploymentSourceManifestSha256],
  ['runtime.dependencyProof.path','dependencies.json',receipt.runtime.dependencyProof.path,receipt.runtime.dependencyProof.sha256],
  ['reservation.receipt.path','reservation-receipt.json',receipt.reservation.receipt.path,receipt.reservation.receipt.sha256],
  ['freshMainAndReservationBinding.receipt.path','fresh-main-reservation-binding.json',receipt.freshMainAndReservationBinding.receipt.path,receipt.freshMainAndReservationBinding.receipt.sha256],
  ['normal613Intent.path','normal613-intent.json',receipt.normal613Intent.path,receipt.normal613Intent.sha256],
  ['normal613Ack.path','normal613-ack.json',receipt.normal613Ack.path,receipt.normal613Ack.sha256]
 ];
 return rows.map(([receiptField,member,receiptPath,sha256])=>{
  const d=members.get(member);assert(d&&d.sha256===sha256,'Receipt/member content join '+member);
  return {receiptField,receiptPath,member,bytes:d.bytes,sha256};
 });
}
function normal613Seal(){
 const engine=process.env.GITHUB_JOB==='installed-upgrade',base=fs.realpathSync(process.env.RUNNER_TEMP),L=NORMAL613_CALLER_POLICY.limits;
 const output=normal613OwnedRoot('ns-normal-613-artifact',true),members=[],issues=[],sources=[],copiedDocuments=new Map();
 let context=null;
 try{context=normal613Context().value;}catch(e){issues.push('Missing/unreadable admitted context');}
 const root=path.join(base,engine?'ns-normal-613-engine':'ns-normal-613-admission');
 const admissionNames=['assembled-source-manifest.json','dependencies.json','reservation-receipt.json','fresh-main-reservation-binding.json','execution-receipt.json','normal613-intent.json','normal613-ack.json','normal613-context.json','normal613-fresh.json','normal613-reservation.json','normal613-approval-witness.json','normal613-readback-before-admission.json','normal613-readback-before-qualification.json','normal613-admitted-engine-context.json','deployment-source-manifest.json','normal613-receipt-member-map.json'];
 const focusedNames=['context.json','report.json','stdout.log','stderr.log'];
 const required=engine?['context.json','baseline-controls.log','installed-baseline.log','installed-tooling.json','install.log','normal613-admission-context.json']:[...admissionNames,...focusedNames.map(n=>'focused/'+n)];
 const proof=engine?path.join(base,'ns-upgrade-proof'):root;
 const add=(file,name)=>{assert(!path.isAbsolute(name)&&!name.split('/').some(s=>!s||s==='.'||s==='..')&&!name.includes('\\'));sources.push({file,name});};
 if(engine){
  const visit=(dir,prefix='',depth=0)=>{assert(depth<16,'Proof directory depth');const st=fs.lstatSync(dir);assert(st.isDirectory()&&!st.isSymbolicLink()&&st.uid===process.getuid());
   for(const name of fs.readdirSync(dir).sort()){assert(sources.length<L.members-2,'Proof member bound');const file=path.join(dir,name),s=fs.lstatSync(file),relative=prefix+name;
    if(s.isDirectory()){assert(!s.isSymbolicLink());visit(file,relative+'/',depth+1);}else add(file,relative);
   }};
  try{visit(proof);}catch(e){issues.push('Incomplete/unsafe engine proof inventory: '+e.message);}
 }else for(const name of admissionNames)if(fs.existsSync(path.join(root,name)))add(path.join(root,name),name);
 if(!engine)for(const name of focusedNames){const file=path.join(base,'ns-normal-613-focused',name);if(fs.existsSync(file))add(file,'focused/'+name);else issues.push('Missing focused proof '+name);}
 const ids=context?(engine?normal613EngineCommandIds(context.engine):normal613FixtureCommandIds()):[];
 for(const id of ids)for(const suffix of ['json','stdout.log','stderr.log']){const file=path.join(root,'command-'+id+'.'+suffix);if(fs.existsSync(file))add(file,'commands/command-'+id+'.'+suffix);else issues.push('Missing command evidence '+id+'.'+suffix);}
 let total=0;
 for(const item of sources){
  try{
   assert(members.length<L.members-2,'Artifact member bound');const s=fs.lstatSync(item.file);assert(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid(),'Regular owned proof member');
   assert(Number.isSafeInteger(s.size)&&s.size>=0&&s.size<=L.metadata&&total+s.size<=L.artifact-L.metadata,'Producer proof byte bound with manifest headroom');
   const fd=fs.openSync(item.file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let bytes;
   try{const opened=fs.fstatSync(fd);for(const k of ['dev','ino','size','mtimeMs','ctimeMs'])assert.equal(opened[k],s[k]);bytes=fs.readFileSync(fd);const last=fs.fstatSync(fd);for(const k of ['dev','ino','size','mtimeMs','ctimeMs'])assert.equal(last[k],s[k]);assert.equal(bytes.length,s.size);}finally{fs.closeSync(fd);}
   const dir=path.dirname(path.join(output,item.name));fs.mkdirSync(dir,{recursive:true,mode:0o700});
   const saved=normal613Save(dir,path.basename(item.name),bytes);members.push({path:item.name,bytes:saved.bytes,sha256:saved.sha256});total+=bytes.length;
   if(["execution-receipt.json","normal613-receipt-member-map.json","focused/context.json","focused/report.json"].includes(item.name))copiedDocuments.set(item.name,bytes);
   if(item.name.startsWith('commands/')&&item.name.endsWith('.json')){const r=JSON.parse(normal613Utf8(bytes));if(r.status!==0||r.failure||!r.childClosed||!r.ownedGroupClosed||r.outputOverflow)issues.push('Command failed/unknown '+r.id);}
  }catch(e){issues.push('Member refused '+item.name+': '+e.message);}
 }
 for(const name of required)if(!members.some(m=>m.path===name))issues.push('Required member absent '+name);

 if(!engine)try{
  const receiptBytes=copiedDocuments.get('execution-receipt.json'),mapBytes=copiedDocuments.get('normal613-receipt-member-map.json');
  assert(receiptBytes&&mapBytes,'Required receipt/member map bytes');const receipt=normal613Canonical(receiptBytes,'Execution receipt'),mapping=JSON.parse(normal613Utf8(mapBytes));normal613UnicodeSafe(mapping);
  normal613Keys(mapping,'schemaVersion receipt references','Receipt member map');assert.equal(mapping.schemaVersion,'normal613-receipt-member-map.v1');
  assert.deepEqual(mapping.receipt,{member:'execution-receipt.json',bytes:receiptBytes.length,sha256:hash(receiptBytes)});
  assert.deepEqual(mapping.references,normal613ReceiptMemberReferences(receipt,new Map(members.map(m=>[m.path,m]))),'Complete exact receipt/member references');
 }catch(e){issues.push('Receipt/member mapping failed: '+e.message);}

 if(!engine)try{
  const fc=JSON.parse(normal613Utf8(copiedDocuments.get('focused/context.json'))),fr=JSON.parse(normal613Utf8(copiedDocuments.get('focused/report.json')));
  normal613UnicodeSafe(fc);normal613UnicodeSafe(fr);assert.equal(fc.schemaVersion,'normal613-focused-context.v1');assert.equal(fr.schemaVersion,'normal613-focused-report.v1');assert.equal(fr.status,'PASS_FOCUSED_SYNTHETIC_CONTROLS_ONLY');
  for(const key of ['repository','headSha','testedMergeSha']){assert.equal(fc[key],context[key]);assert.equal(fr[key],context[key]);}
  for(const value of [fc,fr]){assert.equal(value.runId,process.env.GITHUB_RUN_ID);assert.equal(value.runAttempt,Number(process.env.GITHUB_RUN_ATTEMPT));assert.equal(value.executionReceiptSha256,hash(copiedDocuments.get('execution-receipt.json')));assert.equal(value.originalDeadline||value.originalActionDeadline,context.actionDeadlineAt);}
  assert.equal(fc.assembledManifestSha256,JSON.parse(normal613Utf8(copiedDocuments.get('execution-receipt.json'))).actualAssembledSourceManifestSha256);
  assert.equal(fr.aggregateEntryNs,fc.aggregateEntryNs);assert.equal(fr.aggregateDeadlineNs,fc.aggregateDeadlineNs);assert(BigInt(fc.aggregateDeadlineNs)>BigInt(fc.aggregateEntryNs)&&BigInt(fc.aggregateDeadlineNs)-BigInt(fc.aggregateEntryNs)<=120000000000n);assert.equal(fr.failure,null);assert.equal(fr.releaseAcceptance,false);assert.equal(fr.realAuthorityFromSyntheticRecords,false);assert.deepEqual(fr.unrun,[]);assert.deepEqual(fr.newScratchRoots,[]);assert.equal(fr.completed.length,8);assert.equal(fc.sources.length,8);
  for(const row of fr.completed){assert.equal(row.status,0);assert.equal(row.reason,null);assert(row.childClosed&&row.topLevelGroupClosed&&row.ownedCleanupObserved&&row.childReportAccepted&&!row.cleanupHold);assert.deepEqual(row.ownershipHolds,[]);assert(Array.isArray(row.ownedProcessIdentities)&&row.ownedProcessIdentities.length>0);assert.deepEqual(row.newScratchRoots,[]);assert(BigInt(row.childSoftDeadlineNs)<BigInt(row.childHardDeadlineNs)&&BigInt(row.childHardDeadlineNs)<=BigInt(fc.aggregateDeadlineNs)-3000000000n);}
 }catch(e){issues.push('Focused control proof failed: '+e.message);}

 if(process.env.NS_NORMAL613_JOB_STATUS!=='success')issues.push('Observed job status '+process.env.NS_NORMAL613_JOB_STATUS);
 const manifest={schemaVersion:'normal613-artifact-manifest.v1',status:issues.length?'FAILED_OR_UNKNOWN':'COMPLETE',repository:NORMAL613_CALLER_POLICY.repository,workflow:process.env.GITHUB_WORKFLOW_REF,headSha:context?.headSha||null,baseSha:context?.baseSha||null,testedMergeSha:context?.testedMergeSha||null,tree:context?.tree||null,bodySha256:context?.bodySha256||null,intentSha256:context?.intentSha256||null,allocationId:context?.allocation?.allocationId||context?.allocationId||null,laneId:context?.allocation?.laneId||context?.laneId||null,ownedOperationId:context?.allocation?.ownedOperationId||context?.ownedOperationId||null,runId:process.env.GITHUB_RUN_ID,runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT),job:process.env.GITHUB_JOB,engine:context?.engine||null,observedAt:new Date().toISOString(),payloadBytes:total,files:members,expectedMembers:[...members.map(x=>x.path),'normal613-artifact-manifest.json'],requiredMembers:required,expectedCommands:ids,manifestSelfExcludedFromPayloadHashes:true,limits:{members:L.members,perMember:L.metadata,aggregate:L.artifact},issues,providerArtifactId:'POPULATED_BY_UPLOAD_ACTION_AND_OUTER_METADATA_JOIN',providerArtifactDigest:'OBSERVE_AFTER_UPLOAD',physicalIosAcceptance:false,releaseAcceptance:false};
 const saved=normal613Save(output,'normal613-artifact-manifest.json',manifest);assert(total+saved.bytes<=L.artifact,'Final aggregate artifact limit');
 console.log(JSON.stringify({schemaVersion:manifest.schemaVersion,status:manifest.status,manifest:saved,payloadMembers:members.length,payloadBytes:total,releaseAcceptance:false}));
 assert.equal(manifest.status,'COMPLETE','Incomplete producer evidence remains failed/unknown');
}

function normal613CallerSourceControls(text){
 const restored=restoreNormal613Caller(text);if(restored.edits===0)return {profile:'legacy',normal613RuntimeExecuted:false};
 assert.equal(hash(Buffer.from(restored.text)),NORMAL613_CALLER_AMENDMENT.beforeSha256);
 const normal=text.indexOf('--normal613-intake'),journey=text.indexOf('- name: Verify new-user journey source controls');assert(normal>0&&normal<journey,'external intake before application checks');
 const baseline=text.indexOf('- name: Verify and resolve installed production baseline'),context=text.indexOf('- name: Record exact source and runtime\n'),install=text.indexOf('- name: Install isolated test dependencies'),observed=text.indexOf('- name: Observe actual installed per-engine tooling'),browser=text.indexOf('- name: Verify browser tool offline emulation');
 assert(baseline<context&&context<install&&install<observed&&observed<browser,'early preflight and actual installed observation order retained');
 for(const token of ['--normal613-full','--normal613-verify-current','--normal613-engine-context','--normal613-seal','normal613-admission-','browser: [chromium, webkit]','node "$script" --full'])assert(text.includes(token),'Required independent route '+token);
 assert.equal(NORMAL613_CALLER_POLICY.relayUserId,269614001);assert.notEqual(NORMAL613_CALLER_POLICY.owners.RELEASE,NORMAL613_CALLER_POLICY.owners.PUBLISH);
 const negatives=[['normal intake removed','--normal613-intake','--normal613-intake-removed'],['normal qualifier removed','--normal613-full','--full'],['one engine omitted','browser: [chromium, webkit]','browser: [chromium]'],['manifest seal removed','--normal613-seal','--normal613-seal-removed'],['normal receipt output changed','normal613_source_admission.outputs.executionReceiptPath','normal613_source_admission.outputs.other']];
 for(const [name,from,to]of negatives){assert(text.includes(from),name+' applies');assert.throws(()=>restoreNormal613Caller(text.replace(from,to)),undefined,name);}
 return {profile:'normal613-source-only',restoredAcceptedP2:true,negativeNames:negatives.map(x=>x[0]),relayPolicyAdoption:'SOURCE_DESIGN_ADOPTED_RELEASE_01a1d290',normal613RuntimeExecuted:false,networkRequests:0,releaseAcceptance:false};
}

// No network/process dispatch occurs on import or on the unchanged legacy default.
async function normal613Main(argv){
 const mode=argv[0];
 if(mode==='--normal613-intake'){assert.equal(argv.length,1);return normal613Intake();}
 if(mode==='--normal613-admission'){assert.equal(argv.length,1);return normal613Admission();}
 if(mode==='--normal613-verify-current'){assert.equal(argv.length,1);return normal613Intake('qualification');}
 if(mode==='--normal613-engine-context'){assert.equal(argv.length,1);return normal613EngineContext();}
 if(mode==='--normal613-seal'){assert.equal(argv.length,1);return normal613Seal();}
 if(mode==='--normal613-run'){assert(argv.length>=5&&argv[2]==='--');return normal613OwnedRun(argv[1],argv[3],argv.slice(4));}
 throw Error('Unknown normal613 caller mode');
}
// NORMAL613_CALLER_SOURCE_END

if(require.main===module){
 const argv=process.argv.slice(2);
 if(argv[0]?.startsWith('--normal613-'))normal613Main(argv).catch(error=>{console.error('NORMAL613_FAILED '+String(error.message).slice(0,1000));process.exitCode=1;});
 else console.log(JSON.stringify(sourceControls(boundedRegularRead(path.resolve('.github/workflows/installed-upgrade-tests.yml'),256*1024*1024,sourceReadLedger).toString('utf8'))));
}
module.exports={normaliseForwardWorkflow,sourceControls,boundVersionPlanControls,boundedReaderControls,restoreNormal613Caller,normal613CallerSourceControls,normal613Body,normal613ValidateFresh,normal613ExpectedIntent,normal613Intake,normal613Main,normal613FocusedControls:Object.freeze({normal613FocusedClock,normal613FocusedOwnedProcesses,version:'normal613-focused-controls.v1',NORMAL613_CALLER_POLICY,normal613Remaining,normal613OwnedRoot,normal613Save,normal613UnicodeSafe,normal613Canonical,normal613ReceiptMemberReferences,normal613FixtureCommandIds,normal613EngineCommandIds})};
