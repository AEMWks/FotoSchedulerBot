// Feed.js - JavaScript para la página principal del feed

class PhotoFeed {
  constructor() {
    this.PHOTOS_BASE_PATH = "/photos";
    this.allPhotoDates = [];
    this.loadedPhotos = {};
    this.isLoading = false;
    this.isRefreshing = false;
    this.totalPhotos = 0;
    this.lastRefreshTime = Date.now();
    this.refreshCooldown = 5000;
    this.scrollRefreshThreshold = 500;

    // Slideshow
    this.slideshow = {
      active: false,
      currentIndex: 0,
      interval: null,
      duration: 4000,
      allMedia: [],
    };

    // Lightbox
    this.lightbox = {
      currentIndex: 0,
      currentMedia: [],
    };

    // Comentarios
    this.comments = {
      cache: new Map(), // Cache de comentarios cargados
      currentDate: null, // Fecha del comentario actual en edición
      isEditing: false, // Estado de edición
      autoSaveTimeout: null, // Para auto-guardado
    };

    this.init();
  }

  init() {
    this.setupTheme();
    this.setupEventListeners();
    this.initializeFeed();
    this.setupScrollRefresh();
  }

  // Theme Management
  setupTheme() {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    this.updateThemeIcon(newTheme);
  }

  updateThemeIcon(theme) {
    const themeIcon = document.querySelector(".theme-icon");
    if (themeIcon) {
      themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
    }
  }

