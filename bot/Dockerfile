# bot/Dockerfile - Optimizado para NAS con poca RAM
FROM python:3.11-slim

# Instalar dependencias del sistema (mínimas)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario no-root para seguridad
RUN groupadd -r botuser && useradd -r -g botuser -u 33 botuser

# Configurar directorio de trabajo
WORKDIR /app

# Copiar requirements primero para aprovechar cache de Docker
COPY requirements.txt .

# Instalar dependencias Python con optimizaciones para RAM
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip cache purge

# Copiar código del bot
COPY bot.py .

# Crear directorio de datos con permisos correctos
RUN mkdir -p /data/fotos \
    && chown -R botuser:botuser /data/fotos \
    && chmod -R 775 /data/fotos

# Cambiar al usuario no-root
USER botuser

# Variables de entorno para optimización
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONIOENCODING=utf-8 \
    # Optimizaciones para reducir uso de memoria
    MALLOC_TRIM_THRESHOLD_=10000 \
    MALLOC_MMAP_THRESHOLD_=131072

# Comando por defecto
CMD ["python", "bot.py"]
