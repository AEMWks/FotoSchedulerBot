<?php
// shared/web/api/index.php - Enrutador principal de APIs

// Configuración de errores y headers básicos
error_reporting(E_ALL);
ini_set('display_errors', 0); // No mostrar errores en producción

// Headers CORS y contenido
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Manejar preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir archivos de configuración y utilidades
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils/ResponseHelper.php';
require_once __DIR__ . '/utils/FileManager.php';

// Configurar ResponseHelper
ResponseHelper::configure([
    'debug' => $_ENV['DEBUG_MODE'] ?? false,
    'timezone' => $_ENV['TZ'] ?? 'Europe/Madrid'
]);

/**
 * Enrutador principal de APIs
 */
class APIRouter {
    private $routes = [];
    private $basePath;

    public function __construct() {
        $this->basePath = __DIR__ . '/routes';
        $this->defineRoutes();
    }

    /**
     * Definir todas las rutas disponibles
     */
    private function defineRoutes() {
        $this->routes = [
            // Rutas básicas
            'GET /photos/{year}/{month}/{day}' => 'photos.php',
            'GET /search' => 'search.php',
            'GET /stats' => 'stats.php',
            'GET /dates' => 'dates.php',
            'GET /export' => 'export.php',
            'GET /random' => 'random.php',
            'GET /calendar/{year}/{month}' => 'calendar.php',
            'GET /calendar' => 'calendar.php', // Mes actual por defecto
            'GET /feed' => 'feed.php',
            'GET /comments/{date}' => 'comments.php',
            'POST /comments/{date}' => 'comments.php',
            'DELETE /comments/{date}' => 'comments.php',

            // Rutas de salud y información
            'GET /health' => 'health.php',
            'GET /' => 'info.php',
        ];
    }

    /**
     * Procesar la request actual
     */
    public function handleRequest() {
        try {
            $method = $_SERVER['REQUEST_METHOD'];
            $path = $this->getPath();

            logApiRequest($path, $_GET, 200);

            // Buscar ruta coincidente
            $routeFile = $this->matchRoute($method, $path);

            if (!$routeFile) {
                $this->handleNotFound($path);
                return;
            }

            // Ejecutar la ruta
            $this->executeRoute($routeFile, $path);

        } catch (Exception $e) {
            $this->handleError($e);
        }
    }

    /**
     * Obtener el path de la request
     */
    private function getPath() {
        $requestUri = $_SERVER['REQUEST_URI'] ?? '/';

        // Remover query string
        $path = strtok($requestUri, '?');

        // Remover /api del inicio si existe
        $path = preg_replace('#^/api#', '', $path);

        // Asegurar que empiece con /
        if (!str_starts_with($path, '/')) {
            $path = '/' . $path;
        }

        return $path;
    }

    /**
     * Buscar ruta coincidente
     */
    private function matchRoute($method, $path) {
        foreach ($this->routes as $routePattern => $file) {
            list($routeMethod, $routePath) = explode(' ', $routePattern, 2);

            if ($method !== $routeMethod) {
                continue;
            }

            // Convertir patrón a regex
            $pattern = $this->patternToRegex($routePath);

            if (preg_match($pattern, $path, $matches)) {
                // Guardar parámetros de ruta en $_GET
                $this->extractRouteParams($routePath, $path, $matches);
                return $file;
            }
        }

        return null;
    }

    /**
     * Convertir patrón de ruta a regex
     */
    private function patternToRegex($pattern) {
        $pattern = preg_replace('/\{([^}]+)\}/', '([^/]+)', $pattern);
        return '#^' . $pattern . '$#';
    }

    /**
     * Extraer parámetros de la ruta
     */
    private function extractRouteParams($routePath, $actualPath, $matches) {
        preg_match_all('/\{([^}]+)\}/', $routePath, $paramNames);

        if (!empty($paramNames[1])) {
            for ($i = 0; $i < count($paramNames[1]); $i++) {
                $paramName = $paramNames[1][$i];
                $paramValue = $matches[$i + 1] ?? null;

                if ($paramValue !== null) {
                    $_GET[$paramName] = $paramValue;
                }
            }
        }
    }

