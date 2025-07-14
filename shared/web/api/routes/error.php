<?php
// web/api/error.php - Manejo centralizado de errores para APIs
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Obtener información del error
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

// Determinar el tipo de error
$errorType = 'not_found';
$httpCode = 404;
$message = 'Endpoint no encontrado';

// Análisis de la URI para proporcionar errores más específicos
if (strpos($requestUri, '/api/') !== false) {
    $pathParts = explode('/', trim($requestUri, '/'));

    if (count($pathParts) >= 2 && $pathParts[0] === 'api') {
        $endpoint = $pathParts[1];

        switch ($endpoint) {
            case 'photos':
                if (count($pathParts) < 5) {
                    $message = 'Formato de fecha incorrecto. Use: /api/photos/YYYY/MM/DD';
                } else {
                    $message = 'Fecha no válida o sin contenido';
                }
                break;

            case 'search':
                $message = 'Endpoint de búsqueda no encontrado. Use: /api/search con parámetros query';
                break;

            case 'stats':
                $message = 'Endpoint de estadísticas no encontrado';
                break;

            case 'export':
                $message = 'Endpoint de exportación no encontrado. Tipos válidos: day, week, month, all';
                break;

            case 'calendar':
                $message = 'Endpoint de calendario no encontrado. Use: /api/calendar/YYYY/MM';
                break;

            case 'feed':
                $message = 'Endpoint de feed no encontrado';
                break;

            case 'random':
                $message = 'Endpoint de contenido aleatorio no encontrado';
                break;

            case 'dates':
                $message = 'Endpoint de fechas disponibles no encontrado';
                break;

            default:
                $message = "API endpoint '$endpoint' no reconocido";
        }
    }
} else {
    // No es una ruta de API
    $errorType = 'page_not_found';
    $message = 'Página no encontrada';
}

// Log del error
error_log("API Error 404: $method $requestUri - User-Agent: $userAgent");

// Respuesta de error
$errorResponse = [
    'error' => true,
    'error_type' => $errorType,
    'http_code' => $httpCode,
    'message' => $message,
    'requested_path' => $requestUri,
    'method' => $method,
    'timestamp' => date('c'),
    'suggestions' => []
];

// Proporcionar sugerencias basadas en el endpoint
if (strpos($requestUri, '/api/') !== false) {
    $errorResponse['suggestions'] = [
        'available_endpoints' => [
            '/api/photos/{year}/{month}/{day}' => 'Obtener fotos de una fecha específica',
            '/api/search' => 'Buscar y filtrar contenido',
            '/api/stats' => 'Estadísticas generales',
            '/api/dates' => 'Fechas disponibles',
            '/api/export' => 'Exportar contenido',
            '/api/random' => 'Contenido aleatorio',
            '/api/calendar/{year}/{month}' => 'Vista de calendario',
            '/api/feed' => 'Feed principal paginado'
        ],
        'documentation' => 'Consulte la documentación de la API para más detalles'
    ];

    // Sugerencias específicas por endpoint
    $pathParts = explode('/', trim($requestUri, '/'));
    if (count($pathParts) >= 2 && $pathParts[0] === 'api') {
        $endpoint = $pathParts[1];

        switch ($endpoint) {
            case 'photos':
                $errorResponse['suggestions']['examples'] = [
                    '/api/photos/2024/01/15' => 'Fotos del 15 de enero de 2024',
                    '/api/photos/2024/12/25' => 'Fotos del 25 de diciembre de 2024'
                ];
                break;

            case 'search':
                $errorResponse['suggestions']['parameters'] = [
                    'query' => 'Término de búsqueda',
                    'type' => 'photo, video, o all',
                    'date' => 'Fecha específica (YYYY-MM-DD)',
                    'start_date & end_date' => 'Rango de fechas'
                ];
                break;

            case 'export':
                $errorResponse['suggestions']['types'] = [
                    'day' => 'Exportar día específico (?type=day&date=YYYY-MM-DD)',
                    'week' => 'Exportar semana (?type=week&date=YYYY-MM-DD)',
                    'month' => 'Exportar mes (?type=month&month=YYYY-MM)',
                    'all' => 'Exportar todo (?type=all)'
                ];
                break;

            case 'calendar':
                $errorResponse['suggestions']['examples'] = [
                    '/api/calendar/2024/01' => 'Calendario de enero 2024',
                    '/api/calendar/2024/12' => 'Calendario de diciembre 2024'
                ];
                break;

            case 'random':
                $errorResponse['suggestions']['parameters'] = [
                    'count' => 'Número de elementos aleatorios (1-50)',
                    'type' => 'photo, video, o all',
                    'exclude_recent' => 'Excluir últimos N días'
                ];
                break;
        }
    }
}

// Código de estado HTTP
http_response_code($httpCode);

// Enviar respuesta JSON
echo json_encode($errorResponse, JSON_PRETTY_PRINT);
?>
