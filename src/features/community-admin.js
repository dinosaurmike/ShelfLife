import { DB } from '../core/db.js';
import { App } from '../core/app.js';
import { esc } from '../utils/dom.js';

export function switchAdminTab(tab) {
  ['general', 'books', 'members', 'moderation'].forEach(t => {
    const btn = document.getElementById('adminTab' + t.charAt(0).toUpperCase() + t.slice(1));
    const pnl = document.getElementById('adminPanel' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) {
      btn.style.color = (t === tab) ? 'var(--burgundy)' : '';
      btn.style.borderBottom = (t === tab) ? '2px solid var(--burgundy)' : 'none';
    }
    if (pnl) {
      pnl.style.display = (t === tab) ? 'block' : 'none';
    }
  });
}

export async function makeAdmin(clubId, userId, el) {
  if (!confirm("Promote this member to admin?")) return;
  const res = await DB.updateClubMemberRole(clubId, userId, 'admin');
  if (res && res.success) {
     App.showToast("Promoted to admin.");
     App.openAdminPanel(clubId, 'members');
  } else {
     App.showToast("Failed: " + (res.error || "Unknown"));
  }
}

export async function removeMember(clubId, userId, el) {
  if (!confirm("Remove this member from the club?")) return;
  const result = await DB.removeClubMember(clubId, userId);
  if (result.success) {
     App.showToast("Member removed.");
     App.openAdminPanel(clubId, 'members');
  } else {
     if (typeof App.showToast === 'function') App.showToast('Failed to remove: ' + (result.error ? result.error.message : 'Unknown error'));
  }
}


