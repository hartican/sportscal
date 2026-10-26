// Racing collection was retired on 26 October 2026. Keep the historical
// entrypoints closed so an older caller cannot silently resume provider reads.
'use strict';
const policy=require('../config/horse-coverage');
function unavailable(){throw new Error('Detailed horse-racing coverage is retired');}
async function read(){unavailable();}
function preview(){return {hook:policy.note,context:'',closingCopy:''};}
function source({published=[]}={}){
 return {id:'live-horse-features',allowEmpty:true,seed:published.map(policy.project).filter(Boolean).filter(policy.isCup),minimumIntervalMs:1800000,refreshInterval:()=>1800000,fetch:async({previous=[]})=>previous.filter(policy.isCup).map(policy.project)};
}
module.exports={read,parse:unavailable,fixture:event=>policy.project(event),url:unavailable,key:unavailable,preview,due:()=>false,source};
