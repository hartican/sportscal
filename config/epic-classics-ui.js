(function(root){
 'use strict';
 // Calm archive lists; the share carousel uses NS typography and its existing marks.
 const policy=root.NOTHINGSPORTS_EPIC;
 const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
 const defaultClient=()=>({request:(q,c)=>serverSyncClient.classicsRequest(q,c),owner:()=>serverSyncClient.sessionSubject()||'',results:()=>userPreferences.showSpoilers===true,active:()=>settingsSection==='classics',toast:message=>showToast(message),open:()=>openSettings({section:'classics'})});
 let generation=0,invitedOwner='',urls=[];
 function styles(){if(document.getElementById('epic-styles'))return;const s=el('style');s.id='epic-styles';s.textContent='.epic-highlight-link{display:inline-flex;align-items:center;gap:9px}.epic-highlight-link img{object-fit:contain}.epic-tools{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.epic-row{display:flex;gap:12px;align-items:center;padding:15px 0;border-bottom:1px solid var(--border)}.epic-row-copy{flex:1;min-width:0}.epic-row strong{display:block;font-size:.95rem}.epic-row small{display:block;color:var(--text-dim);margin-top:5px}.epic-row button{min-height:44px}.epic-editorial{padding:14px 0;border-bottom:1px solid var(--border)}.epic-editorial p{white-space:pre-line;line-height:1.65}.epic-status{color:var(--text-dim);font-size:.8rem}.epic-review-item{padding:14px 0;border-bottom:1px solid var(--border)}.epic-review-item label{display:flex;gap:10px;align-items:center}.epic-review-item input[type=checkbox]{width:22px;height:22px}.epic-review-item textarea,.epic-caption{width:100%;min-height:78px;box-sizing:border-box;margin:8px 0;padding:10px;background:var(--panel);color:var(--text);border:1px solid var(--border);border-radius:8px}.epic-preview{display:flex;gap:12px;overflow:auto;scroll-snap-type:x proximity}.epic-preview img{width:200px;height:250px;object-fit:contain;scroll-snap-align:start;border-radius:8px}.epic-dialog{max-height:85vh;overflow:auto}.nsc-rating-phase{display:block;font-size:.65rem;font-weight:800;color:var(--text-dim)}';document.head.append(s);}
 function button(text,action){const n=el('button',text,'btn ghost');n.type='button';n.onclick=action;return n;}
 function dialog(title){const d=el('dialog',undefined,'calendar-dialog epic-dialog');d.dataset.epic='';const h=el('h2',title);h.id='epic-title-'+Math.random().toString(36).slice(2);d.setAttribute('aria-labelledby',h.id);d.append(h);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});return d;}
 function current(client,owner,token){return client.owner()===owner&&generation===token&&client.active?.()!==false;}
 async function all(client,q){let next=q,entries=[],seen=new Set(),first;do{const page=await client.request(next);first ||= page;entries.push(...page.entries);if(page.nextCursor&&seen.has(page.nextCursor))throw Error('Archive pagination could not continue.');seen.add(page.nextCursor);next=page.nextCursor?{...q,cursor:page.nextCursor}:null;}while(next);return{...first,entries};}
 function caption(year,entries){return`My ${year} year of NS in review. ${entries.length} fixture${entries.length===1?'':'s'} worth remembering. Live sport, nothing missed. #NothingSport`;}
 async function mount(container,client=defaultClient()){
  styles();const token=++generation,owner=client.owner();container.replaceChildren();
  if(!owner){container.append(el('p','Sign in to keep your classics across devices.'));container.append(button('Sign in',()=>openSettings({section:'account'})));return;}
  let removed=false,data;
  const status=el('p','Loading your classics…','epic-status');container.append(status);
  const reload=async()=>{status.textContent='Loading your classics…';data=await client.request(removed?{removed:'1'}:{});if(!current(client,owner,token)||!container.isConnected)return;draw();};
  function draw(){
   container.replaceChildren();const tools=el('div',undefined,'epic-tools');
   tools.append(button('Review your classic fixtures',()=>void review(container,Number(policy.day(new Date()).slice(0,4)),client).catch(e=>client.toast(e.message))));
   tools.append(button(removed?'Back to Hall of Fame':'Removed classics',()=>{removed=!removed;void reload().catch(e=>status.textContent=e.message);}));container.append(tools);
   const setting=el('label',undefined,'viewing-toggle'),check=el('input');check.type='checkbox';check.checked=data.yearReviewEnabled;
   setting.append(check,el('span','Year in review notifications · a yearly invitation from 27 December.'));check.onchange=async()=>{if(!current(client,owner,token))return;check.disabled=true;try{await client.request({},{action:'notifications',enabled:check.checked});}catch(e){check.checked=!check.checked;client.toast(e.message);}finally{check.disabled=false;}};container.append(setting);
   if(!data.entries.length)container.append(el('p',removed?'No removed classics.':'Your 5/5 fixtures will be kept here, even after their cards retire.','epic-status'));
   for(const entry of data.entries){const row=el('article',undefined,'epic-row'),copy=el('div',undefined,'epic-row-copy');copy.append(el('strong',entry.fixture.name||'Historical fixture — details unavailable'));copy.append(el('small',`${entry.fixture.finalDate||entry.fixture.date||'Date unavailable'} · saved for ${policy.phaseCopy(entry.qualified_phase).name} 5/5`));
    row.append(copy,button('Review',()=>void detail(entry,client).catch(e=>client.toast(e.message))),button(removed?'Save again':'Remove',()=>void changeEntry(entry,removed?'save':'remove',client,reload)));container.append(row);
   }
   if(data.nextCursor){const more=button('Load more classics',async()=>{if(!current(client,owner,token))return;more.disabled=true;try{const next=await client.request({...removed?{removed:'1'}:{},cursor:data.nextCursor});if(!current(client,owner,token))return;data={...data,entries:[...data.entries,...next.entries],nextCursor:next.nextCursor};draw();}catch(e){client.toast(e.message);more.disabled=false;}});container.append(more);}
   if(data.role==='chief_admin'){
    const section=el('section',undefined,'epic-editorial');section.append(el('h3','Fixture curators'),el('p','Curator picks count as NS picks and carry 8× crowd weight. Changes are audited.','epic-status'));
    const input=el('input');input.placeholder='Existing NS handle';input.setAttribute('aria-label','NS handle to manage');const state=el('p','','epic-status');
    const assign=async enabled=>{if(!current(client,owner,token))return;try{await client.request({},{action:'curator-assign',handle:input.value,enabled});state.textContent=enabled?'Curator assigned.':'Curator removed.';}catch(e){state.textContent=e.message;}};
    section.append(input,button('Assign curator',()=>void assign(true)),button('Remove curator',()=>void assign(false)),state);container.append(section);
   }
  }
  try{await reload();}catch(error){if(current(client,owner,token))status.textContent=error.message||'Classics unavailable. Try again.';}
 }
 async function changeEntry(entry,action,client,reload){
  const owner=client.owner();
  const run=async()=>{if(client.owner()!==owner)return;await client.request({},{action,eventId:entry.event_id,revision:entry.revision});if(client.owner()===owner)await reload();};
  if(action==='save'){try{await run();}catch(e){client.toast(e.message);}return;}
  const d=dialog('Remove this classic?');d.append(el('p','It leaves your personal Hall of Fame. NS keeps its shared editorial; new ratings will not add it back automatically.'));const status=el('p','','epic-status');d.append(button('Keep classic',()=>d.close()),button('Remove classic',async()=>{try{await run();d.close();}catch(e){status.textContent=e.message;}}),status);d.showModal();
 }
 async function detail(entry,client){
  const owner=client.owner(),token=generation,data=await client.request({eventId:entry.event_id,results:client.results()?'1':'0'});if(!current(client,owner,token))return;
  const d=dialog(data.fixture.name||'Historical fixture');
  d.append(el('p',data.fixture.finalDate||data.fixture.date||'Date unavailable','epic-status'));
  const shown=client.results();d.append(button(shown?'Hide results for this classic':'Reveal results for this classic',()=>{d.close();void detail(entry,{...client,results:()=>!shown}).catch(e=>client.toast(e.message));}));
  const media=data.fixture.highlights;if(media?.standalone&&media.availability==='public'&&media.regionStatus!=='blocked'&&Number.isFinite(Date.parse(media.verifiedAt))&&/^https:\/\/(www\.)?(youtube\.com\/watch\?|youtu\.be\/)/.test(media.url||'')){const watch=el('a',undefined,'btn epic-highlight-link'),logo=el('img');logo.src='/assets/providers/youtube.png';logo.alt='YouTube';logo.width=54;logo.height=24;watch.append(logo,el('span','Watch highlights'));watch.href=media.url;watch.target='_blank';watch.rel='noopener noreferrer';d.append(watch);}
  for(const phase of policy.phases){const section=el('section',undefined,'epic-editorial');section.append(el('h3',policy.phaseCopy(phase).name+' · '+policy.phaseCopy(phase).detail));const rows=data.editorial.filter(e=>e.phase===phase),final=rows.findLast(e=>e.milestone==='final');
   if(!rows.length)section.append(el('p','Original editorial is unavailable.','epic-status'));
   else if(final?.redacted)section.append(el('p','Results are OFF. Reveal results to read this phase.','epic-status'));
   else if(final){for(const key of ['hook','body','formCopy','synopsis','closingCopy'])if(final.copy?.[key])section.append(el(key==='hook'?'strong':'p',final.copy[key]));section.append(el('small','Preserved '+new Date(final.capturedAt).toLocaleDateString('en-AU')));for(const url of final.sourceUrls||[])if(/^https:\/\//.test(url)){const link=el('a','Editorial source · '+new URL(url).hostname);link.href=url;link.target='_blank';link.rel='noopener noreferrer';section.append(link);}}
   const first=rows.find(e=>e.milestone==='first-five');if(phase==='heat'&&!first)section.append(el('p','Preview at the first 5/5 is unavailable.','epic-status'));if(first?.copy){const history=el('details');history.append(el('summary','First preserved preview'));for(const key of ['hook','formCopy','synopsis','closingCopy'])if(first.copy[key])history.append(el('p',first.copy[key]));section.append(history);}
   const corrections=rows.filter(e=>e.milestone==='correction'&&e.copy);if(corrections.length){const history=el('details');history.append(el('summary','Earlier copy and corrections'));for(const c of corrections)history.append(el('p',Object.entries(c.copy).filter(([k,v])=>['hook','body','synopsis','formCopy','closingCopy'].includes(k)&&typeof v==='string').map(([,v])=>v).join('\n\n')));section.append(history);}
   d.append(section);
  }
  if(data.comments?.length){const section=el('section',undefined,'epic-editorial');section.append(el('h3','Top comments'));for(const comment of data.comments){const quote=el('blockquote');quote.append(el('strong',comment.handle),el('p',comment.body));section.append(quote);}d.append(section);}
  d.append(button('Close',()=>d.close()));d.showModal();
 }
 async function review(container,year,client=defaultClient()){
  const token=++generation,owner=client.owner();container.replaceChildren(el('p','Loading your review…','epic-status'));
  const [data,available]=await Promise.all([all(client,{review:'1',year:String(year)}),client.request({years:'1'})]);if(!current(client,owner,token)||!container.isConnected)return;
  const candidates=new Map(data.entries.map(e=>[e.event_id,e])),selected=data.review.selection.filter(p=>candidates.has(p.eventId));let revision=data.review.revision;
  const tools=el('div',undefined,'epic-tools'),select=el('select');select.setAttribute('aria-label','Fixture year');const thisYear=Number(policy.day(new Date()).slice(0,4));for(const y of [...new Set([thisYear,year,...available.years])].sort((a,b)=>b-a)){const o=el('option',String(y));o.value=String(y);o.selected=y===year;select.append(o);}select.onchange=()=>void review(container,Number(select.value),client).catch(e=>client.toast(e.message));tools.append(button('Hall of Fame',()=>void mount(container,client)),select);
  const heading=el('h3',year+' · Your year of NS'),intro=el('p','Choose the fixtures you want to remember, then put them in your order.','epic-status'),list=el('div'),captionInput=el('textarea',undefined,'epic-caption');captionInput.setAttribute('aria-label','Share caption');captionInput.value=data.review.caption||caption(year,selected);
  const resultsLabel=el('label',undefined,'viewing-toggle'),reveal=el('input');reveal.type='checkbox';reveal.checked=false;resultsLabel.append(reveal,el('span','Include results and Impact editorial in the shared carousel.'));
  const status=el('p','','epic-status'),output=el('div');container.replaceChildren(tools,heading,intro,list,el('label','Edit your share caption'),captionInput,resultsLabel,status,output);
  function draw(){list.replaceChildren();if(!data.entries.length)list.append(el('p','No completed classics for this year yet.','epic-status'));
   const ordered=[...selected.map(p=>candidates.get(p.eventId)),...data.entries.filter(e=>!selected.some(p=>p.eventId===e.event_id))];
   for(const entry of ordered){const item=el('article',undefined,'epic-review-item'),label=el('label'),check=el('input');check.type='checkbox';let choice=selected.find(p=>p.eventId===entry.event_id);check.checked=!!choice;label.append(check,el('strong',entry.fixture.name||'Historical fixture'));item.append(label);
    check.onchange=()=>{if(check.checked){selected.push({eventId:entry.event_id,note:''});}else selected.splice(selected.findIndex(p=>p.eventId===entry.event_id),1);draw();};
    if(choice){const index=selected.indexOf(choice),note=el('textarea');note.value=choice.note||'';note.maxLength=1000;note.setAttribute('aria-label','Your note for '+(entry.fixture.name||entry.event_id));note.oninput=()=>choice.note=note.value;item.append(note);const move=direction=>{const next=index+direction;if(next>=0&&next<selected.length){[selected[index],selected[next]]=[selected[next],selected[index]];draw();}};const up=button('Move up',()=>move(-1)),down=button('Move down',()=>move(1));up.disabled=index===0;down.disabled=index===selected.length-1;item.append(up,down);}
    list.append(item);
   }
  }
  const save=async()=>{if(!current(client,owner,token))throw Error('The account or review changed. Reopen your review.');const result=await client.request({},{action:'review-save',year,revision,selection:selected,caption:captionInput.value});if(!current(client,owner,token))return;revision=result.revision;status.textContent='Review saved.';};
  const actions=el('div',undefined,'epic-tools');actions.append(button('Save review',()=>void save().catch(e=>status.textContent=e.message)),button('Make share carousel',async()=>{if(!selected.length){status.textContent='Choose at least one fixture.';return;}try{await save();status.textContent='Making your carousel…';const records=[];for(const p of selected){const record=await client.request({eventId:p.eventId,results:reveal.checked?'1':'0'});if(!current(client,owner,token))return;records.push({...record,note:p.note});}const files=await exportFiles(year,records,{results:reveal.checked});if(!current(client,owner,token))return;renderExport(output,files,captionInput.value);status.textContent='Carousel ready. Nothing is posted until you share it.';}catch(e){status.textContent=e.message;}}));container.insertBefore(actions,status);draw();
 }
 function wrap(ctx,text,x,y,width,lineHeight,maxLines=20){let line='',lines=0;for(const word of String(text||'').split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width&&line){ctx.fillText(line,x,y);y+=lineHeight;line=word;if(++lines>=maxLines)return y;}else line=next;}if(line){ctx.fillText(line,x,y);y+=lineHeight;}return y;}
 // Wrap public quotes by grapheme, retaining explicit line breaks and long words.
 function commentLines(ctx,text,width){
  const segments=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(String(text))].map(s=>s.segment):Array.from(String(text));
  const lines=[];let line='';for(const part of segments){if(part==='\n'){lines.push(line);line='';continue;}if(line&&ctx.measureText(line+part).width>width){lines.push(line);line='';}line+=part;}lines.push(line);return lines;
 }
 async function exportFiles(year,records,{results=false}={}){
  await document.fonts?.ready;const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d'),files=[];
  function base(kicker){ctx.fillStyle='#071510';ctx.fillRect(0,0,1080,1350);ctx.fillStyle='#d6ff42';ctx.font='900 65px "DM Sans",sans-serif';ctx.fillText('nothing SPORT',80,125);ctx.fillStyle='#ffffff';ctx.font='700 30px "DM Sans",sans-serif';ctx.fillText(kicker,80,200);ctx.fillStyle='#a1b3a8';ctx.font='500 28px "DM Sans",sans-serif';ctx.fillText('Live sport, nothing missed.',80,1265);}
  const add=async name=>{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('This browser could not export an image.');files.push(new File([blob],name,{type:'image/png'}));};
  base('MY YEAR OF NS');ctx.fillStyle='#d6ff42';ctx.font='900 230px "DM Sans",sans-serif';ctx.fillText(String(year),70,550);ctx.fillStyle='#ffffff';ctx.font='700 66px "DM Sans",sans-serif';wrap(ctx,records.length+' fixtures worth remembering',80,710,900,82,3);ctx.font='500 38px "DM Sans",sans-serif';ctx.fillStyle='#a1b3a8';wrap(ctx,'The anticipation. The electricity. The impact.',80,1050,900,52,3);await add('NS-'+year+'-00-cover.png');
  for(let index=0;index<records.length;index++){const record=records[index];base(year+' · '+String(index+1).padStart(2,'0'));ctx.fillStyle='#ffffff';ctx.font='800 68px "DM Sans",sans-serif';let y=wrap(ctx,record.fixture.name||'A classic fixture',80,310,900,84,5)+35;ctx.fillStyle='#a1b3a8';ctx.font='500 30px "DM Sans",sans-serif';ctx.fillText(record.fixture.finalDate||record.fixture.date||'Date unavailable',80,y);y+=75;
   const phase=results?'impact':'heat',part=record.editorial.findLast(p=>p.phase===phase&&p.milestone==='final'&&p.copy),copy=part?.copy||{};ctx.fillStyle='#d6ff42';ctx.font='700 30px "DM Sans",sans-serif';ctx.fillText(policy.phaseCopy(phase).name.toUpperCase(),80,y);y+=60;ctx.fillStyle='#ffffff';ctx.font='500 37px "DM Sans",sans-serif';const text=[copy.hook,copy.body||copy.synopsis].filter(Boolean).join('\n\n').split(/\s+/).slice(0,85).join(' ');y=wrap(ctx,text||'Original editorial is unavailable.',80,y,900,49,Math.max(1,Math.floor((1120-y)/49)));if(results&&record.note&&y<1100){ctx.fillStyle='#a1b3a8';ctx.font='500 31px "DM Sans",sans-serif';wrap(ctx,record.note,80,y+28,900,42,Math.max(1,Math.floor((1180-y)/42)));}await add('NS-'+year+'-'+String(index+1).padStart(2,'0')+'-fixture.png');await new Promise(resolve=>requestAnimationFrame(resolve));}
  if(results)for(let index=0;index<records.length;index++){
   const record=records[index];for(const [place,comment] of (record.comments||[]).entries()){
    ctx.font='500 36px "DM Sans",sans-serif';const lines=commentLines(ctx,comment.body,900);let offset=0,part=0;
    do{base(year+' · COMMUNITY COMMENTS');ctx.fillStyle='#ffffff';ctx.font='800 48px "DM Sans",sans-serif';const headingEnd=wrap(ctx,record.fixture.name||'A classic fixture',80,290,900,60,3),startY=headingEnd+120;
     ctx.fillStyle='#d6ff42';ctx.font='700 36px "DM Sans",sans-serif';ctx.fillText(comment.handle,80,headingEnd+45);ctx.fillStyle='#ffffff';ctx.font='500 36px "DM Sans",sans-serif';
     const count=Math.max(1,Math.floor((1180-startY)/47)+1);for(const [lineIndex,line] of lines.slice(offset,offset+count).entries())ctx.fillText(line,80,startY+lineIndex*47);
     offset+=count;part++;await add('NS-'+year+'-'+String(index+1).padStart(2,'0')+'-comment-'+(place+1)+'-'+part+'.png');
    }while(offset<lines.length);
   }
  }
  canvas.width=canvas.height=1;return files;
 }
 // Stored ZIP entries avoid another runtime dependency and preserve original PNG bytes.
 async function zip(files){const parts=[],directory=[];let offset=0;const encode=new TextEncoder();const crc=bytes=>{let c=-1;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^-1)>>>0;};
  for(const file of files){const data=new Uint8Array(await file.arrayBuffer()),name=encode.encode(file.name),sum=crc(data),head=new Uint8Array(30+name.length),h=new DataView(head.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(12,33,true);h.setUint32(14,sum,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);head.set(name,30);parts.push(head,data);const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(14,33,true);c.setUint32(16,sum,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);directory.push(central);offset+=head.length+data.length;}
  const size=directory.reduce((n,p)=>n+p.length,0),end=new Uint8Array(22),d=new DataView(end.buffer);d.setUint32(0,0x06054b50,true);d.setUint16(8,files.length,true);d.setUint16(10,files.length,true);d.setUint32(12,size,true);d.setUint32(16,offset,true);return new Blob([...parts,...directory,end],{type:'application/zip'});
 }
 function renderExport(container,files,text){urls.forEach(u=>URL.revokeObjectURL(u));urls=[];container.replaceChildren();const preview=el('div',undefined,'epic-preview');for(const file of files){const url=URL.createObjectURL(file);urls.push(url);const image=el('img');image.src=url;image.alt=file.name;image.loading='lazy';image.width=1080;image.height=1350;preview.append(image);}container.append(preview);
  if(navigator.canShare?.({files}))container.append(button('Share carousel',async()=>{try{await navigator.share({files,title:'My year of NS in review',text});}catch(error){if(error.name!=='AbortError')container.append(el('p','Native sharing could not open. Download your carousel instead.'));}}));
  container.append(button('Download carousel',async()=>{const url=URL.createObjectURL(await zip(files)),a=el('a');a.href=url;a.download='Year-of-NS-in-review.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}));
  const copy=button('Copy caption',async()=>{try{await navigator.clipboard.writeText(text);copy.textContent='Caption copied';}catch{const field=el('textarea');field.value=text;container.append(field);field.focus();field.select();}});container.append(copy);
 }
 async function purge(entries,client=defaultClient()){
  styles();const owner=client.owner(),d=dialog(`Empty bin (${entries.length})?`);d.append(el('p','These cards cannot be restored. Your ratings, points and EPIC Hall of Fame remain saved.'));const status=el('p','','epic-status');
  d.append(button('Keep hidden cards',()=>d.close()),button('Empty bin',async()=>{try{const ids=[...new Set(entries.flatMap(e=>[eventActionKey(e.event),...EVENT_ACTION_IDENTITY.matchingKeys(e.event,eventActions)]))],purged=new Set();if(owner){await syncCurrentServerState();if(client.owner()!==owner)return;for(let i=0;i<ids.length;i+=500){if(client.owner()!==owner)return;const reply=await client.request({},{action:'purge',ids:ids.slice(i,i+500)});for(const id of reply.purgedIds||[])purged.add(id);}}else for(const id of ids)purged.add(id);
   if(client.owner()!==owner)return;for(const entry of entries)if([eventActionKey(entry.event),...EVENT_ACTION_IDENTITY.matchingKeys(entry.event,eventActions)].some(id=>purged.has(id)))updateEventAction(entry.event,{isPurged:true,purgedAt:new Date().toISOString(),saved:false,archived:false,addedToFixtures:false,addedFixture:null});d.close();renderHiddenEventsSettings(document.getElementById('settingsBody'));client.toast(purged.size?'Bin emptied.':'These cards changed on another device. Review the refreshed bin.');renderAll();}catch(error){status.textContent=error.message;}}),status);d.showModal();
 }
 async function invite(client=defaultClient(),clock=new Date()){
  const owner=client.owner(),year=policy.reviewYear(clock);if(!owner||year<2026||invitedOwner===owner+':'+year||document.querySelector('dialog[open],.modal.show'))return;
  const data=await client.request({review:'1',year:String(year)});if(client.owner()!==owner||!data.invite||invitedOwner===owner+':'+year)return;
  invitedOwner=owner+':'+year;let claim;try{claim=await client.request({},{action:'review-seen',year});}catch(error){invitedOwner='';throw error;}if(client.owner()!==owner||claim.claimed!==true)return;
  const d=dialog('Review your classic fixtures');d.append(el('p',`Your ${year} year of NS is ready to curate. Choose the fixtures, add your take and make a share carousel.`));d.append(button('Later',()=>d.close()),button('Review my year',()=>{d.close();client.open();setTimeout(()=>{const body=document.getElementById('settingsBody');if(body)void review(body,year,client).catch(e=>client.toast(e.message));},0);}));d.showModal();
 }
 function openReview(year){styles();const d=dialog('Your year of NS'),body=el('div');d.append(body,button('Close',()=>d.close()));d.showModal();void review(body,year,{...defaultClient(),active:()=>d.open}).catch(error=>body.replaceChildren(el('p',error.message)));return d;}
 function reset(){generation++;invitedOwner='';document.querySelectorAll('dialog[data-epic]').forEach(d=>d.close());urls.forEach(u=>URL.revokeObjectURL(u));urls=[];if(typeof settingsSection!=='undefined'&&settingsSection==='classics')document.getElementById('settingsBody')?.replaceChildren(el('p','Reopen your classics for this account.'));}
 root.NOTHINGSPORTS_EPIC_UI={mount,review,detail,purge,invite,exportFiles,zip,reset,openReview};
})(globalThis);
