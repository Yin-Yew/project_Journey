/* Database-powered dashboard, checklist management and Memories UI. */
let jjDashboardMetrics = [];
let jjMemoryRecords = [];
let jjMemoryUrls = new Map();
let jjMemoryFilter = 'all';
let jjMemorySelected = '';
const jjToday = () => {const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
function jjDaysUntil(date){
 const today=jjToday();return Math.round((Date.parse(`${date}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86400000);
}
const jjMetricText = (node, selector, value) => {const target=node?.querySelector(selector);if(target)target.textContent=value;};
async function loadRealDashboard(){
 if(!document.querySelector('.trip-feature'))return;
 const payload=await apiRequest('/api/dashboard');jjDashboardMetrics=payload.trips||[];
 renderRealDashboard();
}
function renderRealDashboard(){
 const feature=document.querySelector('.trip-feature');if(!feature)return;
 const today=jjToday();
 const metrics=jjDashboardMetrics.filter(t=>t.status==='active'&&t.endDate>=today)
   .sort((a,b)=>a.startDate.localeCompare(b.startDate));
 const summary=metrics[0]||null;
 const trip=summary?getTripById(summary.id):null;
 const hero=document.querySelector('.hero-copy h1');if(hero)hero.textContent=`Hi ${currentProfile?.name||'traveler'}! Ready for another adventure?`;
 const badge=document.querySelector('.hero-badge');
 if(trip){
  feature.hidden=false;feature.href=`trip-detail.html?trip=${encodeURIComponent(trip.id)}`;
  jjMetricText(feature,'h2',trip.name);
  jjMetricText(feature,'p',`${formatTripDate(trip.startDate,trip.endDate)} · ${trip.destination}`);
  const image=feature.querySelector('.mini-trip-photo');if(image)image.src=safeCover(trip);
  jjMetricText(feature,'.pill',trip.startDate>today?'Upcoming Trip':'Ongoing Trip');
  const stack=feature.querySelector('.avatar-stack');if(stack)stack.innerHTML=(tripDetailsCache[trip.id]?.members||[]).slice(0,6).map(m=>`<img class="member-avatar" alt="${escapeHTML(m.name)}" src="${escapeHTML(m.avatar||avatarUrl(m.name))}">`).join('');
  const days=jjDaysUntil(trip.startDate);
  if(badge){jjMetricText(badge,'strong',days>0?`${days} day${days===1?'':'s'}`:days===0?'Today!':'On the trip');jjMetricText(badge,'small',days>0?`until ${trip.name}`:`${trip.name}`);}
 } else {
  feature.href='trips.html';jjMetricText(feature,'h2','No upcoming trips');jjMetricText(feature,'p','Create a new trip to start planning');jjMetricText(feature,'.pill','Plan your next trip');
  const stack=feature.querySelector('.avatar-stack');if(stack)stack.replaceChildren();
  if(badge){jjMetricText(badge,'strong','No countdown');jjMetricText(badge,'small','Create an upcoming trip');}
 }
 const budget=Number(summary?.budget||0),expense=Number(summary?.totalExpense||0),packed=Number(summary?.packingDone||0),total=Number(summary?.packingTotal||0);
 const stats=document.querySelectorAll('.stat-card');
 if(stats[0]){jjMetricText(stats[0],'h2',money(budget));jjMetricText(stats[0],'small',`${money(expense)} used of ${money(budget)}`);const bar=stats[0].querySelector('.progress span');if(bar)bar.style.width=`${budget>0?Math.min(100,100*expense/budget):0}%`;}
 if(stats[1]){jjMetricText(stats[1],'h2',`${summary?.packingPercent||0}%`);jjMetricText(stats[1],'p:not(.muted)',`${packed} of ${total} packed`);const link=stats[1].querySelector('a');if(link)link.href=trip?`checklist.html?trip=${trip.id}`:'trips.html';}
 if(stats[2]){jjMetricText(stats[2],'.muted','Payment Status');jjMetricText(stats[2],'h2',summary?(summary.pendingPayments?`${summary.pendingPayments} pending`:computeSettlements(trip.id).some(s=>!isSettlementCompleted(s))?'Needs payment':'Settled'):'No trip');
  const payments=trip?databaseFinance.payments.filter(p=>p.tripId===trip.id):[];
  const settlements=trip?computeSettlements(trip.id).filter(s=>!isSettlementCompleted(s)):[];
  jjMetricText(stats[2],'p:not(.muted)',summary?`${summary.paidPayments} confirmed · ${settlements.length} unsettled transfer(s)`:'No payments');
  const link=stats[2].querySelector('a');if(link)link.href=trip?`expenses.html?trip=${trip.id}`:'trips.html';}
 const extras=document.getElementById('dashboardExtraStats');
 if(extras){
   extras.innerHTML=`<article class="card jj-mini-stat"><i class="ph-duotone ph-users-three"></i><small>Members</small><h2>${summary?.memberCount||0}</h2></article>
   <article class="card jj-mini-stat"><i class="ph-duotone ph-receipt"></i><small>Total Expense</small><h2>${money(expense)}</h2></article>
   <article class="card jj-mini-stat"><i class="ph-duotone ph-hourglass"></i><small>Countdown</small><h2>${!summary?'—':trip.startDate>today?`${jjDaysUntil(trip.startDate)} days`: 'Traveling'}</h2></article>
   <article class="card jj-mini-stat"><i class="ph-duotone ph-backpack"></i><small>Packing</small><h2>${summary?.packingPercent||0}%</h2></article>`;
 }
}

/* Private, note-style checklist. The server only returns this account's rows. */
const jjNoteEditors=new Map();
function renderChecklistPanel(tripId){
 const trip=getTripById(tripId),panel=document.querySelector(`[data-trip-panel="checklist"][data-trip-id="${tripId}"]`);
 if(!trip||!panel)return;
 const list=panel.querySelector('.checklist');if(!list)return;
 // Show a retriable error inside the panel instead of hiding the whole page.
 // Never show cached or unverified notes when this check fails.
 if(checklistPrivacyErrors[String(tripId)]){
  const message=checklistPrivacyErrors[String(tripId)];
  list.innerHTML=`<div class="jj-note-error" role="alert"><i class="ph-duotone ph-shield-warning"></i><strong>Private notes are temporarily unavailable</strong><p>${escapeHTML(message)}</p><button type="button" class="btn soft" data-jj-note-retry>Retry checklist</button></div>`;
  return;
 }
 const items=getModuleState(tripId).checklistItems||[];
 const done=items.filter(item=>item.checked).length;
 const editable=trip.status!=='finished';
 const editingId=jjNoteEditors.get(tripId);
 const rows=items.map(item=>{
  const id=escapeHTML(item.id);
  if(editable&&String(editingId)===String(item.id)){
   return `<div class="jj-note-row jj-note-editing"><form data-jj-note-edit="${id}" class="jj-note-edit-form">
     <input name="label" aria-label="Edit packing item" maxlength="150" required autocomplete="off" value="${escapeHTML(item.label)}">
     <button type="submit" class="jj-note-small-btn" aria-label="Save item" title="Save"><i class="ph ph-check"></i></button>
     <button type="button" data-jj-note-cancel class="jj-note-small-btn" aria-label="Cancel editing" title="Cancel"><i class="ph ph-x"></i></button>
   </form></div>`;
  }
  return `<div class="jj-note-row ${item.checked?'is-done':''}">
   <label class="jj-note-check"><input type="checkbox" data-item-id="${id}" ${item.checked?'checked':''} ${editable?'':'disabled'}><span>${escapeHTML(item.label)}</span></label>
   ${editable?`<div class="jj-note-actions">
      <button type="button" class="jj-note-small-btn" data-check-edit="${id}" aria-label="Edit ${escapeHTML(item.label)}" title="Edit"><i class="ph ph-pencil-simple"></i></button>
      <button type="button" class="jj-note-small-btn" data-check-delete="${id}" aria-label="Delete ${escapeHTML(item.label)}" title="Delete"><i class="ph ph-trash"></i></button>
     </div>`:''}
  </div>`;
 }).join('');
 list.innerHTML=`<div class="jj-note-heading"><i class="ph-duotone ph-note-pencil"></i>
   <div><strong>My packing list</strong><small><i class="ph ph-lock-key"></i> Private to ${escapeHTML(currentProfile?.email||"your account")}</small></div></div>
  ${editable?`<form class="jj-note-add" data-jj-note-add>
    <input name="label" maxlength="150" required autocomplete="off" aria-label="Packing item" placeholder="Write something to pack...">
    <button type="submit" class="btn primary"><i class="ph-bold ph-plus"></i> Add</button>
  </form>`:'<p class="jj-note-readonly">This trip is finished. Your notes are read-only.</p>'}
  <div class="jj-note-count">${done} of ${items.length} packed</div>
  <div class="jj-note-items">${rows||'<p class="jj-note-empty">Nothing here yet. Add your first item above.</p>'}</div>`;
 const switcher=[...document.querySelectorAll('.trip-switcher[data-trip-group="checklist"] .trip-switch[data-trip-id]')].find(x=>x.dataset.tripId===String(tripId));
 if(switcher){const small=switcher.querySelector('small');if(small)small.textContent=`${done}/${items.length} packed`;}
}
function initTripChecklist(){
 const panels=document.querySelectorAll('[data-trip-panel="checklist"]');if(!panels.length)return;
 panels.forEach(panel=>renderChecklistPanel(panel.dataset.tripId));
 document.addEventListener('submit',async event=>{
  const form=event.target.closest('[data-jj-note-add], [data-jj-note-edit]');if(!form)return;
  event.preventDefault();
  const panel=form.closest('[data-trip-panel="checklist"]');if(!panel)return;
  const tripId=panel.dataset.tripId,trip=getTripById(tripId);
  if(!trip||trip.status==='finished')return;
  const label=form.elements.label.value.trim();if(!label)return;
  const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
  try{
   if(form.hasAttribute('data-jj-note-edit')){
    const id=form.dataset.jjNoteEdit;
    await checklistUpdate(tripId,id,{label});jjNoteEditors.delete(tripId);
    renderChecklistPanel(tripId);
    showToast('Note updated');
   }else{
    await checklistCreate(tripId,label);
    showToast('Added to your notes');
    panel.querySelector('[data-jj-note-add] input')?.focus();
   }
  }catch(error){showToast(error.message);}
  finally{if(button?.isConnected)button.disabled=false;}
 });
 document.addEventListener('click',async event=>{
  const retry=event.target.closest('[data-jj-note-retry]');
  if(retry){
   const panel=retry.closest('[data-trip-panel="checklist"]');if(!panel)return;
   retry.disabled=true;
   checklistContractPromise=null;
   try{await refreshChecklistState(panel.dataset.tripId);}catch(error){showToast(error.message);}
   finally{if(retry.isConnected)retry.disabled=false;}
   return;
  }
  const edit=event.target.closest('[data-check-edit]');
  const cancel=event.target.closest('[data-jj-note-cancel]');
  const remove=event.target.closest('[data-check-delete]');
  if(!edit&&!cancel&&!remove)return;
  const panel=event.target.closest('[data-trip-panel="checklist"]');if(!panel)return;
  const tripId=panel.dataset.tripId,trip=getTripById(tripId);
  if(!trip||trip.status==='finished')return;
  if(edit){jjNoteEditors.set(tripId,edit.dataset.checkEdit);renderChecklistPanel(tripId);
   panel.querySelector('[data-jj-note-edit] input')?.focus();return;}
  if(cancel){jjNoteEditors.delete(tripId);renderChecklistPanel(tripId);return;}
  const item=(getModuleState(tripId).checklistItems||[]).find(x=>String(x.id)===String(remove.dataset.checkDelete));
  if(!item||!confirm(`Delete "${item.label}" from your notes?`))return;
  remove.disabled=true;
  try{await checklistDelete(tripId,item.id);showToast('Note deleted');}
  catch(error){showToast(error.message);await refreshChecklistState(tripId).catch(()=>{});}
  finally{if(remove.isConnected)remove.disabled=false;}
 });
 document.addEventListener('change',async event=>{
  const input=event.target.closest('[data-trip-panel="checklist"] input[data-item-id]');if(!input)return;
  const panel=input.closest('[data-trip-panel="checklist"]');if(!panel)return;
  const tripId=panel.dataset.tripId,trip=getTripById(tripId);
  const item=(getModuleState(tripId).checklistItems||[]).find(x=>String(x.id)===input.dataset.itemId);
  if(!item||!trip||trip.status==='finished'){input.checked=!input.checked;return;}
  input.disabled=true;
  try{await checklistUpdate(tripId,item.id,{checked:input.checked});}
  catch(error){showToast(error.message);await refreshChecklistState(tripId).catch(()=>{input.checked=!input.checked;input.disabled=false;});}
 });
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  const panel=event.target.closest('[data-trip-panel="checklist"]');
  if(!panel)return;
  jjNoteEditors.delete(panel.dataset.tripId);renderChecklistPanel(panel.dataset.tripId);
 });
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')panels.forEach(panel=>refreshChecklistState(panel.dataset.tripId).catch(()=>{}));
 });
}

function jjMemoryImgUrl(id){return jjMemoryUrls.get(id)||'';}
async function jjFetchMemoryPhoto(id){
 const response=await fetch(`/api/memories/${encodeURIComponent(id)}/image`,{headers:{Authorization:`Bearer ${localStorage.getItem(JJ_TOKEN_KEY)||''}`}});
 if(!response.ok)throw new Error('Could not load photo');
 return URL.createObjectURL(await response.blob());
}
function jjRevokeMemoryUrls(){jjMemoryUrls.forEach(url=>{if(url.startsWith('blob:'))URL.revokeObjectURL(url);});jjMemoryUrls.clear();}
async function loadTripMemories(){
 if(!document.querySelector('.memory-gallery'))return;
 jjRevokeMemoryUrls();jjMemoryRecords=(await apiRequest('/api/memories')).memories||[];
 await Promise.all(jjMemoryRecords.map(async m=>{
  if(m.imageUrl && /^https:\/\/(?:thumb\.|upload\.)wikimedia\.org\//.test(m.imageUrl)){jjMemoryUrls.set(m.id,m.imageUrl);return;}
  try{jjMemoryUrls.set(m.id,await jjFetchMemoryPhoto(m.id));}catch(e){console.warn(e);}
 }));
 renderTripMemories();
}
function renderTripMemories(){
 const filters=document.querySelector('.memory-filter'),gallery=document.querySelector('.memory-gallery');if(!filters||!gallery)return;
 const groups=tripCache;
 filters.innerHTML=`<button type="button" class="${jjMemoryFilter==='all'?'active':''}" data-memory-filter="all"><i class="ph-duotone ph-images"></i> All Photos <span>${jjMemoryRecords.length}</span></button>`+
 groups.map(t=>`<button type="button" class="${jjMemoryFilter===t.id?'active':''}" data-memory-filter="${escapeHTML(t.id)}">${escapeHTML(t.name)} <span>${jjMemoryRecords.filter(m=>m.tripId===t.id).length}</span></button>`).join('');
 const selected=jjMemoryRecords.filter(m=>jjMemoryFilter==='all'||m.tripId===jjMemoryFilter);
 gallery.innerHTML=selected.length?selected.map((m,index)=>`<article class="polaroid memory-item ${index%2?'rotate-right':'rotate-left'}" data-memory-id="${m.id}" tabindex="0" role="button" aria-label="Open ${escapeHTML(m.caption)}"><div class="memory-frame"><img alt="${escapeHTML(m.caption)}" loading="lazy" class="memory-photo" src="${jjMemoryImgUrl(m.id)}"><span class="memory-trip pink"><i class="ph-duotone ph-map-pin"></i> ${escapeHTML(m.tripName)}</span></div><p>${escapeHTML(m.caption)}</p></article>`).join(''):'<div class="card jj-gallery-empty"><i class="ph-duotone ph-images"></i><h3>No photos in this album</h3><p>Choose Add Memory to upload a photo from any trip, including finished trips.</p></div>';
 // For externally hosted images, use the authenticated local photo if the host fails.
 gallery.querySelectorAll('.memory-item').forEach(item=>{
  const id=item.dataset.memoryId,photo=item.querySelector('img.memory-photo'),url=jjMemoryImgUrl(id);
  if(!photo||!url.startsWith('https://'))return;
  photo.addEventListener('error',async()=>{
   try{const fallback=await jjFetchMemoryPhoto(id);jjMemoryUrls.set(id,fallback);photo.src=fallback;}
   catch(error){console.warn('Memory fallback unavailable:',error);}
  },{once:true});
 });
}
function initTripMemories(){
 if(!document.querySelector('.memory-gallery'))return;
 const content=document.querySelector('.content');
 content.insertAdjacentHTML('beforeend',`<div class="modal" id="jjUploadModal"><div class="modal-box"><button class="close" type="button" onclick="closeModal('jjUploadModal')"><i class="ph ph-x"></i></button><h2>Add Memory</h2><form id="jjMemoryUploadForm" class="jj-upload-form"><label>Album / Trip<select id="jjMemoryTrip" required></select></label><label>Photo (JPEG, PNG or WebP, up to 5MB)<input type="file" id="jjMemoryFile" accept="image/jpeg,image/png,image/webp" required></label><label>Caption<input id="jjMemoryCaption" maxlength="300" required placeholder="Best sunset together"></label><button type="submit" class="btn primary full" id="jjMemorySubmit">Upload Photo</button></form></div></div>`);
 const add=document.querySelector('.page-head button[onclick^="showToast"]');if(add){add.onclick=()=>openMemoryUploader();add.disabled=!tripCache.length;}
 const upload=document.getElementById('jjMemoryUploadForm');upload?.addEventListener('submit',async event=>{
  event.preventDefault();const file=document.getElementById('jjMemoryFile').files[0],tripId=document.getElementById('jjMemoryTrip').value,caption=document.getElementById('jjMemoryCaption').value.trim();
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){showToast('Select JPEG, PNG or WebP under 5MB');return;}
  const submit=document.getElementById('jjMemorySubmit');submit.disabled=true;
  try{const data=await jjReadFile(file);await apiJson(`/api/trips/${encodeURIComponent(tripId)}/memories`,'POST',{caption,image:data});closeModal('jjUploadModal');upload.reset();jjMemoryFilter=tripId;await loadTripMemories();showToast('Memory uploaded');}
  catch(e){showToast(e.message);}finally{submit.disabled=false;}
 });
 document.querySelector('.memory-filter')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-memory-filter]');if(!button)return;jjMemoryFilter=button.dataset.memoryFilter;renderTripMemories();
 });
 document.querySelector('.memory-gallery')?.addEventListener('click',event=>{const card=event.target.closest('[data-memory-id]');if(card)jjShowMemory(card.dataset.memoryId);});
 document.querySelector('.memory-gallery')?.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;const card=event.target.closest('[data-memory-id]');if(card){event.preventDefault();jjShowMemory(card.dataset.memoryId);}});
 const box=document.querySelector('.lightbox-card');box?.insertAdjacentHTML('beforeend','<button type="button" id="jjEditMemoryCaption" class="btn soft">Edit caption</button> <button type="button" id="jjDeleteMemory" class="btn danger jj-memory-delete">Delete Photo</button>');
 document.getElementById('jjDeleteMemory')?.addEventListener('click',jjDeleteSelectedMemory);
 document.getElementById('jjEditMemoryCaption')?.addEventListener('click',jjEditSelectedMemoryCaption);
 loadTripMemories().catch(e=>showToast(e.message));
}
function jjReadFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('File cannot be opened'));reader.readAsDataURL(file);});}
function openMemoryUploader(){
 const select=document.getElementById('jjMemoryTrip');if(!select)return;
 select.innerHTML=tripCache.map(t=>`<option value="${escapeHTML(t.id)}">${escapeHTML(t.name)} (${t.status==='finished'?'Finished':'Active'})</option>`).join('');
 const query=new URLSearchParams(location.search).get('trip');if(query&&getTripById(query))select.value=query;
 openModal('jjUploadModal');
}
function jjShowMemory(id){
 const memory=jjMemoryRecords.find(m=>m.id===id);if(!memory)return;
 jjMemorySelected=id;
 const image=document.getElementById('lightboxImage');if(image){image.src=jjMemoryImgUrl(id);image.alt=memory.caption;}
 const caption=document.getElementById('lightboxCaption');if(caption)caption.textContent=memory.caption;
 const trip=document.getElementById('lightboxTrip');if(trip)trip.textContent=memory.tripName;
 const mayEdit=memory.uploadedBy===currentId()||getTripById(memory.tripId)?.role==='owner';
 const del=document.getElementById('jjDeleteMemory');if(del)del.hidden=!mayEdit;
 const edit=document.getElementById('jjEditMemoryCaption');if(edit)edit.hidden=!mayEdit;
 document.getElementById('memoryLightbox')?.classList.add('open');
}
async function jjEditSelectedMemoryCaption(){
 const memory=jjMemoryRecords.find(m=>m.id===jjMemorySelected);if(!memory)return;
 const caption=prompt('Edit this photo caption',memory.caption)?.trim();
 if(!caption||caption===memory.caption)return;
 if(caption.length>300){showToast('Caption is too long (max 300 characters)');return;}
 try{await apiJson(`/api/memories/${encodeURIComponent(memory.id)}`,'PATCH',{caption});
   memory.caption=caption;document.getElementById('lightboxCaption').textContent=caption;
   renderTripMemories();showToast('Caption updated');
 }catch(e){showToast(e.message);}
}
async function jjDeleteSelectedMemory(){
 if(!jjMemorySelected||!confirm('Delete this memory photo?'))return;
 try{await apiRequest(`/api/memories/${encodeURIComponent(jjMemorySelected)}`,{method:'DELETE'});document.getElementById('memoryLightbox')?.classList.remove('open');jjMemorySelected='';await loadTripMemories();showToast('Memory deleted');}
 catch(e){showToast(e.message);}
}
window.addEventListener('beforeunload',jjRevokeMemoryUrls);
