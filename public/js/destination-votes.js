/* Shared anonymous destination ballot. Only totals and a user's own choice appear. */
const nextTripState={options:[],myVote:null,totalVotes:0,phase:'upcoming',canAdd:false,canVote:false,canEditSchedule:false,busy:false,loading:false,startAt:null,endAt:null};
const nextTripSafe=value=>escapeHTML(String(value??''));
const nextTripPhaseLabels={upcoming:'Voting opens soon',active:'Voting is live',ended:'Voting ended',closed:'Voting closed'};
let nextTripCountdownTimer=null;

function nextTripMessage(message,error=false){
 const el=document.getElementById('jjNextMessage');if(!el)return;
 el.textContent=message;el.className=error?'jj-next-message error':'jj-next-message';
}
function nextTripLocalInput(value){
 const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';
 const n=x=>String(x).padStart(2,'0');
 return `${d.getFullYear()}-${n(d.getMonth()+1)}-${n(d.getDate())}T${n(d.getHours())}:${n(d.getMinutes())}`;
}
function nextTripFormat(value){
 const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'—';
}
function nextTripVoteLabel(count){return `${count} ${count===1?'vote':'votes'}`;}
function nextTripCountdownText(){
 const now=Date.now();
 const start=new Date(nextTripState.startAt||'').getTime();
 const end=new Date(nextTripState.endAt||'').getTime();
 const formatDistance=(ms,prefix)=>{
  const totalMinutes=Math.max(0,Math.floor(ms/60000));
  const days=Math.floor(totalMinutes/1440);
  const hours=Math.floor((totalMinutes%1440)/60);
  const minutes=totalMinutes%60;
  if(days>0)return `${prefix} ${days} day${days===1?'':'s'}${hours?` ${hours} hr`:''}`;
  if(hours>0)return `${prefix} ${hours} hr${hours===1?'':'s'}${minutes?` ${minutes} min`:''}`;
  return `${prefix} ${minutes} min`;
 };
 if(Number.isFinite(start) && nextTripState.phase==='upcoming')return formatDistance(start-now>0?start-now:0,'Starts in');
 if(Number.isFinite(end) && nextTripState.phase==='active')return formatDistance(end-now>0?end-now:0,'Ends in');
 if(nextTripState.phase==='ended' || nextTripState.phase==='closed')return 'Voting has ended';
 return 'Schedule not set';
}
function syncNextTripCountdown(){
 const el=document.getElementById('jjNextCountdown');if(!el)return;
 el.textContent=nextTripCountdownText();
}
function ensureNextTripCountdown(){
 if(nextTripCountdownTimer)clearInterval(nextTripCountdownTimer);
 syncNextTripCountdown();
 nextTripCountdownTimer=setInterval(syncNextTripCountdown,60000);
}
function renderNextTripSchedule(){
 const s=nextTripState,phase=document.getElementById('jjNextPhase');
 if(phase){phase.textContent=nextTripPhaseLabels[s.phase]||'Unknown status';phase.className=`pill ${s.phase==='active'?'pink':'soft-pill'}`;}
 document.getElementById('jjNextStart').textContent=nextTripFormat(s.startAt);
 document.getElementById('jjNextEnd').textContent=nextTripFormat(s.endAt);
 const form=document.getElementById('jjNextScheduleForm');
 const toggle=document.getElementById('jjNextToggleSchedule');
 const newRound=document.getElementById('jjNextNewRound');
 if(toggle)toggle.hidden=!s.canEditSchedule;
 if(form && form.hidden===false && s.canEditSchedule && !form.contains(document.activeElement)){
   document.getElementById('jjNextStartInput').value=nextTripLocalInput(s.startAt);
   document.getElementById('jjNextEndInput').value=nextTripLocalInput(s.endAt);
 }
 if(s.canEditSchedule){
   const start=document.getElementById('jjNextRoundStart'),end=document.getElementById('jjNextRoundEnd');
   if(start&&!start.value){const now=new Date();start.value=nextTripLocalInput(now.toISOString());}
   if(end&&!end.value){const week=new Date(Date.now()+7*86400000);end.value=nextTripLocalInput(week.toISOString());}
 }
 if(newRound)newRound.hidden=!s.canEditSchedule;
 const hint=document.getElementById('jjNextScheduleHint');
 if(hint){
  hint.textContent=s.phase==='upcoming'
   ? 'Members can add places now. Voting will open automatically at the scheduled time.'
   : s.phase==='active'
   ? 'Voting is open. Each member can keep one anonymous vote active at a time.'
   : 'Voting is closed. You can still view the results and voting history.';
 }
 const add=document.getElementById('jjNextAddButton'),field=document.getElementById('jjNextDestination');
 if(add)add.disabled=!s.canAdd;
 if(field){field.disabled=!s.canAdd;field.placeholder=s.canAdd?'e.g. Chiang Mai, Japan, Phuket…':'Adding new places is closed';}
 ensureNextTripCountdown();
}
function renderNextTrip(){
 const {options,myVote,totalVotes,canVote,phase}=nextTripState;
 renderNextTripSchedule();
 const count=document.getElementById('jjNextCount');
 if(count)count.textContent=`${options.length} ${options.length===1?'place':'places'} · ${totalVotes} ${totalVotes===1?'vote':'votes'} · Anonymous voting`;
 const list=document.getElementById('jjNextList');if(!list)return;
 if(!options.length){list.innerHTML='<div class="card jj-next-empty"><i class="ph-duotone ph-map-pin-line"></i><h3>No places yet</h3><p>Add the first place your group should vote on.</p></div>';return;}
 const highest=Math.max(0,...options.map(o=>o.votes));
 list.innerHTML=options.map(item=>{
   const mine=myVote===item.id;
   const percent=totalVotes?Math.round(item.votes/totalVotes*100):0;
   const leader=highest>0 && item.votes===highest;
   const label=mine?'Voted · Remove vote':phase==='upcoming'?'Voting opens soon':canVote?'Vote here':'Voting closed';
   return `<article class="card jj-next-place ${mine?'is-mine':''}">
     <div class="jj-next-place-main"><div class="jj-next-place-heading"><span class="jj-next-pin"><i class="ph-duotone ph-map-pin"></i></span><h3>${nextTripSafe(item.name)}</h3></div>
       ${leader?'<span class="pill pink"><i class="ph-fill ph-crown"></i> Top votes</span>':''}</div>
     <div class="jj-next-place-votes"><strong>${item.votes}</strong><small>${nextTripVoteLabel(item.votes)}</small></div>
     <div class="jj-next-progress" role="progressbar" aria-label="Votes for ${nextTripSafe(item.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div style="width:${percent}%"></div></div>
     <div class="jj-next-card-bottom"><small class="jj-next-anonymous"><i class="ph-duotone ph-lock-key"></i> Anonymous vote</small>
       <button type="button" class="btn ${mine?'soft':'primary'} jj-next-vote-button" data-next-vote="${nextTripSafe(item.id)}" ${canVote?'':'disabled'} aria-label="${nextTripSafe(label)} ${nextTripSafe(item.name)}"><i class="ph-bold ${mine?'ph-check':'ph-hand-pointing'}"></i> ${nextTripSafe(label)}</button></div>
   </article>`;
 }).join('');
}
async function loadNextTrip(quiet=false){
 if(nextTripState.busy||nextTripState.loading)return;
 nextTripState.loading=true;
 try{
   const data=await apiRequest('/api/next-trip');
   Object.assign(nextTripState,{options:data.options||[],myVote:data.myVote||null,totalVotes:Number(data.totalVotes||0),
      phase:data.phase||'upcoming',canAdd:!!data.canAdd,canVote:!!data.canVote,
      canEditSchedule:!!data.canEditSchedule,startAt:data.startAt,endAt:data.endAt});
   renderNextTrip();if(!quiet)nextTripMessage('');
 }catch(error){if(!quiet){nextTripMessage(error.message,true);document.getElementById('jjNextList').innerHTML='<p class="jj-loading">Could not load places. Please refresh and try again.</p>';}}
 finally{nextTripState.loading=false;}
}
async function submitNextTrip(event){
 event.preventDefault();if(nextTripState.busy||!nextTripState.canAdd)return;
 const form=event.currentTarget,field=form.elements.name,name=field.value.trim();
 if(name.length<2){nextTripMessage('Please enter at least 2 characters for the place name.',true);field.focus();return;}
 nextTripState.busy=true;const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
 try{await apiJson('/api/next-trip/destinations','POST',{name});field.value='';nextTripMessage(`Added ${name}.`);}
 catch(error){nextTripMessage(error.message,true);}
 finally{nextTripState.busy=false;submit.disabled=!nextTripState.canAdd;}
 await loadNextTrip(true);
}
async function selectNextTrip(event){
 const button=event.target.closest('[data-next-vote]');
 if(!button||nextTripState.busy||!nextTripState.canVote)return;
 const id=button.dataset.nextVote;nextTripState.busy=true;button.disabled=true;
 try{
   if(nextTripState.myVote===id){await apiRequest('/api/next-trip/vote',{method:'DELETE'});nextTripMessage('Your vote has been removed.');}
   else{await apiJson('/api/next-trip/vote','PUT',{optionId:id});nextTripMessage('Vote saved. Other members cannot see which place you chose.');}
 }catch(error){nextTripMessage(error.message,true);}
 finally{nextTripState.busy=false;button.disabled=false;}
 await loadNextTrip(true);
}
async function saveNextTripSchedule(event){
 event.preventDefault();if(nextTripState.busy||!nextTripState.canEditSchedule)return;
 const start=document.getElementById('jjNextStartInput').value,end=document.getElementById('jjNextEndInput').value;
 if(!start||!end||new Date(end)<=new Date(start)){nextTripMessage('The end time must be later than the start time.',true);return;}
 const button=event.currentTarget.querySelector('button[type="submit"]');nextTripState.busy=true;button.disabled=true;
 try{await apiJson('/api/next-trip/schedule','PUT',{startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString()});nextTripMessage('Voting schedule updated.');}
 catch(error){nextTripMessage(error.message,true);}
 finally{nextTripState.busy=false;button.disabled=false;}
 await loadNextTrip(true);
}
async function loadNextTripHistory(){
 const host=document.getElementById('jjNextHistory');if(!host)return;
 try{
  const {history=[]}=await apiRequest('/api/next-trip/history');
  host.innerHTML=history.length?history.map(round=>{
   const winner=Math.max(0,...round.options.map(o=>o.votes));
   return `<details class="card jj-history-card"><summary><strong>${nextTripFormat(round.startAt)} – ${nextTripFormat(round.endAt)}</strong><span>${round.totalVotes} ${round.totalVotes===1?'vote':'votes'} · ${round.options.length} ${round.options.length===1?'place':'places'}</span></summary>
    <div class="jj-history-options">${round.options.length?round.options.map(o=>`<p>${nextTripSafe(o.name)} <strong>${o.votes} ${o.votes===1?'vote':'votes'}</strong>${winner&&o.votes===winner?' · Winner':''}</p>`).join(''):'<p>No places were suggested in this round.</p>'}</div></details>`;
  }).join(''):'<p class="jj-next-guide">No previous voting rounds yet.</p>';
 }catch(e){host.textContent='Could not load voting history: '+e.message;}
}
async function startNextTripRound(event){
 event.preventDefault();if(nextTripState.busy||!nextTripState.canEditSchedule)return;
 const start=document.getElementById('jjNextRoundStart').value,end=document.getElementById('jjNextRoundEnd').value;
 if(!start||!end||new Date(end)<=new Date(start)||new Date(end)<=new Date()){
  nextTripMessage('Please choose a valid time range for the new round. The end time must still be in the future.',true);return;
 }
 if(!confirm('Start a new voting round now? The current round will be archived in voting history.'))return;
 nextTripState.busy=true;
 try{
  await apiJson('/api/next-trip/rounds','POST',{startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString()});
  nextTripMessage('A new voting round has been created.');
  document.getElementById('jjNextNewRound').open=false;
 }catch(e){nextTripMessage(e.message,true);}finally{nextTripState.busy=false;}
 await loadNextTrip(true);await loadNextTripHistory();
}
function initDestinationVoting(){
 if(!document.getElementById('jjVotingPage'))return;
 document.getElementById('jjNextForm').addEventListener('submit',submitNextTrip);
 document.getElementById('jjNextList').addEventListener('click',selectNextTrip);
 document.getElementById('jjNextScheduleForm').addEventListener('submit',saveNextTripSchedule);
 document.getElementById('jjNextRoundForm')?.addEventListener('submit',startNextTripRound);
 document.getElementById('jjNextRefresh').addEventListener('click',()=>loadNextTrip());
 document.getElementById('jjNextToggleSchedule')?.addEventListener('click',()=>{
   const form=document.getElementById('jjNextScheduleForm');
   if(!form)return;
   form.hidden=!form.hidden;
   const btn=document.getElementById('jjNextToggleSchedule');
   if(btn)btn.innerHTML=form.hidden?'<i class="ph-duotone ph-clock"></i> Set voting time':'<i class="ph-duotone ph-x"></i> Close time settings';
 });
 loadNextTrip();loadNextTripHistory();
 setInterval(()=>{if(document.visibilityState==='visible')loadNextTrip(true);},15000);
}
