// web/public/assets/js/components/calendar.js - Componente de calendario para el dashboard

/**
 * Componente Calendar para mostrar días con actividad de fotos
 */
class Calendar {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            apiBase: '/api',
            locale: 'es-ES',
            firstDayOfWeek: 1, // 1 = Lunes, 0 = Domingo
            enableNavigation: true,
            enableToday: true,
            highlightToday: true,
            onDateClick: null,
            onMonthChange: null,
            showPhotoCounts: true,
            ...options
        };

        this.state = {
            currentYear: new Date().getFullYear(),
            currentMonth: new Date().getMonth() + 1, // 1-12
            today: new Date(),
            photoDates: new Map(), // date -> { count, photos, videos }
            isLoading: false
        };

        this.monthNames = {
            1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
            5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
            9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
        };

        this.dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        this.init();
    }

    /**
     * Inicialización del componente
     */
    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            throw new Error(`Container with ID "${this.containerId}" not found`);
        }

        this.render();
        this.setupEventListeners();
        this.loadCalendarData();
    }

    /**
     * Renderizar la estructura del calendario
     */
    render() {
        this.container.innerHTML = `
            <div class="calendar-component">
                ${this.options.enableNavigation ? this.renderNavigation() : ''}
                <div class="calendar-weekdays">
                    ${this.renderWeekdays()}
                </div>
                <div class="calendar-grid" id="${this.containerId}-grid">
                    ${this.renderCalendarGrid()}
                </div>
                <div class="calendar-loading" id="${this.containerId}-loading" style="display: none;">
                    <div class="spinner"></div>
                    <span>Cargando calendario...</span>
                </div>
            </div>
        `;

        this.gridElement = document.getElementById(`${this.containerId}-grid`);
        this.loadingElement = document.getElementById(`${this.containerId}-loading`);
    }

    /**
     * Renderizar navegación del calendario
     */
    renderNavigation() {
        return `
            <div class="calendar-header">
                <div class="calendar-nav">
                    <button class="calendar-nav-btn" id="${this.containerId}-prev" title="Mes anterior">
                        <span>‹</span>
                    </button>
                    <h3 class="calendar-title" id="${this.containerId}-title">
                        ${this.monthNames[this.state.currentMonth]} ${this.state.currentYear}
                    </h3>
                    <button class="calendar-nav-btn" id="${this.containerId}-next" title="Mes siguiente">
                        <span>›</span>
                    </button>
                </div>
                ${this.options.enableToday ? `
                    <button class="calendar-today-btn" id="${this.containerId}-today">
                        Hoy
                    </button>
                ` : ''}
            </div>
        `;
    }

    /**
     * Renderizar días de la semana
     */
    renderWeekdays() {
        const weekdays = [];
        const startDay = this.options.firstDayOfWeek;

        for (let i = 0; i < 7; i++) {
            const dayIndex = (startDay + i) % 7;
            weekdays.push(`<div class="calendar-weekday">${this.dayNames[dayIndex]}</div>`);
        }

        return weekdays.join('');
    }

    /**
     * Renderizar grid del calendario
     */
    renderCalendarGrid() {
        const year = this.state.currentYear;
        const month = this.state.currentMonth;

        // Primer día del mes
        const firstDay = new Date(year, month - 1, 1);
        // Último día del mes
        const lastDay = new Date(year, month, 0);
        // Días en el mes
        const daysInMonth = lastDay.getDate();

        // Calcular día de la semana del primer día (ajustado por firstDayOfWeek)
        let startDayOfWeek = firstDay.getDay();
        if (this.options.firstDayOfWeek === 1) {
            startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
        }

        const cells = [];

        // Días del mes anterior (grises)
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();

        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const dateStr = this.formatDateString(prevYear, prevMonth, day);
            cells.push(this.renderDayCell(day, dateStr, true, false));
        }

        // Días del mes actual
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = this.formatDateString(year, month, day);
            const isToday = this.isToday(year, month, day);
            cells.push(this.renderDayCell(day, dateStr, false, isToday));
        }

        // Días del mes siguiente (grises) para completar la grid
        const totalCells = Math.ceil(cells.length / 7) * 7;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;

        for (let day = 1; cells.length < totalCells; day++) {
            const dateStr = this.formatDateString(nextYear, nextMonth, day);
            cells.push(this.renderDayCell(day, dateStr, true, false));
        }

        return cells.join('');
    }

    /**
     * Renderizar celda de día individual
     */
    renderDayCell(day, dateStr, isOtherMonth, isToday) {
        const photoData = this.state.photoDates.get(dateStr) || { count: 0, photos: 0, videos: 0 };
        const hasPhotos = photoData.count > 0;

        const classes = [
            'calendar-day',
            isOtherMonth && 'calendar-day--other-month',
            isToday && this.options.highlightToday && 'calendar-day--today',
            hasPhotos && 'calendar-day--has-photos'
        ].filter(Boolean).join(' ');

        return `
            <div class="${classes}"
                 data-date="${dateStr}"
                 data-day="${day}"
                 data-photos="${photoData.count}"
                 ${!isOtherMonth ? 'tabindex="0"' : ''}>
                <span class="calendar-day-number">${day}</span>
                ${this.options.showPhotoCounts && hasPhotos ? `
                    <div class="calendar-day-indicator">
                        <span class="photo-count">${photoData.count}</span>
                        ${photoData.photos > 0 ? `<span class="photo-type-icon">📸</span>` : ''}
                        ${photoData.videos > 0 ? `<span class="photo-type-icon">🎥</span>` : ''}
                    </div>
                ` : hasPhotos ? '<div class="calendar-day-dot"></div>' : ''}
            </div>
        `;
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Navegación
        if (this.options.enableNavigation) {
            const prevBtn = document.getElementById(`${this.containerId}-prev`);
            const nextBtn = document.getElementById(`${this.containerId}-next`);

            prevBtn?.addEventListener('click', () => this.previousMonth());
            nextBtn?.addEventListener('click', () => this.nextMonth());
        }

        // Botón "Hoy"
        if (this.options.enableToday) {
            const todayBtn = document.getElementById(`${this.containerId}-today`);
            todayBtn?.addEventListener('click', () => this.goToToday());
        }

        // Clicks en días
        this.container.addEventListener('click', (e) => {
            const dayCell = e.target.closest('.calendar-day');
            if (dayCell && !dayCell.classList.contains('calendar-day--other-month')) {
                this.handleDayClick(dayCell);
            }
        });

        // Teclado
        this.container.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('calendar-day')) {
                this.handleKeyboardNavigation(e);
            }
        });

        // Resize para responsive
        window.addEventListener('resize', this.debounce(() => {
            this.handleResize();
        }, 250));
    }

    /**
     * Cargar datos del calendario desde la API
     */
    async loadCalendarData() {
        if (this.state.isLoading) return;

        this.state.isLoading = true;
        this.showLoading(true);

        try {
            const response = await fetch(
                `${this.options.apiBase}/calendar/${this.state.currentYear}/${this.state.currentMonth}`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                this.processCalendarData(data.data);
                this.updateCalendarDisplay();
                this.emit('dataLoaded', { data: data.data });
            } else {
                throw new Error(data.message || 'Error loading calendar data');
            }

        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.emit('error', { error });

            // Fallback a datos mock para desarrollo
            this.loadMockData();
        } finally {
            this.state.isLoading = false;
            this.showLoading(false);
        }
    }

    /**
     * Procesar datos del calendario de la API
     */
    processCalendarData(apiData) {
        this.state.photoDates.clear();

        if (apiData.calendar_data) {
            apiData.calendar_data.forEach(dayData => {
                if (dayData.has_content) {
                    this.state.photoDates.set(dayData.date, {
                        count: dayData.file_count,
                        photos: dayData.photos,
                        videos: dayData.videos,
                        files: dayData.files || []
                    });
                }
            });
        }

        // Emitir evento con estadísticas
        if (apiData.statistics) {
            this.emit('statisticsLoaded', { stats: apiData.statistics });
        }
    }

    /**
     * Cargar datos mock para desarrollo
     */
    loadMockData() {
        const today = new Date();
        const year = this.state.currentYear;
        const month = this.state.currentMonth;

        // Generar algunos días con fotos aleatorias
        for (let day = 1; day <= 28; day++) {
            if (Math.random() > 0.7) { // 30% probabilidad
                const dateStr = this.formatDateString(year, month, day);
                const photoCount = Math.floor(Math.random() * 8) + 1;
                const videoCount = Math.random() > 0.8 ? Math.floor(Math.random() * 2) + 1 : 0;

                this.state.photoDates.set(dateStr, {
                    count: photoCount + videoCount,
                    photos: photoCount,
                    videos: videoCount,
                    files: []
                });
            }
        }

        this.updateCalendarDisplay();
    }

    /**
     * Actualizar display del calendario
     */
    updateCalendarDisplay() {
        if (this.gridElement) {
            this.gridElement.innerHTML = this.renderCalendarGrid();
        }

        // Actualizar título
        const titleElement = document.getElementById(`${this.containerId}-title`);
        if (titleElement) {
            titleElement.textContent = `${this.monthNames[this.state.currentMonth]} ${this.state.currentYear}`;
        }
    }

    /**
     * Navegación de meses
     */
    previousMonth() {
        if (this.state.currentMonth === 1) {
            this.state.currentMonth = 12;
            this.state.currentYear--;
        } else {
            this.state.currentMonth--;
        }

        this.onMonthChange();
    }

    nextMonth() {
        if (this.state.currentMonth === 12) {
            this.state.currentMonth = 1;
            this.state.currentYear++;
        } else {
            this.state.currentMonth++;
        }

        this.onMonthChange();
    }

    goToToday() {
        const today = new Date();
        this.state.currentYear = today.getFullYear();
        this.state.currentMonth = today.getMonth() + 1;

        this.onMonthChange();
    }

    /**
     * Manejar cambio de mes
     */
    onMonthChange() {
        this.updateCalendarDisplay();
        this.loadCalendarData();

        if (this.options.onMonthChange) {
            this.options.onMonthChange({
                year: this.state.currentYear,
                month: this.state.currentMonth
            });
        }

        this.emit('monthChanged', {
            year: this.state.currentYear,
            month: this.state.currentMonth
        });
    }

    /**
     * Manejar click en día
     */
    handleDayClick(dayCell) {
        const date = dayCell.dataset.date;
        const photoCount = parseInt(dayCell.dataset.photos) || 0;

        // Remover selección anterior
        this.container.querySelectorAll('.calendar-day--selected').forEach(cell => {
            cell.classList.remove('calendar-day--selected');
        });

        // Seleccionar día actual
        dayCell.classList.add('calendar-day--selected');

        const clickData = {
            date,
            day: parseInt(dayCell.dataset.day),
            photoCount,
            element: dayCell
        };

        if (this.options.onDateClick) {
            this.options.onDateClick(clickData);
        }

        this.emit('dateClicked', clickData);
    }

    /**
     * Navegación por teclado
     */
    handleKeyboardNavigation(e) {
        const currentDay = e.target;
        const days = Array.from(this.container.querySelectorAll('.calendar-day:not(.calendar-day--other-month)'));
        const currentIndex = days.indexOf(currentDay);

        let targetIndex = currentIndex;

        switch (e.key) {
            case 'ArrowLeft':
                targetIndex = Math.max(0, currentIndex - 1);
                break;
            case 'ArrowRight':
                targetIndex = Math.min(days.length - 1, currentIndex + 1);
                break;
            case 'ArrowUp':
                targetIndex = Math.max(0, currentIndex - 7);
                break;
            case 'ArrowDown':
                targetIndex = Math.min(days.length - 1, currentIndex + 7);
                break;
            case 'Home':
                targetIndex = 0;
                break;
            case 'End':
                targetIndex = days.length - 1;
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                this.handleDayClick(currentDay);
                return;
            default:
                return;
        }

        e.preventDefault();
        if (days[targetIndex]) {
            days[targetIndex].focus();
        }
    }

    /**
     * Manejar redimensionamiento
     */
    handleResize() {
        // Ajustar tamaño de celdas si es necesario
        const container = this.container;
        const width = container.offsetWidth;

        if (width < 500) {
            container.classList.add('calendar--compact');
        } else {
            container.classList.remove('calendar--compact');
        }
    }

    /**
     * Mostrar/ocultar loading
     */
    showLoading(show) {
        if (this.loadingElement) {
            this.loadingElement.style.display = show ? 'flex' : 'none';
        }

        if (this.gridElement) {
            this.gridElement.style.opacity = show ? '0.5' : '1';
        }
    }

    /**
     * Métodos públicos de la API
     */

    // Ir a una fecha específica
    goToDate(year, month) {
        this.state.currentYear = year;
        this.state.currentMonth = month;
        this.onMonthChange();
    }

    // Obtener fecha actual del calendario
    getCurrentDate() {
        return {
            year: this.state.currentYear,
            month: this.state.currentMonth
        };
    }

    // Obtener datos de fotos para una fecha
    getPhotosForDate(dateStr) {
        return this.state.photoDates.get(dateStr) || { count: 0, photos: 0, videos: 0, files: [] };
    }

    // Establecer datos de fotos externos
    setPhotosData(photosMap) {
        this.state.photoDates = new Map(photosMap);
        this.updateCalendarDisplay();
    }

    // Refrescar datos
    refresh() {
        this.loadCalendarData();
    }

    // Destruir componente
    destroy() {
        // Remover event listeners
        window.removeEventListener('resize', this.handleResize);

        // Limpiar container
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    /**
     * Utilidades
     */
    formatDateString(year, month, day) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    isToday(year, month, day) {
        const today = this.state.today;
        return year === today.getFullYear() &&
               month === today.getMonth() + 1 &&
               day === today.getDate();
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

    /**
     * Sistema de eventos
     */
    emit(eventName, data = {}) {
        const event = new CustomEvent(`calendar:${eventName}`, {
            detail: { ...data, calendar: this }
        });
        document.dispatchEvent(event);
    }

    on(eventName, callback) {
        document.addEventListener(`calendar:${eventName}`, callback);
    }

    off(eventName, callback) {
        document.removeEventListener(`calendar:${eventName}`, callback);
    }
}

// CSS adicional para el componente
const calendarStyles = `
    .calendar-component {
        width: 100%;
        background: var(--bg-secondary);
        border-radius: 0.75rem;
        overflow: hidden;
    }

    .calendar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        background: var(--bg-tertiary);
        border-bottom: 1px solid var(--border-color);
    }

    .calendar-nav {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .calendar-nav-btn {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.375rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        font-weight: bold;
        transition: all 0.2s ease;
    }

    .calendar-nav-btn:hover {
        background: var(--accent-primary);
        color: var(--text-inverse);
    }

    .calendar-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
        min-width: 8rem;
        text-align: center;
    }

    .calendar-today-btn {
        background: var(--accent-primary);
        color: var(--text-inverse);
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .calendar-today-btn:hover {
        background: var(--accent-secondary);
    }

    .calendar-weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        background: var(--bg-primary);
        border-bottom: 1px solid var(--border-color);
    }

    .calendar-weekday {
        padding: 0.75rem 0.5rem;
        text-align: center;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.025em;
    }

    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1px;
        background: var(--border-color);
    }

    .calendar-day {
        background: var(--bg-secondary);
        padding: 0.75rem 0.5rem;
        min-height: 4rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        position: relative;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
    }

    .calendar-day:hover {
        background: var(--bg-tertiary);
    }

    .calendar-day:focus {
        outline: none;
        border-color: var(--accent-primary);
    }

    .calendar-day--other-month {
        background: var(--bg-primary);
        color: var(--text-muted);
        cursor: default;
    }

    .calendar-day--other-month:hover {
        background: var(--bg-primary);
    }

    .calendar-day--today {
        background: var(--accent-primary) !important;
        color: var(--text-inverse);
    }

    .calendar-day--today .calendar-day-number {
        font-weight: 700;
    }

    .calendar-day--has-photos {
        background: rgba(16, 185, 129, 0.1);
        border-left: 3px solid var(--accent-success);
    }

    .calendar-day--selected {
        border-color: var(--accent-primary);
        box-shadow: inset 0 0 0 1px var(--accent-primary);
    }

    .calendar-day-number {
        font-weight: 500;
        font-size: 0.875rem;
        margin-bottom: 0.25rem;
    }

    .calendar-day-indicator {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.75rem;
        background: var(--accent-success);
        color: white;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        margin-top: auto;
    }

    .calendar-day--today .calendar-day-indicator {
        background: rgba(255, 255, 255, 0.9);
        color: var(--accent-primary);
    }

    .calendar-day-dot {
        width: 0.5rem;
        height: 0.5rem;
        background: var(--accent-success);
        border-radius: 50%;
        margin-top: auto;
    }

    .photo-count {
        font-weight: 600;
    }

    .photo-type-icon {
        font-size: 0.625rem;
    }

    .calendar-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 2rem;
        color: var(--text-muted);
    }

    .calendar-loading .spinner {
        width: 1.5rem;
        height: 1.5rem;
        border: 2px solid var(--border-color);
        border-top: 2px solid var(--accent-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    /* Responsive */
    .calendar--compact .calendar-day {
        min-height: 3rem;
        padding: 0.5rem 0.25rem;
    }

    .calendar--compact .calendar-day-number {
        font-size: 0.75rem;
    }

    .calendar--compact .calendar-day-indicator {
        font-size: 0.625rem;
        padding: 0.0625rem 0.25rem;
    }

    @media (max-width: 768px) {
        .calendar-header {
            padding: 0.75rem 1rem;
        }

        .calendar-title {
            font-size: 1rem;
            min-width: 6rem;
        }

        .calendar-nav-btn {
            width: 2rem;
            height: 2rem;
            font-size: 1rem;
        }

        .calendar-today-btn {
            padding: 0.375rem 0.75rem;
            font-size: 0.875rem;
        }

        .calendar-weekday {
            padding: 0.5rem 0.25rem;
            font-size: 0.75rem;
        }

        .calendar-day {
            min-height: 2.5rem;
            padding: 0.375rem 0.25rem;
        }

        .calendar-day-number {
            font-size: 0.75rem;
        }
    }
`;

// Agregar estilos al documento
const calendarStyleSheet = document.createElement('style');
calendarStyleSheet.textContent = calendarStyles;
document.head.appendChild(calendarStyleSheet);

// Exportar para uso global
window.Calendar = Calendar;

console.log('📅 Calendar component loaded successfully');
