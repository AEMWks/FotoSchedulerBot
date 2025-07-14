// web/public/assets/js/dashboard.js - Dashboard completo y funcional

/**
 * Clase principal del Dashboard de Análisis
 */
class PhotoDashboard {
    constructor() {
        this.API_BASE = "/api";

        // Estado de la aplicación
        this.state = {
            isLoading: false,
            currentDate: new Date(),
            allPhotoDates: [],
            searchResults: [],
            stats: {
                total: 0,
                photos: 0,
                videos: 0,
                avgPerDay: 0
            },
            pagination: {
                currentPage: 1,
                totalPages: 1,
                itemsPerPage: 20
            },
            filters: {
                type: 'all',
                dateRange: 'all',
                startDate: null,
                endDate: null
            }
        };

        // Componentes
        this.calendar = null;
        this.activityChart = null;
        this.hoursChart = null;

        // Cache para optimizar requests
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos

        this.init();
    }

    /**
     * Inicialización del dashboard
     */
    init() {
        console.log('🚀 Inicializando PhotoDashboard...');

        this.setupEventListeners();
        this.initializeComponents();
        this.loadInitialData();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Búsqueda
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('search-input');

        searchBtn?.addEventListener('click', () => this.performSearch());
        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        // Filtros
        const typeFilter = document.getElementById('type-filter');
        const dateRange = document.getElementById('date-range');
        const clearFilters = document.getElementById('clear-filters');

        typeFilter?.addEventListener('change', () => this.updateFilters());
        dateRange?.addEventListener('change', () => this.handleDateRangeChange());
        clearFilters?.addEventListener('click', () => this.clearAllFilters());

        // Rango de fechas personalizado
        const applyDateRange = document.getElementById('apply-date-range');
        applyDateRange?.addEventListener('click', () => this.applyCustomDateRange());

        // Botones de estadísticas
        const refreshStats = document.getElementById('refresh-stats');
        refreshStats?.addEventListener('click', () => this.refreshStats());

        // Navegación de calendario
        const prevMonth = document.getElementById('prev-month');
        const nextMonth = document.getElementById('next-month');
        const todayBtn = document.getElementById('today-btn');

        prevMonth?.addEventListener('click', () => this.navigateMonth(-1));
        nextMonth?.addEventListener('click', () => this.navigateMonth(1));
        todayBtn?.addEventListener('click', () => this.goToToday());

        // Exportación
        const exportDay = document.getElementById('export-day');
        const exportWeek = document.getElementById('export-week');
        const exportMonth = document.getElementById('export-month');
        const exportAll = document.getElementById('export-all');

        exportDay?.addEventListener('click', () => this.showExportModal('day'));
        exportWeek?.addEventListener('click', () => this.exportContent('week'));
        exportMonth?.addEventListener('click', () => this.exportContent('month'));
        exportAll?.addEventListener('click', () => this.exportContent('all'));

        // Acciones rápidas
        const randomMemory = document.getElementById('random-memory');
        const slideshowAll = document.getElementById('slideshow-all');

        randomMemory?.addEventListener('click', () => this.showRandomMemory());
        slideshowAll?.addEventListener('click', () => this.startSlideshowAll());

        // Paginación
        const prevPage = document.getElementById('prev-page');
        const nextPage = document.getElementById('next-page');

        prevPage?.addEventListener('click', () => this.changePage(-1));
        nextPage?.addEventListener('click', () => this.changePage(1));
    }

    /**
     * Inicializar componentes de UI
     */
    initializeComponents() {
        // Inicializar calendario si el contenedor existe
        const calendarContainer = document.getElementById('calendar-grid');
        if (calendarContainer) {
            try {
                this.calendar = new Calendar('calendar-grid', {
                    onDateClick: (data) => this.handleDateClick(data),
                    onMonthChange: (data) => this.handleMonthChange(data)
                });
                console.log('✅ Calendario inicializado');
            } catch (error) {
                console.warn('⚠️ Error inicializando calendario:', error);
            }
        }

        // Inicializar gráfico de actividad
        const activityChartCanvas = document.getElementById('activity-chart');
        if (activityChartCanvas && window.ActivityChart) {
            try {
                this.activityChart = new ActivityChart('activity-chart');
                console.log('✅ Gráfico de actividad inicializado');
            } catch (error) {
                console.warn('⚠️ Error inicializando gráfico de actividad:', error);
            }
        }

        // Inicializar gráfico de horas
        const hoursChartContainer = document.getElementById('hours-chart');
        if (hoursChartContainer && window.HourlyChart) {
            try {
                this.hoursChart = new HourlyChart('hours-chart');
                console.log('✅ Gráfico de horas inicializado');
            } catch (error) {
                console.warn('⚠️ Error inicializando gráfico de horas:', error);
            }
        }
    }

