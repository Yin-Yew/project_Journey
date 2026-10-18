/* Independent Next Trip Voting page: polls exist before any trip is created. */
const voteState={polls:[],poll:null,options:[],myVote:null,busy:false};
const pollSafe = text => escapeHTML(String(text??''));
const pollIcon = name => `<i class="ph-duotone ph-${name}"></i>`;
const pollId = () => new URLSearchParams(location.search).get('poll');
const pollToast=message=>demoToast(message);
function pollDialog(id,visible){document.getElementById(id)?.classList.toggle('open',visible);}
function pollError(error){pollToast(error?.message||'Unexpected error');}
const pollGo=id=>{location.href=`voting.html?poll=${encodeURIComponent(id)}`;};
async function refreshPolls(){
 const {polls}=await apiRequest('/api/destination-polls');voteState.polls=polls||[];
 const list=document.getElementById('jjVotePolls');
 list.innerHTML=voteState.polls.length?voteState.polls.map(p=>`<a href="voting.html?poll=${p.id}" class="jj-poll-item ${voteState.poll?.id===p.id?'selected':''}"><span><strong>${pollSafe(p.title)}</strong><small>${p.status==='closed'?'Voting closed':'Open for voting'} · ${p.votes} votes · ${p.options} destinations</small></span><span>${pollIcon('caret-right')}</span></a>`).join(''):'<p class="jj-poll-empty">No public polls yet. Create one for everyone on JoyJourney to vote.</p>';
}
function showPollEmpty(){
 voteState.poll=null;
 document.getElementById('jjVoteDetail').innerHTML=`<div class="card jj-empty-state">${pollIcon('map-pin-line')}<h2>Where should we travel next?</h2><p>Create a poll for everyone on JoyJourney. No invitation code or trip required.</p><button type="button" class="btn primary" id="jjVoteEmptyCreate">Create a Poll</button></div>`;
 document.getElementById('jjVoteEmptyCreate').addEventListener('click',()=>pollDialog('jjPollCreateModal',true));
}
function renderPoll(){
 const {poll,options,myVote}=voteState;if(!poll){showPollEmpty();return;}
 const closed=poll.status==='closed',owner=poll.role==='owner';
 const total=options.reduce((sum,x)=>sum+x.votes,0),high=Math.max(0,...options.map(x=>x.votes));
 const leaders=high>0?options.filter(x=>x.votes===high):[];
 const box=document.getElementById('jjVoteDetail');
 box.innerHTML=`<div class="card jj-poll-header">
 <div class="jj-poll-title"><span class="pill ${closed?'lavender':'mint'}">${closed?'Voting finished':'Voting open'}</span><h2>${pollSafe(poll.title)}</h2><p>Everyone with a JoyJourney account can vote. No invitation code needed.</p></div>
 <div class="jj-poll-controls">${owner?`<button class="btn soft" type="button" data-vote-action="toggle">${closed?'Reopen':'Close'} Voting</button><button class="btn soft" type="button" data-vote-action="rename">Rename</button><button class="btn soft" type="button" data-vote-action="delete-poll">Delete Poll</button>`:'<span class="jj-poll-hint">Public poll · all signed-in members can participate</span>'}</div>
 </div>
 <div class="jj-poll-section-head"><div><h2>Destination ideas</h2><p>${options.length} places · ${total} vote${total===1?'':'s'} · One choice per account</p></div>${!closed?`<button type="button" class="btn primary" data-vote-action="new-option">${pollIcon('plus')} Suggest Destination</button>`:''}</div>
 ${closed&&leaders.length?`<div class="card jj-poll-winner">${pollIcon('trophy')} <span>${leaders.length===1?'Most popular destination':'Tied for the lead'}: <strong>${pollSafe(leaders.map(x=>x.name).join(' / '))}</strong> (${high} vote${high===1?'':'s'})</span></div>`:''}
 ${!options.length?`<div class="card jj-empty-state">${pollIcon('map-pin')}<h3>No destination ideas yet</h3><p>${closed?'This poll was closed without suggestions.':'Suggest a destination to start voting.'}</p></div>`:`<div class="jj-candidate-grid">${options.map(x=>{
  const mine=myVote===x.id,edit= !closed&&(owner||x.createdBy===currentId());
  const image=/^https:\/\//i.test(x.image)?`<img src="${pollSafe(x.image)}" class="jj-candidate-image" alt="${pollSafe(x.name)}" loading="lazy">`:`<div class="jj-candidate-image jj-placeholder">${pollIcon('mountains')}</div>`;
  return `<article class="card jj-candidate">${image}<div class="jj-candidate-content"><div class="jj-candidate-head"><h3>${pollSafe(x.name)}</h3>${mine?'<span class="pill pink">Your vote</span>':''}</div>${x.details?`<p>${pollSafe(x.details)}</p>`:''}
  <div class="jj-vote-meter"><div style="width:${total?Math.round(x.votes/total*100):0}%"></div></div><div class="jj-candidate-foot"><span><strong>${x.votes}</strong> vote${x.votes===1?'':'s'} · ${total?Math.round(x.votes/total*100):0}%</span>${!closed?`<button type="button" class="btn ${mine?'soft':'primary'}" data-vote-option="${x.id}">${mine?'Remove my vote':'Vote here'}</button>`:''}</div>${edit?`<div class="jj-candidate-tools"><button data-edit-option="${x.id}" type="button">Edit</button><button data-remove-option="${x.id}" type="button">Delete</button></div>`:''}</div></article>`;
 }).join('')}</div>`}
 ${closed?'<p class="jj-poll-hint">Results stay available after voting closes. The poll is separate from your trips.</p>':'<p class="jj-poll-hint">You can change your vote at any time until the poll closes. Results update when you reload this page.</p>'}`;
}
async function loadPoll(id){
 try{
  const data=await apiRequest(`/api/destination-polls/${encodeURIComponent(id)}`);
  Object.assign(voteState,data);
  await refreshPolls();renderPoll();
 }catch(error){
  voteState.poll=null;await refreshPolls();showPollEmpty();pollError(error);
 }
}
function optionEditor(id){
 const opt=voteState.options.find(o=>o.id===String(id));
 const form=document.getElementById('jjVoteOptionForm');form.reset();
 form.elements.optionId.value=opt?.id||'';form.elements.name.value=opt?.name||'';form.elements.details.value=opt?.details||'';form.elements.image.value=opt?.image||'';
 document.getElementById('jjVoteOptionModalTitle').textContent=opt?'Edit destination':'Suggest a destination';pollDialog('jjVoteOptionModal',true);
}
async function submitPoll(event){
 event.preventDefault();if(voteState.busy)return;voteState.busy=true;
 const form=event.currentTarget;
 try{const {poll}=await apiJson('/api/destination-polls','POST',{title:form.elements.title.value.trim()});pollDialog('jjPollCreateModal',false);pollGo(poll.id);}
 catch(error){pollError(error);}finally{voteState.busy=false;}
}
async function saveOption(event){
 event.preventDefault();if(voteState.busy)return;voteState.busy=true;
 const form=event.currentTarget,id=form.elements.optionId.value,body={name:form.elements.name.value.trim(),details:form.elements.details.value.trim(),image:form.elements.image.value.trim()};
 try{const url=`/api/destination-polls/${voteState.poll.id}/options${id?`/${id}`:''}`;
 await apiJson(url,id?'PATCH':'POST',body);pollDialog('jjVoteOptionModal',false);await loadPoll(voteState.poll.id);pollToast('Destination saved');}
 catch(error){pollError(error);}finally{voteState.busy=false;}
}
async function handleVoteClick(event){
 const button=event.target.closest('button');if(!button||!voteState.poll)return;
 const poll=voteState.poll,id=poll.id,optionId=button.dataset.voteOption;
 if(optionId){button.disabled=true;try{await apiRequest(`/api/destination-polls/${id}/vote`,voteState.myVote===optionId?{method:'DELETE'}:{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({optionId})});await loadPoll(id);}catch(error){pollError(error);button.disabled=false;}return;}
 const editId=button.dataset.editOption;if(editId){optionEditor(editId);return;}
 const removeId=button.dataset.removeOption;if(removeId){if(!confirm('Delete this destination and its votes?'))return;try{await apiRequest(`/api/destination-polls/${id}/options/${removeId}`,{method:'DELETE'});await loadPoll(id);}catch(error){pollError(error);}return;}
 const action=button.dataset.voteAction;if(!action)return;
 try{
  if(action==='new-option')optionEditor();
  if(action==='toggle'){await apiJson(`/api/destination-polls/${id}`,'PATCH',{status:poll.status==='open'?'closed':'open'});await loadPoll(id);}
  if(action==='rename'){const title=prompt('Poll title',poll.title);if(title===null)return;await apiJson(`/api/destination-polls/${id}`,'PATCH',{title:title.trim()});await loadPoll(id);}
  if(action==='delete-poll'){if(!confirm('Delete this poll, all suggestions and all votes permanently?'))return;await apiRequest(`/api/destination-polls/${id}`,{method:'DELETE'});location.href='voting.html';}
 }catch(error){pollError(error);}
}
function initDestinationVoting(){
 if(!document.getElementById('jjVotingPage'))return;
 document.getElementById('jjVoteCreate').addEventListener('click',()=>pollDialog('jjPollCreateModal',true));
 document.getElementById('jjPollCreateForm').addEventListener('submit',submitPoll);
 document.getElementById('jjVoteOptionForm').addEventListener('submit',saveOption);
 document.getElementById('jjVoteDetail').addEventListener('click',handleVoteClick);
 document.querySelectorAll('[data-poll-close]').forEach(b=>b.addEventListener('click',()=>pollDialog(b.dataset.pollClose,false)));
 ['jjPollCreateModal','jjVoteOptionModal'].forEach(id=>document.getElementById(id).addEventListener('click',event=>{if(event.target.id===id)pollDialog(id,false);}));
 const id=pollId();if(id)loadPoll(id);else{refreshPolls().catch(pollError);showPollEmpty();}
}
