// web/public/assets/js/components/charts.js - Componente de gráficos para analytics

/**
 * Clase base para gráficos
 */
class BaseChart {
    constructor(canvasId, options = {}) {
        this.canvasId = canvasId;
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.options = {
            responsive: true,
            maintainAspectRatio: false,
            backgroundColor: '#ffffff',
            gridColor: '#e5e7eb',
            textColor: '#374151',
            primaryColor: '#3b82f6',
            secondaryColor: '#8b5cf6',
            successColor: '#10b981',
            warningColor: '#f59e0b',
            errorColor: '#ef4444',
            ...options
        };

        this.data = [];
        this.animationId = null;
        this.isAnimating = false;

        if (!this.canvas || !this.ctx) {
            console.warn(`Canvas with ID "${canvasId}" not found`);
            return;
        }

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.updateThemeColors();
    }

    setupCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Set actual size in memory (scaled to account for extra pixel density)
        const scale = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * scale;
        this.canvas.height = rect.height * scale;

        // Scale the drawing context so everything will work at the higher ratio
        this.ctx.scale(scale, scale);

        // Scale down canvas back to original size using CSS
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    setupEventListeners() {
        // Theme change listener
        document.addEventListener('photoDiary:themeChanged', () => {
            this.updateThemeColors();
            this.render();
        });

        // Resize listener
        window.addEventListener('resize', this.debounce(() => {
            this.setupCanvas();
            this.render();
        }, 250));

        // Canvas hover
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.handleMouseLeave();
        });

        this.canvas.addEventListener('click', (e) => {
            this.handleClick(e);
        });
    }

    updateThemeColors() {
        const theme = document.documentElement.getAttribute('data-theme');

        if (theme === 'dark') {
            this.options.backgroundColor = '#1e293b';
            this.options.gridColor = '#334155';
            this.options.textColor = '#f8fafc';
        } else {
            this.options.backgroundColor = '#ffffff';
            this.options.gridColor = '#e5e7eb';
            this.options.textColor = '#374151';
        }
    }

    setData(data) {
        this.data = data;
        this.render();
    }

    render() {
        if (!this.ctx) return;

        this.clear();
        this.draw();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw() {
        // To be implemented by subclasses
    }

    handleMouseMove(e) {
        // To be implemented by subclasses
    }

    handleMouseLeave() {
        // To be implemented by subclasses
    }

    handleClick(e) {
        // To be implemented by subclasses
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

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        window.removeEventListener('resize', this.setupCanvas);
        document.removeEventListener('photoDiary:themeChanged', this.updateThemeColors);
    }
}

/**
 * Gráfico de líneas para actividad por tiempo
 */
class ActivityChart extends BaseChart {
    constructor(canvasId, options = {}) {
        super(canvasId, {
            padding: 40,
            showGrid: true,
            showLabels: true,
            showTooltip: true,
            lineWidth: 3,
            pointRadius: 5,
            animationDuration: 1000,
            ...options
        });

        this.tooltip = {
            visible: false,
            x: 0,
            y: 0,
            text: '',
            data: null
        };

        this.animation = {
            progress: 0,
            startTime: null
        };
    }

    draw() {
        if (!this.data || this.data.length === 0) {
            this.drawEmptyState();
            return;
        }

        // Background
        this.ctx.fillStyle = this.options.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const { width, height } = this.getDrawingArea();

        if (this.options.showGrid) {
            this.drawGrid(width, height);
        }

        if (this.options.showLabels) {
            this.drawLabels(width, height);
        }

        this.drawLine(width, height);
        this.drawPoints(width, height);

        if (this.tooltip.visible) {
            this.drawTooltip();
        }
    }

