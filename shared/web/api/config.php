<?php
// shared/web/api/config.php - Configuración centralizada para todas las APIs

// ==========================================
// CONFIGURACIÓN BÁSICA
// ==========================================

// Configuración de rutas
define('PHOTOS_BASE_PATH', $_ENV['PHOTOS_PATH'] ?? '/data/fotos');
define('API_VERSION', '1.0');
define('API_TIMEZONE', $_ENV['TZ'] ?? 'Europe/Madrid');

// Configuración de zona horaria
date_default_timezone_set(API_TIMEZONE);

// ==========================================
// CONFIGURACIÓN DE PAGINACIÓN
// ==========================================

define('DEFAULT_PAGE_SIZE', 10);
define('MAX_PAGE_SIZE', 100);
define('MAX_SEARCH_RESULTS', 1000);

// ==========================================
// CONFIGURACIÓN DE EXPORTACIÓN
// ==========================================

define('MAX_EXPORT_FILES', 10000);
define('EXPORT_TEMP_DIR', sys_get_temp_dir());
define('MAX_EXPORT_SIZE_MB', 500); // 500MB máximo

// ==========================================
// CONFIGURACIÓN DE CACHE
// ==========================================

define('CACHE_ENABLED', true);
define('CACHE_DURATION', 300); // 5 minutos

// ==========================================
// CONFIGURACIÓN DE LOGS
// ==========================================

define('LOG_API_REQUESTS', true);
define('LOG_ERRORS_ONLY', false);

// ==========================================
// FUNCIONES PRINCIPALES DE RESPUESTA
// ==========================================

/**
 * Headers CORS estándar
 */
function setCorsHeaders() {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 86400'); // 24 horas
}

/**
 * Headers de contenido JSON
 */
function setJsonHeaders() {
    header('Content-Type: application/json; charset=utf-8');
    setCorsHeaders();
}

/**
 * Manejar preflight OPTIONS
 */
function handlePreflight() {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        setCorsHeaders();
        http_response_code(200);
        exit();
    }
}

/**
 * Función de logging unificada
 */
function logApiRequest($endpoint, $params = [], $responseCode = 200, $error = null) {
    if (!LOG_API_REQUESTS && !$error) {
        return;
    }

    if (LOG_ERRORS_ONLY && $responseCode < 400) {
        return;
    }

    $logData = [
        'timestamp' => date('c'),
        'endpoint' => $endpoint,
        'method' => $_SERVER['REQUEST_METHOD'] ?? 'GET',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'params' => $params,
        'response_code' => $responseCode
    ];

    if ($error) {
        $logData['error'] = $error;
    }

    error_log('API: ' . json_encode($logData));
}

// ==========================================
// FUNCIONES DE VALIDACIÓN
// ==========================================

/**
 * Validar parámetro de fecha
 */
function validateDateParam($date, $paramName = 'date') {
    if (!$date) {
        return null;
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        throw new InvalidArgumentException("Formato de $paramName inválido. Use YYYY-MM-DD");
    }

    $dateObj = DateTime::createFromFormat('Y-m-d', $date);
    if (!$dateObj || $dateObj->format('Y-m-d') !== $date) {
        throw new InvalidArgumentException("$paramName no es una fecha válida");
    }

    return $date;
}

/**
 * Validar parámetro de página
 */
function validatePageParam($page) {
    $page = intval($page);
    return max(1, $page);
}

/**
 * Validar parámetro de límite
 */
function validateLimitParam($limit) {
    $limit = intval($limit);
    return max(1, min(MAX_PAGE_SIZE, $limit));
}

/**
 * Validar parámetro de tipo
 */
function validateTypeParam($type) {
    $validTypes = ['all', 'photo', 'video'];
    return in_array($type, $validTypes) ? $type : 'all';
}

// ==========================================
// FUNCIONES DE RESPUESTA
// ==========================================

/**
 * Respuesta de error estándar
 */
