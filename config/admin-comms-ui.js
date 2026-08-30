(function attachAdminCommsUi(root,factory){
  const api=factory();root.NOTHINGSPORTS_ADMIN_COMMS_UI=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:window,function buildAdminCommsUi(){
  "use strict";

  const esc=value=>String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const paragraphs=value=>String(value||"").split(/\n\s*\n/).map(item=>item.trim()).filter(Boolean).slice(0,8);
  const sydneyLine=value=>[value?.date,value?.time,value?.timezone].filter(Boolean).join(" · ");
  function completeHandoff(pack){
    return[`Subject: ${pack.subject}`,`Preview text: ${pack.previewText}`,`Suggested send: ${sydneyLine(pack.suggestedSendAt?.sydney)}`,`Headline: ${pack.headline}`,`Body:\n${(pack.bodyParagraphs||[]).join("\n\n")}`,pack.timingLine?`Timing: ${pack.timingLine}`:"",pack.broadcastLine?`Broadcast: ${pack.broadcastLine}`:"",`Primary CTA: ${pack.primaryCta?.label||""}\n${pack.primaryCta?.url||""}`,pack.secondaryCta?`Secondary CTA: ${pack.secondaryCta.label}\n${pack.secondaryCta.url}`:"",`Image: ${pack.image?.url||""}`,`Alt text: ${pack.image?.altText||""}`,`Source: ${pack.source?.name||""}\n${pack.source?.url||""}`].filter(Boolean).join("\n\n");
  }
  async function copy(value,status,label){
    try{await navigator.clipboard.writeText(String(value||""));status.className="admin-status ok";status.textContent=`${label} copied.`}
    catch(error){status.className="admin-status error";status.textContent=`Could not copy ${label.toLowerCase()}: ${error.message}`}
  }
  function exportTools(campaign,status){
    const pack=campaign.export_snapshot;if(campaign.state!=="exported"||campaign.export_stale||!pack)return null;
    const section=document.createElement("section");section.className="admin-export";
    section.innerHTML=`<strong>Frozen Mailchimp export</strong><p>${esc(pack.subject)} · ${esc(pack.previewText)}</p><div class="admin-actions"><button data-copy="subject">Copy subject</button><button data-copy="body">Copy body</button><button data-copy="complete">Copy complete handoff</button>${pack.image?.path?`<a class="button" href="${esc(pack.image.path)}" download>Download image</a>`:""}</div>`;
    const values={subject:pack.subject,body:(pack.bodyParagraphs||[]).join("\n\n"),complete:completeHandoff(pack)};
    section.querySelectorAll("[data-copy]").forEach(button=>button.addEventListener("click",()=>copy(values[button.dataset.copy],status,button.textContent)));
    return section;
  }
  function renderCampaign(container,campaign,client,reload){
    const candidate=campaign.candidate||{},draft=campaign.draft_copy||candidate.drafts||{},email=draft.email||{},instagram=draft.instagram||{},locked=campaign.state==="exported"||Boolean(campaign.approved_at);
    const card=document.createElement("article");card.className="admin-card campaign-card";
    card.innerHTML=`<div class="admin-card-head"><div><span class="admin-eyebrow">${esc(campaign.state)}${campaign.late?" · urgent":""}</span><h2>${esc(candidate.material?.title||email.headline||"Campaign")}</h2></div><span class="badge">Revision ${esc(campaign.campaign_revision)}</span></div>${campaign.export_stale?'<p class="admin-warning">The source changed after export. Prepare a fresh revision before using it.</p>':""}<div class="admin-grid"><label>Subject<input data-field="subject" value="${esc(email.subject)}" ${locked?"disabled":""}></label><label>Preview text<input data-field="preheader" value="${esc(email.preheader)}" ${locked?"disabled":""}></label><label class="wide">Headline<input data-field="headline" value="${esc(email.headline)}" ${locked?"disabled":""}></label><label class="wide">Email body<textarea data-field="body" rows="7" ${locked?"disabled":""}>${esc((email.bodyParagraphs||[]).join("\n\n"))}</textarea></label><label class="wide">Instagram caption<textarea data-field="caption" rows="4" ${locked?"disabled":""}>${esc(instagram.caption)}</textarea></label></div><p class="muted">Suggested send: ${esc(sydneyLine(email.suggestedSendAt?.sydney))} · Source checked ${esc(candidate.source?.checkedAt)}</p><div class="admin-actions">${locked?'<button data-action="reopen">Reopen as new revision</button>':'<button data-action="save" class="secondary">Save draft</button><button data-action="export">Prepare Mailchimp export</button>'}<a class="button secondary" href="${esc(candidate.participation?.fixtureUrl)}" target="_blank" rel="noopener">Open fixture</a></div><p class="admin-status" role="status"></p>`;
    const status=card.querySelector(".admin-status");
    const save=card.querySelector('[data-action="save"]');
    if(save)save.addEventListener("click",async()=>{const next=structuredClone(draft);next.email=next.email||{};next.instagram=next.instagram||{};next.email.subject=card.querySelector('[data-field="subject"]').value;next.email.preheader=card.querySelector('[data-field="preheader"]').value;next.email.headline=card.querySelector('[data-field="headline"]').value;next.email.bodyParagraphs=paragraphs(card.querySelector('[data-field="body"]').value);next.instagram.caption=card.querySelector('[data-field="caption"]').value;try{await client.commsRequest({action:"edit",campaignId:campaign.campaign_id,draftCopy:next});await reload()}catch(error){status.className="admin-status error";status.textContent=error.message}});
    const exportButton=card.querySelector('[data-action="export"]');
    if(exportButton)exportButton.addEventListener("click",async()=>{try{await client.commsRequest({action:"export-mailchimp",campaignId:campaign.campaign_id});await reload()}catch(error){status.className="admin-status error";status.textContent=error.message}});
    const reopen=card.querySelector('[data-action="reopen"]');
    if(reopen)reopen.addEventListener("click",async()=>{try{await client.commsRequest({action:"reopen-export",campaignId:campaign.campaign_id});await reload()}catch(error){status.className="admin-status error";status.textContent=error.message}});
    const tools=exportTools(campaign,status);if(tools)card.appendChild(tools);container.appendChild(card);
  }
  async function mount(container,client){
    async function load(){
      container.innerHTML='<p class="muted">Loading communications…</p>';
      try{
        const data=await client.commsRequest();container.innerHTML='<div class="admin-section-head"><div><h1>Communications</h1><p>Nothing Sport prepares the campaign; Mailchimp sends it.</p></div><button id="syncCampaigns">Sync candidates</button></div><div class="admin-callout">Exports contain copy, links and image instructions only. Audience selection, tests and sending remain explicit steps in Mailchimp.</div><div id="campaignList"></div>';
        container.querySelector("#syncCampaigns").addEventListener("click",async()=>{await client.commsRequest({action:"sync-candidates"});await load()});
        const list=container.querySelector("#campaignList");if(!data.campaigns?.length){list.innerHTML='<div class="admin-empty">No campaign candidates are waiting.</div>';return}
        data.campaigns.forEach(campaign=>renderCampaign(list,campaign,client,load));
      }catch(error){container.innerHTML=`<div class="admin-error"><h1>Communications unavailable</h1><p>${esc(error.message)}</p><button id="retryComms">Retry</button></div>`;container.querySelector("#retryComms").addEventListener("click",load)}
    }
    await load();
  }
  return Object.freeze({mount});
});
