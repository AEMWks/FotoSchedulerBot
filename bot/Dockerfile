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
    # Dependencias mínimas para OpenCV (solo las disponibles)
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    # Limpiar cache
 && rm -rf /var/lib/apt/lists/* \
 && apt-get clean

# Crear directorio para el bot
WORKDIR /app

# Copiar requirements.txt primero para aprovechar el cache de Docker
COPY requirements.txt .

# Instalar dependencias de Python
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el script
COPY bot.py .

# Variables de entorno
ENV PYTHONUNBUFFERED=1

# Crear carpeta para guardar fotos (ruta interna del contenedor)
RUN mkdir -p /data/fotos

# Variables de entorno necesarias (se pueden sobreescribir en docker-compose)
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_USER_ID=""

# Crear script de entrada para configurar permisos y umask
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "🚀 Iniciando bot de fotos..."\n\
\n\
# Configurar umask para que los archivos se creen con permisos correctos\n\
# umask 002 = archivos 664, directorios 775\n\
umask 002\n\
\n\
# Crear directorio base si no existe\n\
mkdir -p /data/fotos\n\
\n\
# Función para configurar permisos recursivamente\n\
setup_permissions() {\n\
    local dir="$1"\n\
    if [ -d "$dir" ]; then\n\
        echo "📁 Configurando permisos para: $dir"\n\
        \n\
        # Intentar obtener UID/GID de www-data, con fallback a 33:33\n\
        local wwwdata_uid=33\n\
        local wwwdata_gid=33\n\
        \n\
        if command -v id >/dev/null 2>&1; then\n\
            if id www-data >/dev/null 2>&1; then\n\
                wwwdata_uid=$(id -u www-data)\n\
                wwwdata_gid=$(id -g www-data)\n\
            fi\n\
        fi\n\
        \n\
        echo "👤 Configurando ownership a $wwwdata_uid:$wwwdata_gid (www-data)"\n\
        \n\
        # Configurar ownership y permisos\n\
        chown -R $wwwdata_uid:$wwwdata_gid "$dir" 2>/dev/null || {\n\
            echo "⚠️  No se pudo cambiar ownership, continuando..."\n\
        }\n\
        \n\
        # Configurar permisos: directorios 775, archivos 664\n\
        find "$dir" -type d -exec chmod 775 {} \\; 2>/dev/null || {\n\
            echo "⚠️  No se pudieron configurar permisos de directorios"\n\
        }\n\
        \n\
        find "$dir" -type f -exec chmod 664 {} \\; 2>/dev/null || {\n\
            echo "⚠️  No se pudieron configurar permisos de archivos"\n\
        }\n\
        \n\
        echo "✅ Permisos configurados para $dir"\n\
    else\n\
        echo "⚠️  Directorio $dir no encontrado, se creará cuando sea necesario"\n\
    fi\n\
}\n\
\n\
# Configurar permisos del directorio de fotos montado\n\
setup_permissions "/data/fotos"\n\
\n\
# Mostrar información del sistema\n\
echo "🔧 Información del sistema:"\n\
echo "   Usuario actual: $(id)"\n\
echo "   Umask actual: $(umask)"\n\
echo "   Directorio fotos: /data/fotos"\n\
echo "   Zona horaria: $TZ"\n\
\n\
# Verificar que el directorio de fotos es escribible\n\
if [ -w "/data/fotos" ]; then\n\
    echo "✅ Directorio /data/fotos es escribible"\n\
else\n\
    echo "❌ Directorio /data/fotos NO es escribible"\n\
    echo "   Intentando crear archivo de prueba..."\n\
    touch "/data/fotos/.test" 2>/dev/null && {\n\
        echo "✅ Archivo de prueba creado exitosamente"\n\
        rm "/data/fotos/.test"\n\
    } || {\n\
        echo "❌ No se puede escribir en /data/fotos"\n\
        echo "   Verifica los permisos del volumen montado"\n\
    }\n\
fi\n\
\n\
# Iniciar script de monitoreo de permisos en background\n\
echo "🔄 Iniciando monitoreo de permisos..."\n\
(\n\
    while true; do\n\
        sleep 60  # Verificar cada minuto\n\
        \n\
        if [ -d "/data/fotos" ]; then\n\
            # Buscar archivos con permisos incorrectos y corregirlos silenciosamente\n\
            find "/data/fotos" -type f ! -perm 664 -exec chmod 664 {} \\; 2>/dev/null || true\n\
            find "/data/fotos" -type d ! -perm 775 -exec chmod 775 {} \\; 2>/dev/null || true\n\
            \n\
            # Corregir ownership si es necesario (silenciosamente)\n\
            find "/data/fotos" \\( ! -user 33 -o ! -group 33 \\) -exec chown 33:33 {} \\; 2>/dev/null || true\n\
        fi\n\
    done\n\
) &\n\
\n\
echo "✅ Bot configurado correctamente. Iniciando aplicación..."\n\
\n\
# Ejecutar el bot con umask configurado\n\
exec python bot.py' > /entrypoint.sh

# Hacer ejecutable el script de entrada
RUN chmod +x /entrypoint.sh

# Crear directorio para logs si se necesita
RUN mkdir -p /var/log/bot && chmod 755 /var/log/bot

# Comando por defecto - usar el entrypoint
CMD ["/entrypoint.sh"]
