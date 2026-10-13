'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync('service-worker.js','utf8').split('self.addEventListener("notificationclick",')[1];assert(code);
async function run(payload,{visible=false,ack=false,closed=false,delay=0}={}){
 const listeners={},shown=[],messages=[],opens=[];
 class Channel{constructor(){this.port1={close(){}};this.port2={postMessage:data=>queueMicrotask(()=>this.port1.onmessage?.({data}))};}}
 const client={visibilityState:visible?'visible':'hidden',postMessage(data,ports){if(closed)throw Error('closed client');messages.push(data);if(delay)setTimeout(()=>ports?.[0].postMessage({visible:ack}),delay);else ports?.[0].postMessage({visible:ack});},focus(){return this;},navigate(url){opens.push(url);return this;}};
 const self={location:{origin:'https://nothingsport.example'},clients:{matchAll:async()=>[client],openWindow:async url=>opens.push(url)},registration:{showNotification:async(...args)=>shown.push(args)},navigator:{},addEventListener:(type,fn)=>listeners[type]=fn};
 vm.runInNewContext('self.addEventListener("notificationclick",'+code,{self,MessageChannel:Channel,setTimeout,clearTimeout,Date,URL,Promise});
 let pending;listeners.push({data:{json:()=>payload},waitUntil:p=>pending=p});await pending;
 if(shown.length){listeners.notificationclick({notification:{data:shown[0][1].data,close(){}},waitUntil:p=>pending=p});await pending;}
 return {shown,messages,opens};
}
(async()=>{
 const base={kind:'milestone',eventId:'fixture:cricket:CA:39990',title:'Test milestone alert',body:'Generic cue',expiresAt:new Date(Date.now()+120000).toISOString(),url:'/?event=fixture%3Acricket%3ACA%3A39990&surface=match-centre&moment=test'};
 assert.equal((await run({...base,expiresAt:new Date(Date.now()-1).toISOString()})).shown.length,0);assert.equal((await run({...base,expiresAt:null})).shown.length,0);
 assert.equal((await run({...base,expiresAt:new Date(Date.now()+20).toISOString()},{visible:true,ack:false,delay:40})).shown.length,0,'Expiry is checked after the client acknowledgement wait');
 const foreground=await run(base,{visible:true,ack:true});assert.equal(foreground.shown.length,0);assert.equal(foreground.messages[0].type,'nothingsport-milestone-visible');
 assert.equal((await run(base,{visible:true,ack:false})).shown.length,1,'A different expanded match does not suppress the system notification');assert.equal((await run(base,{visible:false,ack:true})).shown.length,1,'Hidden windows do not claim presence');assert.equal((await run(base,{visible:true,closed:true})).shown.length,1,'A closing client cannot swallow a push');
 const deep=await run(base);assert.match(deep.opens[0],/surface=match-centre/);assert.equal((await run({...base,url:'https://evil.example/'})).opens[0],'https://nothingsport.example/','Notification links remain origin safe');
 assert.equal((await run({kind:'sport',title:'Existing reminder'})).shown.length,1,'Existing push families retain display');
 console.log('Milestone worker: expired/missing TTL discarded, same-device acknowledgement, hidden/closing clients, exact origin-safe links and existing push display passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
