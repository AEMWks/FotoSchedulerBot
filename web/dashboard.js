// Dashboard.js - JavaScript para el dashboard completo

class PhotoDashboard {
    constructor() {
        this.PHOTOS_BASE_PATH = '/photos';
        this.allPhotos = {};
        this.filteredPhotos = {};
        this.currentMonth = new Date();
        this.isLoading = false;

        this.init();
    }

    init() {
        this.setupTheme();
        this.setupEventListeners();
        this.loadAllData();
        this.generateCalendar();
    }

    // Theme Management (shared with feed)
    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Theme toggle
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            this.toggleTheme();
        });

        // Search functionality
        document.getElementById('search-btn')?.addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('search-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Filters
        document.getElementById('type-filter')?.addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('date-range')?.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                document.getElementById('custom-date-range').style.display = 'flex';
            } else {
                document.getElementById('custom-date-range').style.display = 'none';
                this.applyFilters();
            }
        });

        document.getElementById('apply-date-range')?.addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('clear-filters')?.addEventListener('click', () => {
            this.clearFilters();
        });

        // Calendar navigation
        document.getElementById('prev-month')?.addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.generateCalendar();
        });

        document.getElementById('next-month')?.addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.generateCalendar();
        });

        document.getElementById('today-btn')?.addEventListener('click', () => {
            this.currentMonth = new Date();
            this.generateCalendar();
        });

        // Export functionality
        document.getElementById('export-day')?.addEventListener('click', () => {
            this.showExportModal();
        });

        document.getElementById('export-week')?.addEventListener('click', () => {
            this.exportWeek();
        });

        document.getElementById('export-month')?.addEventListener('click', () => {
            this.exportMonth();
        });

        document.getElementById('export-all')?.addEventListener('click', () => {
            this.exportAll();
        });

        // Quick actions
        document.getElementById('bulk-download')?.addEventListener('click', () => {
            this.bulkDownload();
        });

        document.getElementById('random-memory')?.addEventListener('click', () => {
            this.showRandomMemory();
        });

        document.getElementById('slideshow-all')?.addEventListener('click', () => {
            this.startFullSlideshow();
        });
    }

    // Data Loading
    async loadAllData() {
        this.isLoading = true;
        this.showLoading(true);

        try {
            // Load available dates
            const dates = await this.getAvailableDates();

            // Load photos for each date
            for (const date of dates) {
                const photos = await this.getPhotosForDate(date);
                if (photos.length > 0) {
                    this.allPhotos[date] = photos;
                }
            }

            this.filteredPhotos = { ...this.allPhotos };
            this.updateAnalytics();
            this.generateCalendar();
            this.generateActivityChart();
            this.generateHoursChart();

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }

    async getAvailableDates() {
        // Simulate available dates - in real implementation, this would call an API
        const dates = [];
        const today = new Date();

        for (let i = 0; i < 60; i++) { // Last 60 days
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.push(this.formatDate(date));
        }

        return dates;
    }

    async getPhotosForDate(dateStr) {
        const [year, month, day] = dateStr.split('-');

        try {
            const response = await fetch(`/api/photos.php?year=${year}&month=${month}&day=${day}`);
            if (!response.ok) {
                return [];
            }
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            // Mock data for demo
            return this.generateMockPhotos(dateStr);
        }
    }

    generateMockPhotos(dateStr) {
        const mockPhotos = [
            '10-30-45.jpg', '14-15-20.jpg', '18-45-30.mp4',
            '20-12-15.jpg', '09-15-30.jpg', '16-20-45.jpg',
            '12-30-00.jpg', '15-45-15.mp4', '19-00-30.jpg'
        ];

        const daysSinceDate = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
        const probability = daysSinceDate < 7 ? 0.7 : (daysSinceDate < 30 ? 0.4 : 0.2);

        if (Math.random() < probability) {
            const count = Math.floor(Math.random() * 4) + 1;
            return mockPhotos.slice(0, count);
        }
        return [];
    }

    // Search and Filter Functionality
    performSearch() {
        const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
        if (!searchTerm) {
            this.clearFilters();
            return;
        }

        const results = {};

        // Search by date (YYYY-MM-DD format)
        if (searchTerm.match(/^\d{4}-\d{2}-\d{2}$/)) {
            if (this.allPhotos[searchTerm]) {
                results[searchTerm] = this.allPhotos[searchTerm];
            }
        }
        // Search by type
        else if (searchTerm === 'foto' || searchTerm === 'video') {
            const isVideo = searchTerm === 'video';
            for (const [date, photos] of Object.entries(this.allPhotos)) {
                const filteredPhotos = photos.filter(photo => {
                    return isVideo ? photo.endsWith('.mp4') : !photo.endsWith('.mp4');
                });
                if (filteredPhotos.length > 0) {
                    results[date] = filteredPhotos;
                }
            }
        }
        // Search by partial date (year, month)
        else {
            for (const [date, photos] of Object.entries(this.allPhotos)) {
                if (date.includes(searchTerm)) {
                    results[date] = photos;
                }
            }
        }

        this.filteredPhotos = results;
        this.displaySearchResults(results, searchTerm);
    }

    applyFilters() {
        const typeFilter = document.getElementById('type-filter').value;
        const dateRange = document.getElementById('date-range').value;

        let filtered = { ...this.allPhotos };

        // Apply type filter
        if (typeFilter !== 'all') {
            const isVideo = typeFilter === 'video';
            const newFiltered = {};

            for (const [date, photos] of Object.entries(filtered)) {
                const filteredPhotos = photos.filter(photo => {
                    return isVideo ? photo.endsWith('.mp4') : !photo.endsWith('.mp4');
                });
                if (filteredPhotos.length > 0) {
                    newFiltered[date] = filteredPhotos;
                }
            }
            filtered = newFiltered;
        }

        // Apply date range filter
        if (dateRange !== 'all') {
            const today = new Date();
            let startDate;

            switch (dateRange) {
                case 'today':
                    startDate = new Date(today);
                    break;
                case 'week':
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 7);
                    break;
                case 'month':
                    startDate = new Date(today);
                    startDate.setMonth(today.getMonth() - 1);
                    break;
                case 'custom':
                    const startInput = document.getElementById('start-date').value;
                    const endInput = document.getElementById('end-date').value;
                    if (startInput && endInput) {
                        startDate = new Date(startInput);
                        const endDate = new Date(endInput);

                        filtered = newFiltered;
                    }
                    break;
            }

            if (startDate && dateRange !== 'custom') {
                const newFiltered = {};
                for (const [date, photos] of Object.entries(filtered)) {
                    const photoDate = new Date(date);
                    if (photoDate >= startDate) {
                        newFiltered[date] = photos;
                    }
                }
                filtered = newFiltered;
            }
        }

        this.filteredPhotos = filtered;
        this.displaySearchResults(filtered, 'Filtros aplicados');
    }

    clearFilters() {
        document.getElementById('search-input').value = '';
        document.getElementById('type-filter').value = 'all';
        document.getElementById('date-range').value = 'all';
        document.getElementById('custom-date-range').style.display = 'none';

        this.filteredPhotos = { ...this.allPhotos };
        document.getElementById('results-section').style.display = 'none';
    }

    displaySearchResults(results, searchTerm) {
        const resultsSection = document.getElementById('results-section');
        const resultsTitle = document.getElementById('results-title');
        const resultsCount = document.getElementById('results-count');
        const resultsGrid = document.getElementById('results-grid');

        const totalResults = Object.values(results).reduce((sum, photos) => sum + photos.length, 0);

        resultsTitle.textContent = `Resultados: ${searchTerm}`;
        resultsCount.textContent = `${totalResults} elemento${totalResults !== 1 ? 's' : ''} encontrado${totalResults !== 1 ? 's' : ''}`;

        if (totalResults === 0) {
            resultsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                    <h3>No se encontraron resultados</h3>
                    <p>Intenta con otros términos de búsqueda</p>
                </div>
            `;
        } else {
            let html = '';
            const sortedDates = Object.keys(results).sort((a, b) => b.localeCompare(a));

            for (const date of sortedDates) {
                const photos = results[date];
                for (const photo of photos) {
                    const [year, month, day] = date.split('-');
                    const filePath = `${this.PHOTOS_BASE_PATH}/${year}/${month}/${day}/${photo}`;
                    const isVideo = photo.toLowerCase().endsWith('.mp4');
                    const timestamp = this.extractTimestamp(photo);

                    html += `
                        <div class="media-item" onclick="dashboard.openResultLightbox('${filePath}', '${date}', '${timestamp}')" style="cursor: pointer;">
                            ${isVideo ?
                                `<video muted style="width: 100%; height: 150px; object-fit: cover; border-radius: 0.5rem;">
                                    <source src="${filePath}" type="video/mp4">
                                </video>` :
                                `<img src="${filePath}" alt="Foto del ${date}" loading="lazy" style="width: 100%; height: 150px; object-fit: cover; border-radius: 0.5rem;">`
                            }
                            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); color: white; padding: 1rem 0.5rem 0.5rem; font-size: 0.75rem; text-align: center;">
                                ${this.formatDateSpanish(date)}<br>${timestamp}
                            </div>
                        </div>
                    `;
                }
            }
            resultsGrid.innerHTML = html;
        }

        resultsSection.style.display = 'block';
    }

    // Analytics
    updateAnalytics() {
        const totalCount = Object.values(this.allPhotos).reduce((sum, photos) => sum + photos.length, 0);
        let photoCount = 0;
        let videoCount = 0;

        for (const photos of Object.values(this.allPhotos)) {
            for (const photo of photos) {
                if (photo.endsWith('.mp4')) {
                    videoCount++;
                } else {
                    photoCount++;
                }
            }
        }

        const daysWithPhotos = Object.keys(this.allPhotos).length;
        const avgPerDay = daysWithPhotos > 0 ? (totalCount / daysWithPhotos).toFixed(1) : 0;

        document.getElementById('total-count').textContent = totalCount;
        document.getElementById('photo-count').textContent = photoCount;
        document.getElementById('video-count').textContent = videoCount;
        document.getElementById('avg-per-day').textContent = avgPerDay;
    }

    generateActivityChart() {
        const canvas = document.getElementById('activity-chart');
        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Prepare data for last 14 days
        const days = [];
        const counts = [];
        const today = new Date();

        for (let i = 13; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = this.formatDate(date);

            days.push(date.getDate().toString());
            counts.push(this.allPhotos[dateStr] ? this.allPhotos[dateStr].length : 0);
        }

        // Draw chart
        const maxCount = Math.max(...counts, 1);
        const barWidth = canvas.width / days.length;
        const barMaxHeight = canvas.height - 40;

        ctx.fillStyle = 'var(--accent-primary)';

        for (let i = 0; i < days.length; i++) {
            const barHeight = (counts[i] / maxCount) * barMaxHeight;
            const x = i * barWidth + 5;
            const y = canvas.height - barHeight - 20;

            // Draw bar
            ctx.fillRect(x, y, barWidth - 10, barHeight);

            // Draw day label
            ctx.fillStyle = 'var(--text-muted)';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(days[i], x + (barWidth - 10) / 2, canvas.height - 5);

            // Draw count label
            if (counts[i] > 0) {
                ctx.fillStyle = 'var(--text-primary)';
                ctx.fillText(counts[i].toString(), x + (barWidth - 10) / 2, y - 5);
            }

            ctx.fillStyle = 'var(--accent-primary)';
        }
    }

    generateHoursChart() {
        const hoursGrid = document.getElementById('hours-chart');
        const hourCounts = new Array(24).fill(0);

        // Count photos by hour
        for (const photos of Object.values(this.allPhotos)) {
            for (const photo of photos) {
                const hour = this.extractHour(photo);
                if (hour !== -1) {
                    hourCounts[hour]++;
                }
            }
        }

        const maxCount = Math.max(...hourCounts, 1);
        let html = '';

        for (let hour = 0; hour < 24; hour++) {
            const count = hourCounts[hour];
            const intensity = count / maxCount;
            const isActive = count > 0;

            html += `
                <div class="hour-block ${isActive ? 'active' : ''}"
                     style="opacity: ${0.3 + intensity * 0.7}"
                     title="${hour}:00 - ${count} foto${count !== 1 ? 's' : ''}">
                    ${hour}h
                </div>
            `;
        }

        hoursGrid.innerHTML = html;
    }

    // Calendar
    generateCalendar() {
        const calendarGrid = document.getElementById('calendar-grid');
        const currentMonthEl = document.getElementById('current-month');

        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();

        // Update month display
        currentMonthEl.textContent = this.currentMonth.toLocaleDateString('es-ES', {
            month: 'long',
            year: 'numeric'
        });

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

        let html = '';

        // Day headers
        const dayHeaders = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        for (const header of dayHeaders) {
            html += `<div style="padding: 0.5rem; text-align: center; font-weight: bold; background: var(--bg-tertiary); color: var(--text-muted);">${header}</div>`;
        }

        // Previous month days
        const prevMonth = new Date(year, month - 1, 0);
        const prevMonthDays = prevMonth.getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonthDays - i;
            html += `<div class="calendar-day other-month">
                <span class="day-number">${day}</span>
            </div>`;
        }

        // Current month days
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = this.formatDate(date);
            const isToday = date.toDateString() === today.toDateString();
            const hasPhotos = this.allPhotos[dateStr] && this.allPhotos[dateStr].length > 0;
            const photoCount = hasPhotos ? this.allPhotos[dateStr].length : 0;

            html += `
                <div class="calendar-day ${isToday ? 'today' : ''} ${hasPhotos ? 'has-photos' : ''}" onclick="dashboard.showDayPhotos('${dateStr}')">
                    <span class="day-number">${day}</span>
                    ${hasPhotos ? `<div class="day-photos">${photoCount} foto${photoCount !== 1 ? 's' : ''}</div>` : ''}
                </div>
            `;
        }

        // Next month days to fill the grid
        const totalCells = Math.ceil((startingDayOfWeek + daysInMonth) / 7) * 7;
        const remainingCells = totalCells - (startingDayOfWeek + daysInMonth);
        for (let day = 1; day <= remainingCells; day++) {
            html += `<div class="calendar-day other-month">
                <span class="day-number">${day}</span>
            </div>`;
        }

        calendarGrid.innerHTML = html;
    }

    showDayPhotos(dateStr) {
        if (this.allPhotos[dateStr]) {
            this.displaySearchResults({[dateStr]: this.allPhotos[dateStr]}, this.formatDateSpanish(dateStr));
        }
    }

    // Export Functionality
    showExportModal() {
        document.getElementById('export-modal').style.display = 'flex';
        document.getElementById('export-date').value = this.formatDate(new Date());
    }

    closeExportModal() {
        document.getElementById('export-modal').style.display = 'none';
    }

    confirmExport() {
        const date = document.getElementById('export-date').value;
        if (date) {
            this.exportDay(date);
        }
        this.closeExportModal();
    }

    exportDay(date) {
        if (!this.allPhotos[date]) {
            alert('No hay fotos para esta fecha');
            return;
        }

        const format = document.querySelector('input[name="export-format"]:checked').value;

        if (format === 'zip') {
            // In a real implementation, this would create a ZIP file
            this.downloadPhotosAsZip([date]);
        } else {
            this.downloadMetadataAsJSON([date]);
        }
    }

    exportWeek() {
        const dates = this.getWeekDates();
        const format = document.querySelector('input[name="export-format"]:checked').value;

        if (format === 'zip') {
            this.downloadPhotosAsZip(dates);
        } else {
            this.downloadMetadataAsJSON(dates);
        }
    }

    exportMonth() {
        const dates = this.getMonthDates();
        const format = document.querySelector('input[name="export-format"]:checked').value;

        if (format === 'zip') {
            this.downloadPhotosAsZip(dates);
        } else {
            this.downloadMetadataAsJSON(dates);
        }
    }

    exportAll() {
        const dates = Object.keys(this.allPhotos);
        const format = document.querySelector('input[name="export-format"]:checked').value;

        if (format === 'zip') {
            this.downloadPhotosAsZip(dates);
        } else {
            this.downloadMetadataAsJSON(dates);
        }
    }

    downloadPhotosAsZip(dates) {
        // Simulate download - in real implementation, this would create a ZIP
        alert(`Descargando ${dates.length} días de fotos como ZIP (función simulada)`);
    }

    downloadMetadataAsJSON(dates) {
        const metadata = {};
        for (const date of dates) {
            if (this.allPhotos[date]) {
                metadata[date] = this.allPhotos[date].map(photo => ({
                    filename: photo,
                    timestamp: this.extractTimestamp(photo),
                    type: photo.endsWith('.mp4') ? 'video' : 'photo'
                }));
            }
        }

        const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `metadata_${dates.length}_days.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Quick Actions
    bulkDownload() {
        const selectedCount = Object.values(this.filteredPhotos).reduce((sum, photos) => sum + photos.length, 0);
        if (selectedCount === 0) {
            alert('No hay fotos seleccionadas para descargar');
            return;
        }

        alert(`Descarga masiva de ${selectedCount} archivos (función simulada)`);
    }

    showRandomMemory() {
        const allDates = Object.keys(this.allPhotos).filter(date => this.allPhotos[date].length > 0);
        if (allDates.length === 0) {
            alert('No hay fotos disponibles');
            return;
        }

        this.getRandomMemory();
        document.getElementById('memory-modal').style.display = 'flex';
    }

    getRandomMemory() {
        const allDates = Object.keys(this.allPhotos).filter(date => this.allPhotos[date].length > 0);
        const randomDate = allDates[Math.floor(Math.random() * allDates.length)];
        const photos = this.allPhotos[randomDate];
        const randomPhoto = photos[Math.floor(Math.random() * photos.length)];

        const [year, month, day] = randomDate.split('-');
        const filePath = `${this.PHOTOS_BASE_PATH}/${year}/${month}/${day}/${randomPhoto}`;
        const isVideo = randomPhoto.endsWith('.mp4');
        const timestamp = this.extractTimestamp(randomPhoto);

        const randomImage = document.getElementById('random-image');
        const randomVideo = document.getElementById('random-video');
        const memoryDate = document.getElementById('memory-date');
        const memoryTime = document.getElementById('memory-time');

        if (isVideo) {
            randomImage.style.display = 'none';
            randomVideo.style.display = 'block';
            randomVideo.querySelector('source').src = filePath;
            randomVideo.load();
        } else {
            randomVideo.style.display = 'none';
            randomImage.style.display = 'block';
            randomImage.src = filePath;
        }

        memoryDate.textContent = this.formatDateSpanish(randomDate);
        memoryTime.textContent = timestamp;
    }

    closeMemoryModal() {
        document.getElementById('memory-modal').style.display = 'none';
    }

    startFullSlideshow() {
        alert('Slideshow completo (función simulada - integraría con el feed principal)');
    }

    // Utility Functions
    getWeekDates() {
        const dates = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.push(this.formatDate(date));
        }
        return dates;
    }

    getMonthDates() {
        const dates = [];
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(today.getFullYear(), today.getMonth(), i);
            dates.push(this.formatDate(date));
        }
        return dates;
    }

    openResultLightbox(src, date, time) {
        // Simple lightbox for search results
        const lightbox = document.createElement('div');
        lightbox.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); z-index: 2000;
            display: flex; justify-content: center; align-items: center;
            backdrop-filter: blur(5px);
        `;

        const isVideo = src.includes('.mp4');
        const media = document.createElement(isVideo ? 'video' : 'img');
        media.src = src;
        media.style.cssText = 'max-width: 90%; max-height: 90%; border-radius: 1rem;';
        if (isVideo) {
            media.controls = true;
            media.autoplay = true;
        }

        const info = document.createElement('div');
        info.style.cssText = `
            position: absolute; bottom: 2rem; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.8); color: white; padding: 1rem 2rem;
            border-radius: 0.5rem; text-align: center;
        `;
        info.innerHTML = `${this.formatDateSpanish(date)}<br>${time}`;

        const close = document.createElement('button');
        close.textContent = '×';
        close.style.cssText = `
            position: absolute; top: 1rem; right: 1rem;
            background: rgba(255,255,255,0.2); border: none; color: white;
            width: 3rem; height: 3rem; border-radius: 50%; font-size: 1.5rem;
            cursor: pointer;
        `;
        close.onclick = () => document.body.removeChild(lightbox);

        lightbox.appendChild(media);
        lightbox.appendChild(info);
        lightbox.appendChild(close);
        lightbox.onclick = (e) => {
            if (e.target === lightbox) {
                document.body.removeChild(lightbox);
            }
        };

        document.body.appendChild(lightbox);
    }

    showLoading(show) {
        // Add loading indicator if needed
        console.log('Loading:', show);
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
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

    extractTimestamp(filename) {
        const match = filename.match(/(\d{2})-(\d{2})-(\d{2})/);
        if (match) {
            const [, hours, minutes, seconds] = match;
            return `${hours}:${minutes}:${seconds}`;
        }
        return filename;
    }

    extractHour(filename) {
        const match = filename.match(/(\d{2})-\d{2}-\d{2}/);
        return match ? parseInt(match[1], 10) : -1;
    }
}

// Global functions for onclick handlers
function closeExportModal() {
    dashboard.closeExportModal();
}

function confirmExport() {
    dashboard.confirmExport();
}

function closeMemoryModal() {
    dashboard.closeMemoryModal();
}

function getRandomMemory() {
    dashboard.getRandomMemory();
}

// Initialize dashboard
const dashboard = new PhotoDashboard();
