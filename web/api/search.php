<?php
// web/api/search.php - API para búsqueda y filtrado
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Función para buscar archivos recursivamente
function searchFiles($basePath, $criteria) {
    $results = [];

    if (!is_dir($basePath)) {
        return $results;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($basePath, RecursiveDirectoryIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $filename = $file->getFilename();
            $relativePath = str_replace($basePath . '/', '', $file->getPathname());

            if (preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $filename)) {
                $pathParts = explode('/', $relativePath);
                if (count($pathParts) >= 4) {
                    $year = $pathParts[0];
                    $month = $pathParts[1];
                    $day = $pathParts[2];
                    $date = "$year-$month-$day";

                    $fileInfo = [
                        'filename' => $filename,
                        'date' => $date,
                        'year' => intval($year),
                        'month' => intval($month),
                        'day' => intval($day),
                        'path' => "/photos/$relativePath",
                        'size' => $file->getSize(),
                        'timestamp' => $file->getMTime(),
                        'hour' => intval(substr($filename, 0, 2)),
                        'minute' => intval(substr($filename, 3, 2)),
                        'second' => intval(substr($filename, 6, 2)),
                        'type' => preg_match('/\.mp4$/i', $filename) ? 'video' : 'photo',
                        'extension' => strtolower(pathinfo($filename, PATHINFO_EXTENSION))
                    ];

                    // Aplicar criterios de búsqueda
                    if (matchesCriteria($fileInfo, $criteria)) {
                        $results[] = $fileInfo;
                    }
                }
            }
        }
    }

    return $results;
}

// Función para verificar si un archivo coincide con los criterios
function matchesCriteria($fileInfo, $criteria) {
    // Filtro por tipo
    if (isset($criteria['type']) && $criteria['type'] !== 'all') {
        if ($criteria['type'] !== $fileInfo['type']) {
            return false;
        }
    }

    // Filtro por fecha específica
    if (isset($criteria['date'])) {
        if ($criteria['date'] !== $fileInfo['date']) {
            return false;
        }
    }

    // Filtro por rango de fechas
    if (isset($criteria['start_date']) && isset($criteria['end_date'])) {
        if ($fileInfo['date'] < $criteria['start_date'] || $fileInfo['date'] > $criteria['end_date']) {
            return false;
        }
    }

    // Filtro por año
    if (isset($criteria['year'])) {
        if ($criteria['year'] !== $fileInfo['year']) {
            return false;
        }
    }

    // Filtro por mes
    if (isset($criteria['month'])) {
        if ($criteria['month'] !== $fileInfo['month']) {
            return false;
        }
    }

    // Filtro por día
    if (isset($criteria['day'])) {
        if ($criteria['day'] !== $fileInfo['day']) {
            return false;
        }
    }

    // Filtro por hora
    if (isset($criteria['hour'])) {
        if ($criteria['hour'] !== $fileInfo['hour']) {
            return false;
        }
    }

    // Búsqueda por texto (en fecha o nombre de archivo)
    if (isset($criteria['query']) && !empty($criteria['query'])) {
        $query = strtolower($criteria['query']);
        $searchableText = strtolower($fileInfo['date'] . ' ' . $fileInfo['filename']);

        if (strpos($searchableText, $query) === false) {
            return false;
        }
    }

    // Filtro por tamaño mínimo
    if (isset($criteria['min_size'])) {
        if ($fileInfo['size'] < $criteria['min_size']) {
            return false;
        }
    }

    // Filtro por tamaño máximo
    if (isset($criteria['max_size'])) {
        if ($fileInfo['size'] > $criteria['max_size']) {
            return false;
        }
    }

    return true;
}

// Función para ordenar resultados
function sortResults($results, $sortBy, $sortOrder = 'desc') {
    usort($results, function($a, $b) use ($sortBy, $sortOrder) {
        $result = 0;

        switch ($sortBy) {
            case 'date':
                $result = strcmp($a['date'], $b['date']);
                break;
            case 'size':
                $result = $a['size'] <=> $b['size'];
                break;
            case 'filename':
                $result = strcmp($a['filename'], $b['filename']);
                break;
            case 'time':
                $timeA = $a['hour'] * 3600 + $a['minute'] * 60 + $a['second'];
                $timeB = $b['hour'] * 3600 + $b['minute'] * 60 + $b['second'];
                $result = $timeA <=> $timeB;
                break;
            default:
                $result = strcmp($a['date'], $b['date']);
        }

        return $sortOrder === 'desc' ? -$result : $result;
    });

    return $results;
}