  // Event Listeners
  setupEventListeners() {
    // Theme toggle
    document.getElementById("theme-toggle")?.addEventListener("click", () => {
      this.toggleTheme();
    });

    // Refresh button
    document.getElementById("refresh-btn")?.addEventListener("click", () => {
      this.refreshPhotos();
    });

    // Slideshow button
    document.getElementById("slideshow-btn")?.addEventListener("click", () => {
      this.startSlideshow();
    });

    // Auto-refresh toggle
    const autoRefreshToggle = document.getElementById("auto-refresh");
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.setupScrollRefresh();
        } else {
          this.disableScrollRefresh();
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeLightbox();
        this.stopSlideshow();
      } else if (e.key === "ArrowLeft") {
        this.previousMedia();
      } else if (e.key === "ArrowRight") {
        this.nextMedia();
      } else if (e.key === " " && this.slideshow.active) {
        e.preventDefault();
        this.pauseSlideshow();
      }
    });

    // Comentarios - delegación de eventos
    document.addEventListener("click", (e) => {
      // Click en icono de comentario
      if (e.target.closest(".comment-icon")) {
        const commentIcon = e.target.closest(".comment-icon");
        const date = commentIcon.dataset.date;
        this.showCommentModal(date);
      }

      // Click en botón guardar comentario
      if (e.target.id === "save-comment-btn") {
        this.saveCurrentComment();
      }

      // Click en botón eliminar comentario
      if (e.target.id === "delete-comment-btn") {
        this.deleteCurrentComment();
      }

      // Click en botón cancelar comentario
      if (e.target.id === "cancel-comment-btn") {
        this.hideCommentModal();
      }
    });

    // Auto-guardado mientras escribe
    document.addEventListener("input", (e) => {
      if (e.target.id === "comment-textarea") {
        this.scheduleAutoSave();
      }
    });
  }

  // Feed Management
  async initializeFeed() {
    try {
      await this.loadAvailableDates();
      await this.loadAllPhotos();
      this.updateStats();
    } catch (error) {
      console.error("Error inicializando feed:", error);
      this.showError("Error al cargar el feed inicial");
    }
  }

  async loadAvailableDates() {
    // En una implementación real, esto haría una llamada a la API
    // Por ahora simulamos con fechas de los últimos 30 días
    const dates = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(this.formatDate(date));
    }

    this.allPhotoDates = dates;
    console.log("Fechas disponibles:", this.allPhotoDates.length);
  }

  async loadAllPhotos() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading(true);

    try {
      const allPhotos = {};
      let totalCount = 0;

      console.log(`Cargando fotos para ${this.allPhotoDates.length} fechas...`);

      for (const date of this.allPhotoDates) {
        const photos = await this.getPhotosForDate(date);
        if (photos.length > 0) {
          allPhotos[date] = photos;
          totalCount += photos.length;
        }
      }

      this.loadedPhotos = allPhotos;
      this.displayFeed(this.loadedPhotos);

      console.log(
        `Cargadas ${totalCount} fotos de ${Object.keys(allPhotos).length} días`
      );
    } catch (error) {
      console.error("Error cargando todas las fotos:", error);
      this.showError("Error al cargar las fotos");
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  async getPhotosForDate(dateStr) {
    const [year, month, day] = dateStr.split("-");

    try {
      const response = await fetch(
        `/api/routes/photos.php?year=${year}&month=${month}&day=${day}`
      );
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.log(`No se encontraron fotos para ${dateStr}`);
      return this.generateMockPhotos(dateStr);
    }
  }

  generateMockPhotos(dateStr) {
    const mockPhotos = [
      "10-30-45.jpg",
      "14-15-20.jpg",
      "18-45-30.mp4",
      "20-12-15.jpg",
      "09-15-30.jpg",
      "16-20-45.jpg",
    ];

    const now = Date.now();
    const daysSinceDate = Math.floor(
      (now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
    );
    const probability = daysSinceDate < 3 ? 0.8 : daysSinceDate < 7 ? 0.5 : 0.2;

    if (Math.random() < probability) {
      const baseCount = Math.floor(Math.random() * 3) + 1;
      const extraPhotos = Math.floor(now / 10000) % 2;
      const totalPhotos = baseCount + extraPhotos;

      return mockPhotos.slice(0, Math.min(totalPhotos, mockPhotos.length));
    }
    return [];
  }

  displayFeed(photosByDate) {
    const container = document.getElementById("feedContainer");

    if (Object.keys(photosByDate).length === 0) {
      container.innerHTML = `
                <div class="no-photos">
                    <div class="no-photos-icon">📷</div>
                    <h3>No hay fotos disponibles</h3>
                    <p>Tus recuerdos aparecerán aquí cuando tengas fotos</p>
                </div>
            `;
      return;
    }

    let html = "";
    const sortedDates = Object.keys(photosByDate).sort((a, b) =>
      b.localeCompare(a)
    );

    for (const date of sortedDates) {
      const photos = photosByDate[date];
      html += `
                <div class="diary-entry">
                    <div class="entry-date">${this.formatDateSpanish(
                      date
                    )}</div>
                    <div class="media-grid">
                        ${photos
                          .map((photo, index) =>
                            this.createMediaItem(photo, date, index)
                          )
                          .join("")}
                    </div>
                </div>
            `;
    }

    container.innerHTML = html;
    this.loadCommentsForDisplayedDates(sortedDates);
    this.prepareMediaForSlideshow();
  }

  createMediaItem(filename, date, index) {
    const [year, month, day] = date.split("-");
    const filePath = `${this.PHOTOS_BASE_PATH}/${year}/${month}/${day}/${filename}`;
    const isVideo = filename.toLowerCase().endsWith(".mp4");
    const timestamp = this.extractTimestamp(filename);

    const mediaItem = `
            <div class="media-item" onclick="photoFeed.openLightbox('${filePath}', '${date}', '${timestamp}', ${index})" data-date="${date}" data-time="${timestamp}">
                ${
                  isVideo
                    ? `<video muted>
                        <source src="${filePath}" type="video/mp4">
                        Tu navegador no soporta el elemento video.
                    </video>`
                    : `<img src="${filePath}" alt="Foto del ${date}" loading="lazy">`
                }
                <div class="media-timestamp">${timestamp}</div>
                <div class="comment-icon" data-date="${date}" title="Agregar comentario">
                    💬
                    <span class="comment-indicator" style="display: none;">📝</span>
                </div>
            </div>
        `;

    return mediaItem;
  }

  prepareMediaForSlideshow() {
    this.slideshow.allMedia = [];
    const mediaItems = document.querySelectorAll(".media-item");

    mediaItems.forEach((item, index) => {
      const img = item.querySelector("img");
      const video = item.querySelector("video");
      const date = item.dataset.date;
      const time = item.dataset.time;

      if (img) {
        this.slideshow.allMedia.push({
          type: "image",
          src: img.src,
          alt: img.alt,
          date: date,
          time: time,
          index: index,
        });
      } else if (video) {
        this.slideshow.allMedia.push({
          type: "video",
          src: video.querySelector("source").src,
          date: date,
          time: time,
          index: index,
        });
      }
    });
  }

  // Refresh functionality
  setupScrollRefresh() {
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
    }

    let lastScrollY = window.scrollY;
    let scrollDistance = 0;

    this.scrollHandler = () => {
      const currentScrollY = window.scrollY;
      const deltaY = Math.abs(currentScrollY - lastScrollY);

      scrollDistance += deltaY;
      lastScrollY = currentScrollY;

      if (scrollDistance >= this.scrollRefreshThreshold) {
        this.checkForRefresh();
        scrollDistance = 0;
      }
    };

    window.addEventListener("scroll", this.scrollHandler);
  }

  disableScrollRefresh() {
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
      this.scrollHandler = null;
    }
  }

  async checkForRefresh() {
    const now = Date.now();
    if (now - this.lastRefreshTime < this.refreshCooldown) {
      return;
    }

    if (this.isRefreshing || this.isLoading) {
      return;
    }

    console.log("Trigger de scroll - Verificando nuevas fotos...");
    this.lastRefreshTime = now;
    await this.refreshPhotos();
  }

  async refreshPhotos() {
    if (this.isRefreshing || this.isLoading) return;

    this.isRefreshing = true;
    this.showRefreshIndicator(true);

    try {
      await this.loadAvailableDates();
      const newPhotos = {};
      let foundNewPhotos = false;

      for (const date of this.allPhotoDates) {
        const currentPhotos = await this.getPhotosForDate(date);

        if (currentPhotos.length > 0) {
          const existingPhotos = this.loadedPhotos[date] || [];

          if (
            currentPhotos.length !== existingPhotos.length ||
            !this.arraysEqual(currentPhotos, existingPhotos)
          ) {
            newPhotos[date] = currentPhotos;
            foundNewPhotos = true;
          }
        }
      }

      if (foundNewPhotos) {
        console.log("¡Nuevas fotos encontradas!", Object.keys(newPhotos));
        Object.assign(this.loadedPhotos, newPhotos);
        this.displayFeed(this.loadedPhotos);
        this.updateStats();
        this.showNewPhotosNotification(Object.values(newPhotos).flat().length);
      } else {
        console.log("No se encontraron fotos nuevas");
      }
    } catch (error) {
      console.error("Error refrescando fotos:", error);
    } finally {
      this.isRefreshing = false;
      this.showRefreshIndicator(false);
    }
  }

  // Lightbox functionality
  openLightbox(imageSrc, date, time, index) {
    const lightbox = document.getElementById("lightbox");
    const lightboxContent = document.getElementById("lightboxContent");
    const lightboxVideo = document.getElementById("lightboxVideo");
    const lightboxDate = document.getElementById("lightboxDate");
    const lightboxTime = document.getElementById("lightboxTime");

    // Prepare current media array for navigation
    this.lightbox.currentMedia = this.slideshow.allMedia;
    this.lightbox.currentIndex = index;

    const isVideo = imageSrc.toLowerCase().includes(".mp4");

    if (isVideo) {
      lightboxContent.style.display = "none";
      lightboxVideo.style.display = "block";
      lightboxVideo.querySelector("source").src = imageSrc;
      lightboxVideo.load();
    } else {
      lightboxVideo.style.display = "none";
      lightboxContent.style.display = "block";
      lightboxContent.src = imageSrc;
    }

    lightboxDate.textContent = this.formatDateSpanish(date);
    lightboxTime.textContent = time;

    lightbox.style.display = "flex";
    document.addEventListener("keydown", this.handleLightboxKeydown);
  }

  closeLightbox() {
    const lightbox = document.getElementById("lightbox");
    lightbox.style.display = "none";
    document.removeEventListener("keydown", this.handleLightboxKeydown);
  }

  previousMedia() {
    if (this.lightbox.currentMedia.length === 0) return;

    this.lightbox.currentIndex =
      (this.lightbox.currentIndex - 1 + this.lightbox.currentMedia.length) %
      this.lightbox.currentMedia.length;
    this.updateLightboxContent();
  }

  nextMedia() {
    if (this.lightbox.currentMedia.length === 0) return;

    this.lightbox.currentIndex =
      (this.lightbox.currentIndex + 1) % this.lightbox.currentMedia.length;
    this.updateLightboxContent();
  }

  updateLightboxContent() {
    const currentMedia = this.lightbox.currentMedia[this.lightbox.currentIndex];
    if (!currentMedia) return;

    const lightboxContent = document.getElementById("lightboxContent");
    const lightboxVideo = document.getElementById("lightboxVideo");
    const lightboxDate = document.getElementById("lightboxDate");
    const lightboxTime = document.getElementById("lightboxTime");

    if (currentMedia.type === "video") {
      lightboxContent.style.display = "none";
      lightboxVideo.style.display = "block";
      lightboxVideo.querySelector("source").src = currentMedia.src;
      lightboxVideo.load();
    } else {
      lightboxVideo.style.display = "none";
      lightboxContent.style.display = "block";
      lightboxContent.src = currentMedia.src;
    }

    lightboxDate.textContent = this.formatDateSpanish(currentMedia.date);
    lightboxTime.textContent = currentMedia.time;
  }

  downloadMedia() {
    const currentMedia = this.lightbox.currentMedia[this.lightbox.currentIndex];
    if (!currentMedia) return;

    const a = document.createElement("a");
    a.href = currentMedia.src;
    a.download = `foto_${currentMedia.date}_${currentMedia.time}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  handleLightboxKeydown = (e) => {
    if (e.key === "Escape") {
      this.closeLightbox();
    } else if (e.key === "ArrowLeft") {
      this.previousMedia();
    } else if (e.key === "ArrowRight") {
      this.nextMedia();
    }
  };

  // Slideshow functionality
  startSlideshow() {
    if (this.slideshow.allMedia.length === 0) {
      alert("No hay fotos disponibles para la presentación");
      return;
    }

    this.slideshow.active = true;
    this.slideshow.currentIndex = 0;

    const slideshowOverlay = document.getElementById("slideshowOverlay");
    slideshowOverlay.style.display = "flex";

    this.updateSlideshowContent();
    this.startSlideshowTimer();
  }

  updateSlideshowContent() {
    const currentMedia = this.slideshow.allMedia[this.slideshow.currentIndex];
    if (!currentMedia) return;

    const slideshowImage = document.getElementById("slideshow-image");
    const slideshowVideo = document.getElementById("slideshow-video");
    const slideshowDate = document.getElementById("slideshow-date");
    const slideshowTime = document.getElementById("slideshow-time");
    const progress = document.getElementById("slideshow-progress");

    if (currentMedia.type === "video") {
      slideshowImage.style.display = "none";
      slideshowVideo.style.display = "block";
      slideshowVideo.querySelector("source").src = currentMedia.src;
      slideshowVideo.load();
      slideshowVideo.play();
    } else {
      slideshowVideo.style.display = "none";
      slideshowImage.style.display = "block";
      slideshowImage.src = currentMedia.src;
    }

    slideshowDate.textContent = this.formatDateSpanish(currentMedia.date);
    slideshowTime.textContent = currentMedia.time;
    progress.textContent = `${this.slideshow.currentIndex + 1} / ${
      this.slideshow.allMedia.length
    }`;
  }

  startSlideshowTimer() {
    this.clearSlideshowTimer();
    this.slideshow.interval = setInterval(() => {
      this.nextSlide();
    }, this.slideshow.duration);
  }

  clearSlideshowTimer() {
    if (this.slideshow.interval) {
      clearInterval(this.slideshow.interval);
      this.slideshow.interval = null;
    }
  }

  nextSlide() {
    this.slideshow.currentIndex =
      (this.slideshow.currentIndex + 1) % this.slideshow.allMedia.length;
    this.updateSlideshowContent();
  }

  pauseSlideshow() {
    const pauseBtn = document.getElementById("slideshow-pause");

    if (this.slideshow.interval) {
      this.clearSlideshowTimer();
      pauseBtn.textContent = "▶️";
    } else {
      this.startSlideshowTimer();
      pauseBtn.textContent = "⏸️";
    }
  }

  stopSlideshow() {
    this.slideshow.active = false;
    this.clearSlideshowTimer();

    const slideshowOverlay = document.getElementById("slideshowOverlay");
    slideshowOverlay.style.display = "none";

    // Pause any playing video
    const slideshowVideo = document.getElementById("slideshow-video");
    slideshowVideo.pause();
  }

  // Métodos de comentarios
  async loadCommentForDate(date) {
    // Verificar cache primero
    if (this.comments.cache.has(date)) {
      return this.comments.cache.get(date);
    }

    try {
      const response = await fetch(`/api/comments/${date}`);
      if (response.ok) {
        const data = await response.json();
        const comment = data.success ? data.data?.comment || "" : "";
        this.comments.cache.set(date, comment);
        return comment;
      }
    } catch (error) {
      console.log(`No hay comentario para ${date}`);
    }

    this.comments.cache.set(date, "");
    return "";
  }

  async saveComment(date, comment) {
    try {
      const response = await fetch(`/api/comments/${date}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: comment.trim() }),
      });

      if (response.ok) {
        this.comments.cache.set(date, comment.trim());
        this.updateCommentIndicator(date, comment.trim());
        return true;
      }
    } catch (error) {
      console.error("Error guardando comentario:", error);
    }
    return false;
  }

  async deleteComment(date) {
    try {
      const response = await fetch(`/api/comments/${date}`, {
        method: "DELETE",
      });

      if (response.ok) {
        this.comments.cache.set(date, "");
        this.updateCommentIndicator(date, "");
        return true;
      }
    } catch (error) {
      console.error("Error eliminando comentario:", error);
    }
    return false;
  }

  showCommentModal(date) {
    this.comments.currentDate = date;
    this.comments.isEditing = true;

    // Crear modal si no existe
    let modal = document.getElementById("comment-modal");
    if (!modal) {
      modal = this.createCommentModal();
      document.body.appendChild(modal);
    }

    // Cargar comentario existente
    this.loadCommentForDate(date).then((comment) => {
      const textarea = document.getElementById("comment-textarea");
      const dateElement = document.getElementById("comment-date");

      textarea.value = comment;
      dateElement.textContent = this.formatDateSpanish(date);

      modal.style.display = "flex";
      textarea.focus();
    });
  }

  hideCommentModal() {
    const modal = document.getElementById("comment-modal");
    if (modal) {
      modal.style.display = "none";
    }

    this.comments.currentDate = null;
    this.comments.isEditing = false;
    this.clearAutoSaveTimeout();
  }

  createCommentModal() {
    const modal = document.createElement("div");
    modal.id = "comment-modal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>💬 Comentario del día</h3>
        <button id="cancel-comment-btn" class="modal-close">×</button>
      </div>
      <div class="modal-content">
        <p><strong id="comment-date"></strong></p>
        <textarea id="comment-textarea" placeholder="Escribe tu comentario sobre este día..."
                  rows="4" maxlength="5000"></textarea>
        <div class="comment-actions">
          <div class="comment-status" id="comment-status"></div>
          <div class="comment-buttons">
            <button id="delete-comment-btn" class="btn btn-error">🗑️ Eliminar</button>
            <button id="cancel-comment-btn" class="btn btn-secondary">Cancelar</button>
            <button id="save-comment-btn" class="btn btn-primary">💾 Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `;
    return modal;
  }

  async saveCurrentComment() {
    if (!this.comments.currentDate) return;

    const textarea = document.getElementById("comment-textarea");
    const status = document.getElementById("comment-status");
    const comment = textarea.value.trim();

    status.textContent = "💾 Guardando...";
    status.className = "comment-status saving";

    const success = await this.saveComment(this.comments.currentDate, comment);

    if (success) {
      status.textContent = "✅ Guardado";
      status.className = "comment-status saved";
      setTimeout(() => {
        this.hideCommentModal();
      }, 1000);
    } else {
      status.textContent = "❌ Error al guardar";
      status.className = "comment-status error";
    }
  }

  async deleteCurrentComment() {
    if (!this.comments.currentDate) return;

    if (!confirm("¿Estás seguro de que quieres eliminar este comentario?")) {
      return;
    }

    const status = document.getElementById("comment-status");
    status.textContent = "🗑️ Eliminando...";
    status.className = "comment-status deleting";

    const success = await this.deleteComment(this.comments.currentDate);

    if (success) {
      status.textContent = "✅ Eliminado";
      status.className = "comment-status deleted";
      setTimeout(() => {
        this.hideCommentModal();
      }, 1000);
    } else {
      status.textContent = "❌ Error al eliminar";
      status.className = "comment-status error";
    }
  }

  scheduleAutoSave() {
    this.clearAutoSaveTimeout();

    this.comments.autoSaveTimeout = setTimeout(() => {
      if (this.comments.currentDate && this.comments.isEditing) {
        const textarea = document.getElementById("comment-textarea");
        const status = document.getElementById("comment-status");

        if (textarea && textarea.value.trim()) {
          status.textContent = "💾 Guardando automáticamente...";
          status.className = "comment-status auto-saving";

          this.saveComment(
            this.comments.currentDate,
            textarea.value.trim()
          ).then((success) => {
            if (success) {
              status.textContent = "✅ Guardado automáticamente";
              status.className = "comment-status auto-saved";
            }
          });
        }
      }
    }, 2000); // Auto-guardar después de 2 segundos de inactividad
  }

  clearAutoSaveTimeout() {
    if (this.comments.autoSaveTimeout) {
      clearTimeout(this.comments.autoSaveTimeout);
      this.comments.autoSaveTimeout = null;
    }
  }

  updateCommentIndicator(date, comment) {
    // Buscar todos los iconos de comentario para esta fecha
    const commentIcons = document.querySelectorAll(
      `.comment-icon[data-date="${date}"]`
    );

    commentIcons.forEach((icon) => {
      const indicator = icon.querySelector(".comment-indicator");
      if (comment && comment.trim()) {
        // Hay comentario - mostrar indicador
        indicator.style.display = "inline";
        icon.title = "Ver/editar comentario";
        icon.classList.add("has-comment");
      } else {
        // No hay comentario - ocultar indicador
        indicator.style.display = "none";
        icon.title = "Agregar comentario";
        icon.classList.remove("has-comment");
      }
    });
  }

  async loadCommentsForDisplayedDates(dates) {
    // Cargar comentarios para todas las fechas de forma asíncrona
    const commentPromises = dates.map((date) => this.loadCommentForDate(date));

    try {
      const comments = await Promise.all(commentPromises);

      // Actualizar indicadores para cada fecha
      dates.forEach((date, index) => {
        const comment = comments[index] || "";
        this.updateCommentIndicator(date, comment);
      });

      console.log(`Comentarios cargados para ${dates.length} fechas`);
    } catch (error) {
      console.error("Error cargando comentarios:", error);
    }
  }

  updateCharacterCount() {
    const textarea = document.getElementById("comment-textarea");
    const counter = document.getElementById("comment-char-count");

    if (!textarea || !counter) return;

    const currentLength = textarea.value.length;
    const maxLength = 5000;

    counter.textContent = currentLength;

    // Cambiar color según proximidad al límite
    if (currentLength > 4500) {
      counter.style.color = "var(--accent-error)";
    } else if (currentLength > 4000) {
      counter.style.color = "var(--accent-warning)";
    } else {
      counter.style.color = "var(--text-muted)";
    }
  }

  showCommentStatus(message, type) {
    const statusElement = document.getElementById("comment-status");
    const statusIcon = statusElement.querySelector(".status-icon");
    const statusText = statusElement.querySelector(".status-text");

    if (!statusElement || !statusIcon || !statusText) return;

    // Actualizar icono según tipo
    switch (type) {
      case "saving":
        statusIcon.textContent = "⏳";
        break;
      case "saved":
        statusIcon.textContent = "✅";
        break;
      case "error":
        statusIcon.textContent = "❌";
        break;
      default:
        statusIcon.textContent = "💾";
    }

    // Actualizar texto y mostrar
    statusText.textContent = message;
    statusElement.style.display = "flex";

    // Auto-ocultar después de 3 segundos para 'saved'
    if (type === "saved") {
      setTimeout(() => {
        statusElement.style.display = "none";
      }, 3000);
    }
  }

  // Utility functions
  updateStats() {
    this.totalPhotos = Object.values(this.loadedPhotos).reduce(
      (sum, photos) => sum + photos.length,
      0
    );
    const daysWithPhotos = Object.keys(this.loadedPhotos).length;

    // Calculate this week's photos
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    let thisWeekPhotos = 0;
    for (const [date, photos] of Object.entries(this.loadedPhotos)) {
      const photoDate = new Date(date);
      if (photoDate >= weekStart) {
        thisWeekPhotos += photos.length;
      }
    }

    // Update DOM
    document.getElementById("total-photos").textContent = this.totalPhotos;
    document.getElementById("days-active").textContent = daysWithPhotos;
    document.getElementById("this-week").textContent = thisWeekPhotos;
  }

  showLoading(show) {
    const loading = document.getElementById("loading");
    loading.style.display = show ? "block" : "none";
  }

  showError(message) {
    const container = document.getElementById("feedContainer");
    container.innerHTML = `
            <div class="no-photos">
                <div class="no-photos-icon">❌</div>
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;
  }

  showRefreshIndicator(show) {
    const indicator = document.getElementById("loadMoreIndicator");
    if (show) {
      indicator.innerHTML = `
                <div class="indicator-content">
                    <span class="indicator-icon">🔄</span>
                    <span>Buscando nuevas fotos...</span>
                </div>
            `;
      indicator.style.display = "block";
    } else {
      indicator.style.display = "none";
    }
  }

  showNewPhotosNotification(count) {
    const indicator = document.getElementById("loadMoreIndicator");
    indicator.innerHTML = `
            <div class="indicator-content">
                <span class="indicator-icon">✨</span>
                <span>¡${count} fotos nuevas añadidas!</span>
            </div>
        `;
    indicator.style.display = "block";
    indicator.style.background = "var(--accent-success)";
    indicator.style.color = "white";

    setTimeout(() => {
      indicator.style.display = "none";
      indicator.style.background = "";
      indicator.style.color = "";
    }, 3000);
  }

  arraysEqual(a, b) {
    return a.length === b.length && a.every((val, index) => val === b[index]);
  }

  formatDate(date) {
    return date.toISOString().split("T")[0];
  }

  formatDateSpanish(dateStr) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  extractTimestamp(filename) {
    const match = filename.match(/(\d{2})-(\d{2})-(\d{2})/);
    if (match) {
      const [, hours, minutes, seconds] = match;
      return `${hours}:${minutes}:${seconds}`;
    }
    return filename;
  }

  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }
}

// Global functions for onclick handlers
function scrollToTop() {
  photoFeed.scrollToTop();
}

function previousMedia() {
  photoFeed.previousMedia();
}

function nextMedia() {
  photoFeed.nextMedia();
}

function downloadMedia() {
  photoFeed.downloadMedia();
}

function closeLightbox() {
  photoFeed.closeLightbox();
}

function pauseSlideshow() {
  photoFeed.pauseSlideshow();
}

function stopSlideshow() {
  photoFeed.stopSlideshow();
}

// Initialize the feed when the page loads
const photoFeed = new PhotoFeed();
