<?php
// web/api/dates.php - API para obtener fechas disponibles
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function getAvailableDates($basePath) {
    $dates = [];

    if (!is_dir($basePath)) {
        return $dates;
    }

    // Buscar directorios año/mes/día con archivos
    $years = glob($basePath . '/[0-9][0-9][0-9][0-9]', GLOB_ONLYDIR);
    sort($years);

    foreach ($years as $yearPath) {
        $year = basename($yearPath);
        $months = glob($yearPath . '/[0-9][0-9]', GLOB_ONLYDIR);
        sort($months);

        foreach ($months as $monthPath) {
            $month = basename($monthPath);
            $days = glob($monthPath . '/[0-9][0-9]', GLOB_ONLYDIR);
            sort($days);

            foreach ($days as $dayPath) {
                $day = basename($dayPath);

                // Verificar si hay archivos válidos en este día
                $files = glob($dayPath . '/*.{jpg,jpeg,png,mp4}', GLOB_BRACE);
                $validFiles = array_filter($files, function($file) {
                    $filename = basename($file);
                    return preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $filename);
                });

                if (!empty($validFiles)) {
                    $dateStr = "$year-$month-$day";
                    $dates[] = [
                        'date' => $dateStr,
                        'year' => intval($year),
                        'month' => intval($month),
                        'day' => intval($day),
                        'file_count' => count($validFiles),
                        'photos' => count(array_filter($validFiles, fn($f) => !preg_match('/\.mp4$/i', basename($f)))),
                        'videos' => count(array_filter($validFiles, fn($f) => preg_match('/\.mp4$/i', basename($f))))
                    ];
                }
            }
        }
    }

    return $dates;
}

try {
    $photosBasePath = $_ENV['PHOTOS_PATH'] ?? '/data/fotos';

    // Parámetros opcionales
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    $limit = intval($_GET['limit'] ?? 100);
    $format = $_GET['format'] ?? 'detailed'; // detailed | simple

    error_log("Obteniendo fechas disponibles desde: $photosBasePath");

    $dates = getAvailableDates($photosBasePath);

    // Filtrar por rango de fechas si se proporciona
    if ($startDate && $endDate) {
        $dates = array_filter($dates, function($dateInfo) use ($startDate, $endDate) {
            return $dateInfo['date'] >= $startDate && $dateInfo['date'] <= $endDate;
        });
    }

    // Ordenar por fecha (más reciente primero)
    usort($dates, function($a, $b) {
        return strcmp($b['date'], $a['date']);
    });

    // Aplicar límite
    $dates = array_slice($dates, 0, $limit);

    // Formato de respuesta
    if ($format === 'simple') {
        $response = [
            'dates' => array_column($dates, 'date'),
            'count' => count($dates)
        ];
    } else {
        $response = [
            'dates' => $dates,
            'count' => count($dates),
            'summary' => [
                'total_files' => array_sum(array_column($dates, 'file_count')),
                'total_photos' => array_sum(array_column($dates, 'photos')),
                'total_videos' => array_sum(array_column($dates, 'videos')),
                'date_range' => [
                    'earliest' => !empty($dates) ? end($dates)['date'] : null,
                    'latest' => !empty($dates) ? $dates[0]['date'] : null
                ]
            ],
            'filters' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'limit' => $limit
            ]
        ];
    }

    $response['generated_at'] = date('c');

    echo json_encode($response, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Error en dates.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Error obteniendo fechas disponibles',
        'message' => $e->getMessage()
    ]);
}
?>