    drawEmptyState() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        this.ctx.fillStyle = this.options.textColor;
        this.ctx.font = '16px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('No hay datos para mostrar', centerX, centerY);
    }

    getDrawingArea() {
        return {
            width: this.canvas.width - (this.options.padding * 2),
            height: this.canvas.height - (this.options.padding * 2),
            offsetX: this.options.padding,
            offsetY: this.options.padding
        };
    }

    drawGrid(width, height) {
        const { offsetX, offsetY } = this.getDrawingArea();

        this.ctx.strokeStyle = this.options.gridColor;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);

        const gridLines = 5;

        // Horizontal lines
        for (let i = 0; i <= gridLines; i++) {
            const y = offsetY + (height / gridLines) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(offsetX, y);
            this.ctx.lineTo(offsetX + width, y);
            this.ctx.stroke();
        }

        // Vertical lines
        for (let i = 0; i <= gridLines; i++) {
            const x = offsetX + (width / gridLines) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(x, offsetY);
            this.ctx.lineTo(x, offsetY + height);
            this.ctx.stroke();
        }

        this.ctx.setLineDash([]);
    }

    drawLabels(width, height) {
        const { offsetX, offsetY } = this.getDrawingArea();

        this.ctx.fillStyle = this.options.textColor;
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.textAlign = 'center';

        // X-axis labels (dates)
        const step = Math.ceil(this.data.length / 6); // Show ~6 labels max
        for (let i = 0; i < this.data.length; i += step) {
            const x = offsetX + (width / (this.data.length - 1)) * i;
            const label = this.formatDateLabel(this.data[i].date);
            this.ctx.fillText(label, x, offsetY + height + 20);
        }

        // Y-axis labels (values)
        const maxValue = Math.max(...this.data.map(d => d.count));
        const gridLines = 5;

        this.ctx.textAlign = 'right';
        for (let i = 0; i <= gridLines; i++) {
            const value = Math.round((maxValue / gridLines) * (gridLines - i));
            const y = offsetY + (height / gridLines) * i + 5;
            this.ctx.fillText(value.toString(), offsetX - 10, y);
        }
    }

    drawLine(width, height) {
        if (this.data.length < 2) return;

        const { offsetX, offsetY } = this.getDrawingArea();
        const maxValue = Math.max(...this.data.map(d => d.count));

        this.ctx.strokeStyle = this.options.primaryColor;
        this.ctx.lineWidth = this.options.lineWidth;
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';

        // Create gradient
        const gradient = this.ctx.createLinearGradient(0, offsetY, 0, offsetY + height);
        gradient.addColorStop(0, this.options.primaryColor + '40');
        gradient.addColorStop(1, this.options.primaryColor + '10');

        // Draw area fill
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.moveTo(offsetX, offsetY + height);

        for (let i = 0; i < this.data.length; i++) {
            const x = offsetX + (width / (this.data.length - 1)) * i;
            const y = offsetY + height - (this.data[i].count / maxValue) * height;

            if (i === 0) {
                this.ctx.lineTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.lineTo(offsetX + width, offsetY + height);
        this.ctx.closePath();
        this.ctx.fill();

        // Draw line
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.options.primaryColor;

        for (let i = 0; i < this.data.length; i++) {
            const x = offsetX + (width / (this.data.length - 1)) * i;
            const y = offsetY + height - (this.data[i].count / maxValue) * height;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();
    }

    drawPoints(width, height) {
        const { offsetX, offsetY } = this.getDrawingArea();
        const maxValue = Math.max(...this.data.map(d => d.count));

        for (let i = 0; i < this.data.length; i++) {
            const x = offsetX + (width / (this.data.length - 1)) * i;
            const y = offsetY + height - (this.data[i].count / maxValue) * height;

            // Point background
            this.ctx.fillStyle = this.options.backgroundColor;
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.options.pointRadius + 2, 0, 2 * Math.PI);
            this.ctx.fill();

            // Point
            this.ctx.fillStyle = this.options.primaryColor;
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.options.pointRadius, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }

    drawTooltip() {
        if (!this.tooltip.data) return;

        const padding = 10;
        const text = `${this.tooltip.data.count} fotos`;
        const date = this.formatDateLabel(this.tooltip.data.date);

        this.ctx.font = '12px Inter, sans-serif';
        const textWidth = Math.max(
            this.ctx.measureText(text).width,
            this.ctx.measureText(date).width
        );

        const tooltipWidth = textWidth + padding * 2;
        const tooltipHeight = 40;

        let x = this.tooltip.x - tooltipWidth / 2;
        let y = this.tooltip.y - tooltipHeight - 10;

        // Keep tooltip in bounds
        if (x < 10) x = 10;
        if (x + tooltipWidth > this.canvas.width - 10) x = this.canvas.width - tooltipWidth - 10;
        if (y < 10) y = this.tooltip.y + 20;

        // Background
        this.ctx.fillStyle = this.options.textColor;
        this.ctx.fillRect(x, y, tooltipWidth, tooltipHeight);

        // Text
        this.ctx.fillStyle = this.options.backgroundColor;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text, x + tooltipWidth / 2, y + 15);
        this.ctx.fillText(date, x + tooltipWidth / 2, y + 30);
    }

    handleMouseMove(e) {
        if (!this.data || this.data.length === 0) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const { width, offsetX } = this.getDrawingArea();

        // Find closest data point
        let closestIndex = Math.round(((x - offsetX) / width) * (this.data.length - 1));
        closestIndex = Math.max(0, Math.min(this.data.length - 1, closestIndex));

        const dataPoint = this.data[closestIndex];

        this.tooltip.visible = true;
        this.tooltip.x = x;
        this.tooltip.y = y;
        this.tooltip.data = dataPoint;

        this.canvas.style.cursor = 'pointer';
        this.render();
    }

    handleMouseLeave() {
        this.tooltip.visible = false;
        this.canvas.style.cursor = 'default';
        this.render();
    }

    formatDateLabel(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', {
            month: 'short',
            day: 'numeric'
        });
    }
}

