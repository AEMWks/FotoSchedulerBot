// web/public/assets/js/components/slideshow.js - Componente de slideshow

/**
 * Componente Slideshow para presentaciones automáticas de fotos y videos
 */
class Slideshow {
    constructor(options = {}) {
        this.options = {
            duration: 4000,
            autoPlay: true,
            loop: true,
            showControls: true,
            showProgress: true,
            showInfo: true,
            fullscreen: true,
            enableKeyboard: true,
            enableTouch: true,
            enableMouse: true,
            showThumbnails: false,
            transitionType: 'fade', // fade, slide, zoom
            backgroundBlur: true,
            fitMode: 'contain', // contain, cover
            videoAutoPlay: true,
            ...options
        };

        this.state = {
            isActive: false,
            isPlaying: false,
            currentIndex: 0,
            media: [],
            startTime: null,
            pausedTime: 0,
            touchStartX: 0,
            touchStartY: 0,
            isTransitioning: false
        };

        this.elements = {};
        this.timers = {
            progress: null,
            advance: null
        };

        this.boundMethods = {};

        this.init();
    }

    /**
     * Inicialización del componente
     */
    init() {
        this.createSlideshow();
        this.bindMethods();
        this.setupEventListeners();
    }

    /**
     * Crear estructura del slideshow
     */
    createSlideshow() {
        // Crear overlay si no existe
        let overlay = document.getElementById('slideshow-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'slideshow-overlay';
            overlay.className = 'slideshow-overlay';
            overlay.style.display = 'none';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div class="slideshow-container">
                <!-- Header con controles -->
                <div class="slideshow-header">
                    <div class="slideshow-controls" ${!this.options.showControls ? 'style="display: none;"' : ''}>
                        <button class="slideshow-btn slideshow-play-pause" id="slideshow-play-pause" title="Pausar/Reproducir">
                            <span class="play-icon">⏸️</span>
                        </button>
                        <button class="slideshow-btn slideshow-prev" id="slideshow-prev" title="Anterior">
                            <span>⏮️</span>
                        </button>
                        <button class="slideshow-btn slideshow-next" id="slideshow-next" title="Siguiente">
                            <span>⏭️</span>
                        </button>
                        <button class="slideshow-btn slideshow-fullscreen" id="slideshow-fullscreen" title="Pantalla completa">
                            <span>⛶</span>
                        </button>
                        <button class="slideshow-btn slideshow-close" id="slideshow-close" title="Cerrar">
                            <span>×</span>
                        </button>
                    </div>

                    <div class="slideshow-progress-container" ${!this.options.showProgress ? 'style="display: none;"' : ''}>
                        <div class="slideshow-counter" id="slideshow-counter">
                            <span id="current-slide">1</span> / <span id="total-slides">1</span>
                        </div>
                        <div class="slideshow-progress-bar">
                            <div class="slideshow-progress-fill" id="slideshow-progress-fill"></div>
                        </div>
                        <div class="slideshow-timer" id="slideshow-timer">4.0s</div>
                    </div>
                </div>

                <!-- Área de contenido principal -->
                <div class="slideshow-stage" id="slideshow-stage">
                    <!-- Media container con transiciones -->
                    <div class="slideshow-media-wrapper">
                        <div class="slideshow-media-container current" id="media-current">
                            <img class="slideshow-media-item" id="slideshow-image" style="display: none;">
                            <video class="slideshow-media-item" id="slideshow-video" style="display: none;" muted>
                                <source id="slideshow-video-source" type="video/mp4">
                            </video>
                        </div>
                        <div class="slideshow-media-container next" id="media-next" style="display: none;">
                            <img class="slideshow-media-item" id="slideshow-image-next" style="display: none;">
                            <video class="slideshow-media-item" id="slideshow-video-next" style="display: none;" muted>
                                <source id="slideshow-video-source-next" type="video/mp4">
                            </video>
                        </div>
                    </div>

                    <!-- Loading indicator -->
                    <div class="slideshow-loading" id="slideshow-loading">
                        <div class="loading-spinner"></div>
                        <span>Cargando...</span>
                    </div>

                    <!-- Navigation arrows -->
                    <button class="slideshow-nav slideshow-nav-prev" id="nav-prev" title="Anterior">
                        <span>‹</span>
                    </button>
                    <button class="slideshow-nav slideshow-nav-next" id="nav-next" title="Siguiente">
                        <span>›</span>
                    </button>
                </div>

                <!-- Footer con información -->
                <div class="slideshow-footer" ${!this.options.showInfo ? 'style="display: none;"' : ''}>
                    <div class="slideshow-info">
                        <h3 class="slideshow-title" id="slideshow-title"></h3>
                        <div class="slideshow-metadata">
                            <span class="slideshow-date" id="slideshow-date"></span>
                            <span class="slideshow-time" id="slideshow-time"></span>
                            <span class="slideshow-type" id="slideshow-type"></span>
                        </div>
                    </div>
                </div>

                <!-- Thumbnails strip (opcional) -->
                <div class="slideshow-thumbnails" id="slideshow-thumbnails" ${!this.options.showThumbnails ? 'style="display: none;"' : ''}>
                    <div class="thumbnails-track" id="thumbnails-track">
                        <!-- Thumbnails generados dinámicamente -->
                    </div>
                </div>
            </div>
        `;

        // Guardar referencias a elementos
        this.elements = {
            overlay: overlay,
            container: overlay.querySelector('.slideshow-container'),
            header: overlay.querySelector('.slideshow-header'),
            controls: overlay.querySelector('.slideshow-controls'),
            playPause: overlay.querySelector('#slideshow-play-pause'),
            prev: overlay.querySelector('#slideshow-prev'),
            next: overlay.querySelector('#slideshow-next'),
            fullscreen: overlay.querySelector('#slideshow-fullscreen'),
            close: overlay.querySelector('#slideshow-close'),
            counter: overlay.querySelector('#slideshow-counter'),
            currentSlide: overlay.querySelector('#current-slide'),
            totalSlides: overlay.querySelector('#total-slides'),
            progressBar: overlay.querySelector('#slideshow-progress-fill'),
            timer: overlay.querySelector('#slideshow-timer'),
            stage: overlay.querySelector('#slideshow-stage'),
            mediaCurrent: overlay.querySelector('#media-current'),
            mediaNext: overlay.querySelector('#media-next'),
            image: overlay.querySelector('#slideshow-image'),
            video: overlay.querySelector('#slideshow-video'),
            videoSource: overlay.querySelector('#slideshow-video-source'),
            imageNext: overlay.querySelector('#slideshow-image-next'),
            videoNext: overlay.querySelector('#slideshow-video-next'),
            videoSourceNext: overlay.querySelector('#slideshow-video-source-next'),
            loading: overlay.querySelector('#slideshow-loading'),
            navPrev: overlay.querySelector('#nav-prev'),
            navNext: overlay.querySelector('#nav-next'),
            title: overlay.querySelector('#slideshow-title'),
            date: overlay.querySelector('#slideshow-date'),
            time: overlay.querySelector('#slideshow-time'),
            type: overlay.querySelector('#slideshow-type'),
            thumbnails: overlay.querySelector('#slideshow-thumbnails'),
            thumbnailsTrack: overlay.querySelector('#thumbnails-track')
        };
    }

    /**
     * Bind methods para event listeners
     */
    bindMethods() {
        this.boundMethods = {
            handleKeydown: this.handleKeydown.bind(this),
            handleResize: this.handleResize.bind(this),
            handleFullscreenChange: this.handleFullscreenChange.bind(this),
            handleTouchStart: this.handleTouchStart.bind(this),
            handleTouchMove: this.handleTouchMove.bind(this),
            handleTouchEnd: this.handleTouchEnd.bind(this),
            handleMouseMove: this.handleMouseMove.bind(this),
            togglePlayPause: this.togglePlayPause.bind(this),
            previous: this.previous.bind(this),
            next: this.next.bind(this),
            close: this.close.bind(this),
            toggleFullscreen: this.toggleFullscreen.bind(this)
        };
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Controles
        this.elements.playPause?.addEventListener('click', this.boundMethods.togglePlayPause);
        this.elements.prev?.addEventListener('click', this.boundMethods.previous);
        this.elements.next?.addEventListener('click', this.boundMethods.next);
        this.elements.fullscreen?.addEventListener('click', this.boundMethods.toggleFullscreen);
        this.elements.close?.addEventListener('click', this.boundMethods.close);

        // Navegación
        this.elements.navPrev?.addEventListener('click', this.boundMethods.previous);
        this.elements.navNext?.addEventListener('click', this.boundMethods.next);

        // Media events
        this.elements.video?.addEventListener('loadeddata', () => this.hideLoading());
        this.elements.video?.addEventListener('ended', () => this.next());
        this.elements.image?.addEventListener('load', () => this.hideLoading());
        this.elements.image?.addEventListener('error', () => this.showError('Error cargando imagen'));

        // Mouse movement para mostrar/ocultar controles
        if (this.options.enableMouse) {
            this.elements.stage?.addEventListener('mousemove', this.boundMethods.handleMouseMove);
        }

        // Touch events
        if (this.options.enableTouch) {
            this.elements.stage?.addEventListener('touchstart', this.boundMethods.handleTouchStart);
            this.elements.stage?.addEventListener('touchmove', this.boundMethods.handleTouchMove);
            this.elements.stage?.addEventListener('touchend', this.boundMethods.handleTouchEnd);
        }

        // Fullscreen
        document.addEventListener('fullscreenchange', this.boundMethods.handleFullscreenChange);
    }

    /**
     * Iniciar slideshow con array de media
     */
    start(mediaArray, startIndex = 0) {
        if (!mediaArray || mediaArray.length === 0) {
            console.warn('No media provided for slideshow');
            return;
        }

        this.state.media = mediaArray;
        this.state.currentIndex = Math.max(0, Math.min(startIndex, mediaArray.length - 1));
        this.state.isActive = true;

        // Actualizar UI
        this.elements.totalSlides.textContent = this.state.media.length;
        this.updateNavigation();

        // Mostrar slideshow
        this.elements.overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Fullscreen si está habilitado
        if (this.options.fullscreen) {
            this.enterFullscreen();
        }

        // Cargar primer slide
        this.loadCurrentSlide();

        // Generar thumbnails si están habilitados
        if (this.options.showThumbnails) {
            this.generateThumbnails();
        }

        // Configurar event listeners globales
        if (this.options.enableKeyboard) {
            document.addEventListener('keydown', this.boundMethods.handleKeydown);
        }

        window.addEventListener('resize', this.boundMethods.handleResize);

        // Auto-play si está habilitado
        if (this.options.autoPlay) {
            this.play();
        }

        // Emitir evento
        this.emit('started', {
            mediaCount: this.state.media.length,
            startIndex: this.state.currentIndex
        });
    }

    /**
     * Cerrar slideshow
     */
    close() {
        this.state.isActive = false;
        this.pause();

        // Ocultar slideshow
        this.elements.overlay.style.display = 'none';
        document.body.style.overflow = '';

        // Salir de fullscreen
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }

        // Pausar videos
        this.elements.video.pause();
        this.elements.videoNext.pause();

        // Remover event listeners globales
        document.removeEventListener('keydown', this.boundMethods.handleKeydown);
        window.removeEventListener('resize', this.boundMethods.handleResize);

        // Limpiar timers
        this.clearTimers();

        // Emitir evento
        this.emit('closed');
    }

    /**
     * Play/Resume slideshow
     */
    play() {
        if (!this.state.isActive) return;

        this.state.isPlaying = true;
        this.state.startTime = Date.now() - this.state.pausedTime;

        // Actualizar icono
        this.elements.playPause.querySelector('.play-icon').textContent = '⏸️';
        this.elements.playPause.title = 'Pausar';

        // Iniciar timers
        this.startTimers();

        this.emit('played');
    }

    /**
     * Pausar slideshow
     */
    pause() {
        this.state.isPlaying = false;
        this.state.pausedTime = Date.now() - (this.state.startTime || Date.now());

        // Actualizar icono
        this.elements.playPause.querySelector('.play-icon').textContent = '▶️';
        this.elements.playPause.title = 'Reproducir';

        // Limpiar timers
        this.clearTimers();

        this.emit('paused');
    }

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (this.state.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Ir al slide anterior
     */
    previous() {
        if (this.state.isTransitioning) return;

        const newIndex = this.state.currentIndex - 1;

        if (newIndex < 0) {
            if (this.options.loop) {
                this.goToSlide(this.state.media.length - 1);
            }
        } else {
            this.goToSlide(newIndex);
        }

        this.emit('navigated', { direction: 'previous', index: this.state.currentIndex });
    }

    /**
     * Ir al slide siguiente
     */
    next() {
        if (this.state.isTransitioning) return;

        const newIndex = this.state.currentIndex + 1;

        if (newIndex >= this.state.media.length) {
            if (this.options.loop) {
                this.goToSlide(0);
            } else {
                this.close(); // Cerrar al final si no hay loop
            }
        } else {
            this.goToSlide(newIndex);
        }

        this.emit('navigated', { direction: 'next', index: this.state.currentIndex });
    }

    /**
     * Ir a un slide específico
     */
    goToSlide(index) {
        if (index < 0 || index >= this.state.media.length || index === this.state.currentIndex) {
            return;
        }

        this.state.currentIndex = index;
        this.loadCurrentSlide();

        // Resetear timers si está reproduciéndose
        if (this.state.isPlaying) {
            this.resetTimers();
        }

        this.emit('slideChanged', { index: this.state.currentIndex });
    }

    /**
     * Cargar slide actual
     */
    loadCurrentSlide() {
        const currentMedia = this.state.media[this.state.currentIndex];
        if (!currentMedia) return;

        this.showLoading();

        // Actualizar contador
        this.elements.currentSlide.textContent = this.state.currentIndex + 1;

        // Actualizar información
        this.updateSlideInfo(currentMedia);

        // Cargar media según tipo
        if (currentMedia.type === 'video') {
            this.loadVideo(currentMedia);
        } else {
            this.loadImage(currentMedia);
        }

        // Precargar siguiente slide
        this.preloadNextSlide();

        // Actualizar navegación
        this.updateNavigation();

        // Actualizar thumbnails
        this.updateThumbnails();
    }

    /**
     * Cargar imagen
     */
    loadImage(media) {
        this.elements.video.style.display = 'none';
        this.elements.image.style.display = 'block';

        this.elements.image.onload = () => {
            this.hideLoading();
            this.applyTransition();
        };

        this.elements.image.src = media.src || media.path;
    }

    /**
     * Cargar video
     */
    loadVideo(media) {
        this.elements.image.style.display = 'none';
        this.elements.video.style.display = 'block';

        this.elements.video.onloadeddata = () => {
            this.hideLoading();
            this.applyTransition();

            if (this.options.videoAutoPlay) {
                this.elements.video.play();
            }
        };

        this.elements.videoSource.src = media.src || media.path;
        this.elements.video.load();
    }

    /**
     * Precargar siguiente slide
     */
    preloadNextSlide() {
        const nextIndex = (this.state.currentIndex + 1) % this.state.media.length;
        const nextMedia = this.state.media[nextIndex];

        if (!nextMedia) return;

        if (nextMedia.type === 'video') {
            this.elements.videoSourceNext.src = nextMedia.src || nextMedia.path;
            this.elements.videoNext.load();
        } else {
            this.elements.imageNext.src = nextMedia.src || nextMedia.path;
        }
    }

    /**
     * Aplicar transición visual
     */
    applyTransition() {
        const container = this.elements.mediaCurrent;

        switch (this.options.transitionType) {
            case 'fade':
                container.style.opacity = '0';
                setTimeout(() => {
                    container.style.opacity = '1';
                }, 50);
                break;

            case 'slide':
                container.style.transform = 'translateX(-100%)';
                setTimeout(() => {
                    container.style.transform = 'translateX(0)';
                }, 50);
                break;

            case 'zoom':
                container.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    container.style.transform = 'scale(1)';
                }, 50);
                break;
        }
    }

    /**
     * Actualizar información del slide
     */
    updateSlideInfo(media) {
        this.elements.title.textContent = media.title || media.filename || '';
        this.elements.date.textContent = media.date ? this.formatDate(media.date) : '';
        this.elements.time.textContent = media.time || media.timestamp || '';
        this.elements.type.textContent = media.type === 'video' ? '🎥 Video' : '📸 Foto';
    }

    /**
     * Actualizar navegación
     */
    updateNavigation() {
        const isFirst = this.state.currentIndex === 0;
        const isLast = this.state.currentIndex === this.state.media.length - 1;

        if (!this.options.loop) {
            this.elements.navPrev.style.opacity = isFirst ? '0.5' : '1';
            this.elements.navNext.style.opacity = isLast ? '0.5' : '1';
            this.elements.prev.style.opacity = isFirst ? '0.5' : '1';
            this.elements.next.style.opacity = isLast ? '0.5' : '1';
        }
    }

    /**
     * Generar thumbnails
     */
    generateThumbnails() {
        if (!this.options.showThumbnails) return;

        const track = this.elements.thumbnailsTrack;
        track.innerHTML = '';

        this.state.media.forEach((media, index) => {
            const thumb = document.createElement('div');
            thumb.className = `thumbnail ${index === this.state.currentIndex ? 'active' : ''}`;
            thumb.dataset.index = index;

            if (media.type === 'video') {
                thumb.innerHTML = `
                    <video muted>
                        <source src="${media.src || media.path}" type="video/mp4">
                    </video>
                    <div class="thumbnail-overlay">🎥</div>
                `;
            } else {
                thumb.innerHTML = `<img src="${media.src || media.path}" alt="Thumbnail">`;
            }

            thumb.addEventListener('click', () => this.goToSlide(index));
            track.appendChild(thumb);
        });
    }

    /**
     * Actualizar thumbnails
     */
    updateThumbnails() {
        if (!this.options.showThumbnails) return;

        const thumbnails = this.elements.thumbnailsTrack.querySelectorAll('.thumbnail');
        thumbnails.forEach((thumb, index) => {
            thumb.classList.toggle('active', index === this.state.currentIndex);
        });
    }

    /**
     * Iniciar timers de progreso y auto-advance
     */
    startTimers() {
        this.clearTimers();

        const duration = this.options.duration;
        let elapsed = this.state.pausedTime;

        // Timer de progreso
        this.timers.progress = setInterval(() => {
            elapsed += 100;
            const progress = Math.min((elapsed / duration) * 100, 100);

            this.elements.progressBar.style.width = progress + '%';
            this.elements.timer.textContent = ((duration - elapsed) / 1000).toFixed(1) + 's';

            if (elapsed >= duration) {
                this.next();
            }
        }, 100);
    }

    /**
     * Resetear timers
     */
    resetTimers() {
        this.state.pausedTime = 0;
        this.state.startTime = Date.now();

        if (this.state.isPlaying) {
            this.startTimers();
        }
    }

    /**
     * Limpiar timers
     */
    clearTimers() {
        if (this.timers.progress) {
            clearInterval(this.timers.progress);
            this.timers.progress = null;
        }
    }

    /**
     * Mostrar loading
     */
    showLoading() {
        this.elements.loading.style.display = 'flex';
    }

    /**
     * Ocultar loading
     */
    hideLoading() {
        this.elements.loading.style.display = 'none';
    }

    /**
     * Mostrar error
     */
    showError(message) {
        this.hideLoading();
        console.error('Slideshow error:', message);
    }

    /**
     * Event handlers
     */
    handleKeydown(e) {
        if (!this.state.isActive) return;

        switch (e.key) {
            case 'Escape':
                this.close();
                break;
            case 'ArrowLeft':
                this.previous();
                break;
            case 'ArrowRight':
                this.next();
                break;
            case ' ':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'f':
                this.toggleFullscreen();
                break;
        }
    }

    handleResize() {
        // Ajustar tamaños si es necesario
    }

    handleFullscreenChange() {
        const icon = this.elements.fullscreen.querySelector('span');
        icon.textContent = document.fullscreenElement ? '⛶' : '⛶';
    }

    handleTouchStart(e) {
        this.state.touchStartX = e.touches[0].clientX;
        this.state.touchStartY = e.touches[0].clientY;
    }

    handleTouchMove(e) {
        if (!this.state.touchStartX || !this.state.touchStartY) return;
        e.preventDefault();
    }

    handleTouchEnd(e) {
        if (!this.state.touchStartX || !this.state.touchStartY) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const deltaX = touchEndX - this.state.touchStartX;
        const deltaY = touchEndY - this.state.touchStartY;

        const minSwipeDistance = 50;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) {
                this.previous();
            } else {
                this.next();
            }
        }

        this.state.touchStartX = 0;
        this.state.touchStartY = 0;
    }

    handleMouseMove() {
        // Mostrar controles al mover el mouse
        this.elements.header.style.opacity = '1';
        this.elements.controls.style.opacity = '1';

        // Ocultar después de un tiempo
        clearTimeout(this.hideControlsTimeout);
        this.hideControlsTimeout = setTimeout(() => {
            if (this.state.isPlaying) {
                this.elements.header.style.opacity = '0.7';
                this.elements.controls.style.opacity = '0.7';
            }
        }, 3000);
    }

    /**
     * Fullscreen management
     */
    enterFullscreen() {
        if (this.elements.overlay.requestFullscreen) {
            this.elements.overlay.requestFullscreen();
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.enterFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Utilidades
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Sistema de eventos
     */
    emit(eventName, data = {}) {
        const event = new CustomEvent(`slideshow:${eventName}`, {
            detail: { ...data, slideshow: this }
        });
        document.dispatchEvent(event);
    }

    on(eventName, callback) {
        document.addEventListener(`slideshow:${eventName}`, callback);
    }

    off(eventName, callback) {
        document.removeEventListener(`slideshow:${eventName}`, callback);
    }

    /**
     * API pública
     */
    isActive() {
        return this.state.isActive;
    }

    isPlaying() {
        return this.state.isPlaying;
    }

    getCurrentIndex() {
        return this.state.currentIndex;
    }

    getCurrentMedia() {
        return this.state.media[this.state.currentIndex];
    }

    getMediaCount() {
        return this.state.media.length;
    }

    setDuration(duration) {
        this.options.duration = duration;
        if (this.state.isPlaying) {
            this.resetTimers();
        }
    }

    setAutoPlay(autoPlay) {
        this.options.autoPlay = autoPlay;
    }

    setLoop(loop) {
        this.options.loop = loop;
        this.updateNavigation();
    }

    destroy() {
        this.close();

        // Remover elemento del DOM
        if (this.elements.overlay && this.elements.overlay.parentElement) {
            this.elements.overlay.parentElement.removeChild(this.elements.overlay);
        }
    }
}

// CSS para el slideshow
const slideshowStyles = `
    .slideshow-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        animation: fadeIn 0.3s ease;
    }

    .slideshow-container {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .slideshow-header {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 10001;
        background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
        padding: 1rem 2rem;
        transition: opacity 0.3s ease;
    }

    .slideshow-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .slideshow-btn {
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
        font-size: 1.25rem;
    }

    .slideshow-btn:hover {
        background: rgba(255,255,255,0.3);
        transform: scale(1.1);
    }

    .slideshow-progress-container {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: rgba(0,0,0,0.5);
        padding: 0.75rem 1.5rem;
        border-radius: 0.5rem;
        backdrop-filter: blur(10px);
    }

    .slideshow-counter {
        color: white;
        font-weight: 600;
        font-size: 0.875rem;
        min-width: 4rem;
    }

    .slideshow-progress-bar {
        flex: 1;
        height: 0.25rem;
        background: rgba(255,255,255,0.3);
        border-radius: 0.125rem;
        overflow: hidden;
    }

    .slideshow-progress-fill {
        height: 100%;
        background: white;
        width: 0%;
        transition: width 0.1s linear;
        border-radius: 0.125rem;
    }

    .slideshow-timer {
        color: white;
        font-weight: 500;
        font-size: 0.875rem;
        min-width: 3rem;
        text-align: right;
    }

    .slideshow-stage {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .slideshow-media-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .slideshow-media-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.5s ease;
    }

    .slideshow-media-item {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 0.5rem;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    }

    .slideshow-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        color: white;
        font-weight: 600;
        z-index: 10002;
    }

    .loading-spinner {
        width: 3rem;
        height: 3rem;
        border: 3px solid rgba(255,255,255,0.3);
        border-top: 3px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .slideshow-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0,0,0,0.5);
        border: none;
        color: white;
        width: 4rem;
        height: 4rem;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        font-weight: bold;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
        z-index: 10001;
    }

