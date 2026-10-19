'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),capture=require('./fixtures/football-card-privacy-20261012.json');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
function actualFunction(name,next){const start=source.indexOf('function '+name+'('),end=source.indexOf('function '+next+'(',start);assert(start>=0&&end>start);return source.slice(start,end);}
const caller=actualFunction('buildEuropeanDetail','buildFixtureDataAttribution'),policy=actualFunction('isSpoilerVisible','markSpoilerRevealed');
const renderer=fs.readFileSync(path.join(root,'assets/js/football-card-context.js'),'utf8');
// The real deferred caller and renderer run here. This DOM implements only
// their element operations; full browser checks cover the actual native cards.
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.parent=null;this.className='';this.dataset={};this.attributes={};this._text='';this.connected=false;}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name]??null;}
 get isConnected(){return this.connected||Boolean(this.parent?.isConnected);}
 set textContent(v){this.children.forEach(c=>{if(c instanceof Element)c.parent=null;});this.children=[];this._text=String(v??'');}
 get textContent(){return this._text+this.children.map(c=>c instanceof Element?c.textContent:String(c)).join('');}
 append(...items){for(const c of items){if(c instanceof Element)c.parent=this;this.children.push(c);}}
 appendChild(item){this.append(item);return item;}
 replaceChildren(...items){this.textContent='';this.append(...items);}
 replaceWith(item){assert(this.parent);const parent=this.parent,i=parent.children.indexOf(this);assert(i>=0);parent.children.splice(i,1,item);item.parent=parent;this.parent=null;}
 remove(){if(this.parent){const p=this.parent;p.children.splice(p.children.indexOf(this),1);this.parent=null;}}
}
const all=(node,predicate)=>[...(predicate(node)?[node]:[]),...node.children.filter(c=>c instanceof Element).flatMap(c=>all(c,predicate))];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function environment({global=false,override='inherit',strict=false,fetchDocument}={}){
 const choices={override},head=new Element('head'),mount=new Element('main');mount.connected=true;
 const doc={code:{id:'sport:football'},fixtures:capture.fixtures,standings:capture.standings};
 let reads=0;
 const context=vm.createContext({document:{head,createElement:tag=>new Element(tag),createTextNode:v=>String(v)},userPreferences:{showSpoilers:global,feedControls:{spoilers:strict?'strict':global?'results_visible':'standard'}},getEventSpoilerState:()=>choices,codeInspectorChunk:fetchDocument?null:doc,fetchJson:()=>{reads++;return fetchDocument();},loadDeferredScript:()=>Promise.resolve(),NOTHINGSPORTS_FEED_CARD_PRESENTATION:{standingPosition:r=>r.position},Intl,Date,console});
 vm.runInContext(fs.readFileSync(path.join(root,'config/feed-card-presentation.js'),'utf8')+policy+caller+renderer,context);
 return {context,choices,mount,doc,reads:()=>reads};
}
function section(env){return all(env.mount,n=>n.className==='football-card-standings')[0];}
function rows(node){return all(node,n=>n.tagName==='li');}
async function render(env,fixture,kind='standings'){
 const node=env.context.buildEuropeanDetail(fixture,kind);env.mount.replaceChildren(node);await flush();return kind==='standings'?section(env):env.mount.children[0];
}
async function validate(){
 let cases=0;
 for(const fixture of capture.fixtures)for(const state of [
  {global:true,override:'inherit',strict:false,visible:true},
  {global:true,override:'hide',strict:false,visible:false},
  {global:false,override:'show',strict:false,visible:true},
  {global:true,override:'show',strict:true,visible:false},
  {global:false,override:'inherit',strict:false,visible:false}
 ]){
  const env=environment(state),before=JSON.stringify(fixture),choices=JSON.stringify(env.context.userPreferences);
  assert.equal(env.context.isSpoilerVisible(fixture),state.visible);
  const table=await render(env,fixture);assert(table,'Real deferred caller mounted standings');
  assert.equal(rows(table).length,state.visible?2:0,fixture.competitionId+' table follows fixture privacy');
  if(!state.visible)assert.match(table.textContent,/hidden while Results is off/);
  const detail=await render(env,fixture,'context');
  if(fixture.footballMatchContext){assert.equal(rows(detail).length,state.visible?2:0,'Team records follow the same choice');if(!state.visible)assert.match(detail.textContent,/hidden while Results is off/);}
  assert.equal(JSON.stringify(fixture),before,'Facts and original source clocks unchanged');assert.equal(JSON.stringify(env.context.userPreferences),choices,'Rendering does not change saved choices');assert.equal(env.reads(),0,'Retained inspector adds no data fetch');cases++;
 }
 for(const fixture of capture.fixtures)for(const hidden of ['hide','strict']){
  let resolve;const pending=new Promise(r=>resolve=r),env=environment({global:true,fetchDocument:()=>pending});
  const original=env.context.buildEuropeanDetail(fixture,'standings');env.mount.append(original);await flush();assert.equal(env.reads(),1);
  if(hidden==='hide')env.choices.override='hide';else env.context.userPreferences.feedControls.spoilers='strict';
  resolve(env.doc);await flush();const table=section(env);assert(table);assert.equal(rows(table).length,0,'Late table cannot reveal after a changed choice');assert.match(table.textContent,/hidden while Results is off/);assert.equal(env.reads(),1);cases++;
 }
 for(const fixture of capture.fixtures){
  const env=environment({global:true,fetchDocument:()=>Promise.reject(new Error('Unavailable'))});const table=await render(env,fixture);assert.match(table.textContent,/Standings unavailable/);
  const retry=all(table,n=>n.tagName==='button'&&n.textContent==='Retry standings')[0];assert(retry);env.choices.override='hide';await retry.onclick();
  assert.equal(rows(table).length,0);assert.match(table.textContent,/hidden while Results is off/);assert.equal(env.reads(),1,'A hidden retry does not fetch another table');cases++;
 }
 for(const state of [{global:true,override:'hide',visible:false},{global:false,override:'show',visible:true},{global:true,override:'show',strict:true,visible:false}]){
  const env=environment(state),fixture=capture.sharedNblContextFixture;assert(fixture,'Captured shared NBL context');const before=JSON.stringify(fixture),detail=await render(env,fixture,'context');
  assert.equal(rows(detail).length,state.visible?2:0,'Shared NBL records retain effective fixture privacy');assert.equal(JSON.stringify(fixture),before);cases++;
 }
 const legacy=environment(),contextFixture=capture.fixtures.find(f=>f.footballMatchContext);assert.equal(rows(legacy.context.NOTHINGSPORTS_FOOTBALL_CONTEXT.context(contextFixture,true)).length,2,'Existing explicit boolean context callers retain their contract');assert.equal(rows(legacy.context.NOTHINGSPORTS_FOOTBALL_CONTEXT.context(contextFixture,false)).length,0);
 console.log('Football card privacy: '+cases+' real-caller cases passed, including late loading, strict protection and retry.');
}
if(require.main===module)validate().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports=validate;
Object.assign(module.exports,{environment,render,all,Element});
