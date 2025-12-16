/**
 * Meeting Client Script
 * Xử lý giao diện và logic phía client cho meeting:
 * - Quản lý video/audio stream (camera, mic, screen share)
 * - WebRTC peer connections
 * - Socket.IO events (join, leave, signaling)
 * - Whiteboard collaboration
 * - Video grid layout (Google Meet style)
 * - Preview modal trước khi join
 */

// Socket.io connection
const socket = io();

// Biến quản lý media streams và connections
let localStream = null;
let remoteStreams = new Map();
let peerConnections = new Map(); // key: userId
let userIdToSocketId = new Map(); // Map userId -> socketId
let socketIdToUserId = new Map(); // Map socketId -> userId
let userIdToName = new Map(); // Map userId -> name
let isMuted = false;
let isVideoEnabled = true;
let isScreenSharing = false;
let screenStream = null;
let handRaised = false;
let mediaInitialized = false; // Flag để đảm bảo chỉ init 1 lần
let whiteboardCanvas = null;
let whiteboardCtx = null;
let whiteboardStrokes = [];
let whiteboardIsVisible = false;
let whiteboardDrawing = false;
let whiteboardLastPoint = null;
let whiteboardPenColor = '#ff4757';
let whiteboardPenSize = 4;
let whiteboardTool = 'pen';
const whiteboardEraseThresholdPx = 20;
const canEditWhiteboard = typeof isHost !== 'undefined' ? (isHost || isCoHost) : false;
let isScreenShareAllowed = true;
let isChatDisabled = false;
const generateStrokeId = () => `stroke_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const activeMeetingAlerts = new Map();
let layoutManager = null;
let screenShareOwnerId = null;
let activeSpeakerId = null;
let currentLayoutMode = 'auto'; // auto, tiled, spotlight, sidebar
let updateVideoGridTimer = null;

// Trạng thái preview modal (hiển thị trước khi join meeting)
let previewStream = null;
let previewCameraEnabled = true;
let previewMicEnabled = true;

// Show preview modal on page load
document.addEventListener('DOMContentLoaded', async () => {
    await showPreviewModal();
});

/**
 * Hiển thị preview modal
 * Cho phép user kiểm tra camera/mic trước khi tham gia meeting
 */
async function showPreviewModal() {
    const modal = new bootstrap.Modal(document.getElementById('previewModal'));
    const previewVideo = document.getElementById('preview-video');
    const previewOffMessage = document.getElementById('preview-off-message');
    const cameraBtn = document.getElementById('preview-toggle-camera');
    const micBtn = document.getElementById('preview-toggle-mic');
    const cameraIcon = document.getElementById('preview-camera-icon');
    const micIcon = document.getElementById('preview-mic-icon');
    const joinBtn = document.getElementById('join-meeting-btn');

    // Get initial media stream
    try {
        previewStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        previewVideo.srcObject = previewStream;
        previewVideo.classList.remove('d-none');
        previewOffMessage.classList.add('d-none');
    } catch (error) {
        console.error('Error getting media:', error);

        // Try audio only if video fails
        try {
            previewStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
            });
            previewCameraEnabled = false;
            previewVideo.classList.add('d-none');
            previewOffMessage.classList.remove('d-none');
        } catch (audioError) {
            console.error('Error getting audio:', audioError);
            previewCameraEnabled = false;
            previewMicEnabled = false;
            previewVideo.classList.add('d-none');
            previewOffMessage.classList.remove('d-none');
        }

        updatePreviewButtons();
    }

    function updatePreviewButtons() {
        // Update camera button
        if (previewCameraEnabled) {
            cameraIcon.className = 'bi bi-camera-video';
            cameraBtn.classList.remove('btn-outline-danger');
            cameraBtn.classList.add('btn-outline-light');
            previewVideo.classList.remove('d-none');
            previewOffMessage.classList.add('d-none');
        } else {
            cameraIcon.className = 'bi bi-camera-video-off';
            cameraBtn.classList.remove('btn-outline-light');
            cameraBtn.classList.add('btn-outline-danger');
            previewVideo.classList.add('d-none');
            previewOffMessage.classList.remove('d-none');
        }

        // Update mic button
        if (previewMicEnabled) {
            micIcon.className = 'bi bi-mic';
            micBtn.classList.remove('btn-outline-danger');
            micBtn.classList.add('btn-outline-light');
        } else {
            micIcon.className = 'bi bi-mic-mute';
            micBtn.classList.remove('btn-outline-light');
            micBtn.classList.add('btn-outline-danger');
        }
    }

    // Camera toggle
    cameraBtn.addEventListener('click', () => {
        previewCameraEnabled = !previewCameraEnabled;
        if (previewStream) {
            const videoTrack = previewStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = previewCameraEnabled;
            }
        }
        updatePreviewButtons();
    });

    // Mic toggle
    micBtn.addEventListener('click', () => {
        previewMicEnabled = !previewMicEnabled;
        if (previewStream) {
            const audioTrack = previewStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = previewMicEnabled;
            }
        }
        updatePreviewButtons();
    });

    // Join button
    joinBtn.addEventListener('click', async () => {
        // Stop preview stream
        if (previewStream) {
            previewStream.getTracks().forEach(track => track.stop());
        }

        // Set initial states
        isMuted = !previewMicEnabled;
        isVideoEnabled = previewCameraEnabled;

        // Hide modal and show meeting container
        modal.hide();
        document.getElementById('meeting-container').style.display = '';

        // Initialize meeting with selected settings and join
        await initializeMedia();
        joinMeeting();

        // Initialize caption controls after meeting container is shown
        if (typeof window.initializeCaptionControls === 'function') {
            setTimeout(() => {
                window.initializeCaptionControls();
            }, 500);
        }
    });

    modal.show();
}

// Đảm bảo peer connection luôn có đầy đủ track local trước khi negotiate để tránh video đen
async function ensureLocalTracksOnPc(pc, targetUserId) {
    console.log('*** ensureLocalTracksOnPc called for:', targetUserId);
    console.log('  localStream:', localStream ? 'exists' : 'null');
    if (localStream) {
        console.log('  localStream tracks:', localStream.getTracks().length);
        localStream.getTracks().forEach(track => {
            console.log('    - local track:', track.kind, track.id, 'enabled:', track.enabled);
        });
    }

    const tryAttach = () => {
        if (!localStream) {
            console.log('  tryAttach: no localStream');
            return false;
        }
        const senders = pc.getSenders();
        console.log('  tryAttach: existing senders:', senders.length);
        let attachedAny = false;
        localStream.getTracks().forEach(track => {
            const hasTrack = senders.some(sender => sender.track === track);
            if (!hasTrack && track.readyState === 'live') {
                pc.addTrack(track, localStream);
                attachedAny = true;
                console.log('  ✓ Attached', track.kind, 'track to peer', targetUserId);
            } else {
                console.log('  - Track already attached or not live:', track.kind);
            }
        });
        const hasAnyLocalTrack = senders.some(sender => localStream.getTracks().includes(sender.track));
        console.log('  tryAttach result: attachedAny=', attachedAny, 'hasAnyLocalTrack=', hasAnyLocalTrack);
        return attachedAny || hasAnyLocalTrack;
    };

    if (tryAttach()) {
        // Nếu đang share screen, đảm bảo sender sử dụng track màn hình
        await ensureScreenTrackPriority(pc);
        return;
    }

    let attempts = 0;
    const maxAttempts = 20;
    while (attempts < maxAttempts) {
        await new Promise(res => setTimeout(res, 250));
        attempts++;
        if (tryAttach()) {
            await ensureScreenTrackPriority(pc);
            return;
        }
    }
    console.warn('Unable to attach local tracks for peer', targetUserId);
}

async function ensureScreenTrackPriority(pc) {
    if (!isScreenSharing || !screenStream) {
        return;
    }
    const [screenVideoTrack] = screenStream.getVideoTracks();
    if (!screenVideoTrack) {
        return;
    }
    const videoSender = pc.getSenders().find(sender => sender.track && sender.track.kind === 'video');
    if (videoSender && videoSender.track !== screenVideoTrack) {
        try {
            await videoSender.replaceTrack(screenVideoTrack);
        } catch (err) {
            console.error('Failed to prioritize screen track:', err);
        }
    }
}

let hasJoinedMeeting = false;

function joinMeeting() {
    if (hasJoinedMeeting) {
        return;
    }
    hasJoinedMeeting = true;

    // Lưu tên của chính mình
    if (typeof userName !== 'undefined') {
        userIdToName.set(userId, userName);
    }

    console.log('*** Emitting join-meeting event ***', { meetingId, userId });
    socket.emit('join-meeting', { meetingId, userId });
    console.log('*** join-meeting event emitted ***');
}

async function startMeetingFlow() {
    try {
        await initializeMedia();
    } catch (mediaError) {
        console.error('Unable to initialize media before joining:', mediaError);
    } finally {
        joinMeeting();
    }
}

// Socket event handlers
socket.on('user-joined', ({ userId: joinedUserId, socketId, name }) => {
    console.log('*** SOCKET EVENT: user-joined ***', joinedUserId, 'socketId:', socketId, 'name:', name);
    // Chỉ tạo peer connection cho user khác, không phải chính mình
    if (joinedUserId && joinedUserId !== userId) {
        // Lưu mapping
        if (socketId) {
            userIdToSocketId.set(joinedUserId, socketId);
            socketIdToUserId.set(socketId, joinedUserId);
            console.log('Saved mapping: userId', joinedUserId, '<-> socketId', socketId);
        }

        // Lưu tên người dùng
        if (name) {
            userIdToName.set(joinedUserId, name);
        }

        // Tạo peer connection với user mới (nếu chưa có)
        if (!peerConnections.has(joinedUserId)) {
            console.log('Creating peer connection for newly joined user:', joinedUserId);
            createPeerConnection(joinedUserId);
        } else {
            console.log('Peer connection already exists for newly joined user:', joinedUserId);
            // Cập nhật socketId nếu chưa có
            if (socketId && !userIdToSocketId.has(joinedUserId)) {
                userIdToSocketId.set(joinedUserId, socketId);
                socketIdToUserId.set(socketId, joinedUserId);
            }
        }

        // Update participants list
        if (typeof updateParticipantsList === 'function') {
            updateParticipantsList();
        }
    }
});
// Nhận danh sách participants hiện có
socket.on('participants-list', ({ participants }) => {
    console.log('*** SOCKET EVENT: participants-list ***', participants);
    // Tạo peer connections cho tất cả participants hiện có (trừ chính mình)
    participants.forEach(p => {
        if (p.userId && p.userId !== userId) {
            // Lưu mapping socketId
            if (p.socketId) {
                userIdToSocketId.set(p.userId, p.socketId);
                socketIdToUserId.set(p.socketId, p.userId);
            }

            // Lưu tên người dùng
            if (p.name) {
                userIdToName.set(p.userId, p.name);
            }

            // Tạo peer connection nếu chưa có
            if (!peerConnections.has(p.userId)) {
                console.log('Creating peer connection for existing participant (listen mode):', p.userId, 'socketId:', p.socketId);
                // Khi mình là người mới vào phòng, để tránh negotiation glare với các peers đã online,
                // khởi tạo peer connection ở chế độ "incoming" để chỉ trả lời offer thay vì tự gửi offer.
                createPeerConnection(p.userId, true);
            } else {
                console.log('Peer connection already exists for:', p.userId);
            }
        }
    });
});

// Nhận thông tin về participant mới (cho các users đã có trong room)
socket.on('new-participant-info', ({ userId: newUserId, socketId, name }) => {
    console.log('New participant info received:', newUserId, 'socketId:', socketId, 'name:', name);
    if (newUserId && newUserId !== userId) {
        // Lưu mapping
        if (socketId) {
            userIdToSocketId.set(newUserId, socketId);
            socketIdToUserId.set(socketId, newUserId);
        }

        // Lưu tên người dùng
        if (name) {
            userIdToName.set(newUserId, name);
        }

        // Tạo peer connection với user mới
        if (!peerConnections.has(newUserId)) {
            console.log('Creating peer connection for new participant:', newUserId);
            createPeerConnection(newUserId);
        }
    }
});

socket.on('user-left', ({ userId: leftUserId, socketId }) => {
    console.log('User left:', leftUserId);
    removeVideoElement(leftUserId);

    // Xóa mapping
    if (socketId) {
        socketIdToUserId.delete(socketId);
    }
    userIdToSocketId.delete(leftUserId);
    userIdToName.delete(leftUserId);

    // Đóng peer connection
    if (peerConnections.has(leftUserId)) {
        peerConnections.get(leftUserId).close();
        peerConnections.delete(leftUserId);
    }

    // Update participants list
    if (typeof updateParticipantsList === 'function') {
        updateParticipantsList();
    }
});

socket.on('offer', async ({ offer, from, fromUserId }) => {
    // Ưu tiên dùng fromUserId từ server để tránh lệ thuộc vào mapping bất đồng bộ
    const targetUserId = fromUserId || socketIdToUserId.get(from) || from;
    console.log('Received offer from socketId:', from, 'userId:', targetUserId);

    // Lưu mapping để các ICE candidates về sau có thể tìm đúng peer
    if (from) {
        socketIdToUserId.set(from, targetUserId);
        userIdToSocketId.set(targetUserId, from);
    }

    // Đợi localStream sẵn sàng nếu chưa có
    if (!localStream) {
        console.log('Waiting for localStream before handling offer...');
        const waitForStream = setInterval(() => {
            if (localStream) {
                clearInterval(waitForStream);
                handleOffer(offer, from, targetUserId);
            }
        }, 100);

        // Timeout sau 5 giây
        setTimeout(() => {
            clearInterval(waitForStream);
            if (localStream) {
                handleOffer(offer, from, targetUserId);
            } else {
                console.error('LocalStream not available after 5 seconds');
            }
        }, 5000);
    } else {
        handleOffer(offer, from, targetUserId);
    }
});
 
async function handleOffer(offer, from, targetUserId) {
    let pc = peerConnections.get(targetUserId);
    if (!pc) {
        console.log('Creating new peer connection for incoming offer from:', targetUserId);
        pc = await createPeerConnection(targetUserId, true); // true = isIncomingOffer
    }

    try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('Set remote description for:', targetUserId);

        // Đảm bảo local tracks có mặt trong SDP answer để remote peers hiển thị video
        await ensureLocalTracksOnPc(pc, targetUserId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('Created and set local answer for:', targetUserId);

        // Gửi answer với socketId
        const targetSocketId = userIdToSocketId.get(targetUserId) || from;
        socket.emit('answer', { meetingId, answer, targetId: targetSocketId });
        console.log('Sent answer to socketId:', targetSocketId, 'userId:', targetUserId);
    } catch (error) {
        console.error('[HandleOffer] Error handling offer:', error);
    }
}

socket.on('answer', async ({ answer, from, fromUserId }) => {
    const targetUserId = fromUserId || socketIdToUserId.get(from) || from;
    console.log('Received answer from socketId:', from, 'userId:', targetUserId);

    if (from) {
        socketIdToUserId.set(from, targetUserId);
        userIdToSocketId.set(targetUserId, from);
    }

    const pc = peerConnections.get(targetUserId);
    if (pc) {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Set remote description (answer) for:', targetUserId);
        } catch (error) {
            console.error('Error setting remote description (answer):', error);
        }
    } else {
        console.warn('No peer connection found for userId:', targetUserId, 'when receiving answer');
    }
});

socket.on('ice-candidate', async ({ candidate, from, fromUserId }) => {
    const targetUserId = fromUserId || socketIdToUserId.get(from) || from;
    console.log('[ICE] Received ICE candidate from socketId:', from, 'userId:', targetUserId);
    console.log('[ICE] Candidate type:', candidate.candidate);

    // Log candidate type
    if (candidate.candidate.includes('typ relay')) {
        console.log('[ICE] ✓ RELAY candidate received - TURN working!');
    } else if (candidate.candidate.includes('typ srflx')) {
        console.log('[ICE] ✓ SRFLX candidate received - STUN working');
    } else if (candidate.candidate.includes('typ host')) {
        console.log('[ICE] ✓ HOST candidate received - local network');
    }

    const pc = peerConnections.get(targetUserId);
    if (pc) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('[ICE] ✓ Successfully added ICE candidate for', targetUserId);
        } catch (error) {
            console.error('[ICE] ✗ Error adding ICE candidate:', error);
        }
    } else {
        console.warn('[ICE] ✗ No peer connection found for userId:', targetUserId);
    }
});

socket.on('camera-toggled', ({ userId: cameraUserId, enabled }) => {
    const { video } = getParticipantMediaElements(cameraUserId);
    if (video) {
        video.style.display = enabled ? 'block' : 'none';
    }
});

socket.on('microphone-toggled', ({ userId: micUserId, enabled }) => {
    const { audio } = getParticipantMediaElements(micUserId);
    if (audio) {
        audio.muted = !enabled;
    }
});

socket.on('screen-share-started', ({ userId: sharerId }) => {
    screenShareOwnerId = sharerId;
    syncVideoLayout();
    console.log('Screen share started by:', sharerId);
});

socket.on('screen-share-stopped', ({ userId: sharerId }) => {
    if (screenShareOwnerId === sharerId) {
        screenShareOwnerId = null;
        syncVideoLayout();
    }
    console.log('Screen share stopped by:', sharerId);
});

socket.on('chat-message', (message) => {
    addChatMessage(message);
});

socket.on('hand-raised', ({ userId }) => {
    showHandRaised(userId);
});

socket.on('hand-lowered', ({ userId }) => {
    hideHandRaised(userId);
});

socket.on('emoji-reaction', ({ userId, emoji }) => {
    showEmojiReaction(userId, emoji);
});

socket.on('whiteboard-toggle', ({ active }) => {
    whiteboardIsVisible = !!active;
    setWhiteboardVisibility(whiteboardIsVisible);
    if (!whiteboardIsVisible) {
        clearWhiteboardLayer();
    }
});

socket.on('whiteboard-state', ({ active, strokes }) => {
    whiteboardStrokes = Array.isArray(strokes) ? strokes.map(stroke => ({
        ...stroke,
        id: stroke.id || generateStrokeId()
    })) : [];
    whiteboardIsVisible = !!active;
    repaintWhiteboard();
    setWhiteboardVisibility(whiteboardIsVisible);
});

socket.on('whiteboard-draw', ({ stroke }) => {
    if (!stroke) return;
    if (!stroke.id) {
        stroke.id = generateStrokeId();
    }
    whiteboardStrokes.push(stroke);
    if (whiteboardStrokes.length > 2000) {
        whiteboardStrokes.shift();
    }
    drawStrokeSegment(stroke, false);
});

socket.on('whiteboard-clear', () => {
    whiteboardStrokes = [];
    clearWhiteboardLayer();
});

socket.on('whiteboard-erase', ({ strokeId }) => {
    if (!strokeId) return;
    removeStrokeById(strokeId);
});

socket.on('poll-created', (poll) => {
    showPoll(poll);
});

socket.on('poll-updated', (poll) => {
    updatePoll(poll);
});

socket.on('question-asked', (question) => {
    addQuestion(question);
});

socket.on('user-muted', ({ userId: mutedUserId }) => {
    if (mutedUserId === userId) {
        muteLocalAudio();
        setMeetingAlert('muted', 'Host muted your microphone');
    }
});

socket.on('co-host-added', ({ userId: coHostUserId }) => {
    if (coHostUserId === userId) {
        // Update local isCoHost flag
        window.isCoHost = true;
        setMeetingAlert('co-host', 'You are now a co-host! You can now mute participants and manage settings.');
    }
    // Update participants list to show new co-host badge
    updateParticipantsList();
});

socket.on('co-host-removed', ({ userId: coHostUserId }) => {
    if (coHostUserId === userId) {
        // Update local isCoHost flag
        window.isCoHost = false;
        setMeetingAlert('co-host', 'You are no longer a co-host.');
    }
    // Update participants list
    updateParticipantsList();
});

socket.on('participant-removed', ({ userId: removedUserId }) => {
    if (removedUserId === userId) {
        // Current user was removed
        alert('You have been removed from the meeting by the host.');
        // Clean up and redirect
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        window.location.href = '/classroom/list';
    } else {
        // Another participant was removed, update list
        updateParticipantsList();
    }
});

socket.on('meeting-ended', ({ message }) => {
    // Meeting was ended by host - show modal
    const modalHtml = `
        <div class="modal fade" id="meetingEndedModal" data-bs-backdrop="static" data-bs-keyboard="false">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i>
                            Meeting Ended
                        </h5>
                    </div>
                    <div class="modal-body text-center py-4">
                        <i class="bi bi-box-arrow-right" style="font-size: 3rem; color: #dc3545;"></i>
                        <p class="mt-3 mb-0">${message || 'The meeting has been ended by the host.'}</p>
                        <p class="text-muted mt-2">You will be redirected shortly...</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="window.location.href='/meeting'">
                            Go to Meetings List
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('meetingEndedModal'));
    modal.show();

    // Clean up resources
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    peerConnections.forEach((pc, peerId) => {
        pc.close();
    });
    peerConnections.clear();

    // Disconnect socket
    socket.disconnect();

    // Auto redirect after 3 seconds
    setTimeout(() => {
        window.location.href = '/meeting';
    }, 3000);
});

