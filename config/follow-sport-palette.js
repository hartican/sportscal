(function(root,factory){const api=factory();root.NOTHINGSPORTS_SPORT_PALETTE=api;if(typeof module==='object')module.exports=api;})(globalThis,function(){
  'use strict';
  const aliases={'sport:aflw':'sport:afl','sport:nrlw':'sport:nrl','sport:nbl':'sport:nba','sport:fiba-women':'sport:nba'};
  const parent=id=>aliases[id]||String(id||'').replace(/-women$/,'');
  const labels={'sport:afl':'Australian Rules','sport:nrl':'Rugby League','sport:nba':'Basketball','sport:sailgp':'Sailing'};
  function palette(entities){
    const groups=new Map();
    for(const e of entities){if(Number(e.level)!==2&&!['sport:aflw','sport:nrlw'].includes(e.id))continue;if(e.id==='sport:multi-sport')continue;
      const key=parent(e.id),entry=groups.get(key)||{...(entities.find(x=>x.id===key)||e),id:key,label:labels[key]||(entities.find(x=>x.id===key)?.label||e.label).replace(/ Women$/,''),paletteMemberIds:[]};
      entry.paletteMemberIds.push(e.id);groups.set(key,entry);
    }
    return [...groups.values()].sort((a,b)=>Number(a.editorialOrder||999)-Number(b.editorialOrder||999)||a.label.localeCompare(b.label));
  }
  function genderEntity(root,gender,byId){
    if(gender!=='women')return root;
    return byId[{'sport:afl':'sport:aflw','sport:nrl':'sport:nrlw'}[root.id]||root.id+'-women']||root;
  }
  function genders(root,byId){
    if(root.id==='sport:netball')return [['women','Women']];
    if(['sport:horse-racing','sport:motorsport','sport:sailgp'].includes(root.id))return [['open','Open']];
    return genderEntity(root,'women',byId)!==root?[['all','All supported'],['men','Men'],['women','Women']]:[['all','All supported'],['men','Men']];
  }
  function categories(root,gender,byId){
    const selected=genderEntity(root,gender,byId),ids=[...(selected.childIds||[])];
    if(root.id==='sport:nba')ids.push(...(gender==='women'?['sport:fiba-women']:gender==='men'?['sport:nbl']:['sport:nbl','sport:fiba-women']));
    return [...new Set(ids)].map(id=>byId[id]).filter(Boolean).filter(e=>gender==='all'||gender==='open'||(/-women$/.test(e.id)||['sport:aflw','sport:nrlw'].includes(e.id))===(gender==='women'));
  }
  return {parent,palette,genderEntity,genders,categories};
});