function sendErrorResponse($message, $code = 400, $details = null) {
    http_response_code($code);
    setJsonHeaders();

    $response = [
        'success' => false,
        'error' => [
            'message' => $message,
            'code' => $code,
            'timestamp' => date('c')
        ]
    ];

    if ($details) {
        $response['error']['details'] = $details;
    }

    echo json_encode($response, JSON_PRETTY_PRINT);
    exit();
}

/**
 * Respuesta de éxito estándar
 */
function sendSuccessResponse($data, $meta = []) {
    setJsonHeaders();

    $response = [
        'success' => true,
        'data' => $data,
        'meta' => array_merge([
            'timestamp' => date('c'),
            'api_version' => API_VERSION,
            'timezone' => API_TIMEZONE
        ], $meta)
    ];

    echo json_encode($response, JSON_PRETTY_PRINT);
}

/**
 * Respuesta JSON simple (para compatibilidad)
 */
function sendJsonResponse($data) {
    setJsonHeaders();
    echo json_encode($data, JSON_PRETTY_PRINT);
}

// ==========================================
// FUNCIONES DE ARCHIVOS
// ==========================================

/**
 * Verificar si un directorio contiene archivos válidos
 */
function hasValidFiles($dirPath) {
    if (!is_dir($dirPath)) {
        return false;
    }

    $files = glob($dirPath . '/*.{jpg,jpeg,png,mp4}', GLOB_BRACE);
    return !empty(array_filter($files, function($file) {
        $filename = basename($file);
        return preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $filename);
    }));
}

/**
 * Obtener información de archivos válidos en un directorio
 */
function getValidFilesInDirectory($dirPath, $relativePath = '') {
    $files = [];

    if (!is_dir($dirPath)) {
        return $files;
    }

    $handle = opendir($dirPath);
    if (!$handle) {
        return $files;
    }

    while (false !== ($file = readdir($handle))) {
        if (preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $file)) {
            $fullPath = $dirPath . '/' . $file;
            $isVideo = preg_match('/\.mp4$/i', $file);

            // Extraer timestamp del nombre del archivo
            $timestamp = '';
            if (preg_match('/(\d{2})-(\d{2})-(\d{2})/', $file, $matches)) {
                $timestamp = $matches[1] . ':' . $matches[2] . ':' . $matches[3];
            }

            $files[] = [
                'filename' => $file,
                'type' => $isVideo ? 'video' : 'photo',
                'timestamp' => $timestamp,
                'path' => '/photos/' . ($relativePath ? $relativePath . '/' : '') . $file,
                'full_path' => $fullPath,
                'size' => file_exists($fullPath) ? filesize($fullPath) : 0,
                'modified' => file_exists($fullPath) ? filemtime($fullPath) : 0
            ];
        }
    }

    closedir($handle);

    // Ordenar por timestamp
    usort($files, function($a, $b) {
        return strcmp($a['timestamp'], $b['timestamp']);
    });

    return $files;
}

// ==========================================
// FUNCIONES DE FORMATO
// ==========================================

/**
 * Formatear fechas en español
 */
function formatSpanishDate($dateStr) {
    $monthNames = [
        1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril',
        5 => 'mayo', 6 => 'junio', 7 => 'julio', 8 => 'agosto',
        9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre'
    ];

    $dayNames = [
        'Monday' => 'lunes', 'Tuesday' => 'martes', 'Wednesday' => 'miércoles',
        'Thursday' => 'jueves', 'Friday' => 'viernes', 'Saturday' => 'sábado', 'Sunday' => 'domingo'
    ];

    $date = new DateTime($dateStr);
    $dayOfWeek = $dayNames[$date->format('l')];
    $day = $date->format('j');
    $month = $monthNames[intval($date->format('n'))];
    $year = $date->format('Y');

    return ucfirst($dayOfWeek) . ', ' . $day . ' de ' . $month . ' de ' . $year;
}

/**
 * Formatear tamaño de archivo
 */
function formatFileSize($bytes) {
    if ($bytes == 0) return '0 Bytes';

    $k = 1024;
    $sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    $i = floor(log($bytes) / log($k));

    return round($bytes / pow($k, $i), 2) . ' ' . $sizes[$i];
}

