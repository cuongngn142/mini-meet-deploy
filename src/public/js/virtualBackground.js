/**
 * Virtual Background (Phông nền ảo)
 * Sử dụng TensorFlow.js BodyPix để phân đoạn người và thay thế background
 */

(function () {
    'use strict';

    console.log('[VirtualBG] virtualBackground.js loaded');

    let bodyPixNet = null;
    let isProcessing = false;
    let backgroundMode = 'none'; // 'none', 'blur', 'image'
    let selectedBackgroundImage = null;
    let segmentationMask = null;

    // Canvas elements for processing
    let sourceCanvas = null;
    let outputCanvas = null;
    let sourceCtx = null;
    let outputCtx = null;
    let animationFrameId = null;

    /**
     * Khởi tạo BodyPix model
     */
    async function initBodyPix() {
        if (bodyPixNet) {
            console.log('[VirtualBG] BodyPix already loaded');
            return bodyPixNet;
        }

        try {
            console.log('[VirtualBG] Loading BodyPix model...');
            showBackgroundAlert('Đang tải AI model...', 'info');

            // Load BodyPix with optimized settings
            bodyPixNet = await bodyPix.load({
                architecture: 'MobileNetV1',
                outputStride: 16,
                multiplier: 0.75,
                quantBytes: 2
            });

            console.log('[VirtualBG] BodyPix loaded successfully');
            showBackgroundAlert('AI model đã sẵn sàng!', 'success');
            return bodyPixNet;
        } catch (error) {
            console.error('[VirtualBG] Error loading BodyPix:', error);
            showBackgroundAlert('Không thể tải AI model', 'danger');
            return null;
        }
    }

    /**
     * Áp dụng virtual background lên video stream
     */
    async function applyVirtualBackground(videoElement, mode, backgroundImageUrl = null) {
        console.log('[VirtualBG] Applying virtual background, mode:', mode);
        console.log('[VirtualBG] Video element:', videoElement);
        console.log('[VirtualBG] Video width x height:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        console.log('[VirtualBG] Video srcObject:', videoElement.srcObject);

        if (!videoElement || !videoElement.srcObject) {
            console.warn('[VirtualBG] No video element or stream');
            return null;
        }

        // Wait for video metadata if not loaded
        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
            console.log('[VirtualBG] Waiting for video metadata...');
            await new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    console.log('[VirtualBG] Video metadata loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
                    resolve();
                };
                // Timeout fallback
                setTimeout(resolve, 1000);
            });
        }

        backgroundMode = mode;

        // Nếu mode = 'none', return original stream
        if (mode === 'none') {
            stopProcessing();
            return videoElement.srcObject;
        }

        // Load BodyPix if not loaded
        if (!bodyPixNet) {
            await initBodyPix();
            if (!bodyPixNet) {
                return videoElement.srcObject;
            }
        }

        // Tạo canvas nếu chưa có
        if (!sourceCanvas) {
            sourceCanvas = document.createElement('canvas');
            outputCanvas = document.createElement('canvas');
            sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
            outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
            console.log('[VirtualBG] Canvas elements created');
        }

        // Set canvas size
        const width = videoElement.videoWidth || 640;
        const height = videoElement.videoHeight || 480;
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        outputCanvas.width = width;
        outputCanvas.height = height;

        console.log('[VirtualBG] Canvas size set to:', width, 'x', height);

        // Load background image if mode = 'image'
        if (mode === 'image' && backgroundImageUrl) {
            console.log('[VirtualBG] Loading background image:', backgroundImageUrl);
            await loadBackgroundImage(backgroundImageUrl);
        }

        // Start processing
        isProcessing = true;
        console.log('[VirtualBG] Starting frame processing...');
        processFrame(videoElement);

        // Return canvas stream
        const canvasStream = outputCanvas.captureStream(30); // 30 FPS
        console.log('[VirtualBG] Canvas stream created with tracks:', canvasStream.getTracks().length);
        return canvasStream;
    }

    /**
     * Process mỗi frame của video
     */
    let frameCount = 0;
    async function processFrame(videoElement) {
        if (!isProcessing || !videoElement || !bodyPixNet) {
            console.log('[VirtualBG] Stopped processing:', { isProcessing, hasVideo: !!videoElement, hasBodyPix: !!bodyPixNet });
            return;
        }

        try {
            frameCount++;
            if (frameCount % 30 === 0) { // Log every 30 frames (~1 sec)
                console.log('[VirtualBG] Processing frame', frameCount, 'mode:', backgroundMode);
            }

            // Draw video frame to source canvas
            sourceCtx.drawImage(videoElement, 0, 0, sourceCanvas.width, sourceCanvas.height);

            // Segment người trong ảnh
            const segmentation = await bodyPixNet.segmentPerson(sourceCanvas, {
                flipHorizontal: false,
                internalResolution: 'medium',
                segmentationThreshold: 0.7
            });

            // Áp dụng effect dựa vào mode
            if (backgroundMode === 'blur') {
                applyBlurEffect(segmentation);
            } else if (backgroundMode === 'image') {
                applyImageBackground(segmentation);
            }

            // Request next frame
            animationFrameId = requestAnimationFrame(() => processFrame(videoElement));
        } catch (error) {
            console.error('[VirtualBG] Error processing frame:', error);
            // Continue processing on next frame
            animationFrameId = requestAnimationFrame(() => processFrame(videoElement));
        }
    }

    /**
     * Áp dụng blur effect cho background
     */
    function applyBlurEffect(segmentation) {
        const { width, height } = sourceCanvas;
        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        const mask = segmentation.data;

        // Blur background
        sourceCtx.filter = 'blur(10px)';
        sourceCtx.drawImage(sourceCanvas, 0, 0, width, height);
        sourceCtx.filter = 'none';

        const blurredData = sourceCtx.getImageData(0, 0, width, height);
        const blurredPixels = blurredData.data;

        // Composite: person (sharp) + background (blurred)
        for (let i = 0; i < mask.length; i++) {
            const offset = i * 4;
            if (mask[i] === 1) {
                // Person - keep original
                blurredPixels[offset] = pixels[offset];
                blurredPixels[offset + 1] = pixels[offset + 1];
                blurredPixels[offset + 2] = pixels[offset + 2];
            }
            // Background already blurred
        }

        outputCtx.putImageData(blurredData, 0, 0);
    }

    /**
     * Áp dụng image background
     */
    function applyImageBackground(segmentation) {
        const { width, height } = sourceCanvas;
        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        const mask = segmentation.data;

        // Draw background image
        if (selectedBackgroundImage) {
            outputCtx.drawImage(selectedBackgroundImage, 0, 0, width, height);
        } else {
            // Fallback: solid color
            outputCtx.fillStyle = '#4CAF50';
            outputCtx.fillRect(0, 0, width, height);
        }

        // Get background data
        const backgroundData = outputCtx.getImageData(0, 0, width, height);
        const backgroundPixels = backgroundData.data;

        // Composite: person + custom background
        for (let i = 0; i < mask.length; i++) {
            const offset = i * 4;
            if (mask[i] === 1) {
                // Person - use original pixels
                backgroundPixels[offset] = pixels[offset];
                backgroundPixels[offset + 1] = pixels[offset + 1];
                backgroundPixels[offset + 2] = pixels[offset + 2];
                backgroundPixels[offset + 3] = pixels[offset + 3];
            }
            // Background already drawn
        }

        outputCtx.putImageData(backgroundData, 0, 0);
    }

    /**
     * Load background image
     */
    function loadBackgroundImage(imageUrl) {
        return new Promise((resolve, reject) => {
            // Check if it's a gradient (starts with linear-gradient)
            if (imageUrl && imageUrl.startsWith('linear-gradient')) {
                console.log('[VirtualBG] Using CSS gradient as background');
                // Create a canvas with gradient
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = 1920;
                tempCanvas.height = 1080;
                const ctx = tempCanvas.getContext('2d');

                // Parse gradient - simple version for common cases
                // Format: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
                const gradientMatch = imageUrl.match(/linear-gradient\((\d+)deg,\s*([^,]+)\s+\d+%,\s*([^)]+)\s+\d+%\)/);
                if (gradientMatch) {
                    const angle = parseInt(gradientMatch[1]);
                    const color1 = gradientMatch[2].trim();
                    const color2 = gradientMatch[3].trim();

                    // Convert angle to x,y coordinates
                    const angleRad = (angle - 90) * Math.PI / 180;
                    const x1 = Math.cos(angleRad) * tempCanvas.width / 2 + tempCanvas.width / 2;
                    const y1 = Math.sin(angleRad) * tempCanvas.height / 2 + tempCanvas.height / 2;
                    const x2 = tempCanvas.width - x1;
                    const y2 = tempCanvas.height - y1;

                    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                    gradient.addColorStop(0, color1);
                    gradient.addColorStop(1, color2);
                    ctx.fillStyle = gradient;
                } else {
                    // Fallback to solid color
                    ctx.fillStyle = '#667eea';
                }

                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

                // Convert canvas to image
                const img = new Image();
                img.onload = () => {
                    selectedBackgroundImage = img;
                    console.log('[VirtualBG] Gradient background created');
                    resolve(img);
                };
                img.src = tempCanvas.toDataURL();
                return;
            }

            // Load actual image file
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                selectedBackgroundImage = img;
                console.log('[VirtualBG] Background image loaded:', imageUrl);
                resolve(img);
            };
            img.onerror = (error) => {
                console.error('[VirtualBG] Error loading background image:', error);
                console.warn('[VirtualBG] Falling back to solid color');
                // Create fallback solid color
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = 1920;
                tempCanvas.height = 1080;
                const ctx = tempCanvas.getContext('2d');
                ctx.fillStyle = '#4CAF50';
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

                const fallbackImg = new Image();
                fallbackImg.onload = () => {
                    selectedBackgroundImage = fallbackImg;
                    resolve(fallbackImg);
                };
                fallbackImg.src = tempCanvas.toDataURL();
            };
            img.src = imageUrl;
        });
    }

    /**
     * Dừng xử lý
     */
    function stopProcessing() {
        console.log('[VirtualBG] Stopping processing');
        isProcessing = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    /**
     * Hiển thị alert
     */
    function showBackgroundAlert(message, type = 'info') {
        const alertEl = document.getElementById('background-alert');
        if (alertEl) {
            alertEl.textContent = message;
            alertEl.className = `alert alert-${type} mx-3 mt-2 py-2`;
            alertEl.classList.remove('d-none');

            // Auto hide after 3 seconds
            setTimeout(() => {
                alertEl.classList.add('d-none');
            }, 3000);
        }
    }

    /**
     * Initialize controls
     */
    function initializeBackgroundControls() {
        console.log('[VirtualBG] Initializing background controls');

        // Background mode buttons
        const noneBtn = document.getElementById('bg-none');
        const blurBtn = document.getElementById('bg-blur');
        const imageBtn = document.getElementById('bg-image');

        if (noneBtn) {
            noneBtn.addEventListener('click', () => {
                if (typeof window.changeBackground === 'function') {
                    window.changeBackground('none');
                }
                updateBackgroundButtons('none');
            });
        }

        if (blurBtn) {
            blurBtn.addEventListener('click', () => {
                if (typeof window.changeBackground === 'function') {
                    window.changeBackground('blur');
                }
                updateBackgroundButtons('blur');
            });
        }

        // Background image selector
        const bgImages = document.querySelectorAll('.bg-image-option');
        bgImages.forEach(img => {
            img.addEventListener('click', () => {
                const imageUrl = img.dataset.bgUrl;
                if (typeof window.changeBackground === 'function') {
                    window.changeBackground('image', imageUrl);
                }
                updateBackgroundButtons('image');

                // Highlight selected image
                bgImages.forEach(i => i.classList.remove('selected'));
                img.classList.add('selected');
            });
        });
    }

    /**
     * Update button states
     */
    function updateBackgroundButtons(mode) {
        const noneBtn = document.getElementById('bg-none');
        const blurBtn = document.getElementById('bg-blur');

        if (noneBtn) {
            noneBtn.classList.toggle('active', mode === 'none');
        }
        if (blurBtn) {
            blurBtn.classList.toggle('active', mode === 'blur');
        }
    }

    // Export functions
    window.applyVirtualBackground = applyVirtualBackground;
    window.initBodyPix = initBodyPix;
    window.stopVirtualBackground = stopProcessing;
    window.virtualBackgroundMode = () => backgroundMode;

    // Initialize when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeBackgroundControls);
    } else {
        initializeBackgroundControls();
    }

})();
