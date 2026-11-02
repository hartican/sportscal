#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const SEARCH=path.join(ROOT,'data/follow-directory/search.v1.json');
const IDS=['football-qatar-australia-2026-11-14','football-jordan-australia-2026-11-18'];

function invoke(args){
  return spawnSync(process.execPath,args,{cwd:ROOT,env:process.env,encoding:'utf8'});
}

function focused(){
  const baseline=fs.readFileSync(SEARCH);
  const index=JSON.parse(baseline);
  const idColumn=index.fields.indexOf('id'),nameColumn=index.fields.indexOf('displayName');
  assert(idColumn>=0&&nameColumn>=0,'Search identity columns must be present');
  const targets=['team:football:qatar','team:football:jordan'];
  for(const [i,id] of targets.entries()){
    const rows=index.records.filter(row=>row[idColumn]===id);
    assert.equal(rows.length,1,'Exactly one reviewed opponent must be searchable: '+id);
    assert.equal(rows[0][nameColumn],i===0?'Qatar':'Jordan');
  }
  try{
    for(const id of targets){
      const stale={...index,records:index.records.filter(row=>row[idColumn]!==id)};
      const bytes=Buffer.from(JSON.stringify(stale)+'\n');
      fs.writeFileSync(SEARCH,bytes);
      const refused=invoke(['scripts/build-follow-directories.js','--search-only','--check']);
      assert.notEqual(refused.status,0,'A missing fixture-derived search identity must fail freshness');
      assert.match(refused.stderr,/data\/follow-directory\/search\.v1\.json is stale/);
      assert.deepEqual(fs.readFileSync(SEARCH),bytes,'Check mode must not repair or write');
      const repaired=invoke(['scripts/update-cards.js','--reviewed-fixtures','--admit-reviewed-fixtures','--repair-reviewed-identities','--ids='+IDS.join(','),'--local-only']);
      assert.equal(repaired.status,0,repaired.stderr||repaired.stdout);
      assert.match(repaired.stdout,/participant search closure checked without rebuilding sporting data/);
      assert.doesNotMatch(repaired.stdout,/scripts\/(?:publish-feed|build-code-inspector|redeploy-and-release)/);
      assert.deepEqual(fs.readFileSync(SEARCH),baseline,'Canonical no-op admission must restore the exact index, peers and clock');
    }
    const repeated=invoke(['scripts/build-follow-directories.js','--search-only']);
    assert.equal(repeated.status,0,repeated.stderr);
    assert.deepEqual(fs.readFileSync(SEARCH),baseline,'Repeated search projection must be byte-identical');
    const checked=invoke(['scripts/build-follow-directories.js','--check']);
    assert.equal(checked.status,0,checked.stderr||checked.stdout);
    assert.deepEqual(fs.readFileSync(SEARCH),baseline,'Full original directory freshness gate must remain read-only');
  }finally{
    fs.writeFileSync(SEARCH,baseline);
  }
  console.log('Reviewed search closure: Qatar/Jordan uniqueness, stale check refusal/no writes, actual canonical already-admitted repair, exact peer/clock retention, repeated bytes and full original directory check passed; no sporting source or account requests.');
}

if(require.main===module)focused();
module.exports={focused};
