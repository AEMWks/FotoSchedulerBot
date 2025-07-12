FROM python:3.11-slim

# Instalar dependencias necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Crear directorio para el bot
WORKDIR /app

# Copiar el script
COPY bot.py .

# Instalar dependencias de Python (eliminé nest_asyncio ya que no lo usamos)
RUN pip install --no-cache-dir python-telegram-bot==20.8 apscheduler

ENV PYTHONUNBUFFERED=1
# Crear carpeta para guardar fotos (ruta interna del contenedor)
RUN mkdir -p /data/fotos

# Variables de entorno necesarias (se pueden sobreescribir en docker-compose)
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_USER_ID=""

# Comando por defecto
CMD ["python", "bot.py"]