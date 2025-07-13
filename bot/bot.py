import os
import random
import asyncio
import json
import tempfile
import shutil
import stat
import pwd
import grp
from datetime import datetime, timedelta

from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# Importaciones opcionales con fallback
try:
    from PIL import Image
    PIL_AVAILABLE = True
    print("✅ PIL/Pillow cargado correctamente")
except ImportError:
    PIL_AVAILABLE = False
    print("⚠️ PIL/Pillow no disponible - validación de resolución deshabilitada")

try:
    import cv2
    CV2_AVAILABLE = True
    print("✅ OpenCV cargado correctamente")
except ImportError as e:
    CV2_AVAILABLE = False
    print(f"⚠️ OpenCV no disponible - validación de duración de video deshabilitada: {e}")
except Exception as e:
    CV2_AVAILABLE = False
    print(f"⚠️ Error cargando OpenCV - validación de duración de video deshabilitada: {e}")

# Configuración
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
USER_ID = int(os.getenv("TELEGRAM_USER_ID"))
SAVE_PATH = "/data/fotos"

# Límites de contenido
MAX_VIDEO_DURATION = 20  # segundos
MIN_PHOTO_RESOLUTION = 1920 * 1080  # 1080p mínimo para fotos
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

# Configurar umask globalmente al inicio
os.umask(0o002)

# Función para configurar permisos de archivos y directorios
def setup_file_permissions(file_path):
    """Configura permisos correctos para un archivo o directorio"""
    try:
        # Obtener UID/GID de www-data
        try:
            www_data = pwd.getpwnam('www-data')
            target_uid = www_data.pw_uid
            target_gid = www_data.pw_gid
        except KeyError:
            # Fallback a UID/GID 33 si www-data no existe
            target_uid = 33
            target_gid = 33

        # Configurar ownership
        try:
            os.chown(file_path, target_uid, target_gid)
        except (OSError, PermissionError) as e:
            print(f"⚠️ No se pudo cambiar ownership de {file_path}: {e}")

        # Configurar permisos según si es archivo o directorio
        if os.path.isdir(file_path):
            try:
                os.chmod(file_path, 0o775)  # rwxrwxr-x para directorios
            except (OSError, PermissionError) as e:
                print(f"⚠️ No se pudieron configurar permisos de directorio {file_path}: {e}")
        else:
            try:
                os.chmod(file_path, 0o664)  # rw-rw-r-- para archivos
            except (OSError, PermissionError) as e:
                print(f"⚠️ No se pudieron configurar permisos de archivo {file_path}: {e}")

        return True
    except Exception as e:
        print(f"❌ Error configurando permisos para {file_path}: {e}")
        return False

def setup_directory_permissions(dir_path):
    """Configura permisos para un directorio y toda su estructura padre"""
    try:
        # Crear la estructura de directorios si no existe
        os.makedirs(dir_path, mode=0o775, exist_ok=True)

        # Configurar permisos para toda la estructura
        current_path = dir_path
        while current_path != SAVE_PATH and current_path != '/':
            if os.path.exists(current_path):
                setup_file_permissions(current_path)
            current_path = os.path.dirname(current_path)

        # Configurar permisos del directorio base también
        if os.path.exists(SAVE_PATH):
            setup_file_permissions(SAVE_PATH)

        return True
    except Exception as e:
        print(f"❌ Error configurando estructura de directorios {dir_path}: {e}")
        return False

# Función para obtener texto de requisitos
def get_requirements_text():
    """Devuelve el texto con los requisitos de contenido"""
    requirements = [
        "📏 **Requisitos obligatorios:**",
        "• 📸 Fotos: Mínimo 1080p (1920x1080)",
        "• 🎥 Videos: Máximo 20 segundos",
        "• 📦 Tamaño: Máximo 20MB",
        "• 🔧 Usa máxima calidad en tu cámara"
    ]

    # Añadir advertencias si faltan librerías
    if not PIL_AVAILABLE:
        requirements.append("⚠️ Validación de resolución no disponible")
    if not CV2_AVAILABLE:
        requirements.append("⚠️ Validación de duración no disponible")

    return "\n".join(requirements)

# Ruta para guardar el plan en JSON
def get_plan_json_path():
    today = datetime.now().strftime("%Y-%m-%d")
    plan_dir = f"{SAVE_PATH}/planificacion"
    plan_path = f"{plan_dir}/{today}.json"

    # Asegurar que el directorio de planificación existe con permisos correctos
    try:
        os.makedirs(plan_dir, mode=0o775, exist_ok=True)
        setup_file_permissions(plan_dir)
    except Exception as e:
        print(f"⚠️ Error creando directorio de planificación: {e}")

    return plan_path

def save_plan_json(plan):
    path = get_plan_json_path()
    try:
        with open(path, "w") as f:
            json.dump(plan, f, indent=2)
        # Configurar permisos del archivo JSON
        setup_file_permissions(path)
        print(f"✅ Plan guardado en {path}")
    except Exception as e:
        print(f"❌ Error guardando plan: {e}")

def load_plan_json():
    path = get_plan_json_path()
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error cargando plan json: {e}")
    return None

# Función para generar horarios aleatorios con minutos
def generate_random_schedule():
    """Genera un horario aleatorio con horas y minutos"""
    schedule = []
    num_notifications = random.randint(5, 9)

    # Generar horarios entre 8:00 y 21:59
    base_hours = sorted(random.sample(range(8, 22), min(num_notifications, 14)))

    for base_hour in base_hours:
        # Añadir minutos aleatorios (0, 15, 30, 45)
        minute = random.choice([0, 15, 30, 45])

        # Si es después de las 21:30, limitamos a 21:30 máximo
        if base_hour == 21 and minute > 30:
            minute = 30

        schedule.append({
            "hour": base_hour,
            "minute": minute,
            "type": random.choice(["foto", "video"]),
            "delivered": False
        })

    return schedule

def format_notification_time(hour, minute):
    """Formatea la hora de notificación"""
    return f"{hour:02d}:{minute:02d}"

def get_next_notification_time(plan, current_index):
    """Obtiene la hora de la siguiente notificación"""
    if current_index + 1 < len(plan):
        next_entry = plan[current_index + 1]
        return next_entry.get("hour", 23), next_entry.get("minute", 59)
    else:
        # Si es la última notificación del día, la ventana termina a las 23:59
        return 23, 59

def get_window_end_time_for_notification(plan, notification_index):
    """Calcula la hora de fin de ventana (hasta la siguiente notificación)"""
    end_hour, end_minute = get_next_notification_time(plan, notification_index)
    return f"{end_hour:02d}:{end_minute:02d}"

