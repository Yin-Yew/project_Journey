/* JoyJourney Planner + Places enhancements. Data persists in this browser via localStorage. */
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaultTrips = [
    {id:'samet',name:'Koh Samet Getaway',startDate:'2026-10-10',endDate:'2026-10-12',cover:'https://images.pexels.com/photos/28581877/pexels-photo-28581877.jpeg?auto=compress&cs=tinysrgb&w=1200'},
    {id:'bkk',name:'Bangkok Weekend',startDate:'2026-11-28',endDate:'2026-11-29',cover:'https://images.pexels.com/photos/20020757/pexels-photo-20020757.jpeg?auto=compress&cs=tinysrgb&w=1200'}
  ];
  const trips = () => [...defaultTrips.filter(t => !read('joyjourneyDeletedTrips',[]).includes(t.id)), ...read('joyjourneyTrips',[])];
  const dayCount = trip => Math.max(1, Math.min(31, Math.round((new Date(trip.endDate+'T00:00:00')-new Date(trip.startDate+'T00:00:00'))/86400000)+1 || 1));
  const tripName = id => trips().find(t=>String(t.id)===String(id))?.name || id;
  const currentUser = () => localStorage.getItem('joyjourneyUsername') || localStorage.getItem('username') || read('joyjourneyUser',{}).username || read('joyjourneyUser',{}).name || 'Yin';
  let activeDay = {};

  function getActivities(id) { return read('joyjourneyPlannerActivities', {})[id] || []; }
  function saveActivities(id, list) { const all=read('joyjourneyPlannerActivities',{}); all[id]=list; write('joyjourneyPlannerActivities',all); updateActivityCounts(id); }
  function updateActivityCounts(id) {
    const count=getActivities(id).length;
    $$('[data-trip-panel][data-trip-id="'+CSS.escape(String(id))+'"]').forEach(panel=>{
      const badge=$('[data-activity-count]',panel); if(badge) badge.textContent=count;
    });
    const detailId=new URLSearchParams(location.search).get('trip') || 'samet';
    const detail=$('#tripActivitiesDetail'); if(detail && String(detailId)===String(id)) detail.textContent=count;
    $$('[data-trip-id="'+CSS.escape(String(id))+'"][data-overview-activity-count]').forEach(el=>el.textContent=count);
  }
  function migratePlanner() {
    const all=read('joyjourneyPlannerActivities',{}); let changed=false;
    $$('[data-trip-panel="planner"]').forEach(panel=>{
      const id=panel.dataset.tripId; if(all[id]) return;
      const timeline=$('.timeline',panel); if(!timeline) return;
      const items=$$('.timeline-item',timeline).map((item,i)=>({id:'a-'+Date.now()+'-'+i,day:1,time:$('.timeline-item time',item)?.textContent.trim()||'09:00',title:$('h3',item)?.textContent.trim()||'Activity',location:'',$note:$('.activity p',item)?.textContent.trim()||'',details:$('.activity p',item)?.textContent.trim()||''}));
      all[id]=items; changed=true;
    });
    if(changed) write('joyjourneyPlannerActivities',all);
  }
  function ensurePlannerModal() {
    if($('#activityModal')) return;
    document.body.insertAdjacentHTML('beforeend',`<div class="jj-modal-backdrop" id="activityModal" role="dialog" aria-modal="true" aria-labelledby="activityModalTitle"><form class="jj-modal" id="activityForm"><div class="jj-modal-head"><h2 id="activityModalTitle">Add activity</h2><button type="button" class="jj-close" data-close="activityModal" aria-label="Close">×</button></div><input type="hidden" name="tripId"><input type="hidden" name="activityId"><label>Activity name<input name="title" required maxlength="120" placeholder="e.g. Visit the beach"></label><div class="jj-form-row"><label>Day<select name="day" required></select></label><label>Time<input name="time" type="time" required value="09:00"></label></div><label>Place<input name="location" maxlength="180" placeholder="Location or address"></label><label>Details<textarea name="details" rows="3" placeholder="What will you do?"></textarea></label><div class="jj-modal-actions"><button type="button" class="btn" data-close="activityModal">Cancel</button><button type="submit" class="btn primary">Save activity</button></div></form></div>`);
    $('#activityForm').addEventListener('submit', saveActivityForm);
  }
  function openActivityForm(tripId, activity=null) {
    ensurePlannerModal(); const form=$('#activityForm'); form.reset();
    form.elements.tripId.value=tripId; form.elements.activityId.value=activity?.id||'';
    form.elements.title.value=activity?.title||''; form.elements.day.innerHTML=Array.from({length:dayCount(trips().find(t=>String(t.id)===String(tripId))||{startDate:'2026-01-01',endDate:'2026-01-01'})},(_,i)=>`<option value="${i+1}">Day ${i+1}</option>`).join('');
    form.elements.day.value=String(activity?.day||activeDay[tripId]||1); form.elements.time.value=activity?.time||'09:00'; form.elements.location.value=activity?.location||''; form.elements.details.value=activity?.details||'';
    $('#activityModalTitle').textContent=activity?'Edit activity':'Add activity'; $('#activityModal').classList.add('open');
  }
  function saveActivityForm(e) {
    e.preventDefault(); const f=e.currentTarget, id=f.elements.tripId.value, actId=f.elements.activityId.value;
    const list=getActivities(id); const item={id:actId||'activity-'+Date.now(),day:Number(f.elements.day.value),time:f.elements.time.value,title:f.elements.title.value.trim(),location:f.elements.location.value.trim(),details:f.elements.details.value.trim()};
    if(!item.title) return;
    const index=list.findIndex(a=>a.id===actId); if(index>=0) list[index]=item; else list.push(item);
    list.sort((a,b)=>a.day-b.day || a.time.localeCompare(b.time)); saveActivities(id,list); renderPlanner(); $('#activityModal').classList.remove('open'); toast('Activity saved');
  }
  function toast(message) { if(typeof window.demoToast==='function') window.demoToast(message); else { let el=$('#toast'); if(el){el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800);} } }
  function renderPlanner() {
    $$('[data-trip-panel="planner"]').forEach(panel=>{
      const id=panel.dataset.tripId; const trip=trips().find(t=>String(t.id)===String(id)); if(!trip) return;
      const count=dayCount(trip); let tabs=$('.day-tabs',panel); if(!tabs){ const head=$('.trip-section-head',panel); if(head){tabs=document.createElement('div');tabs.className='day-tabs';head.insertAdjacentElement('afterend',tabs);} }
      if(tabs) tabs.innerHTML=Array.from({length:count},(_,i)=>`<button type="button" class="${(activeDay[id]||1)===i+1?'active':''}" data-day="${i+1}">Day ${i+1}</button>`).join('');
      let timeline=$('.timeline',panel); if(!timeline){timeline=document.createElement('section');timeline.className='timeline';panel.appendChild(timeline);}
      const list=getActivities(id).filter(a=>Number(a.day||1)===(activeDay[id]||1)).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
      timeline.innerHTML=list.length?list.map(a=>`<article class="timeline-item jj-activity-item"><time>${esc(a.time||'09:00')}</time><div class="card activity"><span class="activity-icon lavender"><i class="ph-duotone ph-sparkle"></i></span><div class="jj-activity-copy"><h3>${esc(a.title)}</h3>${a.location?`<p><i class="ph ph-map-pin"></i> ${esc(a.location)}</p>`:''}${a.details?`<p>${esc(a.details)}</p>`:''}</div><div class="jj-item-actions"><button type="button" class="jj-small-btn" data-edit-activity="${esc(a.id)}" data-trip="${esc(id)}">Edit</button><button type="button" class="jj-small-btn danger" data-delete-activity="${esc(a.id)}" data-trip="${esc(id)}">Delete</button></div></div></article>`).join(''):`<div class="module-empty"><i class="ph-duotone ph-calendar-plus"></i><h3>No activities for Day ${activeDay[id]||1}</h3><p>Add an activity to start planning this day.</p></div>`;
      const h2=$('h2',panel); if(h2){let counter=$('[data-activity-count]',panel);if(!counter){counter=document.createElement('span');counter.className='jj-count';counter.innerHTML='Activities: <b data-activity-count>0</b>';h2.insertAdjacentElement('afterend',counter);}counter.querySelector('[data-activity-count]').textContent=getActivities(id).length;}
      updateActivityCounts(id);
    });
  }
  function initPlaces() {
    const content=$('.content'); if(!content || !location.pathname.endsWith('places.html')) return;
    const head=$('.page-head'); if(head){let select=$('#jjPlaceTrip'); if(!select){const wrap=document.createElement('div');wrap.className='jj-place-toolbar';wrap.innerHTML=`<label for="jjPlaceTrip">Trip</label><select id="jjPlaceTrip"></select><span class="jj-place-hint">Places and votes are saved per trip.</span>`;head.insertAdjacentElement('afterend',wrap);select=$('#jjPlaceTrip');select.addEventListener('change',renderPlaces);} }
    if(!$('#placeModal')) document.body.insertAdjacentHTML('beforeend',`<div class="jj-modal-backdrop" id="placeModal" role="dialog" aria-modal="true"><form class="jj-modal" id="placeForm"><div class="jj-modal-head"><h2 id="placeModalTitle">Add place</h2><button type="button" class="jj-close" data-close="placeModal">×</button></div><input type="hidden" name="id"><label>Trip<select name="tripId" required></select></label><label>Place name<input name="name" required maxlength="120"></label><label>Type<select name="type"><option>Attraction</option><option>Restaurant</option><option>Cafe</option><option>Beach</option><option>Viewpoint</option><option>Activity</option><option>Other</option></select></label><label>Image URL<input name="image" type="url" placeholder="https://…"></label><label>Or upload an image<input name="file" type="file" accept="image/*"></label><label>Description<textarea name="description" rows="3"></textarea></label><div class="jj-modal-actions"><button type="button" class="btn" data-close="placeModal">Cancel</button><button class="btn primary" type="submit">Save place</button></div></form></div>`);
    const add=$('.page-head .btn.primary'); if(add){add.onclick=()=>openPlaceForm();}
    $('#placeForm').addEventListener('submit',savePlaceForm);
    const selector=$('#jjPlaceTrip'); if(selector){selector.innerHTML=trips().map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join(''); const q=new URLSearchParams(location.search).get('trip'); if(q&&trips().some(t=>String(t.id)===q))selector.value=q;}
    // Seed the original demo cards once so the existing visual content is retained.
    const existing=read('joyjourneyPlaces',null); if(!existing){const seed=[]; $$('.place-card').forEach((card,i)=>{const title=$('h3',card)?.textContent.trim();if(title)seed.push({id:'place-seed-'+i,tripId:'samet',name:title,type:$('.place-info p',card)?.textContent.trim().split('·')[0].trim()||'Attraction',description:$('.place-info p',card)?.textContent.trim()||'',image:$('img',card)?.src||'',votes:Number($('.vote span',card)?.textContent||0),createdBy:'seed'});});write('joyjourneyPlaces',seed);}
    renderPlaces();
  }
  function placeTripId(){return $('#jjPlaceTrip')?.value||'samet';}
  function renderPlaces(){
    if(!location.pathname.endsWith('places.html'))return; const grid=$('.place-grid'); if(!grid)return; const tid=placeTripId(); const all=read('joyjourneyPlaces',[]); const votes=read('joyjourneyPlaceVotes',{}); const user=currentUser();
    const places=all.filter(p=>String(p.tripId)===String(tid));
    grid.innerHTML=places.length?places.map(p=>{const voted=!!votes[p.id]?.includes(user);return `<article class="card place-card"><img alt="${esc(p.name)}" class="place-photo" src="${esc(p.image||'https://images.pexels.com/photos/1005417/pexels-photo-1005417.jpeg?auto=compress&cs=tinysrgb&w=1200')}" onerror="this.src='https://images.pexels.com/photos/1005417/pexels-photo-1005417.jpeg?auto=compress&cs=tinysrgb&w=1200'"><div class="place-info"><span class="jj-place-type">${esc(p.type)}</span><h3>${esc(p.name)}</h3><p>${esc(p.description||'No description added yet.')}</p><div class="jj-place-card-footer"><button type="button" class="vote ${voted?'active':''}" data-vote-place="${esc(p.id)}" ${voted?'disabled':''}><i class="${voted?'ph-fill':'ph'} ph-heart"></i><span>${Number(p.votes||0)}</span><small>${voted?'Voted':'Vote'}</small></button><div class="jj-item-actions"><button type="button" class="jj-small-btn" data-edit-place="${esc(p.id)}">Edit</button><button type="button" class="jj-small-btn danger" data-delete-place="${esc(p.id)}">Delete</button></div></div></div></article>`}).join(''):`<div class="module-empty jj-empty-places"><i class="ph-duotone ph-map-pin"></i><h3>No places for this trip yet</h3><p>Add a destination, restaurant or cafe to get started.</p><button class="btn primary" type="button" id="jjEmptyAdd">Add Place</button></div>`;
    $('#jjEmptyAdd')?.addEventListener('click',()=>openPlaceForm());
  }
  function openPlaceForm(place=null){const form=$('#placeForm'); if(!form)return; form.reset();form.elements.id.value=place?.id||'';form.elements.tripId.innerHTML=trips().map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');form.elements.tripId.value=place?.tripId||placeTripId();form.elements.name.value=place?.name||'';form.elements.type.value=place?.type||'Attraction';form.elements.image.value=place?.image||'';form.elements.description.value=place?.description||'';$('#placeModalTitle').textContent=place?'Edit place':'Add place';$('#placeModal').classList.add('open');}
  async function savePlaceForm(e){e.preventDefault();const f=e.currentTarget;let image=f.elements.image.value.trim();const file=f.elements.file.files[0];if(file){if(file.size>1500000){toast('Please choose an image smaller than 1.5 MB');return;}image=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}const all=read('joyjourneyPlaces',[]);const id=f.elements.id.value;const previous=all.find(p=>p.id===id);const place={id:id||'place-'+Date.now(),tripId:f.elements.tripId.value,name:f.elements.name.value.trim(),type:f.elements.type.value,image:image||previous?.image||'',description:f.elements.description.value.trim(),votes:Number(previous?.votes||0),createdBy:previous?.createdBy||currentUser()};if(!place.name)return;const idx=all.findIndex(p=>p.id===id);if(idx>=0)all[idx]=place;else all.push(place);write('joyjourneyPlaces',all);$('#placeModal').classList.remove('open');if($('#jjPlaceTrip'))$('#jjPlaceTrip').value=place.tripId;renderPlaces();toast('Place saved');}

  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]');if(close){$('#'+close.dataset.close)?.classList.remove('open');return;}
    const tab=e.target.closest('.day-tabs button');if(tab){const panel=tab.closest('[data-trip-panel="planner"]');if(panel){activeDay[panel.dataset.tripId]=Number(tab.dataset.day)||Number(tab.textContent.replace(/\D/g,''))||1;renderPlanner();}return;}
    const edit=e.target.closest('[data-edit-activity]');if(edit){const item=getActivities(edit.dataset.trip).find(a=>a.id===edit.dataset.editActivity);openActivityForm(edit.dataset.trip,item);return;}
    const del=e.target.closest('[data-delete-activity]');if(del&&confirm('Delete this activity?')){saveActivities(del.dataset.trip,getActivities(del.dataset.trip).filter(a=>a.id!==del.dataset.deleteActivity));renderPlanner();toast('Activity deleted');return;}
    const vote=e.target.closest('[data-vote-place]');if(vote){const id=vote.dataset.votePlace,user=currentUser(),votes=read('joyjourneyPlaceVotes',{}),users=votes[id]||[];if(users.includes(user)){toast('You have already voted for this place');return;}votes[id]=[...users,user];write('joyjourneyPlaceVotes',votes);const all=read('joyjourneyPlaces',[]);const p=all.find(x=>x.id===id);if(p)p.votes=Number(p.votes||0)+1;write('joyjourneyPlaces',all);renderPlaces();return;}
    const editP=e.target.closest('[data-edit-place]');if(editP){openPlaceForm(read('joyjourneyPlaces',[]).find(p=>p.id===editP.dataset.editPlace));return;}
    const delP=e.target.closest('[data-delete-place]');if(delP&&confirm('Delete this place and its votes?')){write('joyjourneyPlaces',read('joyjourneyPlaces',[]).filter(p=>p.id!==delP.dataset.deletePlace));const votes=read('joyjourneyPlaceVotes',{});delete votes[delP.dataset.deletePlace];write('joyjourneyPlaceVotes',votes);renderPlaces();toast('Place deleted');}
  });
  window.addActivity=function(){const panel=$('[data-trip-panel="planner"].active');if(!panel){toast('Choose a trip first');return;}openActivityForm(panel.dataset.tripId);};
  document.addEventListener('DOMContentLoaded',()=>{migratePlanner();ensurePlannerModal();renderPlanner();initPlaces();const detail=$('#tripActivitiesDetail');if(detail){const id=new URLSearchParams(location.search).get('trip')||'samet';const saved=read('joyjourneyPlannerActivities',{});if(Object.prototype.hasOwnProperty.call(saved,id))detail.textContent=(saved[id]||[]).length;} });
})();
