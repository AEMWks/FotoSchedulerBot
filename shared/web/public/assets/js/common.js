// web/public/assets/js/common.js - Funcionalidades compartidas

/**
 * Clase principal para funcionalidades comunes del Diario Visual
 */
class PhotoDiaryCommon {
  constructor() {
    this.API_BASE = "/api";
    this.PHOTOS_BASE = "/photos";

    // Estado global
    this.state = {
      theme: "light",
      isLoading: false,
      currentUser: null,
      settings: this.loadSettings(),
    };

    // Cache para optimizar requests
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos

    this.init();
  }

  /**
   * Inicialización
   */
  init() {
    this.setupTheme();
    this.setupEventListeners();
    this.setupErrorHandling();
    this.checkApiHealth();
  }

  /**
   * ==========================================
   * GESTIÓN DE TEMA
   * ==========================================
   */
  setupTheme() {
    const savedTheme = localStorage.getItem("photo-diary-theme") || "light";
    this.setTheme(savedTheme);
  }

  setTheme(theme) {
    this.state.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("photo-diary-theme", theme);
    this.updateThemeIcon(theme);

    // Emitir evento para que otros componentes puedan reaccionar
    this.emit("themeChanged", { theme });
  }

  toggleTheme() {
    const newTheme = this.state.theme === "dark" ? "light" : "dark";
    this.setTheme(newTheme);
  }

  updateThemeIcon(theme) {
    const themeIcon = document.querySelector(".theme-icon");
    if (themeIcon) {
      themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
    }
  }

  /**
   * ==========================================
   * EVENT LISTENERS GLOBALES
   * ==========================================
   */
  setupEventListeners() {
    // Theme toggle
    document.addEventListener("click", (e) => {
      if (e.target.closest("#theme-toggle")) {
        this.toggleTheme();
      }
    });

    // Keyboard shortcuts globales
    document.addEventListener("keydown", (e) => {
      // Ctrl/Cmd + K para búsqueda rápida
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        this.focusSearch();
      }

      // Escape para cerrar modales
      if (e.key === "Escape") {
        this.closeAllModals();
      }

      // F5 para refresh con feedback
      if (e.key === "F5") {
        e.preventDefault();
        this.refreshPage();
      }
    });

    // Online/offline detection
    window.addEventListener("online", () => {
      this.showNotification("📶 Conexión restaurada", "success");
      this.emit("connectionRestored");
    });

    window.addEventListener("offline", () => {
      this.showNotification("📶 Sin conexión a internet", "warning");
      this.emit("connectionLost");
    });

