/**
 * WebRTC Utility Functions
 * Cung cấp các hàm tiện ích cho WebRTC:
 * - getUserMedia, getDisplayMedia
 * - Switch audio/video devices
 * - Video quality control
 */

// Lấy user media (camera, mic) với constraints
async function getUserMedia(constraints) {
    try {
        return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
        console.error('Error getting user media:', error);
        throw error;
    }
}

// Lấy display media cho screen sharing
async function getDisplayMedia(constraints) {
    try {
        return await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (error) {
        console.error('Error getting display media:', error);
        throw error;
    }
}

// Switch audio input
async function switchAudioInput(deviceId) {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        const newStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: deviceId } },
            video: localStream.getVideoTracks()[0]
        });
        audioTrack.stop();
        localStream.removeTrack(audioTrack);
        localStream.addTrack(newStream.getAudioTracks()[0]);
    }
}

// Switch audio output
function switchAudioOutput(deviceId, audioElement) {
    if (audioElement.setSinkId) {
        audioElement.setSinkId(deviceId);
    }
}

// Lấy danh sách thiết bị audio/video khả dụng
async function getDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
        audioInputs: devices.filter(d => d.kind === 'audioinput'),
        audioOutputs: devices.filter(d => d.kind === 'audiooutput'),
        videoInputs: devices.filter(d => d.kind === 'videoinput')
    };
}

// Video quality control
function setVideoQuality(stream, quality) {
    const videoTrack = stream.getVideoTracks()[0];
    const constraints = {
        width: { ideal: quality.width },
        height: { ideal: quality.height },
        frameRate: { ideal: quality.frameRate }
    };
    videoTrack.applyConstraints(constraints);
}

// Noise cancellation (basic WebAudio API)
function applyNoiseCancellation(audioStream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(audioStream);
    const destination = audioContext.createMediaStreamDestination();

    // Basic high-pass filter for noise reduction
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 80;

    source.connect(filter);
    filter.connect(destination);

    return destination.stream;
}

// Background blur (canvas filter - placeholder)
function applyBackgroundBlur(videoElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Simple blur effect
    ctx.filter = 'blur(10px)';
    ctx.drawImage(videoElement, 0, 0);

    return canvas;
}

// Virtual background (canvas filter - placeholder)
function applyVirtualBackground(videoElement, backgroundImage) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Draw background
    const bg = new Image();
    bg.src = backgroundImage;
    bg.onload = () => {
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
        // Draw video with chroma key (simplified)
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(videoElement, 0, 0);
    };

    return canvas;
}

// Live captions using Web Speech API
let recognition = null;

function startLiveCaptions(callback) {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            callback(transcript);
        };

        recognition.start();
    }
}

function stopLiveCaptions() {
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
}

// Translation placeholder
function translateText(text, targetLanguage) {
    // Placeholder for translation API integration
    return Promise.resolve(`[Translated to ${targetLanguage}]: ${text}`);
}

// Export functions
window.webrtcUtils = {
    getUserMedia,
    getDisplayMedia,
    switchAudioInput,
    switchAudioOutput,
    getDevices,
    setVideoQuality,
    applyNoiseCancellation,
    applyBackgroundBlur,
    applyVirtualBackground,
    startLiveCaptions,
    stopLiveCaptions,
    translateText
};

