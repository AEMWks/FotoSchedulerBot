<?php
// web/api/utils/ResponseHelper.php - Utilidad para respuestas estandarizadas

/**
 * Clase para manejar respuestas HTTP de forma consistente
 */
class ResponseHelper {

    /**
     * Configuración por defecto
     */
    private static $defaultConfig = [
        'timezone' => 'Europe/Madrid',
        'api_version' => '1.0',
        'debug' => false,
        'cors_enabled' => true
    ];

    /**
     * Configurar el helper
     */
    public static function configure($config = []) {
        self::$defaultConfig = array_merge(self::$defaultConfig, $config);

        // Configurar zona horaria
        date_default_timezone_set(self::$defaultConfig['timezone']);

        // Configurar headers CORS si está habilitado
        if (self::$defaultConfig['cors_enabled']) {
            self::setCorsHeaders();
        }
    }

    /**
     * Respuesta de éxito
     */
    public static function success($data = null, $meta = [], $statusCode = 200) {
        http_response_code($statusCode);
        self::setJsonHeaders();

        $response = [
            'success' => true,
            'data' => $data,
            'meta' => array_merge([
                'timestamp' => self::getTimestamp(),
                'api_version' => self::$defaultConfig['api_version'],
                'timezone' => self::$defaultConfig['timezone']
            ], $meta)
        ];

        if (self::$defaultConfig['debug']) {
            $response['debug'] = self::getDebugInfo();
        }

        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        self::logRequest($statusCode);
        exit();
    }

    /**
     * Respuesta de error
     */
    public static function error($message, $statusCode = 400, $details = null, $errorCode = null) {
        http_response_code($statusCode);
        self::setJsonHeaders();

        $response = [
            'success' => false,
            'error' => [
                'message' => $message,
                'code' => $errorCode,
                'status' => $statusCode,
                'timestamp' => self::getTimestamp()
            ]
        ];

        if ($details !== null) {
            $response['error']['details'] = $details;
        }

        if (self::$defaultConfig['debug']) {
            $response['debug'] = self::getDebugInfo();
        }

        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        self::logRequest($statusCode, $message);
        exit();
    }

    /**
     * Respuesta de validación de errores
     */
    public static function validationError($errors, $message = 'Errores de validación') {
        self::error($message, 422, ['validation_errors' => $errors], 'VALIDATION_ERROR');
    }

    /**
     * Respuesta de recurso no encontrado
     */
    public static function notFound($resource = 'Recurso', $message = null) {
        $defaultMessage = "$resource no encontrado";
        self::error($message ?: $defaultMessage, 404, null, 'NOT_FOUND');
    }

    /**
     * Respuesta de no autorizado
     */
    public static function unauthorized($message = 'No autorizado') {
        self::error($message, 401, null, 'UNAUTHORIZED');
    }

    /**
     * Respuesta de prohibido
     */
    public static function forbidden($message = 'Acceso prohibido') {
        self::error($message, 403, null, 'FORBIDDEN');
    }

    /**
     * Respuesta de error interno
     */
    public static function internalError($message = 'Error interno del servidor', $details = null) {
        // Log del error para debugging
        error_log("Internal Error: $message");
        if ($details) {
            error_log("Error details: " . json_encode($details));
        }

        self::error($message, 500, $details, 'INTERNAL_ERROR');
    }

    /**
     * Respuesta de paginación
     */
    public static function paginated($data, $pagination, $meta = []) {
        $paginationMeta = [
            'pagination' => [
                'current_page' => $pagination['current_page'] ?? 1,
                'per_page' => $pagination['per_page'] ?? 10,
                'total' => $pagination['total'] ?? 0,
                'total_pages' => $pagination['total_pages'] ?? 1,
                'has_next' => $pagination['has_next'] ?? false,
                'has_previous' => $pagination['has_previous'] ?? false
            ]
        ];

        self::success($data, array_merge($paginationMeta, $meta));
    }

