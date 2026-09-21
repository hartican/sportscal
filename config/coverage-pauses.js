(function(root,factory){const api=factory();root.NOTHINGSPORTS_COVERAGE_PAUSES=api;if(typeof module!=="undefined")module.exports=api;})(globalThis,function(){
"use strict";
// User decision, 2026-09-22: women's T20 detail coverage paused until further notice.
function womensT20(event={}){
 const sport=String(event.key||event.sportKey||event.sportDomainId||event.codeId||'').replace(/^sport:/,'');
 const text=[event.format,event.matchFormat,event.playingFormat,event.roundLabel,event.name,event.competitionName,event.competitionId].filter(Boolean).join(' ');
 const women=/^(women|womens|women's|female|w)$/i.test(event.gender||event.genderCategory||'') || /women|womens|wbbl/i.test(text) || (event.participantIds||[]).some(id=>/-women(?:$|:)/.test(id));
 return (sport==='cricket'||/cricket/.test(event.competitionId||'')) && women && /\bt20i?\b|twenty20|wbbl/i.test(text);
}
const fields=['editorialNarrative','editorialPreview','storyline','selectedSentence','fullSpiel','recapText','narrativeHook','hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn','editorialReplayRecommendation','resultEditorialBranches','editorialConsequence','summary','description','details','recap','venue','venueName','venueId','venueCountryCode','venueDetails','venueDisplayName','venueOfficialName','venueSourceName','venueCity','city','venueLatitude','venueLongitude','latitude','longitude','location','broadcaster','broadcasters','broadcasterIds','broadcastOptions','broadcasts','viewingOptions','broadcastSourceUrl','broadcastCheckedAt','fixtureResults','homeScore','awayScore','score','scoreDisplay','result','results','outcomeText','resultPublishedAt','consensusResult','resultLabels','winnerId','winnerParticipantId'];
function apply(event,{inPlace=false}={}){
 if(!womensT20(event))return event;
 const result=inPlace?event:{...event};
 for(const key of fields)delete result[key];
 const cleanSide=p=>{if(!p||typeof p!=='object')return p;const copy={...p};for(const key of ['score','scores','result','winner','isWinner'])delete copy[key];if(copy.players)copy.players=copy.players.map(cleanSide);return copy;};
 for(const key of ['participants','participantSlots','matchupSides'])if(Array.isArray(result[key]))result[key]=result[key].map(cleanSide);
 return result;
}
return {womensT20,apply,fields};
});