def is_notification_window_active(plan, notification_index, current_total_minutes):
    """Verifica si la ventana de una notificación específica está activa"""
    if notification_index >= len(plan):
        return False

    entry = plan[notification_index]
    notification_hour = entry.get("hour", 8)
    notification_minute = entry.get("minute", 0)
    notification_total_minutes = notification_hour * 60 + notification_minute

    # La ventana está activa desde la notificación hasta la siguiente notificación
    end_hour, end_minute = get_next_notification_time(plan, notification_index)
    window_end_minutes = end_hour * 60 + end_minute

    return notification_total_minutes <= current_total_minutes < window_end_minutes

# Funciones para validar contenido multimedia
async def validate_video_duration(file_path):
    """Valida que el video no exceda los 20 segundos"""
    if not CV2_AVAILABLE:
        print("OpenCV no disponible, saltando validación de duración")
        return True, 0  # Asumimos que es válido si no podemos validar

    try:
        cap = cv2.VideoCapture(file_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        duration = frame_count / fps if fps > 0 else 0
        cap.release()
        return duration <= MAX_VIDEO_DURATION, duration
    except Exception as e:
        print(f"Error validando duración del video: {e}")
        return True, 0  # Asumimos que es válido si hay error

async def validate_photo_resolution(file_path):
    """Valida que la foto tenga resolución mínima de 1080p"""
    if not PIL_AVAILABLE:
        print("PIL no disponible, saltando validación de resolución")
        return True, 0, 0  # Asumimos que es válido si no podemos validar

    try:
        with Image.open(file_path) as img:
            width, height = img.size
            total_pixels = width * height
            return total_pixels >= MIN_PHOTO_RESOLUTION, width, height
    except Exception as e:
        print(f"Error validando resolución de la foto: {e}")
        return True, 0, 0  # Asumimos que es válido si hay error

def format_duration(seconds):
    """Formatea la duración en segundos a formato legible"""
    if seconds == 0:
        return "no detectada"
    if seconds < 60:
        return f"{seconds:.1f} segundos"
    else:
        minutes = int(seconds // 60)
        secs = seconds % 60
        return f"{minutes}m {secs:.1f}s"

def format_resolution(width, height):
    """Formatea la resolución a formato legible"""
    if width == 0 or height == 0:
        return "no detectada"
    total_mp = (width * height) / 1000000
    return f"{width}x{height} ({total_mp:.1f}MP)"

def get_file_size_mb(file_size):
    """Convierte bytes a MB de forma segura"""
    if file_size is None or file_size == 0:
        return "no detectado"
    return f"{file_size/(1024*1024):.1f}MB"

# Funciones para manejar el estado integrado en el plan
def update_delivery_state(hour_index, delivered=True):
    """Actualiza el estado de entrega para una hora específica"""
    plan = load_plan_json()
    if plan and hour_index < len(plan):
        plan[hour_index]["delivered"] = delivered
        save_plan_json(plan)
        return True
    return False

def get_delivery_state(hour_index):
    """Obtiene el estado de entrega para una hora específica"""
    plan = load_plan_json()
    if plan and hour_index < len(plan):
        return plan[hour_index].get("delivered", False)
    return False

def all_notifications_pending():
    """Verifica si todas las notificaciones están pendientes"""
    plan = load_plan_json()
    if not plan:
        return True
    return all(not entry.get("delivered", False) for entry in plan)

# Enviar notificación al usuario con recordatorio de límites
async def send_photo_request(app, notification_entry):
    try:
        now = datetime.now().strftime("%H:%M")
        # Obtener el tipo directamente del entry que se pasa como parámetro
        tipo = notification_entry.get("type", "foto")
        hora_notificacion = notification_entry.get("hour", 8)
        minuto_notificacion = notification_entry.get("minute", 0)
        hora_programada = f"{hora_notificacion:02d}:{minuto_notificacion:02d}"

        print(f"📢 Enviando notificación de {tipo} programada para las {hora_programada}", flush=True)

        # Cargar el plan para calcular el fin de ventana
        plan = load_plan_json()
        window_end_text = "el final del día"

        if plan:
            # Encontrar el índice de esta notificación
            notification_index = -1
            for i, entry in enumerate(plan):
                if (entry.get("hour") == hora_notificacion and
                    entry.get("minute") == minuto_notificacion):
                    notification_index = i
                    break

            if notification_index >= 0:
                window_end_text = f"las {get_window_end_time_for_notification(plan, notification_index)}"

        if tipo == "video":
            msg = (
                f"🎥 **¡Hora de grabar!** Son las {now}\n"
                f"Haz un video corto de lo que estás haciendo ahora.\n\n"
                f"{get_requirements_text()}\n\n"
                f"⚠️ **Importante:** El video será rechazado si excede los 20 segundos o 20MB.\n"
                f"⏰ **Tienes hasta {window_end_text} para enviarlo.**"
            )
        else:
            msg = (
                f"📸 **¡Hora de fotografiar!** Son las {now}\n"
                f"Haz una foto de lo que estás haciendo ahora.\n\n"
                f"{get_requirements_text()}\n\n"
                f"⚠️ **Importante:** La foto será rechazada si es menor a 1080p o mayor a 20MB.\n"
                f"⏰ **Tienes hasta {window_end_text} para enviarla.**"
            )

        await app.bot.send_message(chat_id=USER_ID, text=msg, parse_mode='Markdown')
        print(f"✅ Notificación de {tipo} enviada correctamente", flush=True)
    except Exception as e:
        print(f"❌ Error enviando notificación: {e}")

# Función para verificar si el contenido enviado es del tipo correcto
def check_content_type(update, expected_type):
    if expected_type == "foto":
        return (update.message.photo or
                (update.message.document and
                 update.message.document.file_name.lower().endswith((".jpg", ".jpeg", ".png", ".heic", ".heif"))))
    elif expected_type == "video":
        return (update.message.video or
                (update.message.document and
                 update.message.document.file_name.lower().endswith((".mp4", ".mov", ".hevc"))))
    return False

# Función mejorada para encontrar la ventana de tiempo actual
def get_current_time_window(plan):
    now = datetime.now()
    current_hour = now.hour
    current_minute = now.minute
    current_total_minutes = current_hour * 60 + current_minute

    print(f"🕐 Hora actual: {current_hour:02d}:{current_minute:02d}", flush=True)

    # Buscar la ventana activa (desde la notificación más reciente hasta la siguiente)
    active_window = None
    active_index = -1

    for i, entry in enumerate(plan):
        notification_hour = entry.get("hour", 8)
        notification_minute = entry.get("minute", 0)

        # Debug: mostrar todas las ventanas
        print(f"🔍 Ventana {i}: Notificación a las {notification_hour:02d}:{notification_minute:02d}, tipo: {entry['type']}, entregado: {entry.get('delivered', False)}", flush=True)

        # Verificar si esta ventana está activa
        if is_notification_window_active(plan, i, current_total_minutes):
            end_hour, end_minute = get_next_notification_time(plan, i)
            print(f"✅ Ventana activa encontrada: {notification_hour:02d}:{notification_minute:02d} hasta {end_hour:02d}:{end_minute:02d}", flush=True)

            # Si no hemos encontrado una ventana activa aún, o esta es más reciente
            if active_window is None or i > active_index:
                active_window = entry
                active_index = i

    if active_window is None:
        print("❌ No hay ventana activa", flush=True)
        return None, None

    print(f"🎯 Ventana activa elegida: índice {active_index}, tipo {active_window['type']}", flush=True)
    return active_index, active_window

# Función auxiliar para mostrar el estado actualizado
async def show_updated_status(context, plan):
    """Muestra el estado actualizado después de recibir contenido"""
    # Recargar el plan para obtener el estado más actual
    updated_plan = load_plan_json()
    if not updated_plan:
        return

    delivered_count = sum(1 for entry in updated_plan if entry.get("delivered", False))
    total_count = len(updated_plan)

    # Encontrar próxima notificación pendiente
    now = datetime.now()
    current_total_minutes = now.hour * 60 + now.minute
    next_notification = None

    for entry in updated_plan:
        notification_hour = entry.get("hour", 8)
        notification_minute = entry.get("minute", 0)
        notification_total_minutes = notification_hour * 60 + notification_minute

        if notification_total_minutes > current_total_minutes and not entry.get("delivered", False):
            next_notification = format_notification_time(notification_hour, notification_minute)
            break

    status_msg = f"📈 **Progreso:** {delivered_count}/{total_count} completadas"
    if next_notification:
        status_msg += f"\n🔔 **Próxima:** {next_notification}"
    elif delivered_count == total_count:
        status_msg += f"\n🎉 **¡Todas las notificaciones completadas!**"

    await context.bot.send_message(chat_id=USER_ID, text=status_msg, parse_mode='Markdown')

# Función para guardar archivo con manejo mejorado de permisos
def save_file_with_permissions(temp_path, final_path):
    """Guarda un archivo desde ubicación temporal a final con permisos correctos"""
    try:
        # Asegurar que el directorio destino existe con permisos correctos
        dest_dir = os.path.dirname(final_path)
        setup_directory_permissions(dest_dir)

        # Mover archivo de temporal a ubicación final
        shutil.move(temp_path, final_path)

        # Configurar permisos del archivo guardado
        setup_file_permissions(final_path)

        print(f"✅ Archivo guardado con permisos correctos: {final_path}")
        return True

    except Exception as e:
        print(f"❌ Error guardando archivo {final_path}: {e}")
        # Limpiar archivo temporal si existe
        if os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass
        return False

# Guardar foto/video que el usuario envía
async def photo_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    print("photo_handler triggered", flush=True)
    if update.effective_user.id != USER_ID:
        print(f"Usuario no autorizado: {update.effective_user.id}", flush=True)
        await context.bot.send_message(chat_id=update.effective_user.id, text="❌ No tienes permisos para usar este bot.")
        return

    # Verificar si puede enviar contenido
    plan = load_plan_json()

    if not plan:
        await context.bot.send_message(chat_id=USER_ID, text="❌ No hay planificación activa. Usa /start para generar una.")
        print("No hay planificación activa aún", flush=True)
        return

    # Si ninguna notificación ha sido entregada todavía
    if all_notifications_pending():
        now = datetime.now()
        first_notification = plan[0]
        primer_hora = first_notification.get("hour", 8)
        primer_minuto = first_notification.get("minute", 0)
        primera_notificacion = now.replace(hour=primer_hora, minute=primer_minuto, second=0, microsecond=0)
        if now < primera_notificacion:
            next_time = format_notification_time(primer_hora, primer_minuto)
            await context.bot.send_message(chat_id=USER_ID, text=f"⏳ Aún no puedes enviar nada. La primera notificación será a las {next_time}.")
            print("Intento de envío antes de la primera notificación", flush=True)
            return

    # Verificar ventana de tiempo actual
    window_index, current_window = get_current_time_window(plan)
    if current_window is None:
        # No hay ventana activa, mostrar próxima notificación
        now = datetime.now()
        current_total_minutes = now.hour * 60 + now.minute
        next_notification = None

        for entry in plan:
            notification_hour = entry.get("hour", 8)
            notification_minute = entry.get("minute", 0)
            notification_total_minutes = notification_hour * 60 + notification_minute

            if notification_total_minutes > current_total_minutes and not entry.get("delivered", False):
                next_notification = format_notification_time(notification_hour, notification_minute)
                break

        if next_notification:
            await context.bot.send_message(chat_id=USER_ID, text=f"⏰ Fuera de horario. La próxima notificación será a las {next_notification}.")
        else:
            await context.bot.send_message(chat_id=USER_ID, text="⏰ No hay más notificaciones programadas para hoy.")
        print("Intento de envío fuera de ventana de tiempo", flush=True)
        return

    # Verificar si ya se completó esta notificación
    if current_window.get("delivered", False):
        # Esta ventana específica ya está completada
        # Buscar si hay otras ventanas activas pendientes
        now = datetime.now()
        current_total_minutes = now.hour * 60 + now.minute

        # Buscar ventanas activas pendientes
        pending_active_windows = []
        for i, entry in enumerate(plan):
            if (is_notification_window_active(plan, i, current_total_minutes) and
                not entry.get("delivered", False)):
                pending_active_windows.append((i, entry))

        if pending_active_windows:
            # Hay otras ventanas activas pendientes, usar la más reciente
            window_index, current_window = max(pending_active_windows,
                                             key=lambda x: x[1].get("hour", 8) * 60 + x[1].get("minute", 0))
            print(f"🔄 Redirigiendo a ventana pendiente más reciente: índice {window_index}", flush=True)
            # Continuar con el procesamiento normal
        else:
            # No hay ventanas activas pendientes, buscar la siguiente
            next_notification = None
            for entry in plan:
                notification_hour = entry.get("hour", 8)
                notification_minute = entry.get("minute", 0)
                notification_total_minutes = notification_hour * 60 + notification_minute

                if notification_total_minutes > current_total_minutes and not entry.get("delivered", False):
                    next_notification = format_notification_time(notification_hour, notification_minute)
                    break

            if next_notification:
                await context.bot.send_message(chat_id=USER_ID, text=f"✅ Ya completaste esta notificación. La próxima será a las {next_notification}.")
            else:
                await context.bot.send_message(chat_id=USER_ID, text="✅ Ya completaste todas las notificaciones de hoy.")
            print("Intento de envío en notificación ya completada", flush=True)
            return

    # Verificar tipo de contenido
    expected_type = current_window["type"]
    if not check_content_type(update, expected_type):
        if expected_type == "foto":
            await context.bot.send_message(
                chat_id=USER_ID,
                text=(
                    "❌ **Se esperaba una FOTO**, pero enviaste otro tipo de contenido.\n\n"
                    "📸 Por favor, envía una imagen que cumpla:\n"
                    "• Mínimo 1080p (1920x1080)\n"
                    "• Máximo 20MB\n"
                    "• Formatos: JPG, PNG, HEIC, HEIF"
                ),
                parse_mode='Markdown'
            )
        else:
            await context.bot.send_message(
                chat_id=USER_ID,
                text=(
                    "❌ **Se esperaba un VIDEO**, pero enviaste otro tipo de contenido.\n\n"
                    "🎥 Por favor, envía un video que cumpla:\n"
                    "• Máximo 20 segundos\n"
                    "• Máximo 20MB\n"
                    "• Formatos: MP4, MOV, HEVC"
                ),
                parse_mode='Markdown'
            )
        print(f"Tipo de contenido incorrecto. Esperado: {expected_type}", flush=True)
        return

    try:
        now = datetime.now()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        day = now.strftime("%d")
        hour = now.strftime("%H-%M-%S")
        dir_path = f"{SAVE_PATH}/{year}/{month}/{day}"

        # Configurar estructura de directorios con permisos correctos
        if not setup_directory_permissions(dir_path):
            await context.bot.send_message(chat_id=USER_ID, text="❌ Error configurando directorio de destino.")
            return

        # Verificar si es mensaje de texto (no contenido multimedia)
        if update.message.text:
            await context.bot.send_message(
                chat_id=USER_ID,
                text=(
                    "❌ **Se esperaba contenido multimedia** (foto o video), pero enviaste texto.\n\n"
                    f"{get_requirements_text()}"
                ),
                parse_mode='Markdown'
            )
            print("Intento de envío de texto en lugar de multimedia", flush=True)
            return

        # Verificar tamaño del archivo antes de procesarlo
        file_size = 0
        if update.message.photo:
            file_size = update.message.photo[-1].file_size
        elif update.message.video:
            file_size = update.message.video.file_size
        elif update.message.document:
            file_size = update.message.document.file_size

        if file_size and file_size > MAX_FILE_SIZE:
            size_mb = file_size / (1024 * 1024)
            await context.bot.send_message(
                chat_id=USER_ID,
                text=(
                    f"❌ **Archivo demasiado grande:** {size_mb:.1f}MB\n\n"
                    f"📦 **Límite:** 20MB máximo\n"
                    f"💡 **Solución:** Reduce la calidad o duración del archivo"
                ),
                parse_mode='Markdown'
            )
            print(f"Archivo demasiado grande: {size_mb:.1f}MB", flush=True)
            return

        # Procesar foto
        if update.message.photo:
            photo = update.message.photo[-1]
            file = await photo.get_file()

            # Descargar a archivo temporal para validar
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
                temp_path = tmp_file.name
                await file.download_to_drive(temp_path)

                # Validar resolución
                is_valid, width, height = await validate_photo_resolution(temp_path)

                if PIL_AVAILABLE and not is_valid:
                    os.unlink(temp_path)
                    await context.bot.send_message(
                        chat_id=USER_ID,
                        text=(
                            f"❌ **Resolución insuficiente:** {format_resolution(width, height)}\n\n"
                            f"📸 **Mínimo requerido:** 1080p (1920x1080)\n"
                            f"💡 **Solución:** Configura tu cámara en máxima calidad"
                        ),
                        parse_mode='Markdown'
                    )
                    print(f"Foto con resolución insuficiente: {width}x{height}", flush=True)
                    return

                # Guardar archivo con permisos correctos
                final_path = f"{dir_path}/{hour}.jpg"
                if save_file_with_permissions(temp_path, final_path):
                    # Marcar como entregado
                    update_delivery_state(window_index, True)
                    await context.bot.send_message(
                        chat_id=USER_ID,
                        text=(
                            f"✅ **Foto recibida y guardada**\n"
                            f"📏 **Resolución:** {format_resolution(width, height)}\n"
                            f"📦 **Tamaño:** {get_file_size_mb(file_size)}"
                        ),
                        parse_mode='Markdown'
                    )
                    print(f"Foto guardada: {final_path} - Resolución: {width}x{height}", flush=True)
                    await show_updated_status(context, None)
                else:
                    await context.bot.send_message(chat_id=USER_ID, text="❌ Error guardando la foto.")
                return

        # Procesar video
        if update.message.video:
            video = update.message.video
            file = await video.get_file()

            # Descargar a archivo temporal para validar
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp_file:
                temp_path = tmp_file.name
                await file.download_to_drive(temp_path)

                # Validar duración
                is_valid, duration = await validate_video_duration(temp_path)

                if CV2_AVAILABLE and not is_valid:
                    os.unlink(temp_path)
                    await context.bot.send_message(
                        chat_id=USER_ID,
                        text=(
                            f"❌ **Video demasiado largo:** {format_duration(duration)}\n\n"
                            f"🎥 **Máximo permitido:** 20 segundos\n"
                            f"💡 **Solución:** Graba un video más corto"
                        ),
                        parse_mode='Markdown'
                    )
                    print(f"Video demasiado largo: {duration:.1f}s", flush=True)
                    return

                # Guardar archivo con permisos correctos
                final_path = f"{dir_path}/{hour}.mp4"
                if save_file_with_permissions(temp_path, final_path):
                    # Marcar como entregado
                    update_delivery_state(window_index, True)
                    await context.bot.send_message(
                        chat_id=USER_ID,
                        text=(
                            f"✅ **Video recibido y guardado**\n"
                            f"⏱️ **Duración:** {format_duration(duration)}\n"
                            f"📦 **Tamaño:** {get_file_size_mb(file_size)}"
                        ),
                        parse_mode='Markdown'
                    )
                    print(f"Video guardado: {final_path} - Duración: {duration:.1f}s", flush=True)
                    await show_updated_status(context, None)
                else:
                    await context.bot.send_message(chat_id=USER_ID, text="❌ Error guardando el video.")
                return

        # Procesar documento
        if update.message.document:
            doc = update.message.document
            filename = doc.file_name.lower()

            # Solo aceptar imágenes y videos comunes
            if filename.endswith((".jpg", ".jpeg", ".png", ".heic", ".heif")):
                # Es una imagen como documento
                file = await doc.get_file()

                with tempfile.NamedTemporaryFile(suffix=f'.{filename.split(".")[-1]}', delete=False) as tmp_file:
                    temp_path = tmp_file.name
                    await file.download_to_drive(temp_path)

                    # Validar resolución
                    is_valid, width, height = await validate_photo_resolution(temp_path)

                    if PIL_AVAILABLE and not is_valid:
                        os.unlink(temp_path)
                        await context.bot.send_message(
                            chat_id=USER_ID,
                            text=(
                                f"❌ **Resolución insuficiente:** {format_resolution(width, height)}\n\n"
                                f"📸 **Mínimo requerido:** 1080p (1920x1080)\n"
                                f"💡 **Solución:** Configura tu cámara en máxima calidad"
                            ),
                            parse_mode='Markdown'
                        )
                        print(f"Imagen con resolución insuficiente: {width}x{height}", flush=True)
                        return

                    # Guardar archivo con permisos correctos
                    final_path = f"{dir_path}/{hour}_{doc.file_name}"
                    if save_file_with_permissions(temp_path, final_path):
                        # Marcar como entregado
                        update_delivery_state(window_index, True)
                        await context.bot.send_message(
                            chat_id=USER_ID,
                            text=(
                                f"✅ **Imagen recibida y guardada**\n"
                                f"📏 **Resolución:** {format_resolution(width, height)}\n"
                                f"📦 **Tamaño:** {get_file_size_mb(file_size)}"
                            ),
                            parse_mode='Markdown'
                        )
                        print(f"Imagen guardada: {final_path} - Resolución: {width}x{height}", flush=True)
                        await show_updated_status(context, None)
                    else:
                        await context.bot.send_message(chat_id=USER_ID, text="❌ Error guardando la imagen.")
                    return

            elif filename.endswith((".mp4", ".mov", ".hevc")):
                # Es un video como documento
                file = await doc.get_file()

                with tempfile.NamedTemporaryFile(suffix=f'.{filename.split(".")[-1]}', delete=False) as tmp_file:
                    temp_path = tmp_file.name
                    await file.download_to_drive(temp_path)

                    # Validar duración
                    is_valid, duration = await validate_video_duration(temp_path)

                    if CV2_AVAILABLE and not is_valid:
                        os.unlink(temp_path)
                        await context.bot.send_message(
                            chat_id=USER_ID,
                            text=(
                                f"❌ **Video demasiado largo:** {format_duration(duration)}\n\n"
                                f"🎥 **Máximo permitido:** 20 segundos\n"
                                f"💡 **Solución:** Graba un video más corto"
                            ),
                            parse_mode='Markdown'
                        )
                        print(f"Video demasiado largo: {duration:.1f}s", flush=True)
                        return

                    # Guardar archivo con permisos correctos
                    final_path = f"{dir_path}/{hour}_{doc.file_name}"
                    if save_file_with_permissions(temp_path, final_path):
                        # Marcar como entregado
                        update_delivery_state(window_index, True)
                        await context.bot.send_message(
                            chat_id=USER_ID,
                            text=(
                                f"✅ **Video recibido y guardado**\n"
                                f"⏱️ **Duración:** {format_duration(duration)}\n"
                                f"📦 **Tamaño:** {get_file_size_mb(file_size)}"
                            ),
                            parse_mode='Markdown'
                        )
                        print(f"Video guardado: {final_path} - Duración: {duration:.1f}s", flush=True)
                        await show_updated_status(context, None)
                    else:
                        await context.bot.send_message(chat_id=USER_ID, text="❌ Error guardando el video.")
                    return
            else:
                await context.bot.send_message(
                    chat_id=USER_ID,
                    text=(
                        "❌ **Formato no soportado**\n\n"
                        "📸 **Imágenes:** JPG, PNG, HEIC, HEIF\n"
                        "🎥 **Videos:** MP4, MOV, HEVC\n\n"
                        f"{get_requirements_text()}"
                    ),
                    parse_mode='Markdown'
                )
                print(f"Archivo ignorado: {filename}", flush=True)
                return

        await context.bot.send_message(
            chat_id=USER_ID,
            text=(
                "❌ **No se detectó imagen o video válido**\n\n"
                f"{get_requirements_text()}"
            ),
            parse_mode='Markdown'
        )
        print("No se detectó imagen o video en el mensaje", flush=True)

    except Exception as e:
        print(f"Error guardando archivo: {e}", flush=True)
        await context.bot.send_message(chat_id=USER_ID, text="❌ Error al guardar el archivo.")

# Comando para mostrar el estado de las notificaciones
async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != USER_ID:
        await context.bot.send_message(chat_id=update.effective_user.id, text="❌ No tienes permisos para usar este bot.")
        return

    plan = load_plan_json()
    if not plan:
        await context.bot.send_message(chat_id=USER_ID, text="❌ No hay planificación activa para hoy.")
        return

    now = datetime.now()
    current_hour = now.hour
    current_total_minutes = current_hour * 60 + now.minute
    status_text = "📊 **Estado de notificaciones de hoy:**\n\n"

    for i, entry in enumerate(plan):
        notification_hour = entry.get("hour", 8)
        notification_minute = entry.get("minute", 0)
        time_str = format_notification_time(notification_hour, notification_minute)
        type_emoji = "📸" if entry["type"] == "foto" else "🎥"
        notification_total_minutes = notification_hour * 60 + notification_minute

        # Determinar el estado
        if entry.get("delivered", False):
            status_emoji = "✅"
            status_text += f"{status_emoji} {time_str} - {type_emoji} {entry['type'].upper()} - **ENTREGADO**\n"
        elif is_notification_window_active(plan, i, current_total_minutes):
            status_emoji = "🔔"
            end_hour, end_minute = get_next_notification_time(plan, i)
            status_text += f"{status_emoji} {time_str} - {type_emoji} {entry['type'].upper()} - **PENDIENTE** (hasta {end_hour:02d}:{end_minute:02d})\n"
        elif current_total_minutes >= notification_total_minutes:
            status_emoji = "⏰"
            status_text += f"{status_emoji} {time_str} - {type_emoji} {entry['type'].upper()} - **PERDIDO** (ventana cerrada)\n"
        else:
            status_emoji = "⏳"
            status_text += f"{status_emoji} {time_str} - {type_emoji} {entry['type'].upper()} - **PROGRAMADO**\n"

    # Agregar resumen
    delivered_count = sum(1 for entry in plan if entry.get("delivered", False))
    total_count = len(plan)

    status_text += f"\n📈 **Resumen:** {delivered_count}/{total_count} completadas"

    # Mostrar próxima notificación si existe
    next_notification = None
    for entry in plan:
        notification_hour = entry.get("hour", 8)
        notification_minute = entry.get("minute", 0)
        notification_total_minutes = notification_hour * 60 + notification_minute

        if notification_total_minutes > current_total_minutes and not entry.get("delivered", False):
            next_notification = format_notification_time(notification_hour, notification_minute)
            break

    if next_notification:
        status_text += f"\n🔔 **Próxima:** {next_notification}"

    # Añadir recordatorio completo de requisitos
    status_text += f"\n\n{get_requirements_text()}"

    # Añadir recordatorio de ventana de tiempo
    status_text += f"\n\n⏰ **Recordatorio:** Cada notificación es válida hasta que llegue la siguiente notificación."

    await context.bot.send_message(chat_id=USER_ID, text=status_text, parse_mode='Markdown')

# Comando para forzar programación del día
async def start_day(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != USER_ID:
        await context.bot.send_message(chat_id=update.effective_user.id, text="❌ No tienes permisos para usar este bot.")
        return

    await context.bot.send_message(chat_id=USER_ID, text="📅 Generando horas para hoy...")

    plan = load_plan_json()
    if plan is None:
        schedule = generate_random_schedule()
        save_plan_json(schedule)
        await context.bot.send_message(chat_id=USER_ID, text="✅ Nuevo plan generado. Las notificaciones se programarán automáticamente.")
    else:
        await context.bot.send_message(chat_id=USER_ID, text="✅ Ya existe un plan para hoy.")

    # Mostrar estado después de generar
    await status_command(update, context)

# Comando para mostrar información del sistema
async def info_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != USER_ID:
        await context.bot.send_message(chat_id=update.effective_user.id, text="❌ No tienes permisos para usar este bot.")
        return

    info_text = "🤖 **Información del sistema:**\n\n"
    info_text += f"📦 **Python Telegram Bot:** Disponible\n"
    info_text += f"⏰ **APScheduler:** Disponible\n"
    info_text += f"🖼️ **PIL/Pillow:** {'✅ Disponible' if PIL_AVAILABLE else '❌ No disponible'}\n"
    info_text += f"🎥 **OpenCV:** {'✅ Disponible' if CV2_AVAILABLE else '❌ No disponible'}\n\n"

    if not PIL_AVAILABLE:
        info_text += "⚠️ **Sin PIL:** No se puede validar resolución de imágenes\n"
    if not CV2_AVAILABLE:
        info_text += "⚠️ **Sin OpenCV:** No se puede validar duración de videos\n"

    if PIL_AVAILABLE and CV2_AVAILABLE:
        info_text += "✅ **Todas las validaciones activas**\n"

    info_text += f"\n📁 **Ruta de guardado:** {SAVE_PATH}\n"
    info_text += f"🔧 **Configuración de permisos:**\n"
    info_text += f"• Umask actual: {oct(os.umask(0o002))[2:]}\n"
    info_text += f"• Archivos: 664 (rw-rw-r--)\n"
    info_text += f"• Directorios: 775 (rwxrwxr-x)\n"
    info_text += f"• Owner: www-data (33:33)\n\n"
    info_text += f"📏 **Límites configurados:**\n"
    info_text += f"• Fotos: Mínimo 1080p\n"
    info_text += f"• Videos: Máximo {MAX_VIDEO_DURATION}s\n"
    info_text += f"• Tamaño: Máximo {MAX_FILE_SIZE/(1024*1024):.0f}MB"

    await context.bot.send_message(chat_id=USER_ID, text=info_text, parse_mode='Markdown')

# Comando de ayuda completo
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Comando para mostrar ayuda e información completa del bot"""
    if update.effective_user.id != USER_ID:
        await context.bot.send_message(chat_id=update.effective_user.id, text="❌ No tienes permisos para usar este bot.")
        return

    help_text = """
🤖 **Bot de Diario Fotográfico**

Este bot te ayuda a crear un diario visual automático enviándote notificaciones aleatorias durante el día para que captures momentos especiales.

📋 **COMANDOS DISPONIBLES:**

🏁 `/start` - Generar plan del día
• Crea un horario aleatorio de 5-9 notificaciones
• Solo se puede usar una vez por día
• Programa notificaciones automáticas

📊 `/status` - Ver estado de notificaciones
• Muestra todas las notificaciones del día
• Estado: PROGRAMADO, PENDIENTE, ENTREGADO, PERDIDO
• Progreso actual y próxima notificación

🔍 `/debug` - Debug de ventanas de tiempo
• Información técnica de ventanas activas
• Útil para resolver problemas
• Muestra ventana actual y disponible

🔧 `/permisos` - Verificar permisos de archivos
• Estado de permisos del directorio
• Configuración de umask
• Archivos recientes y sus permisos

ℹ️ `/info` - Información del sistema
• Estado de dependencias (PIL, OpenCV)
• Configuración de límites
• Rutas y configuración actual

⚙️ `/scheduler` - Debug del programador
• Jobs programados en el scheduler
• Próximas ejecuciones
• Estado interno del programador

❓ `/help` o `/ayuda` - Mostrar esta ayuda

📏 **REQUISITOS DE CONTENIDO:**

📸 **Para FOTOS:**
• Resolución mínima: 1080p (1920x1080)
• Tamaño máximo: 20MB
• Formatos: JPG, PNG, HEIC, HEIF
• Usa la máxima calidad de tu cámara

🎥 **Para VIDEOS:**
• Duración máxima: 20 segundos
• Tamaño máximo: 20MB
• Formatos: MP4, MOV, HEVC
• Graba en la mejor calidad disponible

⏰ **SISTEMA DE VENTANAS:**

• Cada notificación abre una "ventana de tiempo"
• La ventana permanece abierta hasta la siguiente notificación
• Solo puedes enviar UNA foto/video por ventana
• Si pierdes una ventana, se cierra automáticamente

**Ejemplo:**
```
08:00 - 📸 Notificación de FOTO
│
├─ 08:00-10:30: Puedes enviar la foto
│
10:30 - 🎥 Notificación de VIDEO
│
├─ 10:30-14:15: Puedes enviar el video
│
14:15 - 📸 Notificación de FOTO
│
└─ 14:15-23:59: Puedes enviar la foto
```

🔄 **RECUPERACIÓN AUTOMÁTICA:**

Si el bot se reinicia y hay notificaciones perdidas que aún están en ventana activa, se reenviarán automáticamente.

🌐 **INTERFAZ WEB:**

Accede a tu feed visual en: `http://localhost:8090`
• Ve todas tus fotos organizadas por fecha
• Actualización automática
• Lightbox para ver imágenes en grande
• Reproducción de videos integrada

🎯 **CONSEJOS DE USO:**

1. **Usa /start** solo una vez al día
2. **Responde rápido** a las notificaciones
3. **Revisa /status** para ver tu progreso
4. **Configura tu cámara** en máxima calidad
5. **Mantén el bot activo** para no perder notificaciones

💡 **¿Problemas?**

• `/debug` para ver ventanas activas
• `/permisos` para problemas de archivos
• `/info` para verificar configuración
• Revisa que tu contenido cumpla los requisitos

¡Disfruta capturando tu día! 📸✨
"""

    await context.bot.send_message(chat_id=USER_ID, text=help_text, parse_mode='Markdown')

    # Mostrar estado actual después de la ayuda
    plan = load_plan_json()
    if plan:
        status_summary = f"\n📈 **Estado actual:** "
        delivered_count = sum(1 for entry in plan if entry.get("delivered", False))
        total_count = len(plan)
        status_summary += f"{delivered_count}/{total_count} completadas"

        # Próxima notificación
        now = datetime.now()
        current_total_minutes = now.hour * 60 + now.minute
        next_notification = None

        for entry in plan:
            notification_hour = entry.get("hour", 8)
            notification_minute = entry.get("minute", 0)
            notification_total_minutes = notification_hour * 60 + notification_minute

            if notification_total_minutes > current_total_minutes and not entry.get("delivered", False):
                next_notification = format_notification_time(notification_hour, notification_minute)
                next_type = entry.get("type", "foto")
                status_summary += f"\n🔔 **Próxima:** {next_notification} ({next_type.upper()})"
                break

        if not next_notification and delivered_count < total_count:
            # Hay pendientes pero en ventana activa
            window_index, current_window = get_current_time_window(plan)
            if current_window and not current_window.get("delivered", False):
                current_type = current_window.get("type", "foto")
                status_summary += f"\n🔔 **AHORA:** Puedes enviar {current_type.upper()}"

        await context.bot.send_message(chat_id=USER_ID, text=status_summary, parse_mode='Markdown')
    else:
        await context.bot.send_message(
            chat_id=USER_ID,
            text="💡 **Sugerencia:** Usa `/start` para comenzar tu diario fotográfico de hoy.",
            parse_mode='Markdown'
        )

# Comando para depurar las ventanas de tiempo
async def debug_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Comando para depurar las ventanas de tiempo"""
    if update.effective_user.id != USER_ID:
        await context.bot.send_message(chat_id=update.effective_user.id, text="❌ No tienes permisos para usar este bot.")
        return

    plan = load_plan_json()
    if not plan:
        await context.bot.send_message(chat_id=USER_ID, text="❌ No hay planificación activa.")
        return

    now = datetime.now()
    current_hour = now.hour
    current_minute = now.minute
    current_total_minutes = current_hour * 60 + current_minute

    debug_text = f"🔍 **Debug ventanas de tiempo**\n\n"
    debug_text += f"⏰ **Hora actual:** {current_hour:02d}:{current_minute:02d}\n\n"

    active_window = None

    for i, entry in enumerate(plan):
        notification_hour = entry.get("hour", 8)
        notification_minute = entry.get("minute", 0)

        status = ""
        if entry.get("delivered", False):
            status = "✅ ENTREGADO"
        elif is_notification_window_active(plan, i, current_total_minutes):
            status = "🔔 VENTANA ACTIVA"
            active_window = i
        elif current_total_minutes >= (notification_hour * 60 + notification_minute):
            status = "⏰ VENTANA CERRADA"
        else:
            status = "⏳ PROGRAMADO"

        end_hour, end_minute = get_next_notification_time(plan, i)
        debug_text += (
            f"**Ventana {i+1}:**\n"
            f"• Notificación: {notification_hour:02d}:{notification_minute:02d}\n"
            f"• Ventana: {notification_hour:02d}:{notification_minute:02d} hasta {end_hour:02d}:{end_minute:02d}\n"
            f"• Tipo: {entry['type']}\n"
            f"• Estado: {status}\n\n"
        )

    if active_window is not None:
        debug_text += f"🎯 **Ventana activa:** Ventana {active_window + 1}\n"
        debug_text += f"🎬 **Puedes enviar:** {plan[active_window]['type'].upper()}"
    else:
        debug_text += "⏰ **No hay ventana activa en este momento**"

    await context.bot.send_message(chat_id=USER_ID, text=debug_text, parse_mode='Markdown')

# Comando para debug del scheduler
async def scheduler_debug_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Comando para debug del scheduler"""
    if update.effective_user.id != USER_ID:
        await context.bot.send_message(chat_id=update.effective_user.id, text="❌ No tienes permisos para usar este bot.")
        return

    try:
        scheduler = getattr(context.application, 'scheduler', None)
        if not scheduler:
            await context.bot.send_message(chat_id=USER_ID, text="❌ Scheduler no disponible.")
            return

        jobs = scheduler.get_jobs()
        debug_text = f"🔧 **Debug Scheduler**\n\n"
        debug_text += f"📊 **Jobs programados:** {len(jobs)}\n\n"

        for job in jobs:
            debug_text += f"**Job ID:** {job.id}\n"
            debug_text += f"**Próxima ejecución:** {job.next_run_time}\n"
            debug_text += f"**Función:** {job.func.__name__}\n\n"

        await context.bot.send_message(chat_id=USER_ID, text=debug_text, parse_mode='Markdown')

    except Exception as e:
        await context.bot.send_message(chat_id=USER_ID, text=f"❌ Error en scheduler debug: {e}")

# Comando para verificar permisos del directorio
async def permissions_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Comando para verificar y mostrar información de permisos"""
    if update.effective_user.id != USER_ID:
        await context.bot.send_message(chat_id=update.effective_user.id, text="❌ No tienes permisos para usar este bot.")
        return

    try:
        permissions_text = "🔧 **Estado de permisos:**\n\n"

        # Verificar directorio base
        if os.path.exists(SAVE_PATH):
            stat_info = os.stat(SAVE_PATH)
            permissions_text += f"📁 **{SAVE_PATH}:**\n"
            permissions_text += f"• Permisos: {oct(stat_info.st_mode)[-3:]}\n"
            permissions_text += f"• Owner: {stat_info.st_uid}:{stat_info.st_gid}\n"
            permissions_text += f"• Escribible: {'✅' if os.access(SAVE_PATH, os.W_OK) else '❌'}\n\n"
        else:
            permissions_text += f"❌ **{SAVE_PATH} no existe**\n\n"

        # Verificar umask actual
        current_umask = os.umask(0o002)  # Leer y restaurar
        os.umask(current_umask)
        permissions_text += f"🔧 **Configuración actual:**\n"
        permissions_text += f"• Umask: {oct(current_umask)[2:]}\n"
        permissions_text += f"• Archivos nuevos: {oct(0o666 & ~current_umask)[2:]}\n"
        permissions_text += f"• Directorios nuevos: {oct(0o777 & ~current_umask)[2:]}\n\n"

        # Verificar algunos archivos recientes
        permissions_text += "📄 **Archivos recientes:**\n"
        file_count = 0
        for root, dirs, files in os.walk(SAVE_PATH):
            for file in sorted(files)[-3:]:  # Solo los 3 más recientes
                if file_count >= 3:
                    break
                file_path = os.path.join(root, file)
                try:
                    stat_info = os.stat(file_path)
                    permissions_text += f"• {file}: {oct(stat_info.st_mode)[-3:]} ({stat_info.st_uid}:{stat_info.st_gid})\n"
                    file_count += 1
                except:
                    continue

        if file_count == 0:
            permissions_text += "• No hay archivos recientes\n"

        await context.bot.send_message(chat_id=USER_ID, text=permissions_text, parse_mode='Markdown')

    except Exception as e:
        await context.bot.send_message(chat_id=USER_ID, text=f"❌ Error verificando permisos: {e}")

# Función para programar una notificación
async def schedule_notification(scheduler, app, notification_data):
    now = datetime.now()
    target_hour = notification_data.get("hour", 8)
    target_minute = notification_data.get("minute", 0)

    # Si ya pasó la hora, NO programar la notificación para hoy
    if target_hour < now.hour or (target_hour == now.hour and target_minute <= now.minute):
        print(f"Notificación para las {target_hour:02d}:{target_minute:02d} ya pasó, no se programa")
        return

    # Usar el scheduler para programar con minutos exactos
    job_id = f"notification_{target_hour}_{target_minute}"
    scheduler.add_job(
        send_photo_request,
        CronTrigger(hour=target_hour, minute=target_minute),
        args=[app, notification_data],  # Pasar el entry completo
        id=job_id,
        replace_existing=True
    )
    print(f"Programada notificación de {notification_data.get('type', 'foto')} para las {target_hour:02d}:{target_minute:02d}")

# Función para enviar notificaciones perdidas que aún están en ventana activa
async def send_missed_notifications_in_window(app):
    """Envía notificaciones que ya pasaron pero aún están en ventana activa"""
    try:
        plan = load_plan_json()
        if not plan:
            return

        now = datetime.now()
        current_total_minutes = now.hour * 60 + now.minute
        notifications_sent = 0

        print("🔍 Verificando notificaciones perdidas que aún están en ventana activa...")

        for i, entry in enumerate(plan):
            notification_hour = entry.get("hour", 8)
            notification_minute = entry.get("minute", 0)
            notification_total_minutes = notification_hour * 60 + notification_minute
            is_delivered = entry.get("delivered", False)

            # Verificar si la ventana está activa y la notificación no está entregada
            if (is_notification_window_active(plan, i, current_total_minutes) and
                notification_total_minutes <= current_total_minutes and
                not is_delivered):

                end_hour, end_minute = get_next_notification_time(plan, i)
                print(f"📢 Reenviando notificación perdida: {entry['type']} de las {notification_hour:02d}:{notification_minute:02d} (ventana hasta {end_hour:02d}:{end_minute:02d})")

                # Enviar la notificación inmediatamente
                await send_photo_request(app, entry)
                notifications_sent += 1

        if notifications_sent > 0:
            print(f"✅ Se reenviaron {notifications_sent} notificaciones perdidas")
        else:
            print("✅ No hay notificaciones perdidas en ventana activa")

    except Exception as e:
        print(f"❌ Error verificando notificaciones perdidas: {e}")

# Generar horarios aleatorios y programar notificaciones
async def schedule_today(app, scheduler=None):
    try:
        plan = load_plan_json()

        if plan is None:
            plan = generate_random_schedule()
            save_plan_json(plan)
            print(f"✅ Plan generado con {len(plan)} notificaciones")

        # Verificar y enviar notificaciones perdidas que aún están en ventana activa
        await send_missed_notifications_in_window(app)

        # Programar solo las notificaciones que aún no han llegado
        now = datetime.now()
        current_total_minutes = now.hour * 60 + now.minute
        notifications_scheduled = 0

        for entry in plan:
            target_hour = entry.get("hour", 8)
            target_minute = entry.get("minute", 0)
            target_total_minutes = target_hour * 60 + target_minute

            if target_total_minutes > current_total_minutes:
                if scheduler:
                    await schedule_notification(scheduler, app, entry)
                    notifications_scheduled += 1

        print(f"Programadas {notifications_scheduled} notificaciones pendientes para hoy")

        # Mostrar cuántas notificaciones ya pasaron
        missed_count = len(plan) - notifications_scheduled
        if missed_count > 0:
            print(f"Se perdieron {missed_count} notificaciones que ya pasaron")

    except Exception as e:
        print(f"Error en schedule_today: {e}")

# Función principal
async def main():
    try:
        # Verificar dependencias al inicio
        print("🚀 Iniciando bot de fotos...")
        print(f"📦 PIL/Pillow: {'✅' if PIL_AVAILABLE else '❌'}")
        print(f"🎥 OpenCV: {'✅' if CV2_AVAILABLE else '❌'}")

        if not PIL_AVAILABLE:
            print("⚠️ Validación de resolución de imágenes deshabilitada")
        if not CV2_AVAILABLE:
            print("⚠️ Validación de duración de videos deshabilitada")

        # Configurar permisos iniciales
        print("🔧 Configurando permisos iniciales...")
        setup_directory_permissions(SAVE_PATH)

        # Crear la aplicación
        app = ApplicationBuilder().token(TOKEN).build()

        # Agregar handlers para comandos
        app.add_handler(CommandHandler("start", start_day))
        app.add_handler(CommandHandler("status", status_command))
        app.add_handler(CommandHandler("info", info_command))
        app.add_handler(CommandHandler("debug", debug_command))
        app.add_handler(CommandHandler("scheduler", scheduler_debug_command))
        app.add_handler(CommandHandler("permisos", permissions_command))
        app.add_handler(CommandHandler("help", help_command))
        app.add_handler(CommandHandler("ayuda", help_command))

        # Handler para mensajes (debe ir después de los comandos)
        app.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO | filters.Document.ALL | filters.TEXT, photo_handler))

        # Crear y configurar el scheduler
        scheduler = AsyncIOScheduler()

        # Guardar referencia del scheduler en la aplicación para debug
        app.scheduler = scheduler

        # Job para programar nuevas notificaciones cada día a medianoche
        scheduler.add_job(
            schedule_today,
            CronTrigger(hour=0, minute=0),
            args=[app, scheduler],
            id='daily_schedule'
        )
        scheduler.start()

        # Programar hoy si no existe
        await schedule_today(app, scheduler)

        print("✅ Bot en marcha con planificación diaria, validaciones de contenido y gestión de permisos.")

        # Iniciar el bot
        await app.initialize()
        await app.start()
        await app.updater.start_polling()

        # Mantener el bot corriendo
        try:
            await asyncio.Event().wait()
        except KeyboardInterrupt:
            print("🛑 Deteniendo bot...")
        finally:
            await app.updater.stop()
            await app.stop()
            await app.shutdown()
            scheduler.shutdown()

    except Exception as e:
        print(f"❌ Error en main: {e}")

# Punto de entrada
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("🛑 Bot detenido por el usuario")
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