    /**
     * Respuesta de archivo/descarga
     */
    public static function download($filePath, $filename = null, $mimeType = null) {
        if (!file_exists($filePath)) {
            self::notFound('Archivo');
        }

        $filename = $filename ?: basename($filePath);
        $mimeType = $mimeType ?: self::getMimeType($filePath);

        // Headers para descarga
        header('Content-Type: ' . $mimeType);
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: no-cache, must-revalidate');
        header('Expires: 0');

        // Streaming del archivo
        $handle = fopen($filePath, 'rb');
        if ($handle) {
            while (!feof($handle)) {
                echo fread($handle, 8192);
                if (ob_get_level()) {
                    ob_flush();
                }
                flush();
            }
            fclose($handle);
        }

        self::logRequest(200, "File downloaded: $filename");
        exit();
    }

    /**
     * Respuesta de redirección
     */
    public static function redirect($url, $statusCode = 302) {
        http_response_code($statusCode);
        header("Location: $url");
        exit();
    }

    /**
     * Headers JSON
     */
    private static function setJsonHeaders() {
        header('Content-Type: application/json; charset=utf-8');
    }

    /**
     * Headers CORS
     */
    private static function setCorsHeaders() {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Max-Age: 86400');
    }

    /**
     * Obtener timestamp formateado
     */
    private static function getTimestamp() {
        return date('c'); // ISO 8601
    }

    /**
     * Información de debug
     */
    private static function getDebugInfo() {
        return [
            'memory_usage' => memory_get_usage(true),
            'memory_peak' => memory_get_peak_usage(true),
            'execution_time' => microtime(true) - $_SERVER['REQUEST_TIME_FLOAT'],
            'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'Unknown',
            'request_uri' => $_SERVER['REQUEST_URI'] ?? 'Unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
            'ip_address' => self::getClientIP()
        ];
    }

    /**
     * Obtener IP del cliente
     */
    private static function getClientIP() {
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
     * Detectar tipo MIME
     */
    private static function getMimeType($filePath) {
        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        $mimeTypes = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'mp4' => 'video/mp4',
            'mov' => 'video/quicktime',
            'avi' => 'video/x-msvideo',
            'zip' => 'application/zip',
            'json' => 'application/json',
            'pdf' => 'application/pdf'
        ];

        return $mimeTypes[$extension] ?? 'application/octet-stream';
    }

    /**
     * Log de requests
     */
    private static function logRequest($statusCode, $message = null) {
        if (self::$defaultConfig['debug']) {
            $logData = [
                'timestamp' => self::getTimestamp(),
                'method' => $_SERVER['REQUEST_METHOD'] ?? 'Unknown',
                'uri' => $_SERVER['REQUEST_URI'] ?? 'Unknown',
                'status' => $statusCode,
                'ip' => self::getClientIP(),
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
            ];

            if ($message) {
                $logData['message'] = $message;
            }

            error_log('API Request: ' . json_encode($logData));
        }
    }

    /**
     * Validar parámetros requeridos
     */
    public static function validateRequired($data, $requiredFields) {
        $missing = [];

        foreach ($requiredFields as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                $missing[] = $field;
            }
        }

