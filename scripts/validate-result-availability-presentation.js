'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/function buildFixtureResultAvailability\(ev\)\{[\s\S]*?\n\}/)?.[0];assert(source);
class Node{constructor(tag){this.tag=tag;this.style={};this.children=[];this.attributes={};this.value='';}set textContent(v){this.value=v;}get textContent(){return this.value+this.children.map(n=>n.textContent).join('');}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attributes[k]=v;}}
const document={createElement:tag=>new Node(tag),createTextNode:text=>({textContent:text})};
let resultsOn=false;
const context=vm.createContext({document,Date,Intl,isSpoilerVisible:()=>resultsOn});vm.runInContext(source,context);
// Keep the historical unavailable-result branch under test after its actual
// organiser result arrives; this controlled input is not a published fixture.
const retained=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json').events.find(e=>e.id.includes('alcaraz-arnaldi'));assert(retained);
assert.equal(context.buildFixtureResultAvailability(retained),null,'the actual completed result retires its unavailable notice');
resultsOn=true;assert.match(context.buildFixtureResultAvailability(retained).textContent,/Verified result/,'actual final provenance is available with Results ON');resultsOn=false;
const pending={...retained,status:'scheduled',resultStatus:'pending',score:null,resultSourceCheckedAt:'2026-10-03T06:30:54.629Z'};
const note=context.buildFixtureResultAvailability(pending);
assert.match(note.textContent,/Official result unavailable/);assert.match(note.textContent,/checked .*Sydney time/);assert(!/FIA|finished|winner/i.test(note.textContent),'unavailable tennis result cannot acquire another sport’s authority or a final');
const link=note.children.find(e=>e.tag==='a');assert.equal(link.href,pending.resultSourceUrl);assert.equal(link.rel,'noopener noreferrer');assert.match(link.attributes['aria-label'],/Carlos Alcaraz/);
assert.equal(context.buildFixtureResultAvailability({...pending,resultStatus:'official'}),null,'confirmed results do not retain the unavailable notice');
assert(!context.buildFixtureResultAvailability({...pending,resultSourceCheckedAt:'2100-01-01T00:00:00Z'}).textContent.includes('checked'),'future source dates are not advertised');
assert(!context.buildFixtureResultAvailability({...pending,resultSourceCheckedAt:'invalid',resultSourceUrl:'javascript:alert(1)'}).children.some(e=>e.tag==='a'),'invalid dates and unsafe source links are not exposed');
const wrc=context.buildFixtureResultAvailability({...pending,key:'wrc'});assert.match(wrc.textContent,/Official FIA classification pending\./,'WRC keeps its appropriate classification language');
const motogp=context.buildFixtureResultAvailability({...pending,key:'motogp'});assert(!motogp.textContent.includes('FIA'),'MotoGP does not inherit FIA attribution');
console.log('Actual availability renderer: dated pending state, safe source link, final-state absence and sport-appropriate authority passed.');