socket.on('chat-disabled', () => {
    isChatDisabled = true;
    document.getElementById('chat-input')?.setAttribute('disabled', 'disabled');
    document.getElementById('send-chat')?.setAttribute('disabled', 'disabled');
    setMeetingAlert('chat-disabled', 'Host disabled chat for everyone');

    // Update meeting settings state
    if (!window.meeting) window.meeting = { settings: {} };
    if (!window.meeting.settings) window.meeting.settings = {};
    window.meeting.settings.chatEnabled = false;
});

socket.on('chat-enabled', () => {
    isChatDisabled = false;
    document.getElementById('chat-input')?.removeAttribute('disabled');
    document.getElementById('send-chat')?.removeAttribute('disabled');
    setMeetingAlert('chat-disabled');

    // Update meeting settings state
    if (!window.meeting) window.meeting = { settings: {} };
    if (!window.meeting.settings) window.meeting.settings = {};
    window.meeting.settings.chatEnabled = true;
});

socket.on('screen-share-disabled', async () => {
    isScreenShareAllowed = false;
    document.getElementById('toggle-screen-share')?.setAttribute('disabled', 'disabled');
    setMeetingAlert('screen-share', 'Host disabled screen sharing');
    if (isScreenSharing) {
        await stopScreenShare({ emitEvent: false });
    }

    // Update meeting settings state
    if (!window.meeting) window.meeting = { settings: {} };
    if (!window.meeting.settings) window.meeting.settings = {};
    window.meeting.settings.screenShareEnabled = false;
});

