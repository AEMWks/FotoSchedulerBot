<?php
// web/api/stats.php - API para estadísticas y analytics
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Función para obtener todos los archivos recursivamente
function getAllPhotos($basePath) {
    $photos = [];
    $videos = [];
    $allFiles = [];

    if (!is_dir($basePath)) {
        return ['photos' => [], 'videos' => [], 'all' => []];
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($basePath, RecursiveDirectoryIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $filename = $file->getFilename();
            $relativePath = str_replace($basePath . '/', '', $file->getPathname());

            // Verificar formato de archivo esperado (HH-MM-SS.ext)
            if (preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $filename)) {
                $pathParts = explode('/', $relativePath);
                if (count($pathParts) >= 4) {
                    $year = $pathParts[0];
                    $month = $pathParts[1];
                    $day = $pathParts[2];

                    $fileInfo = [
                        'filename' => $filename,
                        'date' => "$year-$month-$day",
                        'year' => $year,
                        'month' => $month,
                        'day' => $day,
                        'path' => $relativePath,
                        'size' => $file->getSize(),
                        'timestamp' => $file->getMTime(),
                        'hour' => intval(substr($filename, 0, 2)),
                        'minute' => intval(substr($filename, 3, 2)),
                        'second' => intval(substr($filename, 6, 2))
                    ];

                    if (preg_match('/\.(jpg|jpeg|png)$/i', $filename)) {
                        $fileInfo['type'] = 'photo';
                        $photos[] = $fileInfo;
                    } elseif (preg_match('/\.mp4$/i', $filename)) {
                        $fileInfo['type'] = 'video';
                        $videos[] = $fileInfo;
                    }

                    $allFiles[] = $fileInfo;
                }
            }
        }
    }

    return [
        'photos' => $photos,
        'videos' => $videos,
        'all' => $allFiles
    ];
}

// Función para calcular estadísticas
function calculateStats($files) {
    $stats = [
        'total_files' => count($files['all']),
        'total_photos' => count($files['photos']),
        'total_videos' => count($files['videos']),
        'total_size' => 0,
        'dates_with_content' => [],
        'activity_by_date' => [],
        'activity_by_hour' => array_fill(0, 24, 0),
        'activity_by_day_of_week' => array_fill(0, 7, 0),
        'monthly_activity' => [],
        'earliest_date' => null,
        'latest_date' => null,
        'avg_photos_per_day' => 0,
        'most_active_hour' => 0,
        'most_active_day' => 0
    ];

    if (empty($files['all'])) {
        return $stats;
    }

    $dateActivity = [];
    $dates = [];

    foreach ($files['all'] as $file) {
        // Tamaño total
        $stats['total_size'] += $file['size'];

        // Actividad por fecha
        $date = $file['date'];
        if (!isset($dateActivity[$date])) {
            $dateActivity[$date] = 0;
            $dates[] = $date;
        }
        $dateActivity[$date]++;

        // Actividad por hora
        $stats['activity_by_hour'][$file['hour']]++;

        // Actividad por día de la semana
        $dayOfWeek = date('w', strtotime($date)); // 0 = domingo, 6 = sábado
        $stats['activity_by_day_of_week'][$dayOfWeek]++;

        // Actividad mensual
        $monthKey = substr($date, 0, 7); // YYYY-MM
        if (!isset($stats['monthly_activity'][$monthKey])) {
            $stats['monthly_activity'][$monthKey] = 0;
        }
        $stats['monthly_activity'][$monthKey]++;
    }

    // Procesar fechas
    sort($dates);
    $stats['earliest_date'] = $dates[0] ?? null;
    $stats['latest_date'] = $dates[count($dates) - 1] ?? null;
    $stats['dates_with_content'] = array_unique($dates);

    // Actividad por fecha para el gráfico
    foreach ($dateActivity as $date => $count) {
        $stats['activity_by_date'][] = [
            'date' => $date,
            'count' => $count
        ];
    }

    // Ordenar por fecha
    usort($stats['activity_by_date'], function($a, $b) {
        return strcmp($a['date'], $b['date']);
    });

    // Calcular promedio de fotos por día
    $totalDays = count($stats['dates_with_content']);
    if ($totalDays > 0) {
        $stats['avg_photos_per_day'] = round($stats['total_files'] / $totalDays, 1);
    }

    // Encontrar hora más activa
    $stats['most_active_hour'] = array_search(max($stats['activity_by_hour']), $stats['activity_by_hour']);

    // Encontrar día más activo
    $stats['most_active_day'] = array_search(max($stats['activity_by_day_of_week']), $stats['activity_by_day_of_week']);

    return $stats;
}

// Función para obtener estadísticas de rango de fechas
function getDateRangeStats($files, $startDate, $endDate) {
    $filteredFiles = ['photos' => [], 'videos' => [], 'all' => []];

    foreach ($files['all'] as $file) {
        $fileDate = $file['date'];
        if ($fileDate >= $startDate && $fileDate <= $endDate) {
            $filteredFiles['all'][] = $file;
            if ($file['type'] === 'photo') {
                $filteredFiles['photos'][] = $file;
            } else {
                $filteredFiles['videos'][] = $file;
            }
        }
    }

    return calculateStats($filteredFiles);
}

try {
    $photosBasePath = $_ENV['PHOTOS_PATH'] ?? '/data/fotos';

    // Obtener parámetros opcionales
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    $type = $_GET['type'] ?? 'all'; // all, photo, video

    error_log("Calculando estadísticas para: $photosBasePath");

    // Obtener todos los archivos
    $allFiles = getAllPhotos($photosBasePath);

    // Filtrar por tipo si se especifica
    if ($type === 'photo') {
        $targetFiles = ['photos' => $allFiles['photos'], 'videos' => [], 'all' => $allFiles['photos']];
    } elseif ($type === 'video') {
        $targetFiles = ['photos' => [], 'videos' => $allFiles['videos'], 'all' => $allFiles['videos']];
    } else {
        $targetFiles = $allFiles;
    }

    // Aplicar filtro de fechas si se proporciona
    if ($startDate && $endDate) {
        $stats = getDateRangeStats($targetFiles, $startDate, $endDate);
        $stats['filtered'] = true;
        $stats['date_range'] = ['start' => $startDate, 'end' => $endDate];
    } else {
        $stats = calculateStats($targetFiles);
        $stats['filtered'] = false;
    }

    // Añadir metadatos adicionales
    $stats['generated_at'] = date('c');
    $stats['total_size_mb'] = round($stats['total_size'] / (1024 * 1024), 2);
    $stats['type_filter'] = $type;

    // Datos específicos para gráficos
    $stats['charts'] = [
        'activity_timeline' => array_slice($stats['activity_by_date'], -30), // Últimos 30 días
        'hourly_distribution' => array_map(function($hour, $count) {
            return ['hour' => $hour, 'count' => $count];
        }, array_keys($stats['activity_by_hour']), $stats['activity_by_hour']),
        'weekly_distribution' => array_map(function($day, $count) {
            $dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            return ['day' => $dayNames[$day], 'count' => $count];
        }, array_keys($stats['activity_by_day_of_week']), $stats['activity_by_day_of_week'])
    ];

    echo json_encode($stats, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Error en stats.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Error calculando estadísticas',
        'message' => $e->getMessage()
    ]);
}
?>
