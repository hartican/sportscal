'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
async function main(){
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://preview.invalid/',runScripts:'outside-only'}),w=dom.window,delegated=[];
 try{
  Object.assign(w,{Response,Headers,Request,fetch:async(input,options)=>{delegated.push({input:String(input),method:options?.method||'GET'});return new Response('{}');}});
  for(const file of ['config/public-comments.js','config/epic-classics.js','preview/public-feed/model.js','preview/public-feed/bootstrap.js'])w.eval(fs.readFileSync(file,'utf8'));
  const address='https://api.giphy.com/v1/gifs/trending?api_key=TEST';
  for(const input of [address,new w.URL(address),new w.Request(address)]){
   const result=await(await w.fetch(input)).json();assert.equal(result.data.length,2);assert(result.data.every(row=>row.id.startsWith('preview-')));
  }
  assert.deepEqual(delegated,[],'String/URL/Request GIF inputs stay entirely local');
  await assert.rejects(w.fetch(new w.URL('https://production.invalid/api/chat')),/External requests are disabled/);
  await assert.rejects(w.fetch('/assets/example.js',{method:'POST',body:'forbidden'}),/Network writes are disabled/);
  await assert.rejects(w.fetch('/private/source.txt'),/not part of the test artifact/);
  assert.deepEqual(delegated,[],'Unknown/external/write inputs never reach native fetch');
  const denied=await w.fetch('/api/chat?mode=public-comments&roomId=fixture:wrong');assert.equal(denied.status,401);assert.deepEqual(delegated,[],'API denial is local');
  await w.fetch('/assets/example.js');assert.equal(delegated.length,1);assert.equal(delegated[0].method,'GET');
  const img=w.document.createElement('img');img.src='https://media.giphy.com/media/preview-cheer/giphy.gif';assert.equal(img.src,'https://preview.invalid/preview/gifs/cheer.gif');
  const link=w.document.createElement('a');link.href='https://giphy.com/';assert.equal(link.getAttribute('href'),'#test-link-disabled');link.href='blob:https://preview.invalid/test';assert.equal(link.href,'blob:https://preview.invalid/test');
  console.log('Preview isolation source: actual transport String/URL/Request, local GIF bytes, fail-closed origins/API/writes, allowlisted reads and local-only export links passed. No browser/server/provider run.');
 }finally{dom.window.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