socket.on('screen-share-enabled', () => {
    isScreenShareAllowed = true;
    document.getElementById('toggle-screen-share')?.removeAttribute('disabled');
    setMeetingAlert('screen-share');

    // Update meeting settings state
    if (!window.meeting) window.meeting = { settings: {} };
    if (!window.meeting.settings) window.meeting.settings = {};
    window.meeting.settings.screenShareEnabled = true;
});

// WebRTC functions
async function createPeerConnection(targetUserId, isIncomingOffer = false) {
    // Kiểm tra xem đã có peer connection chưa
    if (peerConnections.has(targetUserId)) {
        console.log('Peer connection already exists for:', targetUserId);
        return peerConnections.get(targetUserId);
    }

    console.log('Creating peer connection for userId:', targetUserId, 'isIncomingOffer:', isIncomingOffer);

    const pc = new RTCPeerConnection({
        iceServers: [
            // Google STUN servers
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },

            // Metered TURN servers (more reliable)
            {
                urls: 'turn:a.relay.metered.ca:80',
                username: 'b8e0a5f07ef3e4f93f8cf7e7',
                credential: 'HdO5Zk5+z9MR0vRe'
            },
            {
                urls: 'turn:a.relay.metered.ca:80?transport=tcp',
                username: 'b8e0a5f07ef3e4f93f8cf7e7',
                credential: 'HdO5Zk5+z9MR0vRe'
            },
            {
                urls: 'turn:a.relay.metered.ca:443',
                username: 'b8e0a5f07ef3e4f93f8cf7e7',
                credential: 'HdO5Zk5+z9MR0vRe'
            },
            {
                urls: 'turn:a.relay.metered.ca:443?transport=tcp',
                username: 'b8e0a5f07ef3e4f93f8cf7e7',
                credential: 'HdO5Zk5+z9MR0vRe'
            },

            // OpenRelay backup
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ],
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
    });

    console.log('[ICE] Created peer connection for', targetUserId, 'with', pc.getConfiguration().iceServers.length, 'ICE servers');

    ensureLocalTracksOnPc(pc, targetUserId);

    pc.ontrack = (event) => {
        console.log('ontrack event fired for:', targetUserId);
        console.log('Event streams:', event.streams.length);
        event.streams.forEach((stream, index) => {
            console.log(`Stream ${index}:`, stream.id, 'tracks:', stream.getTracks().length);
            stream.getTracks().forEach(track => {
                console.log('  Track:', track.kind, track.id, 'enabled:', track.enabled, 'readyState:', track.readyState);
            });
        });

        const [remoteStream] = event.streams;
        if (remoteStream) {
            console.log('Adding remote video for userId:', targetUserId, 'stream tracks:', remoteStream.getTracks().length);
            addRemoteVideo(targetUserId, remoteStream);
        } else {
            console.warn('No remote stream in track event for:', targetUserId);
        }
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            const candidate = event.candidate;
            console.log('[ICE] New candidate for', targetUserId, '- Type:', candidate.type, 'Protocol:', candidate.protocol, 'Address:', candidate.address || 'N/A');
            console.log('[ICE] Candidate string:', candidate.candidate);

            // Log candidate type for debugging
            if (candidate.candidate.includes('typ host')) {
                console.log('[ICE] HOST candidate (local network)');
            } else if (candidate.candidate.includes('typ srflx')) {
                console.log('[ICE] SRFLX candidate (STUN - public IP)');
            } else if (candidate.candidate.includes('typ relay')) {
                console.log('[ICE] RELAY candidate (TURN - can cross NAT)');
            }

            // Tìm socketId từ userId
            const targetSocketId = userIdToSocketId.get(targetUserId);
            if (targetSocketId) {
                socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    targetId: targetSocketId
                });
                console.log('[ICE] Sent candidate to', targetUserId, 'via socketId:', targetSocketId);
            } else {
                console.warn('[ICE] SocketId not found for userId:', targetUserId, '- candidate not sent!');
            }
        } else {
            console.log('[ICE] All candidates gathered for', targetUserId);
        }
    };

    pc.onicegatheringstatechange = () => {
        console.log('[ICE] Gathering state for', targetUserId, ':', pc.iceGatheringState);
    };

    pc.onconnectionstatechange = () => {
        console.log('[Peer] Connection state for', targetUserId, ':', pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state for', targetUserId, ':', pc.iceConnectionState);

        if (pc.iceConnectionState === 'failed') {
            console.warn('ICE connection failed for', targetUserId, '- attempting restart');
            // Try ICE restart
            if (pc.restartIce) {
                pc.restartIce();
            }
        } else if (pc.iceConnectionState === 'disconnected') {
            console.warn('ICE connection disconnected for', targetUserId, '- waiting for reconnect');
            // Wait a bit before taking action
            setTimeout(() => {
                if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                    console.warn('ICE still disconnected/failed for', targetUserId, '- may need to recreate connection');
                }
            }, 3000);
        } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            console.log('ICE connection established for', targetUserId);
        }
    };

    peerConnections.set(targetUserId, pc);

    // Tạo và gửi offer (chỉ khi không phải incoming offer)
    if (!isIncomingOffer) {
        // Đợi localStream nếu chưa có
        const sendOffer = async () => {
            if (!localStream) {
                console.log('Waiting for localStream before creating offer for:', targetUserId);
                return;
            }

            try {
                await ensureLocalTracksOnPc(pc, targetUserId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                console.log('Created offer for:', targetUserId);

                // Tìm socketId từ userId
                const targetSocketId = userIdToSocketId.get(targetUserId);
                if (targetSocketId) {
                    socket.emit('offer', { meetingId, offer, targetId: targetSocketId });
                    console.log('Sent offer to socketId:', targetSocketId, 'userId:', targetUserId);
                } else {
                    console.warn('SocketId not found for userId:', targetUserId, '- will retry when socketId is available');
                    // Retry nhiều lần để đảm bảo gửi được offer
                    let retryCount = 0;
                    const maxRetries = 10;
                    const retryInterval = setInterval(() => {
                        retryCount++;
                        const retrySocketId = userIdToSocketId.get(targetUserId);
                        if (retrySocketId && pc.localDescription) {
                            socket.emit('offer', { meetingId, offer: pc.localDescription, targetId: retrySocketId });
                            console.log('Sent retry offer (attempt', retryCount, ') to socketId:', retrySocketId, 'userId:', targetUserId);
                            clearInterval(retryInterval);
                        } else if (retryCount >= maxRetries) {
                            console.error('Failed to send offer after', maxRetries, 'retries for userId:', targetUserId);
                            clearInterval(retryInterval);
                        }
                    }, 500);
                }
            } catch (error) {
                console.error('Error creating offer:', error);
            }
        };

        if (localStream) {
            sendOffer();
        } else {
            // Đợi localStream với callback
            console.log('Scheduling offer creation for', targetUserId, 'after media initialization');
            const checkStream = setInterval(() => {
                if (localStream) {
                    clearInterval(checkStream);
                    console.log('LocalStream now available, creating offer for:', targetUserId);
                    sendOffer();
                }
            }, 100);

            // Timeout sau 10 giây
            setTimeout(() => {
                clearInterval(checkStream);
                if (!localStream) {
                    console.error('Timeout waiting for localStream to create offer for:', targetUserId);
                }
            }, 10000);
        }
    }

    return pc;
}

