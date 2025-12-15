(function (global) {
    'use strict';

    const STYLE_TAG_ID = 'video-layout-manager-styles';
    const DEFAULT_OPTIONS = {
        layoutMode: 'auto',
        gap: 8,
        maxTiles: 100,
        maxColumns: 8,
        minTileWidth: 160,
        minTileHeight: 90,
        participantLabel: participant => participant.displayName || participant.name || `Participant ${participant.id}`
    };

    const VIDEO_LAYOUT_STYLES = `
    /* core container */
    #video-grid {
        position: relative;
        width: 100%;
        height: 100%;
        background: #0f0f0f;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: var(--layout-gap, 8px);
        padding: var(--layout-gap, 8px);
        box-sizing: border-box;
    }

    /* stage + complement parts */
    #video-grid .layout-stage,
    #video-grid .layout-complement {
        position: relative;
        display: flex;
        gap: var(--layout-gap, 8px);
        width: 100%;
    }

    #video-grid .layout-stage {
        flex: 1 1 auto;
        min-height: 0;
    }

    #video-grid .layout-complement {
        flex: 0 0 auto;
    }

    /* wrapper & media */
    #video-grid .video-wrapper {
        position: relative;
        background: #1c1c1c;
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        aspect-ratio: 16 / 9;
        min-height: 100px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
        transition: transform 200ms ease, width 200ms ease, height 200ms ease;
    }

    #video-grid .participant-video {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        background: radial-gradient(circle at center, #222, #000);
    }

    #video-grid .participant-audio {
        position: absolute;
        opacity: 0;
        pointer-events: none;
        width: 0;
        height: 0;
    }

    #video-grid .video-label {
        position: absolute;
        left: 12px;
        bottom: 12px;
        background: rgba(0, 0, 0, 0.65);
        color: #fff;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.85rem;
        z-index: 5;
    }

    /* Tiled adaptive */
    #video-grid.layout-tiled .layout-stage {
        display: grid;
        width: 100%;
        height: 100%;
        grid-template-columns: repeat(var(--grid-cols, 1), minmax(0, 1fr));
        grid-auto-rows: 1fr;
        gap: var(--layout-gap, 8px);
    }

    /* Spotlight */
    #video-grid.layout-spotlight {
        flex-direction: column;
    }

    #video-grid.layout-spotlight .layout-stage {
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    #video-grid.layout-spotlight .layout-complement {
        display: flex;
        overflow-x: auto;
        padding-bottom: 4px;
        gap: var(--layout-gap, 8px);
    }

    #video-grid.layout-spotlight .layout-complement .video-wrapper {
        flex: 0 0 220px;
        max-width: 220px;
    }

    /* Sidebar (screen-share) */
    #video-grid.layout-sidebar {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: var(--layout-gap, 8px);
    }

    #video-grid.layout-sidebar .layout-stage {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    #video-grid.layout-sidebar .layout-complement {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        gap: var(--layout-gap, 8px);
    }

    #video-grid .video-wrapper[data-role="primary"] {
        width: 100%;
        height: 100%;
        border-radius: 10px;
    }

    #video-grid .video-wrapper[data-screen-share="true"] {
        border: 2px solid #4cc9f0;
        box-shadow: 0 0 0 2px rgba(76, 201, 240, 0.6), 0 12px 30px rgba(0,0,0,0.55);
    }

    #video-grid .video-wrapper[data-active-speaker="true"] {
        box-shadow: 0 0 0 3px #51ff93 inset, 0 15px 35px rgba(0, 0, 0, 0.5);
        transform: scale(1.02);
    }

    /* hide very small tiles in heavy meetings (user/configurable) */
    #video-grid .video-wrapper.hidden-small {
        display: none !important;
    }

    /* responsiveness helpers */
    @media (max-width: 900px) {
        #video-grid.layout-sidebar {
            grid-template-columns: 1fr;
        }
        #video-grid.layout-spotlight .layout-complement .video-wrapper {
            flex: 0 0 160px;
            max-width: 160px;
        }
    }
    `;

    class VideoLayoutManager {
        constructor(containerOrSelector = '#video-grid', options = {}) {
            const container = typeof containerOrSelector === 'string'
                ? document.querySelector(containerOrSelector)
                : containerOrSelector;

            if (!container) {
                throw new Error('VideoLayoutManager: #video-grid container not found.');
            }

            this.container = container;
            this.options = { ...DEFAULT_OPTIONS, ...options };
            this.layoutMode = this.options.layoutMode;
            this.participants = [];
            this.activeSpeakerId = null;
            this.screenShareParticipantId = null;
            this.wrapperCache = new Map();

            this._injectStyles();
            this._ensureStructure();
            this._applyGap();

            // bind and react to resize
            this._boundOnResize = this._onResize.bind(this);
            window.addEventListener('resize', this._boundOnResize);
            // mutation observer to catch container size changes if embedded
            this._resizeObserver = new ResizeObserver(() => this._onResize());
            this._resizeObserver.observe(this.container);
        }

        destroy() {
            window.removeEventListener('resize', this._boundOnResize);
            if (this._resizeObserver) this._resizeObserver.disconnect();
            this.wrapperCache.clear();
        }

        setParticipants(participants = []) {
            // normalize: remove users who have no camera and no 'showWhenNoCamera' flag
            this.participants = (Array.isArray(participants) ? participants.slice() : [])
                .filter(p => p && (p.hasVideo !== false || p.showWhenNoCamera === true));
            return this;
        }

        upsertParticipant(participant) {
            const index = this.participants.findIndex(p => p.id === participant.id);
            if (index >= 0) {
                this.participants[index] = { ...this.participants[index], ...participant };
            } else {
                this.participants.push(participant);
            }
            return this;
        }

        removeParticipant(participantId) {
            this.participants = this.participants.filter(p => p.id !== participantId);
            const wrapper = this.wrapperCache.get(participantId);
            if (wrapper && wrapper.parentElement) wrapper.parentElement.removeChild(wrapper);
            this.wrapperCache.delete(participantId);
            return this;
        }

        setLayoutMode(mode = 'auto') {
            this.layoutMode = mode;
            return this;
        }

        setActiveSpeaker(participantId) {
            this.activeSpeakerId = participantId;
            return this;
        }

        setScreenShareParticipant(participantId) {
            this.screenShareParticipantId = participantId;
            return this;
        }

        attachStream(participantId, mediaStream) {
            const wrapper = this.wrapperCache.get(participantId);
            if (!wrapper) return this;
            const video = wrapper.querySelector('video');
            if (!video) return this;
            if (video.srcObject !== mediaStream) {
                try { video.srcObject = mediaStream; } catch (e) { video.src = URL.createObjectURL(mediaStream); }
            }
            return this;
        }

        render(mode) {
            return this.applyLayout(mode);
        }

        applyLayout(mode = this.layoutMode, participants = null) {
            if (!this.container) {
                return 'tiled';
            }

            if (participants) {
                this.setParticipants(participants);
            }

            const normalizedMode = mode || 'auto';
            if (normalizedMode === 'auto') {
                this.layoutMode = 'auto';
                return this.applyAutoLayout();
            }

            this.layoutMode = normalizedMode;
            this._applyMode(normalizedMode);
            return normalizedMode;
        }

        applyAutoLayout(participants = null) {
            if (participants) {
                this.setParticipants(participants);
            }
            const autoMode = this._deriveAutoLayout();
            this._applyMode(autoMode);
            return autoMode;
        }

        applyTiledLayout(participants = null) {
            if (participants) {
                this.setParticipants(participants);
            }
            this.container.classList.remove('layout-spotlight', 'layout-sidebar');
            this.container.classList.add('layout-tiled');

            const ordered = this._orderedParticipants();
            const limited = ordered.slice(0, this.options.maxTiles);
            const count = limited.length || 1;

            // calculate adaptive grid
            const cw = this.container.clientWidth || this.container.offsetWidth || window.innerWidth;
            const ch = this.container.clientHeight || this.container.offsetHeight || window.innerHeight;
            const { cols, rows } = this.calculateAdaptiveGrid(count, cw, ch);

            // set grid CSS vars
            this.container.style.setProperty('--grid-cols', cols);

            this.stageEl.className = 'layout-stage grid-stage';
            this.stripEl.className = 'layout-complement grid-strip';

            // clear
            this.stageEl.replaceChildren();
            this.stripEl.replaceChildren();

            // append first rows*cols to stage
            limited.forEach((participant, idx) => {
                const wrapper = this._getWrapper(participant);
                wrapper.dataset.role = 'grid';
                // mark very small tiles to hide if necessary
                wrapper.classList.toggle('hidden-small', false);
                this.stageEl.appendChild(wrapper);
            });

            // any overflow put into strip (useful for > maxTiles)
            if (ordered.length > this.options.maxTiles) {
                ordered.slice(this.options.maxTiles).forEach(participant => {
                    const wrapper = this._getWrapper(participant);
                    wrapper.dataset.role = 'overflow';
                    this.stripEl.appendChild(wrapper);
                });
            }

            // hide thumbnails if resulting tile is too small (mimic Meet behaviour for very large meetings)
            const approxTileWidth = Math.floor((cw - (cols + 1) * this.options.gap) / cols);
            if (approxTileWidth < this.options.minTileWidth) {
                // hide overflow thumbnails (keep primary visible)
                Array.from(this.stageEl.children).forEach((w, i) => {
                    if (i >= cols * rows) w.classList.add('hidden-small');
                });
            }
        }

        applySpotlightLayout(participants = null) {
            if (participants) {
                this.setParticipants(participants);
            }
            this.container.classList.remove('layout-tiled', 'layout-sidebar');
            this.container.classList.add('layout-spotlight');
            const ordered = this._orderedParticipants();
            if (ordered.length === 0) {
                this.stageEl.replaceChildren();
                this.stripEl.replaceChildren();
                return;
            }

            const primary = this._resolvePrimaryParticipant(ordered);
            const rest = ordered.filter(p => p.id !== primary.id);

            this.stageEl.className = 'layout-stage spotlight-stage';
            this.stripEl.className = 'layout-complement spotlight-strip';

            this.stageEl.replaceChildren(this._getWrapper(primary, { role: 'primary' }));
            // make thumbnails smaller; clone order for consistent DOM order
            this.stripEl.replaceChildren(...rest.map(p => this._getWrapper(p, { role: 'thumbnail' })));
        }

        applySidebarLayout(participants = null) {
            if (participants) {
                this.setParticipants(participants);
            }
            this.container.classList.remove('layout-tiled', 'layout-spotlight');
            this.container.classList.add('layout-sidebar');
            const ordered = this._orderedParticipants();
            if (ordered.length === 0) {
                this.stageEl.replaceChildren();
                this.stripEl.replaceChildren();
                return;
            }

            const primary = this._resolvePrimaryParticipant(ordered);
            const rest = ordered.filter(p => p.id !== primary.id);

            this.stageEl.className = 'layout-stage sidebar-stage';
            this.stripEl.className = 'layout-complement sidebar-strip';

            this.stageEl.replaceChildren(this._getWrapper(primary, { role: 'primary' }));
            this.stripEl.replaceChildren(...rest.map(p => this._getWrapper(p, { role: 'secondary' })));
        }

        /**
         * Calculate adaptive grid using container size and aspect ratio
         * returns {cols, rows}
         */
        calculateAdaptiveGrid(count, containerWidth, containerHeight) {
            if (count <= 1) return { cols: 1, rows: 1 };

            const aspectRatio = 16 / 9;
            let best = { cols: 1, rows: count, score: -Infinity };

            const maxCols = Math.min(this.options.maxColumns, Math.max(1, Math.floor(containerWidth / this.options.minTileWidth)));

            for (let cols = 1; cols <= maxCols; cols++) {
                const rows = Math.ceil(count / cols);

                // tile dimensions if we split into cols x rows
                const tileW = (containerWidth - (cols + 1) * this.options.gap) / cols;
                const tileH = (containerHeight - (rows + 1) * this.options.gap) / rows;

                // ensure minimum sizes
                if (tileW < this.options.minTileWidth || tileH < this.options.minTileHeight) continue;

                const tileRatio = tileW / tileH;
                const ratioScore = 1 - Math.abs(tileRatio - aspectRatio); // closer to 1 is better

                // prefer larger tiles while keeping ratio close to aspectRatio
                const areaScore = tileW * tileH;
                const score = ratioScore * areaScore;

                if (score > best.score) {
                    best = { cols, rows, score };
                }
            }

            // fallback if none passed min size
            if (best.score === -Infinity) {
                const fallbackCols = Math.min(this.options.maxColumns, Math.ceil(Math.sqrt(count)));
                return { cols: fallbackCols, rows: Math.ceil(count / fallbackCols) };
            }

            return { cols: best.cols, rows: best.rows };
        }

        _deriveAutoLayout() {
            const count = this.participants.length;
            const hasScreenShare = this.participants.some(p => p.isScreenShare) || !!this.screenShareParticipantId;

            if (hasScreenShare) return 'sidebar';
            if (count <= 1) return 'spotlight';
            // mimic Meet: for small meetings <6, show larger tiles; otherwise tiled adaptive
            if (count <= 6) return 'tiled';
            return 'tiled';
        }

        _orderedParticipants() {
            const shareId = this.screenShareParticipantId;
            return this.participants.slice().sort((a, b) => {
                // screen-share first
                if ((a.id === shareId || a.isScreenShare) && !(b.id === shareId || b.isScreenShare)) return -1;
                if ((b.id === shareId || b.isScreenShare) && !(a.id === shareId || a.isScreenShare)) return 1;

                // active speaker next
                if (a.id === this.activeSpeakerId && b.id !== this.activeSpeakerId) return -1;
                if (b.id === this.activeSpeakerId && a.id !== this.activeSpeakerId) return 1;

                // prefer participants with camera
                if ((a.hasVideo === true) && (b.hasVideo !== true)) return -1;
                if ((b.hasVideo === true) && (a.hasVideo !== true)) return 1;

                // fallback alphabetical
                return (a.displayName || '').localeCompare(b.displayName || '');
            });
        }

        _resolvePrimaryParticipant(participants) {
            const shareId = this.screenShareParticipantId;
            if (shareId) {
                const shareParticipant = participants.find(p => p.id === shareId) || participants.find(p => p.isScreenShare);
                if (shareParticipant) return shareParticipant;
            }
            if (this.activeSpeakerId) {
                const active = participants.find(p => p.id === this.activeSpeakerId);
                if (active) return active;
            }
            // choose first participant with camera, else first available
            const withCam = participants.find(p => p.hasVideo !== false);
            if (withCam) return withCam;
            return participants[0];
        }

        _getWrapper(participant, opts = {}) {
            let wrapper = this.wrapperCache.get(participant.id);
            if (!wrapper) {
                wrapper = this._createWrapper(participant);
                this.wrapperCache.set(participant.id, wrapper);
            }

            wrapper.dataset.participantId = participant.id;
            wrapper.dataset.screenShare = Boolean(participant.isScreenShare).toString();
            wrapper.dataset.activeSpeaker = (participant.id === this.activeSpeakerId).toString();
            wrapper.dataset.role = opts.role || wrapper.dataset.role || 'grid';

            const label = wrapper.querySelector('.video-label');
            if (label) {
                label.textContent = this.options.participantLabel(participant);
            }

            // update media elements if provided
            if (participant.stream) {
                const video = wrapper.querySelector('video');
                if (video && video.srcObject !== participant.stream) {
                    try { video.srcObject = participant.stream; } catch (e) { video.src = URL.createObjectURL(participant.stream); }
                }
            }

            const audio = wrapper.querySelector('.participant-audio');
            if (audio) {
                audio.muted = Boolean(participant.isSelf);
                if (participant.stream && audio.srcObject !== participant.stream) {
                    try { audio.srcObject = participant.stream; } catch (e) { audio.src = URL.createObjectURL(participant.stream); }
                }
            }

            // show/hide wrappers if participant has no camera (respect showWhenNoCamera)
            if (participant.hasVideo === false && !participant.showWhenNoCamera) {
                wrapper.style.display = 'none';
            } else {
                wrapper.style.display = '';
            }

            // mark active speaker attribute for CSS
            wrapper.dataset.activeSpeaker = (participant.id === this.activeSpeakerId) ? 'true' : 'false';

            return wrapper;
        }

        _createWrapper(participant) {
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';

            const video = document.createElement('video');
            video.className = 'participant-video';
            video.autoplay = true;
            video.playsInline = true;
            video.muted = Boolean(participant.isSelf);
            // do not assign stream here to avoid cross-origin if undefined
            if (participant.stream) {
                try { video.srcObject = participant.stream; } catch (e) { video.src = URL.createObjectURL(participant.stream); }
            } else {
                // placeholder poster (dark gradient) - you can later set a track with canvas or avatar
            }

            const label = document.createElement('span');
            label.className = 'video-label';
            label.textContent = this.options.participantLabel(participant);

            const audio = document.createElement('audio');
            audio.className = 'participant-audio';
            audio.autoplay = true;
            audio.playsInline = true;
            audio.muted = Boolean(participant.isSelf);
            if (participant.stream) {
                try { audio.srcObject = participant.stream; } catch (e) { audio.src = URL.createObjectURL(participant.stream); }
            }

            wrapper.appendChild(video);
            wrapper.appendChild(audio);
            wrapper.appendChild(label);

            return wrapper;
        }

        _applyMode(mode) {
            switch (mode) {
                case 'spotlight':
                    this.applySpotlightLayout();
                    break;
                case 'sidebar':
                    this.applySidebarLayout();
                    break;
                case 'tiled':
                default:
                    this.applyTiledLayout();
                    break;
            }
        }

        _ensureStructure() {
            // ensure container has stage and complement strips (preserve if existing)
            if (!this.stageEl) {
                const existingStage = this.container.querySelector('.layout-stage');
                this.stageEl = existingStage || document.createElement('div');
                this.stageEl.className = this.stageEl.className || 'layout-stage';
                if (!existingStage) this.container.appendChild(this.stageEl);
            }
            if (!this.stripEl) {
                const existingStrip = this.container.querySelector('.layout-complement');
                this.stripEl = existingStrip || document.createElement('div');
                this.stripEl.className = this.stripEl.className || 'layout-complement';
                if (!existingStrip) this.container.appendChild(this.stripEl);
            }
        }

        _applyGap() {
            this.container.style.setProperty('--layout-gap', `${this.options.gap}px`);
        }

        _injectStyles() {
            if (document.getElementById(STYLE_TAG_ID)) {
                return;
            }
            const styleTag = document.createElement('style');
            styleTag.id = STYLE_TAG_ID;
            styleTag.textContent = VIDEO_LAYOUT_STYLES;
            document.head.appendChild(styleTag);
        }

        _onResize() {
            // when resizing, re-apply current layout to recalc grid
            if (!this.container) return;
            const current = this.layoutMode === 'auto' ? this._deriveAutoLayout() : this.layoutMode;
            this._applyMode(current);
        }
    }

    global.VideoLayoutManager = VideoLayoutManager;
})(window);