export async function openAdminPanel(clubId, defaultTab = "general") {
  const existing = document.getElementById("adminPanelModal");
  if (existing) existing.remove();
  const clubs = await DB.getMyClubs(App.userId);
  const club = (clubs||[]).find(c => c.id === clubId);
  if (!club) return;
  let members = await DB.getClubMembers(clubId);
  console.log('HEAL CHECK:', { createdBy: club.created_by, me: App.userId, missing: !members.find(m => m.user_id === App.userId), members: members });
  if (String(club.created_by) === String(App.userId) && !members.find(m => String(m.user_id) === String(App.userId))) {
      if (typeof window !== 'undefined' && window.DB && window.DB._supabase) {
          const healRes = await window.DB._supabase.from('club_members').upsert({ club_id: clubId, user_id: App.userId, role: 'admin' }, { onConflict: 'club_id,user_id' });
          if (healRes.error) { console.error('HEAL ERROR:', healRes.error); if (typeof App !== 'undefined' && App.showToast) App.showToast('Auto-heal failed: ' + healRes.error.message); }
          members = await DB.getClubMembers(clubId);
      }
  }
  
  
  App._modalZIndex = (App._modalZIndex || 2000000000) + 1;
  const modalHTML = `
    <div class="modal-overlay open" id="adminPanelModal" onclick="if(event.target===this) this.remove()" style="z-index:${App._modalZIndex} !important; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.8);">
      <div class="modal-card" style="max-width:500px; width:90%; background:#fff; color:var(--wood-dark); padding:24px; border-radius:12px; position:relative; min-height:60vh; display:flex; flex-direction:column;">
        <button class="modal-close" onclick="document.getElementById('adminPanelModal')?.remove()" style="position:absolute; top:12px; right:12px; background:none; border:none; color:var(--wood-mid); font-size:24px; cursor:pointer;">&times;</button>
        <div style="font-size:18px; font-weight:700; margin-bottom:16px;">⚙️⚙️ Admin Settings</div>
        
        <!-- Tabs -->
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(61,43,31,0.1); margin-bottom:16px; font-weight:600; font-size:14px; color:var(--wood-mid); text-align:center;">
          <div id="adminTabGeneral" onclick="App.switchAdminTab('general')" style="flex: 1; padding-bottom:8px; cursor:pointer; color:var(--burgundy); border-bottom:2px solid var(--burgundy);">General</div>
          <div id="adminTabBooks" onclick="App.switchAdminTab('books')" style="flex: 1; padding-bottom:8px; cursor:pointer;">Books</div>
          <div id="adminTabMembers" onclick="App.switchAdminTab('members')" style="flex: 1; padding-bottom:8px; cursor:pointer;">Members</div>
          <div id="adminTabModeration" onclick="App.switchAdminTab('moderation')" style="flex: 1; padding-bottom:8px; cursor:pointer;">Moderation</div>
        </div>
        
        
          <!-- General Settings Tab -->
          <div id="adminPanelGeneral" style="display:flex; flex-direction:column; gap:16px; flex:1; overflow-y:auto; padding-right:8px;">
            <div>
              <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Club Visibility</div>
              <div style="font-size:11px; color:var(--wood-mid); margin-bottom:8px;">Public clubs appear in the "Public Clubs" tab for everyone and can be joined without a code.</div>
              <div style="display:flex; align-items:center; gap:8px;">
                <label style="display:flex; align-items:center; cursor:pointer;">
                  <input type="checkbox" id="adminPublicToggle" ${(club.invite_code || '').startsWith('PUBLIC_') ? 'checked' : ''} onchange="App.toggleClubVisibility('${clubId}', this.checked)" style="width:16px; height:16px; cursor:pointer;">
                  <span style="font-size:13px; font-weight:600; margin-left:8px; color:var(--wood-dark);">Public (Discoverable)</span>
                </label>
              </div>
            </div>
            
            <div>
              <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Club Thumbnail URL</div>
              <div style="font-size:11px; color:var(--wood-mid); margin-bottom:8px;">Paste a direct link to an image (e.g. from Imgur) to display as the club's cover.</div>
              <input type="text" id="adminThumbInput" value="${(club.description || '').match(/\[thumb:(.*?)\]/) ? (club.description || '').match(/\[thumb:(.*?)\]/)[1] : ''}" placeholder="https://..." style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; margin-bottom:8px; box-sizing:border-box;">
              <button onclick="App.saveClubThumbnail('${clubId}', document.getElementById('adminThumbInput').value)" style="padding:8px 16px; background:var(--burgundy); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Save Thumbnail</button>
            </div>
            
            <div>
              <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Description</div>
              <textarea id="adminDescInput" rows="4" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; font-family:inherit; resize:vertical; margin-bottom:8px; box-sizing:border-box;">${esc((club.description || '').replace(/\[thumb:.*?\]/g,'').trim())}</textarea>
              <button onclick="App.saveClubDescription('${clubId}', document.getElementById('adminDescInput').value)" style="padding:8px 16px; background:var(--burgundy); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Save Description</button>
            </div>
          </div>
          
        <!-- Books Tab -->
        <div id="adminPanelBooks" style="display:none; flex-direction:column; gap:8px; flex:1; overflow-y:auto; padding-right:8px;">
          <div style="font-size:12px; font-weight:700; margin-bottom:4px; margin-top:8px;">Current Pick Settings</div>
            ${club.current_book_title ? `<div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
              ${club.current_book_cover ? `<img src="${club.current_book_cover}" style="width:40px; height:60px; object-fit:cover; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.2);">` : ''}
              <button onclick="document.getElementById('adminPanelModal')?.remove(); App.markClubBookFinished('${club.id}')" style="padding:8px 16px; background:#10b981; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; height:40px;">? Finished</button>
            </div>` : ''}
          
          <hr style="border:none; border-top:1px solid rgba(61,43,31,0.1); margin:16px 0;">
            <div style="font-size:12px; font-weight:700; margin-bottom:8px;">Next Pick Settings</div>
            
            <div style="font-size:11px; font-weight:700; margin-bottom:4px; margin-top:8px;">Voting Candidates</div>
            <div style="position:relative; width:100%;">
               <input id="adminCandidateInput" placeholder="Type a book title to search..." oninput="App.debounceAdminSearch(this.value, '${clubId}')" autocomplete="off" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; box-sizing:border-box;">
            </div>
            <div id="adminCandidateSearchResults" class="global-search-results" style="max-height:200px;overflow-y:auto;margin-top:4px;display:none;background:#fff;border:1px solid rgba(61,43,31,0.1);border-radius:6px;z-index:100;"></div>
            
            <div id="adminCandidateList" style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
               ${(App._clubVotingCandidates && App._clubVotingCandidates[clubId] ? App._clubVotingCandidates[clubId] : []).map((b, idx) => {
                  const titleHash = (b.title || '').split('').reduce((a,c)=>a+c.charCodeAt(0),0);
                  const mockVotes = Math.max(0, (titleHash % 15) - idx * 2);
                  const totalMockVotes = 25;
                  const votePct = Math.round((mockVotes / totalMockVotes) * 100);
                  return `<div style="display:flex; flex-direction:column; padding:8px; background:rgba(61,43,31,0.03); border: 1px solid rgba(61,43,31,0.1); border-radius:6px; font-size:12px; gap:8px;">
                     <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                       <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                         ${b.coverUrl || b.cover_url ? '<img src="' + (b.coverUrl || b.cover_url) + '" style="width:24px; height:36px; object-fit:cover; border-radius:3px; flex-shrink:0;">' : '<div style="width:24px; height:36px; background:rgba(0,0,0,0.1); border-radius:3px; flex-shrink:0;"></div>'}
                         <div style="display:flex; flex-direction:column; min-width:0;">
                           <span style="font-weight:700; color:var(--wood-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${b.title}</span>
                           <span style="font-size:10px; color:var(--wood-mid); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${b.author || 'Unknown Author'}</span>
                         </div>
                       </div>
                       <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                          <button onclick="App.adminPromoteCandidate('${clubId}', ${idx})" style="background:var(--wood-dark); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-weight:600; font-size:11px; cursor:pointer;" title="Promote to Next Read">Promote</button>
                          <button onclick="App.adminRemoveCandidate('${clubId}', ${idx})" style="color:var(--burgundy); background:rgba(139,38,53,0.1); border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:12px;" title="Remove">&times;</button>
                       </div>
                     </div>
                     <div style="display:flex; align-items:center; gap:8px; width:100%;">
                        <div style="flex:1; height:6px; background:rgba(61,43,31,0.1); border-radius:3px; overflow:hidden;">
                           <div style="height:100%; width:${votePct}%; background:var(--gold); border-radius:3px;"></div>
                        </div>
                        <div style="font-size:10px; font-weight:700; color:var(--wood-dark);">${mockVotes} votes</div>
                     </div>
                  </div>`;
               }).join('')}
            </div>
            
            <div style="margin-top: 24px; border-top: 1px dashed rgba(61,43,31,0.2); padding-top: 16px; margin-bottom: 16px;">
               <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Member Suggestions</div>
               <div style="font-size:11px; color:var(--wood-mid); margin-bottom:8px;">Books suggested by club members in the discussion view.</div>
               <div id="adminSuggestionsList" style="display:flex; flex-direction:column; gap:4px;">
                 ${(!App._clubSuggestions || !App._clubSuggestions[clubId] || App._clubSuggestions[clubId].length === 0) ? `
                    <div style="font-size:11px; color:var(--wood-light); padding:12px; text-align:center; background:rgba(61,43,31,0.02); border-radius:6px;">No suggestions right now.</div>
                 ` : App._clubSuggestions[clubId].map((s, idx) => `
                    <div style="display:flex; justify-content:space-between; padding:6px 8px; background:rgba(61,43,31,0.05); border-radius:4px; font-size:12px; align-items:center; gap:8px;">
                       <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
                         <span style="font-weight:700; color:var(--wood-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.title}</span>
                       </div>
                       <div style="display:flex; gap:4px; flex-shrink:0;">
                          <button onclick="App.adminApproveSuggestion('${clubId}', ${idx})" style="background:var(--gold); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-weight:600; font-size:10px; cursor:pointer;" title="Add to Voting Candidates">Approve</button>
                          <button onclick="App.adminRejectSuggestion('${clubId}', ${idx})" style="color:var(--burgundy); background:rgba(139,38,53,0.1); border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:10px;" title="Reject">Reject</button>
                       </div>
                    </div>
                 `).join('')}
               </div>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:16px;">
              <div style="flex:1;">
                <div style="font-size:11px; font-weight:700; margin-bottom:4px; color:var(--wood-mid);">Start Date</div>
                <input type="date" id="adminPickStartDate" value="${App._clubStartDates ? App._clubStartDates[clubId] || '' : ''}" onchange="if(App._clubStartDates) App._clubStartDates['${clubId}'] = this.value; App.openClub('${clubId}')" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; box-sizing:border-box;">
              </div>
              <div style="flex:1;">
                <div style="font-size:11px; font-weight:700; margin-bottom:4px; color:var(--wood-mid);">End Date</div>
                <input type="date" id="adminPickEndDate" value="${club.end_date || ''}" onchange="App.setClubEndDate('${club.id}', this.value)" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; box-sizing:border-box;">
              </div>
            </div>
          
          <div style="font-size:11px; font-weight:700; margin-bottom:4px; color:var(--wood-mid);">Directly Set Current Pick</div>
          <button onclick="document.getElementById('adminPanelModal')?.remove(); App.openClubPickModal()" style="padding:8px 16px; background:var(--burgundy); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; margin-bottom:16px;">Open Pick Modal</button>
          
          <div style="border-top: 1px solid rgba(61,43,31,0.1); margin-top: 8px; margin-bottom: 8px;"></div>
          
          <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Past Reads</div>
          <div style="font-size:11px; font-weight:700; margin-bottom:4px; color:var(--wood-mid);">Add a Past Read</div>
          <div style="position:relative; width:100%;">
            <input id="adminPastInput" placeholder="Click to select or search..." onfocus="App.showAdminPastMenu('${clubId}')" oninput="App.filterAdminPastMenu(this.value, '${clubId}')" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; box-sizing:border-box;">
            <div id="adminPastSearchResults" style="position:absolute; top:100%; left:0; width:100%; background:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.15); border-radius:8px; z-index:10; display:none; max-height:200px; overflow-y:auto;"></div>
          </div>
          
          <div style="font-size:11px; font-weight:700; margin-top:16px; margin-bottom:4px; color:var(--wood-mid);">Current Past Reads</div>
          <div id="adminPastList" style="display:flex; flex-direction:column; gap:8px;">
            <!-- Populated dynamically via JS -->
          </div>
        </div>

        <!-- Members Tab -->
        <div id="adminPanelMembers" style="display:none; flex-direction:column; flex:1; overflow-y:auto; padding-right:8px;">
          <div style="margin-bottom: 16px; background: rgba(61,43,31,0.04); padding: 12px; border-radius: 8px; border: 1px dashed rgba(61,43,31,0.2);">
            <div style="font-size: 13px; font-weight: 600; color: var(--wood-dark); margin-bottom: 4px;">Invite Members</div>
            <div style="font-size: 12px; color: var(--wood-mid); margin-bottom: 8px;">Share this code for others to join your club.</div>
            <div style="display:flex; align-items:center; gap: 8px;">
               <div style="font-family: monospace; font-size: 15px; font-weight: bold; padding: 6px 12px; background: #fff; border-radius: 6px; border: 1px solid rgba(61,43,31,0.1); letter-spacing: 1px;">${((club.invite_code || '').startsWith('PUBLIC_') ? (club.invite_code || '').replace('PUBLIC_', '') : (club.invite_code || '---')).substring(0,4)}</div>
               <button onclick="navigator.clipboard.writeText('${((club.invite_code || '').startsWith('PUBLIC_') ? (club.invite_code || '').replace('PUBLIC_', '') : (club.invite_code || '')).substring(0,4)}'); if(typeof App.showToast==='function') App.showToast('Invite code copied!')" class="btn-primary" style="padding: 6px 12px; font-size: 11px;">Copy</button>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
          ${members.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(61,43,31,0.03); border-radius:8px; border:1px solid rgba(61,43,31,0.05);">
              <div style="font-size:14px; font-weight:600;">${(m.user_profiles && m.user_profiles.display_name) || 'Reader'} ${m.role==='admin'?'<span style="color:var(--burgundy);font-size:10px;margin-left:4px;">(Admin)</span>':''}</div>
                ${m.role !== 'admin' ? `
                  <div style="display:flex; gap:8px;">
                    <button onclick="event.stopPropagation(); App.makeAdmin('${clubId}', '${m.user_id}', this)" style="background:var(--wood-dark); color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:10px; font-weight:bold; letter-spacing:0.05em;" title="Make Admin">MAKE ADMIN</button>
                    <button onclick="event.stopPropagation(); App.removeMember('${clubId}', '${m.user_id}', this)" style="background:transparent; color:var(--wood-mid); border:none; padding:4px; cursor:pointer; font-size:16px; transition:color 0.2s;" onmouseover="this.style.color='#ff4444'" onmouseout="this.style.color='var(--wood-mid)'" title="Remove Member">🗑️</button>
                  </div>
                ` : ''}
            </div>
          `).join('')}
          </div>
        </div>

        <!-- Moderation Tab -->
        <div id="adminPanelModeration" style="display:none; flex-direction:column; gap:16px; padding-top:8px; flex:1; overflow-y:auto; padding-right:8px;">
           <div style="font-size:13px; color:var(--wood-mid); line-height:1.5;">As a club admin, you can delete individual messages from the chat view by clicking the red '🗑️' next to a message.</div>
           
           <div style="font-size:12px; font-weight:700; margin-bottom:4px; margin-top:8px; color:#ff4444;">Danger Zone</div>
           
           <div style="display:flex; justify-content:space-between; align-items:center; padding:16px; background:rgba(255,68,68,0.05); border-radius:8px; border:1px solid rgba(255,68,68,0.2);">
              <div style="font-size:13px; font-weight:600; color:var(--wood-dark);">Wipe Entire Chat History</div>
              <button onclick="if(confirm('Are you absolutely sure? This cannot be undone.')){ App.showToast('Chat history wiped.'); App.openClub('${clubId}'); document.getElementById('adminPanelModal')?.remove(); }" style="padding:6px 12px; background:#ff4444; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Wipe</button>
           </div>
           
           <div style="display:flex; justify-content:space-between; align-items:center; padding:16px; background:rgba(255,68,68,0.05); border-radius:8px; border:1px solid rgba(255,68,68,0.2);">
              <div style="font-size:13px; font-weight:600; color:var(--wood-dark);">Delete Club</div>
              <button onclick="App.deleteClub('${clubId}')" style="padding:6px 12px; background:#ff4444; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Delete</button>
           </div>
        </div>

      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  if (typeof App !== 'undefined' && typeof App.switchAdminTab === 'function') App.switchAdminTab(defaultTab);
  
  if (typeof App !== 'undefined' && typeof App.renderAdminPastReads === 'function') App.renderAdminPastReads(clubId);
}
export async function deleteClubMessage(clubId, msgId) {
    if (!confirm("Delete this message?")) return;
    const ok = await DB.deleteClubMessage(msgId);
    if (ok) {
      App.openClub(clubId);
    } else {
      App.showToast("Failed to delete message.");
    }


}

