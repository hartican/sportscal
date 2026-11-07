(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const labels={hook:'Hook',formCopy:'Form',closingCopy:'Storyline',synopsis:'Match Context'};
  async function mount(container,client){
    const data=await client.commsRequest({action:'editorial-list'});
    container.innerHTML=`<div class="admin-section-head"><div><h1>Editorial</h1><p>${esc(data.horizon.from)} to ${esc(data.horizon.to)} · Sydney dates. Verified story changes publish automatically. Saved edits can be revised by later developments.</p></div></div><div class="admin-toolbar"><label class="wide">Search<input data-editorial-search placeholder="Fixture or sport"></label><label>Show<select data-editorial-filter><option value="selected">Qualifying / requested</option><option value="all">All upcoming fixtures</option><option value="due">Due for research</option><option value="held">On hold</option></select></label></div><div data-editorial-list>${data.cards.map(card=>{
      const copy=card.state.pending_copy||card.copy;
      return `<details class="admin-card" data-editorial-id="${esc(card.id)}"><summary><strong>${esc(card.name)}</strong> · ${esc(card.date)} · ${card.schedule.protected?'Protected':card.state.held?'On hold':card.schedule.due&&card.selected?'Research due':'Next check '+esc(card.schedule.nextDueDate)}</summary><p>${esc(card.eligibility.reasons.join(', ')|| (card.state.requested?'Explicit owner request':'Not rating-qualified'))}</p><p>Last checked: ${esc(card.state.last_checked_at||'Not yet')} · Research: ${esc(card.researchedAt||'Missing')} · ${card.schedule.cadenceDays}-day cadence</p><p>Production: ${esc(card.state.published_git_sha||'Published source; no maintenance release recorded')}${card.state.pending_copy?' · Your edit is queued for the next canonical editorial run.':''}</p>${card.state.last_error?`<p class="admin-status error">${esc(card.state.last_error.reason)} Next: ${esc(card.state.last_error.nextAction)}</p>`:''}<div class="admin-grid">${Object.entries(labels).map(([field,label])=>`<label class="wide">${label}<textarea data-editorial-field="${field}" rows="${field==='hook'?2:4}" ${card.schedule.protected?'disabled':''}>${esc(copy[field])}</textarea></label>`).join('')}</div><p>${(card.sources||[]).map(url=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(new URL(url).hostname)}</a>`).join(' · ')}</p><div class="admin-actions"><button data-editorial-save ${card.schedule.protected?'disabled':''}>Save editorial edit</button><button class="secondary" data-editorial-hold ${card.schedule.protected?'disabled':''}>${card.state.held?'Release hold':'Hold automatic updates'}</button><a href="/admin/comms">Communications material</a></div><p class="admin-status" data-editorial-status></p><details><summary>Revision history (${(card.state.history||[]).length})</summary>${(card.state.history||[]).slice().reverse().map(h=>`<p>Revision ${h.revision} · ${esc(h.at)} · ${esc(h.reason)}<br>${esc(h.copy?.hook)}</p>`).join('')}</details></details>`;
    }).join('')||'<p>No fixtures in the current horizon.</p>'}</div>`;
    for(const element of container.querySelectorAll('[data-editorial-id]')){
      const card=data.cards.find(c=>c.id===element.dataset.editorialId);
      const save=async(action)=>{const status=element.querySelector('[data-editorial-status]');try{
        const command={action,eventId:card.id,expectedRevision:card.state.revision};
        if(action==='editorial-save')command.copy=Object.fromEntries([...element.querySelectorAll('[data-editorial-field]')].map(e=>[e.dataset.editorialField,e.value]));else command.held=!card.state.held;
        const result=await client.commsRequest(command);card.state=result.state;
        element.querySelector('[data-editorial-hold]').textContent=card.state.held?'Release hold':'Hold automatic updates';status.className='admin-status ok';status.textContent='Saved privately. Card publication uses the canonical editorial and release gates.';
      }catch(error){status.className='admin-status error';status.textContent=error.message;}};
      element.querySelector('[data-editorial-save]').onclick=()=>save('editorial-save');element.querySelector('[data-editorial-hold]').onclick=()=>save('editorial-hold');
    }
    const filter=()=>{const term=container.querySelector('[data-editorial-search]').value.toLowerCase(),mode=container.querySelector('[data-editorial-filter]').value;for(const el of container.querySelectorAll('[data-editorial-id]')){const c=data.cards.find(c=>c.id===el.dataset.editorialId);el.hidden=!`${c.name} ${c.key}`.toLowerCase().includes(term)||!(mode==='all'||mode==='selected'&&c.selected||mode==='due'&&c.selected&&c.schedule.due||mode==='held'&&c.state.held);}};
    container.querySelector('[data-editorial-search]').oninput=filter;container.querySelector('[data-editorial-filter]').onchange=filter;filter();
    return ()=>{};
  }
  root.NOTHINGSPORTS_ADMIN_EDITORIAL_UI={mount};
})(typeof globalThis!=='undefined'?globalThis:window);
