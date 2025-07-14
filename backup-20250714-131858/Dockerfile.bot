# Usar Ubuntu LTS como base
FROM ubuntu:22.04

# Evitar interacción durante la instalación
ENV DEBIAN_FRONTEND=noninteractive

# Configurar zona horaria correctamente
ENV TZ=Europe/Madrid
RUN apt-get update && apt-get install -y tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && dpkg-reconfigure -f noninteractive tzdata \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Actualizar sistema e instalar Python y dependencias básicas
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    python3-venv \
    curl \
    wget \
    build-essential \
    cmake \
    pkg-config \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias para OpenCV
RUN apt-get update && apt-get install -y \
    # Dependencias de imagen
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libwebp-dev \
    libopenjp2-7-dev \
    # Dependencias de video
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    # Dependencias del sistema
    libgtk-3-dev \
    libatlas-base-dev \
    gfortran \
    # Dependencias adicionales
    libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Crear enlaces simbólicos para Python
RUN ln -s /usr/bin/python3 /usr/bin/python

# Actualizar pip
RUN python3 -m pip install --upgrade pip setuptools wheel

# Instalar NumPy primero (requerido por OpenCV)
RUN pip install numpy==1.24.4

# Instalar OpenCV
RUN pip install opencv-python-headless==4.8.1.78

# Crear directorio de trabajo
WORKDIR /app

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias de la aplicación
RUN pip install --no-cache-dir \
    python-telegram-bot==20.8 \
    APScheduler==3.10.4 \
    Pillow==10.1.0

# Copiar el código del bot
COPY bot.py .

# Variables de entorno
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Configurar OpenCV
ENV OPENCV_LOG_LEVEL=ERROR
ENV OPENCV_VIDEOIO_PRIORITY_MSMF=0

# Crear directorio de fotos
RUN mkdir -p /data/fotos

# Variables de entorno para tokens
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_USER_ID=""

# Script de entrada
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "🚀 Iniciando bot con Ubuntu + OpenCV..."\n\
\n\
# Configurar umask\n\
umask 002\n\
\n\
# Crear directorio de fotos\n\
mkdir -p /data/fotos\n\
\n\
# Configurar permisos\n\
echo "📁 Configurando permisos..."\n\
chown -R 33:33 /data/fotos 2>/dev/null || echo "⚠️ No se pudo cambiar ownership"\n\
chmod -R 775 /data/fotos 2>/dev/null || echo "⚠️ No se pudieron configurar permisos"\n\
\n\
# Verificar Python\n\
echo "🐍 Verificando Python..."\n\
python3 --version\n\
pip --version\n\
\n\
# Verificar dependencias principales\n\
echo "📦 Verificando dependencias..."\n\
\n\
python3 -c "import telegram; print(f\"✅ python-telegram-bot {telegram.__version__}\")" || {\n\
    echo "❌ Error con telegram bot"\n\
    exit 1\n\
}\n\
\n\
python3 -c "from apscheduler.schedulers.asyncio import AsyncIOScheduler; import apscheduler; print(f\"✅ APScheduler {apscheduler.__version__}\")" || {\n\
    echo "❌ Error con APScheduler"\n\
    exit 1\n\
}\n\
\n\
python3 -c "from PIL import Image; import PIL; print(f\"✅ Pillow {PIL.__version__}\")" || {\n\
    echo "❌ Error con Pillow"\n\
    exit 1\n\
}\n\
\n\
python3 -c "import numpy as np; print(f\"✅ NumPy {np.__version__}\")" || {\n\
    echo "❌ Error con NumPy"\n\
    exit 1\n\
}\n\
\n\
# Verificar OpenCV\n\
echo "🎥 Verificando OpenCV..."\n\
python3 -c "import cv2; print(f\"✅ OpenCV {cv2.__version__}\")" || {\n\
    echo "❌ Error con OpenCV"\n\
    exit 1\n\
}\n\
\n\
# Prueba funcional de OpenCV\n\
echo "🧪 Probando funcionalidad de OpenCV..."\n\
python3 -c "\n\
import cv2\n\
import numpy as np\n\
import tempfile\n\
import os\n\
\n\
try:\n\
    # Test básico de VideoCapture\n\
    print(\"  📹 Probando VideoCapture...\")\n\
    cap = cv2.VideoCapture()\n\
    if cap is not None:\n\
        cap.release()\n\
        print(\"  ✅ VideoCapture inicializado correctamente\")\n\
    \n\
    # Test de operaciones de imagen\n\
    print(\"  🖼️  Probando operaciones de imagen...\")\n\
    img = np.zeros((100, 100, 3), dtype=np.uint8)\n\
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)\n\
    resized = cv2.resize(gray, (50, 50))\n\
    print(\"  ✅ Operaciones de imagen funcionando\")\n\
    \n\
    # Test de propiedades de video\n\
    print(\"  📊 Probando propiedades de video...\")\n\
    # Crear VideoCapture dummy\n\
    test_cap = cv2.VideoCapture()\n\
    # Verificar que podemos acceder a las propiedades\n\
    fps_prop = cv2.CAP_PROP_FPS\n\
    frame_count_prop = cv2.CAP_PROP_FRAME_COUNT\n\
    test_cap.release()\n\
    print(\"  ✅ Propiedades de video accesibles\")\n\
    \n\
    print(\"✅ OpenCV completamente funcional\")\n\
    \n\
except Exception as e:\n\
    print(f\"❌ Error en pruebas de OpenCV: {e}\")\n\
    exit(1)\n\
" || {\n\
    echo "❌ OpenCV falló las pruebas funcionales"\n\
    exit 1\n\
}\n\
\n\
# Verificar directorio escribible\n\
echo "📂 Verificando directorio..."\n\
if [ -w "/data/fotos" ]; then\n\
    echo "✅ Directorio escribible"\n\
    echo "test" > "/data/fotos/.test" && rm "/data/fotos/.test" && echo "✅ Escritura OK"\n\
else\n\
    echo "⚠️ Directorio no escribible"\n\
fi\n\
\n\
# Monitoreo de permisos\n\
echo "🔄 Iniciando monitoreo..."\n\
(\n\
    while true; do\n\
        sleep 60\n\
        find "/data/fotos" -type f ! -perm 664 -exec chmod 664 {} \\; 2>/dev/null || true\n\
        find "/data/fotos" -type d ! -perm 775 -exec chmod 775 {} \\; 2>/dev/null || true\n\
        find "/data/fotos" \\( ! -user 33 -o ! -group 33 \\) -exec chown 33:33 {} \\; 2>/dev/null || true\n\
    done\n\
) &\n\
\n\
echo "🎉 Sistema listo con OpenCV funcional"\n\
echo "====================================="\n\
\n\
exec python3 bot.py' > /entrypoint.sh

RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