export async function editClubName(clubId, currentName) {
    if (clubId && typeof clubId === 'object' && clubId.dataset) {
      const el = clubId;
      clubId = el.dataset.clubId || '';
      currentName = el.dataset.clubName || '';
    }
    const newName = prompt("Enter new club name:", currentName);
    if (!newName || newName.trim() === '' || newName === currentName) return;
    const ok = await DB.updateClubName(clubId, newName.trim());
    if (ok) {
      if (typeof App.showToast === 'function') App.showToast("Club name updated!");
      App._currentClub = null; 
      App.openClub(clubId);
    } else {
      if (typeof App.showToast === 'function') App.showToast("Could not update club name");
    }


}


export async function handleAdminEmailSearch(query, clubId) {
  const dropdown = document.getElementById('adminEmailDropdown');
  if (!dropdown) return;
  const q = (query || '').toLowerCase().trim();
  if (q.length < 2) {
    dropdown.style.display = 'none';
    return;
  }
  
  let matches = [];
  if (typeof window !== 'undefined' && window.DB && window.DB._supabase) {
    const { data } = await window.DB._supabase
      .from('user_profiles')
      .select('user_id, display_name, avatar_emoji')
      .ilike('display_name', `%${q}%`)
      .limit(10);
    
    if (data) {
      matches = data.map(u => ({ id: u.user_id, email: u.display_name, name: u.display_name, avatar: u.avatar_emoji }));
    }
  } else {
    const mockUsers = [
      { id: 'u_101', email: 'alice@example.com', name: 'Alice' },
      { id: 'u_102', email: 'bob@bookclub.com', name: 'Bob' },
      { id: 'u_103', email: 'charlie@reads.com', name: 'Charlie' }
    ];
    matches = mockUsers.filter(u => u.email.toLowerCase().includes(q));
    if (matches.length === 0 && q.includes('@')) matches.push({ id: 'u_new_' + Date.now(), email: q, name: q.split('@')[0] });
  }
  
  if (matches.length > 0) {
    dropdown.innerHTML = matches.map(u => `
      <div onclick="App.adminAddMember('${clubId}', '${u.id}', '${(u.email||'').replace(/'/g, "\\'")}', '${(u.name||'').replace(/'/g, "\\'")}')" style="padding: 12px; cursor: pointer; border-bottom: 1px solid rgba(61,43,31,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(61,43,31,0.02)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:600; font-size: 13px; color: var(--wood-dark);">${u.email}</div>
        <div style="font-size: 11px; color: var(--wood-mid); margin-top: 2px;">${u.name}</div>
      </div>
    `).join('');
    dropdown.style.display = 'block';
  } else {
    dropdown.innerHTML = '<div style="padding: 12px; font-size: 13px; color: var(--wood-mid); text-align: center;">No matching emails found.</div>';
    dropdown.style.display = 'block';
  }
}

