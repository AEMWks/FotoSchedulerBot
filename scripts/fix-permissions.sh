#!/bin/bash
# fix-permissions.sh - Script para corregir permisos de fotos

PHOTOS_DIR="/data/fotos"
WEB_USER="33"    # UID de www-data
WEB_GROUP="33"   # GID de www-data

echo "=== Corrigiendo permisos de fotos ==="
echo "Directorio: $PHOTOS_DIR"
echo "Usuario objetivo: $WEB_USER"
echo "Grupo objetivo: $WEB_GROUP"

if [ ! -d "$PHOTOS_DIR" ]; then
    echo "Error: El directorio $PHOTOS_DIR no existe"
    exit 1
fi

# Función para mostrar estadísticas
show_stats() {
    echo "Estadísticas de archivos:"
    echo "- Total de archivos: $(find "$PHOTOS_DIR" -type f | wc -l)"
    echo "- Archivos con propietario incorrecto: $(find "$PHOTOS_DIR" -type f ! -user $WEB_USER | wc -l)"
    echo "- Directorios con propietario incorrecto: $(find "$PHOTOS_DIR" -type d ! -user $WEB_USER | wc -l)"
}

echo "Antes de la corrección:"
show_stats

# Corregir propietario de todos los archivos y directorios
echo "Cambiando propietario a $WEB_USER:$WEB_GROUP..."
chown -R $WEB_USER:$WEB_GROUP "$PHOTOS_DIR"

# Corregir permisos
echo "Configurando permisos..."
find "$PHOTOS_DIR" -type d -exec chmod 775 {} \;
find "$PHOTOS_DIR" -type f -exec chmod 664 {} \;

echo "Después de la corrección:"
show_stats

echo "=== Corrección completada ==="

# Opcional: Mostrar algunos archivos de ejemplo
echo "Ejemplos de archivos corregidos:"
find "$PHOTOS_DIR" -type f | head -5 | while read file; do
    ls -la "$file"
done
