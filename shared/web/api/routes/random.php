<?php
// web/api/random.php - API para obtener fotos/videos aleatorios
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function getAllMediaFiles($basePath) {
    $files = [];

    if (!is_dir($basePath)) {
        return $files;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($basePath, RecursiveDirectoryIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $filename = $file->getFilename();
            $relativePath = str_replace($basePath . '/', '', $file->getPathname());

            // Verificar formato esperado
            if (preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $filename)) {
                $pathParts = explode('/', $relativePath);
                if (count($pathParts) >= 4) {
                    $year = $pathParts[0];
                    $month = $pathParts[1];
                    $day = $pathParts[2];
                    $date = "$year-$month-$day";

                    // Extraer timestamp
                    $timestamp = '';
                    if (preg_match('/(\d{2})-(\d{2})-(\d{2})/', $filename, $matches)) {
                        $timestamp = $matches[1] . ':' . $matches[2] . ':' . $matches[3];
                    }

                    $isVideo = preg_match('/\.mp4$/i', $filename);

                    $files[] = [
                        'filename' => $filename,
                        'date' => $date,
                        'year' => intval($year),
                        'month' => intval($month),
                        'day' => intval($day),
                        'timestamp' => $timestamp,
                        'type' => $isVideo ? 'video' : 'photo',
                        'path' => "/photos/$relativePath",
                        'full_path' => $file->getPathname(),
                        'size' => $file->getSize(),
                        'modified' => $file->getMTime()
                    ];
                }
            }
        }
    }

    return $files;
}

function filterFilesByType($files, $type) {
    if ($type === 'all') {
        return $files;
    }

    return array_filter($files, function($file) use ($type) {
        return $file['type'] === $type;
    });
}

function filterFilesByDateRange($files, $startDate, $endDate) {
    if (!$startDate || !$endDate) {
        return $files;
    }

    return array_filter($files, function($file) use ($startDate, $endDate) {
        return $file['date'] >= $startDate && $file['date'] <= $endDate;
    });
}

function getRandomFiles($files, $count = 1) {
    if (empty($files)) {
        return [];
    }

    if ($count >= count($files)) {
        return $files;
    }

    $randomKeys = array_rand($files, $count);

    if ($count === 1) {
        return [$files[$randomKeys]];
    }

    $result = [];
    foreach ($randomKeys as $key) {
        $result[] = $files[$key];
    }

    return $result;
}

function formatDateSpanish($dateStr) {
    $date = new DateTime($dateStr);
    $formatter = new IntlDateFormatter(
        'es_ES',
        IntlDateFormatter::FULL,
        IntlDateFormatter::NONE,
        'Europe/Madrid'
    );
    return $formatter->format($date);
}

try {
    $photosBasePath = $_ENV['PHOTOS_PATH'] ?? '/data/fotos';

    // Parámetros
    $count = min(intval($_GET['count'] ?? 1), 50); // Máximo 50 archivos
    $type = $_GET['type'] ?? 'all'; // all, photo, video
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    $excludeRecent = $_GET['exclude_recent'] ?? false; // Excluir últimos N días
    $format = $_GET['format'] ?? 'detailed'; // detailed | simple

    error_log("Obteniendo archivos aleatorios: count=$count, type=$type");

    // Obtener todos los archivos
    $allFiles = getAllMediaFiles($photosBasePath);

    if (empty($allFiles)) {
        http_response_code(404);
        echo json_encode([
            'error' => 'No se encontraron archivos multimedia',
            'random_files' => [],
            'count' => 0
        ]);
        exit();
    }

    // Aplicar filtros
    $filteredFiles = $allFiles;

    // Filtrar por tipo
    $filteredFiles = filterFilesByType($filteredFiles, $type);

    // Filtrar por rango de fechas
    if ($startDate && $endDate) {
        $filteredFiles = filterFilesByDateRange($filteredFiles, $startDate, $endDate);
    }

    // Excluir archivos recientes si se solicita
    if ($excludeRecent) {
        $excludeDays = intval($excludeRecent);
        $cutoffDate = date('Y-m-d', strtotime("-$excludeDays days"));
        $filteredFiles = array_filter($filteredFiles, function($file) use ($cutoffDate) {
            return $file['date'] < $cutoffDate;
        });
    }

    if (empty($filteredFiles)) {
        http_response_code(404);
        echo json_encode([
            'error' => 'No se encontraron archivos que cumplan los criterios',
            'random_files' => [],
            'count' => 0,
            'filters_applied' => [
                'type' => $type,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'exclude_recent' => $excludeRecent
            ]
        ]);
        exit();
    }

    // Obtener archivos aleatorios
    $randomFiles = getRandomFiles(array_values($filteredFiles), $count);

    // Formatear respuesta
    $response = [
        'random_files' => [],
        'count' => count($randomFiles),
        'total_available' => count($filteredFiles),
        'generated_at' => date('c')
    ];

    foreach ($randomFiles as $file) {
        if ($format === 'simple') {
            $response['random_files'][] = [
                'path' => $file['path'],
                'type' => $file['type'],
                'date' => $file['date'],
                'timestamp' => $file['timestamp']
            ];
        } else {
            $fileData = $file;

            // Añadir información adicional
            $fileData['date_formatted'] = formatDateSpanish($file['date']);
            $fileData['size_mb'] = round($file['size'] / (1024 * 1024), 2);
            $fileData['age_days'] = floor((time() - strtotime($file['date'])) / 86400);

            // Calcular hora del día en formato legible
            if ($file['timestamp']) {
                $timeInfo = explode(':', $file['timestamp']);
                $hour = intval($timeInfo[0]);
                $minute = intval($timeInfo[1]);

                if ($hour < 6) {
                    $fileData['time_of_day'] = 'madrugada';
                } elseif ($hour < 12) {
                    $fileData['time_of_day'] = 'mañana';
                } elseif ($hour < 18) {
                    $fileData['time_of_day'] = 'tarde';
                } else {
                    $fileData['time_of_day'] = 'noche';
                }
            }

            // Verificar si el archivo existe
            $fileData['exists'] = file_exists($file['full_path']);

            // Remover ruta completa del sistema por seguridad
            unset($fileData['full_path']);

            $response['random_files'][] = $fileData;
        }
    }

    // Añadir estadísticas si se solicita formato detallado
    if ($format === 'detailed') {
        $response['filters'] = [
            'type' => $type,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'exclude_recent_days' => $excludeRecent
        ];

        $response['statistics'] = [
            'total_files_in_system' => count($allFiles),
            'files_after_filters' => count($filteredFiles),
            'photos_available' => count(array_filter($filteredFiles, fn($f) => $f['type'] === 'photo')),
            'videos_available' => count(array_filter($filteredFiles, fn($f) => $f['type'] === 'video')),
            'date_range' => [
                'earliest' => !empty($filteredFiles) ? min(array_column($filteredFiles, 'date')) : null,
                'latest' => !empty($filteredFiles) ? max(array_column($filteredFiles, 'date')) : null
            ]
        ];
    }

    echo json_encode($response, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Error en random.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Error obteniendo archivos aleatorios',
        'message' => $e->getMessage(),
        'random_files' => [],
        'count' => 0
    ]);
}
?>
