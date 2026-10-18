/* JoyJourney database-backed trip application.
   Authentication is handled by the server; no demo trips or localStorage trips are loaded. */
const JJ_TOKEN_KEY='joyjourneyApiToken';
const JJ_COVER_DEFAULT='https://images.pexels.com/photos/28581877/pexels-photo-28581877.jpeg?auto=compress&cs=tinysrgb&w=1200';
let tripCache=[];
let tripModuleCache={};
let tripDetailsCache={};
let currentProfile=null;
let createBusy=false;
let tripModuleWrites={};

async function apiRequest(url,options={}){
  const token=localStorage.getItem(JJ_TOKEN_KEY);
  let response;
  try { response=await fetch(url,{
    ...options,
    headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{}),...(options.headers||{})}
  });} catch {throw new Error('Cannot connect to the server. Is Node.js running?');}
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    if(response.status===401 && !url.includes('/auth/login')){localStorage.removeItem(JJ_TOKEN_KEY);localStorage.removeItem('joyjourneyCurrentUser');if(!/login.html|register.html/.test(location.pathname)) location.href='login.html';}
    throw new Error(payload.error||`Request failed (${response.status}).`);
  }
  return payload;
}
const apiJson=(url,method,body)=>apiRequest(url,{method,body:JSON.stringify(body)});
const currentId=()=>String(currentProfile?.id||'');
function getCurrentUserId(){return currentId();}
function getCurrentUser(){return currentProfile;}
function getStoredTrips(){return tripCache;}
function getTripById(id){return tripCache.find(t=>t.id===String(id))||null;}
function getModuleState(id){return tripModuleCache[String(id)]||{activities:[],checklistItems:[],packing:null};}
function getTripStats(id){const state=getModuleState(id);const items=state.checklistItems||[];return {activities:Number(getTripById(id)?.activityCount ?? (state.activities||[]).length),packingPercent:items.length?Math.round(100*items.filter(i=>i.checked).length/items.length):0};}
function getJoyUsers(){return currentProfile?[currentProfile,...Object.values(tripDetailsCache).flatMap(d=>d.members).filter(m=>m.id!==currentId()).map(m=>({...m}))]:[];}
function getJoyMembers(){return getFinanceMembersFromTrip();}
function getFinanceMembersFromTrip(){
 const id=document.getElementById('expenseTripSelect')?.value || document.querySelector('.finance-panel.active')?.dataset.financePanel || new URLSearchParams(location.search).get('trip') || tripCache[0]?.id;
 return (tripDetailsCache[id]?.members||[currentProfile].filter(Boolean)).map(m=>({...m,avatar:m.avatar||avatarUrl(m.name)}));
}
function getModuleStates(){return tripModuleCache;}
// Legacy activity module compatibility. Checklist uses individual database rows only.
function updateModuleState(id,updater){
 id=String(id);const trip=getTripById(id);
 if(!trip || trip.status==='finished'){demoToast('This trip is finished or unavailable');return getModuleState(id);}
 const old=structuredClone(getModuleState(id));
 const changed=updater(old)||old;
 tripModuleCache[id]=changed;
 tripModuleWrites[id]=(tripModuleWrites[id]||Promise.resolve()).catch(()=>{}).then(()=>apiJson(`/api/trips/${encodeURIComponent(id)}/modules`,'PUT',{activities:changed.activities||[]})).catch(error=>demoToast(error.message));
 return changed;
}
async function refreshChecklistState(id){
 id=String(id);
 const {items}=await apiRequest(`/api/trips/${encodeURIComponent(id)}/checklist`);
 tripModuleCache[id]={...getModuleState(id),checklistItems:items||[]};
 if(typeof renderChecklistPanel==='function')renderChecklistPanel(id);
 return items;
}
async function checklistCreate(id,label){
 await apiJson(`/api/trips/${encodeURIComponent(id)}/checklist`,'POST',{label});
 await refreshChecklistState(id);
}
async function checklistUpdate(id,itemId,changes){
 await apiJson(`/api/trips/${encodeURIComponent(id)}/checklist/${encodeURIComponent(itemId)}`,'PATCH',changes);
 await refreshChecklistState(id);
}
async function checklistDelete(id,itemId){
 await apiRequest(`/api/trips/${encodeURIComponent(id)}/checklist/${encodeURIComponent(itemId)}`,{method:'DELETE'});
 await refreshChecklistState(id);
}
async function loadTrips(){
 const data=await apiRequest('/api/trips');tripCache=data.trips||[];
 const modules=await Promise.all(tripCache.map(async trip=>{
   try {const [mod,detail]=await Promise.all([apiRequest(`/api/trips/${trip.id}/modules`),apiRequest(`/api/trips/${trip.id}`)]);tripDetailsCache[trip.id]=detail;return [trip.id,mod.modules];}
   catch {return [trip.id,{activities:[],checklistItems:[],packing:null}];}
 }));tripModuleCache=Object.fromEntries(modules);
 return tripCache;
}
function safeCover(trip){return /^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(trip.cover||'')?trip.cover:JJ_COVER_DEFAULT;}
function createTripCard(trip){
 const link=document.createElement('a');link.className='trip-card-link active-trip saved-trip';link.dataset.tripId=trip.id;
 link.href=`trip-detail.html?trip=${encodeURIComponent(trip.id)}`;
 link.innerHTML=`<article class="card trip-card"><div class="trip-image-wrap"><img class="cover-image" alt="${escapeHTML(trip.name)} cover" src="${escapeHTML(safeCover(trip))}"><span class="pill ${trip.status==='finished'?'lavender':'pink'} trip-status">${trip.status==='finished'?'Finished':'Active'}</span></div><div class="trip-card-body"><h2>${escapeHTML(trip.name)}</h2><p><i class="ph-duotone ph-map-pin"></i> ${escapeHTML(trip.destination)}</p><p><i class="ph-duotone ph-calendar-blank"></i> ${escapeHTML(formatTripDate(trip.startDate,trip.endDate))}</p><p><i class="ph-duotone ph-users-three"></i> ${trip.memberCount} members · ${escapeHTML(trip.role)}</p><span class="card-enter"><i class="ph ph-arrow-up-right"></i></span></div></article>`;
 return link;
}
function renderStoredTrips(){
 const grid=document.getElementById('activeTrips');if(!grid)return;
 grid.replaceChildren(...tripCache.map(createTripCard));
 const empty=document.getElementById('tripEmpty');if(empty)empty.hidden=tripCache.length>0;
}
function renderStoredTripModules(){
 const configs={planner:plannerPanelMarkup,checklist:checklistPanelMarkup};
 Object.entries(configs).forEach(([group,markup])=>{
 const switcher=document.querySelector(`.trip-switcher[data-trip-group="${group}"]`);
 if(!switcher)return;
 switcher.replaceChildren();
 document.querySelectorAll(`[data-trip-panel="${group}"]`).forEach(panel=>panel.remove());
 const content=document.querySelector('.content');
 tripCache.forEach(trip=>{switcher.insertAdjacentHTML('beforeend',tripSwitchMarkup(trip,group).replaceAll('active-trip',''));content?.insertAdjacentHTML('beforeend',markup(trip));});
 });
 repairTripGroups();selectTripFromQuery();
}
async function createTrip(){
 if(createBusy)return;
 const name=document.getElementById('tripName')?.value.trim();
 const destination=document.getElementById('tripDestination')?.value.trim();
 const startDate=document.getElementById('tripStart')?.value;
 const endDate=document.getElementById('tripEnd')?.value;
 const budget=Number(document.getElementById('tripBudget')?.value||0);
 if(!name||!destination||!startDate||!endDate||endDate<startDate||budget<0){demoToast('Check the trip name, destination, dates and budget');return;}
 createBusy=true;
 try{
 const {trip}=await apiJson('/api/trips','POST',{name,destination,startDate,endDate,budget,cover:pendingTripCover||JJ_COVER_DEFAULT});
 resetTripForm();closeModal('tripModal');location.href=`trip-detail.html?trip=${encodeURIComponent(trip.id)}`;
 }catch(e){demoToast(e.message);}finally{createBusy=false;}
}
async function joinTrip(){
 const input=document.getElementById('joinTripCode');const code=input?.value.trim().toUpperCase();
 if(!code){demoToast('Enter an invite code');return;}
 try{const {trip}=await apiJson('/api/trips/join','POST',{code});location.href=`trip-detail.html?trip=${trip.id}`;}catch(e){demoToast(e.message);}
}
function addJoinUI(){
 const hero=document.querySelector('#activeTrips')?.previousElementSibling;
 if(!hero||document.getElementById('joinTripCode'))return;
 const controls=document.createElement('div');controls.className='join-trip-action';controls.innerHTML='<label for="joinTripCode">Join a trip with invite code</label><div class="jj-inline"><input id="joinTripCode" maxlength="10" placeholder="10-character code" autocomplete="off"/><button class="btn soft" onclick="joinTrip()">Join Trip</button></div>';
 hero.insertAdjacentElement('afterend',controls);
 const subtitle=hero.querySelector('.page-subtitle');if(subtitle)subtitle.textContent='All your active and finished trips, shared with your travel buddies.';
}
function detailId(){return new URLSearchParams(location.search).get('trip')||tripCache[0]?.id||'';}
async function loadStoredTripDetail(){
 const banner=document.getElementById('tripDetailBanner');if(!banner)return;
 const tripId=detailId(),trip=getTripById(tripId);
 if(!trip){location.href='trips.html';return;}
 const {members}=tripDetailsCache[tripId]||await apiRequest(`/api/trips/${tripId}`);
 banner.style.setProperty('--banner',`url("${safeCover(trip).replaceAll('"','%22')}")`);
 banner.querySelector('h1').textContent=trip.name;
 banner.querySelector('p').innerHTML=`<i class="ph-duotone ph-calendar-blank"></i> ${escapeHTML(formatTripDate(trip.startDate,trip.endDate))} <i class="ph-duotone ph-map-pin"></i> ${escapeHTML(trip.destination)}`;
 banner.querySelector('.pill').textContent=trip.status==='finished'?'Finished':'Active';
 document.getElementById('tripInviteCode').textContent=trip.inviteCode||'';
 document.getElementById('tripBudgetDetail').textContent=`฿${trip.budget.toLocaleString()}`;
 document.getElementById('tripActivitiesDetail').textContent=getTripStats(trip.id).activities;
 document.getElementById('tripPackingDetail').textContent=`${getTripStats(trip.id).packingPercent}%`;
 document.getElementById('tripExpenseDetail').textContent=typeof financeSummary==='function'?money(financeSummary(trip.id).total):'฿0';
 [['plannerQuickLink','planner.html'],['placesQuickLink','places.html'],['expensesQuickLink','expenses.html'],['checklistQuickLink','checklist.html']].forEach(([id,page])=>{const link=document.getElementById(id);if(link)link.href=`${page}?trip=${encodeURIComponent(trip.id)}`;});
 const box=document.querySelector('.dashboard-grid .card');if(box){box.querySelectorAll('.member-row').forEach(el=>el.remove());
 members.forEach(member=>{const row=document.createElement('div');row.className='member-row';row.innerHTML=`<span class="member-name"><img class="member-avatar" alt="" src="${escapeHTML(member.avatar||avatarUrl(member.name))}">${escapeHTML(member.name)}</span><span class="pill ${member.role==='owner'?'yellow':'soft-pill'}">${member.role==='owner'?'Owner':'Member'}</span>${trip.role==='owner'&&member.role==='member'?`<button class="btn soft small" data-remove-member="${escapeHTML(member.id)}">Remove</button>`:''}`;box.appendChild(row);});
 box.querySelectorAll('[data-remove-member]').forEach(button=>button.addEventListener('click',()=>removeTripMember(button.dataset.removeMember)));
 }
 const deleteButton=document.querySelector('.trip-detail-actions .danger');if(deleteButton){deleteButton.hidden=trip.role!=='owner';deleteButton.dataset.tripId=trip.id;}
 addTripManagement(trip);document.title=`${trip.name} · JoyJourney`;
}
function addTripManagement(trip){
 const actions=document.querySelector('.trip-detail-actions');if(!actions||document.getElementById('tripManageActions'))return;
 const box=document.createElement('div');box.id='tripManageActions';box.className='jj-management';
 if(trip.role==='owner'){
 box.innerHTML=`<button class="btn soft" onclick="editCurrentTrip()">Edit Trip</button> <button class="btn soft" onclick="toggleTripStatus()">${trip.status==='finished'?'Reopen Trip':'Mark as Finished'}</button><div class="jj-inline"><input id="addMemberEmail" type="email" placeholder="Member email" ${trip.status==='finished'?'disabled':''}/><button class="btn soft" onclick="addTripMember()" ${trip.status==='finished'?'disabled':''}>Add Member</button></div>`;
 }else{box.innerHTML='<button class="btn soft" onclick="leaveTrip()">Leave Trip</button>';}
 actions.appendChild(box);
}
function tripEditor(){
 let modal=document.getElementById('editTripModal');if(modal)return modal;
 modal=document.createElement('div');modal.id='editTripModal';modal.className='modal';
 modal.innerHTML=`<div class="modal-box create-trip-box"><button class="close" onclick="closeModal('editTripModal')">×</button><h2>Edit Trip</h2><label>Trip name <input id="editTripName" maxlength="150"></label><label>Destination <input id="editTripDestination" maxlength="150"></label><div class="form-two"><label>Start date <input type="date" id="editTripStart"></label><label>End date <input type="date" id="editTripEnd"></label></div><label>Budget <input type="number" min="0" id="editTripBudget"></label><label>Cover image URL (optional) <input id="editTripCover" placeholder="https://..."></label><button class="btn primary full" onclick="saveTripEdit()">Save Changes</button></div>`;
 document.body.appendChild(modal);return modal;
}
function editCurrentTrip(){
 const trip=getTripById(detailId());if(!trip||trip.role!=='owner')return;
 tripEditor();[['editTripName',trip.name],['editTripDestination',trip.destination],['editTripStart',trip.startDate],['editTripEnd',trip.endDate],['editTripBudget',trip.budget],['editTripCover',trip.cover.startsWith('https://')?trip.cover:'']].forEach(([id,value])=>document.getElementById(id).value=value);
 openModal('editTripModal');
}
async function saveTripEdit(){
 const id=detailId();const current=getTripById(id);if(!current)return;
 const body={name:document.getElementById('editTripName').value.trim(),destination:document.getElementById('editTripDestination').value.trim(),startDate:document.getElementById('editTripStart').value,endDate:document.getElementById('editTripEnd').value,budget:Number(document.getElementById('editTripBudget').value||0),cover:document.getElementById('editTripCover').value.trim()||current.cover};
 try{await apiJson(`/api/trips/${id}`,'PATCH',body);location.reload();}catch(e){demoToast(e.message);}
}
async function toggleTripStatus(){
 const trip=getTripById(detailId());if(!trip||trip.role!=='owner')return;
 const status=trip.status==='finished'?'active':'finished';
 if(!confirm(`Change status to ${status}?`))return;
 try{await apiJson(`/api/trips/${trip.id}/status`,'PATCH',{status});location.reload();}catch(e){demoToast(e.message);}
}
async function addTripMember(){
 const id=detailId(),email=document.getElementById('addMemberEmail')?.value.trim();
 if(!email){demoToast('Enter a registered member email');return;}
 try{await apiJson(`/api/trips/${id}/members`,'POST',{email});location.reload();}catch(e){demoToast(e.message);}
}
async function removeTripMember(userId){
 if(!confirm('Remove this member from the trip?'))return;
 try{await apiRequest(`/api/trips/${detailId()}/members/${encodeURIComponent(userId)}`,{method:'DELETE'});location.reload();}catch(e){demoToast(e.message);}
}
async function leaveTrip(){
 if(!confirm('Leave this trip?'))return;
 try{await apiRequest(`/api/trips/${detailId()}/members/${currentId()}`,{method:'DELETE'});location.href='trips.html';}catch(e){demoToast(e.message);}
}
function requestDeleteCurrentTrip(){const trip=getTripById(detailId());if(trip?.role==='owner')openModal('deleteTripModal');}
async function confirmDeleteTrip(){
 const id=detailId(),trip=getTripById(id);if(!trip||trip.role!=='owner')return;
 try{await apiRequest(`/api/trips/${id}`,{method:'DELETE'});closeModal('deleteTripModal');location.href='trips.html';}catch(e){demoToast(e.message);}
}
async function authLogin(event){
 event.preventDefault();const message=document.getElementById('loginMessage');
 try{
 const {token,user}=await apiJson('/api/auth/login','POST',{email:document.getElementById('loginEmail').value.trim(),password:document.getElementById('loginPassword').value});
 localStorage.setItem(JJ_TOKEN_KEY,token);currentProfile=user;localStorage.setItem('joyjourneyCurrentUser',user.id);
 location.href='trips.html';
 }catch(e){showAuthMessage(message,e.message,'error');}
}
async function authRegister(event){
 event.preventDefault();const message=document.getElementById('registerMessage');
 const password=document.getElementById('registerPassword').value;
 if(password!==document.getElementById('registerConfirmPassword').value){showAuthMessage(message,'Passwords do not match','error');return;}
 try{
 const {token,user}=await apiJson('/api/auth/register','POST',{name:document.getElementById('registerName').value.trim(),email:document.getElementById('registerEmail').value.trim(),password});
 localStorage.setItem(JJ_TOKEN_KEY,token);currentProfile=user;localStorage.setItem('joyjourneyCurrentUser',user.id);location.href='trips.html';
 }catch(e){showAuthMessage(message,e.message,'error');}
}
function authLogout(){apiRequest('/api/auth/logout',{method:'POST'}).catch(()=>{});localStorage.removeItem(JJ_TOKEN_KEY);localStorage.removeItem('joyjourneyCurrentUser');location.href='login.html';}
async function saveProfile(event){
 event?.preventDefault();if(!currentProfile)return;
 const id=(id)=>document.getElementById(id)?.value.trim()||'';
 try{const {user}=await apiJson('/api/auth/me','PATCH',{name:id('profileName'),email:id('profileEmail'),username:id('profileUsername'),style:id('profileStyle'),promptpay:id('profilePromptPay'),bankName:id('profileBankName'),bankAccount:id('profileBankAccount'),avatar:currentProfile.avatar||''});currentProfile=user;loadProfileForm(user);renderCurrentUserUI(user);demoToast('Profile saved');}catch(e){demoToast(e.message);}
}
function shuffleAvatar(){
 if(!currentProfile)return;currentProfile.avatar=avatarUrl(`${currentProfile.name}-${Date.now()}`);loadProfileForm(currentProfile);demoToast('Save profile to keep this avatar');
}
function renderDashboardTrip(){
 const feature=document.querySelector('.trip-feature');if(!feature)return;
 const trip=tripCache.find(t=>t.status==='active')||tripCache[0];
 if(!trip){feature.href='trips.html';feature.querySelector('h2').textContent='Create your first trip';feature.querySelector('p').textContent='Start planning together';}
 else{
  feature.href=`trip-detail.html?trip=${trip.id}`;
  feature.querySelector('h2').textContent=trip.name;
  feature.querySelector('p').textContent=`${formatTripDate(trip.startDate,trip.endDate)} · ${trip.destination}`;
  feature.querySelector('.mini-trip-photo').src=safeCover(trip);
  feature.querySelector('.pill').textContent=trip.status==='finished'?'Finished':'Active';
  const stack=feature.querySelector('.avatar-stack');if(stack)stack.innerHTML=(tripDetailsCache[trip.id]?.members||[]).slice(0,4).map(m=>`<img class="member-avatar" alt="${escapeHTML(m.name)}" src="${escapeHTML(m.avatar||avatarUrl(m.name))}">`).join('');
 }
 const stats=document.querySelectorAll('.stat-card');
 if(stats[0]){stats[0].querySelector('h2').textContent=trip?`฿${Number(trip.budget).toLocaleString()}`:'฿0';stats[0].querySelector('small').textContent=trip?'Trip budget':'No trips yet';stats[0].querySelector('.progress span').style.width='0%';}
 if(stats[1]){const items=trip?(getModuleState(trip.id).checklistItems||[]):[];stats[1].querySelector('h2').textContent=`${items.filter(i=>i.checked).length} / ${items.length}`;stats[1].querySelector('p:not(.muted)').textContent='Checklist progress';const link=stats[1].querySelector('a');if(link&&trip)link.href=`checklist.html?trip=${trip.id}`;}
 if(stats[2]){stats[2].querySelector('h2').textContent='฿0';stats[2].querySelector('p:not(.muted)').textContent='Open Expenses to manage group costs';const link=stats[2].querySelector('a');if(link&&trip)link.href=`expenses.html?trip=${trip.id}`;}
 const badge=document.querySelector('.hero-badge');if(badge){const strong=badge.querySelector('strong');const small=badge.querySelector('small');if(strong)strong.textContent=trip?.status==='active'?'Active trip':'Plan now';if(small)small.textContent=trip?trip.name:'No upcoming trip';}
}

