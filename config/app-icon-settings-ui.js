(function(root){
'use strict';
const policy=root.NOTHINGSPORTS_APP_ICONS;
const lockedCopy='Unlock icon choices with 100 NothingScore points.';
let cached=null,pending=null;
function scope(){const s=serverSyncClient.accountSnapshot();return s.hasSession&&s.accountId?`${s.accountId}:${s.generation}`:'';}
function selected(){try{return policy.normalize(JSON.parse(localStorage.getItem(policy.KEY)));}catch{return policy.DEFAULT;}}
async function privilege(force=false){
 const owner=scope();if(!owner)return policy.capability(0);
 if(!force&&cached?.owner===owner&&Date.now()-cached.at<30000)return cached.value;
 if(!force&&pending?.owner===owner)return pending.promise;
 const request={owner,promise:null};pending=request;
 request.promise=serverSyncClient.nothingscoreRequest({icon:true}).then(value=>{
  if(scope()!==owner)return policy.capability(0);
  const valid={canChooseIcon:value?.canChooseIcon===true,minimumPoints:100};cached={owner,value:valid,at:Date.now()};return valid;
 }).finally(()=>{if(pending===request)pending=null;});
 return request.promise;
}
function injectStyle(){
 if(document.getElementById('appIconChoiceStyle'))return;
 const style=document.createElement('style');style.id='appIconChoiceStyle';
 style.textContent='.icon-choice-tooltip[hidden]{display:none!important}.icon-choice-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:10px;margin-top:14px}.icon-choice{display:grid;justify-items:center;gap:6px;padding:10px;border:2px solid var(--border);border-radius:14px;background:var(--bg-card);color:var(--text);cursor:pointer}.icon-choice[aria-pressed="true"]{border-color:var(--accent)}.icon-choice img{width:72px;height:72px;object-fit:contain}.app-icon-action[aria-disabled="true"]{filter:grayscale(1);opacity:.52;cursor:not-allowed}.app-icon-action img{width:36px;height:36px}.icon-choice-tip{position:relative}.icon-choice-tooltip{display:none;position:absolute;z-index:5;bottom:100%;left:0;max-width:300px;padding:10px;border-radius:9px;background:var(--text);color:var(--bg);font-size:13px}.icon-choice-tip:hover .icon-choice-tooltip,.icon-choice-tip:focus-within .icon-choice-tooltip,.icon-choice-tip[data-explain="true"] .icon-choice-tooltip{display:block}';
 document.head.append(style);
}
function action(container,onOpen){
 injectStyle();const wrap=document.createElement('div');wrap.className='icon-choice-tip';
 const tip=document.createElement('span');tip.className='icon-choice-tooltip';tip.id=`iconChoiceTip-${document.querySelectorAll('.icon-choice-tip').length}`;tip.role='tooltip';tip.textContent=lockedCopy;
 const button=document.createElement('button');button.type='button';button.className='settings-menu-item app-icon-action';button.setAttribute('aria-disabled','true');button.setAttribute('aria-describedby',tip.id);button.title=lockedCopy;
 const img=document.createElement('img');img.alt='';img.src=`/icons/brand/${selected()}-192.png`;img.dataset.brandAsset='icon';
 const copy=document.createElement('span');copy.className='settings-menu-copy';const title=document.createElement('strong');title.textContent='App icon';const detail=document.createElement('span');detail.textContent='Checking points…';copy.append(title,detail);
 const lock=document.createElement('span');lock.setAttribute('aria-hidden','true');lock.textContent='🔒';button.append(img,copy,lock);wrap.append(button,tip);container.append(wrap);
 let allowed=false;
 const refresh=async()=>{try{const c=await privilege();if(!wrap.isConnected)return;allowed=c.canChooseIcon;button.setAttribute('aria-disabled',String(!allowed));lock.textContent=allowed?'›':'🔒';detail.textContent=allowed?policy.VARIANTS.find(v=>v.id===selected()).label:lockedCopy;tip.hidden=allowed;button.title=allowed?'Choose an app icon':lockedCopy;}catch{allowed=false;detail.textContent='Points unavailable. Try again.';}};
 button.addEventListener('click',async()=>{try{allowed=(await privilege(true)).canChooseIcon;}catch{allowed=false;}button.setAttribute('aria-disabled',String(!allowed));if(!allowed){wrap.dataset.explain=wrap.dataset.explain==='true'?'false':'true';void refresh();return;}onOpen();});
 void refresh();return {button,wrap};
}
function menu(body){const parent=body.querySelector('.settings-menu');if(!parent)return;const control=action(parent,()=>navigateSettingsSection('appearance'));const appearance=parent.querySelector('[data-settings-section="appearance"]');appearance?.after(control.wrap);}
function appearance(stack){
 injectStyle();const section=document.createElement('section');section.className='filter-panel';const heading=document.createElement('h3');heading.textContent='App icon';section.append(heading);stack.append(section);
 const status=document.createElement('p');status.className='preference-help';status.role='status';status.textContent='Checking points…';section.append(status);
 const grid=document.createElement('div');grid.className='icon-choice-grid';section.append(grid);
 const owner=scope();
 const build=async()=>{
  let c;try{c=await privilege();}catch{status.textContent='Points unavailable. Reopen Appearance to try again.';return;}
  if(!section.isConnected||scope()!==owner)return;
  if(!c.canChooseIcon){status.textContent=lockedCopy;action(section,build);return;}
  status.textContent='Choose an icon for this device.';
  for(const v of policy.VARIANTS){
   const button=document.createElement('button');button.type='button';button.className='icon-choice';button.dataset.iconChoice=v.id;button.setAttribute('aria-pressed',String(selected()===v.id));
   const img=document.createElement('img');img.src=`/icons/brand/${v.id}-192.png`;img.alt='';img.width=72;img.height=72;const label=document.createElement('span');label.textContent=v.label;button.append(img,label);grid.append(button);
   button.addEventListener('click',async()=>{
    if(grid.dataset.saving==='true')return;grid.dataset.saving='true';status.textContent='Checking points…';
    try{
     const fresh=await privilege(true);if(!section.isConnected||scope()!==owner)return;
     if(!fresh.canChooseIcon){grid.replaceChildren();status.textContent=lockedCopy;return;}
     localStorage.setItem(policy.KEY,JSON.stringify(v.id));applyThemePreference(draftPreferences?.theme||userPreferences.theme);
     grid.querySelectorAll('[data-icon-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.iconChoice===v.id)));
     status.textContent=`${v.label} selected.`;
    }catch{status.textContent='Icon could not be changed. Try again.';}finally{grid.dataset.saving='false';}
   });
  }
 };
 void build();
}
root.NOTHINGSPORTS_APP_ICON_SETTINGS=Object.freeze({menu,appearance});
})(globalThis);