// Media controls
async function initializeMedia() {
    // Chỉ init 1 lần
    if (mediaInitialized) {
        console.log('Media already initialized, skipping...');
        return;
    }

    console.log('Initializing media with video:', isVideoEnabled, 'muted:', isMuted);

    try {
        // Nếu đã có stream, dừng nó trước
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }

        // Try to get both video and audio
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: isVideoEnabled,
                audio: true
            });
        } catch (videoError) {
            console.warn('Failed to get video, trying audio only:', videoError);
            // Fallback to audio only if video fails
            localStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
            });
            isVideoEnabled = false;
        }

        // Apply initial video state (if we have video track)
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = isVideoEnabled;
            console.log('Video track enabled:', isVideoEnabled);
        } else {
            console.log('No video track available');
        }

        // Apply initial mic state
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !isMuted;
            console.log('Audio track enabled:', !isMuted);
        }

        console.log('Media stream obtained, adding local video...');
        addLocalVideo(localStream);
        mediaInitialized = true;

        // Update UI buttons to reflect initial state
        updateMediaButtons();

        // Cập nhật tất cả peer connections với localStream mới
        peerConnections.forEach(async (pc, targetUserId) => {
            // Kiểm tra xem đã có tracks chưa
            const existingSenders = pc.getSenders();
            let addedTracks = false;
            localStream.getTracks().forEach(track => {
                const hasTrack = existingSenders.some(sender => sender.track === track);
                if (!hasTrack && track.readyState === 'live') {
                    pc.addTrack(track, localStream);
                    console.log('Added track to existing peer connection:', track.kind, 'for:', targetUserId);
                    addedTracks = true;
                }
            });

            // Nếu thêm tracks mới và PC đã có remote description, cần renegotiate
            if (addedTracks && pc.remoteDescription) {
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    const targetSocketId = userIdToSocketId.get(targetUserId);
                    if (targetSocketId) {
                        socket.emit('offer', { meetingId, offer, targetId: targetSocketId });
                        console.log('Sent renegotiation offer to:', targetUserId);
                    }
                } catch (error) {
                    console.error('Error renegotiating with', targetUserId, error);
                }
            }
        });

        // Notify others with initial states
        socket.emit('toggle-camera', { meetingId, enabled: isVideoEnabled });
        socket.emit('toggle-microphone', { meetingId, enabled: !isMuted });
    } catch (error) {
        console.error('Error accessing media:', error);
        mediaInitialized = false; // Reset để có thể thử lại
    }
}

function updateMediaButtons() {
    // Update mute button
    const toggleMic = document.getElementById('toggle-mic');
    const micIcon = toggleMic?.querySelector('i');
    if (isMuted) {
        toggleMic?.classList.add('btn-danger');
        toggleMic?.classList.remove('btn-outline-light');
        if (micIcon) micIcon.className = 'bi bi-mic-mute';
    } else {
        toggleMic?.classList.remove('btn-danger');
        toggleMic?.classList.add('btn-outline-light');
        if (micIcon) micIcon.className = 'bi bi-mic';
    }

    // Update camera button
    const toggleCamera = document.getElementById('toggle-camera');
    const cameraIcon = toggleCamera?.querySelector('i');
    if (!isVideoEnabled) {
        toggleCamera?.classList.add('btn-danger');
        toggleCamera?.classList.remove('btn-outline-light');
        if (cameraIcon) cameraIcon.className = 'bi bi-camera-video-off';
    } else {
        toggleCamera?.classList.remove('btn-danger');
        toggleCamera?.classList.add('btn-outline-light');
        if (cameraIcon) cameraIcon.className = 'bi bi-camera-video';
    }
}

async function startScreenShare() {
    if (isScreenSharing) {
        return;
    }

    if (!isScreenShareAllowed) {
        setMeetingAlert('screen-share', 'Screen sharing is disabled by the host');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });

        const [screenVideoTrack] = stream.getVideoTracks();
        if (!screenVideoTrack) {
            throw new Error('Unable to capture screen: no video track available');
        }

        screenVideoTrack.onended = () => {
            stopScreenShare();
        };

        screenStream = stream;

        const replaceOps = [];
        peerConnections.forEach((pc) => {
            const videoSender = pc.getSenders().find(sender => sender.track && sender.track.kind === 'video');
            if (videoSender) {
                replaceOps.push(videoSender.replaceTrack(screenVideoTrack));
            } else {
                pc.addTrack(screenVideoTrack, stream);
            }
        });
        await Promise.all(replaceOps);

        const { video: localVideo } = getParticipantMediaElements(userId);
        if (localVideo) {
            localVideo.srcObject = stream;
        }

        isScreenSharing = true;
        screenShareOwnerId = userId;
        syncVideoLayout();
        socket.emit('start-screen-share', { meetingId, streamId: screenVideoTrack.id });
    } catch (error) {
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            screenStream = null;
        }
        throw error;
    }
}

async function stopScreenShare(options = { emitEvent: true }) {
    if (!isScreenSharing) {
        return;
    }

    const cameraTrack = localStream?.getVideoTracks()[0];
    if (cameraTrack) {
        const replaceOps = [];
        peerConnections.forEach((pc) => {
            const videoSender = pc.getSenders().find(sender => sender.track && sender.track.kind === 'video');
            if (videoSender) {
                replaceOps.push(videoSender.replaceTrack(cameraTrack));
            }
        });
        await Promise.all(replaceOps);
    }

    const { video: localVideo } = getParticipantMediaElements(userId);
    if (localVideo && localStream) {
        localVideo.srcObject = localStream;
    }

    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    isScreenSharing = false;
    if (screenShareOwnerId === userId) {
        screenShareOwnerId = null;
    }
    syncVideoLayout();

    if (options?.emitEvent) {
        socket.emit('stop-screen-share', { meetingId });
    }
}

function addLocalVideo(stream) {
    if (!stream) {
        console.warn('No local stream provided to addLocalVideo');
        return;
    }
    localStream = stream;
    syncVideoLayout();
}

function addRemoteVideo(targetUserId, stream) {
    if (!stream) {
        console.warn('No remote stream for user:', targetUserId);
        return;
    }
    console.log('*** addRemoteVideo called ***');
    console.log('  targetUserId:', targetUserId);
    console.log('  stream id:', stream.id);
    console.log('  stream tracks:', stream.getTracks().length);
    stream.getTracks().forEach(track => {
        console.log('    - track:', track.kind, track.id, 'enabled:', track.enabled, 'readyState:', track.readyState);
    });
    remoteStreams.set(targetUserId, stream);
    console.log('  remoteStreams size after add:', remoteStreams.size);
    syncVideoLayout();
}

function removeVideoElement(userId) {
    remoteStreams.delete(userId);
    if (screenShareOwnerId === userId) {
        screenShareOwnerId = null;
    }
    syncVideoLayout();
}

function initializeLayoutManager() {
    // Không cần VideoLayoutManager - sử dụng CSS Grid thuần
    console.log('Using native CSS Grid layout (Google Meet style)');
}

function getParticipantDisplayName(participantId) {
    if (!participantId) {
        return 'Participant';
    }
    return participantId === userId ? 'You' : `User ${participantId}`;
}

function syncVideoLayout() {
    const grid = document.getElementById('video-grid');
    if (!grid) {
        console.warn('Video grid not found');
        return;
    }

    console.log('=== syncVideoLayout START ===');
    console.log('localStream:', localStream ? 'exists' : 'null');
    console.log('remoteStreams size:', remoteStreams.size);
    console.log('remoteStreams keys:', Array.from(remoteStreams.keys()));

    // Stop all video/audio elements before clearing to prevent play() interruption
    const existingVideos = grid.querySelectorAll('video');
    existingVideos.forEach(v => {
        v.pause();
        v.srcObject = null;
    });
    const existingAudios = grid.querySelectorAll('audio');
    existingAudios.forEach(a => {
        a.pause();
        a.srcObject = null;
    });

    // Clear existing
    grid.innerHTML = '';

    const participants = [];
    if (localStream) {
        const displayStream = (isScreenSharing && screenStream) ? screenStream : localStream;
        participants.push({
            id: userId,
            stream: displayStream,
            name: 'You',
            isSelf: true,
            isScreenShare: isScreenSharing
        });
    }

    remoteStreams.forEach((stream, remoteId) => {
        console.log('Adding remote participant:', remoteId, 'stream tracks:', stream.getTracks().length);
        participants.push({
            id: remoteId,
            stream,
            name: getParticipantDisplayName(remoteId),
            isSelf: false,
            isScreenShare: remoteId === screenShareOwnerId
        });
    });

    const count = participants.length;
    console.log('Total participants:', count);
    if (count === 0) {
        console.log('No participants to display');
        return;
    }

    // Check if anyone is screen sharing
    const screenShareParticipant = participants.find(p => p.isScreenShare);
    const hasScreenShare = !!screenShareParticipant;

    // Apply layout based on mode
    if (currentLayoutMode === 'auto') {
        applyAutoLayout(grid, participants, hasScreenShare, screenShareParticipant);
    } else if (currentLayoutMode === 'tiled') {
        applyTiledLayout(grid, participants);
    } else if (currentLayoutMode === 'spotlight') {
        applySpotlightLayout(grid, participants, screenShareParticipant);
    } else if (currentLayoutMode === 'sidebar') {
        applySidebarLayout(grid, participants, screenShareParticipant);
    }
}

function applyAutoLayout(grid, participants, hasScreenShare, screenShareParticipant) {
    if (hasScreenShare) {
        // Screen share layout: main video + sidebar thumbnails
        grid.style.display = 'flex';
        grid.style.flexDirection = 'row';
        grid.style.gridTemplateColumns = '';
        grid.style.gridTemplateRows = '';
        grid.style.maxHeight = '100%';
        grid.style.overflow = 'hidden';

        // Create main screen share area
        const mainArea = document.createElement('div');
        mainArea.style.flex = '1';
        mainArea.style.display = 'flex';
        mainArea.style.alignItems = 'center';
        mainArea.style.justifyContent = 'center';
        mainArea.style.background = '#000';
        mainArea.style.minHeight = '0';
        mainArea.style.maxHeight = '100%';
        mainArea.style.overflow = 'hidden';

        // Create sidebar for other participants
        const sidebar = document.createElement('div');
        sidebar.style.width = '200px';
        sidebar.style.display = 'flex';
        sidebar.style.flexDirection = 'column';
        sidebar.style.gap = '8px';
        sidebar.style.padding = '8px';
        sidebar.style.overflowY = 'auto';
        sidebar.style.maxHeight = '100%';

        // Add screen share to main area
        const mainWrapper = createVideoWrapper(screenShareParticipant, true);
        mainArea.appendChild(mainWrapper);
        grid.appendChild(mainArea);

        // Add other participants to sidebar
        participants.forEach(participant => {
            if (!participant.isScreenShare) {
                const wrapper = createVideoWrapper(participant, false);
                wrapper.style.height = '120px';
                sidebar.appendChild(wrapper);
            }
        });

        grid.appendChild(sidebar);
    } else {
        applyTiledLayout(grid, participants);
    }
}

