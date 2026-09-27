'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const expected={
  'Content-Security-Policy':"frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  'X-Frame-Options':'SAMEORIGIN',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
};
async function validate(base){
  const config=require('../vercel.json');
  const headers=Object.fromEntries((config.headers.find(r=>r.source==='/(.*)')?.headers||[]).map(h=>[h.key,h.value]));
  for(const [key,value] of Object.entries(expected))assert.equal(headers[key],value,key+' must cover documents, rewrites and APIs');
  for(const source of ['/service-worker.js','/app-version.json'])assert(config.headers.find(r=>r.source===source).headers.some(h=>h.key==='Cache-Control'&&h.value.includes('no-store')),'update metadata must not become cacheable');
  const checks=[];
  if(base)for(const [route,type,status] of [['/','text/html',200],['/admin/users','text/html',200],['/fixture/header-proof','text/html',200],['/service-worker.js','javascript',200],['/app-version.json','application/json',200],['/assets/js/app-shell-runtime.js','javascript',200],['/api/feed','application/json',401]]){
    const response=await fetch(new URL(route,base),{signal:AbortSignal.timeout(15000),cache:'no-store'});
    assert.equal(response.status,status,route+' status');
    assert(response.headers.get('content-type')?.includes(type),route+' MIME type');
    for(const [key,value] of Object.entries(expected))assert.equal(response.headers.get(key),value,route+' '+key);
    checks.push({route,status:response.status,contentType:response.headers.get('content-type'),headers:Object.fromEntries(Object.keys(expected).map(key=>[key,response.headers.get(key)]))});
    await response.body?.cancel();
  }
  const report={checkedAt:new Date().toISOString(),base:base||null,checks};
  if(base&&process.env.NS_DEPLOY_REPORT_DIR){fs.mkdirSync(process.env.NS_DEPLOY_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.NS_DEPLOY_REPORT_DIR,'security-headers.json'),JSON.stringify(report,null,2));}
  console.log(base?'Production security headers and MIME types passed on seven routes.':'Security header configuration and update-cache controls passed.');
  return report;
}
if(require.main===module)validate(process.argv[2]).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={expected,validate};
