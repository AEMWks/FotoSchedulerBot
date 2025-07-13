<?php
// web/api/calendar.php - API para vista de calendario
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function getCalendarData($basePath, $year, $month) {
    $calendarData = [];

    // Calcular primer y último día del mes
    $firstDay = new DateTime("$year-$month-01");
    $lastDay = clone $firstDay;
    $lastDay->modify('last day of this month');

    // Obtener datos para cada día del mes
    for ($day = 1; $day <= $lastDay->format('d'); $day++) {
        $dayStr = sprintf('%02d', $day);
        $dateStr = "$year-$month-$dayStr";
        $dirPath = "$basePath/$year/$month/$dayStr";

        $dayData = [
            'date' => $dateStr,
            'day' => intval($day),
            'has_content' => false,
            'file_count' => 0,
            'photos' => 0,
            'videos' => 0,
            'files' => [],
            'first_photo_time' => null,
            'last_photo_time' => null,
            'time_span_hours' => 0
        ];

        if (is_dir($dirPath)) {
            $files = [];
            $timestamps = [];

            $handle = opendir($dirPath);
            if ($handle) {
                while (false !== ($file = readdir($handle))) {
                    if (preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $file)) {
                        $isVideo = preg_match('/\.mp4$/i', $file);

                        // Extraer timestamp
                        if (preg_match('/(\d{2})-(\d{2})-(\d{2})/', $file, $matches)) {
                            $hour = intval($matches[1]);
                            $minute = intval($matches[2]);
                            $second = intval($matches[3]);
                            $timestamp = "$hour:$minute:$second";
                            $totalMinutes = $hour * 60 + $minute;
                            $timestamps[] = $totalMinutes;
                        } else {
                            $timestamp = 'unknown';
                        }

                        $files[] = [
                            'filename' => $file,
                            'type' => $isVideo ? 'video' : 'photo',
                            'timestamp' => $timestamp,
                            'path' => "/photos/$year/$month/$dayStr/$file"
                        ];

                        if ($isVideo) {
                            $dayData['videos']++;
                        } else {
                            $dayData['photos']++;
                        }
                    }
                }
                closedir($handle);

                if (!empty($files)) {
                    $dayData['has_content'] = true;
                    $dayData['file_count'] = count($files);
                    $dayData['files'] = $files;

                    // Calcular span de tiempo
                    if (!empty($timestamps)) {
                        sort($timestamps);
                        $firstMinute = min($timestamps);
                        $lastMinute = max($timestamps);

                        $firstHour = floor($firstMinute / 60);
                        $firstMin = $firstMinute % 60;
                        $lastHour = floor($lastMinute / 60);
                        $lastMin = $lastMinute % 60;

                        $dayData['first_photo_time'] = sprintf('%02d:%02d', $firstHour, $firstMin);
                        $dayData['last_photo_time'] = sprintf('%02d:%02d', $lastHour, $lastMin);
                        $dayData['time_span_hours'] = round(($lastMinute - $firstMinute) / 60, 1);
                    }
                }
            }
        }

        $calendarData[] = $dayData;
    }

    return $calendarData;
}