function applyTiledLayout(grid, participants) {
    // Normal grid layout
    grid.style.display = 'grid';
    grid.style.flexDirection = '';
    grid.style.maxHeight = '100%';
    grid.style.overflow = 'hidden';

    const count = participants.length;
    // Google Meet algorithm: calculate optimal grid
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    // Apply grid layout
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    grid.style.alignContent = 'center';

    // Create video elements
    participants.forEach(participant => {
        const wrapper = createVideoWrapper(participant, false);
        grid.appendChild(wrapper);
    });

    console.log(`Grid layout: ${cols} cols × ${rows} rows for ${count} participants`);
}

function applySpotlightLayout(grid, participants, screenShareParticipant) {
    // Spotlight: 1 main video (active speaker or screen share) + small thumbnails
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gridTemplateColumns = '';
    grid.style.gridTemplateRows = '';
    grid.style.maxHeight = '100%';
    grid.style.overflow = 'hidden';

    // Main spotlight area (80% height)
    const mainArea = document.createElement('div');
    mainArea.style.flex = '1';
    mainArea.style.display = 'flex';
    mainArea.style.alignItems = 'center';
    mainArea.style.justifyContent = 'center';
    mainArea.style.background = '#000';
    mainArea.style.minHeight = '0';
    mainArea.style.overflow = 'hidden';

    // Thumbnails strip at bottom (20% height)
    const thumbnailStrip = document.createElement('div');
    thumbnailStrip.style.height = '120px';
    thumbnailStrip.style.display = 'flex';
    thumbnailStrip.style.flexDirection = 'row';
    thumbnailStrip.style.gap = '8px';
    thumbnailStrip.style.padding = '8px';
    thumbnailStrip.style.overflowX = 'auto';
    thumbnailStrip.style.background = 'rgba(0,0,0,0.3)';

    // Determine spotlight participant (screen share > active speaker > first participant)
    let spotlightParticipant = screenShareParticipant;
    if (!spotlightParticipant && activeSpeakerId) {
        spotlightParticipant = participants.find(p => p.id === activeSpeakerId);
    }
    if (!spotlightParticipant && participants.length > 0) {
        spotlightParticipant = participants[0];
    }

    if (spotlightParticipant) {
        const mainWrapper = createVideoWrapper(spotlightParticipant, true);
        mainArea.appendChild(mainWrapper);
    }

    // Add other participants to thumbnail strip
    participants.forEach(participant => {
        if (participant.id !== spotlightParticipant?.id) {
            const wrapper = createVideoWrapper(participant, false);
            wrapper.style.width = '160px';
            wrapper.style.height = '90px';
            wrapper.style.flexShrink = '0';
            thumbnailStrip.appendChild(wrapper);
        }
    });

    grid.appendChild(mainArea);
    grid.appendChild(thumbnailStrip);
}

function applySidebarLayout(grid, participants, screenShareParticipant) {
    // Sidebar: vertical thumbnails on right, main area on left
    grid.style.display = 'flex';
    grid.style.flexDirection = 'row';
    grid.style.gridTemplateColumns = '';
    grid.style.gridTemplateRows = '';
    grid.style.maxHeight = '100%';
    grid.style.overflow = 'hidden';

    // Main area (primary participant or grid)
    const mainArea = document.createElement('div');
    mainArea.style.flex = '1';
    mainArea.style.display = 'flex';
    mainArea.style.alignItems = 'center';
    mainArea.style.justifyContent = 'center';
    mainArea.style.background = '#000';
    mainArea.style.minHeight = '0';
    mainArea.style.overflow = 'hidden';

    // Sidebar for thumbnails
    const sidebar = document.createElement('div');
    sidebar.style.width = '200px';
    sidebar.style.display = 'flex';
    sidebar.style.flexDirection = 'column';
    sidebar.style.gap = '8px';
    sidebar.style.padding = '8px';
    sidebar.style.overflowY = 'auto';
    sidebar.style.maxHeight = '100%';
    sidebar.style.background = 'rgba(0,0,0,0.2)';

    // Determine main participant
    let mainParticipant = screenShareParticipant;
    if (!mainParticipant && activeSpeakerId) {
        mainParticipant = participants.find(p => p.id === activeSpeakerId);
    }
    if (!mainParticipant && participants.length > 0) {
        mainParticipant = participants[0];
    }

    if (mainParticipant) {
        const mainWrapper = createVideoWrapper(mainParticipant, true);
        mainArea.appendChild(mainWrapper);
    }

    // Add other participants to sidebar
    participants.forEach(participant => {
        if (participant.id !== mainParticipant?.id) {
            const wrapper = createVideoWrapper(participant, false);
            wrapper.style.height = '120px';
            sidebar.appendChild(wrapper);
        }
    });

    grid.appendChild(mainArea);
    grid.appendChild(sidebar);
}

function updateVideoGrid() {
    // Debounce to prevent rapid updates
    if (updateVideoGridTimer) {
        clearTimeout(updateVideoGridTimer);
    }

    updateVideoGridTimer = setTimeout(() => {
        updateVideoGridImmediate();
    }, 150);
}

function updateVideoGridImmediate() {
    const grid = document.getElementById('video-grid');
    if (!grid) {
        console.warn('Video grid not found');
        return;
    }

    console.log('=== updateVideoGrid START ===');

    // Stop all video/audio elements before clearing
    const existingVideos = grid.querySelectorAll('video');
    existingVideos.forEach(v => {
        v.pause();
        v.srcObject = null;
    });
    const existingAudios = grid.querySelectorAll('audio');
    existingAudios.forEach(a => {
        a.pause();
        a.srcObject = null;
    });

    // Clear existing
    grid.innerHTML = '';

    const participants = [];
    if (localStream) {
        const displayStream = (isScreenSharing && screenStream) ? screenStream : localStream;
        participants.push({
            id: userId,
            stream: displayStream,
            name: 'You',
            isSelf: true,
            isScreenShare: isScreenSharing
        });
    }

    remoteStreams.forEach((stream, remoteId) => {
        console.log('Adding remote participant:', remoteId, 'stream tracks:', stream.getTracks().length);
        participants.push({
            id: remoteId,
            stream,
            name: getParticipantDisplayName(remoteId),
            isSelf: false,
            isScreenShare: remoteId === screenShareOwnerId
        });
    });

    const count = participants.length;
    console.log('Total participants:', count);
    if (count === 0) {
        console.log('No participants to display');
        return;
    }

    // Check if anyone is screen sharing
    const screenShareParticipant = participants.find(p => p.isScreenShare);
    const hasScreenShare = !!screenShareParticipant;

    // Apply layout based on mode
    if (currentLayoutMode === 'auto') {
        applyAutoLayout(grid, participants, hasScreenShare, screenShareParticipant);
    } else if (currentLayoutMode === 'tiled') {
        applyTiledLayout(grid, participants);
    } else if (currentLayoutMode === 'spotlight') {
        applySpotlightLayout(grid, participants, screenShareParticipant);
    } else if (currentLayoutMode === 'sidebar') {
        applySidebarLayout(grid, participants, screenShareParticipant);
    }
}

function createVideoWrapper(participant, isMainScreen = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';
    wrapper.setAttribute('data-participant-id', participant.id);

    // Apply size constraints for main screen
    if (isMainScreen) {
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        wrapper.style.maxHeight = '100%';
        wrapper.style.maxWidth = '100%';
    }

    if (participant.isScreenShare) {
        wrapper.classList.add('screen-share');
    }

    if (activeSpeakerId === participant.id) {
        wrapper.classList.add('active-speaker');
    }

    const hasVideo = participant.stream && participant.stream.getVideoTracks().length > 0;
    const videoEnabled = hasVideo && participant.stream.getVideoTracks().some(t => t.enabled);

    if (hasVideo) {
        const video = document.createElement('video');
        video.className = 'participant-video';
        video.autoplay = true;
        video.playsinline = true;
        video.muted = participant.isSelf;
        video.srcObject = participant.stream;

        // Ensure video doesn't overflow
        if (isMainScreen) {
            video.style.maxWidth = '100%';
            video.style.maxHeight = '100%';
            video.style.objectFit = 'contain';
        }

        // If video is disabled, show placeholder on top
        if (!videoEnabled) {
            video.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.className = 'video-placeholder';
            const avatar = document.createElement('div');
            avatar.className = 'avatar-circle';
            avatar.textContent = participant.name.charAt(0).toUpperCase();
            placeholder.appendChild(avatar);
            wrapper.appendChild(placeholder);
        }

        wrapper.appendChild(video);

        // Force play to handle autoplay restrictions with delay
        setTimeout(() => {
            if (video.parentElement) {
                video.play().catch(err => {
                    console.warn('Video autoplay failed for', participant.name, err);
                    // Try again after a short delay
                    setTimeout(() => {
                        if (video.parentElement) {
                            video.play().catch(e => console.warn('Second play attempt failed:', e));
                        }
                    }, 500);
                });
            }
        }, 100);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'video-placeholder';
        const avatar = document.createElement('div');
        avatar.className = 'avatar-circle';
        avatar.textContent = participant.name.charAt(0).toUpperCase();
        placeholder.appendChild(avatar);
        wrapper.appendChild(placeholder);
    }

    // Add audio element for remote participants
    if (!participant.isSelf && participant.stream) {
        const audio = document.createElement('audio');
        audio.className = 'participant-audio';
        audio.autoplay = true;
        audio.srcObject = participant.stream;
        wrapper.appendChild(audio);

        // Force play
        audio.play().catch(err => {
            console.warn('Audio autoplay failed for', participant.name, err);
        });
    }

    // Add name label
    const label = document.createElement('div');
    label.className = 'video-label';

    // Lấy tên từ Map hoặc dùng participant.name, hoặc dùng userId làm fallback
    const userName = userIdToName.get(participant.id) || participant.name || `User ${participant.id}`;
    label.textContent = userName;
    wrapper.appendChild(label);

    return wrapper;
}

function getParticipantWrapper(participantId) {
    if (!participantId) {
        return null;
    }
    let safeId = participantId;
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        safeId = CSS.escape(participantId);
    } else {
        safeId = participantId.replace(/"/g, '\\"');
    }
    return document.querySelector(`#video-grid .video-wrapper[data-participant-id="${safeId}"]`);
}

function getParticipantMediaElements(participantId) {
    const wrapper = getParticipantWrapper(participantId);
    return {
        wrapper,
        video: wrapper?.querySelector('.participant-video') || null,
        audio: wrapper?.querySelector('.participant-audio') || null
    };
}