    // Visibility change para pausar/reanudar actualizaciones
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.emit("pageHidden");
      } else {
        this.emit("pageVisible");
      }
    });
  }

  /**
   * ==========================================
   * GESTIÓN DE ERRORES
   * ==========================================
   */
  setupErrorHandling() {
    window.addEventListener("error", (e) => {
      console.error("Error global:", e.error);
      this.logError("JavaScript Error", e.error);
    });

    window.addEventListener("unhandledrejection", (e) => {
      console.error("Promise rechazada:", e.reason);
      this.logError("Unhandled Promise Rejection", e.reason);
    });
  }

  logError(type, error) {
    const errorData = {
      type,
      message: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // En producción, esto se enviaría a un servicio de logging
    console.group("🚨 Error Logged");
    console.error(errorData);
    console.groupEnd();
  }

  /**
   * ==========================================
   * API UTILITIES
   * ==========================================
   */
  async checkApiHealth() {
    try {
      const response = await fetch(`${this.API_BASE}/dates?limit=1`);
      if (response.ok) {
        this.emit("apiHealthy");
      } else {
        throw new Error(`API responded with ${response.status}`);
      }
    } catch (error) {
      console.warn("API health check failed:", error);
      this.emit("apiUnhealthy", { error });
    }
  }

  async apiRequest(endpoint, options = {}) {
    const cacheKey = `${endpoint}:${JSON.stringify(options)}`;

    // Check cache first
    if (options.cache !== false && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const url = endpoint.startsWith("http")
        ? endpoint
        : `${this.API_BASE}/${endpoint.replace(/^\//, "")}`;

      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache successful responses
      if (options.cache !== false) {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });
      }

      return data;
    } catch (error) {
      this.logError("API Request Failed", error);
      throw error;
    }
  }

  clearCache() {
    this.cache.clear();
    this.emit("cacheCleared");
  }

  /**
   * ==========================================
   * UI UTILITIES
   * ==========================================
   */
  showNotification(message, type = "info", duration = 4000) {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;

    const icons = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
    };

    notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icons[type]}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 0.75rem;
            padding: 1rem;
            box-shadow: var(--shadow-lg);
            max-width: 400px;
            animation: slideInRight 0.3s ease;
        `;

    document.body.appendChild(notification);

    // Auto remove
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = "slideOutRight 0.3s ease";
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);

    return notification;
  }

  showLoading(show = true, message = "Cargando...") {
    let loader = document.getElementById("global-loader");

    if (show) {
      if (!loader) {
        loader = document.createElement("div");
        loader.id = "global-loader";
        loader.className = "global-loader";
        loader.innerHTML = `
                    <div class="loader-backdrop"></div>
                    <div class="loader-content">
                        <div class="spinner"></div>
                        <span class="loader-message">${message}</span>
                    </div>
                `;

        loader.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;

        document.body.appendChild(loader);
      } else {
        loader.style.display = "flex";
        loader.querySelector(".loader-message").textContent = message;
      }

      this.state.isLoading = true;
    } else {
      if (loader) {
        loader.style.display = "none";
      }
      this.state.isLoading = false;
    }
  }

  focusSearch() {
    const searchInput = document.querySelector(
      '#search-input, .search-input, [type="search"]'
    );
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  closeAllModals() {
    const modals = document.querySelectorAll(
      ".modal-overlay, .lightbox, .slideshow-overlay"
    );
    modals.forEach((modal) => {
      if (modal.style.display !== "none") {
        modal.style.display = "none";
      }
    });
    this.emit("modalsClosd");
  }

  refreshPage() {
    this.showLoading(true, "Actualizando página...");
    this.clearCache();

    setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  /**
   * ==========================================
   * UTILITY FUNCTIONS
   * ==========================================
   */
  formatDate(dateStr, options = {}) {
    const date = new Date(dateStr);
    const defaultOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };

    return new Intl.DateTimeFormat("es-ES", {
      ...defaultOptions,
      ...options,
    }).format(date);
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(1);

    return `${minutes}m ${remainingSeconds}s`;
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  throttle(func, limit) {
    let inThrottle;
    return function () {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * ==========================================
   * SETTINGS MANAGEMENT
   * ==========================================
   */
  loadSettings() {
    try {
      const settings = localStorage.getItem("photo-diary-settings");
      return settings ? JSON.parse(settings) : this.getDefaultSettings();
    } catch (error) {
      console.warn("Error loading settings:", error);
      return this.getDefaultSettings();
    }
  }

  saveSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    localStorage.setItem(
      "photo-diary-settings",
      JSON.stringify(this.state.settings)
    );
    this.emit("settingsChanged", { settings: this.state.settings });
  }

  getDefaultSettings() {
    return {
      theme: "light",
      autoRefresh: true,
      refreshInterval: 30000, // 30 segundos
      slideshowDuration: 4000, // 4 segundos
      showNotifications: true,
      cacheEnabled: true,
      compressionLevel: "medium",
    };
  }

  /**
   * ==========================================
   * EVENT SYSTEM
   * ==========================================
   */
  emit(eventName, data = {}) {
    const event = new CustomEvent(`photoDiary:${eventName}`, {
      detail: data,
    });
    document.dispatchEvent(event);
  }

  on(eventName, callback) {
    document.addEventListener(`photoDiary:${eventName}`, callback);
  }

  off(eventName, callback) {
    document.removeEventListener(`photoDiary:${eventName}`, callback);
  }

  /**
   * ==========================================
   * PERFORMANCE MONITORING
   * ==========================================
   */
  measurePerformance(name, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();

    console.log(`⚡ ${name}: ${(end - start).toFixed(2)}ms`);

    return result;
  }

  logPageLoad() {
    window.addEventListener("load", () => {
      const navigation = performance.getEntriesByType("navigation")[0];
      console.group("📊 Page Performance");
      console.log(
        `DOM Content Loaded: ${
          navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart
        }ms`
      );
      console.log(
        `Page Load: ${navigation.loadEventEnd - navigation.loadEventStart}ms`
      );
      console.log(
        `Total Load Time: ${navigation.loadEventEnd - navigation.fetchStart}ms`
      );
      console.groupEnd();
    });
  }
}

// Inicializar funcionalidades comunes
const photoDiaryCommon = new PhotoDiaryCommon();

// Exportar para uso global
window.photoDiaryCommon = photoDiaryCommon;

// CSS adicional para notificaciones y loader
const additionalStyles = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }

    .notification {
        animation: slideInRight 0.3s ease;
    }

    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .notification-close {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 1.25rem;
        padding: 0.25rem;
        border-radius: 0.25rem;
        transition: all 0.2s ease;
    }

    .notification-close:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }

    .notification-info { border-left: 4px solid var(--accent-primary); }
    .notification-success { border-left: 4px solid var(--accent-success); }
    .notification-warning { border-left: 4px solid var(--accent-warning); }
    .notification-error { border-left: 4px solid var(--accent-error); }

    .global-loader .loader-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--bg-overlay);
        backdrop-filter: blur(2px);
    }

    .global-loader .loader-content {
        position: relative;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 1rem;
        padding: 2rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        box-shadow: var(--shadow-xl);
    }

    .global-loader .loader-message {
        color: var(--text-secondary);
        font-weight: 500;
    }
`;

// Agregar estilos al documento
const styleSheet = document.createElement("style");
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Log de carga exitosa
photoDiaryCommon.logPageLoad();
console.log("🚀 PhotoDiary Common loaded successfully");
