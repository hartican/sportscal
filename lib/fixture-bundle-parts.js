'use strict';
const crypto=require('node:crypto');
const signature=body=>JSON.stringify([body.p_sport_keys,body.p_known_sport_keys,body.p_participant_ids,body.p_required_ids]);
const rowPart=row=>crypto.createHash('md5').update(row.source_id+'\x1f'+row.fixture_id).digest()[0]%2;
async function readBundleParts(request,{scope,sportKeys=[],knownSportKeys=[],participantIds=[],requiredIds=[]}){
 const body={p_scope:scope,p_sport_keys:sportKeys,p_known_sport_keys:knownSportKeys,p_participant_ids:participantIds,p_required_ids:requiredIds};
 const parts=[];
 // Reuse the existing two request slots, each with its unchanged deadline.
 // Read sequentially so two large projections do not compete for free compute.
 for(let part=0;part<2;part++){
  const value=await request('nothingsports_read_fixture_bundle_part',{...body,p_part:part},'fixture-part-'+part);
  if(value?.schemaVersion!=='fixture-bundle-part.v1'||value.scope!==scope||value.part!==part||value.complete!==true||
   !Number.isInteger(value.rowCount)||value.rowCount<0||value.rowCount>5000||!Array.isArray(value.rows)||value.rows.length>value.rowCount||
   !/^[a-f0-9]{32}$/.test(value.snapshotVersion||'')||
   JSON.stringify([value.sportKeys,value.knownSportKeys,value.participantIds,value.requiredIds])!==signature(body)||
   (part===0?!Array.isArray(value.manifest):value.manifest!==null))throw Error('Incomplete fixture bundle part');
  if(parts[0]&&(value.snapshotVersion!==parts[0].snapshotVersion||value.rowCount!==parts[0].rowCount))throw Error('Fixture bundle changed between parts');
  parts.push(value);
 }
 const manifest=parts[0].manifest;
 if(manifest.some(row=>!row||typeof row.source_id!=='string'||!row.source_id))throw Error('Invalid fixture source manifest');
 const rows=parts.flatMap(part=>part.rows),seen=new Set(),sources=new Set(manifest.map(row=>row.source_id));
 if(sources.size!==manifest.length)throw Error('Repeated fixture source manifest');
 if(rows.length!==parts[0].rowCount)throw Error('Missing fixture bundle rows');
 for(const row of rows){
  if(typeof row?.source_id!=='string'||typeof row.fixture_id!=='string'||!row.fixture||!Array.isArray(row.identity_keys)||!sources.has(row.source_id))throw Error('Invalid fixture bundle row');
  const key=JSON.stringify([row.source_id,row.fixture_id]);if(seen.has(key))throw Error('Repeated fixture bundle row');seen.add(key);
 }
 for(const part of parts)if(part.rows.some(row=>rowPart(row)!==part.part))throw Error('Wrong fixture bundle partition');
 rows.sort((a,b)=>Buffer.compare(Buffer.from(a.source_id),Buffer.from(b.source_id))||Buffer.compare(Buffer.from(a.fixture_id),Buffer.from(b.fixture_id)));
 return {schemaVersion:'current-fixture-bundle.v1',scope,sportKeys,knownSportKeys,participantIds,requiredIds,complete:true,rows,manifest:parts[0].manifest};
}
module.exports={readBundleParts,rowPart};
