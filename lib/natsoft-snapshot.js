'use strict';
// Natsoft's public XML stream is collected once, then disconnected. Never
// execute provider JavaScript or let a partial order replace the last tower.
const assert=require('node:assert/strict');
const URL='ws://server.natsoft.com.au:8080/LiveMeeting/v8super';
const PUBLIC_URL='http://server.natsoft.com.au:8080/LiveMeeting/v8super';
const expansions={22:'><',23:' T="',24:'="0.0000" ',25:'="0" ',26:'="" ',27:'" /><',28:'"><',29:'" />',30:'="',31:'" '};
function decode(raw){
 assert(typeof raw==='string'&&raw.length<=131072,'Invalid Natsoft frame');
 if(raw.startsWith('<'))return raw;
 let previous=127,out='';for(const c of raw){const n=c.charCodeAt(0)^previous;out+=expansions[n]??String.fromCharCode(n);previous=n;}return out;
}
const entity=s=>s.replace(/&(?:amp|lt|gt|quot|apos);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[e]);
function xml(raw){
 const text=decode(raw),stack=[],roots=[];let end=0,nodes=0;
 for(const match of text.matchAll(/<([^<>]+)>/g)){
  assert(!text.slice(end,match.index).trim(),'Unexpected Natsoft text');end=match.index+match[0].length;
  const tag=match[1];assert(++nodes<=1000&&!/[!?]/.test(tag[0]),'Invalid Natsoft XML');
  if(tag.startsWith('/')){assert(stack.pop()?.name===tag.slice(1).trim(),'Incomplete Natsoft XML');continue;}
  const name=tag.match(/^([A-Za-z][A-Za-z0-9]*)\b/)?.[1];assert(name,'Invalid Natsoft tag');const attrs={};
  let rest=tag.slice(name.length).replace(/\/$/,'');for(const m of rest.matchAll(/\s+([A-Za-z][A-Za-z0-9]*)="([^"<>]*)"/g)){assert(!Object.hasOwn(attrs,m[1]),'Duplicate Natsoft attribute');attrs[m[1]]=entity(m[2]);}rest=rest.replace(/\s+[A-Za-z][A-Za-z0-9]*="[^"<>]*"/g,'');assert(!rest.trim(),'Invalid Natsoft attributes');
  const node={name,attrs,children:[]};(stack.at(-1)?.children||roots).push(node);if(!tag.endsWith('/'))stack.push(node);
 }
 assert(!stack.length&&roots.length===1&&!text.slice(end).trim(),'Incomplete Natsoft document');return roots[0];
}
const integer=v=>typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(+v)?+v:null;
const seconds=v=>typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v)&&+v>0?+v:null;
// The public feed's numeric clock is eleven hours ahead of UTC during this
// observed meeting. Its wire format does not declare a timezone. Preserve it
// verbatim; do not relabel it as a UTC provider observation.
const stamp=v=>{const n=seconds(v);assert(n&&n>=1000000000&&n<=4102444800,'Invalid Natsoft source clock');return n;};
function collector({year,sessionCode,sessionName,now=new Date()}={}){
 let metadata=null,status=null,clock=null;
 return raw=>{
  const root=xml(raw),a=root.attrs;
  if(root.name==='New'||root.name==='Change'){
   const m=root.children.find(n=>n.name==='M'),e=root.children.find(n=>n.name==='E'),ol=root.children.find(n=>n.name==='OL'),rl=root.children.find(n=>n.name==='RL');
   assert(m?.attrs.D===`${year} Repco Bathurst 1000`&&e?.attrs.C===sessionCode&&e.attrs.D===sessionName&&ol?.children.some(n=>n.attrs.C==='SG3'),'Wrong Natsoft event/session');
   assert(rl&&rl.children.length>=10&&rl.children.length<=60,'Incomplete Natsoft entry list');
   const entries=new Map();for(const r of rl.children){const id=integer(r.attrs.ID),number=r.attrs.C;assert(r.name==='R'&&id&&/^\d{1,4}$/.test(number)&&!entries.has(id),'Invalid Natsoft car');const drivers=r.children.map(v=>({id:integer(v.attrs.ID),name:v.attrs.N?.replace(/_/g,' ')}));assert(drivers.length===2&&new Set(drivers.map(d=>d.id)).size===2&&drivers.every(d=>d.id&&d.name&&d.name.length<=100),'Incomplete endurance entry');entries.set(id,{number,drivers,team:r.attrs.S||null,vehicle:r.attrs.V||null});}
   assert(new Set([...entries.values()].map(e=>e.number)).size===entries.size,'Duplicate Natsoft car number');metadata={entries,totalLaps:integer(e.attrs.L),session:a,checked:stamp(a.T,now)};status=null;clock=null;return null;
  }
  if(!metadata)return null;
  if(root.name==='S'){assert(a.E===sessionCode,'Wrong Natsoft status session');status={...a,at:stamp(a.T,now)};return null;}
  if(root.name==='C'){clock={...a,at:stamp(a.T,now)};return null;}
  if(root.name!=='L'||a.Y!=='f')return null;
  assert(status&&clock&&integer(a.L)===metadata.entries.size&&root.children.length===metadata.entries.size,'Incomplete Natsoft timing order');
  const sourceClock=stamp(a.T),seen=new Set(),positions=new Set();
  assert([metadata.checked,status.at,clock.at].every(at=>Math.abs(at-sourceClock)<=4),'Incoherent Natsoft snapshot clocks');
  const entries=root.children.map(p=>{
   const id=integer(p.attrs.C),entry=metadata.entries.get(id),d=p.children.find(n=>n.name==='D')?.attrs,position=integer(p.attrs.LP),current=entry?.drivers.find(v=>v.id===integer(p.attrs.D));
   assert(p.name==='P'&&entry&&d&&!seen.has(id)&&position&&position<=metadata.entries.size&&!positions.has(position)&&(integer(p.attrs.D)===0||current)&&integer(d.L)!=null,'Incomplete Natsoft car timing');seen.add(id);positions.add(position);
   const lapDeficit=integer(d.LGL),gap=seconds(d.LGI);return {id:'car:'+entry.number,position,number:entry.number,drivers:entry.drivers.map(v=>v.name),currentDriver:current?.name||null,team:entry.team,vehicle:entry.vehicle,laps:integer(d.L),gap:position===1?null:lapDeficit>0?`${lapDeficit} lap${lapDeficit===1?'':'s'}`:gap==null?null:gap.toFixed(4),lastLap:seconds(d.I),bestLap:seconds(d.FI),sectors:[seconds(d.S1),seconds(d.S2),seconds(d.S3)],tyre:d.TY||null,pitStops:integer(d.PS),pitState:d.P||null};
  }).sort((a,b)=>a.position-b.position);
  const states={Green:'live',Yellow:'live',Red:'suspended',Checkered:'completed'};assert(states[status.S],'Unverified Natsoft race state');
  return {schema:'racing.v1',kind:'circuit',eventId:`bathurst:${year}`,sessionId:sessionCode,sessionName,provider:'Natsoft',officialUrl:PUBLIC_URL,providerAt:null,providerClock:String(a.T),checkedAt:now.toISOString(),phase:status.S==='Checkered'?'provisional-result':'running',status:states[status.S],statusText:status.S==='Red'?'Red flag':status.S==='Checkered'?'Chequered flag · provisional classification':status.S,totalLaps:metadata.totalLaps,elapsedSeconds:integer(clock.E),entries};
 };
}
function readSnapshot(options,{WebSocketImpl=globalThis.WebSocket,signal}={}){
 return new Promise((resolve,reject)=>{
  let socket,done=false,bytes=0;const collect=collector(options);
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);socket?.close();error?reject(error):resolve(value);};
  const abort=()=>finish(Error('Natsoft snapshot cancelled'));const timer=setTimeout(()=>finish(Error('Incomplete Natsoft snapshot after four seconds')),4000);
  if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
  try{assert(typeof WebSocketImpl==='function','Natsoft snapshot transport unavailable');socket=new WebSocketImpl(URL);socket.onmessage=e=>{if(done)return;try{assert(typeof e.data==='string','Invalid Natsoft transport');bytes+=e.data.length;assert(bytes<=262144,'Natsoft snapshot budget exceeded');const value=collect(e.data);if(value)finish(null,value);}catch(error){finish(error);}};socket.onerror=()=>finish(Error('Natsoft snapshot unavailable'));socket.onclose=()=>{if(!done)finish(Error('Incomplete Natsoft connection'));};}catch(error){finish(error);}
 });
}
module.exports={decode,xml,collector,readSnapshot,PUBLIC_URL};
