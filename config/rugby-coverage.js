(function(root,factory){const api=factory();root.NOTHINGSPORTS_RUGBY_COVERAGE=api;if(typeof module==='object')module.exports=api;})(globalThis,function(){
  'use strict';
  const competitions=Object.freeze([
    {id:'competition:rugby:wr:918e620a-c1a4-4050-97ae-20f44da52e33',label:'Champions Cup',family:'champions-cup'},
    {id:'competition:rugby:wr:77856c82-8f54-4fb6-87d5-42d49d2227fa',label:'Top 14',family:'top-14'},
    {id:'competition:rugby:wr:6cacfefe-eb6f-4314-989c-893ebff51651',label:'PREM Rugby',family:'prem-rugby'},
    {id:'competition:rugby:wr:413bfe21-f81b-420e-9f93-5373628cb6cd',label:'United Rugby Championship',family:'urc'},
    {id:'competition:rugby:wr:145a0f16-1628-498b-afd7-67fa201ab047',label:'Currie Cup Premier Division',family:'currie-cup'},
    {id:'competition:rugby:wr:16e09e86-cf77-4acd-80a0-7b9aa9030e57',label:'National Provincial Championship',family:'npc'}
  ]);
  function allowed(e){
    if(!/^rugby(?:-union|-women)?$/.test(String(e.key||e.sportKey||'').replace(/^sport:/,'')))return true;
    if(e.isSenior===false||/under.?\d|\bu\d{2}\b|reserve|academy|sevens/i.test([e.name,e.competitionName,e.discipline,e.ageGroup].join(' ')))return false;
    if(competitions.some(c=>c.id===e.competitionId))return !/women|female/.test(e.gender||e.genderCategory||'');
    if(e.isInternational===true||e.competitionScope==='international')return true;
    const identities=globalThis.NOTHINGSPORTS_NATIONAL_TEAM_IDENTITIES||(typeof require==='function'?require('./national-team-identities'):null),ids=[...new Set([...(e.participantIds||[]),...(e.participantSlots||[]).map(p=>p.participantId)].filter(Boolean))];
    if(ids.length===2&&ids.every(id=>identities?.teamForId(id)))return true;
    return /^competition:super-rugby(?:-pacific|-aus)?(?::|$)/.test(e.competitionId||'')||e.competitionId==='competition:rugby:wr:173b3ab9-4247-4dff-9bc1-9bd7ceda6482'||e.competitionCountryCode==='AU';
  }
  return {competitions,allowed};
});
