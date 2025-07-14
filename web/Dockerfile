# web/Dockerfile - Optimizado para NAS con poca RAM
FROM php:8.1-apache

# Instalar solo extensiones esenciales
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    --no-install-recommends \
    && docker-php-ext-install zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Habilitar módulos necesarios para Apache
RUN a2enmod rewrite \
    && a2enmod headers \
    && a2enmod expires

# Configurar Apache para usar menos memoria
RUN sed -i 's/User .*/User www-data/' /etc/apache2/apache2.conf \
    && sed -i 's/Group .*/Group www-data/' /etc/apache2/apache2.conf

# Configuración optimizada de Apache para NAS
RUN echo "ServerLimit 2" >> /etc/apache2/apache2.conf \
    && echo "MaxRequestWorkers 8" >> /etc/apache2/apache2.conf \
    && echo "ThreadsPerChild 4" >> /etc/apache2/apache2.conf

# Configurar PHP para usar menos memoria
RUN echo "memory_limit = 128M" >> /usr/local/etc/php/conf.d/docker-php-ram-limit.ini \
    && echo "upload_max_filesize = 20M" >> /usr/local/etc/php/conf.d/docker-php-ram-limit.ini \
    && echo "post_max_size = 20M" >> /usr/local/etc/php/conf.d/docker-php-ram-limit.ini \
    && echo "max_execution_time = 60" >> /usr/local/etc/php/conf.d/docker-php-ram-limit.ini \
    && echo "max_input_time = 60" >> /usr/local/etc/php/conf.d/docker-php-ram-limit.ini

# Configurar Apache
COPY apache-config.conf /etc/apache2/sites-available/000-default.conf

# Copiar archivos de la aplicación
COPY public/ /var/www/html/
COPY .htaccess /var/www/html/
COPY api/ /var/www/html/api/

# Establecer permisos correctos
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Crear directorio de fotos
RUN mkdir -p /data/fotos \
    && chown -R www-data:www-data /data/fotos \
    && chmod -R 775 /data/fotos

# Script de inicio optimizado
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Configurar variables de entorno para Apache
ENV APACHE_RUN_USER=www-data \
    APACHE_RUN_GROUP=www-data \
    APACHE_LOG_DIR=/var/log/apache2 \
    APACHE_LOCK_DIR=/var/lock/apache2 \
    APACHE_PID_FILE=/var/run/apache2/apache2.pid

# Crear directorios necesarios
RUN mkdir -p /var/run/apache2 /var/lock/apache2 /var/log/apache2 \
    && chown -R www-data:www-data /var/run/apache2 /var/lock/apache2 /var/log/apache2

EXPOSE 80

CMD ["/entrypoint.sh"]
