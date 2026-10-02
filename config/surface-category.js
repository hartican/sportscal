(function(root,factory){const api=factory();root.NOTHINGSPORTS_SURFACE_CATEGORY=api;if(typeof module==='object')module.exports=api;})(globalThis,function(){
'use strict';
const labels=()=>globalThis.NOTHINGSPORTS_FIXTURE_LABELS||(typeof require==='function'?require('./fixture-labels'):null);
const policy=()=>globalThis.NOTHINGSPORTS_FOLLOW_FEED_POLICY||(typeof require==='function'?require('./follow-feed-policy'):null);
const category=e=>policy().sportKey(e);
const female=key=>['aflw','nrlw','wnba','fiba-women','netball'].includes(key)||key.endsWith('-women');
function matches(e,key){if(!key||key==='all')return true;const base=key.replace(/^sport:/,'');return category(e)===base;}
function genderMatches(e,key){const femaleChoice=female(String(key||'').replace(/^sport:/,''));return labels().gender(e)==='women'?femaleChoice:!femaleChoice;}
function label(key){const base=String(key).replace(/-women$/,'');const names={tdf:'Tour de France',giro:'Giro d’Italia',vuelta:'La Vuelta',rugby:'Rugby Union',cricket:'Cricket',tennis:'Tennis',golf:'Golf',f1:'Formula 1',nrl:'NRL',nrlw:'NRLW',afl:'AFL',aflw:'AFLW',football:'Football'};return (names[base]||base.toUpperCase())+(key.endsWith('-women')?' Women':base==='tennis'?' Men':'');}
return {category,matches,genderMatches,label};
});
