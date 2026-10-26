'use strict';
// Existing privileged reader contract, not a grant to call it. POST is a read
// RPC here; a generic HTTP method allowance would be the wrong boundary.
const SOURCES=['cricket-ca-current','cricket-ca-4710','discovery-cricket-history','discovery-cricket-near',...['mru','wru','mrs','wrs'].flatMap(s=>[`discovery-rugby-${s}`,`discovery-rugby-${s}-near`])];
const PAGE_SIZE=500,MAX_PAGES=8,RPC='/rest/v1/rpc/nothingsports_read_current_fixtures';
function requestForPage(page){
 if(!Number.isInteger(page)||page<0||page>=MAX_PAGES)throw Error('PUBLIC_COVERAGE_PAGE_BUDGET');
 return {path:RPC+`?source_id=in.(${SOURCES.join(',')})&order=source_id.asc,fixture_id.asc&limit=${PAGE_SIZE}&offset=${page*PAGE_SIZE}`,method:'POST',body:{p_fixture_ids:null},timeoutMs:10000};
}
function manifest(){return {schemaVersion:'live-coverage-read-contract.v1',rpc:RPC,method:'POST',body:{p_fixture_ids:null},sources:[...SOURCES],order:'source_id.asc,fixture_id.asc',pageSize:PAGE_SIZE,maxPages:MAX_PAGES,timeoutMs:10000,retries:0,columns:['source_id','fixture_id','fixture','identity_keys'],consistency:'per-statement; paged read is not an atomic snapshot',authority:'existing service-only reader; no new credential or live grant',producerBasis:'supabase/migrations/20261002171936_preserve_compact_fixture_observations.sql'};}
module.exports={SOURCES,PAGE_SIZE,MAX_PAGES,RPC,requestForPage,manifest};
