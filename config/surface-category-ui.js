'use strict';
function buildSurfaceCategoryChooser(surface,events,onChange){
  const keys=[...new Set(events.map(NOTHINGSPORTS_SURFACE_CATEGORY.category))].sort();
  const current=userPreferences.surfaceCategories?.[surface],selected=keys.includes(current)?current:keys[0];
  const select=document.createElement('select');select.setAttribute('aria-label','Sport category');
  for(const key of keys){const option=document.createElement('option');option.value=key;option.textContent=NOTHINGSPORTS_SURFACE_CATEGORY.label(key);select.append(option);}select.value=selected||'';
  select.onchange=()=>{const next=clonePreferences(userPreferences);next.surfaceCategories={...next.surfaceCategories,[surface]:select.value};savePreferences(next,{viewOnly:true});onChange();};
  return {select,selected};
}

function chooseStandingsCategory(competitions,container,options){
 const records=competitions.map(c=>({...c,competitionId:c.id,key:standingsSportKey(c)}));
 const surface=options.sectionLabel==='Tennis rankings'?'tennis-rankings':'standings';
 const choice=buildSurfaceCategoryChooser(surface,records,()=>renderStandingsContext(options));container.append(choice.select);
 return competitions.filter((c,i)=>NOTHINGSPORTS_SURFACE_CATEGORY.category(records[i])===choice.selected);
}
