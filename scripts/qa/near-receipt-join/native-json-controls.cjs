'use strict';
// Synthetic strings/protocol only. Never opens a process, socket or database.
const assert=require('node:assert/strict'),fs=require('node:fs'),{Client,parseJsonStrict,EMPTY_PASSFILE}=require('./native-client.cjs');
async function main(){
 let checks=0;const warn='WARNING: password file "/dev/null" is not a plain file\n';
 assert.deepEqual(parseJsonStrict('[{"ok":true}]'),[{ok:true}]);checks++;
 for(const text of [warn+'[]','WARNING: unrelated warning\n[]','[]\n'+warn]){assert.throws(()=>parseJsonStrict(text),e=>e.code==='NATIVE_JSON_DECODE'&&e.nativeDiagnostic.outputBytes===Buffer.byteLength(text)&&((e.nativeDiagnostic.prefix||'')+(e.nativeDiagnostic.suffix||'')).includes('WARNING:'));checks++;}
 const long='WARNING: '+ 'x'.repeat(10000)+'\n[]';let caught;try{parseJsonStrict(long);}catch(e){caught=e;}assert(caught);assert.equal(caught.nativeDiagnostic.prefix.length,512);assert.equal(caught.nativeDiagnostic.suffix.length,512);assert.equal(caught.nativeDiagnostic.truncated,true);checks++;
 const instance=Object.create(Client.prototype);instance.command=async()=>warn+'[{"n":1}]';await assert.rejects(instance.query('select 1 n'),e=>e.code==='NATIVE_JSON_DECODE'&&e.nativeDiagnostic.prefix.includes('not a plain file'));checks++;
 const denial=Object.assign(Error('permission denied'),{code:'42501'});instance.command=async()=>{throw denial;};await assert.rejects(instance.query('select 1'),e=>e===denial&&e.code==='42501');checks++;
 const limits={binding:()=>({cid:'a'.repeat(64),major:17})};assert.throws(()=>new Client('postgres',limits),/Verified owned empty0600/);checks++;
 const client=fs.readFileSync(require.resolve('./native-client.cjs'),'utf8'),adapter=fs.readFileSync(require.resolve('./adapter.cjs'),'utf8');assert(!client.includes('PGPASSFILE=/dev/null'));assert(client.includes("'PGPASSFILE='+EMPTY_PASSFILE"));assert.equal(EMPTY_PASSFILE,'/var/lib/postgresql/data/qa/.nothingsport-native-empty.pgpass');checks++;
 assert(adapter.includes('umask 077; set -C; : > "$1"; test -f "$1"; test ! -L "$1"; test ! -s "$1";'));assert(adapter.includes('$(stat -c %u:%a:%s "$1")'));assert(adapter.includes('$(id -u):600:0'));assert(adapter.includes('current.emptyPasswordFileVerified=true'));checks++;
 return {state:'PURE_WARNING_JSON_AND_PASSFILE_CONTROLS_ONLY',passed:true,checks,knownAndUnrelatedWarningsRemainFatal:true,boundedRawDiagnosticRetained:true,SQLStatePreserved:true,unverifiedPassfileRefusedBeforeSpawn:true,passfileCreationSourceCheckedNotExecuted:true,processDockerSQLNetworkCIOrPush:0};
}
if(require.main===module)main().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={main};
