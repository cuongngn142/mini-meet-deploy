/**
 * Live Captions (Phụ đề trực tiếp)
 * Sử dụng Web Speech API để nhận diện giọng nói và hiển thị phụ đề real-time
 * Hỗ trợ tiếng Việt và tiếng Anh
 */

(function () {
    'use strict';

    console.log('[Caption] captions.js loaded');

    let recognition = null;
    let captionRunning = false;
    let captionLanguage = 'vi-VN'; // Mặc định tiếng Việt
    let captionHistory = [];
    const MAX_HISTORY = 50; // Giới hạn lịch sử phụ đề

    /**
     * Khởi động chức năng live caption
     */
    window.startCaption = function startCaption() {
        console.log('[Caption] startCaption called, captionRunning:', captionRunning);

        // Nếu đã đang chạy, không làm gì cả
        if (captionRunning && recognition) {
            console.log('[Caption] Caption already running, skipping');
            return;
        }

        // Kiểm tra browser có hỗ trợ Speech Recognition không
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            showCaptionAlert('Browser không hỗ trợ Speech Recognition. Vui lòng dùng Chrome/Edge.');
            return;
        }

        // Dừng recognition cũ nếu có
        if (recognition) {
            console.log('[Caption] Stopping old recognition instance');
            try {
                recognition.stop();
            } catch (e) {
                console.warn('[Caption] Error stopping old recognition:', e);
            }
            recognition = null;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();

        // Cấu hình recognition
        recognition.lang = captionLanguage;
        recognition.continuous = true; // Nhận diện liên tục
        // Xử lý kết quả nhận diện
        recognition.onresult = (event) => {
            console.log('[Caption] onresult triggered, results:', event.results.length);
            let interim = '';
            let finalText = '';

            // Lặp qua các kết quả mới
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                console.log('[Caption] Result', i, 'isFinal:', event.results[i].isFinal, 'text:', transcript);

                if (event.results[i].isFinal) {
                    // Kết quả chính thức
                    finalText += transcript;
                } else {
                    // Kết quả tạm thời
                    interim += transcript;
                }
            }

            console.log('[Caption] Interim:', interim, 'Final:', finalText);

            // Cập nhật phụ đề trực tiếp
            if (interim) {
                // Hiển thị kết quả tạm thời
                updateLiveCaption(interim);
            } else if (finalText) {
                // Hiển thị kết quả final trước khi clear
                updateLiveCaption(finalText);
            }

            // Nếu có kết quả chính thức, thêm vào lịch sử
            if (finalText !== '') {
                addCaptionToHistory(finalText);
                // Clear live caption sau khi đã add vào history
                setTimeout(() => clearLiveCaption(), 1000);

                // Gửi phụ đề qua socket để các user khác cũng thấy (nếu muốn)
                if (typeof socket !== 'undefined') {
                    socket.emit('caption-text', {
                        meetingId,
                        userId,
                        text: finalText,
                        timestamp: Date.now()
                    });
                }
            }
        };

        // Xử lý lỗi
        recognition.onerror = (event) => {
            console.error('[Caption] Speech recognition error:', event.error, event);

            if (event.error === 'no-speech') {
                console.log('[Caption] No speech detected - this is normal');
                // Không tắt caption, chỉ thông báo
            } else if (event.error === 'audio-capture') {
                console.error('[Caption] Audio capture error - mic not available');
                showCaptionAlert('Không thể truy cập microphone');
                captionRunning = false;
                window.captionRunning = false;
                updateCaptionButton();
            } else if (event.error === 'not-allowed') {
                console.error('[Caption] Permission denied - user rejected mic access');
                showCaptionAlert('Vui lòng cho phép truy cập microphone');
                captionRunning = false;
                window.captionRunning = false;
                updateCaptionButton();
            } else {
                console.error('[Caption] Unknown error:', event.error);
            }
        };

        // Tự động restart khi kết thúc để không bị ngắt
        recognition.onend = () => {
            console.log('[Caption] Recognition ended, captionRunning:', captionRunning);
            if (captionRunning && recognition) {
                console.log('[Caption] Attempting to restart recognition...');
                setTimeout(() => {
                    if (captionRunning && recognition) {
                        try {
                            // Check if recognition is not already running
                            recognition.start();
                            console.log('[Caption] Recognition restarted successfully');
                        } catch (error) {
                            // Ignore 'already started' errors, log others
                            if (error.message && error.message.includes('already started')) {
                                console.log('[Caption] Recognition already running, no need to restart');
                            } else {
                                console.error('[Caption] Error restarting recognition:', error);
                                // Nếu lỗi nghiêm trọng, reset state
                                captionRunning = false;
                                window.captionRunning = false;
                                updateCaptionButton();
                            }
                        }
                    }
                }, 200); // Delay 200ms trước khi restart
            } else {
                console.log('[Caption] Not restarting (captionRunning is false)');
            }
        };

        // Bắt đầu nhận diện
        try {
            captionRunning = true;
            window.captionRunning = true;
            recognition.start();
            updateCaptionButton();
            showCaptionPanel();
            showCaptionAlert('Live caption đang hoạt động');
            console.log('[Caption] Caption started successfully');
        } catch (error) {
            console.error('Error starting caption:', error);
            captionRunning = false;
            window.captionRunning = false;
            updateCaptionButton();
        }
    }

    /**
     * Dừng chức năng live caption
     */
    window.stopCaption = function stopCaption() {
        console.log('[Caption] stopCaption called, captionRunning:', captionRunning);

        // Set flag TRƯỚC khi stop để prevent restart
        captionRunning = false;
        window.captionRunning = false;

        if (recognition) {
            try {
                recognition.stop();
                console.log('[Caption] Recognition stopped successfully');
            } catch (error) {
                console.warn('[Caption] Error stopping recognition:', error);
            }
            updateCaptionButton();
            clearLiveCaption();
            showCaptionAlert('Live caption đã tắt');
        } else {
            console.warn('[Caption] No recognition instance to stop');
            updateCaptionButton();
        }
    }

    /**
     * Chuyển đổi ngôn ngữ caption
     */
    function changeCaptionLanguage(lang) {
        captionLanguage = lang;

        // Nếu đang chạy, restart với ngôn ngữ mới
        if (captionRunning) {
            stopCaption();
            setTimeout(() => startCaption(), 500);
        }

        // Cập nhật UI
        document.querySelectorAll('.caption-lang-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
    }

    /**
     * Cập nhật phụ đề trực tiếp (interim results)
     */
    function updateLiveCaption(text) {
        console.log('[Caption] updateLiveCaption called with text:', text);
        const liveCaptionEl = document.getElementById('live-caption-text');
        console.log('[Caption] liveCaptionEl found:', !!liveCaptionEl);
        if (liveCaptionEl) {
            liveCaptionEl.textContent = text || '';
            console.log('[Caption] Text updated in element');
        } else {
            console.warn('[Caption] live-caption-text element not found!');
        }
    }

    /**
     * Xóa phụ đề tạm thời
     */
    function clearLiveCaption() {
        updateLiveCaption('');
    }

    /**
     * Thêm phụ đề vào lịch sử
     */
    function addCaptionToHistory(text) {
        console.log('[Caption] addCaptionToHistory called with text:', text);
        const timestamp = new Date().toLocaleTimeString('vi-VN');
        const caption = {
            text: text.trim(),
            timestamp,
            userId
        };

        captionHistory.push(caption);
        console.log('[Caption] Caption added to history, total:', captionHistory.length);

        // Giới hạn số lượng
        if (captionHistory.length > MAX_HISTORY) {
            captionHistory.shift();
        }

        // Cập nhật UI
        renderCaptionHistory();
    }

    /**
     * Hiển thị lịch sử phụ đề
     */
    function renderCaptionHistory() {
        const historyEl = document.getElementById('caption-history');
        if (!historyEl) return;

        historyEl.innerHTML = captionHistory.map((caption, index) => `
        <div class="caption-history-item" data-index="${index}">
            <small class="text-muted">${caption.timestamp}</small>
            <div class="caption-text">${escapeHtml(caption.text)}</div>
        </div>
    `).join('');

        // Auto scroll to bottom
        historyEl.scrollTop = historyEl.scrollHeight;
    }

    /**
     * Escape HTML để tránh XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Hiển thị caption panel
     */
    function showCaptionPanel() {
        console.log('[Caption] showCaptionPanel called');

        // Mở sidebar trước
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.style.display = 'block';
            console.log('[Caption] Sidebar opened');
        }

        // Ẩn các panel khác
        const chatPanel = document.getElementById('chat-panel');
        const participantsPanel = document.getElementById('participants-panel');
        const qaPanel = document.getElementById('qa-panel');

        if (chatPanel) chatPanel.classList.add('d-none');
        if (participantsPanel) participantsPanel.classList.add('d-none');
        if (qaPanel) qaPanel.classList.add('d-none');

        // Hiện caption panel
        const panel = document.getElementById('caption-panel');
        console.log('[Caption] Panel found:', !!panel);
        if (panel) {
            panel.classList.remove('d-none');
            panel.classList.add('show');
            console.log('[Caption] Panel shown, classes:', panel.className);
        } else {
            console.warn('[Caption] caption-panel element not found!');
        }
    }

    /**
     * Ẩn caption panel
     */
    function hideCaptionPanel() {
        const panel = document.getElementById('caption-panel');
        if (panel) {
            panel.classList.remove('show');
            panel.classList.add('d-none');
        }
    }

    /**
     * Toggle caption panel
     */
    function toggleCaptionPanel() {
        const panel = document.getElementById('caption-panel');
        if (panel) {
            if (panel.classList.contains('d-none')) {
                showCaptionPanel();
            } else {
                hideCaptionPanel();
            }
        }
    }

    /**
     * Cập nhật trạng thái nút caption
     */
    function updateCaptionButton() {
        const btn = document.getElementById('toggle-caption');
        if (!btn) return;

        const icon = btn.querySelector('i');

        if (captionRunning) {
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-secondary');
            if (icon) icon.className = 'bi bi-badge-cc-fill';
        } else {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
            if (icon) icon.className = 'bi bi-badge-cc';
        }
    }

    /**
     * Hiển thị thông báo caption
     */
    function showCaptionAlert(message) {
        const alertEl = document.getElementById('caption-alert');
        if (alertEl) {
            alertEl.textContent = message;
            alertEl.classList.remove('d-none');
            setTimeout(() => {
                alertEl.classList.add('d-none');
            }, 3000);
        }
    }

    /**
     * Xóa lịch sử caption
     */
    function clearCaptionHistory() {
        if (confirm('Xóa toàn bộ lịch sử phụ đề?')) {
            captionHistory = [];
            renderCaptionHistory();
            clearLiveCaption();
        }
    }

    /**
     * Export caption history
     */
    function exportCaptionHistory() {
        if (captionHistory.length === 0) {
            alert('Không có phụ đề để export');
            return;
        }

        const content = captionHistory.map(c => `[${c.timestamp}] ${c.text}`).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `captions_${meetingId}_${Date.now()}.txt`;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Nhận caption từ user khác (qua socket)
     */
    if (typeof socket !== 'undefined') {
        socket.on('caption-text', ({ userId: senderId, text, timestamp }) => {
            // Chỉ hiển thị caption từ người khác nếu đang bật caption panel
            const panel = document.getElementById('caption-panel');
            if (panel && !panel.classList.contains('d-none')) {
                const time = new Date(timestamp).toLocaleTimeString('vi-VN');
                captionHistory.push({
                    text: text.trim(),
                    timestamp: time,
                    userId: senderId
                });

                if (captionHistory.length > MAX_HISTORY) {
                    captionHistory.shift();
                }

                renderCaptionHistory();
            }
        });
    }

    /**
     * Initialize caption controls
     */
    let controlsInitialized = false;

    function initializeCaptionControls() {
        if (controlsInitialized) {
            console.log('[Caption] Controls already initialized, skipping');
            return;
        }

        console.log('[Caption] Initializing caption controls...');

        // Toggle caption button
        const toggleBtn = document.getElementById('toggle-caption');
        if (toggleBtn) {
            console.log('[Caption] Found toggle-caption button');

            // Remove any existing listeners first
            const newBtn = toggleBtn.cloneNode(true);
            toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);

            newBtn.addEventListener('click', (e) => {
                console.log('[Caption] Toggle button clicked, running:', captionRunning);
                e.preventDefault();
                e.stopPropagation();

                if (captionRunning) {
                    stopCaption();
                } else {
                    startCaption();
                }
            });

            controlsInitialized = true;
        } else {
            console.warn('[Caption] toggle-caption button not found');
        }

        // Close panel button
        const closeBtn = document.getElementById('close-caption-panel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                hideCaptionPanel();
            });
        }

        // Clear history button
        const clearBtn = document.getElementById('clear-caption-history');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearCaptionHistory);
        }

        // Export button
        const exportBtn = document.getElementById('export-caption-history');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportCaptionHistory);
        }

        // Language options
        document.querySelectorAll('.caption-lang-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const lang = e.target.dataset.lang;
                if (lang) {
                    changeCaptionLanguage(lang);
                }
            });
        });
    }

    // Export for use in meeting.js
    window.initializeCaptionControls = initializeCaptionControls;
    // startCaption and stopCaption are already exported above as window.startCaption and window.stopCaption

    console.log('[Caption] Functions exported to window:', {
        startCaption: typeof window.startCaption,
        stopCaption: typeof window.stopCaption,
        initializeCaptionControls: typeof window.initializeCaptionControls
    });

    // Try to initialize immediately if elements exist
    if (document.getElementById('toggle-caption')) {
        console.log('[Caption] Button found immediately, initializing');
        initializeCaptionControls();
    }

    // Also try when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[Caption] DOM ready, initializing');
            initializeCaptionControls();
        });
    } else {
        console.log('[Caption] DOM already ready, initializing');
        setTimeout(initializeCaptionControls, 100);
    }

})(); // End IIFE
