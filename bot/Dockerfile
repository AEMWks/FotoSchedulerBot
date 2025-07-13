FROM python:3.11-slim

# Configurar zona horaria
ENV TZ=Europe/Madrid
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Actualizar repositorios e instalar dependencias básicas
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tzdata \
    # Dependencias básicas para Python
    build-essential \
    pkg-config \
    # Dependencias para PIL/Pillow
    libjpeg62-turbo-dev \
    libpng-dev \
    # Dependencias mínimas para OpenCV
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libgthread-2.0-0 \
    libavformat58 \
    libavcodec58 \
    libswscale5 \
    libgtk-3-0 \
    # Limpiar cache
 && rm -rf /var/lib/apt/lists/* \
 && apt-get clean

# Crear directorio para el bot
WORKDIR /app

# Copiar requirements.txt primero para aprovechar el cache de Docker
COPY requirements.txt .

# Instalar dependencias de Python con manejo de errores
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt || { \
        echo "Error instalando algunas dependencias, continuando..."; \
        pip install --no-cache-dir python-telegram-bot==20.8 APScheduler==3.10.4 Pillow==10.1.0; \
    }

# Copiar el script
COPY bot.py .

# Variables de entorno
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Crear carpeta para guardar fotos (ruta interna del contenedor)
RUN mkdir -p /data/fotos

# Variables de entorno necesarias (se pueden sobreescribir en docker-compose)
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_USER_ID=""

# Crear script de entrada mejorado
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "🚀 Iniciando bot de fotos..."\n\
\n\
# Configurar umask para que los archivos se creen con permisos correctos\n\
umask 002\n\
\n\
# Crear directorio base si no existe\n\
mkdir -p /data/fotos\n\
\n\
# Función para configurar permisos\n\
setup_permissions() {\n\
    local dir="$1"\n\
    if [ -d "$dir" ]; then\n\
        echo "📁 Configurando permisos para: $dir"\n\
        \n\
        local wwwdata_uid=33\n\
        local wwwdata_gid=33\n\
        \n\
        chown -R $wwwdata_uid:$wwwdata_gid "$dir" 2>/dev/null || {\n\
            echo "⚠️  No se pudo cambiar ownership, continuando..."\n\
        }\n\
        \n\
        find "$dir" -type d -exec chmod 775 {} \\; 2>/dev/null || true\n\
        find "$dir" -type f -exec chmod 664 {} \\; 2>/dev/null || true\n\
        \n\
        echo "✅ Permisos configurados para $dir"\n\
    fi\n\
}\n\
\n\
# Configurar permisos del directorio de fotos\n\
setup_permissions "/data/fotos"\n\
\n\
# Mostrar información del sistema\n\
echo "🔧 Información del sistema:"\n\
echo "   Usuario actual: $(id)"\n\
echo "   Umask actual: $(umask)"\n\
echo "   Directorio fotos: /data/fotos"\n\
echo "   Zona horaria: $TZ"\n\
\n\
# Verificar dependencias de Python\n\
echo "📦 Verificando dependencias..."\n\
python3 -c "import telegram; print(\"✅ python-telegram-bot ok\")" 2>/dev/null || echo "❌ python-telegram-bot error"\n\
python3 -c "from apscheduler.schedulers.asyncio import AsyncIOScheduler; print(\"✅ APScheduler ok\")" 2>/dev/null || echo "❌ APScheduler error"\n\
python3 -c "from PIL import Image; print(\"✅ Pillow ok\")" 2>/dev/null || echo "⚠️ Pillow no disponible"\n\
python3 -c "import cv2; print(\"✅ OpenCV ok\")" 2>/dev/null || echo "⚠️ OpenCV no disponible"\n\
\n\
# Verificar directorio escribible\n\
if [ -w "/data/fotos" ]; then\n\
    echo "✅ Directorio /data/fotos escribible"\n\
    touch "/data/fotos/.test" 2>/dev/null && rm "/data/fotos/.test" && echo "✅ Test escritura ok" || echo "⚠️ Test escritura falló"\n\
else\n\
    echo "❌ Directorio /data/fotos NO escribible"\n\
fi\n\
\n\
# Monitoreo de permisos en background\n\
(\n\
    while true; do\n\
        sleep 60\n\
        if [ -d "/data/fotos" ]; then\n\
            find "/data/fotos" -type f ! -perm 664 -exec chmod 664 {} \\; 2>/dev/null || true\n\
            find "/data/fotos" -type d ! -perm 775 -exec chmod 775 {} \\; 2>/dev/null || true\n\
            find "/data/fotos" \\( ! -user 33 -o ! -group 33 \\) -exec chown 33:33 {} \\; 2>/dev/null || true\n\
        fi\n\
    done\n\
) &\n\
\n\
echo "✅ Iniciando bot..."\n\
exec python3 bot.py' > /entrypoint.sh

# Hacer ejecutable el script
RUN chmod +x /entrypoint.sh

# Comando por defecto
CMD ["/entrypoint.sh"]