export async function adminAddMember(clubId, userId, email, name) {
  const dropdown = document.getElementById('adminEmailDropdown');
  if (dropdown) dropdown.style.display = 'none';
  const input = document.getElementById('adminAddMemberEmail');
  if (input) input.value = '';
  
  if (typeof window !== 'undefined') {
    window._mockClubMembers = window._mockClubMembers || {};
    window._mockClubMembers[clubId] = window._mockClubMembers[clubId] || [];
    const exists = window._mockClubMembers[clubId].find(m => m.user_id === userId);
    if (!exists) {
      window._mockClubMembers[clubId].push({
        user_id: userId,
        role: 'member',
        user_profiles: { display_name: name || email, avatar_emoji: '👤' }
      });
      try { localStorage.setItem('sl_mockClubMembers', JSON.stringify(window._mockClubMembers)); } catch(e){}
    }
  }
  
  const cName = (typeof App !== 'undefined' && App.clubs) ? (App.clubs.find(c => c.id === clubId)?.name || 'a club') : 'a club';
  if (typeof window !== 'undefined' && window.DB && window.DB._supabase) {
    const { error: _insErr } = await window.DB._supabase.from('club_members').upsert({ club_id: clubId, user_id: userId, role: 'member' }, { onConflict: 'club_id,user_id' });
    if (_insErr) { console.error('insert error:', _insErr); App.showToast('Failed to add to database.'); return; }
    if (typeof window.DB.recordAchievement === 'function') {
      window.DB.recordAchievement(userId, 'club_joined', { clubId, clubName: cName });
    }
  } else if (typeof window !== 'undefined') {
    window._mockAchievements = window._mockAchievements || [];
    window._mockAchievements.push({
       user_id: userId,
       type: 'club_joined',
       data: { clubId, clubName: cName },
       created_at: new Date().toISOString(),
       _name: name || email,
       _avatar: '👤'
    });
    try { localStorage.setItem('sl_mockAchievements', JSON.stringify(window._mockAchievements)); } catch(e){}
  }
  
  if (typeof App.showToast === 'function') App.showToast("Added " + email + " to the club.");
  if (typeof App.openAdminPanel === 'function') App.openAdminPanel(clubId, 'members');
}