    .slideshow-nav:hover {
        background: rgba(0,0,0,0.8);
        transform: translateY(-50%) scale(1.1);
    }

    .slideshow-nav-prev {
        left: 2rem;
    }

    .slideshow-nav-next {
        right: 2rem;
    }

    .slideshow-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0,0,0,0.8));
        padding: 3rem 2rem 1.5rem;
        color: white;
        z-index: 10001;
    }

    .slideshow-info {
        text-align: center;
    }

    .slideshow-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 0 1rem;
    }

    .slideshow-metadata {
        display: flex;
        justify-content: center;
        gap: 2rem;
        flex-wrap: wrap;
        font-size: 0.875rem;
        opacity: 0.9;
    }

    .slideshow-metadata span {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .slideshow-thumbnails {
        position: absolute;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.7);
        border-radius: 0.75rem;
        padding: 0.75rem;
        backdrop-filter: blur(10px);
        z-index: 10001;
    }

    .thumbnails-track {
        display: flex;
        gap: 0.5rem;
        max-width: 80vw;
        overflow-x: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    .thumbnails-track::-webkit-scrollbar {
        display: none;
    }

    .thumbnail {
        position: relative;
        width: 4rem;
        height: 3rem;
        border-radius: 0.375rem;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
        flex-shrink: 0;
    }

    .thumbnail:hover {
        transform: scale(1.1);
    }

    .thumbnail.active {
        border-color: white;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.5);
    }

    .thumbnail img,
    .thumbnail video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .thumbnail-overlay {
        position: absolute;
        top: 0.25rem;
        right: 0.25rem;
        background: rgba(0,0,0,0.7);
        color: white;
        font-size: 0.75rem;
        padding: 0.125rem 0.25rem;
        border-radius: 0.25rem;
        backdrop-filter: blur(5px);
    }

    /* Transition effects */
    .slideshow-media-container.fade-out {
        opacity: 0;
    }

    .slideshow-media-container.slide-left {
        transform: translateX(-100%);
    }

    .slideshow-media-container.slide-right {
        transform: translateX(100%);
    }

    .slideshow-media-container.zoom-out {
        transform: scale(0.8);
        opacity: 0;
    }

    /* Responsive */
    @media (max-width: 768px) {
        .slideshow-header {
            padding: 1rem;
        }

        .slideshow-controls {
            gap: 0.5rem;
            margin-bottom: 0.75rem;
        }

        .slideshow-btn {
            width: 2.5rem;
            height: 2.5rem;
            font-size: 1rem;
        }

        .slideshow-progress-container {
            padding: 0.5rem 1rem;
            gap: 0.75rem;
        }

        .slideshow-nav {
            width: 3rem;
            height: 3rem;
            font-size: 1.5rem;
        }

        .slideshow-nav-prev {
            left: 1rem;
        }

        .slideshow-nav-next {
            right: 1rem;
        }

        .slideshow-footer {
            padding: 2rem 1rem 1rem;
        }

        .slideshow-title {
            font-size: 1.25rem;
        }

        .slideshow-metadata {
            gap: 1rem;
            flex-direction: column;
            align-items: center;
        }

        .thumbnail {
            width: 3rem;
            height: 2.25rem;
        }

        .thumbnails-track {
            max-width: 90vw;
        }
    }

    @media (max-width: 480px) {
        .slideshow-controls {
            flex-wrap: wrap;
            justify-content: center;
        }

        .slideshow-progress-container {
            order: -1;
            width: 100%;
            margin-bottom: 0.5rem;
        }

        .slideshow-metadata {
            font-size: 0.75rem;
        }

        .slideshow-nav {
            width: 2.5rem;
            height: 2.5rem;
            font-size: 1.25rem;
        }
    }

    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
        .slideshow-media-container,
        .slideshow-progress-fill,
        .slideshow-btn,
        .slideshow-nav,
        .thumbnail {
            transition: none !important;
            animation: none !important;
        }

        .loading-spinner {
            animation: none !important;
        }
    }

    /* Focus states for accessibility */
    .slideshow-btn:focus,
    .slideshow-nav:focus,
    .thumbnail:focus {
        outline: 2px solid white;
        outline-offset: 2px;
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
        .slideshow-btn,
        .slideshow-nav {
            border: 2px solid white;
        }

        .slideshow-progress-bar {
            border: 1px solid white;
        }

        .thumbnail {
            border: 1px solid white;
        }
    }
`;

// Agregar estilos al documento
const slideshowStyleSheet = document.createElement('style');
slideshowStyleSheet.textContent = slideshowStyles;
document.head.appendChild(slideshowStyleSheet);

// Exportar para uso global
window.Slideshow = Slideshow;

// Funciones globales para compatibilidad con el HTML existente
window.startSlideshow = (mediaArray, startIndex = 0) => {
    if (!window.globalSlideshow) {
        window.globalSlideshow = new Slideshow();
    }
    window.globalSlideshow.start(mediaArray, startIndex);
};

window.pauseSlideshow = () => {
    if (window.globalSlideshow) {
        window.globalSlideshow.togglePlayPause();
    }
};

window.stopSlideshow = () => {
    if (window.globalSlideshow) {
        window.globalSlideshow.close();
    }
};

window.nextSlide = () => {
    if (window.globalSlideshow) {
        window.globalSlideshow.next();
    }
};

window.previousSlide = () => {
    if (window.globalSlideshow) {
        window.globalSlideshow.previous();
    }
};

console.log('🎬 Slideshow component loaded successfully');