function getMonthStats($calendarData) {
    $stats = [
        'total_days' => count($calendarData),
        'active_days' => 0,
        'total_files' => 0,
        'total_photos' => 0,
        'total_videos' => 0,
        'most_active_day' => null,
        'least_active_day' => null,
        'average_files_per_active_day' => 0,
        'most_productive_hours' => [],
        'activity_by_day_of_week' => array_fill(0, 7, 0) // 0=domingo, 6=sábado
    ];

    $maxFiles = 0;
    $minFiles = PHP_INT_MAX;
    $hourCounts = array_fill(0, 24, 0);

    foreach ($calendarData as $day) {
        if ($day['has_content']) {
            $stats['active_days']++;
            $stats['total_files'] += $day['file_count'];
            $stats['total_photos'] += $day['photos'];
            $stats['total_videos'] += $day['videos'];

            // Día más/menos activo
            if ($day['file_count'] > $maxFiles) {
                $maxFiles = $day['file_count'];
                $stats['most_active_day'] = [
                    'date' => $day['date'],
                    'count' => $day['file_count']
                ];
            }

            if ($day['file_count'] < $minFiles) {
                $minFiles = $day['file_count'];
                $stats['least_active_day'] = [
                    'date' => $day['date'],
                    'count' => $day['file_count']
                ];
            }

            // Actividad por día de la semana
            $dayOfWeek = date('w', strtotime($day['date']));
            $stats['activity_by_day_of_week'][$dayOfWeek] += $day['file_count'];

            // Contar horas más productivas
            foreach ($day['files'] as $file) {
                if ($file['timestamp'] !== 'unknown') {
                    $hour = intval(explode(':', $file['timestamp'])[0]);
                    $hourCounts[$hour]++;
                }
            }
        }
    }

    // Calcular promedio
    if ($stats['active_days'] > 0) {
        $stats['average_files_per_active_day'] = round($stats['total_files'] / $stats['active_days'], 1);
    }

    // Top 5 horas más productivas
    arsort($hourCounts);
    $topHours = array_slice($hourCounts, 0, 5, true);
    foreach ($topHours as $hour => $count) {
        if ($count > 0) {
            $stats['most_productive_hours'][] = [
                'hour' => sprintf('%02d:00', $hour),
                'count' => $count
            ];
        }
    }

    return $stats;
}

function getAdjacentMonths($year, $month) {
    $current = new DateTime("$year-$month-01");

    $prev = clone $current;
    $prev->modify('-1 month');

    $next = clone $current;
    $next->modify('+1 month');

    return [
        'previous' => [
            'year' => intval($prev->format('Y')),
            'month' => intval($prev->format('m')),
            'label' => $prev->format('F Y')
        ],
        'current' => [
            'year' => intval($year),
            'month' => intval($month),
            'label' => $current->format('F Y')
        ],
        'next' => [
            'year' => intval($next->format('Y')),
            'month' => intval($next->format('m')),
            'label' => $next->format('F Y')
        ]
    ];
}

try {
    $photosBasePath = $_ENV['PHOTOS_PATH'] ?? '/data/fotos';

    // Parámetros
    $year = $_GET['year'] ?? date('Y');
    $month = $_GET['month'] ?? date('m');

    // Validar parámetros
    if (!preg_match('/^\d{4}$/', $year) || !preg_match('/^\d{1,2}$/', $month)) {
        throw new Exception('Formato de año/mes inválido');
    }

    $year = sprintf('%04d', intval($year));
    $month = sprintf('%02d', intval($month));

    error_log("Generando calendario para: $year-$month");

    // Validar que el mes sea válido
    if (intval($month) < 1 || intval($month) > 12) {
        throw new Exception('Mes inválido');
    }

    // Obtener datos del calendario
    $calendarData = getCalendarData($photosBasePath, $year, $month);
    $monthStats = getMonthStats($calendarData);
    $navigation = getAdjacentMonths($year, $month);

    // Información adicional del mes
    $monthInfo = [
        'year' => intval($year),
        'month' => intval($month),
        'month_name' => date('F', mktime(0, 0, 0, intval($month), 1, intval($year))),
        'month_name_spanish' => [
            1 => 'Enero', 2 => 'Febrero', 3 => 'Marzo', 4 => 'Abril',
            5 => 'Mayo', 6 => 'Junio', 7 => 'Julio', 8 => 'Agosto',
            9 => 'Septiembre', 10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre'
        ][intval($month)],
        'days_in_month' => intval(date('t', mktime(0, 0, 0, intval($month), 1, intval($year)))),
        'first_day_of_week' => intval(date('w', mktime(0, 0, 0, intval($month), 1, intval($year))))
    ];

    $response = [
        'month_info' => $monthInfo,
        'navigation' => $navigation,
        'calendar_data' => $calendarData,
        'statistics' => $monthStats,
        'generated_at' => date('c')
    ];

    echo json_encode($response, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Error en calendar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Error generando datos del calendario',
        'message' => $e->getMessage()
    ]);
}
?>