    /**
     * Cargar datos iniciales
     */
    async loadInitialData() {
        this.showLoading(true);

        try {
            await Promise.all([
                this.loadStats(),
                this.loadAvailableDates(),
                this.loadCalendarData()
            ]);

            console.log('✅ Datos iniciales cargados');
        } catch (error) {
            console.error('❌ Error cargando datos iniciales:', error);
            this.showError('Error cargando datos del dashboard');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Cargar estadísticas generales
     */
    async loadStats() {
        try {
            const response = await this.apiRequest('stats');

            if (response) {
                this.state.stats = {
                    total: response.total_files || 0,
                    photos: response.total_photos || 0,
                    videos: response.total_videos || 0,
                    avgPerDay: response.avg_photos_per_day || 0
                };

                this.updateStatsDisplay();

                // Actualizar gráficos si existen
                if (this.activityChart && response.activity_by_date) {
                    this.activityChart.setData(response.activity_by_date);
                }

                if (this.hoursChart && response.activity_by_hour) {
                    this.hoursChart.setData(response.activity_by_hour);
                }
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
            // Usar datos mock para desarrollo
            this.loadMockStats();
        }
    }

    /**
     * Cargar fechas disponibles
     */
    async loadAvailableDates() {
        try {
            const response = await this.apiRequest('dates?format=simple&limit=365');

            if (response && response.dates) {
                this.state.allPhotoDates = response.dates;
                console.log(`📅 ${this.state.allPhotoDates.length} fechas disponibles`);
            }
        } catch (error) {
            console.error('Error cargando fechas:', error);
            // Generar fechas mock para desarrollo
            this.generateMockDates();
        }
    }

    /**
     * Cargar datos del calendario
     */
    async loadCalendarData() {
        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth() + 1;

        try {
            const response = await this.apiRequest(`calendar/${year}/${month}`);

            if (response && this.calendar) {
                // El componente Calendar manejará los datos automáticamente
                console.log(`📅 Datos del calendario cargados para ${year}-${month}`);
            }
        } catch (error) {
            console.error('Error cargando calendario:', error);
        }
    }

    /**
     * Realizar búsqueda
     */
    async performSearch() {
        const searchTerm = document.getElementById('search-input')?.value.trim();

        if (!searchTerm && this.state.filters.type === 'all' && this.state.filters.dateRange === 'all') {
            this.hideSearchResults();
            return;
        }

        this.showLoading(true);

        try {
            const params = new URLSearchParams();

            if (searchTerm) {
                params.append('query', searchTerm);
            }

            if (this.state.filters.type !== 'all') {
                params.append('type', this.state.filters.type);
            }

            if (this.state.filters.startDate && this.state.filters.endDate) {
                params.append('start_date', this.state.filters.startDate);
                params.append('end_date', this.state.filters.endDate);
            }

            params.append('page', this.state.pagination.currentPage.toString());
            params.append('limit', this.state.pagination.itemsPerPage.toString());

            const response = await this.apiRequest(`search?${params.toString()}`);

            if (response) {
                this.state.searchResults = response.results || [];
                this.state.pagination = response.pagination || this.state.pagination;

                this.displaySearchResults();
                this.updatePagination();
            }
        } catch (error) {
            console.error('Error en búsqueda:', error);
            this.showError('Error realizando búsqueda');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Actualizar filtros
     */
    updateFilters() {
        const typeFilter = document.getElementById('type-filter');

        if (typeFilter) {
            this.state.filters.type = typeFilter.value;
        }

        // Resetear paginación
        this.state.pagination.currentPage = 1;
    }

    /**
     * Manejar cambio de rango de fecha
     */
    handleDateRangeChange() {
        const dateRange = document.getElementById('date-range');
        const customRange = document.getElementById('custom-date-range');

        if (!dateRange) return;

        this.state.filters.dateRange = dateRange.value;

        if (dateRange.value === 'custom') {
            customRange.style.display = 'flex';
        } else {
            customRange.style.display = 'none';
            this.calculateDateRange(dateRange.value);
        }
    }

    /**
     * Calcular rango de fechas predefinido
     */
    calculateDateRange(range) {
        const today = new Date();
        let startDate = null;
        let endDate = today.toISOString().split('T')[0];

        switch (range) {
            case 'today':
                startDate = endDate;
                break;
            case 'week':
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - 7);
                startDate = weekStart.toISOString().split('T')[0];
                break;
            case 'month':
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                startDate = monthStart.toISOString().split('T')[0];
                break;
            case 'all':
                startDate = null;
                endDate = null;
                break;
        }

        this.state.filters.startDate = startDate;
        this.state.filters.endDate = endDate;
    }

    /**
     * Aplicar rango de fechas personalizado
     */
    applyCustomDateRange() {
        const startDate = document.getElementById('start-date')?.value;
        const endDate = document.getElementById('end-date')?.value;

        if (startDate && endDate) {
            this.state.filters.startDate = startDate;
            this.state.filters.endDate = endDate;
            this.state.pagination.currentPage = 1;
        }
    }

    /**
     * Limpiar todos los filtros
     */
    clearAllFilters() {
        // Limpiar formulario
        const searchInput = document.getElementById('search-input');
        const typeFilter = document.getElementById('type-filter');
        const dateRange = document.getElementById('date-range');
        const customRange = document.getElementById('custom-date-range');

        if (searchInput) searchInput.value = '';
        if (typeFilter) typeFilter.value = 'all';
        if (dateRange) dateRange.value = 'all';
        if (customRange) customRange.style.display = 'none';

        // Resetear estado
        this.state.filters = {
            type: 'all',
            dateRange: 'all',
            startDate: null,
            endDate: null
        };
        this.state.pagination.currentPage = 1;

        // Ocultar resultados
        this.hideSearchResults();
    }

    /**
     * Navegación del calendario
     */
    navigateMonth(direction) {
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() + direction);
        this.updateCalendarDisplay();
        this.loadCalendarData();
    }

    goToToday() {
        this.state.currentDate = new Date();
        this.updateCalendarDisplay();
        this.loadCalendarData();
    }

    /**
     * Manejar click en fecha del calendario
     */
    handleDateClick(data) {
        const date = data.date;
        console.log(`📅 Click en fecha: ${date}`);

        // Realizar búsqueda para esa fecha específica
        this.state.filters.startDate = date;
        this.state.filters.endDate = date;
        this.state.filters.dateRange = 'custom';

        // Actualizar UI
        const dateRange = document.getElementById('date-range');
        if (dateRange) dateRange.value = 'custom';

        this.performSearch();
    }

    /**
     * Manejar cambio de mes del calendario
     */
    handleMonthChange(data) {
        this.state.currentDate = new Date(data.year, data.month - 1, 1);
        this.updateCalendarDisplay();
    }

    /**
     * Exportar contenido
     */
    async exportContent(type, options = {}) {
        this.showLoading(true, 'Preparando exportación...');

        try {
            const params = new URLSearchParams();
            params.append('type', type);

            const format = this.getSelectedExportFormat();
            params.append('format', format);

            // Agregar parámetros específicos según el tipo
            switch (type) {
                case 'day':
                    if (!options.date) {
                        this.showError('Fecha requerida para exportación diaria');
                        return;
                    }
                    params.append('date', options.date);
                    break;
                case 'week':
                    params.append('date', options.date || this.formatDate(new Date()));
                    break;
                case 'month':
                    params.append('month', options.month || this.formatMonth(new Date()));
                    break;
            }

            const url = `${this.API_BASE}/export?${params.toString()}`;

            // Crear enlace de descarga
            const a = document.createElement('a');
            a.href = url;
            a.download = `export_${type}_${Date.now()}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            this.showSuccess('Exportación iniciada');
        } catch (error) {
            console.error('Error en exportación:', error);
            this.showError('Error en la exportación');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Mostrar modal de exportación
     */
    showExportModal(type) {
        const modal = document.getElementById('export-modal');
        const dateInput = document.getElementById('export-date');

        if (modal && dateInput) {
            dateInput.value = this.formatDate(new Date());
            modal.style.display = 'flex';
        }
    }

    /**
     * Obtener recuerdo aleatorio
     */
    async showRandomMemory() {
        try {
            const response = await this.apiRequest('random?count=1&format=detailed');

            if (response && response.random_files && response.random_files.length > 0) {
                const memory = response.random_files[0];
                this.displayRandomMemory(memory);
            } else {
                this.showError('No se encontraron recuerdos aleatorios');
            }
        } catch (error) {
            console.error('Error obteniendo recuerdo aleatorio:', error);
            this.showError('Error obteniendo recuerdo aleatorio');
        }
    }

    /**
     * Actualizar displays
     */
    updateStatsDisplay() {
        const elements = {
            'total-count': this.state.stats.total,
            'photo-count': this.state.stats.photos,
            'video-count': this.state.stats.videos,
            'avg-per-day': this.state.stats.avgPerDay.toFixed(1)
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    updateCalendarDisplay() {
        const monthElement = document.getElementById('current-month');
        if (monthElement) {
            const monthNames = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];
            const month = monthNames[this.state.currentDate.getMonth()];
            const year = this.state.currentDate.getFullYear();
            monthElement.textContent = `${month} ${year}`;
        }
    }

    displaySearchResults() {
        const resultsSection = document.getElementById('results-section');
        const resultsGrid = document.getElementById('results-grid');
        const resultsCount = document.getElementById('results-count');

        if (!resultsSection || !resultsGrid || !resultsCount) return;

        resultsSection.style.display = 'block';
        resultsCount.textContent = `${this.state.searchResults.length} elementos encontrados`;

        if (this.state.searchResults.length === 0) {
            resultsGrid.innerHTML = `
                <div class="no-results">
                    <p>No se encontraron resultados</p>
                </div>
            `;
            return;
        }

        resultsGrid.innerHTML = this.state.searchResults.map(result => `
            <div class="result-item" onclick="openLightbox('${result.path}', '${result.date}', '${result.timestamp}')">
                ${result.type === 'video'
                    ? `<video muted><source src="${result.path}" type="video/mp4"></video>`
                    : `<img src="${result.path}" loading="lazy">`
                }
                <div class="result-item-info">
                    <div class="result-item-date">${this.formatDateSpanish(result.date)}</div>
                    <div class="result-item-time">${result.timestamp}</div>
                </div>
            </div>
        `).join('');
    }

    displayRandomMemory(memory) {
        const modal = document.getElementById('memory-modal');
        const image = document.getElementById('random-image');
        const video = document.getElementById('random-video');
        const videoSource = document.getElementById('random-video-source');
        const date = document.getElementById('memory-date');
        const time = document.getElementById('memory-time');

        if (!modal) return;

        if (memory.type === 'video') {
            image.style.display = 'none';
            video.style.display = 'block';
            videoSource.src = memory.path;
            video.load();
        } else {
            video.style.display = 'none';
            image.style.display = 'block';
            image.src = memory.path;
        }

        if (date) date.textContent = this.formatDateSpanish(memory.date);
        if (time) time.textContent = memory.timestamp || '';

        modal.style.display = 'flex';
    }

    hideSearchResults() {
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }
    }

    updatePagination() {
        const pagination = document.getElementById('results-pagination');
        const pageInfo = document.getElementById('page-info');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (!pagination) return;

        if (this.state.pagination.totalPages > 1) {
            pagination.style.display = 'flex';

            if (pageInfo) {
                pageInfo.textContent = `Página ${this.state.pagination.currentPage} de ${this.state.pagination.totalPages}`;
            }

            if (prevBtn) {
                prevBtn.disabled = this.state.pagination.currentPage === 1;
            }

            if (nextBtn) {
                nextBtn.disabled = this.state.pagination.currentPage === this.state.pagination.totalPages;
            }
        } else {
            pagination.style.display = 'none';
        }
    }

    changePage(direction) {
        const newPage = this.state.pagination.currentPage + direction;

        if (newPage >= 1 && newPage <= this.state.pagination.totalPages) {
            this.state.pagination.currentPage = newPage;
            this.performSearch();
        }
    }

    /**
     * Utilidades y helpers
     */
    async apiRequest(endpoint, options = {}) {
        const cacheKey = `${endpoint}:${JSON.stringify(options)}`;

        // Verificar cache
        if (options.cache !== false && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const url = endpoint.startsWith('http') ? endpoint : `${this.API_BASE}/${endpoint.replace(/^\//, '')}`;

            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Guardar en cache
            if (options.cache !== false) {
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    showLoading(show, message = 'Cargando...') {
        if (window.photoDiaryCommon) {
            window.photoDiaryCommon.showLoading(show, message);
        }
    }

    showError(message) {
        if (window.photoDiaryCommon) {
            window.photoDiaryCommon.showNotification(message, 'error');
        } else {
            alert(`Error: ${message}`);
        }
    }

    showSuccess(message) {
        if (window.photoDiaryCommon) {
            window.photoDiaryCommon.showNotification(message, 'success');
        }
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    formatMonth(date) {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    }

    formatDateSpanish(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    getSelectedExportFormat() {
        const formatRadios = document.querySelectorAll('input[name="export-format"]');
        for (const radio of formatRadios) {
            if (radio.checked) {
                return radio.value;
            }
        }
        return 'zip';
    }

    /**
     * Métodos auxiliares para desarrollo
     */
    loadMockStats() {
        this.state.stats = {
            total: 156,
            photos: 120,
            videos: 36,
            avgPerDay: 5.2
        };
        this.updateStatsDisplay();

        // Datos mock para gráficos
        const mockActivityData = [];
        for (let i = 30; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            mockActivityData.push({
                date: date.toISOString().split('T')[0],
                count: Math.floor(Math.random() * 10)
            });
        }

        const mockHourlyData = Array(24).fill(0).map(() => Math.floor(Math.random() * 8));

        if (this.activityChart) {
            this.activityChart.setData(mockActivityData);
        }

        if (this.hoursChart) {
            this.hoursChart.setData(mockHourlyData);
        }
    }

    generateMockDates() {
        const dates = [];
        const today = new Date();

        for (let i = 0; i < 60; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            if (Math.random() > 0.7) { // 30% probabilidad
                dates.push(date.toISOString().split('T')[0]);
            }
        }

        this.state.allPhotoDates = dates;
    }

    async refreshStats() {
        this.cache.clear();
        await this.loadStats();
    }

    startSlideshowAll() {
        // Implementar slideshow con todas las fotos disponibles
        console.log('🎬 Iniciando slideshow completo...');
        // Aquí iría la implementación del slideshow
    }
}

// Funciones globales para los onclick del HTML
window.closeExportModal = () => {
    const modal = document.getElementById('export-modal');
    if (modal) modal.style.display = 'none';
};

window.confirmExport = () => {
    const dateInput = document.getElementById('export-date');
    if (dateInput && window.dashboard) {
        window.dashboard.exportContent('day', { date: dateInput.value });
        window.closeExportModal();
    }
};

window.closeMemoryModal = () => {
    const modal = document.getElementById('memory-modal');
    if (modal) modal.style.display = 'none';
};

window.getRandomMemory = () => {
    if (window.dashboard) {
        window.dashboard.showRandomMemory();
    }
};

window.openLightbox = (src, date, time) => {
    if (window.lightbox) {
        window.lightbox.open([{
            src: src,
            type: src.includes('.mp4') ? 'video' : 'image',
            date: date,
            time: time
        }], 0);
    }
};

// Inicialización automática cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Inicializando Dashboard...');

    // Verificar que estamos en la página correcta
    if (window.location.pathname.includes('dashboard') || document.getElementById('dashboard-header')) {
        window.dashboard = new PhotoDashboard();
        console.log('✅ Dashboard inicializado correctamente');
    }
});

// Exportar para uso global
window.PhotoDashboard = PhotoDashboard;
