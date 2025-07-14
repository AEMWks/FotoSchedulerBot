<?php
// web/api/export.php - API para exportar fotos y metadatos
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Función para crear archivo ZIP
function createZipExport($files, $exportName) {
    $tempDir = sys_get_temp_dir();
    $zipPath = "$tempDir/{$exportName}.zip";

    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
        throw new Exception('No se pudo crear el archivo ZIP');
    }

    foreach ($files as $file) {
        if (file_exists($file['path'])) {
            $zip->addFile($file['path'], $file['archive_name']);
        }
    }

    $zip->close();
    return $zipPath;
}

// Función para obtener archivos por criterios
function getFilesByCriteria($basePath, $criteria) {
    $files = [];

    if (isset($criteria['date'])) {
        // Exportar día específico
        $date = $criteria['date'];
        $files = getFilesForDate($basePath, $date);
    } elseif (isset($criteria['start_date']) && isset($criteria['end_date'])) {
        // Exportar rango de fechas
        $files = getFilesForDateRange($basePath, $criteria['start_date'], $criteria['end_date']);
    } elseif (isset($criteria['week'])) {
        // Exportar semana
        $files = getFilesForWeek($basePath, $criteria['week']);
    } elseif (isset($criteria['month'])) {
        // Exportar mes
        $files = getFilesForMonth($basePath, $criteria['month']);
    } else {
        // Exportar todo
        $files = getAllFiles($basePath);
    }

    return $files;
}

function getFilesForDate($basePath, $date) {
    $files = [];
    list($year, $month, $day) = explode('-', $date);
    $dirPath = "$basePath/$year/$month/$day";

    if (is_dir($dirPath)) {
        $handle = opendir($dirPath);
        if ($handle) {
            while (false !== ($file = readdir($handle))) {
                if (preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $file)) {
                    $files[] = [
                        'path' => "$dirPath/$file",
                        'archive_name' => "$date/$file",
                        'filename' => $file,
                        'date' => $date,
                        'size' => filesize("$dirPath/$file")
                    ];
                }
            }
            closedir($handle);
        }
    }

    return $files;
}

function getFilesForDateRange($basePath, $startDate, $endDate) {
    $files = [];
    $currentDate = new DateTime($startDate);
    $endDate = new DateTime($endDate);

    while ($currentDate <= $endDate) {
        $dateStr = $currentDate->format('Y-m-d');
        $files = array_merge($files, getFilesForDate($basePath, $dateStr));
        $currentDate->add(new DateInterval('P1D'));
    }

    return $files;
}

function getFilesForWeek($basePath, $weekDate) {
    $date = new DateTime($weekDate);
    $weekStart = clone $date;
    $weekStart->modify('monday this week');
    $weekEnd = clone $weekStart;
    $weekEnd->add(new DateInterval('P6D'));

    return getFilesForDateRange($basePath, $weekStart->format('Y-m-d'), $weekEnd->format('Y-m-d'));
}

function getFilesForMonth($basePath, $monthDate) {
    $date = new DateTime($monthDate . '-01');
    $monthStart = $date->format('Y-m-01');
    $monthEnd = $date->format('Y-m-t');

    return getFilesForDateRange($basePath, $monthStart, $monthEnd);
}

function getAllFiles($basePath) {
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

            if (preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $filename)) {
                $pathParts = explode('/', $relativePath);
                if (count($pathParts) >= 4) {
                    $year = $pathParts[0];
                    $month = $pathParts[1];
                    $day = $pathParts[2];
                    $date = "$year-$month-$day";

                    $files[] = [
                        'path' => $file->getPathname(),
                        'archive_name' => $relativePath,
                        'filename' => $filename,
                        'date' => $date,
                        'size' => $file->getSize()
                    ];
                }
            }
        }
    }

    return $files;
}

