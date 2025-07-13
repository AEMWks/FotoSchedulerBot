# web/Dockerfile
FROM php:8.2-apache

# Instalar extensiones necesarias
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    inotify-tools \
    && docker-php-ext-install zip \
    && rm -rf /var/lib/apt/lists/*

# Habilitar módulos necesarios para Apache
RUN a2enmod rewrite
RUN a2enmod headers

# Configurar Apache para ejecutarse como www-data
RUN sed -i 's/User .*/User www-data/' /etc/apache2/apache2.conf
RUN sed -i 's/Group .*/Group www-data/' /etc/apache2/apache2.conf

# Configurar Apache
COPY apache-config.conf /etc/apache2/sites-available/000-default.conf

# Copiar archivos de la aplicación
COPY index.html /var/www/html/
COPY .htaccess /var/www/html/
COPY api/ /var/www/html/api/

# Establecer permisos correctos para los archivos web
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

# Crear directorio de fotos con permisos correctos
RUN mkdir -p /data/fotos
RUN chown -R www-data:www-data /data/fotos
RUN chmod -R 775 /data/fotos

# Configurar directorio temporal con permisos correctos
RUN mkdir -p /tmp/apache-tmp
RUN chown -R www-data:www-data /tmp/apache-tmp

# Script para ajustar permisos al iniciar
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Crear un script de inicio que configure permisos y ejecute como www-data
RUN echo '#!/bin/bash\n\
# Configurar umask para que los archivos se creen con permisos correctos\n\
umask 002\n\
\n\
# Ejecutar entrypoint como root para configurar permisos\n\
/entrypoint.sh &\n\
\n\
# Esperar un momento para que se configuren los permisos\n\
sleep 2\n\
\n\
# Ejecutar Apache como www-data\n\
exec gosu www-data apache2-foreground' > /start.sh

# Instalar gosu para cambiar de usuario de forma segura
RUN apt-get update && apt-get install -y gosu && rm -rf /var/lib/apt/lists/*

# Hacer ejecutable el script de inicio
RUN chmod +x /start.sh

# Configurar variables de entorno para Apache
ENV APACHE_RUN_USER=www-data
ENV APACHE_RUN_GROUP=www-data
ENV APACHE_LOG_DIR=/var/log/apache2
ENV APACHE_LOCK_DIR=/var/lock/apache2
ENV APACHE_PID_FILE=/var/run/apache2/apache2.pid

# Crear directorios necesarios para Apache
RUN mkdir -p /var/run/apache2 /var/lock/apache2 /var/log/apache2
RUN chown -R www-data:www-data /var/run/apache2 /var/lock/apache2 /var/log/apache2

# Exponer puerto 80
EXPOSE 80

# El contenedor se ejecutará como www-data cuando se use user: "33:33" en docker-compose
# pero el entrypoint necesita ejecutarse como root para configurar permisos
CMD ["/entrypoint.sh"]
