# shared/bot/Dockerfile - Bot optimizado para Synology NAS
FROM python:3.11-slim-bullseye

# Variables de optimización para NAS
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Optimizaciones de memoria para Python
    MALLOC_TRIM_THRESHOLD_=10000 \
    MALLOC_MMAP_THRESHOLD_=131072

# Instalar dependencias mínimas del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Dependencias para OpenCV (versión lite)
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgstreamer1.0-0 \
    libavcodec58 \
    libavformat58 \
    # Utilidades básicas
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/*

# Crear usuario no-root para seguridad (UID 33 = www-data)
RUN groupadd -g 33 appuser && useradd -r -u 33 -g appuser appuser

# Configurar directorio de trabajo
WORKDIR /app

# Copiar requirements primero (aprovecha cache de Docker)
COPY requirements.txt .

# Instalar dependencias Python optimizadas
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir \
        # Core dependencies optimizadas
        python-telegram-bot==20.8 \
        APScheduler==3.10.4 \
        # OpenCV headless (sin GUI, 90% menos tamaño)
        opencv-python-headless==4.8.1.78 \
        # Pillow optimizado
        Pillow==10.1.0 \
        # NumPy optimizado
        numpy==1.24.4 \
    && pip cache purge \
    # Limpiar archivos temporales de pip
    && find /usr/local -name "*.pyc" -delete \
    && find /usr/local -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# Copiar código del bot
COPY bot.py .

# Crear directorio de datos con permisos correctos
RUN mkdir -p /data/fotos \
    && chown -R appuser:appuser /app /data \
    && chmod -R 775 /data/fotos

# Cambiar al usuario no-root
USER appuser

# Health check optimizado para Container Manager
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import sys; sys.exit(0)" || exit 1

# Comando optimizado
CMD ["python", "-u", "bot.py"]
