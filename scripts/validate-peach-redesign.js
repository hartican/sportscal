#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const vectors=require('../config/vector-assets'),catalogue=require('../config/nothingsport-iconography.source');
const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('assets/styles/nothingsport-foundation.css','utf8');
const hash=crypto.createHash('sha256').update(fs.readFileSync('assets/brand/web/nothingsport-logo.png')).digest('hex');
assert.equal(hash,require('./build-peach-brand').expected,'the original wordmark must remain byte-identical');
const nav=html.match(/<nav class="tabs"[\s\S]*?<\/nav>/)?.[0];
assert.deepEqual([...nav.matchAll(/data-tab="([^"]+)"/g)].map(m=>m[1]),['feed','match-centre','follow']);
assert(html.indexOf(nav)>html.indexOf('</header>'),'bottom navigation must be independent of the scrolling header');
assert.equal((html.match(/id="headerBrandLogo"/g)||[]).length,1);
for(const id of ['settingsBtn','calendarSyncBtn','shareAppBtn','notificationsBtn','homeSpoilerToggle','nothingscoreBtn','accountIndicator','headerMoreBtn'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' keeps its existing owner');
assert.match(css,/nav\.tabs\{position:fixed/);
assert.match(css,/env\(safe-area-inset-bottom\)/);
assert.match(css,/body\{padding-bottom:var\(--ns-nav-space\)/);
assert.match(css,/--panel-bg:#191B1E/,'the unchanged wordmark and Account controls keep a dark brand area in Day mode');
for(const mode of ['day','night','system'])assert(html.includes('"'+mode+'"'));
// Execute the actual legacy-route branch, with the first navigation frame's state.
const route=html.match(/async function syncAppRouteFromLocation\(\)\{\n  (if\(\/\^#events[^\n]+)/)?.[1];
assert(route);
for(const hash of ['#events','#events/major/us-open','#events/alert/tickets']){
  const preferences={followed:['kept'],results:false},copy=JSON.stringify(preferences),history=[],renders=[],closed=[];
  const context={location:{hash,pathname:'/',search:''},activeTab:'follow',activeInspectorCodeId:'competition:qa',calendarBulkController:null,
    eventsViewTab:'major-events',majorEventsDocument:null,majorEventsLoading:false,syncTopLevelNavigationState(){},renderAll:()=>renders.push(true),preferences};
  context.window={location:context.location};
  context.history={replaceState:(...args)=>{history.push(args);context.location.hash=args[2].startsWith('#')?args[2]:'';},pushState:(...args)=>history.push(args)};
  context.closeCodeInspector=options=>{closed.push(options);context.activeInspectorCodeId=null;};
  const activate=html.match(/function activateTopLevelTab\([^\n]*\{[\s\S]*?\n\}/)?.[0];assert(activate);
  vm.runInNewContext(activate,context);
  vm.runInNewContext('(function(){'+route+'})()',context);
  assert.equal(context.activeTab,'match-centre');assert.equal(history.at(-1)[2],'#match-centre');assert.equal(renders.length,1);assert.equal(JSON.stringify(preferences),copy);
  assert.equal(context.activeInspectorCodeId,null);assert.equal(closed.length,1);assert.equal(closed[0].render,false);
}
// Exercise real scroll/disclosure listeners, including small per-frame movements.
const navigation=html.match(/\(function initialisePeachNavigation\(\)\{[\s\S]*?\n\}\)\(\);/)?.[0];assert(navigation);
const classes=new Set(),listeners={},frames=[],attrs={},buttonListeners={},headerListeners={};
const header={offsetHeight:100,classList:{remove:k=>classes.delete(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k)},contains:()=>false,addEventListener:(k,fn)=>headerListeners[k]=fn};
const more={setAttribute:(k,v)=>attrs[k]=v,getAttribute:k=>attrs[k],contains:()=>false,focus(){},addEventListener:(k,fn)=>buttonListeners[k]=fn};
const panel={hidden:false,contains:()=>false,querySelector:()=>({focus(){}}),addEventListener(){}};
const scrollContext={scrollY:200,matchMedia:()=>({matches:true,addEventListener(){}}),document:{activeElement:null,querySelector:()=>header,getElementById:id=>id==='headerMoreBtn'?more:panel,addEventListener(){}},
  syncFeedFilterDockOffset(){},window:{addEventListener:(k,fn)=>listeners[k]=fn},requestAnimationFrame:fn=>frames.push(fn)};
vm.runInNewContext(navigation,scrollContext);
function scroll(y){scrollContext.scrollY=y;listeners.scroll();frames.shift()();}
scroll(210);assert(classes.has('is-scroll-hidden'));scroll(208);scroll(206);assert(!classes.has('is-scroll-hidden'),'slow upward motion must accumulate and reveal');
scroll(220);assert(classes.has('is-scroll-hidden'));scroll(0);assert(!classes.has('is-scroll-hidden'),'the page top must always show the header');
buttonListeners.click();assert.equal(attrs['aria-expanded'],'true');scroll(240);assert(!classes.has('is-scroll-hidden'),'open More must pin the header');
const oldKeys=[...require('../config/nothingsport-core-icons.json')];
for(const key of oldKeys){
  const image=vectors.glyphMarkup(key,{label:key,preferImage:true});
  assert(vectors.iconography[key],key+' must use the new family');
  assert.match(image,/<img\b/);assert.match(image,/data:image\/svg\+xml/);assert.doesNotMatch(image,/vector-mask/);
}
assert(Object.keys(catalogue).length>=120);
for(const [key,body]of Object.entries(catalogue))assert(body&&/<(?:path|circle|ellipse|rect)\b/.test(body),key+' has real artwork');
assert.equal(catalogue['sport:a-leagues-women'],catalogue['sport:football']);
assert.notEqual(catalogue['sport:a-leagues-women'],catalogue['sport:cricket']);
// Execute the actual mounted card control factories and their actual glyph
// wrapper, rather than accepting source strings that name a nonexistent helper.
const cardContext={VECTOR_ASSETS:vectors,activeTab:'feed',document:{createElement:tag=>({tag,dataset:{},style:{},children:[],attributes:{},appendChild(child){this.children.push(child);},setAttribute(key,value){this.attributes[key]=value;}})}};
for(const name of ['glyphMarkup','buildEventCardControls','buildCardDisclosureControl']){
  const source=html.match(new RegExp('function '+name+'\\([^\\n]*\\{[\\s\\S]*?\\n\\}'))?.[0];
  assert(source,name+' must retain its actual renderer');vm.runInNewContext(source,cardContext);
}
const dismiss=cardContext.buildEventCardControls({name:'Local QA fixture'}).children[0];
assert.equal(dismiss.attributes['aria-label'],'Dismiss Local QA fixture');assert.match(dismiss.innerHTML,/<img\b/);
for(const state of ['compact','selected']){
  const changes=[],button=cardContext.buildCardDisclosureControl('Local QA fixture',state,(...args)=>changes.push(args));
  assert.match(button.innerHTML,/<img\b/);button.onclick({stopPropagation(){}});
  assert.equal(changes[0][0],state==='compact'?'selected':'compact');assert.equal(changes[0][1].restoreFocus,true);
}
for(const key of ['social:instagram','social:x','social:linkedin'])assert.equal(vectors.openUse[key].library,'Simple Icons');
function luminance(hex){const rgb=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const [text,bg]of [['#F1E7F6','#0C1010'],['#B9AEBD','#191B1E'],['#271E2B','#F8F1F5'],['#67586B','#FFFBFD'],['#FFFBFD','#A7224D'],['#0C1010','#FB3D6C'],['#0C1010','#F9BC9B']])assert(contrast(text,bg)>=4.5,text+' / '+bg+' must meet normal-text contrast');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));assert.equal(manifest.theme_color,'#0C1010');
assert(fs.readFileSync('service-worker.js','utf8').includes('/assets/brand/web/nothingsport-logomark.svg'));
console.log(`Peach redesign valid: exact wordmark, three independent tabs, actual legacy routes, ${oldKeys.length} stable core glyphs / ${Object.keys(catalogue).length} catalogue designs, preserved official marks and contrast pairs.`);
