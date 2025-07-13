// Actualizaciones para dashboard.js
class PhotoDashboard {
  constructor() {
    this.API_BASE = "/api/routes";
    // ... resto del constructor
  }

  // Actualizar método para usar la nueva API de fechas
  async loadAvailableDates() {
    try {
      const response = await fetch(
        `${this.API_BASE}/dates?format=simple&limit=365`
      );
      const data = await response.json();

      if (data.success) {
        this.allPhotoDates = data.dates
          ? data.dates.map((d) => d.date || d)
          : [];
      } else {
        this.allPhotoDates = data.dates || []; // Fallback para formato anterior
      }

      console.log("Fechas disponibles:", this.allPhotoDates.length);
    } catch (error) {
      console.error("Error cargando fechas:", error);
    }
  }

  // Actualizar método para usar la nueva API de búsqueda
  async performAdvancedSearch() {
    const searchTerm = document
      .getElementById("search-input")
      .value.toLowerCase()
      .trim();
    const typeFilter = document.getElementById("type-filter").value;
    const dateRange = document.getElementById("date-range").value;

    let searchParams = new URLSearchParams();

    if (searchTerm) {
      searchParams.append("query", searchTerm);
    }

    if (typeFilter !== "all") {
      searchParams.append("type", typeFilter);
    }

    // Manejar rangos de fecha
    if (dateRange === "custom") {
      const startDate = document.getElementById("start-date").value;
      const endDate = document.getElementById("end-date").value;
      if (startDate && endDate) {
        searchParams.append("start_date", startDate);
        searchParams.append("end_date", endDate);
      }
    } else if (dateRange !== "all") {
      const today = new Date();
      let startDate;

      switch (dateRange) {
        case "today":
          startDate = today.toISOString().split("T")[0];
          searchParams.append("date", startDate);
          break;
        case "week":
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 7);
          searchParams.append(
            "start_date",
            startDate.toISOString().split("T")[0]
          );
          searchParams.append("end_date", today.toISOString().split("T")[0]);
          break;
        case "month":
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          searchParams.append(
            "start_date",
            startDate.toISOString().split("T")[0]
          );
          searchParams.append("end_date", today.toISOString().split("T")[0]);
          break;
      }
    }