    /**
     * Ejecutar archivo de ruta
     */
    private function executeRoute($routeFile, $path) {
        $filePath = $this->basePath . '/' . $routeFile;

        if (!file_exists($filePath)) {
            throw new Exception("Route file not found: $routeFile");
        }

        // Incluir el archivo de ruta
        include $filePath;
    }

    /**
     * Manejar ruta no encontrada
     */
    private function handleNotFound($path) {
        ResponseHelper::notFound('Endpoint', "La ruta '$path' no fue encontrada");
    }

    /**
     * Manejar errores
     */
    private function handleError($e) {
        logApiRequest($_SERVER['REQUEST_URI'] ?? '/', $_GET, 500, $e->getMessage());

        if ($_ENV['DEBUG_MODE'] ?? false) {
            ResponseHelper::internalError($e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
        } else {
            ResponseHelper::internalError('Error interno del servidor');
        }
    }
}

/**
 * Crear endpoints que faltan si no existen
 */
function createMissingEndpoints() {
    $basePath = __DIR__ . '/routes';
    $missingFiles = [
        'health.php' => createHealthEndpoint(),
        'info.php' => createInfoEndpoint()
    ];

    foreach ($missingFiles as $filename => $content) {
        $filePath = $basePath . '/' . $filename;
        if (!file_exists($filePath)) {
            file_put_contents($filePath, $content);
        }
    }
}

function createHealthEndpoint() {
    return '<?php
// Health check endpoint
$health = [
    "status" => "healthy",
    "timestamp" => date("c"),
    "version" => "1.0.0",
    "checks" => [
        "photos_directory" => is_dir(PHOTOS_BASE_PATH),
        "photos_readable" => is_readable(PHOTOS_BASE_PATH),
        "disk_space" => disk_free_space(PHOTOS_BASE_PATH) > (100 * 1024 * 1024), // 100MB
        "php_version" => version_compare(PHP_VERSION, "8.0.0", ">=")
    ]
];

$allHealthy = array_reduce($health["checks"], function($carry, $check) {
    return $carry && $check;
}, true);

if (!$allHealthy) {
    $health["status"] = "unhealthy";
    http_response_code(503);
}

ResponseHelper::success($health);
';
}

function createInfoEndpoint() {
    return '<?php
// API Info endpoint
$info = [
    "name" => "Photo Diary API",
    "version" => API_VERSION,
    "timezone" => API_TIMEZONE,
    "endpoints" => [
        "GET /photos/{year}/{month}/{day}" => "Obtener fotos de una fecha específica",
        "GET /search" => "Buscar y filtrar contenido",
        "GET /stats" => "Estadísticas generales",
        "GET /dates" => "Fechas disponibles",
        "GET /export" => "Exportar contenido",
        "GET /random" => "Contenido aleatorio",
        "GET /calendar/{year}/{month}" => "Vista de calendario",
        "GET /feed" => "Feed principal",
        "GET /health" => "Estado de salud de la API"
    ],
    "documentation" => "/api/docs/",
    "support" => "Consulte la documentación para más detalles"
];

ResponseHelper::success($info);
';
}

// Inicialización
try {
    // Crear endpoints faltantes
    createMissingEndpoints();

    // Configurar FileManager
    FileManager::configure([
        'base_path' => PHOTOS_BASE_PATH
    ]);

    // Procesar request
    $router = new APIRouter();
    $router->handleRequest();

} catch (Exception $e) {
    error_log("API Router Error: " . $e->getMessage());

    if ($_ENV['DEBUG_MODE'] ?? false) {
        ResponseHelper::internalError($e->getMessage(), [
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]);
    } else {
        ResponseHelper::internalError('Error interno del servidor');
    }
}
?>
