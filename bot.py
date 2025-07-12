import os
import random
import asyncio
import json
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

# Configuración
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
USER_ID = int(os.getenv("TELEGRAM_USER_ID"))
SAVE_PATH = "/data/fotos"

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

# Enviar notificación al usuario
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
            msg = f"🎥 Son las {now}. Haz un video corto de lo que estás haciendo ahora."
        else:
            msg = f"📸 Son las {now}. Haz una foto de lo que estás haciendo ahora."
        await app.bot.send_message(chat_id=USER_ID, text=msg)
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

# Función para encontrar la ventana de tiempo actual
def get_current_time_window(plan):
    now = datetime.now()
    current_hour = now.hour
    
    # Buscar la ventana de tiempo actual (notificación más reciente que ya debería haber sido enviada)
    for i, entry in enumerate(plan):
        notification_hour = 8 + entry["hour"]
        # Permitir 2 horas después de cada notificación
        if notification_hour <= current_hour < notification_hour + 2:
            return i, entry
    return None, None

# Función auxiliar para mostrar el estado actualizado
async def show_updated_status(context, plan):
    """Muestra el estado actualizado después de recibir contenido"""
    delivered_count = sum(1 for entry in plan if entry.get("delivered", False))
    total_count = len(plan)
    
    # Encontrar próxima notificación pendiente
    now = datetime.now()
    current_hour = now.hour
    next_notification = None
    
    for entry in plan:
        notification_hour = 8 + entry["hour"]
        if notification_hour > current_hour and not entry.get("delivered", False):
            next_notification = f"{notification_hour:02d}:00"
            break
    
    status_msg = f"📈 Progreso: {delivered_count}/{total_count} completadas"
    if next_notification:
        status_msg += f"\n🔔 Próxima: {next_notification}"
    
    await context.bot.send_message(chat_id=USER_ID, text=status_msg)

# Guardar foto que el usuario envía
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
        primer_hora = 8 + plan[0]["hour"]
        primera_notificacion = now.replace(hour=primer_hora, minute=0, second=0, microsecond=0)
        if now < primera_notificacion:
            next_time = primera_notificacion.strftime("%H:%M")
            await context.bot.send_message(chat_id=USER_ID, text=f"⏳ Aún no puedes enviar nada. La primera notificación será a las {next_time}.")
            print("Intento de envío antes de la primera notificación", flush=True)
            return

    # Verificar ventana de tiempo actual
    window_index, current_window = get_current_time_window(plan)
    if current_window is None:
        # No hay ventana activa, mostrar próxima notificación
        now = datetime.now()
        next_notification = None
        for entry in plan:
            notification_hour = 8 + entry["hour"]
            if notification_hour > now.hour:
                next_notification = f"{notification_hour:02d}:00"
                break
        
        if next_notification:
            await context.bot.send_message(chat_id=USER_ID, text=f"⏰ Fuera de horario. La próxima notificación será a las {next_notification}.")
        else:
            await context.bot.send_message(chat_id=USER_ID, text="⏰ No hay más notificaciones programadas para hoy.")
        print("Intento de envío fuera de ventana de tiempo", flush=True)
        return

    # Verificar tipo de contenido
    expected_type = current_window["type"]
    if not check_content_type(update, expected_type):
        if expected_type == "foto":
            await context.bot.send_message(chat_id=USER_ID, text="❌ Se esperaba una FOTO, pero enviaste otro tipo de contenido. Por favor, envía una imagen.")
        else:
            await context.bot.send_message(chat_id=USER_ID, text="❌ Se esperaba un VIDEO, pero enviaste otro tipo de contenido. Por favor, envía un video.")
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
            await context.bot.send_message(chat_id=USER_ID, text="❌ Se esperaba contenido multimedia (foto o video), pero enviaste texto.")
            print("Intento de envío de texto en lugar de multimedia", flush=True)
            return

        # Si es foto normal
        if update.message.photo:
            photo = update.message.photo[-1]
            file = await photo.get_file()
            file_path = f"{dir_path}/{hour}.jpg"
            await file.download_to_drive(file_path)
            # Marcar como entregado
            update_delivery_state(window_index, True)
            await context.bot.send_message(chat_id=USER_ID, text="✅ Foto recibida y guardada.")
            print(f"Foto guardada como {file_path}", flush=True)
            # Mostrar estado actualizado
            await show_updated_status(context, plan)
            return

        # Si es video normal
        if update.message.video:
            video = update.message.video
            file = await video.get_file()
            file_path = f"{dir_path}/{hour}.mp4"
            await file.download_to_drive(file_path)
            # Marcar como entregado
            update_delivery_state(window_index, True)
            await context.bot.send_message(chat_id=USER_ID, text="✅ Video recibido y guardado.")
            print(f"Video guardado como {file_path}", flush=True)
            # Mostrar estado actualizado
            await show_updated_status(context, plan)
            return

        # Si es documento (archivo)
        if update.message.document:
            doc = update.message.document
            filename = doc.file_name.lower()
            # Solo aceptar imágenes y videos comunes
            if filename.endswith((".jpg", ".jpeg", ".png", ".heic", ".heif", ".mp4", ".mov", ".hevc")):
                file = await doc.get_file()
                file_path = f"{dir_path}/{hour}_{doc.file_name}"
                await file.download_to_drive(file_path)
                # Marcar como entregado
                update_delivery_state(window_index, True)
                await context.bot.send_message(chat_id=USER_ID, text="✅ Archivo recibido y guardado.")
                print(f"Archivo guardado como {file_path}", flush=True)
                # Mostrar estado actualizado
                await show_updated_status(context, plan)
                return
            else:
                await context.bot.send_message(chat_id=USER_ID, text="❌ Solo se aceptan imágenes (jpg, png, heic/heif) o videos (mp4, mov, hevc).")
                print(f"Archivo ignorado: {filename}", flush=True)
                return

        await context.bot.send_message(chat_id=USER_ID, text="❌ No se detectó imagen o video para guardar.")
        print("No se detectó imagen o video en el mensaje", flush=True)
    except Exception as e:
        print(f"Error guardando foto: {e}", flush=True)
        await context.bot.send_message(chat_id=USER_ID, text="❌ Error al guardar la foto.")

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
    status_text = "📊 **Estado de notificaciones de hoy:**\n\n"
    
    for i, entry in enumerate(plan):
        notification_hour = 8 + entry["hour"]
        time_str = f"{notification_hour:02d}:00"
        type_emoji = "📸" if entry["type"] == "foto" else "🎥"
        
        # Determinar el estado
        if entry.get("delivered", False):
            status_emoji = "✅"
            status_text += f"{status_emoji} {time_str} - {type_emoji} {entry['type'].upper()} - **ENTREGADO**\n"
        elif notification_hour <= current_hour:
            if notification_hour + 2 > current_hour:
                status_emoji = "🔔"
                status_text += f"{status_emoji} {time_str} - {type_emoji} {entry['type'].upper()} - **PENDIENTE** (ventana activa)\n"
            else:
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
        notification_hour = 8 + entry["hour"]
        if notification_hour > current_hour and not entry.get("delivered", False):
            next_notification = f"{notification_hour:02d}:00"
            break
    
    if next_notification:
        status_text += f"\n🔔 **Próxima:** {next_notification}"
    
    await context.bot.send_message(chat_id=USER_ID, text=status_text, parse_mode='Markdown')

