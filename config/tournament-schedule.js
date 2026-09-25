(function(root,factory){const api=factory();root.NOTHINGSPORTS_TOURNAMENT_SCHEDULE=api;if(typeof module!=='undefined')module.exports=api;})(globalThis,function(){
 'use strict';
 const slug=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 function family(t){
  if(t.eventFamilyId)return t.eventFamilyId;
  if(t.eventSeriesId)return t.eventSeriesId.replace(/^event-series:/,'');
  const name=String(t.name||t.tournamentName||'');
  for(const [pattern,id] of [[/wta finals/i,'wta-finals'],[/atp finals/i,'atp-finals'],[/australian open/i,'australian-open'],[/roland|french open/i,'roland-garros'],[/wimbledon/i,'wimbledon'],[/\bus open\b|u\.s\. open/i,'us-open'],[/cincinnati/i,'cincinnati'],[/indian wells|bnp paribas/i,'indian-wells'],[/miami/i,'miami-open'],[/madrid/i,'madrid-open'],[/italia|rome/i,'italian-open'],[/national bank|canadian open/i,'national-bank-open'],[/monte.carlo/i,'monte-carlo-masters'],[/shanghai/i,'shanghai-masters'],[/paris masters/i,'paris-masters'],[/billie|bjk/i,'billie-jean-king-cup'],[/davis/i,'davis-cup'],[/united cup/i,'united-cup']])if(pattern.test(name))return id;
  return slug(name.replace(/\b20\d\d\b/g,''));
 }
 function category(t){return t.level==='grand_slam'?'Grand Slams':t.level==='atp_masters_1000'?'ATP Masters 1000':t.level==='wta_1000'?'WTA 1000':t.level==='atp_500'?'ATP 500':t.level==='wta_500'?'WTA 500':t.level==='atp_250'?'ATP 250':t.level==='wta_250'?'WTA 250':/finals/.test(t.level)?'Tour finals':t.level==='team_competition'?'International team events':null;}
 function sections(tournaments,day){
  const limit=new Date(day+'T12:00:00Z');limit.setUTCMonth(limit.getUTCMonth()+3);const until=limit.toISOString().slice(0,10);
  return ['Grand Slams','ATP Masters 1000','WTA 1000','ATP 500','WTA 500','ATP 250','WTA 250','Tour finals','International team events'].map(label=>{
   const all=tournaments.filter(t=>category(t)===label).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.name.localeCompare(b.name));
   return {label,current:all.filter(t=>t.endDate>=day&&t.startDate<=until),later:all.filter(t=>t.startDate>until),previous:all.filter(t=>t.endDate<day).reverse()};
  });
 }
 function identify(f,catalogue=[]){
  const raw=[f.tournamentName,f.competitionName,f.competitionId,f.eventFamilyId,f.majorEventName,f.key,f.id,f.sourceUrl,f.venue].filter(Boolean).join(' ');
  const year=String(f.date||f.startTimeUtc||'').slice(0,4);
  const normalized=slug(raw);
  const candidates=catalogue.filter(t=>String(t.season||t.startDate.slice(0,4))===year).filter(t=>f.tournamentId===t.tournamentId||f.eventFamilyId===family(t)||normalized.includes(slug(t.name))||normalized.includes(family(t)));
  const t=candidates.find(t=>f.date>=t.startDate&&f.date<=t.endDate)||candidates[0]||(!f.date&&catalogue.find(t=>t.tournamentId===f.tournamentId));
  const name=t?.name||f.tournamentName||f.competitionName||f.majorEventName||(f.key==='wimbledon'?'Wimbledon':null);
  // Unresolved source editions remain separate by published competition and year.
  const label=name||String(f.competitionId||'Tournament unavailable').replace(/^competition:/,'').replace(/[-:]/g,' ');
  return {id:t?.tournamentId||f.tournamentId||`${slug(label)}:${year}`,label:`${label} ${year||t?.season||String(t?.startDate||'').slice(0,4)}`,startDate:t?.startDate||f.date,endDate:t?.endDate||f.date};
 }
 function groups(fixtures,catalogue=[]){
  const out=new Map();for(const f of fixtures){const edition=identify(f,catalogue);let g=out.get(edition.id);if(!g){g={...edition,fixtures:[]};out.set(g.id,g);}g.fixtures.push(f);g.startDate=[g.startDate,f.date].filter(Boolean).sort()[0];g.endDate=[g.endDate,f.date].filter(Boolean).sort().at(-1);}
  for(const g of out.values())g.fixtures.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.time||'').localeCompare(String(b.time||''))||a.id.localeCompare(b.id));
  return [...out.values()].sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||a.id.localeCompare(b.id));
 }
 return {family,category,sections,identify,groups};
});
