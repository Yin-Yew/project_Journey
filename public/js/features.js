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

function checklistActionsMarkup(trip,item){
 if(trip.status==='finished')return '<small>Read-only</small>';
 return `<span class="jj-item-actions"><button type="button" class="jj-icon-button" data-check-edit="${escapeHTML(item.id)}" title="Edit item" aria-label="Edit item"><i class="ph ph-pencil-simple"></i></button><button type="button" class="jj-icon-button danger-icon" data-check-delete="${escapeHTML(item.id)}" title="Delete item" aria-label="Delete item"><i class="ph ph-trash"></i></button></span>`;
}
function renderChecklistPanel(tripId){
 const trip=getTripById(tripId),panel=document.querySelector(`[data-trip-panel="checklist"][data-trip-id="${tripId}"]`);
 if(!trip||!panel)return;
 const list=panel.querySelector('.checklist');if(!list)return;
 const items=getModuleState(tripId).checklistItems||[];
 list.innerHTML=items.length?items.map(item=>`<div class="jj-check-row"><label class="saved-checklist-item"><input type="checkbox" data-item-id="${escapeHTML(item.id)}" ${item.checked?'checked':''} ${trip.status==='finished'?'disabled':''}><span><i class="ph-duotone ph-package"></i> ${escapeHTML(item.label)}</span></label>${checklistActionsMarkup(trip,item)}</div>`).join(''):'<div class="module-empty"><i class="ph-duotone ph-backpack"></i><h3>No packing items yet</h3><p>Use Add Item to start this trip checklist.</p></div>';
 const percent=getTripStats(tripId).packingPercent;
 const switcher=[...document.querySelectorAll('.trip-switch[data-trip-id]')].find(el=>el.dataset.tripId===tripId);
 if(switcher){const small=switcher.querySelector('small');if(small)small.textContent=`${percent}% packed`;} 
 let progress=panel.querySelector('.jj-check-progress');if(!progress){progress=document.createElement('div');progress.className='jj-check-progress';panel.querySelector('.trip-section-head')?.after(progress);}
 progress.innerHTML=`<strong>${percent}% packed</strong><small>${items.filter(i=>i.checked).length} / ${items.length} items ready</small><div class="progress"><span style="width:${percent}%"></span></div>`;
}
function initTripChecklist(){
 const groups=document.querySelectorAll('[data-trip-panel="checklist"]');if(!groups.length)return;
 groups.forEach(panel=>renderChecklistPanel(panel.dataset.tripId));
 const add=document.querySelector('.page-head button[onclick="addChecklist()"]');if(add)add.disabled=!tripCache.some(t=>t.status==='active');
 document.addEventListener('change',async event=>{
  const input=event.target.closest('[data-trip-panel="checklist"] input[type="checkbox"][data-item-id]');if(!input)return;
  const panel=input.closest('[data-trip-id]'),tripId=panel?.dataset.tripId;
  const itemId=input.dataset.itemId,checked=input.checked;
  input.disabled=true;
  try{await checklistUpdate(tripId,itemId,{checked});}
  catch(e){demoToast(e.message);try{await refreshChecklistState(tripId);}catch{input.checked=!checked;input.disabled=false;}}
 });
 document.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-check-edit],button[data-check-delete]');if(!button)return;
  const panel=button.closest('[data-trip-panel="checklist"]');if(!panel)return;
  const tripId=panel.dataset.tripId,trip=getTripById(tripId);if(!trip||trip.status==='finished')return;
  const id=button.dataset.checkEdit??button.dataset.checkDelete;
  const item=(getModuleState(tripId).checklistItems||[]).find(x=>String(x.id)===String(id));
  if(!item)return;
  button.disabled=true;
  try{
   if(button.hasAttribute('data-check-delete')){
    if(!confirm(`Delete "${item.label}"?`))return;
    await checklistDelete(tripId,id);demoToast('Item deleted');return;
   }
   const label=prompt('Edit packing item',item.label)?.trim();if(!label)return;
   await checklistUpdate(tripId,id,{label:label.slice(0,150)});demoToast('Item updated');
  }catch(e){demoToast(e.message);await refreshChecklistState(tripId).catch(()=>{});}
  finally{button.disabled=false;}
 });
 // Synchronize changes made by other members while the tab is visible.
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')groups.forEach(p=>refreshChecklistState(p.dataset.tripId).catch(()=>{}));
 });
}

