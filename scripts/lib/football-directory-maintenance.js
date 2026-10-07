'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const LEAGUES={'premier-league':'eng.1',bundesliga:'ger.1','la-liga':'esp.1','serie-a':'ita.1','ligue-1':'fra.1'};
const DAY=86400000,REFRESH_AFTER=30*DAY;
async function refreshDue({root=path.resolve(__dirname,'../..'),now=new Date(),offline=false,fetchImpl=fetch}={}){
  const file=path.join(root,'data/canonical/football-directory.v1.json'),directory=JSON.parse(fs.readFileSync(file,'utf8'));
  const age=+now-Date.parse(directory.generatedAt);
  if(!Number.isFinite(age)||age<0)throw Error('Invalid football directory observation date');
  if(age<REFRESH_AFTER)return {changed:false,state:'current',requests:0};
  if(offline)return {changed:false,state:'offline-retained',requests:0};
  const deadline=AbortSignal.timeout(300000),receipts=[],deferred=[],absent=[],jobs=[],next=structuredClone(directory);
  async function read(url){
    const response=await fetchImpl(url,{signal:AbortSignal.any([deadline,AbortSignal.timeout(15000)]),redirect:'error'});
    if(!response.ok)throw Error(`Football directory source returned ${response.status}: ${url}`);
    const body=await response.text(),payload=JSON.parse(body),receipt={url,checkedAt:new Date().toISOString(),sha256:crypto.createHash('sha256').update(body).digest('hex')};
    receipts.push(receipt);return {payload,receipt};
  }
  const setSource=source=>{const i=next.sources.findIndex(s=>s.id===source.id);if(i<0)next.sources.push(source);else next.sources[i]=source;};
  // All five complete club sets are required before publishing the directory.
  for(const league of next.leagues){
    const code=LEAGUES[league.key];if(!code)throw Error('Unapproved football directory league');
    const url=`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/teams?limit=100`,{payload,receipt}=await read(url);
    const teams=payload.sports?.[0]?.leagues?.[0]?.teams?.map(row=>row.team)||[],retained=next.teams.filter(t=>t.leagueId===league.id);
    if(teams.length!==league.teamCount||new Set(teams.map(t=>String(t.id))).size!==teams.length||retained.some(t=>!teams.some(raw=>String(raw.id)===t.externalIds.espn)))throw Error(`${league.displayName} club identities changed; retained directory requires review`);
    const sourceId=`source:football:${league.key}:clubs-current`;
    setSource({id:sourceId,provider:'ESPN public club list',url,sourceType:'reputable',checkedAt:receipt.checkedAt});
    league.sourceRefs=[...new Set([...league.sourceRefs,sourceId])];
    for(const team of retained){team.sourceRefs=[...new Set([...team.sourceRefs,sourceId])];jobs.push({team,code});}
  }
  let cursor=0;
  await Promise.all(Array.from({length:6},async()=>{
    while(cursor<jobs.length){
      const {team,code}=jobs[cursor++],players=next.players.filter(p=>p.currentTeamId===team.id);
      try{
        const url=`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/teams/${team.externalIds.espn}/roster`,{payload:roster,receipt}=await read(url);
        if(!Array.isArray(roster.athletes)||!roster.athletes.length||new Set(roster.athletes.map(a=>String(a.id))).size!==roster.athletes.length)throw Error('Incomplete roster');
        const ids=new Set(roster.athletes.map(a=>String(a.id))),sourceId=`source:football:roster:${team.externalIds.espn}`;
        setSource({id:sourceId,provider:'ESPN public club roster',url,sourceType:'reputable',checkedAt:receipt.checkedAt});
        for(const player of players){
          if(ids.has(player.externalIds.espn)){
            player.rosterCheckedAt=receipt.checkedAt;player.rosterStatus='listed';delete player.currentTeamStatus;
            player.sourceRefs=[...new Set([...player.sourceRefs.filter(id=>!id.endsWith(':bootstrap')),sourceId])];
          }else{
            // Absence cannot establish a new club, nationality or match appearance.
            player.rosterStatus='unconfirmed';player.currentTeamStatus='last-known';player.rosterAttemptedAt=receipt.checkedAt;player.rosterCheckedAt=player.rosterCheckedAt||directory.generatedAt;
            absent.push(player.id);
          }
        }
      }catch(error){deferred.push({teamId:team.id,message:error.message});}
    }
  }));
  next.generatedAt=receipts.map(r=>r.checkedAt).sort().at(-1);
  next.refreshEvidence={kind:'complete-club-check-with-independent-rosters',checkedAt:next.generatedAt,teams:jobs.length,players:directory.players.length,absent:absent.sort(),deferred:deferred.sort((a,b)=>a.teamId.localeCompare(b.teamId)),receipts:receipts.sort((a,b)=>a.url.localeCompare(b.url))};
  const indexFile=path.join(root,'data/canonical/football-follow-index.v1.json'),index={...JSON.parse(fs.readFileSync(indexFile,'utf8')),generatedAt:next.generatedAt};
  const outputs=[[file,JSON.stringify(next,null,2)+'\n'],[file.replace(/\.json$/,'.js'),'globalThis.NOTHINGSPORTS_FOOTBALL_DIRECTORY_DATA = '+JSON.stringify(next)+';\n'],[indexFile,JSON.stringify(index,null,2)+'\n'],[indexFile.replace(/\.json$/,'.js'),'globalThis.NOTHINGSPORTS_FOOTBALL_FOLLOW_INDEX = '+JSON.stringify(index)+';\n']];
  const previous=outputs.map(([name])=>[name,fs.readFileSync(name)]);
  try{for(const [name,body] of outputs){const tmp=name+'.candidate-'+process.pid;fs.writeFileSync(tmp,body);fs.renameSync(tmp,name);}}
  catch(error){for(const [name,body] of previous)fs.writeFileSync(name,body);throw error;}
  return {changed:true,state:deferred.length?'verified-clubs-roster-gaps':'verified',requests:jobs.length+next.leagues.length,checkedAt:next.generatedAt,teams:jobs.length,players:directory.players.length,absent:absent.length,deferred};
}
module.exports={refreshDue,REFRESH_AFTER};
