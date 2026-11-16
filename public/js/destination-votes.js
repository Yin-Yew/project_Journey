/* Shared anonymous destination ballot. Only totals and a user's own choice appear. */
const nextTripState={options:[],myVote:null,totalVotes:0,phase:'upcoming',canAdd:false,canVote:false,canEditSchedule:false,busy:false,loading:false};
const nextTripSafe=value=>escapeHTML(String(value??''));
const nextTripPhaseLabels={upcoming:'ยังไม่เปิดโหวต',active:'กำลังโหวต',ended:'ปิดโหวตแล้ว',closed:'ปิดโหวตแล้ว'};
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
 const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'—';
}
function renderNextTripSchedule(){
 const s=nextTripState,phase=document.getElementById('jjNextPhase');
 if(phase){phase.textContent=nextTripPhaseLabels[s.phase]||'ไม่ทราบสถานะ';phase.className=`pill ${s.phase==='active'?'pink':'soft-pill'}`;}
 document.getElementById('jjNextStart').textContent=nextTripFormat(s.startAt);
 document.getElementById('jjNextEnd').textContent=nextTripFormat(s.endAt);
 const form=document.getElementById('jjNextScheduleForm');form.hidden=!s.canEditSchedule;
 const newRound=document.getElementById('jjNextNewRound');if(newRound)newRound.hidden=!s.canEditSchedule;
 if(s.canEditSchedule){const start=document.getElementById('jjNextRoundStart'),end=document.getElementById('jjNextRoundEnd');
  if(start&&!start.value){const now=new Date();start.value=nextTripLocalInput(now.toISOString());}
  if(end&&!end.value){const week=new Date(Date.now()+7*86400000);end.value=nextTripLocalInput(week.toISOString());}}
 if(s.canEditSchedule && !form.contains(document.activeElement)){
   document.getElementById('jjNextStartInput').value=nextTripLocalInput(s.startAt);
   document.getElementById('jjNextEndInput').value=nextTripLocalInput(s.endAt);
 }
 const hint=document.getElementById('jjNextScheduleHint');
 hint.textContent=s.phase==='upcoming'?'ยังไม่ถึงเวลาเปิดโหวต เพื่อน ๆ เพิ่มสถานที่เตรียมไว้ก่อนได้':
   s.phase==='active'?'เปิดรับคะแนนอยู่ ทุกคนที่มีบัญชีเว็บสามารถโหวตได้':
   'ปิดรับคะแนนแล้ว ดูผลโหวตได้ แต่เปลี่ยนคะแนนหรือเพิ่มสถานที่ไม่ได้';
 if(s.canEditSchedule)hint.textContent+=' · คุณแก้ไขช่วงเวลาได้จากช่องด้านบน';
 const add=document.getElementById('jjNextAddButton'),field=document.getElementById('jjNextDestination');
 add.disabled=!s.canAdd;field.disabled=!s.canAdd;
 if(!s.canAdd)field.placeholder='หมดเวลาเพิ่มสถานที่แล้ว';
}
function renderNextTrip(){
 const {options,myVote,totalVotes,canVote,phase}=nextTripState;
 renderNextTripSchedule();
 const count=document.getElementById('jjNextCount');
 if(count)count.textContent=`${options.length} สถานที่ · ${totalVotes} คะแนน · โหวตไม่เปิดเผยชื่อ`;
 const list=document.getElementById('jjNextList');if(!list)return;
 if(!options.length){list.innerHTML='<div class="card jj-next-empty"><i class="ph-duotone ph-map-pin-line"></i><h3>ยังไม่มีสถานที่ในรายการ</h3><p>เพิ่มสถานที่แรกที่อยากไปกับเพื่อน ๆ ได้เลย!</p></div>';return;}
 const highest=Math.max(0,...options.map(o=>o.votes));
 list.innerHTML=options.map(item=>{
   const mine=myVote===item.id;
   const percent=totalVotes?Math.round(item.votes/totalVotes*100):0;
   const leader=highest>0 && item.votes===highest;
   const label=mine?'โหวตแล้ว · ยกเลิกได้':phase==='upcoming'?'รอเปิดโหวต':canVote?'โหวตที่นี่':'ปิดรับโหวต';
   return `<article class="card jj-next-place ${mine?'is-mine':''}">
     <div class="jj-next-place-main"><div class="jj-next-place-heading"><span class="jj-next-pin"><i class="ph-duotone ph-map-pin"></i></span><h3>${nextTripSafe(item.name)}</h3></div>
       ${leader?'<span class="pill pink"><i class="ph-fill ph-crown"></i> คะแนนนำ</span>':''}</div>
     <div class="jj-next-place-votes"><strong>${item.votes} <small>คะแนน</small></strong><span>${percent}%</span></div>
     <div class="jj-next-progress" role="progressbar" aria-label="คะแนนโหวต ${nextTripSafe(item.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div style="width:${percent}%"></div></div>
     <div class="jj-next-card-bottom"><small class="jj-next-anonymous"><i class="ph-duotone ph-lock-key"></i> ไม่แสดงชื่อผู้โหวต</small>
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
 }catch(error){if(!quiet){nextTripMessage(error.message,true);document.getElementById('jjNextList').innerHTML='<p class="jj-loading">โหลดข้อมูลไม่สำเร็จ ลองกดรีเฟรชอีกครั้ง</p>';}}
 finally{nextTripState.loading=false;}
}
async function submitNextTrip(event){
 event.preventDefault();if(nextTripState.busy||!nextTripState.canAdd)return;
 const form=event.currentTarget,field=form.elements.name,name=field.value.trim();
 if(name.length<2){nextTripMessage('กรุณากรอกชื่อสถานที่อย่างน้อย 2 ตัวอักษร',true);field.focus();return;}
 nextTripState.busy=true;const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
 try{await apiJson('/api/next-trip/destinations','POST',{name});field.value='';nextTripMessage(`เพิ่ม ${name} แล้ว!`);}
 catch(error){nextTripMessage(error.message,true);}
 finally{nextTripState.busy=false;submit.disabled=!nextTripState.canAdd;}
 await loadNextTrip(true);
}
async function selectNextTrip(event){
 const button=event.target.closest('[data-next-vote]');
 if(!button||nextTripState.busy||!nextTripState.canVote)return;
 const id=button.dataset.nextVote;nextTripState.busy=true;button.disabled=true;
 try{
   if(nextTripState.myVote===id){await apiRequest('/api/next-trip/vote',{method:'DELETE'});nextTripMessage('ยกเลิกคะแนนแล้ว');}
   else{await apiJson('/api/next-trip/vote','PUT',{optionId:id});nextTripMessage('โหวตเรียบร้อย! เพื่อนคนอื่นจะไม่เห็นว่าคุณเลือกที่ไหน');}
 }catch(error){nextTripMessage(error.message,true);}
 finally{nextTripState.busy=false;button.disabled=false;}
 await loadNextTrip(true);
}
async function saveNextTripSchedule(event){
 event.preventDefault();if(nextTripState.busy||!nextTripState.canEditSchedule)return;
 const start=document.getElementById('jjNextStartInput').value,end=document.getElementById('jjNextEndInput').value;
 if(!start||!end||new Date(end)<=new Date(start)){nextTripMessage('เวลาโหวตสิ้นสุดต้องอยู่หลังเวลาเริ่ม',true);return;}
 const button=event.currentTarget.querySelector('button[type="submit"]');nextTripState.busy=true;button.disabled=true;
 try{await apiJson('/api/next-trip/schedule','PUT',{startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString()});nextTripMessage('บันทึกช่วงเวลาโหวตแล้ว');}
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
   return `<details class="card jj-history-card"><summary><strong>${nextTripFormat(round.startAt)} – ${nextTripFormat(round.endAt)}</strong><span>${round.totalVotes} คะแนน · ${round.options.length} สถานที่</span></summary>
    <div class="jj-history-options">${round.options.length?round.options.map(o=>`<p>${nextTripSafe(o.name)} <strong>${o.votes} คะแนน</strong>${winner&&o.votes===winner?' · อันดับ 1':''}</p>`).join(''):'<p>ไม่มีสถานที่ที่ถูกเสนอ</p>'}</div></details>`;
  }).join(''):'<p class="jj-next-guide">ยังไม่มีประวัติรอบโหวต</p>';
 }catch(e){host.textContent='โหลดประวัติไม่ได้: '+e.message;}
}
async function startNextTripRound(event){
 event.preventDefault();if(nextTripState.busy||!nextTripState.canEditSchedule)return;
 const start=document.getElementById('jjNextRoundStart').value,end=document.getElementById('jjNextRoundEnd').value;
 if(!start||!end||new Date(end)<=new Date(start)||new Date(end)<=new Date()){
  nextTripMessage('กำหนดช่วงเวลารอบใหม่ให้ถูกต้อง และวันสิ้นสุดต้องยังไม่ผ่านไป',true);return;
 }
 if(!confirm('เริ่มรอบใหม่ตอนนี้? ระบบจะปิดการโหวตรอบเดิมและเก็บผลไว้ในประวัติ'))return;
 nextTripState.busy=true;
 try{
  await apiJson('/api/next-trip/rounds','POST',{startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString()});
  nextTripMessage('สร้างรอบโหวตใหม่แล้ว! ผลคะแนนรอบก่อนยังอยู่ในประวัติ');
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
 loadNextTrip();loadNextTripHistory();
 setInterval(()=>{if(document.visibilityState==='visible')loadNextTrip(true);},15000);
}
