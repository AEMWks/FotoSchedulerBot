#!/bin/bash
# migrate-to-separated.sh - Script de migración automática

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════╗"
echo "║    🔄 Migración a Compose Separado    ║"
echo "║        Optimizado para NAS 🚀          ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Función para verificar pre-requisitos
check_prerequisites() {
    echo -e "${BLUE}🔍 Verificando pre-requisitos...${NC}"

    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker no está instalado${NC}"
        exit 1
    fi

    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose no está instalado${NC}"
        exit 1
    fi

    # Verificar .env
    if [ ! -f .env ]; then
        echo -e "${RED}❌ Archivo .env no encontrado${NC}"
        echo -e "${YELLOW}💡 Asegúrate de estar en el directorio correcto${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Pre-requisitos verificados${NC}"
}

# Función para hacer backup
make_backup() {
    echo -e "${BLUE}📦 Creando backup de configuración actual...${NC}"

    BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    # Backup de archivos existentes
    [ -f compose.yml ] && cp compose.yml "$BACKUP_DIR/"
    [ -f docker-compose.yml ] && cp docker-compose.yml "$BACKUP_DIR/"
    [ -f web/Dockerfile ] && cp web/Dockerfile "$BACKUP_DIR/Dockerfile.web"
    [ -f bot/Dockerfile ] && cp bot/Dockerfile "$BACKUP_DIR/Dockerfile.bot"

    echo -e "${GREEN}✅ Backup creado en $BACKUP_DIR${NC}"
}

# Función para detener servicios actuales
stop_current_services() {
    echo -e "${YELLOW}🛑 Deteniendo servicios actuales...${NC}"

    # Intentar con diferentes nombres de archivo
    for compose_file in compose.yml docker-compose.yml; do
        if [ -f "$compose_file" ]; then
            docker-compose -f "$compose_file" down 2>/dev/null || true
        fi
    done

    echo -e "${GREEN}✅ Servicios detenidos${NC}"
}

# Función para crear archivos de configuración
create_compose_files() {
    echo -e "${BLUE}📝 Creando archivos de configuración separados...${NC}"

    # Crear docker-compose.bot.yml
    cat > docker-compose.bot.yml << 'EOF'
# docker-compose.bot.yml - Solo el bot de Telegram
version: '3.8'

services:
  nas-photo-bot:
    build: ./bot
    container_name: ${CONTAINER_NAME:-nas-photo-bot}
    env_file:
      - .env
    environment:
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_USER_ID: ${TELEGRAM_USER_ID}
      TZ: ${TZ:-Europe/Madrid}
      UMASK: "002"
    volumes:
      - ${HOST_DATA_PATH}:${DATA_PATH:-/data/fotos}
    restart: unless-stopped
    # Configuración optimizada para NAS con poca RAM
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.5'
        reservations:
          memory: 128M
          cpus: '0.2'
    # Configuración de logging para reducir I/O
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    # No crear red si no es necesario (usa red por defecto)
    network_mode: bridge
EOF

    # Crear docker-compose.web.yml
    cat > docker-compose.web.yml << 'EOF'
# docker-compose.web.yml - Solo la interfaz web
version: '3.8'

services:
  photo-diary-web:
    build: ./web
    container_name: ${WEB_CONTAINER_NAME:-photo-diary-web}
    ports:
      - "${WEB_PORT:-8090}:80"
    environment:
      TZ: ${TZ:-Europe/Madrid}
      PHOTOS_PATH: ${DATA_PATH:-/data/fotos}
      # Configuración optimizada para Apache en NAS
      APACHE_RUN_USER: "#33"
      APACHE_RUN_GROUP: "#33"
      # Limitar uso de memoria de PHP
      PHP_MEMORY_LIMIT: 128M
      PHP_MAX_UPLOAD_SIZE: 20M
      PHP_MAX_POST_SIZE: 20M
    volumes:
      - ${HOST_DATA_PATH}:${DATA_PATH:-/data/fotos}:ro  # Solo lectura para la web
    restart: unless-stopped
    # Configuración optimizada para NAS con poca RAM
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
        reservations:
          memory: 256M
          cpus: '0.3'
    # Configuración de logging para reducir I/O
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    # No crear red si no es necesario (usa red por defecto)
    network_mode: bridge
EOF

    echo -e "${GREEN}✅ Archivos de configuración creados${NC}"
}

# Función para actualizar Dockerfiles
update_dockerfiles() {
    echo -e "${BLUE}🔧 Actualizando Dockerfiles optimizados...${NC}"

    # Backup de Dockerfiles existentes
    [ -f web/Dockerfile ] && cp web/Dockerfile web/Dockerfile.backup
    [ -f bot/Dockerfile ] && cp bot/Dockerfile bot/Dockerfile.backup

    # Actualizar web/Dockerfile
    cat > web/Dockerfile << 'EOF'
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
EOF

    # Actualizar bot/Dockerfile
    cat > bot/Dockerfile << 'EOF'
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
EOF

    echo -e "${GREEN}✅ Dockerfiles actualizados${NC}"
}

