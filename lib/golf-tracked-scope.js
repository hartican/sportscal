'use strict';
const cohort=require('../data/canonical/golf-tracked-cohort.v1.json');
const aliases={'competitor:golf:atthaya-thitikul':'competitor:golf:jeeno-thitikul','competitor:golf:hyojoo-kim':'competitor:golf:hyo-joo-kim'};
const identity=id=>aliases[id]||id;
function trackedIds(extra=[]){const ids=new Set([...cohort.ranked,...cohort.explicitRetentions].map(p=>identity(p.id)));for(const id of extra)if(/^competitor:golf:[a-z0-9-]+$/.test(id))ids.add(identity(id));return ids;}
function privateFollowIds(){if(!process.env.FOLLOW_SNAPSHOT_PATH)return [];const snapshot=require('./follow-snapshot').readSnapshot();const result=[];const walk=v=>{if(!v||typeof v!=='object')return;if(v.participantId&&['follow','priority'].includes(v.followLevel))result.push(v.participantId);Object.values(v).forEach(walk);};walk(snapshot);return result;}
function project(event,{ids=trackedIds(),now=Date.now()}={}){
 if(event.eventFamilyId==='presidents-cup'||event.contestUnit)return event;
 const normalise=p=>({...p,id:identity(p.id)});
 const appearances=(event.appearances||[]).map(a=>({...a,participants:(a.participants||[]).map(normalise),participantIds:(a.participantIds||[]).map(identity)})).filter(a=>a.participantIds.some(id=>ids.has(id)));
 const retained=appearances.filter(a=>Number.isFinite(Date.parse(a.startTimeUtc))&&Date.parse(a.startTimeUtc)>=+now).sort((a,b)=>Date.parse(a.startTimeUtc)-Date.parse(b.startTimeUtc));
 // Keep at most the next published group per player and its next round. Exact
 // IDs and partner identities survive; elapsed time never establishes a result.
 const counts=new Map(),selected=retained.filter(a=>{const players=a.participantIds.filter(id=>ids.has(id)),keep=players.some(id=>(counts.get(id)||0)<2);if(keep)players.forEach(id=>counts.set(id,(counts.get(id)||0)+1));return keep;});
 const entrants=(event.entries||event.participants||[]).map(normalise).filter(p=>ids.has(p.id));
 return {...event,participants:entrants,participantIds:entrants.map(p=>p.id),entries:entrants,excludedParticipantIds:(event.excludedParticipantIds||[]).map(identity).filter(id=>ids.has(id)),appearances:selected,participationScope:'ranked-and-explicit-follows',participationScopeCheckedOn:cohort.checkedOn};
}
function projectDocument(document,options={}){return {...document,pgaParticipation:(document.pgaParticipation||[]).map(e=>project(e,options)),lpga:(document.lpga||[]).map(e=>project(e,options))};}
module.exports={cohort,identity,trackedIds,privateFollowIds,project,projectDocument};