function jjMemoryImgUrl(id){return jjMemoryUrls.get(id)||'';}
async function jjFetchMemoryPhoto(id){
 const response=await fetch(`/api/memories/${encodeURIComponent(id)}/image`,{headers:{Authorization:`Bearer ${localStorage.getItem(JJ_TOKEN_KEY)||''}`}});
 if(!response.ok)throw new Error('Could not load photo');
 return URL.createObjectURL(await response.blob());
}
function jjRevokeMemoryUrls(){jjMemoryUrls.forEach(url=>URL.revokeObjectURL(url));jjMemoryUrls.clear();}
async function loadTripMemories(){
 if(!document.querySelector('.memory-gallery'))return;
 jjRevokeMemoryUrls();jjMemoryRecords=(await apiRequest('/api/memories')).memories||[];
 await Promise.all(jjMemoryRecords.map(async m=>{try{jjMemoryUrls.set(m.id,await jjFetchMemoryPhoto(m.id));}catch(e){console.warn(e);}}));
 renderTripMemories();
}
function renderTripMemories(){
 const filters=document.querySelector('.memory-filter'),gallery=document.querySelector('.memory-gallery');if(!filters||!gallery)return;
 const groups=tripCache;
 filters.innerHTML=`<button type="button" class="${jjMemoryFilter==='all'?'active':''}" data-memory-filter="all"><i class="ph-duotone ph-images"></i> All Photos <span>${jjMemoryRecords.length}</span></button>`+
 groups.map(t=>`<button type="button" class="${jjMemoryFilter===t.id?'active':''}" data-memory-filter="${escapeHTML(t.id)}">${escapeHTML(t.name)} <span>${jjMemoryRecords.filter(m=>m.tripId===t.id).length}</span></button>`).join('');
 const selected=jjMemoryRecords.filter(m=>jjMemoryFilter==='all'||m.tripId===jjMemoryFilter);
 gallery.innerHTML=selected.length?selected.map((m,index)=>`<article class="polaroid memory-item ${index%2?'rotate-right':'rotate-left'}" data-memory-id="${m.id}" tabindex="0" role="button" aria-label="Open ${escapeHTML(m.caption)}"><div class="memory-frame"><img alt="${escapeHTML(m.caption)}" loading="lazy" class="memory-photo" src="${jjMemoryImgUrl(m.id)}"><span class="memory-trip pink"><i class="ph-duotone ph-map-pin"></i> ${escapeHTML(m.tripName)}</span></div><p>${escapeHTML(m.caption)}</p></article>`).join(''):'<div class="card jj-gallery-empty"><i class="ph-duotone ph-images"></i><h3>No photos in this album</h3><p>Choose Add Memory to upload a photo from any trip, including finished trips.</p></div>';
}
function initTripMemories(){
 if(!document.querySelector('.memory-gallery'))return;
 const content=document.querySelector('.content');
 content.insertAdjacentHTML('beforeend',`<div class="modal" id="jjUploadModal"><div class="modal-box"><button class="close" type="button" onclick="closeModal('jjUploadModal')"><i class="ph ph-x"></i></button><h2>Add Memory</h2><form id="jjMemoryUploadForm" class="jj-upload-form"><label>Album / Trip<select id="jjMemoryTrip" required></select></label><label>Photo (JPEG, PNG or WebP, up to 5MB)<input type="file" id="jjMemoryFile" accept="image/jpeg,image/png,image/webp" required></label><label>Caption<input id="jjMemoryCaption" maxlength="300" required placeholder="Best sunset together"></label><button type="submit" class="btn primary full" id="jjMemorySubmit">Upload Photo</button></form></div></div>`);
 const add=document.querySelector('.page-head button[onclick^="demoToast"]');if(add){add.onclick=()=>openMemoryUploader();add.disabled=!tripCache.length;}
 const upload=document.getElementById('jjMemoryUploadForm');upload?.addEventListener('submit',async event=>{
  event.preventDefault();const file=document.getElementById('jjMemoryFile').files[0],tripId=document.getElementById('jjMemoryTrip').value,caption=document.getElementById('jjMemoryCaption').value.trim();
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){demoToast('Select JPEG, PNG or WebP under 5MB');return;}
  const submit=document.getElementById('jjMemorySubmit');submit.disabled=true;
  try{const data=await jjReadFile(file);await apiJson(`/api/trips/${encodeURIComponent(tripId)}/memories`,'POST',{caption,image:data});closeModal('jjUploadModal');upload.reset();jjMemoryFilter=tripId;await loadTripMemories();demoToast('Memory uploaded');}
  catch(e){demoToast(e.message);}finally{submit.disabled=false;}
 });
 document.querySelector('.memory-filter')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-memory-filter]');if(!button)return;jjMemoryFilter=button.dataset.memoryFilter;renderTripMemories();
 });
 document.querySelector('.memory-gallery')?.addEventListener('click',event=>{const card=event.target.closest('[data-memory-id]');if(card)jjShowMemory(card.dataset.memoryId);});
 document.querySelector('.memory-gallery')?.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;const card=event.target.closest('[data-memory-id]');if(card){event.preventDefault();jjShowMemory(card.dataset.memoryId);}});
 const box=document.querySelector('.lightbox-card');box?.insertAdjacentHTML('beforeend','<button type="button" id="jjDeleteMemory" class="btn danger jj-memory-delete">Delete Photo</button>');
 document.getElementById('jjDeleteMemory')?.addEventListener('click',jjDeleteSelectedMemory);
 loadTripMemories().catch(e=>demoToast(e.message));
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
 const del=document.getElementById('jjDeleteMemory');if(del)del.hidden=memory.uploadedBy!==currentId()&&getTripById(memory.tripId)?.role!=='owner';
 document.getElementById('memoryLightbox')?.classList.add('open');
}
async function jjDeleteSelectedMemory(){
 if(!jjMemorySelected||!confirm('Delete this memory photo?'))return;
 try{await apiRequest(`/api/memories/${encodeURIComponent(jjMemorySelected)}`,{method:'DELETE'});document.getElementById('memoryLightbox')?.classList.remove('open');jjMemorySelected='';await loadTripMemories();demoToast('Memory deleted');}
 catch(e){demoToast(e.message);}
}
window.addEventListener('beforeunload',jjRevokeMemoryUrls);
