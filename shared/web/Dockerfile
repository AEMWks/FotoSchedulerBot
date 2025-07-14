# shared/web/Dockerfile - Web ESPECÍFICO para Synology NAS
FROM php:8.1-apache-bullseye

# Variables de entorno para NAS
ENV DEBIAN_FRONTEND=noninteractive \
    APACHE_RUN_USER=www-data \
    APACHE_RUN_GROUP=www-data \
    APACHE_LOG_DIR=/var/log/apache2 \
    APACHE_LOCK_DIR=/var/lock/apache2 \
    APACHE_PID_FILE=/var/run/apache2/apache2.pid \
    # Variables para compatibilidad NAS
    PUID=33 \
    PGID=33

# Instalar extensiones PHP necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Dependencias para procesamiento de imágenes
    libzip-dev \
    libjpeg62-turbo-dev \
    libpng-dev \
    libwebp-dev \
    # Utilidades básicas
    zip \
    unzip \
    curl \
    ca-certificates \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
        zip \
        gd \
        exif \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/* /tmp/*

# Habilitar módulos Apache
RUN a2enmod rewrite headers expires deflate

# Configuración Apache optimizada para NAS (recursos limitados)
RUN echo "# Configuración Apache para NAS Synology" >> /etc/apache2/apache2.conf \
    && echo "ServerLimit 2" >> /etc/apache2/apache2.conf \
    && echo "MaxRequestWorkers 8" >> /etc/apache2/apache2.conf \
    && echo "ThreadsPerChild 4" >> /etc/apache2/apache2.conf \
    && echo "StartServers 1" >> /etc/apache2/apache2.conf \
    && echo "MinSpareThreads 2" >> /etc/apache2/apache2.conf \
    && echo "MaxSpareThreads 4" >> /etc/apache2/apache2.conf \
    && echo "KeepAlive Off" >> /etc/apache2/apache2.conf \
    && echo "ServerTokens Prod" >> /etc/apache2/apache2.conf \
    && echo "ServerSignature Off" >> /etc/apache2/apache2.conf

# Configuración PHP para NAS
RUN echo "# PHP optimizado para NAS" > /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "memory_limit = 128M" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "upload_max_filesize = 20M" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "post_max_size = 20M" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "max_execution_time = 60" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "max_input_time = 60" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "max_input_vars = 1000" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "opcache.enable = 1" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "opcache.memory_consumption = 32" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "opcache.max_accelerated_files = 2000" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "opcache.validate_timestamps = 0" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "log_errors = On" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "error_log = /var/log/apache2/php_errors.log" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini

# Configuración VirtualHost básica para NAS
RUN echo '<VirtualHost *:80>' > /etc/apache2/sites-available/000-default.conf \
    && echo '    ServerAdmin admin@localhost' >> /etc/apache2/sites-available/000-default.conf \
    && echo '    DocumentRoot /var/www/html' >> /etc/apache2/sites-available/000-default.conf \
    && echo '    DirectoryIndex index.html index.php' >> /etc/apache2/sites-available/000-default.conf \
    && echo '    ErrorLog ${APACHE_LOG_DIR}/error.log' >> /etc/apache2/sites-available/000-default.conf \
    && echo '    CustomLog ${APACHE_LOG_DIR}/access.log combined' >> /etc/apache2/sites-available/000-default.conf \
    && echo '    <Directory /var/www/html>' >> /etc/apache2/sites-available/000-default.conf \
    && echo '        Options -Indexes +FollowSymLinks' >> /etc/apache2/sites-available/000-default.conf \
    && echo '        AllowOverride All' >> /etc/apache2/sites-available/000-default.conf \
    && echo '        Require all granted' >> /etc/apache2/sites-available/000-default.conf \
    && echo '    </Directory>' >> /etc/apache2/sites-available/000-default.conf \
    && echo '</VirtualHost>' >> /etc/apache2/sites-available/000-default.conf

# Copiar archivos de la aplicación
COPY public/ /var/www/html/
COPY api/ /var/www/html/api/

# Crear .htaccess básico si no existe
RUN echo 'RewriteEngine On' > /var/www/html/.htaccess \
    && echo 'RewriteCond %{REQUEST_FILENAME} !-f' >> /var/www/html/.htaccess \
    && echo 'RewriteCond %{REQUEST_FILENAME} !-d' >> /var/www/html/.htaccess \
    && echo 'RewriteRule ^api/(.*)$ api/index.php?route=$1 [QSA,L]' >> /var/www/html/.htaccess

# CRÍTICO para NAS: Crear directorios básicos sin intentar cambiar ownership
RUN mkdir -p /var/run/apache2 /var/lock/apache2 /var/log/apache2

# Script de entrada compatible con NAS
RUN echo '#!/bin/bash' > /entrypoint.sh \
    && echo 'set -e' >> /entrypoint.sh \
    && echo 'echo "=== Web server iniciando en NAS Synology ==="' >> /entrypoint.sh \
    && echo 'echo "Usuario actual: $(whoami) ($(id))"' >> /entrypoint.sh \
    && echo 'echo "Directorio web: /var/www/html"' >> /entrypoint.sh \
    && echo 'echo "Directorio fotos: ${PHOTOS_PATH:-/data/fotos}"' >> /entrypoint.sh \
    && echo '# Verificar montaje sin intentar modificarlo' >> /entrypoint.sh \
    && echo 'if [ -d "${PHOTOS_PATH:-/data/fotos}" ]; then' >> /entrypoint.sh \
    && echo '    echo "✅ Directorio de fotos montado correctamente"' >> /entrypoint.sh \
    && echo '    ls -la "${PHOTOS_PATH:-/data/fotos}" | head -3' >> /entrypoint.sh \
    && echo 'else' >> /entrypoint.sh \
    && echo '    echo "⚠️  Directorio de fotos no encontrado: ${PHOTOS_PATH:-/data/fotos}"' >> /entrypoint.sh \
    && echo 'fi' >> /entrypoint.sh \
    && echo '# Verificar archivos web' >> /entrypoint.sh \
    && echo 'echo "Archivos web disponibles:"' >> /entrypoint.sh \
    && echo 'ls -la /var/www/html/ | head -5' >> /entrypoint.sh \
    && echo 'echo "=== Iniciando Apache ==="' >> /entrypoint.sh \
    && echo 'exec apache2-foreground' >> /entrypoint.sh \
    && chmod +x /entrypoint.sh

# Health check para Container Manager
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Puerto estándar
EXPOSE 80

# IMPORTANTE: NO especificar USER en NAS
# Container Manager maneja los permisos automáticamente

# Comando de inicio
CMD ["/entrypoint.sh"]
