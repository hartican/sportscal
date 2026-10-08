(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_PARTICIPANT_DIRECTORY=api;})(globalThis,function(){
 'use strict';
 const nameCompare=new Intl.Collator('en-AU',{sensitivity:'base'}).compare;
 const positive=value=>value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
 const sport=p=>p.sportKey||String(p.sportDomainId||p.id||'').split(':')[1]||'';
 const labels={tennis:'Tennis','tennis-women':'Tennis',football:'Football',afl:'AFL',aflw:'AFLW',nrl:'NRL',nrlw:'NRLW',rugby:'Rugby Union','rugby-union':'Rugby Union',nba:'Basketball',nbl:'NBL','american-football':'NFL','ice-hockey':'Ice Hockey',golf:'Golf',f1:'Formula 1',wrc:'WRC',motogp:'MotoGP',motorsport:'Motorsport'};
 const sportLabel=p=>labels[sport(p)]||sport(p).replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
 function competition(p){if(sport(p).startsWith('tennis'))return /:wta:/.test(p.id)||p.genderCategory==='female'||p.tour==='WTA'?'WTA':'ATP';return p.standingGroup||p.tour||p.leagueName||p.competitionName||String(p.leagueId||p.competitionId||'').replace(/^competition:/,'').replaceAll('-',' ')||p.rankingBasis||((sport(p).startsWith('tennis'))?(p.genderCategory==='female'||/:wta:/.test(p.id)?'WTA':'ATP'):'');}
 const group=p=>[sportLabel(p),competition(p)].filter(Boolean).join(' · ');
 const standing=p=>positive(p.ranking??p.rank??p.ladderPosition);
 function rank(p,records=[]){return standing(p)??positive(p.currentTeamRank)??positive(records.find(r=>r.id===p.currentTeamId)?.ladderPosition);}
 function compare(a,b,records=[]){return nameCompare(group(a),group(b))||(a.currentTeamId&&b.currentTeamId&&!positive(a.ranking??a.rank)&&!positive(b.ranking??b.rank)?(rank(a,records)??Infinity)-(rank(b,records)??Infinity)||String(a.currentTeamId).localeCompare(String(b.currentTeamId)):0)||(rank(a,records)??Infinity)-(rank(b,records)??Infinity)||nameCompare(String(a.displayName||a.name||''),String(b.displayName||b.name||''))||String(a.id).localeCompare(String(b.id));}
 function unpack(document){if(document?.schemaVersion!=='participant-search.v1'||!Array.isArray(document.records)||!Array.isArray(document.fields))throw Error('Invalid participant search index');return document.records.map(row=>Object.fromEntries(document.fields.map((key,i)=>[key,row[i]])));}
 return {positive,sport,sportLabel,competition,group,standing,rank,compare,unpack};
});