# Función para crear scripts de gestión
create_management_scripts() {
    echo -e "${BLUE}🛠️ Creando scripts de gestión...${NC}"

    mkdir -p scripts

    # Crear script principal de gestión
    cat > scripts/manage.sh << 'EOF'
#!/bin/bash
# scripts/manage.sh - Gestión separada de servicios

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar ayuda
show_help() {
    echo -e "${BLUE}🐳 Gestión de Servicios del Diario Visual${NC}"
    echo ""
    echo "Uso: $0 [COMANDO] [SERVICIO]"
    echo ""
    echo -e "${YELLOW}COMANDOS:${NC}"
    echo "  start    - Iniciar servicios"
    echo "  stop     - Detener servicios"
    echo "  restart  - Reiniciar servicios"
    echo "  build    - Construir imágenes"
    echo "  logs     - Ver logs"
    echo "  status   - Ver estado"
    echo "  cleanup  - Limpiar recursos no usados"
    echo ""
    echo -e "${YELLOW}SERVICIOS:${NC}"
    echo "  bot      - Solo el bot de Telegram"
    echo "  web      - Solo la interfaz web"
    echo "  all      - Ambos servicios (por defecto)"
    echo ""
    echo -e "${YELLOW}EJEMPLOS:${NC}"
    echo "  $0 start bot      # Iniciar solo el bot"
    echo "  $0 restart web    # Reiniciar solo la web"
    echo "  $0 logs all       # Ver logs de ambos"
    echo "  $0 build          # Construir todas las imágenes"
}

# Función para verificar .env
check_env() {
    if [ ! -f .env ]; then
        echo -e "${RED}❌ Archivo .env no encontrado${NC}"
        echo -e "${YELLOW}💡 Copia .env.example a .env y configúralo${NC}"
        exit 1
    fi

    # Verificar variables críticas
    source .env
    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_USER_ID" ] || [ -z "$HOST_DATA_PATH" ]; then
        echo -e "${RED}❌ Variables críticas faltantes en .env${NC}"
        echo -e "${YELLOW}💡 Revisa TELEGRAM_BOT_TOKEN, TELEGRAM_USER_ID y HOST_DATA_PATH${NC}"
        exit 1
    fi

    # Verificar directorio de fotos
    if [ ! -d "$HOST_DATA_PATH" ]; then
        echo -e "${YELLOW}⚠️  Directorio $HOST_DATA_PATH no existe, creándolo...${NC}"
        mkdir -p "$HOST_DATA_PATH"
        sudo chown -R 33:33 "$HOST_DATA_PATH" 2>/dev/null || true
        sudo chmod -R 775 "$HOST_DATA_PATH" 2>/dev/null || true
    fi
}

# Función para obtener archivo compose
get_compose_file() {
    case $1 in
        "bot")
            echo "docker-compose.bot.yml"
            ;;
        "web")
            echo "docker-compose.web.yml"
            ;;
        "all"|"")
            echo "docker-compose.bot.yml docker-compose.web.yml"
            ;;
        *)
            echo -e "${RED}❌ Servicio desconocido: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Función para ejecutar comando
run_command() {
    local command=$1
    local service=$2
    local compose_files=$(get_compose_file $service)

    check_env

    case $command in
        "start")
            echo -e "${GREEN}🚀 Iniciando servicios...${NC}"
            for file in $compose_files; do
                docker-compose -f $file up -d
            done
            echo -e "${GREEN}✅ Servicios iniciados${NC}"
            ;;
        "stop")
            echo -e "${YELLOW}🛑 Deteniendo servicios...${NC}"
            for file in $compose_files; do
                docker-compose -f $file down
            done
            echo -e "${GREEN}✅ Servicios detenidos${NC}"
            ;;
        "restart")
            echo -e "${YELLOW}🔄 Reiniciando servicios...${NC}"
            for file in $compose_files; do
                docker-compose -f $file down
                docker-compose -f $file up -d
            done
            echo -e "${GREEN}✅ Servicios reiniciados${NC}"
            ;;
        "build")
            echo -e "${BLUE}🔨 Construyendo imágenes...${NC}"
            for file in $compose_files; do
                docker-compose -f $file build --no-cache
            done
            echo -e "${GREEN}✅ Imágenes construidas${NC}"
            ;;
        "logs")
            echo -e "${BLUE}📋 Mostrando logs...${NC}"
            for file in $compose_files; do
                echo -e "${YELLOW}--- Logs de $file ---${NC}"
                docker-compose -f $file logs --tail=50 -f &
            done
            wait
            ;;
        "status")
            echo -e "${BLUE}📊 Estado de servicios:${NC}"
            for file in $compose_files; do
                echo -e "${YELLOW}--- Estado de $file ---${NC}"
                docker-compose -f $file ps
            done
            ;;
        "cleanup")
            echo -e "${YELLOW}🧹 Limpiando recursos no usados...${NC}"
            docker system prune -f
            docker volume prune -f
            echo -e "${GREEN}✅ Limpieza completada${NC}"
            ;;
        *)
            echo -e "${RED}❌ Comando desconocido: $command${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Función para mostrar información del sistema
