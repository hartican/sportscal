'use strict';
const day=(value=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const add=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
function inHorizon(t,today=day()){return (t.endDate||t.date||t.startDate)>=today&&(t.startDate||t.date)<=add(today,27);}
function structure(t,fixtures=[],format={}){
 const id=t.tournamentId||t.id,slots=[];
 const put=(round,index,kind='match')=>slots.push({slotId:`${id}:${kind}:${round}:${index}`,round,index,kind,status:'provisional',participantSlots:kind==='round'?[]:[{label:'To be confirmed',participantId:null},{label:'To be confirmed',participantId:null}],date:null,time:null});
 if(t.eventFamilyId==='presidents-cup'){for(const f of fixtures.filter(f=>f.cardType==='golf_session')){put(f.stage,1,'round');slots.at(-1).slotId=f.id;}}
 else if(format.sessions){for(const [label,count]of format.sessions)for(let i=1;i<=count;i++)put(label,i,t.key==='golf'?'match':'stage');}
 else if(t.key==='golf')for(let r=1;r<=(format.rounds||4);r++)put(`Round ${r}`,1,'round');
 else if(format.drawSize){
  let size=format.drawSize,bracket=2**Math.ceil(Math.log2(size));
  for(let n=bracket;n>=2;n/=2){const count=n===bracket?size-n/2:n/2,label=n===2?'Final':n===4?'Semi-finals':n===8?'Quarter-finals':`Round of ${n}`;for(let i=1;i<=count;i++)put(label,i);}
  if(format.qualifiers)for(let r=1;r<=2;r++)for(let i=1;i<=format.qualifiers*(r===1?2:1);i++)put(`Qualifying round ${r}`,i,'qualifying');
 }else{
  // Unknown formats stay explicitly incomplete, never masquerade as a real draw.
  const rounds=[...new Set(fixtures.map(f=>f.roundLabel||f.stage).filter(Boolean))];
  for(const round of rounds.length?rounds:['Schedule to be confirmed'])put(round,1,'stage');
 }
 if(format.doublesSize){const size=format.doublesSize,bracket=2**Math.ceil(Math.log2(size));for(let n=bracket;n>=2;n/=2){const count=n===bracket?size-n/2:n/2,label='Doubles '+(n===2?'Final':n===4?'Semi-finals':n===8?'Quarter-finals':`Round of ${n}`);for(let i=1;i<=count;i++)put(label,i,'doubles');}}
 if(format.teamRubbers){for(const tie of [...slots])if(tie.kind==='match'){tie.kind='tie';for(const rubber of ['Singles 1','Singles 2','Doubles'])put(`${tie.round} · Tie ${tie.index} · ${rubber}`,1,'rubber');}}
 for(const [round,confirmed]of Object.entries(format.confirmedTimes||{})){const slot=slots.find(s=>s.round===round);if(slot)Object.assign(slot,confirmed);}
 const byId=new Map(slots.map(s=>[s.slotId,s]));
 for(const f of fixtures){
  const exact=byId.get(f.tournamentSlotId||f.slotId||f.id);
  const matching=exact||slots.find(s=>s.round===(f.roundLabel||f.stage)&&s.index===Number(f.drawMatchNumber||f.matchNumber)&&s.kind===(f.slotKind||'match'));
  if(matching)Object.assign(matching,{fixtureId:f.id,status:f.status||'scheduled',participantSlots:f.participantSlots||[],date:f.date||null,time:f.time||null,startTimeUtc:f.startTimeUtc||null});
 }
 return {tournamentId:id,name:t.name,startDate:t.startDate||t.date,endDate:t.endDate||t.date,sourceUrl:t.sourceUrl,formatSourceUrl:format.sourceUrl||t.sourceUrl,formatConfirmed:!!(t.eventFamilyId==='presidents-cup'||format.drawSize||format.rounds||format.sessions),slots};
}
module.exports={day,add,inHorizon,structure};
