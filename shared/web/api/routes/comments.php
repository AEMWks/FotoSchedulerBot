<?php
// shared/web/api/routes/comments.php - API endpoints para comentarios

// Configuración de headers y CORS
handlePreflight();
setJsonHeaders();

// Incluir dependencias
require_once __DIR__ . '/../utils/CommentsManager.php';

try {
    // Inicializar CommentsManager
    $commentsManager = new CommentsManager([
        'base_path' => PHOTOS_BASE_PATH,
        'timezone' => API_TIMEZONE
    ]);

    // Obtener método HTTP y ruta
    $method = $_SERVER['REQUEST_METHOD'];
    $requestUri = $_SERVER['REQUEST_URI'] ?? '';

    // Extraer path después de /api/comments
    $pathInfo = parse_url($requestUri, PHP_URL_PATH);
    $pathParts = explode('/', trim($pathInfo, '/'));

    // Remover 'api' y 'comments' del path
    $apiIndex = array_search('api', $pathParts);
    $commentsIndex = array_search('comments', $pathParts);

    if ($apiIndex !== false && $commentsIndex !== false) {
        $routeParts = array_slice($pathParts, $commentsIndex + 1);
    } else {
        $routeParts = [];
    }

    // Log de la request
    logApiRequest("comments/" . implode('/', $routeParts), $_REQUEST, 200);

    // Routing principal
    switch ($method) {
        case 'GET':
            handleGetRequest($commentsManager, $routeParts);
            break;

        case 'POST':
            handlePostRequest($commentsManager, $routeParts);
            break;

        case 'DELETE':
            handleDeleteRequest($commentsManager, $routeParts);
            break;

        default:
            sendErrorResponse('Método HTTP no soportado', 405);
    }

} catch (Exception $e) {
    error_log("Error en API de comentarios: " . $e->getMessage());
    sendErrorResponse('Error interno del servidor', 500, [
        'error_type' => get_class($e),
        'debug' => ($_ENV['DEBUG_MODE'] ?? false) ? $e->getMessage() : null
    ]);
}

/**
 * Manejar requests GET
 */
function handleGetRequest($commentsManager, $routeParts) {
    if (empty($routeParts)) {
        // GET /api/comments - Listar endpoints disponibles
        sendSuccessResponse([
            'message' => 'API de Comentarios del Diario Visual',
            'version' => API_VERSION,
            'endpoints' => [
                'GET /api/comments/{date}' => 'Obtener comentario de una fecha',
                'POST /api/comments/{date}' => 'Crear/actualizar comentario',
                'DELETE /api/comments/{date}' => 'Eliminar comentario',
                'GET /api/comments/range/{start_date}/{end_date}' => 'Comentarios en rango',
                'GET /api/comments/stats' => 'Estadísticas de comentarios'
            ]
        ]);
        return;
    }

    $action = $routeParts[0];

    switch ($action) {
        case 'stats':
            // GET /api/comments/stats
            $stats = $commentsManager->getCommentsStats();
            sendSuccessResponse($stats, ['endpoint' => 'stats']);
            break;

        case 'range':
            // GET /api/comments/range/{start_date}/{end_date}
            if (count($routeParts) < 3) {
                sendErrorResponse('Se requieren fechas de inicio y fin', 400);
                return;
            }

            $startDate = validateDateParam($routeParts[1], 'start_date');
            $endDate = validateDateParam($routeParts[2], 'end_date');

            $comments = $commentsManager->getCommentsInRange($startDate, $endDate);

            sendSuccessResponse($comments, [
                'endpoint' => 'range',
                'date_range' => ['start' => $startDate, 'end' => $endDate],
                'count' => count($comments)
            ]);
            break;

        case 'health':
            // GET /api/comments/health
            $health = $commentsManager->healthCheck();
            $statusCode = $health['status'] === 'healthy' ? 200 : 503;

            http_response_code($statusCode);
            sendSuccessResponse($health, ['endpoint' => 'health']);
            break;

        default:
            // GET /api/comments/{date}
            $date = validateDateParam($action, 'date');

            $comment = $commentsManager->getComment($date);

            if ($comment === null) {
                sendErrorResponse('Comentario no encontrado', 404, ['date' => $date]);
                return;
            }

            sendSuccessResponse($comment, [
                'endpoint' => 'get_comment',
                'date' => $date
            ]);
            break;
    }
}

/**
 * Manejar requests POST
 */
