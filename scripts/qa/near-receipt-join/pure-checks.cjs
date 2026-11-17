'use strict';
// Pure strings and synthetic protocol buffers only: no native/process/network call.
const fs=require('node:fs'),assert=require('node:assert/strict'),{Client}=require('./native-client.cjs');
const tests=[];
function parse(text,status='00000'){
 let resolved,rejected;const c=Object.create(Client.prototype);
 c.buffer=text+'\n__NE_pure__ '+status+'\n';c.active={marker:'__NE_pure__',resolve:v=>resolved=v,reject:e=>rejected=e};c.drain();return {resolved,rejected};
}
let p=parse('[{"ok":true}]');assert.equal(p.resolved,'[{"ok":true}]');assert(!p.rejected);tests.push('Complete JSON and successful marker');
p=parse('ERROR:  42501: permission denied\nCONTEXT: QA control','42501');assert.equal(p.rejected.code,'42501');assert.equal(p.resolved,undefined);tests.push('SQLSTATE/error refusal');
p=parse('ERROR:  42710: earlier failure\nROLLBACK','00000');assert.equal(p.rejected.code,'42710');tests.push('Earlier error not hidden by later successful statement');
p=parse('','57014');assert.equal(p.rejected.code,'57014');tests.push('Timeout status without error text');
let resolved;const c=Object.create(Client.prototype);c.buffer='[]\n__NE_split__';c.active={marker:'__NE_split__',resolve:v=>resolved=v,reject:()=>assert.fail()};c.drain();assert.equal(resolved,undefined);c.buffer+=' 00000\n';c.drain();assert.equal(resolved,'[]');tests.push('Incomplete marker waits for complete line');
const transport=fs.readFileSync(require.resolve('./native-client.cjs'),'utf8');assert(!transport.includes('colima')&&!transport.includes('/opt/homebrew')&&!transport.includes('ns-wire-mvcc'));tests.push('Mac transport paths absent');
const base=require('./adapter.cjs').selfTest();
console.log(JSON.stringify({state:'SOURCE_AND_PURE_PROTOCOL_CHECKS_ONLY',base,protocolChecks:tests,nativeCalls:0,DockerCalls:0,SQLExecutions:0}));