        if (!empty($missing)) {
            self::validationError([
                'missing_fields' => $missing
            ], 'Faltan campos requeridos');
        }
    }

    /**
     * Validar formato de fecha
     */
    public static function validateDate($date, $format = 'Y-m-d') {
        $d = DateTime::createFromFormat($format, $date);
        return $d && $d->format($format) === $date;
    }

    /**
     * Sanitizar entrada
     */
    public static function sanitizeInput($input) {
        if (is_array($input)) {
            return array_map([self::class, 'sanitizeInput'], $input);
        }

        return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Manejar opciones CORS preflight
     */
    public static function handlePreflight() {
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            self::setCorsHeaders();
            http_response_code(200);
            exit();
        }
    }

    /**
     * Crear respuesta de caché
     */
    public static function cacheResponse($cacheKey, $ttl = 3600) {
        // Implementación básica de caché
        $cacheFile = sys_get_temp_dir() . '/api_cache_' . md5($cacheKey);

        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $ttl) {
            $cachedData = json_decode(file_get_contents($cacheFile), true);
            if ($cachedData) {
                header('X-Cache: HIT');
                self::success($cachedData['data'], array_merge($cachedData['meta'], [
                    'cached_at' => date('c', filemtime($cacheFile))
                ]));
            }
        }

        return null; // No hay caché válido
    }

    /**
     * Guardar en caché
     */
    public static function saveToCache($cacheKey, $data, $meta = []) {
        $cacheFile = sys_get_temp_dir() . '/api_cache_' . md5($cacheKey);
        $cacheData = [
            'data' => $data,
            'meta' => $meta,
            'created_at' => time()
        ];

        file_put_contents($cacheFile, json_encode($cacheData));
    }

    /**
     * Limpiar caché
     */
    public static function clearCache($pattern = null) {
        $tempDir = sys_get_temp_dir();
        $pattern = $pattern ? "api_cache_*$pattern*" : 'api_cache_*';

        $files = glob($tempDir . '/' . $pattern);
        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
    }

    /**
     * Rate limiting básico
     */
    public static function rateLimit($identifier, $maxRequests = 100, $timeWindow = 3600) {
        $key = 'rate_limit_' . md5($identifier);
        $rateLimitFile = sys_get_temp_dir() . '/' . $key;

        $now = time();
        $requests = [];

        // Cargar requests existentes
        if (file_exists($rateLimitFile)) {
            $data = json_decode(file_get_contents($rateLimitFile), true);
            $requests = $data['requests'] ?? [];
        }

        // Filtrar requests dentro de la ventana de tiempo
        $requests = array_filter($requests, function($timestamp) use ($now, $timeWindow) {
            return ($now - $timestamp) < $timeWindow;
        });

        // Verificar límite
        if (count($requests) >= $maxRequests) {
            $resetTime = min($requests) + $timeWindow;
            self::error('Rate limit excedido', 429, [
                'max_requests' => $maxRequests,
                'time_window' => $timeWindow,
                'reset_at' => date('c', $resetTime)
            ], 'RATE_LIMIT_EXCEEDED');
        }

        // Agregar request actual
        $requests[] = $now;

        // Guardar
        file_put_contents($rateLimitFile, json_encode([
            'requests' => $requests,
            'updated_at' => $now
        ]));

        // Headers informativos
        header('X-RateLimit-Limit: ' . $maxRequests);
        header('X-RateLimit-Remaining: ' . ($maxRequests - count($requests)));
        header('X-RateLimit-Reset: ' . (min($requests) + $timeWindow));
    }

    /**
     * Respuesta con streaming
     */
    public static function stream($generator, $meta = []) {
        self::setJsonHeaders();
        header('Transfer-Encoding: chunked');

        echo json_encode([
            'success' => true,
            'stream' => true,
            'meta' => array_merge([
                'timestamp' => self::getTimestamp(),
                'api_version' => self::$defaultConfig['api_version']
            ], $meta)
        ]) . "\n";

        if (ob_get_level()) {
            ob_flush();
        }
        flush();

        foreach ($generator as $chunk) {
            echo json_encode(['data' => $chunk]) . "\n";
            if (ob_get_level()) {
                ob_flush();
            }
            flush();
        }

        echo json_encode(['end' => true]) . "\n";
        exit();
    }

    /**
     * Formatear tamaño de archivo
     */
    public static function formatFileSize($bytes) {
        if ($bytes == 0) return '0 Bytes';

        $k = 1024;
        $sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        $i = floor(log($bytes) / log($k));

        return round($bytes / pow($k, $i), 2) . ' ' . $sizes[$i];
    }

    /**
     * Formatear duración
     */
    public static function formatDuration($seconds) {
        if ($seconds < 60) {
            return round($seconds, 1) . 's';
        }

        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;

        if ($minutes < 60) {
            return $minutes . 'm ' . round($remainingSeconds, 1) . 's';
        }

        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;

        return $hours . 'h ' . $remainingMinutes . 'm';
    }

    /**
     * Generar hash de entidad para ETag
     */
    public static function generateETag($data) {
        return '"' . md5(json_encode($data)) . '"';
    }

    /**
     * Verificar ETag para cache del cliente
     */
    public static function checkETag($data) {
        $etag = self::generateETag($data);
        $clientETag = $_SERVER['HTTP_IF_NONE_MATCH'] ?? null;

        if ($clientETag && $clientETag === $etag) {
            header('ETag: ' . $etag);
            http_response_code(304);
            exit();
        }

        header('ETag: ' . $etag);
        return $etag;
    }

    /**
     * Respuesta con headers de cache
     */
    public static function successWithCache($data, $ttl = 3600, $meta = []) {
        header('Cache-Control: public, max-age=' . $ttl);
        header('Expires: ' . gmdate('D, d M Y H:i:s', time() + $ttl) . ' GMT');

        $etag = self::checkETag($data);

        self::success($data, array_merge($meta, [
            'cache' => [
                'ttl' => $ttl,
                'expires_at' => date('c', time() + $ttl),
                'etag' => $etag
            ]
        ]));
    }

    /**
     * Respuesta condicional basada en última modificación
     */
    public static function conditionalResponse($data, $lastModified, $meta = []) {
        $lastModifiedTimestamp = is_string($lastModified) ? strtotime($lastModified) : $lastModified;
        $clientModified = $_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? null;

        if ($clientModified && strtotime($clientModified) >= $lastModifiedTimestamp) {
            header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $lastModifiedTimestamp) . ' GMT');
            http_response_code(304);
            exit();
        }

        header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $lastModifiedTimestamp) . ' GMT');

        self::success($data, array_merge($meta, [
            'last_modified' => date('c', $lastModifiedTimestamp)
        ]));
    }

    /**
     * Limpiar archivos temporales antiguos
     */
    public static function cleanup($maxAge = 86400) {
        $tempDir = sys_get_temp_dir();
        $patterns = ['api_cache_*', 'rate_limit_*', 'fotos_*.zip'];

        foreach ($patterns as $pattern) {
            $files = glob($tempDir . '/' . $pattern);
            foreach ($files as $file) {
                if (is_file($file) && (time() - filemtime($file)) > $maxAge) {
                    unlink($file);
                }
            }
        }
    }

    /**
     * Información de salud de la API
     */
    public static function healthCheck($checks = []) {
        $health = [
            'status' => 'healthy',
            'timestamp' => self::getTimestamp(),
            'version' => self::$defaultConfig['api_version'],
            'uptime' => self::getUptime(),
            'checks' => []
        ];

        // Checks básicos
        $basicChecks = [
            'disk_space' => disk_free_space('.') > (100 * 1024 * 1024), // 100MB
            'memory' => memory_get_usage() < (50 * 1024 * 1024), // 50MB
            'temp_writable' => is_writable(sys_get_temp_dir())
        ];

        $health['checks'] = array_merge($basicChecks, $checks);

        // Determinar estado general
        $allHealthy = array_reduce($health['checks'], function($carry, $check) {
            return $carry && $check;
        }, true);

        if (!$allHealthy) {
            $health['status'] = 'unhealthy';
            http_response_code(503);
        }

        self::success($health);
    }

    /**
     * Obtener uptime del servidor
     */
    private static function getUptime() {
        if (function_exists('sys_getloadavg') && file_exists('/proc/uptime')) {
            $uptime = file_get_contents('/proc/uptime');
            $uptime = floatval(explode(' ', $uptime)[0]);
            return round($uptime, 2);
        }

        return null;
    }

    /**
     * Métricas de rendimiento
     */
    public static function metrics() {
        $metrics = [
            'memory' => [
                'current' => memory_get_usage(true),
                'peak' => memory_get_peak_usage(true),
                'limit' => ini_get('memory_limit')
            ],
            'execution_time' => microtime(true) - $_SERVER['REQUEST_TIME_FLOAT'],
            'requests' => [
                'method' => $_SERVER['REQUEST_METHOD'],
                'uri' => $_SERVER['REQUEST_URI'],
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
            ],
            'server' => [
                'php_version' => PHP_VERSION,
                'os' => PHP_OS,
                'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'
            ]
        ];

        if (function_exists('sys_getloadavg')) {
            $metrics['system'] = [
                'load_average' => sys_getloadavg()
            ];
        }

        self::success($metrics);
    }
}

// Auto-configuración si se incluye directamente
if (!defined('RESPONSE_HELPER_CONFIGURED')) {
    ResponseHelper::configure();
    define('RESPONSE_HELPER_CONFIGURED', true);
}

// Cleanup automático ocasional
if (rand(1, 100) === 1) {
    ResponseHelper::cleanup();
}
?>
