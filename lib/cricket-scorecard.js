'use strict';
const URL_BASE='https://apiv2.cricket.com.au/web/views/scorecard';
const url=id=>`${URL_BASE}?fixtureId=${id}&jsconfig=eccn%3Atrue&format=json`;
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const text=v=>typeof v==='string'&&v.trim()?v.trim().slice(0,240):null;
function phase(game){
 const value=String(game.gameStatus||'').trim();
 if(/stumps/i.test(value))return {status:'stumps',statusText:'Stumps'};
 if(/rain|weather|bad light|delayed/i.test(value))return {status:'rain-delay',statusText:value};
 if(/lunch|tea|innings break|break/i.test(value))return {status:'break',statusText:value};
 if(/suspend|interrupt/i.test(value))return {status:'interrupted',statusText:value};
 return null;
}
function normalize(payload,{fixtureId,checkedAt}){
 const f=payload?.fixture;
 if(payload?.responseError||payload?.dataSupport?.isReliableData!==true||f?.id!==fixtureId||!Array.isArray(f.innings)||!f.innings.length||f.innings.length>4||!Array.isArray(payload.players))throw Error('Invalid official cricket scorecard');
 const players=new Map(payload.players.map(p=>[p.id,p]));
 const name=id=>text(players.get(id)?.displayName||players.get(id)?.name);
 const innings=f.innings.map(i=>{
  if(i.fixtureId!==fixtureId||!Number.isSafeInteger(i.inningNumber)||i.inningNumber<1||i.inningNumber>4||!Number.isSafeInteger(i.runsScored)||i.runsScored<0||!Number.isSafeInteger(i.numberOfWicketsFallen)||i.numberOfWicketsFallen<0||i.numberOfWicketsFallen>10||!Array.isArray(i.batsmen)||!Array.isArray(i.bowlers)||!Array.isArray(i.wickets))throw Error('Incomplete official innings');
  const listed=payload.players.filter(p=>p.teamId===i.battingTeamId&&p.isTwelthMan!==true).sort((a,b)=>a.order-b.order),batters=new Map(i.batsmen.map(b=>[b.playerId,b]));
  if(listed.length<11||i.batsmen.some(b=>!name(b.playerId))||i.bowlers.some(b=>!name(b.playerId))||i.wickets.some(w=>!name(w.playerId)))throw Error('Unresolved official scorecard players');
  const batting=listed.map(p=>{const b=batters.get(p.id);return {playerId:p.id,name:name(p.id),runs:b?number(b.runsScored):null,balls:b?number(b.ballsFaced):null,fours:b?number(b.foursScored):null,sixes:b?number(b.sixesScored):null,strikeRate:b?number(b.strikeRate):null,dismissal:b?text(b.dismissalText)||text(b.dismissalTypeId):'Did not bat',bowledBy:b?name(b.bowledByPlayerId):null,dismissedBy:b?name(b.dismissedByPlayerId):null,notOut:b?.isOut===false&&!/did.?not.?bat|yet.to.bat/i.test(b?.dismissalTypeId||''),didNotBat:!b||/did.?not.?bat|yet.to.bat/i.test(b.dismissalTypeId||'')};});
  const bowling=i.bowlers.slice().sort((a,b)=>a.order-b.order).map(b=>({playerId:b.playerId,name:name(b.playerId),overs:text(b.oversBowled),maidens:number(b.maidensBowled),runs:number(b.runsConceded),wickets:number(b.wicketsTaken),economy:number(b.economy),wides:number(b.wideBalls),noBalls:number(b.noBalls)}));
  const wickets=i.wickets.slice().sort((a,b)=>a.order-b.order).map(w=>({name:name(w.playerId),wicket:number(w.order),runs:number(w.runs),overs:text(w.overBallDisplay)}));
  return {inningNumber:i.inningNumber,battingTeamId:i.battingTeamId,bowlingTeamId:i.bowlingTeamId,runsScored:i.runsScored,numberOfWicketsFallen:i.numberOfWicketsFallen,oversBowled:text(i.oversBowled),isDeclared:i.isDeclared===true,isFollowOn:i.isFollowOn===true,isForfeited:i.isForfeited===true,batting,bowling,wickets,extras:{total:number(i.totalExtras),byes:number(i.byesRuns),legByes:number(i.legByesRuns),wides:number(i.wideBalls),noBalls:number(i.noBalls),penalties:number(i.penalties)},detailCheckedAt:checkedAt,detailSourceUrl:url(fixtureId)};
 });
 if(new Set(innings.map(i=>i.inningNumber)).size!==innings.length)throw Error('Duplicate official innings');
 return {fixture:f,innings,balance:text(f.resultText),phase:phase(f)};
}
module.exports={url,normalize,phase};