// Función para aplicar paginación
function paginateResults($results, $page = 1, $limit = 50) {
    $total = count($results);
    $totalPages = ceil($total / $limit);
    $offset = ($page - 1) * $limit;

    $paginatedResults = array_slice($results, $offset, $limit);

    return [
        'data' => $paginatedResults,
        'pagination' => [
            'current_page' => $page,
            'total_pages' => $totalPages,
            'total_items' => $total,
            'items_per_page' => $limit,
            'has_next' => $page < $totalPages,
            'has_prev' => $page > 1
        ]
    ];
}

// Función para obtener fechas disponibles
function getAvailableDates($basePath) {
    $dates = [];

    if (!is_dir($basePath)) {
        return $dates;
    }

    // Buscar directorios año/mes/día
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
                if (!empty($files)) {
                    $dates[] = "$year-$month-$day";
                }
            }
        }
    }

    return $dates;
}

try {
    $photosBasePath = $_ENV['PHOTOS_PATH'] ?? '/data/fotos';

    // Obtener parámetros de búsqueda
    $criteria = [];

    // Parámetros básicos
    if (isset($_GET['query'])) $criteria['query'] = $_GET['query'];
    if (isset($_GET['type'])) $criteria['type'] = $_GET['type'];
    if (isset($_GET['date'])) $criteria['date'] = $_GET['date'];
    if (isset($_GET['start_date'])) $criteria['start_date'] = $_GET['start_date'];
    if (isset($_GET['end_date'])) $criteria['end_date'] = $_GET['end_date'];
    if (isset($_GET['year'])) $criteria['year'] = intval($_GET['year']);
    if (isset($_GET['month'])) $criteria['month'] = intval($_GET['month']);
    if (isset($_GET['day'])) $criteria['day'] = intval($_GET['day']);
    if (isset($_GET['hour'])) $criteria['hour'] = intval($_GET['hour']);

    // Parámetros de tamaño
    if (isset($_GET['min_size'])) $criteria['min_size'] = intval($_GET['min_size']);
    if (isset($_GET['max_size'])) $criteria['max_size'] = intval($_GET['max_size']);

    // Parámetros de ordenación y paginación
    $sortBy = $_GET['sort_by'] ?? 'date';
    $sortOrder = $_GET['sort_order'] ?? 'desc';
    $page = intval($_GET['page'] ?? 1);
    $limit = intval($_GET['limit'] ?? 50);

    // Modo especial: solo obtener fechas disponibles
    if (isset($_GET['dates_only'])) {
        $availableDates = getAvailableDates($photosBasePath);
        echo json_encode([
            'dates' => $availableDates,
            'count' => count($availableDates)
        ]);
        exit();
    }

    error_log("Realizando búsqueda con criterios: " . json_encode($criteria));

    // Realizar búsqueda
    $results = searchFiles($photosBasePath, $criteria);

    // Ordenar resultados
    $results = sortResults($results, $sortBy, $sortOrder);

    // Aplicar paginación
    $paginatedData = paginateResults($results, $page, $limit);

    // Agregar metadatos de búsqueda
    $response = [
        'results' => $paginatedData['data'],
        'pagination' => $paginatedData['pagination'],
        'search_criteria' => $criteria,
        'sort' => [
            'by' => $sortBy,
            'order' => $sortOrder
        ],
        'summary' => [
            'total_found' => count($results),
            'photos' => count(array_filter($results, fn($r) => $r['type'] === 'photo')),
            'videos' => count(array_filter($results, fn($r) => $r['type'] === 'video')),
            'total_size' => array_sum(array_column($results, 'size')),
            'date_range' => [
                'earliest' => !empty($results) ? min(array_column($results, 'date')) : null,
                'latest' => !empty($results) ? max(array_column($results, 'date')) : null
            ]
        ],
        'generated_at' => date('c')
    ];

    echo json_encode($response, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Error en search.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Error en la búsqueda',
        'message' => $e->getMessage()
    ]);
}
?>
