(function attachMarqueeLiveRenderer(root,factory){
  const api=factory();root.NOTHINGSPORTS_MARQUEE_LIVE_RENDERER=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:window,function buildMarqueeLiveRenderer(){
  "use strict";
  const esc=value=>String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const safeUrl=value=>{const raw=String(value||"").trim();return /^(?:https:\/\/|\/(?!\/))/i.test(raw)?raw:""};
  function model(candidate={},presentation={}){
    const material=candidate.material||{},draft=candidate.drafts||{},fallback=candidate.assets?.fallbackHero||draft.email?.image||draft.instagram?.image||{},hero=presentation.hero?.publicUrl||presentation.hero?.path?presentation.hero:fallback,identities=presentation.identities||candidate.identities||{},logos=presentation.logos||{};
    return {headline:presentation.headline||draft.email?.headline||material.recognisableTitle||material.title||"Live fixture",hook:presentation.hook||draft.hook||"A fixture worth making time for.",kicker:presentation.kicker||`5/5 stakes · ${material.sport||"Sport"}`,hero,identities,logos:{showCode:logos.showCode!==false,showTeams:logos.showTeams!==false,order:logos.order==="teams-first"?"teams-first":"code-first"},focalPosition:{x:Number(presentation.focalPosition?.x??50),y:Number(presentation.focalPosition?.y??50)},animationPreset:["none","subtle","energy"].includes(presentation.animationPreset)?presentation.animationPreset:"subtle"};
  }
  function marks(value){
    const code=value.logos.showCode&&value.identities.code?[value.identities.code]:[],teams=value.logos.showTeams&&Array.isArray(value.identities.teams)?value.identities.teams:[],items=value.logos.order==="teams-first"?[...teams,...code]:[...code,...teams];
    return items.map(item=>{const url=safeUrl(item.publicUrl||item.path);return url?`<span class="ns-live-mark"><img src="${esc(url)}" alt=""><span>${esc(item.label||"")}</span></span>`:""}).join("");
  }
  function markup(candidate,presentation={}){
    const value=model(candidate,presentation),hero=safeUrl(value.hero?.publicUrl||value.hero?.path),editorialHero=hero&&!value.hero?.firstPartyAssetsOnly,position=`${Math.max(0,Math.min(100,value.focalPosition.x))}% ${Math.max(0,Math.min(100,value.focalPosition.y))}%`;
    return `<article class="ns-live-asset motion-${esc(value.animationPreset)}"><div class="ns-live-hero">${editorialHero?`<img src="${esc(hero)}" alt="${esc(value.hero.altText||"")}" style="object-position:${esc(position)}">`:'<div class="ns-live-fallback"><img src="/assets/brand/web/nothingsport-logo.png" alt="nothing SPORT"></div>'}<div class="ns-live-shade"></div><div class="ns-live-copy"><div class="ns-live-marks">${marks(value)}</div><p class="ns-live-kicker">${esc(value.kicker)}</p><h2>${esc(value.headline)}</h2><p class="ns-live-hook">${esc(value.hook)}</p></div></div></article>`;
  }
  function render(container,candidate,presentation={}){if(!container)return null;container.innerHTML=markup(candidate,presentation);return model(candidate,presentation)}
  return Object.freeze({markup,model,render,safeUrl});
});