// ==========================================
// FUNCIONES DE CACHE
// ==========================================

/**
 * Limpiar archivos temporales antiguos
 */
function cleanupTempFiles() {
    $tempDir = EXPORT_TEMP_DIR;
    $files = glob($tempDir . '/fotos_*.{zip,json}', GLOB_BRACE);

    foreach ($files as $file) {
        if (file_exists($file) && filemtime($file) < (time() - 3600)) { // 1 hora
            unlink($file);
        }
    }
}

// ==========================================
// FUNCIONES DE UTILIDAD
// ==========================================

/**
 * Obtener IP del cliente
 */
function getClientIP() {
    $ipKeys = ['HTTP_CLIENT_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'];

    foreach ($ipKeys as $key) {
        if (array_key_exists($key, $_SERVER) === true) {
            foreach (explode(',', $_SERVER[$key]) as $ip) {
                $ip = trim($ip);
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }
    }

    return $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
}

/**
 * Verificar si la request es desde localhost
 */
function isLocalRequest() {
    $ip = getClientIP();
    return in_array($ip, ['127.0.0.1', '::1', 'localhost']) ||
           preg_match('/^192\.168\./', $ip) ||
           preg_match('/^10\./', $ip) ||
           preg_match('/^172\.(1[6-9]|2[0-9]|3[0-1])\./', $ip);
}

// ==========================================
// CONFIGURACIÓN DE MANEJO DE ERRORES
// ==========================================

/**
 * Configurar manejo de errores
 */
set_error_handler(function($severity, $message, $file, $line) {
    if (error_reporting() & $severity) {
        throw new ErrorException($message, 0, $severity, $file, $line);
    }
});

// ==========================================
// AUTO-CLEANUP (ocasional)
// ==========================================

// Auto-cleanup al inicio de cada request (solo ocasionalmente)
if (rand(1, 100) === 1) { // 1% de probabilidad
    cleanupTempFiles();
}

// ==========================================
// VALIDACIÓN DE CONFIGURACIÓN
// ==========================================

// Verificar que el directorio de fotos existe
if (!is_dir(PHOTOS_BASE_PATH)) {
    error_log("ADVERTENCIA: El directorio de fotos no existe: " . PHOTOS_BASE_PATH);
}

// Verificar permisos de lectura
if (!is_readable(PHOTOS_BASE_PATH)) {
    error_log("ADVERTENCIA: El directorio de fotos no es legible: " . PHOTOS_BASE_PATH);
}

// Log de configuración (solo en debug)
if ($_ENV['DEBUG_MODE'] ?? false) {
    error_log("API Config loaded - Photos path: " . PHOTOS_BASE_PATH . ", Timezone: " . API_TIMEZONE);
}

// ==========================================
// FUNCIONES AUXILIARES PARA DESARROLLO
// ==========================================

/**
 * Generar datos mock para desarrollo
 */
function generateMockData($type = 'photos', $count = 10) {
    if (!($_ENV['DEBUG_MODE'] ?? false)) {
        return [];
    }

    $mockData = [];
    $baseDate = new DateTime();

    for ($i = 0; $i < $count; $i++) {
        $date = clone $baseDate;
        $date->sub(new DateInterval("P{$i}D"));

        if ($type === 'photos') {
            $mockData[] = [
                'filename' => sprintf('%02d-%02d-%02d.jpg', rand(8, 20), rand(0, 59), rand(0, 59)),
                'date' => $date->format('Y-m-d'),
                'type' => 'photo',
                'timestamp' => sprintf('%02d:%02d:%02d', rand(8, 20), rand(0, 59), rand(0, 59)),
                'size' => rand(1024000, 5024000)
            ];
        }
    }

    return $mockData;
}

/**
 * Log de debug (solo si DEBUG_MODE está activo)
 */
function debugLog($message, $data = null) {
    if ($_ENV['DEBUG_MODE'] ?? false) {
        $logMessage = "[DEBUG] " . $message;
        if ($data !== null) {
            $logMessage .= " - Data: " . json_encode($data);
        }
        error_log($logMessage);
    }
}
?>
