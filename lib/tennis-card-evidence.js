'use strict';
// Projection only: reuse retained source records, without another source read.
const catalogue=require('../data/canonical/tennis-catalogue-2026.json');
const journeys=require('../scripts/build-tennis-journeys').validate(require('../feeds/provider-exports/tennis/journeys-reviewed.v1.json'));
const follow=require('../config/follow-first');
const players=[...require('../data/canonical/tennis-context-2026.json').participants,...require('../data/canonical/tennis-published-participants-2026.json').participants];
const key=follow.participantFollowIdentityKey;
function record(player){
 if(!player||typeof player!=='object')return player;
 const known=players.find(p=>key(p.id)===key(player.id||player.participantId||player.playerId));
 const countryCode=player.countryCode||player.nationalityCode||known?.countryCode;
 return {...player,...(countryCode?{countryCode}:{}),...(!player.countryCode&&known?.metadata?.countrySourceUrl?{countrySourceUrl:known.metadata.countrySourceUrl}:{})};
}
function fixture(event){
 const tournament=catalogue.tournaments.find(t=>[event.tournamentId,event.tennisTournamentId].includes(t.tournamentId));
 const published=event.tournamentOpeningDate&&/^https:\/\//.test(event.tournamentOpeningSourceUrl||'');
 const opening=tournament?.openingPlayDate||tournament?.qualifyingStartDate||tournament?.startDate;
 return {...event,participants:(event.participants||[]).map(record),...(event.matchupSides?{matchupSides:event.matchupSides.map(s=>({...s,players:(s.players||[]).map(record)}))}:{}),...(!published&&opening&&tournament.sourceUrl?{tournamentOpeningDate:opening,tournamentOpeningSourceUrl:tournament.qualifyingSourceUrl||tournament.sourceUrl}:{})};
}
function parent(parent){
 const edition=journeys.editions.find(e=>e.eventFamilyId===parent.eventFamilyId&&e.season===parent.season);
 if(!edition)return parent;
 const windows=edition.tourWindows.filter(w=>(parent.tournamentIds||[]).includes(w.tournamentId));
 const refs=new Map(journeys.sources.map(s=>[s.id,s]));
 const outlookTours=windows.filter(w=>/major|grand.slam|1000/i.test(w.level||edition.category)&&w.sourceIds?.every(id=>/^https:\/\//.test(refs.get(id)?.url||''))).map(w=>w.tour);
 const outlookParticipation=(edition.participation||[]).filter(p=>windows.some(w=>w.tour===(journeys.players.find(r=>key(r.id)===key(p.playerId))?.tour))&&(p.evidenceKind!=='product_projection'||p.status==='withdrawn')).map(p=>({participantId:p.playerId,status:p.status,evidenceKind:p.evidenceKind,sourceUrls:(p.sourceIds||[]).map(id=>refs.get(id)?.url).filter(Boolean),verifiedAt:p.verifiedAt}));
 return {...parent,outlookTours,outlookParticipation};
}
function participantTours(){return Object.fromEntries([...players,...journeys.players].map(p=>[key(p.id),p.tour||(/:wta/.test(p.sportDomainId||p.id)?'WTA':/:atp/.test(p.sportDomainId||p.id)?'ATP':null)]).filter(([,tour])=>tour));}
module.exports={fixture,parent,record,participantTours};
