#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const {withVenue}=require('./lib/wrc-venue-coverage');
const {validateWrcContext}=require('./lib/wrc-context');
const {wrcCardId}=require('./sync-wrc-to-feed');
const VENUE_FIELDS=['venueCity','venueVerified','venueCountryCode','venueSourceUrl','venueCaption','courseArtworkId','courseGeometryVerified','courseGeometrySourceUrl'];
function apply(feed,context){
 const events=new Map(context.events.map(event=>[event.id,event]));
 const cards=new Map(context.events.map(event=>[wrcCardId(event),event]));
 return {...feed,events:feed.events.map(card=>{
  const event=events.get(card.canonicalEventId)||cards.get(card.id);
  if(card.key!=='wrc'||!event)return card;
  return {...card,venue:event.venueName||card.venue,...Object.fromEntries(VENUE_FIELDS.filter(key=>event[key]!=null).map(key=>[key,event[key]]))};
 })};
}
function main(){
 const path='data/canonical/wrc-context-2026.json',existing=JSON.parse(fs.readFileSync(path));
 const context={...existing,events:existing.events.map(withVenue)};
 const errors=validateWrcContext(context);if(errors.length)throw Error(errors.join('\n'));
 const outputs=[{path,value:context},...['feeds/incoming/events.json','data/events.json'].map(path=>({path,value:apply(JSON.parse(fs.readFileSync(path)),context)}))];
 for(const {path,value}of outputs)fs.writeFileSync(path,JSON.stringify(value,null,2)+'\n');
 console.log('Verified WRC venue artwork applied; identities, source clocks, results, status and editorial retained exactly. No source request.');
}
if(require.main===module)main();
module.exports={apply,VENUE_FIELDS};