show_system_info() {
    echo -e "${BLUE}💻 Información del Sistema:${NC}"
    echo "RAM total: $(free -h | awk '/^Mem:/ {print $2}')"
    echo "RAM disponible: $(free -h | awk '/^Mem:/ {print $7}')"
    echo "Espacio en disco: $(df -h . | awk 'NR==2 {print $4 " disponible de " $2}')"
    echo "CPU cores: $(nproc)"
    echo ""
    echo -e "${BLUE}🐳 Docker:${NC}"
    docker --version
    docker-compose --version
    echo ""
}

# Script principal
main() {
    local command=$1
    local service=$2

    # Mostrar banner
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════╗"
    echo "║       🤖 Diario Visual Manager       ║"
    echo "║     Optimizado para NAS con poca     ║"
    echo "║            RAM y CPU 🚀             ║"
    echo "╚══════════════════════════════════════╝"
    echo -e "${NC}"

    # Si no hay parámetros, mostrar ayuda
    if [ $# -eq 0 ]; then
        show_system_info
        show_help
        exit 0
    fi

    # Ejecutar comando
    run_command $command $service

    # Mostrar estado final
    echo ""
    echo -e "${GREEN}🎉 Operación completada exitosamente${NC}"
    echo -e "${BLUE}💡 Acceso a la web: http://localhost:${WEB_PORT:-8090}${NC}"
    echo -e "${BLUE}🤖 Bot de Telegram: Envía /start a tu bot${NC}"
}

# Ejecutar con todos los parámetros
main "$@"
EOF

    chmod +x scripts/manage.sh

    # Crear script de inicio rápido
    cat > start-bot.sh << 'EOF'
#!/bin/bash
# Inicio rápido del bot
./scripts/manage.sh start bot
EOF

    cat > start-web.sh << 'EOF'
#!/bin/bash
# Inicio rápido de la web
./scripts/manage.sh start web
EOF

    chmod +x start-bot.sh start-web.sh

    echo -e "${GREEN}✅ Scripts de gestión creados${NC}"
}

# Función para mostrar resumen post-migración
show_summary() {
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════╗"
    echo "║        ✅ Migración Completada        ║"
    echo "╚═══════════════════════════════════════╝"
    echo -e "${NC}"

    echo -e "${BLUE}📁 Archivos creados:${NC}"
    echo "  • docker-compose.bot.yml  (Bot separado)"
    echo "  • docker-compose.web.yml  (Web separada)"
    echo "  • scripts/manage.sh       (Gestión)"
    echo "  • start-bot.sh           (Inicio rápido bot)"
    echo "  • start-web.sh           (Inicio rápido web)"
    echo ""

    echo -e "${YELLOW}🚀 Comandos útiles:${NC}"
    echo "  # Iniciar solo el bot:"
    echo "  ./scripts/manage.sh start bot"
    echo ""
    echo "  # Iniciar solo la web:"
    echo "  ./scripts/manage.sh start web"
    echo ""
    echo "  # Ver estado:"
    echo "  ./scripts/manage.sh status"
    echo ""
    echo "  # Ver logs del bot:"
    echo "  ./scripts/manage.sh logs bot"
    echo ""

    echo -e "${GREEN}💡 Próximos pasos:${NC}"
    echo "1. Construir e iniciar el bot: ${BLUE}./scripts/manage.sh build bot && ./scripts/manage.sh start bot${NC}"
    echo "2. Probar el bot enviando /start"
    echo "3. Si funciona bien, iniciar la web: ${BLUE}./scripts/manage.sh start web${NC}"
    echo "4. Acceder a http://localhost:${WEB_PORT:-8090}"
    echo ""
    echo -e "${YELLOW}⚠️  Recuerda: El backup está en el directorio backup-*${NC}"
}

# Función principal
main() {
    check_prerequisites
    make_backup
    stop_current_services
    create_compose_files
    update_dockerfiles
    create_management_scripts
    show_summary
}

# Ejecutar migración
main "$@"
EOF
