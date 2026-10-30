'use strict';
// Launch binding only. Does not change any SQL, test, resource or timing logic.
// ROOT substitutes this nonce BEFORE committing the separate packet snapshot.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const ROOT=Object.freeze({nonce:'a5963c4d69e4ad10caf75dce4d8754aa',repository:'hartican/sportscal',ref:'refs/heads/codex/near-receipt-native-20261030-2',workflow:'.github/workflows/near-receipt-native-20261030-2.yml',source:'98af9164d15cddfb198fd35cd9e226b267723216'});
function validateEvent(env,event,expected=ROOT){
 assert.match(expected.nonce,/^[a-f0-9]{32}$/,'Unbound ROOT nonce; template cannot run');
 assert.equal(env.GITHUB_ACTIONS,'true');assert.equal(env.GITHUB_EVENT_NAME,'push','Actual push event required');assert.equal(env.GITHUB_RUN_ATTEMPT,'1','One use; job reruns refused');assert.equal(env.GITHUB_REPOSITORY,expected.repository);assert.equal(env.GITHUB_REPOSITORY_OWNER,'hartican');
 assert.equal(env.GITHUB_REF,expected.ref);assert.equal(env.GITHUB_REF_TYPE,'branch');assert.equal(env.GITHUB_REF_NAME,'codex/near-receipt-native-20261030-2');
 assert.equal(env.GITHUB_WORKFLOW_REF,expected.repository+'/'+expected.workflow+'@'+expected.ref);
 assert.match(env.GITHUB_SHA||'',/^[a-f0-9]{40}$/);assert.equal(env.GITHUB_WORKFLOW_SHA,env.GITHUB_SHA,'Workflow must come from exact pushed carrier');
 assert.equal(env.NEAR_ALLOCATION,'receipt-join-native-pg17-pg18-once');assert.equal(env.NEAR_NONCE,expected.nonce);
 assert.match(env.NEAR_PACKET_SHA||'',/^[a-f0-9]{40}$/);assert.notEqual(env.NEAR_PACKET_SHA,env.GITHUB_SHA,'Separate immutable packet snapshot required');assert.notEqual(env.NEAR_PACKET_SHA,expected.source);
 assert.match(env.NEAR_PACKET_MANIFEST_SHA256||'',/^[a-f0-9]{64}$/);
 assert.equal(event.ref,expected.ref);assert.equal(event.repository?.full_name,expected.repository);assert.equal(event.repository?.owner?.login,'hartican');assert.equal(event.repository?.fork,false);
 assert.equal(event.created,true,'One fresh branch-creation push only');assert.equal(event.before,'0'.repeat(40));assert.equal(event.deleted,false);assert.equal(event.forced,false,'Forced push is outside allocation');assert.equal(event.after,env.GITHUB_SHA);assert.equal(event.head_commit?.id,env.GITHUB_SHA);
 return {event:'push',ref:expected.ref,carrierSha:env.GITHUB_SHA,packetSha:env.NEAR_PACKET_SHA,manifestSha256:env.NEAR_PACKET_MANIFEST_SHA256,nonce:expected.nonce};
}
function assertPushBinding(env){
 // Reject wrong/unbound event context before reading checkouts or creating output.
 assert.match(ROOT.nonce,/^[a-f0-9]{32}$/,'Unbound ROOT nonce; template cannot run');
 assert.equal(env.GITHUB_EVENT_NAME,'push');assert.equal(env.GITHUB_REPOSITORY,ROOT.repository);assert.equal(env.GITHUB_REF,ROOT.ref);assert.equal(env.NEAR_NONCE,ROOT.nonce);
 const eventPath=env.GITHUB_EVENT_PATH;assert(eventPath&&path.isAbsolute(eventPath));assert(fs.statSync(eventPath).size<=1024*1024,'Event payload exceeds 1MiB');
 const receipt=validateEvent(env,JSON.parse(fs.readFileSync(eventPath,'utf8')));
 assert(env.RUNNER_TEMP&&path.isAbsolute(env.RUNNER_TEMP));const workspace=fs.realpathSync(env.GITHUB_WORKSPACE),packet=fs.realpathSync(path.join(workspace,'packet')),source=fs.realpathSync(path.join(workspace,'source'));
 assert.equal(fs.realpathSync(__dirname),path.join(packet,'scripts/qa/near-receipt-join'));assert.equal(fs.realpathSync(env.NEAR_SOURCE),source);
 const gitEnv={PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:env.RUNNER_TEMP,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};
 function git(root,...args){return execFileSync('/usr/bin/git',['-C',root,...args],{env:gitEnv,encoding:'utf8',timeout:5000,maxBuffer:1024*1024}).trim();}
 assert.equal(git(packet,'rev-parse','--show-toplevel'),packet);assert.equal(git(source,'rev-parse','--show-toplevel'),source);
 assert.equal(git(packet,'rev-parse','HEAD'),receipt.packetSha);assert.equal(git(source,'rev-parse','HEAD'),ROOT.source);
 assert.equal(git(packet,'status','--porcelain'),'','Packet checkout must be clean');assert.equal(git(source,'status','--porcelain'),'','Product source checkout must be clean');
 const manifest=fs.readFileSync(path.join(__dirname,'manifest.json'));assert.equal(crypto.createHash('sha256').update(manifest).digest('hex'),receipt.manifestSha256,'ROOT-bound packet manifest differs');
 const parsed=JSON.parse(manifest);assert.equal(parsed.sourceSha,ROOT.source);
 for(const f of parsed.files){assert(/^[A-Za-z0-9_.-]+$/.test(f.file));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,f.file))).digest('hex'),f.sha256,'Frozen packet file differs: '+f.file);}
 return receipt;
}
module.exports={ROOT,validateEvent,assertPushBinding};
