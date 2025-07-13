#!/bin/bash
# web/entrypoint.sh

# Función para configurar permisos
setup_permissions() {
    local dir="$1"
    if [ -d "$dir" ]; then
        echo "Configurando permisos para: $dir"
        chown -R www-data:www-data "$dir" 2>/dev/null || true
        find "$dir" -type d -exec chmod 775 {} \; 2>/dev/null || true
        find "$dir" -type f -exec chmod 664 {} \; 2>/dev/null || true
        echo "Permisos configurados."
    fi
}

# Configurar permisos del directorio de fotos
setup_permissions "/data/fotos"

# Configurar umask para archivos nuevos
umask 002

# Crear directorio si no existe
mkdir -p /data/fotos
chown www-data:www-data /data/fotos 2>/dev/null || true

# Script de monitoreo en background (simplificado)
(
    while true; do
        sleep 30
        if [ -d "/data/fotos" ]; then
            find "/data/fotos" \( ! -user www-data -o ! -group www-data \) -exec chown www-data:www-data {} \; 2>/dev/null || true
        fi
    done
) &

# Ejecutar Apache
exec apache2-foreground
