# shared/bot/Dockerfile - Bot ESPECÍFICO para Synology NAS
FROM python:3.11-slim-bullseye

# Variables de entorno optimizadas para NAS
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Optimizaciones de memoria críticas para NAS
    MALLOC_TRIM_THRESHOLD_=10000 \
    MALLOC_MMAP_THRESHOLD_=131072 \
    # Variables para compatibilidad NAS
    PUID=33 \
    PGID=33

# Instalar dependencias del sistema de forma segura
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Dependencias mínimas para OpenCV
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgstreamer1.0-0 \
    libavcodec58 \
    libavformat58 \
    # Herramientas básicas
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/* /tmp/*

# CRÍTICO: No crear usuarios personalizados en NAS
# El sistema del NAS maneja esto automáticamente

# Directorio de trabajo
WORKDIR /app

# Copiar requirements y instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir \
        python-telegram-bot==20.8 \
        APScheduler==3.10.4 \
        opencv-python-headless==4.8.1.78 \
        Pillow==10.1.0 \
        numpy==1.24.4 \
    && pip cache purge \
    && find /usr/local -name "*.pyc" -delete \
    && find /usr/local -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# Copiar código de la aplicación
COPY bot.py .

# CRÍTICO para NAS: No intentar cambiar ownership ni crear directorios
# Esto lo maneja el sistema de montaje del NAS

# Crear script de entrada compatible con NAS
RUN echo '#!/bin/bash' > /entrypoint.sh \
    && echo 'set -e' >> /entrypoint.sh \
    && echo 'echo "=== Bot iniciando en NAS Synology ==="' >> /entrypoint.sh \
    && echo 'echo "Directorio de datos: ${DATA_PATH:-/data/fotos}"' >> /entrypoint.sh \
    && echo 'echo "Usuario actual: $(whoami) ($(id))"' >> /entrypoint.sh \
    && echo '# Verificar acceso al directorio sin intentar cambiarlo' >> /entrypoint.sh \
    && echo 'if [ -d "${DATA_PATH:-/data/fotos}" ]; then' >> /entrypoint.sh \
    && echo '    echo "✅ Directorio de datos accesible"' >> /entrypoint.sh \
    && echo '    ls -la "${DATA_PATH:-/data/fotos}" | head -3' >> /entrypoint.sh \
    && echo 'else' >> /entrypoint.sh \
    && echo '    echo "⚠️  Directorio de datos no montado: ${DATA_PATH:-/data/fotos}"' >> /entrypoint.sh \
    && echo 'fi' >> /entrypoint.sh \
    && echo '# Crear archivo de health check' >> /entrypoint.sh \
    && echo 'touch /tmp/bot_running' >> /entrypoint.sh \
    && echo 'echo "=== Iniciando aplicación ==="' >> /entrypoint.sh \
    && echo 'exec python -u bot.py' >> /entrypoint.sh \
    && chmod +x /entrypoint.sh

# Health check compatible con Container Manager
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import os; exit(0 if os.path.exists('/tmp/bot_running') else 1)" || exit 1

# Puerto para health check (aunque no se use)
EXPOSE 8000

# IMPORTANTE: NO cambiar a usuario específico en NAS
# Container Manager maneja esto automáticamente

# Comando de inicio
CMD ["/entrypoint.sh"]