/**
 * Gráfico de barras para distribución por horas
 */
class HourlyChart {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.data = Array(24).fill(0);
        this.options = {
            maxHeight: 60,
            showLabels: true,
            showTooltips: true,
            animationDuration: 800,
            colors: {
                low: '#e5e7eb',
                medium: '#93c5fd',
                high: '#3b82f6',
                active: '#1d4ed8'
            },
            ...options
        };

        if (!this.container) {
            console.warn(`Container with ID "${containerId}" not found`);
            return;
        }

        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('photoDiary:themeChanged', () => {
            this.updateTheme();
        });
    }

    setData(hourlyData) {
        // hourlyData should be array of 24 numbers (0-23 hours)
        this.data = hourlyData || Array(24).fill(0);
        this.render();
    }

    render() {
        if (!this.container) return;

        const maxValue = Math.max(...this.data);

        this.container.innerHTML = this.data.map((count, hour) => {
            const percentage = maxValue > 0 ? (count / maxValue) * 100 : 0;
            const level = this.getActivityLevel(count, maxValue);

            return `
                <div class="hour-bar"
                     data-hour="${hour}"
                     data-count="${count}"
                     title="${this.formatHourTooltip(hour, count)}">
                    <div class="hour-bar-fill hour-bar-fill--${level}"
                         style="height: ${percentage}%"></div>
                    ${this.options.showLabels ? `<span class="hour-label">${hour}</span>` : ''}
                </div>
            `;
        }).join('');

        // Animate bars
        setTimeout(() => {
            this.container.querySelectorAll('.hour-bar-fill').forEach((bar, index) => {
                setTimeout(() => {
                    bar.classList.add('hour-bar-fill--animated');
                }, index * 50);
            });
        }, 100);
    }

    getActivityLevel(count, maxValue) {
        if (count === 0) return 'empty';
        if (maxValue === 0) return 'empty';

        const percentage = (count / maxValue);
        if (percentage < 0.3) return 'low';
        if (percentage < 0.7) return 'medium';
        return 'high';
    }

    formatHourTooltip(hour, count) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        const photoText = count === 1 ? 'foto' : 'fotos';
        return `${timeStr} - ${count} ${photoText}`;
    }

    updateTheme() {
        // Theme updates are handled via CSS custom properties
        this.render();
    }

    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

/**
 * Gráfico de dona simple para estadísticas
 */
class DonutChart extends BaseChart {
    constructor(canvasId, options = {}) {
        super(canvasId, {
            innerRadius: 0.6,
            showLabels: true,
            showPercentages: true,
            animationDuration: 1000,
            ...options
        });

        this.segments = [];
        this.hoveredSegment = -1;
    }

    setData(segments) {
        // segments: [{ label, value, color? }]
        this.segments = segments.map((segment, index) => ({
            ...segment,
            color: segment.color || this.getDefaultColor(index),
            percentage: 0 // Will be calculated
        }));

        this.calculatePercentages();
        this.render();
    }

    calculatePercentages() {
        const total = this.segments.reduce((sum, segment) => sum + segment.value, 0);

        let currentAngle = -Math.PI / 2; // Start at top

        this.segments.forEach(segment => {
            segment.percentage = total > 0 ? (segment.value / total) * 100 : 0;
            segment.startAngle = currentAngle;
            segment.endAngle = currentAngle + (segment.value / total) * 2 * Math.PI;
            currentAngle = segment.endAngle;
        });
    }

    draw() {
        if (!this.segments || this.segments.length === 0) {
            this.drawEmptyState();
            return;
        }

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw segments
        this.segments.forEach((segment, index) => {
            const isHovered = index === this.hoveredSegment;
            const currentRadius = isHovered ? radius + 5 : radius;

            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, currentRadius, segment.startAngle, segment.endAngle);
            this.ctx.arc(centerX, centerY, currentRadius * this.options.innerRadius, segment.endAngle, segment.startAngle, true);
            this.ctx.closePath();

            this.ctx.fillStyle = segment.color;
            this.ctx.fill();

            if (isHovered) {
                this.ctx.strokeStyle = this.options.backgroundColor;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        });

        // Draw center text
        this.drawCenterText(centerX, centerY);

        // Draw labels
        if (this.options.showLabels) {
            this.drawLabels(centerX, centerY, radius);
        }
    }

