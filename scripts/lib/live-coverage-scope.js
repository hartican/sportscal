'use strict';
// This is a finite saved-observation scope, not a provider/endpoint override.
const CRICKET_SOURCES=Object.freeze(['cricket-ca-current','cricket-ca-4710','discovery-cricket-history','discovery-cricket-near']);
const RUGBY_SOURCES=Object.freeze(['mru','wru','mrs','wrs'].flatMap(s=>[`discovery-rugby-${s}`,`discovery-rugby-${s}-near`]));
const SOURCES=Object.freeze([...CRICKET_SOURCES,...RUGBY_SOURCES]);
function sourcesFor(coverageSport){
 if(coverageSport==null)return SOURCES;
 if(coverageSport!=='rugby-union')throw Error('Unsupported shared coverage sport');
 return RUGBY_SOURCES;
}
function validateOptions({source,offline=false,coverageSport}={}){
 sourcesFor(coverageSport);
 if(coverageSport!=null&&(source!=='live-coverage'||offline)||source==='live-coverage'&&offline)throw Error('Shared coverage scope requires live-coverage without offline mode');
}
function parseArgs(argv,{child=false}={}){
 const selected=argv.filter(arg=>/^--coverage-(?:sport|code)(?:=|$)/.test(arg));
 if(!selected.length&&!argv.includes('--source=live-coverage'))return null;
 const allowed=new Set(['--source=live-coverage','--coverage-sport=rugby-union',...(!child?['--quick','--local-only','-p']:[])]);
 if(!argv.includes('--source=live-coverage')||!child&&(!argv.includes('--quick')||!argv.includes('--local-only'))||selected.length>1||new Set(argv).size!==argv.length||argv.some(arg=>!allowed.has(arg)))throw Error('Shared coverage requires only --quick --source=live-coverage --local-only and optional --coverage-sport=rugby-union/-p. No source steps ran.');
 return selected.length?'rugby-union':null;
}
function reportFor(coverageSport){
 if(coverageSport==null)return {};
 return {coverageSport,requestedSourceIds:[...sourcesFor(coverageSport)],deferredSources:CRICKET_SOURCES.map(sourceId=>({sourceId,reason:'Cricket contract review; retained last-good observations; not read in this scope'}))};
}
// Only the selected sport may change. A scoped publication cannot admit cards,
// drop retained IDs or use an identity collision to rewrite another sport.
function retainOutsideScope(before,after,coverageSport,codeFor){
 sourcesFor(coverageSport);
 const byId=new Map();
 for(const event of after){if(byId.has(event.id))throw Error('Duplicate scoped coverage identity');byId.set(event.id,event);}
 const ids=new Set(before.map(event=>event.id));
 if(after.some(event=>!ids.has(event.id)&&codeFor(event)===coverageSport))throw Error('Scoped coverage cannot admit a new Feed card');
 return before.map(event=>{
  if(codeFor(event)!==coverageSport)return event;
  const next=byId.get(event.id);
  if(!next||codeFor(next)!==coverageSport)throw Error('Scoped coverage cannot replace retained fixture identity');
  return next;
 });
}
module.exports={SOURCES,CRICKET_SOURCES,RUGBY_SOURCES,sourcesFor,validateOptions,parseArgs,reportFor,retainOutsideScope};