# Comando para forzar programación del día
async def start_day(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != USER_ID:
        await context.bot.send_message(chat_id=update.effective_user.id, text="❌ No tienes permisos para usar este bot.")
        return

    await context.bot.send_message(chat_id=USER_ID, text="📅 Generando horas para hoy...")
    await schedule_today(context.application)
    # Mostrar estado después de generar
    await status_command(update, context)

# Función para programar una notificación
async def schedule_notification(app, hour_offset):
    now = datetime.now()
    target_hour = 8 + hour_offset
    dt = now.replace(hour=target_hour, minute=0, second=0, microsecond=0)
    
    if dt <= now:
        # Si ya pasó la hora, programar para el día siguiente
        dt += timedelta(days=1)
    
    delay = (dt - now).total_seconds()
    
    def create_task():
        asyncio.create_task(send_photo_request(app, hour_offset))
    
    # Usar call_later del loop actual
    asyncio.get_event_loop().call_later(delay, create_task)

# Generar 3-4 horas aleatorias y programar notificaciones
async def schedule_today(app):
    try:
        plan = load_plan_json()
        
        if plan is None:
            hours = sorted(random.sample(range(14), random.randint(5, 9)))
            plan = [{"hour": h, "type": random.choice(["foto", "video"]), "delivered": False} for h in hours]
            save_plan_json(plan)

        # Programar las notificaciones
        for entry in plan:
            await schedule_notification(app, entry["hour"])
        print(f"Programadas {len(plan)} notificaciones para hoy")
    except Exception as e:
        print(f"Error en schedule_today: {e}")

# Función principal
async def main():
    try:
        # Crear la aplicación
        app = ApplicationBuilder().token(TOKEN).build()
        
        # Agregar handlers para comandos
        app.add_handler(CommandHandler("start", start_day))
        app.add_handler(CommandHandler("status", status_command))
        
        # Handler para mensajes (debe ir después de los comandos)
        app.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO | filters.Document.ALL | filters.TEXT, photo_handler))

        # Crear y configurar el scheduler
        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            schedule_today, 
            CronTrigger(hour=0, minute=0), 
            args=[app],
            id='daily_schedule'
        )
        scheduler.start()

        # Programar hoy si no existe
        await schedule_today(app)

        print("Bot en marcha con planificación diaria.")
        
        # Iniciar el bot
        await app.initialize()
        await app.start()
        await app.updater.start_polling()
        
        # Mantener el bot corriendo
        try:
            await asyncio.Event().wait()
        except KeyboardInterrupt:
            print("Deteniendo bot...")
        finally:
            await app.updater.stop()
            await app.stop()
            await app.shutdown()
            scheduler.shutdown()
            
    except Exception as e:
        print(f"Error en main: {e}")

# Punto de entrada
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot detenido por el usuario")
    except Exception as e:
        print(f"Error inesperado: {e}")