    drawCenterText(centerX, centerY) {
        const total = this.segments.reduce((sum, segment) => sum + segment.value, 0);

        this.ctx.fillStyle = this.options.textColor;
        this.ctx.font = 'bold 24px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(total.toString(), centerX, centerY - 5);

        this.ctx.font = '14px Inter, sans-serif';
        this.ctx.fillText('Total', centerX, centerY + 15);
    }

    drawLabels(centerX, centerY, radius) {
        this.segments.forEach(segment => {
            if (segment.percentage < 5) return; // Skip small segments

            const angle = (segment.startAngle + segment.endAngle) / 2;
            const labelRadius = radius * 0.8;
            const x = centerX + Math.cos(angle) * labelRadius;
            const y = centerY + Math.sin(angle) * labelRadius;

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 12px Inter, sans-serif';
            this.ctx.textAlign = 'center';

            if (this.options.showPercentages) {
                this.ctx.fillText(`${Math.round(segment.percentage)}%`, x, y);
            } else {
                this.ctx.fillText(segment.value.toString(), x, y);
            }
        });
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const radius = Math.min(centerX, centerY) - 20;
        const innerRadius = radius * this.options.innerRadius;

        let hoveredIndex = -1;

        if (distance >= innerRadius && distance <= radius) {
            // Normalize angle to match our segment angles
            let normalizedAngle = angle;
            if (normalizedAngle < -Math.PI / 2) {
                normalizedAngle += 2 * Math.PI;
            }

            hoveredIndex = this.segments.findIndex(segment =>
                normalizedAngle >= segment.startAngle && normalizedAngle <= segment.endAngle
            );
        }

        if (hoveredIndex !== this.hoveredSegment) {
            this.hoveredSegment = hoveredIndex;
            this.canvas.style.cursor = hoveredIndex >= 0 ? 'pointer' : 'default';
            this.render();
        }
    }

    handleMouseLeave() {
        if (this.hoveredSegment !== -1) {
            this.hoveredSegment = -1;
            this.canvas.style.cursor = 'default';
            this.render();
        }
    }

    getDefaultColor(index) {
        const colors = [
            this.options.primaryColor,
            this.options.secondaryColor,
            this.options.successColor,
            this.options.warningColor,
            this.options.errorColor
        ];
        return colors[index % colors.length];
    }
}

// CSS adicional para los gráficos
const chartStyles = `
    .hour-bar {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 80px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .hour-bar:hover {
        transform: scale(1.05);
    }

    .hour-bar-fill {
        width: 100%;
        background: var(--bg-tertiary);
        border-radius: 0.25rem 0.25rem 0 0;
        transition: all 0.3s ease;
        margin-top: auto;
        min-height: 2px;
        opacity: 0;
        transform: translateY(10px);
    }

    .hour-bar-fill--animated {
        opacity: 1;
        transform: translateY(0);
    }

    .hour-bar-fill--empty {
        background: var(--bg-tertiary);
    }

    .hour-bar-fill--low {
        background: #93c5fd;
    }

    .hour-bar-fill--medium {
        background: #60a5fa;
    }

    .hour-bar-fill--high {
        background: var(--accent-primary);
    }

    .hour-label {
        font-size: 0.75rem;
        color: var(--text-muted);
        margin-top: 0.5rem;
        font-weight: 500;
    }

    .hours-grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 0.5rem;
        padding: 1rem 0;
    }

    @media (max-width: 768px) {
        .hours-grid {
            grid-template-columns: repeat(6, 1fr);
            gap: 0.25rem;
        }

        .hour-bar {
            height: 60px;
        }

        .hour-label {
            font-size: 0.625rem;
        }
    }

    /* Dark theme adjustments */
    [data-theme="dark"] .hour-bar-fill--low {
        background: #475569;
    }

    [data-theme="dark"] .hour-bar-fill--medium {
        background: #64748b;
    }
`;

// Agregar estilos al documento
const chartStyleSheet = document.createElement('style');
chartStyleSheet.textContent = chartStyles;
document.head.appendChild(chartStyleSheet);

// Exportar clases para uso global
window.ActivityChart = ActivityChart;
window.HourlyChart = HourlyChart;
window.DonutChart = DonutChart;

console.log('📊 Charts components loaded successfully');
