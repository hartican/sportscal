'use strict';
// Execute production renderers with disposable DOM and transport doubles.
const assert=require('node:assert/strict'),vm=require('node:vm');
const {readCardFunction,readInlineOwner}=require('../app-shell-test-utils');
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.style={};this.handlers={};this.className='';this.isConnected=true;this.naturalWidth=0;}
  get classList(){const update=values=>{this.className=[...values].join(' ');};return{
    contains:value=>this.className.split(/\s+/).includes(value),
    add:(...values)=>update(new Set([...this.className.split(/\s+/).filter(Boolean),...values])),
    remove:(...values)=>update(new Set(this.className.split(/\s+/).filter(value=>value&&!values.includes(value)))),
    toggle:(value,on)=>{const values=new Set(this.className.split(/\s+/).filter(Boolean));if(on??!values.has(value))values.add(value);else values.delete(value);update(values);},
  };}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  appendChild(node){this.append(node);return node;}
  replaceChildren(...nodes){this.children.forEach(node=>node.parentElement=null);this.children=[];this.append(...nodes);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  replaceWith(node){const parent=this.parentElement,index=parent.children.indexOf(this);parent.children.splice(index,1,node);node.parentElement=parent;this.parentElement=null;}
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
  setAttribute(key,value){this.attributes[key]=String(value);}
  removeAttribute(key){delete this.attributes[key];if(key==='src')delete this.src;if(key==='data-deferred-card-image')delete this.dataset.deferredCardImage;}
  getAttribute(key){return this.attributes[key];}
  addEventListener(type,callback){this.handlers[type]=callback;}
  matches(selector){return selector.split(',').some(part=>part[0]==='.'?this.classList.contains(part.slice(1)):this.tagName===part);}
  querySelectorAll(selector){return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  set innerHTML(value){this.html=value;this.replaceChildren(...(/<svg\b/.test(value)?[new Element('svg')]:[]));}
  get innerHTML(){return this.html||'';}
}
const document={createElement:tag=>new Element(tag)};
async function fivePointRatings(){
  const writes=[],snapshots=new Map();let signedIn=true,opened=0,fail=false;
  const context={document,serverPersistence:{user:{id:'disposable-owner'}},
    serverSyncClient:{sessionSubject:()=>signedIn?'disposable-owner':null,nothingscoreRequest:async(query,body)=>{
      if(body){writes.push(body);if(fail)throw Error('disposable save failure');return {rating:body.rating};}
      return {detail:{phase:'heat'}};
    }},nothingscorePhaseCopy:require('../../config/epic-classics').phaseCopy,
    glyphMarkup:require('../../config/vector-assets').glyphMarkup,nothingscoreEventId:event=>event.id,
    inlineRatingRequests:new Map(),nothingscoreSnapshots:snapshots,nothingscoreReadGeneration:0,nothingscoreLoadErrors:new Set(),
    mergeNothingscoreSnapshot(){},nothingscoreReadRecovered(){},nothingscoreReadFailed(){},nothingscoreQueueRender(){},
    matchMedia:()=>({matches:true}),openSettings:()=>opened++,setTimeout:callback=>callback(),window:{},};
  vm.createContext(context);vm.runInContext(readCardFunction('buildInlineCrowdRating'),context);
  for(const phase of ['heat','pulse','impact'])for(let value=1;value<=5;value++){
    const root=context.buildInlineCrowdRating({id:'disposable-rating'},{phase,currentUser:{contribution:{rating:0}}});
    const buttons=root.querySelectorAll('button');assert.equal(buttons.length,5,'exactly five accessible one-tap values');
    assert.deepEqual(buttons.map(button=>button.getAttribute('aria-label')),context.nothingscorePhaseCopy(phase).labels.map((label,index)=>`${index+1} out of 5: ${label}`));
    assert(buttons.every(button=>button.querySelector('svg')),'each rating uses the actual shared glyph owner');
    await buttons[value-1].onclick();
    assert.equal(writes.at(-1).rating,value,'one tap submits its exact five-point value');
    assert.equal(writes.at(-1).phase,phase);assert.equal(writes.at(-1).action,phase==='pulse'?'pulse':'submit');
    assert.equal(buttons.filter(button=>button.classList.contains('is-filled')).length,value);
    assert.deepEqual(buttons.map(button=>button.getAttribute('aria-pressed')),[1,2,3,4,5].map(index=>String(index===value)));
  }
  const root=context.buildInlineCrowdRating({id:'disposable-failure'},{phase:'heat',currentUser:{contribution:{rating:2}}});
  fail=true;await root.querySelectorAll('button')[4].onclick();
  assert.equal(root.querySelectorAll('button').filter(button=>button.classList.contains('is-filled')).length,2,'failed save restores prior rating');
  const before=writes.length;signedIn=false;await root.querySelectorAll('button')[3].onclick();
  assert.equal(opened,1);assert.equal(writes.length,before,'guest tap cannot submit');
  assert.equal(writes.length,16,'fifteen deliberate values and one failed save; no duplicate submit');
}
function lazyIdentities(){
  const mark={id:'disposable-team',url:'/local-only.svg',label:'Disposable team'},images=[];
  const context={document:{createElement(tag){const node=new Element(tag);if(tag==='img')images.push(node);return node;}},
    matchupIdentityMatches:()=>[1,2].map(id=>({mark:{...mark,id:String(id)},label:'Team '+id})),NOTHINGSPORTS_FIXTURE_LABELS:{badge:()=>''},
    themeUsesDarkAssets:()=>true,activeTab:'feed',appendTeamIdentityFallback(){},applyTeamLogoAsset(){},
    participantProfileLink:()=>new Element('button'),CARD_IDENTITIES:{markForEvent:()=>mark},
    installIdentityImageRecovery(){},assignCardImageSource:(image,src)=>{image.src=src;},glyphMarkup:()=>'<svg></svg>',};
  vm.createContext(context);
  for(const name of ['buildMatchupIdentity','renderEventIdentityMark'])vm.runInContext(readCardFunction(name),context);
  const identity=context.buildMatchupIdentity({key:'football'},'Local fixture');
  assert.equal(identity.querySelectorAll('img').length,2);
  for(const image of images){assert.equal(image.loading,'lazy');assert.equal(image.decoding,'async');assert(image.width>0&&image.height>0);}
  const container=new Element('div');container.className='event-icon';context.renderEventIdentityMark(container,{key:'football'},{label:'Football',glyph:'sport:football'});
  const image=container.querySelector('img');assert.equal(image.loading,'lazy','shared compact/Inspector event identity defers image loading');
  assert.equal(image.decoding,'async');assert.equal(image.src,mark.url);assert(container.querySelector('.identity-image-placeholder'));
  image.handlers.error();assert.equal(container.querySelectorAll('img').length,0);assert.equal(container.children.length,1,'failed image leaves one fallback');
}
function identityRecovery(){
  const context={document,IDENTITY_FRAME_SELECTOR:'.identity-frame',IDENTITY_FALLBACK_SELECTOR:'.team-logo-fallback,.team-logo-monogram',
    activatedCardImageSources:new Set(),INITIAL_CARD_IMAGE_BUDGET:4,deferredCardImages:new Set(),cardImageLoadingUnlocked:false,observeDeferredCardImages(){}};
  vm.createContext(context);
  for(const name of ['finalizeLoadedIdentityImage','revealIdentityImageFallback','assignCardImageSource'])vm.runInContext(readInlineOwner(name),context);
  const frame=new Element('div');frame.className='identity-frame';const image=new Element('img'),fallback=new Element('span');fallback.className='team-logo-fallback';
  frame.append(image,fallback);image.naturalWidth=40;image.className='identity-image-pending';
  assert.equal(context.finalizeLoadedIdentityImage(image),true);assert.equal(frame.children.length,1);assert.equal(image.hidden,false);assert(image.classList.contains('identity-image-decoded'));
  image.naturalWidth=0;frame.append(fallback);fallback.hidden=true;
  assert.equal(context.revealIdentityImageFallback(image),true);assert.deepEqual(frame.children,[fallback]);assert.equal(fallback.hidden,false,'permanent failure keeps one visible fallback');
  const missing=new Element('img');missing.alt='Local Club';frame.replaceChildren(missing);
  assert.equal(context.revealIdentityImageFallback(missing),true);assert.equal(frame.children.length,1);assert.equal(frame.children[0].textContent,'LC');
  const pending=[];for(let index=0;index<5;index++){const node=new Element('img');pending.push(node);context.assignCardImageSource(node,'/local-'+index+'.svg');}
  assert(pending.slice(0,4).every(node=>node.src),'first-view identities retain their bounded source budget');
  assert.equal(pending[4].src,undefined);assert.equal(context.deferredCardImages.size,1);assert.equal(pending[4].dataset.deferredCardImage,'/local-4.svg');
}
module.exports={fivePointRatings,lazyIdentities,identityRecovery};
