import os
import random
import asyncio
import json
import tempfile
import shutil
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
except ImportError:
    PIL_AVAILABLE = False
    print("⚠️ PIL/Pillow no disponible - validación de resolución deshabilitada")

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    print("⚠️ OpenCV no disponible - validación de duración de video deshabilitada")

# Configuración
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
USER_ID = int(os.getenv("TELEGRAM_USER_ID"))
SAVE_PATH = "/data/fotos"

# Límites de contenido
MAX_VIDEO_DURATION = 20  # segundos
MIN_PHOTO_RESOLUTION = 1920 * 1080  # 1080p mínimo para fotos
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

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
    return f"{SAVE_PATH}/planificacion/{today}.json"

def save_plan_json(plan):
    path = get_plan_json_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(plan, f)

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
async def send_photo_request(app, hour):
    try:
        now = datetime.now().strftime("%H:%M")
        # Cargar el plan json
        plan = load_plan_json()
        tipo = "foto"
        if plan:
            # Buscar el tipo para la hora actual
            for entry in plan:
                if entry["hour"] == hour:
                    tipo = entry["type"]
                    break

        if tipo == "video":
            msg = (
                f"🎥 **¡Hora de grabar!** Son las {now}\n"
                f"Haz un video corto de lo que estás haciendo ahora.\n\n"
                f"{get_requirements_text()}\n\n"
                f"⚠️ **Importante:** El video será rechazado si excede los 20 segundos o 20MB."
            )
        else:
            msg = (
                f"📸 **¡Hora de fotografiar!** Son las {now}\n"
                f"Haz una foto de lo que estás haciendo ahora.\n\n"
                f"{get_requirements_text()}\n\n"
                f"⚠️ **Importante:** La foto será rechazada si es menor a 1080p o mayor a 20MB."
            )

        await app.bot.send_message(chat_id=USER_ID, text=msg, parse_mode='Markdown')
    except Exception as e:
        print(f"Error enviando notificación: {e}")

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

    print(f"🕐 Hora actual: {current_hour:02d}:{current_minute:02d}", flush=True)

    # Buscar la ventana de tiempo actual
    for i, entry in enumerate(plan):
        notification_hour = entry.get("hour", 8)
        notification_minute = entry.get("minute", 0)

        # Debug: mostrar todas las ventanas
        print(f"🔍 Ventana {i}: Notificación a las {notification_hour:02d}:{notification_minute:02d}, tipo: {entry['type']}, entregado: {entry.get('delivered', False)}", flush=True)

        # Convertir tiempo de notificación a minutos totales desde medianoche
        notification_total_minutes = notification_hour * 60 + notification_minute
        current_total_minutes = current_hour * 60 + current_minute

        # Permitir 2 horas (120 minutos) después de cada notificación
        window_end_minutes = notification_total_minutes + 120

        # Si estamos en la ventana de tiempo
        if notification_total_minutes <= current_total_minutes < window_end_minutes:
            window_end_hour = (window_end_minutes // 60)
            window_end_minute = window_end_minutes % 60
            print(f"✅ Ventana activa encontrada: {notification_hour:02d}:{notification_minute:02d}-{window_end_hour:02d}:{window_end_minute:02d}", flush=True)
            return i, entry

    print("❌ No hay ventana activa", flush=True)
    return None, None

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
    current_hour = now.hour
    next_notification = None

    for entry in updated_plan:
        notification_hour = 8 + entry["hour"]
        if notification_hour > current_hour and not entry.get("delivered", False):
            next_notification = f"{notification_hour:02d}:00"
            break

    status_msg = f"📈 **Progreso:** {delivered_count}/{total_count} completadas"
    if next_notification:
        status_msg += f"\n🔔 **Próxima:** {next_notification}"
    elif delivered_count == total_count:
        status_msg += f"\n🎉 **¡Todas las notificaciones completadas!**"

    await context.bot.send_message(chat_id=USER_ID, text=status_msg, parse_mode='Markdown')

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
        # Ya se completó esta notificación, buscar la siguiente
        now = datetime.now()
        next_notification = None
        for entry in plan:
            notification_hour = 8 + entry["hour"]
            if notification_hour > now.hour and not entry.get("delivered", False):
                next_notification = f"{notification_hour:02d}:00"
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
        os.makedirs(dir_path, exist_ok=True)

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

                # Mover archivo a ubicación final usando shutil para evitar cross-device link error
                final_path = f"{dir_path}/{hour}.jpg"
                shutil.move(temp_path, final_path)

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

                # Mover archivo a ubicación final usando shutil para evitar cross-device link error
                final_path = f"{dir_path}/{hour}.mp4"
                shutil.move(temp_path, final_path)

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

                    # Mover archivo a ubicación final usando shutil para evitar cross-device link error
                    final_path = f"{dir_path}/{hour}_{doc.file_name}"
                    shutil.move(temp_path, final_path)

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

                    # Mover archivo a ubicación final usando shutil para evitar cross-device link error
                    final_path = f"{dir_path}/{hour}_{doc.file_name}"
                    shutil.move(temp_path, final_path)

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

# Comando para mostrar el estado de las notificaciones con límites
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
    status_text = "📊 **Estado de notificaciones de hoy:**\n\n"

    for i, entry in enumerate(plan):
        notification_hour = entry.get("hour", 8)
        notification_minute = entry.get("minute", 0)
        time_str = format_notification_time(notification_hour, notification_minute)
        type_emoji = "📸" if entry["type"] == "foto" else "🎥"

        # Convertir a minutos totales para comparación
        notification_total_minutes = notification_hour * 60 + notification_minute
        current_total_minutes = current_hour * 60 + now.minute

        # Determinar el estado
        if entry.get("delivered", False):
            status_emoji = "✅"
            status_text += f"{status_emoji} {time_str} - {type_emoji} {entry['type'].upper()} - **ENTREGADO**\n"
        elif notification_total_minutes <= current_total_minutes < notification_total_minutes + 120:
            status_emoji = "🔔"
            status_text += f"{status_emoji} {time_str} - {type_emoji} {entry['type'].upper()} - **PENDIENTE** (ventana activa)\n"
        elif current_total_minutes >= notification_total_minutes + 120:
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
    current_total_minutes = current_hour * 60 + now.minute

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
    status_text += f"\n\n⏰ **Recordatorio:** Tienes 2 horas desde cada notificación para enviar el contenido."

    await context.bot.send_message(chat_id=USER_ID, text=status_text, parse_mode='Markdown')

# Comando para forzar programación del día
async def start_day(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != USER_ID:
        await context.bot.send_message(chat_id=update.effective_user.id, text="❌ No tienes permisos para usar este bot.")
        return

    await context.bot.send_message(chat_id=USER_ID, text="📅 Generando horas para hoy...")
    # Necesitamos acceso al scheduler, pero no lo tenemos aquí
    # Por simplicidad, recreamos el plan pero no las notificaciones
    # Las notificaciones se programarán cuando el bot se reinicie
    plan = load_plan_json()
    if plan is None:
        schedule = generate_random_schedule()
        save_plan_json(schedule)
        await context.bot.send_message(chat_id=USER_ID, text="✅ Nuevo plan generado. Reinicia el bot para activar las notificaciones.")
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
    info_text += f"📏 **Límites configurados:**\n"
    info_text += f"• Fotos: Mínimo 1080p\n"
    info_text += f"• Videos: Máximo {MAX_VIDEO_DURATION}s\n"
    info_text += f"• Tamaño: Máximo {MAX_FILE_SIZE/(1024*1024):.0f}MB"

    await context.bot.send_message(chat_id=USER_ID, text=info_text, parse_mode='Markdown')

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

    debug_text = f"🔍 **Debug ventanas de tiempo**\n\n"
    debug_text += f"⏰ **Hora actual:** {current_hour:02d}:{now.minute:02d}\n\n"

    active_window = None

    for i, entry in enumerate(plan):
        notification_hour = 8 + entry["hour"]
        window_end = notification_hour + 2

        status = ""
        if entry.get("delivered", False):
            status = "✅ ENTREGADO"
        elif notification_hour <= current_hour < window_end:
            status = "🔔 VENTANA ACTIVA"
            active_window = i
        elif current_hour >= window_end:
            status = "⏰ VENTANA CERRADA"
        else:
            status = "⏳ PROGRAMADO"

        debug_text += (
            f"**Ventana {i+1}:**\n"
            f"• Notificación: {notification_hour:02d}:00\n"
            f"• Ventana: {notification_hour:02d}:00-{window_end:02d}:00\n"
            f"• Tipo: {entry['type']}\n"
            f"• Estado: {status}\n\n"
        )

    if active_window is not None:
        debug_text += f"🎯 **Ventana activa:** Ventana {active_window + 1}\n"
        debug_text += f"🎬 **Puedes enviar:** {plan[active_window]['type'].upper()}"
    else:
        debug_text += "⏰ **No hay ventana activa en este momento**"

    await context.bot.send_message(chat_id=USER_ID, text=debug_text, parse_mode='Markdown')

# Función para programar una notificación con minutos
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
        args=[app, notification_data],
        id=job_id,
        replace_existing=True
    )
    print(f"Programada notificación para las {target_hour:02d}:{target_minute:02d} usando scheduler")

# Generar horarios aleatorios y programar notificaciones
async def schedule_today(app, scheduler=None):
    try:
        plan = load_plan_json()

        if plan is None:
            plan = generate_random_schedule()
            save_plan_json(plan)

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

        # Crear la aplicación
        app = ApplicationBuilder().token(TOKEN).build()

        # Agregar handlers para comandos
        app.add_handler(CommandHandler("start", start_day))
        app.add_handler(CommandHandler("status", status_command))
        app.add_handler(CommandHandler("info", info_command))
        app.add_handler(CommandHandler("debug", debug_command))

        # Handler para mensajes (debe ir después de los comandos)
        app.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO | filters.Document.ALL | filters.TEXT, photo_handler))

        # Crear y configurar el scheduler
        scheduler = AsyncIOScheduler()

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

        print("✅ Bot en marcha con planificación diaria y validaciones de contenido.")

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
