(function(root,factory){
  const api=factory();root.NOTHINGSPORTS_TENNIS_FEED=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis,function(){
  'use strict';
  const api=name=>globalThis[name] || (typeof require==='function'?require({'NOTHINGSPORTS_FOLLOW_FEED_POLICY':'./follow-feed-policy','NOTHINGSPORTS_FOLLOW_FIRST':'./follow-first','NOTHINGSPORTS_TOURNAMENT_SCHEDULE':'./tournament-schedule'}[name]):null);
  const id=e=>String(e.canonicalEventId||e.eventId||e.id||'');
  const isParent=e=>e?.cardType==='tennis_parent';
  const isRubber=e=>Boolean(e?.parentTieId||e?.tieId&&e?.contestUnit!=='tie'||e?.contestUnit==='rubber');
  function isFinal(e){
    if(isParent(e)||isRubber(e)||['MD','WD','XD'].includes(e.eventCode)||/doubles/i.test([e.eventType,e.matchType,e.drawType,e.discipline,e.name].join(' ')))return false;
    // Round labels take precedence over the name of a "Finals" tournament.
    return /^(?:(?:men.s|women.s|singles|championship|grand)\s+)*final$/i.test(String(e.roundLabel||e.round||e.stage||'').trim());
  }
  function parentKey(t){
    // Dates and locations are facts, not identity. Distinct stages use source IDs.
    const family=api('NOTHINGSPORTS_TOURNAMENT_SCHEDULE').family(t);
    return `tennis-parent:${t.editionId||family+':'+t.season}:${t.phaseId||t.stageId||(/team_competition/.test(t.level)?t.tournamentId:'main')}`;
  }
  function matches(parent,e){
    if(!e||isParent(e)||String(e.id||'').startsWith('tennis-tournament-')||api('NOTHINGSPORTS_FOLLOW_FEED_POLICY').aggregateEvent(e)||isRubber(e))return false;
    if(api('NOTHINGSPORTS_FOLLOW_FEED_POLICY').sportKey(e)!=='tennis')return false;
    const ids=[e.tennisTournamentId,e.tournamentId,e.editionId].filter(Boolean);
    if(ids.some(value=>parent.tournamentIds.includes(value)))return true;
    if(ids.length)return false;
    const family=api('NOTHINGSPORTS_FOLLOW_FEED_POLICY').eventFamilyIds(e);
    return family.includes(parent.eventFamilyId)&&Boolean(e.date&&parent.date&&parent.endDate&&e.date>=parent.date&&e.date<=parent.endDate);
  }
  function participation(parent,children){
    const policy=api('NOTHINGSPORTS_FOLLOW_FEED_POLICY');
    const entries=new Map((parent.sourceParticipation||[]).map(e=>[e.participantId+'|'+e.draw,e]));
    const removed=new Set(parent.excludedParticipantIds||[]);
    for(const entry of parent.participationEvidence||[]){
      if(['withdrawn','eliminated','excluded'].includes(entry.participationStatus))removed.add(entry.participantId);
      else if(['confirmed','entered','active'].includes(entry.participationStatus))entries.set(entry.participantId+'|entry',{participantId:entry.participantId,draw:'entry',active:true});
    }
    for(const child of children){
      const draw=child.drawId||child.eventType||child.matchType||(child.contestUnit==='tie'?'ties':'singles');
      const eliminated=new Set([...(child.eliminatedParticipantIds||[]),child.loserParticipantId,...(child.excludedParticipantIds||[])].filter(Boolean));
      if(['cancelled','canceled','withdrawn','abandoned'].includes(String(child.status).toLowerCase()))continue;
      for(const participantId of [...new Set([...policy.participantIds(child),...eliminated])]){
        entries.delete(participantId+'|entry');
        const key=participantId+'|'+draw,prior=entries.get(key);
        entries.set(key,{participantId,draw,active:!eliminated.has(participantId)&&prior?.active!==false});
      }
    }
    const eliminatedTeams=new Set(children.flatMap(c=>c.contestUnit==='tie'?(c.eliminatedParticipantIds||[]):[]));
    for(const child of children)for(const rubber of child.rubbers||[])for(const side of rubber.sides||[])for(const participantId of side.participantIds||[]){
      entries.set(participantId+'|team',{participantId,draw:'team',teamId:side.teamId,active:!eliminatedTeams.has(side.teamId)});
    }
    return [...entries.values()].map(e=>({...e,active:e.active&&!removed.has(e.participantId)&&!eliminatedTeams.has(e.teamId)}));
  }
  function activeParticipants(parent,children){return [...new Set(participation(parent,children).filter(e=>e.active).map(e=>e.participantId))];}
  function reconcile(parent,events){
    const children=new Map((parent.childContests||[]).map(e=>[id(e),e]));
    for(const e of events||[])if(matches(parent,e))children.set(id(e),{...children.get(id(e)),...e});
    const childContests=[...children.values()];
    const endDate=[parent.endDate,...childContests.map(e=>e.endDate||e.date)].filter(Boolean).sort().at(-1)||null;
    return {...parent,endDate,childContests,sourceParticipation:participation(parent,childContests),participantIds:activeParticipants(parent,childContests),participantsConfirmed:true};
  }
  function buildParents(catalogue,fixtures){
    const groups=new Map(),schedule=api('NOTHINGSPORTS_TOURNAMENT_SCHEDULE');
    for(const t of catalogue.tournaments||[]){
      if(!t.tournamentId||!t.season||!t.sourceUrl)continue;
      let key=parentKey(t);let prior=groups.get(key);
      if(prior && (prior.date!==t.startDate||prior.endDate!==t.endDate)){key=parentKey({...t,phaseId:t.tournamentId});prior=groups.get(key);}
      if(prior){prior.tournamentIds.push(t.tournamentId);prior.representedTours=[...new Set([...prior.representedTours,...(t.representedTours||[t.tour])])];continue;}
      const window=t.schedulingWindow||{};
      const date=t.startDate||window.startsOn||null,endDate=t.endDate||window.endsOn||date;
      groups.set(key,{id:key,eventId:key,canonicalEventId:key,key:'tennis',sport:'Tennis',sportDomainId:'sport:tennis',cardType:'tennis_parent',tournamentParent:true,
        name:t.name,tournamentName:t.name,season:t.season,tournamentId:t.tournamentId,tennisTournamentId:t.tournamentId,tournamentIds:[t.tournamentId],eventFamilyId:schedule.family(t),competitionId:t.competitionId,
        phaseId:t.phaseId||t.stageId||null,tour:t.tour,representedTours:t.representedTours||[t.tour],date,endDate,dateOnly:true,timePrecision:date?'date-only':'tbc',timeTbc:true,
        schedulingWindow:window,timingProvisional:t.timingProvisional===true||!t.startDate,dateLabel:t.dateLabel||window.label||(!date?'Dates to be confirmed':null),
        status:'upcoming',venue:[t.city,t.countryCode].filter(Boolean).join(', '),sourceUrl:t.sourceUrl,sourceName:t.sourceName||'Tournament calendar',sourceType:t.sourceType||'published',
        participationEvidence:t.participationEvidence||[],excludedParticipantIds:t.excludedParticipantIds||[],childContests:[],participantIds:[],expected:5});
    }
    return [...groups.values()].map(parent=>reconcile(parent,fixtures));
  }
  function reason(parent,preferences,{collectionsById={},preparedPreferences=null,expandedParticipantIds=null,now=new Date()}={}){
    const policy=api('NOTHINGSPORTS_FOLLOW_FEED_POLICY'),follow=api('NOTHINGSPORTS_FOLLOW_FIRST');
    const prefs=preparedPreferences||follow.migratePreferences(preferences);
    if(policy.explicitlyExcluded(parent,prefs))return null;
    if((prefs.followFirst?.followedMajorEventIds||[]).includes(parent.eventFamilyId)||(prefs.preferenceGraph?.competitionPreferences||[]).some(p=>p.competitionId===parent.competitionId&&p.enabled===true))return {type:'event',id:parent.eventFamilyId,displayTag:false};
    if(parent.endDate && parent.endDate<policy.dateKey(now))return null;
    const participant=(parent.participantIds||[]).find(id=>follow.effectiveParticipantFollow(id,prefs,collectionsById).followed || expandedParticipantIds?.has(id));
    return participant?{type:participant.startsWith('team:')?'team':'athlete',id:participant,displayTag:false}:null;
  }
  function timingLabel(parent){
    const label=parent.dateLabel || (parent.date?[parent.date,parent.endDate!==parent.date?parent.endDate:null].filter(Boolean).join(' – '):'Dates to be confirmed');
    return `${label}${parent.timingProvisional&&parent.date?' · Provisional':''}`;
  }
  return {isParent,isRubber,isFinal,parentKey,matches,activeParticipants,reconcile,buildParents,reason,timingLabel};
});
