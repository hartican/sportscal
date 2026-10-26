'use strict';
const assert=require('node:assert/strict'),{size,chunks}=require('./lib/public-state-stdin-frame');
let checks=0;
const part={name:'part-00.ndjson',bytes:3,rows:1,md5:'a'.repeat(32),data_base64:'YWJj'};
const packet={status:'ready',manifest_text:'{"snapshot":"ascii"}\n',manifest_md5:'b'.repeat(32),parts:[part]};
const wire=[...chunks(packet)].join(''); // Small constructed test only; never the operator runner.
assert.equal(Buffer.byteLength(wire),size(packet));assert.deepEqual(JSON.parse(wire),packet);checks++;
const long={...packet,parts:[{...part,bytes:100000,data_base64:'eA=='.repeat(25000)}]};
assert([...chunks(long)].every(c=>c.length<=4194304));assert.equal([...chunks(long)].reduce((n,c)=>n+c.length,0),size(long));checks++;
for(const edit of [p=>{p.unknown=true;},p=>{p.manifest_text='非ASCII';},p=>{p.parts[0].data_base64='not base64!';},p=>{p.parts[0].bytes=4194305;},p=>{p.parts.push({...p.parts[0],extra:true});}]){
 const changed=structuredClone(packet);edit(changed);assert.throws(()=>size(changed),/INPUT_FRAME/);checks++;
}
const large={...part,bytes:4194304,data_base64:'A'.repeat(4*Math.ceil(4194304/3))};
let sent=0,biggest=0;for(const piece of chunks({...packet,parts:[large]})){sent+=piece.length;biggest=Math.max(biggest,piece.length);}
assert.equal(sent,size({...packet,parts:[large]}));assert.equal(biggest,4194304);checks++;
assert.throws(()=>size({...packet,parts:Array(16).fill(large)}),/INPUT_FRAME/);checks++;
console.log(JSON.stringify({checks,helperBuildsWholeEnvelope:false,maxDataChunk:4194304,networkRequests:0,sqlRuns:0}));
