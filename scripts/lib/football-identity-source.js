'use strict';

// Pack repeated prefixes on the wire, not identity facts. Nonstandard sources
// remain literal values so a future official crest does not borrow an ESPN URL.
function footballIdentitySource(teams){
  const prefixes={0:'team:football:',2:'https://a.espncdn.com/i/teamlogos/soccer/500/',3:'https://www.espn.com/soccer/club/_/id/'};
  const rows=teams.map(t=>[t.id,t.displayName,t.crestUrl,t.crestSourceUrl,t.aliases]);
  const packed=rows.map(row=>row.map((value,index)=>{
    const prefix=prefixes[index];
    return prefix?(typeof value==='string'&&value.startsWith(prefix)?value.slice(prefix.length):[value]):value;
  }));
  const expression=JSON.stringify(packed)+'.map(([id,label,url,source,aliases])=>[typeof id==="string"?"team:football:"+id:id[0],label,typeof url==="string"?"https://a.espncdn.com/i/teamlogos/soccer/500/"+url:url[0],typeof source==="string"?"https://www.espn.com/soccer/club/_/id/"+source:source[0],aliases])';
  return '/* football-club-identities:start */\n  const footballClubIdentities = '+expression+';\n  /* football-club-identities:end */';
}

module.exports={footballIdentitySource};