function createMetadataJson($files) {
    $metadata = [];
    $stats = [
        'total_files' => count($files),
        'total_size' => 0,
        'photos' => 0,
        'videos' => 0,
        'export_date' => date('c')
    ];

    foreach ($files as $file) {
        $date = $file['date'];
        if (!isset($metadata[$date])) {
            $metadata[$date] = [];
        }

        $isVideo = preg_match('/\.mp4$/i', $file['filename']);
        $stats['total_size'] += $file['size'];

        if ($isVideo) {
            $stats['videos']++;
        } else {
            $stats['photos']++;
        }

        // Extraer timestamp del nombre del archivo
        $timestamp = '';
        if (preg_match('/(\d{2})-(\d{2})-(\d{2})/', $file['filename'], $matches)) {
            $timestamp = $matches[1] . ':' . $matches[2] . ':' . $matches[3];
        }

        $metadata[$date][] = [
            'filename' => $file['filename'],
            'timestamp' => $timestamp,
            'type' => $isVideo ? 'video' : 'photo',
            'size' => $file['size'],
            'size_mb' => round($file['size'] / (1024 * 1024), 2)
        ];
    }

    return [
        'stats' => $stats,
        'files_by_date' => $metadata
    ];
}

try {
    $photosBasePath = $_ENV['PHOTOS_PATH'] ?? '/data/fotos';

    // Obtener parámetros
    $format = $_GET['format'] ?? 'zip'; // zip | json
    $type = $_GET['type'] ?? 'day'; // day | week | month | range | all

    // Criterios de exportación
    $criteria = [];

    switch ($type) {
        case 'day':
            if (!isset($_GET['date'])) {
                throw new Exception('Fecha requerida para exportación diaria');
            }
            $criteria['date'] = $_GET['date'];
            $exportName = "fotos_" . $_GET['date'];
            break;

        case 'week':
            if (!isset($_GET['date'])) {
                throw new Exception('Fecha requerida para exportación semanal');
            }
            $criteria['week'] = $_GET['date'];
            $exportName = "fotos_semana_" . $_GET['date'];
            break;

        case 'month':
            if (!isset($_GET['month'])) {
                throw new Exception('Mes requerido para exportación mensual (YYYY-MM)');
            }
            $criteria['month'] = $_GET['month'];
            $exportName = "fotos_mes_" . $_GET['month'];
            break;

        case 'range':
            if (!isset($_GET['start_date']) || !isset($_GET['end_date'])) {
                throw new Exception('Fechas de inicio y fin requeridas para exportación por rango');
            }
            $criteria['start_date'] = $_GET['start_date'];
            $criteria['end_date'] = $_GET['end_date'];
            $exportName = "fotos_" . $_GET['start_date'] . "_" . $_GET['end_date'];
            break;

        case 'all':
            $exportName = "fotos_completo_" . date('Y-m-d');
            break;

        default:
            throw new Exception('Tipo de exportación no válido');
    }

    error_log("Iniciando exportación: tipo=$type, formato=$format");

    // Obtener archivos
    $files = getFilesByCriteria($photosBasePath, $criteria);

    if (empty($files)) {
        http_response_code(404);
        echo json_encode([
            'error' => 'No se encontraron archivos para exportar',
            'criteria' => $criteria
        ]);
        exit();
    }

    if ($format === 'json') {
        // Exportar solo metadatos como JSON
        header('Content-Type: application/json');
        header("Content-Disposition: attachment; filename=\"{$exportName}_metadata.json\"");

        $metadata = createMetadataJson($files);
        echo json_encode($metadata, JSON_PRETTY_PRINT);

    } else {
        // Exportar archivos como ZIP
        $zipPath = createZipExport($files, $exportName);

        if (!file_exists($zipPath)) {
            throw new Exception('Error creando archivo ZIP');
        }

        // Enviar archivo ZIP
        header('Content-Type: application/zip');
        header("Content-Disposition: attachment; filename=\"{$exportName}.zip\"");
        header('Content-Length: ' . filesize($zipPath));

        // Streaming del archivo
        $handle = fopen($zipPath, 'rb');
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

        // Limpiar archivo temporal
        unlink($zipPath);
    }

} catch (Exception $e) {
    error_log("Error en export.php: " . $e->getMessage());

    // Si ya se enviaron headers, no podemos cambiar el content-type
    if (!headers_sent()) {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode([
            'error' => 'Error en la exportación',
            'message' => $e->getMessage()
        ]);
    } else {
        echo "Error: " . $e->getMessage();
    }
}
?>
