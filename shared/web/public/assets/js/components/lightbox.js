// web/public/assets/js/components/lightbox.js - Componente de Lightbox

/**
 * Componente Lightbox para visualización de imágenes y videos
 */
class Lightbox {
    constructor(options = {}) {
        this.options = {
            enableKeyboard: true,
            enableTouch: true,
            enableZoom: true,
            autoPlay: false,
            downloadEnabled: true,
            showCounter: true,
            transitionDuration: 300,
            ...options
        };

        this.state = {
            isOpen: false,
            currentIndex: 0,
            media: [],
            isZoomed: false,
            zoomLevel: 1,
            touchStartX: 0,
            touchStartY: 0
        };

        this.elements = {};
        this.boundMethods = {};

        this.init();
    }

    init() {
        this.createLightbox();
        this.bindMethods();
        this.setupEventListeners();
    }

    createLightbox() {
        // Crear overlay si no existe
        let overlay = document.getElementById('lightbox');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'lightbox';
            overlay.className = 'lightbox-overlay';
            overlay.style.display = 'none';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div class="lightbox-container">
                <!-- Controles superiores -->
                <div class="lightbox-header">
                    <div class="lightbox-counter" id="lightbox-counter">
                        <span id="current-index">1</span> de <span id="total-count">1</span>
                    </div>
                    <div class="lightbox-actions">
                        ${this.options.downloadEnabled ? '<button class="lightbox-btn" id="download-btn" title="Descargar">⬇️</button>' : ''}
                        <button class="lightbox-btn" id="zoom-btn" title="Zoom">🔍</button>
                        <button class="lightbox-btn" id="fullscreen-btn" title="Pantalla completa">⛶</button>
                        <button class="lightbox-btn lightbox-close" id="close-btn" title="Cerrar">×</button>
                    </div>
                </div>

                <!-- Área de contenido -->
                <div class="lightbox-content-area">
                    <!-- Navegación izquierda -->
                    <button class="lightbox-nav lightbox-prev" id="prev-btn" title="Anterior">
                        <span>‹</span>
                    </button>

                    <!-- Contenido multimedia -->
                    <div class="lightbox-media-container" id="media-container">
                        <img class="lightbox-media" id="lightbox-image" style="display: none;">
                        <video class="lightbox-media" id="lightbox-video" controls style="display: none;">
                            <source id="lightbox-video-source" type="video/mp4">
                        </video>

                        <!-- Spinner de carga -->
                        <div class="lightbox-loading" id="lightbox-loading">
                            <div class="spinner"></div>
                            <span>Cargando...</span>
                        </div>
                    </div>

                    <!-- Navegación derecha -->
                    <button class="lightbox-nav lightbox-next" id="next-btn" title="Siguiente">
                        <span>›</span>
                    </button>
                </div>

                <!-- Información inferior -->
                <div class="lightbox-footer">
                    <div class="lightbox-info">
                        <h3 id="media-title"></h3>
                        <p id="media-description"></p>
                        <div class="media-metadata">
                            <span id="media-date"></span>
                            <span id="media-time"></span>
                            <span id="media-size"></span>
                        </div>
                    </div>
                </div>

                <!-- Thumbnails (opcional) -->
                <div class="lightbox-thumbnails" id="lightbox-thumbnails" style="display: none;">
                    <!-- Thumbnails se generan dinámicamente -->
                </div>
            </div>
        `;

        // Guardar referencias a elementos
        this.elements = {
            overlay: overlay,
            container: overlay.querySelector('.lightbox-container'),
            header: overlay.querySelector('.lightbox-header'),
            counter: overlay.querySelector('#lightbox-counter'),
            currentIndex: overlay.querySelector('#current-index'),
            totalCount: overlay.querySelector('#total-count'),
            downloadBtn: overlay.querySelector('#download-btn'),
            zoomBtn: overlay.querySelector('#zoom-btn'),
            fullscreenBtn: overlay.querySelector('#fullscreen-btn'),
            closeBtn: overlay.querySelector('#close-btn'),
            prevBtn: overlay.querySelector('#prev-btn'),
            nextBtn: overlay.querySelector('#next-btn'),
            mediaContainer: overlay.querySelector('#media-container'),
            image: overlay.querySelector('#lightbox-image'),
            video: overlay.querySelector('#lightbox-video'),
            videoSource: overlay.querySelector('#lightbox-video-source'),
            loading: overlay.querySelector('#lightbox-loading'),
            title: overlay.querySelector('#media-title'),
            description: overlay.querySelector('#media-description'),
            date: overlay.querySelector('#media-date'),
            time: overlay.querySelector('#media-time'),
            size: overlay.querySelector('#media-size'),
            thumbnails: overlay.querySelector('#lightbox-thumbnails')
        };
    }

    bindMethods() {
        this.boundMethods = {
            handleKeydown: this.handleKeydown.bind(this),
            handleResize: this.handleResize.bind(this),
            handleTouchStart: this.handleTouchStart.bind(this),
            handleTouchMove: this.handleTouchMove.bind(this),
            handleTouchEnd: this.handleTouchEnd.bind(this),
            close: this.close.bind(this),
            previous: this.previous.bind(this),
            next: this.next.bind(this),
            download: this.download.bind(this),
            toggleZoom: this.toggleZoom.bind(this),
            toggleFullscreen: this.toggleFullscreen.bind(this)
        };
    }

    setupEventListeners() {
        // Eventos de botones
        this.elements.closeBtn?.addEventListener('click', this.boundMethods.close);
        this.elements.prevBtn?.addEventListener('click', this.boundMethods.previous);
        this.elements.nextBtn?.addEventListener('click', this.boundMethods.next);
        this.elements.downloadBtn?.addEventListener('click', this.boundMethods.download);
        this.elements.zoomBtn?.addEventListener('click', this.boundMethods.toggleZoom);
        this.elements.fullscreenBtn?.addEventListener('click', this.boundMethods.toggleFullscreen);

        // Click en el overlay para cerrar
        this.elements.overlay.addEventListener('click', (e) => {
            if (e.target === this.elements.overlay || e.target === this.elements.container) {
                this.close();
            }
        });

        // Doble click para zoom
        this.elements.mediaContainer.addEventListener('dblclick', this.boundMethods.toggleZoom);

        // Eventos de carga de media
        this.elements.image.addEventListener('load', () => this.hideLoading());
        this.elements.image.addEventListener('error', () => this.showError('Error cargando imagen'));

        this.elements.video.addEventListener('loadeddata', () => this.hideLoading());
        this.elements.video.addEventListener('error', () => this.showError('Error cargando video'));
    }

    open(mediaArray, startIndex = 0) {
        this.state.media = mediaArray;
        this.state.currentIndex = startIndex;
        this.state.isOpen = true;

        // Actualizar contador total
        this.elements.totalCount.textContent = this.state.media.length;

        // Mostrar lightbox
        this.elements.overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Cargar media actual
        this.loadCurrentMedia();

        // Configurar event listeners globales
        if (this.options.enableKeyboard) {
            document.addEventListener('keydown', this.boundMethods.handleKeydown);
        }

        if (this.options.enableTouch) {
            this.elements.mediaContainer.addEventListener('touchstart', this.boundMethods.handleTouchStart);
            this.elements.mediaContainer.addEventListener('touchmove', this.boundMethods.handleTouchMove);
            this.elements.mediaContainer.addEventListener('touchend', this.boundMethods.handleTouchEnd);
        }

        window.addEventListener('resize', this.boundMethods.handleResize);

        // Emitir evento
        this.emit('opened', { index: startIndex, media: this.state.media[startIndex] });
    }

    close() {
        this.state.isOpen = false;
        this.state.isZoomed = false;
        this.state.zoomLevel = 1;

        // Ocultar lightbox
        this.elements.overlay.style.display = 'none';
        document.body.style.overflow = '';

        // Parar video si está reproduciendo
        this.elements.video.pause();

        // Remover event listeners globales
        document.removeEventListener('keydown', this.boundMethods.handleKeydown);
        this.elements.mediaContainer.removeEventListener('touchstart', this.boundMethods.handleTouchStart);
        this.elements.mediaContainer.removeEventListener('touchmove', this.boundMethods.handleTouchMove);
        this.elements.mediaContainer.removeEventListener('touchend', this.boundMethods.handleTouchEnd);
        window.removeEventListener('resize', this.boundMethods.handleResize);

        // Emitir evento
        this.emit('closed');
    }

    previous() {
        if (this.state.media.length <= 1) return;

        this.state.currentIndex = (this.state.currentIndex - 1 + this.state.media.length) % this.state.media.length;
        this.loadCurrentMedia();
        this.emit('navigated', { direction: 'previous', index: this.state.currentIndex });
    }

    next() {
        if (this.state.media.length <= 1) return;

        this.state.currentIndex = (this.state.currentIndex + 1) % this.state.media.length;
        this.loadCurrentMedia();
        this.emit('navigated', { direction: 'next', index: this.state.currentIndex });
    }

    loadCurrentMedia() {
        const currentMedia = this.state.media[this.state.currentIndex];
        if (!currentMedia) return;

        // Mostrar loading
        this.showLoading();

        // Resetear zoom
        this.resetZoom();

        // Actualizar contador
        this.elements.currentIndex.textContent = this.state.currentIndex + 1;

        // Actualizar información
        this.updateMediaInfo(currentMedia);

        // Cargar media según tipo
        if (currentMedia.type === 'video') {
            this.loadVideo(currentMedia);
        } else {
            this.loadImage(currentMedia);
        }

        // Actualizar navegación
        this.updateNavigation();
    }

    loadImage(media) {
        this.elements.video.style.display = 'none';
        this.elements.image.style.display = 'block';

        this.elements.image.src = media.src || media.path;
        this.elements.image.alt = media.alt || media.filename || 'Imagen';
    }

    loadVideo(media) {
        this.elements.image.style.display = 'none';
        this.elements.video.style.display = 'block';

        this.elements.videoSource.src = media.src || media.path;
        this.elements.video.load();

        if (this.options.autoPlay) {
            this.elements.video.play();
        }
    }

    updateMediaInfo(media) {
        this.elements.title.textContent = media.title || media.filename || '';
        this.elements.description.textContent = media.description || '';
        this.elements.date.textContent = media.date ? photoDiaryCommon.formatDate(media.date) : '';
        this.elements.time.textContent = media.time || media.timestamp || '';
        this.elements.size.textContent = media.size ? photoDiaryCommon.formatFileSize(media.size) : '';
    }

    updateNavigation() {
        const hasMultiple = this.state.media.length > 1;
        this.elements.prevBtn.style.display = hasMultiple ? 'flex' : 'none';
        this.elements.nextBtn.style.display = hasMultiple ? 'flex' : 'none';
        this.elements.counter.style.display = hasMultiple ? 'block' : 'none';
    }

    showLoading() {
        this.elements.loading.style.display = 'flex';
    }

    hideLoading() {
        this.elements.loading.style.display = 'none';
    }

    showError(message) {
        this.hideLoading();
        this.elements.mediaContainer.innerHTML = `
            <div class="lightbox-error">
                <div class="error-icon">❌</div>
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="lightbox.close()" class="btn btn-primary">Cerrar</button>
            </div>
        `;
    }

    download() {
        const currentMedia = this.state.media[this.state.currentIndex];
        if (!currentMedia) return;

        const link = document.createElement('a');
        link.href = currentMedia.src || currentMedia.path;
        link.download = currentMedia.filename || `media_${Date.now()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.emit('downloaded', { media: currentMedia });
    }

    toggleZoom() {
        if (!this.options.enableZoom) return;

        const currentMedia = this.elements.image.style.display !== 'none' ? this.elements.image : null;
        if (!currentMedia) return;

        if (this.state.isZoomed) {
            this.resetZoom();
        } else {
            this.zoomIn();
        }
    }

    zoomIn() {
        this.state.isZoomed = true;
        this.state.zoomLevel = 2;

        const media = this.elements.image;
        media.style.transform = `scale(${this.state.zoomLevel})`;
        media.style.cursor = 'grab';

        this.elements.zoomBtn.textContent = '🔍-';
        this.elements.zoomBtn.title = 'Zoom out';

        // Habilitar arrastre para pan
        this.enablePan();
    }

    resetZoom() {
        this.state.isZoomed = false;
        this.state.zoomLevel = 1;

        const media = this.elements.image;
        media.style.transform = 'scale(1)';
        media.style.cursor = 'default';

        this.elements.zoomBtn.textContent = '🔍';
        this.elements.zoomBtn.title = 'Zoom';

        this.disablePan();
    }

    enablePan() {
        let isPanning = false;
        let startX, startY, currentX = 0, currentY = 0;

        const startPan = (e) => {
            isPanning = true;
            startX = (e.clientX || e.touches[0].clientX) - currentX;
            startY = (e.clientY || e.touches[0].clientY) - currentY;
            this.elements.image.style.cursor = 'grabbing';
        };

        const doPan = (e) => {
            if (!isPanning) return;
            e.preventDefault();

            currentX = (e.clientX || e.touches[0].clientX) - startX;
            currentY = (e.clientY || e.touches[0].clientY) - startY;

            this.elements.image.style.transform = `scale(${this.state.zoomLevel}) translate(${currentX}px, ${currentY}px)`;
        };

        const endPan = () => {
            isPanning = false;
            this.elements.image.style.cursor = 'grab';
        };

        this.elements.image.addEventListener('mousedown', startPan);
        this.elements.image.addEventListener('mousemove', doPan);
        this.elements.image.addEventListener('mouseup', endPan);
        this.elements.image.addEventListener('mouseleave', endPan);

        this.elements.image.addEventListener('touchstart', startPan);
        this.elements.image.addEventListener('touchmove', doPan);
        this.elements.image.addEventListener('touchend', endPan);

        // Guardar referencias para poder removerlas después
        this.panListeners = { startPan, doPan, endPan };
    }

    disablePan() {
        if (this.panListeners) {
            const { startPan, doPan, endPan } = this.panListeners;

            this.elements.image.removeEventListener('mousedown', startPan);
            this.elements.image.removeEventListener('mousemove', doPan);
            this.elements.image.removeEventListener('mouseup', endPan);
            this.elements.image.removeEventListener('mouseleave', endPan);

            this.elements.image.removeEventListener('touchstart', startPan);
            this.elements.image.removeEventListener('touchmove', doPan);
            this.elements.image.removeEventListener('touchend', endPan);

            this.panListeners = null;
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.elements.overlay.requestFullscreen().catch(err => {
                console.warn('Error al entrar en pantalla completa:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // Event Handlers
    handleKeydown(e) {
        if (!this.state.isOpen) return;

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
                if (this.elements.video.style.display !== 'none') {
                    this.elements.video.paused ? this.elements.video.play() : this.elements.video.pause();
                }
                break;
            case '+':
            case '=':
                if (this.options.enableZoom && !this.state.isZoomed) {
                    this.zoomIn();
                }
                break;
            case '-':
                if (this.options.enableZoom && this.state.isZoomed) {
                    this.resetZoom();
                }
                break;
            case 'd':
                if (this.options.downloadEnabled) {
                    this.download();
                }
                break;
        }
    }

    handleResize() {
        if (this.state.isZoomed) {
            this.resetZoom();
        }
    }

    handleTouchStart(e) {
        this.state.touchStartX = e.touches[0].clientX;
        this.state.touchStartY = e.touches[0].clientY;
    }

    handleTouchMove(e) {
        if (!this.state.touchStartX || !this.state.touchStartY) return;

        // Prevenir scroll en móvil cuando se está navegando
        if (Math.abs(e.touches[0].clientX - this.state.touchStartX) > 50) {
            e.preventDefault();
        }
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
                this.previous(); // Swipe right = previous
            } else {
                this.next(); // Swipe left = next
            }
        }

        this.state.touchStartX = 0;
        this.state.touchStartY = 0;
    }

    // Utilidades
    emit(eventName, data = {}) {
        const event = new CustomEvent(`lightbox:${eventName}`, {
            detail: { ...data, lightbox: this }
        });
        document.dispatchEvent(event);
    }

    on(eventName, callback) {
        document.addEventListener(`lightbox:${eventName}`, callback);
    }

    off(eventName, callback) {
        document.removeEventListener(`lightbox:${eventName}`, callback);
    }

    // API Pública
    goTo(index) {
        if (index >= 0 && index < this.state.media.length) {
            this.state.currentIndex = index;
            this.loadCurrentMedia();
        }
    }

    addMedia(media) {
        this.state.media.push(media);
        this.elements.totalCount.textContent = this.state.media.length;
        this.updateNavigation();
    }

    removeMedia(index) {
        if (index >= 0 && index < this.state.media.length) {
            this.state.media.splice(index, 1);
            this.elements.totalCount.textContent = this.state.media.length;

            // Ajustar índice actual si es necesario
            if (this.state.currentIndex >= this.state.media.length) {
                this.state.currentIndex = this.state.media.length - 1;
            }

            if (this.state.media.length === 0) {
                this.close();
            } else {
                this.loadCurrentMedia();
            }
        }
    }

    getCurrentMedia() {
        return this.state.media[this.state.currentIndex];
    }

    isOpen() {
        return this.state.isOpen;
    }
}

// CSS adicional para el lightbox
const lightboxStyles = `
    .lightbox-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(5px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    }

    .lightbox-container {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .lightbox-header {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 2rem;
        background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
        z-index: 10001;
    }

    .lightbox-counter {
        color: white;
        font-weight: 600;
        background: rgba(0,0,0,0.5);
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        backdrop-filter: blur(10px);
    }

    .lightbox-actions {
        display: flex;
        gap: 0.5rem;
    }

    .lightbox-btn {
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

    .lightbox-btn:hover {
        background: rgba(255,255,255,0.3);
        transform: scale(1.1);
    }

    .lightbox-content-area {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }

    .lightbox-nav {
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

    .lightbox-nav:hover {
        background: rgba(0,0,0,0.8);
        transform: translateY(-50%) scale(1.1);
    }

    .lightbox-prev {
        left: 2rem;
    }

    .lightbox-next {
        right: 2rem;
    }

    .lightbox-media-container {
        position: relative;
        max-width: 90%;
        max-height: 90%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .lightbox-media {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 0.5rem;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
        transition: transform 0.3s ease;
    }

    .lightbox-loading {
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
    }

    .lightbox-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0,0,0,0.8));
        padding: 3rem 2rem 1rem;
        color: white;
    }

    .lightbox-info h3 {
        margin: 0 0 0.5rem;
        font-size: 1.25rem;
        font-weight: 700;
    }

    .lightbox-info p {
        margin: 0 0 1rem;
        opacity: 0.9;
    }

    .media-metadata {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        font-size: 0.875rem;
        opacity: 0.8;
    }

    .media-metadata span:not(:empty)::before {
        content: '• ';
        margin-right: 0.25rem;
    }

    .media-metadata span:first-child::before {
        content: '';
        margin-right: 0;
    }

    .lightbox-error {
        text-align: center;
        color: white;
        padding: 2rem;
    }

    .lightbox-error .error-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    .lightbox-error h3 {
        margin: 0 0 1rem;
        font-size: 1.5rem;
    }

    .lightbox-error p {
        margin: 0 0 2rem;
        opacity: 0.8;
    }

    /* Responsive */
    @media (max-width: 768px) {
        .lightbox-header {
            padding: 1rem;
        }

        .lightbox-nav {
            width: 3rem;
            height: 3rem;
            font-size: 1.5rem;
        }

        .lightbox-prev {
            left: 1rem;
        }

        .lightbox-next {
            right: 1rem;
        }

        .lightbox-footer {
            padding: 2rem 1rem 1rem;
        }

        .lightbox-btn {
            width: 2.5rem;
            height: 2.5rem;
            font-size: 1rem;
        }

        .media-metadata {
            flex-direction: column;
            gap: 0.5rem;
        }
    }
`;

// Agregar estilos al documento
const lightboxStyleSheet = document.createElement('style');
lightboxStyleSheet.textContent = lightboxStyles;
document.head.appendChild(lightboxStyleSheet);

// Crear instancia global
const lightbox = new Lightbox();
window.lightbox = lightbox;

// Funciones globales para compatibilidad
window.openLightbox = (imageSrc, date, time, index) => {
    const media = [{
        src: imageSrc,
        type: imageSrc.includes('.mp4') ? 'video' : 'image',
        date: date,
        time: time,
        filename: imageSrc.split('/').pop()
    }];
    lightbox.open(media, 0);
};

window.closeLightbox = () => lightbox.close();
window.previousMedia = () => lightbox.previous();
window.nextMedia = () => lightbox.next();
window.downloadMedia = () => lightbox.download();

console.log('✨ Lightbox component loaded successfully');