export async function adminRemoveMember(clubId, memberId) {
  if (!confirm('Remove this member from the club?')) return;
  if (typeof window !== 'undefined' && window.DB && window.DB._supabase) {
    const { error } = await window.DB._supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', memberId);
    if (error) {
       console.error('DELETE ERROR:', error);
       if (typeof App.showToast === 'function') App.showToast('Failed to remove: ' + error.message);
       return;
    }
  } else if (typeof window !== 'undefined') {
    if (window._mockClubMembers && window._mockClubMembers[clubId]) {
      window._mockClubMembers[clubId] = window._mockClubMembers[clubId].filter(m => m.user_id !== memberId);
      try { localStorage.setItem('sl_mockClubMembers', JSON.stringify(window._mockClubMembers)); } catch(e){}
    }
  }
  if (typeof App.showToast === 'function') App.showToast('Member removed.');
  if (typeof App.openAdminPanel === 'function') App.openAdminPanel(clubId, 'members');
}

export function openClubPickModal(clubId) {
  if (clubId) App._currentClub = clubId;
  if (typeof App.openModal === 'function') {
    App.openModal('clubPickModal');
  }
}

let _adminSearchTimer = null;
export function debounceAdminSearch(query, clubId) {
  clearTimeout(_adminSearchTimer);
  const resultsContainer = document.getElementById('adminCandidateSearchResults');
  if (!resultsContainer) return;
  if (!query || query.trim().length < 2) {
    resultsContainer.style.display = 'none';
    resultsContainer.innerHTML = '';
    return;
  }
  _adminSearchTimer = setTimeout(async () => {
    try {
      const q = encodeURIComponent(query.trim());
      const res = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=5`);
      if (!res.ok) return;
      const data = await res.json();
      const books = (data.docs || []).map(d => ({
        title: d.title || 'Unknown Title',
        author: (d.author_name && d.author_name[0]) || 'Unknown Author',
        coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : ''
      }));
      if (!books.length) {
        resultsContainer.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--wood-light);text-align:center;">No results found</div>';
        resultsContainer.style.display = 'block';
        return;
      }
      resultsContainer.innerHTML = books.map((b) => `
        <div onclick='App.adminAddCandidate("${clubId}", ${JSON.stringify(b).replace(/'/g, "&#39;")})' style="display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;border-bottom:1px solid rgba(61,43,31,0.05);" onmouseover="this.style.background='rgba(61,43,31,0.04)'" onmouseout="this.style.background='transparent'">
          ${b.coverUrl ? `<img src="${b.coverUrl}" style="width:20px;height:30px;object-fit:cover;border-radius:2px;">` : '<div style="width:20px;height:30px;background:#eee;border-radius:2px;"></div>'}
          <div style="font-size:12px;color:var(--wood-dark);"><strong style="display:block;">${esc(b.title)}</strong><span style="font-size:10px;color:var(--wood-mid);">${esc(b.author)}</span></div>
        </div>
      `).join('');
      resultsContainer.style.display = 'block';
    } catch(err) {
      console.warn('debounceAdminSearch error:', err);
    }
  }, 300);
}

export function adminAddCandidate(clubId, book) {
  if (!clubId || !book) return;
  App._clubVotingCandidates = App._clubVotingCandidates || {};
  App._clubVotingCandidates[clubId] = App._clubVotingCandidates[clubId] || [];
  App._clubVotingCandidates[clubId].push(book);
  const resultsContainer = document.getElementById('adminCandidateSearchResults');
  if (resultsContainer) resultsContainer.style.display = 'none';
  const inp = document.getElementById('adminCandidateInput');
  if (inp) inp.value = '';
  if (typeof App.openAdminPanel === 'function') App.openAdminPanel(clubId, 'books');
}

export function adminRemoveCandidate(clubId, idx) {
  if (App._clubVotingCandidates && App._clubVotingCandidates[clubId]) {
    App._clubVotingCandidates[clubId].splice(idx, 1);
    if (typeof App.openAdminPanel === 'function') App.openAdminPanel(clubId, 'books');
  }
}

let _adminPastSearchTimer = null;
export function debounceAdminPastSearch(query, clubId) {
  clearTimeout(_adminPastSearchTimer);
  const resultsContainer = document.getElementById('adminPastSearchResults');
  if (!resultsContainer) return;
  if (!query || query.trim().length < 2) {
    resultsContainer.style.display = 'none';
    resultsContainer.innerHTML = '';
    return;
  }
  _adminPastSearchTimer = setTimeout(async () => {
    try {
      const q = encodeURIComponent(query.trim());
      const res = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=5`);
      if (!res.ok) return;
      const data = await res.json();
      const books = (data.docs || []).map(d => ({
        title: d.title || 'Unknown Title',
        author: (d.author_name && d.author_name[0]) || 'Unknown Author',
        coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '',
        date: ''
      }));
      if (!books.length) {
        resultsContainer.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--wood-light);text-align:center;">No results found</div>';
        resultsContainer.style.display = 'block';
        return;
      }
      resultsContainer.innerHTML = books.map((b) => `
        <div onclick='App.adminAddPastRead("${clubId}", ${JSON.stringify(b).replace(/'/g, "&#39;")})' style="display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;border-bottom:1px solid rgba(61,43,31,0.05);" onmouseover="this.style.background='rgba(61,43,31,0.04)'" onmouseout="this.style.background='transparent'">
          ${b.coverUrl ? `<img src="${b.coverUrl}" style="width:20px;height:30px;object-fit:cover;border-radius:2px;">` : '<div style="width:20px;height:30px;background:#eee;border-radius:2px;"></div>'}
          <div style="font-size:12px;color:var(--wood-dark);"><strong style="display:block;">${esc(b.title)}</strong><span style="font-size:10px;color:var(--wood-mid);">${esc(b.author)}</span></div>
        </div>
      `).join('');
      resultsContainer.style.display = 'block';
    } catch(err) {
      console.warn('debounceAdminPastSearch error:', err);
    }
  }, 300);
}

