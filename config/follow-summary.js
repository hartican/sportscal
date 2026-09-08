(function(root,factory){const api=factory(root.NOTHINGSPORTS_FOLLOW_FIRST || (typeof require==='function'?require('./follow-first'):null));root.NOTHINGSPORTS_FOLLOW_SUMMARY=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(globalThis,function(follow){
  "use strict";
  const {migratePreferences,STARTUP_SPORTS,MAJOR_EVENT_FAMILIES}=follow;
  function allFollowed(preferences,{records=[],collectionsById={}}={}){
    const identity=follow.participantFollowIdentityKey;
    const next=migratePreferences(preferences),byId=new Map(records.map(record=>[identity(record.id),record])),items=new Map();
    const add=(id,kind,sport,label,origin)=>{
      const key=identity(id),record=byId.get(key)||{},previous=items.get(key);
      const item=previous || {id:record.id||id,kind,sport:record.sportKey||sport||"other",competition:record.leagueId||record.competitionId||"",label:record.displayName||record.name||record.label||label||id,origins:[]};
      if(origin&&!item.origins.includes(origin))item.origins.push(origin);items.set(key,item);
    };
    for(const sport of next.followedSports)add(`sport:${sport}`,"sport",sport,STARTUP_SPORTS.find(item=>item.id===sport)?.label||sport);
    for(const id of next.selectedSelectorEntityIds || [])if(id.startsWith("sport:"))add(id,"sport",id.slice(6),byId.get(id)?.label||id.slice(6));
    for(const id of next.followFirst.followedMajorEventIds){const family=MAJOR_EVENT_FAMILIES.find(item=>item.id===id);add(id,"event",family?.sportIds[0]||"multi-sport",family?.label||id);}
    for(const item of next.preferenceGraph?.competitionPreferences || [])if(item.enabled===true)add(item.competitionId,"event",String(item.sportDomainId||"other").replace(/^sport:/,""),item.competitionId);
    const muted=new Set((next.preferenceGraph?.entityFollows || []).filter(item=>item.followLevel==="mute").map(item=>identity(item.participantId)));
    for(const item of next.preferenceGraph?.entityFollows || [])if(["follow","priority"].includes(item.followLevel)&&!muted.has(identity(item.participantId)))add(item.participantId,item.participantId.startsWith("team:")?"team":"athlete",item.participantId.split(":")[1]);
    for(const id of next.followFirst.collectionFollows){
      const collection=collectionsById[id];
      // Keep the followed collection visible even when its directory is offline.
      add(id,"collection",collection?.sportKey||id.split(":")[1],collection?.label||id);
      for(const member of collection?.memberIds || [])if(!muted.has(identity(member)))add(member,member.startsWith("team:")?"team":"athlete",member.split(":")[1],null,collection.label||id);
    }
    const order={sport:0,event:1,collection:2,team:3,athlete:4};
    return [...items.values()].sort((a,b)=>a.sport.localeCompare(b.sport)||a.competition.localeCompare(b.competition)||order[a.kind]-order[b.kind]||a.label.localeCompare(b.label));
  }

  async function render(body,context){
    body.textContent='Loading follows…';
    try{
      const manifest=await context.manifest(),preferences=context.preferences;
      const requested=new Set([...(preferences.followedSports||[]),...(preferences.preferenceGraph?.entityFollows||[]).map(item=>item.participantId.split(':')[1]),...(preferences.followFirst?.collectionFollows||[]).map(id=>id.split(':')[1])]);
      const keys=manifest.sports.filter(item=>requested.has(item.key)).map(item=>item.key);
      for(let offset=0;offset<keys.length;offset+=3)await Promise.allSettled(keys.slice(offset,offset+3).map(context.loadChunk));
    }catch(error){/* Retain labels and follows when a directory is offline. */}
    if(!context.isActive())return;
    const entries=allFollowed(context.preferences,{records:context.records(),collectionsById:context.collections()});
    const list=document.createElement('div');list.className='all-followed-list';
    let sport='',competition='';
    for(const entry of entries){
      if(entry.sport!==sport){sport=entry.sport;competition='';const heading=document.createElement('h3');heading.textContent=context.sportLabel(sport);list.appendChild(heading);}
      if(entry.competition&&entry.competition!==competition){competition=entry.competition;const heading=document.createElement('h4');heading.textContent=context.competitionLabel(competition);list.appendChild(heading);}
      const row=document.createElement('p');row.dataset.followedId=entry.id;
      const label=document.createElement('strong');label.textContent=entry.label===entry.id?context.participantLabel(entry.id):entry.label;
      const detail=document.createElement('span');detail.className='preference-help';detail.textContent=` · ${entry.kind==='athlete'?'Athlete':entry.kind[0].toUpperCase()+entry.kind.slice(1)}${entry.origins.length?` · via ${entry.origins.join(', ')}`:''}`;
      row.append(label,detail);list.appendChild(row);
    }
    if(!entries.length){const empty=document.createElement('p');empty.textContent='Nothing followed yet.';list.appendChild(empty);}
    body.replaceChildren(list);
  }
  return {allFollowed,render};
});
