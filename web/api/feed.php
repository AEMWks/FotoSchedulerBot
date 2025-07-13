<?php
// web/api/feed.php - API para feed principal con paginación
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function getFeedData($basePath, $limit = 10, $offset = 0, $sortOrder = 'desc') {
    $feedEntries = [];

    if (!is_dir($basePath)) {
        return ['entries' => [], 'total' => 0];
    }

    // Obtener todas las fechas disponibles
    $dates = [];
    $years = glob($basePath . '/[0-9][0-9][0-9][0-9]', GLOB_ONLYDIR);

    foreach ($years as $yearPath) {
        $year = basename($yearPath);
        $months = glob($yearPath . '/[0-9][0-9]', GLOB_ONLYDIR);

        foreach ($months as $monthPath) {
            $month = basename($monthPath);
            $days = glob($monthPath . '/[0-9][0-9]', GLOB_ONLYDIR);

            foreach ($days as $dayPath) {
                $day = basename($dayPath);

                // Verificar si hay archivos en este día
                $files = glob($dayPath . '/*.{jpg,jpeg,png,mp4}', GLOB_BRACE);
                $validFiles = array_filter($files, function($file) {
                    $filename = basename($file);
                    return preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $filename);
                });

                if (!empty($validFiles)) {
                    $dates[] = "$year-$month-$day";
                }
            }
        }
    }

    // Ordenar fechas
    if ($sortOrder === 'desc') {
        rsort($dates);
    } else {
        sort($dates);
    }

    $totalDates = count($dates);

    // Aplicar paginación a nivel de fechas
    $datesToProcess = array_slice($dates, $offset, $limit);

    // Obtener datos para cada fecha
    foreach ($datesToProcess as $date) {
        $entryData = getFeedEntryForDate($basePath, $date);
        if ($entryData) {
            $feedEntries[] = $entryData;
        }
    }

    return [
        'entries' => $feedEntries,
        'total' => $totalDates,
        'offset' => $offset,
        'limit' => $limit,
        'has_more' => ($offset + $limit) < $totalDates
    ];
}

function getFeedEntryForDate($basePath, $date) {
    list($year, $month, $day) = explode('-', $date);
    $dirPath = "$basePath/$year/$month/$day";

    if (!is_dir($dirPath)) {
        return null;
    }

    $files = [];
    $handle = opendir($dirPath);

    if (!$handle) {
        return null;
    }

    while (false !== ($file = readdir($handle))) {
        if (preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $file)) {
            $fullPath = "$dirPath/$file";
            $isVideo = preg_match('/\.mp4$/i', $file);

            // Extraer timestamp
            $timestamp = '';
            if (preg_match('/(\d{2})-(\d{2})-(\d{2})/', $file, $matches)) {
                $timestamp = $matches[1] . ':' . $matches[2] . ':' . $matches[3];
            }

            $files[] = [
                'filename' => $file,
                'type' => $isVideo ? 'video' : 'photo',
                'timestamp' => $timestamp,
                'path' => "/photos/$year/$month/$day/$file",
                'size' => file_exists($fullPath) ? filesize($fullPath) : 0,
                'size_mb' => file_exists($fullPath) ? round(filesize($fullPath) / (1024 * 1024), 2) : 0
            ];
        }
    }
    closedir($handle);

    if (empty($files)) {
        return null;
    }

    // Ordenar archivos por timestamp
    usort($files, function($a, $b) {
        return strcmp($a['timestamp'], $b['timestamp']);
    });

    // Calcular estadísticas del día
    $photos = array_filter($files, fn($f) => $f['type'] === 'photo');
    $videos = array_filter($files, fn($f) => $f['type'] === 'video');

    $totalSize = array_sum(array_column($files, 'size'));
    $timestamps = array_column($files, 'timestamp');
    $firstTime = min($timestamps);
    $lastTime = max($timestamps);

    // Calcular span de tiempo
    $timeSpan = null;
    if ($firstTime && $lastTime && $firstTime !== $lastTime) {
        $firstMinutes = timeToMinutes($firstTime);
        $lastMinutes = timeToMinutes($lastTime);
        $spanMinutes = $lastMinutes - $firstMinutes;
        $timeSpan = [
            'hours' => floor($spanMinutes / 60),
            'minutes' => $spanMinutes % 60,
            'total_minutes' => $spanMinutes
        ];
    }

    return [
        'date' => $date,
        'date_formatted' => formatDateSpanish($date),
        'day_of_week' => date('l', strtotime($date)),
        'day_of_week_spanish' => getDayOfWeekSpanish($date),
        'files' => $files,
        'summary' => [
            'total_files' => count($files),
            'photos' => count($photos),
            'videos' => count($videos),
            'total_size' => $totalSize,
            'total_size_mb' => round($totalSize / (1024 * 1024), 2),
            'first_capture' => $firstTime,
            'last_capture' => $lastTime,
            'time_span' => $timeSpan
        ]
    ];
}

