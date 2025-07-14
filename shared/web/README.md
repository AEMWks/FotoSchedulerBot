# 📸 Diario Visual - Bot de Telegram + Interfaz Web

Un sistema completo para crear un diario fotográfico automatizado con notificaciones aleatorias de Telegram y una interfaz web moderna para visualizar tus recuerdos.

## ✨ Características

### 🤖 Bot de Telegram Inteligente
- **Notificaciones aleatorias** entre 5-9 veces al día
- **Validación automática** de resolución (mínimo 1080p) y duración (máximo 20s)
- **Gestión de permisos** automática para compatibilidad con NAS
- **Sistema de ventanas de tiempo** - cada notificación es válida hasta la siguiente
- **OpenCV y PIL** integrados para validación de contenido multimedia

### 🌐 Interfaz Web Moderna
- **Feed responsive** con vista de timeline
- **Dashboard analítico** con estadísticas y gráficos
- **Lightbox avanzado** con zoom, navegación y descarga
- **Modo slideshow** para presentaciones automáticas
- **Tema claro/oscuro** con persistencia local
- **APIs REST completas** para integración externa

### 📊 Funcionalidades Avanzadas
- **Búsqueda y filtrado** por fecha, tipo y contenido
- **Exportación masiva** en ZIP o metadatos JSON
- **Vista de calendario** con indicadores de actividad
- **Recuerdos aleatorios** para redescubrir fotos antiguas
- **Validación en tiempo real** de archivos subidos

## 🚀 Instalación Rápida

