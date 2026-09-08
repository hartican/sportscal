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
    const aliases = {"sport:afl-premiership":"sport:afl","sport:nrl-premiership":"sport:nrl","sport:rugby":"sport:rugby-union","sport:nba":"sport:basketball","sport:motogp":"competition:motogp","sport:sailgp":"competition:sailgp","sport:fiba-women":"competition:fiba-womens-world-cup"};
    const own = codes.find(code => code.id === (aliases[entity.id] || entity.id));
    if (own) return own;
    // A child championship must not advertise its parent's different schedule.
    if (entity.parentId === "sport:motorsport") return null;
    return codes.find(code => code.id === (aliases[entity.parentId] || entity.parentId)) || null;
  }

  function normalizeCore(event){
    const value = event && typeof event === "object" && !Array.isArray(event) ? event : {};
    const text = input => typeof input === "string" ? input : "";
    const normalized = {...value, key:sportKey(value)};
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
      normalized.startTimeUtc=exact.toISOString();normalized.date=`${parts.year}-${parts.month}-${parts.day}`;normalized.time=`${parts.hour}:${parts.minute}`;normalized.timePrecision="exact";
    }
    normalized.venue = text(value.venue) || text(value.venueName) || null;
    normalized.broadcaster = text(value.broadcaster);
    for (const key of ["participantIds", "participantSlots", "participants", "participantCountryCodes", "representativeCountryCodes", "broadcastOptions", "broadcasterIds", "broadcasts", "viewingOptions"]){
      normalized[key] = Array.isArray(value[key]) ? value[key].filter(item => item != null) : [];
    }
    for (const key of ["storyline", "calendarTemplate"]){
      if (value[key] && (typeof value[key] !== "object" || Array.isArray(value[key]))) normalized[key] = null;
    }
    normalized.consensusTags=consensusTagsForEvent(normalized);
    return normalized;
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
    for (const follow of preferences?.preferenceGraph?.entityFollows || []){
      if (["follow", "priority"].includes(follow?.followLevel)) keys.add(String(follow.participantId || "").split(":")[1]);
    }
    const aliases = {rugby:"rugby-union",nba:"basketball",nfl:"american-football",nhl:"ice-hockey",cwg:"multi-sport",rally:"wrc",fifa:"football","premier-league":"football"};
    const ids = new Set([...keys].map(key => `sport:${aliases[key] || key}`));
    if((preferences?.preferenceGraph?.entityFollows || []).some(follow=>/^competitor:f1:/.test(follow.participantId)&&['follow','priority'].includes(follow.followLevel)))ids.add('sport:motorsport');
    // A taxonomy parent does not imply data containment (e.g. AFL and AFLW).
    return codes.filter(code => ids.has(code.id) || keys.has(code.slug));
  }

  function mergeOverlays(events,updates){
    const result=events.slice(),indexes=new Map();
    const aliases=event=>[event?.canonicalEventId,event?.eventId,event?.id].filter(Boolean);
    result.forEach((event,index)=>aliases(event).forEach(id=>indexes.set(id,index)));
    for(const event of updates || []){
      const ids=aliases(event);if(!ids.length)continue;
      const match=ids.map(id=>indexes.get(id)).find(index=>index!==undefined),index=match??result.length;
      result[index]=normalizeCore({...result[index],...event});ids.forEach(id=>indexes.set(id,index));
    }
    return result;
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
    const tags=[...array(event.consensusTags),...array(event.editorialPreview?.consensusTags)].filter(tag=>tag&&allowed.has(tag.label)&&Number(tag.confidence)>=.6&&array(tag.sourceUrls).some(url=>/^https:\/\//.test(url)));
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
    const end = event?.endDate || event?.date || event?.startDate;
    return !/^\d{4}-\d{2}-\d{2}$/.test(end || "") || end >= cutoff;
  }
  return Object.freeze({sportKey, scheduleCode, normalizeCore, fromSchedule, followedScheduleCodes,mergeOverlays,estimateTimeline,retainedInActiveTimeline,consensusTagsForEvent});
});
