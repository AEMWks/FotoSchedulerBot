FROM python:3.11-slim

# Configurar zona horaria
ENV TZ=Europe/Madrid
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Instalar solo dependencias esenciales y disponibles
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tzdata \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libjpeg62-turbo \
    libpng16-16 \
 && rm -rf /var/lib/apt/lists/* \
 && apt-get clean

# Crear directorio para el bot
WORKDIR /app

# Copiar requirements.txt primero para aprovechar el cache de Docker
COPY requirements.txt .

# Instalar dependencias de Python con versiones específicas compatibles
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el script
COPY bot.py .

# Variables de entorno
ENV PYTHONUNBUFFERED=1

# Crear carpeta para guardar fotos (ruta interna del contenedor)
RUN mkdir -p /data/fotos

# Variables de entorno necesarias (se pueden sobreescribir en docker-compose)
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_USER_ID=""

# Comando por defecto
CMD ["python", "bot.py"]