export async function adminAddPastRead(clubId, book) {
  if (!clubId || !book) return;
  const clubs = await DB.getMyClubs(App.userId);
  const club = (clubs || []).find(c => c.id === clubId);
  if (!club) return;
  const pastReads = club.past_reads || [];
  pastReads.unshift(book);
  await DB.updateClubPastReads(clubId, pastReads);
  const resultsContainer = document.getElementById('adminPastSearchResults');
  if (resultsContainer) resultsContainer.style.display = 'none';
  const inp = document.getElementById('adminPastInput');
  if (inp) inp.value = '';
  if (typeof App.openAdminPanel === 'function') App.openAdminPanel(clubId, 'books');
}

export async function moveClubPastRead(clubId, idx, delta) {
  const clubs = await DB.getMyClubs(App.userId);
  const club = (clubs || []).find(c => c.id === clubId);
  if (!club || !club.past_reads) return;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= club.past_reads.length) return;
  const item = club.past_reads.splice(idx, 1)[0];
  club.past_reads.splice(targetIdx, 0, item);
  await DB.updateClubPastReads(clubId, club.past_reads);
  if (typeof App.openAdminPanel === 'function') App.openAdminPanel(clubId, 'books');
}

export async function removeClubPastRead(clubId, idx) {
  if (!confirm('Remove this book from past reads?')) return;
  const clubs = await DB.getMyClubs(App.userId);
  const club = (clubs || []).find(c => c.id === clubId);
  if (!club || !club.past_reads) return;
  club.past_reads.splice(idx, 1);
  await DB.updateClubPastReads(clubId, club.past_reads);
  if (typeof App.openAdminPanel === 'function') App.openAdminPanel(clubId, 'books');
}

export async function updateClubPastReadDate(clubId, idx, date) {
  const clubs = await DB.getMyClubs(App.userId);
  const club = (clubs || []).find(c => c.id === clubId);
  if (!club || !club.past_reads || !club.past_reads[idx]) return;
  club.past_reads[idx].date = date;
  await DB.updateClubPastReads(clubId, club.past_reads);
}

export async function banMember(clubId, userId, el) {
  if (!confirm('Ban this member from the club?')) return;
  const res = await DB.updateClubMemberRole(clubId, userId, 'banned');
  if (res && res.success) {
    if (typeof App.showToast === 'function') App.showToast('Member banned.');
    if (typeof App.openAdminPanel === 'function') App.openAdminPanel(clubId, 'members');
  } else {
    if (typeof App.showToast === 'function') App.showToast('Failed: ' + (res.error || 'Unknown'));
  }
}

export async function wipeClubChat(clubId) {
  if (!confirm('Are you absolutely sure you want to wipe all chat messages? This cannot be undone.')) return;
  try {
    if (typeof window !== 'undefined' && window.DB && window.DB._supabase) {
      await window.DB._supabase.from('club_messages').delete().eq('club_id', clubId);
      await window.DB._supabase.from('club_discussion').delete().eq('club_id', clubId);
    }
    if (typeof window !== 'undefined' && window._mockClubMessages) {
      window._mockClubMessages[clubId] = [];
      try { localStorage.setItem('sl_mockClubMessages', JSON.stringify(window._mockClubMessages)); } catch(e){}
    }
    if (typeof App.showToast === 'function') App.showToast('Chat history wiped.');
    const modal = document.getElementById('adminPanelModal');
    if (modal) modal.remove();
    if (typeof App.openClub === 'function') App.openClub(clubId);
  } catch(err) {
    console.error('wipeClubChat error:', err);
    if (typeof App.showToast === 'function') App.showToast('Failed to wipe chat');
  }
}

export function openReaderProfileById(userId) {
  if (!userId) return;
  if (typeof App.openProfileView === 'function') {
    App.openProfileView(userId);
  } else if (typeof App._viewPublicShelf === 'function') {
    App._viewPublicShelf(userId);
  }
}

export async function startLocalPod(btn) {
  const clubId = btn?.dataset?.clubId || (typeof btn === 'string' ? btn : '');
  const title = btn?.dataset?.title || '';
  const author = btn?.dataset?.author || '';
  const cover = btn?.dataset?.cover || '';
  const podName = prompt('Enter a name for your private pod:', title ? `${title} Pod` : 'Reading Pod');
  if (!podName || !podName.trim()) return;
  try {
    const newClub = await DB.createClub(
      podName.trim(),
      `Private reading pod reading ${title || 'together'}.`,
      App.userId
    );
    if (newClub) {
      if (title) {
        await DB.setClubPick(newClub.id, title, author, cover);
      }
      if (typeof App.showToast === 'function') App.showToast('Private pod created!');
      if (typeof App.openClub === 'function') App.openClub(newClub.id);
    }
  } catch(err) {
    console.error('startLocalPod error:', err);
    if (typeof App.showToast === 'function') App.showToast('Could not create pod');
  }
}

