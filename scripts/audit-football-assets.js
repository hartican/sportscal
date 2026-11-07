#!/usr/bin/env node
'use strict';
// Read-only snapshot inventory. Source/rights labels describe provenance,
// never permission. No image download, refresh, scheduler or certification.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const identity=require('../config/card-identities');
const pilotIds=['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league'];
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function inventory(){
 const file='data/code-inspector/football.json',bytes=fs.readFileSync(path.join(root,file));
 const fixtures=JSON.parse(bytes).fixtures.filter(event=>pilotIds.includes(event.competitionId));
 const schedule=JSON.parse(fs.readFileSync(path.join(root,'data/follow-schedule/football.json'))).fixtures;
 const ids=fixtures.map(event=>event.id);
 if(new Set(ids).size!==ids.length||ids.some(id=>!schedule.some(event=>event.id===id)))throw Error('Pilot fixture identity/projection mismatch');
 const directory=JSON.parse(fs.readFileSync(path.join(root,'data/canonical/football-directory.v1.json')));
 const participants=(directory.teams||[]).map(team=>({...team,canonicalName:team.displayName,shortName:team.shortName||team.displayName,metadata:{...(team.metadata||{}),titleAliases:team.aliases||[team.displayName]}}));
 const clubs=new Map(),competitions=[];
 const describe=mark=>{
  if(!mark)return null;
  const urls=[...new Set([mark.url,...Object.values(mark.logo||{}).filter(value=>typeof value==='string'&&!['light','dark'].includes(value))].filter(Boolean))];
  const assets=urls.map(url=>{
   if(/^(?:https?:|data:)/i.test(url))return{url,local:false,availabilityChecked:false};
   const name=url.replace(/^\//,'').split('?')[0],local=path.resolve(root,name);
   if(!local.startsWith(root+path.sep))throw Error('Asset path escapes repository');
   const exists=fs.existsSync(local);
   return{url,local:true,exists,...(exists?{sha256:digest(fs.readFileSync(local))}:{})};
  });
  return{id:mark.id,label:mark.label,kind:mark.kind||'image',sourceUrl:mark.sourceUrl||null,assetSourceUrl:mark.assetSourceUrl||mark.assetSource||null,assetClass:mark.assetClass||null,rightsStatus:mark.rightsStatus||null,provenance:mark.provenance||null,displayUse:mark.displayUse||null,glyph:mark.glyph||null,assets,commercialPermission:mark.assetClass==='open-use'?'library-notice-present-separate-scope':'unverified',permissionMeaning:'A source URL or official-reference label is not an NS-specific licence. Open-use glyph library notices are separate from protected badges.'};
 };
 for(const competitionId of pilotIds){
  const events=fixtures.filter(event=>event.competitionId===competitionId),members=new Set();
  for(const event of events){
   const sides=identity.matchupSidesForEvent(event,participants,event.name);
   for(const side of sides){
    const id=side.participant?.id;if(!id)throw Error('Known pilot participant lost by the actual matchup resolver');
    members.add(id);
    const row=clubs.get(id)||{id,name:side.label,competitions:[],fixtureAppearances:0,mark:describe(side.mark)};
    if(!row.competitions.includes(competitionId))row.competitions.push(competitionId);
    row.fixtureAppearances++;clubs.set(id,row);
   }
  }
  const records=[...members].map(id=>clubs.get(id));
  competitions.push({competitionId,fixtures:events.length,clubs:members.size,clubsWithCrest:records.filter(row=>row.mark?.assets.length).length,clubsWithoutCrest:records.filter(row=>!row.mark?.assets.length).length,eventMark:describe(identity.markForEvent(events[0])),scope:'Published pilot projection; current registry/directory resolution, not authenticated image loading or legal clearance.'});
 }
 const rows=[...clubs.values()].sort((a,b)=>a.id.localeCompare(b.id)),sourceHosts={};
 for(const row of rows){const source=row.mark?.assetSourceUrl||row.mark?.assets[0]?.url;if(source){const host=new URL(source,'https://nothingsport.vercel.app').hostname;sourceHosts[host]=(sourceHosts[host]||0)+1;}}
 const runtimeSha=execFileSync('git',['log','-1','--format=%H','--','service-worker.js'],{cwd:root,encoding:'utf8'}).trim();
 return{schemaVersion:'football-assets-audit.v1',checkedAt:new Date().toISOString(),runtimeSha,shell:JSON.parse(fs.readFileSync(path.join(root,'app-version.json'))).version,input:{file,sha256:digest(bytes),registrySha256:digest(fs.readFileSync(path.join(root,'config/card-identities.js')))},summary:{fixtures:fixtures.length,uniqueClubs:rows.length,clubsWithCrest:rows.filter(row=>row.mark?.assets.length).length,clubsWithoutCrest:rows.filter(row=>!row.mark?.assets.length).length,sourceHosts,commercialPermissionsVerified:0},competitions,clubs:rows,limitations:['No source requests or asset downloads; remote availability not checked.','No protected-mark permission can be inferred from provenance or the fixture-data licence.','Library licences and individual protected marks require separate evidence.','One current static resolution, not every authenticated runtime path or future catalogue club.']};
}
if(require.main===module){const output=process.argv[2];if(!output)throw Error('Provide the generated report path under your output folder');const report=inventory();fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,...report.summary,competitions:report.competitions.map(({competitionId,fixtures,clubs,clubsWithCrest,clubsWithoutCrest})=>({competitionId,fixtures,clubs,clubsWithCrest,clubsWithoutCrest}))},null,2));}
module.exports={inventory};
