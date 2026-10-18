/* Planner and Places: no sample trips, activities, places or vote counts. */
const jjPlan = {tripId:'',day:1,activities:[],loading:0,editId:null};
const jjPlaces = {tripId:'',places:[],loading:0,editId:null,oldImage:''};
const jjIcon = n => `<i class="ph-duotone ph-${n}"></i>`;
const jjSafe = value => escapeHTML(String(value??''));
const jjPlaceType = {attraction:'Attraction',restaurant:'Restaurant',cafe:'Cafe'};
const jjDateForDay = (start,day) => {const d=new Date(`${start}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+day-1);return d.toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'});};
const jjNumberDays = trip => Math.max(1,Math.round((Date.parse(`${trip.endDate}T00:00:00Z`)-Date.parse(`${trip.startDate}T00:00:00Z`))/86400000)+1);
const jjChooseTrip = (node,tripId) => {
 node.replaceChildren();
 if(!tripCache.length){node.add(new Option('No trips yet',''));return '';}
 tripCache.forEach(t=>node.add(new Option(`${t.name} (${t.status==='finished'?'Finished':'Active'})`,t.id)));
 const chosen=tripCache.some(t=>t.id===tripId)?tripId:tripCache[0].id;
 node.value=chosen;return chosen;
};
function jjNoTrips(container){container.innerHTML='<div class="card jj-empty-state"><h3>No trips yet</h3><p>Create or join a trip first to plan activities or save places.</p><a class="btn primary" href="trips.html">Go to My Trips</a></div>';}
function jjWorkspaceError(error){demoToast(error?.message||'Unexpected error');}
function jjShowDialog(id){document.getElementById(id)?.classList.add('open');document.querySelector(`#${id} input:not([type=file])`)?.focus();}
function jjHideDialog(id){document.getElementById(id)?.classList.remove('open');}
function jjInitModals(){
 document.querySelectorAll('[data-jj-close]').forEach(button=>button.addEventListener('click',()=>jjHideDialog(button.dataset.jjClose)));
 for(const id of ['jjActivityModal','jjPlaceModal'])document.getElementById(id)?.addEventListener('click',event=>{if(event.target.id===id)jjHideDialog(id);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')for(const id of ['jjActivityModal','jjPlaceModal'])jjHideDialog(id);});
}
function jjDrawPlanner(){
 const container=document.getElementById('jjPlannerBody'),trip=getTripById(jjPlan.tripId);if(!container)return;
 if(!trip){jjNoTrips(container);return;}
 const days=jjNumberDays(trip);
 if(jjPlan.day>days)jjPlan.day=1;
 const dayList=jjPlan.activities.filter(a=>a.day===jjPlan.day);
 const readOnly=trip.status==='finished';
 document.getElementById('jjAddActivity').disabled=readOnly;
 document.getElementById('jjPlannerSummary').textContent=`${days} day${days===1?'':'s'} · ${jjPlan.activities.length} activit${jjPlan.activities.length===1?'y':'ies'} · ${readOnly?'Finished · read only':'Active'}`;
 container.innerHTML=`<div class="jj-section-heading"><div><span class="pill pink">${jjSafe(trip.name)}</span><h2>Daily itinerary</h2><p>${jjSafe(formatTripDate(trip.startDate,trip.endDate))}</p></div><strong>${jjPlan.activities.length} activities</strong></div>
 <div class="jj-day-tabs" role="tablist" aria-label="Trip days">${Array.from({length:days},(_,n)=>`<button type="button" role="tab" aria-selected="${jjPlan.day===n+1}" class="${jjPlan.day===n+1?'active':''}" data-jj-day="${n+1}">Day ${n+1}<small>${jjSafe(jjDateForDay(trip.startDate,n+1))}</small></button>`).join('')}</div>
 <div class="jj-day-heading"><h3>Day ${jjPlan.day}</h3><span>${dayList.length} activities · ${jjSafe(jjDateForDay(trip.startDate,jjPlan.day))}</span></div>
 <div class="jj-activity-list">${dayList.length?dayList.map((a,i)=>`<article class="jj-activity-row card" data-jj-activity="${a.id}"><time>${jjSafe(a.time)}</time><div class="jj-activity-data"><h3>${jjSafe(a.title)}</h3>${a.location?`<p>${jjIcon('map-pin')} ${jjSafe(a.location)}</p>`:''}${a.details?`<p class="jj-activity-details">${jjSafe(a.details)}</p>`:''}</div>${!readOnly?`<div class="jj-activity-actions"><button type="button" data-jj-move="up" data-jj-id="${a.id}" aria-label="Move ${jjSafe(a.title)} up" ${i===0?'disabled':''}>${jjIcon('arrow-up')}</button><button type="button" data-jj-move="down" data-jj-id="${a.id}" aria-label="Move ${jjSafe(a.title)} down" ${i===dayList.length-1?'disabled':''}>${jjIcon('arrow-down')}</button><button type="button" data-jj-edit-activity="${a.id}" aria-label="Edit ${jjSafe(a.title)}">${jjIcon('pencil')}</button><button type="button" data-jj-delete-activity="${a.id}" aria-label="Delete ${jjSafe(a.title)}">${jjIcon('trash')}</button></div>`:''}</article>`).join(''):`<div class="jj-empty-state">${jjIcon('calendar-plus')}<h3>No activities on Day ${jjPlan.day}</h3><p>${readOnly?'This day had no planned activities.':'Use Add Activity to plan this day.'}</p></div>`}</div>`;
}
async function jjLoadActivities(){
 const id=jjPlan.tripId,container=document.getElementById('jjPlannerBody');if(!id){jjDrawPlanner();return;}
 const seq=++jjPlan.loading;if(container)container.innerHTML='<p class="jj-loading">Loading itinerary…</p>';
 try {const result=await apiRequest(`/api/trips/${encodeURIComponent(id)}/activities`);if(seq!==jjPlan.loading)return;jjPlan.activities=result.activities||[];jjDrawPlanner();}
 catch(e){if(seq===jjPlan.loading){container.innerHTML=`<p class="form-message error">${jjSafe(e.message)}</p>`;jjWorkspaceError(e);}}
}
function jjOpenActivity(id){
 const trip=getTripById(jjPlan.tripId);if(!trip||trip.status==='finished'){demoToast('Finished trips are read-only');return;}
 const a=jjPlan.activities.find(x=>x.id===String(id));jjPlan.editId=a?.id||null;
 const form=document.getElementById('jjActivityForm');form.reset();
 form.elements.title.value=a?.title||'';form.elements.time.value=a?.time||'09:00';form.elements.location.value=a?.location||'';form.elements.details.value=a?.details||'';
 const select=document.getElementById('jjActivityDay');select.replaceChildren();for(let n=1;n<=jjNumberDays(trip);n++)select.add(new Option(`Day ${n} · ${jjDateForDay(trip.startDate,n)}`,String(n)));
 select.value=String(a?.day||jjPlan.day);document.getElementById('jjActivityModalTitle').textContent=a?'Edit Activity':'Add Activity';jjShowDialog('jjActivityModal');
}
async function jjSaveActivity(event){
 event.preventDefault();const form=event.currentTarget,button=document.getElementById('jjActivitySave');
 const data={title:form.elements.title.value.trim(),time:form.elements.time.value,day:Number(form.elements.day.value),location:form.elements.location.value.trim(),details:form.elements.details.value.trim()};
 if(!data.title)return;
 button.disabled=true;
 try{const endpoint=`/api/trips/${encodeURIComponent(jjPlan.tripId)}/activities`;await apiJson(jjPlan.editId?`${endpoint}/${jjPlan.editId}`:endpoint,jjPlan.editId?'PUT':'POST',data);jjPlan.day=data.day;jjHideDialog('jjActivityModal');await jjLoadActivities();demoToast('Activity saved');}
 catch(e){jjWorkspaceError(e);}finally{button.disabled=false;}
}
async function jjHandlePlanClick(event){
 const day=event.target.closest('[data-jj-day]');if(day){jjPlan.day=Number(day.dataset.jjDay);jjDrawPlanner();return;}
 const edit=event.target.closest('[data-jj-edit-activity]');if(edit){jjOpenActivity(edit.dataset.jjEditActivity);return;}
 const del=event.target.closest('[data-jj-delete-activity]');if(del){
  const id=del.dataset.jjDeleteActivity;const a=jjPlan.activities.find(x=>x.id===id);if(!a||!confirm(`Delete "${a.title}"?`))return;
  del.disabled=true;try{await apiRequest(`/api/trips/${encodeURIComponent(jjPlan.tripId)}/activities/${id}`,{method:'DELETE'});await jjLoadActivities();demoToast('Activity deleted');}catch(e){jjWorkspaceError(e);del.disabled=false;}return;
 }
 const move=event.target.closest('[data-jj-move]');if(!move)return;
 const list=jjPlan.activities.filter(a=>a.day===jjPlan.day),from=list.findIndex(a=>a.id===move.dataset.jjId),to=from+(move.dataset.jjMove==='up'?-1:1);
 if(from<0||to<0||to>=list.length)return;
 [list[from],list[to]]=[list[to],list[from]];
 move.disabled=true;
 try{await apiJson(`/api/trips/${encodeURIComponent(jjPlan.tripId)}/activities/reorder/day`,'PUT',{day:jjPlan.day,ids:list.map(a=>a.id)});await jjLoadActivities();demoToast('Order updated');}
 catch(e){await jjLoadActivities();jjWorkspaceError(e);}
}
function jjDrawPlaces(){
 const container=document.getElementById('jjPlacesBody'),trip=getTripById(jjPlaces.tripId);if(!container)return;
 if(!trip){jjNoTrips(container);return;}
 const readOnly=trip.status==='finished';document.getElementById('jjAddPlace').disabled=readOnly;
 document.getElementById('jjPlacesSummary').textContent=`${jjPlaces.places.length} places · ${trip.name} · ${readOnly?'Finished · read only':'Active'}`;
 const cards=jjPlaces.places.map(p=>{
 const editable=!readOnly&&(trip.role==='owner'||p.createdBy===currentId());
 const img=/^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/i.test(p.image)?`<img class="jj-place-photo" alt="${jjSafe(p.name)}" loading="lazy" src="${jjSafe(p.image)}">`:`<div class="jj-place-photo jj-place-no-image">${jjIcon(p.category==='cafe'?'coffee':p.category==='restaurant'?'fork-knife':'map-pin')}</div>`;
 return `<article class="card jj-place-card" data-jj-place="${p.id}">${img}<div class="jj-place-info"><span class="pill mint">${jjSafe(jjPlaceType[p.category]||p.category)}</span><h3>${jjSafe(p.name)}</h3><p>${jjSafe(p.details)}</p><div class="jj-place-actions">${editable?`<button type="button" data-jj-edit-place="${p.id}" aria-label="Edit ${jjSafe(p.name)}">${jjIcon('pencil')}</button><button type="button" data-jj-delete-place="${p.id}" aria-label="Delete ${jjSafe(p.name)}">${jjIcon('trash')}</button>`:''}</div></div></article>`;
 }).join('');
 container.innerHTML=cards?`<div class="jj-place-grid">${cards}</div>`:`<div class="card jj-empty-state">${jjIcon('map-pin')}<h3>No places saved for ${jjSafe(trip.name)}</h3><p>${readOnly?'No places were saved on this trip.':'Save attractions, restaurants and cafes for this trip.'}</p></div>`;
}
async function jjLoadPlaces(){
 const id=jjPlaces.tripId,container=document.getElementById('jjPlacesBody');if(!id){jjDrawPlaces();return;}
 const seq=++jjPlaces.loading;container.innerHTML='<p class="jj-loading">Loading places…</p>';
 try{const response=await apiRequest(`/api/trips/${encodeURIComponent(id)}/places`);if(seq!==jjPlaces.loading)return;jjPlaces.places=response.places||[];jjDrawPlaces();}
 catch(e){if(seq===jjPlaces.loading){container.innerHTML=`<p class="form-message error">${jjSafe(e.message)}</p>`;jjWorkspaceError(e);}}
}
function jjOpenPlace(id){
 const trip=getTripById(jjPlaces.tripId);if(!trip||trip.status==='finished'){demoToast('Finished trips are read-only');return;}
 const p=jjPlaces.places.find(x=>x.id===String(id));jjPlaces.editId=p?.id||null;jjPlaces.oldImage=p?.image||'';
 const form=document.getElementById('jjPlaceForm');form.reset();form.elements.name.value=p?.name||'';form.elements.category.value=p?.category||'attraction';form.elements.details.value=p?.details||'';
 if(p?.image?.startsWith('https://'))form.elements.imageUrl.value=p.image;
 const preview=document.getElementById('jjPlacePreview');preview.hidden=!p?.image;if(p?.image)preview.src=p.image;else preview.removeAttribute('src');
 document.getElementById('jjPlaceModalTitle').textContent=p?'Edit Place':'Add Place';jjShowDialog('jjPlaceModal');
}
function jjReadPlaceImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Could not read image.'));reader.readAsDataURL(file);});}
async function jjSavePlace(event){
 event.preventDefault();const form=event.currentTarget,button=document.getElementById('jjPlaceSave'),file=form.elements.imageFile.files?.[0];button.disabled=true;
 try{
  let image=jjPlaces.oldImage;
  const url=form.elements.imageUrl.value.trim();
  if(url)image=url;
  if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1500000)throw new Error('Please choose a JPEG, PNG or WebP under 1.5 MB.');image=await jjReadPlaceImage(file);}
  const data={name:form.elements.name.value.trim(),category:form.elements.category.value,details:form.elements.details.value.trim(),image};
  const endpoint=`/api/trips/${encodeURIComponent(jjPlaces.tripId)}/places`;
  await apiJson(jjPlaces.editId?`${endpoint}/${jjPlaces.editId}`:endpoint,jjPlaces.editId?'PUT':'POST',data);
  jjHideDialog('jjPlaceModal');await jjLoadPlaces();demoToast('Place saved');
 }catch(e){jjWorkspaceError(e);}finally{button.disabled=false;}
}
async function jjHandlePlaceClick(event){
 const edit=event.target.closest('[data-jj-edit-place]');if(edit){jjOpenPlace(edit.dataset.jjEditPlace);return;}
 const del=event.target.closest('[data-jj-delete-place]');if(del){const id=del.dataset.jjDeletePlace,p=jjPlaces.places.find(x=>x.id===id);if(!p||!confirm(`Delete "${p.name}" from this trip?`))return;
  del.disabled=true;try{await apiRequest(`/api/trips/${encodeURIComponent(jjPlaces.tripId)}/places/${id}`,{method:'DELETE'});await jjLoadPlaces();demoToast('Place deleted');}catch(e){jjWorkspaceError(e);del.disabled=false;}return;}
}
async function initPlannerPlacesPage(){
 const qp=new URLSearchParams(location.search).get('trip');
 if(document.getElementById('jjPlannerPage')){
  jjInitModals();const selector=document.getElementById('jjPlannerTrip');jjPlan.tripId=jjChooseTrip(selector,qp);
  selector.addEventListener('change',async()=>{jjPlan.tripId=selector.value;jjPlan.day=1;history.replaceState(null,'',`planner.html?trip=${encodeURIComponent(jjPlan.tripId)}`);await jjLoadActivities();});
  document.getElementById('jjAddActivity').addEventListener('click',()=>jjOpenActivity());
  document.getElementById('jjActivityForm').addEventListener('submit',jjSaveActivity);
  document.getElementById('jjPlannerBody').addEventListener('click',jjHandlePlanClick);
  await jjLoadActivities();
 }else if(document.getElementById('jjPlacesPage')){
  jjInitModals();const selector=document.getElementById('jjPlacesTrip');jjPlaces.tripId=jjChooseTrip(selector,qp);
  selector.addEventListener('change',async()=>{jjPlaces.tripId=selector.value;history.replaceState(null,'',`places.html?trip=${encodeURIComponent(jjPlaces.tripId)}`);await jjLoadPlaces();});
  document.getElementById('jjAddPlace').addEventListener('click',()=>jjOpenPlace());
  document.getElementById('jjPlaceForm').addEventListener('submit',jjSavePlace);
  document.getElementById('jjPlacesBody').addEventListener('click',jjHandlePlaceClick);
  document.querySelector('#jjPlaceForm [name=imageFile]').addEventListener('change',event=>{const file=event.target.files?.[0];if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1500000){demoToast('Image must be JPEG, PNG or WebP under 1.5 MB');event.target.value='';return;}const url=URL.createObjectURL(file);const img=document.getElementById('jjPlacePreview');img.src=url;img.hidden=false;img.onload=()=>URL.revokeObjectURL(url);}});
  await jjLoadPlaces();
 }
}
