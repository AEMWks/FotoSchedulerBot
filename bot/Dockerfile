FROM python:3.11-slim

# Configurar zona horaria
ENV TZ=Europe/Madrid
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Actualizar repositorios primero
RUN apt-get update

# Instalar solo dependencias básicas y disponibles
RUN apt-get install -y --no-install-recommends \
    curl \
    tzdata \
    build-essential \
    pkg-config \
    libjpeg62-turbo-dev \
    libpng-dev \
    libfreetype6-dev \
    zlib1g-dev \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Crear directorio para el bot
WORKDIR /app

# Copiar requirements.txt primero
COPY requirements.txt .

# Instalar dependencias de Python (sin OpenCV por ahora)
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir python-telegram-bot==20.8 APScheduler==3.10.4 Pillow==10.1.0

# Intentar instalar OpenCV, pero continuar si falla
RUN pip install --no-cache-dir opencv-python-headless==4.8.1.78 || \
    echo "⚠️ OpenCV no se pudo instalar, continuando sin validación de video"

# Copiar el script del bot
COPY bot.py .

# Variables de entorno
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Crear directorio de fotos
RUN mkdir -p /data/fotos

# Variables de entorno para tokens
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_USER_ID=""

# Script de entrada simplificado
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "🚀 Iniciando bot de fotos..."\n\
\n\
# Configurar umask\n\
umask 002\n\
\n\
# Crear y configurar directorio de fotos\n\
mkdir -p /data/fotos\n\
chown -R 33:33 /data/fotos 2>/dev/null || echo "⚠️ No se pudo cambiar ownership"\n\
chmod -R 775 /data/fotos 2>/dev/null || echo "⚠️ No se pudieron configurar permisos"\n\
\n\
# Verificar dependencias\n\
echo "📦 Verificando dependencias..."\n\
python3 -c "import telegram; print(\"✅ python-telegram-bot ok\")" || echo "❌ telegram error"\n\
python3 -c "from apscheduler.schedulers.asyncio import AsyncIOScheduler; print(\"✅ APScheduler ok\")" || echo "❌ scheduler error"\n\
python3 -c "from PIL import Image; print(\"✅ Pillow ok\")" || echo "⚠️ Pillow error"\n\
python3 -c "import cv2; print(\"✅ OpenCV ok\")" || echo "⚠️ OpenCV no disponible"\n\
\n\
# Verificar directorio escribible\n\
if [ -w "/data/fotos" ]; then\n\
    echo "✅ Directorio escribible"\n\
else\n\
    echo "❌ Directorio no escribible"\n\
fi\n\
\n\
# Monitoreo de permisos en background\n\
(\n\
    while true; do\n\
        sleep 60\n\
        find "/data/fotos" -type f ! -perm 664 -exec chmod 664 {} \\; 2>/dev/null || true\n\
        find "/data/fotos" -type d ! -perm 775 -exec chmod 775 {} \\; 2>/dev/null || true\n\
        find "/data/fotos" \\( ! -user 33 -o ! -group 33 \\) -exec chown 33:33 {} \\; 2>/dev/null || true\n\
    done\n\
) &\n\
\n\
echo "✅ Iniciando bot..."\n\
exec python3 bot.py' > /entrypoint.sh

# Hacer ejecutable
RUN chmod +x /entrypoint.sh

# Comando por defecto
CMD ["/entrypoint.sh"]