function setMeetingAlert(key, message) {
    const banner = document.getElementById('meeting-alert');
    if (!banner) {
        return;
    }
    if (message) {
        activeMeetingAlerts.set(key, message);
    } else {
        activeMeetingAlerts.delete(key);
    }

    if (activeMeetingAlerts.size === 0) {
        banner.classList.add('d-none');
        banner.textContent = '';
    } else {
        banner.textContent = Array.from(activeMeetingAlerts.values()).join(' • ');
        banner.classList.remove('d-none');
    }
}

function addChatMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = 'mb-2';
    messageDiv.innerHTML = `
        <strong>${message.user.name}:</strong> ${message.message}
        <small class="text-muted d-block">${new Date(message.createdAt).toLocaleTimeString()}</small>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showHandRaised(raisedUserId) {
    const wrapper = getParticipantWrapper(raisedUserId);
    if (wrapper) {
        const label = wrapper.querySelector('.video-label');
        if (label && !label.querySelector('.hand-indicator')) {
            const badge = document.createElement('span');
            badge.className = 'badge bg-warning ms-2 hand-indicator';
            badge.textContent = '✋';
            label.appendChild(badge);
        }
    }
}

function hideHandRaised(raisedUserId) {
    const wrapper = getParticipantWrapper(raisedUserId);
    if (wrapper) {
        const indicator = wrapper.querySelector('.hand-indicator');
        indicator?.remove();
    }
}

function showEmojiReaction(reactUserId, emoji) {
    const wrapper = getParticipantWrapper(reactUserId);
    if (wrapper) {
        const reactionDiv = document.createElement('div');
        reactionDiv.className = 'emoji-reaction';
        reactionDiv.textContent = emoji;
        reactionDiv.style.cssText = 'position: absolute; top: 10px; right: 10px; font-size: 32px; animation: pop 0.5s; z-index: 10;';
        wrapper.appendChild(reactionDiv);
        setTimeout(() => reactionDiv.remove(), 2000);
    }
}

function showReactionsMenu() {
    const reactions = ['👍', '👎', '❤️', '😂', '😮', '👏', '🔥'];
    const menu = document.createElement('div');
    menu.className = 'position-fixed reaction-menu';
    menu.style.cssText = 'bottom: 100px; left: 50%; transform: translateX(-50%); z-index: 1000; background: white; padding: 10px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
    menu.innerHTML = `
        <div class="d-flex gap-2">
            ${reactions.map(emoji => `
                <button class="btn btn-lg" data-emoji="${emoji}" style="font-size: 24px;">${emoji}</button>
            `).join('')}
        </div>
    `;
    menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            sendReaction(btn.dataset.emoji);
            menu.remove();
        });
    });
    document.body.appendChild(menu);
    setTimeout(() => menu.remove(), 5000);
}

function sendReaction(emoji) {
    socket.emit('emoji-reaction', { meetingId, userId, emoji });
}

window.sendReaction = sendReaction;

function muteLocalAudio() {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = false;
        });
        isMuted = true;
        const micBtn = document.getElementById('toggle-mic');
        if (micBtn) {
            micBtn.innerHTML = '<i class="bi bi-mic-mute"></i>';
        }
    }
}

function setWhiteboardVisibility(visible) {
    const overlay = document.getElementById('whiteboard-overlay');
    if (!overlay) {
        return;
    }
    if (visible) {
        overlay.classList.add('active');
        whiteboardIsVisible = true;
        requestAnimationFrame(() => resizeWhiteboardCanvas());
    } else {
        overlay.classList.remove('active');
        whiteboardIsVisible = false;
    }

    const toggleBtn = document.getElementById('toggle-whiteboard');
    if (toggleBtn) {
        toggleBtn.classList.toggle('btn-primary', visible);
        toggleBtn.classList.toggle('btn-secondary', !visible);
    }
}

function resizeWhiteboardCanvas() {
    if (!whiteboardCanvas) {
        return;
    }
    const overlay = document.getElementById('whiteboard-overlay');
    if (!overlay) {
        return;
    }
    const toolbar = overlay.querySelector('.whiteboard-toolbar');
    const availableHeight = overlay.clientHeight - (toolbar ? toolbar.offsetHeight : 0);
    const width = overlay.clientWidth;
    if (width <= 0 || availableHeight <= 0) {
        return;
    }
    whiteboardCanvas.width = width;
    whiteboardCanvas.height = availableHeight;
    whiteboardCanvas.style.width = `${width}px`;
    whiteboardCanvas.style.height = `${availableHeight}px`;
    repaintWhiteboard();
}

function clearWhiteboardLayer() {
    if (whiteboardCtx && whiteboardCanvas) {
        whiteboardCtx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    }
}

function setWhiteboardTool(tool) {
    if (!canEditWhiteboard) {
        return;
    }
    whiteboardTool = tool;
    const penBtn = document.getElementById('whiteboard-tool-pen');
    const eraserBtn = document.getElementById('whiteboard-tool-eraser');
    if (penBtn && eraserBtn) {
        penBtn.classList.toggle('active', tool === 'pen');
        eraserBtn.classList.toggle('active', tool === 'eraser');
    }
    if (whiteboardCanvas) {
        whiteboardCanvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
    }
}

function removeStrokeById(strokeId) {
    if (!strokeId) {
        return null;
    }
    const index = whiteboardStrokes.findIndex(stroke => stroke.id === strokeId);
    if (index === -1) {
        return null;
    }
    const [removed] = whiteboardStrokes.splice(index, 1);
    repaintWhiteboard();
    return removed;
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
        return Math.hypot(px - x1, py - y1);
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    return Math.hypot(px - closestX, py - closestY);
}

function findStrokeIndexNearPoint(point) {
    if (!whiteboardCanvas) {
        return -1;
    }
    const width = whiteboardCanvas.width;
    const height = whiteboardCanvas.height;
    const px = point.x * width;
    const py = point.y * height;

    for (let i = whiteboardStrokes.length - 1; i >= 0; i--) {
        const stroke = whiteboardStrokes[i];
        if (!stroke.start || !stroke.end) {
            continue;
        }
        const startX = (stroke.start.x || 0) * width;
        const startY = (stroke.start.y || 0) * height;
        const endX = (stroke.end.x || 0) * width;
        const endY = (stroke.end.y || 0) * height;
        const distance = distancePointToSegment(px, py, startX, startY, endX, endY);
        const threshold = (stroke.size || whiteboardPenSize) * 2 + whiteboardEraseThresholdPx;
        if (distance <= threshold) {
            return i;
        }
    }
    return -1;
}

function eraseStrokeAtPoint(point) {
    if (!canEditWhiteboard) {
        return;
    }
    const index = findStrokeIndexNearPoint(point);
    if (index === -1) {
        return;
    }
    const [removed] = whiteboardStrokes.splice(index, 1);
    repaintWhiteboard();
    if (removed?.id) {
        socket.emit('whiteboard-erase', { meetingId, strokeId: removed.id });
    }
}

function drawStrokeSegment(stroke, commit = false) {
    if (!whiteboardCtx || !whiteboardCanvas || !stroke || !stroke.start || !stroke.end) {
        return;
    }
    const width = whiteboardCanvas.width;
    const height = whiteboardCanvas.height;

    whiteboardCtx.strokeStyle = stroke.color || '#ffffff';
    whiteboardCtx.lineWidth = stroke.size || 2;
    whiteboardCtx.lineCap = 'round';
    whiteboardCtx.lineJoin = 'round';
    whiteboardCtx.beginPath();
    whiteboardCtx.moveTo((stroke.start.x || 0) * width, (stroke.start.y || 0) * height);
    whiteboardCtx.lineTo((stroke.end.x || 0) * width, (stroke.end.y || 0) * height);
    whiteboardCtx.stroke();

    if (commit) {
        if (!stroke.id) {
            stroke.id = generateStrokeId();
        }
        whiteboardStrokes.push(stroke);
        if (whiteboardStrokes.length > 2000) {
            whiteboardStrokes.shift();
        }
    }
}

function repaintWhiteboard() {
    clearWhiteboardLayer();
    whiteboardStrokes.forEach(stroke => drawStrokeSegment(stroke, false));
}

function getNormalizedPoint(event) {
    if (!whiteboardCanvas) {
        return { x: 0, y: 0 };
    }
    const rect = whiteboardCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / (rect.width || 1);
    const y = (event.clientY - rect.top) / (rect.height || 1);
    return {
        x: Math.min(Math.max(x, 0), 1),
        y: Math.min(Math.max(y, 0), 1)
    };
}

function bindWhiteboardDrawingEvents() {
    if (!whiteboardCanvas || !canEditWhiteboard) {
        return;
    }

    const startDrawing = (event) => {
        if (!whiteboardIsVisible) return;
        event.preventDefault();
        const point = getNormalizedPoint(event);
        if (whiteboardTool === 'eraser') {
            eraseStrokeAtPoint(point);
            whiteboardDrawing = true;
            return;
        }
        whiteboardDrawing = true;
        whiteboardLastPoint = point;
    };

    const draw = (event) => {
        if (!whiteboardIsVisible) return;
        event.preventDefault();
        const currentPoint = getNormalizedPoint(event);
        if (whiteboardTool === 'eraser') {
            if (whiteboardDrawing) {
                eraseStrokeAtPoint(currentPoint);
            }
            return;
        }
        if (!whiteboardDrawing) {
            return;
        }
        if (!whiteboardLastPoint) {
            whiteboardLastPoint = currentPoint;
            return;
        }
        const stroke = {
            start: whiteboardLastPoint,
            end: currentPoint,
            color: whiteboardPenColor,
            size: whiteboardPenSize
        };
        drawStrokeSegment(stroke, true);
        socket.emit('whiteboard-draw', { meetingId, stroke });
        whiteboardLastPoint = currentPoint;
    };

    const stopDrawing = () => {
        whiteboardDrawing = false;
        whiteboardLastPoint = null;
    };

    whiteboardCanvas.addEventListener('pointerdown', startDrawing);
    whiteboardCanvas.addEventListener('pointermove', draw);
    whiteboardCanvas.addEventListener('pointerup', stopDrawing);
    whiteboardCanvas.addEventListener('pointerleave', stopDrawing);
    whiteboardCanvas.addEventListener('pointercancel', stopDrawing);
}

function initializeWhiteboard() {
    whiteboardCanvas = document.getElementById('whiteboard-canvas');
    const overlay = document.getElementById('whiteboard-overlay');
    if (!whiteboardCanvas || !overlay) {
        return;
    }

    whiteboardCtx = whiteboardCanvas.getContext('2d');

    if (!canEditWhiteboard) {
        whiteboardCanvas.classList.add('whiteboard-view-only');
    }

    const colorInput = document.getElementById('whiteboard-color');
    const sizeSelect = document.getElementById('whiteboard-size');
    const clearBtn = document.getElementById('whiteboard-clear');
    const hideBtn = document.getElementById('whiteboard-hide');
    const penBtn = document.getElementById('whiteboard-tool-pen');
    const eraserBtn = document.getElementById('whiteboard-tool-eraser');

    if (colorInput) {
        colorInput.addEventListener('change', (e) => {
            whiteboardPenColor = e.target.value || '#ffffff';
        });
    }
    if (sizeSelect) {
        sizeSelect.addEventListener('change', (e) => {
            const sizeValue = parseInt(e.target.value, 10);
            whiteboardPenSize = Number.isNaN(sizeValue) ? 4 : sizeValue;
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearWhiteboardLayer();
            whiteboardStrokes = [];
            socket.emit('whiteboard-clear', { meetingId });
        });
    }
    if (hideBtn) {
        hideBtn.addEventListener('click', () => {
            whiteboardIsVisible = false;
            socket.emit('whiteboard-toggle', { meetingId, active: false });
            setWhiteboardVisibility(false);
        });
    }

    if (penBtn) {
        penBtn.addEventListener('click', () => setWhiteboardTool('pen'));
    }
    if (eraserBtn) {
        eraserBtn.addEventListener('click', () => setWhiteboardTool('eraser'));
    }

    bindWhiteboardDrawingEvents();
    setWhiteboardVisibility(whiteboardIsVisible);
    repaintWhiteboard();

    window.addEventListener('resize', () => {
        if (whiteboardIsVisible) {
            resizeWhiteboardCanvas();
        }
    });

    if (whiteboardIsVisible) {
        resizeWhiteboardCanvas();
    }

    if (canEditWhiteboard) {
        setWhiteboardTool(whiteboardTool);
    }
}

let eventListenersInitialized = false;

function initializeEventListeners() {
    // Chỉ init 1 lần
    if (eventListenersInitialized) {
        console.log('Event listeners already initialized');
        return;
    }
    eventListenersInitialized = true;
    initializeLayoutManager();
    syncVideoLayout();
    // UI Controls
    document.getElementById('toggle-mic')?.addEventListener('click', async () => {
        if (localStream) {
            isMuted = !isMuted;
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !isMuted;
            });
            socket.emit('toggle-microphone', { meetingId, enabled: !isMuted });
            updateMediaButtons();
            if (!isMuted) {
                setMeetingAlert('muted');
            }
        }
    });

    document.getElementById('toggle-camera').addEventListener('click', async () => {
        if (localStream) {
            isVideoEnabled = !isVideoEnabled;
            localStream.getVideoTracks().forEach(track => {
                track.enabled = isVideoEnabled;
            });
            socket.emit('toggle-camera', { meetingId, enabled: isVideoEnabled });
            updateMediaButtons();
        }
    });

    const toggleScreenShareBtn = document.getElementById('toggle-screen-share');
    if (toggleScreenShareBtn) {
        toggleScreenShareBtn.addEventListener('click', async () => {
            if (!isScreenShareAllowed && !isScreenSharing) {
                setMeetingAlert('screen-share', 'Screen sharing is disabled by the host');
                return;
            }

            if (!isScreenSharing) {
                try {
                    await startScreenShare();
                } catch (error) {
                    console.error('Error sharing screen:', error);
                }
            } else {
                await stopScreenShare();
            }
        });
    }

    const whiteboardButton = document.getElementById('toggle-whiteboard');
    if (whiteboardButton) {
        whiteboardButton.addEventListener('click', async () => {
            // If screen sharing, stop it first
            if (isScreenSharing) {
                await stopScreenShare();
                setMeetingAlert('whiteboard-screen-share', 'Screen sharing stopped to show whiteboard');
                setTimeout(() => setMeetingAlert('whiteboard-screen-share'), 3000);
            }

            whiteboardIsVisible = !whiteboardIsVisible;
            socket.emit('whiteboard-toggle', { meetingId, active: whiteboardIsVisible });
            setWhiteboardVisibility(whiteboardIsVisible);
        });
    }

    document.getElementById('raise-hand').addEventListener('click', () => {
        handRaised = !handRaised;
        if (handRaised) {
            socket.emit('raise-hand', { meetingId, userId });
        } else {
            socket.emit('lower-hand', { meetingId, userId });
        }
    });

    // Layout selector
    const layoutSelect = document.getElementById('layout-select');
    if (layoutSelect) {
        layoutSelect.addEventListener('change', (e) => {
            currentLayoutMode = e.target.value;
            console.log('Layout mode changed to:', currentLayoutMode);
            updateVideoGrid();
        });
    }

    // Chat
    document.getElementById('toggle-chat').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const chatPanel = document.getElementById('chat-panel');
        const participantsPanel = document.getElementById('participants-panel');

        if (sidebar.style.display === 'none') {
            sidebar.style.display = 'block';
            chatPanel.classList.remove('d-none');
            participantsPanel.classList.add('d-none');
        } else if (chatPanel.classList.contains('d-none')) {
            chatPanel.classList.remove('d-none');
            participantsPanel.classList.add('d-none');
        } else {
            sidebar.style.display = 'none';
        }
    });

    const sendChatBtn = document.getElementById('send-chat');
    const chatInput = document.getElementById('chat-input');

    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener('click', () => {
            if (isChatDisabled) {
                setMeetingAlert('chat-disabled', 'Chat is currently disabled by the host');
                return;
            }

            const message = chatInput.value.trim();
            if (message) {
                socket.emit('chat-message', { meetingId, userId, message });
                chatInput.value = '';
            }
        });

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !chatInput.disabled) {
                sendChatBtn.click();
            }
        });
    }

    // Participants panel
    document.getElementById('toggle-participants').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const chatPanel = document.getElementById('chat-panel');
        const participantsPanel = document.getElementById('participants-panel');

        if (sidebar.style.display === 'none' || sidebar.style.display === '') {
            sidebar.style.display = 'block';
            participantsPanel.classList.remove('d-none');
            chatPanel.classList.add('d-none');
        } else if (participantsPanel.classList.contains('d-none')) {
            participantsPanel.classList.remove('d-none');
            chatPanel.classList.add('d-none');
        } else {
            sidebar.style.display = 'none';
        }
        updateParticipantsList();
    });

    function updateParticipantsList() {
        const participantsList = document.getElementById('participants-list');
        if (!participantsList) return;

        // Get current participants from meeting
        fetch(`/meeting/${meetingId}`)
            .then(res => res.text())
            .then(html => {
                // Parse participants from meeting data
                // For now, show current user and remote users
                const participants = [userId, ...Array.from(remoteStreams.keys())];
                participantsList.innerHTML = participants.map(pId => {
                    const participantName = pId === userId ? userName : (userIdToName.get(pId) || `User ${pId.substring(0, 8)}`);
                    const avatarInitial = pId === userId ? (userName ? userName.charAt(0).toUpperCase() : 'Y') : (userIdToName.get(pId) ? userIdToName.get(pId).charAt(0).toUpperCase() : 'U');

                    return `
                    <div class="participant-item d-flex justify-content-between align-items-center p-2 border-bottom">
                        <div class="d-flex align-items-center flex-grow-1">
                            <div class="avatar-circle me-2" style="width: 32px; height: 32px; font-size: 14px;">
                                ${avatarInitial}
                            </div>
                            <div>
                                <strong>${participantName}</strong>
                                ${pId === userId ? '<span class="badge bg-primary ms-2">You</span>' : ''}
                                ${isHost && pId === userId ? '<span class="badge bg-danger ms-1">Host</span>' : ''}
                                ${isCoHost && pId === userId ? '<span class="badge bg-warning ms-1">Co-Host</span>' : ''}
                            </div>
                        </div>
                        ${(isHost || isCoHost) && pId !== userId ? `
                            <div class="btn-group btn-group-sm" role="group">
                                <button class="btn btn-outline-secondary" onclick="muteParticipant('${pId}')" title="Mute">
                                    <i class="bi bi-mic-mute"></i>
                                </button>
                                ${isHost ? `
                                    <button class="btn btn-outline-primary" onclick="toggleCoHost('${pId}')" title="Make Co-Host">
                                        <i class="bi bi-star"></i>
                                    </button>
                                    <button class="btn btn-outline-danger" onclick="removeParticipant('${pId}')" title="Remove">
                                        <i class="bi bi-x-circle"></i>
                                    </button>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
                }).join('');
            })
            .catch(err => {
                participantsList.innerHTML = '<p class="text-muted">Unable to load participants</p>';
            });
    }

    // Mute participant
    window.muteParticipant = function (targetUserId) {
        console.log('[Meeting] Muting participant:', targetUserId);
        const targetName = userIdToName.get(targetUserId) || `User ${targetUserId.substring(0, 8)}`;
        socket.emit('mute-user', { meetingId, targetUserId });
        alert(`Mute request sent to ${targetName}`);
    };

    // Toggle co-host status
    window.toggleCoHost = function (targetUserId) {
        console.log('[Meeting] Toggling co-host for:', targetUserId);
        if (!isHost) {
            alert('Only host can assign co-host');
            return;
        }

        const targetName = userIdToName.get(targetUserId) || `User ${targetUserId.substring(0, 8)}`;
        if (confirm(`Make ${targetName} a co-host? Co-hosts can mute participants and manage meeting settings.`)) {
            socket.emit('set-co-host', { meetingId, targetUserId });
            alert(`Co-host status updated for ${targetName}`);
            // Update participants list
            setTimeout(updateParticipantsList, 500);
        }
    };

    // Remove participant
    window.removeParticipant = function (targetUserId) {
        console.log('[Meeting] Removing participant:', targetUserId);
        if (!isHost) {
            alert('Only host can remove participants');
            return;
        }

        const targetName = userIdToName.get(targetUserId) || `User ${targetUserId.substring(0, 8)}`;
        if (confirm(`Remove ${targetName} from the meeting?`)) {
            socket.emit('remove-participant', { meetingId, targetUserId });
            alert(`${targetName} has been removed`);
        }
    };

    function muteUser(targetUserId) {
        // Deprecated - use muteParticipant instead
        muteParticipant(targetUserId);
    }

    // Settings panel
    document.getElementById('toggle-settings')?.addEventListener('click', () => {
        showSettingsModal();
    });

    function showSettingsModal() {
        // Remove existing modal if any
        const existingModal = document.getElementById('settingsModal');
        if (existingModal) {
            const bsModalInstance = bootstrap.Modal.getInstance(existingModal);
            if (bsModalInstance) {
                bsModalInstance.dispose();
            }
            existingModal.remove();
        }

        const meeting = window.meeting || { isLocked: false, settings: { chatEnabled: true, screenShareEnabled: true } };
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'settingsModal';
        modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><i class="bi bi-gear"></i> Meeting Settings</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="lock-meeting" ${meeting?.isLocked ? 'checked' : ''}>
                            <label class="form-check-label" for="lock-meeting">Lock Meeting</label>
                        </div>
                    </div>
                    <div class="mb-3">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="disable-chat" ${meeting?.settings?.chatEnabled === false ? 'checked' : ''}>
                            <label class="form-check-label" for="disable-chat">Disable Chat</label>
                        </div>
                    </div>
                    <div class="mb-3">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="disable-screen-share" ${meeting?.settings?.screenShareEnabled === false ? 'checked' : ''}>
                            <label class="form-check-label" for="disable-screen-share">Disable Screen Share</label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="save-settings-btn">Save</button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);

        // Attach save handler
        document.getElementById('save-settings-btn').addEventListener('click', function () {
            saveSettings(bsModal);
        });

        // Clean up modal when hidden
        modal.addEventListener('hidden.bs.modal', function () {
            modal.remove();
        });

        bsModal.show();
    }

    function saveSettings(modalInstance) {
        const lockMeeting = document.getElementById('lock-meeting').checked;
        const disableChat = document.getElementById('disable-chat').checked;
        const disableScreenShare = document.getElementById('disable-screen-share').checked;
        const meeting = window.meeting || { isLocked: false, settings: {} };

        // Initialize settings object if it doesn't exist
        if (!window.meeting) {
            window.meeting = { isLocked: false, settings: {} };
        }
        if (!window.meeting.settings) {
            window.meeting.settings = {};
        }

        if (lockMeeting !== meeting?.isLocked) {
            fetch(`/meeting/${meetingId}/lock`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    console.log('Meeting locked:', data.isLocked);
                    if (window.meeting) window.meeting.isLocked = data.isLocked;
                });
        }

        if (disableChat) {
            socket.emit('disable-chat', { meetingId });
            window.meeting.settings.chatEnabled = false;
        } else {
            socket.emit('enable-chat', { meetingId });
            window.meeting.settings.chatEnabled = true;
        }

        if (disableScreenShare) {
            socket.emit('disable-screen-share', { meetingId });
            window.meeting.settings.screenShareEnabled = false;
        } else {
            socket.emit('enable-screen-share', { meetingId });
            window.meeting.settings.screenShareEnabled = true;
        }

        modalInstance.hide();
    }

    // Reactions
    document.getElementById('show-reactions')?.addEventListener('click', showReactionsMenu);

    // Caption button handled by captions.js via initializeCaptionControls()

    // Virtual Background button
    document.getElementById('toggle-background')?.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const backgroundPanel = document.getElementById('background-panel');
        const chatPanel = document.getElementById('chat-panel');
        const participantsPanel = document.getElementById('participants-panel');
        const captionPanel = document.getElementById('caption-panel');
        const qaPanel = document.getElementById('qa-panel');

        if (sidebar.style.display === 'none') {
            sidebar.style.display = 'block';
            backgroundPanel.classList.remove('d-none');
            chatPanel.classList.add('d-none');
            participantsPanel.classList.add('d-none');
            captionPanel.classList.add('d-none');
            if (qaPanel) qaPanel.classList.add('d-none');
        } else if (backgroundPanel.classList.contains('d-none')) {
            backgroundPanel.classList.remove('d-none');
            chatPanel.classList.add('d-none');
            participantsPanel.classList.add('d-none');
            captionPanel.classList.add('d-none');
            if (qaPanel) qaPanel.classList.add('d-none');
        } else {
            sidebar.style.display = 'none';
        }
    });

    // Close background panel
    document.getElementById('close-background-panel')?.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        sidebar.style.display = 'none';
    });

    // Virtual Background change function
    let originalVideoTrack = null; // Store original camera track
    let sourceVideoForCanvas = null; // Hidden video element for canvas processing

    window.changeBackground = async function (mode, imageUrl = null) {
        console.log('[Meeting] Changing background to:', mode, imageUrl);

        // Find local video element dynamically
        const localVideoWrapper = document.querySelector(`[data-participant-id="${userId}"]`);
        if (!localVideoWrapper) {
            console.warn('[Meeting] Local video wrapper not found');
            return;
        }

        const localVideo = localVideoWrapper.querySelector('video.participant-video');
        if (!localVideo) {
            console.warn('[Meeting] Local video element not found');
            return;
        }

        console.log('[Meeting] Found local video element:', localVideo);

        try {
            // Get current video track
            const currentVideoTrack = localStream?.getVideoTracks()[0];

            if (mode === 'none') {
                // Remove virtual background - restore original
                console.log('[Meeting] Removing virtual background');

                if (window.stopVirtualBackground) {
                    window.stopVirtualBackground();
                }

                // Clean up source video
                if (sourceVideoForCanvas) {
                    sourceVideoForCanvas.srcObject = null;
                    sourceVideoForCanvas.remove();
                    sourceVideoForCanvas = null;
                }

                // If we have stored original track, restore it
                if (originalVideoTrack && originalVideoTrack.readyState === 'live') {
                    console.log('[Meeting] Restoring original video track');

                    if (currentVideoTrack && currentVideoTrack !== originalVideoTrack) {
                        localStream.removeTrack(currentVideoTrack);
                        currentVideoTrack.stop();
                    }

                    localStream.addTrack(originalVideoTrack);

                    // Create new stream with original track
                    const restoredStream = new MediaStream();
                    localStream.getTracks().forEach(track => restoredStream.addTrack(track));
                    localVideo.srcObject = restoredStream;

                    // Update peers
                    peerConnections.forEach((pc, peerId) => {
                        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                        if (sender) {
                            sender.replaceTrack(originalVideoTrack);
                        }
                    });

                    originalVideoTrack = null;
                    console.log('[Meeting] Original video restored');
                } else {
                    // Re-initialize camera
                    await initializeMedia();
                }

                return;
            }

            // Apply virtual background
            if (typeof window.applyVirtualBackground !== 'function') {
                console.error('[Meeting] Virtual background not loaded');
                return;
            }

            // Store original track if not already stored
            if (!originalVideoTrack && currentVideoTrack) {
                originalVideoTrack = currentVideoTrack;
                console.log('[Meeting] Stored original video track');
            }

            // Create hidden video element for canvas processing if not exists
            if (!sourceVideoForCanvas) {
                sourceVideoForCanvas = document.createElement('video');
                sourceVideoForCanvas.autoplay = true;
                sourceVideoForCanvas.playsInline = true;
                sourceVideoForCanvas.muted = true;
                sourceVideoForCanvas.style.display = 'none';
                document.body.appendChild(sourceVideoForCanvas);

                // Feed original camera stream to hidden video
                const sourceStream = new MediaStream([originalVideoTrack]);
                sourceVideoForCanvas.srcObject = sourceStream;

                await sourceVideoForCanvas.play();
                console.log('[Meeting] Source video for canvas created');
            }

            // Apply virtual background effect to hidden video
            const processedStream = await window.applyVirtualBackground(
                sourceVideoForCanvas,
                mode,
                imageUrl
            );

            if (processedStream) {
                const processedVideoTrack = processedStream.getVideoTracks()[0];

                if (processedVideoTrack) {
                    console.log('[Meeting] Got processed video track');

                    // Remove current processed track if exists (but not original)
                    if (currentVideoTrack && currentVideoTrack !== originalVideoTrack) {
                        localStream.removeTrack(currentVideoTrack);
                        currentVideoTrack.stop();
                    }

                    // Add new processed track to localStream
                    localStream.addTrack(processedVideoTrack);

                    // Create new stream with processed video + original audio
                    const displayStream = new MediaStream();
                    displayStream.addTrack(processedVideoTrack);
                    localStream.getAudioTracks().forEach(track => displayStream.addTrack(track));

                    // Update local video display with processed stream
                    localVideo.srcObject = displayStream;

                    // Update all peer connections
                    peerConnections.forEach((pc, peerId) => {
                        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                        if (sender) {
                            sender.replaceTrack(processedVideoTrack);
                            console.log('[Meeting] Replaced video track for peer:', peerId);
                        }
                    });

                    console.log('[Meeting] Virtual background applied successfully');
                } else {
                    console.warn('[Meeting] No processed video track');
                }
            } else {
                console.warn('[Meeting] No processed stream returned');
            }
        } catch (error) {
            console.error('[Meeting] Error applying virtual background:', error);
        }
    };

    // End meeting
    document.getElementById('end-meeting')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to end this meeting for everyone?')) {
            fetch(`/meeting/${meetingId}/end`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        socket.emit('leave-meeting', { meetingId, userId });
                        if (localStream) {
                            localStream.getTracks().forEach(track => track.stop());
                        }
                        window.location.href = '/meeting';
                    }
                })
                .catch(err => {
                    console.error('Error ending meeting:', err);
                });
        }
    });

    // Leave meeting
    document.querySelector('a[href="/meeting"]').addEventListener('click', (e) => {
        e.preventDefault();
        socket.emit('leave-meeting', { meetingId, userId });
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        window.location.href = '/meeting';
    });

    // Initialize whiteboard after joining (called from preview modal)
    initializeWhiteboard();

    // Get meeting data for settings
    fetch(`/meeting/${meetingId}`)
        .then(res => res.text())
        .then(html => {
            // Parse meeting data if needed
            window.meeting = { isLocked: false, settings: { chatEnabled: true, screenShareEnabled: true } };
        })
        .catch(err => console.error('Error loading meeting data:', err));
}

// Initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!eventListenersInitialized) {
            initializeEventListeners();
        }
    });
} else {
    initializeEventListeners();
}