### Prerrequisitos
- Docker y Docker Compose
- Token de bot de Telegram ([@BotFather](https://t.me/BotFather))
- Tu ID de usuario de Telegram ([@userinfobot](https://t.me/userinfobot))

### 1. Clonar el repositorio
```bash
git clone <tu-repositorio>
cd diario-visual
```

### 2. Configurar variables de entorno
```bash
# Copiar template de configuración
cp .env.example .env

# Editar configuración
nano .env
```

**Configuración mínima requerida:**
```bash
TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_USER_ID=tu_user_id_aqui
HOST_DATA_PATH=/ruta/absoluta/a/tus/fotos
WEB_PORT=8090
```

### 3. Preparar directorio de fotos
```bash
# Crear directorio (ajustar ruta según tu .env)
mkdir -p /ruta/a/tus/fotos

# Configurar permisos (importante para Docker)
sudo chown -R 33:33 /ruta/a/tus/fotos
sudo chmod -R 775 /ruta/a/tus/fotos
```

### 4. Iniciar servicios
```bash
# Construir e iniciar contenedores
docker-compose up -d

# Verificar que están funcionando
docker-compose ps
```

### 5. ¡Listo! 🎉
- **Bot**: Envía `/start` a tu bot de Telegram
- **Web**: Abre http://localhost:8090
- **Logs**: `docker-compose logs -f`

## 📱 Uso del Bot

### Comandos Disponibles
- `/start` - Generar plan del día (5-9 notificaciones aleatorias)
- `/status` - Ver estado de notificaciones actuales
- `/info` - Información del sistema y configuración
- `/help` - Ayuda completa con ejemplos

### Flujo de Trabajo
1. **Ejecuta `/start`** una vez al día para generar horario aleatorio
2. **Responde a las notificaciones** enviando fotos/videos cuando te lleguen
3. **Revisa tu progreso** con `/status` o en la interfaz web
4. **Explora tus recuerdos** en http://localhost:8090

### Requisitos de Contenido
- **📸 Fotos**: Mínimo 1080p (1920x1080), máximo 20MB
- **🎥 Videos**: Máximo 20 segundos, máximo 20MB
- **📁 Formatos**: JPG, PNG, HEIC, HEIF, MP4, MOV

## 🌐 Interfaz Web

### Páginas Principales
- **`/`** - Feed principal con timeline de fotos
- **`/dashboard.html`** - Analytics y herramientas avanzadas

### APIs Disponibles
- `GET /api/photos/{year}/{month}/{day}` - Fotos de fecha específica
- `GET /api/search` - Búsqueda avanzada con filtros
- `GET /api/stats` - Estadísticas y métricas
- `GET /api/calendar/{year}/{month}` - Vista de calendario
- `GET /api/export` - Exportación masiva
- `GET /api/random` - Contenido aleatorio

[Ver documentación completa de APIs](web/api/docs/api.md)

## 🔧 Configuración Avanzada

### Variables de Entorno Principales
```bash
# Bot de Telegram
TELEGRAM_BOT_TOKEN=token_del_bot
TELEGRAM_USER_ID=tu_id_numerico

# Rutas de almacenamiento
HOST_DATA_PATH=/ruta/completa/a/fotos  # Debe ser absoluta
DATA_PATH=/data/fotos                  # No cambiar

# Configuración web
WEB_PORT=8090                          # Puerto de acceso
WEB_DOMAIN=localhost                   # Dominio (para HTTPS futuro)

# Límites de contenido
MAX_FILE_SIZE_MB=20                    # Tamaño máximo archivo
MAX_VIDEO_DURATION_SECONDS=20          # Duración máxima video
MIN_PHOTO_WIDTH=1920                   # Resolución mínima
MIN_PHOTO_HEIGHT=1080

# Configuración de notificaciones
MIN_NOTIFICATIONS_PER_DAY=5            # Mínimo notificaciones/día
MAX_NOTIFICATIONS_PER_DAY=9            # Máximo notificaciones/día
NOTIFICATIONS_START_HOUR=8             # Hora inicio (24h)
NOTIFICATIONS_END_HOUR=21              # Hora fin (24h)
```

### Personalización de Horarios
El bot genera automáticamente entre 5-9 notificaciones aleatorias cada día entre las 8:00 y 21:30. Cada notificación abre una "ventana de tiempo" hasta la siguiente notificación.

### Gestión de Permisos
El sistema configura automáticamente:
- **Archivos**: `664` (rw-rw-r--)
- **Directorios**: `775` (rwxrwxr-x)
- **Owner**: `www-data` (UID/GID 33)

## 📁 Estructura del Proyecto

```
diario-visual/
├── 📋 CONFIGURACIÓN
│   ├── compose.yml              # Docker Compose principal
│   ├── .env.example            # Template de configuración
│   └── .gitignore              # Archivos ignorados por Git
│
├── 🤖 BOT DE TELEGRAM
│   ├── bot/
│   │   ├── Dockerfile          # Contenedor Ubuntu + OpenCV
│   │   ├── bot.py              # Código principal del bot
│   │   └── requirements.txt    # Dependencias Python
│
├── 🌐 INTERFAZ WEB
│   ├── web/
│   │   ├── Dockerfile          # Contenedor Apache + PHP
│   │   ├── apache-config.conf  # Configuración Apache
│   │   ├── entrypoint.sh       # Script de inicio
│   │   ├── .htaccess           # Reglas de reescritura
│   │   │
│   │   ├── 📱 FRONTEND
│   │   ├── public/
│   │   │   ├── index.html      # Página principal
│   │   │   ├── dashboard.html  # Dashboard analítico
│   │   │   └── assets/
│   │   │       ├── css/        # Estilos organizados
│   │   │       ├── js/         # JavaScript modular
│   │   │       └── images/     # Recursos gráficos
│   │   │
│   │   └── 🔌 BACKEND
│   │       └── api/
│   │           ├── config.php  # Configuración común
│   │           ├── routes/     # Endpoints de API
│   │           ├── utils/      # Utilidades compartidas
│   │           └── docs/       # Documentación API
│
└── 🛠️ SCRIPTS
    ├── scripts/
    │   ├── fix-permissions.sh   # Reparar permisos
    │   └── migrate-structure.sh # Migración de estructura
```

## 🔍 Solución de Problemas

### Problemas Comunes

#### 🚫 "Permission denied" al guardar fotos
```bash
# Verificar permisos del directorio
ls -la /ruta/a/tus/fotos

# Corregir permisos
sudo chown -R 33:33 /ruta/a/tus/fotos
sudo chmod -R 775 /ruta/a/tus/fotos

# O usar el script incluido
./scripts/fix-permissions.sh
```

#### 🤖 Bot no responde a comandos
```bash
# Verificar logs del bot
docker-compose logs -f nas-photo-bot

# Verificar token del bot
echo $TELEGRAM_BOT_TOKEN

# Probar token manualmente
curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe
```

#### 🌐 Error "Puerto ocupado"
```bash
# Verificar qué usa el puerto
sudo lsof -i :8090

# Cambiar puerto en .env
WEB_PORT=8091

# Reiniciar servicios
docker-compose down && docker-compose up -d
```

#### 📱 No recibo notificaciones
```bash
# Verificar tu user ID
echo $TELEGRAM_USER_ID

# Obtener tu ID real enviando mensaje a @userinfobot
# Actualizar .env con el ID correcto
```

#### 🔧 Contenedores no inician
```bash
# Verificar configuración
docker-compose config

# Ver logs detallados
docker-compose logs

# Reconstruir desde cero
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Comandos de Diagnóstico

```bash
# Estado general
docker-compose ps

# Logs en tiempo real
docker-compose logs -f

# Espacio en disco
df -h

# Verificar APIs
curl http://localhost:8090/api/dates

# Verificar permisos
ls -la /ruta/a/tus/fotos

# Reiniciar servicios
docker-compose restart

# Limpiar sistema
docker system prune -f
```

## 🛡️ Seguridad y Privacidad

### Datos Locales
- **Todas las fotos se almacenan localmente** en tu servidor
- **No hay envío a servicios externos** excepto Telegram
- **El bot solo responde a tu user ID** configurado

### Recomendaciones
- **Cambia el puerto por defecto** para mayor seguridad
- **Usa HTTPS** en producción (configuración futura)
- **Haz backups regulares** del directorio de fotos
- **Mantén actualizado** Docker y el sistema operativo

## 📈 Actualizaciones y Desarrollo

### Actualizar el Sistema
```bash
# Detener servicios
docker-compose down

# Actualizar código
git pull origin main

# Reconstruir contenedores
docker-compose build

# Iniciar con nueva versión
docker-compose up -d
```

### Desarrollo Local
```bash
# Modo desarrollo con logs detallados
DEBUG_MODE=true docker-compose up

# Ejecutar solo el bot
docker-compose up nas-photo-bot

# Ejecutar solo la web
docker-compose up photo-diary-web
```

### Contribuir
1. Fork del repositorio
2. Crear branch de feature: `git checkout -b nueva-funcionalidad`
3. Commit cambios: `git commit -am 'Agregar funcionalidad'`
4. Push al branch: `git push origin nueva-funcionalidad`
5. Crear Pull Request

## 📦 Backup y Restauración

### Crear Backup
```bash
# Backup completo
tar -czf backup-$(date +%Y%m%d).tar.gz \
  /ruta/a/tus/fotos \
  .env \
  docker-compose.yml

# Solo fotos
rsync -av /ruta/a/tus/fotos/ backup-fotos/
```

### Restaurar Backup
```bash
# Restaurar fotos
rsync -av backup-fotos/ /ruta/a/tus/fotos/

# Corregir permisos después de restaurar
sudo chown -R 33:33 /ruta/a/tus/fotos
sudo chmod -R 775 /ruta/a/tus/fotos
```

## 🎯 Roadmap Futuro

### Próximas Funcionalidades
- [ ] **PWA (Progressive Web App)** para funcionalidad offline
- [ ] **Reconocimiento facial** para agrupar fotos por personas
- [ ] **Geolocalización** opcional para mapas de recuerdos
- [ ] **Integración con Google Photos/iCloud** para backup automático
- [ ] **Base de datos** para metadatos y búsqueda avanzada
- [ ] **Múltiples usuarios** con autenticación
- [ ] **API de terceros** para integraciones
- [ ] **Machine learning** para categorización automática

### Mejoras Técnicas
- [ ] **HTTPS/SSL** automático con Let's Encrypt
- [ ] **CDN** para delivery optimizado de imágenes
- [ ] **Compresión automática** de imágenes y videos
- [ ] **Streaming adaptativo** para videos
- [ ] **Notificaciones push** web
- [ ] **Análisis de sentimientos** en fotos

## 📞 Soporte

### Comunidad
- **Issues**: [GitHub Issues](../../issues)
- **Discusiones**: [GitHub Discussions](../../discussions)
- **Wiki**: [Documentación extendida](../../wiki)

### Contacto
- **Email**: tu-email@ejemplo.com
- **Telegram**: [@tu_usuario](https://t.me/tu_usuario)
- **Discord**: [Servidor de la comunidad](#)

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

---

**⭐ ¡Si te gusta este proyecto, dale una estrella en GitHub!**

---

## 🙏 Agradecimientos

- **[python-telegram-bot](https://github.com/python-telegram-bot/python-telegram-bot)** - Framework para bots de Telegram
- **[OpenCV](https://opencv.org/)** - Procesamiento de imágenes y videos
- **[Apache](https://httpd.apache.org/)** - Servidor web
- **[Docker](https://www.docker.com/)** - Containerización
- **Comunidad open source** por todas las librerías utilizadas

---

*Creado con ❤️ para preservar tus recuerdos diarios*