export async function sendClubMessage(clubId) {
  const input = document.getElementById('clubMsgInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try {
    await DB.sendClubMessage(clubId, text, App.userId, App.userName);
    if (typeof App.openClub === 'function') App.openClub(clubId);
  } catch(err) {
    console.error('sendClubMessage error:', err);
    if (typeof App.showToast === 'function') App.showToast('Failed to send message');
  }
}

export function selectClubPickBook(book) {
  if (!book) return;
  const titleInp = document.getElementById('clubPickManualTitle');
  if (titleInp) titleInp.value = book.title || '';
  const authorInp = document.getElementById('clubPickManualAuthor');
  if (authorInp) authorInp.value = book.author || '';
  const coverInp = document.getElementById('clubPickManualCover');
  if (coverInp) coverInp.value = book.coverUrl || '';
  const preview = document.getElementById('clubPickPreview');
  if (preview) {
    preview.innerHTML = book.coverUrl ? `<img src="${book.coverUrl}" style="width:50px;height:75px;object-fit:cover;border-radius:4px;margin-top:8px;">` : '';
  }
  const searchResults = document.getElementById('clubPickSearchResults');
  if (searchResults) searchResults.style.display = 'none';
}

App.deleteClub = async (clubId) => {
  const conf = prompt('DANGER: This will permanently delete the club for everyone.\n\nType "DELETE" to confirm:');
  if (conf && conf.trim().toLowerCase() === 'delete') {
    const success = await window.DB.deleteClub(clubId);
    if (success === true) {
      if (typeof App.showToast === 'function') App.showToast('Club deleted.');
      const modal = document.getElementById('adminPanelModal');
      if (modal) modal.remove();
      App._currentClub = null;
      if (window.CommunityClubs && typeof window.CommunityClubs.renderClubs === 'function') window.CommunityClubs.renderClubs();
    } else {
      if (typeof App.showToast === 'function') App.showToast('Failed: ' + success);
    }
  }
};


