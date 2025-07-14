# shared/web/Dockerfile - CORREGIDO para Synology NAS
FROM php:8.1-apache-bullseye

# Variables de entorno para NAS
ENV DEBIAN_FRONTEND=noninteractive \
    APACHE_RUN_USER=www-data \
    APACHE_RUN_GROUP=www-data \
    APACHE_LOG_DIR=/var/log/apache2 \
    APACHE_LOCK_DIR=/var/lock/apache2 \
    APACHE_PID_FILE=/var/run/apache2/apache2.pid \
    PUID=33 \
    PGID=33

# Instalar extensiones PHP necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    libzip-dev \
    libjpeg62-turbo-dev \
    libpng-dev \
    libwebp-dev \
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

# Habilitar módulos Apache necesarios
RUN a2enmod rewrite headers expires deflate

# CONFIGURACIÓN APACHE CORREGIDA PARA MPM_PREFORK
# (PHP-Apache usa prefork, NO worker ni event)
RUN echo "# Configuración Apache para NAS Synology con mpm_prefork" >> /etc/apache2/apache2.conf \
    && echo "ServerName localhost" >> /etc/apache2/apache2.conf \
    && echo "ServerLimit 4" >> /etc/apache2/apache2.conf \
    && echo "MaxRequestWorkers 20" >> /etc/apache2/apache2.conf \
    && echo "StartServers 2" >> /etc/apache2/apache2.conf \
    && echo "MinSpareServers 2" >> /etc/apache2/apache2.conf \
    && echo "MaxSpareServers 4" >> /etc/apache2/apache2.conf \
    && echo "MaxConnectionsPerChild 1000" >> /etc/apache2/apache2.conf \
    && echo "KeepAlive Off" >> /etc/apache2/apache2.conf \
    && echo "ServerTokens Prod" >> /etc/apache2/apache2.conf \
    && echo "ServerSignature Off" >> /etc/apache2/apache2.conf

# Configuración PHP optimizada para NAS
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

# Configuración VirtualHost limpia para NAS
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
    && echo '    <Directory /data/fotos>' >> /etc/apache2/sites-available/000-default.conf \
    && echo '        Options Indexes FollowSymLinks' >> /etc/apache2/sites-available/000-default.conf \
    && echo '        AllowOverride None' >> /etc/apache2/sites-available/000-default.conf \
    && echo '        Require all granted' >> /etc/apache2/sites-available/000-default.conf \
    && echo '    </Directory>' >> /etc/apache2/sites-available/000-default.conf \
    && echo '    Alias /photos /data/fotos' >> /etc/apache2/sites-available/000-default.conf \
    && echo '</VirtualHost>' >> /etc/apache2/sites-available/000-default.conf

# Copiar archivos de la aplicación (debes tener estos directorios)
COPY public/ /var/www/html/
COPY api/ /var/www/html/api/

# Crear .htaccess básico para enrutamiento de API
RUN echo 'RewriteEngine On' > /var/www/html/.htaccess \
    && echo 'RewriteCond %{REQUEST_FILENAME} !-f' >> /var/www/html/.htaccess \
    && echo 'RewriteCond %{REQUEST_FILENAME} !-d' >> /var/www/html/.htaccess \
    && echo 'RewriteRule ^api/(.*)$ api/index.php?route=$1 [QSA,L]' >> /var/www/html/.htaccess

# Crear directorios necesarios para Apache
RUN mkdir -p /var/run/apache2 /var/lock/apache2 /var/log/apache2

# Script de entrada mejorado
RUN echo '#!/bin/bash' > /entrypoint.sh \
    && echo 'set -e' >> /entrypoint.sh \
    && echo 'echo "=== Iniciando servidor web en NAS Synology ==="' >> /entrypoint.sh \
    && echo 'echo "Usuario: $(whoami) ($(id))"' >> /entrypoint.sh \
    && echo 'echo "Directorio web: /var/www/html"' >> /entrypoint.sh \
    && echo 'echo "Directorio fotos: ${PHOTOS_PATH:-/data/fotos}"' >> /entrypoint.sh \
    && echo '# Verificar montaje de fotos' >> /entrypoint.sh \
    && echo 'if [ -d "${PHOTOS_PATH:-/data/fotos}" ]; then' >> /entrypoint.sh \
    && echo '    echo "✅ Directorio de fotos encontrado"' >> /entrypoint.sh \
    && echo '    ls -la "${PHOTOS_PATH:-/data/fotos}" 2>/dev/null | head -3 || echo "Sin contenido aún"' >> /entrypoint.sh \
    && echo 'else' >> /entrypoint.sh \
    && echo '    echo "⚠️  Directorio de fotos no montado: ${PHOTOS_PATH:-/data/fotos}"' >> /entrypoint.sh \
    && echo 'fi' >> /entrypoint.sh \
    && echo '# Verificar configuración Apache' >> /entrypoint.sh \
    && echo 'echo "Verificando configuración Apache..."' >> /entrypoint.sh \
    && echo 'apache2ctl configtest || (echo "❌ Error en configuración Apache" && exit 1)' >> /entrypoint.sh \
    && echo 'echo "✅ Configuración Apache OK"' >> /entrypoint.sh \
    && echo 'echo "🚀 Iniciando Apache..."' >> /entrypoint.sh \
    && echo 'exec apache2-foreground' >> /entrypoint.sh \
    && chmod +x /entrypoint.sh

# Health check para Container Manager
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Puerto estándar
EXPOSE 80

# Comando de inicio
CMD ["/entrypoint.sh"]
