(function attachFixtureIdentity(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FIXTURE_IDENTITY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildFixtureIdentity(){
  "use strict";

  const KEY_ALIASES = Object.freeze({"rugby-union":"rugby",basketball:"nba","multi-sport":"cwg",rally:"wrc","fiba-womens-world-cup":"fiba-women"});
  const SYDNEY_PARTS=new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  function sportKey(event, fallback = ""){
    const competition = String(event?.competitionId || "").toLowerCase();
    if (/^competition:wrc(?:[-:]|$)/.test(competition) || event?.competitionFamilyId === "family:world-rally-championship") return "wrc";
    if (/^competition:(?:formula-one|f1)(?:[-:]|$)/.test(competition)) return "f1";
    if (/^competition:motogp(?:[-:]|$)/.test(competition)) return "motogp";
    if (/^competition:(?:fia-)?wec(?:[-:]|$)/.test(competition) || event?.identityRef === "event:le-mans") return "lemans";
    const explicit = String(event?.key || event?.sportKey || event?.sportId || event?.preferenceDomainId || "").replace(/^sport:/, "");
    if (explicit && explicit !== "motorsport") return KEY_ALIASES[explicit] || explicit;
    const code = String(event?.codeId || fallback || explicit).replace(/^(?:sport|competition):/, "");
    return KEY_ALIASES[code] || code;
  }

  function scheduleCode(entity, codes = []){
    if (!entity) return null;
    const aliases = {"special:commonwealth-games":"sport:multi-sport","sport:afl-premiership":"sport:afl","sport:nrl-premiership":"sport:nrl","sport:rugby":"sport:rugby-union","sport:nba":"sport:basketball","sport:motogp":"competition:motogp","sport:sailgp":"competition:sailgp","sport:fiba-women":"competition:fiba-womens-world-cup"};
    const selectedId=String(entity.id||'').replace(/-women$/,'');
    const own = codes.find(code => code.id === (aliases[selectedId] || selectedId));
    if (own) return own;
    // A child championship must not advertise its parent's different schedule.
    if (entity.parentId === "sport:motorsport") return null;
    return codes.find(code => code.id === (aliases[entity.parentId] || entity.parentId)) || null;
  }

  // Reviewed exact provider identities; no name-based inference. Evidence and
  // durable-reference preflight: docs/quality/cricket-provider-identities.md.
  const PARTICIPANT_ALIASES=Object.freeze({'team:cricket:espn-1116':'team:cricket:ca-50','team:cricket:espn-924':'team:cricket:ca-40','team:cricket:ca-1466':'team:cricket:espn-1075499','team:rugby:wr-2342':'team:rugby:brumbies','team:rugby:wr-2343':'team:rugby:reds','team:rugby:wr-2587':'team:rugby:force','team:rugby:wr-1143':'team:rugby:waratahs'});
  const FIXTURE_ALIASES=Object.freeze({'evt_87':'fixture:cricket:espn:1525659','evt_88':'fixture:cricket:espn:1525660','evt_89':'fixture:cricket:espn:1525661','fixture:cricket:espn:1513451':'fixture:cricket:CA:39484','fixture:cricket:CA:40593':'fixture:cricket:espn:1525658','fixture:rugby:wr:ac4f516c-300d-4f4b-85ea-514f0be5ddf6':'rugby-new-zealand-australia-2026-10-10'});
  function canonicalParticipantId(id){const key=PARTICIPANT_ALIASES[String(id||'')]||String(id||'');const cricket=globalThis.NOTHINGSPORTS_CRICKET_COVERAGE||(typeof require==='function'?require('./cricket-coverage'):null);return cricket?.canonical(key)||key;}
  function canonicalFixtureId(id){const key=String(id||'');return FIXTURE_ALIASES[key]||Object.values(FIXTURE_ALIASES).find(k=>k.replace(/:/g,'-')===key)||key;}
  function fixtureAliases(id){const key=canonicalFixtureId(id);return [key,...(Object.values(FIXTURE_ALIASES).includes(key)?[key.replace(/:/g,'-')]:[]),...Object.keys(FIXTURE_ALIASES).filter(alias=>canonicalFixtureId(alias)===key)];}

  function normalizeCore(event){
    let value = event && typeof event === "object" && !Array.isArray(event) ? event : {};
    const text = input => typeof input === "string" ? input : "";
    const normalized = {...value, key:sportKey(value)};
    const reviewed=globalThis.NOTHINGSPORTS_REVIEWED_FIXTURE_REPAIRS || (typeof require==='function'?require('./reviewed-fixture-repairs'):null);
    Object.assign(normalized,reviewed?.facts(canonicalFixtureId(value.id||value.eventId))||{});
    value=normalized;
    if ([value.status,value.scheduleStatus].some(status => String(status || "").toLowerCase() === "unpublished")) normalized.published = false;
    normalized.id = String(value.id || value.eventId || value.canonicalEventId || "");
    normalized.eventId = String(value.eventId || value.canonicalEventId || normalized.id);
    normalized.name = text(value.name) || text(value.displayTitleCompact) || text(value.competitionName) || "Fixture details unconfirmed";
    normalized.displayTitleCompact = text(value.displayTitleCompact) || normalized.name;
    normalized.date = text(value.date) || text(value.startDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.date)){
      const instant = new Date(value.startTimeUtc || value.timelineSortTimeUtc || value.sessionStartTimeUtc || "");
      normalized.date = Number.isFinite(+instant) ? new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit"}).format(instant) : "";
    }
    normalized.time = text(value.time) || null;
    const exact = new Date(value.startTimeUtc || "");
    // Source UTC is authoritative over stale venue-local or Sydney display fields.
    if(Number.isFinite(+exact) && !["follows","estimated","date-only","tbc","unknown"].includes(value.timePrecision)){
      const parts=Object.fromEntries(SYDNEY_PARTS.formatToParts(exact).map(part=>[part.type,part.value]));
      normalized.startTimeUtc=exact.toISOString();normalized.date=`${parts.year}-${parts.month}-${parts.day}`;normalized.time=`${parts.hour}:${parts.minute}`;normalized.timePrecision=value.timePrecision==="not-before"?"not-before":"exact";
    }
    // Persisted live snapshots can retain date-only metadata after the provider
    // has explicitly confirmed an exact sporting start. Reconcile that group
    // together; an explicit uncertain flag or provisional schedule still wins.
    if((value.dateOnly===true || value.schedulePrecision==='date-only') && Number.isFinite(+exact) && value.timePrecision==='exact' && value.scheduleStatus==='confirmed' && value.timeTbc===false && value.startTimeTbc===false){
      normalized.dateOnly=false;normalized.schedulePrecision='exact';
    }
    normalized.venue = text(value.venue) || text(value.venueName) || null;
    normalized.broadcaster = text(value.broadcaster);
    for (const key of ["participantIds", "participantSlots", "participants", "participantCountryCodes", "representativeCountryCodes", "broadcastOptions", "broadcasterIds", "broadcasts", "viewingOptions"]){
      normalized[key] = Array.isArray(value[key]) ? value[key].filter(item => item != null) : [];
    }
    for (const key of ["storyline", "calendarTemplate"]){
      if (value[key] && (typeof value[key] !== "object" || Array.isArray(value[key]))) normalized[key] = null;
    }
    // Only the reviewed fixture pair is consolidated here. Team Follow aliases
    // do not implicitly merge every historic fixture or its durable actions.
    if(normalized.key==='cricket'&&canonicalFixtureId(normalized.id)==='fixture:cricket:CA:39484'){
      normalized.canonicalEventId='fixture:cricket:CA:39484';
      normalized.sourceEventIds=[...new Set([...(value.sourceEventIds||[]),'fixture:cricket:CA:39484','fixture:cricket:espn:1513451'])];
      normalized.participantIds=normalized.participantIds.map(canonicalParticipantId);
      normalized.participants=normalized.participants.map(p=>({...p,id:canonicalParticipantId(p.id)}));
      for(const key of ['homeParticipantId','awayParticipantId','winnerParticipantId'])if(normalized[key])normalized[key]=canonicalParticipantId(normalized[key]);
      if(Array.isArray(normalized.innings))normalized.innings=normalized.innings.map(i=>({...i,...(i.participantId?{participantId:canonicalParticipantId(i.participantId)}:{})}));
    }
    const originalId=normalized.id;
    normalized.id=canonicalFixtureId(normalized.id);
    if(originalId!==normalized.id||Object.values(FIXTURE_ALIASES).includes(normalized.id)){normalized.eventId=normalized.id;normalized.canonicalEventId=normalized.id;}
    else normalized.canonicalEventId=value.canonicalEventId||normalized.eventId;
    normalized.sourceEventIds=[...new Set([...(value.sourceEventIds||[]),originalId,normalized.id,...Object.keys(FIXTURE_ALIASES).filter(id=>canonicalFixtureId(id)===normalized.id)])];
    normalized.participantIds=normalized.participantIds.map(canonicalParticipantId);
    normalized.participants=normalized.participants.map(p=>({...p,id:canonicalParticipantId(p.id)}));
    normalized.participantSlots=normalized.participantSlots.map(p=>({...p,participantId:canonicalParticipantId(p.participantId)}));
    for(const key of ['homeParticipantId','awayParticipantId','winnerParticipantId'])if(normalized[key])normalized[key]=canonicalParticipantId(normalized[key]);
    normalized.consensusTags=consensusTagsForEvent(normalized);
    const national = globalThis.NOTHINGSPORTS_NATIONAL_TEAM_IDENTITIES
      || (typeof require === 'function' ? require('./national-team-identities') : null);
    if(normalized.key === 'football' && national){
      const canonicalIds = national.participantIdsForEvent(normalized);
      if(canonicalIds.includes('team:football:socceroos')){
        normalized.name = normalized.name.replace(/\bAustralia\b/g, 'Socceroos');
        normalized.displayTitleCompact = normalized.displayTitleCompact.replace(/\bAustralia\b/g, 'Socceroos');
        normalized.participantIds = canonicalIds;
        normalized.participants = canonicalIds.map((id,index) => ({...(normalized.participants[index] || {}),
          id, ...(id === 'team:football:socceroos' ? {name:'Socceroos',displayName:'Socceroos',countryCode:'AU'} : {})}));
        normalized.representativeCountryCodes = [...new Set([...normalized.representativeCountryCodes,'AU'])];
        normalized.isInternational = true;
        normalized.competitionScope = 'international';
      }
    }
    const pauses=globalThis.NOTHINGSPORTS_COVERAGE_PAUSES || (typeof require==="function"?require("./coverage-pauses"):null);
    return pauses ? pauses.apply(normalized) : normalized;
  }

  function fromSchedule(fixture, code = {}){
    return normalizeCore({...fixture, key:sportKey(fixture, code.slug),
      sport:fixture.sport || code.label || code.name,
      eventId:fixture.eventId || fixture.id,
      participantIds:Array.isArray(fixture.participantIds) ? fixture.participantIds
        : (Array.isArray(fixture.participantSlots) ? fixture.participantSlots : []).map(slot => slot?.participantId).filter(Boolean),
    });
  }

  function followedScheduleCodes(preferences, codes){
    const keys = new Set(preferences?.followedSports || []);
    for(const id of preferences?.selectedSelectorEntityIds||[]){
      if(id.startsWith('sport:'))keys.add(id.slice(6));
    }
    // Bathurst is the explicitly approved inherited Motorsport coverage.
    // Loading the schedule does not override the admission policy's opt-outs.
    if(keys.has('motorsport'))keys.add('supercars');
    if(preferences?.followFirst?.followedMajorEventIds?.includes('presidents-cup')||(preferences?.preferenceGraph?.competitionPreferences||[]).some(p=>p.competitionId==='competition:presidents-cup'&&p.enabled===true))keys.add('golf');
    for (const follow of preferences?.preferenceGraph?.entityFollows || []){
      if (["follow", "priority"].includes(follow?.followLevel)) keys.add(String(follow.participantId || "").split(":")[1]);
    }
    const aliases = {rugby:"rugby-union",nba:"basketball",nfl:"american-football",nhl:"ice-hockey",cwg:"multi-sport",rally:"wrc",fifa:"football","premier-league":"football"};
    const ids = new Set([...keys].map(key => {const base=key.replace(/-women$/,'');return `sport:${aliases[base] || base}`;}));
    if((preferences?.preferenceGraph?.entityFollows || []).some(follow=>/^competitor:f1:/.test(follow.participantId)&&['follow','priority'].includes(follow.followLevel)))ids.add('sport:motorsport');
    // A taxonomy parent does not imply data containment (e.g. AFL and AFLW).
    return codes.filter(code => ids.has(code.id) || keys.has(code.slug));
  }

  const SCORE_OBSERVATION_FIELDS=['homeScore','awayScore','scoreDisplay','score','sets','games','innings','rubbers','canonicalResultScoreline'];
  const observationTime=e=>e?.sourceCheckedAt||e?.canonicalSourceCheckedAt||null;
  const hasScore=e=>SCORE_OBSERVATION_FIELDS.some(k=>{const v=e?.[k];return Array.isArray(v)?v.length>0:v!=null&&v!==''&&(typeof v!=='object'||Object.keys(v).length>0);});
  const completed=status=>/^(completed|finished|final)$/i.test(status||'');
  function inningsAdvanced(base,event){
    if(sportKey(event)!=='cricket'||!Array.isArray(base?.innings)||!Array.isArray(event.innings))return false;
    return event.innings.some((next,index)=>{
      const prior=base.innings[index];if(!prior)return false;
      // A new representation, team label or score string is not evidence of play.
      if(prior.participantId&&next.participantId&&prior.participantId!==next.participantId)return false;
      if(!prior.participantId&&!next.participantId&&prior.team!==next.team)return false;
      const values=['runs','wickets','overs'].filter(key=>prior[key]!=null&&next[key]!=null&&prior[key]!==''&&next[key]!==''&&Number.isFinite(Number(prior[key]))&&Number.isFinite(Number(next[key])));
      return values.length>0&&values.every(key=>Number(next[key])>=Number(prior[key]))&&values.some(key=>Number(next[key])>Number(prior[key]));
    });
  }
  function reconcileObservation(base,event){
    if(event.enrichmentOnly)return;
    // Snapshot retrieval time cannot reopen a confirmed result. Preserve final
    // scores and provenance too; otherwise a stale live score could replace them.
    if(completed(base?.status)&&!completed(event.status)){
      for(const key of [...SCORE_OBSERVATION_FIELDS,'homeParticipantId','awayParticipantId','winnerParticipantId','winner','result','outcome','actualEndTimeUtc','completedAt','firstConfirmedCompleteAt','resultPublishedAt']){
        if(base[key]!==undefined)event[key]=base[key];else delete event[key];
      }
      event.status=base.status;event.statusCheckedAt=base.statusCheckedAt||observationTime(base);
      event.scoreCheckedAt=base.scoreCheckedAt||observationTime(base);
      event.livePlayObservedAt=null;
      return;
    }
    // Only a changed score observed from a live source establishes continuing play.
    // A source check timestamp alone cannot extend the ODI display window.
    const nextTime=Date.parse(event.scoreCheckedAt||observationTime(event)||'');
    const priorTime=Date.parse(base?.scoreCheckedAt||observationTime(base)||'');
    if(base&&/^(live|in_progress|in-progress|ongoing)$/.test(event.status||'')&&Number.isFinite(nextTime)&&Number.isFinite(priorTime)&&nextTime>priorTime&&inningsAdvanced(base,event))event.livePlayObservedAt=new Date(nextTime).toISOString();
    else if(base?.livePlayObservedAt)event.livePlayObservedAt=base.livePlayObservedAt;
    const scoreTime=event.scoreCheckedAt||observationTime(event),statusTime=event.statusCheckedAt||observationTime(event);
    const older=(next,prior)=>Number.isFinite(Date.parse(next))&&Number.isFinite(Date.parse(prior))&&Date.parse(next)<Date.parse(prior);
    if(hasScore(event)&&!older(scoreTime,base?.scoreCheckedAt||observationTime(base))){event.scoreCheckedAt=scoreTime;}
    else if(hasScore(base)){
      for(const key of SCORE_OBSERVATION_FIELDS)delete event[key];
      event.scoreCheckedAt=base.scoreCheckedAt||observationTime(base);
      // Retained home/away scores must retain their participant association.
      for(const key of ['homeParticipantId','awayParticipantId'])if(base[key])event[key]=base[key];
    }
    const passive=status=>!status||/^(scheduled|upcoming|not.started|pending)$/i.test(status);
    if(base&&((!passive(base.status)&&passive(event.status))||older(statusTime,base.statusCheckedAt||observationTime(base)))){
      event.status=base.status;event.statusCheckedAt=base.statusCheckedAt||observationTime(base);
      for(const key of ['actualEndTimeUtc','completedAt','firstConfirmedCompleteAt','resultPublishedAt'])if(base[key])event[key]=base[key];
    }else if(event.status)event.statusCheckedAt=statusTime;
  }

  function reconcileReviewedFixtureAliases(events){
    let result=events;
    for(const target of new Set(Object.values(FIXTURE_ALIASES))){
      const matches=result.filter(e=>canonicalFixtureId(e?.id||e?.eventId)===target);
      if(!matches.length)continue;
      const [merged]=mergeOverlays([],matches);
      const fixture=normalizeCore({...merged,id:target,eventId:target,canonicalEventId:target});
      let inserted=false;
      result=result.flatMap(e=>{if(!matches.includes(e))return [e];if(inserted)return [];inserted=true;return [fixture];});
    }
    return result;
  }

  function mergeOverlays(events,updates){
    const result=reconcileReviewedFixtureAliases(events).slice(),indexes=new Map(),semanticIndexes=new Map();
    const aliases=event=>[event?.canonicalEventId,event?.eventId,event?.id,...(event?.sourceEventIds||[])].filter(Boolean);
    const semanticKey=event=>{
      const ids=[...new Set([event.homeParticipantId,event.awayParticipantId].filter(Boolean))];
      if(ids.length!==2)return '';
      const start=Date.parse(event.startTimeUtc||'');if(!Number.isFinite(start))return '';
      return `${sportKey(event)}|${start}|${ids.sort().join('|')}`;
    };
    result.forEach((event,index)=>{aliases(event).forEach(id=>indexes.set(id,index));const key=semanticKey(event);if(key)semanticIndexes.set(key,index);});
    // Enrichment is an additive overlay, never a replacement score/status feed.
    const ordered=[...(updates||[]).filter(event=>!event.enrichmentOnly),...(updates||[]).filter(event=>event.enrichmentOnly)];
    for(const update of ordered){
      const reviewedId=canonicalFixtureId(update?.id||update?.eventId);
      const event = {...(Object.values(FIXTURE_ALIASES).includes(reviewedId)||(globalThis.NOTHINGSPORTS_REVIEWED_FIXTURE_REPAIRS||(typeof require==='function'?require('./reviewed-fixture-repairs'):null))?.facts(reviewedId)?normalizeCore(update):update)};
      const ids=aliases(event);if(!ids.length)continue;
      const key=semanticKey(event),match=ids.map(id=>indexes.get(id)).find(index=>index!==undefined)??(key?semanticIndexes.get(key):undefined),index=match??result.length;
      const base=result[index];
      // A confirmed sporting start supersedes an older date-only placeholder.
      // Missing optional flags must not inherit TBC from the retained record.
      // Explicitly uncertain new observations keep their uncertainty.
      if(base && (base.timeTbc || base.startTimeTbc || base.dateOnly) && event.timePrecision==='exact' && event.scheduleStatus==='confirmed' && Number.isFinite(Date.parse(event.startTimeUtc)) && !event.timeTbc && !event.startTimeTbc && !event.dateOnly){
        event.timeTbc=false;event.startTimeTbc=false;event.dateOnly=false;
      }
      reconcileObservation(base,event);
      if(base && !event.enrichmentOnly){
        const reviewedAt = record => Date.parse(record?.editorialNarrative?.researchedAt || record?.lastReviewedAt || '') || 0;
        // A score snapshot's fetch timestamp is not an editorial review.
        if(reviewedAt(base) > reviewedAt(event)){
          for(const field of ['editorialNarrative','editorialPreview','selectedSentence','fullSpiel','summary','storyline','lastReviewedAt','resultEditorialBranches']){
            if(base[field] !== undefined) event[field] = base[field];
          }
        }
        const resolved = record => (record?.participants || []).length >= 2 &&
          record.participants.every(p => !/winner of|loser of|\btbc\b|\btbd\b|to be confirmed/i.test(p.name || p.displayName || '') && Boolean(p.name || p.displayName));
        if(resolved(base) && !resolved(event)){
          for(const field of ['name','displayName','displayTitleCompact','participants','participantIds','homeParticipantId','awayParticipantId','participantSlots']){
            if(base[field] !== undefined) event[field] = base[field];
          }
        }
        const missing=value=>value==null || value==='' || (Array.isArray(value)&&!value.length) || (typeof value==='string'&&/^(?:tbc|tbd|unknown|venue tbc)$/i.test(value));
        // Score providers commonly omit venue and broadcast rights. Absence is
        // not a retraction of separately verified fixture details.
        for(const field of ['venue','venueName','venueCity','broadcaster','broadcasterIds','broadcastOptions','broadcasts','viewingOptions']){
          if(missing(event[field])&&!missing(base[field]))event[field]=base[field];
        }
        if(!event.startTimeUtc && base.startTimeUtc && !['postponed','cancelled','abandoned'].includes(event.status)){
          for(const field of ['date','time','startTimeUtc','timePrecision','scheduleStatus','timeTbc']){
            if(base[field]!==undefined)event[field]=base[field];
          }
        }
        if(/^won by\b/i.test(event.scoreDisplay||'') && String(base.scoreDisplay||'').endsWith(event.scoreDisplay))event.scoreDisplay=base.scoreDisplay;
      }
      // A cached draw placeholder cannot erase a subsequently published fixture.
      // Real postponements, cancellations and live results still use the normal path.
      if(base?.date && (base.time || base.startTimeUtc) && event.scheduleStatus==='provisional' && !event.date && !event.startTimeUtc && !event.time && !['postponed','cancelled','abandoned','live','finished'].includes(event.status))continue;
      result[index]=event.enrichmentOnly?applyEnrichment(base,event):normalizeCore({...base,...event,...(base?{id:base.id,eventId:base.eventId||base.id,canonicalEventId:base.canonicalEventId||base.id,sourceEventIds:[...new Set([...aliases(base),...ids])]}:{})});
      ids.forEach(id=>indexes.set(id,index));if(key)semanticIndexes.set(key,index);
    }
    return result;
  }

  function applyEnrichment(existing,overlay){
    const base=existing||overlay.fixtureFallback||{id:overlay.id};
    const entries=new Map();
    for(const entry of [...(base.participationEvidence||[]),...(overlay.participationEvidence||[])]){
      if(!entry?.participantId)continue;
      const prior=entries.get(entry.participantId),when=Date.parse(entry.publishedAt||entry.checkedAt)||0,priorWhen=Date.parse(prior?.publishedAt||prior?.checkedAt)||0;
      if(!prior||when>priorWhen||when===priorWhen&&entry.participationStatus==='withdrawn')entries.set(entry.participantId,entry);
    }
    const participantIds=new Set(base.participantIds||[]),excluded=new Set(base.excludedParticipantIds||[]),participants=new Map((base.participants||[]).map(item=>[item.id,item]));
    for(const entry of entries.values()){
      if(entry.participationStatus==='withdrawn'){participantIds.delete(entry.participantId);participants.delete(entry.participantId);excluded.add(entry.participantId);}
      else{participantIds.add(entry.participantId);excluded.delete(entry.participantId);if(!participants.has(entry.participantId))participants.set(entry.participantId,{id:entry.participantId,displayName:entry.displayName,countryCode:entry.countryCode});}
    }
    const tags=new Map((base.consensusTags||[]).map(tag=>[tag.label,tag]));
    for(const tag of overlay.consensusTags||[]){const prior=tags.get(tag.label);if(!prior||String(tag.checkedAt||'')>=String(prior.checkedAt||''))tags.set(tag.label,tag);}
    return normalizeCore({...base,participantIds:[...participantIds],participants:[...participants.values()],participantCountryCodes:[...new Set([...(base.participantCountryCodes||[]),...[...entries.values()].filter(entry=>entry.participationStatus!=='withdrawn').map(entry=>entry.countryCode)].filter(Boolean))],excludedParticipantIds:[...excluded],participationEvidence:[...entries.values()],consensusTags:[...tags.values()]});
  }

  function estimateTimeline(events,{now=new Date()}={}){
    const groups=new Map(),output=new Map();
    for(const event of events || []){
      const court=event?.courtId||event?.court||(/court|ashe|armstrong|grandstand/i.test(event?.venue||"")?event.venue:null);
      if(!court||!event.sessionStartTimeUtc)continue;
      const key=`${court}|${event.sessionStartTimeUtc}`,group=groups.get(key)||[];group.push(event);groups.set(key,group);
    }
    for(const group of groups.values()){
      group.sort((a,b)=>Number(a.sequenceInSession||0)-Number(b.sequenceInSession||0));
      let prior=null;
      for(const event of group){
        let next=event;
        if(["follows","estimated"].includes(event.timePrecision)){
          const doubles=/doubles/i.test([prior?.eventType,prior?.drawType,prior?.name].join(" "));
          const bestOfFive=Number(prior?.bestOf)===5 || /^(?:men|mens|male|MS)$/i.test(prior?.gender||prior?.eventCode||"")&&/us.open|wimbledon|roland|australian.open/i.test(prior?.competitionId||prior?.parentEventId||"")&&!doubles;
          const duration=(doubles?90:bestOfFive?180:105)+10;
          const previousStart=Date.parse(prior?.startTimeUtc||prior?.estimatedStartTimeUtc||"");
          const completed=Date.parse(prior?.actualEndTimeUtc||"");
          let anchor=Number.isFinite(completed)?completed+600000:Number.isFinite(previousStart)?previousStart+duration*60000:Date.parse(event.sessionStartTimeUtc);
          if(prior?.status==='live'&&!Number.isFinite(completed)&&anchor<+now)anchor=+now+(Math.max(5,Number(prior.estimatedRemainingMinutes)||15)+10)*60000;
          const notBefore=Date.parse(event.notBeforeTimeUtc||"");
          const start=Math.max(anchor,Number.isFinite(notBefore)?notBefore:anchor);
          if(Number.isFinite(start)){
            const parts=Object.fromEntries(SYDNEY_PARTS.formatToParts(new Date(start)).map(part=>[part.type,part.value]));
            next={...event,estimatedStartTimeUtc:new Date(start).toISOString(),timelineSortTimeUtc:new Date(start).toISOString(),timePrecision:"estimated",date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`,
              timingProvenance:{kind:"sport-estimate",method:"same-court-sequence.v1",priorEventId:prior?.id||null,sourceUrl:event.sourceUrl||null}};
          }
        }
        output.set(event,next);prior=next;
      }
    }
    return (events || []).map(event=>output.get(event)||event);
  }

  function consensusTagsForEvent(event){
    const array=value=>Array.isArray(value)?value:[];
    const allowed=new Set(['Rivalry','Derby','Round-Robin','Knockout','Final','Record Chase']);
    const urls=[event.sourceUrl,...array(event.sourceUrls),...array(event.sources).map(source=>source?.url)].filter(url=>typeof url==='string'&&/^https:\/\//.test(url));
    const tags=[...array(event.consensusTags),...array(event.editorialPreview?.consensusTags)].filter(tag=>tag&&allowed.has(tag.label)&&Number(tag.confidence)>=.6&&(!tag.expiresAt||Date.parse(tag.expiresAt)>Date.now())&&array(tag.sourceUrls).some(url=>/^https:\/\//.test(url)));
    // Structural schedule facts can be classified without inventing narrative.
    const round=String(event.round||event.roundLabel||event.stage||'').toLowerCase();
    const label=/^(?:grand |grand-)?final$/.test(round)?'Final':/quarter.?final|semi.?final|knockout|round of (?:16|32)/.test(round)?'Knockout':/round.?robin|group stage/.test(round)?'Round-Robin':null;
    if(label&&urls.length)tags.push({label,confidence:.9,sourceUrls:[...new Set(urls)],method:'published-schedule.v1'});
    return [...new Map(tags.map(tag=>[tag.label,tag])).values()];
  }
  function retainedInActiveTimeline(event, now = new Date(), days = 7){
    if (event?.status === "live") return true;
    const parts = Object.fromEntries(SYDNEY_PARTS.formatToParts(now).map(part => [part.type,part.value]));
    const cutoff = new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)-days)).toISOString().slice(0,10);
    const start=event?.date || event?.startDate || event?.schedulingWindow?.startsOn;
    const end = event?.endDate || event?.date || event?.startDate || event?.schedulingWindow?.endsOn;
    const futureYear=Number(parts.year)+1,month=Number(parts.month)-1;
    const lastDay=new Date(Date.UTC(futureYear,month+1,0)).getUTCDate();
    const horizon=new Date(Date.UTC(futureYear,month,Math.min(Number(parts.day),lastDay))).toISOString().slice(0,10);
    return (!/^\d{4}-\d{2}-\d{2}$/.test(end || "") || end >= cutoff) && (!/^\d{4}-\d{2}-\d{2}$/.test(start || "") || start<=horizon);
  }
  return Object.freeze({canonicalParticipantId,canonicalFixtureId,fixtureAliases,sportKey, scheduleCode, normalizeCore, fromSchedule, followedScheduleCodes,mergeOverlays,estimateTimeline,retainedInActiveTimeline,consensusTagsForEvent});
});