function handlePostRequest($commentsManager, $routeParts) {
    if (empty($routeParts)) {
        sendErrorResponse('Fecha requerida en la URL', 400);
        return;
    }

    $date = validateDateParam($routeParts[0], 'date');

    // Obtener datos del cuerpo de la request
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        sendErrorResponse('JSON inválido', 400, ['json_error' => json_last_error_msg()]);
        return;
    }

    // Validar que se proporcione el comentario
    if (!isset($data['comment'])) {
        sendErrorResponse('Campo "comment" requerido', 400);
        return;
    }

    $comment = $data['comment'];

    // Validar que el comentario no esté vacío
    if (empty(trim($comment))) {
        sendErrorResponse('El comentario no puede estar vacío', 400);
        return;
    }

    try {
        $savedComment = $commentsManager->saveComment($date, $comment);

        // Determinar si fue creación o actualización
        $wasUpdate = isset($savedComment['created_at']) &&
                     $savedComment['created_at'] !== $savedComment['updated_at'];

        $statusCode = $wasUpdate ? 200 : 201;
        $action = $wasUpdate ? 'updated' : 'created';

        sendSuccessResponse($savedComment, [
            'endpoint' => 'save_comment',
            'action' => $action,
            'date' => $date
        ], $statusCode);

    } catch (InvalidArgumentException $e) {
        sendErrorResponse($e->getMessage(), 400, ['date' => $date]);
    } catch (Exception $e) {
        error_log("Error guardando comentario para $date: " . $e->getMessage());
        sendErrorResponse('Error guardando comentario', 500, ['date' => $date]);
    }
}

/**
 * Manejar requests DELETE
 */
function handleDeleteRequest($commentsManager, $routeParts) {
    if (empty($routeParts)) {
        sendErrorResponse('Fecha requerida en la URL', 400);
        return;
    }

    $date = validateDateParam($routeParts[0], 'date');

    try {
        $deleted = $commentsManager->deleteComment($date);

        if (!$deleted) {
            sendErrorResponse('Comentario no encontrado', 404, ['date' => $date]);
            return;
        }

        sendSuccessResponse([
            'message' => 'Comentario eliminado exitosamente',
            'date' => $date
        ], [
            'endpoint' => 'delete_comment',
            'action' => 'deleted',
            'date' => $date
        ]);

    } catch (InvalidArgumentException $e) {
        sendErrorResponse($e->getMessage(), 400, ['date' => $date]);
    } catch (Exception $e) {
        error_log("Error eliminando comentario para $date: " . $e->getMessage());
        sendErrorResponse('Error eliminando comentario', 500, ['date' => $date]);
    }
}

/**
 * Ejemplos de uso para desarrolladores
 */
function getApiExamples() {
    return [
        'get_comment' => [
            'url' => 'GET /api/comments/2024-01-15',
            'response' => [
                'success' => true,
                'data' => [
                    'date' => '2024-01-15',
                    'comment' => 'Día increíble en la playa',
                    'created_at' => '2024-01-15T20:30:00+01:00',
                    'updated_at' => '2024-01-15T20:30:00+01:00'
                ]
            ]
        ],
        'save_comment' => [
            'url' => 'POST /api/comments/2024-01-15',
            'body' => ['comment' => 'Día increíble en la playa'],
            'response' => [
                'success' => true,
                'data' => [
                    'date' => '2024-01-15',
                    'comment' => 'Día increíble en la playa',
                    'created_at' => '2024-01-15T20:30:00+01:00',
                    'updated_at' => '2024-01-15T20:30:00+01:00'
                ]
            ]
        ],
        'delete_comment' => [
            'url' => 'DELETE /api/comments/2024-01-15',
            'response' => [
                'success' => true,
                'data' => [
                    'message' => 'Comentario eliminado exitosamente',
                    'date' => '2024-01-15'
                ]
            ]
        ],
        'get_range' => [
            'url' => 'GET /api/comments/range/2024-01-01/2024-01-31',
            'response' => [
                'success' => true,
                'data' => [
                    '2024-01-15' => ['date' => '2024-01-15', 'comment' => '...'],
                    '2024-01-20' => ['date' => '2024-01-20', 'comment' => '...']
                ]
            ]
        ],
        'get_stats' => [
            'url' => 'GET /api/comments/stats',
            'response' => [
                'success' => true,
                'data' => [
                    'total_comments' => 25,
                    'total_characters' => 1847,
                    'avg_length' => 73.9,
                    'first_comment_date' => '2024-01-01',
                    'last_comment_date' => '2024-01-30'
                ]
            ]
        ]
    ];
}

// Función helper para mostrar ejemplos si se accede directamente
if ($_SERVER['REQUEST_METHOD'] === 'GET' &&
    !isset($_GET['date']) &&
    strpos($_SERVER['REQUEST_URI'], 'examples') !== false) {

    sendSuccessResponse([
        'message' => 'Ejemplos de uso de la API de Comentarios',
        'examples' => getApiExamples()
    ]);
}
?>
