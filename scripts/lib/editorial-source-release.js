'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const sourcePath='data/editorial-maintenance-sources.v1.json';
function verifySourceInventory(sha,inventory,source){
  assert.equal(inventory.revision,sha,'Wrong published deployment inventory revision.');
  const entries=inventory.files.filter(file=>file.path===sourcePath);
  assert.equal(entries.length,1,'Deployment inventory must contain exactly one editorial server source.');
  const entry=entries[0],bytes=Buffer.from(source);
  const blob=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(entry.gitBlob,blob,'Deployment source does not match this checkout.');
  assert(['identity','json-compact'].includes(entry.transform),'Unknown editorial source deployment transform.');
  const deployed=entry.transform==='json-compact'?Buffer.from(JSON.stringify(JSON.parse(bytes))+'\n'):bytes;
  assert.equal(entry.bytes,deployed.length,'Wrong deployed editorial source length.');
  assert.equal(entry.sha256,crypto.createHash('sha256').update(deployed).digest('hex'),'Wrong deployed editorial source hash.');
  return JSON.parse(bytes).sourceRevision;
}
module.exports={sourcePath,verifySourceInventory};
