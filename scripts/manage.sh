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
