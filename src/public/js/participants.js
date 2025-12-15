// participants.js - Handle participants list and approval system

let pendingParticipants = [];
let currentParticipants = [];

console.log('🔧 participants.js loaded');
console.log('   meetingId:', typeof meetingId !== 'undefined' ? meetingId : 'NOT DEFINED');
console.log('   userId:', typeof userId !== 'undefined' ? userId : 'NOT DEFINED');
console.log('   isHost:', typeof isHost !== 'undefined' ? isHost : 'NOT DEFINED');
console.log('   isCoHost:', typeof isCoHost !== 'undefined' ? isCoHost : 'NOT DEFINED');

// Initialize participants panel
function initParticipants() {
    console.log('🎬 initParticipants called');
    console.log('   isHost:', isHost, 'isCoHost:', isCoHost);

    // Show pending section only if host or co-host
    if (isHost || isCoHost) {
        console.log('   ✅ User is host/co-host, enabling pending section');
        document.getElementById('pending-participants-section').classList.remove('d-none');

        // Request initial pending participants
        socket.emit('get-pending-participants', { meetingId });
    } else {
        console.log('   ❌ User is NOT host/co-host');
    }

    // Request current participants list
    socket.emit('get-participants', { meetingId });
}

// Render pending participants (host/co-host only)
function renderPendingParticipants() {
    const pendingList = document.getElementById('pending-participants-list');
    const pendingCount = document.getElementById('pending-count');

    if (!pendingList || !pendingCount) return;

    pendingCount.textContent = pendingParticipants.length;

    if (pendingParticipants.length === 0) {
        pendingList.innerHTML = '<p class="text-muted small mb-0 px-2">No pending requests</p>';
        return;
    }

    pendingList.innerHTML = pendingParticipants.map(pending => `
        <div class="d-flex align-items-center justify-content-between p-2 border-bottom bg-white" data-user-id="${pending.user._id}">
            <div class="d-flex align-items-center gap-2">
                <div class="bg-secondary text-white rounded-circle d-flex align-items-center justify-content-center" 
                     style="width: 32px; height: 32px; font-size: 0.85rem;">
                    ${pending.user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div class="fw-bold small">${pending.user.name}</div>
                    <div class="text-muted" style="font-size: 0.75rem;">
                        ${new Date(pending.requestedAt).toLocaleTimeString()}
                    </div>
                </div>
            </div>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-success btn-sm" onclick="approveParticipant('${pending.user._id}')" 
                        title="Approve">
                    <i class="bi bi-check-circle"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="denyParticipant('${pending.user._id}')"
                        title="Deny">
                    <i class="bi bi-x-circle"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Render current participants
function renderParticipants() {
    const participantsList = document.getElementById('participants-list');

    if (!participantsList) return;

    if (currentParticipants.length === 0) {
        participantsList.innerHTML = '<p class="text-muted">No participants yet</p>';
        return;
    }

    participantsList.innerHTML = currentParticipants.map(participant => {
        const isOnline = !participant.leftAt;
        const statusClass = isOnline ? 'bg-success' : 'bg-secondary';
        const statusText = isOnline ? 'Online' : 'Left';

        return `
            <div class="d-flex align-items-center justify-content-between mb-2 p-2 border-bottom" data-user-id="${participant.user._id}">
                <div class="d-flex align-items-center gap-2">
                    <div class="position-relative">
                        <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" 
                             style="width: 36px; height: 36px;">
                            ${participant.user.name.charAt(0).toUpperCase()}
                        </div>
                        <span class="position-absolute bottom-0 end-0 ${statusClass} border border-white rounded-circle" 
                              style="width: 10px; height: 10px;"></span>
                    </div>
                    <div>
                        <div class="fw-bold">${participant.user.name}</div>
                        <div class="text-muted small">${statusText}</div>
                    </div>
                </div>
                <div class="d-flex gap-1">
                    ${participant.isMuted ? '<i class="bi bi-mic-mute text-danger"></i>' : '<i class="bi bi-mic text-success"></i>'}
                    ${!participant.cameraEnabled ? '<i class="bi bi-camera-video-off text-danger"></i>' : '<i class="bi bi-camera-video text-success"></i>'}
                </div>
            </div>
        `;
    }).join('');
}

// Approve participant (host/co-host only)
async function approveParticipant(userId) {
    try {
        const response = await fetch(`/meeting/${meetingId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        const data = await response.json();

        if (data.success) {
            // Remove from pending list locally
            pendingParticipants = pendingParticipants.filter(p => p.user._id !== userId);
            renderPendingParticipants();

            // Socket will handle adding to participants list via 'participant-approved' event
            console.log('Participant approved:', userId);
        } else {
            alert('Failed to approve participant: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error approving participant:', error);
        alert('Failed to approve participant');
    }
}

// Deny participant (host/co-host only)
async function denyParticipant(userId) {
    try {
        const response = await fetch(`/meeting/${meetingId}/deny`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        const data = await response.json();

        if (data.success) {
            // Remove from pending list locally
            pendingParticipants = pendingParticipants.filter(p => p.user._id !== userId);
            renderPendingParticipants();

            console.log('Participant denied:', userId);
        } else {
            alert('Failed to deny participant: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error denying participant:', error);
        alert('Failed to deny participant');
    }
}

// Socket event listeners
socket.on('pending-participants-list', (data) => {
    pendingParticipants = data.pendingParticipants || [];
    renderPendingParticipants();
});

socket.on('participants-list', (data) => {
    currentParticipants = data.participants || [];
    renderParticipants();
});

socket.on('participant-requesting', (data) => {
    console.log('🔔 Received participant-requesting event:', data);
    console.log('isHost:', isHost, 'isCoHost:', isCoHost);

    // New participant requesting to join
    if (isHost || isCoHost) {
        console.log('✅ User is host/co-host, processing request...');
        pendingParticipants.push({
            user: data.user,
            requestedAt: data.requestedAt
        });
        renderPendingParticipants();

        // Show approval modal immediately
        showApprovalModal(data.user);
    } else {
        console.log('❌ User is NOT host/co-host, ignoring request');
    }
}); socket.on('participant-approved', (data) => {
    // Participant was approved
    if (data.userId === userId) {
        // This is me! Redirect to meeting room
        window.location.reload();
    } else {
        // Update participants list for others
        socket.emit('get-participants', { meetingId });
    }
});

socket.on('participant-denied', (data) => {
    // Participant was denied
    if (data.userId === userId) {
        // This is me! Show message and redirect
        alert('Your request to join was denied by the host');
        window.location.href = '/meeting';
    }
});

socket.on('participant-joined', (data) => {
    // Someone joined the meeting
    socket.emit('get-participants', { meetingId });
    showNotification(`${data.user.name} joined the meeting`, 'success');
});

socket.on('participant-left', (data) => {
    // Someone left the meeting
    socket.emit('get-participants', { meetingId });
    showNotification(`${data.user.name} left the meeting`, 'warning');
});

// Helper function to show notifications
function showNotification(message, type = 'info') {
    // Simple notification - can be enhanced with better UI
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '9999';
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Show approval modal for join request
function showApprovalModal(user) {
    console.log('📋 showApprovalModal called for user:', user);

    const approvalModal = document.getElementById('approvalModal');
    console.log('Modal element found:', !!approvalModal);

    if (!approvalModal) {
        console.error('❌ Modal element NOT found!');
        return;
    }

    // Set user info in modal
    document.getElementById('approval-user-initial').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('approval-user-name').textContent = user.name;
    document.getElementById('approval-user-email').textContent = user.email || '';

    console.log('✅ Modal content set');

    // Store userId for approval/deny actions
    const approveBtn = document.getElementById('approve-join-btn');
    const denyBtn = document.getElementById('deny-join-btn');

    // Remove old listeners
    const newApproveBtn = approveBtn.cloneNode(true);
    const newDenyBtn = denyBtn.cloneNode(true);
    approveBtn.parentNode.replaceChild(newApproveBtn, approveBtn);
    denyBtn.parentNode.replaceChild(newDenyBtn, denyBtn);

    // Add new listeners
    newApproveBtn.addEventListener('click', async () => {
        console.log('✅ Approve button clicked');
        await approveParticipant(user._id);
        bootstrap.Modal.getInstance(approvalModal).hide();
    });

    newDenyBtn.addEventListener('click', async () => {
        console.log('❌ Deny button clicked');
        await denyParticipant(user._id);
        bootstrap.Modal.getInstance(approvalModal).hide();
    });

    // Show modal
    console.log('🎭 Attempting to show modal...');
    const modal = new bootstrap.Modal(approvalModal);
    modal.show();
    console.log('✅ Modal.show() called');

    // Play notification sound
    playNotificationSound();
}

// Play notification sound
function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwNUaji8LNkHAU7k9n0zHYpBSh+zPLaizsIGWe67OihUBELTKXh8bllHgU2jdT0yX0qBSN6yu/glEILD1iy5+qnVhEJS6Hf8L1nIAUug9Py2Io3Bxpqvunmn1gRC0ul4PGzYh4FOpTZ9cp1KwUlfdDy2oo5Bxhove7jnFENDlCq5O6wYx4FN5DX9Ml6KgUngMzx3Y07Bxdo');
        audio.volume = 0.3;
        audio.play().catch(() => { });
    } catch (e) {
        // Silently fail if audio doesn't work
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initParticipants();
});