export async function openManageMembers(clubId) {
    let club = (window.App.clubs || (typeof window !== 'undefined' && window._mockClubs) || []).find(c => String(c.id) === String(clubId));
    if (!club) {
        if (typeof window.DB !== 'undefined' && window.DB.getMyClubs) {
            const clubs = await window.DB.getMyClubs(window.App ? window.App.userId : null);
            if (clubs) {
                if (typeof window !== 'undefined' && window.App) window.App.clubs = clubs;
                club = clubs.find(c => String(c.id) === String(clubId));
            }
        }
    }
    if (!club) return window.App.showToast('Club not found');
    
    let members = [];
    try {
        if (typeof window.DB !== 'undefined' && window.DB.getClubMembers) {
            members = await window.DB.getClubMembers(clubId);
        } else if (window._mockClubMembers && window._mockClubMembers[clubId]) {
            members = window._mockClubMembers[clubId];
        }
    } catch (e) { console.error('Failed to get members', e); }
    
    let isAdmin = false;
    const currentUserId = window.App ? window.App.userId : null;
    if (currentUserId) {
        const myMember = members.find(m => m.user_id === currentUserId);
        if (myMember && myMember.role === 'admin') isAdmin = true;
    }
    
    const m = document.createElement('div');
    m.id = 'clubMembersModal';
    m.className = 'modal-overlay open';
    m.onclick = (e) => { if(e.target === m) { m.remove(); if (window.App && window.App.closeModal) window.App.closeModal(m.id); } };
    
    const sl_cm = document.getElementById('communityModal');
    if (sl_cm && sl_cm.classList.contains('open')) sl_cm.appendChild(m); else document.body.appendChild(m);
    m.innerHTML = `
      <style>#clubMembersModal:not(.open) { display: none !important; }</style>
      <div class="modal-card" style="max-width:400px; padding:24px; position:relative;">
        <button onclick="event.stopPropagation(); this.closest('.modal-overlay').remove(); if(window.App && window.App.closeModal) window.App.closeModal('clubMembersModal');" style="position:absolute; top:16px; right:16px; background:none; border:none; font-size:20px; cursor:pointer; color:var(--wood-mid);">✖</button>
        <div style="font-family:'Playfair Display',serif; font-size:24px; font-weight:700; color:var(--wood-dark); margin-bottom:8px;">Club Members</div>
        <div style="font-size:13px; color:var(--wood-mid); margin-bottom:20px;">${club.name}</div>
        <div style="display:flex; flex-direction:column; gap:12px; max-height:400px; overflow-y:auto; padding-right:8px;">
          ${members.map(mem => `
            <div style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(61,43,31,0.03); border-radius:8px;">
              <div style="width:40px; height:40px; border-radius:50%; background:var(--wood-light); display:flex; align-items:center; justify-content:center; font-size:20px; color:#fff;">
                ${mem.user_profiles?.avatar_emoji || '👤'}
              </div>
              <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
                <span style="font-weight:700; color:var(--wood-dark); font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${mem.user_profiles?.display_name || 'Anonymous'}</span>
                <span style="font-size:11px; color:var(--wood-mid); text-transform:uppercase; letter-spacing:0.05em; font-family:'DM Mono',monospace;">${mem.role}</span>
              </div>
                ${isAdmin && mem.role !== 'admin' ? `
                  <button onclick="event.stopPropagation(); window.App.removeMember('${clubId}', '${mem.user_id}', this)" style="background:transparent; color:var(--wood-mid); border:none; padding:4px; cursor:pointer; font-size:16px; transition:color 0.2s;" onmouseover="this.style.color='#ff4444'" onmouseout="this.style.color='var(--wood-mid)'" title="Remove Member">🗑️</button>
                ` : ''}
            </div>
          `).join('')}
          ${members.length === 0 ? '<div style="text-align:center; color:var(--wood-mid); font-size:13px;">No members found.</div>' : ''}
        </div>
      </div>
    `;
    
    m.classList.add('open');
    m.style.display = 'flex';
    m.style.setProperty('z-index', '2147483647', 'important');
    if (window.App) window.App._modalZIndex = 2147483647;
}

  export function showAdminPastMenu(clubId) {
    const resultsContainer = document.getElementById('adminPastSearchResults');
    if (!resultsContainer) return;
    
    const curApp = (typeof window !== 'undefined' && window.App) ? window.App : App;
    let allBooks = (curApp && curApp.books && curApp.books.length) ? curApp.books : ((typeof window !== 'undefined' && window._BOOKS) ? window._BOOKS : []);
    
    if (!allBooks || !allBooks.length) {
      allBooks = [
        { title: 'Dark Matter', author: 'Blake Crouch', cover_url: '' },
        { title: 'Dune', author: 'Frank Herbert', cover_url: '' },
        { title: 'Hyperion', author: 'Dan Simmons', cover_url: '' },
        { title: 'Project Hail Mary', author: 'Andy Weir', cover_url: '' }
      ];
    }
    
    renderAdminPastMenu(allBooks, clubId);
  }

  export function filterAdminPastMenu(query, clubId) {
    const q = (query || '').toLowerCase().trim();
    const curApp = (typeof window !== 'undefined' && window.App) ? window.App : App;
    let allBooks = (curApp && curApp.books && curApp.books.length) ? curApp.books : ((typeof window !== 'undefined' && window._BOOKS) ? window._BOOKS : []);
    
    if (!allBooks || !allBooks.length) {
      allBooks = [
        { title: 'Dark Matter', author: 'Blake Crouch', cover_url: '' },
        { title: 'Dune', author: 'Frank Herbert', cover_url: '' },
        { title: 'Hyperion', author: 'Dan Simmons', cover_url: '' },
        { title: 'Project Hail Mary', author: 'Andy Weir', cover_url: '' }
      ];
    }
    
    if (!q) {
      renderAdminPastMenu(allBooks, clubId);
      return;
    }
    
    const filtered = allBooks.filter(b => (b.title && b.title.toLowerCase().includes(q)) || (b.author && b.author.toLowerCase().includes(q)));
    renderAdminPastMenu(filtered, clubId);
  }

  function renderAdminPastMenu(books, clubId) {
    const resultsContainer = document.getElementById('adminPastSearchResults');
    if (!resultsContainer) return;
    
    if (!books.length) {
      resultsContainer.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--wood-light); text-align: center;">No matching books found.</div>';
      resultsContainer.style.display = 'block';
      return;
    }
    
    const html = books.slice(0, 50).map(b => {
      const bookObj = { title: b.title || 'Unknown', author: b.author || '', coverUrl: b.cover_url || b.coverUrl || b.cover || b.fallbackCover || '', date: '' };
      const bookStr = JSON.stringify(bookObj).replace(/'/g, "&#39;");
      const coverEsc = bookObj.coverUrl.replace(/'/g, "\'");
      return `
        <div style="padding: 8px 12px; border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s;" 
             onmouseover="this.style.background='rgba(61,43,31,0.05)'" onmouseout="this.style.background='transparent'"
             onclick='App.adminAddPastRead("${clubId}", ${bookStr})'>
          <img src="${coverEsc}" style="width: 32px; height: 48px; object-fit: cover; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none'">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 13px; color: var(--wood-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bookObj.title}</div>
            <div style="font-size: 11px; color: var(--wood-mid); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bookObj.author}</div>
          </div>
        </div>
      `;
    }).join('');
    
    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
  }


export async function adminPromoteCandidate(clubId, idx) {
  if (App._clubVotingCandidates && App._clubVotingCandidates[clubId]) {
    const candidate = App._clubVotingCandidates[clubId][idx];
    if (!candidate) return;
    try {
      await window.DB.setClubPick(clubId, candidate.title, candidate.author, candidate.cover_url || candidate.coverUrl);
      App._clubVotingCandidates[clubId].splice(idx, 1);
      if (typeof App.showToast === 'function') App.showToast('Promoted to Next Read!');
      if (typeof App.openAdminPanel === 'function') App.openAdminPanel(clubId, 'books');
      if (typeof App.openClub === 'function') App.openClub(clubId);
    } catch (err) {
      console.error(err);
      if (typeof App.showToast === 'function') App.showToast('Failed to promote candidate.');
    }
  }
}

export function adminApproveSuggestion(clubId, idx) {
  if (App._clubSuggestions && App._clubSuggestions[clubId]) {
    const sug = App._clubSuggestions[clubId].splice(idx, 1)[0];
    if (!sug) return;
    if (!App._clubVotingCandidates) App._clubVotingCandidates = {};
    if (!App._clubVotingCandidates[clubId]) App._clubVotingCandidates[clubId] = [];
    if (App._clubVotingCandidates[clubId].length >= 3) {
      if (typeof App.showToast === 'function') App.showToast('Max 3 candidates. Remove one first.');
      App._clubSuggestions[clubId].splice(idx, 0, sug); // Revert
      return;
    }
    App._clubVotingCandidates[clubId].unshift(sug);
    if (typeof App.openAdminPanel === 'function') App.openAdminPanel(clubId, 'books');
  }
}

export function adminRejectSuggestion(clubId, idx) {
  if (App._clubSuggestions && App._clubSuggestions[clubId]) {
    App._clubSuggestions[clubId].splice(idx, 1);
    if (typeof App.openAdminPanel === 'function') App.openAdminPanel(clubId, 'books');
  }
}
