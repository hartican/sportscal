'use strict';
const identity=require('../config/fixture-identity');
const {publicFixtureTitle}=require('./finals-presentation');
function fixtures(){
  const phases=require('../data/canonical/afl-nrl-finals-2026.json').phases||[];
  const updates=new Map(require('../data/canonical/nrl-finals-published-2026.json').events.map(e=>[e.id,e]));
  const canonical=new Map(require('../data/canonical/afl-nrl-2026.json').events.map(e=>[e.id,e]));
  const published=new Map(require('../data/events.json').events.flatMap(e=>[e.id,e.canonicalEventId,e.eventId].filter(Boolean).map(id=>[id,e])));
  const finals=phases.flatMap(phase=>(phase.fixtures||[]).map(fixture=>{
    const prior=published.get(fixture.id),current=canonical.get(fixture.id),update=updates.get(fixture.id);
    const id=fixture.id==='major-match:nrl-finals-2026:grand-final'?'evt_84':fixture.id;
    const base={...fixture,...published.get(id),...prior,...current,...update};
    const publicName=publicFixtureTitle({...base,key:phase.codeId.replace('sport:',''),displayName:update?.name||current?.displayName||base.name});
    return identity.normalizeCore({...base,id,eventId:id,canonicalEventId:id,
      name:publicName,displayName:publicName,displayTitleCompact:publicName,
      sourceEventIds:[...new Set([fixture.id,id,...(base.sourceEventIds||[])])],
      key:phase.codeId.replace('sport:',''),cardKind:'fixture',
      competitionId:`competition:${phase.codeId.replace('sport:','')}-premiership-2026`,
      status:base.status||'scheduled',timePrecision:base.startTimeUtc?'exact':base.schedulePrecision||'unconfirmed',
      schedulePrecision:base.startTimeUtc?'exact':base.schedulePrecision||'unconfirmed',
      weekAnchorDate:base.startTimeUtc?null:base.weekAnchorDate||null,displayDateLabel:base.startTimeUtc?null:base.displayDateLabel||null,
      schedulingWindow:{startsOn:base.weekAnchorDate||phase.startDate,endsOn:base.weekAnchorDate||phase.endDate},date:base.date||base.weekAnchorDate||(id==='evt_84'?phase.endDate:null),
    });
  }));
  const {normalizeTennisSubEvent}=require('./follow-fixture-resolver');
  const tennis=(require('../data/major-events.v1.json').events||[]).filter(e=>e.id==='major-event:us-open-2026').flatMap(e=>(e.subEvents||[]).map(normalizeTennisSubEvent).filter(Boolean));
  return [...finals,...tennis];
}
module.exports={fixtures};