function timeToMinutes($timeStr) {
    $parts = explode(':', $timeStr);
    return intval($parts[0]) * 60 + intval($parts[1]);
}

function formatDateSpanish($dateStr) {
    $date = new DateTime($dateStr);
    $formatter = new IntlDateFormatter(
        'es_ES',
        IntlDateFormatter::FULL,
        IntlDateFormatter::NONE,
        'Europe/Madrid'
    );
    return $formatter ? $formatter->format($date) : $date->format('l, j \d\e F \d\e Y');
}

function getDayOfWeekSpanish($dateStr) {
    $dayNames = [
        'Monday' => 'Lunes',
        'Tuesday' => 'Martes',
        'Wednesday' => 'Miércoles',
        'Thursday' => 'Jueves',
        'Friday' => 'Viernes',
        'Saturday' => 'Sábado',
        'Sunday' => 'Domingo'
    ];

    $englishDay = date('l', strtotime($dateStr));
    return $dayNames[$englishDay] ?? $englishDay;
}

function getRecentActivity($basePath, $days = 7) {
    $activity = [];
    $today = new DateTime();

    for ($i = 0; $i < $days; $i++) {
        $date = clone $today;
        $date->sub(new DateInterval("P{$i}D"));
        $dateStr = $date->format('Y-m-d');

        $entry = getFeedEntryForDate($basePath, $dateStr);
        $activity[] = [
            'date' => $dateStr,
            'count' => $entry ? $entry['summary']['total_files'] : 0,
            'has_content' => $entry !== null
        ];
    }

    return array_reverse($activity);
}

try {
    $photosBasePath = $_ENV['PHOTOS_PATH'] ?? '/data/fotos';

    // Parámetros de paginación
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = min(50, max(1, intval($_GET['limit'] ?? 10))); // Entre 1 y 50
    $offset = ($page - 1) * $limit;
    $sortOrder = $_GET['sort'] ?? 'desc'; // desc | asc

    // Parámetros adicionales
    $includeActivity = isset($_GET['include_activity']); // Incluir actividad reciente
    $activityDays = min(30, max(1, intval($_GET['activity_days'] ?? 7))); // Entre 1 y 30 días

    error_log("Generando feed: page=$page, limit=$limit, sort=$sortOrder");

    // Obtener datos del feed
    $feedData = getFeedData($photosBasePath, $limit, $offset, $sortOrder);

    // Calcular información de paginación
    $totalPages = ceil($feedData['total'] / $limit);

    $response = [
        'feed' => $feedData['entries'],
        'pagination' => [
            'current_page' => $page,
            'total_pages' => $totalPages,
            'total_entries' => $feedData['total'],
            'entries_per_page' => $limit,
            'has_next' => $page < $totalPages,
            'has_previous' => $page > 1,
            'next_page' => $page < $totalPages ? $page + 1 : null,
            'previous_page' => $page > 1 ? $page - 1 : null
        ],
        'meta' => [
            'sort_order' => $sortOrder,
            'generated_at' => date('c'),
            'timezone' => 'Europe/Madrid'
        ]
    ];

    // Incluir actividad reciente si se solicita
    if ($includeActivity) {
        $response['recent_activity'] = getRecentActivity($photosBasePath, $activityDays);
    }

    // Añadir enlaces de navegación
    $baseUrl = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
    $baseUrl = strtok($baseUrl, '?'); // Remover query string

    $response['links'] = [
        'self' => $baseUrl . "?page=$page&limit=$limit&sort=$sortOrder",
        'first' => $baseUrl . "?page=1&limit=$limit&sort=$sortOrder",
        'last' => $baseUrl . "?page=$totalPages&limit=$limit&sort=$sortOrder"
    ];

    if ($response['pagination']['has_next']) {
        $nextPage = $page + 1;
        $response['links']['next'] = $baseUrl . "?page=$nextPage&limit=$limit&sort=$sortOrder";
    }

    if ($response['pagination']['has_previous']) {
        $prevPage = $page - 1;
        $response['links']['prev'] = $baseUrl . "?page=$prevPage&limit=$limit&sort=$sortOrder";
    }

    echo json_encode($response, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Error en feed.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Error generando feed',
        'message' => $e->getMessage(),
        'feed' => [],
        'pagination' => [
            'current_page' => 1,
            'total_pages' => 0,
            'total_entries' => 0
        ]
    ]);
}
?>
