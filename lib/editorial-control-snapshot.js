'use strict';
// Credential-free local execution. Production APIs continue using their service key.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let cached;
function snapshot(){
  if(cached)return cached;
  const file=process.env.NS_EDITORIAL_CONTROL_SNAPSHOT;
  assert(file&&path.isAbsolute(file),'Absolute private editorial snapshot path required.');
  const root=path.resolve(__dirname,'..');
  assert(!file.startsWith(root+path.sep),'Private control snapshots must remain outside the checkout.');
  assert.equal(fs.statSync(file).mode&0o077,0,'Editorial snapshot must be private (chmod 600).');
  const value=JSON.parse(fs.readFileSync(file,'utf8'));
  const source=JSON.parse(fs.readFileSync(path.join(root,'data/editorial-maintenance-sources.v1.json'),'utf8'));
  const age=Date.now()-Date.parse(value.capturedAt);
  assert(age>=0&&age<=15*60*1000,'Refresh the authorised control snapshot (maximum age 15 minutes).');
  assert.equal(value.sourceRevision,source.sourceRevision,'Control snapshot source revision mismatch.');
  assert(value.complete===true&&Array.isArray(value.groups)&&Array.isArray(value.signals)&&Array.isArray(value.states),'Complete authorised aggregate/control snapshot required.');
  cached=value;return cached;
}
async function request(url,options={}){
  const s=snapshot(),method=options.method||'GET',u=new URL(url,'https://local.invalid');
  if(u.pathname==='/rest/v1/rpc/nothingsports_editorial_signals'&&method==='POST'){
    const groups=options.body.target_groups;
    for(const group of groups)assert(s.groups.some(g=>g.event_id===group.event_id&&JSON.stringify(g.aliases)===JSON.stringify(group.aliases)),'Incomplete aggregate scope.');
    return s.signals.filter(row=>groups.some(g=>g.event_id===row.event_id));
  }
  assert.equal(u.pathname,'/rest/v1/nothingsports_editorial_maintenance','Unsupported offline control request.');
  const id=u.searchParams.get('event_id')?.replace(/^eq\./,'');
  if(method==='GET')return s.states.filter(row=>!id||row.event_id===id);
  if(method==='POST'){if(!s.states.some(row=>row.event_id===options.body.event_id))s.states.push({event_id:options.body.event_id,revision:0,held:false,history:[]});return [];}
  assert.equal(method,'PATCH');
  const revision=Number(u.searchParams.get('revision')?.replace(/^eq\./,''));
  const row=s.states.find(row=>row.event_id===id&&row.revision===revision);
  if(!row)return [];
  assert(!row.held,'Held editorial cannot be staged through a local snapshot.');
  const file=process.env.NS_EDITORIAL_CHECK_REPORT;
  assert(file&&path.isAbsolute(file)&&!file.startsWith(path.resolve(__dirname,'..')+path.sep),'Private out-of-checkout check report required.');
  const report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{sourceRevision:s.sourceRevision,operations:[]};
  assert.equal(report.sourceRevision,s.sourceRevision,'Check report source revision mismatch.');
  report.operations.push({eventId:id,expectedRevision:revision,change:options.body});
  fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{mode:0o600});fs.chmodSync(file,0o600);
  Object.assign(row,options.body);return [row];
}
module.exports={request};