function addActivity(){
 const panel=document.querySelector('[data-trip-panel="planner"].active');
 if(!panel){demoToast('Choose a trip first');return;}
 const trip=getTripById(panel.dataset.tripId);
 if(!trip||trip.status==='finished'){demoToast('Reopen this trip to edit its plan');return;}
 const title=prompt('Activity name');if(!title?.trim())return;
 const time=prompt('Time (HH:MM)','09:00')||'09:00';
 const note=prompt('Activity details (optional)','')||'';
 panel.querySelector('.module-empty')?.remove();
 const entry={time:time.slice(0,20),title:title.trim().slice(0,150),note:note.slice(0,1000)};
 const item=document.createElement('article');item.className='timeline-item saved-activity';item.innerHTML=activityMarkup(entry);
 panel.querySelector('.timeline')?.appendChild(item);
 updateModuleState(trip.id,state=>{state.activities=[...(state.activities||[]),entry];return state;});
 demoToast('Activity saved');
}
async function addChecklist(){
 const panel=document.querySelector('[data-trip-panel="checklist"].active');
 if(!panel){demoToast('Choose a trip first');return;}
 const trip=getTripById(panel.dataset.tripId);
 if(!trip||trip.status==='finished'){demoToast('Reopen the trip to edit packing');return;}
 const label=prompt('Add a packing item');if(!label?.trim())return;
 try{await checklistCreate(trip.id,label.trim().slice(0,150));demoToast('Item added');}catch(e){demoToast(e.message);}
}
// Checklist is managed by features.js with row-level database requests.
function savePackingFromPanel(){/* Deprecated: do not persist the full list. */}
function connectModuleUI(){/* The checklist controller owns its event listeners. */}
function initJourneySearch(){
 const box=document.querySelector('.search');if(!box)return;
 const input=box.querySelector('input');if(!input)return;
 input.setAttribute('type','search');input.setAttribute('aria-label','Search your trips');
 input.placeholder='Search your trips...';
 const list=document.createElement('div');list.className='jj-search-results';list.setAttribute('role','listbox');list.hidden=true;
 box.style.position='relative';box.appendChild(list);
 const update=()=>{
  const query=input.value.trim().toLocaleLowerCase();
  if(!query){list.hidden=true;list.replaceChildren();return;}
  const matched=tripCache.filter(t=>[t.name,t.destination,t.status].some(v=>String(v||'').toLocaleLowerCase().includes(query))).slice(0,12);
  list.replaceChildren();
  if(!matched.length){const row=document.createElement('p');row.textContent='No matching trips';row.className='jj-search-empty';list.appendChild(row);}
  else matched.forEach(t=>{
   const link=document.createElement('a');link.href=`trip-detail.html?trip=${encodeURIComponent(t.id)}`;
   link.className='jj-search-result';link.setAttribute('role','option');
   const title=document.createElement('strong');title.textContent=t.name;
   const sub=document.createElement('small');sub.textContent=`${t.destination} · ${t.status}`;
   link.append(title,sub);list.appendChild(link);
  });
  list.hidden=false;
 };
 input.addEventListener('input',update);
 input.addEventListener('focus',update);
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape'){list.hidden=true;input.blur();}
  if(event.key==='Enter'&&!list.hidden){const first=list.querySelector('a');if(first){event.preventDefault();location.href=first.href;}}
 });
 document.addEventListener('click',event=>{if(!box.contains(event.target))list.hidden=true;});
}
async function startJoyJourney(){
 loadUISettings();
 if(/(?:login|register)\.html$/.test(location.pathname))return;
 if(!localStorage.getItem(JJ_TOKEN_KEY)){location.replace('login.html');return;}
 try{
 const {user}=await apiRequest('/api/auth/me');currentProfile=user;
 localStorage.setItem('joyjourneyCurrentUser',user.id);
 renderCurrentUserUI(user);loadProfileForm(user);
 await loadTrips();
 initJourneySearch();
 if(typeof loadFinanceFromDatabase==='function')await loadFinanceFromDatabase();
 renderStoredTrips();addJoinUI();renderStoredTripModules();
 if(typeof initTripChecklist==='function')initTripChecklist();
 if(typeof renderFinancePage==='function')renderFinancePage();
 await loadStoredTripDetail();
 if(typeof loadRealDashboard==='function')await loadRealDashboard();
 if(typeof initTripMemories==='function')initTripMemories();
 if(typeof initPlannerPlacesPage==='function')await initPlannerPlacesPage();
 if(typeof initDestinationVoting==='function')initDestinationVoting();
 }catch(e){console.error(e);demoToast(e.message);const content=document.querySelector('.content');if(content){const p=document.createElement('p');p.className='form-message error';p.textContent=e.message;content.prepend(p);}}
}
document.addEventListener('DOMContentLoaded',startJoyJourney);