    try {
      const response = await fetch(
        `${this.API_BASE}/search?${searchParams.toString()}`
      );
      const data = await response.json();

      if (data.success) {
        this.displaySearchResults(data.data.results, data.data.summary);
      } else {
        this.displaySearchResults([], { total_found: 0 });
      }
    } catch (error) {
      console.error("Error en búsqueda:", error);
      this.showError("Error realizando búsqueda");
    }
  }

  // Nuevo método para usar la API de exportación
  async exportContent(type, options = {}) {
    let exportParams = new URLSearchParams();
    exportParams.append("type", type);
    exportParams.append("format", options.format || "zip");

    // Agregar parámetros específicos según el tipo
    switch (type) {
      case "day":
        if (!options.date) {
          alert("Fecha requerida para exportación diaria");
          return;
        }
        exportParams.append("date", options.date);
        break;

      case "week":
        exportParams.append(
          "date",
          options.date || this.formatDate(new Date())
        );
        break;

      case "month":
        exportParams.append(
          "month",
          options.month || this.formatMonth(new Date())
        );
        break;

      case "range":
        if (!options.startDate || !options.endDate) {
          alert("Fechas de inicio y fin requeridas");
          return;
        }
        exportParams.append("start_date", options.startDate);
        exportParams.append("end_date", options.endDate);
        break;
    }

    try {
      // Mostrar indicador de carga
      this.showExportProgress(true);

      const response = await fetch(
        `${this.API_BASE}/export?${exportParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Si es JSON, manejar como datos
      if (options.format === "json") {
        const data = await response.json();
        this.downloadJSON(data, `export_${type}_${Date.now()}.json`);
      } else {
        // Si es ZIP, manejar como blob
        const blob = await response.blob();
        this.downloadBlob(blob, `export_${type}_${Date.now()}.zip`);
      }

      this.showExportSuccess();
    } catch (error) {
      console.error("Error exportando:", error);
      alert(`Error en exportación: ${error.message}`);
    } finally {
      this.showExportProgress(false);
    }
  }

  // Nuevo método para obtener recuerdo aleatorio
  async getRandomMemory(count = 1, excludeRecentDays = 0) {
    try {
      let params = new URLSearchParams();
      params.append("count", count.toString());
      params.append("format", "detailed");

      if (excludeRecentDays > 0) {
        params.append("exclude_recent", excludeRecentDays.toString());
      }

      const response = await fetch(
        `${this.API_BASE}/random?${params.toString()}`
      );
      const data = await response.json();

      if (data.success && data.data.random_files.length > 0) {
        return data.data.random_files[0]; // Devolver el primero
      } else {
        throw new Error("No se encontraron recuerdos aleatorios");
      }
    } catch (error) {
      console.error("Error obteniendo recuerdo aleatorio:", error);
      throw error;
    }
  }

  // Actualizar método de calendario para usar nueva API
  async loadCalendarData(year, month) {
    try {
      const response = await fetch(
        `${this.API_BASE}/calendar/${year}/${month}`
      );
      const data = await response.json();

      if (data.success) {
        this.displayCalendar(data.data);
        this.updateCalendarStats(data.data.statistics);
      } else {
        throw new Error(data.message || "Error cargando calendario");
      }
    } catch (error) {
      console.error("Error cargando calendario:", error);
      this.showError("Error cargando datos del calendario");
    }
  }

  // Métodos auxiliares para descargas
  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    this.downloadBlob(blob, filename);
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  showExportProgress(show) {
    const indicator = document.getElementById("export-progress");
    if (indicator) {
      indicator.style.display = show ? "block" : "none";
    }
  }

  showExportSuccess() {
    // Mostrar notificación de éxito
    const notification = document.createElement("div");
    notification.className = "export-success-notification";
    notification.textContent = "✅ Exportación completada";
    notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 1000;
            background: var(--accent-success); color: white;
            padding: 1rem 2rem; border-radius: 0.5rem;
            box-shadow: var(--shadow-lg);
        `;

    document.body.appendChild(notification);

    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }

  formatMonth(date) {
    return (
      date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0")
    );
  }
}

// Actualizaciones para feed.js
class PhotoFeed {
  constructor() {
    this.API_BASE = "/api";
    // ... resto del constructor
  }

  // Actualizar para usar la nueva API de feed
  async loadFeedPage(page = 1, limit = 10) {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading(true);

    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      params.append("sort", "desc");
      params.append("include_activity", "true");

      const response = await fetch(
        `${this.API_BASE}/feed?${params.toString()}`
      );
      const data = await response.json();

      if (data.success) {
        if (page === 1) {
          this.feedEntries = data.data.feed;
        } else {
          this.feedEntries = [...this.feedEntries, ...data.data.feed];
        }

        this.paginationInfo = data.data.pagination;
        this.displayFeed(this.feedEntries);
        this.updateStats(data.data.recent_activity);

        console.log(
          `Página ${page} cargada: ${data.data.feed.length} entradas`
        );
      } else {
        throw new Error(data.message || "Error cargando feed");
      }
    } catch (error) {
      console.error("Error cargando feed:", error);
      this.showError("Error al cargar el feed");
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  // Método para cargar más contenido (scroll infinito)
  async loadMoreContent() {
    if (this.paginationInfo && this.paginationInfo.has_next) {
      await this.loadFeedPage(this.paginationInfo.current_page + 1);
    }
  }

  // Configurar scroll infinito
  setupInfiniteScroll() {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const checkScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Si está cerca del final de la página
      if (scrollY + windowHeight >= documentHeight - 1000) {
        this.loadMoreContent();
      }

      lastScrollY = scrollY;
      ticking = false;
    };

    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(checkScroll);
        ticking = true;
      }
    });
  }

  // Actualizar método de refresh para usar nueva API
  async refreshFeed() {
    try {
      // Obtener actividad reciente para verificar cambios
      const response = await fetch(
        `${this.API_BASE}/feed?page=1&limit=5&include_activity=true&activity_days=1`
      );
      const data = await response.json();

      if (data.success) {
        const newEntries = data.data.feed;
        const hasNewContent = this.hasNewContent(newEntries);

        if (hasNewContent) {
          await this.loadFeedPage(1); // Recargar primera página
          this.showNewContentNotification();
        }
      }
    } catch (error) {
      console.error("Error refrescando feed:", error);
    }
  }

  hasNewContent(newEntries) {
    if (!this.feedEntries || this.feedEntries.length === 0) {
      return newEntries.length > 0;
    }

    const latestExisting = this.feedEntries[0];
    const latestNew = newEntries[0];

    return (
      latestNew &&
      (latestNew.date !== latestExisting.date ||
        latestNew.summary.total_files !== latestExisting.summary.total_files)
    );
  }

  showNewContentNotification() {
    const notification = document.createElement("div");
    notification.className = "new-content-notification";
    notification.innerHTML = `
            <span class="notification-icon">✨</span>
            <span>¡Nuevo contenido disponible!</span>
        `;
    notification.style.cssText = `
            position: fixed; top: 80px; right: 20px; z-index: 1000;
            background: var(--accent-primary); color: white;
            padding: 1rem 2rem; border-radius: 0.5rem;
            box-shadow: var(--shadow-lg); animation: slideIn 0.3s ease;
        `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }
}

// Funciones globales actualizadas
window.dashboardAPI = {
  exportDay: (date) => dashboard.exportContent("day", { date }),
  exportWeek: () =>
    dashboard.exportContent("week", { date: dashboard.formatDate(new Date()) }),
  exportMonth: () =>
    dashboard.exportContent("month", {
      month: dashboard.formatMonth(new Date()),
    }),
  exportAll: () => dashboard.exportContent("all"),
  getRandomMemory: () => dashboard.getRandomMemory(),
  searchContent: () => dashboard.performAdvancedSearch(),
};

// Inicialización mejorada
document.addEventListener("DOMContentLoaded", () => {
  // Verificar disponibilidad de APIs
  checkAPIHealth();

  // Inicializar componentes
  if (window.location.pathname.includes("dashboard")) {
    window.dashboard = new PhotoDashboard();
  } else {
    window.photoFeed = new PhotoFeed();
    photoFeed.setupInfiniteScroll();
  }
});

async function checkAPIHealth() {
  try {
    const response = await fetch("/api/dates?limit=1");
    if (!response.ok) {
      console.warn("APIs podrían no estar disponibles completamente");
    }
  } catch (error) {
    console.warn("APIs no disponibles, usando modo fallback");
  }
}
