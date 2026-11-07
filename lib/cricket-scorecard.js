'use strict';
const URL_BASE='https://apiv2.cricket.com.au/web/views/scorecard';
const url=id=>`${URL_BASE}?fixtureId=${id}&jsconfig=eccn%3Atrue&format=json`;
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const text=v=>typeof v==='string'&&v.trim()?v.trim().slice(0,240):null;
const nonBatting=b=>/^(?:didnotbat|yettobat|absenthurt|absent)$/.test(String(b?.dismissalTypeId||b?.dismissalText||'').replace(/[\s_-]/g,'').toLowerCase());
function phase(game){
 const value=String(game.gameStatus||'').trim();
 if(/stumps/i.test(value))return {status:'stumps',statusText:'Stumps'};
 if(/rain|weather|bad light|delayed/i.test(value))return {status:'rain-delay',statusText:value};
 if(/lunch|tea|innings break|break/i.test(value))return {status:'break',statusText:value};
 if(/suspend|interrupt/i.test(value))return {status:'interrupted',statusText:value};
 return null;
}
function chase(f,innings){
 const i=innings.slice().sort((a,b)=>a.inningNumber-b.inningNumber).at(-1),format=String(f.gameType||'');
 const limited=/^(?:ODI|One Day|T20I?|Twenty20|T20)$/i.test(format);
 if(!i||(!limited&&!/^Test$/i.test(format))||i.inningNumber!==(limited?2:4))return null;
 const statement=String(f.resultText||''),match=statement.match(/\b(?:need|needs|require|requires)\s+(\d+)\s+runs?\s+to\s+win\b/i);
 if(!match)return null;
 const team=[f.homeTeam,f.awayTeam].find(t=>t?.id===i.battingTeamId),prefix=statement.slice(0,match.index).trim().toLowerCase();
 const aliases=team?[team.name,team.nameOverride,team.shortName].filter(Boolean).flatMap(n=>[String(n),String(n).replace(/\s+(?:men|women)$/i,'')]).map(n=>n.toLowerCase()):[];
 if(!aliases.some(n=>prefix===n||prefix.endsWith(' '+n)||prefix.endsWith(':'+n)))return null;
 const runsRemaining=Number(match[1]),wicketsRemaining=10-i.numberOfWicketsFallen;
 const overs=String(f.oversRemaining??'').match(/^(\d{1,3})(?:\.([0-5]))?$/),ballsRemaining=limited&&overs?Number(overs[1])*6+Number(overs[2]||0):null;
 return {confirmed:true,inningNumber:i.inningNumber,runsRemaining,wicketsRemaining,ballsRemaining};
}
function normalize(payload,{fixtureId,checkedAt}){
 const f=payload?.fixture;
 if(payload?.responseError||payload?.dataSupport?.isReliableData!==true||f?.id!==fixtureId||!Array.isArray(f.innings)||!f.innings.length||f.innings.length>4||!Array.isArray(payload.players))throw Error('Invalid official cricket scorecard');
 if(new Set(payload.players.map(p=>p.id)).size!==payload.players.length)throw Error('Duplicate official players');
 const players=new Map(payload.players.map(p=>[p.id,p]));
 const name=id=>text(players.get(id)?.displayName||players.get(id)?.name);
 const innings=f.innings.map(i=>{
  if(i.fixtureId!==fixtureId||!Number.isSafeInteger(i.inningNumber)||i.inningNumber<1||i.inningNumber>4||!Number.isSafeInteger(i.runsScored)||i.runsScored<0||!Number.isSafeInteger(i.numberOfWicketsFallen)||i.numberOfWicketsFallen<0||i.numberOfWicketsFallen>10||!Array.isArray(i.batsmen)||!Array.isArray(i.bowlers)||!Array.isArray(i.wickets))throw Error('Incomplete official innings');
  const listed=payload.players.filter(p=>p.teamId===i.battingTeamId&&p.isTwelthMan!==true).sort((a,b)=>a.order-b.order),batters=new Map(i.batsmen.map(b=>[b.playerId,b]));
  if(listed.length<11||i.batsmen.some(b=>!name(b.playerId))||i.bowlers.some(b=>!name(b.playerId))||i.wickets.some(w=>!name(w.playerId)))throw Error('Unresolved official scorecard players');
  if(new Set(i.batsmen.map(b=>b.playerId)).size!==i.batsmen.length||new Set(i.bowlers.map(b=>b.playerId)).size!==i.bowlers.length||i.batsmen.some(b=>players.get(b.playerId).teamId!==i.battingTeamId||((!Number.isSafeInteger(b.runsScored)||b.runsScored<0)&&!(b.runsScored==null&&nonBatting(b))))||i.batsmen.filter(b=>b.isBatting===true).length>2||i.batsmen.some(b=>b.isBatting===true&&(b.isOut!==false||nonBatting(b)))||!Number.isSafeInteger(i.totalExtras)||i.batsmen.reduce((n,b)=>n+(b.runsScored||0),0)+i.totalExtras!==i.runsScored)throw Error('Contradictory official batting observation');
  if(i.bowlers.some(b=>players.get(b.playerId).teamId!==i.bowlingTeamId||(b.wicketsTaken!=null&&(!Number.isSafeInteger(b.wicketsTaken)||b.wicketsTaken<0||b.wicketsTaken>10)))||i.bowlers.reduce((n,b)=>n+(b.wicketsTaken||0),0)>i.numberOfWicketsFallen)throw Error('Contradictory official bowling observation');
  // The player list belongs to the team, not to an innings. Keep the source
  // sequence alongside actual positions so non-batters never acquire a future order.
  const sourceRows=[...i.batsmen,...listed.filter(p=>!batters.has(p.id)).map(p=>({playerId:p.id}))];
  const positions=new Map();for(const b of i.batsmen)if(Number.isSafeInteger(b.battingOrder)&&b.battingOrder>=1&&b.battingOrder<=11)positions.set(b.battingOrder,(positions.get(b.battingOrder)||0)+1);
  const batting=sourceRows.map((b,sourceOrder)=>({playerId:b.playerId,name:name(b.playerId),battingOrder:positions.get(b.battingOrder)===1?b.battingOrder:null,sourceOrder,isBatting:b.isBatting===true,runs:number(b.runsScored),balls:number(b.ballsFaced),fours:number(b.foursScored),sixes:number(b.sixesScored),strikeRate:number(b.strikeRate),dismissalType:text(b.dismissalTypeId),dismissal:text(b.dismissalText)||text(b.dismissalTypeId),bowledBy:name(b.bowledByPlayerId),dismissedBy:name(b.dismissedByPlayerId),notOut:b.isOut===false&&!nonBatting(b),didNotBat:nonBatting(b)}));
  batting.sort((a,b)=>(a.battingOrder??Infinity)-(b.battingOrder??Infinity)||a.sourceOrder-b.sourceOrder);
  const bowling=i.bowlers.slice().sort((a,b)=>a.order-b.order).map(b=>({playerId:b.playerId,name:name(b.playerId),overs:text(b.oversBowled),maidens:number(b.maidensBowled),runs:number(b.runsConceded),wickets:number(b.wicketsTaken),economy:number(b.economy),wides:number(b.wideBalls),noBalls:number(b.noBalls)}));
  const wickets=i.wickets.slice().sort((a,b)=>a.order-b.order).map(w=>({name:name(w.playerId),wicket:number(w.order),runs:number(w.runs),overs:text(w.overBallDisplay)}));
  return {inningNumber:i.inningNumber,battingTeamId:i.battingTeamId,bowlingTeamId:i.bowlingTeamId,runsScored:i.runsScored,numberOfWicketsFallen:i.numberOfWicketsFallen,oversBowled:text(i.oversBowled),isDeclared:i.isDeclared===true,isFollowOn:i.isFollowOn===true,isForfeited:i.isForfeited===true,batting,bowling,wickets,extras:{total:number(i.totalExtras),byes:number(i.byesRuns),legByes:number(i.legByesRuns),wides:number(i.wideBalls),noBalls:number(i.noBalls),penalties:number(i.penalties)},detailCheckedAt:checkedAt,detailSourceUrl:url(fixtureId)};
 });
 if(new Set(innings.map(i=>i.inningNumber)).size!==innings.length)throw Error('Duplicate official innings');
 return {fixture:f,innings,balance:text(f.resultText),phase:phase(f),chase:chase(f,innings)};
}
module.exports={url,normalize,phase,chase};
