# shared/web/Dockerfile - Web optimizada para Synology NAS
FROM php:8.1-apache-bullseye

# Variables de optimización
ENV DEBIAN_FRONTEND=noninteractive \
    APACHE_RUN_USER=www-data \
    APACHE_RUN_GROUP=www-data \
    APACHE_LOG_DIR=/var/log/apache2 \
    APACHE_LOCK_DIR=/var/lock/apache2 \
    APACHE_PID_FILE=/var/run/apache2/apache2.pid

# Instalar extensiones PHP mínimas necesarias
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
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
        zip \
        gd \
        exif \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/*

# Habilitar módulos Apache necesarios
RUN a2enmod rewrite headers expires deflate

# Configuración optimizada de Apache para NAS (poca RAM)
RUN echo "# Configuración optimizada para NAS Synology" >> /etc/apache2/apache2.conf \
    && echo "ServerLimit 2" >> /etc/apache2/apache2.conf \
    && echo "MaxRequestWorkers 8" >> /etc/apache2/apache2.conf \
    && echo "ThreadsPerChild 4" >> /etc/apache2/apache2.conf \
    && echo "StartServers 1" >> /etc/apache2/apache2.conf \
    && echo "MinSpareThreads 2" >> /etc/apache2/apache2.conf \
    && echo "MaxSpareThreads 4" >> /etc/apache2/apache2.conf \
    && echo "KeepAlive Off" >> /etc/apache2/apache2.conf

# Configurar PHP optimizado para NAS
RUN echo "# Configuración PHP optimizada para NAS" > /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "memory_limit = 128M" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "upload_max_filesize = 20M" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "post_max_size = 20M" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "max_execution_time = 60" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "max_input_time = 60" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "max_input_vars = 1000" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "opcache.enable = 1" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "opcache.memory_consumption = 32" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "opcache.max_accelerated_files = 2000" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini \
    && echo "opcache.validate_timestamps = 0" >> /usr/local/etc/php/conf.d/99-nas-optimization.ini

# Configuración optimizada de Apache VirtualHost
COPY apache-config.conf /etc/apache2/sites-available/000-default.conf

# Copiar archivos de la aplicación web
COPY public/ /var/www/html/
COPY .htaccess /var/www/html/
COPY api/ /var/www/html/api/

# Crear directorio de datos y establecer permisos
RUN mkdir -p /data/fotos /var/run/apache2 /var/lock/apache2 /var/log/apache2 \
    && chown -R www-data:www-data /var/www/html /data/fotos /var/run/apache2 /var/lock/apache2 /var/log/apache2 \
    && chmod -R 755 /var/www/html \
    && chmod -R 775 /data/fotos

# Script de inicio optimizado
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && chown root:root /entrypoint.sh

# Health check para Container Manager
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Exponer puerto
EXPOSE 80

# Usuario por defecto
USER www-data

# Comando de inicio
CMD ["/entrypoint.sh"]
